#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.77 灵息辟谷 -> 免广本地版

原则：只改写「必须看广告」的文案与按钮，不改任何发奖逻辑与数值。
原版靠激励视频的四处入口，在本版改为直接领取：
  1 洞府续命 +10 年（顶部「续命+10」）
  2 寿尽救援 +15 年（还有一线生机）
  3 命格抽取次数（免费次数用完后的 3 次）
  4 轮回玉 200 奖励（属性确认页）
"""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.77_灵息辟谷.html"
OUT_NAME = "山野修仙记_V90.77_免广本地版.html"
BASE_SHA = "EB8FD4058B083545B048173772322C91E8E0127D030BC40D46D2029F217A5AC4"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest().upper()


def canonical(b: bytes) -> str:
    return sha(b.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))


def main() -> None:
    print("V90.77 免广本地版 构建\n")
    raw = BASE.read_bytes()
    if canonical(raw) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{canonical(raw)}")
    print(f"  [OK]   基线校验 {len(raw):,} B")

    text = raw.decode("utf-8")
    eol = "\r\n" if "\r\n" in text[:4000] else "\n"
    text = text.replace("\r\n", "\n")

    def rep(old, new, label, expect=1):
        nonlocal text
        n = text.count(old)
        if n != expect:
            raise SystemExit(f"[ABORT] {label}: 命中 {n}（期望 {expect}）")
        text = text.replace(old, new)
        print(f"  [OK]   {label}（{n} 处）")

    rep("<title>山野修仙记 V90.77 · 灵息辟谷</title>",
        "<title>山野修仙记 V90.77 · 免广本地版</title>", "标题")
    rep("subtitle='灵息辟谷 · V90.77'", "subtitle='免广单机 · V90.77'", "副标题")

    # 续命与救援
    rep("看完一段激励视频，寿元回到 15 年", "直接领取续命，寿元回到 15 年", "续命说明 A",
        expect=text.count("看完一段激励视频，寿元回到 15 年"))
    rep("看完一段激励视频即到账", "点一下即到账", "续命说明 B")
    rep("完整看完激励视频可逆命续年", "本世可免费逆命续年", "逆命说明")
    rep("看广告续命 · 寿元+15年", "免费续命 · 寿元+15年", "逆命按钮")

    # 轮回玉与抽取
    rep("观看广告所得立即记入当前档位账本", "免费领取所得立即记入当前档位账本", "轮回玉说明")
    rep("免费次数用完，可模拟观看广告领取3次", "免费次数用完，可再免费领取3次", "抽取提示")
    rep("试玩领取不需要观看广告", "试玩领取全部免费，不需要观看任何广告", "天赋说明")

    # 版本说明
    rep("当前不含仙界内容、宗门弟子、多人联机、广告或付费抽卡。",
        "当前不含仙界内容、宗门弟子、多人联机、广告或付费抽卡；本版为免广本地单机版。", "版本说明 A")
    rep("本版没有离线收益、抽卡、广告、付费建筑、联网排行榜或宗门弟子管理。",
        "本版没有离线收益、抽卡、广告、付费建筑、联网排行榜或宗门弟子管理；所有原本靠广告的奖励改为直接领取。",
        "版本说明 B")

    for banned in ("激励视频", "看广告"):
        if banned in text:
            raise SystemExit(f"[ABORT] 产物仍含「{banned}」")
    for need in ("免广单机", "灵息辟谷", "recalcUnlocked", "ascensionScore"):
        if need not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {need}")
    print("  [OK]   产物断言（免广 + 辟谷 + 开图同步 + 榜单口径 都在）")

    out = text.replace("\n", eol).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
