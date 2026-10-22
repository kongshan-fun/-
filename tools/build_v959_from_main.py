#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.58 -> V90.59：修复战斗中存档失败（「存储未成功，先导出当前进度」）

根因：V90.51 越级压制把 startBattle 的公式复制到了 normalize 里重建 combat 的位置，
      而 normalize 是普通函数，`this` 为 undefined →
      只要「战斗中存在档」就抛 Cannot read properties of undefined (reading 'enemyBoost')
      → persist() 捕获后弹出「存储未成功」。

修复：normalize 内部用 n.level / n.zone 自行推导 gap/boost/dampen，
      并让 maxHp 与 startBattle 同口径（÷ dampen），保证刷新前后对手数值一致。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.58_跨境解锁.html"
OUT_NAME = "山野修仙记_V90.59_战斗存档修复.html"
BASE_SHA = "B90FC795F0D05F874D5D998CBAB0DC56159A43E2E7683DE25260BA7A2F2C0740"

OLD = ("   const training=t==='dummy',repeat=!!o.combat.repeat,maxHp=Math.round(e.hp*(repeat?1.25:1));\n"
       "   n.combat={type:t,hp:integer(o.combat.hp,1,maxHp),maxHp,atk:Math.round(e.atk*(repeat?1.25:1)*this.enemyBoost),armor:e.armor,")

NEW = ("   const training=t==='dummy',repeat=!!o.combat.repeat;\n"
       "   /* V90.59 越级压制系数必须由 normalize 自己算：这里没有 this */\n"
       "   const _self=Math.min(12,Math.ceil(Math.max(1,Math.min(36,Math.round(n.level)||1))/3));\n"
       "   const _zr=Math.min(12,Math.max(1,Number(n.zone)+2));\n"
       "   const _gap=Math.max(0,_zr-_self);\n"
       "   const _boost=1+0.10*_gap,_damp=Math.max(0.20,1-0.08*_gap);\n"
       "   const maxHp=Math.round(e.hp*(repeat?1.25:1)/_damp);\n"
       "   n.combat={type:t,hp:integer(o.combat.hp,1,maxHp),maxHp,atk:Math.round(e.atk*(repeat?1.25:1)*_boost),armor:e.armor,")


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label):
    n = t.count(old)
    if n != 1:
        raise SystemExit(f"[ABORT] {label}: 命中 {n} 次")
    ok(label)
    return t.replace(old, new, 1)


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    ok("基线校验", f"{len(raw):,} B")
    text = raw.decode("utf-8").replace("\r\n", "\n")

    text = rep(text, "<title>山野修仙记 V90.58 · 跨境解锁</title>",
               "<title>山野修仙记 V90.59 · 战斗存档修复</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.58'", "subtitle='人妖异途 · V90.59'", "副标题版本号")
    text = rep(text, OLD, NEW, "normalize 战斗重建去掉 this.enemyBoost")

    if "this.enemyBoost" in text.split("startBattle(type")[0]:
        raise SystemExit("[ABORT] normalize 段仍残留 this.enemyBoost")
    for needle in ("_boost=1+0.10*_gap", "atk:Math.round(e.atk*(repeat?1.25:1)*_boost)"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "normalize 改由 n 推导系数")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
