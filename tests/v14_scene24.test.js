'use strict';
const assert=require('node:assert/strict');
const Data=require('../src/data.js');
const Game=require('../src/engine.js');
let checked=0;
function test(label,fn){fn();checked++;console.log('PASS',label);}
function moveToTile(game,loc){game.s.zone=loc.zone;game.s.pos={x:loc.x,y:loc.y};game.s.last={...game.s.pos};game.reveal();}
function locate(z,type){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(Data.ZONES[z].map[y][x]===type)return {zone:z,x,y};throw Error('missing terrain '+z+' '+type);}
function memory(){const values={};return {getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k]};}
test('Fixed 6×4 scene grid exported in data',()=>assert.deepEqual(Data.SCENE_GRID,{columns:6,rows:4,count:24}));
test('Each of 12×64 map tiles returns 24 valid, uniquely indexed slots',()=>{
 const g=new Game(null,42,'human');for(let zone=0;zone<Data.ZONES.length;zone++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  g.s.zone=zone;g.s.pos={x,y};let nodes=g.sceneNodes();assert.equal(nodes.length,24);
  for(let i=0;i<24;i++){const n=nodes[i];assert.equal(n.index,i);if(n.type==='resource')assert.ok(Data.RES[n.id]);else if(n.type==='enemy')assert.ok(Data.ENEMIES[n.id]);else assert.equal(n.type,'empty');}
 }
});
test('No RNG consumption or scene reroll on repeated render',()=>{
 const g=new Game(null,42,'human');moveToTile(g,locate(0,'forest'));const prior=g.s.seed;let a=g.sceneNodes(),b=g.sceneNodes();assert.deepEqual(a,b);assert.equal(g.s.seed,prior);
});
test('Initial camp is safe and has 24 clickable resource nodes',()=>{
 const g=new Game(null,42,'human');let arr=g.sceneNodes();assert.equal(arr.filter(x=>x.type==='enemy').length,0);assert.equal(arr.filter(x=>x.type==='resource').length,24);
});
test('Wilderness displays 2 or 3 monsters within the same 24 cells',()=>{
 const g=new Game(null,42,'human');for(const type of ['plain','forest','mine','ruins']){moveToTile(g,locate(0,type));const rows=g.sceneNodes();assert.equal(rows.filter(x=>x.type==='enemy').length,['mine','ruins'].includes(type)?3:2);}
});
test('Legacy harvest indices 0-9 preserve corresponding resource types',()=>{
 const g=new Game(null,42,'human');for(const type of ['plain','forest','mine','ruins','spring','ridge']){moveToTile(g,locate(0,type));const old=Data.RESOURCE_LAYOUT[type];for(let i=0;i<10;i++)if(old[i])assert.equal(g.resource(i),old[i],type+' '+i);}
});
test('New resource slots 10-23 truly gather and maintain independent counters',()=>{
 const g=new Game(null,42,'human');moveToTile(g,locate(0,'plain'));const r=g.sceneNodes().find(n=>n.type==='resource'&&n.index>=10);assert.ok(r);
 const key=g.key()+'#'+r.index,pre=g.left(r.index);assert.equal(pre,1,'new slot cannot multiply daily loot');const result=g.act('gather',{index:r.index});assert.ok(result.ok,JSON.stringify(result));assert.equal(g.left(r.index),pre-1);assert.equal(g.s.nodeHarvest[key].used,1);
 assert.equal(new Game(g.state(),42,'human').left(r.index),pre-1);
});
test('Visible enemy can be challenged directly; no fake battle button',()=>{
 const g=new Game(null,42,'human');moveToTile(g,locate(0,'plain'));const enemy=g.sceneNodes().find(x=>x.type==='enemy');assert.ok(enemy);
 const r=g.act('challenge',{index:enemy.index});assert.ok(r.ok,JSON.stringify(r));assert.equal(g.s.combat.type,enemy.id);assert.equal(g.s.combat.nodeKey,g.key()+'#'+enemy.index);
});
test('Winning challenge consumes only the selected monster node for the day',()=>{
 const g=new Game(null,42,'human');moveToTile(g,locate(0,'plain'));const enemy=g.sceneNodes().find(x=>x.type==='enemy');g.act('challenge',{index:enemy.index});let b=g.s.combat;b.hp=1;b.atk=0;b.intent='recover';
 const r=g.act('fight',{mode:'attack'});assert.ok(r.ok);assert.equal(g.s.combat,null);assert.equal(g.s.huntNodes[g.key()+'#'+enemy.index],g.day);
 assert.equal(g.sceneNodes()[enemy.index].cleared,true);
 assert.equal(g.act('challenge',{index:enemy.index}).ok,false);
 const prior=g.s.minutes;g.s.minutes+=1440;assert.equal(g.sceneNodes()[enemy.index].cleared,false);assert.ok(g.s.minutes>prior);
});
test('Non-enemy nodes cannot start combat; bosss remain sealed',()=>{
 const g=new Game(null,42,'human');assert.equal(g.act('challenge',{index:0}).ok,false);
 moveToTile(g,locate(0,'boss'));const b=g.sceneNodes().find(x=>x.boss);assert.ok(b);const r=g.act('challenge',{index:b.index});assert.equal(r.ok,false);assert.equal(g.s.combat,null);
});
test('Boss map enters without forced battle, but visible boss click works after ritual',()=>{
 const g=new Game(null,42,'human');g.s.ritual[0]=true;moveToTile(g,{zone:0,x:6,y:2});let r=g.act('move',{x:7,y:2});assert.ok(r.ok);assert.equal(g.s.combat,null);
 const b=g.sceneNodes().find(x=>x.boss);assert.equal(b.id,'boss0');r=g.act('challenge',{index:b.index});assert.ok(r.ok);assert.equal(g.s.combat.type,'boss0');
});
test('Ongoing enemy battle and defeat node persist after V14 save/load',()=>{
 const g=new Game(null,42,'human');moveToTile(g,locate(0,'forest'));const n=g.sceneNodes().find(x=>x.type==='enemy');g.act('challenge',{index:n.index});let loaded=new Game(g.state(),42,'human');assert.equal(loaded.s.combat.nodeKey,g.s.combat.nodeKey);
 loaded.s.combat.hp=1;loaded.s.combat.atk=0;loaded.s.combat.intent='recover';loaded.act('fight',{mode:'attack'});const again=new Game(loaded.state(),42,'human');assert.equal(again.sceneNodes()[n.index].cleared,true);
});
test('Old V14 save lacking huntNodes migrates as empty object, old node harvest kept',()=>{
 const g=new Game(null,42,'human');g.s.nodeHarvest['0:1,5#0']={day:1,used:1};const saved=g.state();delete saved.huntNodes;
 const loaded=new Game(saved,42,'human');assert.deepEqual(loaded.s.huntNodes,{});assert.equal(loaded.s.nodeHarvest['0:1,5#0'].used,1);
});
test('Node records are isolated by race, location and slot objects',()=>{
 const a=new Game(null,42,'human'),b=new Game(null,42,'demon');moveToTile(a,locate(0,'plain'));moveToTile(b,locate(0,'plain'));
 const n=a.sceneNodes().find(x=>x.type==='enemy'),key=a.key()+'#'+n.index;a.s.huntNodes[key]=a.day;assert.equal(a.sceneNodes()[n.index].cleared,true);assert.equal(b.sceneNodes()[n.index].cleared,false);
});
console.log(`V14.1 SCENE24 ${checked}/${checked} PASS`);
