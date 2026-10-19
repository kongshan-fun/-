#!/usr/bin/env python3
"""Full H5 Chromium responsive smoke. A test-only hook is injected in memory; product HTML is unchanged."""
from __future__ import annotations
import functools, http.server, json, os, pathlib, tempfile, threading, traceback
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "v908-ui-browser"
VIEWPORTS = [(320, 568), (360, 640), (390, 844), (412, 915), (1080, 1920), (1440, 900)]
GEAR_COUNTS = [2, 3, 10, 36]

AUDIT_HOOK = r"""
window.__V908_LAYOUT_AUDIT = {
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
    if not condition: raise AssertionError(message)
def gear_case(page, width, height, count):
    ensure(page.evaluate("(n)=>window.__V908_LAYOUT_AUDIT.gear(n)",count)==count, "gear fixture count mismatch")
    cards=page.locator(".character-gear-list .character-v92-item")
    ensure(cards.count()==count, f"gear cards {cards.count()} != {count}")
    grid=bounds(page,".character-v92-grid")
    inspector=bounds(page,".character-v92-inspector")
    body=bounds(page,".character-body-v92")
    ensure(grid["height"]>=36,f"gear grid inaccessible: {grid['height']}")
    ensure(inspector["height"]>=72,"inspector collapsed")
    ensure(inspector["bottom"]<=body["bottom"]+2,"inspector overflow")
    ensure(grid["scrollWidth"]<=grid["clientWidth"]+2,"horizontal grid overflow")
    cards.last.click(timeout=12000)
    selected=page.locator(".character-v92-item.is-selected")
    ensure(selected.count()==1,"selected gear missing after click")
    control=page.locator(".character-v92-controls button:not([disabled])").first
    control.click(timeout=10000)
    after=bounds(page,".character-v92-inspector")
    ensure(abs(after["top"]-inspector["top"])<=2,"inspector moved after gear click")
    ensure(abs(after["height"]-inspector["height"])<=2,"inspector resized after gear click")
    if count>=10:
        ensure(grid["scrollHeight"]>grid["clientHeight"],"long grid must scroll")
    if count==3:
        page.screenshot(path=str(OUT/f"gear-{width}x{height}.png"))
    return {"viewport":f"{width}x{height}","count":count,
            "gridHeight":round(grid["height"],1),"inspectorHeight":round(inspector["height"],1),
            "scrollHeight":grid["scrollHeight"],"result":"PASS"}
def archive_case(page,width,height):
    page.evaluate("()=>window.__V908_LAYOUT_AUDIT.archive(0)")
    cells=page.locator(".entry-save-cell")
    ensure(cells.count()==20, "archives should show twenty slots")
    area=bounds(page,".entry-save-content")
    first=bounds(page,".entry-save-cell")
    ensure(first["height"]>=52,"archive cell too short")
    cells.last.scroll_into_view_if_needed(timeout=10000)
    scrolled=bounds(page,".entry-save-content")
    if area["scrollHeight"]>area["clientHeight"]+1:
        ensure(scrolled["scrollTop"]>0,"archive cannot scroll")
    page.locator('[data-a="slot-page"][data-d="1"]').click(timeout=10000)
    ensure(page.locator(".entry-save-cell").count()==20,"next page missing slots")
    ensure(page.locator(".entry-save-id").first.inner_text().strip()=="021","pagination failed")
    page.locator('[data-a="slot-page"][data-d="-1"]').click(timeout=10000)
    ensure(page.locator(".entry-save-id").first.inner_text().strip()=="001","back pagination failed")
    page.screenshot(path=str(OUT/f"archive-{width}x{height}.png"))
    return {"viewport":f"{width}x{height}","cellHeight":round(first["height"],1),
            "scrollHeight":area["scrollHeight"],"areaHeight":area["clientHeight"],"result":"PASS"}
def building_case(page,width,height):
    page.evaluate("()=>window.__V908_LAYOUT_AUDIT.buildings()")
    cards=page.locator(".building-card")
    ensure(cards.count()>=6, "building grid not generated")
    max_lines=0
    for idx in range(cards.count()):
        c=cards.nth(idx); d=c.locator(".building-effect")
        m=d.evaluate("""e=>({scroll:e.scrollHeight,client:e.clientHeight,overflow:getComputedStyle(e).overflow})""")
        ensure(m["scroll"]<=m["client"]+2,f"building {idx} effect clipped {m}")
        max_lines=max(max_lines,m["scroll"])
    cards.last.scroll_into_view_if_needed(timeout=12000)
    last_button=cards.last.locator("button").first
    last_button.click(timeout=10000)
    page.screenshot(path=str(OUT/f"buildings-{width}x{height}.png"))
    return {"viewport":f"{width}x{height}","buildingCards":cards.count(),
            "maxDescriptionHeight":max_lines,"result":"PASS"}
def main():
    OUT.mkdir(parents=True,exist_ok=True)
    html=(ROOT/"index.html").read_text(encoding="utf-8")
    release=(ROOT/"releases/山野修仙记_V90.8_五阶洞府与高阶炼制版.html").read_text(encoding="utf-8")
    ensure(html==release,"main/release H5 contents mismatch")
    anchor="window.QinglanDemo="
    ensure(html.count(anchor)==1,"test-hook insertion point changed")
    html=html.replace(anchor,AUDIT_HOOK+"\n"+anchor,1)
    results={"commit":os.getenv("GITHUB_SHA","local"),"source":"full-V90.8-H5-with-test-only-hook",
             "gear":[],"archives":[],"buildings":[],"errors":[]}
    with tempfile.TemporaryDirectory(prefix="v908-page-") as td:
        pathlib.Path(td,"index.html").write_text(html,encoding="utf-8")
        handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=td)
        server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
        server_thread=threading.Thread(target=server.serve_forever,daemon=True)
        server_thread.start()
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch(channel="chrome",headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
                # 修复：BrowserContext.new_page() 不接受 viewport 参数。
                # 正确做法是给每个视口单独建 BrowserContext，再 new_page() 不带参数。
                for width,height in VIEWPORTS:
                    context=browser.new_context(device_scale_factor=1,
                                                viewport={"width":width,"height":height})
                    page=context.new_page()
                    errors=[]
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    try:
                        page.goto(f"http://127.0.0.1:{server.server_port}/index.html",wait_until="load",timeout=30000)
                        page.wait_for_function("!!window.__V908_LAYOUT_AUDIT",timeout=30000)
                        for n in GEAR_COUNTS:results["gear"].append(gear_case(page,width,height,n))
                        results["archives"].append(archive_case(page,width,height))
                        results["buildings"].append(building_case(page,width,height))
                        ensure(not errors,"uncaught browser JS: "+str(errors))
                    except Exception as exc:
                        results["errors"].append({"viewport":f"{width}x{height}","error":str(exc),
                                                  "traceback":traceback.format_exc()[-1800:]})
                        page.screenshot(path=str(OUT/f"failure-{width}x{height}.png"))
                    finally:
                        page.close()
                        context.close()
                browser.close()
        finally:
            server.shutdown()
    (OUT/"results.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    if results["errors"]:
        print("BROWSER RESPONSIVE FAIL",json.dumps(results["errors"],ensure_ascii=False))
        raise SystemExit(1)
    print("V90.8 FULL H5 BROWSER RESPONSIVE PASS",
          json.dumps({"gear":len(results["gear"]),"archives":len(results["archives"]),
                      "buildings":len(results["buildings"]),"viewports":VIEWPORTS},ensure_ascii=False))
if __name__=="__main__":main()
