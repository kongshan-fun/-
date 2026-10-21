#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.55：把既有用例的夹具从「major 驱动」迁到「level 驱动」。每条替换断言唯一命中。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# major → level（major>=2 时 realmIndex=major+5，level=(realmIndex-1)*3+1）
def lv(m):
    if m <= 1:
        return 17 if m == 1 else 7
    return (min(12, m + 5) - 1) * 3 + 1

JOBS = {
    "tests/v923_gear_drop.cjs": [
        ("s.zone = zone; s.major = major; s.unlocked = Math.max(1, zone + 1);",
         "s.zone = zone; s.major = major; s.level = (function(m){return m<=1?(m===1?17:7):(Math.min(12,m+5)-1)*3+1;})(major); s.unlocked = Math.max(1, zone + 1);"),
    ],
    "tests/v927_gear_economy.cjs": [
        ("s.zone = zone; s.major = major; s.unlocked = Math.min(D.ZONES.length, zone + 1);",
         "s.zone = zone; s.major = major; s.level = (function(m){return m<=1?(m===1?17:7):(Math.min(12,m+5)-1)*3+1;})(major); s.unlocked = Math.min(D.ZONES.length, zone + 1);"),
    ],
    "tests/v952_forge_prof.cjs": [
        ("const mid = mk({ level: 18, major: 2 });", "const mid = mk({ level: 19, major: 2 });"),
    ],
    "tests/v953_refine_rating.cjs": [
        ("[18, 1, 6, '1.60'], [18, 2, 7, '1.72'], [36, 8, 12, '2.32']",
         "[18, 0, 6, '1.60'], [19, 0, 7, '1.72'], [36, 0, 12, '2.32']"),
        ("const levels = { 1: 1, 6: 18, 12: 36 };", "const levels = { 1: 1, 6: 16, 12: 34 };"),
        ("const majors = { 1: 0, 6: 1, 12: 8 };", "const majors = { 1: 0, 6: 0, 12: 0 };"),
        ("const g = mk({ level: 18, major: 1 });      // 境序 6", "const g = mk({ level: 16, major: 0 });      // 境序 6（金丹初期）"),
        ("const g6 = mk({ level: 18, major: 1 });", "const g6 = mk({ level: 16, major: 0 });"),
        ("const gb = mk({ level: 36, major: 8 });", "const gb = mk({ level: 34, major: 0 });"),
    ],
    "tests/v954_spirit_affix.cjs": [
        ("const mid = mk({ level: 18, major: 2 }), top = mk({ level: 36, major: 8 });",
         "const mid = mk({ level: 19, major: 2 }), top = mk({ level: 34, major: 0 });"),
        ("ok(low.spiritGain === 5 && mid.spiritGain === 17 && top.spiritGain === 27,",
         "ok(low.spiritGain === 5 && mid.spiritGain === 17 && top.spiritGain === 27,"),
        ("ok(top.spiritValue('pierce', 0) === Math.round(0.05 * 492), '破甲凡纹 = 0.050W（渡劫 W=492 → ' + Math.round(0.05 * 492) + '）');",
         "ok(top.spiritValue('pierce', 0) === Math.round(0.05 * 492), '破甲凡纹 = 0.050W（渡劫 W=492 → ' + Math.round(0.05 * 492) + '）');"),
    ],
}

for rel, pairs in JOBS.items():
    p = ROOT / rel
    text = p.read_text(encoding="utf-8")
    for old, new in pairs:
        n = text.count(old)
        if n != 1:
            raise SystemExit(f"[ABORT] {rel}: 期望唯一命中，实际 {n}：{old[:60]}")
        text = text.replace(old, new, 1)
    p.write_text(text, encoding="utf-8", newline="")
    print(f"  [OK] {rel}  {len(pairs)} 处")
print("done")
