"""V13.1 full-page character and archive UI smoke (isolated storage adapter)."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'青岚问道_V13_百档角色.html').read_text('utf8')
INJECT="""<script>(()=>{const m={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.hasOwn(m,k)?m[k]:null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}})})();</script>"""
with sync_playwright() as p:
  opts={'headless':True}
  executable=os.environ.get('CHROMIUM_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
  if executable:opts['executable_path']=executable
  if hasattr(os,'geteuid') and os.geteuid()==0:opts['args']=['--no-sandbox']
  browser=p.chromium.launch(**opts)
  for w,h in [(320,568),(390,844),(1440,900)]:
    page=browser.new_page(viewport={'width':w,'height':h})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(HTML.replace('<head>','<head>'+INJECT,1))
    page.wait_for_function('typeof QinglanDemo!=="undefined"')
    assert page.locator('#entry-root').is_visible()
    assert page.locator('.entry-role-option').count()==2
    assert page.locator('#game-shell').evaluate('(e)=>getComputedStyle(e).display')=='none'
    assert page.locator('.modal-backdrop').count()==0
    page.locator('[data-role="herb"][data-a="choose-role"]').click()
    page.locator('.entry-main-action').click()
    assert page.locator('.entry-save-cell').count()==20
    assert page.locator('.modal-backdrop').count()==0
    page.locator('[data-a="slot-page"][data-d="1"]').click()
    page.locator('[data-a="slot-open"][data-slot="25"]').click()
    assert page.locator('#game-shell').evaluate('(e)=>getComputedStyle(e).display')=='none'
    page.locator('[data-a="slot-confirm-new"]').click()
    assert page.evaluate('QinglanDemo.getActiveSlot()')==25 and page.evaluate('QinglanDemo.getActiveRole()')=='herb'
    assert page.locator('#entry-root').is_hidden()
    if page.locator('[data-a="guide"][data-mode="skip"]').count():page.locator('[data-a="guide"][data-mode="skip"]').click()
    assert page.locator('#map .tile').count()==9
    page.locator('[data-a="characters"]').first.click()
    assert page.locator('#entry-root').is_visible()
    assert page.locator('#game-shell').evaluate('(e)=>getComputedStyle(e).display')=='none'
    assert not errors,(w,errors)
    page.close()
  browser.close()
print('V13.1 full-screen entry and archive UI PASS')
