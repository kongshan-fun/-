'use strict';
/* V90.56 验收：渡劫固定伤害 —— 口径改为 docs §七 的绝对表
 *
 * 定稿（docs §七）：
 *   1 凡人→感气 150 / 2 感气→引气 260 / 3 引气→炼气 410 / 4 炼气→筑基 650 /
 *   5 筑基→金丹 1020 / 6 金丹→元婴 1620 / 7 元婴→化神 2550 / 8 化神→炼虚 4000 /
 *   9 炼虚→合体 6300 / 10 合体→大乘 9900 / 11 大乘→渡劫 15500 / 12 渡劫→飞升 24200
 *   护劫丹每颗 −15%，每境最多 2 颗。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (c, l, d) => { if (c) { pass++; console.log('  PASS  ' + l + (d ? '  — ' + d : '')); } else { fail++; console.log('  FAIL  ' + l + (d ? '  — ' + d : '')); } };

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const ctx = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN, Set, Map, Promise, setTimeout, clearTimeout };
ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
ctx.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, get length() { return 0; } };
vm.createContext(ctx);
for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);
const G = ctx.QGame, D = ctx.QData;

const DOC = [150, 260, 410, 650, 1020, 1620, 2550, 4000, 6300, 9900, 15500, 24200];

/* 该境的后期档位（境序 n → level n*3） */
function atRealm(n) {
  const s = G.fresh(20261030, 'human');
  s.level = n * 3;
  s.hunger = 100; s.water = 100; s.life.left = 200 * D.LIFE.yearMinutes;
  const p = { x: 1, y: 5 };
  s.pos = { ...p }; s.last = { ...p };
  s.settlements[0] = { pos: { ...p }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 3 }, stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  s.inv.guardPill = 0;
  const g = new G(s);
  g.s.hp = g.s.maxHp;
  return g;
}

/* ---------- 1. 绝对表逐境对齐 ---------- */
{
  const bad = [];
  for (let n = 1; n <= 12; n++) {
    const got = atRealm(n).tribDamage;
    if (got !== DOC[n - 1]) bad.push(`${n}:${got}≠${DOC[n - 1]}`);
  }
  ok(bad.length === 0, '12 次渡劫伤害 = docs §七 绝对表（150 … 24200）', bad.join(' '));
  ok(D.TRIB_DAMAGE.join(',') === DOC.join(','), 'D.TRIB_DAMAGE 就是定稿表', D.TRIB_DAMAGE.join(','));
}

/* ---------- 2. 与气血上限解耦（不再按气血百分比） ---------- */
{
  const g = atRealm(6);
  const a = g.tribDamage;
  g.s.maxHp = Math.round(g.s.maxHp * 3);
  ok(g.tribDamage === a, '伤害不随气血上限变化（绝对表，不是百分比）', `${a} → ${g.tribDamage}`);
}

/* ---------- 3. 护劫丹：每颗 −15%，最多 2 颗 ---------- */
{
  const g = atRealm(6);
  const base = g.tribDamage;
  g.s.inv.guardPill = 1;
  const one = g.tribDamage;
  g.s.inv.guardPill = 2;
  const two = g.tribDamage;
  g.s.inv.guardPill = 9;
  const cap = g.tribDamage;
  ok(one === Math.round(base * 0.85), '1 颗减伤 15%', `${base} → ${one}`);
  ok(two === Math.round(base * 0.70), '2 颗减伤 30%', `${base} → ${two}`);
  ok(cap === two, '超过 2 颗不再叠加（每境最多 2 颗）', `9 颗 = ${cap}`);
}

/* ---------- 4. 裸装后期档位渡劫后剩余 ≈ 表里的「无装备剩余」列 ---------- */
{
  const BARE = [17, 13, 15, 14, 15, 15, 15, 15, 15, 15, 15, 15];   // docs §七「无装备剩余」
  const bad = [];
  for (let n = 1; n <= 12; n++) {
    const g = atRealm(n);
    const pct = Math.round(Math.max(0, g.s.maxHp - g.tribDamage) / g.s.maxHp * 100);
    if (Math.abs(pct - BARE[n - 1]) > 3) bad.push(`境${n}:${pct}%≠${BARE[n - 1]}%`);
  }
  ok(bad.length === 0, '裸装后期渡劫后剩余 ≈ 定稿「无装备剩余」（±3%）', bad.join(' '));
}

/* ---------- 5. 界面三行存在 ---------- */
ok(/本次伤害/.test(html) && /你的气血上限/.test(html) && /渡劫后剩余/.test(html), '渡劫页三行：本次伤害 / 气血上限 / 剩余百分比');

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
