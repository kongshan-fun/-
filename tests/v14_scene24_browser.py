"""Chromium scene cards test: six by four fixed cards, visible enemies, no layout jump.
Uses an in-memory localStorage adapter; does not claim mobile hardware certification.
"""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';EV.mkdir(exist_ok=True)
HTML=(ROOT/'青岚问道_V14_人妖同途.html').read_text(encoding='utf-8')
INJECT="""<script>(()=>{let m=SEED;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.hasOwn(m,k)?m[k]:null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k],key:i=>Object.keys(m)[i]||null,get length(){return Object.keys(m).length}}});window.__memory=()=>JSON.parse(JSON.stringify(m));})()</script>"""
with sync_playwright() as p:
 kw={'headless':True,'executable_path':'/usr/bin/chromium'}
 if hasattr(os,'geteuid') and os.geteuid()==0:kw['args']=['--no-sandbox']
 browser=p.chromium.launch(**kw)
 for w,h in [(320,568),(360,640),(390,844),(1440,900)]:
  page=browser.new_page(viewport={'width':w,'height':h});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
  page.set_content(HTML.replace('<head>','<head>'+INJECT.replace('SEED','{}'),1))
  page.wait_for_function("typeof QinglanDemo!=='undefined'")
  page.locator('[data-a="view-slots"]').click();page.locator('[data-a="slot-open"][data-slot="1"]').click();page.locator('[data-a="birth-confirm"]').click();
  skip=page.locator('[data-a="guide"][data-mode="skip"]')
  if skip.count():skip.click()
  def metrics():return page.evaluate('''()=>{let b=e=>{const r=document.querySelector(e).getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]};return {tiles:document.querySelectorAll('#resources > *').length,gridCol:getComputedStyle(document.querySelector('#resources')).gridTemplateColumns.split(' ').length,gridRow:getComputedStyle(document.querySelector('#resources')).gridTemplateRows.split(' ').length,scene:b('#resources'),map:b('#map'),inventory:b('#inventory-peek'),nav:b('.quick-nav'),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],sceneOverflow:document.querySelector('#scene-content').scrollHeight-document.querySelector('#scene-content').clientHeight,firstTile:b('#resources > *')}}''')
  a=metrics();assert a['tiles']==24 and a['gridCol']==6 and a['gridRow']==4,a
  assert a['scroll'][0]<=w and a['scroll'][1]<=h,a
  assert a['sceneOverflow']<=2,a
  assert a['firstTile'][2]>=32 and a['firstTile'][3]>=25,a
  # deterministic scene descriptions survive re-render and resource feedback never shifts the sections
  base=page.locator('#resources > *').all_text_contents()
  page.locator('#resources [data-a="gather"]').first.click()
  assert metrics()==a,(w,a,metrics())
  assert page.locator('#resources > *').count()==24
  page.locator('[data-a="mini-step"][data-x="2"][data-y="5"]').click()
  assert page.locator('#resources [data-a="challenge"]').count()>=1,(w,page.locator('#resources').inner_text())
  page.locator('#toast').evaluate('(e)=>e.classList.remove("show")')
  page.screenshot(path=str(EV/f'V14.1_场景妖兽未挑战_{w}.png'))
  enemy=page.locator('#resources [data-a="challenge"]').first
  name=enemy.get_attribute('aria-label')
  before=metrics();enemy.click();assert page.locator('.combat-card').is_visible(),(w,name)
  for z in range(15):
   if not page.locator('.combat-card').count():break
   s=page.evaluate('QinglanDemo.getState()');mode='spell' if s['spirit']>=9 else 'attack'
   page.locator(f'[data-a="fight"][data-mode="{mode}"]').click()
  assert not page.locator('.combat-card').count(),(w,'enemy still alive')
  assert '已清' in page.locator('#resources').inner_text(),(w,page.locator('#resources').inner_text())
  assert metrics()==before,(w,before,metrics())
  assert not errs,errs
  page.locator('#toast').evaluate('(e)=>e.classList.remove("show")')
  page.screenshot(path=str(EV/f'V14.1_24格妖兽_{w}.png'))
  print('PASS',w,h, 'resource slots',a['tiles'],'enemy',name,'tileSize',a['firstTile'][2:],'sceneOverflow',a['sceneOverflow'],flush=True)
  page.close()
 browser.close()
