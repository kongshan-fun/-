"""Chromium UI smoke test. Test-only in-memory storage; not a real device/storage certification."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / '青岚问道_V11_双角色独立存档.html').read_text(encoding='utf-8')
STORAGE = """<script>(()=>{const mem={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.hasOwn(mem,k)?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]},key:n=>Object.keys(mem)[n]||null,clear:()=>{for(const k of Object.keys(mem))delete mem[k]},get length(){return Object.keys(mem).length}}})})();</script>"""
SIZES = [(320,568),(360,640),(390,844),(430,932),(1440,900)]

with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    kwargs={'headless':True}
    if executable:kwargs['executable_path']=executable
    if hasattr(os,'geteuid') and os.geteuid()==0:kwargs['args']=['--no-sandbox']
    browser=p.chromium.launch(**kwargs)
    for width,height in SIZES:
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(HTML.replace('<head>','<head>'+STORAGE,1))
        page.wait_for_function("typeof QinglanDemo !== 'undefined'")
        assert page.locator('.role-card').count()==2
        page.locator('[data-a="slot-open"][data-role="sword"]').click()
        page.locator('[data-a="slot-confirm-new"]').click()
        start=page.locator('[data-a="guide"][data-mode="skip"]')
        if start.count():start.click()
        assert page.locator('#map .tile').count()==9,(width,'minimap')
        assert page.locator('#map .tile').nth(4).inner_text()=='我'
        assert page.locator('#resources > *').count()==10
        baseline=page.evaluate('''()=>{const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {phone:q('#phone'),resources:q('#resources'),map:q('#map'),nav:q('.quick-nav'),inventory:q('#inventory-peek'),bodyW:document.documentElement.scrollWidth,bodyH:document.documentElement.scrollHeight}}''')
        assert baseline['phone']['w']<=min(400,width)+1
        assert baseline['bodyW']<=width and baseline['bodyH']<=height,(width,baseline)
        assert baseline['map']['x']<=baseline['phone']['x']+160,(width,'minimap must stay left')
        page.locator('#expand-map').click()
        assert page.locator('#world-map .tile').count()==64
        page.locator('#collapse-map').click()
        assert page.locator('#world-map .tile').count()==0 or not page.locator('#map-overlay').is_visible()
        page.locator('#resources [data-a="gather"]').first.click()
        after=page.evaluate('''()=>{const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {resources:q('#resources'),map:q('#map'),nav:q('.quick-nav'),inventory:q('#inventory-peek')}}''')
        for label in ('resources','map','nav','inventory'):
            assert baseline[label]==after[label],(width,'layout jump',label,baseline[label],after[label])
        page.locator('#camp-button').click()
        assert page.locator('.panel-close').is_visible()
        assert not errors,(width,errors)
        print(f'BROWSER {width}x{height}: PASS',flush=True)
        context.close()
    browser.close()
print('V10 BROWSER 5/5 PASS')
