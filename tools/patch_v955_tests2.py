#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.55 第二批：v953 境系数夹具、v954 赋灵成本/等级夹具改用 level 与字面公式。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(rel, pairs):
    p = ROOT / rel
    t = p.read_text(encoding="utf-8")
    for old, new in pairs:
        n = t.count(old)
        if n != 1:
            raise SystemExit(f"[ABORT] {rel}: 命中 {n} 次：{old[:60]}")
        t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8", newline="")
    print(f"  [OK] {rel}")


patch("tests/v953_refine_rating.cjs", [
    ("[18, 1, 6, '1.60'], [18, 2, 7, '1.72'], [36, 8, 12, '2.32']",
     "[18, 0, 6, '1.60'], [19, 0, 7, '1.72'], [36, 0, 12, '2.32']"),
])

patch("tests/v954_spirit_affix.cjs", [
    # 等级夹具：19 级 = 境7（元婴初期）
    ("const mid = mk({ level: 18, major: 2 }), top = mk({ level: 36, major: 8 });",
     "const mid = mk({ level: 19, major: 2 }), top = mk({ level: 34, major: 0 });"),
    # 修为成本改回字面值 境基础×0.05，并删掉"实际池"对照组
    ("  /* 修为成本按「本境实际修为池×0.05」：境1(60)→3、境6(285)→14、渡劫(150)→8 */\n  ok([c1.xp, c6.xp, c12.xp].join(',') === '3,14,8', '修为 = 本境修为池×0.05（3/14/8）', [c1.xp, c6.xp, c12.xp].join('/'));",
     "  /* V90.55 36 段轴落地后回到定稿字面值：境基础×0.05 */\n  ok([c1.xp, c6.xp, c12.xp].join(',') === '40,449,1145', '修为 = 境基础×0.05（40/449/1145）', [c1.xp, c6.xp, c12.xp].join('/'));"),
    ("  /* 关键平衡约束：一次赋灵的修为 < 本境破境需求的 20%（否则会把赋灵变成墙） */\n  const pools = [low, mid, top].map((g) => [g.realmPoolXp, g.spiritCost({ id: 'p' }, 0).xp]);\n  ok(pools.every(([pool, c]) => c <= Math.max(3, pool * 0.2)), '赋灵修为 ≤ 本境修为池的 20%',\n    pools.map(([p, c]) => c + '/' + p).join(' '));\n  /* 定稿字面值（境基础×0.05）在最贵的元婴/渡劫档位远超一次破境，故未采用——留住证据防回退 */\n  ok(top.realmBaseXp > top.realmPoolXp * 10, '确认「境基础」与「实收 needDao」量级差 10 倍以上（故按实际池计）',\n    top.realmBaseXp + ' vs ' + top.realmPoolXp);",
     "  /* 关键平衡约束：一次赋灵的修为 ≤ 本段需求的 10%（否则会把赋灵变成墙） */\n  const rows2 = [low, mid, top].map((g) => [g.required, g.spiritCost({ id: 'p' }, 0).xp]);\n  ok(rows2.every(([need, c]) => c <= need * 0.1), '赋灵修为 ≤ 本段需求的 10%',\n    rows2.map(([need, c]) => c + '/' + need).join(' '));\n  ok(!/realmPoolXp/.test(html), 'V90.54 的临时口径 realmPoolXp 已删除');"),
    # 记账与失败块同样改用 19 级（境7）
    ("  const g = mk({ level: 18, major: 2 });\n  g.s.daoXp = 99999;\n  const w = gearAt(g, 4);",
     "  const g = mk({ level: 19, major: 2 });\n  g.s.daoXp = 99999;\n  const w = gearAt(g, 4);"),
    ("  const g = mk({ level: 18, major: 2 });\n  g.s.daoXp = 10;                        // 远不够 449",
     "  const g = mk({ level: 19, major: 2 });\n  g.s.daoXp = 10;                        // 远不够 449"),
    ("  const g = mk({ level: 18, major: 2 });\n  g.s.inv = { wood: 99, stone: 99, fiber: 99, ore: 99, dust: 99 };",
     "  const g = mk({ level: 19, major: 2 });\n  g.s.inv = { wood: 99, stone: 99, fiber: 99, ore: 99, dust: 99 };"),
])

print("done")
