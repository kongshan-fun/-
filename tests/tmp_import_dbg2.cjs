'use strict';
/* 探针 2：change 事件到底有没有到 document？importFile 是否在全局？ */
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
  const port = 9896;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'imp2-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') console.log('EXC:', (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 300));
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 400) }; return r.result.value; };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(1200);

    console.log('typeof importFile   :', await ev(`typeof importFile`));
    console.log('typeof window.QData :', await ev(`typeof window.QData`));
    await ev(`window.__changed='';document.addEventListener('change',function(e){window.__changed=(e.target&&e.target.id)||'?'});`);
    const key = 'qinglan-wendao-v14-human-slot-001';
    const raw = await ev(`localStorage.getItem(${JSON.stringify(key)})`);
    const st = JSON.parse(raw);
    st.inv = st.inv || {}; st.inv.dust = 999;
    const env = { format: 'QinglanWendao', version: 'V14', character: 'human', exportedAt: new Date().toISOString(), state: st };
    const res = await ev(`(function(){
      var txt=${JSON.stringify(JSON.stringify(env))};
      var dt=new DataTransfer();
      dt.items.add(new File([txt],'legacy.json',{type:'application/json'}));
      var input=document.getElementById('import-file');
      input.files=dt.files;
      var fired=input.dispatchEvent(new Event('change',{bubbles:true}));
      return {fired:fired, n:input.files.length, changed:window.__changed};
    })()`);
    console.log('dispatch 结果       :', JSON.stringify(res));
    await sleep(1500);
    console.log('toast               :', JSON.stringify(await ev(`(function(){var t=document.getElementById('toast');return t?t.innerText.replace(/\\s+/g,' ').trim():'';})()`)));
    console.log('modal               :', JSON.stringify(await ev(`(function(){var m=document.getElementById('modal-root');return m?m.innerHTML.slice(0,120):'';})()`)));
    console.log('直接调 importFile  :', JSON.stringify(await ev(`(async function(){
      var key=${JSON.stringify(key)};
      var st=JSON.parse(localStorage.getItem(key));
      st.inv=st.inv||{}; st.inv.dust=888;
      var env={format:'QinglanWendao',version:'V14',character:'human',exportedAt:new Date().toISOString(),state:st};
      var f=new File([JSON.stringify(env)],'x.json',{type:'application/json'});
      if(typeof importFile!=='function') return 'no function';
      await importFile(f);
      return {modal:!!document.querySelector('[data-a=\\"confirm-import\\"]')};
    })()`)));
  } catch (e) { console.error('FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
