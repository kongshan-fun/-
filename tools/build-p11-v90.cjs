'use strict';
function buildP11(base){
  let s=base;
  function one(a,b){
    const i=s.indexOf(a);
    if(i<0 || s.indexOf(a,i+a.length)>=0)throw Error("Missing or ambiguous patch anchor: "+a.slice(0,110));
    s=s.slice(0,i)+b+s.slice(i+a.length);
  }
  one('<title>山野修仙记 V89 · 九霄终劫与凡界终章</title>','<title>山野修仙记 V90 · 高境异能与秘闻事件</title>');
  one(" const RES={",String.raw`
 // P11: tactical identity is driven by opponent type, not a blanket stat multiplier.
 const HIGH_TRAITS={};
 const traitRows=[
  ['封灵回响','封灵：此回合若不防守，将被抽取少量灵力。'],
  ['镜影迷身','幻形：本回合剑击易落空，术法或防守更稳妥。'],
  ['断脉蓄锋','蓄势：本回合蓄力，下回合会打出强力重击。'],
  ['裂界挪移','错位：此回合攻击会附带少量灵力扰动。'],
  ['合灵护阵','护阵：敌人架起短暂屏障，下次受击减伤。'],
  ['镇界反制','反制：此回合剑击易遭追击，术法或防守可规避。'],
  ['九霄雷云','聚雷：本回合蓄雷，下回合重击并扰乱灵力。']
 ];
 for(let z=5;z<=11;z++){
  const id=['seal','mirage','delay','rift','barrier','counter','storm'][z-5];
  for(const type of ['realm'+z,'boss'+z])HIGH_TRAITS[type]={id,name:traitRows[z-5][0],hint:traitRows[z-5][1]};
 }
 const HIGH_EVENTS=[
  {id:'omen',name:'逆行天象',text:'远空灵云倒悬，裂纹中有前人遗落的道材。追寻会招致反噬。'},
  {id:'echo',name:'失名遗响',text:'旧修的余音断续传来。你可以避开险处，或深入听取回响。'},
  {id:'array',name:'护山残阵',text:'残阵尚留薄弱灵光。绕阵拾遗较稳妥，强行勘探可能受伤。'}
 ];
 const RES={`);
  one('const D={SECRETS,HEAVEN_LAYERS','const D={SECRETS,HIGH_TRAITS,HIGH_EVENTS,HEAVEN_LAYERS');
  one("events:{},sites:{},campRests:{}", "events:{},highEvents:{},sites:{},campRests:{}");
  one(" for(const bag of ['inv','stash']){n[bag]={};",String.raw`
 // P11: a bounded seven-zone, single-event state; old V14 saves default to empty.
 n.highEvents={};
 if(obj(o.highEvents))for(let z=5;z<=11;z++){
  const ev=o.highEvents[z];
  if(!obj(ev)||!D.HIGH_EVENTS.some(e=>e.id===ev.id)||!['hidden','pending','done'].includes(ev.status))continue;
  if(typeof ev.tile!=='string'||!new RegExp('^'+z+':[0-7],[0-7]$').test(ev.tile))continue;
  n.highEvents[z]={id:ev.id,tile:ev.tile,status:ev.status};
 }
 for(const bag of ['inv','stash']){n[bag]={};`);
  one("intent:['heavy','attack','recover',...(t.startsWith('boss')?['skill']:[])].includes(o.combat.intent)?o.combat.intent:'attack',training,repeat,virtualHeals:",
      "intent:['heavy','attack','recover',...(t.startsWith('boss')?['skill']:[]),...(D.HIGH_TRAITS[t]?['trait']:[])].includes(o.combat.intent)?o.combat.intent:'attack',charge:['delay','storm'].includes(o.combat.charge)&&D.HIGH_TRAITS[t]?.id===o.combat.charge?o.combat.charge:null,barrier:D.HIGH_TRAITS[t]?.id==='barrier'&&o.combat.barrier===true,training,repeat,virtualHeals:");
  one(' nextBattleIntent(b){\n',String.raw` battleTrait(b=this.s.combat){return D.HIGH_TRAITS[b?.type]||null;}
 traitHint(b=this.s.combat){
  const tr=this.battleTrait(b);
  if(!tr)return '';
  if(b.intent==='trait')return tr.hint;
  if(b.charge)return b.charge==='storm'?'雷云已成：强力重击将至，建议防守。':'蓄势已成：强力重击将至，建议防守。';
  if(b.barrier)return '敌人护阵尚存：下一次伤害会被减免。';
  return tr.name+' · 该敌人会在战斗中施展异能。';
 }
 adjustEnemyDamage(b,damage,style){
  const tr=this.battleTrait(b);
  if(tr?.id==='mirage'&&b.intent==='trait'&&style==='melee'){
   damage=Math.max(1,Math.ceil(damage*.55));this.log('镜影迷身 · 剑击伤害受幻影干扰。');
  }
  if(b.barrier){
   damage=Math.max(1,Math.ceil(damage*.55));b.barrier=false;
   this.log('合灵护阵 · 抵消了部分伤害。');
  }
  return damage;
 }
 nextBattleIntent(b){
`);
  one("  if(!b.training&&b.type.startsWith('boss')&&b.turn%4===0)return 'skill';\n  return b.turn%3===0?'heavy':b.turn%5===0?'recover':'attack';",
      "  if(!b.training&&b.charge)return 'heavy';\n  if(!b.training&&b.type.startsWith('boss')&&b.turn%4===0)return 'skill';\n  if(!b.training&&this.battleTrait(b)&&b.turn%4===3)return 'trait';\n  return b.turn%3===0?'heavy':b.turn%5===0?'recover':'attack';");
  one('    const dmg=Math.max(1,Math.round(base*m.power',
      '    const dmg=this.adjustEnemyDamage(b,Math.max(1,Math.round(base*m.power');
  one("+this.affix('fire');\n    const dealt=","+this.affix('fire'),'melee');\n    const dealt=");
  one('   const dmg=Math.max(1,Math.round(base*boost',
      '   const dmg=this.adjustEnemyDamage(b,Math.max(1,Math.round(base*boost');
  one("+this.affix('fire');\n   const dealt=","+this.affix('fire'),mode==='spell'?'spell':'melee');\n   const dealt=");
  one("  if(b.intent==='recover'){b.hp=Math.min(b.maxHp,b.hp+7);this.log(D.ENEMIES[b.type].name+'调息恢复7。');}\n  else{const skill=b.intent==='skill'?this.bossSkill(b.type):null;\n   const mult=skill?skill.mult:b.intent==='heavy'?1.65:1;",
String.raw`  const trait=this.battleTrait(b);
  if(b.intent==='trait'&&trait?.id==='delay'){b.charge='delay';this.log('断脉蓄锋 · 预告下一回合重击。','bad');}
  else if(b.intent==='trait'&&trait?.id==='storm'){b.charge='storm';this.log('九霄雷云凝聚 · 下回合可防守卸力。','bad');}
  else if(b.intent==='trait'&&trait?.id==='barrier'){b.barrier=true;this.log('合灵护阵 · 护罩将阻挡下一次攻击。','bad');}
  else if(b.intent==='recover'){b.hp=Math.min(b.maxHp,b.hp+7);this.log(D.ENEMIES[b.type].name+'调息恢复7。');}
  else{const skill=b.intent==='skill'?this.bossSkill(b.type):null;
   const mult=skill?skill.mult:b.charge==='storm'?1.86:b.charge==='delay'?1.82:b.intent==='heavy'?1.65:1;`);
  one("   b.manualShield=0;\n   if(skill){",String.raw`   b.manualShield=0;
   if(b.intent==='trait'&&trait){
    if(trait.id==='seal'){
     const lost=guard?0:Math.min(this.s.spirit,Math.min(13,5+this.s.zone));
     this.s.spirit-=lost;this.log('封灵回响 · 灵力-'+lost,lost?'bad':'good');
    }
    if(trait.id==='rift'){
     const lost=guard?0:Math.min(this.s.spirit,6);
     this.s.spirit-=lost;this.log('虚空错位 · 灵力-'+lost,lost?'bad':'good');
    }
    if(trait.id==='counter'&&(mode==='attack'||mode==='manual'&&MANUALS[id]?.slot==='attack')&&!guard){
     damage+=Math.max(1,Math.ceil(b.atk*.22));this.log('镇界反制 · 近战招来追击。','bad');
    }
   }
   if(b.charge&&b.intent==='heavy'){
    if(b.charge==='storm'){
     const lost=guard?0:Math.min(this.s.spirit,Math.min(11,3+this.s.zone));
     this.s.spirit-=lost;this.log('九霄劫雷 · 余雷扰动灵力-'+lost,lost?'bad':'good');
    }
    b.charge=null;
   }
   if(skill){`);
  // P11 events: fixed target per realm, one result per life. Does not alter the combat RNG.
  one(' sceneEnemy(){',String.raw` highEventSeed(z){
  let h=(this.s.seed^(Math.imul(z+1,2654435761)))>>>0;
  h=Math.imul(h^0x9e3779b9,2246822519)>>>0;
  return h;
 }
 ensureHighEvent(){
  const z=this.s.zone;if(z<5||z>11)return null;
  this.s.highEvents||={};
  if(this.s.highEvents[z])return this.s.highEvents[z];
  const eligible=[];
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const land=this.zone.map[y][x],tile=z+':'+x+','+y;
   if(['camp','campsite','sect','bazaar','gate','shrine','boss'].includes(land)||D.SITES[tile]||D.EVENTS[tile])continue;
   if(this.s.settlements[z]?.pos.x===x&&this.s.settlements[z]?.pos.y===y)continue;
   eligible.push({x,y,tile});
  }
  if(!eligible.length)return null;
  const entry=this.entry(z);
  const near=eligible.filter(p=>Math.abs(p.x-entry.x)+Math.abs(p.y-entry.y)<=6);
  const set=near.length?near:eligible,h=this.highEventSeed(z);
  const target=set[h%set.length],event=D.HIGH_EVENTS[(h>>>11)%D.HIGH_EVENTS.length];
  const result={id:event.id,tile:target.tile,status:'hidden'};
  this.s.highEvents[z]=result;return result;
 }
 get highEventAt(){
  const ev=this.s.highEvents?.[this.s.zone];
  return ev?.status==='pending'&&ev.tile===this.key()?D.HIGH_EVENTS.find(e=>e.id===ev.id)||null:null;
 }
 highEventPlan(mode){
  const e=this.highEventAt;
  if(!e||!['observe','probe'].includes(mode))return null;
  const z=this.s.zone,secret=D.SECRETS[z];
  if(!secret)return null;
  const hard=mode==='probe';
  const minutes=hard?45:20,spirit=hard?Math.min(15,5+z):3;
  const damage=hard?Math.max(4,Math.ceil(this.s.maxHp*.045)-Math.min(16,Math.floor(this.armor*.14))):0;
  return {minutes,spirit,damage,loot:hard?{[secret.item]:1,[secret.base]:1}:{[secret.base]:1}};
 }
 highEventResolve(mode){
  const ev=this.s.highEvents?.[this.s.zone],e=this.highEventAt;
  if(!e||this.s.combat||this.s.secretRealm)return this.fail('此处没有可结算的异兆');
  if(ev.status!=='pending'||ev.tile!==this.key())return this.fail('请返回异兆原址');
  const p=this.highEventPlan(mode);if(!p)return this.fail('无效勘探方式');
  const need=p.spirit+this.extra(p.minutes).spirit;
  if(this.s.spirit<need)return this.fail('灵力不足，需要'+need);
  // Commit the one-shot marker before any HP/lifespan loss, including collapse.
  ev.status='done';this.s.stats.events++;
  if(!this.tick(p.minutes,2,2,p.spirit))return {ok:false,msg:'异兆调查中负伤；本世此境无法重复领取'};
  this.s.hp-=p.damage;
  this.log(e.name+' · '+(mode==='probe'?'深入勘察':'绕行拾遗')+(p.damage?'，气血-'+p.damage:''),'good');
  if(this.s.hp<=0){this.collapse();return this.fail('勘探反噬负伤，沿用原折寿；此境异兆已经结算');}
  this.loot(p.loot,'高境异兆',true);
  return this.note(e.name+' · '+(mode==='probe'?'深入勘察':'绕行拾遗')+'完成','ok');
 }
 sceneEnemy(){`);
  one("  if(this.site){this.note('发现'+this.site.name+' · 可探查');return {ok:true,stop:true};}\n  const protect=",
String.raw`  if(this.site){this.note('发现'+this.site.name+' · 可探查');return {ok:true,stop:true};}
  if(this.s.zone>=5){
   const ev=this.ensureHighEvent();
   if(ev&&ev.tile===this.key()&&ev.status!=='done'){
    ev.status='pending';this.note('遭遇'+this.highEventAt.name+' · 可原地调查，也可日后回访','warn');
    return {ok:true,stop:true};
   }
  }
  const protect=`);
  one("const outsideActions=new Set(['move','travel','gather'", "const outsideActions=new Set(['high-event','move','travel','gather'");
  one("   case 'event':result=this.event(Number(args.choice));break;",
      "   case 'high-event':result=this.highEventResolve(args.mode);break;\n   case 'event':result=this.event(Number(args.choice));break;");
  one(" if(game.site)return '<button data-a=\"site\" class=\"important\">'",
      " if(game.highEventAt)return '<button data-a=\"high-event\" class=\"important\">探查异兆</button>'+(pickup||'<button data-a=\"rest\" data-mode=\"field\">调息</button>');\n if(game.site)return '<button data-a=\"site\" class=\"important\">'");
  one("bossSkill=b.intent==='skill'?game.bossSkill(b.type):null,hint=bossSkill?'首领绝技 · '+bossSkill.name+' · 防守可抵御':b.intent==='heavy'?'重击将至 · 宜防守':b.intent==='recover'?'敌人调息 · 可进攻':'普通攻击';",
      "bossSkill=b.intent==='skill'?game.bossSkill(b.type):null,hint=bossSkill?'首领绝技 · '+bossSkill.name+' · 防守可抵御':b.intent==='trait'?game.traitHint(b):b.intent==='heavy'?(b.charge?game.traitHint(b):'重击将至 · 宜防守'):b.intent==='recover'?'敌人调息 · 可进攻':'普通攻击';");
  one("intent-${b.intent==='heavy'||b.intent==='skill'?'danger':b.intent==='recover'?'recovery':'normal'}",
      "intent-${b.intent==='heavy'||b.intent==='skill'||b.intent==='trait'?'danger':b.intent==='recover'?'recovery':'normal'}");
  one("const mark=home?'府':ground?'拾':l==='boss'?game.zone.bossMark:site?.mark||D.LAND[l].mark;",
      "const ev=s.highEvents?.[s.zone],eventVisible=ev?.status==='pending'&&ev.tile===key;\n const mark=home?'府':ground?'拾':eventVisible?'异':l==='boss'?game.zone.bossMark:site?.mark||D.LAND[l].mark;");
  one("home||site||['campsite','shrine','boss','gate'].includes(l)",
      "home||site||eventVisible||['campsite','shrine','boss','gate'].includes(l)");
  one(" else if(modal.kind==='ad-life')body=",String.raw` else if(modal.kind==='high-event'){
  const e=game.highEventAt,calm=game.highEventPlan('observe'),bold=game.highEventPlan('probe');
  body=e?'<div class="kicker">'+esc(game.zone.name)+' · 一世一次</div><h2>'+esc(e.name)+'</h2><p>'+esc(e.text)+'</p><div class="steps">可离开后回到原地继续；不会阻塞主线，也没有永久战力加成。</div>'
   +[['observe','绕行拾遗',calm],['probe','深入勘察',bold]].map(row=>'<button class="event-choice" data-a="high-event-choice" data-mode="'+row[0]+'">'+row[1]+'<small>耗时'+row[2].minutes+'分钟 · 灵力'+row[2].spirit+' + 地形额外消耗 · 预期气血损伤'+row[2].damage+' · '+Object.entries(row[2].loot).map(([k,n])=>esc(D.ITEMS[k].name)+'×'+n).join('、')+'</small></button>').join('')
   +'<p class="micro">风险预告不含饥渴归零造成的额外损伤，请先补足食水。奖励只结算一次。</p><button class="btn" data-a="modal-close">暂不调查</button>':'<p>异兆已消散。</p><button class="btn" data-a="modal-close">返回</button>';
 }
 else if(modal.kind==='ad-life')body=`);
  one(" if(a==='event-choice'){const r=game.act('event',{choice:Number(b.dataset.choice)});",
      " if(a==='high-event-choice'&&modal?.kind==='high-event'){const r=game.act('high-event',{mode:b.dataset.mode});if(r.ok||!game.highEventAt){modal=null;renderModal();}flush(r);return;}\n if(a==='event-choice'){const r=game.act('event',{choice:Number(b.dataset.choice)});");
  one(" if(a==='site'){stop();if(game.site?.id==='immortal-estate')",
      " if(a==='high-event'){stop();if(game.highEventAt)showModal({kind:'high-event'});return;}\n if(a==='site'){stop();if(game.site?.id==='immortal-estate')");
  one("root.QData=D;",String.raw`HELP.push({id:'p11-high-realm',title:'高境异能与异兆调查',paragraphs:[
 '丹霞至渡劫的七境妖兽与首领具有不同异能，注意战斗中的预告。首领原每四回合绝技依旧存在。',
 '每一境每位角色一世最多出现一个异兆：找到原地再调查，可安全绕行或承担明确风险深入探查；成功及失败均不能反复领取。',
 '旧版存档没有异兆记录时视为未发现。异兆不要求完成才能飞升，凡界主线与高阶装备数值不变。'
]});
root.QData=D;`);
  if((s.match(/<script\b/gi)||[]).length!==10 || (s.match(/<\/html>/gi)||[]).length!==1)throw Error("HTML integrity: unexpected script count or duplicate document");
  return s;
}
module.exports={buildP11};
if(typeof require!=='undefined'&&require.main===module){const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const base=fs.readFileSync(path.join(root,'releases/山野修仙记_V89_九霄终劫与凡界终章完整版.html'),'utf8');const out=path.join(root,'releases/山野修仙记_V90_高境异能与秘闻事件完整版.html');fs.writeFileSync(out,buildP11(base),'utf8');process.stdout.write('P11 generated '+out+'\n');}
