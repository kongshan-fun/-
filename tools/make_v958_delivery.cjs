'use strict';
/* 生成 V90.58 交付包：HTML + 源码快照 + 补丁 + 测试证据 + SHA256 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '..', 'deliver-v90.58');
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ['html', 'html/frozen', 'src', 'patches', 'tests', 'evidence', 'docs']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
const cp = (from, toDir) => {
  const dst = path.join(toDir, path.basename(from));
  fs.copyFileSync(from, dst);
  return dst;
};

/* 1) HTML 与冻结基线 */
const html = fs.readFileSync(path.join(ROOT, 'index.html'));
cp(path.join(ROOT, 'index.html'), path.join(OUT, 'html'));
for (const f of ['山野修仙记_V90.56_渡劫改制.html', '山野修仙记_V90.57_属性丹.html', '山野修仙记_V90.58_跨境解锁.html']) {
  const p = path.join(ROOT, 'releases', f);
  if (fs.existsSync(p)) cp(p, path.join(OUT, 'html', 'frozen'));
}

/* 2) 源码与构建器 */
for (const f of ['tools/build_v958_from_main.py', 'tests/v958_cross_realm_unlock.cjs',
                 'tests/v958_old_save_flow.cjs', 'tests/v958_dual_growth_chain.cjs',
                 'tests/run_full_regression.cjs', 'tests/syntax_check.cjs']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) cp(p, path.join(OUT, /build_/.test(f) ? 'patches' : 'tests'));
}

/* 3) 差异补丁（V90.57 → V90.58） */
try {
  const diff = execFileSync('git', ['diff', '--no-color', 'HEAD', '--', 'index.html'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(OUT, 'patches', 'V90.57-to-V90.58.diff'), diff);
} catch (e) { fs.writeFileSync(path.join(OUT, 'patches', 'V90.57-to-V90.58.diff'), '// 生成失败: ' + e.message); }

/* 4) 证据：截图与测试输出 */
const ev = path.join(OUT, 'evidence');
for (const f of ['taptap-v957-selftest-qr.png', 'taptap-v951-selftest-qr.png']) {
  const p = path.join(ROOT, 'visual', f);
  if (fs.existsSync(p)) cp(p, ev);
}
for (const d of ['v958-oldsave']) {
  const p = path.join(ROOT, 'visual', d);
  if (fs.existsSync(p)) {
    const dir = path.join(ev, d); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(p)) { try { cp(path.join(p, f), dir); } catch {} }
  }
}

/* 5) 文档 */
for (const f of fs.readdirSync(path.join(ROOT, 'docs'))) {
  if (/\.md$/.test(f)) { try { cp(path.join(ROOT, 'docs', f), path.join(OUT, 'docs')); } catch {} }
}

/* 6) SHA256 校验文件 */
const lines = ['# 山野修仙记 V90.58 交付校验（SHA-256）', '# 生成时间 ' + new Date().toISOString(), ''];
function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(abs, r);
    else if (!/SHA256SUMS/.test(e.name)) {
      lines.push(sha256(fs.readFileSync(abs)) + '  ' + r);
    }
  }
}
walk(OUT);
fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), lines.join('\n') + '\n', 'utf8');

console.log('output : ' + OUT);
console.log('html   : ' + sha256(html));
let count = 0, bytes = 0;
(function stat(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const a = path.join(d, e.name); if (e.isDirectory()) stat(a); else { count++; bytes += fs.statSync(a).size; } } })(OUT);
console.log('files  : ' + count + ' / ' + bytes.toLocaleString() + ' B');
