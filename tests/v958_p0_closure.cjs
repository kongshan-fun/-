'use strict';
/* V90.58: real-game boundary crossing and once-only migration compensation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.equal(scripts.length,10);scripts.forEach(x=>new vm.Script(x));
const c=vm.createContext({console});c.globalThis=c;c.window=c;
for(let i=0;i<6;i++)vm.runInContext(scripts[i],c,{timeout:10000});
const G=c.QGame,D=c.QData,Slots=c.QCharacterSlots;
let checks=0;const ok=(x,m)=>{assert.ok(x,m);checks++},eq=(a,b,m)=>{assert.equal(a,b,m);checks++};
function camp(z){for(let y=0;y<8;y++)for(let x=0;x<8;x++){let k=z+':'+x+','+y;if(D.CAMP_LANDS.includes(D.ZONES[z].map[y][x])&&!D.SITES[k]&&!D.EVENTS[k])return {x,y}}throw Error('no camp')}
function stage(z,r){const s=G.fresh(20261022,r),p=camp(z);
 s.zone=z;s.unlocked=z+1;s.level=(z+1)*3;s.pos={...p};s.last={...p};
 s.settlements[z]={pos:{...p},level:2,buildings:{},stash:{},storedGears:[]};
 for(let i=0;i<=z;i++){s.cleared[i]=true;s.ritual[i]=true}
 const g=new G(s,20261022,r);g.s.xp=g.required;g.s.hunger=g.s.water=100;g.s.hp=g.s.maxHp;
 g.s.spirit=g.s.maxSpirit;g.s.life.left=500*D.LIFE.yearMinutes;return g}
for(const r of ['human','demon'])for(let z=5;z<=10;z++){
 const g=stage(z,r);
 ok(!g.travel(z+1).ok,r+z+' cannot skip');
 ok(g.breakthrough().ok,r+z+' break');
 eq(g.s.unlocked,z+2,r+z+' immediate unlock');
 ok(g.travel(z+1).ok,r+z+' travel');
 const saved=new G(g.state(),20261022,r);
 eq(saved.s.unlocked,z+2,r+z+' reload');eq(saved.s.zone,z+1,r+z+' reload zone');
}
for(const r of ['human','demon']){
 const g=stage(5,r);g.s.cleared[5]=false;g.s.unlocked=6;
 ok(g.breakthrough().ok,'early break before boss');eq(g.s.unlocked,6,'still requires boss');
 g.s.pos={x:7,y:2};g.s.ritual[5]=true;g.s.attack=10000000;
 ok(g.hunt().ok,'boss started');ok(g.fight('attack').ok,'boss win');eq(g.s.unlocked,7,'boss after break unlocks');
}
function store(){const m=new Map();let failure=null;
 return {m,getItem:k=>m.has(k)?m.get(k):null,setItem(k,v){if(failure===k)throw Error('quota');m.set(k,String(v))},
 removeItem:k=>m.delete(k),fail:k=>failure=k};}
const disk=store(),slots=new Slots(disk);
for(const [r,n,version,kind,tier] of [['human',1,14,'basic',300],['human',2,13,'major',600],['human',3,10,'boss',600],['demon',1,14,'ascend',1000]]){
 const s=G.fresh(20261022,r);s.version=version;delete s.rebuilt;
 if(kind==='major')s.major=6;if(kind==='boss')s.cleared=Array.from({length:12},(_,i)=>i<8);
 if(kind==='ascend')s.ascended=true;
 disk.setItem(slots.key(r,n),JSON.stringify(s));eq(slots.read(r,n).reset.tier,tier,r+n+' tier');
}
const keys=[...disk.m.entries()],readOnly=slots.status('human',2);
eq(JSON.stringify([...disk.m]),JSON.stringify(keys),'view old does not mutate');
const raw=disk.getItem(slots.key('human',1));disk.fail(slots.key('human',1));
assert.throws(()=>slots.resetRebuilt('human',1),/quota/);checks++;
eq(disk.getItem(slots.key('human',1)),raw,'failure preserves original');
eq(slots.legacy('human',1).balance,300,'credit persists');
disk.fail(null);eq(slots.resetRebuilt('human',1).paid,0,'retry credits zero');
eq(slots.legacy('human',1).balance,300,'no duplication');
ok(slots.read('human',1).game,'new save readable');
for(const [r,n] of [['human',2],['human',3],['demon',1]]){
 const tier=slots.read(r,n).reset.tier;
 eq(slots.resetRebuilt(r,n).paid,tier,'tier paid once');
 ok(slots.read(r,n).game,'new valid game');
 assert.throws(()=>slots.resetRebuilt(r,n),/不是待补偿|数据损坏/);checks++;
}
const bad=G.fresh(5,'human');delete bad.rebuilt;delete bad.inv;
disk.setItem(slots.key('human',72),JSON.stringify(bad));
eq(slots.status('human',72).status,'invalid','broken original locked');
const wrong=G.fresh(5,'demon');delete wrong.rebuilt;
disk.setItem(slots.key('human',73),JSON.stringify(wrong));
eq(slots.status('human',73).status,'invalid','race mismatch protected');
ok(html.includes('data-a="reset-export"'),'raw old JSON export exposed');
ok(html.indexOf("if(a==='reset-export'")<html.indexOf('if(frontPage||!activeRole)return;'),'export action precedes frontpage guard');
console.log('V90.58 P0 BOUNDARY AND COMPENSATION PASS',checks,'checks');
