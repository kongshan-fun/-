'use strict';
/* 上传 4 张 V90.37 商店截图到 TapTap 素材库，打印 url + info */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NODE = 'D:\\node\\node.exe';
const CLI_DIR = 'D:\\taptap-cli';
const CLI = 'node_modules\\@taptap\\cli\\scripts\\run.js';
const SRC = 'D:\\deepseek harness\\shanhe-repo\\visual\\store-v937';

function run(args) {
  const out = execFileSync(NODE, [CLI, ...args], { cwd: CLI_DIR, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf('{')));
}

const files = ['01-camp.png', '02-combat.png', '03-character.png', '04-trial.png'];
const results = [];
for (const f of files) {
  const src = path.join(SRC, f);
  const dst = path.join(CLI_DIR, 'assets', f);
  fs.copyFileSync(src, dst);
  console.log('上传 ' + f + ' …');
  const j = run(['upload', 'assets/' + f, '--dev-id', '380806', '--app-id', '980929', '--yes', '--json']);
  if (!j.ok) { console.log('  失败: ' + JSON.stringify(j.error).slice(0, 200)); continue; }
  const d = j.data || {};
  const res = d.result || d;
  console.log('  ' + JSON.stringify(res).slice(0, 300));
  results.push({ file: f, raw: res });
}
fs.writeFileSync('D:\\deepseek harness\\shanhe-repo\\visual\\store-v937\\upload-result.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\n结果已写入 visual/store-v937/upload-result.json');
