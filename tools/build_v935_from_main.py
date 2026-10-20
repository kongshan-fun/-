#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.34 -> V90.35 构建器（洞府设施卡：去掉"升级后…"说明行）

基线：V90.34（字节哈希，按 CRLF 归一）

用户判断（2026-10-20）：「升级后那几行字是不是可以去掉，这更像是攻略的描述」

确实：卡上那行 `升级后：开放四阶设施；高阶洞府休整效率提升…` 属于攻略文案，
不是当下决策需要的信息（当下要看的是：还差什么材料、多少分钟、几阶）。
去掉后卡片矮一截，短屏能把 6 栋一次看完。

改动：
  - 卡片模板里整段删除 `<p class="building-effect">…</p>`
  - 卡片 min-height 收紧（原来 184/124/104 三档由说明行撑着），padding 保持
  - 说明文字本身不丢：仍可从「教程」里查到；升级按钮的确认逻辑不变

三条硬断言：基线哈希 / 替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.34_战斗日志常显版.html"
OUT_NAME = "山野修仙记_V90.35_洞府卡片精简版.html"
BASE_SHA = "67052C8494AF83CB624110A905A62BCC15FC87A05B80E1D41881C04CBDCC097B"

OLD_EFFECT = ('<p class="building-effect">${esc(next?(level?\'升级后：\':\'建成：\')+next.effect'
              ':def.levels.at(-1).effect)}</p>')

CSS = """
/* V90.35 洞府设施卡：说明行去掉后收紧高度 */
#panel-root .building-card{min-height:0}
#panel-root .build-grid .building-card{min-height:0}
@media (max-width:400px){#panel-root .build-grid .building-card{min-height:0}}
#panel-root .building-card .building-cost{margin-top:2px}
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

    text = rep(text, "<title>山野修仙记 V90.34 · 战斗日志常显</title>",
               "<title>山野修仙记 V90.35 · 洞府卡片精简</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.34'", "subtitle='人妖异途 · V90.35'", "副标题版本号")
    text = rep(text, "V90.34 · ${game.character.name}", "V90.35 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.34_本机飞升资质榜.json", "山野修仙记_V90.35_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.34：", "当前版本 V90.35：", "帮助页版本说明")

    # 1) 删掉说明行
    text = rep(text, OLD_EFFECT, "", "删除「升级后…」说明行")
    # 2) 收紧高度
    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v935-camp-cards\">" + CSS + "</style>\n</head>\n<body>",
               "注入卡片收紧样式")

    if '<p class="building-effect">' in text:
        raise SystemExit("[ABORT] 说明行还在")
    ok("产物标记", "说明行已删除 / 收紧样式已注入")

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
