#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.15 -> V90.16 构建器（窄屏面板密度，C 方案定案）

基线：V90.15（字节哈希校验）
内容：仅压缩窄屏下的面板内部密度（入口行 / 建筑卡 / 配方卡 / 小标题）。
      不触碰顶栏与状态条——V90.16A/B 的顶栏压缩会把资源条压坏且零收益，已废弃。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.15_窄屏与空态修正版.html"
OUT_NAME = "山野修仙记_V90.16_窄屏面板密度版.html"
BASE_SHA = "978EAF8E332131A8BA6CE9ACF25C51F9E2A44913018DEEF3BCD1A34D0C5007A8"

PANEL_CSS = """
/* V90.16 窄屏面板密度：只压面板内部，不碰顶栏与状态条 */
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


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label, expect=1):
    n = t.count(old)
    if n != expect:
        raise SystemExit(f"[ABORT] {label}: 期望 {expect} 次，实际 {n}")
    ok(label)
    return t.replace(old, new, expect)


def main():
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    # 断言：本次注入的样式绝不触碰状态条（基线自带 #status 规则属正常）
    if "#status" in PANEL_CSS:
        raise SystemExit("[ABORT] 注入样式里出现 #status 规则")

    text = rep(text, "<title>山野修仙记 V90.15 · 窄屏与空态修正</title>",
               "<title>山野修仙记 V90.16 · 窄屏面板密度</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.15'", "subtitle='人妖异途 · V90.16'", "副标题版本号")
    text = rep(text, 'V90.15 · ${game.character.name}', 'V90.16 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.15_本机飞升资质榜.json", "山野修仙记_V90.16_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "</head>\n<body>",
               f'<style id="v916-panel-density">\n{PANEL_CSS}\n</style>\n</head>\n<body>',
               "注入窄屏面板密度样式")

    injected = text.split('<style id="v916-panel-density">')[1].split('</style>')[0]
    if "#status" in injected:
        raise SystemExit("[ABORT] 注入块误含 #status 规则")
    ok("未触碰顶栏", "注入块内无 #status 规则")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
