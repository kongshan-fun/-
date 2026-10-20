#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.29 -> V90.30 构建器（战斗界面重做：全屏模态 + 三段式）

基线：V90.29（字节哈希，按 CRLF 归一）

用户需求（2026-10-20，附参考截图）：
  1. 战斗界面做成「顶部敌我血条与名称 + 中间战斗日志 + 下方技能模块」
  2. 战斗一旦触发就是模态：不击败或逃跑不能退出
  3. 顺带修「地图上遇到怪却不弹战斗、要手动关地图才看得见」的不符合直觉

落地：
  A. 新增全屏层 `#combat-root`（z-index 63：压过地图 60，低于弹窗 70 / toast 65）
  B. `renderCombatPanel()` 输出三段式结构，`syncCombat()` 负责显隐
  C. `render()` 里：有战斗就强制关掉地图 / 出行菜单 / 面板，并渲染战斗层
  D. `renderScene()` 不再把战斗画进场景卡（战斗层盖住它），战斗结束后场景即为常态
  E. `syncLayers()`：斗法中隐藏引导浮层
  F. 旧的 renderCombat() 保留但不再被调用（降风险，注释标明 legacy）

不动引擎规则：所有动作仍是 `data-a="fight" data-mode=...`，data-a 集合不变。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.29_广告奖励可重复版.html"
OUT_NAME = "山野修仙记_V90.30_战斗界面重做版.html"
BASE_SHA = "AE5C59E6485917811C7419BCF9704DFCF99D87E5CBCDDB09B3C4F704B8A4A0E5"

CSS = """
/* V90.30 战斗界面：全屏模态，三段式（敌 / 日志 / 我+技能） */
.combat-root{position:absolute;inset:0;z-index:63;display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--page);overflow:hidden}
.combat-root[hidden]{display:none!important}
.cb-foe,.cb-self{flex:none;border:1px solid var(--line);border-radius:8px;padding:7px 9px;display:flex;flex-direction:column;gap:4px;background:var(--panel-bg,var(--surface,#fff))}
.cb-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0}
.cb-name{font:650 15px/1.25 "Noto Serif CJK SC","Songti SC",serif;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cb-meta{flex:none;font-size:10px;color:#777;font-variant-numeric:tabular-nums}
.cb-bar{position:relative;height:13px;border-radius:7px;background:#e9e9e9;overflow:hidden}
.cb-bar>i{display:block;height:100%;background:#c0392b;transition:width .18s linear}
.cb-self .cb-bar>i{background:#2f855a}
.cb-bar>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.cb-hint{font-size:10.5px;color:#8a1c1c}
.cb-hint.normal{color:#555}
.cb-hint.recovery{color:#2f855a}
.cb-log{flex:1 1 auto;min-height:96px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:8px 9px;display:flex;flex-direction:column;gap:5px;font-size:11.5px;line-height:1.62;background:var(--surface,#fff);scrollbar-width:thin}
.cb-line{margin:0;color:#333}
.cb-line b{font-weight:650}
.cb-line.warn{color:#8a1c1c}
.cb-line.good{color:#2f855a}
.cb-line.dim{color:#888;font-size:10.5px}
.cb-skills{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.cb-actions{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.cb-skills .btn,.cb-actions .btn{min-height:38px;padding:4px 5px;font-size:11.5px;line-height:1.25;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}
.cb-skills .btn small,.cb-actions .btn small{font-size:9px;color:#777;font-weight:400}
.cb-cost{flex:none;font-size:9.5px;color:#888;text-align:center}
@media (max-width:340px){.cb-log{font-size:11px;min-height:80px}.cb-skills .btn,.cb-actions .btn{min-height:34px;font-size:11px}}
"""

NEW_FN = r"""
/* V90.30 战斗界面：顶部敌方 / 中间日志 / 底部我方+技能。全屏模态，只有打赢或撤离才会消失。 */
function renderCombatPanel(){
 const b=game.s.combat,s=game.s,e=D.ENEMIES[b.type];
 const roundSpirit=b.training?0:2+game.extra(15).spirit,needSpirit=cost=>cost+roundSpirit;
 const bossSkill=b.intent==='skill'?game.bossSkill(b.type):null;
 const hint=bossSkill?'首领绝技 · '+bossSkill.name+' · 防守可抵御':b.intent==='trait'?game.traitHint(b):b.intent==='heavy'?(b.charge?game.traitHint(b):'重击将至 · 宜防守'):b.intent==='recover'?'敌人调息 · 可进攻':'普通攻击';
 const tone=b.intent==='heavy'||b.intent==='skill'||b.intent==='trait'?'danger':b.intent==='recover'?'recovery':'normal';
 const pct=(v,max)=>Math.max(0,Math.min(100,v/Math.max(1,max)*100));
 const logLines=(s.logs||[]).slice(0,9).reverse().map(l=>`<p class="cb-line ${esc(l.tone||'')}">${esc(l.time)} · ${esc(l.msg)}</p>`).join('');
 const manual=["attack","guard","utility"].map(slot=>{const m=globalThis.QManuals[s.manuals.equipped[slot]];if(!m)return '';const cd=b.cooldowns?.[m.id]||0;const wait=cd>b.turn;const lack=s.spirit<m.spirit;
   return `<button class="btn" data-a="fight" data-mode="manual" data-id="${m.id}" ${wait||lack?'disabled':''}>${esc(m.name)}<small>${wait?'冷却'+(cd-b.turn)+'回合':lack?'灵力不足 · 需'+m.spirit:'耗灵'+m.spirit+(roundSpirit?' + '+roundSpirit:'')}</small></button>`;}).join('');
 return `<section class="cb-foe">
  <div class="cb-head"><strong class="cb-name">${esc(e.name)}</strong><span class="cb-meta">${b.training?'练习 · ':b.repeat?'再战 · ':''}第 ${b.turn} 回合</span></div>
  <div class="cb-bar"><i style="width:${pct(b.hp,b.maxHp)}%"></i><span>${b.hp} / ${b.maxHp}</span></div>
  <div class="cb-hint ${tone}">${esc(hint)}${(s.zone>=5&&(b.intent==='heavy'||b.intent==='skill'))?' · 穿甲威胁，请防守':''}</div>
 </section>
 <div class="cb-log" id="combat-log">${logLines||'<p class="cb-line dim">斗法开始</p>'}</div>
 <section class="cb-self">
  <div class="cb-head"><strong class="cb-name">${esc(game.character.short)} · ${esc(game.realm)}</strong><span class="cb-meta">气血 ${s.hp}/${s.maxHp} · 灵力 ${s.spirit}/${s.maxSpirit}</span></div>
  <div class="cb-bar"><i style="width:${pct(s.hp,s.maxHp)}%"></i><span>${s.hp} / ${s.maxHp}</span></div>
  <div class="cb-cost">${b.training?'试剑不扣实际回合补给':`每回合自然消耗：灵力 ${roundSpirit} · 饱腹 1 · 饮水 ${1+game.extra(15).water}`}${s.spirit<=Math.max(15,needSpirit(10))?' · 灵力偏低，建议普攻／防守或回灵':''}</div>
 </section>
 <div class="cb-skills">${manual||'<p class="cb-cost" style="grid-column:1/-1">未装备功法 · 可在「修炼 → 功法传承」装备三个主动技能</p>'}</div>
 <div class="cb-actions">
  <button class="btn primary" data-a="fight" data-mode="attack">${s.character==='demon'?'爪击':'剑击'}<small>基础 ${s.attack+game.weapon}</small></button>
  <button class="btn spell" data-a="fight" data-mode="spell">${game.character.spellName}<small>${game.character.energy} −${game.spellCost}${roundSpirit?' · 回合−'+roundSpirit:''}</small></button>
  <button class="btn" data-a="fight" data-mode="guard">防守<small>减伤 · 蓄势</small></button>
  <button class="btn" data-a="fight" data-mode="heal">${game.character.healSpell?'回春术':'回春散'}<small>${game.character.healSpell&&s.spirit>=14?'灵力−14':b.training?'练习药'+b.virtualHeals:'药'+(s.inv.salve||0)}</small></button>
  <button class="btn" data-a="fight" data-mode="mana">回灵丹<small>${b.training?'练习用':'余'+(s.inv.mana||0)}</small></button>
  <button class="btn" data-a="fight" data-mode="escape" ${b.type.startsWith('boss')?'disabled':''}>${b.training?'结束':'撤离'}<small>${b.type.startsWith('boss')?'不可撤离':b.training?'恢复原状态':'成功率80%'}</small></button>
 </div>`;
}
function syncCombat(){
 const root=$('combat-root');if(!root)return;
 if(!game.s.combat){ if(!root.hidden){root.hidden=true;root.innerHTML='';} return; }
 root.hidden=false; root.innerHTML=renderCombatPanel();
 const log=$('combat-log'); if(log)log.scrollTop=log.scrollHeight;
}
"""


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label, expect=1):
    n = t.count(old)
    if n != expect:
        raise SystemExit(f"[ABORT] {label}: 期望 {expect} 次，实际 {n}")
    ok(label, f"{n} 处")
    return t.replace(old, new, expect)


def actions(t):
    return set(re.findall(r'data-a="([a-z0-9-]+)"', t))


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")
    before = actions(text)
    ok("基线动作集合", f"{len(before)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.29 · 广告奖励可重复</title>",
               "<title>山野修仙记 V90.30 · 战斗界面重做</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.29'", "subtitle='人妖异途 · V90.30'", "副标题版本号")
    text = rep(text, "V90.29 · ${game.character.name}", "V90.30 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.29_本机飞升资质榜.json", "山野修仙记_V90.30_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.29：", "当前版本 V90.30：", "帮助页版本说明")

    # 1) 样式
    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v930-combat\">" + CSS + "</style>\n</head>\n<body>",
               "注入战斗界面样式")
    # 2) 全屏层容器
    text = rep(text, '<div id="modal-root"></div>',
               '<div id="combat-root" class="combat-root" hidden></div>\n<div id="modal-root"></div>',
               "插入 #combat-root")
    # 3) 新渲染函数
    text = rep(text, "function renderMap(){", NEW_FN + "\nfunction renderMap(){",
               "插入 renderCombatPanel / syncCombat")
    # 4) 场景卡不再画战斗（战斗层盖住它）
    text = rep(text,
               "function renderScene(){\n const old=$('scene-content').scrollTop;\n "
               "if(game.s.combat){$('scene-content').innerHTML=renderCombat();$('scene-content').scrollTop=old;return;}",
               "function renderScene(){\n const old=$('scene-content').scrollTop;\n "
               "/* V90.30：斗法改由 #combat-root 全屏显示，场景卡继续画地图，战斗结束后无需重绘 */",
               "renderScene 去掉战斗分支")
    # 5) render() 里：斗法强制收掉地图/出行/面板，并渲染战斗层
    text = rep(text, "function render(){\n renderStatus();renderScene();",
               "function render(){\n if(game.s.combat){mapOpen=false;travelOpen=false;panel=null;}"
               " renderStatus();renderScene();", "render 开头收掉其他层")
    text = rep(text, "renderPanel();renderPromo();syncLayers();",
               "renderPanel();renderPromo();syncCombat();syncLayers();", "render 里调用 syncCombat")
    # 6) 斗法时隐藏引导浮层
    text = rep(text, "$('guide-root').hidden=!!frontPage||!!modal||mapOpen;",
               "$('guide-root').hidden=!!frontPage||!!modal||mapOpen||!!game.s.combat;",
               "斗法隐藏引导浮层")
    # 7) 开战时不要再弹 toast：同一句话已经在战斗日志第一行，且 toast 在 30% 位置会盖住日志
    text = rep(text,
               "if(show)notify(show.msg,show.tone,show.kind);",
               "if(show&&!(show.kind==='battle'&&game.s.combat))notify(show.msg,show.tone,show.kind);",
               "开战 toast 不遮挡日志")

    # ---- 产物断言 ----
    for needle, what in (("renderCombatPanel(){", "三段式渲染函数"),
                         ("syncCombat(){", "战斗层同步函数"),
                         ('id="combat-root"', "战斗层容器"),
                         ("v930-combat", "战斗样式"),
                         ("mapOpen=false;travelOpen=false;panel=null;", "斗法收掉其他层")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "容器/样式/渲染/同步/收层 齐全")
    if "if(game.s.combat){$('scene-content').innerHTML=renderCombat()" in text:
        raise SystemExit("[ABORT] 场景卡里的旧战斗分支没删掉")
    ok("旧分支已移除", "renderScene 不再画战斗卡")
    for mode in ('data-mode="attack"', 'data-mode="spell"', 'data-mode="guard"',
                 'data-mode="heal"', 'data-mode="mana"', 'data-mode="escape"', 'data-mode="manual"'):
        if mode not in text:
            raise SystemExit(f"[ABORT] 产物缺少动作：{mode}")
    ok("动作保留", "attack/spell/guard/heal/mana/escape/manual 七个 mode 都在")

    after = actions(text)
    if after != before:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after ^ before)}")
    ok("动作集合不变", f"{len(after)} 个")

    eol = "\r\n" if b"\r\n" in raw[:4000] else "\n"
    out = text.replace("\n", eol).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
