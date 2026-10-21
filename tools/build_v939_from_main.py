#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.38 -> V90.39 构建器（设置页「寿元」区文案与新规则对齐）

V90.38 已经取消了「最后 15 年」的续命门槛，但设置页 set-life 那一块还留着旧文案：
  - 按钮文字：game.lifeYears>15 ? '寿元低于16年时可领' : '领取10年寿元'
  - 说明文字：寿元剩余 15 年以内时…；寿元归零会清除当前档位及其备份，寿尽后不能复活
新规则下这两处都在骗玩家，必须一起改：
  - 按钮：斗法中 → '斗法中不可使用'；否则 → '领取10年寿元'
  - 说明：随时可领、每世不限次数；寿元归零时先给一次「看广告续命 +15 年」的机会，
    选择接受轮回才结算清档。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.38_续命放开版.html"
OUT_NAME = "山野修仙记_V90.39_寿元文案对齐版.html"
BASE_SHA = "1852BE1FDC9CD0CCCB5FD845A7AB514C6886B079593CA59E67CCC1780CA235C3"

OLD_BTN = "${game.s.combat?'斗法中不可使用':game.lifeYears>15?'寿元低于16年时可领':'领取10年寿元'}"
NEW_BTN = "${game.s.combat?'斗法中不可使用':'领取10年寿元'}"

OLD_NOTE = ('<p class="v909-note">寿元剩余 15 年以内时，每次达到条件可领取 10 年寿元；'
            '每世不限次数，但每次须重新满足条件。领取无真实广告、无网络请求、不消耗轮回玉。'
            '寿元归零会清除当前档位及其备份，寿尽后不能复活。</p>')
NEW_NOTE = ('<p class="v909-note">任何时候都可以领取 10 年寿元（斗法中除外），每世不限次数，'
            '领取无真实广告、无网络请求、不消耗轮回玉。寿元归零时不会立刻清档：'
            '本世还有一次逆命续年的机会（看完激励视频 +15 年，进度全部保留）；'
            '选择「接受轮回」才会结算并清除当前档位的主存档与自动备份。</p>')


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
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")
    before = actions(text)

    text = rep(text, "<title>山野修仙记 V90.38 · 续命放开</title>",
               "<title>山野修仙记 V90.39 · 寿元文案对齐</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.38'", "subtitle='人妖异途 · V90.39'", "副标题版本号")
    text = rep(text, "V90.38 · ${game.character.name}", "V90.39 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.38_本机飞升资质榜.json", "山野修仙记_V90.39_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.38：", "当前版本 V90.39：", "帮助页版本说明")

    text = rep(text, OLD_BTN, NEW_BTN, "设置页续命按钮不再看寿元")
    text = rep(text, OLD_NOTE, NEW_NOTE, "设置页寿元说明改写")

    if "低于16年" in text:
        raise SystemExit("[ABORT] 旧门槛文案还在")
    ok("产物标记", "旧门槛文案已清空")

    after = actions(text)
    if after != before:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after ^ before)}")
    ok("动作集合不变", f"{len(after)} 个")

    eol = "\r\n" if b"\r\n" in raw[:4000] else "\n"
    out = text.replace("\n", eol).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
