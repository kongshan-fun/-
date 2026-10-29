'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const h=fs.readFileSync('index.html','utf8');const ss=[...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);const c=vm.createContext({console});c.globalThis=c;for(let i=0;i<6;i++)vm.runInContext(ss[i],c);const {QGame:G,QData:D,QCharacterSlots:S}=c;let count=0;const ok=(a,m)=>{assert.ok(a,m);count++},eq=(a,b,m)=>{assert.equal(a,b,m);count++};const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};function fixture(){const g=new G();g.s.life.left=500*D.LIFE.yearMinutes;g.s.hunger=g.s.water=100;g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;return g;}
{
 const disk=storage(),slots=new S(disk),g=fixture(12);g.s.level=36;g.syncMajor();g.s.cleared.fill(true);g.s.ritual.fill(true);g.s.unlocked=12;g.s.zone=11;g.s.pos={x:7,y:5};g.s.xp=g.required;
 for(const[k,v]of Object.entries(D.ASCENSION_RULE.cost))g.s.inv[k]=v+1;
 ok(g.act('ascend').ok,'new ruleset actual ascension');
 eq(g.s.ascensionRecord.ruleset,'bigu-v977','completion stamps exact ruleset');
 slots.save('human',g,99);const reloaded=slots.read('human',99).game;
 eq(reloaded.s.ascensionRecord.ruleset,'bigu-v977','ruleset survives normalization');
 ok(!!slots.recordAscension('human',99,reloaded),'new ruleset may rank');
 const old=reloaded.state();old.ascensionRecord.runId='human:123:456:789';delete old.ascensionRecord.ruleset;
 const oldGame=new G(old);eq(slots.recordAscension('human',98,oldGame),null,'old completion cannot enter new board');
 eq(slots.leaderboard().records.length,1,'old completion does not modify new records');
}
console.log('V90.77 ruleset isolation PASS',count);
