'use strict';
/*
 * V90.18 轮回玉广告奖励数额回归（C 方案：只改 100 -> 200）
 *
 * 断言：
 *   1. 命格确认页按钮文案是「领取200轮回玉」
 *   2. 点一次恰好 +200（不是 +100，也不是 +200 加到了错的档位）
 *   3. 加的是「当前草稿档位」的账本（换到别的档位读不到这 200）
 *   4. 无运行期异常
 *
 * 说明：C 方案明确不加一次性限制，本测试只锁定"一次点击 = 200"，
 *       不锁定"可重复"这一行为（那是待排期的经济问题）。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v918';
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
  const port = 9882;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v918j-'));
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

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    console.log('=== 1. 进入一个空档的命格确认页 ===');
    ok(await click('[data-a="panel"][data-name="settings"]'), '打开设置'); await sleep(600);
    ok(await click('[data-a="panel-step"][data-name="set-char"]'), '进入角色与档案'); await sleep(600);
    ok(await click('[data-a="characters"]'), '打开种族与百档档案'); await sleep(700);
    ok(await click('[data-a="choose-role"][data-role="human"]'), '选择人族'); await sleep(600);
    ok(await click('[data-a="view-slots"]'), '打开档位列表'); await sleep(700);
    ok(await click('[data-a="slot-open"][data-slot="2"]'), '打开 002 空档'); await sleep(900);
    ok(await click('[data-a="birth-next"]'), '进入属性确认页'); await sleep(900);
    const onConfirm = await ev(`!!document.querySelector('[data-a="birth-jade-ad"]')`);
    ok(onConfirm, '到达命格确认页');

    console.log('\n=== 2. 按钮文案与数额 ===');
    const label = await ev(`(function(){var b=document.querySelector('[data-a="birth-jade-ad"]');return b?b.textContent.trim():'';})()`);
    ok(label === '领取200轮回玉', '按钮文案为「领取200轮回玉」', label);
    const before = await jade();
    ok(before === 0, '空档初始轮回玉为 0', String(before));

    console.log('\n=== 3. 点一次恰好 +200 ===');
    ok(await click('[data-a="birth-jade-ad"]'), '点击领取');
    await sleep(800);
    const after = await jade();
    ok(after !== null && after - before === 200, '本档轮回玉 +200', `${before} -> ${after}`);
    const toast = await ev(`(function(){var t=document.getElementById('toast');return t?t.innerText.replace(/\\s+/g,' ').trim():'';})()`);
    ok(/轮回玉\+200/.test(toast), '提示文案为 +200', toast.slice(0, 30));

    console.log('\n=== 4. 账本落点正确，不串档 ===');
    const ledgers = await ev(`(function(){
      function read(k){try{var r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch(e){return null;}}
      return {
        s1:read('qinglan-wendao-v14-human-slot-001-legacy-v1'),
        s2:read('qinglan-wendao-v14-human-slot-002-legacy-v1'),
        s3:read('qinglan-wendao-v14-human-slot-003-legacy-v1')
      };})()`);
    ok(!!ledgers.s2 && ledgers.s2.balance === 200, '002 档账本余额 = 200', JSON.stringify(ledgers.s2 && { b: ledgers.s2.balance, t: ledgers.s2.total }));
    ok(!ledgers.s3 || ledgers.s3.balance === 0, '003 档未被写入', JSON.stringify(ledgers.s3 && ledgers.s3.balance));
    ok(!ledgers.s1 || ledgers.s1.balance === 0, '001 档（种子档）未被写入', JSON.stringify(ledgers.s1 && ledgers.s1.balance));

    console.log('\n=== 5. 运行期异常 ===');
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
