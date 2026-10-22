'use strict';
/* V90.57: source-of-truth contract + actual engine mechanics, including the twelfth final ordeal. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const blocks=[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(blocks.length,10);blocks.forEach((s,i)=>new vm.Script(s,{filename:'inline'+i}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;ctx.window=ctx;ctx.self=ctx;
for(let i=0;i<=5;i++)vm.runInContext(blocks[i],ctx,{timeout:15000});
const G=ctx.QGame,D=ctx.QData;
let checks=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++};
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++};
function state(realm=5,role='human'){
 const s=G.fresh(20261022,role);s.zone=realm-1;s.unlocked=12;s.level=realm*3;
 s.life.left=200*D.LIFE.yearMinutes;s.hunger=100;s.water=100;s.spirit=s.maxSpirit;
 s.cleared=Array(12).fill(true);s.ritual=Array(12).fill(true);
 const tile=realm===12?{x:7,y:5}:(()=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){const land=D.ZONES[realm-1].map[y][x],key=(realm-1)+':'+x+','+y;if(D.CAMP_LANDS.includes(land)&&!D.SITES[key]&&!D.EVENTS[key])return {x,y};}throw Error('no camp tile');})();
 s.pos={...tile};s.last={...s.pos};
 if(realm<12)s.settlements[realm-1]={pos:{...s.pos},level:3,buildings:{warehouse:3,forge:3,alchemy:3,quiet:3,farm:3},stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
 for(const item of Object.keys(D.ITEMS))s.inv[item]=0;
 const g=new G(s,20261022,role);g.s.xp=g.required;g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;
 return g;
}
for(const race of ['human','demon']){
 for(let realm=1;realm<=11;realm++){
  const g=state(realm,race),snapshot=JSON.stringify(g.state());
  const forecast=g.tribPreview(false);
  ok(forecast.safe,`${race} realm${realm} full hp is enough to cross`);
  eq(JSON.stringify(g.state()),snapshot,`${race} realm${realm} preview is read-only`);
  const hpBefore=g.s.hp,dmg=forecast.damage;
  const res=g.breakthrough();ok(res&&res.ok!==false,`${race} realm${realm} breakthrough succeeds`);
  eq(g.s.level,realm*3+1,`${race} realm${realm} enters next realm`);
  eq(g.s.hp,forecast.hpAfter,`${race} realm${realm} actual remaining HP equals preview`);
  eq(g.s.maxHp,forecast.maxAfter,`${race} realm${realm} next cap equals preview`);
  eq(Math.round(g.s.hp/g.s.maxHp*100),forecast.percent,`${race} realm${realm} UI percentage equals settlement`);
  eq(g.s.hp,hpBefore-dmg,`${race} realm${realm} actual absolute damage deducted from previous HP`);
 }
}
{
 const g=state(5);g.s.hp=g.tribDamage+11;
 const pre=g.tribPreview();eq(pre.hpAfter,11,'underfilled HP prediction exact');
 ok(pre.safe,'underfilled HP but adequate allows attempt');
 ok(g.breakthrough().ok!==false,'underfilled HP at threshold succeeds');
 eq(g.s.hp,11,'underfilled actual HP equals preview');
}
{
 const g=state(5);g.s.hp=g.tribDamage;
 const before=g.state(),pre=g.tribPreview();ok(!pre.safe,'zero residual fails safe check');
 ok(g.breakthrough().ok===false,'zero residual is blocked explicitly');
 eq(g.s.level,15,'insufficient HP did not upgrade');
 eq(g.s.inv.guardPill,before.inv.guardPill,'failed attempt does not charge guard pills');
}
{
 const g=state(5);g.s.hunger=0;g.s.water=0;g.s.hp=g.s.maxHp;
 const p=g.tribPreview();ok(p.survivalDamage>0,'starvation during long ritual accounted for');
 if(p.safe){ok(g.breakthrough().ok!==false,'starvation with sufficient HP completes');eq(g.s.hp,p.hpAfter,'starvation extra damage matches actual');}
}
for(const race of ['human','demon']){
 for(const pills of [0,1,2,9]){
  const g=state(12,race);g.s.inv.guardPill=pills;g.s.inv.tribulationCrystal=3;g.s.inv.ascendToken=2;
  const pre=g.tribPreview(true);
  eq(pre.damage,Math.round(24200*(1-Math.min(2,pills)*.15)),`${race} final damage and pill reduction`);
  ok(pre.safe,`${race} final full blood can survive ordeal`);
  const out=g.ascend();ok(out&&out.ok!==false,`${race} final ascend succeeds`);
  ok(g.s.ascended,`${race} final ascent flag`);
  eq(g.s.inv.guardPill,Math.max(0,pills-Math.min(2,pills)),`${race} exact pill consumption once`);
  eq(g.s.inv.tribulationCrystal,0,`${race} final crystals deducted once`);
  eq(g.s.inv.ascendToken,0,`${race} final tokens deducted once`);
  ok(g.s.logs.some(x=>/第十二重飞升终劫.*固定伤害/.test(x.msg||'')),`${race} final log confirms actual damage`);
  eq(g.s.hp,g.s.maxHp,`${race} ascension heals on success as previous game rule`);
 }
}
{
 const g=state(12);g.s.inv.tribulationCrystal=3;g.s.inv.ascendToken=2;g.s.hp=g.tribDamage;
 const pre=g.tribPreview(true),before=g.s.minutes;
 ok(!pre.safe,'final exact damage HP is insufficient for surviving');
 ok(g.ascend().ok===false,'final insufficient HP prevents success');
 ok(!g.s.ascended,'blocked final remains mortal');
 eq(g.s.minutes,before,'blocked final does not consume time');
 eq(g.s.inv.tribulationCrystal,3,'blocked final preserves materials');
}
{
 const g=state(12);g.s.inv.tribulationCrystal=2;g.s.inv.ascendToken=2;
 ok(g.ascend().ok===false,'final missing crystals rejects');
 eq(g.s.inv.tribulationCrystal,2,'failed final preserves crystals');
}
{
 const g=state(12);g.s.cleared[7]=false;g.s.inv.tribulationCrystal=3;g.s.inv.ascendToken=2;
 ok(g.ascend().ok===false,'missing one boss rejects as existing final condition');
}
{
 const g=state(8);g.s.xp=500;g.s.daoXp=0;
 ok(g.spendProgress(45),'high-realm spirit work consumes real XP');
 eq(g.s.xp,455,'high-realm XP charged exactly once');
 eq(g.s.daoXp,0,'retired daoXp remains zero');
 ok(!g.spendProgress(500),'insufficient XP is rejected');
 eq(g.s.xp,455,'failed spirit spend is atomic');
}
// UI and helpers must follow the real rules. Keep DOM metadata tests separate.
ok(!/data-name="cultivate-trial"[^>]*>旧版三重/.test(source),'no obsolete trine trial entry');
ok(source.includes('V90.58 · 跨境与旧档补偿闭环'),'new title is present');
ok(source.includes('第十二重飞升终劫'),'final 12th ordeal exists');
console.log('V90.58 TRIBULATION REGRESSION PASS',checks,'checks');
