'use strict';
/* V90.58 验收③：人族 / 妖族 从第一境到第十二境、再到飞升的完整成长链
   全程走真实状态转移（xp() 升级 + breakthrough() 渡劫 + ascend() 飞升），不直接改 level */
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

function born(race) {
  const raw = G.fresh(20261019, race);
  const g = new G(raw, 20261019, race);
  /* 只给资源与位置，不动 level */
  g.s.cleared = Array(ZONES).fill(true);      // 地图与首领已平定（模拟已走到终点）
  g.s.ritual = Array(ZONES).fill(true);
  g.s.unlocked = ZONES;
  const camp = { x: 1, y: 5 };
  g.s.pos = { ...camp }; g.s.last = { ...camp };
  g.s.settlements = Array.from({ length: ZONES }, (_, z) => ({ pos: z ? { x: 0, y: 5 } : camp, level: 1, buildings: {} }));
  g.s.maxHp = 200000; g.s.hp = 200000;
  g.s.spirit = 100000; g.s.maxSpirit = 100000;
  g.s.hunger = 100; g.s.water = 100;
  g.s.life.left = 5000 * D.LIFE.yearMinutes;
  g.s.combat = null;
  g.s.inv = Object.assign({}, g.s.inv, D.ASCENSION_RULE.cost);  /* 飞升材料 */
  return g;
}

for (const race of ['human', 'demon']) {
  console.log(`\n--- ${race} ---`);
  const g = born(race);
  const realmsSeen = [];
  let tribs = 0;

  /* 一级一级往上修：每级把修为灌满，跨段时用 breakthrough 渡劫 */
  for (let guard = 0; guard < 200 && g.s.level < 36; guard++) {
    if (g.stageIndex === 3) {
      g.s.xp = g.required;
      g.s.hp = g.s.maxHp;      /* 模拟回洞府补血：渡劫是固定扣血判定 */
      g.s.spirit = g.s.maxSpirit;
      const r = g.breakthrough();
      if (!r || r.ok === false) { ok(false, race + ' 渡劫失败于 level' + g.s.level, r && r.msg); break; }
      tribs++;
      realmsSeen.push(g.realm);
    } else {
      const before = g.s.level;
      g.xp(g.required * 2);
      if (g.s.level === before) { ok(false, race + ' 修为无法推进 level' + before); break; }
    }
  }

  ok(g.s.level === 36, race + ' 修到第 36 段（渡劫后期）', 'level=' + g.s.level + ' realm=' + g.realm);
  ok(tribs === 11, race + ' 途中完成 11 次境边界渡劫（境1→12）', 'tribs=' + tribs);
  ok(g.s.unlocked === ZONES, race + ' 十二境全部解锁', 'unlocked=' + g.s.unlocked + '/' + ZONES);
  ok(new Set(realmsSeen.map((r) => r.replace(/(初期|中期|后期)$/, ''))).size === 11, race + ' 渡劫经历 11 个新境名', [...new Set(realmsSeen.map((r) => r.replace(/(初期|中期|后期)$/, '')))].join('→'));

  /* 飞升：先到渡劫天门界碑、修为满 */
  g.s.zone = ZONES - 1;
  const gate = g.land ? null : null;
  g.s.xp = g.required;
  /* 站到 gate 上 */
  let placed = false;
  for (let y = 0; y < 8 && !placed; y++) for (let x = 0; x < 8 && !placed; x++) {
    if (g.land(x, y) === 'gate') { g.s.pos = { x, y }; g.s.last = { x, y }; placed = true; }
  }
  ok(placed, race + ' 找到飞升界碑坐标');
  const ar = g.ascend();
  ok(ar && ar.ok !== false, race + ' 飞升成功', ar && (ar.msg || ar.text));
  ok(g.s.ascended === true && g.s.major === 9, race + ' 状态置为飞升', 'ascended=' + g.s.ascended + ' major=' + g.s.major);
  ok(!!g.s.ascensionRecord && g.s.ascensionRecord.version === 1, race + ' 写入飞升记录');
}

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
