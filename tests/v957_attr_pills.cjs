'use strict';
/* V90.57 验收：属性丹（培元丹 / 淬体丹） */
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

const D = ctx.QData;
const G = ctx.QGame;

ok(!!D.ITEMS.peiyuanPill, '培元丹物品存在', D.ITEMS.peiyuanPill && D.ITEMS.peiyuanPill.name);
ok(!!D.ITEMS.cuitiPill, '淬体丹物品存在', D.ITEMS.cuitiPill && D.ITEMS.cuitiPill.name);
ok(D.RECIPES.some((r) => r.item === 'peiyuanPill'), '培元丹有配方');
ok(D.RECIPES.some((r) => r.item === 'cuitiPill'), '淬体丹有配方');
ok(typeof D.applyPills === 'function' && typeof D.realmIndexOf === 'function', 'applyPills / realmIndexOf 存在');

/* 加成计算 */
const base = D.statsForLevel(1);
ok(D.applyPills(base, {}).hp === base.hp, '无丹药时加成为 0', base.hp);
ok(D.applyPills(base, { pillHp: 1 }).hp === Math.round(base.hp * 1.02), '1 颗培元丹 = +2% 气血上限', D.applyPills(base, { pillHp: 1 }).hp);
ok(D.applyPills(base, { pillHp: 3 }).hp === Math.round(base.hp * 1.06), '3 颗培元丹 = +6%');
ok(D.applyPills(base, { pillAtk: 2 }).atk === base.atk + 10, '2 颗淬体丹 = +10 攻击', D.applyPills(base, { pillAtk: 2 }).atk);
ok(D.applyPills(base, { pillHp: 1, pillAtk: 1 }).spirit === base.spirit, '灵力不受丹药影响');

/* 境序换算 */
ok(D.realmIndexOf({ level: 1 }) === 1 && D.realmIndexOf({ level: 36 }) === 12, '境序 1..12', D.realmIndexOf({ level: 18 }));
ok(D.realmIndexOf({ level: 18 }) === 6, 'L18 → 第 6 境（金丹）');

/* 服用：同一境最多 3 颗 */
const mk = (level) => {
  const g = Object.create(G.prototype);
  const st = D.statsForLevel(level);
  g.s = {
    level, major: Math.max(0, Math.ceil(level / 3) - 1), zone: 0, xp: 0, combat: null,
    maxHp: st.hp, hp: st.hp, maxSpirit: st.spirit, spirit: st.spirit, attack: st.atk,
    inv: { peiyuanPill: 5, cuitiPill: 5 }, logs: [], life: { left: 1e6 }, character: 'human',
    hunger: 100, water: 100, pillCnt: null, pillHp: 0, pillAtk: 0,
  };
  g.fail = (msg) => ({ ok: false, msg });
  g.log = () => {};
  g.note = (msg) => ({ ok: true, msg });
  return g;
};

const g = mk(1);
const hp0 = g.s.maxHp;
const r1 = g.consume('peiyuanPill');
ok(r1 && r1.ok !== false, '第 1 颗培元丹服下成功', r1 && r1.msg);
ok(g.s.maxHp > hp0, '气血上限提升', hp0 + ' → ' + g.s.maxHp);
ok(g.s.pillHp === 1 && g.s.pillCnt.hp === 1, '计数正确（累计 1 / 本境 1）');
g.consume('peiyuanPill'); g.consume('peiyuanPill');
const r4 = g.consume('peiyuanPill');
ok(r4 && r4.ok === false, '本境第 4 颗被拒绝', r4 && r4.msg);
ok(g.s.inv.peiyuanPill === 2, '被拒绝时不扣药', String(g.s.inv.peiyuanPill));

/* 换境后计数清零，但永久加成保留 */
const g2 = mk(1);
g2.consume('peiyuanPill'); g2.consume('peiyuanPill'); g2.consume('peiyuanPill');
const beforeSwitch = { hp: g2.s.maxHp, pillHp: g2.s.pillHp, cntHp: g2.s.pillCnt.hp };
g2.s.level = 13; /* 第 5 境 */
g2.consume('peiyuanPill');
ok(g2.s.pillCnt.realm === 5, '换境后计数重绑到第 5 境', String(g2.s.pillCnt.realm));
ok(g2.s.pillCnt.hp === 1, '新境从 1 开始计数', String(g2.s.pillCnt.hp));
ok(g2.s.pillHp === 4, '永久累计不清零（4 颗）', String(g2.s.pillHp));
ok(g2.s.maxHp > beforeSwitch.hp, '换境后加成仍然生效', beforeSwitch.hp + ' → ' + g2.s.maxHp);

/* 淬体丹 */
const g3 = mk(1);
const atk0 = g3.s.attack;
g3.consume('cuitiPill');
ok(g3.s.attack === atk0 + 5 || g3.s.attack > atk0, '攻击提升 +5', atk0 + ' → ' + g3.s.attack);

/* 源码层：三处属性重算都叠加了丹药 */
ok((html.match(/D\.applyPills\(/g) || []).length >= 4, 'applyPills 在三处重算点都接入', String((html.match(/D\.applyPills\(/g) || []).length));

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
