'use strict';
/* V90.59 real engine checks: combat save/load; 4 no-damage upgrades +7 hazards;
   XP overflow across all 36 segments; dual-race independence and unchanged gap. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..'),text=fs.readFileSync(path.join(base,'index.html'),'utf8');
const scripts=[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);for(const s of scripts)new vm.Script(s);
const c=vm.createContext({console});c.globalThis=c;c.window=c;for(let i=0;i<=5;i++)vm.runInContext(scripts[i],c,{timeout:10000});
const Game=c.QGame,D=c.QData,Slots=c.QCharacterSlots;
let checks=0;function eq(a,b,reason){assert.equal(a,b,reason);checks++}function ok(a,reason){assert.ok(a,reason);checks++}
function camp(z){for(let y=0;y<8;y++)for(let x=0;x<8;x++){const land=D.ZONES[z].map[y][x],key=z+':'+x+','+y;if(D.CAMP_LANDS.includes(land)&&!D.SITES[key]&&!D.EVENTS[key])return {x,y}}throw Error('No camp '+z)}
function bound(z,role='human',seed=261022){const s=Game.fresh(seed,role);s.zone=z;s.unlocked=z+1;s.level=(z+1)*3;
 for(let i=0;i<=z;i++){s.cleared[i]=true;s.ritual[i]=true}
 const p=camp(z);s.pos={...p};s.last={...p};s.visited[z+':'+p.x+','+p.y]=true;
 s.settlements[z]={pos:{...p},level:3,buildings:{quiet:3,forge:3,warehouse:3},stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
 const g=new Game(s,seed,role);g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;g.s.hunger=g.s.water=100;g.s.life.left=200*D.LIFE.yearMinutes;
 g.s.xp=g.required;return g;
}
const mem=new Map(),slots=new Slots({getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)});
for(const role of ['human','demon']){
 // Both races, 11 boundaries each. Validate all 4 pure promotions and all 7 injury-based tribulations.
 for(let z=0;z<11;z++){
  const g=bound(z,role);const before={hp:g.s.hp,pills:2,minutes:g.s.minutes,need:g.required,level:g.s.level};
  g.s.inv.guardPill=2;g.s.xp=before.need+777;
  const hazard=z>=4,preview=hazard?g.tribPreview():null;
  const oldLevel=g.s.level,oldUnlocked=g.s.unlocked;
  const result=g.act('breakthrough');ok(result.ok,`${role} boundary ${z+1}->${z+2} advances: ${result.msg}`);
  eq(g.s.level,oldLevel+1,`${role} boundary ${z+1}->${z+2} level`);
  eq(g.s.xp,777,`${role} boundary ${z+1}->${z+2} overflow survives`);
  ok(g.s.unlocked>=z+2,`${role} next zone unlocked immediately`);ok(g.s.unlocked>=oldUnlocked,`${role} no regression in unlocked`);
  if(!hazard){eq(g.s.hp,before.hp,`${role} early promotion does not lose HP`);eq(g.s.inv.guardPill,2,`${role} early pill kept`);eq(g.s.minutes,before.minutes,`${role} early promotion no starvation tick`)}
  else{eq(g.s.hp,before.hp-preview.damage,`${role} late actual fixed damage`);eq(g.s.inv.guardPill,0,`${role} late consumes 2 pills`);eq(g.s.minutes,before.minutes+240,`${role} late passes 240min`)}
  ok(slots.save(role,g,z+1),`${role} boundary ${z+1} persist`);
  const loaded=slots.read(role,z+1).game;
  eq(loaded.s.xp,777,`${role} after reload overflow`);
  eq(loaded.s.hp,g.s.hp,`${role} after reload HP`);
 }
}
// Level 36 is a LEVEL limit only, XP continues accumulating and survives reload.
for(const role of ['human','demon']){
 const g=bound(11,role);g.s.xp=g.required+7;
 g.xp(33333);ok(g.s.xp>g.required,`${role} lvl36 overcap continues`);
 const xp=g.s.xp;const loaded=new Game(g.state(),261022,role);
 eq(loaded.s.xp,xp,`${role} level36 overcap reload`);eq(loaded.s.level,36,`${role} remains 36`);
}
// Ordinary XP gains also retain the surplus at the realm boundary rather than truncating.
for(const role of ['human','demon']){
 const g=bound(0,role);g.s.xp=g.required-10;
 g.xp(555);ok(g.s.xp>g.required,`${role} near-cap XP can exceed`);
 const exp=g.s.xp;eq(new Game(g.state(),261022,role).s.xp,exp,`${role} overcap saved`);
 const t=g.act('breakthrough');ok(t.ok,`${role} surplus breakthrough`);
 eq(g.s.xp,exp-1920,`${role} surplus exact old need subtraction`);
}
// Combat save: zone gap 10% at lvl1 in starting zone should remain, without
// invoking `this` inside normalize(). Enemy current HP, maxHP, attack and turn persist.
for(const role of ['human','demon'])for(const z of [0,4,8,11]){
 const s=Game.fresh(188188+z,role);s.zone=z;s.level=(z+1)*3-2;s.unlocked=z+1;
 for(let i=0;i<=z;i++){s.cleared[i]=true;s.ritual[i]=true}
 const g=new Game(s,188188+z,role);g.s.hunger=g.s.water=100;g.s.life.left=300*D.LIFE.yearMinutes;
 const type=D.ZONES[z].boss; // repeat boss to exercise scaled max HP
 const start=g.startBattle(type,true);ok(start?.ok,`${role} z${z} battle begins`);
 ok(g.s.combat?.maxHp>0,`${role} z${z} combat exists`);
 g.s.combat.hp=Math.max(1,Math.floor(g.s.combat.maxHp*.43));
 g.s.combat.turn=3;g.s.combat.riposte=2;g.s.combat.intent='heavy';
 for(let n=0;n<11;n++){
  const snapshot=JSON.stringify(g.s.combat);
  ok(slots.save(role,g,80+z),`${role} z${z} combat save iteration ${n}`);
  const reread=slots.read(role,80+z);ok(reread?.game,`${role} z${z} combat reload iteration ${n}`);
  const after=reread.game.s.combat;
  ok(after,`${role} z${z} resumed combat`);
  for(const key of ['type','hp','maxHp','atk','armor','turn','riposte','intent','repeat'])eq(after[key],g.s.combat[key],`${role} z${z} ${key} unchanged iteration ${n}`);
  g.s.combat=reread.game.s.combat;
 }
}
// Do not change the original zone-gap calculation: lvl 1 in Qinglan = gap 1 / 10%.
const first=new Game(null,261022,'human');eq(first.zoneGap,1,'Qinglan stage1 zone gap=1');eq(first.enemyBoost,1.1,'Qinglan stage1 enemy +10%');
ok(/const zoneRealm=Math\.min\(12,Math\.max\(1,Number\(this\.s\.zone\)\+2\)\)/.test(text),'legacy zone-gap formula retained');
console.log('V90.59 RULES PASS',checks,'assertions; 2 races x 11 boundaries, overcap, combat x 88 saves, gap unchanged');
