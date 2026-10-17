'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const release='山野修仙记_V90_高境异能与秘闻事件完整版.html';
const html=fs.readFileSync(path.join(root,'releases',release),'utf8');
const v89=fs.readFileSync(path.join(root,'releases/山野修仙记_V89_九霄终劫与凡界终章完整版.html'),'utf8');
const builder=require('../tools/build-p11-v90.cjs');
assert.equal(html,builder.buildP11(v89),'V90 必须能够从未改动的 V89 原始文件完整复建');
assert.equal((html.match(/<!doctype html>/gi)||[]).length,1);
assert.equal((html.match(/<\/html>/gi)||[]).length,1);
assert.equal(html.trimEnd().endsWith('</html>'),true);
function load(source){
 const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 assert.equal(scripts.length,10,'必须恰好 10 段 JS，防止重复与错位');
 scripts.forEach((script,i)=>new vm.Script(script,{filename:'inline-'+i+'.js'}));
 const ctx=vm.createContext({console});
 ctx.globalThis=ctx;
 for(let i=0;i<5;i++)vm.runInContext(scripts[i],ctx,{timeout:7000});
 return ctx;
}
const C=load(html),OLD=load(v89),G=C.QGame,D=C.QData;
assert.equal(Object.keys(D.HIGH_TRAITS).length,14);
assert.equal(D.HIGH_EVENTS.length,3);
assert.equal(JSON.stringify(D.ENEMIES),JSON.stringify(OLD.QData.ENEMIES),'P11 不得悄悄调整敌人的 HP/ATK/护甲/掉落');
assert.equal(JSON.stringify(D.ZONES),JSON.stringify(OLD.QData.ZONES),'P11 不应改变 12 张地图与关卡');
let checked=5;
const check=(name,condition)=>{assert.ok(condition,name);checked++};
function make(role,z=5,seed=457777){
 const s=G.fresh(seed,role);
 s.zone=z;s.unlocked=12;s.major=8;s.ritual=Array(12).fill(true);s.cleared=Array(12).fill(true);
 s.life.left=7000000;
 const g=new G(s,seed,role);
 g.s.maxHp=g.s.hp=6000;g.s.maxSpirit=g.s.spirit=900;g.s.hunger=g.s.water=100;
 return g;
}
const abilities=['seal','mirage','delay','rift','barrier','counter','storm'];
for(const role of ['human','demon']){
 for(let z=5;z<=11;z++){
  const id=abilities[z-5],wild='realm'+z,boss='boss'+z;
  for(const enemy of [wild,boss]){
   const g=make(role,z);
   check(role+enemy+' trait',D.HIGH_TRAITS[enemy].id===id);
   check(role+enemy+' start',g.startBattle(enemy).ok===true);
   check(role+enemy+' third-turn signal',g.nextBattleIntent({...g.s.combat,turn:3})==='trait');
   if(enemy===boss)check(role+enemy+' old boss skill preserved',g.nextBattleIntent({...g.s.combat,turn:4})==='skill');
   g.s.combat.intent='trait';
   check(role+enemy+' preview',g.traitHint().length>=12);
   const pre=g.s.stats.kills,result=g.fight('guard');
   check(role+enemy+' combat advances',result.ok===true&&g.s.combat.turn===2&&g.s.stats.kills===pre);
   if(['delay','storm'].includes(id))check(role+enemy+' charge',g.s.combat.charge===id&&g.s.combat.intent==='heavy');
   if(id==='barrier')check(role+enemy+' ward',g.s.combat.barrier===true);
   const re=new G(g.state(),457777,role);
   check(role+enemy+' midfight restore',!!re.s.combat&&re.s.combat.type===enemy);
   if(['delay','storm'].includes(id))check(role+enemy+' charged save',re.s.combat.charge===id);
   if(id==='barrier')check(role+enemy+' ward save',re.s.combat.barrier===true);
  }
  for(const seed of [4512,7821]){
   const g=make(role,z,seed),before=g.s.seed;
   const ev=g.ensureHighEvent(),again=g.ensureHighEvent(),duplicate=make(role,z,seed).ensureHighEvent();
   check(role+z+seed+' event allocated',ev&&ev.tile.startsWith(z+':'));
   check(role+z+seed+' seed unchanged',g.s.seed===before);
   check(role+z+seed+' repeat deterministic',JSON.stringify(ev)===JSON.stringify(again)&&JSON.stringify(ev)===JSON.stringify(duplicate));
   check(role+z+seed+' no story tile',!D.SITES[ev.tile]&&!D.EVENTS[ev.tile]);
   const xy=ev.tile.split(':')[1].split(',').map(Number);
   const neighbor={x:xy[0]>0?xy[0]-1:xy[0]+1,y:xy[1]};
   g.s.pos=neighbor;g.s.last=neighbor;
   const walked=g.move(xy[0],xy[1]);
   check(role+z+seed+' event found by actual movement',walked.ok!==false&&g.highEventAt?.id===ev.id&&ev.status==='pending');
   const s=g.state(),carry=new G(s,seed,role);
   check(role+z+seed+' pending saved',carry.highEventAt?.id===ev.id);
   const safe=carry.highEventPlan('observe'),deep=carry.highEventPlan('probe');
   check(role+z+seed+' preview exact',safe.damage===0&&deep.damage>0&&deep.minutes>safe.minutes);
   const count=carry.s.stats.events;
   check(role+z+seed+' safe claim',carry.highEventResolve('observe').ok===true);
   check(role+z+seed+' exactly one claim',carry.s.stats.events===count+1&&carry.s.highEvents[z].status==='done');
   check(role+z+seed+' repeat blocked',carry.highEventResolve('observe').ok===false);
   check(role+z+seed+' persisted done',new G(carry.state(),seed,role).s.highEvents[z].status==='done');
  }
  // All three archetypes and both choices must use the existing inventory.
  for(const spec of D.HIGH_EVENTS)for(const mode of ['observe','probe']){
   const g=make(role,z);g.s.highEvents[z]={id:spec.id,tile:g.key(),status:'pending'};
   const p=g.highEventPlan(mode),items=Object.keys(p.loot),previous=g.s.stats.events;
   check(role+z+spec.id+mode+' original items',items.every(k=>!!D.ITEMS[k]));
   check(role+z+spec.id+mode+' one shot',g.highEventResolve(mode).ok===true&&g.s.stats.events===previous+1);
   check(role+z+spec.id+mode+' no replay',g.highEventResolve(mode).ok===false);
  }
 }
}
for(const role of ['human','demon']){
 const g=make(role,5);delete g.s.highEvents;
 check(role+' legacy missing field',Object.keys(new G(g.state(),457777,role).s.highEvents).length===0);
 const own=make(role,5),bad=own.state();bad.highEvents={5:{id:'forged',tile:'5:9,9',status:'done'}};
 check(role+' malformed event isolated',Object.keys(new G(bad,457777,role).s.highEvents).length===0);
 const fallen=make(role,5);fallen.s.highEvents[5]={id:'omen',tile:fallen.key(),status:'pending'};fallen.s.hp=1;
 const oldLoss=fallen.s.life.losses;
 check(role+' risky death returns failure',fallen.highEventResolve('probe').ok===false);
 check(role+' defeat penalty not duplicated',fallen.s.life.losses===oldLoss+1&&fallen.s.highEvents[5].status==='done');
 check(role+' failed event cannot farm',fallen.highEventResolve('probe').ok===false);
 const foreign=make(role,5).state();
 check(role+' cross-race save rejected',(()=>{try{new G(foreign,457777,role==='human'?'demon':'human');return false;}catch{return true;}})());
}
// Protect the P10 direct and optional endings, including original exact material cost.
for(const role of ['human','demon']){
 for(const a of ['ward','channel','endure'])for(const b of ['ward','channel','endure'])for(const c of ['ward','channel','endure']){
  const g=make(role,11);g.s.pos={x:7,y:5};g.s.daoXp=200;g.s.inv.tribulationCrystal=10;g.s.inv.ascendToken=10;
  check(role+' heaven start',g.heavenStart().ok!==false);
  check(role+' heaven first',g.heavenAct(a).ok!==false);
  const saved=new G(g.state(),457777,role);
  check(role+' heaven restored',saved.heavenTrial.phase===2);
  check(role+' heaven second',saved.heavenAct(b).ok!==false);
  check(role+' heaven third',saved.heavenAct(c).ok!==false&&saved.heavenTrial.complete);
  const n=saved.s.inv.tribulationCrystal,m=saved.s.inv.ascendToken;
  check(role+' ascend',saved.ascend().ok!==false&&saved.s.ascended);
  check(role+' fixed cost',saved.s.inv.tribulationCrystal===n-3&&saved.s.inv.ascendToken===m-2);
 }
 const direct=make(role,11);direct.s.pos={x:7,y:5};direct.s.daoXp=200;direct.s.inv.tribulationCrystal=10;direct.s.inv.ascendToken=10;
 check(role+' original direct ascension',direct.ascend().ok!==false&&direct.s.ascended);
}
console.log('P11 V90 PASS '+checked+' assertions; 10/10 scripts compile; double-race seven-zone checks and P10 regressions.');
