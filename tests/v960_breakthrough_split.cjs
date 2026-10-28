// V90.75 fixture migration: unique homestead + explicit home context; numerical assertions retained.
'use strict';
/* V90.60 验收：
   A 凡人~筑基（境1→5）破境不渡劫：不掉血、不耗护劫丹
   B 金丹起（进入境6..12）仍需渡劫：扣固定伤害
   C 修为可超额累积：后期修满后继续获得修为不清零
   D 破境只扣本段需求，溢出保留
   E 双族各 11 次破境中，晋升 4 次 + 渡劫 7 次
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

function makeGame(race, level) {
  const g = new G(G.fresh(20261019, race), 20261019, race);
  g.s.cleared = Array(D.ZONES.length).fill(true);
  g.s.unlocked = D.ZONES.length;
  g.s.level = level;
  g.s.major = (() => { const i = Math.min(12, Math.ceil(level / 3)); return i >= 12 ? 8 : i <= 5 ? 0 : i - 5; })();
  g.s.maxHp = 8000; g.s.hp = 8000;
  g.s.spirit = 4000; g.s.maxSpirit = 4000;
  g.s.life.left = 900 * D.LIFE.yearMinutes;
  g.s.hunger = 100; g.s.water = 100;
  const camp = { x: 1, y: 5 };
  g.s.pos = { ...camp }; g.s.last = { ...camp };
  g.s.homestead={version:1,pos:{x:1,y:5},level:1,buildings:{},stash:{},storedGears:[],foundedAt:g.s.minutes,farmAt:g.s.minutes};g.s.atHome=true;
  g.s.combat = null;
  g.s.xp = g.required;
  return g;
}

/* A 境1→2、2→3、3→4、4→5：不渡劫 */
for (const level of [3, 6, 9, 12]) {
  const g = makeGame('human', level);
  ok(g.needsTribulation === false, `Lv${level}（境${level / 3}→${level / 3 + 1}）标记为晋升`, String(g.needsTribulation));
  const hp0 = g.s.hp, pill0 = g.s.inv.guardPill;
  g.s.inv.guardPill = 2;
  const r = g.breakthrough();
  ok(r && r.ok !== false, `Lv${level} 晋升成功`, r && r.msg);
  ok(g.s.level === level + 1, `Lv${level} 段位推进`, 'level=' + g.s.level);
  ok(g.s.hp === hp0, `Lv${level} 晋升不掉血`, hp0 + ' → ' + g.s.hp);
  ok(g.s.inv.guardPill === 2, `Lv${level} 晋升不耗护劫丹`, String(g.s.inv.guardPill));
  void pill0;
}

/* B 境5→6 起需要渡劫 */
for (const level of [15, 18, 21, 24, 27, 30, 33]) {
  const g = makeGame('human', level);
  g.s.maxHp = 60000; g.s.hp = 60000;
  ok(g.needsTribulation === true, `Lv${level}（境${level / 3}→${level / 3 + 1}）需要渡劫`, String(g.needsTribulation));
  const dmg = g.tribDamage;
  const r = g.breakthrough();
  ok(r && r.ok !== false, `Lv${level} 渡劫成功`, r && r.msg);
  ok(g.s.hp === Math.max(1, g.s.maxHp - dmg), `Lv${level} 渡劫扣血`, `${60000} → ${g.s.hp}（伤 ${dmg}）`);
}

/* C 修为可超额累积 */
{
  const g = makeGame('human', 15);      // 境5 后期（渡劫边界）
  g.s.xp = g.required;
  const need = g.required;
  g.xp(need * 3);                        // 再灌两大段
  ok(g.s.xp > need, 'C 后期修满后修为继续累积（不再夹紧）', g.s.xp + ' > ' + need);
  ok(g.s.pendingTribulation === g.s.level, 'C 仍等待渡劫结算', String(g.s.pendingTribulation));
}

/* D 破境只扣本段需求 */
{
  const g = makeGame('human', 15);
  g.s.maxHp = 60000; g.s.hp = 60000;
  const need = g.required;
  g.s.xp = need + 777;                   // 溢出 777
  const r = g.breakthrough();
  ok(r && r.ok !== false, 'D 渡劫成功', r && r.msg);
  ok(g.s.xp === 777, 'D 溢出修为保留 777', 'xp=' + g.s.xp);
}

/* E 双族 11 次破境：4 晋升 + 7 渡劫 */
for (const race of ['human', 'demon']) {
  const g = makeGame(race, 3);   // 从境1后期起步，每次破境都在边界
  g.s.maxHp = 80000; g.s.hp = 80000;
  let up = 0, trib = 0;
  for (let i = 0; i < 40 && g.s.level < 36; i++) {
    g.s.hp = g.s.maxHp;
    if (g.stageIndex !== 3) { g.xp(g.required * 2); continue; }   // 段内先修到后期
    g.s.xp = g.required;
    const wasTrib = g.needsTribulation;
    const r = g.breakthrough();
    if (!r || r.ok === false) { ok(false, race + ' 第 ' + (i + 1) + ' 次破境失败', r && r.msg); break; }
    if (wasTrib) trib++; else up++;
  }
  ok(g.s.level === 36, race + ' 走完 36 段', 'level=' + g.s.level);
  ok(up === 4, race + ' 晋升 4 次（境1→5）', 'up=' + up);
  ok(trib === 7, race + ' 渡劫 7 次（境6→12）', 'trib=' + trib);
}

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
