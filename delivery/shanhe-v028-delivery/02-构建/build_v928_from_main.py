#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.27 -> V90.28 构建器（洞府外框收紧 20px：390 档回到一屏）

基线：V90.27（字节哈希，按 CRLF 归一）

实测（V90.27）：
  390×844  洞府 1.03 屏（608 可视 / 626 内容）→ **连基准宽度都差 18px**
  360×640  洞府 1.51 屏

1.03 那一档只差 18px，属于"外框留白"而非内容量，收掉不伤可读性：
  .camp-summary  padding-bottom 12 → 9      (-3)
  .farm-strip    margin-bottom 9 → 6        (-3)
  .camp-build-title margin 10 0 6 → 7 0 4   (-5)
  .build-grid    gap 6 → 5（3 行 → 少 4px）  (-4)
  .building-card padding 7 → 6              （每行 -2，3 行 -6）
合计约 -21px → 390 落到 1.00；360 从 1.51 收到约 1.46（仍超，原因见 docs §7.5）

不动字号、不动卡片内文字（保持 V90.24 的"说明不被裁"契约）。
三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.27_主线窄屏收敛版.html"
OUT_NAME = "山野修仙记_V90.28_洞府外框收紧版.html"
BASE_SHA = "4DCD70BDFDF3C9D16F1475368D993D0A802FF45093D17CE205C944E147C64680"

CSS = """
/* V90.28 洞府外框收紧：只动留白与间距，不动字号与卡片内文字 */
#panel-root .camp-summary{padding-bottom:9px;margin-bottom:9px}
#panel-root .farm-strip{margin-bottom:6px}
#panel-root .camp-build-title{margin:7px 0 4px}
#panel-root .build-grid{gap:5px}
#panel-root .build-grid .building-card{padding:6px}
"""


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

    text = rep(text, "<title>山野修仙记 V90.27 · 主线窄屏收敛</title>",
               "<title>山野修仙记 V90.28 · 洞府外框收紧</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.27'", "subtitle='人妖异途 · V90.28'", "副标题版本号")
    text = rep(text, "V90.27 · ${game.character.name}", "V90.28 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.27_本机飞升资质榜.json", "山野修仙记_V90.28_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.27：", "当前版本 V90.28：", "帮助页版本说明")

    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v928-camp-frame\">" + CSS + "</style>\n</head>\n<body>",
               "注入洞府外框收紧样式")
    ok("注入检查", "v928-camp-frame 已就位")

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
