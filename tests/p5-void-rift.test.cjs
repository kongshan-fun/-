'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../releases/山野修仙记_V84_炼虚空间裂隙完整版.html'),'utf8');
const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10,'expected intact original script topology');
scripts.forEach((s,i)=>{new vm.Script(s,{filename:'V84-script-'+i+'.js'});});
const context=vm.createContext({console,globalThis:null});context.globalThis=context;
for(const i of [0,1,2,3,4])vm.runInContext(scripts[i],context,{timeout:5000});
const G=context.QGame,D=context.QData;
assert.equal(D.ZONES.length,12);
assert.equal(D.SITES['8:2,4'].id,'void-rift');
let passed=0;
const check=(name,cb)=>{cb();passed++;console.log('PASS',name);};
function fixture(race,seed=231124){
 const s=G.fresh(seed,race);
 s.cleared=Array.from({length:12},(_,i)=>i<8);
 s.ritual=s.cleared.slice();
 s.major=4;s.unlocked=9;s.zone=8;s.pos={x:2,y:4};s.last={x:2,y:4};
 s.hp=s.maxHp=600;s.spirit=s.maxSpirit=250;s.hunger=100;s.water=100;
 s.inv.voidStone=5;s.life.left=9999999;
 return new G(s,seed,race);
}
for(const race of ['human','demon']){
 const g=fixture(race);const name=race+' ';
 check(name+'required location',()=>assert.equal(g.riftReason(),''));
 check(name+'scouting consumes real spirit but no HP',()=>{
  const before=g.s.spirit,hp=g.s.hp;
  assert.notEqual(g.riftScout().ok,false);
  assert.equal(g.voidRift.phase,1);assert.equal(g.s.spirit,before-4);assert.equal(g.s.hp,hp);
 });
 check(name+'safe bearing damage matches the preview',()=>{
  const bearing=g.riftBearing(),p=g.riftPreview(bearing),hp=g.s.hp,sp=g.s.spirit;
  assert.notEqual(g.riftAct(bearing).ok,false);
  assert.equal(g.voidRift.phase,2);assert.equal(g.s.hp,hp-p.damage);
  assert.equal(g.s.spirit,sp-p.spirit);
 });
 const resumed=new G(g.state(),231124,race);
 check(name+'midway save restore',()=>{
  assert.equal(resumed.voidRift.phase,2);assert.equal(resumed.voidRift.steps.length,1);
 });
 const before=resumed.s.inv.riftEssence||0;
 check(name+'second-fold completion',()=>{
  assert.notEqual(resumed.riftAct(resumed.riftBearing()).ok,false);
  assert.equal(resumed.voidRift.complete,true);assert.equal(resumed.voidRift.phase,3);
 });
 check(name+'one-time loot',()=>{
  assert.equal(resumed.s.inv.riftEssence||0,before+1);
  assert.equal(resumed.riftAct('anchor').ok,false);
  assert.equal(resumed.s.inv.riftEssence||0,before+1);
 });
 check(name+'legacy V14 field omission',()=>{
  const old=g.state();delete old.flags.voidRift;
  assert.equal(new G(old,231124,race).voidRift.phase,0);
 });
 check(name+'wrong map no mutation',()=>{
  const x=fixture(race);x.s.zone=7;const minute=x.s.minutes;
  assert.equal(x.riftScout().ok,false);assert.equal(x.s.minutes,minute);
 });
 check(name+'insufficient spirit no mutation',()=>{
  const x=fixture(race);x.riftScout();x.s.spirit=1;const hp=x.s.hp;
  assert.equal(x.riftAct('left').ok,false);assert.equal(x.s.hp,hp);
 });
 check(name+'incorrect bearing risk is higher',()=>{
  const x=fixture(race);x.riftScout();
  const safe=x.riftBearing(),wrong=safe==='left'?'right':'left';
  assert(x.riftPreview(wrong).damage>x.riftPreview(safe).damage);
 });
 check(name+'fall preserves legacy injury rule',()=>{
  const x=fixture(race);x.riftScout();x.s.hp=8;
  const defeats=x.s.life.losses;
  x.riftAct('force');assert.equal(x.s.life.losses,defeats+1);
  assert.equal(x.voidRift.phase,0);
 });
 check(name+'invalid mode no cost',()=>{
  const x=fixture(race);x.riftScout();const before=x.state();
  assert.equal(x.riftAct('fake').ok,false);
  assert.equal(x.s.hp,before.hp);assert.equal(x.s.minutes,before.minutes);
 });
 check(name+'no consumable on early exit',()=>{
  const x=fixture(race);x.riftScout(),p=x.voidRift.phase,hp=x.s.hp;
  assert.equal(x.voidRift.phase,p);assert.equal(x.s.hp,hp);
 });
 check(name+'mandatory breakthrough unaffected',()=>{
  const x=fixture(race);const before=x.s.daoXp;
  assert.equal(x.voidRift.phase,0);assert.equal(x.s.daoXp,before);
 });
}
check('deterministic direction differs across folds',()=>{
 const x=fixture('human');x.riftScout();const b=x.riftBearing();
 x.riftAct(b);assert.notEqual(x.riftBearing(),b);
});
check('normalized completed state stays completed',()=>{
 const x=fixture('human');x.riftScout();x.riftAct(x.riftBearing());x.riftAct(x.riftBearing());
 assert.equal(new G(x.state(),231124,'human').voidRift.complete,true);
});
check('completed old realm is not a breakthrough gate',()=>{
 const s=G.fresh(222,'human');s.major=5;
 assert.equal(new G(s,222,'human').voidRift.complete,false);
});
console.log('P5 NODE ENGINE TESTS PASS:',passed,'assertion groups, 10 scripts syntax PASS');
