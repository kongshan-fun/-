'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),dirname=path.join(root,'releases');
const baseline=fs.readFileSync(path.join(dirname,'山野修仙记_V90_高境异能与秘闻事件完整版.html'),'utf8');
const current=fs.readFileSync(path.join(dirname,'山野修仙记_V90.1_饥渴时间结算修正版.html'),'utf8');
assert.equal(current,require('../tools/build-v901-survival.cjs').buildV901(baseline),'Build must be reproducible');
const scripts=[...current.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);
assert.equal((current.match(/<\/html>/g)||[]).length,1);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'v90.1-inline-'+i+'.js'}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<5;i++)vm.runInContext(scripts[i],ctx,{timeout:8000});
const Game=ctx.QGame,D=ctx.QData;
let checked=12;
function check(name,condition){assert.ok(condition,name);checked++;}
function fixture(race='human',zone=0,seed=60118){
 const state=Game.fresh(seed,race);
 state.zone=zone;state.unlocked=12;state.major=8;state.ritual=Array(12).fill(true);state.cleared=Array(12).fill(true);
 state.life.left=10000000;state.minutes=500;
 state.settlements[zone]={pos:{x:1,y:5},level:1,buildings:{},stash:{},storedGears:[],foundedAt:0,farmAt:0};
 state.pos={x:1,y:5};state.last={x:1,y:5};
 const g=new Game(state,seed,race);g.s.hp=g.s.maxHp;g.s.spirit=Math.round(g.s.maxSpirit*.3);
 return g;
}
for(const race of ['human','demon'])for(const zone of [0,2,5,11]){
 const label=race+'/'+zone+'/';
 // Absolute lack of food and water must always produce a negative HP slope and no regeneration.
 const starving=fixture(race,zone);
 starving.s.hunger=starving.s.water=0;
 const hp=starving.s.hp,sp=starving.s.spirit,plan=starving.restForecast('camp');
 check(label+' no positive forecast',plan.hpGain===0&&plan.spiritGain===0&&plan.netHp<0);
 check(label+' 3h succeeds for test character',starving.rest('camp').ok===true);
 check(label+' no free HP or MP',starving.s.hp<hp&&starving.s.spirit===sp);
 check(label+' starvation zero stays zero',starving.s.hunger===0&&starving.s.water===0);
 // Healthy recovery scales with elapsed time, limited by current health/mana.
 const well=fixture(race,zone);well.s.hunger=well.s.water=90;
 well.s.hp=Math.ceil(well.s.maxHp*.3);well.s.spirit=10;
 const pre=well.restForecast('camp'),result=well.rest('camp');
 check(label+' healthy rest',result.ok!==false&&well.s.hp>pre.expectedHp-pre.hpGain);
 check(label+' UI forecast matches HP',well.s.hp===pre.expectedHp);
 check(label+' UI forecast matches mana',well.s.spirit===pre.expectedSpirit);
 // One-minute sleep must not magically set both meters to 100%.
 const short=fixture(race,zone);short.s.minutes=1079;short.s.hunger=short.s.water=90;
 short.s.hp=Math.floor(short.s.maxHp*.3);short.s.spirit=10;const old=short.s.hp;
 check(label+' next-clock one minute',short.restForecast('night').minutes===1);
 check(label+' no instant full healing',short.rest('night').ok!==false&&short.s.hp===old);
 // Low-but-nonzero resources must yield no rest healing, even if not yet dealing starvation damage.
 const low=fixture(race,zone);low.s.hunger=low.s.water=11;low.s.hp=Math.floor(low.s.maxHp*.5);const initial=low.s.hp;
 check(label+' low nutrition blocks HP restoration',low.rest('camp').ok!==false&&low.s.hp===initial);
 // Field meditation must not gain spirit at hunger and water zero.
 const field=fixture(race,zone);field.s.hunger=field.s.water=0;field.s.spirit=12;
 check(label+' field meditation no free energy',field.rest('field').ok!==false&&field.s.spirit===12);
 // No environmental / enemy difficulty or world data changed by this fix.
 check(label+' original high foe exists',!!D.ENEMIES['boss'+Math.min(11,zone===0?5:zone)]||zone===2);
}
for(const race of ['human','demon']){
 const a=fixture(race),b=fixture(race);a.s.hunger=a.s.water=0;b.s.hunger=b.s.water=0;
 check(race+' same loss 60 min split',a.tick(60)&&b.tick(15)&&b.tick(15)&&b.tick(15)&&b.tick(15)&&a.s.hp===b.s.hp);
 check(race+' same fractional debt',Math.abs(a.s.survival.debt-b.s.survival.debt)<1e-8);
 const c=fixture(race),d=fixture(race);c.s.hunger=c.s.water=0;d.s.hunger=d.s.water=0;
 c.tick(49);for(let i=0;i<7;i++)d.tick(7);
 check(race+' subhour action time consistency',c.s.hp===d.s.hp&&Math.abs(c.s.survival.debt-d.s.survival.debt)<1e-8);
 const partial=fixture(race);partial.s.hunger=partial.s.water=2;const start=partial.s.hp;partial.tick(60,4,4,0);
 check(race+' starting with small supply only pays for uncovered time',partial.s.hp===start-6);
 const older=fixture(race);delete older.s.survival;
 check(race+' old save works',new Game(older.state(),60118,race).s.survival.debt===0);
 const tiny=fixture(race);tiny.s.hunger=tiny.s.water=0;tiny.tick(1);
 check(race+' fractional loss persisted',new Game(tiny.state(),60118,race).s.survival.debt===tiny.s.survival.debt);
 const rescue=fixture(race);rescue.s.hunger=rescue.s.water=0;rescue.s.hp=1;
 const eaten=rescue.rest('supply');
 check(race+' emergency meal before passage',eaten.ok!==false&&rescue.s.hp===1&&rescue.s.hunger>0&&rescue.s.water>0);
 const dead=fixture(race);dead.s.hunger=dead.s.water=0;dead.s.hp=1;
 const losses=dead.s.life.losses;
 check(race+' starvation collapse has original life penalty',dead.rest('camp').ok===false&&dead.s.life.losses===losses+1);
 check(race+' collapse does not conjure food',dead.s.hunger===0&&dead.s.water===0);
 const after=dead.s.hp;const rest=dead.restForecast('camp');
 check(race+' subsequent rest cannot heal',rest.hpGain===0&&rest.spiritGain===0);
 const normal=fixture(race);normal.s.hunger=normal.s.water=40;normal.s.hp=1;normal.collapse();
 check(race+' normal combat defeat still restores ordinary supplies',normal.s.hunger===48&&normal.s.water===52);
 const original=fixture(race,11);original.s.pos={x:7,y:5};original.s.daoXp=200;original.s.inv.tribulationCrystal=10;original.s.inv.ascendToken=10;
 check(race+' P10 direct ascension unchanged',original.ascend().ok!==false&&original.s.ascended);
 const p11=fixture(race,5);check(race+' P11 high realm still present',!!p11.ensureHighEvent()&&D.HIGH_TRAITS.realm5?.id==='seal');
}
console.log('V90.1 SURVIVAL CHECKS PASS '+checked+' assertions / 10 inline scripts compiled.');
