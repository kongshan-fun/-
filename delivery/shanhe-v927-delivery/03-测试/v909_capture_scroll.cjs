'use strict';
/**
 * 设置面板滚动截图：用于改前/改后对比。
 * 用法： node tests/v909_capture_scroll.cjs <相对路径> <输出前缀> [帧数]
 * 例：   node tests/v909_capture_scroll.cjs index.html after 4
 *        node tests/v909_capture_scroll.cjs "releases/山野修仙记_V90.8_五阶洞府与高阶炼制版.html" before 4
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v909');

const target = process.argv[2] || 'index.html';
const prefix = process.argv[3] || 'shot';
const frames = Number(process.argv[4] || 4);
const W = 390, H = 844;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (e, buf) => {
        if (e) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 1; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('ws')), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    return r.result.value;
  }
  async waitFor(expr, timeout = 25000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch {}
      await sleep(120);
    }
    throw new Error('waitFor timeout');
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
}

async function waitDebug(port) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('devtools');
}

const click = (cdp, sel) => cdp.eval(`(function(){var b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true;})()`);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await startServer(ROOT);
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const port = 9941;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  try {
    await waitDebug(port);
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });

    const url = origin + '/' + target.split('/').map(encodeURIComponent).join('/');
    await cdp.send('Page.navigate', { url });
    await cdp.waitFor("typeof window.QData === 'object'");
    await sleep(1200);

    // 入世
    for (const [sel, w] of [['[data-a="characters"]', 600], ['[data-a="choose-role"][data-role="human"]', 500],
      ['[data-a="view-slots"]', 600], ['[data-a="slot-open"][data-slot="1"]', 800],
      ['[data-a="birth-next"]', 800], ['[data-a="birth-confirm-final"]', 1500]]) {
      if (!(await click(cdp, sel))) throw new Error('onboarding missing ' + sel);
      await sleep(w);
    }
    await cdp.eval(`(function(){
      var g=document.querySelector('.modal-backdrop [data-a="guide"]')||document.querySelector('[data-a="guide"]');
      if(g){g.click();return;}
      var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();
    })()`);
    await sleep(700);
    await cdp.eval(`(function(){var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(600);

    // 打开设置
    const opened = await cdp.eval(`(function(){
      var b=document.querySelector('[data-a="panel"][data-name="settings"]');
      if(!b)return false;b.click();return true;})()`);
    if (!opened) throw new Error('settings button missing');
    await sleep(900);

    const dim = await cdp.eval(`(function(){var pb=document.getElementById('panel-body');
      return {sh:pb.scrollHeight, ch:pb.clientHeight};})()`);
    const steps = Math.min(frames, Math.max(1, Math.ceil(dim.sh / dim.ch)));
    console.log(`面板内容 ${dim.sh}px / 可视 ${dim.ch}px -> 抓 ${steps} 帧`);

    for (let i = 0; i < steps; i++) {
      const top = Math.round((dim.sh - dim.ch) * (steps === 1 ? 0 : i / (steps - 1)));
      await cdp.eval(`(function(){var pb=document.getElementById('panel-body');pb.scrollTop=${top};return pb.scrollTop;})()`);
      await sleep(450);
      const f = path.join(OUT, `${prefix}-${String(i + 1).padStart(2, '0')}.png`);
      await cdp.shot(f);
      console.log('  ' + path.basename(f) + `  scrollTop=${top}`);
    }
    console.log('完成：' + prefix + ' ' + steps + ' 帧');
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { await cdp.send('Browser.close'); } catch {} try { cdp.ws.close(); } catch {} }
    await sleep(400);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
