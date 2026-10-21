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
const make = (zone, maxHp, hp) => {
  const g = Object.create(G.prototype);
  g.s = { zone, maxHp, hp, major: zone - 4, level: 18, daoXp: 0, character: 'human', ascended: false, cleared: Array(12).fill(true) };
  return g;
};

/* 系数表：zone5=.70 … zone11=1.00 */
const CASES = [[5, 0.70], [6, 0.75], [7, 0.80], [8, 0.85], [9, 0.90], [10, 0.95], [11, 1.00]];
let bad = [];
for (const [z, r] of CASES) {
  const g = make(z, 1000, 1000);
  const want = Math.round(1000 * r);
  if (g.tribDamage !== want) bad.push('zone' + z + ' ' + g.tribDamage + '≠' + want);
}
ok(bad.length === 0, '七境渡劫伤害 = 气血上限 × 系数', bad.join(' / ') || '70%~100%');

ok(make(5, 640, 640).tribDamage === 448, '金丹→元婴：640 血上限 → 伤 448', make(5, 640, 640).tribDamage);
ok(make(11, 640, 640).tribDamage === 640, '渡劫境：扣满 100%', make(11, 640, 640).tribDamage);
ok(make(5, 1, 1).tribDamage >= 1, '最小不会出现 0 伤害', make(5, 1, 1).tribDamage);
ok(make(0, 500, 500).tribDamage === 350, '前五境取默认 70%', make(0, 500, 500).tribDamage);

/* 源码级校验：破境前有气血判定、破境后按 上限−伤害 结算 */
const src = html;
ok(src.includes('if(this.s.hp<dmg)return this.fail('), '破境前校验：气血 < 伤害则拒绝（相等可险过）');
ok(/this\.s\.hp=Math\.max\(1,this\.s\.maxHp-dmg\)/.test(src), '破境后：气血 = 上限 − 伤害（不再满血）');
ok((src.match(/this\.s\.hp=Math\.max\(1,this\.s\.maxHp-dmg\)/g) || []).length === 1, "破境扣血只出现一次（飞升/休整的满血回复不受影响）");

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
