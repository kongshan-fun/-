#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.24 -> V90.25 构建器（轮回玉广告奖励改为每档一次）

基线：V90.24（字节哈希校验）

问题（P0-3）：命格确认页「领取200轮回玉」**没有任何次数限制**。
浏览器/离线版点一次 +200；TapTap 包内每次点击都被广告拦截器接管成"看广告 +200"。
按代码里的价格（出生站 10玉=+5年寿元、20玉=+1攻击，初始寿元 56 年）：
一次 = +100 年寿元 = 12.5 颗延寿丹（而延寿丹全局限 2 颗），且 5 次 ≈ 一次飞升的基础结算。

规则（本次落地）：
  - **每个档位一次**，标记写在旁路键 `<slotkey>-jadead`，
    **不进 legacy 账本**（账本有严格结构校验，加字段会牵动存档格式/100 档回归/云存档 payload）
  - 领过后按钮置灰显示「本档已领取」，处理器里再挡一道（防止被禁用属性绕过）
  - 刷新、重开都读同一个键 → 不会重复领取；键里带档位号 → 不同档位互不串

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.24_建筑卡文字不裁切版.html"
OUT_NAME = "山野修仙记_V90.25_轮回玉每档一次版.html"
BASE_SHA = "F92A3B41B89071F5FE7C98203B6C11012290734D155B9AF58AA1F213EB5559AB"

OLD_KEY = "backupKey(id,n=1){return this.key(id,n)+'-backup';}"
NEW_KEY = (OLD_KEY +
           " adJadeKey(id,n=1){return this.key(id,n)+'-jadead';}"
           " adJadeUsed(id,n=1){return this.readKey(this.adJadeKey(id,n))==='1';}"
           " markAdJade(id,n=1){this.storage.setItem(this.adJadeKey(id,n),'1');}")

OLD_SIG = "function birthConfirm(b,slot,ledger,dead=false){"
NEW_SIG = "function birthConfirm(b,slot,ledger,dead=false,jadeUsed=false){"

OLD_CALL = ("else if(frontPage.kind==='birth-confirm')root.innerHTML=E.birthConfirm(draftBirth,draftSlot,"
            "slots.legacy(selectedRole,draftSlot),slots.dead(selectedRole,draftSlot));")
NEW_CALL = ("else if(frontPage.kind==='birth-confirm')root.innerHTML=E.birthConfirm(draftBirth,draftSlot,"
            "slots.legacy(selectedRole,draftSlot),slots.dead(selectedRole,draftSlot),slots.adJadeUsed(selectedRole,draftSlot));")

OLD_BTN = '<button data-a="birth-jade-ad">领取200轮回玉</button>'
# 注意：这段模板在 birth 模块（E/QBirth）里，作用域里没有 slots。
# 所以只能吃参数 jadeUsed，不能直接调 slots —— 否则会抛 "slots is not defined"。
NEW_BTN = ("${jadeUsed"
           "?'<button data-a=\"birth-jade-ad\" disabled>本档已领取</button>'"
           ":'<button data-a=\"birth-jade-ad\">领取200轮回玉</button>'}")

OLD_NOTE = '轮回玉在本页直接用于本世加点；广告奖励立即记入当前档位账本。'
NEW_NOTE = '轮回玉在本页直接用于本世加点；观看广告所得立即记入当前档位账本。每档仅可领取一次，刷新或重开不会重置。'

OLD_HANDLER = "if(a==='birth-jade-ad'&&frontPage?.kind==='birth-confirm'){try{grantLegacyJade(selectedRole,draftSlot,200);updateBirthStatsInPlace();notify('本档轮回玉+200','ok');}catch(e){notify('领取失败：'+e.message,'warn');}return;}"
NEW_HANDLER = ("if(a==='birth-jade-ad'&&frontPage?.kind==='birth-confirm'){"
               "if(slots.adJadeUsed(selectedRole,draftSlot)){notify('本档已领取过轮回玉（每档一次）','warn');return;}"
               "try{grantLegacyJade(selectedRole,draftSlot,200);slots.markAdJade(selectedRole,draftSlot);"
               "renderPage();updateBirthStatsInPlace();notify('本档轮回玉+200（每档一次）','ok');}"
               "catch(e){notify('领取失败：'+e.message,'warn');}return;}")


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
    """沿用基线文件的行尾：Windows 工作副本是 CRLF，CI（Linux 检出）是 LF。

    不这样做的话，CI 里 `--rebuild` 会把 LF 基线重建成 CRLF，
    `git diff --exit-code` 立刻报红 —— 属于"本地全绿、云端全红"的经典坑。
    """
    head = raw[:4000]
    return "\r\n" if b"\r\n" in head else "\n"


def main():
    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    before_actions = actions(text)
    ok("基线动作集合", f"{len(before_actions)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.24 · 建筑卡文字不裁切</title>",
               "<title>山野修仙记 V90.25 · 轮回玉每档一次</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.24'", "subtitle='人妖异途 · V90.25'", "副标题版本号")
    text = rep(text, 'V90.24 · ${game.character.name}', 'V90.25 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.24_本机飞升资质榜.json", "山野修仙记_V90.25_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.24：", "当前版本 V90.25：", "帮助页版本说明")

    text = rep(text, OLD_KEY, NEW_KEY, "旁路键 adJadeUsed/markAdJade")
    text = rep(text, OLD_SIG, NEW_SIG, "birthConfirm 增加 jadeUsed 参数")
    text = rep(text, OLD_CALL, NEW_CALL, "调用处传入本档已领状态")
    text = rep(text, OLD_BTN, NEW_BTN, "按钮按已领状态渲染")
    text = rep(text, OLD_NOTE, NEW_NOTE, "本页说明补一句每档一次")
    text = rep(text, OLD_HANDLER, NEW_HANDLER, "处理器二次拦截 + 打标记")

    for token in ("adJadeKey(id,n=1)", "slots.adJadeUsed(selectedRole,draftSlot)",
                  "slots.markAdJade(selectedRole,draftSlot)", "本档已领取", "jadeUsed=false"):
        if token not in text:
            raise SystemExit(f"[ABORT] 缺少产物标记：{token}")
    if "${slots.adJadeUsed" in text:
        raise SystemExit("[ABORT] 模板里直接调了 slots（birth 模块作用域没有 slots）")
    ok("产物标记", "旁路键 / 参数传递 / 二次拦截 / 置灰按钮 齐全")

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
