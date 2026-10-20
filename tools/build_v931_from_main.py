#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.30 -> V90.31 构建器（战斗界面按参考图再排一次）

基线：V90.30（字节哈希，按 CRLF 归一）

用户实测反馈（2026-10-20）：
  1. 敌人血条在上、主角血条在下（已是），**技能模块要放在主角血条上面**
  2. 血条「占更大空间、显示更明显」
  3. 战斗日志**不要留那么大空间**，做成「下拉隐藏」样式

落地：
  - 顺序改为：敌方（名+大血条+意图）→ 日志（默认收起，summary 显示最新一条）→
    技能三格 → 六个动作 → 我方（名+大血条+灵力/消耗）
  - 血条 13px -> 22px，字号 10 -> 12，我方血条同样放大
  - 日志用原生 `<details>`：默认收起（只占一行，摘要里带最新一条），点开才展开；
    展开状态记在 `combatLogOpen`，跨回合保持
  - 说明：交接文档里「禁止折叠式下拉条把多个功能塞一屏」针对的是**多个功能**；
    战斗日志是单一功能（看历史），用户也明确要求，故按可折叠处理

三条硬断言：基线哈希 / 替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.30_战斗界面重做版.html"
OUT_NAME = "山野修仙记_V90.31_战斗界面排布版.html"
BASE_SHA = "3051AE4C2C5C068B450CDABF82F5E3C99E0E47DEE80B21E33D57810117C2C896"

CSS_OLD_ANCHOR = ".combat-root{position:absolute;inset:0;z-index:63;"

CSS_ADD = """
/* V90.31 战斗界面：血条放大、技能上移到我方血条之上、日志折叠 */
.cb-foe,.cb-self{padding:9px 10px;gap:6px}
.cb-foe .cb-bar,.cb-self .cb-bar{height:24px;border-radius:12px}
.cb-skills{margin-top:auto}
.cb-foe{flex:1 1 auto;justify-content:flex-end;min-height:96px}
.combat-root.log-open .cb-foe{flex:0 0 auto;justify-content:flex-start}
.cb-log-wrap[open]{max-height:52vh;overflow:hidden}
.cb-log-wrap[open] .cb-log{max-height:calc(52vh - 34px)}
.cb-foe .cb-bar>span,.cb-self .cb-bar>span{font-size:12px;font-weight:600}
.cb-name{font-size:17px}
.cb-meta{font-size:10.5px}
.cb-log-wrap{flex:none;border:1px solid var(--line);border-radius:8px;background:var(--surface,#fff);overflow:hidden}
.cb-log-wrap>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;padding:7px 9px;font-size:10.5px;color:#555;line-height:1.35}
.cb-log-wrap>summary::-webkit-details-marker{display:none}
.cb-log-wrap>summary .cb-sum-tag{flex:none;font-weight:650;color:#333}
.cb-log-wrap>summary .cb-sum-line{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#666}
.cb-log-wrap>summary .cb-sum-arrow{flex:none;color:#999;transition:transform .15s}
.cb-log-wrap[open]>summary{border-bottom:1px solid var(--line)}
.cb-log-wrap[open]>summary .cb-sum-arrow{transform:rotate(180deg)}
.cb-log-wrap .cb-log{border:0;border-radius:0;max-height:38vh;min-height:0}
@media (max-width:340px){.cb-foe .cb-bar,.cb-self .cb-bar{height:19px}.cb-log-wrap .cb-log{max-height:32vh}}
"""

NEW_FN = r"""
/* V90.31 战斗界面：顶部敌方大血条 / 折叠日志 / 技能在主角血条之上 / 底部主角大血条 */
function renderCombatPanel(){
 const b=game.s.combat,s=game.s,e=D.ENEMIES[b.type];
 const roundSpirit=b.training?0:2+game.extra(15).spirit,needSpirit=cost=>cost+roundSpirit;
 const bossSkill=b.intent==='skill'?game.bossSkill(b.type):null;
 const hint=bossSkill?'首领绝技 · '+bossSkill.name+' · 防守可抵御':b.intent==='trait'?game.traitHint(b):b.intent==='heavy'?(b.charge?game.traitHint(b):'重击将至 · 宜防守'):b.intent==='recover'?'敌人调息 · 可进攻':'普通攻击';
 const tone=b.intent==='heavy'||b.intent==='skill'||b.intent==='trait'?'danger':b.intent==='recover'?'recovery':'normal';
 const pct=(v,max)=>Math.max(0,Math.min(100,v/Math.max(1,max)*100));
 const lines=(s.logs||[]).slice(0,12).reverse();
 const latest=lines.length?lines[lines.length-1]:null;
 const logLines=lines.map(l=>`<p class="cb-line ${esc(l.tone||'')}">${esc(l.time)} · ${esc(l.msg)}</p>`).join('');
 const manual=["attack","guard","utility"].map(slot=>{const m=globalThis.QManuals[s.manuals.equipped[slot]];if(!m)return '';const cd=b.cooldowns?.[m.id]||0;const wait=cd>b.turn;const lack=s.spirit<m.spirit;
   return `<button class="btn" data-a="fight" data-mode="manual" data-id="${m.id}" ${wait||lack?'disabled':''}>${esc(m.name)}<small>${wait?'冷却'+(cd-b.turn)+'回合':lack?'灵力不足 · 需'+m.spirit:'耗灵'+m.spirit+(roundSpirit?' + '+roundSpirit:'')}</small></button>`;}).join('');
 return `<section class="cb-foe">
  <div class="cb-head"><strong class="cb-name">${esc(e.name)}</strong><span class="cb-meta">${b.training?'练习 · ':b.repeat?'再战 · ':''}第 ${b.turn} 回合</span></div>
  <div class="cb-bar"><i style="width:${pct(b.hp,b.maxHp)}%"></i><span>${b.hp} / ${b.maxHp}</span></div>
  <div class="cb-hint ${tone}">${esc(hint)}${(s.zone>=5&&(b.intent==='heavy'||b.intent==='skill'))?' · 穿甲威胁，请防守':''}</div>
 </section>
 <details class="cb-log-wrap" id="combat-log-wrap" ${combatLogOpen?'open':''}>
  <summary><span class="cb-sum-tag">战斗日志 ${lines.length} 条</span><span class="cb-sum-line">${latest?esc(latest.msg):'斗法开始'}</span><span class="cb-sum-arrow">▾</span></summary>
  <div class="cb-log" id="combat-log">${logLines||'<p class="cb-line dim">斗法开始</p>'}</div>
 </details>
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
 const wrap=$('combat-log-wrap'),wasOpen=wrap?wrap.open:combatLogOpen;
 root.hidden=false; root.innerHTML=renderCombatPanel();
 const log=$('combat-log'),nowWrap=$('combat-log-wrap');
 root.classList.toggle('log-open',!!wasOpen);
 if(nowWrap){nowWrap.open=wasOpen;
   nowWrap.addEventListener('toggle',()=>{combatLogOpen=nowWrap.open;root.classList.toggle('log-open',nowWrap.open);});}
 if(log)log.scrollTop=log.scrollHeight;
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

    text = rep(text, "<title>山野修仙记 V90.30 · 战斗界面重做</title>",
               "<title>山野修仙记 V90.31 · 战斗界面排布</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.30'", "subtitle='人妖异途 · V90.31'", "副标题版本号")
    text = rep(text, "V90.30 · ${game.character.name}", "V90.31 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.30_本机飞升资质榜.json", "山野修仙记_V90.31_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.30：", "当前版本 V90.31：", "帮助页版本说明")

    # 1) 状态：记住日志展开与否
    text = rep(text, "guideSignature='',importCandidate=null;",
               "guideSignature='',importCandidate=null,combatLogOpen=false;", "新增 combatLogOpen 状态")
    # 2) 样式追加
    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v931-combat-layout\">" + CSS_ADD + "</style>\n</head>\n<body>",
               "注入放大血条/折叠日志样式")
    # 3) 整段替换 renderCombatPanel + syncCombat
    start = text.find("function renderCombatPanel(){")
    end = text.find("function renderMap(){", start)
    if start < 0 or end < 0:
        raise SystemExit("[ABORT] 找不到 renderCombatPanel/syncCombat 区段")
    text = text[:start] + NEW_FN.strip() + "\n" + text[end:]
    ok("替换战斗渲染函数", f"{(end - start):,} 字符 -> {len(NEW_FN):,} 字符")

    # ---- 产物断言 ----
    for needle, what in (('class="cb-log-wrap"', "折叠日志容器"),
                         ("combatLogOpen=false", "展开状态变量"),
                         ("<section class=\"cb-self\">", "我方区块"),
                         ("cb-skills", "技能模块")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "折叠日志 / 状态变量 / 我方区块 / 技能模块 齐全")
    fn_start = text.find("function renderCombatPanel(){")
    fn_end = text.find("function syncCombat(){")
    body = text[fn_start:fn_end]
    order = [body.find('class="cb-foe"'), body.find('class="cb-log-wrap"'),
             body.find('class="cb-skills"'), body.find('class="cb-actions"'),
             body.find('class="cb-self"')]
    if any(x < 0 for x in order) or order != sorted(order):
        raise SystemExit(f"[ABORT] 三段顺序不对：{order}")
    ok("顺序检查", "敌 → 日志 → 技能 → 动作 → 我（技能在我方血条之上）")
    for mode in ('data-mode="attack"', 'data-mode="spell"', 'data-mode="guard"',
                 'data-mode="heal"', 'data-mode="mana"', 'data-mode="escape"', 'data-mode="manual"'):
        if mode not in text:
            raise SystemExit(f"[ABORT] 产物缺少动作：{mode}")
    ok("动作保留", "七个 mode 都在")

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
