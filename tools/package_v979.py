#!/usr/bin/env python3
from pathlib import Path
import zipfile,json,hashlib
R=Path(__file__).resolve().parents[1];O=R/'dist/v979';O.mkdir(parents=True,exist_ok=True)
data=(R/'index.html').read_bytes();sha=hashlib.sha256(data).hexdigest().upper();assert data==(R/'releases/山野修仙记_V90.79_纸墨精修.html').read_bytes()
a=json.loads((R/'artifacts/v979/acceptance.json').read_text());v=json.loads((R/'artifacts/v979/visual/results.json').read_text());assert a['pass']and a['sourceSha256']==sha;assert v['mode']=='native-http-localStorage'and v['passed']==v['total']and v['sourceSha256']==sha
readme='''山野修仙记 V90.79 · 纸墨精修（真实代码版）

解压后打开 index.html 即可。推荐使用原来的固定网站来源保存；升级前导出旧版JSON。
本次只修改界面渲染、CSS与响应式分页；游戏引擎、配方、材料扣费、存档结构及种植成长规则未改。
保留原有主题选择，不强制换色。默认是浅纸墨绿，黑白及深色主题仍可切换。
长屏灵田展示全26块，短屏每页12块；田地编号及种植记录不变。
附带的前后图是两份实际HTML以同一测试存档运行后的浏览器截图，未绘制或重构截图像素。
独立H5，不是APK；真实TapTap SDK未验收；未合并main或部署生产。
'''
with zipfile.ZipFile(O/'山野修仙记_V90.79_UI精修实装版.zip','w',zipfile.ZIP_DEFLATED)as z:
 z.writestr('index.html',data);z.writestr('使用说明.txt',readme);z.writestr('SHA256.txt',sha+'  index.html\n')
with zipfile.ZipFile(O/'山野修仙记_V90.79_真实对比截图与测试.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in (R/'artifacts/v979').rglob('*'):
  if p.is_file()and not any(x in p.parts for x in ['visual-render','browser-render','preview'])and p.name!='FAILURE.png':z.write(p,p.relative_to(R/'artifacts/v979'))
paths=[R/'index.html',R/'README.md']
for folder in ['src','tools','tests','docs','releases','.github/workflows']:
 paths.extend(p for p in (R/folder).rglob('*')if p.is_file()and not any(x in p.parts for x in ['__pycache__','node_modules','.git'])and p.name!='local979.sh')
paths.extend(p for p in (R/'artifacts/v979').rglob('*')if p.is_file()and not any(x in p.parts for x in ['visual-render','browser-render','preview'])and p.name!='FAILURE.png')
with zipfile.ZipFile(O/'山野修仙记_V90.79_源码与验收.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in sorted(set(paths)):z.write(p,p.relative_to(R))
 z.writestr('本轮使用说明.txt',readme)
(O/'山野修仙记_V90.79_纸墨精修.html').write_bytes(data)
manifest={'version':'V90.79','sourceSha256':sha,'bytes':len(data),'engine':a,'visual':{'passed':v['passed'],'total':v['total'],'mode':v['mode']},'files':[],'productionChanged':False,'TapTapSDK':'NOT_VERIFIED'}
for p in O.glob('*.zip'):
 with zipfile.ZipFile(p)as z:assert z.testzip()is None
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(O/'交付清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('V90.79 deliverables',json.dumps(manifest['files'],ensure_ascii=False))
