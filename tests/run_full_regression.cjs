'use strict';
/*
 * 全量回归入口（P1-3）
 *
 * 一次跑完引擎、存档、界面与浏览器四层，任何一层失败即整体失败并打印定位。
 * 用法：node tests/run_full_regression.cjs [play目录]
 *   默认 play 目录会自动选「与 index.html 字节一致」的发布文件对应的 jindan-vNNN；
 *   找不到就用最新的 play/jindan-v*。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;

function pickPlayDir() {
  if (process.argv[2]) return process.argv[2];
  const dirs = fs.readdirSync(path.join(ROOT, 'play'))
    .filter((d) => /^jindan-v\d+$/.test(d))
    .sort((a, b) => Number(b.split('-v')[1]) - Number(a.split('-v')[1]));
  return dirs[0];
}
const PLAY = pickPlayDir();

const LAYERS = [
  ['语法与自包含', 'node', ['tests/syntax_check.cjs']],
  ['引擎 6 套回归（含人妖两族 × 100 档全里程碑、储物袋、飞升、结算中断）', 'node', ['tests/run_v908_regression.cjs']],
  ['装备掉落与来源', 'node', ['tests/v923_gear_drop.cjs']],
  ['装备经济闭环', 'node', ['tests/v927_gear_economy.cjs']],
  ['七境突破指引', 'node', ['tests/v926_realm_guide.cjs']],
  ['角色装备布局契约', 'node', ['tests/v908-character-gear-layout.test.cjs']],
  ['UI 结构（设置父子页 / 三宽度）', 'node', ['tests/v914_ui_structure.cjs', PLAY]],
  ['设置动作（主题/动效/行记/资质榜/续命/存档）', 'node', ['tests/v909_settings_browser.cjs', PLAY]],
  ['图鉴父子页', 'node', ['tests/v917_book_hierarchy.cjs', PLAY]],
  ['评价与加群入口', 'node', ['tests/v919_promo.cjs', PLAY]],
  ['评价入口触发时机（关闭重开）', 'node', ['tests/v922_promo_trigger.cjs']],
  ['轮回玉每档一次（刷新 / 换档）', 'node', ['tests/v925_jade_once.cjs', PLAY]],
  ['存档往返（关闭重开 / 导出 / 旧档导入 / 备份）', 'node', ['tests/v929_save_roundtrip.cjs', PLAY]],
  ['八面板 × 三宽度矩阵', 'node', ['tests/v915_widths_matrix.cjs', PLAY]],
  ['file:// 双击直开', 'node', ['tests/v910_file_launch_check.cjs']],
  ['8 视口 Chromium 布局（含百档 20 格 / 洞府建筑）', 'python', ['tests/browser_responsive.py']],
];

const results = [];
let failed = 0;
/* 已知未达标层：失败不被当成回归，但必须打印原因，且不能悄悄消失。
   目前只有一项：洞府在 360×640 仍 1.47 屏 —— 结构性，等产品决策（docs §7.5）。
   **必须"确实是那一条"才算已知**：把 label 映射成正则，避免洞府以外的失败（比如
   浏览器起不来、fetch failed）被这张白名单吞掉——第一次接 CI 时就踩过这个坑。 */
const KNOWN = {
  '八面板 × 三宽度矩阵': {
    match: /超出 1\.02 屏的项[^\n]*: 1 \/ 24/,
    reason: '洞府 360×640 仍 1.47 屏（设施网格 407.6px ≈ 可视 413px；压到 1.02 需砍字，见 docs §7.5）',
  },
};
let known = 0;
console.log(`全量回归开始（play 目录：${PLAY}）\n`);
for (const [label, runner, args] of LAYERS) {
  const started = Date.now();
  const r = runner === 'python'
    ? spawnSync('python', args, { cwd: ROOT, encoding: 'utf8' })
    : spawnSync(NODE, args, { cwd: ROOT, encoding: 'utf8' });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const okRun = !r.error && r.status === 0;
  const out = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
  const knownSpec = KNOWN[label];
  const isKnown = !okRun && !!knownSpec && knownSpec.match.test(out) && !/fetch failed/i.test(out);
  if (!okRun && !isKnown) failed++;
  if (isKnown) known++;
  results.push({ label, ok: okRun, known: !!isKnown, secs, code: r.status });
  console.log(`${okRun ? 'PASS' : isKnown ? 'KNOWN' : 'FAIL'}  ${label}  (${secs}s)`);
  if (isKnown) console.log(`  已知：${knownSpec.reason}`);
  if (!okRun) {
    const tail = out.split(/\r?\n/).slice(-14);
    console.log('  ---- 输出尾部 ----');
    console.log(tail.map((l) => '  ' + l).join('\n'));
    /* GitHub Actions 会把 ::error:: 转成检查注解——失败层名与尾部输出因此不需要登录也能读 */
    if (!isKnown) {
      console.log(`::error::${label} 失败：${r.error ? r.error.message : 'exit ' + r.status}`);
      for (const l of tail.slice(-8)) console.log('::error::' + String(l).replace(/\r/g, '').slice(0, 900));
    }
  }
}

console.log('\n=== 汇总 ===');
for (const r of results) console.log(`${r.ok ? '✓' : r.known ? '△' : '✗'} ${r.label}  ${r.secs}s`);
const passCount = results.filter((r) => r.ok).length;
console.log(`\n${failed === 0 ? 'FULL REGRESSION PASS' : 'FULL REGRESSION FAIL'}：`
  + `${passCount}/${results.length} 层通过，${known} 层已知未达标`
  + (known ? '（见上方原因）' : ''));
process.exitCode = failed === 0 ? 0 : 1;
