'use strict';
/*
 * V90.55/V90.56 验收：渡劫（境边界的那一次固定伤害结算）
 *
 * 语义变更（原 v926「七境突破指引」已不适用）：
 *   旧：道行满 + 击败首领 + 三重雷考/问心 + 材料 → major+1
 *   新：本境后期修满（xp≥required）→ 回洞府 → 气血≥固定伤害 → 渡劫 → level+1（进入下一境初期）
 * 失败只重伤（collapse），不清档；不再有材料消耗与选项式前摇。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const ctx = vm.createContext({ console });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame, D = ctx.QData;

let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

/* 造一个「本境后期修满、在洞府、气血足」的档位 */
function readyState(level) {
  const s = Game.fresh(20261025, 'human');
  s.level = level;
  s.zone = 0;
  s.hunger = 100; s.water = 100;
  s.life.left = 200 * D.LIFE.yearMinutes;
  const p = { x: 1, y: 5 };
  s.pos = { ...p }; s.last = { ...p };
  s.settlements[0] = { pos: { ...p }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 3 },
    stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  s.inv.guardPill = 0;
  const g = new Game(s);
  g.s.hp = g.s.maxHp;
  g.s.xp = g.required;                                  // 后期修满
  return g;
}

/* ---------- 1. 成功：后期修满 → 渡劫 → 进入下一境初期 ---------- */
for (const level of [3, 18, 33]) {
  const g = readyState(level);
  const before = { level: g.s.level, idx: g.realmIndex, dmg: g.tribDamage };
  const r = g.breakthrough();
  ok(r && r.ok, `L${level} 渡劫成功：${JSON.stringify((r && r.msg) || '')}`);
  eq(g.s.level, before.level + 1, `L${level} 渡劫后 level+1`);
  eq(g.s.xp, 0, '渡劫后修为归零');
  eq(g.s.pendingTribulation, 0, '渡劫后清掉待渡劫标记');
  eq(g.realmIndex, Math.min(12, before.idx + 1), '进入下一境');
  eq(g.stageIndex, 1, '落在下一境初期');
  const st = D.statsForLevel(g.s.level);
  eq(g.s.maxHp, st.hp, '气血上限按新段属性表落位');
  eq(g.s.hp, Math.max(1, g.s.maxHp - before.dmg), '渡劫按固定伤害扣血（不清零）');
}

/* ---------- 2. 伤害口径：小于气血上限，护劫丹每颗减 15% ---------- */
{
  const g = readyState(18);
  const full = g.tribDamage;
  ok(full > 0 && full < g.s.maxHp, '渡劫伤害小于气血上限（不会必死）', `${full}/${g.s.maxHp}`);
  g.s.inv.guardPill = 2;
  const reduced = g.tribDamage;
  ok(reduced < full, '两颗护劫丹确实减伤', `${full} → ${reduced}`);
  ok(Math.abs(reduced - Math.round(full * 0.7)) <= 1, '两颗护劫丹约减 30%', `${full}*0.7≈${Math.round(full * 0.7)} vs ${reduced}`);
}

/* ---------- 3. 门槛：逐个失败原因 ---------- */
function expectFail(label, mutate, needle) {
  const g = readyState(18);
  mutate(g.s, g);
  let r;
  try { r = g.breakthrough(); } catch (e) { r = { ok: false, msg: e.message }; }
  const msg = String((r && r.msg) || '');
  ok(r && r.ok !== true && new RegExp(needle).test(msg), `${label} → 被挡（${msg.slice(0, 24)}）`);
}
expectFail('战斗中', (s) => { s.combat = { type: 'river', hp: 1, maxHp: 1, atk: 1, armor: 0, turn: 1, intent: 'attack' }; }, '斗法中');
expectFail('未到后期', (s) => { s.level = 17; }, '后期');
expectFail('修为未满', (s) => { s.xp = 1; }, '修为未满');
expectFail('不在洞府', (s, g) => { g.s.settlements[0].pos = { x: 6, y: 6 }; }, '洞府');
expectFail('气血不足', (s) => { s.hp = 1; }, '气血');
expectFail('已在渡劫后期', (s) => { s.level = 36; s.xp = 0; }, '渡劫后期');

/* ---------- 4. 后期修满后不再自动跨境 ---------- */
{
  const g = readyState(18);
  g.s.xp = 0;
  g.xp(g.required * 3);               // 远超本段需求
  eq(g.s.level, 18, '后期修满后不再自动升段');
  eq(g.s.xp, g.required, '修为停在本段需求（等渡劫）');
  eq(g.s.pendingTribulation, 18, '记下待渡劫');
  ok(/本境已修至圆满/.test(html), '有「本境已修至圆满 · 可渡劫」提示');
}

/* ---------- 5. 旧选项式试炼不再卡破境（docs §十 明确不做） ---------- */
{
  const g = readyState(18);
  g.s.flags.coreTribulation = { phase: 0, marks: 0, started: false, complete: false };
  g.s.flags.heartTrial = { phase: 0, started: false, complete: false, choices: [] };
  const r = g.breakthrough();
  ok(r && r.ok, '三重雷考/问心未做也能渡劫（不再作为门槛）', JSON.stringify((r && r.msg) || ''));
}

/* ---------- 6. 材料不再消耗 ---------- */
{
  const g = readyState(18);
  const before = JSON.stringify(g.s.inv);
  g.breakthrough();
  eq(JSON.stringify(g.s.inv), before, '渡劫不消耗任何材料');
}

/* ---------- 7. 指引文案存在 ---------- */
ok(/渡劫/.test(html) && /圆满/.test(html), '源码含渡劫/圆满文案');

console.log(`REALM TRIBULATION PASS ${checks} checks（后期修满→渡劫→下一境；失败只重伤）`);
