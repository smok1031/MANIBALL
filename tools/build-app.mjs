// app-src의 팀 매니저 코드를 웹용 public/app.js, public/style.css로 묶는다.
// 화면과 기능은 아티팩트 앱과 같고, 권한 안내 문구와 시작 방법만 웹에 맞춘다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "app-src");
const read = n => readFileSync(join(SRC, n), "utf8");
let js = [1, 2, 3, 4, 7, 5, 6, 8].map(i => read(`a${i}.js`)).join("\n");

function rep(a, b) {
  if (!js.includes(a)) throw new Error("app-src에서 찾지 못함: " + a.slice(0, 90));
  js = js.replace(a, () => b);
}
const W = (web, art) => `\${window.__WEB ? ${JSON.stringify(web)} : ${JSON.stringify(art)}}`;
const T = (web, art) => `(window.__WEB ? ${JSON.stringify(web)} : ${JSON.stringify(art)})`;

// 1) 자동 시작 대신, 로그인과 팀 선택이 끝난 뒤 web.js가 시작한다
rep(`/* ---------- boot ---------- */
applyBig();
setSync();
initStore();`, `/* ---------- boot: 웹에서는 로그인과 팀 선택 뒤 web.js가 부른다 ---------- */
window.KEI_APP = { start() { applyBig(); setSync(); initStore(); } };`);

// 2) MOM, 설문, 읽음 집계는 서버 트리거가 맞추므로 운영진 기기가 따로 쓰지 않는다
rep("function syncTallies() {\n  if (!Store.canWrite", "function syncTallies() {\n  if (window.__WEB) return;\n  if (!Store.canWrite");

// 3) 권한 안내 문구: Claude 공유 대신 초대 링크와 팀장의 운영진 지정
rep(`toast("아직 팀원 권한이 없어 저장하지 못했어요. 운영진에게 '사용 가능' 권한을 요청해 주세요.");`,
  `toast(${T("팀 멤버가 아니라 저장하지 못했어요. 초대 링크로 다시 들어와 주세요.", "아직 팀원 권한이 없어 저장하지 못했어요. 운영진에게 '사용 가능' 권한을 요청해 주세요.")});`);
rep(`toast("운영진 권한이 없어 저장하지 못했어요. 링크 소유자에게 '편집 가능' 권한을 요청해 주세요.");`,
  `toast(${T("운영진만 바꿀 수 있어요. 팀장에게 운영진 지정을 요청해 주세요.", "운영진 권한이 없어 저장하지 못했어요. 링크 소유자에게 '편집 가능' 권한을 요청해 주세요.")});`);
rep(`toast(VOTE_ACTS.has(act) ? "아직 팀원 권한이 없어요. 운영진에게 '사용 가능' 권한을 요청해 주세요." : "운영진만 할 수 있어요.");`,
  `toast(VOTE_ACTS.has(act) ? ${T("팀 멤버만 할 수 있어요. 초대 링크로 들어와 주세요.", "아직 팀원 권한이 없어요. 운영진에게 '사용 가능' 권한을 요청해 주세요.")} : "운영진만 할 수 있어요.");`);
rep(`toast("링크 소유자만 할 수 있습니다.");`, `toast(${T("팀장만 할 수 있어요.", "링크 소유자만 할 수 있습니다.")});`);
rep("<b>아직 팀원 권한을 받지 않았어요.</b> 지금은 일정과 기록을 볼 수만 있어요. 참석 투표를 하려면 운영진에게 '사용 가능' 권한을 요청해 주세요.",
  `<b>아직 팀 멤버가 아니에요.</b> ${W("초대 링크로 다시 들어오면 참석 투표를 할 수 있어요.", "지금은 일정과 기록을 볼 수만 있어요. 참석 투표를 하려면 운영진에게 '사용 가능' 권한을 요청해 주세요.")}`);
rep(`<div style="font-size:14px;font-weight:700">Claude 계정 연결됨</div>`, `<div style="font-size:14px;font-weight:700">${W("", "Claude ")}계정 연결됨</div>`);
rep("되돌릴 수 없고, 링크 소유자만 할 수 있어요.", `되돌릴 수 없고, ${W("팀장만", "링크 소유자만")} 할 수 있어요.`);
rep(`placeholder="공유 메뉴에서 복사한 이 앱의 링크"`, `placeholder="${W("비워 두면 이 앱 주소가 들어가요", "공유 메뉴에서 복사한 이 앱의 링크")}"`);
// 설정의 권한 카드는 웹에서 팀 멤버 관리 카드로 바꾼다 (web.js의 webRoleCard)
rep(`  const roleCard = Store.mode === "db" ?`, `  const roleCard = window.__WEB && typeof window.webRoleCard === "function" ? window.webRoleCard() : Store.mode === "db" ?`);

// 4) 미리보기: 팀원 화면(?demo=member)과 운영진 화면(?demo=op)
rep(`  Store.real = { role: "member", canWrite: false, canMoney: false, canVote: true, isOwner: false };
  const D = makeDemo();`, `  Store.real = { role: "member", canWrite: false, canMoney: false, canVote: true, isOwner: false };
  const OP = window.__DEMO === "op";
  if (OP) { Object.assign(Store, { me: "demo-op", role: "owner", canWrite: true, canMoney: true, isOwner: true }); Store.real = { role: "owner", canWrite: true, canMoney: true, canVote: true, isOwner: true }; }
  const D = makeDemo();
  if (OP) demoOpExtras(D);`);
rep(`function makeDemo() {`, `// 운영진 미리보기에서 처리할 일이 보이도록 확인 요청을 몇 개 넣는다
function demoOpExtras(D) {
  const ME = D.rsvp["demo-me"].pid, pid = Object.keys(D.players).find(k => D.players[k].name === "황종민");
  D.rsvp["demo-op"] = { pid: Object.keys(D.players).find(k => D.players[k].name === "정성목"), claimAt: nowIso() };
  D.fines.df1 = { id: "df1", pid: ME, date: D.mydues["demo-me"].fines.df1.date, reason: "지각", amount: 2000, paid: false, presetId: "late" };
  D.payreq["demo-me"] = { items: { "fine-df1": { kind: "fine", ref: "df1", amount: 2000, label: "지각 벌금", pid: ME, at: new Date(Date.now() - 864e5).toISOString(), status: "req" } } };
  // 회비: 지난 달까지는 거의 다 냈고, 이번 달은 절반 남짓
  const ids = Object.keys(D.players), m = thisMonth();
  for (let k = 0; k <= 6; k++) { const mm = shiftMonth(m, -k); D.dues[mm] = {}; ids.forEach((id, i) => { if (k > 0 ? i % 13 !== 5 || k > 2 : i % 5 < 3) D.dues[mm][id] = "paid"; }); }
  const next = Object.values(D.events).filter(e => e.date > todayStr()).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  if (next && pid) D.guestreq["demo-g"] = { items: { gq1: { eid: next.id, name: "최민준", pos: "MF", pid, at: new Date(Date.now() - 3600e3).toISOString(), status: "req" } } };
}
function makeDemo() {`);
rep("if (window.__DEMO) html = `<div class=\"preview\"><b>팀원 화면 미리보기</b>예요. 예시 데이터라 눌러 봐도 실제 팀에는 저장되지 않아요.</div>` + html;",
  "if (window.__DEMO) html = `<div class=\"preview\"><b>${window.__DEMO === \"op\" ? \"운영진\" : \"팀원\"} 화면 미리보기</b>예요. 예시 데이터라 눌러 봐도 실제 팀에는 저장되지 않아요.${window.__WEB ? ` <a class=\"linkbtn\" href=\"?demo=${window.__DEMO === \"op\" ? \"member\" : \"op\"}\">${window.__DEMO === \"op\" ? \"팀원\" : \"운영진\"} 화면 보기</a>` : \"\"}</div>` + html;");

if (js.includes("\u00b7")) throw new Error("가운뎃점이 들어 있음");
mkdirSync(join(ROOT, "public"), { recursive: true });
writeFileSync(join(ROOT, "public", "app.js"), js);
const css = read("css.css") + "\n" + readFileSync(join(ROOT, "src", "web.css"), "utf8");
if (css.includes("\u00b7")) throw new Error("가운뎃점이 들어 있음");
writeFileSync(join(ROOT, "public", "style.css"), css);
console.log("app.js", js.length, "style.css", css.length);
