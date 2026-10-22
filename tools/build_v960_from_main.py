#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.59 -> V90.60：破境分流（金丹前晋升 / 金丹起渡劫）+ 修为可超额累积

需求（产品）：
  1. 只有金丹（境序 ≥6）及以上的跨境才需要渡雷劫；凡人~筑基（境1→5）直接「晋升」
  2. 修为可以超过当前段上限累积；破境只扣掉本段需求，溢出保留

实现：
  · 新增 get needsTribulation —— 目标境序 ≥6 才为真
  · xp()：后期修满时不再把 xp 夹到 required（保留溢出），也不再在 36 段夹紧
  · breakthrough()：双分支；两种分支都改为 xp -= required（不再清零）
  · 修炼面板：按 needsTribulation 显示「晋升」页或「渡劫」页
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.59_战斗存档修复.html"
OUT_NAME = "山野修仙记_V90.60_破境分流.html"
BASE_SHA = "56889E0293CE988CC9A3FCBD3E92C0B3A8AC025022B394F53E01B6810B36DE6B"

GETTER = ''' /* V90.60 金丹（境序 6）起才渡雷劫；凡人~筑基的直接晋升 */
 get needsTribulation(){return Math.min(12,Math.ceil(this.s.level/3)+1)>=6;}
'''

OLD_BREAK = ''' breakthrough(){
  if(this.s.combat)return this.fail('斗法中无法渡劫');
  if(this.s.ascended)return this.fail('飞升已成，仙界待后续版本开启');
  if(this.s.level>=36)return this.fail('已在渡劫后期，飞升天门将在大劫中开启');
  if(this.stageIndex!==3)return this.fail('需先修到本境后期圆满才能渡劫');
  if(this.s.xp<this.required)return this.fail('本段修为未满：'+this.s.xp+'/'+this.required);
  if(!this.atCamp)return this.fail('需回本境洞府静修渡劫');
  const dmg=this.tribDamage;
  if(this.s.hp<dmg)return this.fail('渡劫需气血 '+dmg+'，当前 '+this.s.hp+' —— 先回洞府补血再来');
  const usedPills=this.tribPills;
  if(!this.tick(240,5,5,0))return {ok:false};
  if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);
  this.s.level++;this.syncMajor();this.recalcUnlocked();this.s.xp=0;this.s.pendingTribulation=0;
  const _st=D.statsForLevel(this.s.level);
  {const _p=D.applyPills(_st,this.s);if(_p){this.s.maxHp=_p.hp;this.s.maxSpirit=_p.spirit;this.s.attack=_p.atk;}}
  this.s.hp=Math.max(1,this.s.maxHp-dmg);this.s.spirit=this.s.maxSpirit;
  this.s.life.left+=3*D.LIFE.yearMinutes;
  this.log('渡劫成功 · '+this.realm+'，延寿3年','good');
  void this.s.daoXp;
  return this.note('渡过'+this.realm+' · 气血剩余 '+this.s.hp+'/'+this.s.maxHp,'ok','unlock');
 }'''

NEW_BREAK = ''' breakthrough(){
  if(this.s.combat)return this.fail('斗法中无法破境');
  if(this.s.ascended)return this.fail('飞升已成，仙界待后续版本开启');
  if(this.s.level>=36)return this.fail('已在渡劫后期，飞升天门将在大劫中开启');
  if(this.stageIndex!==3)return this.fail('需先修到本境后期圆满才能破境');
  const need=this.required;
  if(this.s.xp<need)return this.fail('本段修为未满：'+this.s.xp+'/'+need);
  if(!this.atCamp)return this.fail('需回本境洞府静心破境');
  const trib=this.needsTribulation;
  let dmg=0;
  if(trib){
   dmg=this.tribDamage;
   if(this.s.hp<dmg)return this.fail('渡劫需气血 '+dmg+'，当前 '+this.s.hp+' —— 先回洞府补血再来');
   const usedPills=this.tribPills;
   if(!this.tick(240,5,5,0))return {ok:false};
   if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);
  }else{
   if(!this.tick(60,2,2,0))return {ok:false};
  }
  /* V90.60 只扣本段需求：溢出的修为留在身上 */
  this.s.xp=Math.max(0,this.s.xp-need);
  this.s.level++;this.syncMajor();this.recalcUnlocked();this.s.pendingTribulation=0;
  const _st=D.statsForLevel(this.s.level);
  {const _p=D.applyPills(_st,this.s);if(_p){this.s.maxHp=_p.hp;this.s.maxSpirit=_p.spirit;this.s.attack=_p.atk;}}
  if(trib){
   this.s.hp=Math.max(1,this.s.maxHp-dmg);this.s.spirit=this.s.maxSpirit;
   this.s.life.left+=3*D.LIFE.yearMinutes;
   this.log('渡劫成功 · '+this.realm+'，延寿3年','good');
   return this.note('渡过'+this.realm+' · 气血剩余 '+this.s.hp+'/'+this.s.maxHp,'ok','unlock');
  }
  /* 晋升：不损气血、不耗护劫丹；同境界内若修为仍满，自动继续补齐段位 */
  this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit);
  let more=0;
  while(this.s.level<36&&this.s.xp>=this.required&&this.stageIndex!==3){
   const n2=this.required;this.s.xp-=n2;this.s.level++;more++;this.syncMajor();
   const st2=D.statsForLevel(this.s.level);
   if(st2){const p2=D.applyPills(st2,this.s);if(p2){this.s.maxHp=p2.hp;this.s.maxSpirit=p2.spirit;this.s.attack=p2.atk;}}
  }
  if(this.s.stageIndex===3&&this.s.xp>=this.required)this.s.pendingTribulation=this.s.level;
  const years=D.LIFE.breakthroughYears[this.s.level]||0;
  if(years)this.s.life.left+=years*D.LIFE.yearMinutes;
  this.log('晋升 · '+this.realm+(more?'（连升 '+more+' 段）':'')+'，余修为 '+this.s.xp,'good');
  return this.note('晋升'+this.realm+' · 余修为 '+this.s.xp,'ok','unlock');
 }'''

OLD_UI = '''  const dmg=game.tribDamage,maxHp=s.maxHp,left=Math.max(0,maxHp-dmg),pct=Math.round(left/maxHp*100);
  const full=s.stageIndex===3&&s.xp>=game.required;
  const ready=full&&game.atCamp&&s.hp>=dmg;
  advance=`<h3>渡劫 · 由${game.realm}入下一境</h3>`+
   `<div class="stat-chips"><span>本次伤害 ${dmg}</span><span>你的气血上限 ${maxHp}</span><span>渡劫后剩余 ${pct}%</span></div>`+
   `<p class="muted">本境后期修满即可渡劫。伤害是固定的养成判定：气血不足请先回洞府补给；失败只重伤折寿，不清档。</p>`+
   (game.tribPills?`<p class="micro">护劫丹 ${game.tribPills} 颗 · 减伤 ${Math.round(game.tribReduce*100)}%（每颗 15%，最多 2 颗）</p>`:'')+
   `<div class="stat-chips"><span>当前修为 ${s.xp}/${game.required}</span><span>当前气血 ${s.hp}/${maxHp}</span></div>`+
   `<button class="btn ${ready?'primary':''}" data-a="breakthrough">${full?(game.atCamp?(s.hp>=dmg?'渡劫':'气血不足'):'需回洞府'):'修为未满 · 需后期圆满'}</button>`;'''

NEW_UI = '''  const full=s.stageIndex===3&&s.xp>=game.required;
  if(game.needsTribulation){
   const dmg=game.tribDamage,maxHp=s.maxHp,left=Math.max(0,maxHp-dmg),pct=Math.round(left/maxHp*100);
   const ready=full&&game.atCamp&&s.hp>=dmg;
   advance=`<h3>渡劫 · 由${game.realm}入下一境</h3>`+
    `<div class="stat-chips"><span>本次伤害 ${dmg}</span><span>你的气血上限 ${maxHp}</span><span>渡劫后剩余 ${pct}%</span></div>`+
    `<p class="muted">金丹之后才入雷劫：本境后期修满即可渡劫。伤害是固定的养成判定，气血不足请先回洞府补给；失败只重伤折寿，不清档。</p>`+
    (game.tribPills?`<p class="micro">护劫丹 ${game.tribPills} 颗 · 减伤 ${Math.round(game.tribReduce*100)}%（每颗 15%，最多 2 颗）</p>`:'')+
    `<div class="stat-chips"><span>当前修为 ${s.xp}/${game.required}</span><span>当前气血 ${s.hp}/${maxHp}</span></div>`+
    `<button class="btn ${ready?'primary':''}" data-a="breakthrough">${full?(game.atCamp?'渡劫':'需回洞府'):'修为未满 · 需后期圆满'}</button>`;
  }else{
   const ready=full&&game.atCamp;
   const spare=Math.max(0,s.xp-game.required);
   advance=`<h3>晋升 · 由${game.realm}入下一境</h3>`+
    `<div class="stat-chips"><span>所需修为 ${game.required}</span><span>当前修为 ${s.xp}</span><span>溢出保留 ${spare}</span></div>`+
    `<p class="muted">金丹之前不入雷劫：后期修满即可直接晋升，不损气血、不耗护劫丹。修为可以超过上限，溢出的部分会留到下一段。</p>`+
    `<button class="btn ${ready?'primary':''}" data-a="breakthrough">${full?(game.atCamp?'晋升':'需回洞府'):'修为未满 · 需后期圆满'}</button>`;
  }'''


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

    text = rep(text, "<title>山野修仙记 V90.59 · 战斗存档修复</title>",
               "<title>山野修仙记 V90.60 · 破境分流</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.59'", "subtitle='人妖异途 · V90.60'", "副标题版本号")

    # 1) needsTribulation getter
    text = rep(text, " get stageIndex(){", GETTER + " get stageIndex(){", "插入 needsTribulation")

    # 2) 修为不再夹紧
    text = rep(text, "    this.s.xp=need;this.s.pendingTribulation=this.s.level;",
               "    this.s.pendingTribulation=this.s.level;", "后期不再夹紧修为")
    text = rep(text, "  if(this.s.level>=36)this.s.xp=Math.min(this.s.xp,this.required);",
               "  /* V90.60 修为可超额累积，36 段同样不夹紧 */", "满段不再夹紧修为")

    # 3) 破境双分支
    text = rep(text, OLD_BREAK, NEW_BREAK, "breakthrough 双分支 + 溢出保留")

    # 4) 面板分流
    text = rep(text, OLD_UI, NEW_UI, "修炼面板晋升/渡劫分流")
    text = rep(text, "const trialName=s.ascended?'飞升已成':s.level>=36?'飞升天门':'渡劫 · 入下一境';",
               "const trialName=s.ascended?'飞升已成':s.level>=36?'飞升天门':(game.needsTribulation?'渡劫 · 入下一境':'晋升 · 入下一境');",
               "入口标题分流")
    text = rep(text, "   s.stageIndex===3?(s.xp>=game.required?'后期圆满 · 可渡劫':`修为 ${s.xp}/${game.required}`):",
               "   s.stageIndex===3?(s.xp>=game.required?(game.needsTribulation?'后期圆满 · 可渡劫':'后期圆满 · 可晋升'):`修为 ${s.xp}/${game.required}`):",
               "入口状态分流")

    for needle in ("get needsTribulation()", "const trib=this.needsTribulation;",
                   "修为可超额累积", "晋升 · 由${game.realm}入下一境"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "getter / 双分支 / 面板分流 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
