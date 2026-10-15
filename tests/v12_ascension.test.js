'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../src/data.js'),G=require('../src/engine.js'),Slots=require('../src/slots.js');
const {campaign}=require('./v10_campaign.test.js');
// Each GitHub CI job gets an independent, clean checkout. Reproduce the legacy
// five-map fixture from real Game.act actions if it is absent in this job.
const legacyFixture=path.join(__dirname,'fixtures/v9_natural_complete.json');
if(!fs.existsSync(legacyFixture)){
 const first=campaign(261014,true,'sword');
 A.equal(first.pass,true,'Unable to reconstruct old natural save fixture');
}
let tests=0;const check=(name,fn)=>{fn();tests++;console.log('PASS',name);};
const good=(g,a,b={})=>{const r=g.act(a,b);A.equal(r.ok,true,`${a}: ${r.msg||''}`);return r;};
const no=(g,a,b={})=>{const before=JSON.stringify(g.state());const r=g.act(a,b);A.equal(r.ok,false,`${a} should fail`);A.equal(JSON.stringify(g.state()),before,'Failed '+a+' must not mutate state');};
check('Twelve actual distinct 8x8 maps, nine mortal realms, final ascension',()=>{
 A.equal(D.VERSION,12);A.equal(D.ZONES.length,12);A.equal(D.REALMS.length,10);A.equal(D.ASCENSION_STAGES.length,7);A.equal(new Set(D.ZONES.map(z=>z.name)).size,12);
 for(const [i,z] of D.ZONES.entries()){A.equal(z.map.length,8);for(const row of z.map){A.equal(row.length,8);for(const land of row)A.ok(D.LAND[land],land);}A.ok(D.ENEMIES[z.boss]);A.ok(D.ITEMS[Object.keys(z.need)[0]]);if(i>=5)A.equal(z.map[5][0],'campsite');}
});
check('All high realm resources, enemies, recipes and quality distributions',()=>{
 for(let z=5;z<12;z++){const t=D.ASCENSION_STAGES[z-5];A.ok(D.RES[t.primary]);A.ok(D.RES[t.secondary]);A.ok(D.ENEMIES['realm'+z]);A.equal(D.RECIPES.filter(r=>r.zone===z&&r.gear).length,2);const all=D.ZONES[z].map.flat();for(const land of t.kind)A.ok(all.includes(land));A.equal(D.QUALITY_WEIGHTS[z].reduce((a,b)=>a+b,0),100);}
});
check('New character and V11 old five map save keep independent branch history',()=>{
 const g=new G();A.equal(g.s.settlements.length,12);A.equal(g.s.major,0);
 const old=require('../tests/fixtures/v9_natural_complete.json');const snap=JSON.parse(JSON.stringify(old));snap.version=11;snap.settlements=snap.settlements.slice(0,5);snap.cleared=snap.cleared.slice(0,5);snap.ritual=snap.ritual.slice(0,5);delete snap.major;delete snap.daoXp;delete snap.ascended;
 const restored=new G(snap);A.equal(restored.s.zone,0);A.equal(restored.s.settlements.length,12);A.equal(restored.s.unlocked,6);A.equal(restored.s.major,1);A.equal(restored.s.flags.complete,false);
 const round=new G(restored.state());A.equal(round.s.unlocked,6);A.equal(round.s.settlements.length,12);
});
check('Falsified ascension and incomplete settlements cannot be imported',()=>{
 const s=new G().state();A.throws(()=>new G({...s,major:9,ascended:true}),/大境界|飞升/);A.throws(()=>new G({...s,settlements:s.settlements.slice(0,5)}),/洞府数据/);
});
check('Gate progression requires actual region completion and manual advancement',()=>{
 const g=new G();no(g,'travel',{zone:5});A.equal(g.s.unlocked,1);
});
check('Independent V12 saves survive realm and warehouse roundtrip',()=>{
 class DB{constructor(){this.k={};}getItem(k){return this.k[k]??null;}setItem(k,v){this.k[k]=v;}removeItem(k){delete this.k[k];}}
 const slots=new Slots(new DB());const a=slots.newGame('sword'),b=slots.newGame('herb');A.equal(a.s.version,12);A.equal(b.s.version,12);A.equal(slots.list().length,2);
 slots.save('sword',a);slots.save('herb',b);A.equal(slots.read('sword').game.s.character,'sword');A.equal(slots.read('herb').game.s.character,'herb');slots.expire('sword');A.equal(slots.status('sword').status,'dead');A.equal(slots.status('herb').status,'ready');
});
function flythrough(seed,role){
 const start=campaign(seed,false,role,true);if(!start.pass)throw Error('Old five chapters did not finish');
 const g=new G(start.state,seed,role),result=[];let actions=0,encounters=0;
 function act(a,b={}){if(++actions>21000)throw Error('exceeded 21k operations');return g.act(a,b);}
 function must(a,b={}){const r=act(a,b);A.equal(r.ok,true,`${role} stage ${g.s.zone} ${a}: ${r.msg||''}`);return r;}
 function fight(){let i=0;while(g.s.combat){if(++i>220)throw Error('battle too long: '+g.s.combat.type);const b=g.s.combat;let mode=b.intent==='heavy'?'guard':g.s.spirit>=g.spellCost?'spell':'attack';if(g.s.hp<Math.min(140,g.s.maxHp*.42)&&b.intent!=='heavy')mode='heal';if(mode==='heal'&&g.s.character==='sword'&&!g.s.inv.salve)mode='guard';
  const r=act('fight',{mode});if(g.s.ended)throw Error('unexpected death');if(g.s.stats.defeats)throw Error('unexpected collapse');if(!r.ok&&!['heal','mana'].includes(mode))throw Error('combat action failed '+r.msg);
 }
 }
 function care(){if(g.s.combat){fight();return;}if(g.s.hunger<30){let food=['berry','pill','meal','fish'].find(k=>g.s.inv[k]>0);if(food)act('consume',{id:food});}if(g.s.water<30&&g.s.inv.water)act('consume',{id:'water'});
  if(g.atCamp&&(g.s.hp<g.s.maxHp*.6||g.s.spirit<30||g.s.hunger<18||g.s.water<18))act('rest',{mode:'camp'});
  if(!g.atCamp&&g.s.spirit<26)act('rest',{mode:'field'});
 }
 function go(x,y){for(let i=0;i<90;i++){care();if(g.s.combat)fight();if(g.s.pos.x===x&&g.s.pos.y===y)return;const step=g.path(x,y)[0];if(!step)throw Error('Path unavailable '+g.s.zone+' to '+x+','+y);const r=act('move',step);if(g.s.combat){encounters++;fight();}if(!r.ok&&g.s.stats.defeats)throw Error('collapsed on path');}throw Error('path loop');}
 function resOptions(item,zone=g.s.zone){const result=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const land=D.ZONES[zone].map[y][x];if(land==='boss'||land==='gate')continue;
  for(let i=0;i<10;i++){const id=D.RESOURCE_LAYOUT[land]?.[i],r=D.RES[id];if(!r?.loot[item]||r.tool&&!g.s.inv[r.tool])continue;
   const mark=g.s.nodeHarvest[`${zone}:${x},${y}#${i}`];if(mark?.day===g.day&&mark.used>=r.max)continue;
   result.push({x,y,i,dist:Math.max(Math.abs(x-g.s.pos.x),Math.abs(y-g.s.pos.y)),land});
  }
 }return result.sort((a,b)=>a.dist-b.dist);}
 function gatherTo(item,num,zone=g.s.zone){let loops=0;while((g.s.inv[item]||0)<num){if(++loops>250)throw Error('no material '+item+' '+num+' @'+zone+' '+JSON.stringify(g.s.inv));
  care();if(g.s.zone!==zone)must('travel',{zone});
  if(g.weight>g.capacity-8){if(g.camp){must('travel',{zone,home:true});if(g.roomLevel('warehouse'))act('store');}else{for(const id of ['star','thunder','hide','ore','dust'])if(g.s.inv[id]>5)for(let j=0;j<5;j++)act('discard',{id});}}
  const opts=resOptions(item,zone);if(!opts.length){if(g.camp){must('travel',{zone,home:true});act('rest',{mode:'dawn'});}else{for(let i=0;i<5;i++)care(),act('rest',{mode:'field'});}continue;}
  const t=opts[0];go(t.x,t.y);if(g.s.combat){fight();continue;}
  let why=g.requirement(g.resource(t.i));if(why.includes('灵力不足')){act('rest',{mode:'field'});continue;}
  const r=act('gather',{index:t.i});if(!r.ok){if(r.msg?.includes('负重')){if(g.camp){must('travel',{zone,home:true});if(g.storageReady)act('store');}else throw Error('overweight before first camp');}else if(r.msg?.includes('灵力'))act('rest',{mode:'field'});else throw Error(r.msg);}
 }
 }
 function refillAtHome(){if(g.s.zone!==0)must('travel',{zone:0});if(!g.atCamp)must('travel',{zone:0,home:true});for(let x=0;x<2;x++)act('rest',{mode:'camp'});}
 for(let z=5;z<12;z++){
  const t=D.ASCENSION_STAGES[z-5];A.equal(g.s.unlocked>=z+1,true,'stage unlocked '+z);A.equal(g.s.major,z-4,'realm before '+z);
  // Build a local abode using REAL gathered earlier materials, never another region's remote stash.
  refillAtHome();for(const [id,n]of Object.entries(D.SETTLE_COST))gatherTo(id,n,0);
  must('travel',{zone:z});must('settle');
  // The stage itself supplies all forged gear, altar and ascension ingredients.
  const p=t.primary,q=t.secondary;
  gatherTo(p,10,z);gatherTo(q,5,z);
  must('travel',{zone:0});must('travel',{zone:0,home:true});
  gatherTo('wood',1,0);gatherTo('fiber',1,0);must('travel',{zone:0,home:true});
  if(g.s.gears.length>30)for(const gear of [...g.s.gears]){if(g.s.gears.length<=26)break;if(!Object.values(g.s.equipped).includes(gear.id))must('salvage',{id:gear.id});}
  for(const item of ['realmSword'+z,'realmRobe'+z]){
   const r=D.RECIPES.find(x=>x.id===item);const rr=act('craft',{id:r.id});A.equal(rr.ok,true,'gear '+item+': '+rr.msg);
  }
  must('travel',{zone:z});go(4,4);
  must('repair');go(7,2);if(g.s.combat)fight();if(!g.s.cleared[z])must('hunt'),fight();
  A.equal(g.s.cleared[z],true,'boss '+z);
  must('travel',{zone:z,home:true});
  if(g.s.level<18){while(g.s.level<18)must('meditate');}
  if(g.s.daoXp<t.needDao){for(let i=0;i<20&&g.s.daoXp<t.needDao;i++){if(g.s.meditation.uses>=3)act('rest',{mode:'dawn'});must('meditate');}}
  A.ok(g.s.daoXp>=t.needDao,'enough DAO for '+z);
  const prior=g.lifeYears;must('breakthrough');A.equal(g.s.major,z-3);A.ok(g.lifeYears>prior);
  if(role==='sword'&&z===5){fs.mkdirSync(path.join(__dirname,'../evidence'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../evidence/V12_结丹地图实测档.json'),JSON.stringify(g.state(),null,2));}
  const saved=new G(g.state(),seed,role);A.equal(saved.s.major,g.s.major);A.equal(saved.s.settlements.length,12);
  result.push({zone:z,realm:g.realm,days:g.day,dao:g.s.daoXp,life:g.lifeYears,actions,encounters,defeats:g.s.stats.defeats});
 }
 // The final realm is 渡劫; flight requires a separate final trial at the Gate.
 A.equal(g.s.major,8);A.equal(g.s.ascended,false);A.equal(g.s.unlocked,12);
 gatherTo('tribulationCrystal',3,11);gatherTo('ascendToken',2,11);
 must('travel',{zone:11,home:true});
 for(let i=0;g.s.daoXp<D.ASCENSION_RULE.dao&&i<8;i++){
  go(7,2);const h=act('hunt');
  if(h.ok){fight();}
  else if(h.msg?.includes('今日已挑战')){must('travel',{zone:11,home:true});for(let j=0;j<8&&g.s.bossDaily[11]===g.day;j++)act('rest',{mode:'camp'});}
  else throw Error('hunt for flight failed: '+h.msg);
 }
 A.ok(g.s.daoXp>=D.ASCENSION_RULE.dao,'Ascension DAO requirement');go(7,5);
 if(role==='sword')fs.writeFileSync(path.join(__dirname,'../evidence/V12_渡劫天门实测档.json'),JSON.stringify(g.state(),null,2));
 must('ascend');
 A.equal(g.s.ascended,true);A.equal(g.s.flags.complete,true);A.equal(g.s.major,9);A.equal(g.s.unlocked,12);
 const persisted=new G(g.state(),seed,role);A.equal(persisted.s.ascended,true);
 if(role==='sword'){fs.writeFileSync(path.join(__dirname,'../evidence/V12_飞升完成实测档.json'),JSON.stringify(g.state(),null,2));}
 return {role,seed,actions,days:g.day,defeats:g.s.stats.defeats,stages:result,finalLife:g.lifeYears};
}
const results=[];
for(const role of ['sword','herb']){const r=flythrough(261014,role);results.push(r);console.log('FLYTHROUGH',role,'SUCCESS',r.actions,'actions',r.days,'days',r.finalLife.toFixed(1),'years');}
fs.mkdirSync(path.join(__dirname,'../evidence'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../evidence/V12_飞升推进记录.json'),JSON.stringify({results},null,2));
console.log(`V12 ASCENSION TESTS ${tests}/${tests} PASS; 2/2 roles reached ascension`);
