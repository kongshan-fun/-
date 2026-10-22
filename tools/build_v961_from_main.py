#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.60 -> V90.61：战斗中存档「沿用存档数值」（吸收云端 V90.59 的更稳做法）

背景：本地 V90.60 的 normalize 会用 zone/level 重算 combat 的 maxHp/atk；
      若玩家在开战后境界/地图有变化（渡劫、换图），重算值会与内存值不同，
      表现为"刷新后怪物血量变了"。
      云端 V90.59 的做法更稳：优先沿用存档里的 maxHp/atk，缺失或非法时才推算。

本版只改这一点，其余（晋升分流、修为继承、属性丹、渡劫口径）保持本地实现。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.60_破境分流.html"
OUT_NAME = "山野修仙记_V90.61_存档沿用.html"
BASE_SHA = "0750D762B2BED2A6CFC64650D889B6DD8F7FC36940E3F57F902E3B1C69E82FAA"

OLD = '''   const _boost=1+0.10*_gap,_damp=Math.max(0.20,1-0.08*_gap);
   const maxHp=Math.round(e.hp*(repeat?1.25:1)/_damp);
   n.combat={type:t,hp:integer(o.combat.hp,1,maxHp),maxHp,atk:Math.round(e.atk*(repeat?1.25:1)*_boost),armor:e.armor,'''

NEW = '''   const _boost=1+0.10*_gap,_damp=Math.max(0.20,1-0.08*_gap);
   /* V90.61 优先沿用存档里的对手数值（云端 V90.59 口径）：避免刷新后数值漂移 */
   const expectedMaxHp=Math.round(e.hp*(repeat?1.25:1)/_damp);
   const maxHp=(Number.isSafeInteger(o.combat.maxHp)&&o.combat.maxHp>=1&&o.combat.maxHp<=100000000)?o.combat.maxHp:expectedMaxHp;
   const savedAtk=(Number.isSafeInteger(o.combat.atk)&&o.combat.atk>=0&&o.combat.atk<=100000000)?o.combat.atk:Math.round(e.atk*(repeat?1.25:1)*_boost);
   n.combat={type:t,hp:integer(o.combat.hp,1,maxHp),maxHp,atk:savedAtk,armor:e.armor,'''


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

    text = rep(text, "<title>山野修仙记 V90.60 · 破境分流</title>",
               "<title>山野修仙记 V90.61 · 存档沿用</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.60'", "subtitle='人妖异途 · V90.61'", "副标题版本号")
    text = rep(text, OLD, NEW, "normalize 沿用存档数值")

    for needle in ("const expectedMaxHp=", "const savedAtk=", "atk:savedAtk"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "沿用存档数值 已接入")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
