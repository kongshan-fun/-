'use strict';
/*
 * V90.14 UI 结构回归测试（替代 V90.9 的 v909_settings_browser.cjs）
 *
 * 背景：v909_settings_browser 假定「顶栏有档案按钮 + 设置是单页六模块」，
 * 而 V90.13/V90.14 已改为「顶栏仅 教程/设置」与「设置父页 + 六子页」。
 * 该测试的 onboarding 依赖顶栏档案，改版后第一步即失败并级联 21 项。
 * 本测试按新结构验证：入世路径、设置六入口、六个子页可进可返、三种宽度。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v914';
const EDGE = require('./lib/browser').BROWSER;   // Edge / Chrome / Chromium / playwright 自带，CI 里也能跑
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (c, label, detail) => { if (c) { pass++; console.log('  PASS  ' + label + (detail ? '  — ' + detail : '')); } else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); } };

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      fs.readFile(path.join(root, rel), (e, b) => { if (e) { rsp.writeHead(404).end(); return; } rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(b); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve(path.join(ROOT, 'play', DIR));
  const port = 9880;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v914t-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map(); let errors = 0;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') errors++;
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors++;
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    console.log('=== 0. 入世路径（不再依赖顶栏档案） ===');
    ok(await ev(`!document.querySelector('[data-a="view-slots"]')`), '自动入世成功');
    const top = await ev(`[...document.querySelectorAll('.top-buttons button')].map(b=>b.textContent.trim())`);
    ok(JSON.stringify(top) === JSON.stringify(['教程', '设置']), '顶栏仅 教程/设置', top.join('/'));
    ok(!(await ev(`!!document.querySelector('.top-buttons [data-a="characters"]')`)), '顶栏已无「档案」');

    console.log('\n=== 1. 设置父页六入口 ===');
    ok(await click('[data-a="panel"][data-name="settings"]'), '设置可打开');
    await sleep(700);
    const rows = await ev(`[...document.querySelectorAll('#panel-body [data-a="panel-step"]')].map(b=>b.dataset.name)`);
    ok(rows.length === 6, '父页入口数为 6', '实际 ' + rows.length);
    const want = ['set-save', 'set-life', 'set-char', 'set-visual', 'set-help', 'set-reset'];
    ok(want.every((k) => rows.includes(k)), '六个分区齐全', rows.join(','));
    ok(rows.every((k, i) => k === want[i]), '入口顺序与设计一致');

    console.log('\n=== 2. 六个子页可进可返 ===');
    const expect = {
      'set-save': ['export', 'import', 'restore'],
      'set-life': ['ad-life'],
      'set-char': ['characters', 'ranking-open'],
      'set-visual': ['theme-set', 'motion'],
      'set-help': ['panel'],
      'set-reset': ['reset'],
    };
    for (const name of want) {
      const hit = await click(`[data-a="panel-step"][data-name="${name}"]`);
      await sleep(650);
      const info = await ev(`(function(){var b=document.getElementById('panel-body');
        return {acts:[...new Set([...b.querySelectorAll('[data-a]')].map(x=>x.dataset.a))],
                back:!!document.querySelector('[data-a="panel-back"]'),
                title:(document.getElementById('panel-root')?.querySelector('.panel')?.getAttribute('aria-label')||''),
                empty:b.innerText.trim().length===0};})()`);
      const missing = (expect[name] || []).filter((a) => !info.acts.includes(a));
      ok(hit && !info.empty && missing.length === 0 && info.back, name + ' 子页完整', missing.length ? '缺 ' + missing.join(',') : info.title);
      const back = await click('[data-a="panel-back"]');
      await sleep(550);
      const atParent = await ev(`!!document.querySelector('[data-a="panel-step"][data-name="set-save"]')`);
      ok(back && atParent, name + ' 可返回父页');
    }

    console.log('\n=== 3. 三种手机宽度父页不溢出 ===');
    /* 分级验收（与交接文档 3.4 一致）：320×568 归"允许滚动"档，只要求不坏；
       360×640 以上必须收敛到 1.02 屏内。旧版对 320 也卡 1.02，与规范矛盾。 */
    for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(500);
      const r = await ev(`(function(){var b=document.getElementById('panel-body');if(!b)return null;
        return +(b.scrollHeight/b.clientHeight).toFixed(2);})()`);
      const limit = w <= 320 ? 1.35 : 1.02;
      ok(r !== null && r <= limit, `${w}x${h} 父页一屏`, `屏数 ${r}（上限 ${limit}）`);
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    console.log('\n=== 4. 行记 / 教程仍可达 ===');
    await click('[data-a="panel-step"][data-name="set-help"]'); await sleep(650);
    ok(await click('[data-a="panel"][data-name="log"]'), '行记可跳转');
    await sleep(700);
    ok(await ev(`(document.getElementById('panel-body')?.innerText||'').length>20`), '行记有内容');
    await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(500);
    await click('[data-a="panel-step"][data-name="set-help"]').catch(() => {}); await sleep(600);
    ok(await click('[data-a="panel"][data-name="help"]'), '教程可跳转');
    await sleep(700);
    ok(await ev(`(document.getElementById('panel-body')?.innerText||'').indexOf('首次试玩建议')>=0`), '教程有内容');

    console.log('\n=== 5. 背包只留仓库入口 ===');
    await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(400);
    await click('[data-a="panel"][data-name="pack"]'); await sleep(700);
    const ext = await ev(`[...document.querySelectorAll('#panel-body [data-a="panel"]')].map(b=>b.dataset.name)`);
    ok(JSON.stringify(ext) === JSON.stringify(['warehouse']), '背包外部入口仅仓库', ext.join(',') || '无');

    console.log('\n=== 6. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    process.exitCode = fail === 0 ? 0 : 1;
  } catch (e) {
    console.error('FAIL: ' + e.message); process.exitCode = 1;
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
