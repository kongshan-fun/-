#!/usr/bin/env python3
"""Chromium click verification of export/cancel/confirm for a real V14 legacy fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text('utf8')
OUT=ROOT/'evidence'/'v958'/'browser';OUT.mkdir(parents=True,exist_ok=True)
STORAGE="""<script>window.__v958Disk=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{
 getItem(k){return window.__v958Disk.get(k)??null},
 setItem(k,v){window.__v958Disk.set(k,String(v))},removeItem(k){window.__v958Disk.delete(k)},
 clear(){window.__v958Disk.clear()},key(i){return [...window.__v958Disk.keys()][i]??null},get length(){return window.__v958Disk.size}
}});</script>"""
HOOK="""window.__V958_OLD={
 seed(){const s=QGame.fresh(20261022,'human');delete s.rebuilt;s.major=6;
   localStorage.setItem(slots.key('human',1),JSON.stringify(s));
   return {status:slots.status('human',1).status,tier:slots.status('human',1).tier}},
 open(){selectCharacter('human','open',1)},
 peek(){return {old:JSON.parse(localStorage.getItem(slots.key('human',1))).rebuilt||false,
  ledger:slots.legacy('human',1).balance}},
 result(){return {ready:slots.status('human',1).status,newVersion:slots.read('human',1).game.s.rebuilt,
  ledger:slots.legacy('human',1).balance}}
};"""
assert HTML.count('<head>')==1 and HTML.count('window.QinglanDemo=')==1
HTML=HTML.replace('<head>','<head>'+STORAGE,1).replace('window.QinglanDemo=',HOOK+'\nwindow.QinglanDemo=',1)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page(accept_downloads=True,viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML,wait_until='domcontentloaded')
 assert page.evaluate('window.__V958_OLD.seed()')=={'status':'reset','tier':600}
 page.evaluate('window.__V958_OLD.open()')
 assert page.locator('#modal-root [data-a="reset-export"]').count()==1
 page.screenshot(path=str(OUT/'old-before-export.png'))
 with page.expect_download() as event:
  page.locator('#modal-root [data-a="reset-export"]').click()
 downloaded=OUT/'old-export.json';event.value.save_as(str(downloaded))
 data=json.loads(downloaded.read_text('utf8'))
 assert data['format']=='ShanyeOldSaveBackup' and data['state']['major']==6 and 'rebuilt' not in data['state']
 page.locator('#modal-root [data-a="modal-close"]').click()
 assert page.evaluate('window.__V958_OLD.peek()')=={'old':False,'ledger':0}
 page.evaluate('window.__V958_OLD.open()')
 page.locator('#modal-root [data-a="reset-confirm"]').click()
 assert page.evaluate('window.__V958_OLD.result()')=={'ready':'ready','newVersion':1,'ledger':600}
 page.screenshot(path=str(OUT/'old-confirmed.png'))
 assert not errors,errors
 browser.close()
print('V90.58 CHROMIUM LEGACY EXPORT CANCEL CONFIRM PASS')
