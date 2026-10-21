#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.36 -> V90.37 构建器（战斗日志只显示「本次斗法」这一段）

基线：V90.36（字节哈希，按 CRLF 归一）

用户反馈：战斗界面中间的日志把探索/采集/吐纳那些也一起显示了，应该只显示
「从这场战斗开始到结束」这一段。

做法（不动存档结构主体，只加一个自增序号）：
  1. `log()` 给每条日志加 `seq`（自增；缺省时用「最新一条的 seq」续上，旧档也不会撞号）
  2. `startBattle()` 记下开战那条日志的 seq：`this.s.combat.logFrom = logs[0].seq`
  3. normalize 复制日志时保留 `seq`（原来是白名单重建，会丢字段）
  4. `renderCombatPanel()` 只取 `seq >= logFrom` 的条目；旧档/旧战斗没有 logFrom 时退回原行为

三条硬断言：基线哈希 / 替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.36_突破指引修复版.html"
OUT_NAME = "山野修仙记_V90.37_战斗日志分段版.html"
BASE_SHA = "90FB253809FFB0EAC68533E8A4DA79944B24E9B0AB465AB341EA92CCF6A3DA4B"

OLD_LOG = "log(msg,tone=''){this.s.logs.unshift({time:`${this.day}日 ${this.clock}`,msg,tone});this.s.logs=this.s.logs.slice(0,80);}"
NEW_LOG = ("log(msg,tone=''){const e={time:`${this.day}日 ${this.clock}`,msg,tone};"
           "this.s.logSeq=Math.max(this.s.logSeq||0,(this.s.logs[0]&&this.s.logs[0].seq)||0)+1;"
           "e.seq=this.s.logSeq;this.s.logs.unshift(e);this.s.logs=this.s.logs.slice(0,80);}")

OLD_START = "this.log(e.name+'拦住去路。');return this.note("
NEW_START = ("this.log(e.name+'拦住去路。');"
             "if(this.s.combat)this.s.combat.logFrom=(this.s.logs[0]&&this.s.logs[0].seq)||0;"
             "return this.note(")

OLD_NORM = "tone:['good','bad',''].includes(l.tone)?l.tone:''}))"
NEW_NORM = "tone:['good','bad',''].includes(l.tone)?l.tone:'',seq:integer(l.seq,0,1e9)}))"

OLD_LINES = " const lines=(s.logs||[]).slice(0,24).reverse();"
NEW_LINES = (" const from=b.logFrom||0;"
             " const src=from>0?(s.logs||[]).filter(l=>(l.seq||0)>=from):(s.logs||[]);"
             " const lines=src.slice(0,60).reverse();")


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

    text = rep(text, "<title>山野修仙记 V90.36 · 突破指引修复</title>",
               "<title>山野修仙记 V90.37 · 战斗日志分段</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.36'", "subtitle='人妖异途 · V90.37'", "副标题版本号")
    text = rep(text, "V90.36 · ${game.character.name}", "V90.37 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.36_本机飞升资质榜.json", "山野修仙记_V90.37_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.36：", "当前版本 V90.37：", "帮助页版本说明")

    text = rep(text, OLD_LOG, NEW_LOG, "log() 加自增序号")
    text = rep(text, OLD_START, NEW_START, "开战记下 logFrom")
    text = rep(text, OLD_NORM, NEW_NORM, "normalize 保留 seq")
    text = rep(text, OLD_LINES, NEW_LINES, "战斗日志按 logFrom 过滤")

    for needle, what in (("this.s.logSeq=Math.max", "日志序号"),
                         ("this.s.combat.logFrom=", "开战锚点"),
                         ("seq:integer(l.seq,0,1e9)", "存档保留 seq"),
                         ("const src=from>0?", "面板过滤")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "序号 / 锚点 / 存档 / 过滤 齐全")

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
