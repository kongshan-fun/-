#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.23 -> V90.24 构建器（建筑卡说明文字不再被裁切）

基线：V90.23（字节哈希校验）

问题（Chromium 实测，P0-2 的产物）：
  V90.8 曾明确修过「第三种文本行不能消失」，写入
  `#panel-root .building-card .building-effect{min-height:0;max-height:none;overflow:visible}`；
  但 V90.16 的窄屏密度补丁又在同样的选择器上加了 `max-height:30px` / `26px`，
  由于位置更靠后，把那次的修复**整段盖掉了** →
  建筑卡第 6 张（灵田）的说明在 320/360/412/1080/1440 全部被裁。
  `tests/v908-character-gear-layout.test.cjs` 早就在断言那条修复规则存在，
  但它写在 index.html 里仍然存在（被覆盖而非删除），所以静态断言没发现；
  真正的裁切只有浏览器量 scrollHeight/clientHeight 才看得见。

改动：
  1. V90.16 窄屏块里的两处 max-height 上限改回上限放开（min-height:0;max-height:none）
  2. 版本号
三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.23_战斗不再掉成品版.html"
OUT_NAME = "山野修仙记_V90.24_建筑卡文字不裁切版.html"
BASE_SHA = "445769D47356D0C29F5985F7986348F13EB1076077706C7CCA0BB65C58A9E38B"

OLD_A = "#panel-root .building-card .building-effect{min-height:28px;max-height:30px;font-size:9.5px;line-height:1.55;margin:4px 0 2px}"
NEW_A = "#panel-root .building-card .building-effect{min-height:0;max-height:none;font-size:9.5px;line-height:1.55;margin:4px 0 2px}"

OLD_B = "#panel-root .building-card .building-effect{max-height:26px;font-size:9px}"
NEW_B = "#panel-root .building-card .building-effect{max-height:none;font-size:9px}"


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

    text = rep(text, "<title>山野修仙记 V90.23 · 战斗不再掉成品</title>",
               "<title>山野修仙记 V90.24 · 建筑卡文字不裁切</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.23'", "subtitle='人妖异途 · V90.24'", "副标题版本号")
    text = rep(text, 'V90.23 · ${game.character.name}', 'V90.24 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.23_本机飞升资质榜.json", "山野修仙记_V90.24_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.23：", "当前版本 V90.24：", "帮助页版本说明")

    text = rep(text, OLD_A, NEW_A, "窄屏建筑卡说明高度上限（400px 档）")
    text = rep(text, OLD_B, NEW_B, "窄屏建筑卡说明高度上限（340px 档）")

    # 断言：凡是 #panel-root 作用域下的 .building-effect 规则，都不得再设数值上限
    # （基础规则 `.building-card .building-effect` 的 51px 会被 ID 规则覆盖，保留不动）
    bad = []
    for m in re.finditer(r"#panel-root \.building-card \.building-effect\{([^}]*)\}", text):
        body = m.group(1)
        if re.search(r"max-height:\s*\d+px", body):
            bad.append(body)
    if bad:
        raise SystemExit(f"[ABORT] 仍有高度上限：{bad[0]}")
    ok("裁切断言", "#panel-root 下不再有数值 max-height 上限")

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
