"""Generate the guide and rule tables from the same data used by the game.
Requires Python 3 and Node.js; playing the HTML requires neither.
"""
from pathlib import Path
import subprocess,json,html
ROOT=Path(__file__).resolve().parent
D=json.loads(subprocess.check_output(['node','-e','console.log(JSON.stringify(require("./src/data.js")))'],cwd=ROOT,text=True))
DOC=ROOT/'docs';DOC.mkdir(exist_ok=True)
e=html.escape
name=lambda k:D['ITEMS'][k]['name']
cost=lambda d:'、'.join(name(k)+'×'+str(v) for k,v in d.items())
md=['# 青岚问道 V12 · 完整文字教程','', '这份教程与游戏内的教程共用同一份数据。所有时间均指行动推进的游戏时间；网页关闭后不产生离线收益。','']
contents=[];parts=[]
for i,c in enumerate(D['HELP'],1):
    md+=['## '+str(i)+'. '+c['title'],'']
    md+=sum(([p,''] for p in c['paragraphs']),[])
    contents.append(f'<a href="#{c["id"]}">{i:02d}　{e(c["title"])}</a>')
    parts.append(f'<section id="{c["id"]}"><h2><small>{i:02d}</small> {e(c["title"])}</h2>'+''.join('<p>'+e(p)+'</p>' for p in c['paragraphs'])+'</section>')
(DOC/'完整文字教程.md').write_text('\n'.join(md),encoding='utf8')
guide='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青岚问道 V12 · 完整教程</title><style>*{box-sizing:border-box}body{margin:0;color:#222;background:#f5f5f5;font:16px/1.95 -apple-system,BlinkMacSystemFont,"Microsoft Yahei","PingFang SC",sans-serif}main{max-width:850px;margin:32px auto;padding:32px 48px 64px;background:#fff;border:1px solid #ddd}header{border-bottom:2px solid #222;margin-bottom:24px;padding-bottom:20px}header small{letter-spacing:.12em;color:#777}h1{font:600 30px/1.5 "Songti SC","SimSun",serif;margin:10px 0}header p{font-size:14px;color:#555;margin:0}nav{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:40px;padding:18px;background:#f6f6f6}a{color:#333;text-decoration:none;font-size:14px}a:hover{text-decoration:underline}h2{font-size:21px;margin:32px 0 18px;border-bottom:1px solid #ddd;padding-bottom:8px}h2 small{font-size:15px;color:#888;margin-right:8px}p{margin:12px 0}section{scroll-margin:16px}footer{border-top:1px solid #ccc;margin-top:40px;font-size:13px;color:#777;padding-top:20px}@media(max-width:600px){main{margin:0;padding:24px 20px;border:0}body{font-size:15px}h1{font-size:26px}nav{grid-template-columns:1fr;padding:14px}h2{font-size:19px}}@media print{body{background:#fff}main{margin:0;max-width:none;border:0;padding:0}nav{break-after:page}h2{break-after:avoid}section{break-inside:auto}a{color:#111}}</style><main><header><small>青岚问道 · V12 凡界飞升</small><h1>从一座草庐开始修行</h1><p>选址 · 仓储 · 炼器 · 炼丹 · 十二境探索</p></header><nav>CONTENTS</nav>PARTS<footer>本地单机网页游戏。首次游玩选择“跟着学”；需要查规则时再阅读本手册。</footer></main></html>'''
guide=guide.replace('CONTENTS',''.join(contents)).replace('PARTS',''.join(parts))
(DOC/'完整文字教程.html').write_text(guide,encoding='utf8')
# Machine-readable values and build requirements: not a pretend full original game's database.
(DOC/'当前游戏数据.json').write_text(json.dumps(D,ensure_ascii=False,indent=2),encoding='utf8')
rows=['# V12 凡界营建与炼制数值','', '这是本工程的实际配置，不是《开拓者》的内部数据。所有成本均按游戏内材料计。','', '## 选址与迁居','', f'筑庐：{cost(D["SETTLE_COST"])}；120分钟。迁居：{cost(D["MOVE_CAMP_COST"])}；180分钟。两者都必须携带材料到新地点。每境最多一府；迁居保留建筑等级、库存和田计时。','', '## 建筑表','', '| 建筑 | 等级 | 住所前置 | 材料 | 耗时/分钟 | 效果 |','|---|---:|---|---|---:|---|']
for bid,b in D['BUILDINGS'].items():
    for i,l in enumerate(b['levels'],1):
        prerequisite='在已定居的洞府' if not l.get('home') else f'洞府{l["home"]}阶'
        if bid=='residence':prerequisite='择地筑庐' if i==1 else f'洞府{i-1}阶'
        rows.append(f'| {b["name"]} | {i} | {prerequisite} | {cost(l["cost"])} | {l["minutes"]} | {l["effect"]} |')
rows+=['','仓房容量按物品重量，不是件数；一级80、二级180、三级360。山门仅能在青岚自建洞府修建。','', '## 全部配方','', '| 配方 | 最早区域 | 房间条件 | 材料 |','|---|---|---|---|']
for r in D['RECIPES']:
    room=f'{D["BUILDINGS"][r["room"]]["name"]}{r["tier"]}阶' if r.get('room') else '随身可制'
    rows.append(f'| {r["name"]} | {D["ZONES"][r.get("zone",0)]["name"]} | {room} | {cost(r["cost"])} |')
rows+=['','房间只在角色亲自回到对应洞府时可用。已解锁配方可用其他区域的足阶设施生产；装备掉落后的穿戴不受设施等级限制。区域品质概率取当前所在地图。','', '## 十二境首领与目标','', '| 地图 | 仪式 | 需求 | 首领 | 气血/攻击/防御 |','|---|---|---|---|---|']
for z in D['ZONES']:
    en=D['ENEMIES'][z['boss']]
    rows.append(f'| {z["name"]} | {z["verb"]} | {cost(z["need"])} | {en["name"]} | {en["hp"]}/{en["atk"]}/{en["armor"]} |')
rows+=['','## 九境破境与飞升','', '| 试炼区域 | 晋升境界 | 道行要求 | 道材消耗 | 增寿/年 |','|---|---|---:|---|---:|']
for z,t in zip(D['ZONES'][5:],D['ASCENSION_STAGES']):
    rows.append(f'| {z["name"]} | {t["realm"]} | {t["needDao"]} | {name(t["primary"])}×2、{name(t["secondary"])}×1 | {t["life"]} |')
rows+=['','## 边界','', '营建没有随机失败、现实时间等待或付费加速。药物无随机品质；法器保留五档品质、词条和精炼。尚未实现弟子经营、自动物流、多人联机、离线收益；这些入口也没有出现在可玩界面。']
(DOC/'营建与炼制数值.md').write_text('\n'.join(rows),encoding='utf8')
print(f'Generated {len(D["HELP"])} guide chapters, {len(D["BUILDINGS"])} building kinds, {len(D["RECIPES"])} recipes.')
