'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const ss=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(ss.length,10);for(const s of ss)new vm.Script(s);
const x=vm.createContext({console});x.globalThis=x;
for(let i=0;i<=5;i++)vm.runInContext(ss[i],x,{timeout:10000});
const {QGame:Game,QData:D,QCharacterSlots:Slots}=x;
assert.equal(D.HELP.find(p=>p.id==='v907-ascension')?.paragraphs.length,4);
let checks=0;const check=(name,condition)=>{assert.ok(condition,name);checks++};
const table=new Map(),disk={getItem:k=>table.get(k)||null,setItem:(k,v)=>table.set(k,String(v)),removeItem:k=>table.delete(k)};
const slots=new Slots(disk);
function ready(race,slot,seed){
 const g=slots.newGame(race,seed,slot);g.xp(10000);
 g.s.zone=11;g.s.unlocked=12;g.s.ritual=Array(12).fill(true);g.s.cleared=Array(12).fill(true);
 g.s.level=36;g.s.xp=g.required;g.s.major=8;
 const at36=D.statsForLevel(36);g.s.maxHp=at36.hp;g.s.maxSpirit=at36.spirit;g.s.attack=at36.atk; // real level-36 stats required by final tribulation
 g.s.pos={x:7,y:5};g.s.last={x:6,y:5};g.s.spirit=g.s.maxSpirit;g.s.hp=g.s.maxHp;g.s.hunger=g.s.water=100;
 g.s.minutes=420+5760*(20+slot)+(race==='demon'?1440:0);
 g.s.life.left=300*D.LIFE.yearMinutes;
 for(const [k,n] of Object.entries(D.ASCENSION_RULE.cost))g.s.inv[k]=n+1;
 slots.save(race,g,slot);
 return g;
}
let a=ready('human',1,1234567);
const oldClock=a.s.minutes,oldLife=a.s.life.left;
let result=a.act('ascend');
check('real engine ascension',result.ok===true&&a.s.ascended&&a.s.major===9);
check('includes actual final 180 min',a.s.ascensionRecord.elapsedMinutes===oldClock+180-420);
check('captures life BEFORE +1000',a.s.ascensionRecord.remainingLifeMinutes===oldLife-180);
check('no hidden birth offset',a.s.ascensionRecord.elapsedMinutes/5760>(20+1));
check('race stable',a.s.ascensionRecord.race==='human');
const earliest=a.s.ascensionRecord.elapsedMinutes;
slots.save('human',a,1);
check('first leaderboard record',!!slots.recordAscension('human',1,a)&&slots.leaderboard().records.length===1);
check('recordAscension idempotent',!!slots.recordAscension('human',1,a)&&slots.leaderboard().records.length===1);
let reload=slots.read('human',1).game;
check('immutable saved milestone',reload.s.ascensionRecord.elapsedMinutes===earliest);
// Keep playing AFTER victory, but never modify fastest ranking time.
let move=reload.act('move',{x:6,y:5});
check('post ascension exploration still works',move.ok===true);
check('continued development does not change first ascension score',reload.s.ascensionRecord.elapsedMinutes===earliest&&reload.s.minutes>a.s.minutes);
check('new world time increases elapsed clock but NOT rank',reload.s.minutes-420>earliest);
check('repeating final ascend rejected',reload.act('ascend').ok===false);
slots.save('human',reload,1);slots.recordAscension('human',1,reload);
check('board unchanged after continuing',slots.leaderboard().records[0].elapsedMinutes===earliest);
const quote=slots.previewAscendedReward('human',1,reload);
check('large first ascension reward',quote.total>=1000&&quote.base===1000&&quote.known===true);
const balanceBefore=slots.legacy('human',1).balance;
const finished=slots.retireAscended('human',1,reload);
check('retirement pays exact preview once',finished.reward===quote.total&&slots.legacy('human',1).balance===balanceBefore+quote.total);
check('character retired and locked',slots.status('human',1).status==='retired'&&slots.dead('human',1));
check('character primary and backup deleted',!table.get(slots.key('human',1))&&!table.get(slots.backupKey('human',1)));
check('ranking stays after retirement',slots.leaderboard().records.length===1);
let doubleDenied=false;try{slots.retireAscended('human',1,reload)}catch{doubleDenied=true;}
check('double reward denied even with stale object',doubleDenied&&slots.legacy('human',1).balance===finished.balance);
// Per-slot lifetime currency persists after explicit newGame.
const again=slots.newGame('human',999123,1);
check('new generation allowed after retirement',!!again&&!slots.dead('human',1));
check('reward ledger preserved after rebirth',slots.legacy('human',1).balance===finished.balance&&slots.legacy('human',1).generation===1);
check('rank survives the next life',slots.leaderboard().records[0].runId===a.s.ascensionRecord.runId);
// Second race distinct, faster and sorted first.
const demon=ready('demon',1,546789);demon.s.minutes=420+5760*3;slots.save('demon',demon,1);
check('another race can ascend',demon.act('ascend').ok===true);slots.save('demon',demon,1);
slots.recordAscension('demon',1,demon);
check('top sorts by elapsed in game minutes',slots.leaderboard().records[0].race==='demon'&&slots.leaderboard().records[1].race==='human');
check('two role balances isolated',slots.legacy('demon',1).balance===0&&slots.legacy('human',1).balance>0);
// Old V90.6 saves have ascended=true but no first finish time: can retire, not rank.
const old=ready('human',2,445567);old.s.ascended=true;old.s.major=9;old.s.ascensionRecord=null;slots.save('human',old,2);
const imported=slots.read('human',2).game;
const oldQuote=slots.previewAscendedReward('human',2,imported);
check('legacy ascended gets base only, no fake time',oldQuote.total===1000&&!oldQuote.known);
check('legacy no fake leaderboard record',slots.recordAscension('human',2,imported)===null);
const oldFinish=slots.retireAscended('human',2,imported);
check('legacy retirement works and preserves other slots',oldFinish.reward===1000&&slots.status('human',2).status==='retired'&&slots.status('human',1).status==='ready');
// Data corruption can never silently reset or overwrite a ranked record.
const key=slots.leaderboardKey(),saved=table.get(key);table.set(key,'broken json');
let broken=false;try{slots.leaderboard()}catch{broken=true};
check('corrupt board fails closed',broken&&table.get(key)==='broken json');table.set(key,saved);
const invalid=JSON.parse(JSON.stringify(reload.state()));invalid.ascensionRecord.runId='forged';
let bad=false;try{new Game(invalid,261014,'human')}catch{bad=true};
check('invalid milestone refuses restore',bad);
check('UI leaderboard buttons and confirm',html.includes('ranking-open')&&html.includes('ascension-retire-confirm')&&html.includes('ascension-settled'));
console.log('V90.7 ASCENSION LIFECYCLE PASS',checks,'assertions; payout',finished.reward,'recorded years',(earliest/5760).toFixed(2));
