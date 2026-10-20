#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.21 -> V90.22 构建器（评价入口触发时机：教程结束/跳过）

基线：V90.21（字节哈希校验）
改动（一行判定 + 版本号，其余零改动）：
  旧：...(game.camp || game.day>=2)          // 有洞府 / 第 2 游戏日起
  新：...(game.s.guide.status==='done' || game.s.guide.status==='skipped')
      即：跟完新手教程，或跳过新手教程

为什么这个时机更好：教学刚结束＝玩家完整走了一遍采集→制作→筑庐→炼器→炼丹→图鉴→试剑，
正是"他确实玩过"的信号；跳过也算一次明确的意愿表达。原来是"有洞府或第 2 日"，
会比教学更早（第 2 日可能才采了两把草），时机偏前。

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合必须完全不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.21_加群文案润色版.html"
OUT_NAME = "山野修仙记_V90.22_评价触发时机版.html"
BASE_SHA = "F90021A9B2AEA6E0882628CB5EC63625F87DB63FB29C1DE99F90996DAC3F7495"

OLD = "&&(game.camp||game.day>=2);}"
NEW = "&&(game.s.guide.status==='done'||game.s.guide.status==='skipped');}"


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
    if sha(raw) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    before_actions = actions(text)
    ok("基线动作集合", f"{len(before_actions)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.21 · 加群文案润色</title>",
               "<title>山野修仙记 V90.22 · 评价触发时机</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.21'", "subtitle='人妖异途 · V90.22'", "副标题版本号")
    text = rep(text, 'V90.21 · ${game.character.name}', 'V90.22 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.21_本机飞升资质榜.json", "山野修仙记_V90.22_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.21：", "当前版本 V90.22：", "帮助页版本说明")

    # 只改 promoVisible 的最后一项门槛（锚点带 ;} 收尾，确保不会误伤别的表达式）
    text = rep(text, "&&(game.camp||game.day>=2);}", NEW, "评价入口触发条件")

    if "game.camp||game.day>=2" in text:
        raise SystemExit("[ABORT] 旧触发条件残留")
    if "game.s.guide.status==='done'||game.s.guide.status==='skipped'" not in text:
        raise SystemExit("[ABORT] 新触发条件未写入")
    ok("触发条件断言", "教程 done / skipped 才显示")

    after_actions = actions(text)
    if after_actions != before_actions:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after_actions ^ before_actions)}")
    ok("动作集合不变", f"{len(after_actions)} 个")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
