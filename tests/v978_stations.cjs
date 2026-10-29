'use strict';
const {load,fixture,harness}=require('./lib/v978.cjs');const C=load(),D=C.QData,G=C.QGame,T=harness('stations');
T.test('配方唯一归属与自动工作台',()=>{
 for(const r of D.RECIPES){T.ok(Object.keys(D.STATIONS).includes(r.station),r.id);T.eq(D.stationOf(r),r.station);if(r.gear)T.eq(r.station,'forge');if(r.storageBag)T.eq(r.station,'workbench');}
 const g=new G();T.eq(g.roomLevel('workbench'),0);g.enterHome();Object.assign(g.s.inv,D.SETTLE_COST);T.ok(g.act('settle').ok);T.eq(g.roomLevel('workbench'),1);T.eq(g.act('build',{id:'workbench'}).ok,false);T.eq(g.camp.buildings.workbench,undefined);
});
T.test('十二阶袋不再依赖炼器室等级，地图与境界仍限制',()=>{
 for(const race of ['human','demon'])for(const mode of ['easy','standard','challenge'])for(let t=1;t<=12;t++){
 const g=fixture(C,t,race,mode);g.camp.buildings.forge=0;const r=g.recipe('bag'+String(t).padStart(2,'0'));Object.assign(g.camp.stash,r.cost);
 T.eq(g.recipeRequirement(r),'');T.ok(g.act('craft',{id:r.id}).ok);T.ok(g.hasStorageBag(r.id));T.eq(g.act('craft',{id:r.id}).ok,false);T.eq(g.roomLevel('workbench'),1);
 if(t<12)T.ok(g.recipeRequirement(g.recipe('bag'+String(t+1).padStart(2,'0'))));
 }
});
T.test('前期无斧开工循环、赋灵维持一阶前置',()=>{
 const g=new G();Object.assign(g.s.inv,{wood:3,fiber:3,stone:3});T.eq(g.recipeRequirement(g.recipe('axe')),'');T.ok(g.act('craft',{id:'axe'}).ok);
 const h=fixture(C,7);h.camp.buildings.forge=0;const gear=h.createGear('woodSword',2);h.s.gears.push(gear);h.s.xp=100000;h.camp.stash.stone=100000;T.eq(h.act('spirit',{id:gear.id}).ok,false);h.camp.buildings.forge=1;T.ok(h.act('spirit',{id:gear.id}).ok);h.leaveHome();T.eq(h.act('spirit',{id:gear.id}).ok,false);
});
T.test('文案配置单一口径，不更换旧物品ID',()=>{
 T.eq(D.ITEMS.coreTonic.name,'六阶回元丹');T.eq(D.ITEMS.daoTonic.name,'十一阶道源丹');T.eq(D.SUPPLIES.mana.tier,D.RECIPES.find(r=>r.item==='mana').mapTier);
 T.ok(D.GUIDE.find(r=>r.id==='settle').text.includes('固定洞府'));T.ok(!D.HELP.some(r=>/（P\d+）/.test(r.title)));T.ok(D.HELP.find(r=>r.id==='blood').paragraphs.join('').includes('114'));
 T.ok(C.html.includes('id="manuals-button"'));T.ok(!C.html.includes('id="craft-button"'));
});
T.finish();
