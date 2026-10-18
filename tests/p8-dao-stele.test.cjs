'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../releases/山野修仙记_V87_大乘古道三途问道完整版.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'v87-'+i+'.js'}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<5;i++)vm.runInContext(scripts[i],ctx,{timeout:5000});
const G=ctx.QGame,D=ctx.QData;
let count=0;const test=(label,fn)=>{fn();count++;};
function fixture(race,stele,mirror=true,karma=1){
 const s=G.fresh(15437,race);
 s.cleared=Array.from({length:12},(_,i)=>i<10);
 s.ritual=s.cleared.slice();s.zone=10;s.unlocked=11;s.major=6;s.pos={x:3,y:3};s.last={x:3,y:3};
 s.spirit=s.maxSpirit=300;s.hp=s.maxHp=650;s.hunger=s.water=100;s.life.left=3000000;
 s.flags.steleChoice=stele;s.flags.mirrorTrial.complete=mirror;
 s.flags.karmaWitness={stage:2,choice:1};s.flags.karmaReckoning={ending:karma,origin:stele,source:1};
 s.inv.ancient=5;s.inv.mahayaJade=5;s.inv.herb=5;
 return new G(s,15437,race);
}
test('original twelve maps and eighth story site',()=>{assert.equal(D.ZONES.length,12);assert.equal(D.SITES['10:3,3'].id,'dao-three-paths');});
for(const race of ['human','demon'])for(const path of ['preserve','discern','compassion'])for(const stele of [0,1,2]){
 const label=[race,path,stele].join('/');
 const g=fixture(race,stele);test(label+' point',()=>assert.equal(g.daoReason(),''));
 test(label+' read',()=>{assert.notEqual(g.daoRead().ok,false);assert.equal(g.daoStele.phase,1);});
 test(label+' vow',()=>{assert.notEqual(g.daoChoose(path).ok,false);assert.equal(g.daoStele.path,path);});
 const initial=JSON.stringify(g.daoStele.roots),preview=g.daoPreview(path);
 test(label+' real prices',()=>assert(preview.spirit>0&&preview.minutes>0));
 test(label+' no switching vow',()=>assert.equal(g.daoChoose('discern').ok,false));
 const restored=new G(g.state(),15437,race);
 test(label+' save restore',()=>assert.equal(restored.daoStele.phase,2));
 restored.s.flags.steleChoice=(stele+1)%3;
 test(label+' ancestry frozen',()=>assert.equal(JSON.stringify(restored.daoStele.roots),initial));
 const hp=restored.s.hp,spent=Object.fromEntries(Object.keys(preview.cost).map(id=>[id,restored.s.inv[id]||0]));
 test(label+' complete once',()=>{assert.notEqual(restored.daoFulfill().ok,false);assert.equal(restored.daoStele.complete,true);});
 test(label+' damage matches forecast',()=>assert.equal(restored.s.hp,hp-preview.damage));
 test(label+' charge exactly',()=>{for(const [id,n] of Object.entries(preview.cost))assert.equal(restored.s.inv[id]||0,spent[id]-n);});
 test(label+' reject extra awards',()=>assert.equal(restored.daoFulfill().ok,false));
}
test('older v14 save without P8 flag',()=>{const old=fixture('human',0).state();delete old.flags.daoStele;assert.equal(new G(old,15437,'human').daoStele.phase,0);});
test('no access from neighboring tile',()=>{const x=fixture('demon',0),before=x.s.minutes;x.s.pos.x=2;assert.equal(x.daoRead().ok,false);assert.equal(x.s.minutes,before);});
test('all prior progression flags remain present',()=>{const s=G.fresh(9,'human');for(const key of ['coreTribulation','heartTrial','voidRift','mirrorTrial','karmaWitness','karmaReckoning'])assert(s.flags[key]);});
test('no early completion without choosing vow',()=>{const x=fixture('human',2);x.daoRead();assert.equal(x.daoFulfill().ok,false);});
test('resource failure cannot advance stage',()=>{const x=fixture('human',0);x.daoRead();x.daoChoose('preserve');delete x.s.inv.ancient;const min=x.s.minutes;assert.equal(x.daoFulfill().ok,false);assert.equal(x.s.minutes,min);assert.equal(x.daoStele.phase,2);});
console.log('P8 V87 PASS',count,'test groups; 10/10 original scripts compile.');
