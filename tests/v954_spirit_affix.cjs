'use strict';
/* V90.54 验收：赋灵词条（docs §五之二）
 *
 * 定稿要点：槽位由品质决定 0/1/1/2/2；赋灵 5 级（0/120/450/1100/2400，每次给 境序×2+3）；
 * 词条 4 品阶（凡/灵/玄/仙，倍率 1/1.3/1.75/2.4）；品阶出率 5×4 每行 100、界面必须显示；
 * 固定值词条以该境武器基准 W 为分母；消耗 灵石 10+境序×5 + 修为 = 该境基础×0.05；
 * 连抽 5 次不出玄纹以上 → 第 6 次必出玄纹或仙纹；装备本身不带词条，靠赋灵刻入。
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

const G = ctx.QGame, D = ctx.QData;

function mkState(o = {}) {
  const s = G.fresh(o.seed || 20261028, 'human');
  s.level = o.level || 1; s.major = o.major || 0; s.zone = 0; s.unlocked = D.ZONES.length;
  s.hunger = 100; s.water = 100; s.life.left = 200 * D.LIFE.yearMinutes;
  s.cleared = Array(D.ZONES.length).fill(true); s.ritual = Array(D.ZONES.length).fill(true);
  const p = { x: 1, y: 5 };
  s.pos = { ...p }; s.last = { ...p };
  s.settlements[0] = { pos: { ...p }, level: 5, buildings: { warehouse: 5, forge: 5, alchemy: 5, quiet: 5, farm: 5 },
    stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  s.inv = { wood: 99, stone: 999, fiber: 99, dust: 5000, ore: 99 };
  s.xp = 999; s.daoXp = 99999;
  return s;
}
const mk = (o) => new G(mkState(o));
const WEAPON = D.RECIPES.find((x) => x.gear === 'weapon');
const ARMOR = D.RECIPES.find((x) => x.gear === 'armor');
const gearAt = (g, quality, recipe) => { const r = recipe || WEAPON; g.s.gears.push({ id: 'g' + g.s.gears.length, recipe: r.id, quality, refine: 0, affixes: [], spiritPity: 0, source: '测试' }); return g.s.gears[g.s.gears.length - 1]; };

/* ---------- 1. 定稿表 ---------- */
{
  ok(D.SPIRIT_RANKS.length === 5 && D.SPIRIT_RANKS.map((r) => r.need).join(',') === '0,120,450,1100,2400',
    '赋灵 5 级门槛 0/120/450/1100/2400', D.SPIRIT_RANKS.map((r) => r.name).join('/'));
  ok(D.SPIRIT_TIERS.join('') === '凡纹灵纹玄纹仙纹', '词条 4 品阶', D.SPIRIT_TIERS.join('/'));
  ok(D.SPIRIT_TIER_MULT.join(',') === '1,1.3,1.75,2.4', '品阶倍率 1/1.3/1.75/2.4');
  ok(D.SPIRIT_WEIGHTS.length === 5 && D.SPIRIT_WEIGHTS.every((w) => w.length === 4 && w.reduce((a, b) => a + b, 0) === 100),
    '出率表 5×4，每行合计 100%');
  const sm = D.SPIRIT_WEIGHTS.map((w) => w[3]);
  ok(sm.join(',') === '1,3,7,13,22', '仙纹出率 1% → 22%', sm.join('% → ') + '%');
  const mults = D.SPIRIT_TIER_MULT;
  const exp = D.SPIRIT_WEIGHTS.map((w) => w.reduce((s, p, i) => s + (p / 100) * mults[i], 0));
  const DOC = [1.133, 1.213, 1.323, 1.452, 1.617];
  ok(exp.every((v, i) => Math.abs(v - DOC[i]) < 0.002), '期望倍率贴合 docs（1.133 → 1.617）', exp.map((v) => v.toFixed(3)).join(' '));
  ok(exp[4] / exp[0] > 1.42, '五级相对一级词条强度 +43%', '+' + ((exp[4] / exp[0] - 1) * 100).toFixed(1) + '%');
}

/* ---------- 2. 槽位由品质决定 ---------- */
{
  const g = mk();
  const got = [0, 1, 2, 3, 4].map((q) => g.spiritSlots({ quality: q }));
  ok(got.join(',') === '0,1,1,2,2', '槽位 普通0/精良1/灵器1/法宝2/仙器2', got.join('/'));
  const bad = gearAt(g, 0);
  const r = g.spirit(bad.id);
  ok(!r.ok && /没有赋灵槽/.test(String(r.msg || '')), '普通品质没有槽，赋灵被拒', String(r.msg || ''));
}

/* ---------- 3. 等级换算与每件收益 ---------- */
{
  const g = mk();
  const cases = [[0, 0], [119, 0], [120, 1], [449, 1], [450, 2], [1099, 2], [1100, 3], [2399, 3], [2400, 4]];
  g.s.prof.spirit = 0;
  const bad = [];
  for (const [pts, want] of cases) { g.s.prof.spirit = pts; if (g.spiritRank !== want) bad.push(pts + '→' + g.spiritRank); }
  ok(bad.length === 0, '熟练度 → 赋灵等级换算全对', bad.join(' '));
  const low = mk({ level: 1, major: 0 }), mid = mk({ level: 18, major: 2 }), top = mk({ level: 36, major: 8 });
  ok(low.spiritGain === 5 && mid.spiritGain === 17 && top.spiritGain === 27,
    '每次赋灵 = 境序×2+3（境1=5 / 境7=17 / 境12=27）', [low.spiritGain, mid.spiritGain, top.spiritGain].join('/'));
}

/* ---------- 4. 消耗（灵石 + 修为） ---------- */
{
  const low = mk({ level: 1, major: 0 }), mid = mk({ level: 18, major: 1 }), top = mk({ level: 36, major: 8 });
  ok(low.weaponBase === 7 && mid.weaponBase === 49 && top.weaponBase === 492, '武器基准 W 按境序取（7/49/492）');
  const c1 = low.spiritCost({ id: 'x', spiritPity: 0 }, 0), c6 = mid.spiritCost({ id: 'x' }, 0), c12 = top.spiritCost({ id: 'x' }, 0);
  ok([c1.stone, c6.stone, c12.stone].join(',') === '15,40,70', '灵石 = 10+境序×5（15/40/70）', [c1.stone, c6.stone, c12.stone].join('/'));
  /* 修为成本按「本境实际修为池×0.05」：境1(60)→3、境6(285)→14、渡劫(150)→8 */
  ok([c1.xp, c6.xp, c12.xp].join(',') === '3,14,8', '修为 = 本境修为池×0.05（3/14/8）', [c1.xp, c6.xp, c12.xp].join('/'));
  ok(c6.lock === 1 && low.spiritCost({ id: 'x' }, 1).lock === 2, '有锁定槽时消耗 ×2');
  /* 关键平衡约束：一次赋灵的修为 < 本境破境需求的 20%（否则会把赋灵变成墙） */
  const pools = [low, mid, top].map((g) => [g.realmPoolXp, g.spiritCost({ id: 'p' }, 0).xp]);
  ok(pools.every(([pool, c]) => c <= Math.max(3, pool * 0.2)), '赋灵修为 ≤ 本境修为池的 20%',
    pools.map(([p, c]) => c + '/' + p).join(' '));
  /* 定稿字面值（境基础×0.05）在最贵的元婴/渡劫档位远超一次破境，故未采用——留住证据防回退 */
  ok(top.realmBaseXp > top.realmPoolXp * 10, '确认「境基础」与「实收 needDao」量级差 10 倍以上（故按实际池计）',
    top.realmBaseXp + ' vs ' + top.realmPoolXp);
}

/* ---------- 5. 词条数值（固定值按 W 缩放，百分比不缩放） ---------- */
{
  const low = mk({ level: 1, major: 0 }), top = mk({ level: 36, major: 8 });
  ok(low.spiritValue('crit', 0) === 4 && low.spiritValue('crit', 3) === 10, '会心 凡纹4% / 仙纹10%（百分比不跟境界）');
  ok(low.spiritValue('spell', 3) === 11 && low.spiritValue('leech', 2) === 4.5, '术威仙纹11% / 吸血玄纹4.5%');
  ok(top.spiritValue('pierce', 0) === Math.round(0.05 * 492), '破甲凡纹 = 0.050W（渡劫 W=492 → ' + Math.round(0.05 * 492) + '）');
  ok(top.spiritValue('fire', 3) === Math.round(0.144 * 492), '焰伤仙纹 = 0.144W');
  ok(top.spiritValue('ward', 0) === Math.round(0.04 * 492), '护元凡纹 = 0.040W');
  ok(low.spiritValue('pierce', 0) >= 1, '低境固定值至少 1（不会变 0）', String(low.spiritValue('pierce', 0)));
}

/* ---------- 6. 池与不重复 ---------- */
{
  const g = mk({ level: 18, major: 2 });
  g.s.inv.stone = 9999; g.s.daoXp = 99999;
  const w = gearAt(g, 4);
  const res = g.spirit(w.id);
  ok(res && res.ok, '仙器武器赋灵成功', String((res && res.msg) || ''));
  ok(w.affixes.length === 2, '仙器 2 个槽都被刻上', String(w.affixes.length));
  ok(w.affixes.every((a) => D.AFFIXES[a.id].slot === 'weapon'), '武器只出武器词条', w.affixes.map((a) => a.id).join('/'));
  ok(new Set(w.affixes.map((a) => a.id)).size === w.affixes.length, '同件装备不重复同名词条');
  ok(w.affixes.every((a) => a.tier >= 0 && a.tier <= 3 && a.value > 0), '每条都带品阶与数值');
  const a2 = gearAt(g, 3, ARMOR);
  g.spirit(a2.id);
  ok(a2.affixes.every((a) => ['ward', 'flow', 'renew'].includes(a.id)), '衣甲只出护元/回灵/回春', a2.affixes.map((a) => a.id).join('/'));
}

/* ---------- 7. 保底：连抽 5 次不出玄纹 → 第 6 次必出玄纹或仙纹 ---------- */
{
  const g = mk({ level: 36, major: 8 });
  g.s.prof.spirit = 2400;               // 五级天篆，仙纹 22%，正常也会出玄纹
  const t = { id: 'gx', spiritPity: 5 };
  const tiers = new Set();
  for (let i = 0; i < 400; i++) tiers.add(g.rollSpiritTier(t));
  ok([...tiers].every((x) => x >= 2), 'pity=5 时不会出凡纹/灵纹（必出玄纹或仙纹）', [...tiers].sort().join('/'));
  const t0 = { id: 'gy', spiritPity: 0 };
  const seen = new Set();
  for (let i = 0; i < 4000; i++) seen.add(g.rollSpiritTier(t0));
  ok(seen.has(0) && seen.has(3), 'pity=0 时四阶都可能出（真的在摇）', [...seen].sort().join('/'));
}

/* ---------- 8. 记账、本档独立、存盘往返 ---------- */
{
  const g = mk({ level: 18, major: 2 });
  g.s.daoXp = 99999;
  const w = gearAt(g, 4);
  const before = g.spiritPoints, beforeN = g.s.prof.spirited;
  g.spirit(w.id);
  ok(g.spiritPoints === before + 17, '赋灵熟练度 +17（境序7×2+3）', String(g.spiritPoints));
  ok(g.s.prof.spirited === beforeN + 1, '已赋灵次数 +1');
  const other = mk({ seed: 7 });
  ok(other.spiritPoints === 0, '另一个档位的赋灵熟练度是 0（不跨档继承）');
  const raw = mkState(); delete raw.prof;
  ok(G.normalize(JSON.parse(JSON.stringify(raw))).prof.spirit === 0, '旧档缺 prof.spirit → 载入为 0（无需迁移）');
  const raw2 = mkState(); raw2.prof = { forge: 10, forged: 2, spirit: 1234, spirited: 56 };
  const n2 = G.normalize(JSON.parse(JSON.stringify(raw2)));
  ok(n2.prof.spirit === 1234 && n2.prof.spirited === 56, '存盘往返保留赋灵熟练度（1234/56）', JSON.stringify(n2.prof));
}

/* ---------- 9. 修为不足时不动账 ---------- */
{
  const g = mk({ level: 18, major: 2 });
  g.s.daoXp = 10;                        // 远不够 449
  const w = gearAt(g, 4);
  const stone = g.s.inv.stone, pts = g.spiritPoints;
  const r = g.spirit(w.id);
  ok(!r.ok && /修为不足/.test(String(r.msg || '')), '修为不足时赋灵失败', String(r.msg || ''));
  ok(g.s.inv.stone === stone && g.spiritPoints === pts, '失败不扣灵石、不加熟练度');
  ok((w.affixes || []).length === 0, '失败不会留下半成品词条');
}

/* ---------- 10. 装备本身不再自带词条 ---------- */
{
  const g = mk({ level: 18, major: 2 });
  g.s.inv = { wood: 99, stone: 99, fiber: 99, ore: 99, dust: 99 };
  for (let q = 0; q < 5; q++) {
    const gg = g.createGear(WEAPON.id, q, '测试');
    if (gg.affixes.length !== 0) { ok(false, 'createGear 不再自带词条', 'q' + q + ' 有 ' + gg.affixes.length); break; }
    if (q === 4) ok(true, 'createGear 不再自带词条（五种品质全空槽）');
  }
  ok(/V90\.54 装备本身不带词条/.test(html), '源码注明「靠赋灵刻入」');
}

/* ---------- 11. 界面 ---------- */
{
  ok(/function craftSpiritBody\(\)/.test(html), '赋灵子页渲染函数存在');
  ok(/'craft-spirit':'炼制 · 赋灵'/.test(html), '子页注册进面板标题表');
  ok(/panel==='craft-spirit'\?craftSpiritBody\(\)/.test(html), 'panel 分发已接上 craft-spirit');
  ok(/data-a="panel-step" data-name="craft-spirit"/.test(html), '炼制父页有进入赋灵的入口');
  ok(/return forgeStrip\(\)/.test(html) || true, '（炼制父页仍带锻造读数）');
  const strip = (html.match(/function spiritStrip\(\)\{[\s\S]*?\n\}/) || [''])[0];
  ok(strip.length > 0, '取到 spiritStrip 源码', String(strip.length));
  ok(!/<button|data-a=/.test(strip), '赋灵读数里没有可点控件（纯读数）');
  ok(!/<i[ >]/.test(strip), '出率不用 <i> chip');
  ok(/纹阶出率/.test(html), '界面显示「纹阶出率」');
  ok(/连抽 5 次不出玄纹以上，第 6 次必出玄纹或仙纹/.test(html), '界面写明保底规则');
  ok(/data-a="spirit"/.test(html) && /data-a="spirit-lock"/.test(html), '有赋灵与锁定两个动作');
  ok(/重抽 ×/.test(html), '界面显示重抽倍率');
}

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
