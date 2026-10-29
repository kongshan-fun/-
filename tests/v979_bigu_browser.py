#!/usr/bin/env python3
"""Native Chromium + HTTP + origin localStorage + real UI clicks, no DOM mocks.
Progression fixtures accelerate screenshots only; no player accounts are used.
"""
from pathlib import Path
import functools,http.server,threading,json,shutil,traceback,hashlib,sys
from playwright.sync_api import sync_playwright
OFFLINE='--offline-dom' in sys.argv
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/('artifacts/v979/bigu-browser-render' if OFFLINE else 'artifacts/v979/bigu-browser');OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}/index.html'
checks=[];errors=[];shots=[];metrics=[];fatal=None
HTML=(ROOT/'index.html').read_text()
def navigate(p,saved=None):
 if not OFFLINE:
  p.goto(URL)
  return
 p.goto('about:blank')
 shim="""<script>(function(){const m=new Map(Object.entries(%s));Storage.prototype.getItem=function(k){return m.get(String(k))??null};Storage.prototype.setItem=function(k,v){m.set(String(k),String(v))};Storage.prototype.removeItem=function(k){m.delete(String(k))};Storage.prototype.clear=function(){m.clear()};Storage.prototype.key=function(i){return [...m.keys()][i]??null};Object.defineProperty(Storage.prototype,'length',{get(){return m.size},configurable:true});Object.defineProperty(window,'localStorage',{value:Object.create(Storage.prototype),configurable:true});})();</script>"""%json.dumps(saved or {},ensure_ascii=False)
 p.set_content(HTML.replace('<head>','<head>'+shim),wait_until='load')
def refresh(p):
 if not OFFLINE:
  p.reload()
  return
 saved=p.evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return[k,localStorage.getItem(k)]}))')
 navigate(p,saved)


def ck(v,label,detail=None):
 checks.append({'name':label,'pass':bool(v),'detail':detail})
 if not v:raise AssertionError(label+' '+str(detail))
def state(p):return p.evaluate('QinglanDemo.getState()')
def shot(p,name):
 p.wait_for_function('!document.querySelector("#toast.show")',timeout=10000);p.screenshot(path=str(OUT/(name+'.png')));shots.append(name+'.png')
def enter(p,race='human',mode='challenge',slot=1):
 p.locator(f'[data-a="difficulty-choice"][data-mode="{mode}"]').click();p.locator('[data-a="difficulty-next"]').click()
 p.locator(f'[data-a="choose-role"][data-role="{race}"]').click();p.locator('[data-a="view-slots"]').click();p.locator(f'[data-a="slot-open"][data-slot="{slot}"]').click()
 p.wait_for_function('QinglanDemo.getUI().frontPage===null')
def seed(p,realm=7,race='human',ack=7,enabled=False,energy=1,breakthrough=False,old=False,combat=False,theme='forest'):
 navigate(p)
 p.evaluate('''cfg=>{
 const g=new QGame(null,123456,cfg.race),D=QData;
 g.s.level=cfg.breakthrough?18:cfg.realm*3-2;g.syncMajor();const b=D.statsForLevel(g.s.level);
 Object.assign(g.s,{maxHp:b.hp,hp:b.hp,maxSpirit:b.spirit,spirit:Math.floor(b.spirit*cfg.energy),attack:b.atk,xp:0});
 g.s.life.left=400*D.LIFE.yearMinutes;g.s.hunger=g.s.water=90;g.s.guide.status='skipped';g.s.settings.motion=false;
 g.enterHome();for(const[k,v]of Object.entries(D.SETTLE_COST))g.s.inv[k]=v+5;g.act('settle');
 g.camp.level=cfg.realm;for(const id of D.HOME_ROOMS.filter(k=>k!=='residence'))g.camp.buildings[id]=cfg.realm;
 g.camp.stash.stone=500;g.s.inv.guardPill=2;g.s.inv.berry=5;g.s.inv.water=5;
 if(cfg.breakthrough)g.s.xp=g.required;
 g.s.bigu.enabled=cfg.enabled;g.s.bigu.noticeTier=cfg.ack;
 if(cfg.old)delete g.s.bigu;
 g.leaveHome();if(cfg.combat)g.startBattle('wolf');
 localStorage.clear();const slots=new QCharacterSlots(localStorage);localStorage.setItem(slots.key(cfg.race,1),JSON.stringify(g.state()));
 localStorage.setItem('shanye-promo-v1','1');localStorage.setItem('shanye-visual-theme-v28',cfg.theme);
 }''',locals_config(realm,race,ack,enabled,energy,breakthrough,old,combat,theme))
 refresh(p);enter(p,race)
def locals_config(realm,race,ack,enabled,energy,breakthrough,old,combat,theme):return dict(realm=realm,race=race,ack=ack,enabled=enabled,energy=energy,breakthrough=breakthrough,old=old,combat=combat,theme=theme)
def cultivate(p):
 p.locator('#home-button').click();p.locator('[data-a="panel"][data-name="cultivate"]').click()
def bounds(p,selector,label,w,h):
 b=p.locator(selector).first.bounding_box();ck(bool(b) and b['x']>=-1 and b['y']>=-1 and b['x']+b['width']<=w+1 and b['y']+b['height']<=h+1,label+' in viewport',b)
def layout(p,w,h,dialog=False):
 selector='.bigu977-modal' if dialog else '#panel-body'
 m=p.locator(selector).evaluate('e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight})');metrics.append(dict(viewport=[w,h],dialog=dialog,**m))
 ck(m['scrollWidth']<=m['width']+1,'no horizontal overflow '+str([w,h,dialog]),m)
 if dialog:
  bounds(p,'.bigu977-modal','dialog bounds',w,h)
  for sel in ['[data-a="bigu-confirm"]','[data-a="bigu-later"]','#bigu-enable-now']:bounds(p,sel,sel,w,h)
 else:
  bounds(p,'#bigu-toggle','visible switch',w,h);bounds(p,'.panel-close','visible back button',w,h)
  ck(m['scrollHeight']<=m['height']+2,'cultivation fits a screen '+str([w,h]),m)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  ctx=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
  p=ctx.new_page();p.set_default_timeout(6000);p.on('pageerror',lambda e:errors.append(str(e)))
  navigate(p);ck('V90.79' in p.title(),'V90.79 actual release title')
  seed(p,realm=6,ack=5,breakthrough=True);cultivate(p)
  ck(p.locator('#bigu-toggle').is_disabled(),'sixth realm cannot enable extra conversion')
  ck('75%' in p.locator('.bigu977-card').inner_text(),'sixth realm has automatic 25 percent reduction')
  p.locator('[data-a="cult-step"][data-name="cultivate-trial"]').click();shot(p,'01_突破前_金丹圆满')
  predicted=p.locator('.trib-hero-top').inner_text()
  p.locator('[data-a="breakthrough"]').click();ck(state(p)['level']==19,'actual breakthrough reaches seventh realm')
  actual=state(p);actual_pct=int(actual['hp']/actual['maxHp']*100+0.5)
  ck('成功后约 '+str(actual_pct)+'% 气血' in predicted,'breakthrough HP forecast matches new realm result',dict(predicted=predicted,hp=actual['hp'],maxHp=actual['maxHp']))
  ck(p.locator('.bigu977-awakening').count()==1,'breakthrough opens learning dialog')
  ck(not p.locator('#bigu-enable-now').is_checked(),'first learning opt-in is unchecked')
  ck('−50%' in p.locator('.bigu977-gift').inner_text(),'learning states new passive benefit')
  shot(p,'02_突破领悟_默认不勾选');layout(p,390,844,True)
  p.locator('#bigu-enable-now').check();p.locator('[data-a="bigu-confirm"]').click()
  ck(state(p)['bigu']['enabled'] and state(p)['bigu']['noticeTier']==7,'choice and first notice persisted')
  ck(p.evaluate('QinglanDemo.getUI().panel')=='cultivate','confirm returns directly to cultivation');ck('生效中' in p.locator('.bigu977-card').inner_text(),'cultivation active status matches enabled switch')
  shot(p,'03_修炼页_已开启');layout(p,390,844)
  # Actually use a gather action through the UI and compare resource debits.
  p.locator('.panel-close').click();p.locator('[data-a="home-exit"]').click();before=state(p)
  p.locator('#resources [data-a="gather"]').first.click();after=state(p)
  ck(after['bigu']['spentSpirit']>before['bigu']['spentSpirit'],'ordinary gather actually spends conversion energy')
  ck(after['hunger']==before['hunger'] and after['water']==before['water'],'converted gather preserves ordinary food and water')
  ck(after['spirit']<before['spirit'],'conversion consumes real shared energy')
  spent=after['bigu'];refresh(p);enter(p);ck(state(p)['bigu']==spent,'all debt and credit fields survive real reload')
  ck(p.locator('.bigu977-awakening').count()==0,'no repeated unlock modal after reload')
  cultivate(p);p.locator('#bigu-toggle').click();ck(not state(p)['bigu']['enabled'],'off switch changes saved state')
  ck('50%' in p.locator('.bigu977-card').inner_text(),'off never removes passive reduction')
  # Storage write failure must restore both UI and memory; no misleading enabled state.
  p.evaluate('''()=>{window.origSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='qinglan-wendao-v14-human-slot-001')throw new DOMException('test quota','QuotaExceededError');return window.origSet.call(this,k,v)}}''')
  p.locator('#bigu-toggle').click();ck(not state(p)['bigu']['enabled'],'quota failure rolls back toggle memory')
  ck(p.locator('#bigu-toggle').get_attribute('aria-checked')=='false','quota failure does not fake UI success');p.evaluate('()=>{Storage.prototype.setItem=window.origSet;}')
  refresh(p);enter(p);ck(not state(p)['bigu']['enabled'],'off state persists after failed enable')
  # Below reserve -> automatic pause, not a fake OFF switch. Restore via real rest.
  seed(p,realm=7,ack=7,enabled=True,energy=.4);cultivate(p)
  ck(p.locator('#bigu-toggle').get_attribute('aria-checked')=='true','low reserve keeps user preference ON')
  ck('储备不足' in p.locator('.bigu977-card').inner_text(),'pause reason visible');shot(p,'04_四成储备_自动暂停')
  before=state(p);p.locator('[data-a="cult-step"][data-name="cultivate-rest"]').click()
  # The normal rest page exposes the original rest action.
  p.locator('#panel-body [data-a="rest"][data-mode="camp"]').click();p.locator('.panel-close').click()
  ck(state(p)['spirit']>before['spirit'],'actual rest recovers real energy')
  ck(state(p)['bigu']['spentSpirit']==before['bigu']['spentSpirit'],'rest does not spend-and-refill conversion energy')
  ck('生效中' in p.locator('.bigu977-card').inner_text(),'energy recovery auto resumes without another switch')
  shot(p,'05_休整后_自动恢复')
  # Old high-realm save: one catch-up, default OFF, no extra breakthrough.
  seed(p,realm=11,old=True);ck('旧档直接领悟' in p.locator('.bigu977-dialog').inner_text(),'old advanced save catch-up explained')
  ck(not p.locator('#bigu-enable-now').is_checked(),'old save does not opt in secretly');p.locator('[data-a="bigu-later"]').click()
  ck(not state(p)['bigu']['enabled'] and state(p)['bigu']['noticeTier']==11,'skip acknowledges once and stays off')
  refresh(p);enter(p);ck(p.locator('.bigu977-awakening').count()==0,'old save prompt not repeated')
  cultivate(p);ck('15%' in p.locator('.bigu977-card').inner_text(),'old advanced save receives correct passive reduction')
  shot(p,'06_高境旧档_减耗生效');p.locator('[data-a="bigu-rules"]').click();shot(p,'07_辟谷规则_五档进阶');p.keyboard.press('Escape')
  # Demon uses existing demon energy (same engine field, correct label).
  seed(p,realm=7,race='demon',old=True);ck('妖元' in p.locator('.bigu977-dialog').inner_text(),'demon awakening uses correct energy name');p.locator('#bigu-enable-now').check();p.locator('[data-a="bigu-confirm"]').click();cultivate(p)
  ck('妖元' in p.locator('.bigu977-card').inner_text(),'demon card label consistent');shot(p,'08_妖族_妖元辟谷')
  # Combat pause: inspect display then execute a real battle action.
  seed(p,realm=7,ack=7,enabled=True,combat=True)
  ck('斗法中暂停' in p.locator('.bigu977-combat-note').inner_text(),'combat pause explicitly shown');shot(p,'09_斗法中_暂停额外抵扣')
  before=state(p);p.locator('[data-a="fight"][data-mode="attack"]').first.click();after=state(p)
  ck(after['bigu']['spentSpirit']==before['bigu']['spentSpirit'],'combat action spends no extra conversion energy')
  # A V90.76 rescue receipt can legitimately lack the new field. It must not
  # crash after recovery or show the optional learning popup ahead of rescue.
  seed(p,realm=7,ack=7)
  p.evaluate("""()=>{
   const raw=QinglanDemo.getState();delete raw.bigu;raw.life.left=1;raw.life.rescued=false;raw.ended=false;
   localStorage.clear();const disk=new QCharacterSlots(localStorage);localStorage.setItem(disk.key('human',1),JSON.stringify(raw));
   const g=new QGame(raw);delete g.s.bigu;g.expire('old-version fixture');disk.markRescuePending('human',1,g);
   localStorage.setItem('shanye-promo-v1','1');
  }""")
  refresh(p);enter(p);ck(p.locator('[data-a="ad-life-rescue"]').count()==1,'old rescue prompt has priority over learning')
  ck(p.locator('.bigu977-awakening').count()==0,'no learning modal over a dead character')
  p.locator('[data-a="ad-life-rescue"]').click();ck(p.locator('.bigu977-awakening').count()==1,'learning available after old-version rescue')
  p.locator('[data-a="bigu-later"]').click();ck(state(p)['bigu']['noticeTier']==7,'old rescue state upgraded without missing-field crash')
  # Six sizes, both dialog and permanent management, native storage.
  for w,h in [(320,568),(360,640),(390,844),(430,932),(768,1024),(1280,900)]:
   p.set_viewport_size({'width':w,'height':h});seed(p,realm=7,old=True);layout(p,w,h,True);shot(p,f'{w}x{h}_领悟')
   p.locator('[data-a="bigu-later"]').click();cultivate(p);layout(p,w,h);shot(p,f'{w}x{h}_修炼')
  # Visible low-realm explanation and keyboard dismissal keep preference clear.
  p.set_viewport_size({'width':390,'height':844});seed(p,realm=5,ack=0);cultivate(p)
  ck(p.locator('#bigu-toggle').is_disabled(),'realm five only passive');shot(p,'10_筑基_初步辟谷')
  seed(p,realm=7,old=True);p.keyboard.press('Escape');ck(not state(p)['bigu']['enabled'] and state(p)['bigu']['noticeTier']==7,'escape records later choice, no repeat trap')
  ck(not errors,'no uncaught browser exceptions',errors)
  ctx.close()
 except Exception as e:
  fatal=traceback.format_exc();print(fatal)
  try:p.screenshot(path=str(OUT/'FAILURE.png'))
  except:pass
 finally:
  browser.close();server.shutdown()
  report={'version':'V90.79','kind':'Chromium rendered release + explicit memory Storage adapter' if OFFLINE else 'real HTTP origin + native localStorage + Chromium UI','sourceSha256':hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest(),'checks':checks,'passed':sum(x['pass'] for x in checks),'total':len(checks),'errors':errors,'fatal':fatal,'metrics':metrics,'screenshots':shots}
  (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('V90.79 BROWSER',report['passed'],'/',report['total'],'fatal',bool(fatal),'errors',errors)
if fatal:raise SystemExit(1)
