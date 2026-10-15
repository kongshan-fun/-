"""Generate the current player manual and balance tables directly from V14 data."""
from pathlib import Path
import json,subprocess,html
ROOT=Path(__file__).resolve().parent;DOC=ROOT/'docs';DOC.mkdir(exist_ok=True)
js="const D=require('./src/data.js'),B=require('./src/birth.js');console.log(JSON.stringify({version:D.VERSION,races:B.RACES,roots:B.ROOTS,bloods:B.BLOODS,forms:B.FORMS,elements:B.ELEMENTS,life:D.LIFE,zones:D.ZONES.map(z=>({name:z.name,need:z.need,boss:z.boss})),buildings:D.BUILDINGS,recipes:D.RECIPES,items:D.ITEMS,help:D.HELP}))"
d=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,text=True,encoding='utf8'))
chapters=d['help'];md=['# 青岚问道 V14 · 人妖同途完整教程','\n本教程从当前游戏数据生成。选择种族 → 选择档位 → 抽取天赋 → 确认入世。\n']
body=[]
for i,c in enumerate(chapters,1):
 title=c['title'];paras=c.get('paragraphs',c.get('body',c.get('text',[])))
 if isinstance(paras,str):paras=[paras]
 # The authored HELP schema uses paras.
 if not paras:paras=c.get('paras',[])
 md+=['## '+str(i)+'. '+title,'',*sum(([p,''] for p in paras),[])]
 body.append('<section><h2>'+str(i)+'. '+html.escape(title)+'</h2>'+''.join('<p>'+html.escape(p)+'</p>' for p in paras)+'</section>')
(DOC/'完整文字教程.md').write_text('\n'.join(md)+'\n',encoding='utf8')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青岚问道 V14 · 完整教程</title><style>body{font:16px/1.85 system-ui,"Microsoft Yahei",sans-serif;color:#222;background:#fff;margin:0}main{max-width:820px;padding:32px 22px;margin:auto}h1{font-size:27px}h2{font-size:20px;border-top:1px solid #ddd;padding-top:22px;margin-top:32px}p{margin:12px 0}nav{display:flex;flex-wrap:wrap;gap:8px}small{color:#777}@media print{h2{break-after:avoid}p{orphans:3;widows:3}}</style><main><h1>青岚问道 · 人妖同途</h1><p>V14 完整文字教程 · 两族百档 · 凡界飞升</p>'''+''.join(body)+'<footer><small>游戏内查看：教程。存档均为当前浏览器来源本地数据；换设备前请导出备份。</small></footer></main></html>'
(DOC/'完整文字教程.html').write_text(page,encoding='utf8')
(DOC/'当前游戏数据.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
lines=['# V14 种族与命格数值','', '人族、妖族共享12境地图、仪式、首领与飞升终点；种族保持不变。妖族境界采用本作编排，不宣称全行业统一。','']
for id,r in d['races'].items():
 lines+=['## '+r['name'],' → '.join(r['realms']),'',f"基础气血 {r['hp']}，{r['energy']} {r['spirit']}，攻击 {r['attack']}，寿元 {r['years']} 年。",'']
rows=[('人族灵根',d['roots']),('妖族血脉',d['bloods'])]
for title,arr in rows:
 lines+=['## '+title,'| 品阶 | 概率 | 修为增益 |','|---|---:|---:|']
 lines += [f"| {x['name']} | {x['weight']}% | +{x['xp']}% |" for x in arr]
 lines+=['']
lines+=['## 通用随机属性','悟性/灵智40–90，每5点高于40提供1%修为增益；根骨/妖躯40–90，气血增加floor((数值−40)×0.4)；气运1–100，装备品质判定额外0–8点。','', '人族五行偏性取灵根首属性：金攻击+1，木采止血草15%额外一份，水灵力+10，火伤害+4%，土气血+12。异灵根雷/冰/风当前是名称表现，实际按五行偏性结算。','', '妖族本相各20%：苍狼伤害+4%，青狐妖元+12，玄猿气血+14，灵蛇药物恢复+12%，白鹤术法耗元−1。','', '入世前可免费重抽；确认后种族与天赋固定。所有品阶都有相同地图和破境资格。实际概率与数学收益见src/birth.js。','', '## 兼容','旧剑修、旧丹修仅可显式继承为人族旧世传承，保留原有属性、技能、寿元与物资，不强行重抽。旧源档不删除；两个旧001应选择不同的人族空档。','', '## 寿元','每4个游戏日折1年，战败额外折16年并消耗半日恢复。寿尽只清当前种族当前档；新轮回重新抽取。','']
(DOC/'V14_种族与命格数值.md').write_text('\n'.join(lines),encoding='utf8')
print('Built',len(chapters),'manual chapters and race data')
