#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.47 -> V90.48：后七境属性接入成长表（气血/灵力/攻击按十二境基准）

范围严格控制：
  · 前两境（major<=1，凡人~金丹）保持原公式不变 —— 不动新手体感、不动老测试
  · major>=2 的七境：maxHp / maxSpirit / attack 由 REALM_STATS 与该阶段系数(0.70/0.85/1.00)决定
  · 破境成功时按新境重算，而不是 +t.hp 累加
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.47_护劫丹.html"
OUT_NAME = "山野修仙记_V90.48_高境属性.html"
BASE_SHA = "A0DB2332F245A2E42578A01ADE420105B869AC65120697CD8A502EA4F91EB861"

BLOCK = '''/* V90.48 十二境属性基准（后期、未穿装备）；阶系数 0.70 / 0.85 / 1.00 */
D.REALM_STATS=[
 {hp:180,atk:6,spirit:90},{hp:300,atk:9,spirit:120},{hp:480,atk:13,spirit:160},
 {hp:760,atk:19,spirit:210},{hp:1200,atk:28,spirit:280},{hp:1900,atk:41,spirit:380},
 {hp:3000,atk:60,spirit:510},{hp:4700,atk:88,spirit:690},{hp:7400,atk:130,spirit:930},
 {hp:11600,atk:190,spirit:1250},{hp:18200,atk:280,spirit:1700},{hp:28500,atk:410,spirit:2300}
];
/* major>=2 时，境界序 = major+5（金丹=6 → 元婴=7 … 渡劫=12） */
D.statsFor=function(major,daoXp,need){
 const m=Math.max(0,Math.round(Number(major)||0));
 if(m<2)return null;
 const idx=Math.min(12,m+5), t=D.REALM_STATS[idx-1];
 const r=need>0?(Number(daoXp)||0)/need:0;
 const f=r>=2/3?1:(r>=1/3?0.85:0.70);
 return {index:idx,hp:Math.round(t.hp*f),atk:Math.round(t.atk*f),spirit:Math.round(t.spirit*f)};
};
'''

OLD_NORM = "n.maxHp=c.hp+9*(n.level-1);n.maxSpirit=c.spirit+2*(n.level-1);n.attack=c.attack+n.level-1;"
NEW_NORM = ("n.maxHp=c.hp+9*(n.level-1);n.maxSpirit=c.spirit+2*(n.level-1);n.attack=c.attack+n.level-1;\n"
            " {const _st=D.statsFor(n.major,n.daoXp,(D.ASCENSION_STAGES[n.major-1]||{}).needDao||D.ASCENSION_RULE.dao);\n"
            "  if(_st){n.maxHp=_st.hp;n.maxSpirit=_st.spirit;n.attack=_st.atk;}}\n"
            " if(n.hp>n.maxHp)n.hp=n.maxHp;if(n.spirit>n.maxSpirit)n.spirit=n.maxSpirit;")

OLD_BREAK = ("  this.s.attack+=t.atk;this.s.maxHp+=t.hp;this.s.maxSpirit+=t.spirit;")
NEW_BREAK = ("  {const _st=D.statsFor(this.s.major,0,(D.ASCENSION_STAGES[this.s.major-1]||{}).needDao||D.ASCENSION_RULE.dao);\n"
             "   if(_st){this.s.maxHp=_st.hp;this.s.maxSpirit=_st.spirit;this.s.attack=_st.atk;}\n"
             "   else{this.s.attack+=t.atk;this.s.maxHp+=t.hp;this.s.maxSpirit+=t.spirit;}}")


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label):
    n = t.count(old)
    if n != 1:
        raise SystemExit(f"[ABORT] {label}: 命中 {n} 次")
    ok(label)
    return t.replace(old, new, 1)


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    ok("基线校验", f"{len(raw):,} B")
    text = raw.decode("utf-8").replace("\r\n", "\n")

    text = rep(text, "<title>山野修仙记 V90.47 · 护劫丹</title>",
               "<title>山野修仙记 V90.48 · 高境属性</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.47'", "subtitle='人妖异途 · V90.48'", "副标题版本号")
    text = rep(text, "V90.47 · ${game.character.name}", "V90.48 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.47_本机飞升资质榜.json", "山野修仙记_V90.48_本机飞升资质榜.json",
               "导出文件名")

    text = rep(text, "D.realmOfLevel=function(level,character){", BLOCK + "D.realmOfLevel=function(level,character){",
               "插入 REALM_STATS + statsFor")
    text = rep(text, OLD_NORM, NEW_NORM, "normalize 高境按表重算")
    text = rep(text, OLD_BREAK, NEW_BREAK, "破境按新境重算")

    for needle in ("D.REALM_STATS=", "D.statsFor=function", "this.s.maxHp=_st.hp"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "属性表/换算/接线 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
