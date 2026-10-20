'use strict';
/* 量测 V90.11 所有可达面板的屏数，找出仍属长滚动的界面 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 静态：各 *Body 函数体量
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const bodies = [...html.matchAll(/function ([a-zA-Z]+Body)\(\)/g)].map((m) => m[1]);
console.log('=== 各面板 body 函数体量（字符） ===');
const sizes = [];
for (const fn of bodies) {
  const i = html.indexOf('function ' + fn + '(');
  let d = 0, st = false, end = i;
  for (let k = i; k < html.length; k++) {
    const c = html[k];
    if (c === '{') { d++; st = true; } else if (c === '}') { d--; if (st && d === 0) { end = k + 1; break; } }
  }
  sizes.push([fn, end - i]);
}
sizes.sort((a, b) => b[1] - a[1]).forEach(([fn, n]) => console.log('  ' + fn.padEnd(22) + n));

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
  const srv = await serve(path.join(ROOT, 'play', 'jindan-v911'));
  const port = 9971;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'meas-'));
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

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    const targets = ['camp', 'cultivate', 'manuals', 'character', 'warehouse', 'craft', 'pack', 'book', 'lore', 'help', 'settings', 'quest', 'dao', 'rift', 'mirror', 'karma', 'estate', 'heaven', 'birth'];
    console.log('\n=== 实测屏数（390x844）===');
    console.log('  面板            内容高  可视  屏数');
    for (const name of targets) {
      // 回洞府父级
      await ev(`(function(){var p=document.querySelector('[data-a="panel-back"]');if(p)p.click();})()`); await sleep(250);
      await click(`[data-a="panel"][data-name="${name}"]`); await sleep(650);
      const m = await ev(`(function(){var p=document.getElementById('panel-root');var b=document.getElementById('panel-body');
        if(!p||!p.querySelector('.panel'))return null;
        return {h:b.scrollHeight,c:b.clientHeight,title:(p.querySelector('.panel')?.getAttribute('aria-label')||'?')};})()`).catch(() => null);
      if (m && m.c) console.log('  ' + (name + ' ' + m.title).padEnd(24) + String(m.h).padStart(6) + String(m.c).padStart(7) + (m.h / m.c).toFixed(2).padStart(7));
      else console.log('  ' + name.padEnd(24) + '   打不开/无内容');
    }
  } catch (e) { console.error('FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
