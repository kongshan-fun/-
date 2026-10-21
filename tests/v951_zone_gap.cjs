'use strict';
/* V90.51 验收：越级压制（境界差 → 对手更强、我方更钝） */
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

const G = ctx.QGame;
const mk = (level, major, zone) => { const g = Object.create(G.prototype); g.s = { level, major, zone, daoXp: 0, character: 'human', ascended: false, maxHp: 1000, hp: 1000, inv: {}, cleared: Array(12).fill(true) }; return g; };

/* 同境：无压制 */
const same = mk(18, 2, 4); // 自身境6（金丹），zone4 → zoneRealm 5 → gap 0
ok(same.zoneGap === 0, '同境 gap=0', String(same.zoneGap));
ok(same.enemyBoost === 1 && same.playerDampen === 1, '同境：敌伤 ×1、我方 ×1');

/* 越 1 境 */
const up1 = mk(21, 2, 6); // 自身境7（元婴，level21），zone6 → 境8（化神）
console.log('  （调试）up1.zoneGap =', up1.zoneGap);
ok(up1.zoneGap === 1, '越 1 境 gap=1', String(up1.zoneGap));
ok(Math.abs(up1.enemyBoost - 1.10) < 1e-9, '越 1 境：敌伤 ×1.10', up1.enemyBoost.toFixed(2));
ok(Math.abs(up1.playerDampen - 0.92) < 1e-9, '越 1 境：我方 ×0.92', up1.playerDampen.toFixed(2));

/* 越 3 境 / 越 8 境 */
const up3 = mk(21, 2, 8);
ok(up3.zoneGap === 3, '越 3 境 gap=3', String(up3.zoneGap));
ok(Math.abs(up3.enemyBoost - 1.30) < 1e-9, '越 3 境：敌伤 ×1.30');
const far = mk(3, 0, 9);
ok(far.zoneGap > 5, '低境去高图 gap>5', String(far.zoneGap));
ok(Math.abs(far.playerDampen - 0.20) < 1e-9, '压制下限 0.20（我方输出不归零）', far.playerDampen.toFixed(2));

/* 低境主角在高图：zone+1 计算自洽 */
ok(mk(1, 0, 0).zoneGap === 1, '凡人打青岚：zoneRealm=2 → gap=1');

/* 源码层：开局确实套用了两个系数 */
ok(/atk:Math\.round\(e\.atk\*\(repeat\?1\.25:1\)\*this\.enemyBoost\)/.test(html), '开局对手攻击 × enemyBoost');
ok(/maxHp=Math\.round\(e\.hp\*\(repeat\?1\.25:1\)\/this\.playerDampen\)/.test(html), '开局对手气血 ÷ playerDampen');

console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
process.exitCode = fail === 0 ? 0 : 1;
