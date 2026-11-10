// design/app/*.dc.html(디자인 캔버스의 모바일 화면)을 눌러 볼 수 있는 정적 페이지로 바꾼다.
// 결과: public/v2/app/<이름>.html, public/v2/app/index.html (화면 목록)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const ACCENT = "#15803D";
const SRC = new URL("../design/app/", import.meta.url);
const OUT = new URL("../public/v2/app/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// 시트처럼 한 화면 높이에 고정된 화면은 캔버스 원본의 고정 높이(height: 844px; overflow: hidden)로 알아낸다

const GROUPS = [
  ["팀 만들기", ["TeamSplit", "InviteMessage", "InviteRoster"]],
  ["팀원 가입 (초대 링크로 들어왔을 때)", ["JoinInvite", "JoinProfile", "JoinRules"]],
  ["운영진 홈", ["HomeAdmin", "NotifyAdmin", "NoticeAdmin", "NoticeAdminWrite"]],
  ["운영진 일정", ["ScheduleAdmin", "AdminRemind", "AdminRemindLocked", "AdminLineup", "AdminFormation", "AdminRestTable", "AdminLineupShare", "AdminCheckIn", "AdminGuestAdd", "AdminCheckInDone", "AdminSquad", "AdminOpenNow", "AdminOpenNowDeadline", "AdminCreate", "AdminCreateDate", "AdminCreateDeadline", "AdminEdit", "AdminEditDate", "AdminEditDeadline", "AdminDeleteConfirm", "AdminScrimOffer", "AdminScrimNotify", "AdminScrimDone", "AdminScrimKeep", "AdminScrimKept", "AdminGuestRequests", "AdminCalendar"]],
  ["운영진 기록", ["RecordAdmin", "RecordAdminSeason", "RecordAdminPlayers", "RecordAdminMatch", "RecordAdminScrim", "RecordAdminResult", "RecordAdminVoting", "RecordAdminEditScrim", "RecordAdminEditGame", "RecordAdminEditDraw"]],
  ["운영진 회비", ["DuesAdmin", "DuesAdminSettings", "DuesAdminConfirmed", "DuesAdminRemind", "DuesAdminReminded", "DuesAdminLedger", "DuesAdminSpend", "DuesAdminUpload", "DuesAdminMatched", "DuesAdminApplied"]],
  ["운영진 선수", ["PlayersAdmin", "PlayersAdminInvite", "PlayersAdminRules", "PlayersAdminDetail", "PlayersAdminPromote", "PlayersAdminPromoted", "PlayersAdminRemove", "PlayersAdminRemoved", "PlayersAdminUniform"]],
  ["팀원 홈", ["Home5", "NotifyMember"]],
  ["팀원 일정", ["ScheduleMember", "ScheduleMemberAttend", "ScheduleMemberLate", "ScheduleMemberAbsent", "ScheduleMemberChange", "ScheduleMemberCalendar", "ScheduleMemberRoster", "ScheduleMemberGuest", "ScheduleMemberGuestSent"]],
  ["팀원 기록", ["RecordMember", "RecordMemberSeason", "RecordMemberMatch", "RecordMemberScrim", "RecordMemberPending", "RecordMemberScrimView", "RecordMemberGame", "RecordMemberMissed"]],
  ["팀원 회비", ["DuesMember", "DuesMemberPay", "DuesMemberSent", "DuesMemberLedger"]],
  ["팀원 선수", ["PlayersMember", "PlayersMemberProfile", "PlayersMemberEdit", "PlayersMemberPosition", "PlayersMemberRequested"]],
];

const titles = {};
// 목록에는 디자인 캔버스에 붙인 이름을 그대로 쓴다
const boardTitles = Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL("canvas.json", SRC), "utf8")).boards).map(([k, v]) => [k.replace(".dc.html", ""), v.title]));
for (const f of readdirSync(SRC).filter(f => f.endsWith(".dc.html"))) {
  const name = f.replace(".dc.html", "");
  const src = readFileSync(new URL(f, SRC), "utf8");
  const title = (src.match(/<title>([^<]*)<\/title>/) || [, name])[1];
  titles[name] = boardTitles[name] || title;
  const helmet = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  let body = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>")).replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();
  // 캔버스에서 상태로 움직이게 바꾼 화면은 화면 로직을 함께 싣는다 (proto.js가 같은 로직으로 그린다)
  const live = src.includes("/*maniball-interactive*/");
  if (!live && body.includes("{{") && body.replaceAll("{{accent}}", "").includes("{{")) throw new Error("unknown hole in " + f);
  body = body
    .replaceAll("{{accent}}", ACCENT)
    .replace(/href="([A-Za-z0-9]+)\.dc\.html"/g, 'href="$1.html"');
  // 팀 만들기의 뒤로는 홈페이지로
  body = body.replace(/href="Main\.html"/g, 'href="../"');
  // 캔버스용 고정 높이를 실제 휴대폰 화면 높이로
  body = body.replace(/^(<div style="width: 100%; max-width: 480px; box-sizing: border-box; )(height|min-height): \d+px;/,
    (m, a, kind) => a + (kind === "height" ? "height: 100dvh;" : "min-height: 100dvh;"));
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} | 매니볼</title>
<meta name="robots" content="noindex">
${helmet.trim()}
<style>html{background:#E5E7EB}body{background:#E5E7EB}a{-webkit-tap-highlight-color:transparent}a[href="#"]{cursor:default}</style>
</head>
<body>
${live ? `<div id="dc-root"></div>
<template id="dc-tpl">${body}</template>
<script type="text/x-dc" id="dc-code">${src.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]}</script>` : body}
<script src="proto.js"></script>
</body>
</html>
`;
  writeFileSync(new URL(`${name}.html`, OUT), html);
}

writeFileSync(new URL("proto.js", OUT), readFileSync(new URL("proto.js", import.meta.url)));

// 목록에 빠진 화면이 있으면 알려 준다
const listed = new Set(GROUPS.flatMap(([, n]) => n));
const unlisted = Object.keys(titles).filter(n => !listed.has(n));
if (unlisted.length) console.warn("목록에 없는 화면:", unlisted.join(", "));

const list = GROUPS.map(([g, names]) => `
  <section style="display: flex; flex-direction: column; gap: 8px">
    <b style="font-size: 13px; font-weight: 900; color: ${ACCENT}; padding: 0 4px">${g}</b>
    <div style="background: #FFFFFF; border-radius: 18px; overflow: hidden">${names.filter(n => titles[n]).map(n =>
      `<a href="${n}.html" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #F3F4F6; color: #111827; text-decoration: none; font-size: 15px">${titles[n]}<span style="color: #9CA3AF">›</span></a>`).join("")}</div>
  </section>`).join("");

writeFileSync(new URL("index.html", OUT), `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>화면 둘러보기 | 매니볼</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<style>body{margin:0;background:#E5E7EB}</style>
</head>
<body>
<div style="width: 100%; max-width: 480px; box-sizing: border-box; min-height: 100dvh; margin: 0 auto; background: #F6F7F9; font-family: 'Noto Sans KR', sans-serif; color: #111827; padding: 24px 16px 40px; display: flex; flex-direction: column; gap: 18px; word-break: keep-all">
  <a href="../" style="color: #6B7280; text-decoration: none; font-size: 14px">‹ 홈페이지</a>
  <div><h1 style="font-size: 26px; font-weight: 900; letter-spacing: -0.6px; margin: 0 0 6px">화면 둘러보기</h1>
  <p style="margin: 0; color: #4B5563; font-size: 14px; line-height: 1.6">지금까지 만든 디자인이에요. 버튼을 눌러 화면 사이를 오갈 수 있어요. 내용은 예시이고 저장되지 않아요.</p></div>
  ${list}
</div>
</body>
</html>
`);
console.log("public/v2/app", Object.keys(titles).length, "screens");
