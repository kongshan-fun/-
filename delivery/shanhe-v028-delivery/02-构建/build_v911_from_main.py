#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.10 -> V90.11 构建器（修炼面板父子级重构）

基线：冻结的 V90.10 发布文件（字节哈希校验）
改动：
  1. cultivateBody 拆为父页 + 三个子页（破境条件 / 境界法门 / 休整）
  2. 面板路由、标题表、返回按钮、panel-back 处理接入子页
  3. 注入列表式入口样式
不修改：任何动作、规则、数值、存档结构；所有原有 data-a 全部保留。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.10_界面密度与检索优化版.html"
OUT_NAME = "山野修仙记_V90.11_修炼父子页版.html"

BASE_SHA = "FC024760C3D0FF710ADB2D49D51A84EC3738B3B3F3D8DED77FB227DCE3731AC0"

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
    i = text.find(marker)
    if i < 0:
        die(f"找不到 {marker}")
    if text.count(marker) != 1:
        die(f"{marker} 不唯一")
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
    print("V90.10 -> V90.11 修炼父子页构建开始\n")
    if not BASE.exists():
        die(f"缺少基线：{BASE}")
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    # ---- 1. 替换 cultivateBody，并新增三个子页函数 ----
    old_body = extract_fn(text, "function cultivateBody(){")
    new_src = (ROOT / "tools" / "v911-cultivate.js").read_text(encoding="utf-8").rstrip("\n")
    if "function isCultChild" not in new_src or "function cultivateRestBody" not in new_src:
        die("v911-cultivate.js 内容不完整")

    # 动作集合不得减少
    acts = lambda t: set(re.findall(r'data-a="([a-z0-9\-]+)"', t))
    lost = acts(old_body) - acts(new_src)
    if lost:
        die(f"动作丢失：{sorted(lost)}")
    ok("动作集合", f"{len(acts(old_body))} 个全部保留（新增 cult-step）")

    text = rep(text, old_body, new_src, "替换 cultivateBody 为父子页结构")

    # ---- 2. 面板正文路由 ----
    route_old = "panel==='cultivate'?cultivateBody():"
    route_new = ("panel==='cultivate'?cultivateBody():isCultChild(panel)?"
                 "(panel==='cultivate-trial'?cultivateTrialBody():"
                 "panel==='cultivate-art'?cultivateArtBody():cultivateRestBody()):")
    text = rep(text, route_old, route_new, "面板正文路由接入三个子页")

    # ---- 3. 标题表 ----
    title_old = "cultivate:'洞府 · 修炼'"
    title_new = ("'cultivate-trial':'破境条件','cultivate-art':'境界法门','cultivate-rest':'休整'")
    text = rep(text, title_old, title_old + "," + title_new, "面板标题表新增子页")

    # ---- 4. 返回按钮：子页显示「← 返回修炼」 ----
    back_old = "(panel==='warehouse'||panel==='cultivate')?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回洞府\">← 返回洞府</button>'"
    back_new = ("isCultChild(panel)?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回修炼\">← 返回修炼</button>':"
                +(back_old))
    text = rep(text, back_old, back_new, "子页头部接入返回按钮")

    # ---- 5. panel-back 处理：子页回父页 ----
    pb_old = "if(a==='panel-back'||a==='close-panel'){if(isQuestChild(panel)){leaveQuestChild();return;}"
    pb_new = (pb_old + "if(isCultChild(panel)){panel='cultivate';render();"
              "if($('panel-body'))$('panel-body').scrollTop=0;return;}")
    text = rep(text, pb_old, pb_new, "panel-back 支持子页返回父页")

    # ---- 6. cult-step 动作：进入子页 ----
    step_old = "if(a==='panel'){openPanel(b.dataset.name);return;}"
    step_new = ("if(a==='panel'){openPanel(b.dataset.name);return;}\n"
                "   if(a==='cult-step'){panel=b.dataset.name;render();"
                "if($('panel-body'))$('panel-body').scrollTop=0;return;}")
    text = rep(text, step_old, step_new, "新增 cult-step 跳转子页")

    # ---- 7. 版本号 ----
    text = rep(text, "<title>山野修仙记 V90.10 · 界面密度与检索优化</title>",
               "<title>山野修仙记 V90.11 · 修炼父子页</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.10'", "subtitle='人妖异途 · V90.11'", "副标题版本号")

    # ---- 8. 样式 ----
    css = (ROOT / "tools" / "v911-hierarchy.css").read_text(encoding="utf-8").rstrip("\n")
    style = '<style id="v911-cultivate-hierarchy">\n' + css + "\n</style>\n"
    text = rep(text, "</head>\n<body>", style + "</head>\n<body>", "注入父子页样式")

    # ---- 产物自检 ----
    for must in ["isCultChild", "cultivateTrialBody", "cultivateArtBody",
                 "cultivateRestBody", "cult-nav-row", "cult-step"]:
        if must not in text:
            die(f"产物缺少：{must}")
    ok("产物关键片段", "父子页函数 + 入口行 + 跳转动作")

    out = text.replace("\n", "\r\n").encode("utf-8")
    RELEASES.mkdir(exist_ok=True)
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    lb = hashlib.sha1(b"blob " + str(len(text.encode())).encode() + b"\0" + text.encode()).hexdigest()
    ok("产物一致性", "index.html == release")

    print("\n--- 写出完成 ---")
    print(f"  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  行数   : {len(text.splitlines())}")
    print(f"  SHA256 : {sha(out)}")
    print(f"  GitBlob: {lb}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
