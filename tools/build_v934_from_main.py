#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.33 -> V90.34 构建器（战斗日志不再折叠，直接占中段）

基线：V90.33（字节哈希，按 CRLF 归一）

用户反馈（2026-10-20）：「战斗日志不用做折叠」

所以回到参考图的样子：
  顶部敌方（紧凑，不拉伸）→ 中间战斗日志（常显，自己滚动，永远停在最新一行）→
  技能三格 → 六个动作 → 底部我方血条。

同时保留 V90.33 的两处修正：敌方面板不再吞掉空白、底部安全区内边距。
日志常显后，中段空白被日志吃掉，长屏也不会再是一大片空白。

三条硬断言：基线哈希 / 替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.33_战斗界面长屏修正版.html"
OUT_NAME = "山野修仙记_V90.34_战斗日志常显版.html"
BASE_SHA = "5BF56EF03B4F8913EA5436F1D660482F56C746F635693E99F7A9ABC7D025828D"

CSS = """
/* V90.34 战斗界面：日志常显、占中段、自己滚动 */
.cb-log-wrap{flex:1 1 auto!important;min-height:88px;display:flex;flex-direction:column;overflow:hidden}
.cb-log-wrap>.cb-log{flex:1 1 auto;height:auto;max-height:none;min-height:0;border:0;border-radius:0;padding:9px 10px}
.cb-skills{margin-top:0}
"""

NEW_FN = r"""
/* V90.34 战斗界面：顶部敌 / 中间日志常显 / 技能 / 动作 / 底部我 */
function renderCombatPanel(){
 const b=game.s.combat,s=game.s,e=D.ENEMIES[b.type];
 const roundSpirit=b.training?0:2+game.extra(15).spirit,needSpirit=cost=>cost+roundSpirit;
 const bossSkill=b.intent==='skill'?game.bossSkill(b.type):null;
 const hint=bossSkill?'首领绝技 · '+bossSkill.name+' · 防守可抵御':b.intent==='trait'?game.traitHint(b):b.intent==='heavy'?(b.charge?game.traitHint(b):'重击将至 · 宜防守'):b.intent==='recover'?'敌人调息 · 可进攻':'普通攻击';
 const tone=b.intent==='heavy'||b.intent==='skill'||b.intent==='trait'?'danger':b.intent==='recover'?'recovery':'normal';
 const pct=(v,max)=>Math.max(0,Math.min(100,v/Math.max(1,max)*100));
 const lines=(s.logs||[]).slice(0,24).reverse();
 const logLines=lines.map(l=>`<p class="cb-line ${esc(l.tone||'')}">${esc(l.time)} · ${esc(l.msg)}</p>`).join('');
 const manual=["attack","guard","utility"].map(slot=>{const m=globalThis.QManuals[s.manuals.equipped[slot]];if(!m)return '';const cd=b.cooldowns?.[m.id]||0;const wait=cd>b.turn;const lack=s.spirit<m.spirit;
   return `<button class="btn" data-a="fight" data-mode="manual" data-id="${m.id}" ${wait||lack?'disabled':''}>${esc(m.name)}<small>${wait?'冷却'+(cd-b.turn)+'回合':lack?'灵力不足 · 需'+m.spirit:'耗灵'+m.spirit+(roundSpirit?' + '+roundSpirit:'')}</small></button>`;}).join('');
 return `<section class="cb-foe">
  <div class="cb-head"><strong class="cb-name">${esc(e.name)}</strong><span class="cb-meta">${b.training?'练习 · ':b.repeat?'再战 · ':''}第 ${b.turn} 回合</span></div>
  <div class="cb-bar"><i style="width:${pct(b.hp,b.maxHp)}%"></i><span>${b.hp} / ${b.maxHp}</span></div>
  <div class="cb-hint ${tone}">${esc(hint)}${(s.zone>=5&&(b.intent==='heavy'||b.intent==='skill'))?' · 穿甲威胁，请防守':''}</div>
 </section>
 <div class="cb-log-wrap"><div class="cb-log" id="combat-log">${logLines||'<p class="cb-line dim">斗法开始</p>'}</div></div>
 <div class="cb-skills">${manual||'<p class="cb-cost" style="grid-column:1/-1">未装备功法 · 可在「修炼 → 功法传承」装备三个主动技能</p>'}</div>
 <div class="cb-actions">
  <button class="btn primary" data-a="fight" data-mode="attack">${s.character==='demon'?'爪击':'剑击'}<small>基础 ${s.attack+game.weapon}</small></button>
  <button class="btn spell" data-a="fight" data-mode="spell">${game.character.spellName}<small>${game.character.energy} −${game.spellCost}${roundSpirit?' · 回合−'+roundSpirit:''}</small></button>
  <button class="btn" data-a="fight" data-mode="guard">防守<small>减伤 · 蓄势</small></button>
  <button class="btn" data-a="fight" data-mode="heal">${game.character.healSpell?'回春术':'回春散'}<small>${game.character.healSpell&&s.spirit>=14?'灵力−14':b.training?'练习药'+b.virtualHeals:'药'+(s.inv.salve||0)}</small></button>
  <button class="btn" data-a="fight" data-mode="mana">回灵丹<small>${b.training?'练习用':'余'+(s.inv.mana||0)}</small></button>
  <button class="btn" data-a="fight" data-mode="escape" ${b.type.startsWith('boss')?'disabled':''}>${b.training?'结束':'撤离'}<small>${b.type.startsWith('boss')?'不可撤离':b.training?'恢复原状态':'成功率80%'}</small></button>
 </div>
 <section class="cb-self">
  <div class="cb-head"><strong class="cb-name">${esc(game.character.short)} · ${esc(game.realm)}</strong><span class="cb-meta">气血 ${s.hp}/${s.maxHp} · 灵力 ${s.spirit}/${s.maxSpirit}</span></div>
  <div class="cb-bar"><i style="width:${pct(s.hp,s.maxHp)}%"></i><span>${s.hp} / ${s.maxHp}</span></div>
  <div class="cb-cost">${b.training?'试剑不扣实际回合补给':`每回合自然消耗：灵力 ${roundSpirit} · 饱腹 1 · 饮水 ${1+game.extra(15).water}`}${s.spirit<=Math.max(15,needSpirit(10))?' · 灵力偏低，建议普攻／防守或回灵':''}</div>
 </section>`;
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

    text = rep(text, "<title>山野修仙记 V90.33 · 战斗界面长屏修正</title>",
               "<title>山野修仙记 V90.34 · 战斗日志常显</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.33'", "subtitle='人妖异途 · V90.34'", "副标题版本号")
    text = rep(text, "V90.33 · ${game.character.name}", "V90.34 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.33_本机飞升资质榜.json", "山野修仙记_V90.34_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.33：", "当前版本 V90.34：", "帮助页版本说明")

    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v934-combat-log\">" + CSS + "</style>\n</head>\n<body>",
               "注入日志常显样式")

    start = text.find("/* V90.31 战斗界面：顶部敌方大血条")
    if start < 0:
        start = text.find("function renderCombatPanel(){")
    end = text.find("function renderMap(){", start)
    if start < 0 or end < 0:
        raise SystemExit("[ABORT] 找不到战斗渲染区段")
    text = text[:start] + NEW_FN.strip() + "\n" + text[end:]
    ok("替换战斗渲染函数", f"{(end - start):,} 字符 -> {len(NEW_FN):,} 字符")

    for needle, what in (("v934-combat-log", "样式块"),
                         ('<div class="cb-log-wrap">', "常显日志容器"),
                         ("renderCombatPanel(){", "渲染函数")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    if '<details class="cb-log-wrap"' in text or "combat-log-wrap" in text:
        raise SystemExit("[ABORT] 日志仍然是 details 折叠")
    ok("产物标记", "日志容器常显 / 样式齐全（页面里其它 <details> 不动）")

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
