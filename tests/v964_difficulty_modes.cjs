'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.equal(blocks.length,10,'script blocks unchanged');
for(const block of blocks)new vm.Script(block);
const c=vm.createContext({console});c.globalThis=c;c.window=c;
for(let i=0;i<6;i++)vm.runInContext(blocks[i],c);
const D=c.QData,G=c.QGame,Slots=c.QCharacterSlots;
let count=0;
function equal(x,y,label){assert.equal(x,y,label);count++}
equal(Object.keys(D.DIFFICULTIES).length,3,'three difficulty definitions');
for(const [id,factor] of [['easy',0.5],['standard',0.8],['challenge',1]]){
 const g=new G(null,261014,'human');g.s.difficulty=id;
 const expected=Math.max(1,Math.round(D.REALM_BASE[g.realmIndex-1]*D.STAGE_MULT[g.stageIndex-1]*factor));
 equal(g.required,expected,id+' requirement');
 const b=g.startBattle('boss0');
 assert.ok(b?.ok,id+' battle created');count++;
 const enemy=D.ENEMIES.boss0,combat=g.s.combat;
 equal(combat.maxHp,Math.max(1,Math.round(enemy.hp/g.playerDampen*factor)),id+' mob hp');
 equal(combat.atk,Math.max(1,Math.round(enemy.atk*g.enemyBoost*factor)),id+' mob attack');
 equal(combat.armor,Math.max(0,Math.round(enemy.armor*factor)),id+' mob armor');
 const loaded=new G(g.state(),261014,'human');
 equal(loaded.s.difficulty,id,id+' load mode');
 equal(loaded.s.combat.maxHp,combat.maxHp,id+' monster save roundtrip');
 equal(loaded.s.combat.atk,combat.atk,id+' monster atk roundtrip');
}
const mock=new Map();let active='challenge';
const base=D.SLOT_PREFIX;
const storage={
 key(k){k=String(k);return active==='challenge'?k:k.startsWith(base)?base+active+'-'+k.slice(base.length):'shanye-mode-'+active+':'+k;},
 getItem(k){return mock.get(this.key(k))??null},
 setItem(k,v){mock.set(this.key(k),String(v))},
 removeItem(k){mock.delete(this.key(k))}
};
const slots=new Slots(storage),originalChallengeKey=slots.key('human',1);
const seen=new Set();
for(const mode of ['challenge','standard','easy']){
 active=mode;slots.setDifficulty(mode);
 for(const race of ['human','demon']){
  const g=slots.newGame(race,261014,1);
  equal(g.s.difficulty,mode,'new role mode '+mode+' '+race);
  const physical=storage.key(slots.key(race,1));assert.ok(!seen.has(physical),'isolated physical key');seen.add(physical);count++;
  const read=slots.read(race,1).game;
  equal(read.s.difficulty,mode,'read mode '+mode+' '+race);
  equal(slots.status(race,1).status,'ready','status valid');
  if(mode!=='challenge'){
   g.s.difficulty='challenge';
   assert.throws(()=>slots.save(race,g,1),/跨模式/,'write rejected');count++;
   g.s.difficulty=mode;
  }
 }
}
equal(seen.size,6,'six independently addressed slots');
active='challenge';slots.setDifficulty('challenge');
equal(storage.key(originalChallengeKey),originalChallengeKey,'legacy challenge key preserved');
active='easy';slots.setDifficulty('easy');
equal(slots.leaderboard().records.length,0,'easy has no competitive board');
assert.equal(typeof slots.recordAscension,'function');count++;
const simple=slots.read('human',1).game;
simple.s.ascended=true;simple.s.ascensionRecord={race:'human',runId:'test-easy',elapsedMinutes:1,defeats:0,remainingLifeMinutes:1};
equal(slots.recordAscension('human',1,simple),null,'easy skip record');
equal(slots.leaderboard().records.length,0,'easy no leaderboard after ascension');
assert.match(html,/function difficultyPage\(/);count++;
assert.match(html,/difficulty-open/);count++;
assert.match(html,/difficulty-rank/);count++;
assert.match(html,/showPage\(\{kind:'modes'\}\)/);count++;
console.log('V90.64 THREE MODES '+count+' assertions PASS');
