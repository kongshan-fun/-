#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.11 -> V90.12 构建器（炼制 / 洞府 父子页扩展）

基线：冻结的 V90.11 发布文件（字节哈希校验）
沿用 V90.11 的父子页模式：
  - 炼制 8.48 屏 → 父页（品类入口 5 行）+ 子页 craft-cat（配方列表）
  - 洞府 1.59 屏 → 父页（名片/静修/快捷/灵田 + 设施入口）+ 子页 camp-build（建筑网格）
不修改：动作、配方、建筑规则、存档结构。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.11_修炼父子页版.html"
OUT_NAME = "山野修仙记_V90.12_炼制与洞府父子页版.html"

BASE_SHA = "48CE7799491BF541830475F8212BA23A942CFA902771E01325FAFB0E69A0E8DA"

checks = []


def ok(label, detail=""):
    checks.append(label)
    print(f"  [OK] {label}" + (f"  {detail}" if detail else ""))


def die(msg):
    raise SystemExit(f"\n[ABORT] {msg}")


def rep(text, old, new, label, expect=1):
    n = text.count(old)
    if n != expect:
        die(f"{label}: 期望 {expect} 次，实际 {n} 次")
    ok(label)
    return text.replace(old, new, expect)


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def extract_fn(text, marker):
    if text.count(marker) != 1:
        die(f"{marker} 出现 {text.count(marker)} 次")
    i = text.find(marker)
    d, st = 0, False
    for k in range(i, len(text)):
        c = text[k]
        if c == "{":
            d += 1; st = True
        elif c == "}":
            d -= 1
            if st and d == 0:
                return text[i:k + 1]
    die(f"{marker} 未配平")


def main():
    print("V90.11 -> V90.12 炼制 / 洞府父子页构建开始\n")
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    old_craft = extract_fn(text, "function craftBody(){")
    old_camp = extract_fn(text, "function campBody(){")
    mod = (ROOT / "tools" / "v912-panels.js").read_text(encoding="utf-8").rstrip("\n")
    for must in ("function craftBody", "function craftListBody", "function campBody",
                 "function campBuildBody", "function isListChild"):
        if must not in mod:
            die(f"模块缺少 {must}")

    acts = lambda t: set(re.findall(r'data-a="([a-z0-9\-]+)"', t))
    lost = (acts(old_craft) | acts(old_camp)) - acts(mod)
    if lost:
        die(f"动作丢失：{sorted(lost)}")
    ok("动作集合", f"{len(acts(old_craft) | acts(old_camp))} 个全部保留（新增 panel-step）")

    text = rep(text, old_craft, "", "移除旧 craftBody 占位")
    text = rep(text, old_camp, "", "移除旧 campBody 占位")

    # 把模块插到 isCultChild 定义之前
    anchor = "function isCultChild(p)"
    text = rep(text, anchor, mod + "\n\n" + anchor, "注入 V90.12 父子页模块")

    # 路由
    text = rep(text, "panel==='craft'?craftBody():",
               "panel==='craft'?craftBody():panel==='craft-cat'?craftListBody():", "路由：炼制子页")
    text = rep(text, "panel==='camp'?campBody():",
               "panel==='camp'?campBody():panel==='camp-build'?campBuildBody():", "路由：洞府子页")

    # 标题
    text = rep(text, "craft:'炼制'", "craft:'炼制','craft-cat':'炼制 · 配方'", "标题：炼制子页")
    text = rep(text, "camp:'洞府'", "camp:'洞府','camp-build':'洞府设施'", "标题：洞府子页")

    # 返回按钮
    old_back = "(panel==='warehouse'||panel==='cultivate')?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回洞府\">← 返回洞府</button>'"
    new_back = ("panel==='craft-cat'?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回炼制\">← 返回炼制</button>':"
                "panel==='camp-build'?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回洞府\">← 返回洞府</button>':"
                + old_back)
    text = rep(text, old_back, new_back, "子页头部返回按钮")

    # panel-back 处理（子页回父页）
    pb_old = "if(isCultChild(panel)){panel='cultivate';render();"
    pb_new = ("if(panel==='craft-cat'||panel==='camp-build'){panel=panel==='craft-cat'?'craft':'camp';render();"
              "if($('panel-body'))$('panel-body').scrollTop=0;return;}" + pb_old)
    text = rep(text, pb_old, pb_new, "panel-back 支持炼制/洞府子页")

    # panel-step 动作
    ps_old = "   if(a==='cult-step'){panel=b.dataset.name;render();"
    ps_new = ("   if(a==='panel-step'){if(b.dataset.cat)filter=b.dataset.cat;panel=b.dataset.name;render();"
              "if($('panel-body'))$('panel-body').scrollTop=0;return;}\n" + ps_old)
    text = rep(text, ps_old, ps_new, "新增 panel-step 跳转子页")

    # 版本号
    text = rep(text, "<title>山野修仙记 V90.11 · 修炼父子页</title>",
               "<title>山野修仙记 V90.12 · 炼制与洞府父子页</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.11'", "subtitle='人妖异途 · V90.12'", "副标题版本号")

    for must in ["craftListBody", "campBuildBody", "panel-step", "craft-cat", "camp-build"]:
        if must not in text:
            die(f"产物缺少：{must}")
    ok("产物关键片段")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print("\n--- 写出完成 ---")
    print(f"  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
