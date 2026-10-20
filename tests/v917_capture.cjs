'use strict';
/*
 * V90.17 截图验收：图鉴父子页 + 行记空态，三种宽度
 * 产物：visual/v917/*.png
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v917');
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

async function withPage(dir, width, height, fn) {
  const srv = await serve(path.join(ROOT, 'play', dir));
  const port = 9900 + Math.floor(Math.random() * 60);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v917cap-'));
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
    const page = {
      send, ev,
      click: (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`),
      shot: async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); console.log('    -> visual/v917/' + f); },
      ratio: () => ev(`(function(){var b=document.getElementById('panel-body');if(!b||!b.clientHeight)return null;return +(b.scrollHeight/b.clientHeight).toFixed(2);})()`),
      title: () => ev(`(document.querySelector('.panel-head strong')||{}).textContent||''`)
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);
    await fn(page);
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(150);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
}

(async () => {
  for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
    const wh = `${w}x${h}`;
    console.log(`== ${wh} ==`);

    // 改造前：V90.16 图鉴（11 个折叠组）
    await withPage('jindan-v916', w, h, async (p) => {
      await p.click('[data-a="panel"][data-name="book"]');
      await sleep(700);
      console.log(`  before 图鉴 ${wh}: ${await p.ratio()} 屏`);
      await p.shot(`before-${wh}-book.png`);
    });

    // 改造后：V90.17 图鉴入口 / 品类 / 详情 + 行记空态
    await withPage('jindan-v917', w, h, async (p) => {
      await p.click('[data-a="panel"][data-name="book"]');
      await sleep(700);
      console.log(`  after 图鉴入口 ${wh}: ${await p.ratio()} 屏  [${await p.title()}]`);
      await p.shot(`after-${wh}-book-home.png`);

      await p.click('#panel-body .book-cat-cell[data-cat="enemy"]');
      await sleep(650);
      console.log(`  after 图鉴·妖兽 ${wh}: ${await p.ratio()} 屏  [${await p.title()}]`);
      await p.shot(`after-${wh}-book-enemy.png`);

      if (w === 390) {
        await p.click('#panel-body .book-entry-link');
        await sleep(650);
        console.log(`  after 图鉴·详情 ${wh}: ${await p.ratio()} 屏  [${await p.title()}]`);
        await p.shot(`after-${wh}-book-detail.png`);
      }

      // 行记空态
      await p.ev(`(function(){document.querySelectorAll('[data-a="close-panel"]').forEach(function(b){b.click();});})()`);
      await sleep(300);
      await p.click('[data-a="panel"][data-name="settings"]'); await sleep(600);
      await p.click('[data-a="panel-step"][data-name="set-help"]'); await sleep(600);
      await p.click('[data-a="panel"][data-name="log"]'); await sleep(700);
      const text = await p.ev(`(document.getElementById('panel-body')?.innerText||'').replace(/\\s+/g,' ').trim()`);
      console.log(`  行记 ${wh}: [${await p.title()}] ${text.slice(0, 30)}`);
      await p.shot(`after-${wh}-log.png`);
    });
  }
  console.log('\n截图完成：visual/v917/');
})();
