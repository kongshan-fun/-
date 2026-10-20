#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.17 -> V90.18 构建器（轮回玉广告奖励 100 -> 200）

基线：V90.17（字节哈希校验）
范围（用户确认的 C 方案，只改数额，其余不动）：
  - 命格确认页按钮「领取100轮回玉」-> 「领取200轮回玉」
  - birth-jade-ad 处理器 grantLegacyJade(...,100) -> 200，提示文案同步
  - 旧「模拟广告」弹窗的 jade 分支同样改 200（当前不可达，但避免残留一个 100）
不做：评价入口（另排期）、一次性限制、出生站加点价格 —— 均按 C 方案不动。

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不减少。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.17_图鉴父子页版.html"
OUT_NAME = "山野修仙记_V90.18_轮回玉广告奖励版.html"
BASE_SHA = "987F601ED09FA52F5ABB6003A8A1886FDC93F4FF1E5360AEF29993CABE8D0408"


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

    # ---- 版本号 ----
    text = rep(text, "<title>山野修仙记 V90.17 · 图鉴父子页</title>",
               "<title>山野修仙记 V90.18 · 轮回玉广告奖励</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.17'", "subtitle='人妖异途 · V90.18'", "副标题版本号")
    text = rep(text, 'V90.17 · ${game.character.name}', 'V90.18 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.17_本机飞升资质榜.json", "山野修仙记_V90.18_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.17：", "当前版本 V90.18：", "帮助页版本说明")

    # ---- 奖励数额 100 -> 200（三处，逐一断言） ----
    text = rep(text, ">领取100轮回玉<", ">领取200轮回玉<", "命格确认页按钮文案")
    text = rep(text, "grantLegacyJade(selectedRole,draftSlot,100)",
               "grantLegacyJade(selectedRole,draftSlot,200)", "轮回玉发放数额", expect=2)
    text = rep(text, "本档轮回玉+100", "本档轮回玉+200", "领取提示文案", expect=2)

    if "领取100轮回玉" in text or "轮回玉+100" in text:
        raise SystemExit("[ABORT] 仍有遗留的 100 文本")
    ok("遗留检查", "无 100 残留")

    after_actions = actions(text)
    lost = before_actions - after_actions
    if lost:
        raise SystemExit(f"[ABORT] 动作集合减少：{sorted(lost)}")
    ok("动作集合未减少", f"{len(after_actions)} 个")

    # 断言：三处数额一致（按钮 / 发放 / 提示）
    for token in (">领取200轮回玉<", "grantLegacyJade(selectedRole,draftSlot,200)", "本档轮回玉+200"):
        if token not in text:
            raise SystemExit(f"[ABORT] 缺少预期产物标记：{token}")
    ok("产物标记", "按钮 / 发放 / 提示 三处一致")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
