'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../src/data.js');
const Game = require('../src/engine.js');
const passed=[];
function check(name,run){run();passed.push(name);process.stdout.write('PASS '+name+'\n');}
function act(g,name,args={}){const r=g.act(name,args);assert.equal(r.ok,true,`${name}: ${r.msg||''}`);return r;}
function rejected(g,name,args={}){const before=JSON.stringify(g.state());assert.equal(g.act(name,args).ok,false,name);assert.equal(JSON.stringify(g.state()),before,`${name} modified player state after rejection`);}
function funded(){const g=new Game(null,17);g.s.inv={wood:30,stone:25,fiber:20,ore:12,berry:6,water:6,axe:1,pick:1};return g;}
function homed(){const g=funded();act(g,'settle');return g;}
check('Five 8x8 zones and valid bosses/landmarks',()=>{assert.equal(D.ZONES.length,5);for(const z of D.ZONES){assert.equal(z.map.length,8);for(const row of z.map){assert.equal(row.length,8);for(const kind of row)assert.ok(D.LAND[kind],kind);}assert.ok(D.ENEMIES[z.boss]);}});
check('All recipes and building costs reference materials and existing rooms',()=>{for(const r of D.RECIPES){for(const [id,q] of Object.entries(r.cost)){assert.ok(D.ITEMS[id],id);assert.ok(Number.isInteger(q)&&q>0);}if(r.room){assert.ok(D.BUILDINGS[r.room]);assert.ok(r.tier<=D.BUILDINGS[r.room].levels.length);}}for(const b of Object.values(D.BUILDINGS)){for(const l of b.levels)for(const [id,q] of Object.entries(l.cost)){assert.ok(D.ITEMS[id]);assert.ok(q>0);}}});
check('Fresh character has neither settlement nor free production',()=>{const g=new Game();assert.equal(g.s.version,10);assert.equal(g.s.unlocked,1);assert.equal(g.s.settlements.filter(Boolean).length,0);assert.equal(g.storageReady,false);assert.equal(g.workshop,false);assert.deepEqual(g.s.pos,{x:1,y:5});});
check('Invalid, counterfeit and incomplete saves are rejected',()=>{assert.throws(()=>new Game({}),/存档/);const g=new Game().state();assert.throws(()=>new Game({...g,version:999}),/存档/);assert.throws(()=>new Game({...g,settlements:[]}),/洞府/);assert.throws(()=>new Game({...g,pos:{x:25,y:1}}),/存档/);});
check('V9 JSON save round-trip preserves initial state',()=>{const s=new Game(null,42).state();const v=new Game(JSON.parse(JSON.stringify(s))).state();for(const key of ['version','seed','zone','unlocked','inv','settlements','pos','seen','visited','level','stats','cleared'])assert.deepEqual(v[key],s[key],key);});
check('No free settlement, rest, storage or advanced crafting',()=>{const g=new Game();rejected(g,'settle');rejected(g,'store');rejected(g,'rest',{mode:'camp'});rejected(g,'craft',{id:'woodSword'});});
check('Build camp and warehouse after paying real material costs',()=>{const g=homed();assert.equal(g.s.inv.wood,26);assert.equal(g.s.inv.stone,23);assert.equal(g.storageReady,false);act(g,'build',{id:'warehouse'});assert.equal(g.storageReady,true);assert.equal(g.stashCapacity(),80);});
check('Warehouse store/withdraw conserves items; tools remain carried by default',()=>{const g=homed();act(g,'build',{id:'warehouse'});g.s.inv={wood:10,axe:1,berry:2};const before=g.s.inv.wood+(g.camp.stash.wood||0);act(g,'store',{id:'wood'});act(g,'withdraw',{id:'wood',qty:1});assert.equal(g.s.inv.wood+(g.camp.stash.wood||0),before);const tool=g.s.inv.axe;act(g,'store');assert.equal(g.s.inv.axe,tool);});
check('Warehouse capacity limits stored materials without deleting overflow',()=>{const g=homed();act(g,'build',{id:'warehouse'});g.s.inv={wood:45};act(g,'store',{id:'wood'});assert.equal(g.camp.stash.wood,40);assert.equal(g.s.inv.wood,5);rejected(g,'store',{id:'wood'});});
check('Outside the settlement cannot use stored materials remotely',()=>{const g=homed();act(g,'build',{id:'warehouse'});act(g,'store',{id:'wood'});g.s.pos={x:2,y:5};assert.equal(g.has('wood'),0);rejected(g,'withdraw',{id:'wood'});rejected(g,'build',{id:'forge'});});
check('Advanced weapon crafting requires the actual forge',()=>{const g=homed();rejected(g,'craft',{id:'woodSword'});act(g,'build',{id:'forge'});act(g,'craft',{id:'woodSword'});assert.ok(g.s.equipped.weapon);rejected(g,'craft',{id:'ironSword'});});
check('Daily farm production cannot be collected twice',()=>{const g=homed();act(g,'build',{id:'farm'});rejected(g,'farm');g.s.minutes+=1440;act(g,'farm');rejected(g,'farm');});
check('Tutorial supports pause/resume without claiming completion',()=>{const g=homed();act(g,'guide',{mode:'start'});assert.equal(g.s.guide.status,'active');act(g,'guide',{mode:'pause'});assert.equal(g.s.guide.status,'paused');act(g,'guide',{mode:'resume'});assert.equal(g.s.guide.status,'active');assert.equal(g.s.guide.rewarded,false);assert.equal(D.GUIDE.length,11);});
check('Unopened regions cannot be traveled to',()=>{const g=new Game();rejected(g,'travel',{zone:4});rejected(g,'travel',{zone:1});});
check('Grey mobile UI contains 3x3 minimap and expanded map',()=>{const ui=fs.readFileSync(path.join(__dirname,'../src/ui.js'),'utf8');const css=fs.readFileSync(path.join(__dirname,'../src/style.css'),'utf8');const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(ui,/function renderMap\(/);assert.match(ui,/function setMap\(/);assert.match(html,/id="map"/);assert.match(html,/id="world-map"/);assert.match(css,/grid-template-columns:repeat\(3/);assert.match(css,/width:min\(400px,100vw\)/);});
console.log(`V10 REGRESSION ${passed.length}/${passed.length} PASS`);
