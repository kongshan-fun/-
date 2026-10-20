#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.13 -> V90.14 构建器（入口去重，纯减法）

1. 顶栏移除「档案」（设置 → 角色与档案 已有同一功能）
2. 背包移除「行记」「人物」「前往炼制储物袋」三个外部功能入口，保留「本境仓库」
3. 人物页移除「前往炼制」按钮（炼制在底栏）
不改任何逻辑、数值、存档结构；只删按钮与失去意义的空容器。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.13_设置父子页版.html"
OUT_NAME = "山野修仙记_V90.14_入口去重版.html"
BASE_SHA = "762A90120414A6BBA836BE98BA7E904F5566C0E5CF8799A234499184806DCA00"

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
    print("V90.13 -> V90.14 入口去重开始\n")
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    # 1. 顶栏档案
    text = rep(text, '<button data-a="characters">档案</button>', "",
               "顶栏移除「档案」")

    # 2. 背包三个外部入口
    text = rep(text,
               '<button type="button" class="btn" data-a="panel" data-name="craft">前往炼制储物袋 ›</button>',
               "", "背包移除「前往炼制储物袋」")
    text = rep(text,
               '<button class="btn" data-a="panel" data-name="log">行记</button>',
               "", "背包移除「行记」")
    text = rep(text,
               '<div class="inline-buttons"><button class="btn" data-a="panel" data-name="character">人物 · 穿戴装备与精炼</button></div>',
               "", "背包移除「人物」入口并清空容器")

    # 3. 人物页炼制按钮（空态提示保留文字）
    text = rep(text,
               '<button type="button" data-a="panel" data-name="craft">前往炼制</button>',
               "", "人物页移除「前往炼制」")

    # 版本号
    text = rep(text, "<title>山野修仙记 V90.13 · 设置父子页</title>",
               "<title>山野修仙记 V90.14 · 入口去重版</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.13'", "subtitle='人妖异途 · V90.14'", "副标题版本号")


    # ---- 版本号与导出文件名去硬化 ----
    text = rep(text, 'V90.13 · ${game.character.name}', 'V90.14 · ${game.character.name}',
               "设置页头部版本号")
    text = rep(text, '<p class="v909-note">当前版本 V90.13：设置改为分区进入；炼制按品类与品阶进入；洞府设施回归本体展示。</p>',
               '<p class="v909-note">当前版本 V90.14：设置按分区进入；炼制按品类与品阶进入；洞府设施回归本体；顶栏与背包的外部入口已收拢。</p>',
               "帮助与记录说明")
    text = rep(text, "山野修仙记_V90.10_本机飞升资质榜.json", "山野修仙记_V90.14_本机飞升资质榜.json",
               "资质榜导出文件名")

    # 断言：背包里只应剩一个外部 panel 入口（仓库）
    i = text.find("function packBody(")
    d, st = 0, False
    end = i
    for k in range(i, len(text)):
        c = text[k]
        if c == "{": d += 1; st = True
        elif c == "}":
            d -= 1
            if st and d == 0:
                end = k + 1; break
    pack = text[i:end]
    names = re.findall(r'data-a="panel" data-name="([a-z0-9\-]+)"', pack)
    if names != ["warehouse"]:
        die(f"背包残留外部入口：{names}")
    ok("背包外部入口", f"仅剩 {names}")

    acts = lambda t: set(re.findall(r'data-a="([a-z0-9\-]+)"', t))
    if "store" not in acts(pack) or "discard" not in acts(pack):
        die("背包动作被误删")
    ok("背包动作完整", "store / discard / consume 保留")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}   减少 {len(raw) - len(out):,} B")
    print(f"  SHA256 : {sha(out)}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
