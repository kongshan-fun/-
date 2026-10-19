#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.9 -> V90.10 构建器（界面密度与检索优化）

基线：冻结的 V90.9 发布文件（哈希校验），不读取已被改写的 index.html。
本版只改呈现层：图鉴分类折叠与成就折叠、炼制排序与采集指路、背包储物袋折叠与密度。
不修改：战斗数值、突破难度、存档结构、寿元/续命、储物袋规则、飞升结算。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.9_界面整合与境界指引优化版.html"
OUT_NAME = "山野修仙记_V90.10_界面密度与检索优化版.html"

BASE_SHA256 = "B728E687ADEE2B9AF03A3E762A4C530DA2DDC4F1681CA63EF1A56F643070458D"  # LF 归一化
BASE_SHA256_CRLF = "E524AD54909D3783FB59A446E1E1C3BD83253BA6D16ED36F6D4B3A47A908FC22"  # 工作区字节
BASE_BLOB = "8f53b5dcd19b75fd9d1bac4907e67f6fa820e115"

checks = []


def ok(label, detail=""):
    checks.append((label, detail))
    print(f"  [OK] {label}" + (f"  {detail}" if detail else ""))


def die(msg):
    raise SystemExit(f"\n[ABORT] {msg}")


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def blob(b):
    return hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()


def rep(text, old, new, label, expect=1):
    n = text.count(old)
    if n != expect:
        die(f"{label}: 期望 {expect} 次，实际 {n} 次")
    ok(label, f"{n} 处")
    return text.replace(old, new, expect)


def extract_fn(text, marker):
    i = text.find(marker)
    if i < 0:
        die(f"找不到 {marker}")
    if text.count(marker) != 1:
        die(f"{marker} 不唯一")
    depth, started = 0, False
    for k in range(i, len(text)):
        c = text[k]
        if c == "{":
            depth += 1
            started = True
        elif c == "}":
            depth -= 1
            if started and depth == 0:
                return text[i:k + 1]
    die(f"{marker} 未配平")


def main():
    print("V90.9 -> V90.10 构建开始\n")
    if not BASE.exists():
        die(f"缺少 V90.9 基线：{BASE}")
    raw = BASE.read_bytes()
    text = raw.decode("utf-8").replace("\r\n", "\n")
    if sha(text.encode()) != BASE_SHA256:
        die(f"V90.9 基线 SHA256 不符：{sha(text.encode())}")
    if blob(text.encode()) != BASE_BLOB:
        die(f"V90.9 基线 Git Blob 不符：{blob(text.encode())}")
    ok("V90.9 冻结基线校验", f"{len(raw)} B / blob {BASE_BLOB[:12]}…")
    # ---- 替换三个面板的渲染函数 ----
    for fn, fname, label in [
        ("function bookListBody(){", "v910-book.js", "图鉴列表（分类折叠 + 成就折叠）"),
        ("function craftBody(){", "v910-craft.js", "炼制（排序 + 采集指路）"),
        ("function packBody(){", "v910-pack.js", "背包（储物袋折叠 + 密度）"),
    ]:
        old = extract_fn(text, fn)
        new = (ROOT / "tools" / fname).read_text(encoding="utf-8").rstrip("\n")
        if not new.startswith(fn):
            die(f"{fname} 起始标记不符")
        if sha(new.encode()) == sha(old.encode()):
            die(f"{fname} 与基线相同")
        # 保留原有 data-a 动作，避免丢功能
        old_acts = set(re.findall(r'data-a="([a-z0-9\-]+)"', old))
        new_acts = set(re.findall(r'data-a="([a-z0-9\-]+)"', new))
        lost = old_acts - new_acts
        if lost:
            die(f"{label} 丢失动作：{sorted(lost)}")
        ok(label, f"{len(old)} -> {len(new)} 字符，动作 {len(old_acts)}→{len(new_acts)}")
        text = rep(text, old, new, f"替换 {label}")

    # ---- 版本号跟随 ----
    text = rep(text, "<title>山野修仙记 V90.9 · 界面整合与境界指引</title>",
               "<title>山野修仙记 V90.10 · 界面密度与检索优化</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.9'", "subtitle='人妖异途 · V90.10'", "入口副标题版本号")
    text = rep(text, "link.download='山野修仙记_V90.9_本机飞升资质榜.json'",
               "link.download='山野修仙记_V90.10_本机飞升资质榜.json'", "导出文件名版本号")
    text = rep(text, '<span class="v909-set-id">V90.9 · ${game.character.name}',
               '<span class="v909-set-id">V90.10 · ${game.character.name}', "设置页版本标识")
    text = rep(text,
               "当前版本 V90.9：设置页整合为六个分区；境界进阶指引与金丹雷劫说明已校正。",
               "当前版本 V90.10：图鉴改为分类折叠、成就折叠；炼制按可炼制优先并标注采集地点；背包储物袋可折叠。",
               "设置页版本说明")

    # ---- 注入密度样式 ----
    css = (ROOT / "tools" / "v910-density.css").read_text(encoding="utf-8").rstrip("\n")
    if "book-group" not in css:
        die("密度样式内容异常")
    style = '<style id="v910-ui-density">\n' + css + "\n</style>\n"
    text = rep(text, "</head>\n<body>", style + "</head>\n<body>", "注入 v910-ui-density 样式")

    # ---- 产物自检 ----
    for must in ["book-group", "book-rewards-fold", "craft-summary", "recipe-hint",
                 "storage-bag-fold", "progMatSource"]:
        if must not in text:
            die(f"产物缺少：{must}")
    ok("产物关键片段", "分类折叠 / 汇总条 / 采集指路 / 储物袋折叠")
    if text.count("v910-ui-density") != 1:
        die("样式块注入次数异常")

    # ---- 写出 ----
    out = text.replace("\n", "\r\n").encode("utf-8")
    RELEASES.mkdir(exist_ok=True)
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    lb = blob((ROOT / "index.html").read_bytes().decode("utf-8").replace("\r\n", "\n").encode("utf-8"))
    rb = blob((RELEASES / OUT_NAME).read_bytes().decode("utf-8").replace("\r\n", "\n").encode("utf-8"))
    if lb != rb:
        die("index.html 与发布文件 Blob 不一致")
    ok("产物一致性", "index.html == release")

    print("\n--- 写出完成 ---")
    print(f"  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out)}")
    print(f"  行数   : {len(text.splitlines())}")
    print(f"  SHA256 : {sha(out)}")
    print(f"  GitBlob: {lb}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
