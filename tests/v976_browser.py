#!/usr/bin/env python3
"""Real Chromium HTTP origin/localStorage acceptance for the V90.76 hotfix."""
from pathlib import Path
import http.server, functools, threading, json, traceback, os, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/v976/browser';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url='http://127.0.0.1:'+str(server.server_port)+'/index.html';checks=[];errors=[]
def ck(v,desc):
 checks.append({'name':desc,'pass':bool(v)})
 if not v:raise AssertionError(desc)
def begin(page,mode='challenge',race='human',slot=1):
 page.locator(f'[data-a="difficulty-choice"][data-mode="{mode}"]').click()
 page.locator('[data-a="difficulty-next"]').click()
 page.locator(f'[data-a="choose-role"][data-role="{race}"]').click()
 page.locator('[data-a="view-slots"]').click()
 page.locator(f'[data-a="slot-open"][data-slot="{slot}"]').click()
 page.wait_for_function('window.QinglanDemo && QinglanDemo.getUI().frontPage===null')

def fresh_seed(page,life=1,ended=False):
 return page.evaluate('''x=>{
 const g=new QGame(null,12345,'human');g.s.guide.status='skipped';g.s.life.left=x.life;
 if(x.ended)g.expire('browser pre-dead');
 localStorage.clear();localStorage.setItem('qinglan-wendao-v14-human-slot-001',JSON.stringify(g.state()));
 localStorage.setItem('shanye-promo-v1','1');return JSON.stringify(g.state());
 }''',{'life':life,'ended':ended})
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url);ck('V90.76' in page.title(),'V90.76 title loads')
  fresh_seed(page);page.reload();begin(page)
  page.locator('#rest-button').click();ck(page.locator('[data-a="ad-life-rescue"]').count()==1,'actual death opens rescue choice')
  key='qinglan-wendao-v14-human-slot-001';pending=key+'-rescue-pending-v976'
  ck(page.evaluate('(k)=>!!localStorage.getItem(k)',pending),'pending receipt persisted before modal')
  ck(page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).state.ended',pending),'pending contains actual death snapshot')
  page.evaluate('window.dispatchEvent(new Event("pagehide"))');ck(page.evaluate('(k)=>!!localStorage.getItem(k)',pending),'pagehide leaves pending')
  page.reload();begin(page);ck(page.locator('[data-a="ad-life-rescue"]').count()==1,'refresh restores rescue modal')
  ck(page.evaluate('QinglanDemo.getState().ended && QinglanDemo.getState().life.left===0'),'refresh does not undo death')
  page.screenshot(path=str(OUT/'rescue-after-reload.png'))
  page.locator('[data-a="ad-life-rescue"]').click();ck(page.evaluate('QinglanDemo.getState().life.rescued && QinglanDemo.getState().life.left===15*5760'),'rescue grants one 15-year recovery')
  ck(page.evaluate('(k)=>localStorage.getItem(k)===null',pending),'successful rescue clears pending receipt')
  page.reload();begin(page);ck(page.evaluate('QinglanDemo.getState().life.rescued'),'rescue used flag survives another reload')
  # Different run, explicit decline after refresh.
  fresh_seed(page);page.reload();begin(page);page.locator('#rest-button').click();page.reload();begin(page)
  page.locator('[data-a="life-giveup"]').click();ck(page.locator('[data-a="rebirth"]').count()==1,'explicit giveup settles death')
  ck(page.evaluate('(k)=>localStorage.getItem(k)===null',key),'explicit giveup removes only current playable save')
  ck(page.evaluate('(k)=>localStorage.getItem(k)===null',pending),'explicit giveup removes pending receipt')
  ck(page.evaluate('(k)=>!!localStorage.getItem(k+"-death")',key),'explicit giveup creates death tombstone')
  # Visual content and knowledge coverage at new game reloaded in a new slot.
  fresh_seed(page,life=100*5760);page.reload();begin(page)
  page.locator('[data-a="panel"][data-name="book"]').first.click();body=page.locator('#panel-body').inner_text()
  ck('211' in body,'codex total is computed from 211 real collectible entries')
  ck('已识 0/14' in body,'unowned bags are not falsely counted as discovered')
  page.screenshot(path=str(OUT/'dynamic-codex.png'))
  page.locator('.panel-close').click()
  page.locator('[data-a="panel"][data-name="help"]').first.click();body=page.locator('#panel-body').inner_text()
  ck('灵根' in body and '储物袋' in body and '赋灵' in body,'restored help covers birth, storage bags and enchantment')
  page.screenshot(path=str(OUT/'restored-help.png'))
  page.locator('.panel-close').click()
  page.locator('[data-a="panel"][data-name="settings"]').first.click()
  page.locator('[data-a="panel-step"][data-name="set-char"]').click()
  page.locator('[data-a="characters"]').click()
  page.locator('[data-a="difficulty-next"]').click()
  ck('V90.76' in page.locator('#entry-root').inner_text(),'role screen uses current release label')
  page.screenshot(path=str(OUT/'updated-version.png'))
  ck(not errors,'no unhandled page errors')
  context.close()
 finally:
  browser.close();server.shutdown();report={'version':'V90.76','checks':checks,'passed':sum(x['pass'] for x in checks),'total':len(checks),'errors':errors};(OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('V90.76 REAL CHROMIUM',report['passed'],'/',report['total'], 'errors',errors)
