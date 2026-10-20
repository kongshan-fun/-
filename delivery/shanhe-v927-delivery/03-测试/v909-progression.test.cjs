'use strict';
/**
 * V90.9 阶段成长指引 + 金丹雷劫文案专项
 *
 * 覆盖任务 G 要求的状态：
 *   两者均未完成 / 只完成问道坛 / 两者均完成 / 道行不足 / 材料不足 /
 *   洞府不存在 / 不在本境洞府 / 饱腹饮水不足 / 雷劫半途 / 全部满足 /
 *   正式突破入口 / 两族档位隔离 / 旧存档重载
 *
 * 只读取真实引擎状态与真实配置表，不构造第二套进度账本。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
assert.equal(blocks.length, 10, 'script 块数量');
for (const b of blocks) new vm.Script(b); // 全部块语法检查

const ctx = vm.createContext({ console });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame;
const D = ctx.QData;

let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

/* ---- 装载被测试的指引模块本身（与构建产物同一份源码） ---- */
function loadGuide(gameObj) {
  const src = fs.readFileSync(path.join(root, 'tools', 'v909-progression.js'), 'utf8');
  const c = vm.createContext({ console, game: gameObj, D, esc: (x) => String(x) });
  c.globalThis = c;
  vm.runInContext(src, c, { timeout: 10000 });
  ok(typeof c.progRows === 'function', 'progRows 已定义');
  ok(typeof c.progNext === 'function', 'progNext 已定义');
  ok(typeof c.progGuide === 'function', 'progGuide 已定义');
  ok(typeof c.progMatSource === 'function', 'progMatSource 已定义');
  return c;
}

function baseState(zone = 5, major = 1, race = 'human') {
  const s = Game.fresh(20261018, race);
  s.zone = zone; s.major = major; s.unlocked = zone + 1;
  s.hunger = 100; s.water = 100; s.hp = s.maxHp; s.spirit = s.maxSpirit;
  s.life.left = 200 * D.LIFE.yearMinutes;
  s.pos = { x: 1, y: 5 }; s.last = { ...s.pos };
  s.visited[zone + ':' + s.pos.x + ',' + s.pos.y] = true;
  for (let i = 0; i < zone; i++) s.cleared[i] = true;
  s.settlements[zone] = {
    pos: { ...s.pos }, level: 3,
    buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 2 },
    stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes,
  };
  for (const id of Object.keys(D.ITEMS)) s.inv[id] = 1000;
  s.storageBags = {};
  s.ritual[zone] = true; s.cleared[zone] = true;
  s.level = 18; s.daoXp = 999;
  return s;
}

const stage = D.ASCENSION_STAGES[0];
ok(stage && stage.needDao === 60, '金丹道行要求为 60（源码配置）');

/* ================= 1. 条件清单：一次返回全部，不隐藏后续未完成项 ================= */
{
  const s = baseState();
  s.ritual[5] = false;
  s.cleared[5] = false; // 两者均未完成（首领未过时不会归一化 ritual）
  const g = new Game(s);
  const c = loadGuide(g);
  const rows = c.progRows('core');
  ok(rows.length >= 11, `条件清单包含全部关键项（${rows.length} 行）`);
  const labels = rows.map((r) => r.label);
  for (const need of ['本境问道坛', '本境首领', '等级要求', '道行', '本境洞府', '位于本境洞府']) {
    ok(labels.includes(need), `清单包含「${need}」`);
  }
  const no = rows.filter((r) => !r.pass).map((r) => r.label);
  // D2：不能只返回第一个失败条件就隐藏其余未完成项
  eq(no.join(','), '本境问道坛,本境首领,三重雷劫', '未完成项被完整列出，不因首个条件失败而隐藏后续');
  checks++;

  // 记录引擎真实行为：首领已完成时 ritual 会被归一化为真，因此
  // 「首领已过但问道坛未过」在存档层不可构造，清单不会给出自相矛盾的状态。
  const s2 = baseState();
  s2.ritual[5] = false; s2.cleared[5] = true;
  const g2 = new Game(s2);
  ok(g2.s.ritual[5] === true, '首领已完成时 ritual 归一化为真（引擎既有规则，未改动）');
  const c2 = loadGuide(g2);
  ok(!c2.progRows('core').some((r) => r.label === '本境首领' && !r.pass), '首领记录一致，清单无矛盾项');
  checks++;
}

/* ================= 2. 下一步只给一条，且随状态正确推进 ================= */
{
  // 两者均未完成
  let s = baseState(); s.ritual[5] = false; s.cleared[5] = false;
  let c = loadGuide(new Game(s));
  ok(/问道坛/.test(c.progNext('core').label), '两者均未完成 -> 先引导问道坛');

  // 只完成问道坛
  s = baseState(); s.ritual[5] = true; s.cleared[5] = false;
  c = loadGuide(new Game(s));
  ok(/首领/.test(c.progNext('core').label), '只完成问道坛 -> 引导首领');

  // 两者均完成、等级不足
  s = baseState(); s.level = 12;
  c = loadGuide(new Game(s));
  ok(/等级|修炼/.test(c.progNext('core').label), '等级不足 -> 引导修炼');

  // 道行不足
  s = baseState(); s.daoXp = 10;
  c = loadGuide(new Game(s));
  ok(/道行/.test(c.progNext('core').label), '道行不足 -> 引导积累道行');

  // 材料不足
  s = baseState(); s.inv[stage.primary] = 0; s.inv[stage.secondary] = 0;
  c = loadGuide(new Game(s));
  const nx = c.progNext('core');
  ok(/采集/.test(nx.label), '材料不足 -> 引导采集');
  ok(nx.act === 'codex-open', '材料不足给出图鉴入口');

  // 洞府不存在
  s = baseState(); delete s.settlements[5];
  c = loadGuide(new Game(s));
  ok(/建立洞府/.test(c.progNext('core').label), '无洞府 -> 引导建立洞府');

  // 不在本境洞府
  s = baseState(); s.pos = { x: 6, y: 1 };
  c = loadGuide(new Game(s));
  ok(/返回本境洞府/.test(c.progNext('core').label), '不在洞府 -> 引导返回');

  // 雷劫未完成
  s = baseState();
  s.flags.coreTribulation = { phase: 1, marks: 0, started: true, complete: false };
  c = loadGuide(new Game(s));
  const core = c.progNext('core');
  ok(/雷劫/.test(core.label) && core.act === 'tribulation-open', '雷劫未渡 -> 引导试炼并给出入口');

  // 全部满足
  s = baseState();
  s.flags.coreTribulation = { phase: 3, marks: 3, started: true, complete: true };
  c = loadGuide(new Game(s));
  const fin = c.progNext('core');
  eq(fin.act, 'breakthrough', '全部满足 -> 唯一主操作是正式突破');
  ok(/正式突破/.test(fin.label), '全部满足文案为正式突破');

  // 饱腹不足
  s = baseState();
  s.flags.coreTribulation = { phase: 3, marks: 3, started: true, complete: true };
  s.hunger = 1;
  c = loadGuide(new Game(s));
  ok(/用餐|补水/.test(c.progNext('core').label), '饱腹不足 -> 先引导用餐补水');
}

/* ================= 3. 材料来源由真实表推导，不虚构 ================= */
{
  const s = baseState();
  s.inv[stage.primary] = 0;
  const c = loadGuide(new Game(s));
  const src = c.progMatSource(stage.primary);
  ok(src !== null, `主材 ${stage.primary} 能推导出真实来源`);
  if (src) {
    ok(typeof src.zoneName === 'string' && src.zoneName.length > 0, `来源境域为真实名称：${src.zoneName}`);
    ok(typeof src.res.name === 'string' && src.res.name.length > 0, `来源资源为真实名称：${src.res.name}`);
    const z = D.ZONES[src.zone];
    ok(!!z, '来源境域索引存在于 D.ZONES');
    // 该资源必须真的出现在该境地图的地形布局里
    let found = false;
    for (const row of z.map) for (const t of row) {
      const layout = D.RESOURCE_LAYOUT[t];
      if (layout && layout.includes(src.res.mark !== undefined ? src.res.mark : '')) { /* noop */ }
    }
    for (const [rid, res] of Object.entries(D.RES)) {
      if (res !== src.res) continue;
      for (const row of z.map) for (const t of row) {
        const layout = D.RESOURCE_LAYOUT[t];
        if (layout && layout.includes(rid)) found = true;
      }
    }
    ok(found, '来源资源确实出现在该境地图地形中（可导航依据真实）');
  }
  const missingItem = c.progMatSource('__not_an_item__');
  eq(missingItem, null, '不存在的物品不返回虚构来源');
}

/* ================= 4. 指引是只读的：调用前后存档不变 ================= */
{
  const s = baseState();
  const before = JSON.stringify(s);
  const c = loadGuide(new Game(s));
  c.progGuide('core'); c.progRows('core'); c.progNext('core');
  eq(JSON.stringify(s), before, '生成指引不写入任何存档字段');
}

/* ================= 5. D1：雷劫页不再出现写死的完成文案 ================= */
{
  ok(!html.includes('结丹雷蛟已伏'), '产物中不存在写死的「结丹雷蛟已伏」');
  ok(html.includes('const trialIntro='), '雷劫首段由 trialIntro 状态判定生成');
  for (const frag of ['丹霞问道坛尚未完成', '结丹雷蛟仍在渊中', '三重雷劫已渡', '雷劫已启']) {
    ok(html.includes(frag), `六态文案包含「${frag}」`);
  }
}

/* ================= 6. 三处接入都在，且入口唯一醒目 ================= */
{
  const hits = (html.match(/progGuide\('(core|heart|generic)'\)/g) || []).length;
  eq(hits, 3, '雷劫页 / 问心页 / 修炼面板 三处接入');
  ok(html.includes('prog-card'), '指引卡片样式已注入');
  ok(html.includes('v909-progression'), '指引样式块存在');
}

/* ================= 7. 种族与档位隔离 ================= */
{
  const human = baseState(5, 1, 'human'); human.ritual[5] = false; human.cleared[5] = false;
  const demon = baseState(5, 1, 'demon'); demon.ritual[5] = true; demon.cleared[5] = false;
  const ch = loadGuide(new Game(human, 261014, 'human'));
  const cd = loadGuide(new Game(demon, 261014, 'demon'));
  ok(/问道坛/.test(ch.progNext('core').label), '人族档：问道坛未完成');
  ok(/首领/.test(cd.progNext('core').label), '妖族档：问道坛已完成、首领未击败');
  ok(human.ritual[5] === false && demon.ritual[5] === true, '两档状态互不影响');
}

/* ================= 8. 旧存档重载后指引仍可用 ================= */
{
  const s = baseState();
  const round = new Game(JSON.parse(JSON.stringify(s)));
  const c = loadGuide(round);
  ok(c.progRows('core').length >= 11, '序列化重载后仍能生成完整清单');
  ok(!!c.progNext('core').label, '序列化重载后仍能给出下一步');
}

/* ================= 9. 元婴阶段同样可用（不能只修金丹） ================= */
{
  const s = baseState(6, 2);
  s.ritual[6] = true; s.cleared[6] = true;
  s.flags.heartTrial = { phase: 1, marks: 0, started: true, complete: false };
  const c = loadGuide(new Game(s));
  const rows = c.progRows('heart');
  ok(rows.some((r) => r.label === '三重问心'), '元婴阶段清单含三重问心');
  const nx = c.progNext('heart');
  ok(/问心/.test(nx.label) && nx.act === 'heart-open', '元婴阶段引导问心并给出入口');
  const st2 = D.ASCENSION_STAGES[1];
  eq(st2.needDao, 110, '元婴道行要求为 110（源码配置）');
}

console.log(`V90.9 PROGRESSION GUIDE PASS ${checks} assertions`);
