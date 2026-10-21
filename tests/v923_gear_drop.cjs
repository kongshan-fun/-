'use strict';
/*
 * V90.23 A 方案回归：战斗/秘境不再产出成品装备，只出器材与灵尘
 *
 * 动态断言（真跑引擎）：
 *   1. dropLoot() 在前期境给 ore/fiber/wood + 灵尘，且不产生任何 gears
 *   2. dropLoot() 在高阶境给该境的主材/副材 + 灵尘
 *   3. 负重点满时 loot 会留在地面缓存，不会凭空消失（沿用原 loot 行为）
 * 静态断言（锁死这次改动本身）：
 *   4. 战斗结算里不再调用 dropGear；改为首领 dropLoot
 *   5. 秘境封藏不再 createGear；dropGear 只剩「定义 + 一次性奇遇」两处
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
eq(blocks.length, 10, 'script 块 10 个');
for (const s of blocks) new vm.Script(s);          // 语法自检
const ctx = vm.createContext({ console });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame, D = ctx.QData;

function state(zone, major) {
  const s = Game.fresh(20261023, 'human');
  s.zone = zone; s.major = major; s.level = (function(m){return m<=1?(m===1?17:7):(Math.min(12,m+5)-1)*3+1;})(major); s.unlocked = Math.max(1, zone + 1);
  s.hunger = 100; s.water = 100; s.hp = s.maxHp; s.spirit = s.maxSpirit;
  s.life.left = 200 * D.LIFE.yearMinutes;
  /* 存档校验：major ≤ 1 + 从第 5 境起连续通关数；所以 major=zone-3 时必须通关到本境 */
  for (let i = 0; i <= zone; i++) { s.cleared[i] = true; s.ritual[i] = true; }
  return s;
}

/* ---------- 1. 前期境：器材 + 灵尘，不出成品 ---------- */
{
  const g = new Game(state(0, 0));
  const before = { ...g.s.inv };
  const gearsBefore = g.s.gears.length;
  g.dropLoot();
  eq(g.s.gears.length, gearsBefore, '前期境 dropLoot 不产生成品装备');
  ok((g.s.inv.ore || 0) > (before.ore || 0), '前期境给玄铁矿');
  ok((g.s.inv.fiber || 0) > (before.fiber || 0), '前期境给青藤');
  ok((g.s.inv.dust || 0) > (before.dust || 0), '前期境给灵尘');
}

/* ---------- 2. 高阶境：给该境主材/副材 ---------- */
for (const zone of [5, 7, 11]) {
  const g = new Game(state(zone, zone - 3));
  const st = D.ASCENSION_STAGES[zone - 5];
  const before = { ...g.s.inv };
  const gearsBefore = g.s.gears.length;
  g.dropLoot();
  eq(g.s.gears.length, gearsBefore, `zone${zone} dropLoot 不产生成品装备`);
  ok((g.s.inv[st.primary] || 0) > (before[st.primary] || 0), `zone${zone} 给主材 ${st.primary}`);
  ok((g.s.inv[st.secondary] || 0) > (before[st.secondary] || 0), `zone${zone} 给副材 ${st.secondary}`);
  ok((g.s.inv.dust || 0) - (before.dust || 0) >= 2, `zone${zone} 给灵尘`);
}

/* ---------- 3. 超重时留地（不凭空消失） ---------- */
{
  const g = new Game(state(0, 0));
  for (const k of Object.keys(D.ITEMS)) g.s.inv[k] = 0;
  g.s.inv.stone = 999;                        // 顶满负重
  const cacheBefore = JSON.stringify(g.s.caches || {});
  g.dropLoot();
  ok(g.s.gears.length === 0, '超重时也不会给成品');
  const cached = JSON.stringify(g.s.caches || {}) !== cacheBefore;
  ok(cached, '超重部分进入地面缓存（沿用原 loot 行为）');
}

/* ---------- 4/5. 静态锁死 ---------- */
ok(!/this\.random\(\)<\.22\)this\.dropGear/.test(html), '战斗结算不再调用 dropGear');
ok(/if\(boss\)this\.dropLoot\(\);/.test(html), '首领改为 dropLoot()');
ok(!/createGear\(cfg\.gear/.test(html), '秘境封藏不再直接给成品');
eq((html.match(/dropGear\(/g) || []).length, 2, 'dropGear 只剩「定义 + 一次性奇遇」两处');
ok(/if\(c\.gear\)this\.dropGear\(c\.minQuality\|\|0,'遗迹寻宝'\)/.test(html), '奇遇仍保留成品掉落');

console.log(`V90.23 GEAR DROP REBALANCE PASS ${checks} checks`);
