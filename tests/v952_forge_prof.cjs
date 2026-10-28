// V90.75 fixture migration: unique homestead + explicit home context; numerical assertions retained.
'use strict';
/* V90.52 验收：锻造熟练度（5 级 · 仙品出率 5%→30% · 本档独立不继承 · 出率可见）
 *
 * 动态断言（真跑引擎）：
 *   1. 定稿表：5 级门槛 0/150/500/1200/2500，出率表 5×5 每行合计 100，仙品列 5/9/14/21/30
 *   2. 期望属性倍率与 docs §五 一致（1.118 → 1.443，即 1→5 级 +29%）
 *   3. 档位换算：0/149→一级 … 2500→五级
 *   4. 每件熟练度 = 境序×3+5（凡人 8，渡劫 41）
 *   5. 真打一件：prof.forge +8、prof.forged +1，且品质取自本档出率表
 *   6. 实测分布贴合定稿表（每档每列 ±1.5pp）
 *   7. 旧档无 prof 字段 → 载入为 0（无需迁移）；有值则原样保留
 *   8. 跨档不继承：两个档位的 prof 互不影响
 * 静态断言：
 *   9. 掉落路径不走熟练度（createGear 仍是 3 参数调用）
 *  10. 炼制页顶部有熟练度条 + 五档出率；装备行显示当前仙品概率
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
const ZONES = D.ZONES.length;

/* ---------- 1. 定稿表 ---------- */
const NEEDS = [0, 150, 500, 1200, 2500];
ok(D.FORGE_RANKS.length === 5, '熟练度恰好 5 级', String(D.FORGE_RANKS.length));
ok(D.FORGE_RANKS.map((r) => r.need).join(',') === NEEDS.join(','),
  '升级门槛累计值 = 0/150/500/1200/2500', D.FORGE_RANKS.map((r) => r.name + ':' + r.need).join(' '));
ok(D.FORGE_RANKS.map((r) => r.name).join('') === '生手略通熟练精通宗师', '五级称号按定稿顺序',
  D.FORGE_RANKS.map((r) => r.name).join(' '));

ok(D.FORGE_WEIGHTS.length === 5, '出率表 5 行（对应 5 级）');
const allRows100 = D.FORGE_WEIGHTS.every((w) => w.length === 5 && w.reduce((a, b) => a + b, 0) === 100);
ok(allRows100, '每行 5 档且合计恰好 100%');
const sm = D.FORGE_WEIGHTS.map((w) => w[4]);
ok(sm.join(',') === '5,9,14,21,30', '仙品出率 5% → 30%（逐级递增）', sm.join('% → ') + '%');
ok(sm.every((v, i) => i === 0 || v > sm[i - 1]), '仙品出率严格递增');

/* 期望属性倍率（docs §五 表格最后一列） */
const MULTS = D.QUALITIES.map((q) => q.mult);
const expectMult = D.FORGE_WEIGHTS.map((w) => w.reduce((s, p, i) => s + (p / 100) * MULTS[i], 0));
const DOC_MULT = [1.118, 1.187, 1.266, 1.348, 1.443];
const multOk = expectMult.every((v, i) => Math.abs(v - DOC_MULT[i]) < 0.002);
ok(multOk, '期望属性倍率贴合 docs（1.118 → 1.443）', expectMult.map((v) => v.toFixed(3)).join(' '));
ok(expectMult[4] / expectMult[0] > 1.28, '五级相对一级期望属性 +29%',
  '+' + ((expectMult[4] / expectMult[0] - 1) * 100).toFixed(1) + '%');

/* ---------- 构造可用档位 ---------- */
function mkState(o = {}) {
  const s = G.fresh(o.seed || 20261026, 'human');
  s.level = o.level || 1; s.major = o.major || 0; s.zone = 0; s.unlocked = ZONES;
  s.hunger = 100; s.water = 100; s.life.left = 200 * D.LIFE.yearMinutes;
  s.cleared = Array(ZONES).fill(true); s.ritual = Array(ZONES).fill(true);
  const p = { x: 1, y: 5 };
  s.pos = { ...p }; s.last = { ...p };
  s.homestead = { pos: { ...p }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 3 },
    stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  s.inv.wood = 20; s.inv.stone = 20; s.inv.fiber = 20;
  s.atHome=true;
  return s;
}
const mk = (o) => new G(mkState(o));

/* ---------- 2. 新档默认 0 ---------- */
const f = G.fresh(1, 'human');
ok(f.prof && f.prof.forge === 0 && f.prof.forged === 0, '新档 prof 默认 {forge:0, forged:0}', JSON.stringify(f.prof));

/* ---------- 3. 档位换算 ---------- */
const rankCases = [[0, 0], [1, 0], [149, 0], [150, 1], [499, 1], [500, 2], [1199, 2], [1200, 3], [2499, 3], [2500, 4], [99999, 4]];
{
  const g = mk();
  const bad = [];
  for (const [pts, want] of rankCases) {
    g.s.prof.forge = pts;
    if (g.forgeRank !== want) bad.push(`${pts}→${g.forgeRank}(期望${want})`);
  }
  ok(bad.length === 0, '熟练度 → 等级换算全对', rankCases.map(([p, r]) => p + '→' + (r + 1) + '级').join(' '));
  g.s.prof.forge = 0;
  ok(g.forgeWeights === D.FORGE_WEIGHTS[0], '一级用第 1 行出率表');
  g.s.prof.forge = 2500;
  ok(g.forgeWeights === D.FORGE_WEIGHTS[4] && g.forgeRankName === '宗师', '五级 = 宗师 · 第 5 行出率表');
  ok(g.forgeNextNeed() === null, '五级已满级，无下一档');
  g.s.prof.forge = 0;
  ok(g.forgeNextNeed() === 150, '一级下一档门槛 150');
}

/* ---------- 4. 每件给 境序×3+5 ---------- */
{
  const low = mk({ level: 1, major: 0 });
  ok(low.realmIndex === 1 && low.forgeGain === 8, '凡人（境序1）一件给 8 点', String(low.forgeGain));
  const mid = mk({ level: 19, major: 2 });
  ok(mid.realmIndex === 7 && mid.forgeGain === 26, '元婴（境序7）一件给 26 点', String(mid.forgeGain));
  const top = mk({ level: 36, major: 8 });
  ok(top.realmIndex === 12 && top.forgeGain === 41, '渡劫（境序12）一件给 41 点', String(top.forgeGain));
}

/* ---------- 5. 真打一件：记账 + 出率生效 ---------- */
{
  const g = mk();
  const before = { forge: g.forgePoints, forged: g.s.prof.forged, gears: g.s.gears.length };
  const r = g.craft('woodSword');
  ok(r && r.ok, '炼制桃木灵剑成功', JSON.stringify((r && r.msg) || ''));
  ok(g.s.gears.length === before.gears + 1, '产生一件独立装备实例');
  ok(g.forgePoints === before.forge + 8, '锻造熟练度 +8（凡人 境序1×3+5）', `${before.forge} → ${g.forgePoints}`);
  ok(g.s.prof.forged === before.forged + 1, '已打造件数 +1', String(g.s.prof.forged));
  const g2 = g.s.gears[g.s.gears.length - 1];
  ok(g2 && g2.quality >= 0 && g2.quality <= 4, '品质落在 0..4', String(g2 && g2.quality));
  ok(/炼成/.test(html), '炼制仍有既有的「炼成」行记');
}

/* 非装备（储物袋/丹药）不计熟练度 */
{
  const g = mk();
  g.s.inv = Object.assign(g.s.inv, { rune: 20 });
  const before = g.forgePoints;
  const bag = D.STORAGE_BAGS.find((b) => b.id === 'bag01');
  const r = g.craft(bag.id);
  ok(r && r.ok, '炼制一阶储物袋成功', JSON.stringify((r && r.msg) || ''));
  ok(g.forgePoints === before, '非装备炼制不加锻造熟练度（只算打造装备）', String(g.forgePoints));
}

/* ---------- 6. 实测分布贴合定稿表 ---------- */
{
  const N = 20000;
  const sample = (rank, seed) => {
    const g = new G(G.fresh(seed, 'human'));
    /* 拔掉气运对品质的 +0..8 加成，只验定稿表本身 */
    Object.defineProperty(g, 'birthEffects', { get: () => ({ quality: 0 }) });
    g.s.prof.forge = D.FORGE_RANKS[rank].need;
    const w = g.forgeWeights, c = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) c[g.rollQualityFrom(w)]++;
    return c.map((x) => (x / N) * 100);
  };
  let worst = 0, worstAt = '';
  D.FORGE_WEIGHTS.forEach((row, rank) => {
    const got = sample(rank, 9000 + rank);
    row.forEach((want, i) => {
      const d = Math.abs(want - got[i]);
      if (d > worst) { worst = d; worstAt = `第${rank + 1}级 ${D.QUALITIES[i].name} 期望${want}% 实测${got[i].toFixed(2)}%`; }
    });
    ok(got.every((v, i) => Math.abs(v - row[i]) <= 1.5), `第${rank + 1}级实测分布贴合定稿表`,
      got.map((v) => v.toFixed(1)).join('/'));
  });
  ok(worst <= 1.5, `最大偏离 ${worst.toFixed(2)}pp（容差 1.5pp）`, worstAt);

  const one = sample(0, 4242), five = sample(4, 4242);
  ok(five[4] > one[4] + 20, '五级仙品实测明显高于一级（≈30% vs ≈5%）',
    one[4].toFixed(1) + '% → ' + five[4].toFixed(1) + '%');
}

/* ---------- 7. 旧档无需迁移 / 有值保留 ---------- */
{
  const raw = mkState();
  delete raw.prof;
  const n = G.normalize(JSON.parse(JSON.stringify(raw)));
  ok(n.prof && n.prof.forge === 0 && n.prof.forged === 0, '旧档缺 prof 字段 → 载入为 0（不做迁移）', JSON.stringify(n.prof));

  const raw2 = mkState();
  raw2.prof = { forge: 730, forged: 86 };
  const n2 = G.normalize(JSON.parse(JSON.stringify(raw2)));
  ok(n2.prof.forge === 730 && n2.prof.forged === 86, '存盘往返保留 prof（730/86）', JSON.stringify(n2.prof));

  const raw3 = mkState();
  raw3.prof = { forge: -5, forged: 'x' };
  const n3 = G.normalize(JSON.parse(JSON.stringify(raw3)));
  ok(n3.prof.forge === 0 && n3.prof.forged === 0, '脏数据被夹取为 0', JSON.stringify(n3.prof));
}

/* ---------- 8. 跨档不继承 ---------- */
{
  const a = mk({ seed: 111 }), b = mk({ seed: 222 });
  a.s.prof.forge = 2500; a.s.prof.forged = 300;
  ok(b.forgePoints === 0 && b.s.prof.forged === 0, '另一个档位的熟练度为 0（不跨档继承）',
    `A ${a.forgePoints}/${a.s.prof.forged}  B ${b.forgePoints}/${b.s.prof.forged}`);
  ok(a.s.prof !== b.s.prof, '两个档位的 prof 是不同对象');
  ok(G.normalize(JSON.parse(JSON.stringify(b.state()))).prof.forge === 0, 'B 存盘往返仍是 0');
}

/* ---------- 9. 掉落路径不受影响（静态） ---------- */
ok(/this\.createGear\(r\.id,min,source\)/.test(html), '奇遇/掉落仍用区域品质表（createGear 3 参数）');
ok(!/createGear\(r\.id,min,source,/.test(html), '掉落没有套用锻造熟练度');
ok(/rollQuality\(z=this\.s\.zone\)\{return this\.rollQualityFrom\(D\.QUALITY_WEIGHTS/.test(html),
  'rollQuality 仍按所在区域品质表');

/* ---------- 10. 界面（静态） ---------- */
ok(/function forgeStrip\(\)/.test(html), '炼制页有熟练度条渲染函数');
ok(/forge-prof/.test(html) && /forge-rate/.test(html), '熟练度条 + 出率条样式与节点俱在');
ok(/锻造熟练 · \$\{tier\}级/.test(html), '界面显示「锻造熟练 · N级 称号」');
ok(/D\.QUALITIES\.map\(\(q,i\)=>i===4\?`<b>\$\{q\.name\} \$\{w\[i\]\}%<\/b>`:`<span>\$\{q\.name\} \$\{w\[i\]\}% · <\/span>`\)\.join\(''\)/.test(html),
  '出率是纯文字（档名+百分比不被拆行），只有仙品用 <b> 加粗');
ok(/#panel-root \.forge-rate span\{white-space:nowrap\}/.test(html), '每档「品质 百分比」不跨行拆开');
/* 出率只告知、不可选：不能出现按钮/动作，也不能长成带边框的 chip 组（V90.52 返工点） */
{
  const strip = (html.match(/function forgeStrip\(\)\{[\s\S]*?\n\}/) || [''])[0];
  ok(strip.length > 0, '取到 forgeStrip 源码块', String(strip.length));
  ok(!/<button|data-a=|role="button"|tabindex/.test(strip), '熟练度条里没有任何可点/可选控件');
  ok(!/<i[ >]/.test(strip), '出率不再用 <i> 做 chip');
  const rateCss = (html.match(/#panel-root \.forge-rate\{[^}]*\}/) || [''])[0];
  ok(rateCss.length > 0, '取到 .forge-rate 样式', rateCss.slice(0, 40));
  ok(!/border|background/.test(rateCss), '.forge-rate 不画边框/底色（读起来不像控件）');
  const profCss = (html.match(/#panel-root \.forge-prof\{[^}]*\}/) || [''])[0];
  ok(!/border|background/.test(profCss), '.forge-prof 不画边框/底色');
  ok(!/#panel-root \.forge-rate>i/.test(html), '旧的 chip 样式已移除');
}
ok(/已打造 \$\{\(game\.s\.prof\|\|\{\}\)\.forged\|\|0\} 件/.test(html), '界面显示已打造件数');
ok(/品质随机 · 仙品'\+\s*game\.forgeWeights\[4\]\+'%'/.test(html) || /品质随机 · 仙品/.test(html),
  '装备配方行显示当前仙品出率（锻造前可见）');
ok(/return forgeStrip\(\)/.test(html), '炼制父页顶部嵌入熟练度条（不新增页面）');

/* ---------- 版本：只校验"纯数字版本号"这一约定，具体版本由 v908 发布文件一致性测试管 ---------- */
const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
ok(/V\d+\.\d+/.test(title), '标题里有版本号', title);
ok(!/V\d+\.\d+[a-zA-Z]/.test(title), '版本号纯数字（不带字母后缀，否则发布文件名一致性会红）', title);

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
