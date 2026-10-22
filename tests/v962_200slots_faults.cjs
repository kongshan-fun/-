'use strict';
// V90.62 acceptance: dual-race 200-slot compensation, fault injection and retry.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.equal(blocks.length,10,'script count');
const ctx=vm.createContext({console});ctx.globalThis=ctx;ctx.window=ctx;
for(let i=0;i<6;i++)vm.runInContext(blocks[i],ctx);
const Game=ctx.QGame,Slots=ctx.QCharacterSlots;
const map=new Map();
let failKey=null,checks=0,failuresInjected=0,retries=0;
const storage={
 getItem(k){return map.has(k)?map.get(k):null},
 setItem(k,v){if(k===failKey)throw Error('QuotaExceeded: injected '+k);map.set(k,String(v))},
 removeItem(k){map.delete(k)}
};
const slots=new Slots(storage);
const snapshot=[];
for(const race of ['human','demon']){
 for(let n=1;n<=100;n++){
  const old=Game.fresh(261014,race);
  old.rebuilt=0;
  old.major=n%3===1?6:0;
  old.ascended=n%3===2;
  const tier=n%3===2?1000:n%3===1?600:300;
  const key=slots.key(race,n),legacyKey=key+'-legacy-v1',backup=slots.backupKey(race,n);
  const oldRaw=JSON.stringify(old);
  map.set(key,oldRaw);
  map.set(backup,oldRaw);
  const neighbor=race==='human'?'demon':'human';
  const foreignKey=slots.key(neighbor,n);
  const foreignBefore=map.get(foreignKey)||null;
  assert.equal(slots.read(race,n).reset.tier,tier,'old tier '+race+' '+n);checks++;
  if(n%17===0){
   failKey=legacyKey;
   assert.throws(()=>slots.resetRebuilt(race,n),/QuotaExceeded/,'ledger fault '+race+' '+n);checks++;
   failKey=null;failuresInjected++;
   assert.equal(map.get(key),oldRaw,'ledger failure preserves original '+race+' '+n);checks++;
   assert.equal(map.get(backup),oldRaw,'ledger failure preserves backup '+race+' '+n);checks++;
  }
  if(n%13===0){
   failKey=key;
   assert.throws(()=>slots.resetRebuilt(race,n),/QuotaExceeded/,'slot-write fault '+race+' '+n);checks++;
   failKey=null;failuresInjected++;retries++;
   assert.equal(map.get(key),oldRaw,'slot failure preserves original '+race+' '+n);checks++;
   assert.equal(map.get(backup),oldRaw,'slot failure preserves backup '+race+' '+n);checks++;
   assert.equal(slots.legacy(race,n).balance,tier,'pre-credited ledger survives failed slot '+race+' '+n);checks++;
  }
  const claimedBefore=!!slots.legacy(race,n).rebuildCompensation;
  const result=slots.resetRebuilt(race,n);
  assert.equal(result.paid,claimedBefore?0:tier,'correct payout '+race+' '+n);checks++;
  assert.equal(slots.legacy(race,n).balance,tier,'one-time ledger '+race+' '+n);checks++;
  assert.equal(slots.status(race,n).status,'ready','new slot playable '+race+' '+n);checks++;
  assert.equal(map.has(backup),false,'old backup cleared after success '+race+' '+n);checks++;
  assert.equal(map.get(foreignKey)||null,foreignBefore,'other race same slot unchanged '+race+' '+n);checks++;
  if(n%11===0){
   const ledger=slots.legacy(race,n);ledger.balance=0;slots.putLegacy(race,n,ledger);
   map.set(key,oldRaw);
   const again=slots.resetRebuilt(race,n);retries++;
   assert.equal(again.paid,0,'never pay twice '+race+' '+n);checks++;
   assert.equal(slots.legacy(race,n).balance,0,'never replenish spent jade '+race+' '+n);checks++;
   assert.equal(slots.status(race,n).status,'ready','repeated old-save import playable '+race+' '+n);checks++;
  }
  snapshot.push({race,n,tier});
 }
}
assert.equal(snapshot.length,200);checks++;
const ready=snapshot.every(({race,n})=>slots.status(race,n).status==='ready');
assert.ok(ready,'all 200 playable after fault and retry');checks++;
for(let n=1;n<=100;n++){
 const human=slots.key('human',n),demon=slots.key('demon',n);
 assert.notEqual(human,demon,'race slot keys independent');checks++;
}
console.log('V90.62 DUAL-RACE 200/200 slots PASS; '+checks+' assertions; '+failuresInjected+' injected write failures; '+retries+' retries');