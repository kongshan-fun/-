"""Current V16 end-to-end browser clicks. Storage is an explicitly isolated adapter."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';EV.mkdir(exist_ok=True)
ctx={'__file__':str(ROOT/'tests/v14_browser.py')}
exec((ROOT/'tests/v14_browser.py').read_text(encoding='utf8').split('with sync_playwright() as pw:')[0],ctx)
ctx['HTML']=(ROOT/'青岚问道_V16_猎妖炼器.html').read_text(encoding='utf8')
with sync_playwright() as pw:
 kw={'headless':True};ex=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 if ex:kw['executable_path']=ex
 if hasattr(os,'geteuid') and os.geteuid()==0:kw['args']=['--no-sandbox']
 browser=pw.chromium.launch(**kw)
 for w,h in [(320,568),(360,640),(390,844),(1440,900)]:
  page=browser.new_page(viewport={'width':w,'height':h});errors=[];page.on('pageerror',lambda x:errors.append(str(x)))
  ctx['boot'](page,{})
  ctx['race'](page,'human');ctx['archive'](page,1);ctx['click'](page,'birth-confirm');ctx['skip'](page)
  assert page.locator('#resources > *').count()==24
  assert page.locator('#map .tile').count()==9
  before=ctx['game_metrics'](page)
  assert before['body'][0]<=w and before['body'][1]<=h
  # Camp is safe, nearby westward plain has prey; the whole scene remains 6x4.
  ctx['click'](page,'mini-step','[data-x="0"][data-y="5"]')
  assert page.locator('#resources > *').count()==24
  monsters=page.locator('#resources [data-a="challenge"]')
  assert monsters.count()==3,(w,monsters.count())
  assert any('草灵' in monsters.nth(i).inner_text() for i in range(3))
  page.screenshot(path=str(EV/f'V16_场景与妖兽_{w}.png'),full_page=False)
  i=next(i for i in range(3) if '草灵' in monsters.nth(i).inner_text());monsters.nth(i).click()
  state=ctx['state'](page);assert state['combat']['type']=='sprite',state['combat']
  for _ in range(14):
   if not ctx['state'](page)['combat']:break
   intent=ctx['state'](page)['combat']['intent']
   ctx['click'](page,'fight',f'[data-mode="{"guard" if intent=="heavy" else "spell"}"]')
  assert ctx['state'](page)['combat'] is None,'not finished'
  st=ctx['state'](page);assert st['stats']['kills']>=1,st['stats']
  assert st['inv'].get('woodEssence',0)>=1,st['inv']
  assert page.locator('#resources > *').count()==24
  assert ctx['game_metrics'](page)==before,'scene panel changed size while fighting'
  page.screenshot(path=str(EV/f'V16_战斗胜利_{w}.png'))
  assert not errors,errors
  print('PASS',w,h,'24 nodes, nearby prey, fight, loot, fixed layout',flush=True)
  page.close()
 browser.close()
print('V16 BROWSER 4/4 PASS (in-memory test storage; not real mobile certification)')
