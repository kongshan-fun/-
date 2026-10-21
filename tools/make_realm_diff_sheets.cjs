'use strict';
/* V90.42 前后对比拼图：状态栏 / 修炼页 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'visual', 'v942-realm');
const OUT = path.join(SRC, 'diff');
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const SHEETS = [
  ['01-status.png', '主屏状态栏：化神（道 110/220）→ 化神中期 + 三段刻度'],
  ['02-cultivate.png', '修炼面板：道行 110/220 → 道行 110/220 · 化神中期 + 刻度'],
];

const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const port = 9947;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'r942-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
    const send = (m, p = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); setTimeout(() => rej(new Error('timeout')), 30000); });
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
    await send('Runtime.enable'); await send('Page.enable');

    for (const [file, title] of SHEETS) {
      const b = path.join(SRC, 'before', file), a = path.join(SRC, 'after', file);
      if (!fs.existsSync(a)) { console.log('  跳过 ' + file); continue; }
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#f2f2f2;font:14px/1.45 -apple-system,"Microsoft Yahei",sans-serif;padding:14px}
        h1{font-size:15px;margin:0 0 10px;color:#222;width:732px}
        .row{display:flex;gap:12px;align-items:flex-start}
        .col{background:#fff;border:1px solid #ccc;border-radius:8px;overflow:hidden}
        .cap{padding:6px 10px;font-size:13px;font-weight:700;border-bottom:1px solid #ddd}
        .cap.before{background:#fff1f0;color:#a8071a}
        .cap.after{background:#f0fff4;color:#1a7f37}
        img{display:block;width:360px;height:640px}
      </style></head><body>
        <h1>${title}</h1>
        <div class="row">
          <div class="col"><div class="cap before">改前（V90.41）</div><img src="${uri(b)}"></div>
          <div class="col"><div class="cap after">改后（V90.42）</div><img src="${uri(a)}"></div>
        </div></body></html>`;
      const tmp = path.join(os.tmpdir(), 'r942-' + file + '.html');
      fs.writeFileSync(tmp, html, 'utf8');
      await send('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') });
      await sleep(600);
      const cw = await ev('Math.ceil(document.body.scrollWidth)');
      const ch = await ev('Math.ceil(document.body.scrollHeight)');
      await send('Emulation.setDeviceMetricsOverride', { width: cw, height: ch, deviceScaleFactor: 2, mobile: false });
      await sleep(350);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(OUT, file.replace('.png', '-diff.png')), Buffer.from(shot.data, 'base64'));
      console.log('  ' + file.replace('.png', '-diff.png'));
    }
    console.log('输出: ' + OUT);
  } catch (e) { console.error('FAIL: ' + e.message); process.exitCode = 1; }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }
})();
