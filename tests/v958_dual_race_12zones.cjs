'use strict';
/* 12-zone accelerated integration, NOT an unassisted natural grind:
   stage food/materials/gear capacity, boosted combat and XP; perform actual
   settlement, crafting, ritual, movement, boss fight, tribulation, travel and ascension. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.equal(scripts.length,10);scripts.forEach(s=>new vm.Script(s));
const c=vm.createContext({console});c.globalThis=c;c.window=c;
for(let i=0;i<6;i++)vm.runInContext(scripts[i],c,{timeout:10000});
const G=c.QGame,D=c.QData,Slots=c.QCharacterSlots;
const disk=new Map(),slots=new Slots({getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,String(v)),removeItem:k=>disk.delete(k)});
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};const eq=(a,b,m)=>{assert.equal(a,b,m);n++};
function pos(z,type){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(D.ZONES[z].map[y][x]===type)return {x,y};throw Error('missing '+type)}
function camp(z){for(let y=0;y<8;y++)for(let x=0;x<8;x++){
 const p={x,y},key=z+':'+x+','+y;if(D.CAMP_LANDS.includes(D.ZONES[z].map[y][x])&&!D.EVENTS[key]&&!D.SITES[key])return p;
}throw Error('no camp '+z)}
function play(role){
 let g=slots.newGame(role,20261022,1),walked=0,bosses=0,breaks=0;
 function supply(){g.s.hunger=g.s.water=100;g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;
   g.s.life.left=900*D.LIFE.yearMinutes;g.s.storageBags.bagVoid=true;}
 function stock(cost){for(const [id,v] of Object.entries(cost))g.s.inv[id]=Math.max(g.s.inv[id]||0,v+1)}
 function act(name,args={}){const r=g.act(name,args);if(!r?.ok)throw Error(role+' z'+g.s.zone+' '+name+': '+r?.msg);return r}
 function fight(){if(!g.s.combat)return;const prev=g.s.attack;g.s.attack=10000000;
   for(let k=0;k<10&&g.s.combat;k++)act('fight',{mode:'attack'});
   ok(!g.s.combat,'combat settled');g.s.attack=prev;supply();}
 function move(target){const route=g.path(target.x,target.y);if(route.length===0&&(g.s.pos.x!==target.x||g.s.pos.y!==target.y))throw Error('unreachable');
   for(const step of route){act('move',step);walked++;fight()}eq(g.s.pos.x,target.x,'x');eq(g.s.pos.y,target.y,'y')}
 function restore(){ok(slots.save(role,g,1),'durable save');const saved=slots.read(role,1)?.game;
   ok(saved,'durable restore');eq(saved.s.unlocked,g.s.unlocked,'same unlock');eq(saved.s.zone,g.s.zone,'same zone');g=saved}
 for(let z=0;z<12;z++){
   eq(g.s.zone,z,'zone order');supply();const here=camp(z);
   g.s.pos={...here};g.s.last={...here};g.reveal(); // location staging only
   stock(D.SETTLE_COST);act('settle');ok(g.camp,'real settlement');
   if(z===0){
     stock(D.RECIPES.find(r=>r.id==='axe').cost);act('craft',{id:'axe'});
     stock(D.BUILDINGS.forge.levels[0].cost);act('build',{id:'forge'});
     stock(D.RECIPES.find(r=>r.id==='woodSword').cost);act('craft',{id:'woodSword'});
     stock(D.BUILDINGS.gate.levels[0].cost);act('build',{id:'gate'});
   }else{stock(D.ZONES[z].need);supply();move(pos(z,'shrine'));supply();stock(D.ZONES[z].need);act('repair')}
   ok(g.s.ritual[z],'real ritual');supply();move(pos(z,'boss'));
   if(!g.s.cleared[z]){if(!g.s.combat)act('hunt');fight()}
   ok(g.s.cleared[z],'real boss');bosses++;restore();
   if(z<11){
     supply();act('travel',{zone:z,home:true});supply();
     g.xp(1e12);eq(g.s.level,(z+1)*3,'third-stage cap using xp method');
     act('breakthrough');breaks++;eq(g.s.level,(z+1)*3+1,'boundary result');
     ok(g.s.unlocked>=z+2,'immediately unlocked');
     supply();act('travel',{zone:z+1});eq(g.s.zone,z+1,'real onward travel');
     restore();
   }
 }
 supply();g.xp(1e12);eq(g.s.level,36,'fully trained');
 stock(D.ASCENSION_RULE.cost);supply();move(pos(11,'gate'));supply();act('ascend');
 ok(g.s.ascended,'real final ascent');restore();ok(slots.status(role,1).ascended,'persisted ascended');
 return {role,bosses,breaks,walked,ascended:g.s.ascended};
}
const a=play('human'),b=play('demon');
ok(slots.key('human',1)!==slots.key('demon',1),'two independent slots');
console.log('V90.58 DUAL RACE 12 ZONES PASS',n,'assertions',JSON.stringify({human:a,demon:b,accelerated:true,naturalGrind:false}));
