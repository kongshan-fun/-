#!/usr/bin/env python3
from pathlib import Path
import zipfile,hashlib,json
ROOT=Path(__file__).resolve().parents[1];DIST=ROOT/'dist/v977';DIST.mkdir(parents=True,exist_ok=True)
index=ROOT/'index.html';data=index.read_bytes();sha=hashlib.sha256(data).hexdigest().upper()
assert b'V90.77' in data and data==(ROOT/'releases/山野修仙记_V90.77_灵息辟谷.html').read_bytes()
readme='''山野修仙记 V90.77 · 灵息辟谷\n\n解压后打开 index.html 可进行本地试玩。正式使用建议固定网站来源，升级前先导出旧版JSON。\n第七境起自选开启灵息辟谷；默认关闭，境界自然减耗无需开启。\n本包为独立自包含H5，不是已经接入真实TapTap SDK的生产适配包，不含APK。\n没有修改正式网址或平台版本。上线门禁及回滚说明见配套源码文档。\n'''
h5=DIST/'山野修仙记_V90.77_H5上线候选.zip'
with zipfile.ZipFile(h5,'w',zipfile.ZIP_DEFLATED)as z:
 z.writestr('index.html',data);z.writestr('使用说明.txt',readme);z.writestr('SHA256.txt',sha+'  index.html\n')
source=DIST/'山野修仙记_V90.77_源码与验收.zip'
paths=[index,ROOT/'README.md']
for folder in ['src','tools','tests','docs','releases','.github/workflows']:
 paths.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and not any(x in p.parts for x in ['__pycache__','node_modules']))
paths.extend(p for p in (ROOT/'artifacts/v977').rglob('*') if p.is_file()and p.suffix not in ['.pid']and p.name!='FAILURE.png')
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted(set(paths)):
  if p.exists():z.write(p,p.relative_to(ROOT).as_posix())
 z.writestr('本轮使用说明.txt',readme)
manifest={'version':'V90.77','indexBytes':len(data),'indexSha256':sha,'files':[]}
for p in [h5,source]:
 with zipfile.ZipFile(p)as z:assert z.testzip() is None
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest().upper()})
(DIST/'交付清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))
