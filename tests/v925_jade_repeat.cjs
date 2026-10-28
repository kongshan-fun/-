'use strict';
/*
 * V90.29 广告奖励「可重复领取」验收（取代 V90.25 的「每档一次」）
 *
 * 用户决策（2026-10-20）：广告是唯一盈利手段，恢复无限刷；单次从 200 降回 100。
 * 本测试断的是"确实可以一直领、而且没有残留的一次性痕迹"：
 *   1. 空档 002：按钮「领取100轮回玉」，余额 0
 *   2. 连点三次 → 100 / 200 / 300，按钮始终可点、文案不变
 *   3. 不再写 `-jadead` 键（V90.25 的旁路键必须彻底消失）
 *   4. 刷新重进 → 余额仍是 300，且**还能继续领**（+100 → 400）
 *   5. 换 003 档：独立账本，从 0 开始
 *   6. 种子档 001 不受影响（余额不变、也没有 -jadead 键）
 *   7. 无运行期异常
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v929';
const EDGE = require('./lib/browser').BROWSER;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v925r-'));
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
    const jade = () => ev(`(function(){var n=document.querySelector('[data-bind="jade-balance"]');return n?Number(n.textContent.trim()):null;})()`);
    const btn = () => ev(`(function(){var b=document.querySelector('[data-a="birth-jade-ad"]');return b?{text:b.textContent.trim(),disabled:!!b.disabled}:null;})()`);
    const boot = async () => {
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`document.body.innerText.includes('气血') && !!document.querySelector('.top-buttons button')`).catch(() => false)) break; }
      await sleep(800);
    };
    const openSlot = async (slot) => {
      /* V90.64+：设置 → 角色与档案 → 难度页 → 种族 → 档位列表 → 档位 → 命格确认 */
      if (await ev(`!!document.querySelector('[data-a="panel"][data-name="settings"]')`)) {
        await click('[data-a="panel"][data-name="settings"]'); await sleep(400);
        await click('[data-a="panel-step"][data-name="set-char"]'); await sleep(400);
        await click('[data-a="characters"]'); await sleep(700);
      }
      if (await ev(`!!document.querySelector('[data-a="difficulty-next"]')`)) {
        await click('[data-a="difficulty-choice"][data-mode="challenge"]'); await sleep(300);
        await click('[data-a="difficulty-next"]'); await sleep(600);
      }
      if (await ev(`!!document.querySelector('[data-a="choose-role"]')`)) {
        await click('[data-a="choose-role"][data-role="human"]'); await sleep(400);
      }
      if (await ev(`!!document.querySelector('[data-a="view-slots"]')`)) {
        await click('[data-a="view-slots"]'); await sleep(600);
      }
      const opened = await click(`[data-a="slot-open"][data-role="human"][data-slot="${slot}"]`)
        || await click(`[data-a="slot-open"][data-slot="${slot}"]`);
      await sleep(800);
      const next = await click('[data-a="birth-next"]'); await sleep(800);
      return opened && next;
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    console.log('=== 1. 空档 002：初始状态 ===');
    await boot();
    ok(await openSlot(2), '进入 002 档命格确认页');
    const b0 = await btn();
    ok(b0 && b0.text === '领取100轮回玉' && !b0.disabled, '按钮「领取100轮回玉」且可用', JSON.stringify(b0));
    ok((await jade()) === 0, '初始余额 0', String(await jade()));

    console.log('\n=== 2. 连点三次：可以一直领 ===');
    for (const [n, want] of [[1, 100], [2, 200], [3, 300]]) {
      ok(await click('[data-a="birth-jade-ad"]'), `第 ${n} 次点领取`);
      await sleep(800);
      ok((await jade()) === want, `余额 ${want}`, String(await jade()));
      const b = await btn();
      ok(b && !b.disabled && b.text === '领取100轮回玉', `第 ${n} 次后按钮仍可点`, JSON.stringify(b));
    }

    console.log('\n=== 3. 不再有 -jadead 一次性痕迹 ===');
    ok(await ev(`localStorage.getItem('qinglan-wendao-v14-human-slot-002-jadead')===null`), '002 档没有 -jadead 键');
    ok(!(await ev(`document.body.innerText.includes('本档已领取')`)), '界面上没有「本档已领取」字样');

    console.log('\n=== 4. 刷新重进：余额保留，仍可继续领 ===');
    await boot();
    ok(await openSlot(2), '刷新后重进 002 档');
    ok((await jade()) === 300, '余额仍是 300', String(await jade()));
    ok(await click('[data-a="birth-jade-ad"]'), '刷新后再领一次');
    await sleep(800);
    ok((await jade()) === 400, '余额 400（刷新不封顶）', String(await jade()));

    console.log('\n=== 5. 换 003 档：独立账本 ===');
    await boot();
    ok(await openSlot(3), '进入 003 档命格确认页');
    ok((await jade()) === 0, '003 初始余额 0', String(await jade()));
    ok(await click('[data-a="birth-jade-ad"]'), '003 领一次');
    await sleep(800);
    ok((await jade()) === 100, '003 余额 100', String(await jade()));

    console.log('\n=== 6. 种子档 001 不受影响 ===');
    const slot1 = await ev(`localStorage.getItem('qinglan-wendao-v14-human-slot-001')`);
    ok(!!slot1, '001 档存档存在');
    ok(await ev(`localStorage.getItem('qinglan-wendao-v14-human-slot-001-jadead')===null`), '001 档也没有 -jadead 键');

    console.log('\n=== 7. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    process.exitCode = fail === 0 ? 0 : 1;
  } catch (e) {
    console.error('FAIL: ' + e.message); process.exitCode = 1;
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
