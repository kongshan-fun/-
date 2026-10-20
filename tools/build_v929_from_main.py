#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.28 -> V90.29 构建器（广告奖励恢复无限领取，单次 200 -> 100）

基线：V90.28（字节哈希，按 CRLF 归一）

需求（用户 2026-10-20）：
  「广告那个只能看一次，先把它去掉，我们还是可以无限刷吧，不然唯一盈利手段就没了……
    如果你实在觉得影响平衡，就把这个数值调回 100」

落地：
  1. 去掉 V90.25 加的「每档一次」限制：删 `-jadead` 旁路键与三个方法、
     删 birthConfirm 的 jadeUsed 参数、按钮恢复成永远可点、说明里删掉「每档仅可领取一次」
  2. 单次 200 -> 100（回到 V90.18 之前的数值）：
     按钮文案、两处 grantLegacyJade、两处提示文案
  说明里保留「观看广告所得立即记入当前档位账本」，但补一句可重复领取的口径。

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.28_洞府外框收紧版.html"
OUT_NAME = "山野修仙记_V90.29_广告奖励可重复版.html"
BASE_SHA = "A7E4D7BFC4E61573FF2019BE8B6C45940D493F176697448F86CB4DA1D6DFB328"

# ---- 1. 去掉一次性限制 ----
OLD_METHODS = ("backupKey(id,n=1){return this.key(id,n)+'-backup';}"
               " adJadeKey(id,n=1){return this.key(id,n)+'-jadead';}"
               " adJadeUsed(id,n=1){return this.readKey(this.adJadeKey(id,n))==='1';}"
               " markAdJade(id,n=1){this.storage.setItem(this.adJadeKey(id,n),'1');}")
NEW_METHODS = "backupKey(id,n=1){return this.key(id,n)+'-backup';}"

OLD_SIG = "function birthConfirm(b,slot,ledger,dead=false,jadeUsed=false){"
NEW_SIG = "function birthConfirm(b,slot,ledger,dead=false){"

OLD_BTN = ('${jadeUsed'
           "?'<button data-a=\"birth-jade-ad\" disabled>本档已领取</button>'"
           ":'<button data-a=\"birth-jade-ad\">领取200轮回玉</button>'}")
NEW_BTN = '<button data-a="birth-jade-ad">领取100轮回玉</button>'

OLD_NOTE = '轮回玉在本页直接用于本世加点；观看广告所得立即记入当前档位账本。每档仅可领取一次，刷新或重开不会重置。'
NEW_NOTE = '轮回玉在本页直接用于本世加点；观看广告所得立即记入当前档位账本，可重复领取。'

OLD_CALL = ("else if(frontPage.kind==='birth-confirm')root.innerHTML=E.birthConfirm(draftBirth,draftSlot,"
            "slots.legacy(selectedRole,draftSlot),slots.dead(selectedRole,draftSlot),slots.adJadeUsed(selectedRole,draftSlot));")
NEW_CALL = ("else if(frontPage.kind==='birth-confirm')root.innerHTML=E.birthConfirm(draftBirth,draftSlot,"
            "slots.legacy(selectedRole,draftSlot),slots.dead(selectedRole,draftSlot));")

OLD_HANDLER = ("if(a==='birth-jade-ad'&&frontPage?.kind==='birth-confirm'){"
               "if(slots.adJadeUsed(selectedRole,draftSlot)){notify('本档已领取过轮回玉（每档一次）','warn');return;}"
               "try{grantLegacyJade(selectedRole,draftSlot,200);slots.markAdJade(selectedRole,draftSlot);"
               "renderPage();updateBirthStatsInPlace();notify('本档轮回玉+200（每档一次）','ok');}"
               "catch(e){notify('领取失败：'+e.message,'warn');}return;}")
NEW_HANDLER = ("if(a==='birth-jade-ad'&&frontPage?.kind==='birth-confirm'){"
               "try{grantLegacyJade(selectedRole,draftSlot,100);renderPage();updateBirthStatsInPlace();"
               "notify('本档轮回玉+100','ok');}"
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


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")
    before = actions(text)
    ok("基线动作集合", f"{len(before)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.28 · 洞府外框收紧</title>",
               "<title>山野修仙记 V90.29 · 广告奖励可重复</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.28'", "subtitle='人妖异途 · V90.29'", "副标题版本号")
    text = rep(text, "V90.28 · ${game.character.name}", "V90.29 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.28_本机飞升资质榜.json", "山野修仙记_V90.29_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.28：", "当前版本 V90.29：", "帮助页版本说明")

    text = rep(text, OLD_METHODS, NEW_METHODS, "删除 -jadead 旁路键与三个方法")
    text = rep(text, OLD_SIG, NEW_SIG, "birthConfirm 去掉 jadeUsed 参数")
    text = rep(text, OLD_BTN, NEW_BTN, "按钮恢复可点、文案改 100")
    text = rep(text, OLD_NOTE, NEW_NOTE, "说明改为可重复领取")
    text = rep(text, OLD_CALL, NEW_CALL, "调用处去掉已领状态")
    text = rep(text, OLD_HANDLER, NEW_HANDLER, "处理器去掉一次性拦截，金额 100")
    # 剩下的 200 出处：另一处按钮文案在 birth 模块之外（若有）
    for old, new, label in [
        ("grantLegacyJade(selectedRole,draftSlot,200)", "grantLegacyJade(selectedRole,draftSlot,100)", "另处发放金额"),
        ("本档轮回玉+200", "本档轮回玉+100", "另处提示文案"),
    ]:
        n = text.count(old)
        if n:
            text = rep(text, old, new, label, n)

    for banned in ("jadead", "adJadeUsed", "markAdJade", "本档已领取", "每档一次", "200轮回玉", "+200"):
        if banned in text:
            raise SystemExit(f"[ABORT] 仍有残留：{banned}")
    ok("残留检查", "jadead / 一次性文案 / 200 全部清除")
    if text.count("领取100轮回玉") < 1 or text.count("grantLegacyJade(selectedRole,draftSlot,100)") < 1:
        raise SystemExit("[ABORT] 100 未落到位")
    ok("金额检查", "单次 100 已生效")

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
