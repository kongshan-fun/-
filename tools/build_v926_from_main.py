#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.25 -> V90.26 构建器（360×640 收敛：设置父页 + 修炼父页）

基线：V90.25（字节哈希校验）

实测（360×640，面板可视 413px）：
  设置父页 435px → 1.05 屏：其中 40.8px 是**与「帮助与记录」子页完全重复**的版本说明
  修炼父页 476px → 1.15 屏：两段规则说明各 40.8px，教程/帮助里都有

改法按「减入口优于压像素」：
  - 设置父页删掉重复的版本说明（信息仍在 设置→帮助与记录）
  - 修炼父页删掉"四游戏日折一年…"（帮助·寿元章有），"试剑与法门…"压成一行
不改字号、不裁文字。

洞府 / 主线不在本版：实测它们的超屏来自**内容量**（洞府 6 张设施卡 3 行 = 407px；
主线 q3 正文 246px + 两个入口行 135px），压像素只能到 1.1~1.2，要真正 1.02
必须动「本体不拆」或裁切文字，需要先定方案，见交接文档 §7.5。

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.25_轮回玉每档一次版.html"
OUT_NAME = "山野修仙记_V90.26_窄屏父页收敛版.html"
BASE_SHA = "8878A27EDD2C76E8F55CA83201AAC15DD57C557FB4709CF44394B30D09708920"

OLD_SETTINGS_NOTE = '<p class="micro">设置分区之间互不影响；每个子页顶部都可「← 返回设置」。</p>'
NEW_SETTINGS_NOTE = ''

OLD_CULT_MUTED = '<p class="muted">四游戏日折一年，战败额外折寿${D.LIFE.defeatYears}年。寿尽只删除当前档位。</p>'
NEW_CULT_MUTED = ''

OLD_CULT_MICRO = '<p class="micro">试剑与法门每天有限次，不替代仪式或首领挑战。所有条件与消耗与旧版完全一致。</p>'
NEW_CULT_MICRO = '<p class="micro">试剑与法门每天有限次，不替代仪式或首领战。</p>'


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


def eol_of(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw[:4000] else "\n"


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    before_actions = actions(text)
    ok("基线动作集合", f"{len(before_actions)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.25 · 轮回玉每档一次</title>",
               "<title>山野修仙记 V90.26 · 窄屏父页收敛</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.25'", "subtitle='人妖异途 · V90.26'", "副标题版本号")
    text = rep(text, 'V90.25 · ${game.character.name}', 'V90.26 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.25_本机飞升资质榜.json", "山野修仙记_V90.26_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.25：", "当前版本 V90.26：", "帮助页版本说明")

    text = rep(text, OLD_SETTINGS_NOTE, NEW_SETTINGS_NOTE, "设置父页去重版本说明")
    text = rep(text, OLD_CULT_MUTED, NEW_CULT_MUTED, "修炼父页去掉寿元规则段")
    text = rep(text, OLD_CULT_MICRO, NEW_CULT_MICRO, "修炼父页说明压成一行")

    if OLD_SETTINGS_NOTE in text or OLD_CULT_MUTED in text:
        raise SystemExit("[ABORT] 旧段落残留")
    ok("删除断言", "两段重复/冗长说明已移除")

    after_actions = actions(text)
    if after_actions != before_actions:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after_actions ^ before_actions)}")
    ok("动作集合不变", f"{len(after_actions)} 个")

    eol = eol_of(raw)
    out = text.replace("\n", eol).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", f"index.html == release（行尾 {eol.encode('unicode_escape').decode()}）")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
