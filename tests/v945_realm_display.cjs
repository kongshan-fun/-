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

/* V90.55：level 1..36 是唯一真源 → 境序=ceil(level/3)，阶序=(level-1)%3+1 */
const L = (lv, xp) => D.realmDisplay({ character: 'human', level: lv, xp: xp || 0 });
ok(L(1) === '凡人初期', 'L1 = 凡人初期', L(1));
ok(L(3) === '凡人后期', 'L3 = 凡人后期', L(3));
ok(L(6) === '感气后期', 'L6 = 感气后期', L(6));
ok(L(9) === '引气后期', 'L9 = 引气后期', L(9));
ok(L(12) === '炼气后期', 'L12 = 炼气后期', L(12));
ok(L(15) === '筑基后期', 'L15 = 筑基后期', L(15));
ok(L(18) === '金丹后期', 'L18 = 金丹后期', L(18));

/* 后七境同样由 level 驱动：19..21 元婴、22..24 化神 … 34..36 渡劫 */
const at = (lv) => D.realmDisplay({ character: 'human', level: lv });
ok(at(19) === '元婴初期', 'L19 = 元婴初期', at(19));
ok(at(20) === '元婴中期', 'L20 = 元婴中期', at(20));
ok(at(21) === '元婴后期', 'L21 = 元婴后期', at(21));
ok(at(22) === '化神初期', 'L22 = 化神初期', at(22));
ok(at(25) === '炼虚初期', 'L25 = 炼虚初期', at(25));
ok(at(28) === '合体初期', 'L28 = 合体初期', at(28));
ok(at(31) === '大乘初期', 'L31 = 大乘初期', at(31));
ok(at(34) === '渡劫初期', 'L34 = 渡劫初期', at(34));
ok(at(36) === '渡劫后期', 'L36 = 渡劫后期', at(36));

/* 「圆满」是状态词（阶序=3 且本段修满），不是第四阶 */
{
  const lv = 21;                                     // 元婴后期
  const need = Math.round(D.REALM_BASE[6] * D.STAGE_MULT[2]);
  ok(D.realmDisplay({ character: 'human', level: lv, xp: need - 1 }) === '元婴后期', '未修满仍是后期');
  ok(D.realmDisplay({ character: 'human', level: lv, xp: need }) === '元婴圆满', '修满 → 元婴圆满', 'need=' + need);
  ok(D.realmDisplay({ character: 'human', level: 20, xp: 999999 }) === '元婴中期', '中期修满也不叫圆满');
}

/* 妖族同一套 level 轴 */
ok(D.realmDisplay({ character: 'demon', level: 1 }) === '凡妖初期', '妖族 L1 = 凡妖初期');
ok(D.realmDisplay({ character: 'demon', level: 19 }) === '妖王初期', '妖族 L19 = 妖王初期（对应人族元婴）');

/* 全局覆盖：36 段走完，12 境全部可达 */
const seen = new Set();
for (let lv = 1; lv <= 36; lv++) seen.add(D.realmDisplay({ character: 'human', level: lv }).replace(/(初期|中期|后期|圆满)$/, ''));
ok(seen.size === 12, '十二境全部可达', [...seen].join('→'));

/* 旧引擎 getter 已切过去（借原型，不构造存档） */
const g = Object.create(ctx.QGame.prototype);
g.s = { character: 'human', level: 9, major: 0, daoXp: 0, ascended: false, xp: 0 };
ok(g.realm === '引气后期', 'game.realm 走新表（L9 = 引气后期）', g.realm);

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
