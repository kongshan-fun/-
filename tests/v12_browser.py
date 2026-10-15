"""V12 Chromium verification: 12-map UI, two character slots, ascension persistence.
Browser uses injected test-only localStorage, not actual persistent origin storage.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'青岚问道_V12_凡界飞升.html').read_text(encoding='utf8')
EV=ROOT/'evidence';EV.mkdir(exist_ok=True)
STORAGE="""<script>(()=>{const mem=SEED;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.hasOwn(mem,k)?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]},key:n=>Object.keys(mem)[n]||null,clear:()=>{for(const k of Object.keys(mem))delete mem[k]},get length(){return Object.keys(mem).length}}});window.__testStorage=()=>JSON.parse(JSON.stringify(mem));})()</script>"""
RESULTS=[]
def launch(p):
 kw={'headless':True}
 executable=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 if executable:kw['executable_path']=executable
 if hasattr(os,'geteuid') and os.geteuid()==0:kw['args']=['--no-sandbox']
 return p.chromium.launch(**kw)
def boot(page,storage=None):
 inject=STORAGE.replace('SEED',json.dumps(storage if storage is not None else {},ensure_ascii=False))
 page.set_content(HTML.replace('<head>','<head>'+inject,1))
 page.wait_for_function('typeof window.QinglanDemo!=="undefined"')
def choose(page,new=False):
 page.locator('[data-a="slot-open"][data-role="sword"]').click()
 if new:page.locator('[data-a="slot-confirm-new"]').click()
 skip=page.locator('[data-a="guide"][data-mode="skip"]')
 if skip.count():skip.click()
 assert page.evaluate('QinglanDemo.getActiveRole()')=='sword'
def snapshot(page):return page.evaluate('window.__testStorage()')
def metrics(page):
 return page.evaluate('''()=>{const r=s=>{let e=document.querySelector(s).getBoundingClientRect();return {x:e.x,y:e.y,w:e.width,h:e.height}};return {phone:r('#phone'),resources:r('#resources'),map:r('#map'),nav:r('.quick-nav'),inventory:r('#inventory-peek'),scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight}}''')
with sync_playwright() as p:
 b=launch(p)
 for width,height in ((320,568),(390,844),(1440,900)):
  ctx=b.new_context(viewport={'width':width,'height':height});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  boot(page)
  assert page.locator('.role-card').count()==2,'role selection'
  choose(page,new=True)
  assert page.evaluate('QinglanDemo.metadata.version')==12
  assert page.evaluate('QinglanDemo.metadata.regions.length')==12
  assert page.locator('#map .tile').count()==9
  assert page.locator('#map .tile').nth(4).inner_text()=='我'
  assert page.locator('#resources > *').count()==10
  a=metrics(page)
  assert a['phone']['w']<=min(width,400)+1,(width,'phone')
  assert a['scrollW']<=width and a['scrollH']<=height,(width,'page scroll')
  assert a['map']['x']<a['phone']['x']+170,(width,'minimap left')
  page.locator('#expand-map').click()
  assert page.locator('#world-map .tile').count()==64
  page.locator('#collapse-map').click()
  page.locator('#resources [data-a="gather"]').first.click()
  bb=metrics(page)
  for key in ['resources','map','nav','inventory']:assert a[key]==bb[key],(width,'jump',key)
  page.locator('#travel-toggle').click()
  assert page.locator('.travel-option').count()==12
  assert page.locator('#travel-menu').evaluate('(e)=>getComputedStyle(e).overflowY')=='auto'
  page.locator('#travel-toggle').click()
  page.locator('[data-name="help"]').first.click()
  assert '飞升' in page.locator('#panel-body').inner_text()
  page.locator('.panel-close').click()
  if width==390:page.screenshot(path=str(EV/'V12_手机开局.png'))
  if width==1440:page.screenshot(path=str(EV/'V12_桌面手机窗.png'))
  assert not errors,errors
  RESULTS.append(f'Viewport {width}x{height}, 12-map travel list, minigrid, full map and no-jump PASS')
  ctx.close()
 # A natural progression screenshot generated from the actual twelve-stage planner (no injected stats).
 sample=json.loads((EV/'V12_结丹地图实测档.json').read_text(encoding='utf8'))
 ctx=b.new_context(viewport={'width':390,'height':844});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 boot(page,{'qinglan-wendao-v11-sword':json.dumps(sample,ensure_ascii=False)})
 choose(page)
 assert page.evaluate('QinglanDemo.getState().major')==2
 assert '金丹' in page.locator('#status').inner_text()
 assert '丹霞雷渊' in page.locator('#zone-label').inner_text()
 assert page.locator('#map .tile').count()==9
 page.screenshot(path=str(EV/'V12_金丹地图.png'))
 RESULTS.append('Genuine post-breakthrough Jin Dan save loads on correct zone and realm')
 # End of mortal world: explicit gate interaction, saved separate from permadeath.
 atgate=json.loads((EV/'V12_渡劫天门实测档.json').read_text(encoding='utf8'))
 boot(page,{'qinglan-wendao-v11-sword':json.dumps(atgate,ensure_ascii=False)})
 choose(page)
 assert page.evaluate('QinglanDemo.getState().major')==8
 assert page.locator('#scene-content [data-a="ascend"]').count()==1
 page.screenshot(path=str(EV/'V12_渡劫天门.png'))
 page.locator('#scene-content [data-a="ascend"]').click()
 assert page.evaluate('QinglanDemo.getState().ascended') is True
 assert '飞升成功' in page.locator('.modal').inner_text()
 page.screenshot(path=str(EV/'V12_飞升成功.png'))
 mem=snapshot(page)
 assert 'qinglan-wendao-v11-sword' in mem
 assert 'qinglan-wendao-v11-sword-death' not in mem
 assert json.loads(mem['qinglan-wendao-v11-sword'])['ascended'] is True
 boot(page,mem)
 choose(page)
 assert page.evaluate('QinglanDemo.getState().ascended') is True
 assert page.evaluate('QinglanDemo.getState().major')==9
 assert page.evaluate('QinglanDemo.getState().life.left')>0
 assert not errors,errors
 RESULTS.append('Gate flight genuine action; victory modal; role saved and reload preserved, no tombstone')
 ctx.close();b.close()
for z in RESULTS:print('PASS',z)
print(f'V12 BROWSER {len(RESULTS)}/{len(RESULTS)} PASS (test storage adapter)')
(EV/'V12_浏览器验收记录.json').write_text(json.dumps({'results':RESULTS,'method':'Chromium page.set_content + test-only localStorage adapter; not phone persistence certification'},ensure_ascii=False,indent=2),encoding='utf8')
