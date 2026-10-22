#!/usr/bin/env python3
"""V90.59: correct combat save roundtrips, 4 early upgrades, XP carry.

Source: pinned V90.58 HTML release. Exact-once modifications and independent output.
The early-game zone-gap penalty is intentionally NOT changed.
"""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
BASE=ROOT / 'releases/山野修仙记_V90.58_跨境与旧档补偿闭环版.html'
OUT=ROOT / 'releases/山野修仙记_V90.59_存档晋升与修为继承版.html'
BASE_SHA='BD61E4275769CBFFE10E007DB9AD21C6425CB1E4B584F700F797E92ED99A89B3'
assert hashlib.sha256(BASE.read_bytes()).hexdigest().upper()==BASE_SHA, 'V90.58 基线哈希不符'
s=BASE.read_text(encoding='utf8')

def rep(old,new,label):
    global s
    n=s.count(old)
    assert n==1, f'{label}: expected exactly 1 found {n}'
    s=s.replace(old,new,1)

def segment(before,after,new,label):
    global s
    assert s.count(before)==1 and s.count(after)==1, f'{label} boundary mismatch'
    a=s.index(before);b=s.index(after,a+len(before));assert b>a
    s=s[:a]+new+s[b:]

rep('V90.58 · 跨境与旧档补偿闭环','V90.59 · 存档晋升与修为继承','title')
rep("subtitle='人妖异途 · V90.58'","subtitle='人妖异途 · V90.59'",'subtitle')
rep('V90.58 · ${game.character.name}','V90.59 · ${game.character.name}','settings')
rep('山野修仙记_V90.58_本机飞升资质榜.json','山野修仙记_V90.59_本机飞升资质榜.json','leaderboard')

# Normalization is a pure function, not a method on QGame. Retain the *actual*
# fight snapshot, including the max HP scaling applied when fight started.
rep('const training=t===\'dummy\',repeat=!!o.combat.repeat,maxHp=Math.round(e.hp*(repeat?1.25:1));',
'''const training=t==='dummy',repeat=!!o.combat.repeat;
   const gap=Math.max(0,Math.min(12,n.zone+2)-Math.min(12,Math.ceil(n.level/3)));
   const expectedMaxHp=Math.round(e.hp*(repeat?1.25:1)/Math.max(.20,1-.08*gap));
   const maxHp=Number.isSafeInteger(o.combat.maxHp)&&o.combat.maxHp>=1&&o.combat.maxHp<=100000000?o.combat.maxHp:expectedMaxHp;
   const savedAttack=Number.isSafeInteger(o.combat.atk)&&o.combat.atk>=0&&o.combat.atk<=100000000?o.combat.atk:Math.round(e.atk*(repeat?1.25:1)*(1+.10*gap));''',
'combat maxHp + zone gap')
rep('atk:Math.round(e.atk*(repeat?1.25:1)*this.enemyBoost),armor:e.armor,turn:integer(o.combat.turn',
    'atk:savedAttack,armor:e.armor,turn:integer(o.combat.turn','combat attack snapshot')
rep('n.xp=integer(o.xp,0,Math.max(1,Math.round(D.REALM_BASE[Math.min(11,Math.ceil(n.level/3)-1)]*D.STAGE_MULT[((n.level-1)%3)])-1));',
    'n.xp=integer(o.xp,0,Number.MAX_SAFE_INTEGER);','save overflow preserved')

# Use one progression routine from XP events and after crossing a realm. A large
# accrued surplus promotes across early and middle stages, but never skips an
# active realm boundary; 36 is a LEVEL cap only, not an XP cap.
segment(' xp(amount){\n',' // 功法可先获残卷，达到学习条件后在洞府参悟；不直接改面板属性。', ''' advanceXpStages(){
  let broke=0;
  while(this.s.level<36&&this.s.xp>=this.required){
   if(this.stageIndex===3){
    if(this.s.pendingTribulation!==this.s.level)this.log('本境后期已圆满 · 可'+(this.realmIndex<=4?'晋升':'渡劫'),'good');
    this.s.pendingTribulation=this.s.level;
    break;
   }
   const need=this.required;
   this.s.xp-=need;
   this.s.level++;broke++;
   this.syncMajor();
   const st=D.statsForLevel(this.s.level);
   if(st){
    const hpRatio=this.s.maxHp>0?this.s.hp/this.s.maxHp:1;
    this.s.maxHp=st.hp;this.s.attack=st.atk;this.s.maxSpirit=st.spirit;
    this.s.hp=Math.min(this.s.maxHp,Math.max(1,Math.round(this.s.maxHp*hpRatio)));
    this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit);
   }
   const years=D.LIFE.breakthroughYears[this.s.level]||0;
   if(years){this.s.life.left+=years*D.LIFE.yearMinutes;this.log('突破增寿 '+years+'年','good');}
   this.log('突破 · '+this.realm,'good');
  }
  this.s.daoXp=0;
  return broke;
 }
 xp(amount){
  if(this.s.ended||!Number.isFinite(amount)||amount<=0)return;
  const exact=amount*(1+this.birthEffects.xp/100)+this.s.xpCarry;
  const gain=Math.floor(exact+1e-10);
  this.s.xpCarry=Math.max(0,exact-gain);
  this.s.xp=Math.min(Number.MAX_SAFE_INTEGER,this.s.xp+gain);
  return this.advanceXpStages();
 }
''','XP overflow + progression')
segment(' breakthrough(){\n',' // P10: optional final thunder ordeal beside the ORIGINAL ascension interface.', ''' breakthrough(){
  if(this.s.combat)return this.fail('斗法中无法晋升或渡劫');
  if(this.s.ascended)return this.fail('飞升已成，仙界待后续版本开启');
  if(this.s.level>=36)return this.fail('已在渡劫后期，飞升天门将在大劫中开启');
  if(this.stageIndex!==3)return this.fail('需先修到本境后期圆满才能破境');
  const need=this.required;
  if(this.s.xp<need)return this.fail('本段修为未满：'+this.s.xp+'/'+need);
  if(!this.atCamp)return this.fail('需回本境洞府静修破境');
  const early=this.realmIndex<=4;
  // Four early realm boundaries (realm1→2 ... realm4→5): instant promotion,
  // no damage, no guard pills, no hunger tick, no accidental old tribulation.
  let damage=0,usedPills=0;
  if(!early){
   const preview=this.tribPreview(false);
   damage=preview.damage;
   if(!preview.safe)return this.fail('渡劫需气血至少 '+(damage+preview.survivalDamage+1)+'（含额外生存损耗 '+preview.survivalDamage+'），当前 '+this.s.hp+'；先休整再来');
   usedPills=this.tribPills;
   if(!this.tick(240,5,5,0))return {ok:false};
   this.s.hp-=damage;
   if(this.s.hp<=0){this.collapse();return this.note('渡劫失利 · 重伤折寿','warn');}
   if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);
  }
  this.s.xp-=need;
  this.s.level++;
  this.syncMajor();
  this.s.unlocked=unlockedFromProgress(this.s);
  this.s.pendingTribulation=0;
  const st=D.statsForLevel(this.s.level);
  if(st){this.s.maxHp=st.hp;this.s.maxSpirit=st.spirit;this.s.attack=st.atk;}
  this.s.hp=Math.min(this.s.maxHp,this.s.hp);
  this.s.spirit=this.s.maxSpirit;
  this.s.life.left+=3*D.LIFE.yearMinutes;
  // Surplus XP remains available and can complete early/middle stages of the
  // new realm immediately, but stops at the next active boundary.
  this.advanceXpStages();
  const name=early?'晋升成功':'渡劫成功';
  this.log(name+(early?' · 不扣血、不消耗护劫丹':' · 固定伤害−'+damage)+
    '，气血剩余 '+this.s.hp+'/'+this.s.maxHp+'，延寿3年','good');
  return this.note('成功进入'+this.realm+' · 气血 '+this.s.hp+'/'+this.s.maxHp,'ok','unlock');
 }

''','breakthrough 4+7 split')

# Interface: early upgrade is deliberately a different panel with no damage UI.
rep("const trialName=s.ascended?'飞升已成':s.level>=36?'飞升天门':'渡劫 · 入下一境';",
    "const trialName=s.ascended?'飞升已成':s.level>=36?'飞升天门':game.realmIndex<=4?'晋升 · 入下一境':'渡劫 · 入下一境';",'cultivate entry name')
rep("game.stageIndex===3?(s.xp>=game.required?'后期圆满 · 可渡劫':`修为 ${s.xp}/${game.required}`):",
    "game.stageIndex===3?(s.xp>=game.required?'后期圆满 · 可'+(game.realmIndex<=4?'晋升':'渡劫'):`修为 ${s.xp}/${game.required}`):",'cultivate entry label')
rep("const max=p.final&&s.level===36;\n add('修为阶段'", "const max=p.final&&s.level===36,early=!max&&p.index<=4;\n add('修为阶段'",'prog rows early flag')
rep(" }else{\n  add('当前洞府',game.atCamp,game.atCamp?'已在本境洞府':game.camp?'需返回本境洞府':'本境未建洞府');\n }\n if(p.stage===3&&s.xp>=p.need){",
    " }else{\n  add('当前洞府',game.atCamp,game.atCamp?'已在本境洞府':game.camp?'需返回本境洞府':'本境未建洞府');\n  if(early)add('晋升方式',true,'直接晋升，不扣血、不使用护劫丹');\n }\n if(!early&&p.stage===3&&s.xp>=p.need){",'skip early harm in condition rows')
rep("return {label:'继续修炼',hint:`${game.realm} · 修为 ${s.xp}/${p.need}；修满初/中期自动进阶，后期圆满后须主动渡劫`,act:null};",
    "return {label:'继续修炼',hint:`${game.realm} · 修为 ${s.xp}/${p.need}；修满初/中期自动进阶，后期圆满后须主动${p.index<=4?'晋升':'渡劫'}`,act:null};",'progress text dynamic')
rep(" const check=game.tribPreview(atFinal);\n if(!check.safe)"," if(!atFinal&&p.index<=4)return {label:'晋升下一境',hint:'无需渡劫扣血或护劫丹，保留本段多余修为',act:'breakthrough'};\n const check=game.tribPreview(atFinal);\n if(!check.safe)",'early button no trib')
rep(" const where=final?(s.zone===11&&game.land()==='gate'):(game.atCamp);\n const conditions=progRows('current');",
" const where=final?(s.zone===11&&game.land()==='gate'):(game.atCamp);\n if(!final&&game.realmIndex<=4){\n  const rows=progRows('current'),next=progNext('current'),canAct=next.act==='breakthrough';\n  return `<section class=\"trial-page v959-upgrade\"><div class=\"trial-intro\"><small>第 ${game.realmIndex}/12 境 · ${esc(game.realm)}</small><h3>直接晋升 · 下一境</h3><p>前四次破境不需要渡雷劫，不扣气血，不使用护劫丹。修为超额部分会带入下一境。</p></div><div class=\"stat-chips\"><span>当前气血 ${s.hp}/${s.maxHp}</span><span>修为 ${s.xp}/${game.required}</span><span>护劫丹无需消耗</span></div><div class=\"prog-rows\">${rows.map(r=>`<div class=\"prog-row ${r.pass?'ok':'no'}\"><span class=\"prog-mark\">${r.pass?'✓':'·'}</span><span class=\"prog-label\">${esc(r.label)}</span><span class=\"prog-val\">${esc(r.text)}</span></div>`).join('')}</div><p class=\"trial-note\">${esc(next.hint)}</p><button class=\"btn ${canAct?'primary':''}\" data-a=\"breakthrough\" ${canAct?'':'disabled'}>${canAct?'晋升下一境':esc(next.label)}</button></section>`;\n }\n const conditions=progRows('current');",'separate promotion panel')
rep("if(s.level<36&&game.stageIndex===3&&s.xp>=game.required)return '<button data-a=\"rest\" data-mode=\"field\">调息</button><button data-a=\"panel\" data-name=\"quest\" class=\"important\">查看渡劫指引</button>';",
"if(s.level<36&&game.stageIndex===3&&s.xp>=game.required)return '<button data-a=\"rest\" data-mode=\"field\">调息</button><button data-a=\"panel\" data-name=\"quest\" class=\"important\">查看'+(game.realmIndex<=4?'晋升':'渡劫')+'指引</button>';",'quest ready shortcut')
rep("parts.push(s.level===36?'最终渡劫后期已满：平定十二境，携带劫雷晶×3与天门符×2，到渡劫天门界碑承受第十二次固定伤害终劫。':'当前后期已圆满：在本境自己的洞府进入【修炼 → 渡劫】，准备气血与护劫丹；不需要道行或旧版三重试炼。');",
"parts.push(s.level===36?'最终渡劫后期已满：平定十二境，携带劫雷晶×3与天门符×2，到渡劫天门界碑承受第十二次固定伤害终劫。':game.realmIndex<=4?'当前后期已圆满：在本境自己的洞府进入【修炼 → 晋升】，不扣血、不使用护劫丹，多余修为带入下一境。':'当前后期已圆满：在本境自己的洞府进入【修炼 → 渡劫】，准备气血与护劫丹；不需要道行或旧版三重试炼。');",'manual stage 3')
rep("else parts.push('当前'+game.realm+'，修为 '+s.xp+'/'+game.required+'。初/中期修满自动升段，后期圆满须回本境洞府主动渡劫。');",
"else parts.push('当前'+game.realm+'，修为 '+s.xp+'/'+game.required+'。初/中期修满自动升段，后期圆满须回本境洞府主动'+(game.realmIndex<=4?'晋升':'渡劫')+'。');",'manual stages')
rep("out.detail='本段修为已修满。返回当前所在境域自己的洞府，在「洞府 → 修炼 → 渡劫」承受固定伤害；不再要求道行或三重试炼。';",
"out.detail=game.realmIndex<=4?'本段修为已修满。返回本境洞府，在「洞府 → 修炼 → 晋升」直接进入下一境，不扣血、不消耗护劫丹，剩余修为带入下一境。':'本段修为已修满。返回当前所在境域自己的洞府，在「洞府 → 修炼 → 渡劫」承受固定伤害；不再要求道行或三重试炼。';",'quest ready description')
rep("out.note='本次伤害 '+game.tribDamage+' · 气血 '+s.hp+'/'+s.maxHp;",
"out.note=game.realmIndex<=4?'直接晋升 · 不扣血 · 修为 '+s.xp+'/'+game.required:'本次伤害 '+game.tribDamage+' · 气血 '+s.hp+'/'+s.maxHp;",'quest ready note')
rep("out.action=!camp?action('在本境筑庐','panel',{panel:'camp'}):here?action('进入渡劫条件页','panel',{panel:'cultivate-trial'}):action('返回本境洞府','map',{x:camp.pos.x,y:camp.pos.y});",
"out.action=!camp?action('在本境筑庐','panel',{panel:'camp'}):here?action(game.realmIndex<=4?'查看晋升条件':'进入渡劫条件页','panel',{panel:'cultivate-trial'}):action('返回本境洞府','map',{x:camp.pos.x,y:camp.pos.y});",'quest ready button')
rep("out.short=game.realm+' · 可准备渡劫';return out;",
"out.short=game.realm+' · 可'+(game.realmIndex<=4?'晋升':'渡劫');return out;",'quest ready short')
rep("out.detail=`当前 ${game.realm}，修为 ${s.xp}/${game.required}。初/中期修满自动升段，后期圆满回本境洞府渡劫；可探索旧境采集。`;",
"out.detail=`当前 ${game.realm}，修为 ${s.xp}/${game.required}。初/中期修满自动升段，后期圆满回本境洞府${game.realmIndex<=4?'直接晋升':'渡劫'}；超额修为保留，可探索旧境采集。`;",'quest ordinary progress')
rep("<small>高境关卡通关后还需要在本境洞府完成主动破境。</small>",
"<small>前四境圆满直接晋升，第五境起圆满须渡劫；最后在飞升天门应最终劫。</small>",'world progress')
rep("<h3>首次试玩建议</h3>","<h3>首次试玩建议</h3>",'safe no-op') if False else None
rep("后期圆满则须在本境洞府主动渡劫。旧的道行刻度", "后期圆满须在本境洞府破境：第1至4境直接晋升，第5境起渡劫。旧的道行刻度",'help narrative 1')
rep("境界渡劫需要后期圆满、本境洞府及足够气血。", "第1至4境后期圆满在洞府直接晋升、不扣气血；第5境起渡劫需要后期圆满、本境洞府及足够气血。",'help narrative 2')
rep("后期圆满在本境洞府承受一次固定伤害渡劫；不再需要", "第1至4境直接晋升、第5境起在洞府承受固定伤害渡劫；不再需要",'rebuild narrative 1')
rep("后期修满后渡劫，渡劫后期圆满可挑战", "第1至4境后期修满直接晋升、第5境起渡劫，渡劫后期圆满可挑战",'rebuild narrative 2')
rep("到后期圆满时返回本境洞府，通过一次固定伤害判定渡劫。", "到后期圆满时返回本境洞府，前四境直接晋升，第五境起按固定伤害判定渡劫。",'rebuild narrative 3')
rep("'cultivate-trial':'破境条件'","'cultivate-trial':'晋升与渡劫条件'",'panel header')
# Fall through: the zone gap formula above (zone+2 vs realmIndex) is immutable.
assert "const zoneRealm=Math.min(12,Math.max(1,Number(this.s.zone)+2));" in s
assert "return Math.max(0,zoneRealm-self);" in s
assert s.count('<script') == BASE.read_text(encoding='utf8').count('<script')
out=s.replace('\n','\r\n').encode('utf8')
OUT.write_bytes(out)
(ROOT/'index.html').write_bytes(out)
print('V90.59 emitted:',len(out),'bytes; sha256',hashlib.sha256(out).hexdigest().upper())
