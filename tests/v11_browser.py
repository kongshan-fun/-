"""Two V11 characters and isolated permadeath, using TEST-ONLY in-memory storage."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'青岚问道_V11_双角色独立存档.html').read_text(encoding='utf8')
def boot(page,mem=None):
 code="""<script>(()=>{const d=DATA;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.hasOwn(d,k)?d[k]:null,setItem:(k,v)=>d[k]=String(v),removeItem:k=>{delete d[k]}}});window.snapshot=()=>JSON.parse(JSON.stringify(d))})()</script>""".replace('DATA',json.dumps(mem or {},ensure_ascii=False))
 page.set_content(HTML.replace('<head>','<head>'+code,1));page.wait_for_function('typeof QinglanDemo!=="undefined"')
def choose(page,id,new=False):
 page.locator(f'[data-a="slot-open"][data-role="{id}"]').click()
 if new:page.locator('[data-a="slot-confirm-new"]').click()
 skip=page.locator('[data-a="guide"][data-mode="skip"]')
 if skip.count():skip.click()
 assert page.evaluate('QinglanDemo.getActiveRole()')==id
with sync_playwright() as p:
 opts={'headless':True}
 executable=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 if executable:opts['executable_path']=executable
 if hasattr(os,'geteuid') and os.geteuid()==0:opts['args']=['--no-sandbox']
 browser=p.chromium.launch(**opts);page=browser.new_page(viewport={'width':390,'height':844});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 boot(page);assert page.locator('.role-card').count()==2
 choose(page,'sword',True);page.locator('#resources [data-a="gather"]').first.click()
 assert page.evaluate('QinglanDemo.getState().stats.gathers')>0
 page.locator('.topbar [data-a="characters"]').click();choose(page,'herb',True)
 assert page.evaluate('QinglanDemo.getState().stats.gathers')==0
 page.locator('.topbar [data-a="characters"]').click();choose(page,'sword')
 assert page.evaluate('QinglanDemo.getState().stats.gathers')>0
 mem=page.evaluate('window.snapshot()');assert 'qinglan-wendao-v11-herb' in mem
 state=json.loads(mem['qinglan-wendao-v11-sword']);state['life']['left']=10;mem['qinglan-wendao-v11-sword']=json.dumps(state,ensure_ascii=False)
 boot(page,mem);choose(page,'sword');page.locator('#rest-button').click()
 page.locator('[data-a="rebirth"]').wait_for()
 dead=page.evaluate('window.snapshot()')
 assert 'qinglan-wendao-v11-sword' not in dead and 'qinglan-wendao-v11-sword-death' in dead
 assert 'qinglan-wendao-v11-herb' in dead
 page.locator('[data-a="characters"]').last.click();choose(page,'herb')
 assert page.evaluate('QinglanDemo.getState().character')=='herb'
 assert not errors,errors
 browser.close()
print('V11 CHROMIUM ROLE SWITCH + PERMADEATH PASS (isolated storage, not real-origin persistence)')
