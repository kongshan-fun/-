"""Drive only the guide-highlighted real controls; no injected levels or resources."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];EV=ROOT/'evidence';EV.mkdir(exist_ok=True)
# Reuse the actual V14 boot/UI helpers, not the top-level suite body.
# exec requires a common globals dict for helper globals.
g={'__file__':str(ROOT/'tests/v14_browser.py')};exec((ROOT/'tests/v14_browser.py').read_text().split('with sync_playwright() as pw:')[0],g)
g['HTML']=(ROOT/'青岚问道_V16_猎妖炼器.html').read_text(encoding='utf8')
result=[]
with sync_playwright() as pw:
 kw={'headless':True};ex=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
 if ex:kw['executable_path']=ex
 if hasattr(os,'geteuid') and os.geteuid()==0:kw['args']=['--no-sandbox']
 b=pw.chromium.launch(**kw)
 for role,w,h in [('human',320,568),('demon',320,568),('human',390,844),('demon',390,844)]:
  ctx=b.new_context(viewport={'width':w,'height':h});p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));g['boot'](p,{})
  p.evaluate('()=>{crypto.getRandomValues=(a)=>{a[0]=261014;return a}}')
  g['race'](p,role);g['archive'](p,1);g['click'](p,'birth-confirm');g['click'](p,'guide','[data-mode="start"]')
  steps=set();actions=[]
  for i in range(320):
   p.wait_for_timeout(50);s=g['state'](p);u=g['ui'](p);steps.add(s['guide']['step'])
   if s['guide']['status']=='done':break
   if u['route']>0:p.wait_for_timeout(600);continue
   if u['modal']=='settle':g['click'](p,'confirm-settle');actions.append('confirm-settle');continue
   if u['modal']:raise AssertionError(('unexpected modal',u))
   button=p.locator('.guide-target').first
   if not button.count():raise AssertionError(('missing tutorial target',u,s['guide']))
   a=button.get_attribute('data-a');text=button.inner_text();actions.append(f'{a}:{text}')
   try:button.click(timeout=2500)
   except Exception:
    p.screenshot(path=str(EV/f'V14_教程错误_{role}_{w}.png'));raise
  else:raise AssertionError(('tutorial did not finish',role,w,s['guide'],actions[-20:]))
  assert steps>=set(range(11)),steps
  assert not errors,errors
  assert s['stats']['crafted']>=3 and s['stats']['training']>0
  assert s['settlements'][0] is not None
  p.screenshot(path=str(EV/f'V14_实操教程完成_{role}_{w}.png'))
  result.append({'race':role,'viewport':[w,h],'operations':len(actions),'seenSteps':sorted(steps),'deaths':s['stats']['defeats'],'status':'PASS','actions':actions})
  print('PASS',role,w,'11 steps',len(actions),'real actions',flush=True);ctx.close()
 b.close()
if g.get('server'):g['server'].shutdown()
(EV/'V16_实操教程验收.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
