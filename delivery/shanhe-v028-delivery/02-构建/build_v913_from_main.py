#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.12 -> V90.13 构建器（设置父子页）

基线：冻结的 V90.12 发布文件（字节哈希校验）
按「一页只放同一类内容」的原则，把设置的六个不同类型分区
改为父页入口 + 六个子页；不新增下拉/折叠，不改任何设置项与动作。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.12_炼制与洞府父子页版.html"
OUT_NAME = "山野修仙记_V90.13_设置父子页版.html"

BASE_SHA = "4C65032E69ECDA85B19D1DE414D3B90642E7D677FE3A71ACC16FFE44B186D13B"

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
    print("V90.12 -> V90.13 设置父子页构建开始\n")
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    old = extract_fn(text, "function settingsBody(){")
    mod = (ROOT / "tools" / "v913-settings.js").read_text(encoding="utf-8").rstrip("\n")
    for need in ("function isSetChild", "function settingsBody", "function settingsChildBody"):
        if need not in mod:
            die(f"模块缺少 {need}")

    acts = lambda t: set(re.findall(r'data-a="([a-z0-9\-]+)"', t))
    lost = acts(old) - acts(mod)
    if lost:
        die(f"动作丢失：{sorted(lost)}")
    ok("动作集合", f"{len(acts(old))} 个全部保留（新增 panel-step）")

    text = rep(text, old, mod, "替换 settingsBody 为父子页结构")

    # 路由：插在 settings 分支之前
    text = rep(text, "panel==='settings'?settingsBody():",
               "isSetChild(panel)?settingsChildBody():panel==='settings'?settingsBody():",
               "路由：设置子页")

    # 标题
    text = rep(text, "settings:'设置'",
               "settings:'设置','set-save':'存档与备份','set-life':'修行状态与寿元',"
               "'set-char':'角色与档案','set-visual':'视觉与体验',"
               "'set-help':'帮助与记录','set-reset':'重新修行'",
               "标题：六个设置子页")

    # 返回按钮
    back_old = "isCultChild(panel)?'<button class=\"panel-back\""
    back_new = ("isSetChild(panel)?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回设置\">← 返回设置</button>':"
                + back_old)
    text = rep(text, back_old, back_new, "子页头部返回按钮")

    # panel-back：设置子页回设置父页
    pb_old = "if(panel==='craft-tier'){"
    pb_new = ("if(isSetChild(panel)){panel='settings';render();"
              "if($('panel-body'))$('panel-body').scrollTop=0;return;}\n" + pb_old)
    text = rep(text, pb_old, pb_new, "panel-back 支持设置子页")

    # 版本号
    text = rep(text, "<title>山野修仙记 V90.12 · 炼制与洞府父子页</title>",
               "<title>山野修仙记 V90.13 · 设置父子页</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.12'", "subtitle='人妖异途 · V90.13'", "副标题版本号")

    for must in ["isSetChild", "settingsChildBody", "set-save", "set-reset"]:
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
