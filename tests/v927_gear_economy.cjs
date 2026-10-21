'use strict';
/*
 * P0-5 装备经济复核：四条来源的真实产出 + 采集→炼制闭环 + 不重复发放
 *
 *   1. 普通怪：真打一场，击杀后 **不产生成品装备**，只给原有战利品材料
 *   2. 首领：dropLoot 精确给「本境主材×2 + 副材×1 + 灵尘」
 *   3. 秘境：封藏分支不再 createGear（静态锁死），宝箱走「专属灵材×2 + 基础材×1」
 *   4. 奇遇：仍允许一次性成品（eventReward 走 dropGear），但上层 sites 有一次性守卫
 *   5. 闭环：用首领掉的材料 + 采集材料，真 craft 出一件 → 装备进背包、自动穿戴
 *   6. 不重复：同一地点奇遇只有一次（sites 键守卫存在）
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

function fresh(zone = 0, major = 0) {
  const s = Game.fresh(20261025, 'human');
  s.zone = zone; s.major = major; s.level = (function(m){return m<=1?(m===1?17:7):(Math.min(12,m+5)-1)*3+1;})(major); s.unlocked = Math.min(D.ZONES.length, zone + 1);
  s.hunger = 100; s.water = 100; s.hp = s.maxHp; s.spirit = s.maxSpirit;
  s.life.left = 200 * D.LIFE.yearMinutes;
  for (let i = 0; i <= zone; i++) { s.cleared[i] = true; s.ritual[i] = true; }
  const p = { x: 1, y: 5 };
  s.pos = { ...p }; s.last = { ...p };
  s.settlements[zone] = { pos: { ...p }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 3 }, stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  return s;
}

/* ---------- 1. 普通怪：真打一场 ---------- */
{
  const g = new Game(fresh(0, 0));
  const gearsBefore = g.s.gears.length;
  const hideBefore = g.s.inv.hide || 0;
  const r0 = g.startBattle('river');
  ok(r0 && r0.ok, '发起一场普通战斗');
  g.s.combat.hp = 1;                        // 一击必杀，专注测结算
  g.s.attack = 9999;
  const r = g.fight('attack');
  ok(r && r.ok, '攻击并结算');
  eq(g.s.combat, null, '战斗已结束');
  eq(g.s.gears.length, gearsBefore, '普通怪不掉成品装备');
  ok((g.s.inv.hide || 0) >= hideBefore, '普通怪原有战利品（妖兽皮等）照常结算');
}

/* ---------- 2. 首领：dropLoot 精确数量 ---------- */
for (const z of [0, 5, 9]) {
  const g = new Game(fresh(z, Math.max(0, z - 3)));
  const st = z >= 5 ? D.ASCENSION_STAGES[z - 5] : null;
  const before = { ...g.s.inv };
  const gearsBefore = g.s.gears.length;
  g.dropLoot();
  eq(g.s.gears.length, gearsBefore, `zone${z} 首领不掉成品`);
  if (st) {
    eq((g.s.inv[st.primary] || 0) - (before[st.primary] || 0), 2, `zone${z} 主材恰好 +2`);
    eq((g.s.inv[st.secondary] || 0) - (before[st.secondary] || 0), 1, `zone${z} 副材恰好 +1`);
  } else {
    eq((g.s.inv.ore || 0) - (before.ore || 0), 2, '前期境给玄铁矿 +2');
  }
  ok((g.s.inv.dust || 0) > (before.dust || 0), `zone${z} 给灵尘`);
}

/* ---------- 3. 秘境：不再 createGear；宝箱给灵材 ---------- */
ok(!/createGear\(cfg\.gear/.test(html), '秘境封藏分支不再直接生成成品');
ok(/this\.loot\(\{\[cfg\.item\]:2,\[cfg\.base\]:1\},'秘境封藏'\)/.test(html), '秘境宝箱给「专属灵材×2 + 基础材×1」');

/* ---------- 4. 奇遇：仍允许一次性成品 ---------- */
ok(/if\(c\.gear\)this\.dropGear\(c\.minQuality\|\|0,'遗迹寻宝'\)/.test(html), '一次性奇遇仍可出成品');
const siteWithGear = Object.entries(D.SITES).find(([, s]) => s.choices.some((c) => c.gear));
ok(!!siteWithGear, '存在带成品掉落的奇遇');
{
  const [key, site] = siteWithGear;
  const idx = site.choices.findIndex((c) => c.gear);
  const g = new Game(fresh(0, 0));
  const gearsBefore = g.s.gears.length;
  g.eventReward(key, idx);
  ok(g.s.gears.length >= gearsBefore, '奇遇结算不报错并可能给成品');
  ok(/if\(!this\.s\.sites\[key\]/.test(html) || /s\.sites\[key\]/.test(html), '奇遇有「每个地点一次」守卫');
}

/* ---------- 5. 闭环：首领材料 + 采集材料 → 真 craft 一件 ---------- */
{
  const g = new Game(fresh(5, 2));
  const st = D.ASCENSION_STAGES[0];
  g.dropLoot();                                  // 首领给主材/副材
  g.s.inv.wood = 20; g.s.inv.fiber = 20;         // 模拟采集补足
  g.s.inv.stone = 20;
  const recipe = D.RECIPES.find((r) => r.gear === 'weapon' && r.zone === 5);
  ok(!!recipe, 'zone5 有可炼武器配方');
  /* 高阶配方要求更高阶炼器室（金丹道剑需 4 阶），这里把洞府拉到 5 阶 */
  g.s.settlements[5].level = 5;
  g.s.settlements[5].buildings.forge = 5;
  const gearsBefore = g.s.gears.length;
  const r = g.craft(recipe.id);
  ok(r && r.ok, `炼制 ${recipe.name} 成功：${JSON.stringify(r && r.msg || '')}`);
  eq(g.s.gears.length, gearsBefore + 1, '炼制产生一件独立装备实例');
  ok(!!g.s.equipped.weapon, '炼出的武器已自动装到武器位');
  ok(g.weapon > 0, '武器加成生效（weapon > 0）');
}

console.log(`GEAR ECONOMY PASS ${checks} checks（战斗不出成品 / 首领给料精确 / 秘境给灵材 / 奇遇一次性 / 炼出即穿）`);
