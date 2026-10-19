#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.8 -> V90.9 构建器

基线：V90.8（index.html / releases/山野修仙记_V90.8_五阶洞府与高阶炼制版.html，同一 Git Blob）
本轮：设置界面分区重排 + 版本号跟随 + 设置布局样式注入。

约定
  1. 所有替换都断言「唯一命中」，命中数不符立即中止，绝不产出半成品。
  2. 只读取 LF 归一化文本，写出时统一转回 CRLF，保持与原仓库一致。
  3. 写出前校验：设置面板的 data-a 按钮集合不得丢失或新增。
  4. 不修改存档数据、寿元机制、备份规则、续命机制与任何战斗数值。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
BODY_SRC = ROOT / "tools" / "v909-settings-body.js"
CSS_SRC = ROOT / "tools" / "v909-settings.css"
RELEASES = ROOT / "releases"

BASE_LF_SHA256 = "5993611AC42248383C4485F5BA99B726B2BDB5728F1FF52113ECF32D4F19B08E"
BASE_LINES = 6513
OLD_BODY_SHA256 = "59FBA4DEE2E3F0073117417F820C798CD93DDF819790572E40BA58C95FDC482A"

VERSION_TITLE_OLD = "<title>山野修仙记 V90.8 · 五阶洞府与高阶炼制</title>"
VERSION_TITLE_NEW = "<title>山野修仙记 V90.9 · 界面整合与境界指引</title>"
SUBTITLE_OLD = "subtitle='人妖异途 · V90.8'"
SUBTITLE_NEW = "subtitle='人妖异途 · V90.9'"
EXPORT_OLD = "link.download='山野修仙记_V90.8_本机飞升资质榜.json'"
EXPORT_NEW = "link.download='山野修仙记_V90.9_本机飞升资质榜.json'"

HEAD_ANCHOR = "</head>\r\n<body>"   # 在 LF 归一化文本中应为 "</head>\n<body>"

checks = []


def ok(label, detail=""):
    checks.append((label, detail))
    print(f"  [OK] {label}" + (f"  {detail}" if detail else ""))


def die(msg):
    raise SystemExit(f"\n[ABORT] {msg}")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def git_blob(data: bytes) -> str:
    header = b"blob " + str(len(data)).encode() + b"\0"
    return hashlib.sha1(header + data).hexdigest()


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die(f"{label}: 期望唯一命中，实际 {n} 次")
    ok(label, f"1 处")
    return text.replace(old, new, 1)


def extract_function(text, start_marker):
    """按花括号配平从 start_marker 处提取完整函数源码。"""
    i = text.find(start_marker)
    if i < 0:
        die(f"找不到函数起点：{start_marker}")
    if text.count(start_marker) != 1:
        die(f"函数起点不唯一：{start_marker}")
    depth = 0
    started = False
    for k in range(i, len(text)):
        ch = text[k]
        if ch == "{":
            depth += 1
            started = True
        elif ch == "}":
            depth -= 1
            if started and depth == 0:
                return text[i:k + 1]
    die("花括号未能配平，提取失败")


def data_actions(html):
    """收集所有 data-a="xxx" 动作名（用于校验按钮不丢失）。"""
    return sorted(set(re.findall(r'data-a="([a-z0-9\-]+)"', html)))


def main():
    print("V90.8 -> V90.9 构建开始\n")

    if not INDEX.exists():
        die("找不到 index.html")
    raw0 = INDEX.read_bytes()
    text = raw0.decode("utf-8").replace("\r\n", "\n")
    lines = text.split("\n")

    # ---- 基线校验 ----
    if sha256_hex(text.encode()) != BASE_LF_SHA256:
        die(f"基线 LF SHA256 不符：{sha256_hex(text.encode())}")
    if len(text.splitlines()) != BASE_LINES:
        die(f"基线行数不符：{len(text.splitlines())}")
    ok("基线校验", f"{len(raw0)} 字节 / {len(lines)} 行 / sha256 {BASE_LF_SHA256[:16]}…")

    # ---- 1. 提取并替换 settingsBody ----
    old_body = extract_function(text, "function settingsBody(){")
    if sha256_hex(old_body.encode()) != OLD_BODY_SHA256:
        die(f"旧 settingsBody 指纹不符：{sha256_hex(old_body.encode())}")
    ok("旧 settingsBody 指纹", f"{len(old_body)} 字符")

    new_body = BODY_SRC.read_text(encoding="utf-8").rstrip("\n")
    if not new_body.startswith("function settingsBody(){return `"):
        die("新 settingsBody 文件格式不符")
    if sha256_hex(new_body.encode()) == OLD_BODY_SHA256:
        die("新旧 settingsBody 相同，替换无意义")

    old_actions = data_actions(old_body)
    new_actions = data_actions(new_body)
    lost = [a for a in old_actions if a not in new_actions]
    added = [a for a in new_actions if a not in old_actions]
    if lost:
        die(f"设置页丢失按钮动作：{lost}")
    if added:
        die(f"设置页新增了未预期的按钮动作：{added}")
    ok("按钮动作集合一致", f"{len(old_actions)} 个：{', '.join(old_actions)}")

    text = replace_once(text, old_body, new_body, "替换 settingsBody（六分区）")

    # ---- 2. 版本号跟随 ----
    text = replace_once(text, VERSION_TITLE_OLD, VERSION_TITLE_NEW, "标题版本号")
    text = replace_once(text, SUBTITLE_OLD, SUBTITLE_NEW, "入口页副标题版本号")
    text = replace_once(text, EXPORT_OLD, EXPORT_NEW, "排行榜导出文件名版本号")

    # ---- 3. 注入设置布局样式 ----
    css = CSS_SRC.read_text(encoding="utf-8").rstrip("\n")
    if "v909-set" not in css:
        die("样式文件内容异常")
    style_block = '<style id="v909-settings-layout">\n' + css + "\n</style>\n"
    anchor_lf = HEAD_ANCHOR.replace("\r\n", "\n")
    text = replace_once(text, anchor_lf, style_block + anchor_lf, "注入 v909-settings-layout 样式")

    # ---- 4. 产物自检 ----
    if text.count("v909-settings-layout") != 1:
        die("样式块注入次数异常")
    if "v909-set-head" not in text:
        die("新布局标记缺失")
    for must in ("data-a=\"export\"", "data-a=\"import\"", "data-a=\"restore\"",
                 "data-a=\"characters\"", "data-a=\"ranking-open\"", "data-a=\"ad-life\"",
                 "data-a=\"theme-set\"", "data-a=\"motion\"", "data-a=\"reset\"",
                 'data-name="log"', 'data-name="help"'):
        if must not in text:
            die(f"关键按钮缺失：{must}")
    ok("产物按钮完整性", "12 个关键入口均在")
    if text.count("V90.9") != 6:
        die(f"V90.9 出现次数异常：{text.count('V90.9')}（应为 6：标题/副标题/导出名/设置头/设置说明/CSS 注释）")
    ok("版本号出现次数", "V90.9 × 6（标题/副标题/导出名/设置头/设置说明/CSS 注释）")

    # ---- 5. 写出（统一 CRLF，与原仓库一致） ----
    out_bytes = text.replace("\n", "\r\n").encode("utf-8")
    RELEASES.mkdir(exist_ok=True)
    release_name = "山野修仙记_V90.9_界面整合与境界指引版.html"
    (RELEASES / release_name).write_bytes(out_bytes)
    INDEX.write_bytes(out_bytes)

    print("\n--- 写出完成 ---")
    print(f"  releases/{release_name}")
    print(f"  index.html")
    print(f"  字节数      : {len(out_bytes)}")
    print(f"  行数        : {len(text.splitlines())}")
    print(f"  SHA256(CRLF): {sha256_hex(out_bytes)}")
    print(f"  SHA256(LF)  : {sha256_hex(text.encode())}")
    print(f"  Git Blob    : {git_blob(out_bytes)}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
