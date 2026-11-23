"""PC 시안의 홍보 페이지(PC_Landing.dc.html)를 그려서 정적 HTML 조각으로 저장한다.
캔버스 미리보기 도구(sbx.html, localhost:8765)가 떠 있어야 한다. 결과: design/landing/landing.html
  python3 tools/snap-landing.py
- 메뉴 버튼은 같은 페이지 안 링크(#before 등)로, 로그인과 팀 만들기는 실제 앱(team/)으로 바꾼다
- 휴대폰 화면 4개는 그림처럼 보이게 누를 수 없게 한다 (inert)
- 캔버스용 '글자 끌어서 선택 막기'는 홍보 페이지에서는 뺀다"""
import asyncio, pathlib
from playwright.async_api import async_playwright
OUT = pathlib.Path(__file__).resolve().parent.parent / "design/landing/landing.html"
JS = r"""() => {
  const root = document.getElementById('root').cloneNode(true);
  const JUMP = { '달라지는 점': '#before', '화면 보기': '#screens', '실제 화면 보기': '#screens', '시작하는 법': '#start', '다른 팀과': '#pc' };
  root.querySelectorAll('button').forEach(b => {
    const t = b.textContent.trim(); let href = JUMP[t];
    if (b.getAttribute('aria-label') === '매니볼 처음으로') href = '#top';
    if (!href) return;
    const a = document.createElement('a'); a.href = href;
    for (const at of b.attributes) if (at.name !== 'type') a.setAttribute(at.name, at.value);
    a.innerHTML = b.innerHTML; a.style.textDecoration = 'none'; b.replaceWith(a);
  });
  root.querySelectorAll('a').forEach(a => {
    const t = a.textContent.trim();
    if (/로그인|우리 팀 만들기|카카오로 시작하기|시작하기/.test(t) && !a.getAttribute('href')?.startsWith('#')) a.setAttribute('href', 'team/');
    a.removeAttribute('tabindex');
  });
  root.querySelectorAll('.phone').forEach(p => {
    const s = p.querySelector('.screen'); const cap = p.querySelector('.cap b');
    if (s) { s.setAttribute('inert', ''); s.setAttribute('role', 'img'); s.setAttribute('aria-label', '매니볼 화면: ' + (cap ? cap.textContent : '')); }
  });
  root.querySelectorAll('p.sub').forEach(p => { if (p.textContent.includes('눌러 볼 수도 있어요')) p.textContent = '팀원이 매주 쓰는 실제 화면이에요.'; });
  root.querySelectorAll('.foot span span').forEach(s => { if (s.textContent.trim() === '개인정보처리방침과 이용약관') { const a = document.createElement('a'); a.href = '../privacy.html'; a.textContent = s.textContent; s.replaceWith(a); } });
  const lp = root.querySelector('.lp'); if (lp) lp.id = 'top';
  const seen = new Set(); const css = [];
  document.querySelectorAll('style').forEach(st => { const t = st.textContent; if (!seen.has(t)) { seen.add(t); css.push(t); } });
  let html = root.innerHTML;
  const strip = s => s.replace(/-webkit-user-select:\s*none;?\s*/g, '').replace(/user-select:\s*none;?\s*/g, '').replace(/-webkit-touch-callout:\s*none;?\s*/g, '');
  return { css: strip(css.join('\n')), html: strip(html) };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 1440, "height": 1100})
        await pg.goto("http://localhost:8765/sbx.html?f=PC_Landing.dc.html"); await asyncio.sleep(0.3)
        fr = pg.frames[1]; await fr.wait_for_selector("body[data-done]", timeout=20000); await asyncio.sleep(1.5)
        r = await fr.evaluate(JS)
        OUT.write_text(f"<style>\n{r['css']}\n</style>\n{r['html']}\n", encoding="utf-8")
        print(OUT, OUT.stat().st_size)
        await b.close()
asyncio.run(main())
