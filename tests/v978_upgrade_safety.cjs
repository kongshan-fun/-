'use strict';
const {load,mem,fixture,harness}=require('./lib/v978.cjs');
const C=load(),O=load('releases/山野修仙记_V90.77_灵息辟谷.html'),T=harness('upgrade-safety');
T.test('跨版寿尽回执：六组角色恢复后保留唯一种植迁移',()=>{
 for(const race of ['human','demon'])for(const mode of ['easy','standard','challenge']){
  const db=mem(),oldSlots=new O.QCharacterSlots(db,mode),slots=new C.QCharacterSlots(db,mode);
  const old=fixture(O,3,race,mode),key=slots.key(race,2);old.s.minutes+=1440;old.camp.farmAt=old.s.minutes-1440;old.camp.pendingHarvest={ore:2};oldSlots.save(race,old,2);
  const prior=db.getItem(key);old.expire('version upgrade pending rescue');oldSlots.markRescuePending(race,2,old);const receipt=db.getItem(slots.rescueKey(race,2));
  const found=slots.read(race,2),dead=found.pendingRescue;
  T.ok(dead.ended);T.eq(dead.life.left,0);T.ok(dead.garden);T.eq(db.getItem(slots.rescueKey(race,2)),receipt,'read must not rewrite immutable death receipt');
  T.eq(dead.garden.legacyYield.ore,2);T.eq(dead.inv.seedHerb,2);T.eq(dead.garden.plots.length,8);
  const again=slots.read(race,2).pendingRescue;T.eq(again.inv.seedHerb,2);T.eq(again.garden.legacyYield.ore,2);
  const g=found.game;g.s=JSON.parse(JSON.stringify(dead));g.s.ended=false;g.s.life.rescued=true;g.s.life.left=15*C.QData.LIFE.yearMinutes;g.s.hp=Math.max(1,Math.round(g.s.maxHp*.35));
  T.ok(slots.save(race,g,2));T.eq(db.getItem(slots.gardenArchiveKey(race,2)),prior);
  const resumed=slots.read(race,2);T.eq(resumed.pendingRescue,undefined);T.eq(resumed.game.s.inv.seedHerb,2);T.eq(resumed.game.s.garden.legacyYield.ore,2);
  T.eq(resumed.game.s.life.rescued,true);T.eq(db.getItem(slots.rescueKey(race,2)),null);
 }
});
T.test('新档不归档旧回合、合法归档永不覆盖',()=>{
 const db=mem(),slots=new C.QCharacterSlots(db);const g=slots.newGame('human',987654,3);T.eq(db.getItem(slots.gardenArchiveKey('human',3)),null);
 const archived='original independent history';db.setItem(slots.gardenArchiveKey('human',3),archived);slots.save('human',g,3);T.eq(db.getItem(slots.gardenArchiveKey('human',3)),archived);
});
T.finish();
