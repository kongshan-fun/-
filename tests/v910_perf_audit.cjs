'use strict';
/**
 * V90.10 性能审计
 * 测量：启动耗时、堆与 DOM 规模、CSS 规则数、localStorage 体积与写入耗时、
 *       各面板打开延迟、重复渲染稳定性。
 *
 * 运行： node tests/v910_perf_audit.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'visual', 'v910-perf');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const W = 390, H = 844;

const PANELS = ['character', 'pack', 'craft', 'camp', 'book', 'settings', 'quest'];

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
    throw new Error('waitFor timeout: ' + expr);
  }
}

const click = (cdp, sel) => cdp.eval(`(function(){var b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true;})()`);

/* 点击到两帧绘制完成的耗时 */
const timedClick = (cdp, sel) => cdp.eval(`new Promise(function(res){
  var t0=performance.now();
  var b=document.querySelector(${JSON.stringify(sel)});
  if(!b){res(-1);return;}
  b.click();
  requestAnimationFrame(function(){requestAnimationFrame(function(){res(+(performance.now()-t0).toFixed(2));});});
})`);

const SETITEM_HOOK = `
(function(){
  window.__setTimes=[]; window.__setBytes=0; window.__setCount=0;
  var p=Storage.prototype, orig=p.setItem;
  p.setItem=function(k,v){
    var t0=performance.now();
    try{ return orig.call(this,k,v); }
    finally{
      window.__setTimes.push(+(performance.now()-t0).toFixed(3));
      window.__setBytes+=(String(k).length+String(v).length);
      window.__setCount++;
    }
  };
})();`;

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
  const port = 9971;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  const report = { panels: {}, boot: {}, storage: {}, dom: {} };
  try {
    await waitDebug(port);
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Performance.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SETITEM_HOOK });

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    const t0 = Date.now();
    await cdp.send('Page.navigate', { url: origin + '/index.html' });
    await cdp.waitFor("typeof window.QData === 'object'");
    report.boot.engineReadyMs = Date.now() - t0;
    await sleep(1200);
    report.boot.firstPaintMs = await cdp.eval(`(function(){var n=performance.getEntriesByType('navigation')[0];return n?+ (n.domContentLoadedEventEnd).toFixed(1):-1;})()`);

    // 入世
    for (const [sel, w] of [['[data-a="characters"]', 600], ['[data-a="choose-role"][data-role="human"]', 500],
      ['[data-a="view-slots"]', 600], ['[data-a="slot-open"][data-slot="1"]', 800],
      ['[data-a="birth-next"]', 800], ['[data-a="birth-confirm-final"]', 1500]]) {
      if (!(await click(cdp, sel))) throw new Error('onboarding ' + sel);
      await sleep(w);
    }
    await cdp.eval(`(function(){
      var g=document.querySelector('.modal-backdrop [data-a="guide"]')||document.querySelector('[data-a="guide"]');
      if(g){g.click();return;}
      var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();
    })()`);
    await sleep(600);
    await cdp.eval(`(function(){var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(600);

    // 面板打开延迟（每项测 3 次取中位数）
    for (const name of PANELS) {
      const sel = `[data-a="panel"][data-name="${name}"]`;
      const samples = [];
      for (let i = 0; i < 3; i++) {
        await cdp.eval(`(function(){var c=document.querySelector('.panel-close');if(c)c.click();})()`);
        await sleep(280);
        const ms = await timedClick(cdp, sel);
        if (ms > 0) samples.push(ms);
        await sleep(200);
      }
      samples.sort((a, b) => a - b);
      report.panels[name] = {
        medianMs: samples.length ? +samples[Math.floor(samples.length / 2)].toFixed(2) : -1,
        samples,
      };
    }
    await cdp.eval(`(function(){var c=document.querySelector('.panel-close');if(c)c.click();})()`);
    await sleep(300);

    // 存储与 DOM 规模
    report.storage = await cdp.eval(`(function(){
      var keys=Object.keys(localStorage), bytes=0;
      for(var k of keys) bytes+=(k.length+(localStorage.getItem(k)||'').length);
      var m=window.__setTimes||[];
      m.sort(function(a,b){return a-b;});
      return {keyCount:keys.length, bytes:bytes,
              writes:window.__setCount||0, writeTotalBytes:window.__setBytes||0,
              writeMaxMs:m.length?m[m.length-1]:0, writeMedianMs:m.length?m[Math.floor(m.length/2)]:0,
              topKeys:keys.map(function(k){return {k:k.slice(0,42),n:(localStorage.getItem(k)||'').length};})
                        .sort(function(a,b){return b.n-a.n;}).slice(0,6)};
    })()`);

    // DOM / CSS 规模
    report.dom = await cdp.eval(`(function(){
      var rules=0, sheets=document.styleSheets.length;
      for(var i=0;i<sheets;i++){ try{ rules+=document.styleSheets[i].cssRules.length; }catch(e){} }
      return {nodes:document.querySelectorAll('*').length,
              elements:document.getElementsByTagName('*').length,
              styleSheets:sheets, cssRules:rules,
              htmlBytes:document.documentElement.outerHTML.length};
    })()`);

    const metrics = await cdp.send('Performance.getMetrics');
    const get = (n) => { const m = metrics.metrics.find((x) => x.name === n); return m ? m.value : null; };
    report.dom.jsHeapMB = get('JSHeapUsedSize') ? +(get('JSHeapUsedSize') / 1048576).toFixed(2) : null;
    report.dom.jsHeapTotalMB = get('JSHeapTotalSize') ? +(get('JSHeapTotalSize') / 1048576).toFixed(2) : null;
    report.dom.layoutCount = get('LayoutCount');
    report.dom.recalcStyleCount = get('RecalcStyleCount');
    report.dom.jsEventListeners = get('JSEventListeners');
    report.dom.documents = get('Documents');

    console.log('=== 启动 ===');
    console.log(`  引擎就绪     ${report.boot.engineReadyMs} ms`);
    console.log(`  DOMContentLoaded ${report.boot.firstPaintMs} ms`);
    console.log('\n=== 面板打开延迟（3 次中位数） ===');
    for (const [k, v] of Object.entries(report.panels)) {
      console.log(`  ${k.padEnd(11)} ${String(v.medianMs).padStart(7)} ms   样本 [${v.samples.join(', ')}]`);
    }
    console.log('\n=== 存储 ===');
    console.log(`  localStorage 键数 ${report.storage.keyCount}，字符串总量 ${(report.storage.bytes / 1024).toFixed(1)} KB`);
    console.log(`  写入 ${report.storage.writes} 次，累计 ${(report.storage.writeTotalBytes / 1024).toFixed(1)} KB，单次最长 ${report.storage.writeMaxMs} ms，中位 ${report.storage.writeMedianMs} ms`);
    console.log('  最大的键：');
    for (const k of report.storage.topKeys) console.log(`    ${String(k.n).padStart(7)} 字符  ${k.k}`);
    console.log('\n=== DOM / CSS ===');
    console.log(`  DOM 节点 ${report.dom.nodes}，样式表 ${report.dom.styleSheets}，CSS 规则 ${report.dom.cssRules}`);
    console.log(`  JS 堆 ${report.dom.jsHeapMB} MB / 总 ${report.dom.jsHeapTotalMB} MB`);
    console.log(`  Layout ${report.dom.layoutCount} 次，RecalcStyle ${report.dom.recalcStyleCount} 次，事件监听 ${report.dom.jsEventListeners} 个`);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(300);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\n明细: visual/v910-perf/perf.json');
})();
