#!/usr/bin/env python3
"""V90.62 actual Chromium user workflow (the current index.html, not historical play fixtures)."""
import functools, http.server, json, pathlib, threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
KEY='qinglan-wendao-v14-human-slot-001'
LED=KEY+'-legacy-v1'
old={'version':14,'race':'human','character':'human','seed':20261019,
     'major':6,'level':18,'zone':5,'pos':{'x':2,'y':2},'inv':{'wood':3},
     'birth':{'race':'human','seed':20261019,'root':'mixed','element':'fire','grade':2,'name':'旧档测试'}}
old_raw=json.dumps(old,ensure_ascii=False)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
handler=functools.partial(Quiet,directory=str(ROOT))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
out=ROOT/'artifacts/v962-p0-browser';out.mkdir(parents=True,exist_ok=True)
checks=0
def check(cond,label):
    global checks
    if not cond:raise AssertionError(label)
    checks+=1
def open_slot(page):
    x=page.locator('[data-a="view-slots"]')
    if x.count() and x.first.is_visible():
        x.first.click()
    if not page.locator('[data-a="slot-open"]').count():
        p=page.locator('[data-a="slot-page"]')
        if p.count():p.first.click()
    page.locator('[data-a="slot-open"][data-n="1"]').first.click()
def fetch(page):
    return page.evaluate('''() => {
      const k='qinglan-wendao-v14-human-slot-001';
      const raw=localStorage.getItem(k),l=localStorage.getItem(k+'-legacy-v1');
      return {raw:raw&&JSON.parse(raw), ledger:l&&JSON.parse(l),
       done:localStorage.getItem(k+'-rebuild-compensated')};
    }''')
errors=[]
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':360,'height':640},accept_downloads=True)
    pg=ctx.new_page();pg.on('pageerror',lambda e: errors.append(str(e)))
    seed=f"""try{{if(!localStorage.getItem('__v962_seeded')){{
      localStorage.setItem({json.dumps(KEY)},{json.dumps(old_raw)});
      localStorage.setItem('__v962_seeded','1');
    }}}}catch(e){{}}"""
    pg.add_init_script(seed)
    pg.goto(url,wait_until='load',timeout=30000)
    pg.wait_for_timeout(250)
    open_slot(pg)
    pg.locator('[data-a="reset-confirm"]').wait_for(timeout=10000)
    check(pg.locator('[data-a="reset-export"]').count()==1,'export button')
    check('600' in pg.locator('#modal-root').inner_text(),'600 jade tier visible')
    pg.screenshot(path=str(out/'old-save-modal-360x640.png'))
    with pg.expect_download(timeout=10000) as info:
        pg.locator('[data-a="reset-export"]').click()
    download=info.value
    save_path=out/'exported-old-slot.json';download.save_as(str(save_path))
    exported=json.loads(save_path.read_text(encoding='utf-8'))
    check(exported['raw']['major']==6,'real old data exported')
    pg.locator('[data-a="modal-close"]').click()
    check(fetch(pg)['raw'].get('rebuilt') is None,'cancel keeps exact old save')
    pg.reload(wait_until='load')
    open_slot(pg)
    pg.locator('[data-a="reset-confirm"]').click()
    pg.wait_for_timeout(200)
    data=fetch(pg)
    check(data['raw']['rebuilt']==1,'new game slot was committed')
    check(data['ledger']['balance']==600,'one-time jade credited exactly')
    check(data['ledger']['rebuildCompensation']['tier']==600,'single ledger marker')
    check(data['done']=='1','old marker compatibility persisted')
    pg.screenshot(path=str(out/'after-reset-360x640.png'))
    # Simulate a previous paid-and-spent ledger that later sees the old source
    # again (historical backup, interrupted previous UI flow).
    pg.evaluate('''(values) => {const [k,oldRaw]=values;
      let l=JSON.parse(localStorage.getItem(k+'-legacy-v1'));
      l.balance=9;localStorage.setItem(k+'-legacy-v1',JSON.stringify(l));
      localStorage.setItem(k,oldRaw);
    }''',[KEY,old_raw])
    pg.reload(wait_until='load')
    open_slot(pg)
    check('不重复' in pg.locator('#modal-root').inner_text(),'repeat dialog warns no second payout')
    pg.locator('[data-a="reset-confirm"]').click()
    check(fetch(pg)['ledger']['balance']==9,'spent jade not replenished on retry')
    check(not errors,'no uncaught errors: '+repr(errors[:3]))
    ctx.close();browser.close()
    print(f'V90.62 REAL BROWSER PASS {checks} checks; screenshots in {out}')
finally:
 server.shutdown();server.server_close()
