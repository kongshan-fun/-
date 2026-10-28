#!/usr/bin/env python3
"""Actual Chromium UI acceptance. --offline-dom uses a storage test adapter only
when the host prohibits page navigation. Default serves the unmodified release
and uses real origin localStorage; CI runs that default path.
"""
from __future__ import annotations
import argparse,functools,http.server,json,pathlib,threading,traceback,time,os,shutil
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/v975/browser';OUT.mkdir(parents=True,exist_ok=True)
P=argparse.ArgumentParser();P.add_argument('--offline-dom',action='store_true');P.add_argument('--quick',action='store_true');ARGS=P.parse_args()
HTML=(ROOT/'index.html').read_text()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
URL=f'http://127.0.0.1:{server.server_port}/index.html'
CHECKS=[];ERRORS=[];SHOTS=[];METRICS=[];FATAL=None
def check(v,label,details=None):
 CHECKS.append({'name':label,'pass':bool(v),'details':details})
 if not v:raise AssertionError(label+(' '+str(details) if details is not None else ''))
def storage(page):return page.evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return [k,localStorage.getItem(k)]}))')
def boot(context,seed=None):
 page=context.new_page();page.set_default_timeout(5000);page.on('pageerror',lambda e:ERRORS.append(str(e)))
 if ARGS.offline_dom:
  shim='''<script>const mockStore=new Map(Object.entries(%s));Object.defineProperty(window,'localStorage',{value:{getItem:k=>mockStore.get(k)||null,setItem:(k,v)=>mockStore.set(k,String(v)),removeItem:k=>mockStore.delete(k),clear:()=>mockStore.clear(),key:i=>[...mockStore.keys()][i]||null,get length(){return mockStore.size}}});</script>'''%json.dumps(seed or {},ensure_ascii=False)
  page.set_content(HTML.replace('<head>','<head>'+shim),wait_until='load')
 else:
  page.goto(URL)
  if seed is not None:page.evaluate('(x)=>{localStorage.clear();for(const[k,v]of Object.entries(x))localStorage.setItem(k,v);}',seed);page.reload()
 return page

def enter(page,mode='challenge',race='human',slot=1,new=False):
 page.locator(f'[data-a="difficulty-choice"][data-mode="{mode}"]').click();page.locator('[data-a="difficulty-next"]').click()
 page.locator(f'[data-a="choose-role"][data-role="{race}"]').click();page.locator('[data-a="view-slots"]').click()
 page.locator(f'[data-a="slot-open"][data-slot="{slot}"]').click()
 if new:
  page.locator('[data-a="birth-next"]').click();page.locator('[data-a="birth-confirm-final"]').click();page.locator('[data-a="guide"][data-mode="skip"]').click()
 page.wait_for_function('QinglanDemo.getUI().frontPage===null')

def shot(page,name):
 page.screenshot(path=str(OUT/(name+'.png')));SHOTS.append(name+'.png')

def panel_metrics(page,name,w,h):
 m=page.locator('#panel-body').evaluate('e=>({scroll:e.scrollHeight,client:e.clientHeight,width:e.clientWidth,scrollWidth:e.scrollWidth})');m.update({'name':name,'viewport':[w,h]});METRICS.append(m)
 check(m['scrollWidth']<=m['width']+2,name+' no horizontal overflow '+str(w),m)
 for key in ['.panel-head','.panel-close']:
  b=page.locator(key).first.bounding_box();check(bool(b)and b['x']>=-1 and b['y']>=-1 and b['x']+b['width']<=w+1 and b['y']+b['height']<=h+1,name+' bounds '+key+str(w),b)
 return m

def seeded(page,tier=12):
 return page.evaluate('''t=>{
 const g=new QGame(null,187345,'human');const D=QData;
 g.s.level=t*3;g.syncMajor();Object.assign(g.s,{maxHp:D.statsForLevel(t*3).hp,maxSpirit:D.statsForLevel(t*3).spirit,attack:D.statsForLevel(t*3).atk});
 g.s.xp=g.required+500000;g.s.life.left=5000*D.LIFE.yearMinutes;g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;g.s.hunger=g.s.water=100;
 g.s.zone=t-1;g.s.cleared=Array.from({length:12},(_,i)=>i<t-1);g.s.ritual=g.s.cleared.slice();g.recalcUnlocked();g.s.pos={x:0,y:5};g.s.last={...g.s.pos};
 g.enterHome();for(const[id,n]of Object.entries(D.SETTLE_COST))g.s.inv[id]=n+2;g.act('settle');
 g.camp.level=t;for(const id of D.HOME_ROOMS.filter(k=>k!=='residence'))g.camp.buildings[id]=t;
 for(const id of Object.keys(D.ITEMS)){g.camp.stash[id]=25;g.s.codex.items[id]=1;}
 g.camp.stash.stone=5000;g.s.inv={wood:6,fiber:6,stone:6};
 for(let i=0;i<4;i++){const id='supply'+D.QUICK_KINDS[i]+t;g.s.inv[id]=8;g.s.codex.items[id]=1;}
 g.s.inv.salve=3;g.s.inv.mana=3;g.s.inv.berry=3;g.s.inv.water=3;
 const r=D.RECIPES.find(r=>r.gear==='weapon'&&r.mapTier===t&&!r.secret),gear=g.createGear(r.id,2,'browser-fixture');gear.quality=2;g.s.gears.push(gear);g.s.equipped.weapon=gear.id;
 g.s.guide.status='skipped';g.s.settings.motion=false;g.leaveHome();
 return {'qinglan-wendao-v14-human-slot-001':JSON.stringify(g.state()),'shanye-promo-v1':'1'};
 }''',tier)

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
  page=boot(context);check('V90.75' in page.title(),'cold launch version')
  enter(page,new=True)
  check(page.locator('#supply-slots button').count()==4,'four quick slots on fresh game')
  # Construct the first house via actual resource buttons, no granted materials.
  for idx in [0,2,1]:page.locator(f'#resources [data-a="gather"][data-index="{idx}"]').click()
  page.locator('#home-button').click();check('建造一次' in page.locator('#panel-body').inner_text(),'unique home introduction')
  page.locator('[data-a="home-build"]').click();check(page.evaluate('!!QinglanDemo.getState().homestead'),'build home through UI')
  page.locator('[data-a="home-exit"]').click();pos=page.evaluate('JSON.stringify(QinglanDemo.getState().pos)')
  page.locator('#home-button').click();check(page.locator('[data-a="home-build"]').count()==0,'existing home no duplicate construction')
  page.locator('[data-a="home-exit"]').click();check(page.evaluate('JSON.stringify(QinglanDemo.getState().pos)')==pos,'home return preserves location')
  base=seeded(page);page.close();page=boot(context,base);enter(page)
  page.locator('#home-button').click();check(page.locator('.home975-card').count()==6,'six home facilities')
  check('250,000' in page.locator('#panel-body').inner_text(),'twelve-tier capacity visible')
  page.locator('[data-a="room"][data-room="forge"]').click();page.locator('[data-a="panel-step"][data-name="craft-spirit"]').click()
  before=page.evaluate('QinglanDemo.getState().xp');page.locator('[data-a="spirit"]').first.click()
  after=page.evaluate('QinglanDemo.getState().xp');check(after<before,'high-realm enchant spends current xp',{'before':before,'after':after})
  check(page.evaluate('QinglanDemo.getState().daoXp===0'),'obsolete dao pool stays zero')
  page.locator('.panel-close').click();check(page.evaluate('QinglanDemo.getUI().panel')=='craft','enchant back works without ReferenceError')
  # Leave home, configure all four slots through real select controls.
  while page.evaluate('QinglanDemo.getUI().panel') is not None:page.locator('.panel-close').click()
  page.locator('[data-a="quick-config"]').click()
  for i,kind in enumerate(['hp','spirit','food','water']):page.locator(f'#quick-slot-{i}').select_option('supply'+kind+'12')
  check(page.evaluate('QinglanDemo.getState().quickSlots.join(",")')=='supplyhp12,supplyspirit12,supplyfood12,supplywater12','four chosen items saved')
  saved=storage(page);page.close();page=boot(context,saved);enter(page)
  check(page.evaluate('QinglanDemo.getState().quickSlots[0]')=='supplyhp12','chosen potion survives reload')
  page.locator('#quest').click();q=page.locator('#panel-body').inner_text();check('渡劫' in q and '三重' not in q and '道行' not in q,'current quest follows actual high realm',q)
  page.locator('[data-a="quest-subpage"][data-page="world"]').click();check(page.locator('.q4-stages li').count()==12,'all twelve map statuses visible')
  page.locator('[data-a="quest-return"]').first.click();page.locator('[data-a="lore-open"]').click();check('尚未亲历' in page.locator('#panel-body').inner_text(),'optional stories not fabricated')

  # A real full middle realm must be presented as ready; s.stageIndex never existed.
  middle=seeded(page,6);page.close();page=boot(context,middle);enter(page)
  page.locator('#home-button').click();page.locator('[data-a="panel"][data-name="cultivate"]').click();page.locator('[data-a="cult-step"][data-name="cultivate-trial"]').click()
  check('后期圆满' in page.locator('#panel-body').inner_text(),'breakthrough readiness uses real stage getter')
  page.locator('[data-a="breakthrough"]').click();check(page.evaluate('QinglanDemo.getState().level')==19,'actual UI breakthrough advances level18 to19')
  # Backup-first import: storage fault must leave primary exactly unchanged.
  page.locator('.panel-close').click();page.locator('.panel-close').click();page.locator('[data-a="home-exit"]').click()
  page.locator('[data-a="panel"][data-name="settings"]').click();page.locator('[data-a="panel-step"][data-name="set-save"]').click()
  key='qinglan-wendao-v14-human-slot-001'
  raw=page.evaluate('(k)=>localStorage.getItem(k)',key);candidate=json.loads(raw);candidate['xp']+=1234
  page.evaluate("""(k)=>{window.__failBackup=k+'-backup';const obj=Object.getPrototypeOf(localStorage)===Object.prototype?localStorage:Storage.prototype;const real=obj.setItem;obj.setItem=function(a,b){if(a===window.__failBackup)throw new Error('browser injected backup fault');return real.call(this,a,b);};}""",key)
  page.locator('#import-file').set_input_files({'name':'test-save.json','mimeType':'application/json','buffer':json.dumps({'format':'QinglanWendao','state':candidate},ensure_ascii=False).encode()})
  page.locator('[data-a="confirm-import"]').click();check(page.evaluate('(k)=>localStorage.getItem(k)',key)==raw,'failed backup blocks UI import primary overwrite')
  page.evaluate('window.__failBackup=null');page.locator('[data-a="confirm-import"]').click()
  check(page.evaluate('QinglanDemo.getState().xp')==candidate['xp'],'successful import updates active game')
  check(page.evaluate('(k)=>localStorage.getItem(k+"-backup")',key)==raw,'successful import retains exact previous primary')
  # A historical two-home slot is archived, merged once and offers a downloadable rollback copy.
  old=json.loads(base[key]);old.pop('homeSchema');old.pop('homestead');old.pop('atHome');old.pop('quickSlots')
  old['settlements']=[None]*12
  for z,level in [(0,2),(1,3)]:old['settlements'][z]={'pos':{'x':1 if z==0 else 0,'y':5},'level':level,'buildings':{'warehouse':level,'forge':level},'stash':{'wood':10+z},'storedGears':[],'foundedAt':0,'farmAt':old['minutes']}
  oldraw=json.dumps(old,ensure_ascii=False,separators=(',',':'));page.close();page=boot(context,{key:oldraw,'shanye-promo-v1':'1'});enter(page)
  page.locator('#home-button').click();check(page.evaluate('QinglanDemo.getState().homestead.stash.wood')==21,'legacy two-home warehouse sum')
  check(page.evaluate('(k)=>localStorage.getItem(k+"-pre-global-home-v975")',key)==oldraw,'legacy primary immutable upgrade archive')
  page.locator('[data-a="home-exit"]').click();page.locator('[data-a="panel"][data-name="settings"]').click();page.locator('[data-a="panel-step"][data-name="set-save"]').click()
  check(page.locator('[data-a="export-prehome-archive"]').count()==1,'upgrade rollback export entry visible')
  if not ARGS.offline_dom:
   with page.expect_download() as d:page.locator('[data-a="export-prehome-archive"]').click()
   dest=OUT/'historical-download.json';d.value.save_as(str(dest));check(json.loads(dest.read_text())['state']==old,'downloaded archive contains complete original historical state')
  # Rescue candidate must survive background/pagehide without tombstoning the slot.
  rescue=json.loads(base[key]);rescue['life']['left']=1;rescue['life']['rescued']=False
  page.close();page=boot(context,{key:json.dumps(rescue,ensure_ascii=False),'shanye-promo-v1':'1'});enter(page)
  page.locator('#rest-button').click();check(page.locator('[data-a="ad-life-rescue"]').count()==1,'lifespan rescue dialog appears')
  before=page.evaluate('(k)=>localStorage.getItem(k)',key);page.evaluate("window.dispatchEvent(new Event('pagehide'))")
  check(page.evaluate('(k)=>localStorage.getItem(k)',key)==before,'rescue pagehide leaves prior save intact')
  check(page.evaluate('(k)=>localStorage.getItem(k+"-death")',key) is None,'rescue pagehide creates no tombstone')
  page.locator('[data-a="ad-life-rescue"]').click();check(page.evaluate('QinglanDemo.getState().life.rescued'),'rescue completion persisted')
  saved=storage(page);page.close();page=boot(context,saved);enter(page);check(page.evaluate('QinglanDemo.getState().life.left')==15*5760,'rescued character survives reload')

  check(not ERRORS,'functional UI has no uncaught exceptions',ERRORS)
  context.close()
  # Independent mobile/desktop viewports. Fixtures accelerate progression only.
  viewports=[(320,568),(360,640),(390,844),(412,915),(768,1024),(1280,900)]
  if ARGS.quick:viewports=[(390,844)]
  for w,h in viewports:
   ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,accept_downloads=True)
   pg=boot(ctx,base);enter(pg);shot(pg,f'{w}x{h}-world')
   check(pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'world horizontal bounds {w}')
   pg.locator('#home-button').click();m=panel_metrics(pg,'home',w,h);shot(pg,f'{w}x{h}-home')
   if w>=360:check(m['scroll']<=m['client']+3,f'home one screen {w}x{h}',m)
   pg.locator('[data-a="room"][data-room="forge"]').click();pg.locator('[data-a="panel-step"][data-cat="gear"]').click();check(pg.locator('[data-a="panel-step"][data-name="craft-tier"]').count()==12,f'gear twelve tier categories {w}')
   pg.locator('[data-a="panel-step"][data-tier="12"]').click();panel_metrics(pg,'tier12',w,h);shot(pg,f'{w}x{h}-tier12')
   for _ in range(6):
    if pg.evaluate('QinglanDemo.getUI().panel') is None:break
    pg.locator('.panel-close').click()
   pg.locator('[data-a="quick-config"]').click();panel_metrics(pg,'quicksetup',w,h);shot(pg,f'{w}x{h}-quicksetup')
   pg.locator('.panel-close').click();pg.locator('#quest').click();panel_metrics(pg,'progress',w,h);shot(pg,f'{w}x{h}-progress')
   ctx.close()
  check(not ERRORS,'entire viewport matrix zero JS errors',ERRORS)
 except Exception as exc:
  FATAL=str(exc)
  traceback.print_exc()
  try:page.screenshot(path=str(OUT/'failure.png'))
  except Exception:pass
  raise
 finally:
  browser.close();server.shutdown()
  report={'version':'V90.75','mode':'offline DOM + explicit in-memory Storage adapter' if ARGS.offline_dom else 'HTTP origin + real localStorage','checks':CHECKS,'errors':ERRORS,'screenshots':SHOTS,'metrics':METRICS,'fatal':FATAL,'pass':not FATAL and all(c['pass']for c in CHECKS)and not ERRORS}
  (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print('BROWSER',len(CHECKS),'checks',len(SHOTS),'screenshots','PASS'if report['pass'] else 'FAIL')
