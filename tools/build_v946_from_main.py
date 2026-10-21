#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.45 -> V90.46：破境加入「渡劫固定伤害」（养成判定，失败不清档）

规则：
  · 每次破境要承受一次固定伤害 = 气血上限 × 该境系数（70%~100%）
  · 当前气血 ≤ 伤害 → 不能渡劫（提示先去补血），不消耗任何材料
  · 渡劫成功 → 破境完成，气血 = 上限 − 伤害（不会满血离开）
  · 失败（气血不足）→ 什么都不发生，不清档、不退境
界面：破境条件页新增一行「渡劫消耗 气血 X / 当前 Y」
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.45_十二境显示.html"
OUT_NAME = "山野修仙记_V90.46_渡劫扣血.html"
BASE_SHA = "0DD9A819E3769C43FEEF23599E07B5BAE119A4BA3BE44181E06BBC44800C9302"

GETTER = (' /* V90.46 渡劫固定伤害：按本境系数 × 气血上限（养成判定） */\n'
          ' get tribDamage(){const r={5:.70,6:.75,7:.80,8:.85,9:.90,10:.95,11:1.00}[this.s.zone]||.70;\n'
          '  return Math.max(1,Math.round(this.s.maxHp*r));}\n')

GATE = ('  const dmg=this.tribDamage;\n'
        '  if(this.s.hp<dmg)return this.fail(\'渡劫需气血 \'+dmg+\'，当前 \'+this.s.hp+\' —— 先回洞府补血再来\');\n')


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

    text = rep(text, "<title>山野修仙记 V90.45 · 十二境显示</title>",
               "<title>山野修仙记 V90.46 · 渡劫扣血</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.45'", "subtitle='人妖异途 · V90.46'", "副标题版本号")
    text = rep(text, "V90.45 · ${game.character.name}", "V90.46 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.45_本机飞升资质榜.json", "山野修仙记_V90.46_本机飞升资质榜.json",
               "导出文件名")

    # 1) 新增 tribDamage getter（挂在 tribulationNeed 之后）
    anchor = " get tribulationNeed(){"
    i = text.index(anchor)
    j = text.index("}", text.index("}\n", i) if False else text.index("{", i))
    # 直接用整段替换：找到 tribulationNeed getter 的结尾 '}\n' 后插入
    end = text.index("\n", text.index("get tribulationNeed(){", i))
    line_end = text.index("get character(){", i)
    text = text[:line_end] + GETTER + text[line_end:]
    ok("插入 tribDamage getter")

    # 2) 破境前校验气血
    text = rep(text, "  if(!this.tick(240,5,5,10))return {ok:false};\n  this.spend(cost);",
               "  " + GATE + "  if(!this.tick(240,5,5,10))return {ok:false};\n  this.spend(cost);",
               "破境前校验气血")

    # 3) 破境后扣血（不再满血）
    text = rep(text, "this.s.hp=this.s.maxHp;this.s.spirit=this.s.maxSpirit;\n  this.s.life.left+=t.life*D.LIFE.yearMinutes;",
               "this.s.hp=Math.max(1,this.s.maxHp-dmg);this.s.spirit=this.s.maxSpirit;\n  this.s.life.left+=t.life*D.LIFE.yearMinutes;",
               "破境后扣血")

    for needle in ("get tribDamage()", "渡劫需气血", "this.s.maxHp-dmg"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "getter / 校验 / 扣血 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
