'use strict';
const {load,mem,fixture,harness}=require('./lib/v978.cjs');const C=load(),O=load('releases/山野修仙记_V90.77_灵息辟谷.html'),G=C.QGame,D=C.QData,S=C.QCharacterSlots,T=harness('garden');
const reload=g=>new G(g.state(),1,g.s.character,null,g.s.difficulty);
const base=id=>Object.fromEntries(Object.entries(id));
T.test('四至二十六块田及植物来源，不产生矿石',()=>{
 for(let t=1;t<=12;t++)T.eq(D.gardenCapacity(t),4+2*(t-1));T.eq(D.gardenCapacity(0),0);
 for(const c of Object.values(D.CROPS)){T.ok(D.ITEMS[c.id]);T.ok(D.ITEMS[c.item]);T.ok(c.sources.every(x=>D.RES[x]));T.ok(!['ore','stone','tribulationCrystal','ascendToken','copper','voidStone'].includes(c.item));T.ok(c.minutes>=720);}
});
T.test('双种族三难度十二阶：播种、成长、重载和一次性收获',()=>{
 for(const race of ['human','demon'])for(const mode of ['easy','standard','challenge'])for(let tier=1;tier<=12;tier++){
 let g=fixture(C,tier,race,mode);g.camp.stash.water=100;g.s.inv={water:2};
 for(const c of Object.values(D.CROPS).filter(c=>c.tier<=tier)){
  g.camp.stash[c.id]=(g.camp.stash[c.id]||0)+2;const count=g.has(c.id),time=g.s.minutes,mat=g.has(c.item),water=g.has('water');
  T.ok(g.act('garden-sow',{crop:c.id,index:0}).ok);T.eq(g.has(c.id),count-1);T.eq(g.has('water'),water-1);T.eq(g.s.minutes,time+5);T.eq(g.s.garden.plots[0].readyAt,g.s.minutes+c.minutes);
  const rng=g.s.seed,before=JSON.stringify(g.s.garden);g.gardenInfo();g.gardenInfo();T.eq(JSON.stringify(g.s.garden),before);T.eq(g.s.seed,rng);
  T.eq(g.act('garden-harvest',{index:0}).ok,false);g=reload(g);g.enterHome();T.eq(g.s.garden.plots[0].readyAt,time+5+c.minutes);
  T.ok(g.tick(c.minutes,0,0,0));T.ok(g.act('garden-harvest',{index:0}).ok);T.eq(g.has(c.item),mat+c.yield);T.eq(g.s.garden.plots[0],null);T.eq(g.act('garden-harvest',{index:0}).ok,false);
  g=reload(g);g.enterHome();T.eq(g.has(c.item),mat+c.yield);
 }
 }
});
T.test('种植升级、批量数量及资源不足不扣费',()=>{
 const g=fixture(C,3);g.camp.buildings.farm=1;g.s.garden.plots=Array(4).fill(null);g.camp.stash.seedHerb=6;g.camp.stash.water=4;g.s.inv.water=0;
 T.ok(g.act('garden-sow',{crop:'seedHerb',batch:true}).ok);T.eq(g.gardenInfo().growing,4);T.eq(g.camp.stash.seedHerb,2);T.eq(g.camp.stash.water,0);
 const original=g.s.garden.plots.map(p=>p.readyAt);Object.assign(g.camp.stash,D.BUILDINGS.farm.levels[1].cost);T.ok(g.act('build',{id:'farm'}).ok);T.eq(g.gardenCapacity(),6);T.same(g.s.garden.plots.slice(0,4).map(p=>p.readyAt),original);
 const before=JSON.stringify(g.s);T.eq(g.act('garden-sow',{crop:'seedGodFruit',index:4}).ok,false);T.eq(JSON.stringify(g.s),before);
 g.camp.stash.water=0;g.s.inv.water=0;const seeds=g.has('seedHerb'),time=g.s.minutes;T.eq(g.act('garden-sow',{crop:'seedHerb',index:4}).ok,false);T.eq(g.has('seedHerb'),seeds);T.eq(g.s.minutes,time);
});
T.test('满仓不吞、部分收获与刷新不复制',()=>{
 let g=fixture(C,1);g.s.inv={seedWood:1,water:1};T.ok(g.act('garden-sow',{crop:'seedWood',index:0}).ok);T.ok(g.tick(D.CROPS.seedWood.minutes,0,0,0));
 // Leave exactly 2 units (4 weight) in the warehouse; fill the backpack exactly.
 g.camp.stash={wood:298};g.s.inv={wood:Math.floor(g.capacity/2),fiber:g.capacity%2};
 const inv0=g.s.inv.wood,stored0=g.camp.stash.wood;T.ok(g.act('garden-harvest',{index:0}).ok);T.eq(g.camp.stash.wood,stored0+2);T.eq(g.s.garden.plots[0].remaining,4);
 const snapshot=JSON.stringify(g.s);T.eq(g.act('garden-harvest',{index:0}).ok,false);T.eq(JSON.stringify(g.s),snapshot);
 g=reload(g);g.enterHome();T.eq(g.s.garden.plots[0].remaining,4);g.camp.stash.wood-=4;T.ok(g.act('garden-harvest',{index:0}).ok);T.eq(g.s.garden.plots[0],null);T.eq(g.s.inv.wood,inv0);T.eq(g.camp.stash.wood,stored0+2);T.eq(g.s.garden.harvested,1);
});
T.test('旧田最多三轮、未满一轮、待领和原档均保留且幂等',()=>{
 const old=fixture(O,6);old.camp.farmAt=old.s.minutes-5*1440-333;old.s.minutes+=20000;old.camp.farmAt=old.s.minutes-5*1440-333;old.camp.pendingHarvest={ore:7};
 const raw=JSON.stringify(old.state()),db=mem(),slots=new S(db),key=slots.key('human',1);db.setItem(key,raw);
 let g=slots.read('human',1).game;T.ok(g.s.garden.starter);T.eq(g.s.inv.seedHerb,2);for(const[k,n]of Object.entries(O.QData.FARM_LOOT[6]))T.eq(g.s.garden.legacyYield[k],n*3+(k==='ore'?7:0));T.eq(g.s.garden.legacyYield.ore,7);
 T.eq(g.s.garden.legacyDue.at,g.s.minutes+1107);const a=JSON.stringify(g.s.garden);slots.save('human',g,1);T.eq(db.getItem(slots.gardenArchiveKey('human',1)),raw);g=slots.read('human',1).game;T.eq(JSON.stringify(g.s.garden),a);T.eq(g.s.inv.seedHerb,2);
 g.enterHome();const initial=g.has('herb'),pending=g.s.garden.legacyYield.herb;T.ok(g.act('garden-legacy').ok);T.eq(g.has('herb'),initial+pending);T.eq(g.act('garden-legacy').ok,false);g.tick(1107,0,0,0);T.ok(g.act('garden-legacy').ok);T.eq(g.s.garden.legacyDue,null);g.tick(1440*10,0,0,0);T.eq(g.act('garden-legacy').ok,false);
});
T.test('首次存档归档写失败与静默写失败不得覆盖原档',()=>{
 for(const silent of [false,true]){const db=mem(),slots=new S(db),old=fixture(O,2),raw=JSON.stringify(old.state()),key=slots.key('human',3);db.setItem(key,raw);const g=slots.read('human',3).game;db.fail=slots.gardenArchiveKey('human',3);db.silent=silent;T.throws(()=>slots.save('human',g,3),/quota|归档/);T.eq(db.getItem(key),raw);db.fail=null;T.ok(slots.save('human',g,3));T.eq(db.getItem(slots.gardenArchiveKey('human',3)),raw);}
});
T.test('篡坏结构不能截断作物或制造即时成熟',()=>{
 const g=fixture(C,12);g.s.inv.seedHerb=1;g.s.inv.water=2;g.act('garden-sow',{crop:'seedHerb',index:0});
 for(const edit of [s=>s.garden.schema=999,s=>s.garden.plots[0].crop='fake',s=>s.garden.plots[0].readyAt=0,s=>s.garden.plots[0].remaining=999,s=>s.garden.plots.push(null),s=>s.garden.seedRng=-1,s=>s.garden.legacyYield.wood=-2]){const s=g.state();edit(s);T.throws(()=>new G(s),/灵田|种子/);}
 const low=g.state();low.homestead.buildings.farm=1;low.garden.plots[20]={...low.garden.plots[0]};T.throws(()=>new G(low),/灵田/);
});
T.test('采集失败不抽种、成功采集保底、独立随机数不改变主随机流',()=>{
 const g=fixture(C,1);g.leaveHome();g.s.inv={axe:1,water:10,berry:10};let idx=-1;for(let i=0;i<24;i++)if(g.resource(i)==='grass'){idx=i;break;}T.ok(idx>=0);
 let count=0;for(let n=0;n<36;n++){
  g.s.nodeHarvest={};g.s.hunger=g.s.water=100;g.s.spirit=g.s.maxSpirit;const before=g.s.stats.gathers;T.ok(g.act('gather',{index:idx}).ok);T.eq(g.s.stats.gathers,before+1);count=g.s.inv.seedFiber||0;
  g.s.nodeHarvest[g.key()+'#'+idx]={day:g.day,used:D.RES.grass.max};const a=JSON.stringify(g.s.garden);T.eq(g.act('gather',{index:idx}).ok,false);T.eq(JSON.stringify(g.s.garden),a);
  g.s.inv.fiber=0;
 }T.ok(count>=3);T.eq(g.s.garden.seedsFound,count);
});
T.test('跨族难度百档隔离与数百次重载',()=>{
 const db=mem();for(const mode of ['easy','standard','challenge'])for(const race of ['human','demon']){const slots=new S(db,mode);for(let n=1;n<=100;n++){
 let g=fixture(C,1,race,mode,123000+n);g.s.inv.seedHerb=1;g.camp.stash.water=1;g.s.inv.water=0;g.act('garden-sow',{crop:'seedHerb',index:0});slots.save(race,g,n);const a=g.s.garden.plots[0].readyAt;
 g=slots.read(race,n).game;T.eq(g.s.garden.plots[0].readyAt,a);T.eq(g.s.inv.seedHerb||0,0);T.eq(g.s.character,race);T.eq(g.s.difficulty,mode);
 }}
});
T.finish({fixtures:'Progression and quantities are injected for rule testing; not a natural playthrough.'});
