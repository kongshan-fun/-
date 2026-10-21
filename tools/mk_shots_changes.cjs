'use strict';
/* 读取当前 screenshots 字段现值（read-before-write 用），并生成 changes.json */
const { execFileSync } = require('child_process');
const fs = require('fs');

const NODE = 'D:\\node\\node.exe';
const CLI_DIR = 'D:\\taptap-cli';
const CLI = 'node_modules\\@taptap\\cli\\scripts\\run.js';

function run(args) {
  const out = execFileSync(NODE, [CLI, ...args], { cwd: CLI_DIR, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf('{')));
}

const mod = run(['app', 'get-app-module', '--dev-id', '380806', '--app-id', '980929', '--data', JSON.stringify({ module_id: 'assets-upload' }), '--json']);
const fields = mod.data.result.fields;
const cur = fields.screenshots.current_value;
console.log('当前截图数量:', Array.isArray(cur) ? cur.length : 0);
console.log('当前截图:', JSON.stringify(cur).slice(0, 300));

const ups = JSON.parse(fs.readFileSync('D:\\deepseek harness\\shanhe-repo\\visual\\store-v937\\upload-result.json', 'utf8'));
const value = ups.map((u) => ({ url: u.raw.url, info: u.raw.info }));
console.log('新截图:', value.map((v) => v.url.slice(-12)).join(' '));

const changes = {
  app_id: 980929,
  developer_id: 380806,
  changes: [
    { field_id: 'screenshots', op: 'replace', expected: cur, value },
  ],
};
fs.writeFileSync('D:\\taptap-cli\\shots-changes.json', JSON.stringify(changes, null, 2), 'utf8');
console.log('已写 shots-changes.json');
