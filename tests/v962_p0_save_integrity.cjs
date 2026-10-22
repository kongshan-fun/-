'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.equal(blocks.length,10,'script count');blocks.forEach(x=>new vm.Script(x));
const c=vm.createContext({console});c.globalThis=c;c.window=c;
for(let i=0;i<6;i++)vm.runInContext(blocks[i],c);
const G=c.QGame,D=c.QData,Slots=c.QCharacterSlots;let pass=0;
function ok(x,msg){assert.ok(x,msg);pass++}
function eq(a,b,msg){assert.equal(a,b,msg);pass++}
function storage(){const map=new Map();return {map,failKey:null,getItem:k=>map.get(k)||null,setItem(k,v){if(k===this.failKey)throw Error('QuotaExceeded');map.set(k,String(v));},removeItem(k){map.delete(k)}}}
for(const race of ['human','demon']){
  for(const level of [1,15,36]){
    const st=G.fresh(261014,race);st.level=level;st.major=level>=36?8:level<=15?0:Math.floor((level-1)/3)-4;
    st.xp=1234567;st.hp=st.maxHp;st.spirit=st.maxSpirit;st.life.left=200*D.LIFE.yearMinutes;
    const g=new G(st,261014,race);
    eq(g.s.xp,1234567,race+' level '+level+' survives first normalize');
    const again=new G(JSON.parse(JSON.stringify(g.state())),261014,race);
    eq(again.s.xp,1234567,race+' level '+level+' survives reloading');
    if(level===36){again.xp(100);ok(again.s.xp>g.s.xp,race+' level36 gain continues');}
  }
  const st=G.fresh(261014,race),g=new G(st,261014,race);
  g.s.level=15;g.s.xp=g.required+777;g.s.cleared.fill(true);g.s.unlocked=12;
  const camp={pos:{x:1,y:5},level:1,buildings:{}};
  g.s.zone=0;g.s.pos={x:1,y:5};g.s.settlements[0]=camp;
  // Serialization must preserve overflow without needing successful breakthrough.
  eq(new G(g.state(),261014,race).s.xp,g.s.xp,race+' high XP roundtrip');
}
for(const race of ['human','demon']){
  for(const tier of [300,600,1000]){
    const db=storage(),s=new Slots(db),key=s.key(race,1);
    const old=G.fresh(261014,race);
    old.rebuilt=0;old.major=tier===600?6:0;old.ascended=tier===1000;
    db.setItem(key,JSON.stringify(old));
    eq(s.read(race,1).reset.tier,tier,race+' tier');
    const before=db.getItem(key);
    const result=s.resetRebuilt(race,1);
    eq(result.paid,tier,race+' first claim');
    eq(s.legacy(race,1).balance,tier,race+' ledger credited');
    ok(s.read(race,1).game,race+' new game persisted');
    // Spending credits must NOT turn into a second claim when a stale old file reappears.
    const led=s.legacy(race,1);led.balance=0;s.putLegacy(race,1,led);
    db.setItem(key,before);
    const second=s.resetRebuilt(race,1);
    eq(second.paid,0,race+' repeat has no payment');
    eq(s.legacy(race,1).balance,0,race+' spent credit not topped up');
  }
}
{
 const db=storage(),s=new Slots(db),key=s.key('human',2),old=G.fresh(261014,'human');
 old.rebuilt=0;db.setItem(key,JSON.stringify(old));const before=db.getItem(key);
 db.failKey=key;let threw=false;
 try{s.resetRebuilt('human',2)}catch(e){threw=true}
 ok(threw,'failed new slot write throws');
 eq(db.getItem(key),before,'failed write does not delete old slot');
 eq(s.legacy('human',2).balance,300,'credit persisted once');
 db.failKey=null;const recovered=s.resetRebuilt('human',2);
 eq(recovered.paid,0,'retry after failure does not repay');
 eq(s.legacy('human',2).balance,300,'retry ledger unchanged');
 ok(s.read('human',2).game,'retry completes migration');
}
for(const race of ['human','demon']){
 const db=storage(),s=new Slots(db),g=s.newGame(race,261014,3),key=s.key(race,3);
 g.s.xp=234567;g.s.level=36;g.s.xpCarry=.3;
 s.save(race,g,3);const g2=s.read(race,3).game;
 eq(g2.s.xp,234567,race+' slot save keeps XP at 36');
 eq(g2.s.xpCarry,.3,race+' slot save keeps fractional carry');
}
console.log('V90.62 P0 targeted '+pass+' assertions PASS');
