'use strict';
/* V90.13 设置前后对比 + 六个子页 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v913-settings');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function run(dir, tag, children) {
  const srv = await serve(path.join(ROOT, 'play', dir));
  const port = 9920 + Math.floor(Math.random() * 30);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v913-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
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
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const m = () => ev(`(function(){var b=document.getElementById('panel-body');if(!b)return null;
      return {h:b.scrollHeight,c:b.clientHeight,r:+(b.scrollHeight/b.clientHeight).toFixed(2),
              t:(document.getElementById('panel-root')?.querySelector('.panel')?.getAttribute('aria-label')||'?')};})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    // 打开设置（顶栏「设置」）
    const opened = await click('[data-a="panel"][data-name="settings"]');
    await sleep(900);
    await ev(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(300);
    await shot(`${tag}-settings.png`);
    let x = await m();
    console.log(`${tag} 设置  open=${opened}  ${x.t}  ${x.h}/${x.c}  ${x.r} 屏`);

    for (const c of children) {
      const hit = await click(`[data-a="panel-step"][data-name="${c.name}"]`);
      await sleep(800);
      await ev(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(250);
      await shot(`${tag}-${c.file}.png`);
      const y = await m();
      console.log(`   ${tag}-${c.file}  hit=${hit}  ${y.t}  ${y.h}/${y.c}  ${y.r} 屏`);
      await click('[data-a="panel-back"]'); await sleep(600);
    }
  } catch (e) { console.error(tag + ' FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await run('jindan-v912', 'before', []);
  await run('jindan-v913', 'after', [
    { name: 'set-save', file: 'sub-save' },
    { name: 'set-life', file: 'sub-life' },
    { name: 'set-char', file: 'sub-char' },
    { name: 'set-visual', file: 'sub-visual' },
    { name: 'set-help', file: 'sub-help' },
    { name: 'set-reset', file: 'sub-reset' },
  ]);
})();
