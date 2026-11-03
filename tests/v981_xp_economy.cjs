'use strict';
/* V90.81 map-tier cultivation XP regression; run: node tests/v981_xp_economy.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const root = {};
for (const script of scripts.slice(0, 5)) new Function('globalThis', script[2])(root);
const { QData: D, QGame: G } = root;
assert.equal(D.RELEASE, 'V90.81');
let checks = 0;
const check = (condition, label) => { checks++; assert.ok(condition, label); };
function create(level, zone, race = 'human', difficulty = 'standard', seed = 261014) {
  const g = new G(null, seed, race, null, difficulty);
  g.s.level = level; g.syncMajor(); g.s.zone = zone;
  g.s.unlocked = Math.max(g.s.unlocked, zone + 1);
  const stats = D.applyPills(D.statsForLevel(level), g.s);
  Object.assign(g.s, { maxHp: stats.hp, hp: stats.hp, maxSpirit: stats.spirit,
    spirit: stats.spirit, attack: stats.atk, hunger: 100, water: 100 });
  return g;
}
function home(g) {
  const s = g.s;
  s.homestead = { version: 1, pos: { x: 1, y: 5 }, level: 1,
    buildings: {}, stash: {}, storedGears: [], pendingHarvest: {},
    foundedAt: s.minutes, farmAt: s.minutes, migratedFrom: 0 };
  s.storageBags.bagSlayer = true; s.stats.kills = 100;
  return g;
}
for (let zone = 0; zone < D.ZONES.length; zone++) {
  const exp = Math.max(1, Math.round(D.REALM_BASE[zone] / 40));
  for (const race of ['human', 'demon']) for (const difficulty of ['easy', 'standard', 'challenge']) {
    const low = create(1, zone, race, difficulty);
    const mid = create(15, zone, race, difficulty);
    const high = create(34, zone, race, difficulty);
    check(low.worldXp('chore', 'grass') === mid.worldXp('chore', 'grass'), 'same zone, player level independent');
    check(mid.worldXp('chore', 'grass') === high.worldXp('chore', 'grass'), 'high-level farming capped');
    check(low.worldXp('boss', D.ZONES[zone].boss) === high.worldXp('boss', D.ZONES[zone].boss), 'boss map tier');
    check(mid.worldXp('main') === low.worldXp('main'), 'quest map tier');
    check(low.worldXp('chore') === exp, 'scout map-tier base');
  }
}
for (let z = 0; z < 11; z++) {
  check(create(15, z + 1).worldXp('chore', 'grass') > create(15, z).worldXp('chore', 'grass'), 'gather map progression');
  check(create(15, z + 1).worldXp('boss', D.ZONES[z + 1].boss) >
    create(15, z).worldXp('boss', D.ZONES[z].boss), 'boss map progression');
}
const sample = create(15, 0);
check(sample.worldXp('chore', 'grass') === 20, 'first map gathering 20 base');
check(sample.worldXp('mob', 'guard') > sample.worldXp('mob', 'rabbit'), 'enemy config xp controls rank');
check(sample.worldXp('chore', 'coreOre') > sample.worldXp('chore', 'grass'), 'resource config xp controls rank');
check(sample.worldXp('chore', 'grass') < sample.xpRatio('chore'), 'wilderness != cultivation');
const high = create(34, 0);
check(high.worldXp('chore', 'grass') === 20, 'late realm cannot grow first-map yields');
check(create(34, 11).worldXp('mob', 'realm11') > 1000, 'late map stronger yields');
home(sample); sample.s.pos = { x: 4, y: 5 }; sample.s.last = { ...sample.s.pos }; sample.reveal();
const ix = sample.sceneNodes().findIndex((_, i) => sample.resource(i) === 'grass');
const expBefore = sample.s.xp;
check(sample.act('gather', { index: ix }).ok, 'real gather action');
check(sample.s.xp - expBefore > 0 && sample.s.xp - expBefore < 40, 'real gather map-tier reward');
const reload = new G(sample.state(), 261014, 'human', null, 'standard');
check(reload.s.xp === sample.s.xp && reload.s.level === sample.s.level, 'old save format roundtrip');
const enemy = home(create(15, 0)); enemy.s.attack = 1000; enemy.s.maxHp = 100000; enemy.s.hp = 100000;
const enemyBefore = enemy.s.xp;
check(enemy.startBattle('rabbit').ok, 'rabbit fight started');
for (let t = 0; t < 20 && enemy.s.combat; t++) check(enemy.act('fight', { mode: 'attack' }).ok, 'fight turn');
const got = enemy.s.xp - enemyBefore;
const log = enemy.s.logs.map(x => JSON.stringify(x)).join('\\n');
check(got > 0 && got < 60, 'rabbit reward limited on high-level character');
check(log.includes('修为+' + got), 'fight log credited XP');
check(log.includes('修为 +' + got), 'fight reward credited XP');
const asc = home(create(15, 4)); asc.s.xp = asc.required; asc.enterHome();
check(asc.act('breakthrough').ok && asc.s.level === 16, 'original tribulation outcome');
const mover = create(1, 0); mover.s.pos = { x: 4, y: 5 };
mover.s.last = { ...mover.s.pos }; mover.s.stats.steps = 0; mover.reveal();
for (let i = 0; i < 8; i++) {
  const m = mover.act('move', { x: i % 2 ? 4 : 5, y: 5 });
  check(m.ok && mover.s.xp === 0, 'walking never awards XP');
}
// Regression of the previous exploit: from level 1, 1708 genuine first-map gathers
// previously reached level 36. Supplies and permanent bag are pregranted to isolate
// reward balance, not to simulate an unaided new-save playthrough.
const grind = home(create(1, 0));
grind.s.pos = { x: 4, y: 5 }; grind.s.last = { ...grind.s.pos };
grind.s.inv = { berry: 300, water: 270 }; grind.reveal();
let gathers = 0, cycles = 0;
function maintain() {
  for (const [id, field] of [['berry', 'hunger'], ['water', 'water']])
    for (let k = 0; grind.s[field] < 45 && k < 6; k++)
      assert.ok(grind.act('consume', { id }).ok, 'supplies available');
  for (let k = 0; grind.weight > grind.capacity - 60 && k < 1000; k++) {
    const item = Object.keys(grind.s.inv).filter(id =>
      grind.s.inv[id] > 0 && D.ITEMS[id]?.type === 'material')
      .sort((a, b) => grind.s.inv[b] * D.ITEMS[b].wt - grind.s.inv[a] * D.ITEMS[a].wt)[0];
    assert.ok(item && grind.act('discard', { id: item }).ok, 'free capacity');
  }
}
function breakReady() {
  while (grind.stageIndex === 3 && grind.s.xp >= grind.required && grind.s.level < 36) {
    grind.enterHome();
    assert.ok(grind.act('breakthrough').ok, 'standard advancement');
    grind.leaveHome();
  }
}
while (gathers < 1708 && !grind.s.ended && cycles++ < 500) {
  maintain(); breakReady();
  let did = false;
  for (let i = 0; i < grind.sceneNodes().length && gathers < 1708; i++) {
    while (grind.resource(i) && grind.left(i) > 0 && gathers < 1708) {
      maintain(); assert.ok(grind.act('gather', { index: i }).ok, 'first-map gather');
      gathers++; did = true; breakReady();
    }
  }
  if (!did) {
    grind.enterHome();
    assert.ok(grind.act('rest', { mode: 'dawn' }).ok, 'next harvest cycle');
    grind.leaveHome();
  }
}
check(gathers === 1708, '1708 actions executed');
check(grind.s.level <= 12, 'first-map progression no longer reaches advanced realms');
check(grind.s.unlocked === 1, 'no gate or map unlocked');
console.log('V90.81 XP economy PASS ' + checks + ' assertions | 1708 first-map gathers → lv' + grind.s.level);
