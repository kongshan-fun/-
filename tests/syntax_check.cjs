'use strict';
/* 提取 HTML 内所有 <script> 块做真实语法检查（不执行），并检查是否存在外部依赖。 */
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || 'index.html';
const html = fs.readFileSync(path.resolve(file), 'utf8');

let n = 0, bad = 0, total = 0;
const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) {
  const code = m[1];
  total += code.length;
  n++;
  try {
    new Function(code); // 只解析，不执行
  } catch (e) {
    bad++;
    const line = html.slice(0, m.index).split('\n').length;
    console.error(`  FAIL 第 ${n} 个 script（约行 ${line}）: ${e.message}`);
  }
}
console.log(`script 块 ${n} 个 / 共 ${total} 字符 / 语法错误 ${bad} 个`);

const externals = [
  [/<link[^>]+href=/i, '外部样式 <link>'],
  [/<script[^>]+src=/i, '外部脚本 <script src>'],
  [/https?:\/\//i, '远程 URL'],
];
let ex = 0;
for (const [r, label] of externals) {
  if (r.test(html)) { console.error(`  FAIL 存在${label}`); ex++; }
}
console.log(ex === 0 ? '自包含检查: 通过（无外链、无远程资源）' : `自包含检查: ${ex} 项不通过`);

process.exit(bad === 0 && ex === 0 ? 0 : 1);
