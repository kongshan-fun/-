'use strict';
/* V90.45 验收：境界显示切换到十二境表 */
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
ok(!!D && !!D.realmDisplay, '引擎含 D.realmDisplay');

/* 前两境：由 level 驱动 → 凡人/感气/引气/炼气/筑基/金丹 */
const L = (lv, major) => D.realmDisplay({ character: 'human', level: lv, major: major || 0, daoXp: 0 });
ok(L(1) === '凡人初期', 'L1 = 凡人初期', L(1));
ok(L(3) === '凡人后期', 'L3 = 凡人后期', L(3));
ok(L(6) === '感气后期', 'L6 = 感气后期', L(6));
ok(L(9) === '引气后期', 'L9 = 引气后期', L(9));
ok(L(12) === '炼气后期', 'L12 = 炼气后期', L(12));
ok(L(15) === '筑基后期', 'L15 = 筑基后期', L(15));
ok(L(18) === '金丹后期', 'L18 = 金丹后期', L(18));

/* 破境境：major 2..8 → 境 7..12，阶段由 daoXp 决定 */
const stageOf = (major, ratio) => {
  const need = major >= 8 ? D.ASCENSION_RULE.dao : D.ASCENSION_STAGES[major - 1].needDao;
  return D.realmDisplay({ character: 'human', level: 18, major, daoXp: Math.round(need * ratio) });
};
ok(stageOf(2, 0.1) === '元婴初期', 'major2 初期 = 元婴初期', stageOf(2, 0.1));
ok(stageOf(2, 0.5) === '元婴中期', 'major2 中期', stageOf(2, 0.5));
ok(stageOf(2, 0.8) === '元婴后期', 'major2 后期', stageOf(2, 0.8));
ok(stageOf(2, 1) === '元婴圆满', 'major2 满 = 元婴圆满', stageOf(2, 1));
ok(stageOf(3, 0.5) === '化神中期', 'major3 = 化神中期', stageOf(3, 0.5));
ok(stageOf(4, 0.5) === '炼虚中期', 'major4 = 炼虚中期', stageOf(4, 0.5));
ok(stageOf(5, 0.5) === '合体中期', 'major5 = 合体中期', stageOf(5, 0.5));
ok(stageOf(6, 0.5) === '大乘中期', 'major6 = 大乘中期', stageOf(6, 0.5));
ok(stageOf(7, 0.5) === '渡劫中期', 'major7 = 渡劫中期', stageOf(7, 0.5));
ok(stageOf(8, 0.5) === '渡劫中期', 'major8 夹紧到渡劫', stageOf(8, 0.5));

/* 妖族 */
ok(D.realmDisplay({ character: 'demon', level: 1, major: 0, daoXp: 0 }) === '凡妖初期', '妖族 L1 = 凡妖初期');
ok(D.realmDisplay({ character: 'demon', level: 18, major: 2, daoXp: 1 }) === '妖王初期', '妖族 major2 = 妖王初期（对应人族元婴）');

/* 全局覆盖：12 境全部可达 */
const seen = new Set();
for (let lv = 1; lv <= 18; lv++) seen.add(D.realmDisplay({ character: 'human', level: lv, major: 0, daoXp: 0 }).replace(/(初期|中期|后期|圆满)$/, ''));
for (let m = 2; m <= 8; m++) seen.add(stageOf(m, 0.1).replace(/(初期|中期|后期|圆满)$/, ''));
ok(seen.size === 12, '十二境全部可达', [...seen].join('→'));

/* 旧引擎 getter 已切过去（借原型，不构造存档） */
const g = Object.create(ctx.QGame.prototype);
g.s = { character: 'human', level: 9, major: 0, daoXp: 0, ascended: false };
ok(g.realm === '引气后期', 'game.realm 走新表（L9 = 引气后期）', g.realm);

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
