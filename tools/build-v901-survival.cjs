'use strict';
function buildV901(html){
 let s=html;
 function rep(needle,next){let i=s.indexOf(needle);if(i<0||s.indexOf(needle,i+needle.length)>=0)throw Error('ambiguous '+needle.slice(0,90));s=s.slice(0,i)+next+s.slice(i+needle.length);}
 function section(start,end,content){const a=s.indexOf(start);if(a<0||s.indexOf(start,a+start.length)>=0)throw Error('start '+start);const b=s.indexOf(end,a+start.length);if(b<0)throw Error('end '+end);s=s.slice(0,a)+content+s.slice(b);}
 rep("<title>山野修仙记 V90 · 高境异能与秘闻事件</title>","<title>山野修仙记 V90.1 · 饥渴时间结算修正版</title>");
 rep("events:{},highEvents:{},sites:{}","events:{},highEvents:{},survival:{debt:0},sites:{}");
 rep(" for(const bag of ['inv','stash']){n[bag]={};",String.raw`
 // Persist fractional starvation damage for action-splitting and reload equivalence.
 n.survival={debt:Number.isFinite(o.survival?.debt)?Math.max(0,Math.min(.999999,o.survival.debt)):0};
 for(const bag of ['inv','stash']){n[bag]={};`);
 section(" tick(minutes,h=0,w=0,sp=0){"," collapse(){",String.raw`
 // Time, not button presses, drives nutritional damage; all existing action
 // hunger and hydration costs remain unchanged.
 survivalForecast(minutes,h=0,w=0,sp=0){
  const s=this.s,elapsed=Math.max(0,Math.floor(Number(minutes)||0)),environment=this.extra(elapsed);
  const hungerCost=Math.max(0,Number(h)||0),waterCost=Math.max(0,Number(w)||0)+environment.water;
  const spiritCost=Math.max(0,Number(sp)||0)+environment.spirit;
  const missingMinutes=(available,cost)=>available<=0?elapsed:cost>available?elapsed*(cost-available)/cost:0;
  const hungerMinutes=missingMinutes(s.hunger,hungerCost),waterMinutes=missingMinutes(s.water,waterCost);
  const spiritMinutes=spiritCost>0?missingMinutes(s.spirit,spiritCost):0;
  // Even at higher realms, remaining without food and water must have a cost.
  const hungerRate=Math.max(4,Math.ceil(s.maxHp*.002));
  const waterRate=Math.max(8,Math.ceil(s.maxHp*.004));
  const spiritRate=Math.max(2,Math.ceil(s.maxHp*.001));
  const debt=Number.isFinite(s.survival?.debt)?Math.max(0,Math.min(.999999,s.survival.debt)):0;
  const raw=debt+(hungerMinutes*hungerRate+waterMinutes*waterRate+spiritMinutes*spiritRate)/60;
  const damage=Math.floor(raw+1e-8);
  return {elapsed,hungerCost,waterCost,spiritCost,damage,debt:Math.max(0,raw-damage),
   hunger:Math.max(0,s.hunger-hungerCost),water:Math.max(0,s.water-waterCost),
   spirit:Math.max(0,s.spirit-spiritCost),hungerMinutes,waterMinutes,spiritMinutes};
 }
 tick(minutes,h=0,w=0,sp=0){
  const old=this.day,p=this.survivalForecast(minutes,h,w,sp);
  this.s.minutes+=p.elapsed;
  if(!this.age(p.elapsed))return false;
  this.s.hunger=p.hunger;this.s.water=p.water;this.s.spirit=p.spirit;
  this.s.survival={debt:p.debt};
  if(this.day>old)this.log('新的一天，资源与奇遇已刷新。','good');
  if(p.damage){
   this.s.hp-=p.damage;
   this.log('饥渴与耗灵随时间造成气血-'+p.damage+'（历时'+p.elapsed+'分钟）','bad');
  }
  if(this.s.hp<=0){this.collapse();return false;}
  return true;
 }
`);
 section(" rest(mode='field'){"," consume(id){",String.raw`
 // Recovery is a positive healing budget earned only from time spent resting
 // while nutritionally supported; neither sleeping nor camping sets HP to max.
 restForecast(mode='camp'){
  const home=mode!=='field';
  let minutes=mode==='field'?50:180,h=mode==='field'?5:2,w=mode==='field'?6:3;
  if(mode==='night'||mode==='dawn'){
   const clockTarget=mode==='night'?1080:420;
   let target=Math.floor(this.s.minutes/1440)*1440+clockTarget;
   if(target<=this.s.minutes)target+=1440;
   minutes=target-this.s.minutes;h=Math.ceil(minutes/180);w=Math.ceil(minutes/150);
  }
  const cost=this.survivalForecast(minutes,h,w,0);
  const supply=Math.min(this.s.hunger,this.s.water,cost.hunger,cost.water);
  // <=10: zero restoration; >=35: full efficiency, interpolated in between.
  const factor=supply<=10?0:supply>=35?1:(supply-10)/25;
  const level=home?this.camp?.level||1:1;
  const hpHourly=14+5*(level-1)+Math.ceil(this.s.maxHp*.008);
  const spiritHourly=24+5*(level-1)+Math.ceil(this.s.maxSpirit*.015);
  const hpGain=home?Math.floor(hpHourly*minutes/60*factor):0;
  const spiritGain=home?Math.floor(spiritHourly*minutes/60*factor):Math.floor(28*factor);
  const willCollapse=cost.damage>=this.s.hp;
  const expectedHp=willCollapse?0:Math.min(this.s.maxHp,Math.max(0,this.s.hp-cost.damage)+hpGain);
  const expectedSpirit=Math.min(this.s.maxSpirit,cost.spirit+spiritGain);
  return {...cost,mode,minutes,factor,hpGain,spiritGain,willCollapse,
    expectedHp,expectedSpirit,netHp:expectedHp-this.s.hp,netSpirit:expectedSpirit-this.s.spirit};
 }
 rest(mode='field'){
  if(this.s.combat)return this.fail('斗法中请使用防守恢复灵力');
  if(mode==='field'){
   const p=this.restForecast('field'),before=this.s.hp;
   if(!this.tick(p.minutes,p.hungerCost,p.waterCost-this.extra(p.minutes).water,0))return {ok:false};
   this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+p.spiritGain);
   return this.note(p.factor===0?'饥渴虚弱：野外调息无法回灵，气血'+(this.s.hp-before):'野外调息 · 灵力+'+p.spiritGain+' · 气血'+(this.s.hp-before),
    p.factor===0?'warn':'ok');
  }
  if(!this.workshop)return this.fail(this.camp?'请先回到洞府':'先选址筑庐，野外可调息');
  if(mode==='supply'){
   const food=this.has('berry')?'berry':this.has('meal')?'meal':this.has('fish')?'fish':this.has('pill')?'pill':null;
   if(!food||!this.has('water'))return this.fail('洞府补给需要食物1份和清水1份（可从本境仓房取用）');
   // Eating and drinking precede time passage; a near-death role can still eat.
   this.spend({[food]:1,water:1});
   const gain={berry:22,meal:45,fish:28,pill:42}[food];
   this.s.hunger=Math.min(100,this.s.hunger+gain);
   this.s.water=Math.min(100,this.s.water+30);
   if(!this.tick(30,1,1,0))return {ok:false};
   return this.note('已进食补水：'+D.ITEMS[food].name+'×1、清水×1；补给充足后休息才能恢复','ok');
  }
  if(!['camp','night','dawn'].includes(mode))return this.fail('未知休息方式');
  const p=this.restForecast(mode),beforeHp=this.s.hp,beforeSp=this.s.spirit;
  if(!this.tick(p.minutes,p.hungerCost,p.waterCost-this.extra(p.minutes).water,0))return {ok:false};
  this.s.hp=Math.min(this.s.maxHp,this.s.hp+p.hpGain);
  this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+p.spiritGain);
  const hpDelta=this.s.hp-beforeHp,spDelta=this.s.spirit-beforeSp;
  const signed=x=>(x>=0?'+':'')+x;
  const label=mode==='night'||mode==='dawn'?'安睡至'+this.clock:'洞府休息'+p.minutes+'分钟';
  const msg=label+' · 气血'+signed(hpDelta)+' · 灵力'+signed(spDelta)
   +(p.factor===0?'；饥渴虚弱，未获得恢复，请先补给':p.factor<1?'；补给偏低，恢复效果下降':'');
  this.log(msg,hpDelta<0||p.factor===0?'bad':'good');
  return this.note(msg,hpDelta<0||p.factor===0?'warn':'ok');
 }
`);
 section(' if(game.atCamp)return `<button data-a="panel" data-name="camp" class="important">洞府</button>',
 ' if(l===\'shrine\')return',String.raw`
 if(game.atCamp){
  const hungry=game.restForecast('camp').factor===0;
  return '<button data-a="panel" data-name="camp" class="important">洞府</button>'
   +(hasGround?pickup:'<button data-a="rest" data-mode="camp" title="'+(hungry?'饥渴虚弱：休息不会回血回灵，气血会随时间下降':'休息3小时：按时长与补给恢复')+'">'+(hungry?'休息·饥渴':'休息')+'</button>');
 }
`);
 rep("$('rest-button').textContent=game.workshop?'休息':'调息';$('rest-button').disabled=!!game.s.secretRealm;",
  "$('rest-button').textContent=game.workshop?'休息':'调息';$('rest-button').disabled=!!game.s.secretRealm;$('rest-button').title=game.restForecast(game.workshop?'camp':'field').factor===0?'饥渴严重：无法靠休息恢复，气血会随时间减少':'按休息时长与饱腹饮水恢复';");
 rep(" out+=`<div class=\"camp-training-entry\">",String.raw`
 if(at){
  const forecast=game.restForecast('camp'),weak=forecast.factor===0;
  out+='<section class="trial-note"><strong>'+(weak?'饥渴虚弱 · 请先补给':'休息结算 · 根据时间恢复')+'</strong><p>洞府休息180分钟：预计气血'+(forecast.netHp>=0?'+':'')+forecast.netHp+'，灵力'+(forecast.netSpirit>=0?'+':'')+forecast.netSpirit+'；饱腹−'+forecast.hungerCost+'，饮水−'+forecast.waterCost+'。</p>'
   +'<p class="'+(weak?'danger-text':'muted')+'">'+(forecast.willCollapse?'该次休息预计会重伤折寿，建议先用餐补水。':weak?'无法从睡眠获得气血或灵力；零饱腹、零饮水会随时间持续扣血。请先在洞府用餐补水。':'饱腹与饮水低于35时恢复逐步减弱，低于或等于10时停止恢复。长时间睡眠也按真实时长计算。')+'</p></section>';
 }
 out+=`+"`<div class=\"camp-training-entry\">");
 rep("root.QData=D;",String.raw`
HELP.push({id:'survival-time',title:'饥渴与休息：按时间结算',paragraphs:[
 '气血损失按实际时间累计：饱腹0时每小时至少损失4气血，饮水0时每小时至少损失8气血；两项耗尽时叠加，高境人物由于气血上限较高，伤害也相应增加。',
 '每次行动原有的饱腹、饮水消耗保持不变。一次长行动若中途耗尽补给，仅从耗尽时开始计算伤害。连续短行动与等时长的长行动使用同一套时间计算规则。',
 '洞府安睡及休息按分钟恢复气血和灵力。补给充足才能完整恢复，任一补给低于或等于10则停止恢复，请先在洞府用餐补水。'
]});
root.QData=D;`);
 if((s.match(/<script\b/gi)||[]).length!==10||(s.match(/<\/html>/gi)||[]).length!==1)throw Error("V90.1 integrity failed");
 return s;
}
module.exports={buildV901};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const base=fs.readFileSync(path.join(root,'releases/山野修仙记_V90_高境异能与秘闻事件完整版.html'),'utf8');const dest=path.join(root,'releases/山野修仙记_V90.1_饥渴时间结算修正版.html');fs.writeFileSync(dest,buildV901(base),'utf8');console.log('V90.1 generated');}
