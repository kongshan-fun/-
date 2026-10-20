#!/usr/bin/env python3
"""全 H5 Chromium 响应式验收（与版本号无关，P0-2 修复版）。

相对旧版 v908_browser_responsive.py 的修复：
  1. 不再硬编码 V90.8 发布文件 —— 自动找出与 index.html **字节一致**的 releases/*.html，
     找不到就报错（这本身就是一条一致性断言）。
  2. 浏览器启动改为三级回退：msedge → chrome → playwright 自带 chromium。
     旧版写死 channel="chrome"，Windows 上没有 Chrome 直接失败，CI 里也没装。
  3. viewport 一律通过 browser.new_context(viewport={...}) 设置（new_page 不接受该参数），
     每个视口独立 context，避免上一个视口的尺寸/滚动状态串味。
  4. 结果与截图目录、输出文案不再带 V90.8 字样。

产物：artifacts/browser-responsive/  （results.json + 每个视口的截图）
"""
from __future__ import annotations
import functools, http.server, json, os, pathlib, re, tempfile, threading, traceback
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "browser-responsive"
VIEWPORTS = [(320, 568), (360, 640), (390, 844), (412, 915), (1080, 1920), (1440, 900)]
GEAR_COUNTS = [2, 3, 10, 36]

AUDIT_HOOK = r"""
window.__LAYOUT_AUDIT = {
  gear(count) {
    game = new QGame();
    activeRole='human'; activeSlot=1; frontPage=null; panel='character';
    modal=null; travelOpen=false; mapOpen=false;
    characterGearFilter='all'; characterGearSort='quality';
    characterSelectedKey=''; characterGearResetScroll=true;
    const weapons=D.RECIPES.filter(r=>r.gear==='weapon'&&!r.secret);
    const armors=D.RECIPES.filter(r=>r.gear==='armor'&&!r.secret);
    if(!weapons.length||!armors.length)throw Error('Missing weapon/armor recipes');
    game.s.gears=[]; game.s.equipped.weapon=null; game.s.equipped.armor=null;
    for(let i=0;i<count;i++){
      const r=i%2===0?weapons[Math.floor(i/2)%weapons.length]:armors[Math.floor(i/2)%armors.length];
      const gear=game.createGear(r.id,Math.min(4,i%5),'browser-audit');
      game.s.gears.push(gear);
      if(i===0)game.s.equipped.weapon=gear.id;
      if(i===1)game.s.equipped.armor=gear.id;
    }
    renderPage(); render();
    return game.s.gears.length;
  },
  archive(page=0) {
    slotPage=page; selectedRole='human'; showPage({kind:'slots',role:'human'});
  },
  buildings() {
    game=new QGame();
    activeRole='human'; activeSlot=1; frontPage=null;panel='camp';
    const s=game.s,zone=s.zone;
    s.settlements[zone]={pos:{...s.pos},level:3,
      buildings:{warehouse:3,forge:3,alchemy:3,quiet:3,farm:3},
      stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
    renderPage();render();
  }
};
"""


def bounds(page, selector):
    return page.locator(selector).first.evaluate("""e=>{
      let b=e.getBoundingClientRect();
      return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height,
        scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,
        scrollTop:e.scrollTop,overflowY:getComputedStyle(e).overflowY};
    }""")


def ensure(condition, message):
    if not condition:
        raise AssertionError(message)


def detect_release(index_bytes: bytes) -> tuple[pathlib.Path, str]:
    """找出与 index.html 字节一致的发布文件，并返回它的版本串。"""
    hits = [p for p in sorted((ROOT / "releases").glob("*.html")) if p.read_bytes() == index_bytes]
    ensure(hits, "releases/ 里没有与 index.html 字节一致的发布文件")
    release = hits[0]
    m = re.search(r"_V(\d+\.\d+)", release.name)
    ensure(m, f"发布文件名里没有版本号：{release.name}")
    return release, "V" + m.group(1)


def launch_browser(p):
    args = ["--no-sandbox", "--disable-dev-shm-usage"]
    for channel in ("msedge", "chrome"):
        try:
            return p.chromium.launch(channel=channel, headless=True, args=args), channel
        except Exception:
            continue
    return p.chromium.launch(headless=True, args=args), "bundled-chromium"


def gear_case(page, width, height, count):
    ensure(page.evaluate("(n)=>window.__LAYOUT_AUDIT.gear(n)", count) == count, "gear fixture count mismatch")
    cards = page.locator(".character-gear-list .character-v92-item")
    ensure(cards.count() == count, f"gear cards {cards.count()} != {count}")
    grid = bounds(page, ".character-v92-grid")
    inspector = bounds(page, ".character-v92-inspector")
    body = bounds(page, ".character-body-v92")
    ensure(grid["height"] >= 36, f"gear grid inaccessible: {grid['height']}")
    ensure(inspector["height"] >= 72, "inspector collapsed")
    ensure(inspector["bottom"] <= body["bottom"] + 2, "inspector overflow")
    ensure(grid["scrollWidth"] <= grid["clientWidth"] + 2, "horizontal grid overflow")
    cards.last.click(timeout=12000)
    ensure(page.locator(".character-v92-item.is-selected").count() == 1, "selected gear missing after click")
    control = page.locator(".character-v92-controls button:not([disabled])").first
    control.click(timeout=10000)
    after = bounds(page, ".character-v92-inspector")
    ensure(abs(after["top"] - inspector["top"]) <= 2, "inspector moved after gear click")
    ensure(abs(after["height"] - inspector["height"]) <= 2, "inspector resized after gear click")
    if count >= 10:
        ensure(grid["scrollHeight"] > grid["clientHeight"], "long grid must scroll")
    if count == 3:
        page.screenshot(path=str(OUT / f"gear-{width}x{height}.png"))
    return {"viewport": f"{width}x{height}", "count": count,
            "gridHeight": round(grid["height"], 1), "inspectorHeight": round(inspector["height"], 1),
            "scrollHeight": grid["scrollHeight"], "result": "PASS"}


def archive_case(page, width, height):
    page.evaluate("()=>window.__LAYOUT_AUDIT.archive(0)")
    cells = page.locator(".entry-save-cell")
    ensure(cells.count() == 20, "archives should show twenty slots")
    area = bounds(page, ".entry-save-content")
    first = bounds(page, ".entry-save-cell")
    ensure(first["height"] >= 52, "archive cell too short")
    cells.last.scroll_into_view_if_needed(timeout=10000)
    scrolled = bounds(page, ".entry-save-content")
    if area["scrollHeight"] > area["clientHeight"] + 1:
        ensure(scrolled["scrollTop"] > 0, "archive cannot scroll")
    page.locator('[data-a="slot-page"][data-d="1"]').click(timeout=10000)
    ensure(page.locator(".entry-save-cell").count() == 20, "next page missing slots")
    ensure(page.locator(".entry-save-id").first.inner_text().strip() == "021", "pagination failed")
    page.locator('[data-a="slot-page"][data-d="-1"]').click(timeout=10000)
    ensure(page.locator(".entry-save-id").first.inner_text().strip() == "001", "back pagination failed")
    page.screenshot(path=str(OUT / f"archive-{width}x{height}.png"))
    return {"viewport": f"{width}x{height}", "cellHeight": round(first["height"], 1),
            "scrollHeight": area["scrollHeight"], "areaHeight": area["clientHeight"], "result": "PASS"}


def building_case(page, width, height):
    page.evaluate("()=>window.__LAYOUT_AUDIT.buildings()")
    cards = page.locator(".building-card")
    ensure(cards.count() >= 6, "building grid not generated")
    max_lines = 0
    for idx in range(cards.count()):
        # V90.35 起设施卡不再有「升级后…」说明行（攻略文案已移出卡片），
        # 所以这里改判「材料清单 + 卡内所有文本都不越界」。
        m = cards.nth(idx).evaluate(
            """e=>{
                 const rows=[...e.querySelectorAll('.building-cost,.building-footer,.building-heading')];
                 const out=rows.map(r=>({scroll:r.scrollHeight,client:r.clientHeight,
                                         bottom:r.getBoundingClientRect().bottom}));
                 const box=e.getBoundingClientRect();
                 return {scroll:e.scrollHeight,client:e.clientHeight,
                         overflow:out.filter(r=>r.scroll>r.client+2).length,
                         outside:out.filter(r=>r.bottom>box.bottom+1).length};
               }""")
        ensure(m["scroll"] <= m["client"] + 2, f"building {idx} card clipped {m}")
        ensure(m["overflow"] == 0 and m["outside"] == 0, f"building {idx} rows clipped {m}")
        max_lines = max(max_lines, m["scroll"])
    cards.last.scroll_into_view_if_needed(timeout=12000)
    cards.last.locator("button").first.click(timeout=10000)
    page.screenshot(path=str(OUT / f"buildings-{width}x{height}.png"))
    return {"viewport": f"{width}x{height}", "buildingCards": cards.count(),
            "maxDescriptionHeight": max_lines, "result": "PASS"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index_bytes = (ROOT / "index.html").read_bytes()
    release, version = detect_release(index_bytes)
    html = index_bytes.decode("utf-8")
    title = re.search(r"<title>([^<]+)</title>", html)
    ensure(title and version in title.group(1), f"index.html 标题里没有 {version}")
    anchor = "window.QinglanDemo="
    ensure(html.count(anchor) == 1, "test-hook 注入点变化（window.QinglanDemo=）")
    html = html.replace(anchor, AUDIT_HOOK + "\n" + anchor, 1)

    results = {"commit": os.getenv("GITHUB_SHA", "local"), "version": version,
               "release": release.name, "source": "full-H5-with-test-only-hook",
               "gear": [], "archives": [], "buildings": [], "errors": []}

    with tempfile.TemporaryDirectory(prefix="h5-browser-") as td:
        pathlib.Path(td, "index.html").write_text(html, encoding="utf-8")
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=td)
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser, channel = launch_browser(p)
                results["channel"] = channel
                try:
                    for width, height in VIEWPORTS:
                        # viewport 只能挂在 context 上；new_page() 不接受该参数
                        context = browser.new_context(device_scale_factor=1,
                                                     viewport={"width": width, "height": height})
                        page = context.new_page()
                        errors = []
                        page.on("pageerror", lambda e: errors.append(str(e)))
                        try:
                            page.goto(f"http://127.0.0.1:{server.server_port}/index.html",
                                      wait_until="load", timeout=30000)
                            page.wait_for_function("!!window.__LAYOUT_AUDIT", timeout=30000)
                            for n in GEAR_COUNTS:
                                results["gear"].append(gear_case(page, width, height, n))
                            results["archives"].append(archive_case(page, width, height))
                            results["buildings"].append(building_case(page, width, height))
                            ensure(not errors, "uncaught browser JS: " + str(errors))
                        except Exception as exc:
                            results["errors"].append({"viewport": f"{width}x{height}", "error": str(exc),
                                                      "traceback": traceback.format_exc()[-1800:]})
                            try:
                                page.screenshot(path=str(OUT / f"failure-{width}x{height}.png"))
                            except Exception:
                                pass
                        finally:
                            page.close()
                            context.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()

    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    if results["errors"]:
        print("BROWSER RESPONSIVE FAIL", json.dumps(results["errors"], ensure_ascii=False))
        raise SystemExit(1)
    print("FULL H5 BROWSER RESPONSIVE PASS", json.dumps({
        "version": version, "release": release.name, "channel": results["channel"],
        "gear": len(results["gear"]), "archives": len(results["archives"]),
        "buildings": len(results["buildings"]), "viewports": VIEWPORTS}, ensure_ascii=False))


if __name__ == "__main__":
    main()
