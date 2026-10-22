#!/usr/bin/env python3
"""Actual Chromium DOM click/viewport checks; no external network, no seed persisted to user storage."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, hashlib, os

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence'/'v958'/'browser'
OUT.mkdir(parents=True,exist_ok=True)
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
MARK='window.QinglanDemo='
assert HTML.count(MARK)==1
AUDIT=r'''
window.__V958_AUDIT={
 init(realm=5,role='human',mode='trial'){
  const z=realm-1,seed=20261022;
  const s=QGame.fresh(seed,role);s.zone=z;s.unlocked=12;s.level=realm*3;
  s.hunger=s.water=100;s.life.left=200*D.LIFE.yearMinutes;
  s.cleared=Array(12).fill(true);s.ritual=Array(12).fill(true);
  const p=realm===12?{x:7,y:5}:(()=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const k=z+':'+x+','+y,l=D.ZONES[z].map[y][x];
   if(D.CAMP_LANDS.includes(l)&&!D.SITES[k]&&!D.EVENTS[k])return {x,y};
  }throw Error('no suitable campsite');})();
  s.pos=p;s.last={...p};s.visited[z+':'+p.x+','+p.y]=true;
  if(realm!==12)s.settlements[z]={pos:{...p},level:3,buildings:{warehouse:3,forge:3,alchemy:3,quiet:3,farm:3},stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
  for(const k of Object.keys(D.ITEMS))s.inv[k]=0;
  s.inv.tribulationCrystal=3;s.inv.ascendToken=2;
  game=new QGame(s,seed,role);game.s.xp=game.required;game.s.hp=game.s.maxHp;game.s.spirit=game.s.maxSpirit;
  activeRole=role;activeSlot=1;deathBoot=false;saveAvailable=false;saveStatus='测试档 · 不写入真实存档';
  frontPage=null;panel=mode==='settings'?'settings':mode==='quest'?'quest':mode==='cultivate'?'cultivate':'cultivate-trial';
  modal=null;travelOpen=false;mapOpen=false;route=[];
  renderPage();render();
  return {level:game.s.level,stage:game.stageIndex,xp:game.s.xp,required:game.required,preview:game.tribPreview(realm===12)};
 },
 inspect(){return {level:game.s.level,hp:game.s.hp,maxHp:game.s.maxHp,ascended:game.s.ascended,
  stage:game.stageIndex,objective:objective().title,summary:document.querySelector('#panel-body')?.innerText||'',
  panel,preview:game.tribPreview(game.s.level===36)};},
 setHp(hp){game.s.hp=hp;render();},
};
'''
HTML=HTML.replace(MARK,AUDIT+MARK,1)
VIEWPORTS=[(320,568),(360,640),(390,844),(412,915)]
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for w,h in VIEWPORTS:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(HTML,wait_until='domcontentloaded',timeout=30000)
        # Real cold boot: the role selector should show the new twelve-realm path.
        entry=page.locator('#entry-root').inner_text()
        assert 'V90.58' in entry and '凡人' in entry and '感气' in entry and '引气' in entry,entry[:550]
        page.screenshot(path=str(OUT/f'cold-boot-{w}x{h}.png'))
        # Core-stage previously showed a false "修为未满" blocker.
        page.evaluate('window.__V958_AUDIT.init(5,"human","trial")')
        details=page.evaluate('window.__V958_AUDIT.inspect()')
        assert details['level']==15,details
        assert details['preview']['safe'],details
        assert '渡劫' in details['summary']
        assert '修为未满' not in details['summary'],details['summary']
        btn=page.locator('#panel-root button[data-a="breakthrough"]')
        assert btn.count()==1 and btn.is_enabled(),details['summary']
        box=page.locator('#panel-body').evaluate('(e)=>({cw:e.clientWidth,sw:e.scrollWidth,ch:e.clientHeight,sh:e.scrollHeight})')
        assert box['sw']<=box['cw']+2,(w,h,box)
        page.screenshot(path=str(OUT/f'core-ready-{w}x{h}.png'))
        if w==390:
            prev=details['preview'];btn.click()
            updated=page.evaluate('window.__V958_AUDIT.inspect()')
            assert updated['level']==16 and updated['hp']==prev['hpAfter'] and updated['maxHp']==prev['maxAfter'],updated
        page.evaluate('window.__V958_AUDIT.init(5,"human","quest")')
        q=page.evaluate('window.__V958_AUDIT.inspect()')
        assert '道行 0/60' not in q['summary'],q['summary']
        assert '三重雷劫' not in q['summary'],q['summary']
        page.screenshot(path=str(OUT/f'quest-{w}x{h}.png'))
        page.evaluate('window.__V958_AUDIT.init(5,"human","settings")')
        sett=page.evaluate('window.__V958_AUDIT.inspect()')
        assert 'V90.58' in sett['summary'] and 'V90.51' not in sett['summary']
        page.screenshot(path=str(OUT/f'settings-{w}x{h}.png'))
        # Final ordeal is now a real engine action.
        init=page.evaluate('window.__V958_AUDIT.init(12,"human","trial")')
        page.screenshot(path=str(OUT/f'ascension-ready-{w}x{h}.png'))
        if w==390:
            fb=page.locator('#panel-root button[data-a="ascend"]')
            assert fb.count()==1 and fb.is_enabled(),page.locator('#panel-body').inner_text()
            fb.click()
            post=page.evaluate('window.__V958_AUDIT.inspect()')
            assert post['ascended'] and post['hp']==post['maxHp'],post
        assert not errors,errors
        results.append({'viewport':f'{w}x{h}','core':'PASS','quest':'PASS','settings':'PASS','final':'PASS','panel':box,'runtimeErrors':errors})
        page.close()
    browser.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('V90.58 BROWSER SMOKE PASS',len(results),'viewports',len(list(OUT.glob('*.png'))),'screenshots')
