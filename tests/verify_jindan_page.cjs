'use strict';
/* 验证 play/jindan/index.html：打开后是否自动落地在金丹前一步 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const DIR = path.resolve(__dirname, '..', 'play', 'jindan');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(root, rel);
      fs.readFile(f, (e, b) => { if (e) { rsp.writeHead(404).end(); return; } rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(b); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const srv = await serve(DIR);
  const port = 9994;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
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
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });

    // 等自动进入（最多 15 秒）
    let landed = false;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      try {
        const st = await ev(`(function(){
          var txt=document.body.innerText||'';
          return {inGame:!document.querySelector('[data-a="view-slots"]'),
                  text:txt.replace(/\\s+/g,' ').slice(0,150),
                  seeded:!!window.__SEEDED__, seedErr:window.__SEED_ERR__||null,
                  slotLen:(localStorage.getItem('qingnan-wendao')||'').length};})()`);
        if (st.inGame) { landed = true; console.log('落地用时约 ' + ((i + 1) * 0.25).toFixed(1) + ' 秒'); console.log('界面: ' + st.text); break; }
      } catch {}
    }

    const info = await ev(`(function(){
      var k='qinglan-wendao-v14-human-slot-001';
      var raw=localStorage.getItem(k)||'';
      var o={}; try{o=JSON.parse(raw);}catch(e){}
      return {seeded:!!window.__SEEDED__, seedErr:window.__SEED_ERR__||null,
              slotChars:raw.length, version:o.version, zone:o.zone, major:o.major,
              level:o.level, daoXp:o.daoXp,
              inGame:!document.querySelector('[data-a="view-slots"]'),
              body:(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,200)};})()`);

    console.log('\n=== 播种结果 ===');
    console.log('  播种成功      : ' + info.seeded + (info.seedErr ? '  错误:' + info.seedErr : ''));
    console.log('  001 档字符数  : ' + info.slotChars);
    console.log('  存档字段      : version=' + info.version + ' zone=' + info.zone + ' major=' + info.major + ' level=' + info.level + ' daoXp=' + info.daoXp);
    console.log('  自动进入游戏  : ' + (landed ? '是' : '否'));
    console.log('  界面文本      : ' + info.body);

    const ok = info.seeded && info.version === 14 && info.zone === 5 && info.major === 1 && landed;
    console.log('\n结论: ' + (ok ? 'PASS 打开即在该存档' : 'FAIL'));
    process.exitCode = ok ? 0 : 1;
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
