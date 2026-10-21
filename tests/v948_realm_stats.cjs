'use strict';
/* V90.48 验收：高境属性接入十二境成长表 */
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

const D = ctx.QData;
ok(Array.isArray(D.REALM_STATS) && D.REALM_STATS.length === 12, '12 条属性基准', D.REALM_STATS && D.REALM_STATS.length);
ok(D.REALM_STATS[0].hp === 180 && D.REALM_STATS[11].hp === 28500, '首尾气血 180 → 28,500', D.REALM_STATS[0].hp + ' → ' + D.REALM_STATS[11].hp);
ok(D.REALM_STATS[11].atk === 410 && D.REALM_STATS[11].spirit === 2300, '渡劫攻击 410 / 灵力 2300');

/* 前两境不启用（保持原公式） */
ok(D.statsFor(0, 0, 60) === null, 'major0（凡人~炼气）不套表');
ok(D.statsFor(1, 0, 60) === null, 'major1（筑基/金丹）不套表');

/* 高境三档 */
const need6 = D.ASCENSION_STAGES[4].needDao; // major6 → 大乘
const s6a = D.statsFor(6, 0, need6);
const s6b = D.statsFor(6, Math.round(need6 * 0.5), need6);
const s6c = D.statsFor(6, need6, need6);
ok(s6a.index === 11, 'major6 → 第 11 境（大乘）', s6a.index);
ok(s6a.hp === Math.round(18200 * 0.70), '大乘初期 = 18200×0.70', s6a.hp);
ok(s6b.hp === Math.round(18200 * 0.85), '大乘中期 = ×0.85', s6b.hp);
ok(s6c.hp === 18200, '大乘后期 = ×1.00', s6c.hp);

const s8 = D.statsFor(8, 0, D.ASCENSION_RULE.dao);
ok(s8.hp === Math.round(28500 * 0.70), '渡劫初期 = 28500×0.70', s8.hp);
ok(D.statsFor(99, 0, 100).index === 12, '越界夹紧到第 12 境');

/* 与渡劫扣血联动：气血上限变大 → 伤害同步变大 */
const G = ctx.QGame;
const g = Object.create(G.prototype);
const st = D.statsFor(6, 0, need6);
g.s = { zone: 10, major: 6, level: 18, daoXp: 0, character: 'human', ascended: false, maxHp: st.hp, hp: st.hp, inv: {}, cleared: Array(12).fill(true) };
ok(g.tribDamage === Math.round(st.hp * 0.95), '大乘渡劫：伤害 = 上限×95%（随属性放大）', g.tribDamage);

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
