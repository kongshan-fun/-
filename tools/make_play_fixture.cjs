'use strict';
/* 生成回归 fixture：种子存档 + 自动入世（自动入世放在 </body> 前，便于测试剥离种子块后仍保留）
   用法: node make_play_fixture.cjs <release.html> <outDir> */
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const outDir = process.argv[3];
if (!target || !outDir) throw new Error('用法: node make_play_fixture.cjs <release.html> <outDir>');

const playRoot = 'D:\\deepseek harness\\v964\\山野修仙记_V90.64_本地完整交付候选包\\play';
let html = fs.readFileSync(target, 'utf8');
const donor = fs.readFileSync(path.join(playRoot, 'jindan-v961/index.html'), 'utf8');

const seedStart = donor.indexOf('<script id="seed-save"');
const seedEnd = donor.indexOf('</script>', seedStart) + '</script>'.length;
if (seedStart < 0) throw new Error('donor 缺少 seed-save 块');
const seed = donor.slice(seedStart, seedEnd);

const IMPORTER = `
<script id="seed-import">
/* 打开即在档：写入 001 档位（挑战线键名），已存在则不覆盖 */
(function(){
  try{
    var raw = document.getElementById('seed-save').textContent.trim();
    if(!raw) throw new Error('empty seed');
    var K = 'qinglan-wendao-v14-human-slot-001';
    if(!localStorage.getItem(K)){
      localStorage.setItem(K, raw);
      localStorage.setItem(K + '-backup', raw);
      window.__SEEDED__ = true;
    } else { window.__SEEDED__ = false; }
  }catch(e){ window.__SEED_ERR__ = String(e && e.message || e); }
})();
</script>`;

const AUTO_ENTRY = `
<script id="auto-entry">
/* 自动入世：难度 → 种族 → 档案 → 001 档；放在 body 末尾，剥离种子块后依然生效 */
(function(){
  if(/[?&]play=0/.test(location.search)) return;
  var STEPS = [
    '[data-a="difficulty-choice"][data-mode="challenge"]',
    '[data-a="difficulty-next"]',
    '[data-a="view-slots"][data-role="human"]',
    '[data-a="slot-open"][data-role="human"][data-slot="1"]'
  ];
  function entered(){ return document.body.innerText.indexOf('\u6c14\u8840') >= 0; }
  function run(){
    if (window.__AUTO_ENTERED__) return;
    for (var i = 0; i < STEPS.length; i++) {
      var el = document.querySelector(STEPS[i]);
      if (!el || el.disabled) return;
      el.click();
    }
    if (entered()) window.__AUTO_ENTERED__ = true;
  }
  var n = 0;
  var timer = setInterval(function(){ run(); if (window.__AUTO_ENTERED__ || ++n > 100) clearInterval(timer); }, 100);
  document.addEventListener('DOMContentLoaded', run);
  run();
})();
</script>`;

const anchor = '<body>\n';
const idx = html.indexOf(anchor);
if (idx < 0) throw new Error('发布文件缺少 <body>\\n 锚点');
html = html.slice(0, idx + anchor.length) + seed + '\n' + IMPORTER + '\n' + html.slice(idx + anchor.length);

const tail = html.lastIndexOf('</body>');
if (tail < 0) throw new Error('发布文件缺少 </body>');
html = html.slice(0, tail) + AUTO_ENTRY + '\n' + html.slice(tail);

fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'index.html');
fs.writeFileSync(file, html, 'utf8');
console.log('已生成 ' + file + '  ' + html.length + ' 字符');
