'use strict';
/*
 * 面板全屏前后对比：三宽度 × 主要面板截图 + 旧版同屏对照
 * 用法: node tools/capture_panel_shots.cjs <playDir> <outDir>
 * 目录: visual/v941-panels/<outDir>/
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v941';
const TAG = process.argv[3] || 'after';
const OUT = path.join(ROOT, 'visual', 'v941-panels', TAG);
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

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
  const port = 9941;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'panels-'));
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
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout')), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { await sleep(320); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const closeAll = async () => { for (let i = 0; i < 5; i++) { const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`); if (!had) break; await sleep(250); } };
    const measure = () => ev(`(function(){
      var b=document.getElementById('panel-body'); if(!b) return null;
      var r=b.getBoundingClientRect();
      return {screens:Math.round(b.scrollHeight/Math.max(1,r.height)*100)/100,
              bodyTop:Math.round(r.top), visH:Math.round(r.height),
              mini:!!document.querySelector('.panel-mini-bar'),
              statusHidden:getComputedStyle(document.getElementById('status')).display==='none'};
    })()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(1100);

    /* 需要登录面板的几页：洞府 → 修炼 / 炼制 / 背包 / 图鉴 / 主线 */
    const openPanel = async (name) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await click(`[data-a="panel"][data-name="${name}"]`);
        await sleep(700);
        if (await ev(`!!document.querySelector('#panel-root .panel-overlay')`)) return true;
      }
      return false;
    };

    const results = {};
    for (const [label, opener] of [
      ['camp', async () => { await closeAll(); return openPanel('camp'); }],
      ['craft', async () => { await closeAll(); return openPanel('craft'); }],
      ['pack', async () => { await closeAll(); return openPanel('pack'); }],
      ['book', async () => { await closeAll(); return openPanel('book'); }],
      ['quest', async () => { await closeAll(); return openPanel('quest'); }],
      ['settings', async () => { await closeAll(); return openPanel('settings'); }],
      ['cultivate', async () => { await closeAll(); await openPanel('camp'); await sleep(400); return openPanel('cultivate'); }],
    ]) {
      const opened = await opener();
      if (!opened) { console.log('  ! ' + label + ' 打不开'); continue; }
      const m = await measure();
      results[label] = m;
      await shot('360-' + label + '.png');
      console.log('  ' + label + ' → ' + JSON.stringify(m));
    }

    /* 320 / 390 的洞府 */
    for (const [w, h] of [[320, 568], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(500);
      await closeAll();
      if (await openPanel('camp')) {
        const m = await measure();
        results['camp' + w] = m;
        await shot(w + '-camp.png');
        console.log('  camp@' + w + ' → ' + JSON.stringify(m));
      }
    }

    fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(results, null, 1), 'utf8');
    console.log('输出: ' + OUT);
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
