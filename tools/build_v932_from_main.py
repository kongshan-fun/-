#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.31 -> V90.32 构建器（人物装备面板：全屏 + 卡片文字不半截）

基线：V90.31（字节哈希，按 CRLF 归一）

用户实测反馈（2026-10-20，附设备截图）：
  1. 装备界面覆盖整个界面，不再显示最上面的角色状态条
     （理由：装备界面里本来就显示气血/灵力具体数值）
  2. 装备详情这块「战力/攻击力」的文字显示有问题

实测结论：
  - `#panel-root` 在 `#game-middle` 里（#game-middle 只覆盖 124..597），
    所以给它设 `inset:0` 永远只到场景区，盖不住顶部 123px 的顶栏+状态条。
  - 把面板搬进新宿主会让 `#panel-root xxx` 那几百条 CSS 全部失效（实测变成裸文本）。
  因此采用**不动 DOM、只让顶部 HUD 让位**的办法：
    `#phone.in-character` 时隐藏 .topbar 与 #status，#game-middle 自然撑满，
    面板（本来就铺满 game-middle）于是从屏幕最上方开始。

另外装备卡：
  - 战力/词条行改成单行 + 省略号（原来可换行的长文本容易被卡片/滚动区切一半）
  - 卡片允许撑开（overflow:visible）、行高 118px 起、列表底部留 padding

三条硬断言：基线哈希 / 替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.31_战斗界面排布版.html"
OUT_NAME = "山野修仙记_V90.32_装备面板全屏版.html"
BASE_SHA = "E7FB99360C61054F266EBA8DF7F1C7ABCEC0AE0E35490E9DA819DFEBA0A7AFCC"

CSS = """
/* V90.32 人物装备面板：进人物时让顶部 HUD 让位，面板铺满整屏 */
#phone.in-character .topbar,#phone.in-character #status{display:none!important}
#phone.in-character #game-middle{padding-top:4px}
#panel-root .character-v92-item{padding:9px 10px;min-height:118px;overflow:visible}
#panel-root .character-v92-grid{grid-auto-rows:minmax(118px,max-content);padding-bottom:10px;scroll-padding-bottom:10px}
#panel-root .character-v92-item-delta,#panel-root .character-v92-item-stat{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.45}
#panel-root .character-v92-item strong{line-height:1.35}
"""

OLD_HEAD = "function renderPanel(){const root=$('panel-root');if(!panel){root.innerHTML='';return;}"
NEW_HEAD = ("function renderPanel(){const root=$('panel-root');"
            "$('phone').classList.toggle('in-character',panel==='character');"
            "if(!panel){root.innerHTML='';return;}")


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

    text = rep(text, "<title>山野修仙记 V90.31 · 战斗界面排布</title>",
               "<title>山野修仙记 V90.32 · 装备面板全屏</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.31'", "subtitle='人妖异途 · V90.32'", "副标题版本号")
    text = rep(text, "V90.31 · ${game.character.name}", "V90.32 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.31_本机飞升资质榜.json", "山野修仙记_V90.32_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.31：", "当前版本 V90.32：", "帮助页版本说明")

    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v932-character-cover\">" + CSS + "</style>\n</head>\n<body>",
               "注入装备面板样式")
    text = rep(text, OLD_HEAD, NEW_HEAD, "renderPanel 切换 in-character")

    for needle, what in (("v932-character-cover", "样式块"),
                         ("$('phone').classList.toggle('in-character'", "in-character 开关"),
                         ("#phone.in-character .topbar", "顶部 HUD 让位规则")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "样式 / 开关 / HUD 让位 齐全")

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
