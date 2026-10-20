'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const baseline=fs.readFileSync(path.join(root,'releases/山野修仙记_V90.2_人物装备界面优化版.html'),'utf8');
const html=fs.readFileSync(path.join(root,'releases/山野修仙记_V90.3_主线引导与地图标识优化版.html'),'utf8');
assert.equal(html,require('../tools/build-v903-quest.cjs').compile(baseline));
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);assert.equal(scripts.length,10);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'inline-'+i}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<=4;i++)vm.runInContext(scripts[i],ctx,{timeout:8000});
const D=ctx.QData,G=ctx.QGame,ui=scripts[7];ctx.D=D;
ctx.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
ctx.relicCourtQuestHTML=()=>'<p>见闻</p>';ctx.realmPlaybookHTML=()=>'<p>攻略</p>';ctx.route=[];
vm.runInContext(ui.slice(ui.indexOf('const questFolds=new Set();'),ui.indexOf('function simulatedLifeAdReady(){')),ctx);
vm.runInContext(ui.slice(ui.indexOf('function mapTile(x,y,small=false){'),ui.indexOf('function renderMap(){')),ctx);
let checks=10;const chk=(m,x)=>{assert.ok(x,m);checks++};
const call=code=>vm.runInContext(code,ctx);
for(const race of ['human','demon'])for(let z=0;z<12;z++){
 const g=new G(G.fresh(20261018,race),20261018,race);
 g.s.zone=z;g.s.unlocked=12;g.s.major=z>=5?z-4:0;g.s.pos={x:0,y:5};g.s.ritual=Array(12).fill(false);g.s.cleared=Array(12).fill(false);
 ctx.game=g;const zone=D.ZONES[z];
 chk('8x8 '+race+z,zone.map.length===8&&zone.map.every(r=>r.length===8));
 if(z){
  const point=call('poi('+z+',"shrine")'),main=call('objective()'),tile=call('mapTile(4,4,false)');
  chk('shrine tile '+race+z,point.x===4&&point.y===4&&zone.map[4][4]==='shrine');
  chk('authoritative name '+race+z,point.name===zone.altar&&D.NAMED[point.key][0]===zone.altar);
  chk('icon '+race+z,tile.includes('>'+point.mark+'</button>')&&tile.includes('q3-target'));
  chk('quest route '+race+z,main.action?.type==='map'&&main.action.x===4&&main.action.y===4);
 }
 g.s.ritual[z]=true;
 const boss=call('poi('+z+',"boss")'),stage=call('objective()');
 chk('boss metadata '+race+z,boss.x===7&&boss.y===2&&stage.title.includes(D.ENEMIES[zone.boss].name));
 chk('boss marker '+race+z,call('mapTile(7,2,false)').includes('>'+zone.bossMark+'</button>'));
 g.s.cleared[z]=true;if(z>=5)g.s.major=z-3;
 const done=call('objective()');
 chk('post-boss '+race+z,z===11?done.title.includes('飞升'):done.title.includes(D.ZONES[z+1].name));
}
chk('quest folding',ui.includes('questFolds.add')&&ui.includes('data-quest="world"'));
chk('fifth gate both paths',ui.includes('>前往丹霞</button>')&&ui.includes('>回青岚</button>'));
chk('main gate label',D.NAMED['4:7,5'][0]==='天阙传境界碑');
chk('critical shrine mark',D.NAMED['1:4,4'][0]==='净泉灵坛');
chk('special locations',Object.keys(D.SITES).length===18);
console.log('V90.3 QUEST MAP PASS',checks,'assertions');
