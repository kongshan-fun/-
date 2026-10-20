#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.19 -> V90.20 构建器（评价与加群文案优化）

基线：V90.19（字节哈希校验）
改动（只动文案与一条样式，不动逻辑/动作/存档）：
  1. 删掉「也不会有任何奖励交换」——用户明确不要提"没有任何奖励"
  2. 群号用途补全：反馈问题 + 群里有**无广告单机版**
  3. 正文措辞收紧，去重「说说真实感受」与「好评差评都会看」

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不减少（应保持 154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.19_评价与加群提示版.html"
OUT_NAME = "山野修仙记_V90.20_评价与加群文案版.html"
BASE_SHA = "B9AAA82C9F4F882A0BFB2C72AD241829A547971540C63997144F6034639F6DC7"

OLD_BODY = ('<div class="kicker">人间烟火 · 只提这一次</div><h2>给个评价，或来群里坐坐</h2>'
            '<p>在 TapTap 搜索《山野修仙记》，进详情页点「评价」，说说真实感受就行——好评差评都会看，也不会有任何奖励交换。</p>'
            '<div class="promo-group"><span>玩家交流群（QQ）</span><b>${PROMO.group}</b></div>'
            '<p><small>这个提示只出现一次，关掉后不再打扰。</small></p>'
            '<div class="inline-buttons"><button class="btn" data-a="promo-copy">复制群号</button>'
            '<button class="btn primary" data-a="promo-close">知道了</button></div>')

NEW_BODY = ('<div class="kicker">人间烟火 · 只提这一次</div><h2>给个评价，或来群里坐坐</h2>'
            '<p>在 TapTap 搜索《山野修仙记》，进详情页点「评价」，玩到现在的感受随手说两句就好，我们都会认真看。</p>'
            '<div class="promo-group"><span>QQ 群号</span><b>${PROMO.group}</b></div>'
            '<p class="promo-uses">群里两件事：<b>反馈问题</b>、<b>领取无广告单机版</b>。</p>'
            '<p><small>这个提示只出现一次，关掉后不再打扰。</small></p>'
            '<div class="inline-buttons"><button class="btn" data-a="promo-copy">复制群号</button>'
            '<button class="btn primary" data-a="promo-close">知道了</button></div>')

OLD_CSS = ('.modal .promo-group b{font:650 20px/1.1 "Songti SC","SimSun",serif;letter-spacing:.08em}\n')
NEW_CSS = ('.modal .promo-group b{font:650 20px/1.1 "Songti SC","SimSun",serif;letter-spacing:.08em}\n'
           '.modal .promo-uses{font-size:11.5px;line-height:1.75;color:#444;margin:6px 0 8px}\n'
           '.modal .promo-uses b{font-weight:600;color:#111}\n')


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
    text = rep(text, "<title>山野修仙记 V90.19 · 评价与加群提示</title>",
               "<title>山野修仙记 V90.20 · 评价与加群文案</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.19'", "subtitle='人妖异途 · V90.20'", "副标题版本号")
    text = rep(text, 'V90.19 · ${game.character.name}', 'V90.20 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.19_本机飞升资质榜.json", "山野修仙记_V90.20_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.19：", "当前版本 V90.20：", "帮助页版本说明")

    # ---- 文案 ----
    text = rep(text, OLD_BODY, NEW_BODY, "评价与加群弹窗文案")
    text = rep(text, OLD_CSS, NEW_CSS, "promo 用途行样式")

    # ---- 断言：不许再出现"奖励"字样，且两项用途都在 ----
    promo_start = text.index('人间烟火')
    promo_end = text.index('知道了</button></div>', promo_start)
    promo = text[promo_start:promo_end]
    if "奖励" in promo:
        raise SystemExit("[ABORT] 弹窗里仍出现「奖励」字样")
    for token in ("反馈问题", "领取无广告单机版", "${PROMO.group}"):
        if token not in promo:
            raise SystemExit(f"[ABORT] 弹窗缺少：{token}")
    if "group:'854720768'" not in text:
        raise SystemExit("[ABORT] PROMO 群号常量丢失")
    ok("文案断言", "无「奖励」字样；反馈问题 + 无广告单机版 + 群号占总齐全")

    after_actions = actions(text)
    lost = before_actions - after_actions
    if lost:
        raise SystemExit(f"[ABORT] 动作集合减少：{sorted(lost)}")
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
