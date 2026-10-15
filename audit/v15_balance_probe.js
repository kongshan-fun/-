'use strict';
const D=require('../src/data.js'),Game=require('../src/engine.js');
const areas=[];
for(let z=0;z<D.ZONES.length;z++){
 const g=new Game();g.s.zone=z;let oldCount=0,newCount=0,enemyCount=0;
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  g.s.pos={x,y};
  for(const k of D.RESOURCE_LAYOUT[g.land()]||[])if(k)oldCount+=D.RES[k].max;
  for(const n of g.sceneNodes()){if(n.kind)newCount+=D.RES[n.kind].max;if(n.enemy)enemyCount++;}
 }
 areas.push({map:D.ZONES[z].name,harvest_old:oldCount,harvest_v15:newCount,ratio:+(newCount/oldCount).toFixed(2),enemy_nodes:enemyCount});
}
const stages=[];
for(let z=5;z<12;z++){
 const stage=D.ASCENSION_STAGES[z-5],mob=D.ENEMIES['realm'+z],need={...D.ZONES[z].need};
 need[stage.primary]=(need[stage.primary]||0)+2;
 need[stage.secondary]=(need[stage.secondary]||0)+1;
 const battles=Math.max(...Object.entries(need).map(([k,v])=>Math.ceil(v/(mob.loot[k]||0.000001))));
 stages.push({map:D.ZONES[z].name,three_battles_cover_materials:battles<=3,three_kills_xp:mob.xp*3,dao_required:stage.needDao});
}
console.log(JSON.stringify({areas,stages},null,2));