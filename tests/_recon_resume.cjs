'use strict';
const fs = require('fs');
const path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const anchors = ['qinglan-wendao-v14-current', 'ACTIVE_KEY', 'function current', 'slots.current', 'resume', 'boot()', 'function boot'];
for (const a of anchors) {
  let i = s.indexOf(a);
  let n = 0;
  console.log('\n===== ' + a + ' =====');
  while (i >= 0 && n < 3) {
    n++;
    const line = s.slice(0, i).split('\n').length;
    console.log('  行 ' + line + ': ' + s.slice(Math.max(0, i - 230), i + 320).replace(/\n/g, '\n    '));
    i = s.indexOf(a, i + 1);
  }
  if (!n) console.log('  (无)');
}
