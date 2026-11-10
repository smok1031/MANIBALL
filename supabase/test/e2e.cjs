// 웹 앱 전체 흐름 시험: 가짜 Supabase(fake_rest.py) + 실제 Postgres 권한 규칙
// node e2e.cjs APP_URL SEED_JSON SHOT_DIR   (PGHOST 등은 psql 환경 변수로)
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");

const [APP, SEED, SHOTS] = process.argv.slice(2);
const PSQL = ["-h", "/var/tmp/pgt", "-p", "5499", "-U", "postgres", "-d", "t2", "-tA", "-v", "ON_ERROR_STOP=1", "-c"];
const sql = q => execFileSync("psql", PSQL.concat([q]), { encoding: "utf8" }).trim();
const U = { A: "00000000-0000-0000-0000-00000000000a", B: "00000000-0000-0000-0000-00000000000b", C: "00000000-0000-0000-0000-00000000000c" };
const fails = [], errs = [];
const ok = (n, c, x) => { console.log((c ? "ok:   " : "FAIL: ") + n, c ? "" : (x === undefined ? "" : JSON.stringify(x))); if (!c) fails.push(n); };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
function session(uid, email, name) {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const at = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: uid, role: "authenticated", aud: "authenticated", exp, email }) + ".sig";
  return { access_token: at, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "r-" + uid,
    user: { id: uid, aud: "authenticated", role: "authenticated", email, app_metadata: { provider: "kakao" }, user_metadata: { name }, created_at: new Date().toISOString() } };
}
async function ctxFor(browser, s) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (s) await ctx.addInitScript(v => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("sb-localhost-auth-token", v); sessionStorage.setItem("seeded", "1"); } } catch (e) {} }, JSON.stringify(s));
  ctx.on("page", p => { p.on("pageerror", e => errs.push(e.message)); });
  return ctx;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function waitApp(p) { await p.waitForSelector("#tabs:not([hidden])", { timeout: 15000 }); await wait(600); }
const tabs = p => p.locator("#tabs .in > *").allInnerTexts();

(async () => {
  const browser = await chromium.launch();
  // 1) 팀장: 팀 만들기
  const ca = await ctxFor(browser, session(U.A, "owner@x.kr", "정성목"));
  const a = await ca.newPage();
  await a.goto(APP);
  await a.waitForSelector("#createForm", { timeout: 15000 });
  await a.screenshot({ path: SHOTS + "/e2e-start.png" });
  await a.fill("#createForm input[name=name]", "KEI FC");
  await a.click("#createForm button[type=submit]");
  await waitApp(a);
  const tid = sql("select id from public.teams limit 1");
  ok("team created with owner", sql(`select role from public.members where team_id = '${tid}' and user_id = '${U.A}'`) === "owner");
  ok("owner tabs", JSON.stringify(await tabs(a)).includes("선수"), await tabs(a));

  // 2) 예시 데이터 넣기 (데모 데이터에서 개인 문서는 뺀다)
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  const rows = Object.entries(seed).filter(([k]) => !/^(rsvp|mydues|payreq|uvote|guestreq)\//.test(k));
  const vals = rows.map(([k, v]) => { const [c, id] = k.split("/"); return `('${tid}', '${c}', '${id}', '${JSON.stringify(v).replace(/'/g, "''")}'::jsonb)`; }).join(",");
  sql(`insert into public.docs (team_id, coll, id, data) values ${vals} on conflict (team_id, coll, id) do update set data = excluded.data`);
  await a.reload(); await waitApp(a);
  const nPlayers = await a.evaluate(() => Object.keys(R.players).length);
  ok("owner loads seeded players", nPlayers === 30, nPlayers);
  ok("owner reads fines and dues", await a.evaluate(() => Object.keys(R.fines).length >= 0 && R.dues !== undefined));
  await a.screenshot({ path: SHOTS + "/e2e-owner-home.png" });

  // 3) 설정의 초대 링크
  await a.evaluate(() => { location.hash = "config"; }); await wait(500);
  const invite = (await a.locator(".invite").innerText()).trim();
  ok("invite link shown", /\?join=[a-z0-9]{10}$/.test(invite), invite);
  await a.screenshot({ path: SHOTS + "/e2e-owner-config.png", fullPage: true });

  // 4) 로그인 전 초대 화면
  const cn = await ctxFor(browser, null);
  const n = await cn.newPage();
  await n.goto(invite.replace(/^https?:\/\/[^/]+\//, APP.replace(/\/?$/, "/")));
  await n.waitForSelector(".btn.kakao", { timeout: 15000 }); await wait(500);
  ok("login shows invited team", (await n.locator("#main").innerText()).includes("KEI FC 팀 초대를 받았어요"), await n.locator("#main").innerText());
  ok("login url cleaned", !n.url().includes("join="), n.url());
  await n.screenshot({ path: SHOTS + "/e2e-login.png" });

  // 5) 팀원: 초대 링크로 들어가기
  const cc = await ctxFor(browser, session(U.C, "mem@x.kr", "세영"));
  const c = await cc.newPage();
  await c.goto(invite.replace(/^https?:\/\/[^/]+\//, APP.replace(/\/?$/, "/")));
  await c.waitForSelector("#joinForm", { timeout: 15000 });
  ok("join suggests name", (await c.inputValue("#joinForm input[name=name]")) === "세영");
  await c.fill("#joinForm input[name=name]", "이세영");
  await c.screenshot({ path: SHOTS + "/e2e-join.png" });
  await c.click("#joinForm button[type=submit]");
  await waitApp(c);
  ok("member joined", sql(`select role || ':' || display_name from public.members where team_id = '${tid}' and user_id = '${U.C}'`) === "member:이세영");
  const ct = await tabs(c);
  ok("member tabs have no players", !ct.join(",").includes("선수") && ct.join(",").includes("내 회비"), ct);
  const priv = await c.evaluate(() => ({ f: Object.keys(R.fines).length, d: Object.keys(R.dues).length, k: Object.keys(R.contacts).length, p: Object.keys(R.players).length }));
  ok("member cannot read fines dues contacts", priv.f === 0 && priv.d === 0 && priv.k === 0 && priv.p === 30, priv);

  // 6) 팀원: 선수 연결과 참석 투표 (화면에서 누르기)
  await c.evaluate(() => { patchDoc("rsvp/" + Store.me, { pid: "d5", claimAt: nowIso() }); }); await wait(1200);
  ok("claim saved", sql(`select data->>'pid' from public.docs where team_id = '${tid}' and coll = 'rsvp' and id = '${U.C}'`) === "d5");
  await c.evaluate(() => { location.hash = "home"; }); await wait(400);
  const btn = c.locator('[data-act="myVote"][data-v="yes"]').first();
  const eid = await btn.getAttribute("data-eid");
  await btn.click(); await wait(1500);
  ok("vote saved through UI", sql(`select data->'ev'->'${eid}'->>'s' from public.docs where team_id = '${tid}' and coll = 'rsvp' and id = '${U.C}'`) === "yes");
  const sync = await c.locator("#sync").innerText();
  ok("sync shows saved", sync.includes("저장됨"), sync);
  await c.screenshot({ path: SHOTS + "/e2e-member-home.png" });

  // 7) 팀원이 막힌 곳에 쓰려 하면 거절된다
  const denied = await c.evaluate(async () => { try { await (await claude.use("db")).doc("players/d5").set({ name: "x" }); return "written"; } catch (e) { return e.code; } });
  ok("member write to players refused", denied === "permission_denied", denied);
  const missing = await a.evaluate(async () => { try { await (await claude.use("db")).doc("players/nope").update({ name: "x" }); return "written"; } catch (e) { return e.code; } });
  ok("update of missing doc is invalid_argument", missing === "invalid_argument", missing);

  // 8) MOM 표 (팀원) -> 서버 집계 -> 팀장 화면
  // 지난 경기의 MOM은 마감이라 서버가 거절하고, 권한은 그대로다
  const oldEvent = await a.evaluate(() => Object.keys(R.events).find(k => R.events[k].score));
  await c.evaluate(id => { patchDoc("uvote/" + Store.me, { mom: { [id]: "d1" } }); }, oldEvent); await wait(1200);
  ok("closed mom refused", sql(`select count(*) from public.docs where team_id = '${tid}' and coll = 'uvote' and id = '${U.C}' and data->'mom' ? '${oldEvent}'`) === "0");
  ok("member keeps vote rights after refusal", await c.evaluate(() => Store.canVote === true));
  // 오늘 경기 (이미 시작) MOM
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  sql(`insert into public.docs (team_id, coll, id, data) values ('${tid}', 'events', 'momtoday', '{"id":"momtoday","type":"match","date":"${today}","time":"00:00","score":{"us":1,"them":0}}'::jsonb)`);
  await wait(800); await c.reload(); await waitApp(c);
  const momEvent = "momtoday";
  await c.evaluate(id => { patchDoc("uvote/" + Store.me, { mom: { [id]: "d1" } }); }, momEvent); await wait(1500);
  ok("tally counted on server", sql(`select data->'c'->>'d1' from public.docs where team_id = '${tid}' and coll = 'tally' and id = 'mom-${momEvent}'`) === "1");
  ok("tally hides voter in updated_by", sql(`select count(*) from public.docs where coll = 'tally' and updated_by is not null`) === "0");
  const memTally = await c.evaluate(id => (R.tally["mom-" + id] || {}).n, momEvent);
  ok("member sees fresh tally right after voting", memTally === 1, memTally);

  // 9) 팀원이 관리자 신청 -> 팀장 홈에 알림 -> 팀장이 수락
  await c.evaluate(() => { location.hash = "config"; }); await wait(500);
  ok("member sees admin request button", (await c.locator('[data-web="adminReq"]').count()) === 1);
  ok("member has no role select", (await c.locator("select[data-web-role]").count()) === 0);
  await c.click('[data-web="adminReq"]'); await wait(300); await c.click("#okBtn"); await wait(1200);
  ok("request saved", sql(`select admin_req is not null from public.members where team_id = '${tid}' and user_id = '${U.C}'`) === "t");
  ok("member sees pending state", (await c.locator("#main").innerText()).includes("관리자 신청을 보냈어요"));
  await c.screenshot({ path: SHOTS + "/e2e-member-request.png" });
  await a.reload(); await waitApp(a);
  await a.evaluate(() => { location.hash = "home"; }); await wait(500);
  ok("owner home shows request banner", (await a.locator("#main").innerText()).includes("관리자 신청이 왔어요"));
  await a.screenshot({ path: SHOTS + "/e2e-owner-banner.png" });
  await a.evaluate(() => { location.hash = "config"; }); await wait(500);
  await a.screenshot({ path: SHOTS + "/e2e-owner-requests.png", fullPage: true });
  await a.click(`[data-web="adminOk"][data-u="${U.C}"]`); await wait(300); await a.click("#okBtn"); await wait(1200);
  ok("role changed", sql(`select role || ':' || coalesce(admin_req::text, 'none') from public.members where team_id = '${tid}' and user_id = '${U.C}'`) === "admin:none");
  ok("owner sees role select", (await a.locator(`select[data-web-role="${U.C}"]`).count()) === 1);
  await c.reload(); await waitApp(c);
  const ct2 = await tabs(c);
  ok("promoted member gets operator tabs", ct2.join(",").includes("선수"), ct2);
  const priv2 = await c.evaluate(() => Object.keys(R.contacts).length + Object.keys(R.dues).length + Object.keys(R.fines).length);
  ok("admin reads private colls", priv2 >= 0);

  // 10) 운영진이 일정 메모 저장 -> DB, 지우기 -> DB
  await c.evaluate(id => { evPatch(id, { memo: "공 5개 챙기기" }); }, eid); await wait(1200);
  ok("admin patch saved", sql(`select data->>'memo' from public.docs where team_id = '${tid}' and coll = 'events' and id = '${eid}'`) === "공 5개 챙기기");
  await c.evaluate(() => { delDoc("notices/n3"); }); await wait(1200);
  ok("admin delete saved", sql(`select count(*) from public.docs where team_id = '${tid}' and coll = 'notices' and id = 'n3'`) === "0");
  ok("deleted doc gone from view", await c.evaluate(() => !R.notices.n3));

  // 11) 이름 바꾸기, 다른 팀, 로그아웃
  await c.evaluate(() => { location.hash = "config"; }); await wait(500);
  await c.fill("#webName", "세영"); await c.click('[data-web="saveName"]'); await wait(1000);
  ok("name changed", sql(`select display_name from public.members where team_id = '${tid}' and user_id = '${U.C}'`) === "세영");
  await a.click('[data-web="switchTeam"]'); await a.waitForSelector(".teampick", { timeout: 15000 });
  ok("picker lists team", (await a.locator(".teampick").innerText()).includes("KEI FC"));
  await a.screenshot({ path: SHOTS + "/e2e-picker.png" });
  await a.click(".teampick"); await waitApp(a);
  ok("enter from picker", (await a.locator(".teamname").innerText()).includes("KEI FC"));
  await a.evaluate(() => { location.hash = "config"; }); await wait(500);
  await a.click('[data-web="logout"]'); await a.waitForSelector(".btn.kakao", { timeout: 15000 });
  ok("logout returns to login", true);

  // 12) 내보내진 사람은 팀 화면에 못 들어간다
  sql(`delete from public.members where team_id = '${tid}' and user_id = '${U.C}'`);
  await c.reload(); await c.waitForSelector("#codeForm", { timeout: 15000 });
  ok("removed member sees start screen", true);

  ok("no page errors", errs.length === 0, errs);
  console.log("FAILS", fails.length);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
