'use strict';
/* Accelerated, NOT natural-grind: all 12 maps by actual engine actions.
   Fixture provides missing resources, healing, 10000 attack for combat and fast XP.
   Walking/settlement/ritual/fights/travel/breakthrough/ascend/save-load are real APIs. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const blocks=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(blocks.length,10);for(const s of blocks)new vm.Script(s);
const ctx=vm.createContext({console});ctx.globalThis=ctx;ctx.window=ctx;for(let i=0;i<=5;i++)vm.runInContext(blocks[i],ctx,{timeout:10000});
const G=ctx.QGame,D=ctx.QData,Slots=ctx.QCharacterSlots;
let checks=0;
const ok=(x,msg)=>{assert.ok(x,msg);checks++;};
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++;};
const disk=new Map(),slots=new Slots({getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,String(v)),removeItem:k=>disk.delete(k)});
function tile(z,kind){for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(D.ZONES[z].map[y][x]===kind)return {x,y};return null;}
function campSpot(z){for(let y=0;y<8;y++)for(let x=0;x<8;x++){const land=D.ZONES[z].map[y][x],key=z+':'+x+','+y;if(D.CAMP_LANDS.includes(land)&&!D.SITES[key]&&!D.EVENTS[key])return {x,y};}throw Error('no camp tile zone '+z);}
function run(role,n){
 let g=slots.newGame(role,20261022,n);const events=[],accelerations={teleportToCamp:0,provisionedResources:0,xpBoost:0,attackBoost:0,healthRestore:0};
 function accelerateSupply(){
  g.s.hunger=g.s.water=100;g.s.spirit=g.s.maxSpirit;g.s.hp=g.s.maxHp;g.s.life.left=900*D.LIFE.yearMinutes;
  g.s.storageBags.bagVoid=true; // fixture-only capacity, not a claimed legitimate acquisition
  accelerations.healthRestore++;
 }
 function stock(o){for(const [k,n] of Object.entries(o)){g.s.inv[k]=Math.max(g.s.inv[k]||0,n+1);accelerations.provisionedResources++;}}
 function use(name,args={}){const r=g.act(name,args);if(!r?.ok)throw Error(`${role} zone${g.s.zone} ${name} FAILED: ${r?.msg||'unknown'}`);return r;}
 function battle(){
  if(!g.s.combat)return;
  const atk=g.s.attack;g.s.attack=10000000;accelerations.attackBoost++;
  for(let a=0;g.s.combat&&a<10;a++)use('fight',{mode:'attack'});
  if(g.s.combat)throw Error('Combat not settled zone '+g.s.zone);
  g.s.attack=atk;accelerateSupply();
 }
 function moveTo(p){if(!p)throw Error('unmapped target');
  const route=g.path(p.x,p.y);if(!route.length&&(g.s.pos.x!==p.x||g.s.pos.y!==p.y))throw Error(`path blocked ${g.s.zone}→${p.x},${p.y}`);
  for(const q of route){use('move',q);if(g.s.combat)battle();}
  eq(g.s.pos.x,p.x,'arrive x');eq(g.s.pos.y,p.y,'arrive y');
 }
 function checkpoint(label){
  ok(slots.save(role,g,n),`save ${label}`);
  const read=slots.read(role,n);
  ok(read?.game,`load ${label}`);
  eq(read.game.s.zone,g.s.zone,`zone after reload ${label}`);
  eq(read.game.s.level,g.s.level,`level after reload ${label}`);
  eq(read.game.s.unlocked,g.s.unlocked,`unlock after reload ${label}`);
  g=read.game;
 }
 // An accelerated fixture, NOT a natural save: provision the little needed, then execute real actions.
 for(let z=0;z<12;z++){
  eq(g.s.zone,z,`entered z${z}`);accelerateSupply();
  // Temporary move-to-valid-camp fixture; settlement itself is a real action.
  const camp=campSpot(z);g.s.pos={...camp};g.s.last={...camp};g.reveal();accelerations.teleportToCamp++;
  stock(D.SETTLE_COST);use('settle');ok(g.camp,`camp z${z}`);
  if(z===0){
   stock(D.RECIPES.find(r=>r.id==='axe').cost);use('craft',{id:'axe'});ok(g.s.inv.axe,'craft axe');
   stock(D.BUILDINGS.forge.levels[0].cost);use('build',{id:'forge'});
   stock(D.RECIPES.find(r=>r.id==='woodSword').cost);use('craft',{id:'woodSword'});ok(g.s.gears.some(e=>e.recipe==='woodSword'),'craft equipment');
   stock(D.BUILDINGS.gate.levels[0].cost);use('build',{id:'gate'});
  }else{
   stock(D.ZONES[z].need);accelerateSupply();moveTo(tile(z,'shrine'));accelerateSupply();stock(D.ZONES[z].need);use('repair');
  }
  ok(g.s.ritual[z],`ritual z${z}`);
  accelerateSupply();moveTo(tile(z,'boss'));
  if(!g.s.cleared[z]){if(!g.s.combat)use('hunt');battle();}
  ok(g.s.cleared[z],`boss won z${z}`);
  events.push({zone:z+1,ritual:true,boss:true,level:g.s.level,unlocked:g.s.unlocked});
  checkpoint('boss-z'+z);
  if(z<11){
   accelerateSupply();use('travel',{zone:z,home:true});accelerateSupply();
   // Real XP leveling function; huge amount solely to bypass hours of grinding.
   let budget=0;
   while(g.stageIndex!==3&&budget++<4){g.xp(g.required);accelerations.xpBoost++;}
   if(g.stageIndex!==3)throw Error('Cannot reach stage three in zone '+z);
   if(g.s.xp<g.required){g.xp(g.required-g.s.xp);accelerations.xpBoost++;}
   eq(g.s.level,(z+1)*3,`stage three cap z${z}`);
   eq(g.stageIndex,3,'last stage before ordeal');
   const before=g.s.unlocked;
   use('breakthrough');
   eq(g.s.level,(z+1)*3+1,`level boundary z${z}`);
   // Crossing locked realms requires BOTH boss clear and successful breakthrough.
   ok(g.s.unlocked>=z+2,`unlocked before next travel z${z}`);
   ok(g.s.unlocked>=before,`no backwards unlock z${z}`);
   accelerateSupply();use('travel',{zone:z+1});eq(g.s.zone,z+1,`immediate zone transition ${z+1}`);
   checkpoint('travel-z'+(z+1));
  }
 }
 accelerateSupply();
 {let budget=0;while(g.s.level<36&&budget++<4){g.xp(g.required);accelerations.xpBoost++;}
  if(g.s.xp<g.required){g.xp(g.required-g.s.xp);accelerations.xpBoost++;}}
 eq(g.s.level,36,'final 36');eq(g.s.cleared.filter(Boolean).length,12,'twelve bosses');
 stock(D.ASCENSION_RULE.cost);accelerateSupply();moveTo(tile(11,'gate'));accelerateSupply();
 use('ascend');ok(g.s.ascended,`ascend ${role}`);ok(g.s.ascensionRecord,`first finish record ${role}`);
 checkpoint('ascension');ok(slots.status(role,n).ascended,`ascension reload ${role}`);
 return {race:role,zoneCount:events.length,events,accelerations,ascended:g.s.ascended,stats:{bossWins:g.s.stats.bossWins,steps:g.s.stats.steps,settled:g.s.stats.settled,crafted:g.s.stats.crafted},naturalGrind:false};
}
const human=run('human',1),demon=run('demon',1);
// Two races do not alias save keys or leaderboard.
ok(slots.key('human',1)!==slots.key('demon',1),'role slots separated');
const record={version:'V90.58',kind:'accelerated-actual-engine-action-12-zone-chain',human,demon,assertions:checks,
 limitations:['Resources and food are provisioned in fixture','Attack boosted to resolve fights quickly','XP boosted through genuine xp() method','Camp positions initially staged without walking','Real engine methods handle building, crafting, ritual, path movement, boss combat, zone travel, tribulation, ascension, save/reload','Not a naturally ground zero-cheat playthrough']};
const out=path.join(root,'evidence','v958','dual_race_accelerated_e2e.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(record,null,2));
console.log('V90.58 DUAL-RACE 12-ZONE ACCELERATED ENGINE CHAIN PASS',checks,'assertions, human/demon ascended, not naturally ground');
