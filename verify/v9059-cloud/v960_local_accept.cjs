'use strict';
/* V90.59 云端包 独立验收（不依赖对方脚本，按行为断言）
   覆盖：①战斗中存档 ②前四境晋升/第五境起渡劫 ③修为超额继承
        ④十二境全链 + 飞升 ⑤双族一致 */
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

function makeGame(race, level, zone) {
  const g = new G(G.fresh(20261019, race), 20261019, race);
  g.s.cleared = Array(ZONES).fill(true);
  g.s.unlocked = ZONES;
  g.s.level = level;
  g.s.major = (() => { const i = Math.min(12, Math.ceil(level / 3)); return i >= 12 ? 8 : i <= 5 ? 0 : i - 5; })();
  g.s.life.left = 900 * D.LIFE.yearMinutes;
  g.s.hunger = 100; g.s.water = 100;
  const st = D.statsForLevel(level);
  if (st) { g.s.maxHp = st.hp; g.s.maxSpirit = st.spirit; g.s.attack = st.atk; }
  g.s.hp = g.s.maxHp;
  g.s.spirit = g.s.maxSpirit;
  g.s.zone = zone === undefined ? 9 : zone;
  const camp = g.s.zone ? { x: 0, y: 5 } : { x: 1, y: 5 };
  g.s.pos = { ...camp }; g.s.last = { ...camp };
  g.s.settlements = Array.from({ length: ZONES }, (_, z) => ({ pos: z ? { x: 0, y: 5 } : camp, level: 1, buildings: {} }));
  g.s.combat = null;
  g.s.xp = g.required;
  return g;
}
const persistLike = (g) => { const v = new G(g.state(), 261014, g.s.character); return { raw: JSON.stringify(v.state()), reloaded: v }; };

console.log('\n=== ① 战斗中存档 ===');
{
  const g = makeGame('human', 33);
  g.startBattle('realm9', false);
  ok(!!g.s.combat, '成功开战', g.s.combat && g.s.combat.type);
  const before = { maxHp: g.s.combat.maxHp, atk: g.s.combat.atk };
  let err = null, turns = 0, maxBytes = 0;
  for (let i = 0; i < 60 && g.s.combat; i++) {
    g.s.hp = g.s.maxHp;
    g.fight(i % 3 === 0 ? 'spell' : 'attack');
    try { const r = persistLike(g); maxBytes = Math.max(maxBytes, r.raw.length); } catch (e) { err = e.message; break; }
    turns++;
  }
  ok(!err, '战斗中连续存档不抛错', err || (turns + ' 回合 / 峰值 ' + maxBytes + ' B'));
  const g2 = makeGame('human', 33);
  g2.startBattle('realm9', false);
  const b2 = { maxHp: g2.s.combat.maxHp, atk: g2.s.combat.atk };
  const { reloaded } = persistLike(g2);
  ok(reloaded.s.combat && reloaded.s.combat.maxHp === b2.maxHp, '刷新后对手气血不变', b2.maxHp + ' → ' + (reloaded.s.combat && reloaded.s.combat.maxHp));
  ok(reloaded.s.combat && reloaded.s.combat.atk === b2.atk, '刷新后对手攻击不变', b2.atk + ' → ' + (reloaded.s.combat && reloaded.s.combat.atk));
  void before;
}

console.log('\n=== ② 前四境晋升 / 第五境起渡劫 ===');
for (const [lvl, expectEarly] of [[3, true], [6, true], [9, true], [12, true], [15, false], [18, false]]) {
  const g = makeGame('human', lvl);
  const hp0 = g.s.hp;
  g.s.inv.guardPill = 2;
  const r = g.breakthrough();
  const label = `Lv${lvl}（境${Math.ceil(lvl / 3)}→${Math.ceil(lvl / 3) + 1}）`;
  ok(r && r.ok !== false, label + ' 破境成功', r && r.msg);
  ok(g.s.level === lvl + 1, label + ' 段位 +1', 'level=' + g.s.level);
  if (expectEarly) {
    ok(g.s.hp === hp0, label + ' 晋升不掉血（绝对气血不变）', hp0 + ' → ' + g.s.hp + '/' + g.s.maxHp);
    ok(g.s.inv.guardPill === 2, label + ' 晋升不耗护劫丹', String(g.s.inv.guardPill));
  } else {
    ok(g.s.hp < g.s.maxHp, label + ' 渡劫后掉血', g.s.hp + '/' + g.s.maxHp);
  }
}

console.log('\n=== ③ 修为超额继承 ===');
{
  const g = makeGame('human', 15);
  const need = g.required;
  g.xp(need * 2);
  ok(g.s.xp > need, '后期修满后修为继续累积', g.s.xp + ' > ' + need);
  ok(g.s.pendingTribulation === g.s.level, '仍在边界等待玩家操作', String(g.s.pendingTribulation));
  const g2 = makeGame('human', 15);
  const need2 = g2.required;
  g2.s.xp = need2 + 777;
  const r = g2.breakthrough();
  ok(r && r.ok !== false, '带溢出破境成功', r && r.msg);
  ok(g2.s.xp >= 777, '溢出部分保留（可能已并入下级）', 'xp=' + g2.s.xp);
}

console.log('\n=== ④ 双族 12 境全链 + 飞升 ===');
for (const race of ['human', 'demon']) {
  const g = makeGame(race, 3);
  let promos = 0, tribs = 0;
  for (let i = 0; i < 60 && g.s.level < 36; i++) {
    g.s.hp = g.s.maxHp;
    if (g.stageIndex !== 3) { g.xp(g.required * 2); continue; }
    g.s.xp = g.required;
    const early = g.realmIndex <= 4;
    const r = g.breakthrough();
    if (!r || r.ok === false) { ok(false, race + ' 第 ' + (promos + tribs + 1) + ' 次破境失败', r && r.msg); break; }
    if (early) promos++; else tribs++;
  }
  ok(g.s.level === 36, race + ' 修满 36 段', 'level=' + g.s.level);
  ok(promos === 4, race + ' 晋升 4 次（境1→5）', 'promos=' + promos);
  ok(tribs === 7, race + ' 渡劫 7 次（境6→12）', 'tribs=' + tribs);
  /* 飞升 */
  g.s.zone = ZONES - 1;
  g.s.xp = g.required;
  g.s.inv = Object.assign({}, g.s.inv, D.ASCENSION_RULE.cost);
  let placed = false;
  for (let y = 0; y < 8 && !placed; y++) for (let x = 0; x < 8 && !placed; x++) {
    if (g.land(x, y) === 'gate') { g.s.pos = { x, y }; g.s.last = { x, y }; placed = true; }
  }
  const ar = g.ascend();
  ok(placed && ar && ar.ok !== false, race + ' 飞升成功', ar && (ar.msg || 'ok'));
  ok(g.s.ascended === true, race + ' 飞升状态写入', String(g.s.ascended));
}

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
