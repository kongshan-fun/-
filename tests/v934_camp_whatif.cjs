'use strict';
/*
 * 如果洞府也做全屏（隐藏顶栏+状态条），三宽度分别变成几屏？
 * 用法: node tests/v934_camp_whatif.cjs jindan-v934
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v934';
const EDGE = require('./lib/browser').BROWSER;
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
  const port = 9914;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'whatif-'));
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

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(900);
    for (let i = 0; i < 3; i++) {
      await click('[data-a="panel"][data-name="camp"]'); await sleep(700);
      if (await ev(`!!document.querySelector('#panel-root .panel-overlay')`)) break;
    }

    for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(600);
      const r = await ev(`(function(){
        var body=document.getElementById('panel-body');
        var before=Math.round(body.getBoundingClientRect().height), total=body.scrollHeight;
        /* 模拟：洞府也全屏，隐藏顶栏与状态条 */
        var st=document.createElement('style'); st.id='whatif';
        st.textContent='#phone.whatif .topbar,#phone.whatif #status{display:none!important}';
        document.head.appendChild(st);
        document.getElementById('phone').classList.add('whatif');
        var after=Math.round(body.getBoundingClientRect().height);
        /* 再模拟：卡片里去掉"升级后…"那行说明（保守按 2 行 ≈ 34px） */
        var cards=[].slice.call(document.querySelectorAll('#panel-body .building-card'));
        var cardH=cards.length?Math.round(cards[0].getBoundingClientRect().height):0;
        var saved=cards.length*2*17;
        document.getElementById('phone').classList.remove('whatif');
        st.remove();
        return {w:${w},visBefore:before,visAfter:after,total:total,cardH:cardH,
          nowScreens:Math.round(total/before*100)/100,
          fullScreens:Math.round(total/after*100)/100,
          fullPlusSlimScreens:Math.round((total-saved)/after*100)/100,
          savedPx:saved};
      })()`);
      console.log(JSON.stringify(r));
    }
  } catch (e) { console.error('FAIL: ' + e.message); process.exitCode = 1; }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
