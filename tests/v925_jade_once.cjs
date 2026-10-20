'use strict';
/*
 * V90.25 轮回玉「每档一次」验收（P0-3）
 *
 * 1. 空档：按钮「领取200轮回玉」，余额 0
 * 2. 点一次：+200，按钮变「本档已领取」且 disabled
 * 3. 强行把 disabled 去掉再点：处理器仍拦截，余额不变
 * 4. 刷新页面重进：仍是 200，按钮仍禁用（刷新不重置）
 * 5. 换到 003 档：余额 0、按钮可用、可再领 200（不串档）
 * 6. 001（种子档）未被写入
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
  const port = 9886;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v925j-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
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
    const jade = () => ev(`(function(){var n=document.querySelector('[data-bind="jade-balance"]');return n?Number(n.textContent.trim()):null;})()`);
    const btn = () => ev(`(function(){var b=document.querySelector('[data-a="birth-jade-ad"]');return b?{text:b.textContent.trim(),disabled:!!b.disabled}:null;})()`);
    const boot = async () => {
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(800);
    };
    const openSlot = async (slot) => {
      await click('[data-a="panel"][data-name="settings"]'); await sleep(500);
      await click('[data-a="panel-step"][data-name="set-char"]'); await sleep(500);
      await click('[data-a="characters"]'); await sleep(600);
      await click('[data-a="choose-role"][data-role="human"]'); await sleep(500);
      await click('[data-a="view-slots"]'); await sleep(600);
      const opened = await click(`[data-a="slot-open"][data-slot="${slot}"]`); await sleep(800);
      const next = await click('[data-a="birth-next"]'); await sleep(800);
      return opened && next;
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    console.log('=== 1. 空档 002：初始状态 ===');
    await boot();
    ok(await openSlot(2), '进入 002 档命格确认页');
    const b0 = await btn();
    ok(b0 && b0.text === '领取200轮回玉' && !b0.disabled, '按钮为「领取200轮回玉」且可用', JSON.stringify(b0));
    ok((await jade()) === 0, '初始余额 0', String(await jade()));

    console.log('\n=== 2. 点一次：+200 且按钮置灰 ===');
    ok(await click('[data-a="birth-jade-ad"]'), '点领取');
    await sleep(900);
    ok((await jade()) === 200, '余额 200', String(await jade()));
    const b1 = await btn();
    ok(b1 && b1.text === '本档已领取' && b1.disabled, '按钮变「本档已领取」且 disabled', JSON.stringify(b1));
    ok(await ev(`localStorage.getItem('qinglan-wendao-v14-human-slot-002-jadead')==='1'`), '已写入 -jadead 标记');

    console.log('\n=== 3. 强行绕过 disabled 再点：处理器拦截 ===');
    await ev(`(function(){var b=document.querySelector('[data-a="birth-jade-ad"]');b.disabled=false;b.click();})()`);
    await sleep(800);
    ok((await jade()) === 200, '余额仍为 200（没有第二次发放）', String(await jade()));
    const toast = await ev(`(function(){var t=document.getElementById('toast');return t?t.innerText.replace(/\\s+/g,' ').trim():'';})()`);
    ok(/已领取/.test(toast), '提示「已领取」', toast.slice(0, 30));

    console.log('\n=== 4. 刷新重进：不重置 ===');
    await boot();
    ok(await openSlot(2), '刷新后重进 002 档');
    ok((await jade()) === 200, '余额仍 200', String(await jade()));
    const b2 = await btn();
    ok(b2 && b2.disabled && b2.text === '本档已领取', '按钮仍禁用', JSON.stringify(b2));

    console.log('\n=== 5. 换 003 档：不串档，可再领一次 ===');
    await boot();
    ok(await openSlot(3), '进入 003 档命格确认页');
    ok((await jade()) === 0, '003 初始余额 0', String(await jade()));
    const b3 = await btn();
    ok(b3 && !b3.disabled, '003 按钮可用（未被 002 的标记影响）', JSON.stringify(b3));
    ok(await click('[data-a="birth-jade-ad"]'), '003 领一次');
    await sleep(900);
    ok((await jade()) === 200, '003 余额 200', String(await jade()));

    console.log('\n=== 6. 种子档 001 未被写入 ===');
    const s1 = await ev(`localStorage.getItem('qinglan-wendao-v14-human-slot-001-jadead')`);
    ok(s1 === null, '001 档没有 -jadead 标记', String(s1));

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
