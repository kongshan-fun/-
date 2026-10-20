'use strict';
/* 探针 3：用 Page.fileChooserOpened + DOM.setFileInputFiles 走真实导入路径 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v928';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
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

(async () => {
  const srv = await serve(path.join(ROOT, 'play', DIR));
  const port = 9897;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'imp3-'));
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'imp3dl-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map(); let chooser = null;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') console.log('EXC:', (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 300));
      if (m.method === 'Page.fileChooserOpened') { chooser = m.params; console.log('chooser:', JSON.stringify(m.params)); }
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 400) }; return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.setInterceptFileChooserDialog', { enabled: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(1200);

    const key = 'qinglan-wendao-v14-human-slot-001';
    const raw = await ev(`localStorage.getItem(${JSON.stringify(key)})`);
    const st = JSON.parse(raw);
    st.inv = st.inv || {}; st.inv.dust = 999;
    const env = { format: 'QinglanWendao', version: 'V14', character: 'human', exportedAt: new Date().toISOString(), state: st };
    const p = path.join(dl, 'legacy.json');
    fs.writeFileSync(p, JSON.stringify(env), 'utf8');

    for (let i = 0; i < 5; i++) { await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`); await sleep(200); }
    await click('[data-a="panel"][data-name="settings"]'); await sleep(500);
    await click('[data-a="panel-step"][data-name="set-save"]'); await sleep(500);
    console.log('点导入 ->', await click('[data-a="import"]'));
    for (let i = 0; i < 30; i++) { if (chooser) break; await sleep(200); }
    if (!chooser) { console.log('没有收到 fileChooserOpened'); return; }
    await send('DOM.setFileInputFiles', { backendNodeId: chooser.backendNodeId, files: [p] });
    await sleep(1500);
    console.log('modal :', JSON.stringify(await ev(`(function(){var m=document.getElementById('modal-root');return m?m.innerHTML.replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim().slice(0,120):'';})()`)));
    console.log('toast :', JSON.stringify(await ev(`(function(){var t=document.getElementById('toast');return t?t.innerText.replace(/\\s+/g,' ').trim():'';})()`)));
    console.log('confirm 按钮:', await ev(`!!document.querySelector('[data-a="confirm-import"]')`));
  } catch (e) { console.error('FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
