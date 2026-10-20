'use strict';
/* V90.12 前后对比：炼制 / 洞府 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v912-panels');
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

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 1; this.pending = new Map();
    ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }); }
  static async connect(u) { const ws = new WebSocket(u);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', () => j(new Error('ws')), { once: true }); });
    return new Cdp(ws); }
  send(m, p = {}) { const id = this.id++;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method: m, params: p }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + m)); } }, 30000); }); }
  async eval(e) { const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
  async shot(f) { const r = await this.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); }
}

async function run(dirName, tag, craftSteps, campSteps) {
  const srv = await serve(path.join(ROOT, 'play', dirName));
  const port = 9955 + Math.floor(Math.random() * 20);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v912-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await cdp.eval(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    const click = (s) => cdp.eval(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const measure = () => cdp.eval(`(function(){var b=document.getElementById('panel-body');
      return {h:b.scrollHeight,c:b.clientHeight,r:+(b.scrollHeight/b.clientHeight).toFixed(2),
              t:(document.getElementById('panel-root')?.querySelector('.panel')?.getAttribute('aria-label')||'?')};})()`);

    // 炼制
    await click('[data-a="panel"][data-name="craft"]'); await sleep(900);
    await cdp.eval(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(300);
    await cdp.shot(path.join(OUT, `${tag}-craft.png`));
    let m = await measure(); console.log(`${tag} 炼制  ${m.t}  ${m.h}/${m.c}  ${m.r} 屏`);

    for (const st of craftSteps) {
      const hit = await click(st.sel); await sleep(st.wait || 900);
      await cdp.eval(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(250);
      await cdp.shot(path.join(OUT, `${tag}-${st.tag}.png`));
      const mm = await measure();
      console.log(`   ${tag}-${st.tag}  hit=${hit}  ${mm.t}  ${mm.h}/${mm.c}  ${mm.r} 屏`);
    }
    await click('[data-a="panel-back"]'); await sleep(500);
    // 洞府
    await click('[data-a="panel-back"]').catch(() => {});
    await sleep(400);
    await click('[data-a="panel"][data-name="camp"]'); await sleep(900);
    await cdp.eval(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(300);
    await cdp.shot(path.join(OUT, `${tag}-camp.png`));
    m = await measure(); console.log(`${tag} 洞府  ${m.t}  ${m.h}/${m.c}  ${m.r} 屏`);

    for (const st of campSteps) {
      await click(st.sel); await sleep(st.wait || 900);
      await cdp.eval(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(250);
      await cdp.shot(path.join(OUT, `${tag}-${st.tag}.png`));
      const mm = await measure(); console.log(`   ${tag}-${st.tag}  ${mm.t}  ${mm.h}/${mm.c}  ${mm.r} 屏`);
      if (st.back) { await click('[data-a="panel-back"]'); await sleep(600); }
    }
  } catch (e) { console.error(tag + ' FAIL: ' + e.message); }
  finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await run('jindan-v911', 'before', [], []);
  await run('jindan-v912', 'after',
    [{ sel: '[data-a="panel-step"][data-name="craft-cat"][data-cat="food"]', tag: 'craft-mat', wait: 1000 },
     { sel: '[data-a="panel-back"]', tag: 'craft-back', wait: 700 },
     { sel: '[data-a="panel-step"][data-name="craft-cat"][data-cat="gear"]', tag: 'craft-gear', wait: 1000 },
     { sel: '[data-a="panel-step"][data-name="craft-tier"]', tag: 'craft-tier1', wait: 1000 }],
    [{ sel: '[data-a="panel-step"][data-name="camp-build"]', tag: 'camp-build', wait: 1000 }]);
})();
