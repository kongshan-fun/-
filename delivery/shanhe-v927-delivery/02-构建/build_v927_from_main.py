#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.26 -> V90.27 构建器（360×640：主线父页行高收敛）

基线：V90.26（字节哈希校验）
实测：360×640 主线 507px / 可视 413px = 1.23 屏。组成：
  q3-title 32.5 + q3-main 245.9 + 见闻入口 59 + 两个子页入口 63.5×2
其中入口行 min-height:62px、见闻 min-height:59px 是给大屏留的尺寸，
在 360 这一档明显偏松。

改法：只对 `max-width:400px` 收紧入口行/见闻/任务卡内边距（**不动字号下限、不裁文字**），
390 及以上的观感不变。这是行高收敛，不是压像素压到不可读。
三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.26_窄屏父页收敛版.html"
OUT_NAME = "山野修仙记_V90.27_主线窄屏收敛版.html"
BASE_SHA = "01E4B8E4001D7D9B166731F66AA22770F790ABBD528641F167622A1FC4AE2A39"

CSS = """
/* V90.27 主线父页在 ≤400px 的行高收敛（只收行高，不改字号下限、不裁文字） */
@media (max-width: 400px){
  #panel-root .q4-links{gap:5px}
  #panel-root .q4-link{min-height:42px;padding:5px 10px;gap:6px}
  #panel-root .q4-link span:first-child{gap:2px}
  #panel-root .q4-link strong{font-size:12px}
  #panel-root .q4-link small{font-size:9.5px}
  #panel-root .q3 .world-journal-entry{min-height:42px!important;padding:5px 10px!important;margin:0!important}
  #panel-root .q3-actions{margin-top:5px}
  #panel-root .q3-actions .btn{min-height:33px;font-size:12px}
  #panel-root .q3-main{padding:7px}
  #panel-root .q3-main>p{margin-bottom:4px!important;line-height:1.55!important}
  #panel-root .q3-place{padding:2px 0}
  #panel-root .q3-note{padding:1px 0}
  #panel-root .q3-needs{margin:3px 0 0}
  #panel-root .q3-needs span{padding:3px 6px}
  #panel-root .q3-title{padding:5px 7px}
  #panel-root .q3{gap:4px}
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
    ok(label, f"{n} 处")
    return t.replace(old, new, expect)


def actions(t):
    return set(re.findall(r'data-a="([a-z0-9-]+)"', t))


def eol_of(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw[:4000] else "\n"


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    before_actions = actions(text)
    ok("基线动作集合", f"{len(before_actions)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.26 · 窄屏父页收敛</title>",
               "<title>山野修仙记 V90.27 · 主线窄屏收敛</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.26'", "subtitle='人妖异途 · V90.27'", "副标题版本号")
    text = rep(text, 'V90.26 · ${game.character.name}', 'V90.27 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.26_本机飞升资质榜.json", "山野修仙记_V90.27_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.26：", "当前版本 V90.27：", "帮助页版本说明")

    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v927-quest-narrow\">" + CSS + "</style>\n</head>\n<body>",
               "注入主线窄屏行高")

    if "v927-quest-narrow" not in text:
        raise SystemExit("[ABORT] 样式未注入")
    ok("注入检查", "v927-quest-narrow 已就位")

    after_actions = actions(text)
    if after_actions != before_actions:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after_actions ^ before_actions)}")
    ok("动作集合不变", f"{len(after_actions)} 个")

    eol = eol_of(raw)
    out = text.replace("\n", eol).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", f"index.html == release（行尾 {eol.encode('unicode_escape').decode()}）")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
