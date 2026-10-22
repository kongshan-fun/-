'use strict';
/* V90.62 P0: XP saved across normalize, level36 XP, one-time old save
   compensation, interrupted localStorage writes, and 200 isolated slots.
   This is an engine/storage test; no resource or battle stats are injected
   into the shipped HTML. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10,'10 embedded scripts');
for(const js of scripts)new vm.Script(js);
const c=vm.createContext({console,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Error,parseInt,parseFloat,isNaN,Set,Map,Promise,setTimeout,clearTimeout});
c.globalThis=c;c.window=c;c.self=c;
for(let i=0;i<6;i++)vm.runInContext(scripts[i],c,{timeout:10000});
const G=c.QGame,D=c.QData,Slots=c.QCharacterSlots;
assert.ok(G&&D&&Slots,'engine and slot classes');
let checks=0;
function ok(cond,message){assert.ok(cond,message);checks++;}
function eq(a,b,message){assert.equal(a,b,message);checks++;}
function throws(fn,message){assert.throws(fn,message);checks++;}
class Disk{
 constructor(){this.m=new Map();this.failSet=null;this.failRemove=null;}
 getItem(k){return this.m.has(k)?this.m.get(k):null;}
 setItem(k,v){if(k===this.failSet)throw Error('INJECTED_SET_FAILURE:'+k);this.m.set(k,String(v));}
 removeItem(k){if(k===this.failRemove)throw Error('INJECTED_REMOVE_FAILURE:'+k);this.m.delete(k);}
}
function oldSlot(slots,race,slot,tier=300,version=14){
 const s=G.fresh(20261022+slot,race);
 s.version=version;delete s.rebuilt;
 s.major=tier===600?6:0;s.ascended=tier===1000;
 if(version<14){s.race='human';s.character='human';}
 const raw=JSON.stringify(s);
 slots.storage.setItem(slots.key(race,slot),raw);
 return raw;
}
/* A. Save -> reload XP above requirement for both races and boundaries. */
for(const race of ['human','demon']){
 const store=new Disk(),slots=new Slots(store);
 for(const lv of [3,6,15,18,33,36]){
  const n=lv+1,g=new G(G.fresh(261014+n,race),261014+n,race);
  g.s.level=lv;g.s.xp=g.required+1777;
  slots.save(race,g,n);
  const read=slots.read(race,n).game;
  eq(read.s.xp,g.s.xp,race+' Lv'+lv+' XP survives save/load');
  if(lv%3===0&&lv<36)eq(read.s.pendingTribulation,lv,'ready boundary marker preserved');
 }
 const g=new G(G.fresh(20261023,race),20261023,race);
 g.s.level=36;g.s.xp=g.required+2000;
 const was=g.s.xp;g.xp(123);
 ok(g.s.xp>was,race+' level36 XP increases');
 slots.save(race,g,96);
 eq(slots.read(race,96).game.s.xp,g.s.xp,race+' level36 XP persisted');
}
/* B. Early promotion deducts only this stage requirement, persists surplus. */
{
 const slots=new Slots(new Disk()),g=new G(G.fresh(20261022,'human'),20261022,'human');
 g.s.level=3;g.s.xp=g.required+777;
 g.s.settlements[0]={pos:{x:1,y:5},level:1,buildings:{},stash:{}};
 const need=g.required;const r=g.breakthrough();
 ok(r&&r.ok!==false,'early promotion succeeds');
 eq(g.s.level,4,'promoted to level4');
 eq(g.s.xp,777,'surplus 777 retained');
 slots.save('human',g,1);
 eq(slots.read('human',1).game.s.xp,777,'surplus remains 777 after saving/reopening');
 eq(need>0,true,'positive XP requirement');
}
/* C. Tiered compensation (300/600/1000) and 200 race+slot isolation. */
{
 const disk=new Disk(),slots=new Slots(disk);
 let expectedTotal=0;
 for(const race of ['human','demon']){
  for(let slot=1;slot<=100;slot++){
   const tier=slot%3===0?1000:slot%3===1?600:300;
   oldSlot(slots,race,slot,tier);
   const result=slots.resetRebuilt(race,slot);
   eq(result.paid,tier,'exact compensation '+race+slot);
   const led=slots.legacy(race,slot);
   eq(led.balance,tier,'ledger balance '+race+slot);
   eq(led.total,tier,'ledger total '+race+slot);
   ok(!!led.rebuildCompensation,'single ledger claim marker '+race+slot);
   eq(slots.read(race,slot).game.s.version,14,'replacement readable '+race+slot);
   eq(disk.getItem(slots.key(race,slot)+'-rebuild-compensated'),'1','legacy done flag '+race+slot);
   throws(()=>slots.resetRebuilt(race,slot),'cannot claim a completed new slot '+race+slot);
   expectedTotal+=tier;
  }
 }
 ok(expectedTotal>0,'200 slots compensated in isolated ledgers');
}
/* D. Disk write failures must never delete old save before replacement. */
for(const phase of ['backup','ledger','primary']){
 const disk=new Disk(),slots=new Slots(disk),key=slots.key('human',1);
 const raw=oldSlot(slots,'human',1,600);
 disk.failSet=phase==='backup'?slots.backupKey('human',1):phase==='ledger'?slots.legacyKey('human',1):key;
 throws(()=>slots.resetRebuilt('human',1),'failure injected at '+phase);
 eq(disk.getItem(key),raw,'original primary preserved: '+phase);
 eq(slots.read('human',1).reset.tier,600,'old save still recoverable: '+phase);
 const after=slots.legacy('human',1);
 eq(after.balance,phase==='primary'?600:0,'ledger credit sequence: '+phase);
 disk.failSet=null;
 const first=slots.resetRebuilt('human',1);
 eq(first.paid,phase==='primary'?0:600,'retry pays at most once '+phase);
 eq(slots.legacy('human',1).balance,600,'post-retry balance '+phase);
 eq(slots.read('human',1).game.s.version,14,'recovered new save '+phase);
}
/* E. Once credited, money spent cannot trigger an automatic top-up. */
{
 const disk=new Disk(),slots=new Slots(disk),key=slots.key('human',2);
 oldSlot(slots,'human',2,1000);
 disk.failSet=key;throws(()=>slots.resetRebuilt('human',2),'interrupted replace');
 disk.failSet=null;
 let led=slots.legacy('human',2);
 eq(led.balance,1000,'initial ledger credited once');
 led.balance=17;slots.putLegacy('human',2,led);
 const done=slots.resetRebuilt('human',2);
 eq(done.paid,0,'no second payout after spending');
 eq(slots.legacy('human',2).balance,17,'spent balance never replenished');
}
/* F. Preexisting doneKey from previous release must prevent duplicate awards. */
{
 const disk=new Disk(),slots=new Slots(disk),key=slots.key('human',3);
 oldSlot(slots,'human',3,1000);
 disk.setItem(key+'-rebuild-compensated','1');
 const done=slots.resetRebuilt('human',3);
 eq(done.paid,0,'legacy marker suppresses compensation');
 eq(slots.legacy('human',3).balance,0,'legacy balance preserved');
}
/* G. Cleanup interruption is not a failed commit; slot remains readable. */
{
 const disk=new Disk(),slots=new Slots(disk);
 oldSlot(slots,'human',4,300);
 disk.failRemove=slots.backupKey('human',4);
 const r=slots.resetRebuilt('human',4);
 eq(r.paid,300,'once-only payout survives cleanup error');
 ok(!!slots.read('human',4).game,'new primary still opens');
}
/* H. Older raw records are compensable only for their compatible race. */
{
 const slots=new Slots(new Disk());
 oldSlot(slots,'human',5,300,13);
 eq(slots.read('human',5).reset.tier,300,'historical v13 is recognized');
 const r=slots.resetRebuilt('human',5);
 eq(r.paid,300,'historical v13 compensated once');
 const bad=oldSlot(slots,'demon',6,300,13);
 throws(()=>slots.resetRebuilt('demon',6),'pre-v14 single race cannot reset into demon');
 eq(slots.storage.getItem(slots.key('demon',6)),bad,'wrong-race old save untouched');
}
/* I. Structural checks of the actual UI call site. */
ok(html.includes('const result=slots.resetRebuilt(m.race,m.slot);'),'UI uses safe reset API');
ok(!html.includes('if((chk.balance||0)<m.tier)'),'no balance-based top-up');
ok(!html.includes('n.xp=integer(o.xp,0,Math.max(1,Math.round('),'no stage XP clamp');
ok(!html.includes('if(this.s.level>=36){this.s.daoXp=0;return;}'),'level36 XP no longer blocked');
ok(html.includes('get enemyBoost(){return 1+0.10*this.zoneGap;}'),'zone-gating combat scaling unchanged');
console.log('V90.62 P0 INTEGRITY PASS '+checks+' assertions');
