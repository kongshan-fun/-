'use strict';
/* V90.47 验收：护劫丹（渡劫减伤） */
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

const D = ctx.QData, G = ctx.QGame;
ok(!!D.ITEMS.guardPill, '护劫丹物品存在', D.ITEMS.guardPill && D.ITEMS.guardPill.name);
ok(D.RECIPES.some((r) => r.item === 'guardPill'), '护劫丹有配方', (D.RECIPES.find((r) => r.item === 'guardPill') || {}).name);

const make = (pills) => {
  const g = Object.create(G.prototype);
  g.s = { zone: 5, maxHp: 1000, hp: 1000, major: 1, level: 18, daoXp: 0, character: 'human', ascended: false, cleared: Array(12).fill(true), inv: { guardPill: pills } };
  return g;
};

ok(make(0).tribDamage === 700, '无丹：1000 上限 × 70% = 700', make(0).tribDamage);
ok(make(1).tribDamage === 595, '1 颗：减伤 15% → 595', make(1).tribDamage);
ok(make(2).tribDamage === 490, '2 颗：减伤 30% → 490', make(2).tribDamage);
ok(make(5).tribDamage === 490, '5 颗只按 2 颗算（上限）', make(5).tribDamage);
ok(make(2).tribPills === 2 && make(5).tribPills === 2, 'tribPills 夹紧到 2');
ok(Math.abs(make(1).tribReduce - 0.15) < 1e-9, 'tribReduce = 0.15');

/* 源码级：成功后消耗实际生效的丹药 */
ok(/const usedPills=this\.tribPills;/.test(html), '破境取用生效颗数');
ok(/this\.s\.inv\.guardPill=Math\.max\(0,\(this\.s\.inv\.guardPill\|\|0\)-usedPills\)/.test(html), '成功后扣减护劫丹');
/* 破境条件页展示 */
ok(/渡劫消耗/.test(html) && /护劫丹 /.test(html), '破境条件页展示消耗与丹药减伤');

/* 渡劫伤害仍受 zone 系数影响 */
ok(make(2).tribDamage === 490 && Math.round(make(2).tribDamage / 0.70) === 700, '系数与丹药叠加正确');

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
