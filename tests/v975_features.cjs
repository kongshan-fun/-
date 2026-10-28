'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
function load(file){const text=fs.readFileSync(file,'utf8'),ss=[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);assert.equal(ss.length,10);for(const s of ss)new vm.Script(s);const c=vm.createContext({console});c.globalThis=c;c.window=c;for(let i=0;i<6;i++)vm.runInContext(ss[i],c);return c;}
const C=load(path.join(ROOT,'index.html')),O=load(path.join(ROOT,'releases/山野修仙记_V90.74_存档安全修复版.html'));
const G=C.QGame,D=C.QData,S=C.QCharacterSlots;let checks=0;const outcomes=[];
function eq(a,b,name){assert.equal(a,b,name);checks++}function ok(v,name){assert.ok(v,name);checks++}function throws(f,re,name){assert.throws(f,re,name);checks++}
function test(name,f){const before=checks;f();outcomes.push({name,status:'PASS',assertions:checks-before});console.log('PASS',name,checks-before);}
function mem(){return {map:new Map(),fail:null,getItem(k){return this.map.get(k)||null},setItem(k,v){if(k===this.fail)throw Error('quota injection');this.map.set(k,String(v))},removeItem(k){this.map.delete(k)}}}
function restore(g){return new G(g.state(),1,g.s.character,null,g.s.difficulty);}
function refuel(g){g.s.hunger=g.s.water=100;g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;g.s.life.left=5000*D.LIFE.yearMinutes;}
function fund(g,cost){for(const [id,n] of Object.entries(cost)){if(g.storageReady)g.camp.stash[id]=(g.camp.stash[id]||0)+n;else g.s.inv[id]=(g.s.inv[id]||0)+n;}}
function stage(g,t){g.s.level=t*3;g.syncMajor();const st=D.statsForLevel(g.s.level);Object.assign(g.s,{maxHp:st.hp,maxSpirit:st.spirit,attack:st.atk});g.s.cleared=Array.from({length:12},(_,i)=>i<t-1);g.s.ritual=g.s.cleared.slice();g.recalcUnlocked();refuel(g);}
function home(g){g.enterHome();fund(g,D.SETTLE_COST);ok(g.act('settle').ok,'settle');}
const samples=[];
test('十二图×十二阶配置完整',()=>{
 eq(D.MAP_MATERIALS.length,12);for(const id of D.HOME_ROOMS)eq(D.BUILDINGS[id].levels.length,12,id);
 for(let t=1;t<=12;t++){ok(D.RECIPES.some(r=>r.gear==='weapon'&&r.mapTier===t),'weapon '+t);ok(D.RECIPES.some(r=>r.gear==='armor'&&r.mapTier===t),'armor '+t);for(const kind of D.QUICK_KINDS)ok(D.SUPPLIES['supply'+kind+t],kind+t);}
 eq(D.WAREHOUSE_CAPS[12],250000);for(let t=2;t<=12;t++)ok(D.WAREHOUSE_CAPS[t]>D.WAREHOUSE_CAPS[t-1]);
});
test('双种族×三难度×十二阶营建、配方与赋灵',()=>{
 for(const race of ['human','demon'])for(const mode of ['easy','standard','challenge']){
  let g=new G(null,187345,race,null,mode);home(g);
  for(let t=1;t<=12;t++){
   stage(g,t);g.enterHome();
   if(t>1){fund(g,D.BUILDINGS.residence.levels[t-1].cost);ok(g.act('build',{id:'residence'}).ok,'residence '+t);}
   for(const id of D.HOME_ROOMS.filter(x=>x!=='residence')){refuel(g);fund(g,D.BUILDINGS[id].levels[t-1].cost);ok(g.act('build',{id}).ok,id+t);eq(g.roomLevel(id),t);}
   eq(g.stashCapacity(),D.WAREHOUSE_CAPS[t]);
   for(const type of ['weapon','armor']){const r=D.RECIPES.find(r=>r.gear===type&&r.mapTier===t&&!r.secret);refuel(g);fund(g,r.cost);ok(g.act('craft',{id:r.id}).ok,'craft '+r.id);const gear=g.s.gears.findLast(q=>q.recipe===r.id);ok(gear);gear.quality=2;g.s.xp=10000000;g.s.daoXp=0;fund(g,{stone:100000});const before=g.s.xp;const cost=g.spiritCost(gear);ok(g.act('spirit',{id:gear.id,mode:''}).ok,'spirit '+race+mode+t);eq(g.s.xp,before-cost.xp,'xp cost');eq(g.s.daoXp,0,'retired pool');ok(g.s.prof.spirit>0);}
   for(const kind of D.QUICK_KINDS){const id='supply'+kind+t,r=g.recipe(id);refuel(g);fund(g,r.cost);ok(g.act('craft',{id}).ok,'supply recipe '+id);ok(g.s.inv[id]>0);}
   const cap=g.stashCapacity();g=restore(g);eq(g.roomLevel('residence'),t);eq(g.roomLevel('forge'),t);eq(g.stashCapacity(),cap);eq(g.s.settlements.filter(Boolean).length,0);
  }
  samples.push({race,mode,homeLevel:g.camp.level,capacity:g.stashCapacity(),gearCount:g.s.gears.length});
 }
});
test('赋灵余额不足、全部锁定不抽签不扣材料',()=>{
 const g=new G();home(g);g.camp.buildings.forge=1;const gear=g.createGear('woodSword',2);g.s.gears.push(gear);g.s.xp=0;g.s.inv.stone=100;
 const before=JSON.stringify({seed:g.s.seed,stone:g.s.inv.stone,affixes:gear.affixes});eq(g.act('spirit',{id:gear.id}).ok,false);eq(JSON.stringify({seed:g.s.seed,stone:g.s.inv.stone,affixes:gear.affixes}),before);
 g.s.xp=10000;ok(g.act('spirit',{id:gear.id}).ok);const state=JSON.stringify({seed:g.s.seed,xp:g.s.xp,stone:g.s.inv.stone});eq(g.spirit(gear.id,gear.affixes.map((_,i)=>i)).ok,false);eq(JSON.stringify({seed:g.s.seed,xp:g.s.xp,stone:g.s.inv.stone}),state);
 stage(g,7);g.s.xp=g.required;g.s.pendingTribulation=g.s.level;ok(g.spendProgress(1));eq(g.s.pendingTribulation,0);eq(g.s.level,21);
});
test('多洞府材料与432件装备无损、幂等迁移',()=>{
 const old=new O.QGame(null,123456,'human');old.s.minutes=40000;old.s.life.left=500*D.LIFE.yearMinutes;old.s.level=36;old.s.major=8;old.s.cleared.fill(true);old.s.ritual.fill(true);old.s.unlocked=12;
 let total=0,gears=0;const expectedYield={};
 for(let z=0;z<12;z++){
  let p;for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!p&&O.QData.CAMP_LANDS.includes(O.QData.ZONES[z].map[y][x])&&!O.QData.SITES[z+':'+x+','+y]&&!O.QData.EVENTS[z+':'+x+','+y])p={x,y};
  ok(p,'legacy buildable position');const stash={wood:1000+z,stone:2000+z};total+=stash.wood;
  const vault=Array.from({length:36},()=>({id:'g'+(++gears),recipe:'woodSword',quality:2,refine:1,affixes:[],source:'旧仓'}));
  old.s.settlements[z]={pos:p,level:5,buildings:{warehouse:5,forge:5,alchemy:4,quiet:3,farm:2},stash,storedGears:vault,farmAt:old.s.minutes-2881,foundedAt:200};
  for(const [id,q] of Object.entries(O.QData.FARM_LOOT[2]))expectedYield[id]=(expectedYield[id]||0)+q*2;
 }
 let g=new G(old.state());eq(g.camp.stash.wood,total);eq(g.camp.storedGears.length,432);eq(new Set(g.camp.storedGears.map(x=>x.id)).size,432);eq(g.camp.level,12);eq(g.roomLevel('alchemy'),9);eq(g.roomLevel('quiet'),5);eq(g.camp.migratedFrom,12);
 const once=JSON.stringify(g.state());g=restore(g);assert.deepEqual(JSON.parse(JSON.stringify(g.state())),JSON.parse(once),'reloading migration does not duplicate anything');checks++;
 for(const [id,q] of Object.entries(expectedYield))eq(g.camp.pendingHarvest[id],q,'pending harvest '+id);
 g.enterHome();const before=g.camp.stash.herb||0;ok(g.act('farm').ok);eq(g.camp.stash.herb,before+expectedYield.herb);eq(Object.keys(g.camp.pendingHarvest).length,0);g=restore(g);eq(g.camp.stash.herb,before+expectedYield.herb);
});
test('迁移前原档归档写入故障必须阻断保存',()=>{
 const db=mem(),slots=new S(db),old=new O.QGame();old.s.guide.status='skipped';const key=slots.key('human',1),raw=JSON.stringify(old.state());db.setItem(key,raw);
 const g=slots.read('human',1).game;db.fail=key+'-pre-global-home-v975';throws(()=>slots.save('human',g,1),/quota/);eq(db.getItem(key),raw);db.fail=null;ok(slots.save('human',g,1));eq(db.getItem(key+'-pre-global-home-v975'),raw);ok(JSON.parse(db.getItem(key)).homeSchema===1);
});
test('洞府安全边界、配方门槛与超量仓物',()=>{
 const g=new G();home(g);g.camp.buildings.warehouse=1;g.camp.stash.wood=100000;g.s.inv.wood=2;eq(g.act('store',{id:'wood',qty:1}).ok,false);const stored=g.camp.stash.wood;
 ok(g.act('withdraw',{id:'wood',qty:1}).ok);eq(g.camp.stash.wood,stored-1);
 const pos=JSON.stringify(g.s.pos),zone=g.s.zone;g.leaveHome();eq(g.storageReady,false);eq(g.has('wood'),g.s.inv.wood);eq(g.act('withdraw',{id:'wood'}).ok,false);g.enterHome();eq(JSON.stringify(g.s.pos),pos);eq(g.s.zone,zone);eq(g.act('settle').ok,false);
 eq(g.act('build',{id:'residence'}).ok,false);eq(g.camp.level,1);ok(g.recipeRequirement(g.recipe('supplyhp12')));
 g.leaveHome();g.startBattle('sprite');eq(g.enterHome().ok,false);g.s.combat=null;g.s.secretRealm={zone:0};eq(g.enterHome().ok,false);
});
test('四格补给、战斗用药回合与无货不换药',()=>{
 const g=new G();stage(g,12);g.s.inv.supplyhp12=3;g.s.inv.supplyspirit12=3;g.s.inv.supplyfood12=3;g.s.inv.supplywater12=3;
 for(let i=0;i<4;i++)ok(g.setQuickSlot(i,'supply'+D.QUICK_KINDS[i]+12).ok);
 let r=restore(g);eq(r.s.quickSlots.join(','),g.s.quickSlots.join(','));
 r.s.hp=1;const gain=r.supplyEffect('supplyhp12').hp;ok(r.consume('supplyhp12').ok);eq(r.s.hp,1+gain);eq(r.s.inv.supplyhp12,2);
 refuel(r);r.s.hp=Math.round(r.s.maxHp*.2);r.startBattle('sprite');r.s.combat.atk=1;r.s.combat.hp=r.s.combat.maxHp=999999;const turn=r.s.combat.turn,min=r.s.minutes;ok(r.act('fight',{mode:'heal'}).ok);eq(r.s.combat.turn,turn+1);eq(r.s.minutes,min+15);eq(r.s.inv.supplyhp12,1);
 r.s.inv.supplyhp12=0;r.s.inv.salve=100;const t=r.s.combat.turn;eq(r.act('fight',{mode:'heal'}).ok,false);eq(r.s.inv.salve,100);eq(r.s.combat.turn,t);eq(r.act('consume',{id:'supplyfood12'}).ok,false);
 r.s.combat=null;r.s.hp=r.s.maxHp;r.s.inv.supplyhp12=2;eq(r.consume('supplyhp12').ok,false);eq(r.s.inv.supplyhp12,2);
});
test('未建仓房的旧灵田产出不损坏存档、已完成故事不倒退',()=>{
 const g=new G();home(g);g.camp.buildings.farm=1;g.camp.pendingHarvest={herb:20};const before=JSON.stringify(g.camp.pendingHarvest);
 eq(g.act('farm').ok,false);eq(JSON.stringify(g.camp.pendingHarvest),before);ok(restore(g));
 stage(g,12);g.s.flags.coreTribulation={phase:3,marks:2,started:true,complete:true};g.s.flags.heartTrial={phase:3,started:true,complete:true,choices:['anchor','observe','force']};const r=restore(g);
 eq(r.s.flags.coreTribulation.complete,true);eq(r.s.flags.heartTrial.complete,true);
});
test('六百个历史档首次保存前逐档归档，故障不污染邻档',()=>{
 const db=mem();let migrated=0;
 for(const mode of ['easy','standard','challenge'])for(const race of ['human','demon']){
  const slots=new S(db,mode);
  for(let n=1;n<=100;n++){
   const old=new O.QGame(null,400000+n,race,null,mode);
   old.s.settlements[0]={pos:{x:1,y:5},level:3,buildings:{warehouse:3,forge:3},stash:{wood:10+n},storedGears:[],foundedAt:old.s.minutes,farmAt:old.s.minutes};
   const key=slots.key(race,n),raw=JSON.stringify(old.state());db.setItem(key,raw);const g=slots.read(race,n).game;
   if(n%17===0){db.fail=key+'-pre-global-home-v975';throws(()=>slots.save(race,g,n),/quota/);eq(db.getItem(key),raw);db.fail=null;}
   slots.save(race,g,n);eq(db.getItem(key+'-pre-global-home-v975'),raw);eq(slots.read(race,n).game.camp.stash.wood,10+n);eq(slots.read(race,n).game.camp.level,5);migrated++;
  }
 }
 eq(migrated,600);
});
test('600独立档位配置往返，不跨难度和种族',()=>{
 const db=mem();for(const mode of ['easy','standard','challenge'])for(const race of ['human','demon']){const slots=new S(db,mode);for(let n=1;n<=100;n++){const g=slots.newGame(race,123000+n,n);g.s.inv.supplyhp1=1;g.s.quickSlots[0]='supplyhp1';slots.save(race,g,n);eq(slots.read(race,n).game.s.quickSlots[0],'supplyhp1');eq(slots.read(race,n).game.s.difficulty,mode);}}
 eq(new Set([...db.map.keys()].filter(k=>/-slot-\d+$/.test(k))).size,600);
});
const report={version:'V90.75',assertions:checks,suites:outcomes,samples,notes:['Synthetic materials and accelerated levels; not a natural-play economy certification.','No live TapTap SDK requests in engine tests.']};
fs.mkdirSync(path.join(ROOT,'artifacts/v975'),{recursive:true});fs.writeFileSync(path.join(ROOT,'artifacts/v975/features.json'),JSON.stringify(report,null,2));console.log('V90.75 FEATURE MATRIX PASS',checks,'assertions');
