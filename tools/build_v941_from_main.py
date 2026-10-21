#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.40 -> V90.41 构建器（面板全屏化 + 迷你资源条）

基线：V90.40（字节哈希，按 CRLF 归一）

方案 A（对用户方案的对照版）：
  1. 任何面板打开时都全屏：`#phone.in-page` 隐藏 .topbar 与 #status，
     #game-middle 自然撑满 → 面板从屏幕最上方开始（和人物装备同一套做法）
  2. 因为洞府/修炼/炼制这些页原本不显示资源，全屏后会丢信息，
     所以在面板标题行下面补一条 1 行 **迷你资源条**：
     气血 / 灵力 / 饱腹 / 饮水 / 寿元（10px，320 宽度自动省略）
  3. 人物装备仍保留原来的 in-character（它自带气血/灵力上限，不需要迷你条）

只动表现层；不动任何游戏逻辑、数值、存档结构。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.40_文案清理版.html"
OUT_NAME = "山野修仙记_V90.41_面板全屏版.html"
BASE_SHA = "549DA3AE01AB42AC2C314286F48643C1805488DDC0D61CCC7D3597B2569CEDC3"

CSS = """
/* V90.41 面板全屏：任何面板打开都让顶部 HUD 让位，标题行下补迷你资源条 */
#phone.in-page .topbar,#phone.in-page #status{display:none!important}
#phone.in-page #game-middle{padding-top:4px}
#phone.in-page #panel-root>.panel-overlay{padding:4px 6px calc(6px + env(safe-area-inset-bottom))}
#panel-root .panel-mini-bar{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;overflow:hidden;
  padding:4px 2px 5px;margin:0 0 4px;border-bottom:1px solid var(--line,#ddd);
  font-size:10px;line-height:1.3;color:#555;font-variant-numeric:tabular-nums;white-space:nowrap}
#panel-root .panel-mini-bar span{flex:none}
#panel-root .panel-mini-bar span:last-child{overflow:hidden;text-overflow:ellipsis}
#phone.in-page[data-narrow="1"] #panel-root .panel-mini-bar{gap:7px;font-size:9.5px}
@media (max-width:400px){
  #panel-root .panel-mini-bar{gap:6px;font-size:9px}
}
@media (max-width:340px){
  #panel-root .panel-mini-bar{font-size:9px;gap:6px}
}
"""

MINI_FN = r"""
/* V90.41 面板迷你资源条：全屏后替代顶部状态条，保证洞府/修炼等页面仍能看到关键数值 */
function panelMiniBar(){
 if(!game||!game.s||!game.character)return '';
 const s=game.s;
 return `<div class="panel-mini-bar"><span>气血 ${s.hp}/${s.maxHp}</span><span>${game.character.energy} ${s.spirit}/${s.maxSpirit}</span><span>饱腹 ${s.hunger}</span><span>饮水 ${s.water}</span><span>寿元 ${game.lifeYears.toFixed(1)}年</span></div>`;
}
"""

OLD_HEAD = "function renderPanel(){const root=$('panel-root');"
NEW_HEAD = MINI_FN.strip() + "\nfunction renderPanel(){const root=$('panel-root');"


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

    text = rep(text, "<title>山野修仙记 V90.40 · 文案清理</title>",
               "<title>山野修仙记 V90.41 · 面板全屏</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.40'", "subtitle='人妖异途 · V90.41'", "副标题版本号")
    text = rep(text, "V90.40 · ${game.character.name}", "V90.41 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.40_本机飞升资质榜.json", "山野修仙记_V90.41_本机飞升资质榜.json",
               "资质榜导出文件名")

    # 1) 样式
    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v941-panel-fullscreen\">" + CSS + "</style>\n</head>\n<body>",
               "注入全屏 + 迷你条样式")
    # 2) 迷你条函数
    text = rep(text, OLD_HEAD, NEW_HEAD, "插入 panelMiniBar()")
    # 3) 面板打开时切 in-page（任何面板）
    text = rep(text,
               "$('phone').classList.toggle('in-character',panel==='character');",
               "$('phone').classList.toggle('in-page',!!panel);"
               "$('phone').classList.toggle('in-character',panel==='character');",
               "任何面板全屏")
    # 4) 面板头下面插入迷你条（面板头以 </div> 结尾后紧跟 id=panel-body）
    text = rep(text,
               '<div id="panel-body" class="panel-body ${',
               '${panelMiniBar()}<div id="panel-body" class="panel-body ${',
               "标题行下插入迷你条")

    for needle, what in (("v941-panel-fullscreen", "样式块"),
                         ("function panelMiniBar(){", "迷你条函数"),
                         ("classList.toggle('in-page',!!panel)", "in-page 开关"),
                         ("${panelMiniBar()}<div id=\"panel-body\"", "迷你条插入位置")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "样式 / 函数 / 开关 / 插入位置 齐全")

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
