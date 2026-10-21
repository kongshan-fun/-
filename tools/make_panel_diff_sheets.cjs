'use strict';
/*
 * 面板全屏化前后对比拼图：visual/v941-panels/{before,after} → diff/
 * 用法: node tools/make_panel_diff_sheets.cjs
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'visual', 'v941-panels');
const OUT = path.join(SRC, 'diff');
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const SHEETS = [
  ['360-camp.png', '洞府 · 360×640：内容 514px / 可见 413px = 1.24 屏 → 可见 516px = 1.00 屏'],
  ['320-camp.png', '洞府 · 320×568（最窄）：1.51 屏 → 1.19 屏（仍差半张卡）'],
  ['390-camp.png', '洞府 · 390×844：本来就 1.00 屏，全屏后留白更多'],
  ['360-cultivate.png', '修炼 · 360×640：顶部 HUD 让位，面板整体上移 101px'],
  ['360-craft.png', '炼制 · 360×640：多出 103px 可视高度'],
  ['360-pack.png', '背包 · 360×640'],
  ['360-book.png', '图鉴 · 360×640'],
  ['360-quest.png', '主线 · 360×640'],
  ['360-settings.png', '设置 · 360×640'],
];

const uri = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const port = 9942;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'psheet-'));
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
      if (!fs.existsSync(b) || !fs.existsSync(a)) { console.log('  跳过 ' + file); continue; }
      const w = file.startsWith('320') ? 320 : file.startsWith('390') ? 390 : 360;
      const h = file.startsWith('320') ? 568 : file.startsWith('390') ? 844 : 640;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#f2f2f2;font:14px/1.45 -apple-system,"Microsoft Yahei",sans-serif;padding:14px}
        h1{font-size:15px;margin:0 0 10px;color:#222;width:${w * 2 + 12}px}
        .row{display:flex;gap:12px;align-items:flex-start}
        .col{background:#fff;border:1px solid #ccc;border-radius:8px;overflow:hidden}
        .cap{padding:6px 10px;font-size:13px;font-weight:700;border-bottom:1px solid #ddd}
        .cap.before{background:#fff1f0;color:#a8071a}
        .cap.after{background:#f0fff4;color:#1a7f37}
        img{display:block;width:${w}px;height:${h}px}
      </style></head><body>
        <h1>${title}</h1>
        <div class="row">
          <div class="col"><div class="cap before">改前（V90.40）</div><img src="${uri(b)}"></div>
          <div class="col"><div class="cap after">改后（V90.41 全屏）</div><img src="${uri(a)}"></div>
        </div></body></html>`;
      const tmp = path.join(os.tmpdir(), 'psheet-' + file + '.html');
      fs.writeFileSync(tmp, html, 'utf8');
      await send('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') });
      await sleep(600);
      const cw = await ev('Math.ceil(document.body.scrollWidth)');
      const ch = await ev('Math.ceil(document.body.scrollHeight)');
      await send('Emulation.setDeviceMetricsOverride', { width: cw, height: ch, deviceScaleFactor: 2, mobile: false });
      await sleep(350);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(path.join(OUT, file.replace('.png', '-diff.png')), Buffer.from(shot.data, 'base64'));
      console.log('  ' + file.replace('.png', '-diff.png') + '  ' + cw + 'x' + ch);
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
