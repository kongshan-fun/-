"""V15 active scene nodes: separate isolated Chromium check."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'青岚问道_V15_场景24格.html').read_text(encoding='utf8')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 for width,height in [(320,568),(390,844),(1440,900)]:
  page=b.new_page(viewport={'width':width,'height':height})
  errors=[]
  page.on('pageerror',lambda x:errors.append(str(x)))
  page.set_content(HTML)
  # Role/birth onboarding flows are covered by V14 suites; main check uses exposed scene state.
  ok=page.evaluate("typeof QGame==='function' && typeof QData==='object'")
  assert ok,(width,'engine not booted')
  assert page.evaluate("new QGame().sceneNodes().length")==24
  assert page.evaluate("(()=>{const g=new QGame();g.s.pos={x:1,y:4};return g.sceneNodes().filter(x=>x.enemy).length})()")>=1
  assert not errors,errors
  page.close()
 b.close()
print('V15 Chromium 24-node source checks PASS')
