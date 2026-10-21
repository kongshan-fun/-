'use strict';
/* V90.43b 验收：12 境 × 36 段 映射表（数据层） */
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
ok(!!D, '引擎加载');
ok(!!D.REALM12 && Array.isArray(D.REALM12.human) && Array.isArray(D.REALM12.demon), 'REALM12 表存在');
ok(D.REALM12.human.length === 12 && D.REALM12.demon.length === 12, '两族各 12 境', D.REALM12.human.length + '/' + D.REALM12.demon.length);

const HUMAN = ['凡人', '感气', '引气', '炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'];
ok(JSON.stringify(D.REALM12.human) === JSON.stringify(HUMAN), '人族 12 境顺序正确');
ok(D.REALM12.demon[0] === '凡妖' && D.REALM12.demon[11] === '渡劫', '妖族首尾正确', D.REALM12.demon.join('→'));

/* 36 段全组合 */
let bad = [];
for (let lv = 1; lv <= 36; lv++) {
  const r = D.realmOfLevel(lv, 'human');
  const idx = Math.ceil(lv / 3), st = ((lv - 1) % 3) + 1;
  const want = HUMAN[idx - 1] + ['初期', '中期', '后期'][st - 1];
  if (r.index !== idx || r.stage !== st || r.name !== want) bad.push(lv + '→' + r.name + '(期望' + want + ')');
}
ok(bad.length === 0, '人族 36 段映射全部正确', bad.slice(0, 3).join(' / '));

let bad2 = [];
for (let lv = 1; lv <= 36; lv++) {
  const r = D.realmOfLevel(lv, 'demon');
  if (!/^(凡妖|开识|启灵|通脉|妖丹|化形|妖王|妖皇|妖尊|妖圣|妖帝|渡劫)(初期|中期|后期)$/.test(r.name)) bad2.push(lv + '→' + r.name);
}
ok(bad2.length === 0, '妖族 36 段命名合法', bad2.slice(0, 3).join(' / '));

/* 边界与容错 */
ok(D.realmOfLevel(1, 'human').name === '凡人初期', 'L1 = 凡人初期', D.realmOfLevel(1, 'human').name);
ok(D.realmOfLevel(36, 'human').name === '渡劫后期', 'L36 = 渡劫后期', D.realmOfLevel(36, 'human').name);
ok(D.realmOfLevel(99, 'human').name === '渡劫后期', '越界向上夹紧', D.realmOfLevel(99, 'human').name);
ok(D.realmOfLevel(-5, 'human').name === '凡人初期', '越界向下夹紧', D.realmOfLevel(-5, 'human').name);
ok(D.realmOfLevel(18, 'human').name === '金丹后期', 'L18 = 金丹后期（旧 level 上限落点）', D.realmOfLevel(18, 'human').name);

/* 旧有显示保持不变（本步不接线） */
const B = ctx.QBirth;
ok(B.realm({ character: 'human', major: 0, level: 3 }) === '炼气三层', '旧显示未受影响（炼气三层）');
ok(B.realm({ character: 'human', major: 1, level: 13 }) === '筑基中期', '旧显示未受影响（筑基中期）');

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
