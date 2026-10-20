#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.14 -> V90.15 构建器（窄屏适配 + 行记空态）

1. 注入窄屏媒体查询：入口行在 320/360 宽度下压缩，避免溢出
2. 行记无记录时显示空态文案（原来渲染成空白）
不改任何逻辑、数值、存档结构。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.14_入口去重版.html"
OUT_NAME = "山野修仙记_V90.15_窄屏与空态修正版.html"
BASE_SHA = "B1B0023CCBCF44D0320FF686FF572172490369AC9AA927C3116EBFA98F9B5F94"

checks = []


def ok(l, d=""):
    checks.append(l); print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def die(m):
    raise SystemExit(f"\n[ABORT] {m}")


def rep(t, old, new, label, expect=1):
    n = t.count(old)
    if n != expect:
        die(f"{label}: 期望 {expect} 次，实际 {n}")
    ok(label); return t.replace(old, new, expect)


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def main():
    print("V90.14 -> V90.15 窄屏与空态修正开始\n")
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    # 1. 行记空态
    logs_old = ("game.s.logs.map(l=>`<div class=\"history ${esc(l.tone)}\">"
                "<time>${esc(l.time)}</time>${esc(l.msg)}</div>`).join('')")
    logs_new = (":game.s.logs.length?game.s.logs.map(l=>`<div class=\"history ${esc(l.tone)}\">"
                "<time>${esc(l.time)}</time>${esc(l.msg)}</div>`).join('')"
                ":'<p class=\"muted\">暂无记录。采集、战斗、突破与破境都会记在这里。</p>'")
    # 原串前面是 panel==='quest-world'?worldPage(): ，需要把末尾分号前的表达式包住
    text = rep(text, "panel==='quest-world'?worldPage():" + logs_old,
               "panel==='quest-world'?worldPage()" + logs_new, "行记空态")
    ok("行记渲染", "空数组时显示占位文案")

    # 2. 窄屏样式
    css = (ROOT / "tools" / "v915-narrow.css").read_text(encoding="utf-8").rstrip("\n")
    text = rep(text, "</head>\n<body>",
               '<style id="v915-narrow">\n' + css + "\n</style>\n</head>\n<body>",
               "注入窄屏样式")
    if "@media (max-width: 340px)" not in text:
        die("窄屏样式未生效")

    # 版本号
    text = rep(text, "<title>山野修仙记 V90.14 · 入口去重版</title>",
               "<title>山野修仙记 V90.15 · 窄屏与空态修正</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.14'", "subtitle='人妖异途 · V90.15'", "副标题版本号")
    text = rep(text, 'V90.14 · ${game.character.name}', 'V90.15 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.14_本机飞升资质榜.json", "山野修仙记_V90.15_本机飞升资质榜.json",
               "资质榜导出文件名")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
