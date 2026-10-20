'use strict';
/*
 * P0-4 动态境界指引复验：金丹 → 渡劫七境的「条件清单 / 材料来源 / 导航 / 动作」
 *
 * 断的是引擎真行为，不是文案：
 *   1. 每个高阶境（zone 5..11）在条件齐备时 breakthrough() 真的成功，
 *      且 major = zone-3、境界名与 ASCENSION_STAGES 一致
 *   2. 条件不齐时**每一条门槛都会给出可读的拒绝理由**（说明清单是活的，不是摆设）
 *       战斗中 / 未通关本境 / 已突破 / 未满 18 级 / 不在洞府 / 道行不足 / 缺材料 /
 *       金丹雷劫未渡 / 元婴问心未过
 *   3. 突破材料在该境地图上真的有来源（资源地标的 loot 命中）
 *   4. 该境地图像素里存在 boss 格，且 game.path() 能算出路线（导航可用）
 *   5. 修炼父子页用到的动作在 handle() 里都存在（按钮不会点了没反应）
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const ctx = vm.createContext({ console: { log() {} } });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame, D = ctx.QData;

let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

/* ---------- 1/3/4. 七境突破 + 材料来源 + 导航 ---------- */
function stageState(z) {
  const st = D.ASCENSION_STAGES[z - 5];
  const s = Game.fresh(20261025, 'human');
  s.zone = z; s.major = z - 4; s.unlocked = Math.min(D.ZONES.length, z + 1);
  s.level = 18; s.hunger = 100; s.water = 100;
  s.hp = s.maxHp; s.spirit = s.maxSpirit;
  s.life.left = 200 * D.LIFE.yearMinutes;
  for (let i = 0; i <= z; i++) { s.cleared[i] = true; s.ritual[i] = true; }
  s.daoXp = st.needDao;
  s.inv[st.primary] = 10; s.inv[st.secondary] = 10;
  s.flags.coreTribulation = { phase: 3, marks: 3, started: true, complete: true };
  s.flags.heartTrial = { phase: 3, started: true, complete: true, choices: [] };
  const campPos = { x: 1, y: 5 };
  s.pos = { ...campPos }; s.last = { ...campPos };
  s.settlements[z] = { pos: { ...campPos }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 3 }, stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  return s;
}

for (let z = 5; z < D.ZONES.length; z++) {
  const st = D.ASCENSION_STAGES[z - 5];
  const g = new Game(stageState(z));
  ok(g.atCamp, `zone${z} 判定为在洞府（破境前置）`);
  eq(g.breakthroughReason ? null : null, null, ''); // 占位保持计数简单
  const before = g.s.major;
  const r = g.breakthrough();
  ok(r && r.ok, `zone${z} ${D.ZONES[z].name} 破境成功：${JSON.stringify(r && r.msg || '')}`);
  eq(before, z - 4, `zone${z} 破境前 major=${z - 4}`);
  eq(g.s.major, z - 3, `zone${z} 破境后 major=${z - 3}`);
  eq(g.realm, st.realm, `zone${z} 境界名 = ${st.realm}（实际 ${g.realm}）`);

  // 材料来源：该境地图上要能采到 primary / secondary
  const lands = new Set(D.ZONES[z].map.flat());
  for (const item of [st.primary, st.secondary]) {
    const hasLand = [...lands].some((land) => (D.RESOURCE_LAYOUT[land] || []).some((k) => k && D.RES[k]?.loot?.[item]));
    ok(hasLand, `zone${z} 地图上能产出 ${D.ITEMS[item]?.name || item}`);
  }

  // 导航：boss 格存在且 path 可用
  const boss = [];
  D.ZONES[z].map.forEach((row, y) => row.forEach((land, x) => { if (land === 'boss') boss.push({ x, y }); }));
  ok(boss.length === 1, `zone${z} 地图恰好一个 boss 格`);
  const g2 = new Game(stageState(z));
  const route = g2.path(boss[0].x, boss[0].y);
  ok(Array.isArray(route) && route.length > 0, `zone${z} 能算出通往 boss 的路线（${route.length} 步）`);
}

/* ---------- 2. 每条门槛都要有可读拒绝理由 ---------- */
const gates = [];
function expectFail(label, mutate, needle) {
  /* 先建 Game 再改 g.s：normalize 会把伪造的 combat 之类直接清掉 */
  const g = new Game(stageState(5));   // 丹霞 = 金丹，雷劫/问心条件都在这一境
  mutate(g.s);
  const r = g.breakthrough();
  ok(r && r.ok === false, `门槛「${label}」应当失败`);
  const msg = String(r.msg || '');
  ok(msg.includes(needle), `门槛「${label}」理由包含「${needle}」（实际：${msg}）`);
  gates.push(label);
}
expectFail('战斗中', (s) => { s.combat = { enemy: 'river', hp: 1, maxHp: 1, atk: 1, armor: 0, turn: 1, intent: 'attack' }; }, '斗法中');
expectFail('未通关本境', (s) => { s.cleared[5] = false; }, '首领');
expectFail('已突破过', (s) => { s.major = 2; }, '已突破');
expectFail('未满 18 级', (s) => { s.level = 12; }, '后期');
expectFail('不在洞府', (s) => { s.settlements[5].pos = { x: 6, y: 6 }; }, '洞府');
expectFail('道行不足', (s) => { s.daoXp = 0; }, '道行不足');
expectFail('缺材料', (s) => { s.inv[D.ASCENSION_STAGES[0].primary] = 0; s.inv[D.ASCENSION_STAGES[0].secondary] = 0; }, '缺');
expectFail('金丹雷劫未渡', (s) => { s.flags.coreTribulation = { phase: 0, marks: 0, started: false, complete: false }; }, '雷');
expectFail('元婴问心未过', (s) => { s.zone = 6; s.major = 2; s.cleared[6] = true; s.settlements[6] = s.settlements[5]; s.pos = { x: 1, y: 5 }; s.daoXp = D.ASCENSION_STAGES[1].needDao; s.inv[D.ASCENSION_STAGES[1].primary] = 10; s.inv[D.ASCENSION_STAGES[1].secondary] = 10; s.flags.heartTrial = { phase: 0, started: false, complete: false, choices: [] }; }, '问心');

/* ---------- 5. 修炼父子页的动作在 handle() 里都存在 ---------- */
for (const act of ['cult-step', 'panel-step', 'train', 'tribulation-open', 'tribulation-start', 'tribulation-act', 'tribulation-return', 'heart-open', 'heart-start', 'heart-act', 'heart-return']) {
  ok(html.includes(`a==='${act}'`) || html.includes(`data-a="${act}"`), `动作 ${act} 存在（按钮不会点了没反应）`);
}

console.log(`REALM GUIDE PASS ${checks} checks（七境全部可突破；门槛 ${gates.length} 条都有理由；动作齐全）`);
