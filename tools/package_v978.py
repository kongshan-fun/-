#!/usr/bin/env python3
"""Package only exact verified sources; no credentials, test player data, or fonts."""
from pathlib import Path
import zipfile,hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist/v978';DIST.mkdir(parents=True,exist_ok=True)
index=ROOT/'index.html';data=index.read_bytes();sha=hashlib.sha256(data).hexdigest().upper()
assert b'V90.78' in data and data==(ROOT/'releases/山野修仙记_V90.78_洞府百业与灵田.html').read_bytes()
a=json.loads((ROOT/'artifacts/v978/acceptance.json').read_text());assert a['pass'] and a['sourceSha256']==sha
readme='''山野修仙记 V90.78 · 洞府百业与灵田\n\n解压后打开根目录index.html即可。长期存档请使用固定网站来源，升级前导出旧版JSON。\n工作台随洞府启用且不升级；功法位于底栏，赋灵位于洞府。灵田按本档游戏时间成长，离线不催熟。\n本包为独立自包含H5，不是APK或已接入真实TapTap SDK的生产适配包。没有替换线上或提交审核。\n种植前原档可在设置→存档与备份导出，回滚请使用该原档，不要用旧版本覆盖保存新版种植档。\n'''
h5=DIST/'山野修仙记_V90.78_H5完整版.zip'
with zipfile.ZipFile(h5,'w',zipfile.ZIP_DEFLATED)as z:
 z.writestr('index.html',data);z.writestr('使用说明.txt',readme);z.writestr('SHA256.txt',sha+'  index.html\n')
source=DIST/'山野修仙记_V90.78_源码与验收.zip'
paths=[index,ROOT/'README.md']
for folder in ['src','tools','tests','docs','releases','.github/workflows']:
 paths.extend(p for p in (ROOT/folder).rglob('*') if p.is_file()and not any(x in p.parts for x in ['__pycache__','node_modules','.git']))
# Keep only this version's evidence; historical failures do not masquerade as gates.
paths.extend(p for p in (ROOT/'artifacts/v978').rglob('*')if p.is_file()and p.suffix!='.pid'and p.name not in ['FAILURE.png','legacy-regression-attempt.log'])
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted(set(paths)):
  if p.exists():z.write(p,p.relative_to(ROOT).as_posix())
 z.writestr('本轮使用说明.txt',readme)
manifest={'version':'V90.78','indexBytes':len(data),'indexSha256':sha,'TapTapSDK':'NOT_VERIFIED','productionChanged':False,'files':[]}
for p in [h5,source]:
 with zipfile.ZipFile(p)as z:assert z.testzip()is None;assert z.read('index.html')==data
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest().upper()})
(DIST/'交付清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps(manifest,ensure_ascii=False,indent=2))
