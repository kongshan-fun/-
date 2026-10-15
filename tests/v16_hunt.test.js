'use strict';
const A=require('node:assert/strict');
const D=require('../src/data.js'),Game=require('../src/engine.js');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS',name)};
const baseItems=['woodEssence','wolfFang','rockShell','creekScale','fishScale','waterShell','flameNeedle','lavaCrystal','yinPearl','ghostSilk','starCore','thunderFeather'];
function battle(g,type){const before=g.s.stats.kills;A.equal(g.startBattle(type).ok,true);for(let i=0;g.s.combat&&i<120;i++){
 if(g.s.combat.intent==='heavy')g.act('fight',{mode:'guard'});else g.act('fight',{mode:'spell'});
 if(g.s.hp<g.s.maxHp*.5&&g.s.inv.salve&&g.s.combat?.intent!=='heavy')g.act('fight',{mode:'heal'});
 }A.equal(g.s.combat,null);A.ok(g.s.stats.kills>before);}
test('all 5 hunting zones include two craftable pieces plus elite pieces',()=>{
 A.equal(D.HUNT_TIERS.length,5);D.HUNT_TIERS.forEach((z,i)=>{for(const id of z.ready){const r=D.RECIPES.find(t=>t.id===id);A.ok(r,'missing '+id);A.equal(r.bossPrepZone,i);A.ok(r.gear==='weapon'||r.gear==='armor');}A.ok(z.focus.length>=2);});
});
test('monster-bound materials are guaranteed in named prey, not free-gatherable',()=>{
 for(const id of baseItems){const producers=Object.values(D.ENEMIES).filter(e=>e.loot?.[id]>0);A.ok(producers.length,'no guaranteed source '+id);A.ok(!Object.values(D.RES).some(res=>res.loot?.[id]),'free gathering '+id);A.ok(D.RECIPES.some(r=>r.cost?.[id]>0),'no crafting demand '+id);}
});
test('five maps all expose mandatory prey in their 24-node scene, with active challenge index',()=>{
 for(let z=0;z<5;z++){
  const g=new Game();g.s.zone=z;const found=new Set();
  for(let y=0;y<8;y++)for(let x=0;x<8;x++) {g.s.pos={x,y};for(const i of [10,16,22]){
   const n=g.sceneNodes()[i];if(n.enemy)found.add(n.enemy);
  }}
  for(const key of D.HUNT_TIERS[z].focus){A.ok([...found].some(id=>D.ENEMIES[id].loot?.[key]),`zone ${z}: ${key} inaccessible`);}
 }
});
test('fresh save has boss craft gate even after altar repair',()=>{
 const g=new Game();g.s.ritual[0]=true;g.s.pos={x:6,y:2};const r=g.act('move',{x:7,y:2});A.equal(r.ok,false);A.match(r.msg,/先狩猎/);A.deepEqual(g.s.pos,{x:6,y:2});
 A.equal(g.startBattle('boss0').ok,false);A.equal(g.act('hunt').ok,false);
});
test('real sprite fight awards deterministic key material + rollable bonus',()=>{
 const g=new Game(null,12345);g.s.inv.salve=10;g.s.level=6;g.s.maxHp=160;g.s.hp=160;g.s.spirit=100;g.s.maxSpirit=100;g.s.attack=22;
 const k=g.s.inv.woodEssence||0;
 battle(g,'sprite');A.equal(g.s.inv.woodEssence,k+1);A.ok(g.s.codex.items.woodEssence);
});
test('low-zone original starter gear does not bypass hunting gate',()=>{
 const g=new Game();g.s.pos={x:1,y:5};g.s.settlements[0]={pos:{x:1,y:5},level:1,buildings:{forge:1},stash:{},foundedAt:420,farmAt:420};
 g.s.inv.wood=30;g.s.inv.stone=25;g.s.inv.fiber=20;
 A.equal(g.act('craft',{id:'woodSword'}).ok,true);A.equal(g.s.huntPrepared[0],false);A.ok(g.bossReadiness());
});
test('crafting beast-gear marks exactly one zone and survives export/import',()=>{
 for(let z=0;z<5;z++){
  const g=new Game();g.s.zone=z;g.s.unlocked=z+1;g.s.pos={x:0,y:5};g.s.settlements[z]={pos:{x:0,y:5},level:1,buildings:{forge:1},stash:{},foundedAt:420,farmAt:420};
  if(z===0){g.s.pos={x:1,y:5};g.s.settlements[0].pos={x:1,y:5};}
  const r=D.RECIPES.find(r=>r.id==='huntSword'+z);for(const [id,n] of Object.entries(r.cost))g.s.inv[id]=(g.s.inv[id]||0)+n+2;
  A.equal(g.act('craft',{id:r.id}).ok,true,r.id);A.equal(g.s.huntPrepared[z],true,r.id);
  A.equal(new Game(g.state()).s.huntPrepared[z],true);
  for(let other=0;other<5;other++)if(other!==z)A.equal(g.s.huntPrepared[other],false);
 }
});
test('extended resource cells consume only canonical original 10-slot budget',()=>{
 const g=new Game();g.s.pos={x:2,y:3};g.s.level=18;g.s.maxSpirit=200;g.s.spirit=200;g.s.hunger=100;g.s.water=100;g.s.maxHp=300;g.s.hp=300;g.s.inv.wood=0;g.s.inv.fiber=0;g.s.inv.stone=0;
 const before=D.RESOURCE_LAYOUT[g.land()].reduce((sum,k)=>sum+(k?D.RES[k].max:0),0);
 const sumLeft=()=>Array.from({length:10},(_,i)=>g.left(i)).reduce((a,b)=>a+b,0);
 A.equal(sumLeft(),before);
 const source=Array.from({length:24},(_,i)=>i).find(i=>i>=10&&g.resource(i)&&g.left(i)>0);
 A.ok(source!==undefined);const k=g.resource(source),n=g.left(source);
 let amount=0;
 for(let i=0;i<n;i++){
  g.s.spirit=200;g.s.hunger=100;g.s.water=100;g.s.hp=300;
  // Prevent bag fullness from masking resource logic. Simulate the stash space being available.
  for(const id of Object.keys(g.s.inv))if(D.ITEMS[id]?.type==='material')g.s.inv[id]=0;
  A.equal(g.act('gather',{index:source}).ok,true,`gather${i}`);amount++;
 }
 A.equal(g.left(source),0);A.equal(g.act('gather',{index:source}).ok,false);
 A.equal(sumLeft(),before-amount);
});
test('postboss seals supply upcoming advanced gear; final seal and optional essence have use',()=>{
 for(let z=0;z<4;z++){
  A.ok(D.ENEMIES['boss'+z].loot['seal'+z]>0);
  const r=D.RECIPES.find(r=>r.id===['','springSword','emberSword','yinSword','skySword'][z+1]);A.ok(r.cost['seal'+z]>=1);
 }
 A.ok(D.RECIPES.some(r=>r.cost.seal4>0));A.ok(D.RECIPES.some(r=>r.cost.beastPearl>0));
});
test('natural extra rewards never hard-lock the hunter recipes',()=>{
 for(const r of D.RECIPES.filter(r=>r.hunter))for(const id of Object.keys(r.cost)){
  const producers=Object.values(D.ENEMIES).filter(e=>e.loot?.[id]>0);
  A.ok(producers.length||Object.values(D.RES).some(n=>n.loot?.[id]),'missing guaranteed source '+id);
 }
});
test('V15-style old save is backward compatible and previously cleared bosses remain cleared',()=>{
 const g=new Game();g.s.cleared[0]=true;g.s.ritual[0]=true;g.s.unlocked=2;const raw=g.state();delete raw.huntPrepared;
 const n=new Game(raw);A.equal(n.s.cleared[0],true);A.equal(n.s.huntPrepared[0],true);A.equal(n.s.huntPrepared[1],false);
});
console.log(`V16 HUNT→CRAFT→BOSS RULES ${checks}/${checks} PASS`);
