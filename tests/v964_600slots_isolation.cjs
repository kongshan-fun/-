'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const c=vm.createContext({console});c.globalThis=c;c.window=c;for(let i=0;i<6;i++)vm.runInContext(blocks[i],c);
const Slots=c.QCharacterSlots,G=c.QGame,D=c.QData;
const db=new Map();let mode='challenge';
const storage={
 name(key){const k=String(key);return mode==='challenge'?k:k.startsWith(D.SLOT_PREFIX)?D.SLOT_PREFIX+mode+'-'+k.slice(D.SLOT_PREFIX.length):'shanye-mode-'+mode+':'+k},
 getItem(k){return db.get(this.name(k))??null},
 setItem(k,v){db.set(this.name(k),String(v))},
 removeItem(k){db.delete(this.name(k))}
};
const slots=new Slots(storage),observed=new Set();let pass=0;
const initialChallengeSlot=slots.key('human',1);
for(const diff of ['challenge','standard','easy']){
 mode=diff;slots.setDifficulty(diff);
 for(const race of ['human','demon']){
  for(let n=1;n<=100;n++){
   const id=storage.name(slots.key(race,n));
   assert.ok(!observed.has(id),'physical slot shared across mode: '+id);observed.add(id);pass++;
   const g=slots.newGame(race,261014+n,n);
   assert.equal(g.s.difficulty,diff,'fresh difficulty '+diff+' '+race+' '+n);pass++;
   assert.equal(slots.read(race,n).game.s.difficulty,diff,'roundtrip '+diff+' '+race+' '+n);pass++;
   const led=slots.legacy(race,n);led.balance=n;slots.putLegacy(race,n,led);
   assert.equal(slots.legacy(race,n).balance,n,'ledger '+diff+' '+race+' '+n);pass++;
  }
 }
}
assert.equal(observed.size,600,'600 unique mode/race/number save keys');pass++;
mode='challenge';slots.setDifficulty('challenge');
assert.equal(storage.name(initialChallengeSlot),initialChallengeSlot,'V90.62 challenge keys remain unchanged');pass++;
const base=db.get(initialChallengeSlot);
for(const other of ['easy','standard']){
 mode=other;slots.setDifficulty(other);
 assert.ok(storage.name(slots.key('human',1))!==initialChallengeSlot);pass++;
 assert.notEqual(db.get(storage.name(slots.key('human',1))),base);pass++;
}
mode='challenge';slots.setDifficulty('challenge');
assert.equal(db.get(initialChallengeSlot),base,'old challenge untouched');pass++;
console.log('V90.64 ALL 600 SLOTS PASS '+pass+' assertions');
