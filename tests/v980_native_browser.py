#!/usr/bin/env python3
"""Exact release UI in Chromium. --offline-dom is explicitly storage-shim coverage only.
Default uses HTTP, real origin localStorage, reload and downloads in GitHub CI.
All advanced states are isolated test fixtures, never player data.
"""
from pathlib import Path
import json,functools,http.server,threading,shutil,sys,traceback,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OFFLINE='--offline-dom' in sys.argv
OUT=ROOT/('artifacts/v980/browser-render' if OFFLINE else 'artifacts/v980/browser');OUT.mkdir(parents=True,exist_ok=True)
HTML=(ROOT/'index.html').read_text();checks=[];errors=[];shots=[];metrics=[]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();URL=f'http://127.0.0.1:{server.server_port}/index.html'
def ck(value,name,detail=None):
 checks.append(dict(name=name,pass_=bool(value),detail=detail))
 if not value:raise AssertionError(name+' '+str(detail))
def nav(p,saved=None):
 if not OFFLINE:p.goto(URL);return
 p.goto('about:blank');shim="""<script>(()=>{const m=new Map(Object.entries(%s));Storage.prototype.getItem=function(k){return m.get(String(k))??null};Storage.prototype.setItem=function(k,v){m.set(String(k),String(v))};Storage.prototype.removeItem=function(k){m.delete(String(k))};Storage.prototype.clear=function(){m.clear()};Storage.prototype.key=function(i){return [...m.keys()][i]??null};Object.defineProperty(Storage.prototype,'length',{get(){return m.size},configurable:true});Object.defineProperty(window,'localStorage',{value:Object.create(Storage.prototype),configurable:true});})();</script>"""%json.dumps(saved or {},ensure_ascii=False)
 p.set_content(HTML.replace('<head>','<head>'+shim),wait_until='load')
def refresh(p):
 if OFFLINE:nav(p,p.evaluate('Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i);return[k,localStorage.getItem(k)]}))'))
 else:p.reload()
def state(p):return p.evaluate('QinglanDemo.getState()')
def enter(p,race='human'):
 p.locator('[data-a="difficulty-choice"][data-mode="challenge"]').click();p.locator('[data-a="difficulty-next"]').click();p.locator(f'[data-a="choose-role"][data-role="{race}"]').click();p.locator('[data-a="view-slots"]').click();p.locator('[data-a="slot-open"][data-slot="1"]').click();p.wait_for_function('QinglanDemo.getUI().frontPage===null')
def seed(p,tier=12,race='human',home=True,legacy=False,mature=False,full=False):
 # Neutralize prior pagehide first; otherwise the old UI can overwrite a freshly
 # prepared scenario during reload. This is test isolation, not game logic.
 p.goto('about:blank');nav(p)
 saved=p.evaluate('''cfg=>{
 const g=new QGame(null,663311,cfg.race),D=QData;
 g.s.level=cfg.tier*3;g.syncMajor();const st=D.statsForLevel(g.s.level);Object.assign(g.s,{hp:st.hp,maxHp:st.hp,spirit:st.spirit,maxSpirit:st.spirit,attack:st.atk,hunger:100,water:100,xp:100000});g.s.life.left=500*D.LIFE.yearMinutes;g.s.cleared=Array.from({length:12},(_,i)=>i<cfg.tier-1);g.s.ritual=g.s.cleared.slice();g.recalcUnlocked();g.s.guide.status='skipped';g.s.settings.motion=false;g.s.bigu.noticeTier=cfg.tier>=11?11:cfg.tier>=9?9:cfg.tier>=7?7:cfg.tier>=5?5:0;
 if(cfg.home){g.enterHome();Object.assign(g.s.inv,D.SETTLE_COST);g.act('settle');g.camp.level=cfg.tier;for(const id of D.HOME_ROOMS.filter(x=>x!=='residence'))g.camp.buildings[id]=cfg.tier;
 g.camp.stash={wood:100,stone:10000,herb:100,water:100,seedHerb:100,seedFiber:30,seedWood:30,seedGodFruit:3};g.s.garden.plots=Array(D.gardenCapacity(cfg.tier)).fill(null);g.s.garden.starter=true;
 const gear=g.createGear('woodSword',2);g.s.gears.push(gear);
 if(cfg.mature){g.s.minutes+=5000;g.s.garden.plots[0]={crop:'seedHerb',plantedAt:g.s.minutes-720,readyAt:g.s.minutes};}
 if(cfg.full){g.camp.stash={wood:Math.floor(g.stashCapacity()/2)};g.s.inv={wood:Math.floor(g.capacity/2),fiber:g.capacity%2};}
 if(cfg.legacy){g.s.minutes+=5000;g.camp.farmAt=g.s.minutes-2000;g.camp.pendingHarvest={herb:4};delete g.s.garden;}
 }g.leaveHome();const slots=new QCharacterSlots(localStorage);const data={[slots.key(cfg.race,1)]:JSON.stringify(g.state()),'shanye-promo-v1':'1'};return data;
 }''',dict(tier=tier,race=race,home=home,legacy=legacy,mature=mature,full=full))
 if OFFLINE:nav(p,saved)
 else:
  p.goto('about:blank');p.goto(URL);p.evaluate('data=>{localStorage.clear();for(const[k,v]of Object.entries(data))localStorage.setItem(k,v);}',saved)
  # This page has no active player, so its pagehide cannot overwrite a fixture.
  p.reload()
 enter(p,race)
def click(p,sel):p.locator(sel).first.click()
def home(p):click(p,'#home-button')
def facility(p,name):click(p,f'[data-a="facility-open"][data-name="{name}"]')
def shot(p,name):
 p.wait_for_function('!document.querySelector("#toast.show")',timeout=12000);p.screenshot(path=str(OUT/(name+'.png')));shots.append(name+'.png')
def sizecheck(p,w,h,name,fit=False):
 m=p.locator('#panel-body').evaluate('e=>({w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight})');metrics.append(dict(viewport=[w,h],panel=name,**m));ck(m['sw']<=m['w']+1,'无横向溢出 '+name+str(w),m)
 if fit:ck(m['sh']<=m['h']+2,'一页收揽 '+name+str([w,h]),m)
 b=p.locator('.panel-close').bounding_box();ck(b['y']>=0 and b['x']+b['width']<=w+1 and b['y']+b['height']<=h+1,'关闭按钮可达 '+name)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=b.new_context(viewport={'width':390,'height':844},accept_downloads=True);p=ctx.new_page();p.set_default_timeout(6500);p.on('pageerror',lambda e:errors.append(str(e)))
 try:
  seed(p,tier=1,home=False);ck('V90.80' in p.title(),'实际入口版本正确');ck(p.locator('#manuals-button').inner_text()=='功法','底栏炼制改功法');click(p,'#manuals-button');ck(not state(p)['atHome'],'野外功法只读不传送');click(p,'.panel-close');click(p,'#pack-button');click(p,'[data-a="handcraft"]');ck(p.evaluate('QinglanDemo.getUI().panel')=='handcraft','建府前可随身手作');ck(p.locator('#recipe-axe').count()==1,'粗木斧可见');shot(p,'01_无洞府也能随身手作')
  seed(p);home(p);ck(p.locator('.facility978-card').count()==6,'六设施均有独立入口');ck('无需升级' in p.locator('#building-workbench').inner_text(),'工作台自动启用无等级');ck(p.locator('.home978-nav button').last.inner_text()=='赋灵','洞府功法位替换赋灵');shot(p,'02_洞府百业_建筑入口')
  facility(p,'facility-forge');ck(p.locator('[data-station]').count()>0,'十二阶装备可见');ck(p.locator('[data-station]:not([data-station="forge"])').count()==0,'炼器室不混杂丹药工具');shot(p,'03_炼器室_装备独立');click(p,'[data-a="facility-back"]')
  facility(p,'facility-alchemy');ck(p.locator('[data-station]:not([data-station="alchemy"])').count()==0,'丹房不混杂装备');ck('养元丹' in p.locator('#panel-body').inner_text(),'丹药页');click(p,'[data-a="facility-tab"][data-tab="food"]');ck('灵膳' in p.locator('#panel-body').inner_text(),'食品灵饮独立页');shot(p,'04_丹房_灵膳灵饮');click(p,'[data-a="facility-back"]')
  facility(p,'facility-workbench');ck('无需升级' in p.locator('#panel-body').inner_text(),'工作台说明无等级');click(p,'[data-a="facility-tab"][data-tab="bag"]');p.locator('#facility-tier').select_option('12');ck(p.locator('#recipe-bag12').count()==1,'十二阶储物袋仍可查看');ck('炼器室' not in p.locator('#recipe-bag12').inner_text(),'储物袋不再要求炼器室等级');shot(p,'05_工作台_十二阶储物袋');click(p,'[data-a="facility-back"]')
  facility(p,'facility-spirit');before=state(p)['xp'];click(p,'[data-a="spirit"]');ck(state(p)['xp']<before,'赋灵真实扣修为');shot(p,'06_独立赋灵入口');click(p,'[data-a="facility-back"]')
  facility(p,'garden');ck(p.locator('.garden978-plot').count()==26,'长屏完整展示26块田');p.set_viewport_size(dict(width=320,height=568));p.wait_for_function('document.querySelectorAll(".garden978-plot").length===12',timeout=6000);ck(p.locator('.garden978-plot').count()==12,'短屏保留12格分页');click(p,'[data-a="garden-page"][data-delta="1"]');click(p,'[data-a="garden-page"][data-delta="1"]');ck(p.locator('.garden978-plot').count()==2,'十二阶第三页2块田');p.set_viewport_size(dict(width=390,height=844));p.wait_for_function('document.querySelectorAll(".garden978-plot").length===26',timeout=6000);ck(p.locator('.garden978-plot').count()==26,'恢复长屏后仍显示全部田地');shot(p,'07_十二阶灵田_地块总览')
  click(p,'[data-a="garden-plot"][data-index="0"]');p.locator('#garden-seed').select_option('seedHerb');before=state(p);click(p,'[data-a="garden-confirm"]');after=state(p);ck(after['garden']['plots'][0]['crop']=='seedHerb','真实播种');ck(after['minutes']==before['minutes']+5,'播种耗时5分钟');ck(after['homestead']['stash']['seedHerb']==before['homestead']['stash']['seedHerb']-1,'扣除一粒种子');shot(p,'08_播种后_生长状态');saved=after['garden'];refresh(p);enter(p);ck(state(p)['garden']==saved,'游戏刷新后种植时钟与种子记录不变');home(p);facility(p,'garden')
  click(p,'[data-a="garden-plot"][data-index="0"]');click(p,'[data-a="garden-clear-prompt"]');click(p,'[data-a="modal-close"]');ck(state(p)['garden']['plots'][0] is not None,'取消清理不伤作物');click(p,'[data-a="garden-batch"]');click(p,'[data-a="garden-confirm"]');ck(len([x for x in state(p)['garden']['plots'] if x])>1,'批量播种实际生效')
  seed(p,mature=True);home(p);facility(p,'garden');before=state(p)['homestead']['stash']['herb'];click(p,'[data-a="garden-collect"]');ck(state(p)['homestead']['stash']['herb']==before+3,'收获实际入仓');ck(state(p)['garden']['plots'][0] is None,'收获后清田');ck(p.locator('[data-a="garden-collect"]').is_disabled(),'不重复发放');shot(p,'09_成熟收获_一次结算')
  seed(p,mature=True,full=True);home(p);facility(p,'garden');click(p,'[data-a="garden-collect"]');ck(state(p)['garden']['plots'][0] is not None,'满仓不丢收成');shot(p,'10_满仓作物保留')
  seed(p,legacy=True);home(p);facility(p,'garden');ck(p.locator('[data-a="garden-claim"]').count()==1,'旧田保留产出可领取');ck(state(p)['garden']['legacyDue'] is not None,'旧田剩余生长折算一次');shot(p,'11_旧灵田无损迁移');click(p,'[data-a="garden-claim"]');ck(not state(p)['garden']['legacyYield'],'旧产出领完无重复');click(p,'[data-a="facility-back"]');click(p,'[data-a="home-exit"]');click(p,'[data-a="panel"][data-name="settings"]');click(p,'[data-a="panel-step"][data-name="set-save"]');ck(p.locator('[data-a="garden-export-archive"]').count()==1,'升级前原始存档有导出入口')
  if not OFFLINE:
   with p.expect_download() as di:click(p,'[data-a="garden-export-archive"]')
   dl=di.value;dl.save_as(str(OUT/'legacy-export.json'));raw=json.loads((OUT/'legacy-export.json').read_text());ck('garden' not in raw['state'],'下载的是升级前原档')
  seed(p);home(p);facility(p,'garden');before=state(p);p.evaluate('''()=>{window.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='qinglan-wendao-v14-human-slot-001')throw Error('quota injection');return window.oldSet.call(this,k,v)}}''');click(p,'[data-a="garden-plot"][data-index="0"]');click(p,'[data-a="garden-confirm"]');ck(state(p)['garden']==before['garden'],'写盘失败播种回滚');ck(state(p)['homestead']['stash']['seedHerb']==before['homestead']['stash']['seedHerb'],'失败不吞种子');p.evaluate('()=>{Storage.prototype.setItem=window.oldSet;delete window.oldSet;}')
  # No fixed stage count masquerading as real policy: UI and engine share config.
  seed(p);home(p);click(p,'[data-a="panel"][data-name="cultivate"]');ck(p.locator('#bigu-toggle').count()==1,'辟谷管理保留');shot(p,'12_修炼与辟谷保持可用')
  for w,h in [(320,568),(360,640),(390,844),(430,932),(768,1024),(1280,900)]:
   p.set_viewport_size(dict(width=w,height=h));seed(p);home(p);sizecheck(p,w,h,'洞府',True);shot(p,f'{w}x{h}_洞府');facility(p,'garden');sizecheck(p,w,h,'灵田',True);shot(p,f'{w}x{h}_灵田');click(p,'[data-a="garden-plot"][data-index="0"]');mb=p.locator('.garden978-modal').bounding_box();ck(mb['y']>=0 and mb['y']+mb['height']<=h+1,'播种弹窗边界 '+str(w),mb);shot(p,f'{w}x{h}_播种');click(p,'[data-a="modal-close"]')
  ck(not errors,'无浏览器运行错误',errors)
 except Exception:
  p.screenshot(path=str(OUT/'FAILURE.png'));raise
 finally:
  report=dict(version='V90.80',sourceSha256=hashlib.sha256((ROOT/'index.html').read_bytes()).hexdigest().upper(),mode='offline-dom-storage-shim' if OFFLINE else 'native-http-localStorage',checks=checks,passed=sum(bool(x['pass_']) for x in checks),total=len(checks),errors=errors,metrics=metrics,screenshots=shots)
  (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));ctx.close();b.close();server.shutdown()
print('V90.80 BROWSER PASS',len(checks),'checks',len(shots),'screenshots',report['mode'])
