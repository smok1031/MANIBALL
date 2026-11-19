// 매니볼 알림 받기 전용 서비스 워커. 화면 파일은 저장(캐시)하지 않는다.
// 알림이 오면 띄우고, 누르면 그 팀의 해당 화면을 연다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  const u = new URL(self.registration.scope);
  if (/^[0-9a-f-]{36}$/.test(d.team || "")) u.searchParams.set("team", d.team);
  u.hash = String(d.url || "#/").replace(/^#?/, "");
  e.waitUntil(self.registration.showNotification(d.title || "매니볼", {
    body: d.body || "", tag: d.tag || undefined, icon: "icon-192.png", badge: "badge-96.png", data: { url: u.href },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.registration.scope)) {
        try { await c.navigate(target); } catch (x) { /* 못 바꾸면 그대로 */ }
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
