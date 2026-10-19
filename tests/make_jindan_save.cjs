'use strict';
/**
 * 生成「刚进阶 · 准备渡劫金丹」存档
 * 目标：coreTrialReason() 返回空串（全部前置满足），但三重雷劫尚未开启。
 * 输出：raw game state（可直接被「导入存档」接受）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const ctx = vm.createContext({ console });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame;
const D = ctx.QData;

const SEED = 20261019;
const s = Game.fresh(SEED, 'human');

// —— 位置与境域：第 6 境 丹霞雷渊（zone 5），筑基／通脉后期（major 1）
s.zone = 5;
s.major = 1;
s.unlocked = 6;
s.ascended = false;
s.ended = false;
s.combat = false;
s.secretRealm = null;

// —— 境界与道行
s.level = 18;
s.daoXp = 60;              // 金丹需求 60，正好达标，留出可继续增长的余地

// —— 先前各境全部通关
for (let i = 0; i < 6; i++) {
  s.ritual[i] = true;
  s.cleared[i] = true;
}

// —— 本境洞府已建成，且角色正站在府中（atCamp 为真）
s.pos = { x: 1, y: 5 };
s.last = { ...s.pos };
s.visited[5 + ':1,5'] = true;
s.settlements[5] = {
  pos: { x: 1, y: 5 },
  level: 3,
  buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 2, gate: 1 },
  stash: {},
  storedGears: [],
  foundedAt: s.minutes,
  farmAt: s.minutes,
};

// —— 破境道材：金丹需 coreOre×2 + coreHerb×1，另给一些常用物资
for (const id of Object.keys(D.ITEMS)) s.inv[id] = 0;
Object.assign(s.inv, {
  coreOre: 2, coreHerb: 1,      // 破境道材（雷凝砂 / 丹霞芝），恰好够一次突破
  water: 6, berry: 6, salve: 2  // 少量补给，避免超载
});

// —— 生存状态拉满
s.hp = s.maxHp;
s.spirit = s.maxSpirit;
s.hunger = 100;
s.water = 100;
if (s.life) s.life.left = 60 * D.LIFE.yearMinutes;   // 余寿 60 年，够折腾

// —— 三重雷劫：未开启、未完成
s.flags.coreTribulation = { phase: 0, marks: 0, started: false, complete: false };

// —— 新手引导标记为已完成，避免载入后弹「从一草一木，开始」
if (!s.guide) s.guide = {};
s.guide.status = 'done';
s.guide.step = 0;
s.guide.rewarded = true;

// —— 心魔/问心等试炼保持干净
s.flags.heartTrial = { phase: 0, started: false, complete: false, choices: [] };

// —— 校验（maxHp/maxSpirit 由归一化后的属性决定，满血必须在 new Game 之后设置）
const g = new Game(s, SEED, 'human');
g.s.hp = g.s.maxHp;
g.s.spirit = g.s.maxSpirit;
g.s.hunger = 100;
g.s.water = 100;
const reason = g.coreTrialReason();
const st = g.s;
console.log('=== 生成结果 ===');
console.log('  境域        : 第 ' + (st.zone + 1) + ' 境 ' + D.ZONES[st.zone].name);
console.log('  阶段        : major=' + st.major);
console.log('  等级 / 道行 : ' + st.level + ' / ' + st.daoXp + '（金丹需求 ' + D.ASCENSION_STAGES[0].needDao + '）');
console.log('  问道坛      : ' + st.ritual[5] + '   首领: ' + st.cleared[5]);
console.log('  本境洞府    : ' + !!st.settlements[5] + '   在府中: ' + g.atCamp);
console.log('  主材/副材   : ' + D.ITEMS[D.ASCENSION_STAGES[0].primary].name + ' ' + g.has(D.ASCENSION_STAGES[0].primary) + '/2 · ' +
            D.ITEMS[D.ASCENSION_STAGES[0].secondary].name + ' ' + g.has(D.ASCENSION_STAGES[0].secondary) + '/1');
console.log('  雷劫        : phase=' + g.coreTrial.phase + ' started=' + g.coreTrial.started + ' complete=' + g.coreTrial.complete);
console.log('  负重 / 容量 : ' + g.weight + '/' + g.capacity + (g.weight > g.capacity ? '  ⚠ 超载' : '  ✔'));
console.log('  寿元        : ' + g.lifeYears.toFixed(1) + ' 年');
console.log('');
console.log('  coreTrialReason() = ' + (reason === '' ? '(空) ✔ 全部前置已满足' : '「' + reason + '」✘'));
if (reason !== '') { console.log('\n生成失败：前置仍未满足'); process.exit(1); }

// —— 序列化（模拟真实存档落盘：JSON 字符串）
const payload = JSON.parse(JSON.stringify(g.state()));
const outDir = path.join(ROOT, 'saves');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'shanhe-v910-jindan-ready.json');
fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
console.log('\n已写出：' + file);
console.log('  版本号 version = ' + payload.version + '   大小 ' + fs.statSync(file).size.toLocaleString() + ' 字节');

// —— 回读校验：能重新载入且理由仍为空
const g2 = new Game(JSON.parse(fs.readFileSync(file, 'utf8')), SEED, 'human');
console.log('  回读校验 retrialReason = ' + (g2.coreTrialReason() === '' ? '(空) ✔' : '「' + g2.coreTrialReason() + '」'));
