'use strict';
/* 抓 A/B/C 三版在 320x568 的洞府与设置，并拼成对比图 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v916-variants');
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

async function grab(dir, tag) {
  const srv = await serve(path.join(ROOT, 'play', dir));
  const port = 9840 + Math.floor(Math.random() * 40);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v916-'));
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
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const chromeH = () => ev(`(function(){var t=document.querySelector('.topbar'),s=document.getElementById('status');
      var r1=t?t.getBoundingClientRect().height:0,r2=s?s.getBoundingClientRect().height:0;
      var b=document.getElementById('panel-body');
      return {top:+r1.toFixed(1),status:+r2.toFixed(1),body:b?b.clientHeight:0};})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    for (const [name, file] of [['camp', 'camp'], ['settings', 'settings'], ['book', 'book']]) {
      await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(250);
      if (!(await click(`[data-a="panel"][data-name="${name}"]`))) { console.log(tag + ' ' + file + ' 打不开'); continue; }
      await sleep(650);
      await ev(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(250);
      await shot(`${tag}-${file}.png`);
      const c = await chromeH();
      console.log(`${tag} ${file.padEnd(9)} 顶栏 ${c.top}px + 状态条 ${c.status}px = ${(c.top + c.status)}  可视 ${c.body}px`);
    }
  } catch (e) { console.error(tag + ' FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const targets = process.argv.slice(2);
  const list = targets.length
    ? targets.map((d) => [d, d.replace(/^jindan-/, '').toUpperCase()])
    : [['jindan-v916A', 'A'], ['jindan-v916B', 'B'], ['jindan-v916C', 'C']];
  for (const [dir, tag] of list) await grab(dir, tag);
  // 拼三图对比
  for (const file of ['camp', 'settings', 'book']) {
    const args = ['-y', '-loglevel', 'error'];
    for (const [dir, tag] of list) args.push('-i', path.join(OUT, tag + '-' + file + '.png'));
    args.push('-filter_complex', '[0:v]scale=520:-1[a];[1:v]scale=520:-1[b];[a][b]hstack', path.join(OUT, 'cmp-' + file + '.png'));
    try {
      execFileSync('ffmpeg', args, { stdio: 'ignore' });
      console.log('  已拼接 cmp-' + file + '.png');
    } catch (e) { console.log('  拼接 ' + file + ' 失败: ' + e.message); }
  }
})();
