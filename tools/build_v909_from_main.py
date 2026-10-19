#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.8 -> V90.9 构建器（版本化后处理）

设计原则（任务 H）
  1. 基线是**冻结的 V90.8 发布文件**，不是 index.html —— 因此可重复生成，
     不会因为 index.html 已被改成 V90.9 而覆盖或污染历史版本。
  2. 每一步替换都断言唯一命中；任何一处不符立即中止，绝不产出半成品。
  3. 通读 LF 归一化文本，写出统一转 CRLF，与原仓库一致。
  4. 写出后比对 index.html 与发布文件的 Git Blob，二者必须一致。

本轮改动范围
  A. 设置界面六分区重排（布局与层级）
  C. 修炼面板 / 雷劫 / 问心 三处接入统一的阶段成长指引
  D. 金丹雷劫：移除写死的「结丹雷蛟已伏」，改为按真实存档呈现六种状态
  E. 元婴问心复用同一套指引
  不修改：战斗数值、突破难度、存档结构、寿元机制、储物袋、飞升结算。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE_FILE = RELEASES / "山野修仙记_V90.8_五阶洞府与高阶炼制版.html"
OUT_NAME = "山野修仙记_V90.9_界面整合与境界指引优化版.html"

BASE_LF_SHA256 = "5993611AC42248383C4485F5BA99B726B2BDB5728F1FF52113ECF32D4F19B08E"
BASE_BLOB = "c18964dab7d5549688b2acd83ba707e3f02e9c5b"

checks = []


def ok(label, detail=""):
    checks.append((label, detail))
    print(f"  [OK] {label}" + (f"  {detail}" if detail else ""))


def die(msg):
    raise SystemExit(f"\n[ABORT] {msg}")


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest().upper()


def blob(b: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()


def rep(text, old, new, label, expect=1):
    n = text.count(old)
    if n != expect:
        die(f"{label}: 期望命中 {expect} 次，实际 {n} 次")
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
    die(f"{marker} 花括号未配平")


def data_actions(html):
    return sorted(set(re.findall(r'data-a="([a-z0-9\-]+)"', html)))


# ---------------- D1：雷劫引导首段改为按真实存档生成 ----------------
TRIAL_INTRO_JS = (
    "const trialIntro=!s.ritual[5]?"
    "`丹霞问道坛尚未完成，雷劫之门未启。先回山门完成本境的问道仪式，再回此地应劫。`:"
    "!s.cleared[5]?"
    "`丹霞问道坛已完成，但结丹雷蛟仍在渊中。击败它之后，雷劫才会真正显形。`:"
    "state.complete?"
    "`三重雷劫已渡，丹气凝实。回到修炼界面完成正式破境。`:"
    "state.started?"
    "`雷劫已启，劫云笼罩丹田。此劫分三重，可退出休整，进度随本档保存。`:"
    "`问道坛与结丹雷蛟皆已了却，余劫仍在丹田。此劫分三重，不再另设一只必须击败的 Boss。`;"
)

FIXED_COPY = (
    "<p>结丹雷蛟已伏，余劫却仍在丹田。此劫分三重，不再另设一只必须击败的 Boss。"
    "错误应对可能重伤折寿；你也可以返回洞府休息后再继续。</p>"
)


def main():
    print("V90.8 -> V90.9 构建开始\n")
    if not BASE_FILE.exists():
        die(f"缺少冻结基线：{BASE_FILE}")

    raw0 = BASE_FILE.read_bytes()
    text = raw0.decode("utf-8").replace("\r\n", "\n")
    # 注意：Git blob 存的是 clean 过滤器之后（LF）的内容，不能直接用工作区 CRLF 字节算
    if blob(text.encode()) != BASE_BLOB:
        die(f"冻结基线 Git Blob 不符：{blob(text.encode())}")
    if sha(text.encode()) != BASE_LF_SHA256:
        die(f"冻结基线 LF SHA256 不符：{sha(text.encode())}")
    ok("冻结基线校验", f"V90.8 / {len(raw0)} B / blob {BASE_BLOB[:12]}…")

    # ---- A. 设置界面六分区 ----
    old_body = extract_fn(text, "function settingsBody(){")
    new_body = (ROOT / "tools" / "v909-settings-body.js").read_text(encoding="utf-8").rstrip("\n")
    lost = [a for a in data_actions(old_body) if a not in data_actions(new_body)]
    if lost:
        die(f"设置页丢失按钮：{lost}")
    text = rep(text, old_body, new_body, "A. 替换 settingsBody（六分区）")

    # ---- 注入指引模块（必须早于被引用的函数定义） ----
    prog = (ROOT / "tools" / "v909-progression.js").read_text(encoding="utf-8").rstrip("\n")
    text = rep(text, "function tribulationBody(){",
               prog + "\nfunction tribulationBody(){", "注入阶段成长指引模块")

    # ---- D1. 雷劫首段文案改为按真实状态生成 ----
    anchor_5464 = (" const s=game.s,state=game.coreTrial,role=s.character==='demon',"
                   "ready=game.coreTrialReason();")
    text = rep(text, anchor_5464, anchor_5464 + "\n " + TRIAL_INTRO_JS, "D1. 注入 trialIntro 状态判定")
    text = rep(text, FIXED_COPY, "<p>${trialIntro}</p>", "D1. 移除写死的「结丹雷蛟已伏」")

    # ---- D2 / E. 雷劫页与问心页接入统一指引 ----
    text = rep(text, 'return `<div class="trial-page"><div class="trial-intro">',
               'return `<div class="trial-page">${progGuide(\'core\')}<div class="trial-intro">',
               "D2. 雷劫页接入条件清单")
    text = rep(text, 'return `<div class="trial-page">${header}${stats}',
               'return `<div class="trial-page">${progGuide(\'heart\')}${header}${stats}',
               "E. 问心页接入条件清单")

    # ---- C. 修炼面板接入阶段指引 ----
    text = rep(text, "<h3>破境 · ${game.realmAt(s.zone-3)}</h3>",
               "<h3>破境 · ${game.realmAt(s.zone-3)}</h3>${progGuide('generic')}",
               "C. 修炼面板接入阶段指引")

    # ---- 版本号跟随 ----
    text = rep(text, "<title>山野修仙记 V90.8 · 五阶洞府与高阶炼制</title>",
               "<title>山野修仙记 V90.9 · 界面整合与境界指引</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.8'", "subtitle='人妖异途 · V90.9'", "入口副标题版本号")
    text = rep(text, "link.download='山野修仙记_V90.8_本机飞升资质榜.json'",
               "link.download='山野修仙记_V90.9_本机飞升资质榜.json'", "导出文件名版本号")

    # ---- 样式注入 ----
    css_settings = (ROOT / "tools" / "v909-settings.css").read_text(encoding="utf-8").rstrip("\n")
    css_prog = (ROOT / "tools" / "v909-progression.css").read_text(encoding="utf-8").rstrip("\n")
    style = ('<style id="v909-settings-layout">\n' + css_settings + "\n</style>\n"
             '<style id="v909-progression">\n' + css_prog + "\n</style>\n")
    text = rep(text, "</head>\n<body>", style + "</head>\n<body>", "注入 V90.9 样式块")

    # ---- 产物自检 ----
    for must in ['progGuide(\'core\')', 'progGuide(\'heart\')', 'progGuide(\'generic\')',
                 'const trialIntro=', 'progMatSource', 'progRows', 'progNext']:
        if must not in text:
            die(f"产物缺少：{must}")
    ok("产物关键片段", "指引模块 3 处接入 + trialIntro")

    if "结丹雷蛟已伏，余劫却仍在丹田" in text:
        die("D1 未生效：写死文案仍在")
    ok("D1 校验", "写死的「结丹雷蛟已伏」已消失")

    if text.count("V90.9") < 6:
        die(f"V90.9 版本标记不足：{text.count('V90.9')}")

    # ---- 写出 ----
    out = text.replace("\n", "\r\n").encode("utf-8")
    RELEASES.mkdir(exist_ok=True)
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)

    lb = blob((ROOT / "index.html").read_bytes())
    rb = blob((RELEASES / OUT_NAME).read_bytes())
    if lb != rb:
        die("index.html 与发布文件 Git Blob 不一致")
    ok("产物一致性", f"index.html == releases/{OUT_NAME}")

    print("\n--- 写出完成 ---")
    print(f"  releases/{OUT_NAME}")
    print(f"  index.html")
    print(f"  字节数      : {len(out)}")
    print(f"  行数        : {len(text.splitlines())}")
    print(f"  SHA256      : {sha(out)}")
    print(f"  Git Blob    : {lb}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
