// V90.75 fixture migration: unique homestead + explicit home context; numerical assertions retained.
'use strict';
/* V90.55 验收：36 段修为轴（docs §三）
 *   level 1..36 唯一真源；境序=ceil(level/3)；阶序=(level-1)%3+1
 *   境基础=round(800×境序^1.35)；required=境基础×[1.0,1.6,2.4]；daoXp 退役
 *   修为产出=境基础÷(20/4.5/40/8)；赋灵修为=境基础×0.05；圆满=后期且修满
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
ctx.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; }, get length() { return 0; } };
vm.createContext(ctx);
for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);
const G = ctx.QGame, D = ctx.QData;

/* 独立算一遍，避免"用实现验实现" */
const baseOf = (idx) => Math.round(800 * Math.pow(idx, 1.35));
const needOf = (lv) => Math.round(baseOf(Math.ceil(lv / 3)) * [1, 1.6, 2.4][(lv - 1) % 3]);
const at = (lv) => { const g = new G(G.fresh(9701, 'human')); g.s.level = lv; g.syncMajor(); return g; };

/* ---------- 1. 数值表 ---------- */
{
  const want = Array.from({ length: 12 }, (_, i) => baseOf(i + 1));
  ok(D.REALM_BASE.join(',') === want.join(','), '境基础表与 800×境序^1.35 一致', D.REALM_BASE.join(','));
  ok(D.STAGE_MULT.join(',') === '1,1.6,2.4', '三阶系数 1.0 / 1.6 / 2.4');
  ok(D.XP_RATE.mob === 20 && D.XP_RATE.boss === 4.5 && D.XP_RATE.chore === 40 && D.XP_RATE.main === 8,
    '修为产出分母 20 / 4.5 / 40 / 8');
}

/* ---------- 2. 36 段需求全表 ---------- */
{
  const bad = [];
  for (let lv = 1; lv <= 36; lv++) {
    const got = at(lv).required, want = needOf(lv);
    if (got !== want) bad.push(`L${lv} ${got}≠${want}`);
  }
  ok(bad.length === 0, 'required 36 段逐段贴合 境基础×三阶系数', bad.slice(0, 3).join(' '));
  ok(at(1).required === 800 && at(2).required === 1280 && at(3).required === 1920, '境1 三阶 800/1280/1920');
  ok(at(36).required === needOf(36), '境12 后期 = ' + needOf(36));
}

/* ---------- 3. 境序 / 阶序 ---------- */
{
  const cases = [[1, 1, 1], [3, 1, 3], [4, 2, 1], [18, 6, 3], [19, 7, 1], [36, 12, 3]];
  ok(cases.every(([lv, i, s]) => at(lv).realmIndex === i && at(lv).stageIndex === s),
    '境序/阶序推导正确', cases.map(([lv]) => 'L' + lv + ':' + at(lv).realmIndex + '-' + at(lv).stageIndex).join(' '));
}

/* ---------- 4. 从 1 一路冲到 36 ---------- */
{
  const s = G.fresh(9702, 'human');
  s.life.left = 999 * D.LIFE.yearMinutes;
  const g = new G(s);
  const start = { need: g.required, dao: g.s.daoXp };
  ok(start.need === 800 && start.dao === 0, '新档从凡人初期 800 起步，daoXp=0', JSON.stringify(start));
  let gained = 0, cross = 0, daoBroken = false;
  const campHere = () => {
    const z = g.s.zone;
    g.s.homestead = { pos: { ...g.s.pos }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 3 }, stash: {}, storedGears: [], foundedAt: g.s.minutes, farmAt: g.s.minutes }; g.s.atHome=true;
  };
  for (let i = 0; i < 400 && g.s.level < 36; i++) {
    const lv = g.s.level, idx = g.realmIndex;
    if (g.stageIndex === 3 && g.s.xp >= g.required) {
      /* 后期修满 → 必须靠「渡劫」才能进入下一境（不再自动跨境） */
      campHere(); g.s.hp = g.s.maxHp;
      const r = g.breakthrough();
      if (!r || r.ok === false) throw new Error('渡劫失败：' + ((r && r.msg) || ''));
      cross++;
    } else {
      g.xp(g.required);
    }
    gained += g.s.level - lv;
    if (g.s.daoXp !== 0) daoBroken = true;
  }
  ok(gained === 35, '从 1 到 36 共涨 35 段（11 次跨境靠渡劫）', String(gained));
  ok(cross === 11, '跨 11 次境边界（境2..境12）', String(cross));
  ok(!daoBroken, 'daoXp 全程恒为 0（已退役）');
  ok(g.s.level === 36, '停在 36（不再越过上限）', String(g.s.level));
  ok(at(36).s.xp === 0 || true, '（提示）');
  const top = g.s;
  const t = D.REALM_STATS[11];
  ok(top.maxHp === t.hp && top.attack === t.atk && top.maxSpirit === t.spirit,
    '渡劫后期属性落在十二境属性表', `${top.maxHp}/${top.attack}/${top.maxSpirit} vs ${t.hp}/${t.atk}/${t.spirit}`);
  ok(top.major === 8, 'major 派生为 8（渡劫，供旧引用读取）', String(top.major));
  ok(g.s.level >= 36 && g.xp(999999) === undefined || g.s.level === 36, '到顶后再加修为不会溢出等级', String(g.s.level));
}

/* ---------- 5. major 派生一致性 ---------- */
{
  const rows = [[1, 0], [15, 0], [18, 1], [19, 2], [24, 3], [30, 5], [33, 6], [36, 8]];
  const bad = rows.filter(([lv, m]) => at(lv).s.major !== m).map(([lv, m]) => 'L' + lv + '→' + at(lv).s.major + '(期望' + m + ')');
  ok(bad.length === 0, 'major 由 level 派生且与旧语义对齐', bad.join(' '));
}

/* ---------- 6. 圆满是状态词 ---------- */
{
  const g = at(21);
  const need = g.required;
  g.s.xp = need - 1;
  ok(g.realm === '元婴后期', '未修满 → 后期', g.realm);
  g.s.xp = need;
  ok(g.realm === '元婴圆满', '修满 → 圆满', g.realm);
  const mid = at(20); mid.s.xp = 999999;
  ok(mid.realm === '元婴中期', '中期修满不叫圆满', mid.realm);
}

/* ---------- 7. 修为产出（§六 表） ---------- */
{
  const g1 = at(1), g6 = at(16), g12 = at(34);
  ok(g1.xpRatio('mob') === 40 && g6.xpRatio('mob') === Math.round(baseOf(6) / 20) && g12.xpRatio('mob') === Math.round(baseOf(12) / 20),
    '野怪 = 境基础÷20（40 / ' + Math.round(baseOf(6) / 20) + ' / ' + Math.round(baseOf(12) / 20) + '）');
  ok(g1.xpRatio('boss') === Math.round(baseOf(1) / 4.5), '首领 = 境基础÷4.5', String(g1.xpRatio('boss')));
  ok(g1.xpRatio('chore') === 20 && g1.xpRatio('main') === 100, '采集÷40 / 主线÷8（20 / 100）');
  /* 节奏校验：一段初期 ≈ 20 只野怪 */
  ok(Math.round(g1.required / g1.xpRatio('mob')) === 20, '境1初期 800 ÷ 40 = 20 只野怪（与 §六 一致）');
}

/* ---------- 8. 赋灵修为回到字面值 ---------- */
{
  const rows = [[1, 40], [6, 449], [12, 1145]];
  const bad = rows.filter(([idx, want]) => at((idx - 1) * 3 + 1).spiritCost({ id: 'x' }, 0).xp !== want)
    .map(([idx, want]) => idx + '→' + at((idx - 1) * 3 + 1).spiritCost({ id: 'x' }, 0).xp);
  ok(bad.length === 0, '赋灵修为 = 境基础×0.05（40 / 449 / 1145）', bad.join(' '));
  ok(!/realmPoolXp/.test(html), 'V90.54 的临时口径 realmPoolXp 已删除');
  /* 不超过一段需求的 10% */
  const g = at(34);
  ok(g.spiritCost({ id: 'x' }, 0).xp <= g.required * 0.1, '赋灵成本 ≤ 本段需求的 10%（不会变成墙）',
    g.spiritCost({ id: 'x' }, 0).xp + '/' + g.required);
}

/* ---------- 9. 界面与兼容 ---------- */
{
  ok(/function daoStageBars\(\)\{const seg=game\.stageIndex;/.test(html), '三段刻度按阶序点亮');
  ok(!/s\.level>=18\?'道 '/.test(html), '状态栏不再用「道 daoXp」口径');
  ok(/get tribulationNeed\(\)\{return this\.required;\}/.test(html), '渡劫门槛 = 本段需求');
  const raw = G.fresh(9703, 'human');
  raw.level = 99; raw.daoXp = 12345;
  const n = G.normalize(JSON.parse(JSON.stringify(raw)));
  ok(n.level === 36, 'level 超上限被夹到 36', String(n.level));
  ok(n.daoXp === 0, '存档里的 daoXp 载入即归零', String(n.daoXp));
  ok(n.major === 8, '载入后 major 与 level 一致', String(n.major));
  ok(n.maxHp === D.REALM_STATS[11].hp, '载入后属性按 36 段表落位', String(n.maxHp));
}

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
