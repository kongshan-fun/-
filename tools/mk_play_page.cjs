'use strict';
/*
 * 生成「打开即在档」的本地试玩页：play/<dir>/index.html
 *
 * 试玩页 = 构建产物 + 两段注入：
 *   ① 存档播种脚本（紧跟在 <body> 之后，必须在游戏脚本之前跑）
 *   ② 轮询式自动进入脚本（放在 </body> 之前）
 *
 * 用法：
 *   node tools/mk_play_page.cjs <源试玩页.html> <目标目录名> [构建产物.html]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const [srcRel, dir, baseRel] = process.argv.slice(2);
if (!srcRel || !dir) {
  console.error('用法: node tools/mk_play_page.cjs <源试玩页.html> <目标目录名> [构建产物.html]');
  process.exit(1);
}
const src = fs.readFileSync(path.resolve(ROOT, srcRel), 'utf8');
const base = fs.readFileSync(path.resolve(ROOT, baseRel || 'index.html'), 'utf8');

// ① 存档播种块
const SEED_START = '<script id="seed-save"';
const SEED_END = '<div id="phone"';
const i = src.indexOf(SEED_START);
const j = src.indexOf(SEED_END, i);
if (i < 0 || j < 0) throw new Error('源试玩页里找不到存档播种块');
const seedBlock = src.slice(i, j);

// ② 自动进入块
const AUTO_MARK = '/* 轮询式自动进入';
const m = src.indexOf(AUTO_MARK);
if (m < 0) throw new Error('源试玩页里找不到自动进入块');
const k = src.lastIndexOf('<script>', m);
if (k < 0) throw new Error('自动进入块缺少 <script> 起始');
const AUTO_END = '</body>';
const l = src.indexOf(AUTO_END, m);
if (l < 0) throw new Error('源试玩页里找不到 </body>');
const autoBlock = src.slice(k, l).replace(/\s+$/, '');

if (base.includes(SEED_START)) throw new Error('构建产物里已经有 seed 块，拒绝重复注入');
if (base.includes('轮询式自动进入')) throw new Error('构建产物里已经有自动进入块，拒绝重复注入');

const bodyAnchor = '\r\n<body>';
if (!base.includes(bodyAnchor)) throw new Error('构建产物缺少 <body> 锚点');
let out = base.replace(bodyAnchor, bodyAnchor + '\r\n' + seedBlock);

const tail = '\r\n</body>\r\n</html>';
if (!out.includes(tail)) throw new Error('构建产物缺少 </body> 锚点');
out = out.replace(tail, '\r\n' + autoBlock + '\r\n</body>\r\n</html>');

const outDir = path.join(ROOT, 'play', dir);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), out, 'utf8');
console.log(`  seed ${seedBlock.length} 字符 + auto ${autoBlock.length} 字符 -> play/${dir}/index.html`);
