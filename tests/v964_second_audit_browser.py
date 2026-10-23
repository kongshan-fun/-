#!/usr/bin/env python3
"""Independent second review: REAL onboarding -> saved mode -> reload -> cross-import defense."""
import functools, http.server, json, pathlib, threading
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts"/"v964-second-review"
OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
n=0
def check(condition,message):
 global n
 if not condition: raise AssertionError(message)
 n+=1
def choose(page,mode,race='human'):
 page.locator(f'[data-a="difficulty-choice"][data-mode="{mode}"]').click()
 page.locator('[data-a="difficulty-next"]').click()
 page.locator(f'[data-a="choose-role"][data-role="{race}"]').click()
 page.locator(f'[data-a="view-slots"][data-role="{race}"]').click()
def make_character(page,mode,race,slot):
 choose(page,mode,race)
 button=page.locator(f'[data-a="slot-open"][data-role="{race}"][data-slot="{slot}"]')
 check("empty" in (button.get_attribute("class") or ""),f"{mode}/{race}: new slot starts empty")
 button.click()
 check(page.locator('[data-a="birth-next"]').count()==1,"birth roll screen reached")
 page.locator('[data-a="birth-next"]').click()
 check(page.locator('[data-a="birth-confirm-final"]').count()==1,"birth confirmation screen reached")
 page.locator('[data-a="birth-confirm-final"]').click()
 state=page.evaluate("window.QinglanDemo.getState()")
 check(state is not None,f"{mode}/{race}: new game created")
 check(state['difficulty']==mode,f"{mode}/{race}: mode stored on character")
 check(state['race']==race,f"{mode}/{race}: race stored")
 check(page.evaluate("window.QinglanDemo.getPlayingDifficulty()")==mode,"playing difficulty readback")
 return state
def close_intro(page):
 skip=page.locator('[data-a="guide"][data-mode="skip"]')
 if skip.count(): skip.first.click()
 else:
  buttons=page.locator('[data-a="modal-close"]')
  if buttons.count(): buttons.first.click()
def data(page,key):
 return page.evaluate("key=>localStorage.getItem(key)",key)

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  # Three independent real UI creation flows, across different device viewports.
  for mode,race,size in [('easy','human',(320,568)),('standard','demon',(360,640)),('challenge','human',(390,844))]:
   context=browser.new_context(viewport={'width':size[0],'height':size[1]},accept_downloads=True)
   page=context.new_page()
   errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
   page.goto(f"http://127.0.0.1:{srv.server_port}/index.html",wait_until="load",timeout=30000)
   check(page.locator('[data-a="difficulty-next"]').is_disabled(),"initial explicit mode required")
   original=make_character(page,mode,race,1)
   key="qinglan-wendao-v14-"+('' if mode=='challenge' else mode+'-')+race+"-slot-001"
   stored=data(page,key)
   check(stored is not None,f"{mode}: game persisted under correct mode key")
   check(json.loads(stored)['difficulty']==mode,"persisted JSON mode not rewritten")
   expected_seed=original['seed']
   close_intro(page)
   page.screenshot(path=str(OUT/f"created-{mode}-{size[0]}.png"))
   page.reload(wait_until="load")
   choose(page,mode,race)
   row=page.locator(f'[data-a="slot-open"][data-role="{race}"][data-slot="1"]')
   check("ready" in (row.get_attribute("class") or ""),f"{mode}: saved slot visible after reload")
   row.click()
   restored=page.evaluate("window.QinglanDemo.getState()")
   check(restored['difficulty']==mode,"difficulty survived reload")
   check(restored['seed']==expected_seed,"seed survived reload")
   check(data(page,key) is not None,"saved key retained after reopening")
   check(not errors,"no browser runtime exceptions: "+repr(errors))
   context.close()
  # Cross-mode switch must not corrupt the current playing character.
  ctx=browser.new_context(viewport={'width':390,'height':844})
  page=ctx.new_page();errs=[];page.on("pageerror",lambda e:errs.append(str(e)))
  page.goto(f"http://127.0.0.1:{srv.server_port}/index.html",wait_until="load")
  created=make_character(page,'easy','human',1);close_intro(page)
  key='qinglan-wendao-v14-easy-human-slot-001';before=json.loads(data(page,key))
  page.locator('[data-a="panel"][data-name="settings"]').first.click()
  page.locator('[data-a="panel-step"][data-name="set-char"]').click()
  page.locator('[data-a="characters"]').first.click()
  check(page.locator('[data-a="difficulty-choice"]').count()==3,"return to difficulty selector")
  page.locator('[data-a="difficulty-choice"][data-mode="challenge"]').click()
  check(page.locator('[data-a="slot-back"]').count()==1,"return to active game remains available")
  page.locator('[data-a="slot-back"]').click()
  check(page.evaluate("window.QinglanDemo.getPlayingDifficulty()")=="easy","active easy game restored")
  check(page.evaluate("window.QinglanDemo.getDifficulty()")=="easy","slot service restored to original mode")
  check(json.loads(data(page,key))['seed']==before['seed'],"mode switch didn't overwrite original")
  check(data(page,'qinglan-wendao-v14-human-slot-001') is None,"challenge slot not accidentally created")
  # Cross-mode JSON import is rejected at the actual browser FileReader entry.
  page.locator('[data-a="panel"][data-name="settings"]').first.click()
  page.locator('[data-a="panel-step"][data-name="set-char"]').click()
  page.locator('[data-a="characters"]').first.click()
  page.locator('[data-a="difficulty-choice"][data-mode="standard"]').click()
  page.locator('[data-a="difficulty-next"]').click()
  page.locator('[data-a="view-slots"][data-role="human"]').click()
  page.locator('[data-a="slot-open"][data-role="human"][data-slot="1"]').click()
  file_json=json.dumps({"format":"QinglanWendao","version":14,"character":"human","state":created},ensure_ascii=False).encode("utf-8")
  page.locator('#import-file').set_input_files({"name":"cross-mode.json","mimeType":"application/json","buffer":file_json})
  page.wait_for_timeout(600)
  check(page.evaluate("window.QinglanDemo.getUI().frontPage")=="birth","rejected import stays on birth screen")
  check("难度" in page.locator("#toast").inner_text(),"import shows difficulty mismatch feedback")
  check(data(page,'qinglan-wendao-v14-standard-human-slot-001') is None,"no foreign mode archive created")
  check(not errs,"switch/import runtime exceptions "+repr(errs))
  ctx.close();browser.close()
 print(f"V90.64 SECOND REVIEW REAL ONBOARDING PASS {n} checks, three modes created and reloaded, cross-mode import rejected")
finally:
 srv.shutdown();srv.server_close()
