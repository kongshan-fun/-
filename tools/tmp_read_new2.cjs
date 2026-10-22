'use strict';
const fs = require('fs');
const p = process.argv[2];
const t = fs.readFileSync(p, 'utf8');
function show(label, key, before, after) {
  const i = t.indexOf(key);
  console.log('\n===== ' + label + ' @' + i + ' =====');
  if (i >= 0) console.log(t.slice(Math.max(0, i - before), i + after));
  else console.log('(未命中)');
}
show('advanceXpStages', ' advanceXpStages(', 0, 2200);
show('breakthrough (真身)', ' breakthrough(){', 0, 2000);
