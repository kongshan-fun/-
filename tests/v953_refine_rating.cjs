'use strict';
/* V90.53 验收：精炼经济闭环 + 战力境界系数按境序
 *
 * 依据 docs/境界与修为阶定义.md
 *   §二  战力 = round(… × 境界系数)，境界系数 = 1 + (境序-1)×0.12，12 境上限 2.32
 *   §五之三  精炼第 n 次 = 境序×3×n 灵尘；每阶 +6%；分解 = 境序×(1+品质)×(1+精炼×0.5) + 返还已投入 30%
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
ctx.localStorage = { _d: {}, getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, get length() { return 0; } };
vm.createContext(ctx);
for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);

const G = ctx.QGame, D = ctx.QData, R = ctx.QCombatRating;

function mkState(o = {}) {
  const s = G.fresh(o.seed || 20261027, 'human');
  s.level = o.level || 1; s.major = o.major || 0; s.zone = 0; s.unlocked = D.ZONES.length;
  s.hunger = 100; s.water = 100; s.life.left = 200 * D.LIFE.yearMinutes;
  s.cleared = Array(D.ZONES.length).fill(true); s.ritual = Array(D.ZONES.length).fill(true);
  const p = { x: 1, y: 5 };
  s.pos = { ...p }; s.last = { ...p };
  s.settlements[0] = { pos: { ...p }, level: 5, buildings: { warehouse: 5, forge: 5, alchemy: 5, quiet: 5, farm: 5 },
    stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  s.inv = { wood: 99, stone: 99, fiber: 99, dust: 5000, ore: 99 };
  return s;
}
const mk = (o) => new G(mkState(o));

/* ---------- 1. 境界系数按境序 ---------- */
{
  const cases = [[1, 0, 1, '1.00'], [3, 0, 1, '1.00'], [4, 0, 2, '1.12'], [7, 0, 3, '1.24'],
                 [18, 0, 6, '1.60'], [19, 0, 7, '1.72'], [36, 0, 12, '2.32']];
  const bad = [];
  for (const [level, major, idx, want] of cases) {
    const g = mk({ level, major });
    const got = R.live(g).realm;
    if (g.realmIndex !== idx || got !== want) bad.push(`L${level}/M${major} 境序${g.realmIndex}(期望${idx}) 系数${got}(期望${want})`);
  }
  ok(bad.length === 0, '境界系数 = 1+(境序-1)×0.12（凡人1.00 … 渡劫2.32）', bad.join(' '));
  ok(mk({ level: 36, major: 8 }).realmIndex === 12, '渡劫境序 = 12');
  const full = [];
  for (let i = 1; i <= 12; i++) full.push((1 + (i - 1) * 0.12).toFixed(2));
  ok(full[11] === '2.32' && full[5] === '1.60', '12 境系数曲线与 docs 一致', full.join(' '));
}

/* ---------- 2. 精炼消耗随境序放大 ---------- */
{
  const table = [[1, [3, 6, 9, 12, 15]], [6, [18, 36, 54, 72, 90]], [12, [36, 72, 108, 144, 180]]];
  const majors = { 1: 0, 6: 1, 12: 8 };
  const levels = { 1: 1, 6: 18, 12: 36 };
  for (const [idx, want] of table) {
    const g = mk({ level: levels[idx], major: majors[idx] });
    const got = [0, 1, 2, 3, 4].map((r) => g.refineCost({ refine: r }));
    ok(g.realmIndex === idx && got.join(',') === want.join(','),
      `境序 ${idx} 精炼消耗 = ${want.join('/')}`, got.join('/'));
  }
  const g = mk({ level: 1, major: 0 });
  ok(g.refineCost({ refine: 5 }) === 18, '第 6 次（已满级不该发生）仍是线性外推', String(g.refineCost({ refine: 5 })));
  ok(g.refineInvested({ refine: 5 }) === 45, '境序1 精炼到顶累计投入 45 灵尘（3+6+9+12+15）', String(g.refineInvested({ refine: 5 })));
  const g6 = mk({ level: 18, major: 1 });
  ok(g6.refineInvested({ refine: 5 }) === 270, '境序6 精炼到顶累计 270 灵尘（与 docs 表一致）', String(g6.refineInvested({ refine: 5 })));
}

/* ---------- 3. 精炼效果 +6% ---------- */
{
  const g = mk({ level: 1, major: 0 });
  const r = D.RECIPES.find((x) => x.gear === 'weapon');
  g.s.gears.push({ id: 'g1', recipe: r.id, quality: 0, refine: 0, affixes: [], source: '测试' });
  const base = g.gearBonus(g.s.gears[0]);
  g.s.gears[0].refine = 5;
  const top = g.gearBonus(g.s.gears[0]);
  ok(base === Math.round(r.bonus * 1 * 1), '精炼 0 时就是品质折算基础值', String(base));
  ok(top === Math.round(r.bonus * 1 * 1.30), '精炼 +5 = ×1.30（每阶 +6%）', `${base} → ${top}`);
  ok(g.refineStep === 0.06, '精炼步长 6%', String(g.refineStep));
  ok(!/refine\*\.08/.test(html), '旧的 +8% 已从代码里消失');
}

/* ---------- 4. 分解：随境序放大 + 返还 30% ---------- */
{
  const g = mk({ level: 1, major: 0 });
  const want = {
    '0,0': Math.floor(1 * (1 + 0) * 1) + 0,
    '1,0': Math.floor(1 * (1 + 1) * 1) + 0,
    '4,5': Math.floor(1 * (1 + 4) * (1 + 2.5)) + Math.floor(1 * 3 * 5 * 6 / 2 * 0.30),
  };
  const bad = [];
  for (const [key, exp] of Object.entries(want)) {
    const [q, ref] = key.split(',').map(Number);
    const got = g.salvageDust({ quality: q, refine: ref });
    if (got !== exp) bad.push(`${key}: ${got}≠${exp}`);
  }
  ok(bad.length === 0, '分解 = 境序×(1+品质)×(1+精炼×0.5) + 返还30%', bad.join(' '));

  const g6 = mk({ level: 18, major: 1 });
  ok(g6.salvageDust({ quality: 0, refine: 0 }) === 6, '境序6 普通裸装分解 6 灵尘（随境界放大）', String(g6.salvageDust({ quality: 0, refine: 0 })));
  /* 闭环校验：一件精炼到顶，分解拿不回本钱（经济不能自循环） */
  const cost = g6.refineInvested({ refine: 5 });
  const back = g6.salvageDust({ quality: 4, refine: 5 });
  ok(back < cost, '精炼到顶再分解仍亏（沉没成本保留）', `投入 ${cost} / 回收 ${back}`);
}

/* ---------- 5. 真跑一次精炼：扣对灵尘、加对属性 ---------- */
{
  const g = mk({ level: 18, major: 1 });      // 境序 6
  const r = D.RECIPES.find((x) => x.gear === 'weapon' && (x.zone || 0) === 0) || D.RECIPES.find((x) => x.gear === 'weapon');
  g.s.gears.push({ id: 'gT', recipe: r.id, quality: 0, refine: 0, affixes: [], source: '测试' });
  g.s.inv.dust = 1000;
  const before = g.s.inv.dust;
  const res = g.refine('gT');
  ok(res && res.ok, '在炼器室精炼一次成功', JSON.stringify((res && res.msg) || ''));
  ok(g.s.gears[0].refine === 1, '精炼等级 +1', String(g.s.gears[0].refine));
  ok(before - g.s.inv.dust === 18, '扣掉 境序6×3×1 = 18 灵尘', String(before - g.s.inv.dust));
  const b1 = Math.round(r.bonus * 1 * 1.06);
  ok(g.gearBonus(g.s.gears[0]) === b1, '属性 +1 阶 = 基础值 ×1.06（四舍五入）',
    `${Math.round(r.bonus * 1)} → ${g.gearBonus(g.s.gears[0])}（期望 ${b1}）`);
  /* 低境基础值小，6% 会被取整吃掉——这是定稿 6% 的固有现象，用高境基准确认真的在放大 */
  const big = D.RECIPES.filter((x) => x.gear === 'weapon').sort((a, b) => b.bonus - a.bonus)[0];
  const gb = mk({ level: 36, major: 8 });
  gb.s.gears.push({ id: 'gBig', recipe: big.id, quality: 0, refine: 0, affixes: [], source: '测试' });
  const n0 = gb.gearBonus(gb.s.gears[0]);
  gb.s.gears[0].refine = 5;
  const n5 = gb.gearBonus(gb.s.gears[0]);
  ok(n5 === Math.round(big.bonus * 1.30) && n5 > n0,
    `高境武器（基准 ${big.bonus}）精炼 +5 明显放大`, `${n0} → ${n5}`);
}

/* ---------- 6. 界面文案不再说 8% / 4-8-12 ---------- */
{
  ok(!/精炼每阶提高品质折算后基础属性8%/.test(html), '图鉴不再写「每阶 8%」');
  ok(!/分别花4\/8\/12灵尘/.test(html), '帮助页不再写固定「4/8/12 灵尘」');
  ok(/精炼每阶提高品质折算后基础属性6%/.test(html), '图鉴已改为「每阶 6%」');
  ok(/境序×3×n/.test(html), '帮助页写明「境序×3×n」');
  ok(!/灵尘'\+\(\(g\.refine\+1\)\*4\)/.test(html) && !/灵尘'\+\(selected\.refine\+1\)\*4/.test(html),
    '装备卡与人物面板的精炼按钮都用 refineCost');
  ok(/game\.refineCost\(g\)/.test(html) && /game\.refineCost\(selected\)/.test(html), '两处按钮都走 refineCost()');
}

/* ---------- 7. 排行榜口径提示（公式变了，旧成绩不可比，docs §二 要求榜上标注） ---------- */
ok(/战力算法自 V90\.53 起按十二境系数/.test(html), '排行榜注明战力算法分界（旧成绩仅供参考）');

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
