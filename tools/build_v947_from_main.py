#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.46 -> V90.47：护劫丹（渡劫减伤道具，每颗 -15%，最多 2 颗）

规则：
  · 背包里的「护劫丹」自动参与渡劫计算：每颗减伤 15%，最多计 2 颗（-30%）
  · 渡劫成功后消耗掉实际生效的丹药
  · 界面：破境条件页的「渡劫消耗」下方显示「护劫丹 2 颗 · 减伤 30%」
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.46_渡劫扣血.html"
OUT_NAME = "山野修仙记_V90.47_护劫丹.html"
BASE_SHA = "18A2ED3A78B16F9C86111C72483DDFB90D4102A1595CDCA5CED549F8E62CE72B"

OLD_DMG = (" get tribDamage(){const r={5:.70,6:.75,7:.80,8:.85,9:.90,10:.95,11:1.00}[this.s.zone]||.70;\n"
           "  return Math.max(1,Math.round(this.s.maxHp*r));}")

NEW_DMG = (" /* V90.47 护劫丹：每颗减伤 15%，最多 2 颗 */\n"
           " get tribPills(){return Math.min(2,Math.max(0,Math.round(Number((this.s.inv||{}).guardPill)||0)));}\n"
           " get tribReduce(){return this.tribPills*.15;}\n"
           " get tribDamage(){const r={5:.70,6:.75,7:.80,8:.85,9:.90,10:.95,11:1.00}[this.s.zone]||.70;\n"
           "  return Math.max(1,Math.round(this.s.maxHp*r*(1-this.tribReduce)));}")

ITEM_ANCHOR = "ITEMS.lifespanPill="
ITEM_NEW = ("ITEMS.guardPill={name:'护劫丹',wt:1,type:'food',effect:'渡劫减伤 15%，最多同时生效 2 颗（无寿元效果）'};\n"
            "RECIPES.push({id:'guardPill',name:'护劫丹',type:'丹药',cost:{rune:2,star:1,herb:3},item:'guardPill',home:true,room:'alchemy',tier:2,zone:2});\n")


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

    text = rep(text, "<title>山野修仙记 V90.46 · 渡劫扣血</title>",
               "<title>山野修仙记 V90.47 · 护劫丹</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.46'", "subtitle='人妖异途 · V90.47'", "副标题版本号")
    text = rep(text, "V90.46 · ${game.character.name}", "V90.47 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.46_本机飞升资质榜.json", "山野修仙记_V90.47_本机飞升资质榜.json",
               "导出文件名")

    text = rep(text, OLD_DMG, NEW_DMG, "tribDamage 接入护劫丹")
    text = rep(text, ITEM_ANCHOR, ITEM_NEW + ITEM_ANCHOR, "新增护劫丹物品与配方")

    # 渡劫成功消耗丹药
    text = rep(text, "  this.spend(cost);this.s.daoXp=0;this.s.major=this.s.zone-3;",
               "  const usedPills=this.tribPills;\n  this.spend(cost);this.s.daoXp=0;this.s.major=this.s.zone-3;\n"
               "  if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);",
               "渡劫成功消耗护劫丹")

    # 破境条件页展示
    text = rep(text, "rows.push(ok('道行', s.daoXp>=p.st.needDao, s.daoXp+'/'+p.st.needDao));",
               "rows.push(ok('道行', s.daoXp>=p.st.needDao, s.daoXp+'/'+p.st.needDao));\n"
               " rows.push(ok('渡劫消耗', s.hp>=game.tribDamage, '气血 '+game.tribDamage+' / 当前 '+s.hp+(game.tribPills?'（护劫丹 '+game.tribPills+' 颗 · 减伤 '+Math.round(game.tribReduce*100)+'%）':'')));",
               "破境条件页展示渡劫消耗")

    for needle in ("get tribPills()", "ITEMS.guardPill", "usedPills", "渡劫消耗"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "丹药/减伤/消耗/展示 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
