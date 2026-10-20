#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.20 -> V90.21 构建器（加群文案润色）

基线：V90.20（字节哈希校验）
改动（只动一句文案 + 版本号，逻辑/动作/存档零改动）：
  "群里两件事：反馈问题、领取无广告单机版。"
  -> "欢迎加群反馈问题、聊聊玩法；想玩本地无广告的单机版，也可以加群来取。"

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合必须完全不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.20_评价与加群文案版.html"
OUT_NAME = "山野修仙记_V90.21_加群文案润色版.html"
BASE_SHA = "A9E2E7162FC515AEDD4C98153FA46626ABE47C6BCB247F90CE2106BFCD970FAF"

OLD_LINE = '<p class="promo-uses">群里两件事：<b>反馈问题</b>、<b>领取无广告单机版</b>。</p>'
NEW_LINE = '<p class="promo-uses">欢迎加群反馈问题、聊聊玩法；想玩本地无广告的单机版，也可以加群来取。</p>'


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

    text = rep(text, "<title>山野修仙记 V90.20 · 评价与加群文案</title>",
               "<title>山野修仙记 V90.21 · 加群文案润色</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.20'", "subtitle='人妖异途 · V90.21'", "副标题版本号")
    text = rep(text, 'V90.20 · ${game.character.name}', 'V90.21 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.20_本机飞升资质榜.json", "山野修仙记_V90.21_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.20：", "当前版本 V90.21：", "帮助页版本说明")

    text = rep(text, OLD_LINE, NEW_LINE, "加群文案润色")

    # ---- 断言 ----
    promo_start = text.index('人间烟火')
    promo_end = text.index('知道了</button></div>', promo_start)
    promo = text[promo_start:promo_end]
    if "奖励" in promo:
        raise SystemExit("[ABORT] 弹窗里仍出现「奖励」字样")
    for token in ("欢迎加群", "反馈问题", "无广告的单机版", "${PROMO.group}"):
        if token not in promo:
            raise SystemExit(f"[ABORT] 弹窗缺少：{token}")
    if "群里两件事" in text:
        raise SystemExit("[ABORT] 旧文案残留")
    ok("文案断言", "欢迎加群 + 反馈问题 + 无广告单机版；无「奖励」、无旧句")

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
