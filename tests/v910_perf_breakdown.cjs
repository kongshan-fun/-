'use strict';
/**
 * render() 成本拆解：用 CDP Performance 指标差分，比较一次交互里
 * Script / Layout / RecalcStyle 各自耗时，判断该优化 JS 还是 CSS。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v910-perf');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(root, rel);
      if (!f.startsWith(root)) { rsp.writeHead(403).end(); return; }
      fs.readFile(f, (e, b) => {
        if (e) { rsp.writeHead(404).end(); return; }
        rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        rsp.end(b);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 40000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
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
  async metrics() {
    const r = await this.send('Performance.getMetrics');
    const o = {};
    for (const m of r.metrics) o[m.name] = m.value;
    return o;
  }
}

const click = (cdp, sel) => cdp.eval(`(function(){var b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true;})()`);
const timed = (cdp, sel) => cdp.eval(`new Promise(function(res){
  var t0=performance.now();var b=document.querySelector(${JSON.stringify(sel)});
  if(!b){res(-1);return;} b.click();
  requestAnimationFrame(function(){requestAnimationFrame(function(){res(+(performance.now()-t0).toFixed(2));});});
})`);

async function waitDebug(port) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('devtools');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT);
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const port = 9981;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  const out = { rounds: [], summary: {} };
  try {
    await waitDebug(port);
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: origin + '/index.html' });
    await cdp.waitFor("typeof window.QData === 'object'");
    await sleep(1200);

    for (const [sel, w] of [['[data-a="characters"]', 600], ['[data-a="choose-role"][data-role="human"]', 500],
      ['[data-a="view-slots"]', 600], ['[data-a="slot-open"][data-slot="1"]', 800],
      ['[data-a="birth-next"]', 800], ['[data-a="birth-confirm-final"]', 1500]]) {
      if (!(await click(cdp, sel))) throw new Error('onboarding ' + sel);
      await sleep(w);
    }
    await cdp.eval(`(function(){var g=document.querySelector('[data-a="guide"]');if(g)g.click();var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();})()`);
    await sleep(500);
    await cdp.eval(`(function(){var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(500);

    const KEYS = ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount', 'TaskDuration'];
    const N = 14;
    for (let i = 0; i < N; i++) {
      const open = i % 2 === 0;
      const sel = open ? '[data-a="panel"][data-name="settings"]' : '.panel-close';
      await sleep(260);
      const a = await cdp.metrics();
      const wall = await timed(cdp, sel);
      await sleep(120);
      const b = await cdp.metrics();
      const d = {};
      for (const k of KEYS) d[k] = +((b[k] || 0) - (a[k] || 0)).toFixed(4);
      out.rounds.push({
        action: open ? 'open-settings' : 'close-panel',
        wallMs: wall,
        scriptMs: +(d.ScriptDuration * 1000).toFixed(2),
        layoutMs: +(d.LayoutDuration * 1000).toFixed(2),
        styleMs: +(d.RecalcStyleDuration * 1000).toFixed(2),
        taskMs: +(d.TaskDuration * 1000).toFixed(2),
        layouts: d.LayoutCount,
        restyles: d.RecalcStyleCount,
      });
    }

    const avg = (k) => +(out.rounds.reduce((s, r) => s + r[k], 0) / out.rounds.length).toFixed(2);
    out.summary = {
      rounds: out.rounds.length,
      avgWallMs: avg('wallMs'), avgScriptMs: avg('scriptMs'), avgLayoutMs: avg('layoutMs'),
      avgStyleMs: avg('styleMs'), avgTaskMs: avg('taskMs'),
      avgLayouts: avg('layouts'), avgRestyles: avg('restyles'),
    };
    console.log('=== 每次 render() 的平均成本（' + out.rounds.length + ' 次开/关设置面板） ===');
    console.log(`  墙钟(含 2 帧等待)  ${out.summary.avgWallMs} ms`);
    console.log(`  脚本执行          ${out.summary.avgScriptMs} ms`);
    console.log(`  布局              ${out.summary.avgLayoutMs} ms（Layout 次数 ${out.summary.avgLayouts}）`);
    console.log(`  样式重算          ${out.summary.avgStyleMs} ms（RecalcStyle 次数 ${out.summary.avgRestyles}）`);
    console.log(`  任务总时长        ${out.summary.avgTaskMs} ms`);
    const share = (v) => out.summary.avgScriptMs + out.summary.avgLayoutMs + out.summary.avgStyleMs > 0
      ? (v / (out.summary.avgScriptMs + out.summary.avgLayoutMs + out.summary.avgStyleMs) * 100).toFixed(0) + '%' : 'n/a';
    console.log(`\n  构成占比：脚本 ${share(out.summary.avgScriptMs)} / 布局 ${share(out.summary.avgLayoutMs)} / 样式 ${share(out.summary.avgStyleMs)}`);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(300);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
  fs.writeFileSync(path.join(OUT, 'breakdown.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log('\n明细: visual/v910-perf/breakdown.json');
})();
