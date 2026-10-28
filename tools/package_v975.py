#!/usr/bin/env python3
"""Package the exact tested H5, reproducible source, and explicit evidence."""
from __future__ import annotations
import argparse,hashlib,json,pathlib,zipfile,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'dist';OUT.mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--allow-offline-browser',action='store_true');args=p.parse_args()
def sha(b):return hashlib.sha256(b).hexdigest().upper()
def readj(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
engine=readj('artifacts/v975/current-regression.json')
browser=readj('artifacts/v975/browser/results.json')
features=readj('artifacts/v975/features.json');milestones=readj('artifacts/v975/100slots.json')
if not engine.get('pass') or not browser.get('pass'):raise SystemExit('Packaging blocked: failed or missing current test evidence')
if 'real localStorage' not in browser.get('mode','') and not args.allow_offline_browser:raise SystemExit('Packaging blocked: real-origin browser evidence required')
html=(ROOT/'index.html').read_bytes()
release=ROOT/'releases/山野修仙记_V90.75_洞天十二阶完整版.html'
if release.read_bytes()!=html:raise SystemExit('Entry/release mismatch')
if not re.search(rb'<title>[^<]*V90\.75',html):raise SystemExit('Incorrect release')
manifest={
 'version':'V90.75','name':'山野修仙记 · 洞天十二阶','format':'self-contained H5',
 'baselineCommit':'41e77e7d3e50890651b59e5a092d70687d179e84','featureBranch':'feat/v90.75-global-home-progression',
 'entry':{'path':'index.html','bytes':len(html),'sha256':sha(html)},
 'facilities':{'types':6,'tiers':12,'warehouseWeightAtTier12':250000,'warehouseGearAtTier12':1600},
 'supplies':{'newRecipes':48,'configurableSlots':4,'battleUseConsumesTurn':True},
 'testEvidence':{'currentSuiteCount':len(engine.get('suites',[])),'enginePass':engine['pass'],'featureAssertions':features.get('assertions'),
                 'browserMode':browser['mode'],'browserChecks':len(browser['checks']),'browserScreenshots':len(browser['screenshots']),
                 'browserPass':browser['pass'],'accelerated100Slots':milestones},
 'platform':{'liveTapTapSDK':False,'productionModified':False,'nativeAPK':False,'onlineCloudAndAdsVerified':False},
 'sourceSha256':{str(q.relative_to(ROOT)):sha(q.read_bytes()) for q in sorted((ROOT/'src/v975').glob('*')) if q.is_file()}
}
readme='''山野修仙记 V90.75 · 洞天十二阶\n\n解压后打开根目录index.html。手机建议通过HTTP/HTTPS静态站点访问。\n唯一洞府、十二阶设施、赋灵修复、动态指引、48种分阶补给、四格自选快捷栏已包含。\n\n先备份，再升级：旧版设置里导出JSON。切换浏览器/路径/域名不会自动共享存档。\n已采用十二境规则的旧角色合并各地洞府，保留仓物；第一次新结构保存前留原始归档。\n需要回滚时导出升级前原档，配合原V90.74游戏使用，不要用旧版保存新结构档。\n\n这是完整独立H5，不是APK，也不是已连接真实TapTap广告/云存档的生产包。\n不自动提交审核，不改变线上包体。独立版奖励为本地试玩逻辑。\n详细源码、迁移说明、测试报告和实渲截图见配套“源码与验收”ZIP。\n'''
manifestb=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def writezip(target,entries):
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in sorted(entries.items()):
   if name.startswith('/') or '\\' in name or '..' in pathlib.PurePosixPath(name).parts:raise ValueError(name)
   info=zipfile.ZipInfo(name,(2026,10,28,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;info.flag_bits|=0x800
   z.writestr(info,data)
 with zipfile.ZipFile(target) as z:
  if z.testzip():raise SystemExit('ZIP CRC failure')
  if z.read('index.html')!=html:raise SystemExit('ZIP entry mismatch')
entries={'index.html':html,'使用说明.txt':readme.encode(),'manifest.json':manifestb}
entries['SHA256SUMS.txt']=('\n'.join(sha(b)+'  '+n for n,b in sorted(entries.items()))+'\n').encode()
h5=OUT/'山野修仙记_V90.75_H5完整版.zip';writezip(h5,entries)
source={n:b for n,b in entries.items() if n!='SHA256SUMS.txt'}
selected=['README.md','tools/build_v975_from_main.py','tools/check_entry_consistency.py','tools/package_v975.py','tests/run_v975_acceptance.cjs','tests/v975_browser.py']
# Keep the exact current suite inputs, including legacy fixture generators.
for row in engine.get('suites',[]):
 name=row.get('name') or row.get('test') or row.get('file')
 if name:selected.append('tests/'+name)
for folder in ['src/v975','docs/v975','artifacts/v975/current-regression','artifacts/v975/browser']:
 for q in sorted((ROOT/folder).rglob('*')):
  if q.is_file() and q.suffix not in ('.pyc',):selected.append(str(q.relative_to(ROOT)))
for name in ['features.json','100slots.json','current-regression.json','acceptance.log']:
 selected.append('artifacts/v975/'+name)
selected+=['releases/山野修仙记_V90.74_存档安全修复版.html','releases/山野修仙记_V90.5_战斗平衡与顶部状态栏优化版.html','releases/山野修仙记_V90.75_洞天十二阶完整版.html']
for name in sorted(set(selected)):
 q=ROOT/name
 if not q.is_file():raise SystemExit('Missing source/evidence: '+name)
 source[name]=q.read_bytes()
source['SHA256SUMS.txt']=('\n'.join(sha(b)+'  '+n for n,b in sorted(source.items()))+'\n').encode()
full=OUT/'山野修仙记_V90.75_源码与验收.zip';writezip(full,source)
(OUT/'manifest.json').write_bytes(manifestb)
(OUT/'SHA256SUMS.txt').write_text('\n'.join(sha(q.read_bytes())+'  '+q.name for q in [h5,full])+'\n',encoding='utf-8')
for q in [h5,full]:print('PACKAGED',q.name,q.stat().st_size,sha(q.read_bytes()))
