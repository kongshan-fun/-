'use strict';
const fs = require('fs');
const p = process.argv[2];
const t = fs.readFileSync(p, 'utf8');
function dump(label, key, before, after, max = 1) {
  console.log('\n===== ' + label + ' =====');
  let i = -1, n = 0;
  while ((i = t.indexOf(key, i + 1)) >= 0 && n < max) {
    console.log(JSON.stringify(t.slice(Math.max(0, i - before), i + after)));
    n++;
  }
  if (!n) console.log('(未命中)');
}
dump('breakthrough 全文', ' breakthrough(', 40, 1900);
dump('xp 循环', ' xp(amount)', 0, 1200);
dump('normalize combat 重建', 'n.combat={type:', 700, 200);
dump('zoneGap', 'get zoneGap', 0, 320);
