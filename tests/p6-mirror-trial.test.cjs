'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'../releases/山野修仙记_V85_化神云海镜阵辨真传完整版.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'script-'+i}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;for(let i=0;i<5;i++)vm.runInContext(scripts[i],ctx,{timeout:5000});
const {QGame:G,QData:D}=ctx;let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name);}
function fixture(race){const seed=231124,s=G.fresh(seed,race);s.cleared=Array.from({length:12},(_,i)=>i<7);s.ritual=s.cleared.slice();s.major=3;s.unlocked=8;s.zone=7;s.pos={x:3,y:3};s.last={x:3,y:3};s.maxHp=s.hp=600;s.maxSpirit=s.spirit=230;s.hunger=95;s.water=95;s.life.left=999999;return new G(s,seed,race);}
check('all ten embedded scripts compile',()=>assert.equal(scripts.length,10));
check('site at existing eighth realm',()=>assert.equal(D.SITES['7:3,3'].id,'cloud-mirror'));
for(const race of ['human','demon']){
 const g=fixture(race),name=race+' ';
 check(name+'entry',()=>assert.equal(g.mirrorReason(),''));
 check(name+'begin',()=>assert.notEqual(g.mirrorBegin().ok,false));
 check(name+'requires two independent clues',()=>assert.equal(g.mirrorChoose(D.MIRROR_SCROLLS[0].id).ok,false));
 check(name+'inspect seal',()=>assert.notEqual(g.mirrorInspect('seal').ok,false));
 check(name+'inspect echo',()=>assert.notEqual(g.mirrorInspect('echo').ok,false));
 check(name+'does not bill duplicate evidence',()=>{const min=g.s.minutes;assert.equal(g.mirrorInspect('echo').ok,false);assert.equal(g.s.minutes,min)});
 const truth=g.mirrorTruth(),fake=D.MIRROR_SCROLLS.find(q=>q.id!==truth).id;
 check(name+'both forgeries can be deduced',()=>{const descriptions=['seal','echo'].map(k=>g.mirrorProof(k));assert(descriptions.every(t=>!t.includes(D.MIRROR_SCROLLS.find(q=>q.id===truth).name)));assert.notEqual(descriptions[0],descriptions[1])});
 const hp=g.s.hp;
 check(name+'false choice damages life',()=>{assert.notEqual(g.mirrorChoose(fake).ok,false);assert(g.s.hp<hp)});
 check(name+'same-day cooldown',()=>assert.equal(g.mirrorChoose(truth).ok,false));
 const loaded=new G(g.state(),231124,race);
 check(name+'restores clues and exclusion',()=>{assert.equal(loaded.mirrorTrial.clues.length,2);assert(loaded.mirrorTrial.rejected.includes(fake))});
 loaded.s.minutes=loaded.mirrorTrial.lockedUntil*1440+60;
 check(name+'correct identification',()=>{assert.notEqual(loaded.mirrorChoose(truth).ok,false);assert.equal(loaded.mirrorTrial.complete,true)});
 check(name+'reward once',()=>{const n=loaded.s.inv.godFruit||0;assert.equal(loaded.mirrorChoose(truth).ok,false);assert.equal(loaded.s.inv.godFruit||0,n)});
 check(name+'legacy saves',()=>{const old=fixture(race).state();delete old.flags.mirrorTrial;assert.equal(new G(old,231124,race).mirrorTrial.started,false)});
 check(name+'off-map access denied',()=>{const other=fixture(race);other.s.zone=8;assert.equal(other.mirrorBegin().ok,false)});
}
console.log('PASS P6',passed,'test groups');
