'use strict';
/* V90.49 验收：后七境怪物属性对齐十二境表 */
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
const WANT = {
  5: { w: [792, 180, 36], b: [2904, 270, 36] },
  6: { w: [1162, 282, 53], b: [4259, 423, 53] },
  7: { w: [1716, 444, 78], b: [6292, 666, 78] },
  8: { w: [2508, 696, 114], b: [9196, 1044, 114] },
  9: { w: [3696, 1092, 168], b: [13552, 1638, 168] },
  10: { w: [5412, 1710, 246], b: [19844, 2565, 246] },
  11: { w: [5412, 1710, 246], b: [19844, 2565, 246] },
};
let bad = [];
for (const z of Object.keys(WANT)) {
  const e = D.ENEMIES['realm' + z], b = D.ENEMIES['boss' + z];
  const w = WANT[z];
  if (!e || !b) { bad.push('zone' + z + ' 缺失'); continue; }
  if (e.hp !== w.w[0] || e.atk !== w.w[1] || e.armor !== w.w[2]) bad.push('zone' + z + ' 野怪 ' + [e.hp, e.atk, e.armor]);
  if (b.hp !== w.b[0] || b.atk !== w.b[1] || b.armor !== w.b[2]) bad.push('zone' + z + ' 首领 ' + [b.hp, b.atk, b.armor]);
}
ok(bad.length === 0, '七境野怪/首领数值全部对上', bad.slice(0, 3).join(' / ') || '7/7 境');

/* 与玩家成长表对齐：野怪 6 回合、首领 22 回合量级 */
const st7 = D.REALM_STATS[6], st12 = D.REALM_STATS[11];
ok(D.ENEMIES['realm5'].hp > 600 && D.ENEMIES['realm5'].hp < 1000, '元婴野怪血 792（旧 85）', D.ENEMIES['realm5'].hp);
ok(D.ENEMIES['boss10'].hp === 19844, '渡劫境首领血 19,844（旧 3,820）', D.ENEMIES['boss10'].hp);
ok(D.ENEMIES['boss10'].atk === 2565 && st12.hp === 28500, '首领伤害约玩家渡劫气血的 9%', Math.round(2565 / st12.hp * 100) + '%');

/* 前五境不动 */
ok(D.ENEMIES['boss0'] && D.ENEMIES['boss0'].hp < 300, '前五境首领未被本版覆盖（仍是低数值）', D.ENEMIES.boss0.hp);

/* 怪物不再"一碰就死"：血/攻比在合理区间 */
const ratio = D.ENEMIES['realm9'].hp / D.ENEMIES['realm9'].atk;
ok(ratio > 2 && ratio < 5, '野怪气血/攻击比合理', ratio.toFixed(2));

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
