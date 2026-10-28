'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.equal(blocks.length,10,'script count');
const ctx=vm.createContext({console});ctx.globalThis=ctx;ctx.window=ctx;
for(let i=0;i<6;i++)vm.runInContext(blocks[i],ctx,{timeout:10000});
const {QGame:Game,QCharacterSlots:Slots,QBirth:Birth,QData:D,QAscensionScore:score}=ctx;
let assertions=0;
function eq(a,b,label){assert.equal(a,b,label);assertions++}
function ok(v,label){assert.ok(v,label);assertions++}
function store(){const m=new Map();return {m,failKey:null,getItem(k){return m.get(k)||null},setItem(k,v){if(this.failKey===k)throw Error('QuotaExceeded simulated '+k);m.set(k,String(v))},removeItem(k){m.delete(k)}}}
function born(seed=1234567){return Birth.roll('human',seed,'归档测试')}
function flight(s,role,n,seed,years){const g=s.newGame(role,seed,n);g.s.ascended=true;g.s.major=9;g.s.cleared.fill(true);g.s.minutes=420+5760*(years+1);g.s.ascensionRecord={version:1,race:role,runId:role+':'+seed+':'+seed+':'+(420+5760*years),elapsedMinutes:5760*years,remainingLifeMinutes:5760*30,defeats:0,difficulty:s.difficulty};return g}
{
 const disk=store(),slots=new Slots(disk),b=born();b.adds={hp:4,spirit:0,attack:0,years:0,spent:10};const ledger=slots.legacy('human',1);ledger.balance=50;ledger.total=50;slots.putLegacy('human',1,ledger);
 disk.failKey=slots.key('human',1);assert.throws(()=>slots.newGameWithPayment('human',b.seed,1,b),/QuotaExceeded/);assertions++;
 eq(disk.getItem(slots.key('human',1)),null,'no game after quota failure');
 disk.failKey=null;
 eq(slots.legacy('human',1).balance,50,'debit recovered after failed create');
 const game=slots.newGameWithPayment('human',b.seed,1,b);
 eq(slots.legacy('human',1).balance,40,'exactly one debit');
 eq(game.s.birth.adds.spent,10,'paid birth preserved');
 eq(slots.read('human',1).game.s.birth.adds.hp,4,'paid game saved');
}
{
 const disk=store(),slots=new Slots(disk),b=born(1234568);b.adds={hp:4,spirit:0,attack:0,years:0,spent:10};
 const ledger=slots.legacy('human',1);ledger.balance=50;ledger.total=50;slots.putLegacy('human',1,ledger);
 disk.failKey=slots.legacyKey('human',1);
 assert.throws(()=>slots.newGameWithPayment('human',b.seed,1,b),/QuotaExceeded/);assertions++;
 eq(disk.getItem(slots.key('human',1)),null,'cannot create unpaid game if ledger write fails');
}
{
 const disk=store(),slots=new Slots(disk),g=slots.newGame('human',45678,2),key=slots.key('human',2),backup=slots.backupKey('human',2);
 const previous=disk.getItem(key);g.s.stats.steps++;
 disk.failKey=backup;
 assert.throws(()=>slots.save('human',g,2,{requireBackup:true}),/备份失败/);assertions++;
 eq(disk.getItem(key),previous,'failed backup cannot overwrite original');
 disk.failKey=null;slots.save('human',g,2,{requireBackup:true});
 eq(disk.getItem(backup),previous,'strict import saves original backup');
}
{
 const disk=store(),slots=new Slots(disk),old=Game.fresh(98765,'human');
 old.rebuilt=0;const raw=JSON.stringify(old),key=slots.key('human',3),backup=slots.backupKey('human',3),archive=key+'-pre-rebuild-archive';
 disk.setItem(key,raw);disk.failKey=archive;
 assert.throws(()=>slots.resetRebuilt('human',3),/QuotaExceeded/);assertions++;
 eq(disk.getItem(key),raw,'old game preserved when archive blocked');
 eq(slots.legacy('human',3).balance,0,'no compensation when archive blocked');
 disk.failKey=null;const x=slots.resetRebuilt('human',3);
 eq(x.paid,300,'compensation after durable archive');
 eq(disk.getItem(archive),raw,'archive survives reset');
 eq(disk.getItem(backup),null,'auto-backup can be cleaned after independent archive');
}
{
 const disk=store(),slots=new Slots(disk);
 const first=flight(slots,'human',1,76541,40),second=flight(slots,'demon',1,76542,30);
 slots.save('human',first,1);slots.recordAscension('human',1,first);
 slots.save('demon',second,1);slots.recordAscension('demon',1,second);
 eq(slots.leaderboard().records.length,2,'second record persists');
 eq(slots.leaderboard().records[0].race,'demon','faster entry sorts first');
 eq(score({elapsedMinutes:5760*25+1,defeats:1}),41,'floor score includes 16-year defeat');
}
{
 ok(html.includes("if(lifeRescueReady()){saveStatus='救援待确认"),'background persist must keep rescue pending');
 ok(html.includes("if(!clearAllSaves()){notify('结算存储失败"),'give-up checks settlement result');
 ok(html.includes("slots.save(activeRole,importCandidate,activeSlot,{requireBackup:true})"),'import requires backup');
}
console.log('V90.74 P0 fault and rankings PASS: '+assertions+' assertions');
