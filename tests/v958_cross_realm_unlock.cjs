'use strict';
/* V90.58 缺陷复现：渡劫成功后未立即解锁下一境（必须刷新才生效）
   覆盖人族 / 妖族 × 6 个境边界 = 12 组
   映射：zone i 的玩家处于 idx=i+2 境（major=i-3），渡劫后 idx+1、major+1 */
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

const D = ctx.QData, G = ctx.QGame;
const ZONES = D.ZONES.length;

function stageAt(race, zone) {
  const idx = zone + 2;            // 站在 zone i 的应有境序
  const level = 3 * idx;           // 该境后期
  const raw = G.fresh(20261019, race);
  raw.level = level;
  raw.major = Math.ceil(level / 3) - 1;
  raw.zone = zone;
  raw.cleared = Array(ZONES).fill(false);
  for (let i = 0; i <= zone; i++) raw.cleared[i] = true;
  raw.ritual = Array(ZONES).fill(true);
  raw.ascended = false;
  const g = new G(raw, 20261019, race);
  g.s.level = level;
  g.s.major = (() => { const i2 = Math.min(12, Math.ceil(level / 3)); return i2 >= 12 ? 8 : i2 <= 5 ? 0 : i2 - 5; })();
  g.s.zone = zone;
  g.s.cleared = Array(ZONES).fill(false);
  for (let i = 0; i <= zone; i++) g.s.cleared[i] = true;
  g.s.ritual = Array(ZONES).fill(true);
  g.s.ascended = false;
  g.s.xp = g.required;
  const camp = zone ? { x: 0, y: 5 } : { x: 1, y: 5 };
  g.s.pos = { ...camp };
  g.s.last = { ...camp };
  g.s.settlements = Array.from({ length: ZONES }, (_, z) => ({ pos: z ? { x: 0, y: 5 } : { x: 1, y: 5 }, level: 1, buildings: {} }));
  g.s.maxHp = Math.max(g.s.maxHp, 60000);
  g.s.hp = g.s.maxHp;
  g.s.spirit = g.s.maxSpirit;
  g.s.life.left = 900 * D.LIFE.yearMinutes;
  g.s.hunger = 100; g.s.water = 100;
  g.s.combat = null;
  g.s.unlocked = Math.max(1, zone + 1);
  return g;
}

console.log('=== 渡劫 → 立即换图（不刷新） ===');
let groups = 0;
for (const race of ['human', 'demon']) {
  for (const zone of [5, 6, 7, 8, 9]) {
    const g = stageAt(race, zone);
    const before = { lv: g.s.level, major: g.s.major, unlocked: g.s.unlocked };
    const need = Math.min(ZONES, zone + 2);
    const r = g.breakthrough();
    const label = `${race} zone${zone}（境${Math.ceil(before.lv / 3)}→${Math.ceil((before.lv + 1) / 3)}）`;
    groups++;
    if (!r || r.ok === false) { ok(false, label + ' 渡劫可发起', r && r.msg); continue; }
    ok(g.s.level === before.lv + 1, label + ' 修为推进到下一境', `level ${before.lv}→${g.s.level}`);
    ok(g.s.unlocked >= need, label + ' 立即解锁下一境', `unlocked ${before.unlocked}→${g.s.unlocked}，期望≥${need}`);
  }
}

console.log(`\n覆盖组数 ${groups}；合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
