"""V14 current build, actual browser actions. Local run uses explicitly isolated memory
storage; QINGLAN_REAL_ORIGIN=1 instead serves HTTP and tests real origin storage.
Neither mode certifies iOS/Android hardware or 200 high-progress browser saves.
"""
import os,json,threading,functools,contextlib
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';EV.mkdir(exist_ok=True)
HTML=(ROOT/'青岚问道_V14_人妖同途.html').read_text(encoding='utf8')
REAL=os.environ.get('QINGLAN_REAL_ORIGIN')=='1'
INJECT="""<script>(()=>{const d=SEED;window.__writeFail=false;const api={getItem:k=>Object.hasOwn(d,k)?d[k]:null,setItem:(k,v)=>{if(window.__writeFail)throw Error('quota exceeded');d[k]=String(v)},removeItem:k=>{delete d[k]},key:n=>Object.keys(d)[n]||null,get length(){return Object.keys(d).length}};Object.defineProperty(window,'localStorage',{configurable:true,value:api});window.__snapshot=()=>JSON.parse(JSON.stringify(d));})()</script>"""
server=None
if REAL:
 class Quiet(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/index.html'
RESULTS=[]
def report(name,**info):RESULTS.append({'name':name,'status':'PASS',**info});print('PASS',name,flush=True)
def boot(page,mem=None):
 if REAL:
  page.goto(url,wait_until='load')
  if mem is not None:
   page.evaluate('d=>{localStorage.clear();for(const [k,v]of Object.entries(d))localStorage.setItem(k,v)}',mem);page.reload()
 else:page.set_content(HTML.replace('<head>','<head>'+INJECT.replace('SEED',json.dumps(mem or {},ensure_ascii=False)),1))
 page.wait_for_function('typeof QinglanDemo!=="undefined"');page.wait_for_timeout(80)
def snap(p):return p.evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{let k=localStorage.key(i);return[k,localStorage.getItem(k)]}))')
def state(p):return p.evaluate('QinglanDemo.getState()')
def ui(p):return p.evaluate('QinglanDemo.getUI()')
def click(p,a,extra=''):p.locator(f'[data-a="{a}"]'+extra).filter(visible=True).first.click()
def race(p,r):
 click(p,'choose-role',f'[data-role="{r}"]');click(p,'view-slots')
def archive(p,n):
 page=(n-1)//20
 for _ in range(page):click(p,'slot-page','[data-d="1"]')
 click(p,'slot-open',f'[data-slot="{n}"]')
def skip(p):
 btn=p.locator('[data-a="guide"][data-mode="skip"]')
 if btn.count() and btn.is_visible():btn.click()
def full_page(p):
 assert p.locator('#entry-root').is_visible()
 assert not p.locator('#game-shell').is_visible()
 assert not p.locator('.modal-backdrop').count()
 m=p.evaluate('''()=>{const f=document.querySelector('#phone').getBoundingClientRect(),e=document.querySelector('#entry-root').getBoundingClientRect();return {fw:f.width,fh:f.height,ew:e.width,eh:e.height,w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,inert:document.querySelector('#game-shell').inert}}''')
 assert m['fw']<=min(m['w'],400)+1,m
 assert abs(m['fh']-m['eh'])<=2 and abs(m['fw']-m['ew'])<=2,m
 assert m['sw']<=m['w'] and m['sh']<=m['h'],m
 assert m['inert']
 return m
def game_metrics(p):return p.evaluate('''()=>{const r=s=>{let x=document.querySelector(s).getBoundingClientRect();return [x.x,x.y,x.width,x.height]};return {resources:r('#resources'),map:r('#map'),nav:r('.quick-nav'),peek:r('#inventory-peek'),body:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],size:[innerWidth,innerHeight]}}''')
with sync_playwright() as pw:
 kw={'headless':True};ex=os.environ.get('CHROMIUM_PATH')
 if not ex and Path('/usr/bin/chromium').exists():ex='/usr/bin/chromium'
 if ex:kw['executable_path']=ex
 if hasattr(os,'geteuid') and os.geteuid()==0:kw['args']=['--no-sandbox']
 browser=pw.chromium.launch(**kw)
 for w,h in [(320,568),(360,640),(390,844),(430,932),(1440,900)]:
  ctx=browser.new_context(viewport={'width':w,'height':h});p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  boot(p,{});full_page(p);assert p.locator('[data-a="choose-role"]').count()==2
  before=snap(p);race(p,'human');full_page(p);assert p.locator('.entry-save-cell').count()==20
  # 20 slots fit in their panel without a scrollbar or hidden rows.
  assert p.locator('.entry-save-grid').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
  archive(p,100);full_page(p);draft=p.evaluate('QinglanDemo.getBirthDraft()')
  p.locator('#birth-name').fill('青岚试行者');click(p,'birth-reroll');second=p.evaluate('QinglanDemo.getBirthDraft()');assert draft['seed']!=second['seed'];assert second['name']=='青岚试行者';assert snap(p)==before
  full_page(p);click(p,'birth-confirm');skip(p);assert state(p)['birth']==second
  saved=state(p);assert saved['race']=='human';assert p.evaluate('QinglanDemo.getActiveSlot()')==100
  assert p.locator('#map .tile').count()==9 and p.locator('#map .tile').nth(4).inner_text()=='我'
  m=game_metrics(p);assert m['body'][0]<=w and m['body'][1]<=h
  p.locator('#resources [data-a="gather"]').first.click();p.wait_for_timeout(50);assert game_metrics(p)==m
  assert state(p)['stats']['gathers']>saved['stats']['gathers']
  click(p,'expand-map');assert p.locator('#world-map .tile').count()==64;click(p,'collapse-map');assert game_metrics(p)==m
  # Live shared panels and old miniature inventory item popover remain functional.
  click(p,'peek','[data-id="wood"]');assert '灵木' in p.locator('.modal').inner_text();click(p,'modal-close')
  click(p,'panel','[data-name="cultivate"]');assert '命格' in p.locator('#panel-body').inner_text();click(p,'panel','[data-name="birth"]');assert '灵根' in p.locator('#panel-body').inner_text();click(p,'close-panel')
  click(p,'characters');full_page(p);race(p,'human');archive(p,100);assert state(p)['birth']==second
  progress=state(p);click(p,'characters');race(p,'demon');archive(p,1);full_page(p)
  p.locator('#birth-name').fill('山野来客');demon=p.evaluate('QinglanDemo.getBirthDraft()');click(p,'birth-confirm');skip(p);assert state(p)['race']=='demon'
  assert '启灵' in p.locator('#status').inner_text() and '妖元' in p.locator('#status').inner_text()
  click(p,'characters');race(p,'human');archive(p,100);assert state(p)['birth']==progress['birth'];assert state(p)['inv']==progress['inv'];assert state(p)['stats']==progress['stats']
  storage=snap(p);boot(p,storage);full_page(p);race(p,'demon');archive(p,1);assert state(p)['birth']==demon
  assert not errors,errors
  p.screenshot(path=str(EV/f'V14_游戏适配_{w}x{h}.png'))
  click(p,'characters');click(p,'choose-role','[data-role="demon"]');p.screenshot(path=str(EV/f'V14_妖族页面_{w}.png'))
  click(p,'view-slots');p.screenshot(path=str(EV/f'V14_百档页面_{w}.png'))
  click(p,'slot-open','[data-slot="2"]');p.screenshot(path=str(EV/f'V14_妖族天赋_{w}.png'))
  report(f'{w}x{h}：完整三页、档100、种族隔离、重读和无跳动',storage='real HTTP origin' if REAL else 'in-memory adapter');ctx.close()
 # Legacy imports: two old class #001 saves migrate into distinct human slots.
 ctx=browser.new_context(viewport={'width':390,'height':844});p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));boot(p,{})
 old=p.evaluate('''()=>{let a=new QGame(null,12,'human').state();a.version=13;delete a.birth;delete a.race;delete a.xpCarry;a.character='sword';return a}''')
 old2=json.loads(json.dumps(old));old2['character']='herb'
 initial={'qinglan-wendao-v11-sword':json.dumps(old),'qinglan-wendao-v11-herb':json.dumps(old2)}
 boot(p,initial);race(p,'human');archive(p,7);click(p,'legacy-list');full_page(p);assert p.locator('.heritage-item').count()==2
 click(p,'legacy-pick');full_page(p);click(p,'entry-import-confirm');skip(p);assert state(p)['birth']['origin']=='legacy';assert state(p)['birth']['legacyClass']=='sword';assert snap(p)['qinglan-wendao-v11-sword']==initial['qinglan-wendao-v11-sword']
 click(p,'characters');race(p,'human');archive(p,8);click(p,'legacy-list');assert p.locator('.heritage-item').count()==1;click(p,'legacy-pick');click(p,'entry-import-confirm');skip(p);assert state(p)['birth']['legacyClass']=='herb'
 report('两个旧001档分别迁入人族007/008，原档不动');
 # JSON import into empty slot; mismatched race cannot create or overwrite.
 human=snap(p);click(p,'characters');race(p,'demon');archive(p,2)
 p.locator('#import-file').set_input_files({'name':'old-human.json','mimeType':'application/json','buffer':json.dumps(old).encode()});p.wait_for_timeout(80);assert ui(p)['frontPage']=='birth';assert '不' in p.locator('#toast').inner_text();assert snap(p)==human
 click(p,'birth-back');click(p,'characters');race(p,'human');archive(p,9)
 p.locator('#import-file').set_input_files({'name':'human.json','mimeType':'application/json','buffer':json.dumps(old).encode()});p.wait_for_timeout(80);assert ui(p)['frontPage']=='entry-import';click(p,'entry-import-confirm');skip(p);assert p.evaluate('QinglanDemo.getActiveSlot()')==9
 report('JSON恢复完整页与跨族导入拒绝')
 # Genuine game-operation lifespan expiration; corrupt/other keys must stay untouched.
 click(p,'characters');race(p,'demon');archive(p,1);click(p,'birth-confirm');skip(p)
 mem=snap(p);key='qinglan-wendao-v14-demon-slot-001';s=json.loads(mem[key]);s['life']['left']=10;mem[key]=json.dumps(s)
 boot(p,mem);race(p,'demon');archive(p,1);click(p,'quick-rest');assert ui(p)['modal']=='permadeath';expired=snap(p)
 assert key not in expired and key+'-death' in expired
 for k,v in mem.items():
  if k not in [key,key+'-backup','qinglan-wendao-v14-active']:assert expired[k]==v,(k,'other archive changed')
 click(p,'rebirth');full_page(p);assert '新轮回' in p.locator('#entry-root').inner_text();click(p,'birth-confirm');skip(p);assert state(p)['life']['left']>0;assert key+'-death' not in snap(p)
 report('寿尽只清本档，新轮回重新抽取且不伤其他档')
 if not REAL:
  # Simulated quota fault is purposeful; do not claim this is a browser quota pressure test.
  p.evaluate('window.__writeFail=true');click(p,'characters');assert not p.locator('#entry-root').is_visible();assert not ui(p)['frontPage'];assert '未能落盘' in ui(p)['saveStatus'];p.evaluate('window.__writeFail=false');click(p,'characters');full_page(p)
  race(p,'human');archive(p,10);stored=snap(p);p.evaluate('window.__writeFail=true');click(p,'birth-confirm');assert ui(p)['frontPage']=='birth';assert snap(p)==stored;p.evaluate('window.__writeFail=false')
  report('模拟配额失败：阻止切档、拒绝假新建且保留原记录')
 assert not errors,errors;ctx.close();browser.close()
if server:server.shutdown()
(EV/'V14_浏览器验收.json').write_text(json.dumps({'storageMode':'real-http-origin' if REAL else 'explicit-test-adapter','checks':RESULTS},ensure_ascii=False,indent=2),encoding='utf8')
print('V14 BROWSER',len(RESULTS),'SCENARIOS PASS')
