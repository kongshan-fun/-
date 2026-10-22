#!/usr/bin/env python3
"""V90.56 -> V90.57 reproducible offline build. Never modifies frozen V90.56 bytes."""
from pathlib import Path
import hashlib,re,sys
ROOT=Path(__file__).resolve().parents[1]
REL=ROOT/'releases'
BASE=REL/'山野修仙记_V90.56_渡劫改制.html'
OUT=REL/'山野修仙记_V90.57_渡劫主线修复与终劫闭环.html'
BASE_SHA='a17bddf3c3e05fbaf279733628fa2c7b88af290dad8745472e4f0057e2952c49'

def digest(x):return hashlib.sha256(x).hexdigest()
def replace(s,old,new,tag,n=1):
 hits=s.count(old)
 if hits!=n:raise RuntimeError(f'{tag} anchor count {hits} != {n}')
 return s.replace(old,new,n)
def block(s,start,end,new,tag):
 if s.count(start)!=1 or s.count(end)!=1: raise RuntimeError(f'{tag} start/end anchor count invalid')
 i=s.index(start);j=s.index(end,i+len(start))
 return s[:i]+new+'\n'+s[j:]
def read(p):return (ROOT/p).read_text(encoding='utf-8').strip('\r\n')

def build():
 original=BASE.read_bytes()
 if digest(original)!=BASE_SHA:raise RuntimeError('V90.56 frozen baseline SHA-256 mismatch: '+digest(original))
 s=original.decode('utf-8').replace('\r\n','\n')
 originalActions=set(re.findall(r'data-a="([a-z0-9-]+)"',s))
 s=replace(s,'<title>山野修仙记 V90.56 · 渡劫改制</title>','<title>山野修仙记 V90.57 · 渡劫主线与终劫闭环</title>','version title')
 s=replace(s,"subtitle='人妖异途 · V90.56'","subtitle='人妖异途 · V90.57'",'subtitle')
 s=replace(s,'V90.51 · ${game.character.name}','V90.57 · ${game.character.name}','settings version')
 s=replace(s,'山野修仙记_V90.51_本机飞升资质榜.json','山野修仙记_V90.57_本机飞升资质榜.json','leaderboard export')
 # StageIndex is a getter on QGame, not a property on game.s.
 s=replace(s,"s.stageIndex===3?(s.xp","game.stageIndex===3?(s.xp",'stage getter in cultivation overview')
 # Core: preview is read-only, includes real survival-time damage and next realm maxHP.
 marker="get character(){return B.profile(this.s.birth);}"
 preview='''/* The SAME read-only forecast drives labels, readiness and execution. */
 tribPreview(final=false){
  const travel=final?{minutes:180,hunger:4,water:4,spirit:8}:{minutes:240,hunger:5,water:5,spirit:0};
  const survival=this.survivalForecast(travel.minutes,travel.hunger,travel.water,travel.spirit);
  const damage=this.tribDamage, maxAfter=final?this.s.maxHp:(D.statsForLevel(this.s.level+1)?.hp||this.s.maxHp);
  const left=this.s.hp-damage-survival.damage;
  const hpAfter=Math.max(0,Math.min(maxAfter,left));
  return {damage,pills:this.tribPills,survivalDamage:survival.damage,hpAfter,maxAfter,
   percent:Math.round(hpAfter/maxAfter*100),safe:left>0,minutes:travel.minutes};
 }
'''
 s=replace(s,marker,preview+marker,'shared preview')
 before="""  const dmg=this.tribDamage;
  if(this.s.hp<dmg)return this.fail('渡劫需气血 '+dmg+'，当前 '+this.s.hp+' —— 先回洞府补血再来');
  const usedPills=this.tribPills;
  if(!this.tick(240,5,5,0))return {ok:false};
  if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);
  this.s.level++;this.syncMajor();this.s.xp=0;this.s.pendingTribulation=0;
  const _st=D.statsForLevel(this.s.level);
  if(_st){this.s.maxHp=_st.hp;this.s.maxSpirit=_st.spirit;this.s.attack=_st.atk;}
  this.s.hp=Math.max(1,this.s.maxHp-dmg);this.s.spirit=this.s.maxSpirit;
  this.s.life.left+=3*D.LIFE.yearMinutes;
  this.log('渡劫成功 · '+this.realm+'，延寿3年','good');
  void this.s.daoXp;
  return this.note('渡过'+this.realm+' · 气血剩余 '+this.s.hp+'/'+this.s.maxHp,'ok','unlock');"""
 after="""  const preview=this.tribPreview(false),dmg=preview.damage;
  if(!preview.safe)return this.fail('渡劫需气血至少 '+(dmg+preview.survivalDamage+1)+'（含额外生存损耗 '+preview.survivalDamage+'），当前 '+this.s.hp+'；先休整再来');
  const usedPills=this.tribPills;
  if(!this.tick(240,5,5,0))return {ok:false};
  /* Deduct absolute damage from actual CURRENT HP before increasing the realm cap. */
  this.s.hp-=dmg;
  if(this.s.hp<=0){this.collapse();return this.note('渡劫失利 · 重伤折寿','warn');}
  if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);
  this.s.level++;this.syncMajor();this.s.xp=0;this.s.pendingTribulation=0;
  const _st=D.statsForLevel(this.s.level);
  if(_st){this.s.maxHp=_st.hp;this.s.maxSpirit=_st.spirit;this.s.attack=_st.atk;}
  this.s.hp=Math.min(this.s.maxHp,this.s.hp);this.s.spirit=this.s.maxSpirit;
  this.s.life.left+=3*D.LIFE.yearMinutes;
  this.log('渡劫成功 · 固定伤害−'+dmg+'，气血剩余 '+this.s.hp+'/'+this.s.maxHp+'，延寿3年','good');
  return this.note('渡过'+this.realm+' · 气血剩余 '+this.s.hp+'/'+this.s.maxHp,'ok','unlock');"""
 s=replace(s,before,after,'fixed damage settlement')
 old="""  if(!this.enough(D.ASCENSION_RULE.cost))return this.fail(this.missing(D.ASCENSION_RULE.cost));
  if(!this.tick(180,4,4,8))return {ok:false};this.spend(D.ASCENSION_RULE.cost);
  this.s.major=9;this.s.ascended=true;this.s.flags.complete=true;"""
 new="""  if(!this.enough(D.ASCENSION_RULE.cost))return this.fail(this.missing(D.ASCENSION_RULE.cost));
  const preview=this.tribPreview(true),dmg=preview.damage,usedPills=this.tribPills;
  if(!preview.safe)return this.fail('飞升终劫需气血至少 '+(dmg+preview.survivalDamage+1)+'（含生存损耗），当前 '+this.s.hp+'；先补充气血或护劫丹');
  if(!this.tick(180,4,4,8))return {ok:false};
  this.s.hp-=dmg;
  if(this.s.hp<=0){this.collapse();return this.note('飞升终劫失利 · 重伤折寿','warn');}
  if(usedPills>0)this.s.inv.guardPill=Math.max(0,(this.s.inv.guardPill||0)-usedPills);
  this.spend(D.ASCENSION_RULE.cost);
  this.log('第十二重飞升终劫 · 固定伤害−'+dmg+'，劫后气血 '+this.s.hp+'/'+this.s.maxHp,'good');
  this.s.major=9;this.s.ascended=true;this.s.flags.complete=true;"""
 s=replace(s,old,new,'final 24200 damage')
 # The same 36-segment XP pool is used for enchantment at ALL realms.
 s=replace(s,"""/* 修为从当前进度池扣（前六境 xp / 金丹之后 daoXp），扣到 0 为止，不倒退段位 */
 spendProgress(xp){
  const n=Math.max(0,Math.round(Number(xp)||0));if(!n)return true;
  if(this.s.major>=2){const cur=Math.max(0,Math.round(Number(this.s.daoXp)||0));if(cur<n)return false;this.s.daoXp=cur-n;return true;}
  const cur=Math.max(0,Math.round(Number(this.s.xp)||0));if(cur<n)return false;this.s.xp=cur-n;return true;
 }""","""/* V90.57: daoXp retired; forging/spirit arts must consume current segment XP. */
 spendProgress(xp){
  const n=Math.max(0,Math.round(Number(xp)||0));if(!n)return true;
  const cur=Math.max(0,Math.round(Number(this.s.xp)||0));if(cur<n)return false;
  this.s.xp=cur-n;return true;
 }""",'high-realm enchanting softlock')
 # Read-only stage guide + current trial page, keeping original resource source lookup.
 a='function progStage(){';z='function tribulationBody(){'
 i=s.index('function progMatSource(id){');j=s.index('/* 条件清单：',i)
 mats=s[s.rfind('/* 材料来源：',0,i):j].strip()
 s=block(s,a,z,read('tools/v957-progression.js')+'\n'+mats,'36-segment progression panel')
 s=block(s,'function cultivateTrialBody(){','function cultivateArtBody(){',read('tools/v957-trial-ui.js'),'trial panel and final preview')
 s=block(s,'function objective(){','function questDisplay(){',read('tools/v957-objective.js'),'main objective')
 # Replace the old high-dao prose in actual help / region playbook.
 changes={
 '第六境起，高阶突破需要本境洞府、道行、突破道材、仪式与首领记录。满足条件后必须主动在洞府执行破境；到渡劫天门还要准备最终材料并完成飞升。':
 '修行采用十二境三十六段，初中期修满自动升段，后期圆满在本境洞府承受一次固定伤害渡劫；不再需要道行、突破道材、三重雷考或问心。最终飞升需要渡劫后期圆满、十二境平定、劫雷晶×3与天门符×2，到界碑承受第十二重终劫。',
 '初期九层之后进入第二大境界，累计18级达到第二大境界后期。此后每一境都分初期、中期、后期三段：道行修到三分之一为中期、三分之二为后期，修满即后期圆满——只有圆满之后，才能在洞府里破境或渡劫。':
 '现在每一大境分初期、中期、后期三段，共十二境三十六段。每一段修满后，初/中期自动升阶，后期圆满则须在本境洞府主动渡劫。旧的道行刻度已取消，实际进度见修炼页的修为数字。',
 '后七境必须在当地自建洞府、已击败本境首领，消耗道行和两类道材才能破境。两族使用相同前置条件，天赋只影响效率与战斗，不跳过主线。':
 '境界渡劫需要后期圆满、本境洞府及足够气血。首领与仪式属于地图通关任务；突破本身不再消耗道行或原两类突破道材。两族采用相同渡劫规则。',
 '最后达到渡劫，平定十二境，携带劫雷晶3、天门符2并积累150道行，在渡劫天门的界碑点击飞升。飞升保留进度，仙界暂未开放。':
 '修满渡劫后期（36段）、平定十二境，随身携带劫雷晶×3、天门符×2，在渡劫天门的界碑通过第十二次固定伤害终劫后飞升。护劫丹减伤规则不变；不再要求150道行。',
 '筑基后期（炼气起累计等级18）转为积累“道行”。每完成一次大境界突破，道行重新结算为0；当境界符合才开放下一图。角色差异、跨境仓储隔离和寿元归零永久死亡继续生效。':
 '现在以36段等级和本段修为为唯一进度；不再积累“道行”。后期修满主动渡劫，气血不足先养成与补给。角色差异、跨境仓储隔离和寿元归零规则照旧。',
 '第十二图渡劫天门的飞升界碑，在达到渡劫境并平定十二境后，除原有“飞升”外新增可选“九霄终劫”。该扩展只是可选挑战：原有飞升路径、旧档进度，以及飞升所需的150道行／劫雷晶3／天门符2，都不受影响。':
 '第十二图渡劫天门的飞升界碑需要等级36后期圆满、十二境平定、劫雷晶×3与天门符×2，并承受第十二次固定伤害终劫。旧版三重问答已从正式修炼入口下线。',
 '无论是否渡过额外九霄试炼，飞升操作仍按原本规则在天门界碑结算一次，道行与材料不能重复扣取。直接飞升也合法，结局会如实注明未另行挑战三重。':
 '新版终劫只结算一次固定伤害；成功后仅扣取飞升灵材一次，不再重复领取或扣取已退役的道行。',
 }
 for old,new in changes.items():s=replace(s,old,new,'help copy: '+old[:12])
 # User-facing region guide at zone 6..12: this is exploration advice, not a second gate.
 for old,new in [
 ('坛前提交4主材与2副材、挑战结丹雷蛟，再回府积攒60道行破境。','坛与首领是地图挑战；金丹后期修满后回本境洞府承受固定伤害渡劫。'),
 ('提交本境道材，平定夺舍魂君；110道行后回府破境。','平定夺舍魂君，元婴后期圆满后回洞府承受固定伤害渡劫。'),
 ('平定化神云海首领，积累160道行回府突破。','平定云海首领；后期修满后回本境洞府渡劫，不再消耗道行。'),
 ('交付本境材料、击败裂空兽；220道行后破境。','挑战裂空兽；后期修满后回洞府渡劫，不再需要突破道材。'),
 ('击败千面合灵傀，280道行后归府破境。','挑战千面合灵傀；后期修满后回府承受固定伤害渡劫。'),
 ('平定大道镇界灵，积累350道行破境。','挑战大道镇界灵；后期圆满回府渡劫，注意提升气血上限。'),
 ('击败九霄天劫主，430道行完成渡劫，再满足最终飞升条件。','平定十二境、修满渡劫后期（等级36）；在天门界碑承受第十二重终劫。'),
 ('飞升仍需另行达标道行与材料，不会击败首领就自动成功。','飞升需要劫雷晶×3、天门符×2以及足够气血；成功才消耗材料。')]:s=replace(s,old,new,'high region playbook')
 # Stage instructions in the lesson side panel should reflect new rules.
 old="""if(s.secretRealm)parts.push('你正在秘境中：先查看相邻格，再移动或探索；可随时撤离，不会更换大地图。');
 if(!s.ritual[zone])parts.push(zone===0?'先在本境洞府修建山门并恢复护山阵；缺料请看下方材料清单。':'本境仪式尚未完成：先搜集祭坛所需材料，并携带到地图上的祭坛位置。');
 else if(!s.cleared[zone])parts.push('本境仪式已完成：检查装备、气血和补给，再前往首领。');
 else if(zone===6&&s.major===2&&s.cleared[6]&&!s.flags.heartTrial?.complete)parts.push('婴灵古墟首领已平定：回本境洞府完成三重问心，再依原条件突破元婴。');
 else if(zone>=5&&zone<11)parts.push(zone===5&&s.major===1&&!s.flags.coreTribulation?.complete?'丹霞雷蛟已平定：请在本境洞府修炼面板完成三重凝丹雷劫，再按旧条件破境。':'本境首领已击败：高境需在【本境】筑庐，积累道行与突破材料，再到【修炼】主动破境。');
 else if(zone===11&&!s.ascended)parts.push('渡劫终点：查看修炼面板的飞升条件，准备劫雷晶、天门符和道行后前往天门。');
 else if(zone<11)parts.push('已平定本境：通过下方旅行菜单前往下一境，旧境可随时回访采集。');"""
 new="""if(s.secretRealm)parts.push('你正在秘境中：先查看相邻格，再移动或探索；可随时撤离，不会更换大地图。');
 if(game.stageIndex===3&&s.xp>=game.required&&!s.ascended)parts.push(s.level===36?'最终渡劫后期已满：平定十二境，携带劫雷晶×3与天门符×2，到渡劫天门界碑承受第十二次固定伤害终劫。':'当前后期已圆满：在本境自己的洞府进入【修炼 → 渡劫】，准备气血与护劫丹；不需要道行或旧版三重试炼。');
 else parts.push('当前'+game.realm+'，修为 '+s.xp+'/'+game.required+'。初/中期修满自动升段，后期圆满须回本境洞府主动渡劫。');
 if(!s.ritual[zone])parts.push(zone===0?'本境地图任务：先筑庐并修建山门与护山阵。':'本境地图任务：收集祭坛材料后前往地图「坛」字；该任务不消耗你的突破修为。');
 else if(!s.cleared[zone])parts.push('本境地图任务：祭坛已完成，检查装备与补给后挑战首领。');"""
 s=replace(s,old,new,'manual guidance overwrite')
 # Don't present retired high-realm gate costs in codex.
 s=replace(s,'`<div>道行门槛：${stage.needDao}</div><div>突破材料：${esc(D.ITEMS[stage.primary]?.name||stage.primary)}×2、${esc(D.ITEMS[stage.secondary]?.name||stage.secondary)}×1</div><div>要求：本境洞府、本境首领通关、达到突破前置境界。</div>`',
 '`<div>修为采用36段：初中期修满自动升阶，后期圆满在本境洞府渡劫。</div><div>固定伤害：${D.TRIB_DAMAGE[Math.min(11,i+5)]}；护劫丹每颗减伤15%，最多两颗。</div><div>首领与祭坛仍属于地图通关内容；不再要求旧版道行或道材破境。</div>`','codex highrealm')
 # Main location's final gate should offer the current final action, not the deprecated three-choice ordeal.
 s=replace(s,"if(l==='gate'&&s.zone===11&&s.major===8&&s.cleared.every(Boolean))return '<button data-a=\"heaven-open\">九霄终劫</button><button data-a=\"ascend\" class=\"important\">飞升</button>';",
 "if(l==='gate'&&s.zone===11)return '<button data-a=\"panel\" data-name=\"quest\">飞升条件</button><button data-a=\"ascend\" class=\"important\">承受终劫 · 飞升</button>';",'final gate actions')
 # Remove retired unconditional gate hint, route to actual current segment.
 s=replace(s,"if(s.zone>=5&&s.major===s.zone-4)return '<button data-a=\"rest\" data-mode=\"field\">调息</button><button data-a=\"panel\" data-name=\"quest\" class=\"important\">先回府破境</button>';",
 "if(s.level<36&&game.stageIndex===3&&s.xp>=game.required)return '<button data-a=\"rest\" data-mode=\"field\">调息</button><button data-a=\"panel\" data-name=\"quest\" class=\"important\">查看渡劫指引</button>';",'boundary map guide')
 # Show current version in primary help. Do not modify narrative logs of actual old experiences.
 s=replace(s,'当前版本 V90.56：','当前版本 V90.57：','help version') if '当前版本 V90.56：' in s else s
 # V90.57 visible help chapters: retire old level-18, Dao XP and optional three-part heavenly ordeal instructions.
 for old,new in [
 ('灵根品阶抽取：杂灵根30%、三灵根30%、双灵根23%、天灵根12%、异灵根5%。修为与道行获取分别增加0%、4%、8%、12%、15%。普通天赋没有修行上限。',
  '灵根品阶抽取：杂灵根30%、三灵根30%、双灵根23%、天灵根12%、异灵根5%。当前修为获取加成依次为0%、4%、8%、12%、15%。道行已退役。'),
 ('采集和实战得修为，达到10＋当前层数×5后自动突破。每层基础攻击+1、气血上限+9、灵力上限+2、负重上限+3，最高18层。基础行囊负重46。',
  '采集和实战可获得本段修为。十二境共36段，初/中期修满自动升段；后期修满须在本境洞府主动承受固定伤害渡劫。气血、攻击与灵力上限采用当前36段定稿表，不再使用旧版18层成长公式。'),
 ('境界顺序：炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘、渡劫，最后飞升。飞升只是凡界终章，仙界内容将在后续版本开放。炼气共九层，筑基包括初中后期；旧版本的等级与筑基境界保持不变。',
  '凡界十二境依次为凡人、感气、引气、炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘、渡劫，每境有初期、中期、后期三段，共36段。后期修满后渡劫，渡劫后期圆满可挑战飞升终劫；仙界暂未开放。'),
 ('每张新区域先采集两种道材，在中心问道坛交付4份主材和2份副材，击败本境首领。随后前往本境自建洞府的修炼面板，点击“破境”，满足修为积累和道材条件后进入下一境界。不能只靠刷经验自动跳过主境界。',
  '地图的祭坛与首领仍有独立任务：采集仪式材料、修复祭坛、击败首领；它们用于地图通关，不再是渡劫扣费清单。人物按本段修为升段；到后期圆满时返回本境洞府，通过一次固定伤害判定渡劫。'),
 ('已探索地块、战斗进度和获得的材料与原版存档体系兼容。旧版本没有秘境时仍按无秘境存档加载。',
  '旧格式存档采用 V90.43 起的重置与阶梯补偿方案，不提供无损原地升级。更换旧版前请导出 JSON 并保留原游戏；新版存档各自保存地图和秘境进度。'),
 ('九霄终劫是可选的深度应劫体验：启劫后经过问命天雷、因果照魂、九霄破界三重考验。每重可选择护元承雷、纳雷淬身或以躯硬抗。可在当前页面查看所耗时间、灵力和气血损伤，再确认选择。',
  '旧版九霄三重选项属于历史玩法记录，现已不再是可进入的正式飞升步骤。新版在天门界碑执行第十二次固定伤害终劫，护劫丹至多两颗、每颗减伤15%，预告与结算使用同一计算。'),
 ('每重完成后自动存档。途中可返回地图调息，失利按原规则重伤折寿，已完成的层次仍会保存。应劫不生成仙器、不额外提升永久伤害，完成三重后才会记录九霄已渡。',
  '现在没有必须连续完成的三重终劫。修满渡劫后期、平定十二境并准备飞升材料后，在界碑一次结算固定伤害；不足时先休整补给，成功才扣材料与护劫丹。'),
 ('境界突破按配置增寿，三阶丹房可制延寿丹。初始天赋不保证不死，稀有血脉也不能越过寿元终结规则。',
  '成功渡劫按当前规则延寿3年，三阶丹房可制延寿丹。初始天赋不保证不死，稀有血脉也不能越过寿元终结规则。'),
 ]:
  s=replace(s,old,new,'visible help modernization: '+old[:18])
 # V90.57: entry, birth sheet and 12-zone quest should display the REAL 12-realm data table,
 # not the obsolete 10-label RACES arrays (preserved for historic API compatibility).
 for old,new in [
  ("${c.realms.map((r,i)=>`<span>${r}</span>${i<9?'<i>›</i>':''}`).join('')}",
   "${(root.QData?.REALM12?.[selected]||c.realms).map((r,i,a)=>`<span>${r}</span>${i<a.length-1?'<i>›</i>':''}`).join('')}"),
  ("${g.character.realms.join(' → ')}", "${(root.QData?.REALM12?.[g.s.character]||g.character.realms).join(' → ')}"),
  ("${esc(game.character.realms.join(' → '))}", "${esc((D.REALM12?.[game.s.character]||game.character.realms).join(' → '))}"),
 ]:
  s=replace(s,old,new,'entry and quest 12-realm labels')
 afterActions=set(re.findall(r'data-a="([a-z0-9-]+)"',s))
 if not afterActions.issuperset(originalActions-{'heaven-open'}):
  raise RuntimeError('Unexpected loss in UI actions: '+str(sorted(originalActions-afterActions)))
 if s.count('function objective(){')!=1 or s.count('function cultivateTrialBody(){')!=1:
  raise RuntimeError('duplicated main UI modules')
 if s.count('<script')!=10 or s.count('</script>')!=10: raise RuntimeError('script count changed')
 data=s.replace('\n','\r\n').encode('utf-8')
 OUT.write_bytes(data);(ROOT/'index.html').write_bytes(data)
 assert OUT.read_bytes()==(ROOT/'index.html').read_bytes()
 assert digest(BASE.read_bytes())==BASE_SHA
 print('V90.57 BUILD PASS',len(data),'bytes',digest(data).upper())
 print('BASE: ',BASE_SHA.upper())
 print('ACTIONS: ',len(originalActions),'->',len(afterActions),'dropped:',sorted(originalActions-afterActions))
if __name__=='__main__':build()
