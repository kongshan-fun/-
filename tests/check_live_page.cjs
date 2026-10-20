'use strict';
/* 从真实网址 127.0.0.1:8765 打开，确认自动落地在金丹前一步 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:8765/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = 9996;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'live-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout')), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: URL });

    let landed = null;
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      try {
        const st = await ev(`(function(){
          return {start: !!document.querySelector('[data-a="view-slots"]'), slots: !!document.querySelector('[data-a="slot-open"]'),
                  body: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200),
                  seeded: window.__SEEDED__, skipped: window.__SEED_SKIPPED__};})()`);
        if (!st.start && !st.slots) { landed = st; break; }
      } catch {}
    }
    console.log('网址: ' + URL);
    if (landed) {
      console.log('结果: PASS 打开即落地');
      console.log('  播种: ' + (landed.seeded ? '已播种' : landed.skipped ? '已有档，跳过' : '未知'));
      console.log('  界面: ' + landed.body);
    } else {
      const st = await ev(`(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,150)`);
      console.log('结果: FAIL 未落地');
      console.log('  界面: ' + st);
      process.exitCode = 1;
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const out = path.resolve(__dirname, '..', 'visual', 'v910-save', 'jindan-live.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('截图: ' + out);
  } catch (e) {
    console.error('FAIL: ' + e.message); process.exitCode = 1;
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }
})();
