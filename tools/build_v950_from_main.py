#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.49 -> V90.50：前两境（凡人~金丹）也接入十二境属性表

至此 36 段全部按 REALM_STATS 说话：
  前六境（level 1..18）  → 境 = ceil(level/3)，阶 = (level-1)%3
  后六境（major 2..8）    → 境 = min(12, major+5)，阶由道行决定
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.49_怪物对齐.html"
OUT_NAME = "山野修仙记_V90.50_全境属性.html"
BASE_SHA = "F569E87280C4A49CA9EA6838EFA81AD276E0905B8BC820041C365345992BBA46"

HELPER = '''/* V90.50 前六境：按 level 换算境/阶，套同一张属性表 */
D.statsForLevel=function(level){
 const lv=Math.max(1,Math.min(36,Math.round(Number(level)||1)));
 const idx=Math.min(12,Math.ceil(lv/3)), st=(lv-1)%3;
 const t=D.REALM_STATS[idx-1], f=st===2?1:(st===1?0.85:0.70);
 return {index:idx,stage:st+1,hp:Math.round(t.hp*f),atk:Math.round(t.atk*f),spirit:Math.round(t.spirit*f)};
};
'''

OLD = " {const _st=D.statsFor(n.major,n.daoXp,(D.ASCENSION_STAGES[n.major-1]||{}).needDao||D.ASCENSION_RULE.dao);"
NEW = (" {const _st=(n.major<2?D.statsForLevel(n.level):D.statsFor(n.major,n.daoXp,(D.ASCENSION_STAGES[n.major-1]||{}).needDao||D.ASCENSION_RULE.dao));")


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

    text = rep(text, "<title>山野修仙记 V90.49 · 怪物对齐</title>",
               "<title>山野修仙记 V90.50 · 全境属性</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.49'", "subtitle='人妖异途 · V90.50'", "副标题版本号")
    text = rep(text, "V90.49 · ${game.character.name}", "V90.50 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.49_本机飞升资质榜.json", "山野修仙记_V90.50_本机飞升资质榜.json",
               "导出文件名")

    text = rep(text, "D.statsFor=function(major,daoXp,need){", HELPER + "D.statsFor=function(major,daoXp,need){",
               "插入 statsForLevel")
    text = rep(text, OLD, NEW, "normalize 前六境也走表")

    for needle in ("D.statsForLevel=function", "n.major<2?D.statsForLevel(n.level)"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "helper + 接线 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
