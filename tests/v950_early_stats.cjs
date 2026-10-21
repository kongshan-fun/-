'use strict';
/* V90.50 验收：前六境属性接入同一张成长表 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, l, d) => { if (c) { pass++; console.log('  PASS  ' + l + (d ? '  — ' + d : '')); } else { fail++; console.log('  FAIL  ' + l + (d ? '  — ' + d : '')); } };

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const ctx = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN, Set, Map, Promise, setTimeout, clearTimeout };
ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
ctx.localStorage = { _d: {}, getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, get length() { return 0; } };
vm.createContext(ctx);
for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);

const D = ctx.QData;
ok(typeof D.statsForLevel === 'function', 'statsForLevel 存在');

const L = (lv) => D.statsForLevel(lv);
ok(L(1).hp === Math.round(180 * 0.70) && L(1).index === 1, 'L1 凡人初期 = 180×0.70', L(1).hp);
ok(L(3).hp === 180 && L(3).stage === 3, 'L3 凡人后期 = 180', L(3).hp);
ok(L(6).hp === 300 && L(6).index === 2, 'L6 感气后期 = 300', L(6).hp);
ok(L(9).hp === 480, 'L9 引气后期 = 480', L(9).hp);
ok(L(12).hp === 760, 'L12 炼气后期 = 760', L(12).hp);
ok(L(15).hp === 1200, 'L15 筑基后期 = 1200', L(15).hp);
ok(L(18).hp === 1900 && L(18).atk === 41, 'L18 金丹后期 = 1900/41', L(18).hp + '/' + L(18).atk);
ok(L(4).hp === Math.round(300 * 0.70), 'L4 感气初期 = 300×0.70', L(4).hp);
ok(L(99).index === 12, '越界夹紧到第 12 境');
ok(L(1).atk === 4 && L(18).atk === 41, '攻击 4 → 41');

/* 归一化后游戏对象真的用了新数值 */
const G = ctx.QGame;
const raw = ctx.QGame.fresh(20261019, 'human');
const g = new G(raw, 20261019, 'human');
const st = D.statsForLevel(g.s.level);
ok(g.s.maxHp === st.hp, '新建档 maxHp 走表', g.s.maxHp + ' vs ' + st.hp);
ok(g.s.spirit === st.spirit || g.s.spirit <= g.s.maxSpirit, '灵力不超过上限', g.s.spirit + '/' + g.s.maxSpirit);

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
