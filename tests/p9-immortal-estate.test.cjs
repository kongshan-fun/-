'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../releases/山野修仙记_V88_仙人遗府三段终试完整版.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);scripts.forEach((s,i)=>new vm.Script(s,{filename:'v88-'+i+'.js'}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;for(let i=0;i<5;i++)vm.runInContext(scripts[i],ctx,{timeout:5000});
const G=ctx.QGame,D=ctx.QData;let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}
function fixture(role,seed=25777){
 const s=G.fresh(seed,role);s.zone=11;s.unlocked=12;s.major=7;s.pos={x:3,y:3};s.last={x:3,y:3};
 s.cleared=Array.from({length:12},(_,i)=>i<11);s.ritual=s.cleared.slice();
 s.hp=s.maxHp=1900;s.spirit=s.maxSpirit=700;s.hunger=s.water=100;s.life.left=6000000;
 s.inv.mahayaJade=6;s.inv.rune=6;s.inv.mahayaRune=6;
 return new G(s,seed,role);
}
check('one estate on twelfth map',()=>{assert.equal(D.ZONES.length,12);assert.equal(D.SITES['11:3,3'].id,'immortal-estate')});
for(const race of ['human','demon'])for(const first of ['remember','discern','sever'])
for(const second of ['survey','anchor','force'])for(const third of ['return','record']){
 const k=[race,first,second,third].join('/'),game=fixture(race);
 check(k+' entry',()=>{assert.equal(game.estateReason(),'');assert.notEqual(game.estateBegin().ok,false)});
 const p=game.estatePreview(first),hp=game.s.hp;
 check(k+' first phase and exact preview',()=>{assert.notEqual(game.estateAct(first).ok,false);assert.equal(game.s.hp,hp-p.damage);assert.equal(game.immortalEstate.phase,2)});
 const restored=new G(game.state(),25777,race);
 check(k+' mid-stage save',()=>{assert.equal(restored.immortalEstate.phase,2);assert.equal(restored.immortalEstate.choices[0],first)});
 const q=restored.estatePreview(second),before=restored.s.hp,material=restored.s.inv.mahayaJade||0;
 check(k+' second phase and material',()=>{assert.notEqual(restored.estateAct(second).ok,false);assert.equal(restored.s.hp,before-q.damage);assert.equal(restored.immortalEstate.phase,3);if(second==='anchor')assert.equal(restored.s.inv.mahayaJade||0,material-1)});
 const done=restored.estatePreview(third),oldHP=restored.s.hp;
 check(k+' terminal and health',()=>{assert.notEqual(restored.estateAct(third).ok,false);assert.equal(restored.s.hp,oldHP-done.damage);assert.equal(restored.immortalEstate.complete,true)});
 check(k+' reward cannot duplicate',()=>assert.equal(restored.estateAct(third).ok,false));
 check(k+' completed reload',()=>{const loaded=new G(restored.state(),25777,race);assert.equal(loaded.immortalEstate.complete,true);assert.equal(loaded.immortalEstate.choices.length,3)});
}
check('old V14 save without P9 fields',()=>{const o=fixture('human').state();delete o.flags.immortalEstate;assert.equal(new G(o,25777,'human').immortalEstate.phase,0)});
check('wrong location zero cost',()=>{const g=fixture('demon'),before=g.s.minutes;g.s.pos.x=2;assert.equal(g.estateBegin().ok,false);assert.equal(g.s.minutes,before)});
check('collapse does not falsely mark stage complete',()=>{const g=fixture('human');g.estateBegin();g.s.hp=3;const losses=g.s.life.losses;g.estateAct('sever');assert.equal(g.s.life.losses,losses+1);assert.equal(g.immortalEstate.phase,1)});
check('unchanged existing ascension requirement',()=>{const g=fixture('human');assert.equal(g.s.ascended,false);assert.equal(D.ASCENSION_RULE.dao,150)});
console.log('P9 V88 PASS',passed,'grouped assertions and 10/10 inline syntax checks.');
