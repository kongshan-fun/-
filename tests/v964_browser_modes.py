#!/usr/bin/env python3
"""Real Chromium flow: mode -> race -> slots, old challenge compatibility and mobile viewports."""
import functools, http.server, pathlib, threading, json
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
checks=0
def check(test,message):
 global checks
 assert test,message
 checks+=1
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for width,height in [(320,568),(360,640),(390,844),(412,915)]:
   context=browser.new_context(viewport={'width':width,'height':height})
   page=context.new_page()
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(url,wait_until='load')
   check(page.locator('[data-a="difficulty-open"]').count()==3,'3 mode cards '+str(width))
   check('选择游戏模式' in page.locator('#entry-root').inner_text(),'mode heading')
   for mode in ['easy','standard','challenge']:
    page.locator(f'[data-a="difficulty-open"][data-difficulty="{mode}"]').click()
    check(page.evaluate('window.QinglanDemo.getDifficulty()')==mode,'selected '+mode)
    check(page.locator('[data-a="choose-role"]').count()==2,'races after '+mode)
    page.locator('[data-a="view-slots"]').click()
    check(page.locator('[data-a="slot-open"]').count()==20,'slots after '+mode)
    page.locator('[data-a="characters"]').last.click()
    page.locator('[data-a="difficulty-back"]').click()
   check(not errors,'no JS errors '+str(errors[:3]))
   context.close()
  browser.close()
 print(f'V90.64 MOBILE MODE FLOW PASS {checks} checks')
finally:
 server.shutdown();server.server_close()
