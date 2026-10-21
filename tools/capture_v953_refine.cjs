'use strict';
/*
 * V90.53 精炼闭环：三宽度截图（人物装备面板，能同时看到战力与「精炼 · 灵尘N」）
 * 用法: node tools/capture_v953_refine.cjs <playDir> <tag>
 * 产物: visual/v953-refine/<tag>/{320x568,360x640,390x844}-character.png
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v953';
const TAG = process.argv[3] || 'after';
const GEAR = process.argv[4] || '';        // 可选：给种子档塞一件装备，才能截到「精炼 · 灵尘N」
const OUT = path.join(ROOT, 'visual', 'v953-refine', TAG);
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

/* 复制到临时目录并按需注入一件装备（不改仓库里的 play/） */
function stage() {
  const src = path.join(ROOT, 'play', DIR, 'index.html');
  let html = fs.readFileSync(src, 'utf8');
  if (GEAR) {
    const gear = JSON.stringify([{ id: 'g1', recipe: GEAR, quality: 2, refine: 0, affixes: [], source: '示例' }]);
    if (!/"gears":\s*\[\s*\]/.test(html)) throw new Error('seed 里的 gears 不是空数组，注入方式要改');
    html = html.replace(/"gears":\s*\[\s*\]/, `"gears": ${gear}`);
    if (!new RegExp('"recipe"\\s*:\\s*"' + GEAR + '"').test(html)) throw new Error('装备注入失败');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v953inject-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  return dir;
}

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

const WIDTHS = [[320, 568], [360, 640], [390, 844]];

(async () => {
  const staged = stage();
  const srv = await serve(staged);
  const port = 9953;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v953shot-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
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
    const shot = async (f) => { await sleep(340); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const closeAll = async () => { for (let i = 0; i < 6; i++) { const had = await click('[data-a="close-panel"]'); if (!had) break; await sleep(220); } await sleep(80); };
    const probe = () => ev(`(function(){var b=document.querySelector('.panel-body');
      var r=document.querySelector('.v905-status-sub strong');
      var btn=[].slice.call(document.querySelectorAll('[data-a="refine"]')).map(function(x){return x.textContent.trim();}).slice(0,3);
      var ratio=b?+(b.scrollHeight/b.clientHeight).toFixed(2):null;
      return {power:r?r.textContent.trim():'',refine:btn,ratio:ratio};})()`);

    await send('Runtime.enable'); await send('Page.enable');
    for (const [w, h] of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(650);
      await closeAll();
      await click('[data-a="panel"][data-name="character"]'); await sleep(700);
      const info = await probe();
      console.log(`  ${w}x${h} ${JSON.stringify(info)}`);
      await shot(`${w}x${h}-character.png`);
    }
    console.log(`  截图 -> visual/v953-refine/${TAG}/`);
  } catch (e) { console.error('FAIL: ' + e.message); process.exitCode = 1; }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
