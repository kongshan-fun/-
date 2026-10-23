'use strict';
// V90.64 difficulty and 3 x 200 save isolation (Challenge = unmodified legacy keys).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(blocks.length,10,'existing 10 scripts retained');
const ctx=vm.createContext({console});ctx.globalThis=ctx;ctx.window=ctx;
for(let i=0;i<6;i++)vm.runInContext(blocks[i],ctx);
const Game=ctx.QGame,Slots=ctx.QCharacterSlots,D=ctx.QData;
const backing=new Map(), storage={getItem:k=>backing.has(k)?backing.get(k):null,setItem:(k,v)=>backing.set(k,String(v)),removeItem:k=>backing.delete(k)};
const modes=['easy','standard','challenge'],scales={easy:.5,standard:.8,challenge:1};
let passed=0;function ok(v,msg){assert.ok(v,msg);passed++}
function eq(a,b,msg){assert.equal(a,b,msg);passed++}
const g={};for(const mode of modes){const sl=new Slots(storage,mode);g[mode]=sl.newGame('human',261014,1);
 eq(g[mode].s.difficulty,mode,mode+' stored difficulty');eq(sl.read('human',1).game.s.difficulty,mode,mode+' roundtrip');
 const e=Object.values(D.ENEMIES).find(z=>z&&z.training!==true&&z.hp>0&&z.atk>0);
 ok(!!e,'enemy exists');
 const type=Object.keys(D.ENEMIES).find(k=>D.ENEMIES[k]===e);
 const base=Math.max(1,Math.round(g[mode].realmBaseXp*D.STAGE_MULT[g[mode].stageIndex-1]*scales[mode]));
 eq(g[mode].required,base,mode+' XP requirement');
 eq(g[mode].tribDamage,Math.max(1,Math.round(D.TRIB_DAMAGE[0]*scales[mode])),mode+' tribulation reduction');
 const result=g[mode].startBattle(type);ok(result.ok,mode+' battle starts');
 const actual=g[mode].s.combat,scale=scales[mode];
 eq(actual.maxHp,Math.max(1,Math.round(e.hp/g[mode].playerDampen*scale)),mode+' enemy HP');
 eq(actual.atk,Math.max(1,Math.round(e.atk*g[mode].enemyBoost*scale)),mode+' enemy ATK');
 eq(actual.armor,Math.max(0,Math.round(e.armor*scale)),mode+' enemy armor');
 sl.save('human',g[mode],1);
 const reopened=sl.read('human',1).game;
 eq(reopened.s.combat.maxHp,actual.maxHp,mode+' battle maxHp unchanged after reload');
 eq(reopened.s.combat.atk,actual.atk,mode+' battle atk unchanged after reload');
 eq(reopened.s.combat.armor,actual.armor,mode+' battle armor unchanged after reload');
}
const key={
 easy:new Slots(storage,'easy').key('human',1),
 standard:new Slots(storage,'standard').key('human',1),
 challenge:new Slots(storage,'challenge').key('human',1)
};
eq(key.challenge,'qinglan-wendao-v14-human-slot-001','legacy challenge key unchanged');
ok(new Set(Object.values(key)).size===3,'three independent save keys');
const challenge=new Slots(storage,'challenge'),easy=new Slots(storage,'easy'),standard=new Slots(storage,'standard');
for(const mode of modes){for(const race of ['human','demon']){for(let n=1;n<=100;n++){
  const current=new Slots(storage,mode),k=current.key(race,n);
  ok(k.includes(race+'-slot-'+String(n).padStart(3,'0')),mode+'/'+race+'/'+n+' scoped');
  if(mode!=='challenge')ok(!k.startsWith('qinglan-wendao-v14-'+race+'-slot-'),mode+'/'+race+'/'+n+' not legacy key');
}}}
let rejected=false;try{easy.save('human',g.challenge,2);}catch{rejected=true}ok(rejected,'cannot save challenge state into easy slot');
rejected=false;try{new Game(g.standard.state(),261014,'human',null,'challenge');}catch{rejected=true}ok(rejected,'cannot load standard save as challenge');
const legacy=Game.fresh(271014,'human');delete legacy.difficulty;legacy.rebuilt=1;backing.set(challenge.key('human',20),JSON.stringify(legacy));
eq(challenge.read('human',20).game.s.difficulty,'challenge','old unmarked save remains challenge');
eq(standard.status('human',20).status,'empty','old challenge save invisible in standard');
eq(easy.status('human',20).status,'empty','old challenge save invisible in easy');
const ck=challenge.key('human',21),old=Game.fresh(271014,'human');old.rebuilt=0;delete old.difficulty;backing.set(ck,JSON.stringify(old));
eq(challenge.status('human',21).status,'reset','old reset visible only challenge');
eq(easy.status('human',21).status,'empty','easy never grabs old reset');
eq(standard.status('human',21).status,'empty','standard never grabs old reset');
let firstKeys=[];for(const mode of modes){const store=new Slots(storage,mode);store.putLegacy('human',4,{version:1,race:'human',slot:4,balance:mode==='easy'?50:mode==='standard'?80:100,total:100,generation:0,upgrades:{vigor:0,spirit:0,attack:0},history:[],last:null});firstKeys.push(store.legacyKey('human',4))}
ok(new Set(firstKeys).size===3,'all reincarnation ledgers separate');
eq(easy.legacy('human',4).balance,50,'easy independent jade');
eq(standard.legacy('human',4).balance,80,'standard independent jade');
eq(challenge.legacy('human',4).balance,100,'challenge independent jade');
for(const mode of modes){const item=g[mode];item.s.ascended=true;item.s.ascensionRecord={race:'human',runId:'human:1:123:1',elapsedMinutes:5000,defeats:0,remainingLifeMinutes:10000};
 const store=new Slots(storage,mode),result=store.recordAscension('human',1,item);
 if(mode==='easy')eq(result,null,'easy cannot enter any board');
 else ok(!!result,mode+' ranked record stored');
}
eq(easy.leaderboard('easy').records.length,0,'easy board empty');
eq(standard.leaderboard('standard').records.length,1,'standard separate board');
eq(challenge.leaderboard('challenge').records.length,1,'challenge separate board');
eq(standard.leaderboard('challenge').records[0].difficulty,'challenge','mode selector never mixes boards');
const normal=standard.leaderboardKey(),hard=challenge.leaderboardKey();
ok(normal!==hard,'two separate storage board keys');
eq(hard,'shanye-v907-local-ascension-board-v1','existing leaderboard remains challenge');
ok(html.includes("function difficulties(selected,picked,active)"),'entry difficult selector rendered');
ok(html.includes("rank-difficulty"),'ranking tabs available');
ok(html.includes("showPage({kind:'difficulty'})"),'difficulty is first screen');
console.log('V90.64 difficulty MODE PASS '+passed+' assertions (3 modes, dual race x100 slots, 2 ranked boards, challenge compatibility)');
