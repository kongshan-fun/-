#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.56 -> V90.57：属性丹（培元丹 / 淬体丹）

按 docs/境界与修为阶定义.md §九：
  培元丹  永久 +2% 气血上限   每境最多 3 颗
  淬体丹  永久 +5 攻击        每境最多 3 颗
实现：
  · s.pillHp / s.pillAtk  —— 累计服用的颗数（永久，换境不清）
  · s.pillCnt{realm,hp,atk} —— 当前境的服用计数（换境自动清零）
  · D.applyPills(stats,s)   —— 三处属性重算点统一叠加，避免被表覆盖
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.56_渡劫改制.html"
OUT_NAME = "山野修仙记_V90.57_属性丹.html"
BASE_SHA = "A17BDDF3C3E05FBAF279733628FA2C7B88AF290DAD8745472E4F0057E2952C49"

HELPER = '''/* V90.57 属性丹：永久加成只在属性重算后叠加，避免被成长表覆盖 */
D.applyPills=function(st,s){
 if(!st)return st;
 const hpN=Math.max(0,Math.round(Number(s&&s.pillHp)||0));
 const atkN=Math.max(0,Math.round(Number(s&&s.pillAtk)||0));
 if(!hpN&&!atkN)return st;
 return {index:st.index,stage:st.stage,hp:Math.round(st.hp*(1+0.02*hpN)),atk:st.atk+5*atkN,spirit:st.spirit};
};
/* 当前境序（用于"每境最多 3 颗"的计数） */
D.realmIndexOf=function(s){
 const lv=Math.max(1,Math.min(36,Math.round(Number(s&&s.level)||1)));
 return Math.min(12,Math.ceil(lv/3));
};
'''

ITEMS = '''ITEMS.peiyuanPill={name:'培元丹',wt:1,type:'food',effect:'永久 +2% 气血上限，每境最多服 3 颗'};
RECIPES.push({id:'peiyuanPill',name:'培元丹',type:'丹药',cost:{herb:4,wood:2},item:'peiyuanPill',home:true,room:'alchemy',tier:1,zone:0});
ITEMS.cuitiPill={name:'淬体丹',wt:1,type:'food',effect:'永久 +5 攻击，每境最多服 3 颗'};
RECIPES.push({id:'cuitiPill',name:'淬体丹',type:'丹药',cost:{herb:3,ore:2},item:'cuitiPill',home:true,room:'alchemy',tier:1,zone:0});
'''

CONSUME = ''' if(id==='peiyuanPill'||id==='cuitiPill'){
  const realm=D.realmIndexOf(this.s);
  if(!this.s.pillCnt||typeof this.s.pillCnt!=='object')this.s.pillCnt={realm,hp:0,atk:0};
  const pc=this.s.pillCnt;
  if(pc.realm!==realm){pc.realm=realm;pc.hp=0;pc.atk=0;}
  const key=id==='peiyuanPill'?'hp':'atk';
  if((pc[key]||0)>=3)return this.fail('本境'+D.ITEMS[id].name+'已服满 3 颗，需渡劫后再服');
  this.s.inv[id]--;pc[key]=(pc[key]||0)+1;
  if(key==='hp')this.s.pillHp=(this.s.pillHp||0)+1;else this.s.pillAtk=(this.s.pillAtk||0)+1;
  const _bs=D.statsForLevel(this.s.level), _ps=D.applyPills(_bs,this.s);
  const _ratio=this.s.maxHp>0?this.s.hp/this.s.maxHp:1;
  if(_ps){this.s.maxHp=_ps.hp;this.s.maxSpirit=_ps.spirit;this.s.attack=_ps.atk;}
  this.s.hp=Math.min(this.s.maxHp,Math.max(1,Math.round(this.s.maxHp*_ratio)));
  const msg='服下'+D.ITEMS[id].name+' · 气血上限 '+this.s.maxHp+' · 攻击 '+this.s.attack+'（本境 '+pc[key]+'/3）';
  this.log(msg,'good');return this.note(msg,'ok');
 }
'''


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

    text = rep(text, "<title>山野修仙记 V90.56 · 渡劫改制</title>",
               "<title>山野修仙记 V90.57 · 属性丹</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.56'", "subtitle='人妖异途 · V90.57'", "副标题版本号")
    ok("设置页/导出名：本版无固定版本串，跳过")

    text = rep(text, "D.applyPills=function", "D.applyPills=function", "占位校验") if False else text

    # 1) 插入 helper（挂在 statsForLevel 之前）
    text = rep(text, "D.statsForLevel=function(level){", HELPER + "D.statsForLevel=function(level){",
               "插入 applyPills / realmIndexOf")

    # 2) 物品与配方
    text = rep(text, "ITEMS.lifespanPill=", ITEMS + "ITEMS.lifespanPill=", "新增两种属性丹与配方")

    # 3) 服用分支
    text = rep(text, " if(id==='lifespanPill'){", CONSUME + " if(id==='lifespanPill'){", "consume 增加属性丹分支")

    # 4) 三处属性重算叠加丹药加成
    text = rep(text, "  if(_st){n.maxHp=_st.hp;n.maxSpirit=_st.spirit;n.attack=_st.atk;}}",
               "  const _p=D.applyPills(_st,n);\n  if(_p){n.maxHp=_p.hp;n.maxSpirit=_p.spirit;n.attack=_p.atk;}}",
               "normalize 叠加")
    text = rep(text, "    this.s.maxHp=st.hp;this.s.attack=st.atk;this.s.maxSpirit=st.spirit;",
               "    {const _p=D.applyPills(st,this.s);\n     this.s.maxHp=_p.hp;this.s.attack=_p.atk;this.s.maxSpirit=_p.spirit;}",
               "升级叠加")
    text = rep(text, "  if(_st){this.s.maxHp=_st.hp;this.s.maxSpirit=_st.spirit;this.s.attack=_st.atk;}",
               "  {const _p=D.applyPills(_st,this.s);if(_p){this.s.maxHp=_p.hp;this.s.maxSpirit=_p.spirit;this.s.attack=_p.atk;}}",
               "渡劫叠加")

    for needle in ("D.applyPills=function", "D.realmIndexOf=function", "ITEMS.peiyuanPill", "ITEMS.cuitiPill",
                   "本境'+D.ITEMS[id].name+'已服满 3 颗"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "丹药/配方/服用/三处叠加 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
