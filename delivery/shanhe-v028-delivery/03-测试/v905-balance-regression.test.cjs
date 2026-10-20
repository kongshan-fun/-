'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=(name)=>fs.readFileSync(path.join(root,'releases',name),'utf8');
const oldHTML=read('山野修仙记_V90.4_主线子页面与通关验证版.html');
const newHTML=read('山野修仙记_V90.5_战斗平衡与顶部状态栏优化版.html');
function load(html){
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 assert.equal(scripts.length,10,'must preserve ten scripts');scripts.forEach((s,i)=>new vm.Script(s,{filename:'script'+i}));
 const ctx=vm.createContext({console});ctx.globalThis=ctx;
 for(let i=0;i<=5;i++)vm.runInContext(scripts[i],ctx,{timeout:15000});
 return {D:ctx.QData,G:ctx.QGame,scripts};
}
const original=load(oldHTML),current=load(newHTML);let checks=0;
const check=(why,cond)=>{assert.ok(cond,why);checks++};
for(let i=0;i<12;i++){
 for(const t of ['boss'+i,'secretGuard'+i]){
  const old=original.D.ENEMIES[t],now=current.D.ENEMIES[t];
  check('hp increase '+t,now.hp>old.hp);
  check('attack not reduced '+t,now.atk>=old.atk);
  check('reward identical '+t,JSON.stringify(now.loot)===JSON.stringify(old.loot)&&now.xp===old.xp);
 }
}
check('training stays same',JSON.stringify(current.D.ENEMIES.dummy)===JSON.stringify(original.D.ENEMIES.dummy));
check('twelfth zone remains intact',current.D.ZONES.length===12);
check('fixed zones not player adaptive',current.D.COMBAT_BALANCE.hp.length===12);
check('combat intent remains visible',newHTML.includes('穿甲威胁，请防守'));
check('new HUD has separated power row',newHTML.includes('v905-status-head')&&newHTML.includes('v905-status-sub'));
check('real H5 not duplicated',newHTML.split('</html>').length===2);
function fighter(z=11,seed=100321){
 const Game=current.G;
 const g=new Game(Game.fresh(seed,'human'),seed,'human');g.s.zone=z;g.s.major=7;g.s.level=18;g.s.cleared=Array.from({length:12},(_,i)=>i<z);g.s.ritual=Array(12).fill(true);g.s.unlocked=12;
 g.s.maxHp=1600;g.s.hp=1600;g.s.maxSpirit=300;g.s.spirit=300;g.s.hunger=100;g.s.water=100;
 g.s.attack=250;g.startBattle('boss'+z);g.s.combat.intent='heavy';g.s.combat.hp=1000000;
 g.random=()=>0.5;return g;
}
const atk=fighter(),def=fighter();
check('ordinary hit resolves',atk.fight('attack').ok===true);
check('guard resolves',def.fight('guard').ok===true);
const attackingLoss=1600-atk.s.hp,defendingLoss=1600-def.s.hp;
check('unguarded high-realm heavy visibly dangerous',attackingLoss>1600*.25);
check('guard mitigates significantly',defendingLoss*2<attackingLoss);
check('dynamic counterattack scales with high realm',def.s.combat.riposte>=80);
const restored=current.G.normalize(def.s,'human');
check('guard retained after JSON roundtrip',restored.combat.riposte===def.s.combat.riposte);
check('old-game class names intact',JSON.stringify(current.D.REALMS)===JSON.stringify(original.D.REALMS));
console.log(`V90.5 BALANCE REGRESSION PASS ${checks} assertions; heavy ${attackingLoss} unguarded vs ${defendingLoss} guarded, riposte ${def.s.combat.riposte}`);
