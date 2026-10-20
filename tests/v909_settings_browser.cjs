'use strict';
/*
 * 设置页动作回归（原 v909_settings_browser 的过期结构断言已废弃，保留其功能覆盖）
 *
 * 为什么重写：旧版假定「顶栏有档案按钮 + 设置是单页六模块」。
 * V90.13 起设置改成父子页、V90.14 删掉顶栏档案，旧版第一步就失败并级联 21 条红灯。
 * 现在结构断言由 v914_ui_structure 负责，本测试只负责**动作真的生效**：
 *   1. 主题切换（mono / forest / immortal 三种可切、class 真变）
 *   2. 减少动效（transition 归零，再点恢复）
 *   3. 行记 / 教程 可进可返且非空
 *   4. 资质榜弹窗可开可关
 *   5. 续命机缘按钮状态与寿元一致
 *   6. 存档三键（导出 / 导入 / 恢复）都在
 *   7. 无运行期异常
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v925';
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
  const port = 9889;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v909s-'));
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
    /* 复位：连续点关闭键，确保真的没有任何面板（子页的 × 是返回上一层，多次点可穿透） */
    const closeAll = async () => {
      for (let i = 0; i < 5; i++) {
        const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`);
        if (!had) break;
        await sleep(200);
      }
      await sleep(120);
    };
    const openSettings = async () => { await closeAll(); await click('[data-a="panel"][data-name="settings"]'); await sleep(600); };
    const openChild = async (name) => { await click(`[data-a="panel-step"][data-name="${name}"]`); await sleep(600); };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(800);

    console.log('=== 0. 设置父页六入口 ===');
    await openSettings();
    const entries = await ev(`[...document.querySelectorAll('#panel-body [data-a="panel-step"]')].map(b=>b.dataset.name)`);
    ok(entries.length === 6, '六个分区入口', entries.join(','));

    console.log('\n=== 1. 主题切换 ===');
    await openSettings(); await openChild('set-visual');
    for (const theme of ['mono', 'immortal', 'forest']) {
      ok(await click(`#panel-body [data-a="theme-set"][data-theme="${theme}"]`), `点主题 ${theme}`);
      await sleep(500);
      const cls = await ev(`document.body.className`);
      const want = theme === 'forest' ? !/theme-(mono|immortal)/.test(cls) : cls.includes('theme-' + theme);
      ok(want, `主题 ${theme} 已生效`, cls);
    }

    console.log('\n=== 2. 减少动效 ===');
    await openSettings(); await openChild('set-visual');
    ok(await click('#panel-body [data-a="motion"]'), '点「减少动效」'); await sleep(700);
    const reduced = await ev(`document.querySelector('.phone').classList.contains('reduced')`);
    const label = await ev(`(function(){var b=document.querySelector('#panel-body [data-a="motion"]');return b?b.textContent.trim():'';})()`);
    ok(reduced, 'phone 进入 reduced 模式');
    ok(label === '恢复动效', '按钮文案变为「恢复动效」', label);
    await click('#panel-body [data-a="motion"]'); await sleep(700);
    ok(!(await ev(`document.querySelector('.phone').classList.contains('reduced')`)), '再点恢复动效');

    console.log('\n=== 3. 行进 / 教程 可进可返 ===');
    await openSettings(); await openChild('set-help');
    ok(await click('#panel-body [data-a="panel"][data-name="log"]'), '进「行记」'); await sleep(600);
    ok((await ev(`(document.getElementById('panel-body')||{}).innerText||''`)).length > 4, '行记有内容');
    ok(await click('[data-a="close-panel"]'), '关行记'); await sleep(500);
    await openSettings(); await openChild('set-help');
    ok(await click('#panel-body [data-a="panel"][data-name="help"]'), '进「完整教程」'); await sleep(700);
    ok((await ev(`document.querySelectorAll('#panel-body details.help-chapter').length`)) > 0, '教程章节已渲染');
    await click('[data-a="close-panel"]'); await sleep(400);

    console.log('\n=== 4. 资质榜弹窗 ===');
    await openSettings(); await openChild('set-char');
    ok(await click('#panel-body [data-a="ranking-open"]'), '打开资质榜'); await sleep(700);
    ok(await ev(`!!document.querySelector('.modal')`), '资质榜弹窗出现');
    ok(await click('[data-a="modal-close"]'), '关闭资质榜'); await sleep(400);

    console.log('\n=== 5. 续命按钮状态与寿元一致 ===');
    await openSettings(); await openChild('set-life');
    const life = await ev(`(function(){var b=document.querySelector('#panel-body [data-a="ad-life"]');return b?{label:b.textContent.trim(),disabled:!!b.disabled}:null;})()`);
    ok(!!life, '续命按钮存在', life && life.label);
    ok(life && (/寿元低于16年时可领/.test(life.label) ? life.disabled : /领取10年寿元/.test(life.label)), '按钮状态与寿元匹配（寿元 60 年时禁用）', JSON.stringify(life));

    console.log('\n=== 6. 存档三键 ===');
    await openSettings(); await openChild('set-save');
    for (const [act, label] of [['export', '导出存档'], ['import', '导入存档'], ['restore', '恢复上次备份']]) {
      ok(await ev(`!!document.querySelector('#panel-body [data-a="${act}"]')`), `有「${label}」`);
    }

    console.log('\n=== 7. 运行期异常 ===');
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
