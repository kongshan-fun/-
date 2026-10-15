/* Real fresh state, only Game.act mutates the player. A map-aware planner, not a
   human balance claim. Five bases are built, production is centralized in Qinglan. */
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../src/engine.js'),D=require('../src/data.js'),OUT=path.join(__dirname,'../evidence');
// CI checkouts do not contain generated evidence or optional save fixtures.
fs.mkdirSync(OUT,{recursive:true});
fs.mkdirSync(path.join(__dirname,'fixtures'),{recursive:true});
function campaign(seed,write=false,character='sword',includeState=false){
 const g=new G(null,seed,character),trace=[],stages=[];let n=0,depth=0;const buildingGoals={};
 function act(a,b={}){if(++n>14000)throw Error('14000 action limit');const r=g.act(a,b);trace.push({n,zone:g.s.zone,pos:{...g.s.pos},day:g.day,a,b,ok:r.ok,msg:r.msg});return r;}
 const total=k=>(g.s.inv[k]||0)+(g.s.settlements[0]?.stash[k]||0);
 function fight(){for(let i=0;g.s.combat&&i<160;i++){
  const b=g.s.combat;let mode=b.intent==='heavy'?'guard':g.s.spirit>=18?'spell':'attack';
  if(g.s.hp<g.s.maxHp*.45&&g.s.inv.salve&&b.intent!=='heavy')mode='heal';act('fight',{mode});
 }if(g.s.combat)throw Error('battle loop');if(g.s.stats.defeats>8)throw Error('excess defeats');}
 function eat(){if(g.s.combat)return;for(let i=0;i<3&&g.s.hunger<45;i++){const id=['berry','pill','meal','fish'].find(k=>g.s.inv[k]>0);if(!id)break;act('consume',{id});}for(let i=0;i<3&&g.s.water<45&&g.s.inv.water;i++)act('consume',{id:'water'});}
 function simpleWalk(x,y){for(let i=0;i<80&&(g.s.pos.x!==x||g.s.pos.y!==y);i++){
  if(g.s.combat)fight();eat();if(g.s.spirit<18)act('rest',{mode:g.atCamp?'camp':'field'});
  const p=g.path(x,y)[0];if(!p)throw Error('no simple path');act('move',p);
 }if(g.s.combat)fight();}
 function home(){if(g.s.combat)fight();if(!g.s.settlements[0])return;
  if(g.s.zone!==0)act('travel',{zone:0});else if(!g.atCamp)simpleWalk(g.camp.pos.x,g.camp.pos.y);
 }
 function service(){if(!g.s.settlements[0]){eat();if(g.s.spirit<24)act('rest',{mode:'field'});return;}
  home();if(g.storageReady)act('store');
  if(g.storageReady)for(const [id,cap]of Object.entries({berry:4,water:5,salve:6,pill:2,fish:2,mana:2})){if((g.s.inv[id]||0)>cap)act('store',{id});if((g.s.inv[id]||0)<cap&&g.camp.stash[id])act('withdraw',{id,qty:cap-(g.s.inv[id]||0)});}
  for(let i=0;i<12&&(g.s.hp<g.s.maxHp||g.s.spirit<g.s.maxSpirit*.9||g.s.hunger<70||g.s.water<70);i++){
   if(g.s.hp>=g.s.maxHp&&g.s.spirit>=g.s.maxSpirit*.9&&g.has('stone')>20)act('rest',{mode:'supply'});else act('rest',{mode:'camp'});
  }
 }
 function care(){if(g.s.combat)fight();eat();if(g.s.hp<g.s.maxHp*.4&&g.s.inv.salve)act('consume',{id:'salve'});
  if(g.s.settlements[0]&&(g.s.hp<g.s.maxHp*.5||g.s.hunger<12||g.s.water<12))service();
  if(g.s.spirit<24){act('rest',{mode:g.atCamp?'camp':'field'});eat();}
 }
 function go(x,y,z=g.s.zone){for(let i=0;i<110;i++){care();if(g.s.zone!==z)act('travel',{zone:z});if(g.s.pos.x===x&&g.s.pos.y===y)return;const p=g.path(x,y)[0];if(!p)throw Error('no path '+z+':'+x+','+y);act('move',p);if(g.s.combat)fight();}throw Error('go loop '+z+':'+x+','+y);}
 function options(id){const rows=[];for(let z=0;z<g.s.unlocked;z++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const l=D.ZONES[z].map[y][x];if(['boss','gate'].includes(l))continue;const list=D.RESOURCE_LAYOUT[l]||[];
  for(let i=0;i<10;i++){const k=list[i],r=D.RES[k];if(!r||!r.loot[id]||(r.tool&&!g.s.inv[r.tool])||r.level>g.s.level)continue;
   const h=g.s.nodeHarvest[`${z}:${x},${y}#${i}`];if(h?.day===g.day&&h.used>=r.max)continue;
   rows.push({z,x,y,i,dist:(z===g.s.zone?0:35)+Math.max(Math.abs(g.s.pos.x-x),Math.abs(g.s.pos.y-y))-(k==='wood'?0.3:0)});
  }
 }return rows.sort((a,b)=>a.dist-b.dist);}
 function gather(id){for(let i=0;i<80;i++){
  care();if(g.weight>g.capacity-5&&g.s.settlements[0])service();
  const o=options(id);if(!o.length){service();if(g.atCamp&&g.has('stone'))act('rest',{mode:'dawn'});else for(let t=0;t<8;t++)act('rest',{mode:g.atCamp?'camp':'field'});continue;}
  const t=o[0];go(t.x,t.y,t.z);if(g.s.zone!==t.z||g.s.pos.x!==t.x||g.s.pos.y!==t.y)continue;
  if(/灵力/.test(g.requirement(g.resource(t.i)))){act('rest',{mode:'field'});eat();continue;}
  const r=act('gather',{index:t.i});if(r.ok)return;
  if(/负重/.test(r.msg||'')){service();for(const k of ['hide','ore','fiber','wood','stone'])if((g.s.inv[k]||0)>12)for(let d=0;d<4;d++)act('discard',{id:k});}
 }throw Error('cannot gather '+id+' '+JSON.stringify({inv:g.s.inv,stash:g.s.settlements[0]?.stash}));}
 function ensure(id,need){if(++depth>2500)throw Error('ensure count');
  const level={rune:2,cinder:4,soul:5,thunder:6,ancient:6,venom:5}[id]||1;
  while(g.s.level<level){service();ensure('stone',2);home();const r=act('meditate');if(!r.ok)act('rest',{mode:'dawn'});}
  if(id==='hide'){for(let i=0;total(id)<need&&i<20;i++){go(3,5,0);if(g.siteReady()){service();if(g.has('stone'))act('rest',{mode:'dawn'});continue;}act('event',{choice:1});fight();}return;}
  for(let i=0;total(id)<need&&i<150;i++)gather(id);A.ok(total(id)>=need,'missing '+id);
 }
 function ensureCost(cost){for(const [id,q]of Object.entries(cost))ensure(id,q);}
 function build(id,target=1){home();while(g.roomLevel(id)<target){
  const next=D.BUILDINGS[id].levels[g.roomLevel(id)];if(next.home&&g.camp.level<next.home)build('residence',next.home);
  ensureCost(next.cost);service();const r=act('build',{id});A.equal(r.ok,true,`${id}: ${r.msg}`);
 }}
 function make(id){const r=g.recipe(id);if(r.unique&&total(r.item)){if(!g.s.inv[r.item]){home();act('withdraw',{id:r.item});}return;}
  if(r.room)build(r.room,r.tier);ensureCost(r.cost);service();const res=act('craft',{id});A.equal(res.ok,true,id+': '+res.msg);
 }
 function stock(){service();ensure('water',5);ensure('berry',4);service();if(g.storageReady)for(const id of ['water','berry','salve'])if((g.s.inv[id]||0)<3&&g.camp.stash[id])act('withdraw',{id,qty:3-(g.s.inv[id]||0)});}
 function buildRemote(z){if(g.s.settlements[z])return;home();ensureCost(D.SETTLE_COST);service();for(const [id,q]of Object.entries(D.SETTLE_COST))if((g.s.inv[id]||0)<q)act('withdraw',{id,qty:q-(g.s.inv[id]||0)});
  act('travel',{zone:z});const r=act('settle');A.equal(r.ok,true,'remote settle '+z+' '+r.msg);
 }
 try{
  act('guide',{mode:'skip'});make('axe');ensureCost(D.SETTLE_COST);go(1,5,0);A.equal(act('settle').ok,true);
  build('warehouse');build('forge');make('woodSword');make('robe');make('pick');build('warehouse',2);build('alchemy');build('quiet');build('farm');make('pill');make('focus');act('consume',{id:'focus'});
  make('ironSword');make('hideRobe');build('warehouse',3);
  for(let z=0;z<5;z++){
   if(z)buildRemote(z);
   if(z){make(['','springSword','emberSword','yinSword','skySword'][z]);make(['','springRobe','emberRobe','yinRobe','skyRobe'][z]);}
   if(z===1){make('rod');build('alchemy',2);}if(z===4)build('alchemy',3);
   ensureCost(D.ZONES[z].need);stock();service();
   if(z){for(const [id,q]of Object.entries(D.ZONES[z].need))if((g.s.inv[id]||0)<q)act('withdraw',{id,qty:q-(g.s.inv[id]||0)});go(4,4,z);}
   const r=act('repair');A.equal(r.ok,true,'ritual '+z+': '+r.msg);
   for(let i=0;total('salve')<4&&i<4;i++)make('salve');stock();service();if(z)act('travel',{zone:z});
   if(write)fs.writeFileSync(path.join(__dirname,`fixtures/v9_natural_zone_${z+1}.json`),JSON.stringify(g.state(),null,2));
   for(let i=0;!g.s.cleared[z]&&i<4;i++){go(7,2,z);if(g.s.combat)fight();if(!g.s.cleared[z]){stock();service();}}
   A.equal(g.s.cleared[z],true,'boss '+z);stages.push({zone:D.ZONES[z].name,actions:n,day:g.day,level:g.s.level,defeats:g.s.stats.defeats});
   for(const b of D.BOOK_REWARDS)if(!g.s.codex.claims[b.id]&&g.bookCount>=b.need)act('claim-book',{id:b.id});
  }
  A.ok(g.s.cleared.slice(0,5).every(Boolean));A.ok(g.s.unlocked>=6);home();if(g.farmRemaining()===0)act('farm');
  if(write){fs.mkdirSync(path.join(__dirname,'fixtures'),{recursive:true});fs.writeFileSync(path.join(__dirname,'fixtures/v9_natural_complete.json'),JSON.stringify(g.state(),null,2));fs.writeFileSync(path.join(OUT,'V9自然通关动作.json'),JSON.stringify({seed,trace}));}
  return {pass:true,seed,character,actions:n,days:g.day,level:g.s.level,defeats:g.s.stats.defeats,bases:g.s.settlements.filter(Boolean).length,primary:g.s.settlements[0].buildings,stages,...(includeState?{state:g.state()}: {})};
 }catch(e){fs.writeFileSync(path.join(OUT,'campaign_debug.json'),JSON.stringify({seed,error:e.stack,stages,state:g.state(),trace:trace.slice(-120)},null,2));throw e;}
}
if(require.main===module){
const seeds=process.argv.includes('--all')?[261014,42,12345]:[261014],results=[];
const roles=process.argv.includes('--both-roles')?['sword','herb']:['sword'];
for(const character of roles)for(const seed of seeds){try{const r=campaign(seed,character==='sword'&&seed===seeds[0],character);results.push(r);console.log('CAMPAIGN',character,seed,r.pass,r.actions,r.days,r.level,r.defeats);}catch(e){results.push({pass:false,seed,character,error:e.stack});console.error(e.stack);break;}}
fs.writeFileSync(path.join(OUT,'V11从零五境双角色验收.json'),JSON.stringify({description:'两角色只通过Game.act、正常初始资源、预先知晓地图的规划器；非一般新手时长或全路线平衡保证。',total:seeds.length*roles.length,passed:results.filter(r=>r.pass).length,results},null,2));if(results.some(r=>!r.pass))process.exitCode=1;

}
module.exports={campaign};
