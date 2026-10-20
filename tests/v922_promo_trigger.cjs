'use strict';
/*
 * V90.22 评价入口「触发时机」验收：教程跟完 / 跳过才出现
 *
 * 用**未播种的发布文件**跑（没有存档，走真实建号流程），因此能覆盖：
 *   1. guide.status = 'new'（刚入世，介绍弹窗）→ 不出现
 *   2. guide.status = 'active'（跟着学，引导进行中）→ 不出现
 *   3. guide.status = 'skipped'（自行探索/跳过）→ 立刻出现
 *   4. 'done'（跟完教程）由 v919_promo.cjs 的种子档覆盖（那是 guide=done 的档）
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RELEASE = process.argv[2] || '山野修仙记_V90.22_评价触发时机版.html';
const EDGE = require('./lib/browser').BROWSER;   // Edge / Chrome / Chromium / playwright 自带，CI 里也能跑
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (c, label, detail) => { if (c) { pass++; console.log('  PASS  ' + label + (detail ? '  — ' + detail : '')); } else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); } };

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/' + RELEASE;
      fs.readFile(path.join(root, rel), (e, b) => {
        if (e) { rsp.writeHead(404).end(); return; }
        rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        rsp.end(b);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve(path.join(ROOT, 'releases'));
  const port = 9885;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v922t-'));
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
    const pin = () => ev(`!!document.querySelector('#promo-slot .promo-chip')`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`!!document.querySelector('[data-a="choose-role"]')`).catch(() => false)) break; }
    await sleep(600);

    console.log('=== 1. 新建角色（guide=new）→ 不出现 ===');
    ok(await ev(`!!document.querySelector('[data-a="choose-role"]')`), '落地在角色选择页');
    ok(await click('[data-a="choose-role"][data-role="human"]'), '选人族'); await sleep(500);
    ok(await click('[data-a="view-slots"]'), '打开档位'); await sleep(600);
    ok(await click('[data-a="slot-open"][data-slot="1"]'), '开 001 空档'); await sleep(800);
    ok(await click('[data-a="birth-next"]'), '进入属性确认'); await sleep(700);
    ok(await click('[data-a="birth-confirm-final"]'), '确认入世'); await sleep(1200);
    const g1 = await ev(`(function(){var m=document.querySelector('.modal');return {intro:!!m,skip:!!document.querySelector('[data-a="guide"][data-mode="skip"]')};})()`);
    ok(g1.intro && g1.skip, '介绍弹窗出现（可「自行探索」）');
    ok(!(await pin()), 'guide=new 时不出现评价入口');

    console.log('\n=== 2. 跟着学（guide=active）→ 不出现 ===');
    ok(await click('[data-a="guide"][data-mode="start"]'), '点「跟着学」'); await sleep(900);
    ok(!(await pin()), 'guide=active 时不出现评价入口');

    console.log('\n=== 3. 跳过教程（guide=skipped）→ 立刻出现 ===');
    /* 引导进行中时卡片上只有「收起」；真正的跳过入口在 顶栏「教程」面板里 */
    ok(await click('[data-a="panel"][data-name="help"]'), '打开「教程」面板'); await sleep(800);
    ok(await click('#panel-body [data-a="guide"][data-mode="skip"]'), '点面板里的「跳过引导」'); await sleep(800);
    /* 跳过引导的动作本身会 panel=null（见 handle 里的 guide 分支），面板自动收起 */
    ok(await ev(`!document.getElementById('panel-body')`), '跳过后面板自动收起');
    const st = await ev(`(function(){try{return JSON.parse(localStorage.getItem('qinglan-wendao-v14-human-slot-001')).guide.status;}catch(e){return 'ERR';}})()`);
    ok(st === 'skipped', '存档里 guide.status = skipped', st);
    const appeared = await pin();
    ok(appeared, '跳过教程后评价入口出现');

    console.log('\n=== 4. 点开后仍是一次性 ===');
    if (appeared) {
      ok(await click('#promo-slot .promo-chip'), '点开入口'); await sleep(700);
      ok(await ev(`!!document.querySelector('[data-a="promo-close"]')`), '弹窗打开');
      ok(await click('[data-a="promo-close"]'), '点「知道了」'); await sleep(600);
      ok(!(await pin()), '关闭后入口消失');
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/` });
      for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(800);
      ok(!(await pin()), '刷新重进后仍不出现');
    }

    console.log('\n=== 5. 运行期异常 ===');
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
