#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.55：把剩余硬编码修为产出点接到 xpRatio()。每条断言唯一命中，避免误改。"""
from pathlib import Path

P = Path(__file__).resolve().parents[1] / "index.html"
text = P.read_text(encoding="utf-8")

PAIRS = [
    ("message=this.loot(items,'秘境灵材');this.xp(3+z);",
     "message=this.loot(items,'秘境灵材');this.xp(this.xpRatio('main'));"),
    ("this.xp(2+z);message='机关伤害'+loss+'，领悟险境修为+'+(2+z);",
     "const g2=this.xpRatio('main');this.xp(g2);message='机关伤害'+loss+'，领悟险境修为+'+g2;"),
    ("else if(cfg.effect==='insight'){this.xp(6+z*2);",
     "else if(cfg.effect==='insight'){this.xp(this.xpRatio('main'));"),
    ("this.s.hp-=loss;this.xp(8+z);message='破解火纹，受伤'+loss+'，修为+'+(8+z);}",
     "this.s.hp-=loss;const g8=this.xpRatio('main');this.xp(g8);message='破解火纹，受伤'+loss+'，修为+'+g8;}"),
    ("if(index===8){this.xp(3+z);message+=' · 额外悟道';}",
     "if(index===8){this.xp(this.xpRatio('main'));message+=' · 额外悟道';}"),
    ("this.xp(8+z*2);this.manualAcquire('secret');",
     "this.xp(this.xpRatio('main'));this.manualAcquire('secret');"),
    ("if(delta>=3)this.xp(2);", "if(delta>=3)this.xp(this.xpRatio('chore'));"),
    ("this.s.flags.repaired=true;this.xp(10);",
     "this.s.flags.repaired=true;this.xp(this.xpRatio('main'));"),
    ("this.xp(10+this.s.zone*4);", "this.xp(this.xpRatio('main'));"),
    ("this.xp(3+this.s.zone);", "this.xp(this.xpRatio('main'));"),
]

for old, new in PAIRS:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"[ABORT] 期望唯一命中，实际 {n} 次：{old[:50]}")
    text = text.replace(old, new, 1)
    print(f"  [OK] {old[:46]}")

P.write_text(text, encoding="utf-8", newline="")
print("done")
