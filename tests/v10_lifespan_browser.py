"""V10 lifespan UI integration using an isolated explicit storage adapter.

The execution environment blocks localhost and file:// navigations, so this test
is NOT evidence of browser-origin localStorage persistence across real reloads.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'青岚问道_V10_寿元与洞府.html').read_text(encoding='utf8')
RESULT=[]
def boot(page,mem=None):
    script="""<script>(()=>{const mem=SEED;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.hasOwn(mem,k)?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]},key:n=>Object.keys(mem)[n]||null,clear:()=>{for(const k of Object.keys(mem))delete mem[k]},get length(){return Object.keys(mem).length}}});window.__testStorage=()=>JSON.parse(JSON.stringify(mem));})()</script>""".replace('SEED',json.dumps(mem or {},ensure_ascii=False))
    page.set_content(HTML.replace('<head>','<head>'+script,1))
    page.wait_for_function('typeof QinglanDemo!=="undefined"')
def snapshot(page):return page.evaluate('window.__testStorage()')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width,height in [(320,568),(390,844),(1440,900)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
        page=ctx.new_page();errors=[];page.on('pageerror',lambda x:errors.append(str(x)))
        boot(page);page.locator('[data-a="guide"][data-mode="skip"]').click()
        assert page.evaluate('QinglanDemo.getState().life.left')==56*5760
        assert '寿 56.0年' in page.locator('#status').inner_text()
        assert page.locator('#map .tile').count()==9
        assert page.locator('#resources > *').count()==10
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight')
        page.screenshot(path=str(ROOT/'evidence'/f'V10_黑白主界面_{width}.png'))
        page.locator('[data-name="help"]').first.click();assert '寿元与轮回' in page.locator('#panel-body').inner_text();page.locator('.panel-close').click()
        assert not errors,errors;RESULT.append(f'Black-white minimap + lifespan + tutorial {width}x{height} PASS');ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':844});page=ctx.new_page();errors=[];page.on('pageerror',lambda x:errors.append(str(x)))
    boot(page);page.locator('[data-a="guide"][data-mode="skip"]').click()
    state=page.evaluate('QinglanDemo.getState()');state['life']['left']=40;state['guide']['status']='skipped'
    mem={'qinglan-wendao-v10':json.dumps(state,ensure_ascii=False),'qinglan-wendao-v10-backup':json.dumps(state,ensure_ascii=False),'qinglan-wendao-v9':json.dumps({**state,'version':9},ensure_ascii=False)}
    boot(page,mem);assert page.evaluate('QinglanDemo.getState().life.left')==40
    page.locator('#rest-button').click();page.locator('[data-a="rebirth"]').wait_for()
    assert '寿元已尽' in page.locator('.modal').inner_text()
    gone=snapshot(page);assert 'qinglan-wendao-v10' not in gone;assert 'qinglan-wendao-v10-backup' not in gone;assert 'qinglan-wendao-v9' not in gone;assert 'qinglan-wendao-v10-permadeath' in gone
    page.screenshot(path=str(ROOT/'evidence'/'V10_寿元归零.png'))
    # Reload-equivalent: render a fresh app document with only persisted keys from the adapter.
    boot(page,gone);page.locator('[data-a="rebirth"]').wait_for();assert 'qinglan-wendao-v10' not in snapshot(page)
    page.locator('[data-a="rebirth"]').click();assert page.evaluate('QinglanDemo.getState().life.left')==56*5760
    fresh=snapshot(page);assert 'qinglan-wendao-v10-permadeath' not in fresh and 'qinglan-wendao-v10' in fresh
    RESULT.append('Expired character purged V10 + backup + V9; tombstone and new incarnation PASS')
    # Old version non-destructive import; legacy data remains until actual permadeath.
    legacy={**state,'version':9};legacy.pop('life',None);legacy.pop('ended',None)
    boot(page,{'qinglan-wendao-v9':json.dumps(legacy,ensure_ascii=False)})
    assert page.evaluate('QinglanDemo.getState().version')==10
    assert page.evaluate('QinglanDemo.getState().life.left')>=8*5760
    assert 'qinglan-wendao-v9' in snapshot(page)
    RESULT.append('V9 migration does not delete old save during normal upgrade PASS')
    assert not errors,errors
    ctx.close();browser.close()
for x in RESULT:print('PASS',x)
print(f'V10 LIFESPAN UI {len(RESULT)}/{len(RESULT)} PASS (storage adapter, not native persistent origin)')
(ROOT/'evidence'/'browser_lifespan_results.json').write_text(json.dumps({'tests':RESULT,'method':'Playwright set_content + test storage adapter; file:// and localhost blocked by administrator'},ensure_ascii=False,indent=2),encoding='utf8')
