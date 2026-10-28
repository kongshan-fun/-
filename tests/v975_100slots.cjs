'use strict';
// Current-entry, accelerated milestones. Materials/health/attack are synthetic;
// navigation, single home, all twelve map rituals, upgrades, battles, breakthroughs,
// ascension, serialization and rankings execute the real product methods.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ss=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]),c=vm.createContext({console});c.globalThis=c;for(let i=0;i<6;i++)vm.runInContext(ss[i],c);
const {QGame:G,QData:D,QCharacterSlots:Slots}=c,map=new Map(),disk={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)},slots=new Slots(disk);
let assertions=0,builds=0,bosses=0,rituals=0,breakthroughs=0,moves=0,saveLoads=0;const cases=[];
function eq(a,b,l){assert.equal(a,b,l);assertions++}function ok(v,l){assert.ok(v,l);assertions++}
for(let n=0;n<100;n++){
 const race=n%2?'demon':'human',slot=Math.floor(n/2)+1;let g=slots.newGame(race,26500000+n*7919,slot);
 const stock=cost=>{for(const[id,q]of Object.entries(cost))g.s.inv[id]=Math.max(g.s.inv[id]||0,q+5)};
 const feed=()=>{g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;g.s.hunger=g.s.water=100;g.s.life.left=5000*D.LIFE.yearMinutes;};
 const act=(a,args={})=>{const r=g.act(a,args);ok(r.ok,race+' '+slot+' '+a+': '+r.msg);return r;};
 const save=label=>{const state=g.state();ok(slots.save(race,g,slot),label);g=slots.read(race,slot).game;eq(g.s.level,state.level,label+' level');eq(g.s.zone,state.zone,label+' zone');eq(g.s.cleared.join(),state.cleared.join(),label+' cleared');eq(g.camp.level,state.homestead.level,label+' home');eq(g.s.settlements.filter(Boolean).length,0,label+' unique');saveLoads++;};
 const fight=()=>{if(!g.s.combat)return;const attack=g.s.attack;g.s.attack=10000000;for(let k=0;g.s.combat&&k<20;k++)act('fight',{mode:'attack'});ok(!g.s.combat,'battle resolves');g.s.attack=attack;feed();};
 const walk=(x,y)=>{g.leaveHome();const steps=g.path(x,y);ok(steps.length||g.s.pos.x===x&&g.s.pos.y===y,'reachable world tile');for(const p of steps){act('move',p);moves++;fight();}eq(g.s.pos.x,x);eq(g.s.pos.y,y);};
 g.s.guide.status='skipped';feed();stock(D.SETTLE_COST);act('home-enter');act('settle');g.xp(10000000);
 for(let z=0;z<12;z++){
  const t=z+1;feed();if(z)act('travel',{zone:z});eq(g.s.zone,z,'travel');eq(g.realmIndex,t,'realm matches map');act('home-enter');
  if(t>1){stock(D.BUILDINGS.residence.levels[t-1].cost);act('build',{id:'residence'});builds++;}
  for(const id of D.HOME_ROOMS.filter(id=>id!=='residence')){feed();stock(D.BUILDINGS[id].levels[t-1].cost);act('build',{id});builds++;eq(g.roomLevel(id),t,id+' tier');}
  for(const type of ['weapon','armor']){const r=D.RECIPES.find(r=>r.gear===type&&r.mapTier===t&&!r.secret);stock(r.cost);feed();act('craft',{id:r.id});}
  stock(D.ZONES[z].need);feed();
  if(z===0)act('repair');else{walk(4,4);stock(D.ZONES[z].need);feed();act('repair');}
  eq(g.s.ritual[z],true,'ritual');rituals++;save('ritual'+z);walk(7,2);if(!g.s.cleared[z]){if(!g.s.combat)act('hunt');fight();}eq(g.s.cleared[z],true,'boss');bosses++;save('boss'+z);
  if(z<11){act('home-enter');feed();act('breakthrough');breakthroughs++;g.xp(1);eq(g.realmIndex,t+1,'breakthrough new realm');save('growth'+z);}
 }
 feed();stock(D.ASCENSION_RULE.cost);walk(7,5);act('ascend');ok(g.s.ascended,'ascended');save('ascension');slots.recordAscension(race,slot,g);eq(g.camp.level,12,'home12');eq(g.s.stats.settled,1,'only one initial construction');
 cases.push({race,slot,cleared:g.s.cleared.filter(Boolean).length,level:g.s.level,home:g.camp.level,ascended:g.s.ascended});
}
eq(cases.length,100);eq(slots.leaderboard().records.length,100,'all current-version scores recorded');
const report={version:'V90.75',source:'index.html',status:'PASS',assertions,slots:100,races:{human:50,demon:50},builds,bosses,rituals,breakthroughs,moves,saveLoads,assumptions:['Granted cultivation and materials; health replenished; attack temporarily boosted in battles.','Milestone correctness test, NOT natural-play balance or economy certification.'],cases};
fs.mkdirSync(path.join(ROOT,'artifacts/v975'),{recursive:true});fs.writeFileSync(path.join(ROOT,'artifacts/v975/100slots.json'),JSON.stringify(report,null,2));console.log('V90.75 CURRENT 100 SLOTS PASS',JSON.stringify({...report,cases:undefined}));
