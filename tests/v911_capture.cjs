'use strict';
/* 抓取 V90.10 与 V90.11 的修炼面板：父页 + 子页 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v911-cultivate');
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
const click = (c, s) => c.eval(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);

async function grab(dirName, tag, steps) {
  const srv = await serve(path.join(ROOT, 'play', dirName));
  const port = 9989 + Math.floor(Math.random() * 8);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
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

    // 等落地
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const ok = await cdp.eval(`!document.querySelector('[data-a="view-slots"]') && !document.querySelector('[data-a="slot-open"]')`).catch(() => false);
      if (ok) break;
    }
    await sleep(600);

    // 进入修炼：洞府 → 进入修炼
    await click(cdp, '[data-a="panel"][data-name="camp"]'); await sleep(800);
    await click(cdp, '[data-a="panel"][data-name="cultivate"]'); await sleep(900);
    await cdp.eval(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`);
    await sleep(400);
    await cdp.shot(path.join(OUT, `${tag}-1.png`));
    const m1 = await cdp.eval(`(function(){var p=document.getElementById('panel-body');return {h:p.scrollHeight,c:p.clientHeight,ratio:+(p.scrollHeight/p.clientHeight).toFixed(2)};})()`);
    console.log(`${tag}-1  内容高 ${m1.h} / 可视 ${m1.c}  屏数 ${m1.ratio}`);

    for (const st of steps) {
      const ok = await click(cdp, st.sel);
      await sleep(st.wait || 900);
      if (!ok) { console.log(`  ${st.tag} 未命中 ${st.sel}`); continue; }
      await cdp.shot(path.join(OUT, `${tag}-${st.tag}.png`));
      const mm = await cdp.eval(`(function(){var p=document.getElementById('panel-body');return {h:p.scrollHeight,c:p.clientHeight,ratio:+(p.scrollHeight/p.clientHeight).toFixed(2)};})()`);
      console.log(`  ${tag}-${st.tag}  内容高 ${mm.h} / 可视 ${mm.c}  屏数 ${mm.ratio}`);
    }
  } catch (e) { console.error(`${tag} FAIL: ${e.message}`); }
  finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // 改前：V90.10，修炼页只有一个长页
  await grab('jindan', 'before', []);
  // 改后：V90.11，父页 + 子页
  await grab('jindan-v911', 'after', [
    { sel: '[data-a="cult-step"][data-name="cultivate-trial"]', tag: '2', wait: 1000 },
    { sel: '[data-a="panel-back"]', tag: 'back', wait: 800 },
    { sel: '[data-a="cult-step"][data-name="cultivate-art"]', tag: '3', wait: 900 },
  ]);
})();
