'use strict';
// Natural-play attempt: every state change is through QGame.act; no XP, item,
// HP, inventory, realm, or combat stat injection. Failures remain in the log.
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'),h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),ss=[...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]),c=vm.createContext({console});c.globalThis=c;c.window=c;for(let i=0;i<6;i++)vm.runInContext(ss[i],c);
const {QGame:G,QData:D,QCharacterSlots:Slots}=c;const simMode=process.argv[2]||'easy',g=new G(null,123456,'human',null,simMode);let actions=0,errors=[],events=[],fights=0,deaths=0,maxActions=Number(process.env.SIM_ACTION_LIMIT||22000),noProgress=0;
const modeledAds=process.env.SIM_MODELED_ADS==='1';let modeledAdViews=0;
const disk=new Map(),storage={getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,String(v)),removeItem:k=>disk.delete(k)},slots=new Slots(storage,simMode);const record=(event,info='')=>{events.push({event,info,actions,day:g.day,level:g.s.level,zone:g.s.zone,life:+g.lifeYears.toFixed(2),hp:g.s.hp,food:g.s.hunger,water:g.s.water});if(events.length>250)events.shift();};
const biguOn=process.env.SIM_BIGU==='1';
function act(name,args={}){if(biguOn&&g.realmIndex>=7&&!g.s.bigu.enabled&&!g.s.combat&&!g.s.ended){const on=g.act('bigu-toggle',{enabled:true});if(on.ok)actions++;}
if(modeledAds&&!g.s.ended&&!g.s.combat&&g.lifeYears<32){
  // UI rewards +10 years per completed rewarded video. This is an explicit
  // **modeled ad callback**, not an engine action or verified SDK playback.
  g.s.life.left+=10*D.LIFE.yearMinutes;modeledAdViews++;record('MODELED_AD_VIDEO_COMPLETE_10Y');
 }
 if(actions++>=maxActions)throw Error('ACTION_LIMIT '+maxActions);const r=g.act(name,args);if(g.s.ended)throw Error('PLAYER_DEAD after '+name+' : '+r.msg);return r;}
const total=id=>(g.s.inv[id]||0)+(g.camp?.stash?.[id]||0);
function runBattle(forceKill=false){if(!g.s.combat)return;fights++;for(let n=0;n<110&&g.s.combat;n++){
 const b=g.s.combat;const hp=g.s.hp,max=g.s.maxHp,heavy=['heavy','skill'].includes(b.intent),preferred=g.s.quickSlots[0];let mode='spell',item=null;
 if(!forceKill&&!b.type.startsWith('boss')&&!b.training){const run=act('fight',{mode:'escape'});if(!g.s.combat)break;if(!run.ok)continue;}
 if(hp<Math.max(max*.38,b.atk*1.7)&&g.s.inv[preferred]>0){mode='heal';item=preferred;}
 else if(heavy&&hp<Math.max(max*.65,b.atk*2.7)){mode='guard';}
 else if(g.s.spirit<g.spellCost){mode='attack';}
 else if(b.intent==='heavy'&&hp<b.atk*2.8){mode='guard';}
 const r=act('fight',{mode,id:item});if(!r.ok&&g.s.combat){if(mode==='heal'||mode==='spell')act('fight',{mode:'guard'});else if(mode==='guard')act('fight',{mode:'attack'});}
 }
 if(g.s.combat)throw Error('BATTLE_STALLED '+g.s.combat.type);
}
function walk(x,y){if(g.s.atHome)act('home-exit');for(let attempt=0;attempt<20;attempt++){
 if(g.s.pos.x===x&&g.s.pos.y===y)return true;
 const route=g.path(x,y);if(!route.length)return false;
 for(const p of route){
  if(!nutritionBusy&&!recoveryBusy){useFoodWater();if(g.s.hp<g.s.maxHp*.70){recoveryBusy=true;try{for(let t=0;t<5&&g.s.hp<g.s.maxHp*.90;t++){const before=g.s.hp;act('home-enter');const rest=act('rest',{mode:'camp'});act('home-exit');if(!rest.ok||g.s.hp<=before)break;}}finally{recoveryBusy=false;}}}
  const r=act('move',p);if(g.s.combat)runBattle();if(g.s.pos.x===x&&g.s.pos.y===y)return true;if(!r.ok)break;}
 }return false;}
function availableResource(id){const positions=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){
 const land=g.zone.map[y][x],layout=D.RESOURCE_LAYOUT[land]||[];
 for(const r of layout)if(D.RES[r]?.loot[id]&&!D.RES[r].tool||D.RES[r]?.loot[id]){
  if(D.RES[r]?.tool&&!g.s.inv[D.RES[r].tool])continue;
  if(D.RES[r]?.level&&g.s.level<D.RES[r].level)continue;
  const distance=Math.max(Math.abs(x-g.s.pos.x),Math.abs(y-g.s.pos.y));positions.push({x,y,kind:r,dist:distance});break;
 }
 }return positions.sort((a,b)=>a.dist-b.dist);}
let nutritionBusy=false,recoveryBusy=false;
function useFoodWater(){
 if(nutritionBusy||g.s.ended||g.s.combat)return;
 nutritionBusy=true;
 try{
  for(const [stat,item,minimum] of [['hunger','berry',58],['water','water',58]]){
   if(g.s[stat]>=minimum)continue;
   if(!g.s.inv[item]){
    if(g.camp?.stash?.[item]>0){const wasHome=g.s.atHome;if(!wasHome)act('home-enter');if(g.storageReady)act('withdraw',{id:item,qty:Math.min(3,g.camp.stash[item])});if(!wasHome)act('home-exit');}
    if(!g.s.inv[item])ensureLocal(item,Math.max(6,total(item)),90,true);
   }
   if(g.s.inv[item]>0)act('consume',{id:item});
  }
 }finally{nutritionBusy=false;}
}
function ensureLocal(id,required=1,limit=160,skipNutrition=false){
 let loops=0,stale=0;
 while(total(id)<required&&loops++<limit){
  if(g.s.ended)return false;if(!skipNutrition)useFoodWater();
  if(g.weight>g.capacity*.80&&g.camp){act('home-enter');if(g.storageReady){for(const [mat,q] of Object.entries(g.s.inv))if(q>0&&D.ITEMS[mat]?.type==='material'&&mat!==id)act('store',{id:mat,qty:q});}act('home-exit');}
  let rIndex=-1;for(let i=0;i<24;i++){const kind=g.resource(i);if(D.RES[kind]?.loot[id]&&g.left(i)>0&&!g.requirement(kind)){rIndex=i;break;}}
  if(rIndex>=0){const old=total(id),r=act('gather',{index:rIndex});if(r.ok&&total(id)>old){stale=0;continue;}}
  if(stale++>10&&g.camp){act('home-enter');if(g.roomLevel('warehouse')&&g.s.inv[id])act('store',{id,qty:g.s.inv[id]});let rests=0;while(g.day===events.at(-1)?.day&&rests++<4)act('rest',{mode:'camp'});act('home-exit');stale=0;}
  let opts=availableResource(id);
  if(!opts.length){
   if(farmMobLoot(id,required)){stale=0;continue;}
   const missingTool=Object.values(D.RES).find(r=>r.loot[id]&&r.tool&&!g.s.inv[r.tool])?.tool;
   if(missingTool){
    const recipe=D.RECIPES.find(r=>r.id===missingTool);
    if(!recipe)throw Error('TOOL_RECIPE_ABSENT '+missingTool);
    const diff=stockCost(recipe.cost);if(diff)throw Error('TOOL_STOCK '+diff);
    const result=act('craft',{id:missingTool});if(!result.ok)throw Error('TOOL_CRAFT '+missingTool+' '+result.msg);
    record('crafted-tool-'+missingTool);continue;
   }
   const source=sourceZone(id);if(source!==undefined&&source!==g.s.zone){const origin=g.s.zone;const back=act('travel',{zone:source});if(!back.ok)throw Error('CANNOT_VISIT_SOURCE '+source+' '+back.msg);record('material-trip-'+id+'-from-'+(origin+1)+'-to-'+(source+1));continue;}
   return false;
  }
  const target=opts[loops%Math.min(opts.length,7)];if(!walk(target.x,target.y))return false;
 }
 return total(id)>=required;
}
function farmMobLoot(id,needed){
 const ids=Object.entries(D.ENEMIES).filter(([type,e])=>!type.startsWith('boss')&&e.loot?.[id]).map(([type])=>type);
 if(!ids.length)return false;
 const supportedMap0=new Set(['wolf','sprite','rabbit','guard']);
 if(!ids.some(id=>supportedMap0.has(id)))return false;
 const origin=g.s.zone;
 const zo=0;
 if(g.s.zone!==zo){const tr=act('travel',{zone:zo});if(!tr.ok)return false;}
 const targets=[];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const land=g.zone.map[y][x],mob=land==='forest'?'wolf':land==='mine'||land==='ruins'?'guard':land==='plain'?'rabbit':'sprite';
  if(ids.includes(mob))targets.push({x,y});
 }
 if(!targets.length)return false;
 let tries=0;
 while(total(id)<needed&&tries++<60){
  useFoodWater();
  if(g.s.hp<g.s.maxHp*.55){act('home-enter');const rr=act('rest',{mode:'camp'});if(!rr.ok)return false;act('home-exit');}
  const target=targets[(tries-1)%targets.length];if(!walk(target.x,target.y))continue;
  let mobIndex=-1;for(let j=0;j<24;j++)if(g.sceneNodes()[j]?.enemy&&g.enemyLeft(j)){mobIndex=j;break;}
  if(mobIndex<0){act('home-enter');const rr=act('rest',{mode:'camp'});if(!rr.ok)return false;act('home-exit');continue;}
  const r=act('challenge',{index:mobIndex});if(r.ok){runBattle(true);record('farm-mob-'+id);}
 }
 if(g.s.zone!==origin){const tr=act('travel',{zone:origin});if(!tr.ok)return false;}
 return total(id)>=needed;
}
function sourceZone(id){
 const viable=[];
 for(let z=0;z<g.s.unlocked;z++){
  let found=false;
  for(const row of D.ZONES[z].map)for(const land of row)for(const kind of D.RESOURCE_LAYOUT[land]||[]){
   if(D.RES[kind]?.loot[id]&&(!D.RES[kind].level||g.s.level>=D.RES[kind].level))found=true;
  }
  if(found)viable.push(z);
 }
 return viable.sort((a,b)=>Math.abs(a-g.s.zone)-Math.abs(b-g.s.zone))[0];
}
function prepareTribulation(){
 act('home-enter');
 let tries=0;
 while(g.tribDamage>g.s.maxHp&&tries++<3){
  const r=D.RECIPES.find(q=>q.id==='guardPill');
  while(g.roomLevel('alchemy')<r.tier){
   const c=D.BUILDINGS.alchemy.levels[g.roomLevel('alchemy')].cost;
   const fail=stockCost(c);if(fail)throw Error('GUARD_ALCHEMY_STOCK '+fail);
   act('home-enter');const b=act('build',{id:'alchemy'});if(!b.ok)throw Error('GUARD_ALCHEMY_BUILD '+b.msg);
  }
  const fail=stockCost(r.cost);if(fail)throw Error('GUARD_PILL_MATS '+fail);
  act('home-enter');const x=act('craft',{id:'guardPill'});if(!x.ok)throw Error('GUARD_PILL_CRAFT '+x.msg);
  record('crafted-guard-pill');
 }
 if(g.tribDamage>g.s.maxHp)throw Error('TRIBULATION_DAMAGE_EXCEEDS_MAX_HP '+g.tribDamage+'/'+g.s.maxHp);
 for(let t=0;t<40&&g.s.hp<g.tribDamage;t++){
  useFoodWater();act('home-enter');const rest=act('rest',{mode:'camp'});
  if(!rest.ok)throw Error('REST_HEAL_FOR_BREAK '+rest.msg);
 }
 if(g.s.hp<g.tribDamage)throw Error('TRIBULATION_HP_UNRECOVERABLE '+g.tribDamage+'/'+g.s.hp);
}
function prepareBoss(z){
 if(z<5)return;
 const type='supplyhp'+(z+1),recipe=D.RECIPES.find(r=>r.id===type);
 if(!recipe)throw Error('NO_BOSS_POTION_RECIPE '+type);
 while(g.roomLevel('alchemy')<recipe.tier){
  const cost=D.BUILDINGS.alchemy.levels[g.roomLevel('alchemy')].cost;
  const miss=stockCost(cost);if(miss)throw Error('BOSS_ALCHEMY_STOCK '+miss);
  act('home-enter');const b=act('build',{id:'alchemy'});if(!b.ok)throw Error('BOSS_ALCHEMY_BUILD '+b.msg);
 }
 // A geared player enters high-realm boss fights with prepared, tier-matched
 // healing rather than relying on the obsolete 32-HP beginner salve.
 for(let i=(g.s.inv[type]||0);i<12;i++){
  const miss=stockCost(recipe.cost);if(miss)throw Error('BOSS_MEDICINE_STOCK '+type+' '+miss);
  act('home-enter');const r=act('craft',{id:type});if(!r.ok)throw Error('BOSS_MEDICINE_CRAFT '+r.msg);
 }
 const q=act('quick-config',{slot:0,id:type});if(!q.ok)throw Error('BOSS_QUICK_CONFIG '+q.msg);
 for(let i=0;i<20&&g.s.hp<g.s.maxHp*.90;i++){
  useFoodWater();act('home-enter');const r=act('rest',{mode:'camp'});if(!r.ok)throw Error('BOSS_HEAL '+r.msg);
 }
 record('boss-prep-'+(z+1)+'-potions-'+(g.s.inv[type]||0));
}
function stockCost(cost){
 // Player may lose half their carried resources on a random-encounter defeat
 // while obtaining a different ingredient. Recheck the entire cost atomically.
 const keys=Object.keys(cost).sort((a,b)=>(D.ITEMS[a]?.wt||1)-(D.ITEMS[b]?.wt||1));
 for(let round=0;round<16;round++){
  let pending=keys.filter(id=>total(id)<cost[id]);
  if(!pending.length)return '';
  for(const id of pending){let ready=false;for(let attempt=0;attempt<3&&!ready;attempt++){ready=ensureLocal(id,cost[id],180);if(!ready)record('material-search-retry',id+' '+total(id)+'/'+cost[id]);}if(!ready)return 'cannot obtain '+id+' '+total(id)+'/'+cost[id];}
 }
 return 'inventory attrition ' + keys.map(id=>id+':'+total(id)+'/'+cost[id]).join(',');
}
function runStart(){
 record('creation');act('guide',{mode:'skip'});
 const need=stockCost(D.SETTLE_COST);if(need)throw Error('START_STOCK '+need);
 const e=act('home-enter');if(!e.ok)throw Error(e.msg);const s=act('settle');if(!s.ok)throw Error('HOME_SETUP '+s.msg);record('home-built');
}
function main(){try{
 runStart();
 // Stage 1: source materials, craft a tool, equip an early weapon, upgrade only when earned.
 for(const [id]of [['woodSword'],['robe']]){
  const recipe=D.RECIPES.find(r=>r.id===id);if(!recipe)continue;let r=stockCost(recipe.cost);if(r)throw Error('CRAFT_STOCK '+r);
  if(g.roomLevel('forge')===0){r=stockCost(D.BUILDINGS.forge.levels[0].cost);if(r)throw Error('FORGE_STOCK '+r);act('home-enter');const b=act('build',{id:'forge'});if(!b.ok)throw Error('FORGE '+b.msg);}
  r=stockCost(recipe.cost);if(r)throw Error('POST_FORGE_STOCK '+r);act('home-enter');const b=act('craft',{id});if(!b.ok)throw Error('CRAFT '+id+' '+b.msg);const gear=g.s.gears.findLast(x=>x.recipe===id);if(gear)act('equip',{id:gear.id});record('equipped-'+id);
 }
 if(!g.s.ritual[0]){
  const r=stockCost(D.ZONES[0].need);if(r)throw Error('RITUAL_STOCK '+r);
  act('home-enter');const x=act('repair');if(!x.ok)throw Error('RITUAL_FAILED '+x.msg);record('first-ritual');
 }
 // From now on the bot follows normal world requirements, never grants inventory.
 for(let z=0;z<12;z++){
  if(g.s.zone!==z){const r=act('travel',{zone:z});if(!r.ok)throw Error('TRAVEL '+z+' '+r.msg);}
  record('enter-map-'+(z+1));
  // Natural gear progression: buy the next room tiers and craft the tier's
  // real weapon and armor. All costs come from actual gathered inventory.
  if(z>0){
   for(const id of ['residence','forge']){
    const target=z+1;while(g.roomLevel(id)<target){
     const recipe=D.BUILDINGS[id].levels[g.roomLevel(id)];
     const need=stockCost(recipe.cost);if(need)throw Error('UPGRADE_COST '+id+': '+need);
     act('home-enter');const r=act('build',{id});if(!r.ok)throw Error('HOME_UPGRADE_'+id+' '+r.msg+' [atHome='+g.s.atHome+' inv='+JSON.stringify(g.s.inv)+' stash='+JSON.stringify(g.camp?.stash)+' want='+JSON.stringify(recipe.cost)+']');
     record('upgrade-'+id+'-'+g.roomLevel(id));
    }
   }
   for(const type of ['weapon','armor']){
    const recipe=D.RECIPES.find(r=>r.gear===type&&r.mapTier===z+1&&!r.secret);
    const need=stockCost(recipe.cost);if(need)throw Error('EQUIP_MATERIAL '+recipe.id+': '+need);
    act('home-enter');const r=act('craft',{id:recipe.id});if(!r.ok)throw Error('EQUIP_CRAFT '+recipe.id+' '+r.msg);
    const gear=g.s.gears.findLast(x=>x.recipe===recipe.id);if(!gear)throw Error('NO_GEAR '+recipe.id);
    act('equip',{id:gear.id});record('equipment-'+recipe.id);
   }
  }
  if(!g.s.ritual[z]){
   const need=stockCost(D.ZONES[z].need);if(need)throw Error('RITUAL_STOCK_'+z+': '+need);
   if(z>0&&!walk(4,4))throw Error('SHRINE_UNREACHABLE_'+z);
   let r=act('repair');if(!r.ok&&r.msg&&/缺/.test(r.msg)){const back=stockCost(D.ZONES[z].need);if(back)throw Error('RITUAL_RESTOCK_'+z+': '+back);if(z>0&&!walk(4,4))throw Error('SHRINE_RETURN_'+z);r=act('repair');}if(!r.ok)throw Error('RITUAL_'+z+': '+r.msg);
  }
  if(!g.s.cleared[z]){
   prepareBoss(z);
   if(!walk(7,2))throw Error('BOSS_UNREACHABLE_'+z);
   if(g.s.combat)runBattle();
   if(!g.s.cleared[z]){const r=act('hunt');if(!r.ok)throw Error('HUNT_'+z+': '+r.msg);runBattle();}
   record('boss-cleared-'+(z+1));
  }
  if(z===11)break;
  // Mandatory realm progression: earn XP exclusively via combat, gather, meditation.
  let attempts=0;
  while(g.realmIndex<z+2&&attempts++<2500){
   useFoodWater();
   if(g.stageIndex===3&&g.s.xp>=g.required){
    act('home-enter');prepareTribulation();
    const r=act('breakthrough');if(!r.ok)throw Error('BREAK '+r.msg);record('breakthrough-'+g.realmIndex);continue;
   }
   // Forage additional stone for meditation, then meditate; all outputs use real engine rules.
   if(total('stone')<1){const r=ensureLocal('stone',2,50);if(!r)throw Error('NO_STONE_FOR_MEDITATE');}
   act('home-enter');const r=act('meditate');
   if(!r.ok){
    if(/今日吐纳已满/.test(r.msg)){useFoodWater();act('home-enter');const rest=act('rest',{mode:'camp'});if(!rest.ok)throw Error('REST '+rest.msg+' hp='+g.s.hp+' food='+g.s.hunger+' water='+g.s.water);}
    else if(/灵石/.test(r.msg)){act('home-exit');continue;}
    else throw Error('MEDITATE '+r.msg);
   }
  }
  if(g.realmIndex<z+2)throw Error('XP_STALL zone '+z+' lv '+g.s.level+' xp '+g.s.xp);
 }
 if(g.s.zone===11){if(!walk(7,5))throw Error('FINAL_GATE_UNREACHABLE');const lack=stockCost(D.ASCENSION_RULE.cost);if(lack)throw Error('ASCENSION_MATERIALS '+lack);const r=act('ascend');if(!r.ok)throw Error('ASCEND '+r.msg);record('ASCENDED');}
}catch(e){errors.push(String(e.stack||e));record('STOP',e.message);}finally{
 const report={version:D.RELEASE,biguOn,bigu:g.s.bigu,kind:modeledAds?'ACTUAL ENGINE ACTIONS + EXPLICIT MODELED ADS (not real SDK)':'NO-CHEAT ACTUAL ENGINE ACTIONS',mode:simMode,seed:123456,ascended:g.s.ascended,cleared:g.s.cleared.filter(Boolean).length,level:g.s.level,realm:g.realm,yearsRemaining:g.lifeYears,day:g.day,minutes:g.s.minutes,actions,combatEncounters:fights,modeledAdViews,damageStats:{attack:g.s.attack,weapon:g.weapon,armor:g.armor,crit:g.affix('crit'),lifeLosses:g.s.life.losses},errors,events,defeats:g.s.life.losses,finalInventory:g.s.inv,finalStash:g.camp?.stash,homeLevels:{residence:g.roomLevel('residence'),forge:g.roomLevel('forge'),warehouse:g.roomLevel('warehouse')},atHome:g.s.atHome,homeBuilt:!!g.camp};
 const out=path.join(ROOT,'artifacts/v977','player-'+(modeledAds?'modeled-ads-':'natural-')+simMode+(biguOn?'-bigu-on':'-passive')+'.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log('NATURAL PLAYER',JSON.stringify({...report,events:events.slice(-12),finalInventory:undefined},null,2));
 }}
main();
