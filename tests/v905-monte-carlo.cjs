'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=process.argv[2]||path.join(__dirname,'releases/山野修仙记_V90.5_战斗平衡与顶部状态栏优化版.html');
const html=fs.readFileSync(src,'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<=5;i++)vm.runInContext(scripts[i],ctx,{timeout:20000});
const D=ctx.QData,G=ctx.QGame;
const profiles={low:[1,0],mid:[2,2],high:[4,3]};
const lvl=[4,9,12,15,18,18,18,18,18,18,18,18];
const recipes=[['woodSword','robe'],['springSword','springRobe'],['emberSword','emberRobe'],['yinSword','yinRobe'],['skySword','skyRobe'],...Array.from({length:7},(_,i)=>['realmSword'+(i+5),'realmRobe'+(i+5)])];
function makeHero(z,race,seed,profile){
 const g=new G(G.fresh(seed,race),seed,race);g.s.zone=z;
 // Shared progression (not a playthrough): raise levels through the ACTUAL XP method.
 while(g.s.level<lvl[z])g.xp(100);
 if(z>=5){
   g.s.major=z-4;
   for(let i=0;i<z-5;i++){
     const t=D.ASCENSION_STAGES[i];g.s.attack+=t.atk;g.s.maxHp+=t.hp;g.s.maxSpirit+=t.spirit;
   }
 }
 const [quality,refine]=profiles[profile], [w,a]=recipes[z];
 for(const gear of [w,a]){
   const item=g.createGear(gear,0,'test');item.quality=quality;item.refine=refine;
   g.s.gears.push(item);g.s.equipped[D.RECIPES.find(r=>r.id===gear).gear]=item.id;
 }
 g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;
 g.s.hunger=g.s.water=100;g.s.inv.salve=10;
 // Avoid permanent death changing the sampled risk profile: track only combat outcome.
 return g;
}
function simulation(z,race,seed,profile,style,boss=true){
 let g=makeHero(z,race,seed,profile);
 const t=boss?'boss'+z: (z===0?'wolf':z===1?'river':z===2?'firebeast':z===3?'wraith':z===4?'sentinel':'realm'+z);
 const start={hp:g.s.hp,atk:g.s.attack,armor:g.armor,weapon:g.weapon,spirit:g.s.spirit};
 g.startBattle(t);
 let turns=0,guards=0,potions=0,spells=0;
 for(;g.s.combat&&turns<60;){
   const b=g.s.combat;
   let mode='attack';
   if(style==='tactical'){
    if(g.s.hp<g.s.maxHp*.37&&g.s.inv.salve>0&&g.s.hp>0&&b.intent!=='heavy'&&b.intent!=='skill')mode='heal';
    else if(['heavy','skill'].includes(b.intent))mode='guard';
    else if(b.charge&&b.intent==='heavy')mode='guard';
    else if(b.intent==='trait'&&['counter','mirage'].includes(D.HIGH_TRAITS[b.type]?.id||'')&&g.s.spirit>=g.spellCost+2)mode='spell';
    else if(g.s.spirit>=g.spellCost+2&&b.intent==='recover')mode='spell';
    else if(g.s.spirit>=g.spellCost+2&&b.intent==='attack'&&seed%2===0)mode='spell';
   }
   turns++;if(mode==='guard')guards++;if(mode==='heal')potions++;if(mode==='spell')spells++;
   const r=g.fight(mode);
   if(r?.ok===false&&!g.s.combat)break;
   if(r?.ok===false&&g.s.combat){ console.error('failed',z,r); break;}
 }
 return {win: !g.s.combat&&g.s.stats.kills>0,failed:g.s.stats.defeats>0,turns,hpLoss:start.hp-g.s.hp,start,guards,potions,spells,stuck:!!g.s.combat};
}
const races=['human','demon'];
const results=[];
for(let z=0;z<12;z++){
 for(const profile of ['mid','high']){
  for(const type of ['boss','ordinary']){
   const row={z,zone:D.ZONES[z].short,profile,type};
   for(const style of ['naive','tactical']){
     let wins=0,loss=0,turns=0,maxTurns=0,stuck=0,guards=0,samples=0;
     for(const race of races)for(let trial=0;trial<30;trial++){
       const res=simulation(z,race,190000+trial*881+z*1370,profile,style,type==='boss');
       if(res.win)wins++;if(res.failed)loss++;turns+=res.turns;maxTurns=Math.max(maxTurns,res.turns);stuck+=+res.stuck;guards+=res.guards;samples++;
     }
     row[style]={win: +(wins/samples*100).toFixed(1),lose:+(loss/samples*100).toFixed(1),turns:+(turns/samples).toFixed(1),maxTurns,stuck,avgGuards:+(guards/samples).toFixed(2)};
   }
   results.push(row);
  }
 }
}
if(process.argv.includes('--json'))console.log(JSON.stringify({results,profiles,recipes},null,2));
else for(const r of results.filter(r=>r.type==='boss'))console.log(`${r.z+1} ${r.zone.padEnd(3)} ${r.profile.padEnd(4)} ${'无脑'+String(r.naive.win).padStart(4)+'%/'+String(r.naive.turns).padStart(4)+'回合'}   策略 ${String(r.tactical.win).padStart(4)}%/${String(r.tactical.turns).padStart(4)}回合 ${r.tactical.avgGuards}防`);
