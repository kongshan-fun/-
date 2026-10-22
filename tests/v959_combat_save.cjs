'use strict';
/* V90.59 验收：战斗中存档不再失败（「存储未成功，先导出当前进度」）
   根因：normalize 重建 combat 时引用了 this.enemyBoost（normalize 没有 this）
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
ctx.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, key() { return null; }, get length() { return Object.keys(this._d).length; } };
vm.createContext(ctx);
for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);

const D = ctx.QData, G = ctx.QGame;
const RACE = 'human';

const persistLike = (g) => {
  const valid = new G(g.state(), 261014, RACE);
  return { raw: JSON.stringify(valid.state()), reloaded: valid };
};

function makeGame(zone, level) {
  const g = new G(G.fresh(20261019, RACE), 20261019, RACE);
  g.s.cleared = Array(D.ZONES.length).fill(true);
  g.s.unlocked = D.ZONES.length;
  g.s.level = level;
  g.s.major = (() => { const i = Math.min(12, Math.ceil(level / 3)); return i >= 12 ? 8 : i <= 5 ? 0 : i - 5; })();
  g.s.maxHp = 30000; g.s.hp = 30000;
  g.s.spirit = 8000; g.s.maxSpirit = 8000;
  g.s.life.left = 900 * D.LIFE.yearMinutes;
  g.s.hunger = 100; g.s.water = 100;
  g.s.zone = zone;
  const camp = zone ? { x: 0, y: 5 } : { x: 1, y: 5 };
  g.s.pos = { ...camp }; g.s.last = { ...camp };
  g.s.settlements = Array.from({ length: D.ZONES.length }, (_, z) => ({ pos: z ? { x: 0, y: 5 } : camp, level: 1, buildings: {} }));
  return g;
}

/* A. 合法高境状态：战斗中连续存档 60 回合不抛错 */
{
  const g = makeGame(9, 33);
  g.startBattle('realm9', false);
  ok(!!g.s.combat, 'A 成功开战', g.s.combat && g.s.combat.type);
  let err = null, turns = 0, maxBytes = 0;
  for (let i = 0; i < 60 && g.s.combat; i++) {
    g.s.hp = g.s.maxHp;
    g.fight(i % 3 === 0 ? 'spell' : 'attack');
    try { const r = persistLike(g); maxBytes = Math.max(maxBytes, r.raw.length); } catch (e) { err = e.message; break; }
    turns++;
  }
  ok(!err, 'A 战斗中每次存档都不抛错', err || (turns + ' 回合 / 峰值 ' + maxBytes + ' B'));
  ok(turns >= 20, 'A 实际打满 20 回合以上', turns + ' 回合');
}

/* B. 合法状态刷新前后对手数值一致 */
{
  const g = makeGame(9, 33);
  g.startBattle('realm9', false);
  const before = { maxHp: g.s.combat.maxHp, atk: g.s.combat.atk, zone: g.s.zone };
  const { reloaded } = persistLike(g);
  ok(reloaded.s.zone === before.zone, 'B 刷新后所在地图不变', before.zone + ' → ' + reloaded.s.zone);
  ok(reloaded.s.combat && reloaded.s.combat.maxHp === before.maxHp, 'B 刷新后对手气血不变',
    before.maxHp + ' → ' + (reloaded.s.combat && reloaded.s.combat.maxHp));
  ok(reloaded.s.combat && reloaded.s.combat.atk === before.atk, 'B 刷新后对手攻击不变',
    before.atk + ' → ' + (reloaded.s.combat && reloaded.s.combat.atk));
}

/* C. 极端越级状态（读档会被夹紧地图）也不许抛错 */
{
  const g = makeGame(9, 21);
  let err = null, reloaded = null;
  try { const r = persistLike(g); reloaded = r.reloaded; } catch (e) { err = e.message; }
  ok(!err, 'C 越级状态存档不抛错', err || 'ok');
  ok(!!reloaded && reloaded.s.zone <= reloaded.s.unlocked - 1, 'C 越级存档被夹紧到合法地图',
    reloaded ? ('zone=' + reloaded.s.zone + ' unlocked=' + reloaded.s.unlocked) : 'n/a');
}

/* D. 战斗外存档正常 */
{
  const g = makeGame(2, 9);
  g.s.combat = null;
  let err = null;
  try { persistLike(g); } catch (e) { err = e.message; }
  ok(!err, 'D 非战斗状态存档正常', err || 'ok');
}

/* E. 源码层 */
{
  const head = html.slice(0, html.indexOf('startBattle(type'));
  ok(!/this\.enemyBoost/.test(head), 'E normalize 段无 this.enemyBoost 残留');
  ok(/const _boost=1\+0\.10\*_gap/.test(html), 'E normalize 自行推导压制系数');
}

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
