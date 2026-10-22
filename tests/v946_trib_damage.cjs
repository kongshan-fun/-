'use strict';
/* V90.46 验收：渡劫固定伤害（养成判定） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, l, d) => { if (c) { pass++; console.log('  PASS  ' + l + (d ? '  — ' + d : '')); } else { fail++; console.log('  FAIL  ' + l + (d ? '  — ' + d : '')); } };

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const ctx = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN, Set, Map, Promise, setTimeout, clearTimeout };
ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
ctx.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, key() { return null; }, get length() { return Object.keys(this._d).length; } };
vm.createContext(ctx);
for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);

const G = ctx.QGame;

const D=ctx.QData;
const fixed=[150,260,410,650,1020,1620,2550,4000,6300,9900,15500,24200];
function atRealm(n) {
 const s=G.fresh(20261030,'human');s.level=n*3;
 s.hunger=100;s.water=100;s.life.left=200*D.LIFE.yearMinutes;
 const p={x:1,y:5};s.pos={...p};s.last={...p};
 s.settlements[0]={pos:{...p},level:3,buildings:{warehouse:3,forge:3,alchemy:3,quiet:3,farm:3},stash:{},storedGears:[],foundedAt:s.minutes,farmAt:s.minutes};
 s.inv.guardPill=0;const g=new G(s);g.s.hp=g.s.maxHp;return g;
}
const incorrect=[];
for(let i=1;i<=12;i++){const got=atRealm(i).tribDamage;if(got!==fixed[i-1])incorrect.push(i+':'+got+'/'+fixed[i-1]);}
ok(incorrect.length===0,'12 absolute tribulation amounts align with 36-stage design',incorrect.join(','));
ok(D.TRIB_DAMAGE.join(',')===fixed.join(','),'definitive data table preserved');
const g=atRealm(6),actual=g.tribDamage;g.s.maxHp*=3;
ok(g.tribDamage===actual,'fixed tribulation independent of maximum HP');
g.s.inv.guardPill=1;ok(g.tribDamage===Math.round(actual*.85),'one pill reduces damage by 15%');
g.s.inv.guardPill=2;ok(g.tribDamage===Math.round(actual*.70),'two pills reduce damage by 30%');
g.s.inv.guardPill=9;ok(g.tribDamage===Math.round(actual*.70),'pill cap is two');
const expectedPct=[17,13,15,14,15,15,15,15,15,15,15,15],outliers=[];
for(let n=1;n<=12;n++){const game=atRealm(n),pct=Math.round(Math.max(0,game.s.maxHp-game.tribDamage)/game.s.maxHp*100);
 if(Math.abs(pct-expectedPct[n-1])>3)outliers.push(n+':'+pct+'%');}
ok(outliers.length===0,'bare late-stage remaining HP percent within 3% of design',outliers.join(','));
ok(/本次伤害/.test(html)&&/你的气血上限/.test(html)&&/渡劫后剩余/.test(html),'trial UI shows actual fixed damage, HP and remaining percent');
console.log('V90.58 ABSOLUTE TRIBULATION REGRESSION',pass,'PASS',fail,'FAIL');
process.exitCode=fail?1:0;
