#!/usr/bin/env python3
"""Actual Chromium with fake TapTap host methods; browser evidence, not real SDK certification."""
from __future__ import annotations
import functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"artifacts"/"v983-browser"
OUT.mkdir(parents=True,exist_ok=True)
VIEWPORTS=[(320,568),(360,640),(390,844),(412,915),(1440,900)]
INIT=r"""
window.tap={
 env:{USER_DATA_PATH:'/mock'},
 createRewardedVideoAd(){return {onLoad(){},onError(){},onClose(){},show(){return Promise.resolve()},load(){return Promise.resolve()}}},
 getCloudSaveManager(){return {getArchiveList({success}){success({saves:[]})},createArchive({success}){success({uuid:'mock'})}}},
 getFileSystemManager(){return {writeFile({success}){success()},readFile({success}){success({data:'{}'})}}},
 getLeaderboardManager(){return {submitScores({callback}){callback?.onSuccess?.({})}}}
};
"""
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_args):pass
def ensure(value,message):
 if not value:raise AssertionError(message)
def run():
 handler=functools.partial(Quiet,directory=str(ROOT))
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url="http://127.0.0.1:"+str(server.server_port)+"/releases/山野修仙记_V90.83_TapTap候选版.html"
 results=[]
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   for w,h in VIEWPORTS:
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<=412,has_touch=w<=412,device_scale_factor=1)
    ctx.add_init_script(INIT)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    resp=page.goto(url,wait_until='domcontentloaded',timeout=30000)
    page.wait_for_timeout(850)
    ensure(resp.status==200,"HTTP response error: "+str(w))
    info=page.evaluate("""() => ({
      release:window.QData?.RELEASE,
      build:window.__SHANYE_BUILD_CODE,
      hasAdapter:!!window.QTap,
      mock:window.QTap?.isMock?.(),
      cloud:window.QTap?.env?.cloud?.(),
      ranked:!!window.QTap?.rankDifficulty?.sync,
      scrollWidth:document.documentElement.scrollWidth,
      innerWidth:window.innerWidth,
      hasPhone:!!document.getElementById('phone')
    })""")
    ensure(info['release']=='V90.83',"wrong game version "+str(info))
    ensure(info['build']=='SHANYE-V983-TT-20261103',"wrong build code "+str(info))
    ensure(info['hasAdapter'] and info['mock'] is False and info['cloud'] and info['ranked'],"TapTap adapter not booted")
    ensure(info['hasPhone'],"game phone shell missing")
    ensure(info['scrollWidth']<=info['innerWidth']+2,"horizontal overflow "+str(info))
    ensure(not errors,"uncaught JS errors "+str(errors))
    page.screenshot(path=str(OUT/('candidate-'+str(w)+'x'+str(h)+'.png')),full_page=True)
    results.append({'viewport':[w,h],'status':'PASS','scrollWidth':info['scrollWidth']})
    ctx.close()
   browser.close()
 finally:
  server.shutdown();server.server_close()
 (OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
 print('V90.83 BROWSER MOCK-SDK PASS',len(results),results)
if __name__=='__main__':run()
