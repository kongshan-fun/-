#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.15 -> V90.16 A/B/C 三个窄屏方案（纯 CSS，便于并排对比）

A 顶栏紧凑        ：窄屏压缩 .topbar 与 #status 的垂直占用（对所有面板一次性增益）
B 顶栏紧凑 + 面板紧：A 的基础上再压入口行/配方/建筑卡
C 仅面板紧        ：不碰顶栏，只压面板内部密度

产物：releases/山野修仙记_V90.16_{A,B,C}_*.html
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.15_窄屏与空态修正版.html"
BASE_SHA = "978EAF8E332131A8BA6CE9ACF25C51F9E2A44913018DEEF3BCD1A34D0C5007A8"

CHROME = """
/* A: 窄屏顶栏与状态条压缩 */
@media (max-width: 400px){
  .topbar{padding:3px 10px;min-height:0}
  .topbar .wordmark{font-size:14px;line-height:1.25}
  .topbar .wordmark span{display:none}
  .topbar .top-buttons button{font-size:11px;padding:2px 7px;min-height:26px}
  #status{padding:3px 10px;font-size:11px;line-height:1.28}
  #status *{line-height:1.28}
  #status .bar,#status .meter{height:3px}
}
"""

PANEL = """
/* B/C: 面板内部再压一档 */
@media (max-width: 400px){
  #panel-root .cult-nav-row{min-height:40px;padding:5px 9px}
  #panel-root .cult-nav-main b{font-size:12px}
  #panel-root .cult-nav-main small{font-size:9.5px;line-height:1.26}
  #panel-root .cult-nav{gap:5px}
  #panel-root .build-grid .building-card{min-height:104px;padding:6px}
  #panel-root .building-card .building-effect{max-height:26px;font-size:9px}
  #panel-root .building-card .building-cost{min-height:18px;font-size:9px}
  #panel-root .recipe{padding:5px 8px;margin-bottom:4px}
  #panel-root .recipe .recipe-cost{font-size:9px}
  #panel-root .recipe .recipe-hint{display:none}
  #panel-root h3{margin:7px 0 4px}
}
"""

VARIANTS = {
    "A": ("顶栏紧凑", CHROME, "顶栏与状态条压缩，面板不动"),
    "B": ("顶栏紧凑+面板紧", CHROME + PANEL, "顶栏压缩 + 面板内部再压"),
    "C": ("仅面板紧", PANEL, "顶栏不动，只压面板内部"),
}


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def main():
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(raw)}")
    base = raw.decode("utf-8").replace("\r\n", "\n")
    print(f"基线 V90.15 {len(raw):,} B 校验通过\n")

    for key, (name, css, desc) in VARIANTS.items():
        t = base
        t = t.replace("<title>山野修仙记 V90.15 · 窄屏与空态修正</title>",
                      f"<title>山野修仙记 V90.16{key} · {name}</title>", 1)
        t = t.replace("subtitle='人妖异途 · V90.15'", f"subtitle='人妖异途 · V90.16{key}'", 1)
        t = t.replace('V90.15 · ${game.character.name}', f'V90.16{key} · ${{game.character.name}}', 1)
        t = t.replace("</head>\n<body>",
                      f'<style id="v916{key}">\n{css}\n</style>\n</head>\n<body>', 1)
        if f'v916{key}' not in t:
            raise SystemExit(f"[ABORT] {key} 样式未注入")
        out = t.replace("\n", "\r\n").encode("utf-8")
        f = RELEASES / f"山野修仙记_V90.16{key}_{name}.html"
        f.write_bytes(out)
        print(f"  [{key}] {f.name}")
        print(f"      {desc}")
        print(f"      {len(out):,} B  SHA256 {sha(out)[:16]}…")


if __name__ == "__main__":
    main()
