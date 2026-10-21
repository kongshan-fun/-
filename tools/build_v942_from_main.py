#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.41 -> V90.42 构建器（后七境补前中后期 + 只有后期满才能破境）

基线：V90.41（字节哈希，按 CRLF 归一）

问题（用户提出，已核实）：
  `QBirth.realm()` 里写的是 `state.major>1 ? realms[major] : ...`，于是
    · 炼气 1~9 层 → 「炼气三层」
    · 筑基（level 10~18）→ 「筑基初期/中期/后期」
    · 金丹及以后（major≥1）→ 只剩一个光秃秃的境界名，没有任何前期/中期/后期
  而破境判定本来是 `daoXp >= needDao` 才放行（= 道行修满），
  也就是说「只有后期满才能破境」在代码里是对的，但玩家看不到"后期"这个概念。

本版改动（全部围绕"看得见的分段"，不改战斗/经济数值）：
  0. 澄清语义：`major=1` 是"筑基"（level 10 时置 1），金丹从 `major=2` 起 → 阶段后缀也只在 major>=2 生效
  2. 后七境（金丹~渡劫）按道行三等分补上 初期/中期/后期：
       < 1/3 初期 · < 2/3 中期 · ≥ 2/3 后期 · = 100% 后期圆满（可破境）
  3. 状态栏/修炼页的「道 34/60」后面补上阶段名，并加一条三段刻度条
  4. 破境指引提示改成「需先修到 XX 后期圆满（道行 x/x）」
  5. 教程·境界段落补一句三阶段说明
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.41_面板全屏版.html"
OUT_NAME = "山野修仙记_V90.42_境界分段版.html"
BASE_SHA = "5011A7155DE32F6F24C38CBE6784B49F7B9438769DACABA57F230D393C89C9DE"

CSS = """
/* V90.42 后七境前中后期：三段道行刻度 */
.dao-stage{display:inline-flex;align-items:center;gap:4px;margin-left:4px}
.dao-stage i{display:block;width:12px;height:5px;border-radius:2px;background:#d8d8d8}
.dao-stage i.on{background:#222}
"""

# 1) QBirth 境界名：major>=1 也算进入该大境界
OLD_BIRTH = "return state.major>1?r.realms[state.major]:state.level<=9?r.start+n[state.level]+'层':r.second+(state.level<=12?'初期':state.level<=15?'中期':'后期');"
NEW_BIRTH = "return state.major>1?r.realms[state.major]:state.level<=9?r.start+n[state.level]+'层':r.second+(state.level<=12?'初期':state.level<=15?'中期':'后期');"

# 2) 引擎 realm：后七境按道行三等分加阶段后缀
OLD_GET_REALM = "get realm(){return B.realm(this.s);}"
NEW_GET_REALM = ("get realm(){const base=B.realm(this.s);if(this.s.major<2)return base;"
                 "const need=this.tribulationNeed||0;if(!need)return base;"
                 "const r=(this.s.daoXp||0)/need;"
                 "return base+(r>=1?'圆满':r>=2/3?'后期':r>=1/3?'中期':'初期');}"
                 " /* V90.42 后七境：初期/中期/后期/圆满（道行三等分） */")
NEW_STAGE_FN = ("/* V90.42 道行三段刻度：0~1/3 初期 · 1/3~2/3 中期 · 2/3~1 后期 · 满 圆满 */\n"
                "function daoStageBars(){const need=game.tribulationNeed||0;if(!need||game.s.major<2)return '';\n"
                " const done=(game.s.daoXp||0)/need;\n"
                " const seg=Math.max(1,Math.min(3,Math.ceil(done*3)));\n"
                " return `<span class=\"dao-stage\">${[0,1,2].map(i=>`<i class=\"${i<seg?'on':''}\"></i>`).join('')}</span>`;}\n")

# 3) 状态栏：道 xx/60 后面加阶段条
OLD_STATUS = "道 '+s.daoXp+'/'+(game.tribulationNeed||'—')"
NEW_STATUS = "道 '+s.daoXp+'/'+(game.tribulationNeed||'—')+' '+esc(game.realm.replace(/^(.*?)(初期|中期|后期|圆满)$/,'$2'))+daoStageBars()"

# 4) 修炼页：道行 chip 补阶段名 + 刻度
OLD_CHIP = "<span>${s.level>=18?'道行 '+s.daoXp+'/'+(game.tribulationNeed||'—'):'修为 '+s.xp+'/'+game.required}</span>"
NEW_CHIP = "<span>${s.level>=18?'道行 '+s.daoXp+'/'+(game.tribulationNeed||'—')+' · '+game.realm.replace(/^(.*?)(初期|中期|后期|圆满)$/,'$1$2').replace(/^[^\\u4e00-\\u9fa5]+/,'')+daoStageBars():'修为 '+s.xp+'/'+game.required}</span>"

# 5) 破境指引提示：说清"要后期圆满"
OLD_HINT = "hint:'道行 '+s.daoXp+'/'+p.st.needDao+'，问道坛、试炼与主线推进都会增长'"
NEW_HINT = ("hint:'道行 '+s.daoXp+'/'+p.st.needDao+'，需先修到本境后期圆满才能破境；"
            "问道坛、试炼与主线推进都会增长道行'")

# 6) 教程：境界段落补三阶段
OLD_HELP = "初期九层之后进入第二大境界，累计18级达到第二大境界后期。之后将修为积累为道行，按各境所需完成仪式、首领和破境。"
NEW_HELP = ("初期九层之后进入第二大境界，累计18级达到第二大境界后期。此后每一境都分初期、中期、后期三段："
            "道行修到三分之一为中期、三分之二为后期，修满即后期圆满——只有圆满之后，才能在洞府里破境或渡劫。")


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

    text = rep(text, "<title>山野修仙记 V90.41 · 面板全屏</title>",
               "<title>山野修仙记 V90.42 · 境界分段</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.41'", "subtitle='人妖异途 · V90.42'", "副标题版本号")
    text = rep(text, "V90.41 · ${game.character.name}", "V90.42 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.41_本机飞升资质榜.json", "山野修仙记_V90.42_本机飞升资质榜.json",
               "资质榜导出文件名")

    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v942-realm-stage\">" + CSS + "</style>\n</head>\n<body>",
               "注入三段刻度样式")
    text = rep(text, OLD_BIRTH, NEW_BIRTH, "境界名：金丹起走大境界名（major>1）")
    text = rep(text, OLD_GET_REALM, NEW_GET_REALM, "realm 加前中后期后缀")
    text = rep(text, "function renderPanel(){const root=$('panel-root');",
               NEW_STAGE_FN + "function renderPanel(){const root=$('panel-root');", "插入 daoStageBars()")
    text = rep(text, OLD_STATUS, NEW_STATUS, "状态栏道行加阶段")
    text = rep(text, OLD_CHIP, NEW_CHIP, "修炼页道行 chip 加阶段")
    text = rep(text, OLD_HINT, NEW_HINT, "破境提示写清后期圆满")
    text = rep(text, OLD_HELP, NEW_HELP, "教程补三阶段说明")

    for needle, what in (("v942-realm-stage", "样式"),
                         ("state.major>1?r.realms[state.major]", "境界名判定"),
                         ("daoStageBars()", "刻度函数"),
                         ("daoStageBars()", "刻度调用"),
                         ("后期圆满才能破境", "破境提示")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "样式/判定/刻度/提示 齐全")
    if "初期、中期、后期三段" not in text:
        raise SystemExit("[ABORT] 教程段未更新")

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
