// 매니볼 휴대폰 알림 발송 함수 (Supabase Edge Function "push", JWT 확인은 끄고 아래에서 직접 확인)
//  - 앱: { action: "key" }  로그인한 사람에게 구독용 공개 키를 준다 (키가 없으면 여기서 처음 만든다)
//  - 앱: { action: "test" } 로그인한 사람의 기기에 "알림을 켰어요"를 보낸다
//  - DB: 헤더 x-cron-key 가 맞으면 쌓인 알림(push_outbox)을 보낸다 (pg_net이 깨움)
// 발송 키(VAPID)는 이 함수가 처음 한 번 만들어 DB(push_conf)에만 둔다. 밖으로 나가지 않는다.
// 외부 라이브러리 없이 WebCrypto로 웹 푸시 암호화(RFC 8291, aes128gcm)와 VAPID 서명(RFC 8292)을 한다.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// 테스트 프로젝트는 maniball 스키마, 운영은 public
const SCHEMA = SB_URL.includes("vlaiziklxvpykzsuvinn") ? "maniball" : "public";
const SUBJECT = "https://smok1031.github.io/MANIBALL/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ""; for (const c of u) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (s: string) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); const b = atob(t + "=".repeat((4 - t.length % 4) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const safeEq = (a: string, b: string) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Content-Profile": SCHEMA, "Accept-Profile": SCHEMA }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${name} ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

type Conf = { public: string | null; private: JsonWebKey | null; fn_url: string | null; cron_key: string };
async function conf(): Promise<Conf> {
  let c: Conf = await rpc("push_conf_get");
  if (!c.public || !c.private || !c.fn_url) {
    let pub = c.public, priv = c.private;
    if (!pub || !priv) {
      const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      pub = b64u(await crypto.subtle.exportKey("raw", k.publicKey)); priv = await crypto.subtle.exportKey("jwk", k.privateKey);
    }
    c = await rpc("push_conf_init", { p_public: pub, p_private: priv, p_url: `${SB_URL}/functions/v1/push` });
  }
  return c;
}

async function vapidAuth(endpoint: string, c: Conf) {
  const key = await crypto.subtle.importKey("jwk", c.private!, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${c.public}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

// RFC 8291: 받는 기기의 공개 키(p256dh)와 비밀(auth)로 내용을 암호화한다
export async function encrypt(payload: Uint8Array, p256dh: string, auth: string) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(enc.encode("WebPush: info\0"), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const k = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, k, cat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

type Sub = { endpoint: string; p256dh: string; auth: string };
// 결과: ok(받음), gone(구독 없어짐, 지움), retry(잠시 문제, 다시 시도)
async function sendOne(sub: Sub, msg: Record<string, unknown>, c: Conf): Promise<"ok" | "gone" | "retry"> {
  try {
    const body = await encrypt(enc.encode(JSON.stringify(msg)), sub.p256dh, sub.auth);
    const r = await fetch(sub.endpoint, { method: "POST", headers: { Authorization: await vapidAuth(sub.endpoint, c), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" }, body });
    await r.body?.cancel();
    if (r.status >= 200 && r.status < 300) return "ok";
    if (r.status === 404 || r.status === 410) return "gone";
    if (r.status === 400 || r.status === 403 || r.status === 413) { console.log("push rejected", r.status, new URL(sub.endpoint).host); return "gone"; }
    return "retry";
  } catch (e) { console.log("push error", String(e)); return "retry"; }
}

async function drain(c: Conf) {
  const t0 = Date.now(); let sent = 0;
  while (Date.now() - t0 < 25000) {
    const items: { id: number; team: string; title: string; body: string; url: string; tag: string; subs: Sub[] }[] = await rpc("push_take", { p_limit: 50 });
    if (!items.length) break;
    const done: number[] = [], gone: string[] = [], ok: string[] = [];
    await Promise.all(items.map(async it => {
      const res = await Promise.all(it.subs.map(s => sendOne(s, { title: it.title, body: it.body, url: it.url, tag: it.tag, team: it.team }, c).then(r => { if (r === "gone") gone.push(s.endpoint); if (r === "ok") ok.push(s.endpoint); return r; })));
      if (!res.length || res.some(r => r !== "retry")) done.push(it.id);
      sent += res.filter(r => r === "ok").length;
    }));
    await rpc("push_done", { p_ids: done, p_gone: gone, p_ok: ok });
    if (done.length < items.length) break; // 다시 시도할 것은 다음에 (1분마다 깨움)
  }
  return sent;
}

async function userOf(req: Request) {
  const a = req.headers.get("Authorization") ?? "";
  if (!/^Bearer \S+$/.test(a)) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON || SERVICE, Authorization: a } });
  if (!r.ok) return null;
  const u = await r.json(); return typeof u?.id === "string" ? u.id as string : null;
}

async function mySubs(uid: string): Promise<Sub[]> { return (await rpc("push_subs_of", { p_user: uid })) ?? []; }

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const cronKey = req.headers.get("x-cron-key");
    if (cronKey) {
      const c = await conf();
      if (!safeEq(cronKey, c.cron_key)) return json({ error: "forbidden" }, 403);
      return json({ sent: await drain(c) });
    }
    const uid = await userOf(req);
    if (!uid) return json({ error: "login_required" }, 401);
    const { action } = await req.json().catch(() => ({}));
    const c = await conf();
    if (action === "key") return json({ key: c.public });
    if (action === "test") {
      const subs = await mySubs(uid); const gone: string[] = [], ok: string[] = [];
      const res = await Promise.all(subs.map(s => sendOne(s, { title: "매니볼", body: "알림을 켰어요. 매니볼 소식이 여기로 와요", url: "#/", tag: "test" }, c).then(r => { if (r === "gone") gone.push(s.endpoint); if (r === "ok") ok.push(s.endpoint); return r; })));
      if (gone.length || ok.length) await rpc("push_done", { p_ids: [], p_gone: gone, p_ok: ok });
      return json({ sent: res.filter(r => r === "ok").length, devices: subs.length });
    }
    return json({ error: "action" }, 400);
  } catch (e) {
    console.log("push fn error", String(e));
    return json({ error: "server" }, 500);
  }
});
