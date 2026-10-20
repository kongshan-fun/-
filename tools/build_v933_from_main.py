#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.32 -> V90.33 构建器（战斗界面在长屏手机上的排版修正）

基线：V90.32（字节哈希，按 CRLF 归一）

用户实测（2026-10-20，837×1890 设备截图，约 390×880 CSS 像素）：
  战斗界面顶上是大半屏空白，敌方名字和血条被压在这块空白卡的**底部**，
  看着像"卡里没内容"；底部我方卡片最后一行贴住了屏幕底边。

原因（我上一版自己埋的）：
  V90.31 为了让血条"占更大空间"，写了
      .cb-foe{flex:1 1 auto; justify-content:flex-end}
  日志一收起就没有别的元素吃剩余高度，于是敌方面板把整块空白全吞了，
  而内容对齐到底部 —— 屏幕越高（2.26 这种长屏），空白越大。
  测试只跑了 320×568 / 360×640 / 390×844，没有更长的视口，所以没抓到。

改动：
  A. 敌方面板不再拉伸：`.cb-foe{flex:0 0 auto;justify-content:flex-start}`（内容高度，贴顶）
  B. 空白留在日志与技能之间（纯背景，不再是一张空框）
  C. 战斗层补安全区内边距（底部不再贴边）
  D. 日志摘要文案：「战斗日志 · 最近 N 条」（原来"12 条"容易被当成打了 12 回合）
  E. 测试增加 390×880 长屏视口
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.32_装备面板全屏版.html"
OUT_NAME = "山野修仙记_V90.33_战斗界面长屏修正版.html"
BASE_SHA = "D30C5DADFB85201318FF541FAD09723D5C822F1B68FA98D9F66D58CB5C7D6005"

CSS = """
/* V90.33 战斗界面：敌方面板不再吞掉整块空白，底部留安全区 */
.combat-root{padding:8px 8px calc(8px + env(safe-area-inset-bottom))}
.cb-foe{flex:0 0 auto!important;justify-content:flex-start!important}
.cb-log-wrap{flex:0 0 auto}
.cb-skills{margin-top:auto}
.cb-self{flex:0 0 auto;margin-bottom:0}
@media (min-height:800px){.cb-foe{padding:10px 11px}.cb-foe .cb-bar{height:26px}}
"""

OLD_TAG = '${lines.length} 条</span>'
NEW_TAG = '${lines.length?`· 最近 ${lines.length} 条`:""}</span>'


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
    ok("基线动作集合", f"{len(before)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.32 · 装备面板全屏</title>",
               "<title>山野修仙记 V90.33 · 战斗界面长屏修正</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.32'", "subtitle='人妖异途 · V90.33'", "副标题版本号")
    text = rep(text, "V90.32 · ${game.character.name}", "V90.33 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.32_本机飞升资质榜.json", "山野修仙记_V90.33_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.32：", "当前版本 V90.33：", "帮助页版本说明")

    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v933-combat-long\">" + CSS + "</style>\n</head>\n<body>",
               "注入长屏战斗样式")
    text = rep(text, "战斗日志 ${lines.length} 条</span>",
               "战斗日志${lines.length?` · 最近 ${lines.length} 条`:''}</span>", "日志摘要文案")

    for needle, what in (("v933-combat-long", "样式块"),
                         ("flex:0 0 auto!important;justify-content:flex-start!important", "敌方不拉伸"),
                         ("env(safe-area-inset-bottom)", "底部安全区")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "样式 / 不拉伸 / 安全区 齐全")

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
