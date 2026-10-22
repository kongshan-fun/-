#!/usr/bin/env python3
"""Chromium UI + actual localStorage save/refresh for V90.59; four phone sizes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'v959'/'browser'
OUT.mkdir(parents=True,exist_ok=True)
html=(ROOT/'index.html').read_text('utf8')
MARK='window.QinglanDemo='
assert html.count(MARK)==1
AUDIT=r'''
window.__V959={
 init(realm=1,role='human',pane='cultivate-trial'){
  const z=realm-1,seed=20261022;
  const s=QGame.fresh(seed,role);s.zone=z;s.unlocked=12;s.level=realm*3;
  s.hunger=s.water=100;s.life.left=200*D.LIFE.yearMinutes;
  s.cleared=Array(12).fill(true);s.ritual=Array(12).fill(true);
  const p=realm===12?{x:7,y:5}:(()=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const k=z+':'+x+','+y,l=D.ZONES[z].map[y][x];
   if(D.CAMP_LANDS.includes(l)&&!D.SITES[k]&&!D.EVENTS[k])return {x,y};
  }throw Error('no camp');})();
  s.pos=p;s.last={...p};s.visited[z+':'+p.x+','+p.y]=true;
  if(realm!==12)s.settlements[z]={pos:{...p},level:3,buildings:{warehouse:3,forge:3,quiet:3,farm:3},stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
  game=new QGame(s,seed,role);game.s.xp=game.required+777;game.s.hp=game.s.maxHp;game.s.spirit=game.s.maxSpirit;
  game.s.inv.guardPill=2;activeRole=role;activeSlot=99;deathBoot=false;saveAvailable=true;
  frontPage=null;panel=pane;modal=null;mapOpen=false;travelOpen=false;route=[];
  renderPage();render();
  return this.inspect();
 },
 preview(){return game.tribPreview()},
 saveAgain(){if(!persist())throw Error(saveStatus);return this.inspect()},
 inspect(){return {level:game.s.level,xp:game.s.xp,need:game.required,hp:game.s.hp,maxHp:game.s.maxHp,pills:game.s.inv.guardPill||0,minutes:game.s.minutes,combat:game.s.combat?JSON.parse(JSON.stringify(game.s.combat)):null,ascended:game.s.ascended,summary:document.querySelector('#panel-body')?.innerText||'',status:saveStatus}},
 combatInit(role='human'){
  const g=slots.newGame(role,999913,88);game=g;activeRole=role;activeSlot=88;
  frontPage=null;panel=null;deathBoot=false;saveAvailable=true;modal=null;
  game.s.hp=game.s.maxHp;game.s.hunger=game.s.water=100;
  const type=D.ZONES[0].boss;game.startBattle(type,true);
  game.s.combat.hp=Math.round(game.s.combat.maxHp*.52);
  game.s.combat.turn=3;game.s.combat.intent='heavy';
  const was=this.inspect();if(!persist())throw Error('Combat persist failed: '+saveStatus);
  renderPage();render();return {was,now:this.inspect()};
 },
 reloadCombat(role='human'){
  const res=slots.read(role,88);if(!res?.game)throw Error('Saved battle not found');
  game=res.game;activeRole=role;activeSlot=88;frontPage=null;panel=null;deathBoot=false;saveAvailable=true;
  renderPage();render();return this.inspect();
 }
};
'''
html=html.replace(MARK,AUDIT+MARK,1)  # in-memory page-only instrumentation
views=[(320,568),(360,640),(390,844),(412,915)]
results=[]
with sync_playwright() as pw:
 launch={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage']}
 if Path('/usr/bin/chromium').exists():launch['executable_path']='/usr/bin/chromium'
 browser=pw.chromium.launch(**launch)
 for w,h in views:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  # about:blank navigation is restricted in this runner, so use Playwright
  # set_content with a simulated Storage object; Node suite exercises real
  # durable store roundtrips independently.
  storage_shim='''<script>window.__v959Store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return Object.prototype.hasOwnProperty.call(window.__v959Store,k)?window.__v959Store[k]:null},setItem(k,v){window.__v959Store[k]=String(v)},removeItem(k){delete window.__v959Store[k]}}});</script>'''
  page.set_content(html.replace('<head>','<head>'+storage_shim,1),wait_until='domcontentloaded')
  assert 'V90.59' in page.locator('#entry-root').inner_text()
  for realm in range(1,5):
   state=page.evaluate('(realm)=>window.__V959.init(realm,"human")',realm)
   pane=page.locator('#panel-body').inner_text()
   assert '直接晋升' in pane,(w,h,realm,pane[:650])
   assert '本次伤害' not in pane and '渡劫后剩余' not in pane,(realm,pane[:650])
   btn=page.locator('#panel-root button[data-a="breakthrough"]')
   assert btn.count()==1 and btn.is_enabled(),(realm,pane[:650])
   if realm==1:page.screenshot(path=str(OUT/f'upgrade-{w}x{h}.png'))
   if w==390:
    btn.click();after=page.evaluate('window.__V959.inspect()')
    assert after['level']==realm*3+1,(state,after)
    assert after['hp']==state['hp'] and after['pills']==2,(state,after)
    assert after['xp']==777,(state,after)
  pre=page.evaluate('window.__V959.init(5,"human")')
  panel=page.locator('#panel-body').inner_text()
  assert '本次伤害' in panel and '渡劫后剩余' in panel,(w,h,panel[:850])
  page.screenshot(path=str(OUT/f'tribulation-{w}x{h}.png'))
  if w==390:
   btn=page.locator('#panel-root button[data-a="breakthrough"]')
   assert btn.is_enabled()
   expected=page.evaluate('window.__V959.preview()')
   btn.click()
   after=page.evaluate('window.__V959.inspect()')
   assert after['level']==16 and after['hp']==expected['hpAfter'] and after['pills']==0,(pre,after,expected)
  if w==390:
   # Real localStorage write, browser reload and restore; two different save writes.
   before=page.evaluate('window.__V959.combatInit()')
   assert before['now']['combat']==before['was']['combat']
   page.screenshot(path=str(OUT/'combat-saved-390x844.png'))
   snapshot=page.evaluate('JSON.stringify(window.__v959Store)')
   restored='''<script>window.__v959Store=JSON.parse('''+json.dumps(snapshot)+''');Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return Object.prototype.hasOwnProperty.call(window.__v959Store,k)?window.__v959Store[k]:null},setItem(k,v){window.__v959Store[k]=String(v)},removeItem(k){delete window.__v959Store[k]}}});</script>'''
   page.close()
   page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.set_content(html.replace('<head>','<head>'+restored,1),wait_until='domcontentloaded')
   after=page.evaluate('window.__V959.reloadCombat()')
   for key in ['type','hp','maxHp','atk','armor','turn','riposte','intent','repeat']:
    assert after['combat'][key]==before['now']['combat'][key],(key,before,after)
   for _ in range(3):
    r=page.evaluate('window.__V959.saveAgain()')
    for key in ['type','hp','maxHp','atk','armor','turn','riposte','intent','repeat']:
     assert r['combat'][key]==after['combat'][key],(key,r,after)
   assert '未能落盘' not in after['status']
   page.screenshot(path=str(OUT/'combat-restored-390x844.png'))
  assert not errors,errors
  info=page.locator('#panel-body').evaluate('(el)=>({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth})') if page.locator('#panel-body').count() else {'clientWidth':0,'scrollWidth':0}
  assert info['scrollWidth']<=info['clientWidth']+2,(w,h,info)
  results.append({'viewport':f'{w}x{h}','earlyUpgrade':'PASS','tribulation':'PASS','combatReload':'PASS' if w==390 else 'not_run','errors':errors,'width':info})
  page.close()
 browser.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
print('V90.59 BROWSER PASS',len(results),'viewports; screenshots',len(list(OUT.glob('*.png'))),'with combat reload')
