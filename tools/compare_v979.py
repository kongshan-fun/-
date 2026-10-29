#!/usr/bin/env python3
"""Compose ONLY existing unretouched browser screenshots; never draw a game UI."""
from pathlib import Path
import json,hashlib,subprocess
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];V=R/'artifacts/v979/visual';O=R/'artifacts/v979/comparisons';O.mkdir(parents=True,exist_ok=True)
report=json.loads((V/'results.json').read_text());assert report['mode']=='native-http-localStorage';assert report['passed']==report['total']
font_path=subprocess.check_output(['fc-match','-f','%{file}','Noto Sans CJK SC'],text=True).strip();serif_path=subprocess.check_output(['fc-match','-f','%{file}','Noto Serif CJK SC'],text=True).strip()
f=lambda size:ImageFont.truetype(font_path,size);sf=lambda size:ImageFont.truetype(serif_path,size)
labels={'home':'洞府总览','forge':'炼器室','alchemy':'丹房','workbench':'工作台 · 储物袋','spirit':'赋灵','garden':'十二阶灵田','garden-growing':'作物生长','garden-ready':'成熟状态','garden-sow':'播种确认'}
manifest=[]
for p in report['pairs']:
 assert p['sameState'];a=Image.open(V/p['before']).convert('RGB');b=Image.open(V/p['after']).convert('RGB');assert a.size==b.size==(390,844)
 im=Image.new('RGB',(858,964),'#f1f2ed');d=ImageDraw.Draw(im)
 d.text((24,14),labels[p['scenario']]+'  /  真实运行前后对比',font=sf(23),fill='#263e36')
 d.text((24,52),'同一测试存档 · 390 × 844 · 默认浅色主题',font=f(12),fill='#65746b')
 d.text((24,84),'优化前  V90.78',font=f(14),fill='#6a736d');d.text((444,84),'优化后  V90.79',font=f(14),fill='#2e5a4b')
 # Paste original pixels 1:1. Border and labels stay outside screenshots.
 im.paste(a,(24,112));im.paste(b,(444,112));d.rectangle((23,111,414,956),outline='#d8ded4');d.rectangle((443,111,834,956),outline='#b9cbbd')
 dest=O/(p['scenario']+'_前后真实截图.png');im.save(dest)
 manifest.append({'scenario':p['scenario'],'image':dest.name,'before':p['before'],'after':p['after'],'stateSha256':p['stateSha256'],'scale':'1:1','changesToScreenshotPixels':False})
# Contact sheet uses only downscaled originals, annotated as a compact overview.
selected=['home','forge','alchemy','workbench','spirit','garden'];sheet=Image.new('RGB',(1320,1130),'#f1f2ed');d=ImageDraw.Draw(sheet)
d.text((24,14),'山野修仙记 V90.79 · 六大界面实拍',font=sf(26),fill='#263e36')
d.text((24,54),'上排：洞府、炼器室、丹房    下排：工作台、赋灵、灵田',font=f(14),fill='#65746b')
for i,k in enumerate(selected):
 p=next(p for p in report['pairs'] if p['scenario']==k);s=Image.open(V/p['after']).convert('RGB');s.thumbnail((214,464),Image.Resampling.LANCZOS)
 x=25+(i%3)*438;y=100+(i//3)*510
 # In overview each module is a reduced before/after pair.
 old=Image.open(V/p['before']).convert('RGB');old.thumbnail((196,424),Image.Resampling.LANCZOS)
 new=Image.open(V/p['after']).convert('RGB');new.thumbnail((196,424),Image.Resampling.LANCZOS)
 d.text((x,y),labels[k],font=sf(19),fill='#263e36');d.text((x,y+31),'V90.78',font=f(11),fill='#68776e');d.text((x+204,y+31),'V90.79',font=f(11),fill='#315e50')
 sheet.paste(old,(x,y+53));sheet.paste(new,(x+204,y+53))
sheet.save(O/'六大界面_前后实拍总览.png')
(O/'截图对应关系.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Generated',len(manifest),'comparisons from native screenshots only')
