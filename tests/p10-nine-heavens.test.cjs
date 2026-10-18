'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../releases/山野修仙记_V89_九霄终劫与凡界终章完整版.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'v89-'+i+'.js'}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<5;i++)vm.runInContext(scripts[i],ctx,{timeout:5000});
const G=ctx.QGame;let count=0;function check(label,condition){assert(condition,label);count++;}
function game(role){
 const s=G.fresh(457777,role);s.zone=11;s.unlocked=12;s.major=8;s.pos={x:7,y:5};s.last={x:7,y:5};
 s.cleared=Array(12).fill(true);s.ritual=Array(12).fill(true);
 s.daoXp=200;s.inv.tribulationCrystal=10;s.inv.ascendToken=10;
 s.maxHp=s.hp=2400;s.maxSpirit=s.spirit=900;s.hunger=s.water=100;s.life.left=7000000;
 return new G(s,457777,role);
}
for(const race of ['human','demon'])for(const a of ['ward','channel','endure'])for(const b of ['ward','channel','endure'])for(const d of ['ward','channel','endure']){
 const g=game(race),key=[race,a,b,d].join('/');
 check(key+' start',g.heavenStart().ok!==false&&g.heavenTrial.phase===1);
 const p=g.heavenPreview(a),hp=g.s.hp;
 check(key+' damage',g.heavenAct(a).ok!==false&&g.s.hp===hp-p.damage);
 const r=new G(g.state(),457777,race);
 check(key+' resume',r.heavenTrial.phase===2);
 check(key+' second',r.heavenAct(b).ok!==false&&r.heavenTrial.phase===3);
 check(key+' final',r.heavenAct(d).ok!==false&&r.heavenTrial.complete);
 check(key+' no repeat',r.heavenAct(d).ok===false);
 const crystal=r.s.inv.tribulationCrystal,token=r.s.inv.ascendToken;
 check(key+' ascension',r.ascend().ok!==false&&r.s.ascended);
 check(key+' materials once',r.s.inv.tribulationCrystal===crystal-3&&r.s.inv.ascendToken===token-2);
 check(key+' saved ascension',new G(r.state(),457777,race).s.ascended);
}
for(const race of ['human','demon']){
 let g=game(race);check(race+' direct ascend',g.ascend().ok!==false);
 const raw=game(race).state();delete raw.flags.heavenTrial;
 check(race+' old V14',new G(raw,457777,race).heavenTrial.phase===0);
 g=game(race);g.heavenStart();g.s.hp=1;const losses=g.s.life.losses;g.heavenAct('endure');
 check(race+' collapse preserves previous stages',g.s.life.losses===losses+1&&g.heavenTrial.phase===1);
}
console.log('P10 V89 PASS',count,'assertions, 10/10 inline JS syntax.');
