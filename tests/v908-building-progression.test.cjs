'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ss=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(ss.length,10);
for(const s of ss)new vm.Script(s);
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<=5;i++)vm.runInContext(ss[i],ctx,{timeout:10000});
const Game=ctx.QGame,D=ctx.QData;
let checks=0;
function ok(v,msg){assert.ok(v,msg);checks++}
function eq(a,b,msg){assert.equal(a,b,msg);checks++}
function baseState(zone=0,major=0,unlocked=1,forge=3){
 const s=Game.fresh(20261018,'human');
 s.zone=zone;s.major=major;s.unlocked=unlocked;
 s.hunger=100;s.water=100;s.hp=s.maxHp;s.spirit=s.maxSpirit;
 s.life.left=200*D.LIFE.yearMinutes;
 s.pos=zone===0?{x:1,y:5}:{x:0,y:5};s.last={...s.pos};
 s.visited[zone+':'+s.pos.x+','+s.pos.y]=true;
 for(let i=0;i<zone;i++)s.cleared[i]=true;
 s.settlements[zone]={pos:{...s.pos},level:3,buildings:{warehouse:3,forge,alchemy:3,quiet:3,farm:2},stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
 for(const id of Object.keys(D.ITEMS))s.inv[id]=1000;
 s.inv.dust=1000;s.storageBags={};
 return s;
}
// Five-tier facility model and costs use existing material IDs.
for(const id of ['residence','warehouse','forge','alchemy','quiet','farm'])eq(D.BUILDINGS[id].levels.length,5,`${id} has five levels`);
eq(D.BUILDINGS.gate.levels.length,1,'story gate remains a one-time plot unlock');
for(const [id,def] of Object.entries(D.BUILDINGS))for(const lv of def.levels)for(const item of Object.keys(lv.cost))ok(!!D.ITEMS[item],`building ${id} cost item ${item} exists`);
eq(D.FARM_LOOT.length,6,'farm output supports tiers 1-5');
eq(D.FARM_LOOT[3].herb,4,'farm tier 3 yield');
eq(D.FARM_LOOT[4].dew,1,'farm tier 4 yields map resources');
eq(D.FARM_LOOT[5].blossom,2,'farm tier 5 yields advanced resources');
// Upgrade residence and all facilities through tiers four and five using real build() actions.
let s=baseState();let g=new Game(s);
for(const level of [4,5]){
  g.s.hunger=100;g.s.water=100;g.s.spirit=g.s.maxSpirit;g.s.hp=g.s.maxHp;
  const r=g.build('residence');ok(r.ok,`residence upgrade to ${level} succeeds`);eq(g.camp.level,level,`residence level ${level}`);
}
for(const id of ['warehouse','forge','alchemy','quiet','farm']){
  const target=id==='farm'?2:3;
  g.camp.buildings[id]=target;
  for(const level of Array.from({length:5-target},(_,i)=>target+i+1)){
    g.s.hunger=100;g.s.water=100;g.s.spirit=g.s.maxSpirit;g.s.hp=g.s.maxHp;
    const r=g.build(id);ok(r.ok,`${id} upgrade to ${level} succeeds`);eq(g.roomLevel(id),level,`${id} level ${level}`);
  }
}
eq(g.stashCapacity(),1100,'tier-five warehouse capacity');
eq(D.BUILDINGS.forge.levels.length,5,'forge UI has five levels');
eq(g.s.settlements[0].level,5,'tier-five residence persists in live state');
// Restore/load must preserve new facility levels and old tier-three saves.
const roundTrip=new Game(g.state());
eq(roundTrip.camp.level,5,'tier-five residence survives save normalization');
for(const id of ['warehouse','forge','alchemy','quiet','farm'])eq(roundTrip.roomLevel(id),5,`${id} tier five survives save normalization`);
let old=Game.fresh(123,'human');old.settlements[0]={pos:{x:1,y:5},level:3,buildings:{warehouse:3,forge:3,alchemy:3,quiet:3,farm:2},stash:{},storedGears:[],foundedAt:old.minutes,farmAt:old.minutes};
const oldLoaded=new Game(old);eq(oldLoaded.camp.level,3,'old residence tier-three save is preserved');eq(oldLoaded.roomLevel('forge'),3,'old forge tier-three save is preserved');
// Recipe gates: high-realm gear and high-tier bags require matching forge level.
const w4=D.RECIPES.find(r=>r.id==='realmSword5'),w5=D.RECIPES.find(r=>r.id==='realmSword9');
eq(w4.tier,4,'first high-realm sword requires forge IV');eq(w5.tier,5,'late high-realm sword requires forge V');
eq(D.RECIPES.find(r=>r.id==='bag06').tier,4,'sixth storage bag requires forge IV');
eq(D.RECIPES.find(r=>r.id==='bag10').tier,5,'tenth storage bag requires forge V');
let g4=new Game(baseState(5,1,6,3));g4.camp.buildings.forge=3;
ok(g4.recipeRequirement(w4).includes('炼器室4阶'),'forge III blocks tier-four gear');
g4.camp.buildings.forge=4;eq(g4.recipeRequirement(w4),'','forge IV unlocks first high-realm sword');
let g5=new Game(baseState(9,5,12,4));g5.camp.buildings.forge=4;
ok(g5.recipeRequirement(w5).includes('炼器室5阶'),'forge IV blocks tier-five gear');
g5.camp.buildings.forge=5;eq(g5.recipeRequirement(w5),'','forge V unlocks late high-realm sword');
// Real crafting action for late gear.
const crafted=g5.craft('realmSword9');ok(crafted.ok,'late realm sword can be crafted after unlocks');
ok(g5.s.gears.some(x=>x.recipe==='realmSword9'),'crafted weapon entered gear inventory');
// Alchemy tier IV/V unlocks consumables with meaningful recovery.
eq(D.RECIPES.find(r=>r.id==='coreTonic').tier,4,'tier-four tonic requires alchemy IV');
eq(D.RECIPES.find(r=>r.id==='daoTonic').tier,5,'tier-five tonic requires alchemy V');
let tonic=new Game(baseState(9,5,12,5));tonic.s.inv.coreTonic=1;tonic.s.hp=20;tonic.s.maxHp=300;tonic.s.spirit=10;tonic.s.maxSpirit=200;
ok(tonic.consume('coreTonic').ok,'tier-four tonic can be consumed');eq(tonic.s.hp,140,'tier-four tonic heals 120');eq(tonic.s.spirit,70,'tier-four tonic restores 60 spirit');
tonic.s.inv.daoTonic=1;tonic.s.hp=20;tonic.s.spirit=10;
ok(tonic.consume('daoTonic').ok,'tier-five tonic can be consumed');eq(tonic.s.hp,240,'tier-five tonic heals 220');eq(tonic.s.spirit,140,'tier-five tonic restores 130 spirit');
// Meditation and refinement scale to the newly supported caps.
let quiet=new Game(baseState(0,0,1,5));quiet.camp.buildings.quiet=4;quiet.s.inv.stone=100;
const xp0=quiet.s.xp, lv0=quiet.s.level;
ok(quiet.meditate().ok,'tier-four meditation succeeds');ok(quiet.s.level>lv0||quiet.s.xp>xp0,'tier-four meditation awards cultivation');
let refine=new Game(baseState(9,5,12,5));const item=refine.createGear('realmSword9',0,'test');item.refine=4;refine.s.gears.push(item);refine.s.inv.dust=1000;
ok(refine.refine(item.id).ok,'refinement +5 succeeds at forge V');eq(item.refine,5,'refinement reaches +5');ok(!refine.refine(item.id).ok,'refinement +6 is blocked');

// Tier prerequisites, restorative scaling, and high-tier farm outputs.
let gated=new Game(baseState(0,0,1,4));gated.camp.level=3;gated.camp.buildings.forge=4;
const blockedForge=gated.build('forge');ok(!blockedForge.ok&&String(blockedForge.msg).includes('洞府升至4阶'),'forge V is gated by residence IV');
gated.camp.level=4;gated.s.hunger=100;gated.s.water=100;gated.s.spirit=gated.s.maxSpirit;gated.s.hp=gated.s.maxHp;
ok(gated.build('forge').ok,'forge V unlocks after residence IV');
let rest3=new Game(baseState());rest3.camp.level=3;rest3.s.hunger=100;rest3.s.water=100;
let rest5=new Game(baseState());rest5.camp.level=5;rest5.s.hunger=100;rest5.s.water=100;
ok(rest5.restForecast('camp').hpGain>rest3.restForecast('camp').hpGain,'residence V improves HP recovery');
ok(rest5.restForecast('camp').spiritGain>rest3.restForecast('camp').spiritGain,'residence V improves spirit recovery');
let farm=new Game(baseState());farm.camp.level=5;farm.camp.buildings.warehouse=5;farm.camp.buildings.farm=5;
farm.s.inv={};farm.s.minutes=farm.camp.farmAt+1440;
ok(farm.harvestFarm().ok,'tier-five farm harvest succeeds');
eq(farm.camp.stash.herb,6,'tier-five farm stores six herbs');eq(farm.camp.stash.berry,6,'tier-five farm stores six berries');
eq(farm.camp.stash.waterherb,4,'tier-five farm stores four water herbs');eq(farm.camp.stash.dew,2,'tier-five farm stores advanced dew');eq(farm.camp.stash.blossom,2,'tier-five farm stores advanced blossoms');
for(const recipe of D.RECIPES)for(const item of Object.keys(recipe.cost||{}))ok(!!D.ITEMS[item],`recipe ${recipe.id} cost item ${item} exists`);
for(let tier=6;tier<=9;tier++)eq(D.RECIPES.find(r=>r.id==='bag'+String(tier).padStart(2,'0')).tier,4,`storage bag ${tier} uses forge IV`);
for(let tier=10;tier<=12;tier++)eq(D.RECIPES.find(r=>r.id==='bag'+String(tier).padStart(2,'0')).tier,5,`storage bag ${tier} uses forge V`);

console.log(`V90.8 BUILDING PROGRESSION PASS ${checks} assertions`);
