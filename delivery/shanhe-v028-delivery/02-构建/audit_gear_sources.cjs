'use strict';
/*
 * 装备来源体检（V90.23 起）
 *
 * 只读：从 index.html 取出引擎，逐境列出「可炼装备 / 首领强度 / 战斗掉落」，
 * 并给出改动前后「不采集也能拿到几件成品」的对照。
 *
 * 用法：node tools/audit_gear_sources.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const ctx = vm.createContext({ console: { log() {}, error() {} } });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame, D = ctx.QData;

const BTL_DROP_OLD = 0.22;   // 旧：普通怪 22% 掉成品
const BTL_DROP_NEW = 0;      // 新：普通怪不掉成品

function drops(zone) {
  const st = zone >= 5 ? D.ASCENSION_STAGES[zone - 5] : null;
  if (st) return `${D.ITEMS[st.primary].name}×2 / ${D.ITEMS[st.secondary].name}×1 / 灵尘×${2 + Math.max(0, zone - 5)}`;
  return `玄铁矿×2 / 青藤×1 / 灵木×1 / 灵尘×2`;
}

const pad = (s, n) => String(s).padEnd(n, ' ');
const rows = [];
for (let z = 0; z < D.ZONES.length; z++) {
  const zone = D.ZONES[z];
  const craftable = D.RECIPES.filter((r) => r.gear && !r.secret && (z === 0
    ? ['woodSword', 'ironSword', 'robe', 'hideRobe'].includes(r.id)
    : r.zone === z));
  const boss = D.ENEMIES['boss' + z];
  const secretGear = D.SECRETS[z] ? D.RECIPES.filter((r) => r.secret && r.zone === z).length : 0;
  rows.push({
    z, name: zone.name,
    craft: craftable.map((r) => r.name).join('、') || '—',
    secretGear,
    boss: boss ? `${boss.hp}/${boss.atk}` : '—',
    drop: drops(z),
  });
}

console.log('=== 每境装备来源（V90.23：战斗与秘境不再给成品）===\n');
console.log(pad('境', 4) + pad('地图', 14) + pad('可炼成品', 30) + pad('秘藏专属', 10) + pad('首领 hp/atk', 14) + '战斗掉落（器材）');
console.log('-'.repeat(120));
for (const r of rows) {
  console.log(pad(r.z, 4) + pad(r.name, 14) + pad(r.craft, 30) + pad(r.secretGear, 10) + pad(r.boss, 14) + r.drop);
}

console.log('\n=== 「不采集也能拿到几件成品」对照（按一个境打 20 场估算）===\n');
console.log(pad('境', 4) + pad('地图', 14) + pad('旧：普通怪 22%', 16) + pad('旧：首领必掉', 14) + pad('旧合计', 10) + '新（V90.23）');
console.log('-'.repeat(90));
for (const r of rows) {
  const normalOld = +(20 * BTL_DROP_OLD).toFixed(1);
  const bossOld = 1;
  console.log(pad(r.z, 4) + pad(r.name, 14) + pad(normalOld, 16) + pad(bossOld, 14)
    + pad((normalOld + bossOld).toFixed(1), 10) + `0 件成品（掉落改为器材 ×${BTL_DROP_NEW + 1} 组）`);
}

const totalCraft = rows.reduce((n, r) => n + (r.craft === '—' ? 0 : r.craft.split('、').length), 0);
console.log(`\n合计：可炼成品 ${totalCraft} 件（含秘藏专属 ${rows.reduce((n, r) => n + r.secretGear, 0)} 件）`
  + '；改动后成品唯一来源＝炼器室炼制。');
