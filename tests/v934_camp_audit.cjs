'use strict';
/*
 * 洞府（camp）拥挤程度取证：三宽度截图 + 折叠线以下还有什么
 * 用法: node tests/v934_camp_audit.cjs jindan-v934
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v934';
const OUT = path.join(ROOT, 'visual', 'v934-camp');
const EDGE = require('./lib/browser').BROWSER;
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
  const port = 9913;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'camp-'));
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(900);

    /* 打开洞府 */
    for (let i = 0; i < 3; i++) {
      await click('[data-a="panel"][data-name="camp"]');
      await sleep(700);
      if (await ev(`!!document.querySelector('#panel-root .panel-overlay')`)) break;
    }

    for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(700);
      await ev(`(function(){var b=document.getElementById('panel-body');if(b)b.scrollTop=0;})()`);
      await sleep(200);
      await shot(`${w}x${h}-camp-top.png`);

      const m = await ev(`(function(){
        var body=document.getElementById('panel-body');
        var r=body.getBoundingClientRect();
        var vis=r.height;
        var total=body.scrollHeight;
        var cards=[].map.call(document.querySelectorAll('#panel-body .building-card'),function(c){
          var cb=c.getBoundingClientRect();
          var name=(c.querySelector('.building-name,.building-heading strong,b,strong')||{}).textContent||'';
          return {name:name.trim().slice(0,8),top:Math.round(cb.top-r.top),h:Math.round(cb.height),
                  visible:cb.top<r.bottom-2};
        });
        var foldNames=cards.filter(function(c){return !c.visible;}).map(function(c){return c.name;});
        return {w:${w},h:${h},visH:Math.round(vis),totalH:Math.round(total),
          screens:Math.round(total/vis*100)/100,
          cards:cards.length,cardsVisible:cards.filter(function(c){return c.visible;}).length,
          belowFold:foldNames,
          bodyTop:Math.round(r.top),bodyBottom:Math.round(r.bottom)};
      })()`);
      console.log(JSON.stringify(m));

      await ev(`(function(){var b=document.getElementById('panel-body');b.scrollTop=b.scrollHeight;})()`);
      await sleep(300);
      await shot(`${w}x${h}-camp-bottom.png`);
      await ev(`(function(){var b=document.getElementById('panel-body');b.scrollTop=0;})()`);
      await sleep(150);
    }
    console.log('\n截图：visual/v934-camp/');
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
