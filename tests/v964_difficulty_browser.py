#!/usr/bin/env python3
"""V90.64 real Chromium mode entry, archive isolation, ranked tabs and narrow screen."""
from __future__ import annotations
import functools, http.server, pathlib, threading, json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts"/"v964-difficulty";OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
checks=0
def check(condition,label):
    global checks
    if not condition:raise AssertionError(label)
    checks+=1
def select(pg,mode):
    pg.locator(f'[data-a="difficulty-choice"][data-mode="{mode}"]').click()
    check(pg.locator(f'[data-a="difficulty-choice"][data-mode="{mode}"]').get_attribute("aria-pressed")=="true",mode+" chosen")
    pg.locator('[data-a="difficulty-next"]').click()
    check(pg.locator('[data-a="choose-role"]').count()==2,mode+" race screen")
def archives(pg):
    pg.locator('[data-a="view-slots"]').click()
    check(pg.locator('.entry-save-cell').count()==20,"slots twenty cells")
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    for width,height in [(320,568),(360,640),(390,844)]:
     ctx=browser.new_context(viewport={"width":width,"height":height},accept_downloads=True)
     pg=ctx.new_page();errors=[];pg.on("pageerror",lambda e:errors.append(str(e)))
     pg.goto(f"http://127.0.0.1:{srv.server_port}/index.html",wait_until="load",timeout=30000)
     check(pg.locator('[data-a="difficulty-choice"]').count()==3,"3 mode options")
     check(pg.locator('[data-a="difficulty-next"]').is_disabled(),"explicit difficulty confirmation")
     box=pg.locator(".difficulty-content").evaluate("""e=>({width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,full:e.scrollHeight})""")
     check(box["scroll"]<=box["width"]+2,"no sideways difficulty overflow")
     check(box["height"]>=125,"difficulty choices readable")
     pg.screenshot(path=str(OUT/f"select-{width}x{height}.png"))
     # Test exact visible mode, then back-navigation before selecting the other one.
     select(pg,"easy")
     pg.locator('[data-a="difficulty-back"]').click()
     check(pg.locator('[data-a="difficulty-choice"]').count()==3,"back to difficulty from race")
     pg.locator('[data-a="ranking-open"]').click()
     check(pg.locator('[data-a="rank-difficulty"]').count()==2,"separate standard and challenge board tabs")
     check("简单模式不计榜" in pg.locator("#modal-root").inner_text(),"easy leaderboard exclusion explained")
     pg.locator('[data-a="modal-close"]').click()
     pg.locator('[data-a="difficulty-next"]').click()
     archives(pg)
     check(pg.locator('.entry-save-cell').nth(0).get_attribute("class").find("empty")>=0,"easy empty slot")
     # Create easy and legacy challenge slots directly through the storage class, using real serialization.
     val=pg.evaluate("""() => {
       const s=new QCharacterSlots(localStorage,'easy');
       s.newGame('human',261014,1);
       const old=new QGame().state();delete old.difficulty;
       localStorage.setItem('qinglan-wendao-v14-human-slot-002',JSON.stringify(old));
       return [s.key('human',1),new QCharacterSlots(localStorage,'challenge').key('human',2)];
     }""")
     check(val[0]!=val[1],"different mode storage paths")
     pg.reload(wait_until="load")
     select(pg,"easy");archives(pg)
     check("ready" in pg.locator('.entry-save-cell').nth(0).get_attribute("class"),"easy ready")
     check("empty" in pg.locator('.entry-save-cell').nth(1).get_attribute("class"),"challenge slot invisible in easy")
     pg.locator('[data-a="characters"]').click()
     pg.locator('[data-a="difficulty-back"]').click()
     select(pg,"challenge");archives(pg)
     check("empty" in pg.locator('.entry-save-cell').nth(0).get_attribute("class"),"easy invisible in challenge")
     check("ready" in pg.locator('.entry-save-cell').nth(1).get_attribute("class"),"old unmarked challenge slot survives")
     pg.screenshot(path=str(OUT/f"archives-{width}x{height}.png"))
     check(not errors,"no JS page errors: "+repr(errors))
     ctx.close()
    browser.close()
 print(f"V90.64 REAL BROWSER DIFFICULTY PASS {checks} checks; 3 phone viewports and screenshots")
finally:
 srv.shutdown();srv.server_close()
