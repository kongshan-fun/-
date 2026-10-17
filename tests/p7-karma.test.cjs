'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../releases/山野修仙记_V86_跨境因果与旧印追索完整版.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10,'all original script modules should remain intact');
scripts.forEach((source,i)=>new vm.Script(source,{filename:'inline-script-'+i+'.js'}));
const ctx=vm.createContext({console});
ctx.globalThis=ctx;
for(let i=0;i<=4;i++)vm.runInContext(scripts[i],ctx,{timeout:5000});
const {QGame:G,QData:D}=ctx;
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name);}
function oldRealm(race,stele){
 const state=G.fresh(48993,race);
 state.zone=3;state.unlocked=4;state.pos={x:3,y:6};state.last={x:3,y:6};
 state.cleared=Array.from({length:12},(_,i)=>i<3);state.ritual=state.cleared.slice();
 state.flags.steleChoice=stele;
 state.spirit=state.maxSpirit=220;state.hunger=state.water=100;
 state.inv.herb=8;state.inv.stone=8;state.life.left=1000000;
 return new G(state,48993,race);
}
function laterRealm(g,race){
 g.s.zone=9;g.s.pos={x:3,y:3};g.s.last={x:3,y:3};
 g.s.cleared=Array.from({length:12},(_,i)=>i<9);g.s.ritual=g.s.cleared.slice();
 g.s.unlocked=10;g.s.major=5;g.s.spirit=220;g.s.hunger=g.s.water=100;
 // Fixture models the actual breakthrough recovery before the city scene.
 const out=new G(g.state(),48993,race);
 out.s.hp=out.s.maxHp;out.s.spirit=out.s.maxSpirit;
 return out;
}
check('V86 still has 12 base maps',()=>assert.equal(D.ZONES.length,12));
check('two new sites are inside existing maps',()=>{
 assert.equal(D.SITES['3:3,6'].id,'karma-marsh');
 assert.equal(D.SITES['9:3,3'].id,'karma-city');
 assert.equal(D.ZONES[3].map[6][3],'forest');
 assert.notEqual(D.ZONES[9].map[3][3],'boss');
});
for(const race of ['human','demon'])for(const stele of [0,1,2])for(const source of [1,2])for(const ending of ['reconcile','defy']){
 const name=race+'/stele'+stele+'/witness'+source+'/'+ending;
 const game=oldRealm(race,stele);
 check(name+' begins on site',()=>assert.equal(game.karmaReason('marsh'),''));
 const observed=game.karmaActionCost(4,20),energy=game.s.spirit;
 check(name+' clue cost matches native terrain',()=>{
  assert.notEqual(game.karmaRead().ok,false);
  assert.equal(game.s.spirit,energy-observed.spirit);
 });
 check(name+' old clue cannot rescan',()=>assert.equal(game.karmaRead().ok,false));
 const planned=game.karmaActionCost(source===1?6:4,source===1?35:30),before=game.s.spirit;
 check(name+' commits exclusive witness choice',()=>{
  assert.notEqual(game.karmaWitnessChoose(source).ok,false);
  assert.equal(game.karmaWitness.choice,source);
  assert.equal(game.s.spirit,before-planned.spirit);
 });
 check(name+' prevents choice switching',()=>assert.equal(game.karmaWitnessChoose(source===1?2:1).ok,false));
 const city=laterRealm(game,race);
 check(name+' restores across realms',()=>assert.equal(city.karmaWitness.choice,source));
 check(name+' derives genuine settlement price',()=>{
  assert.equal(city.karmaReconcileCost().herb,1+(source===2?1:0)+(stele===1?0:1));
 });
 const herb=city.s.inv.herb,hp=city.s.hp,harm=city.karmaDefyDamage();
 check(name+' makes final mutually-exclusive selection',()=>{
  assert.notEqual(city.karmaConclude(ending).ok,false);
  assert.equal(city.karmaReckoning.ending,ending==='reconcile'?1:2);
  if(ending==='reconcile')assert.equal(city.s.inv.herb,herb-city.karmaReconcileCost().herb);
  else assert.equal(city.s.hp,hp-harm);
 });
 const story=city.karmaEndingStory();
 city.s.flags.steleChoice=(stele+1)%3;
 check(name+' freezes historical memory at resolution',()=>assert.equal(city.karmaEndingStory(),story));
 const minute=city.s.minutes;
 check(name+' no repeat payout or opposite ending',()=>{
  assert.equal(city.karmaConclude(ending==='reconcile'?'defy':'reconcile').ok,false);
  assert.equal(city.s.minutes,minute);
 });
 const again=new G(city.state(),48993,race);
 check(name+' conclusion survives normalization',()=>{
  assert.equal(again.karmaReckoning.ending,ending==='reconcile'?1:2);
  assert.equal(again.karmaEndingStory(),story);
 });
}
for(const race of ['human','demon']){
 check(race+' missing original experience cannot be invented',()=>{
  const g=laterRealm(oldRealm(race,0),race),before=g.s.minutes;
  assert.equal(g.karmaConclude('reconcile').ok,false);
  assert.equal(g.s.minutes,before);
 });
 check(race+' V14 without P7 flags stays unvisited',()=>{
  const o=oldRealm(race,0).state();delete o.flags.karmaWitness;delete o.flags.karmaReckoning;
  const loaded=new G(o,48993,race);
  assert.equal(loaded.karmaWitness.stage,0);
  assert.equal(loaded.karmaReckoning.ending,0);
 });
}
check('marsh humidity/poison cost is included in preview',()=>{
 const g=oldRealm('human',1),sp=g.s.spirit,shown=g.karmaActionCost(4,20).spirit;
 assert(shown>=4);g.karmaRead();assert.equal(g.s.spirit,sp-shown);
});
check('borderline insufficient energy never causes unpreviewed HP loss',()=>{
 const g=oldRealm('demon',2);
 g.s.spirit=g.karmaActionCost(4,20).spirit;
 const hp=g.s.hp,minute=g.s.minutes;
 assert.equal(g.karmaRead().ok,false);
 assert.equal(g.s.hp,hp);assert.equal(g.s.minutes,minute);
});
check('fatal confrontation uses original collapse but does not invent success',()=>{
 const g=oldRealm('human',2);g.karmaRead();g.karmaWitnessChoose(2);
 const city=laterRealm(g,'human'),defeats=city.s.life.losses;
 city.s.hp=Math.max(1,city.karmaDefyDamage()-1);
 city.karmaConclude('defy');
 assert.equal(city.s.life.losses,defeats+1);
 assert.equal(city.karmaReckoning.ending,0);
});
check('unrelated old systems preserved by initial save',()=>{
 const initial=G.fresh(345,'human').flags;
 for(const flag of ['coreTribulation','heartTrial','voidRift','mirrorTrial'])assert(initial[flag]);
});
check('stage page and native close paths exist',()=>{
 for(const marker of ['function karmaBody()','data-a="karma-read"','data-a="karma-witness"','data-a="karma-final"','data-a="karma-return"',"['karma','mirror','rift'].includes(panel)"]){
  assert(html.includes(marker),'missing '+marker);
 }
});
console.log('P7 V86 PASSED '+passed+' grouped assertions, 10/10 original script syntax checks.');
