'use strict';
/*
 * V90.52 锻造熟练度：三宽度截图（前后对比）
 * 用法: node tools/capture_v952_craft.cjs <playDir> <tag> [forge] [forged]
 *   给了 forge 就在 seed 里注入 prof（用于拍「三级 熟练 730/1,200」的样子）
 * 产物: visual/v952-craft/<tag>/{320x568,360x640,390x844}-craft[-gear].png
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v952';
const TAG = process.argv[3] || 'after';
const FORGE = process.argv[4] === undefined ? null : Number(process.argv[4]);
const FORGED = process.argv[5] === undefined ? 0 : Number(process.argv[5]);
const OUT = path.join(ROOT, 'visual', 'v952-craft', TAG);
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

/* 把 play 页复制到临时目录，必要时给 seed 注入 prof，不弄脏仓库里的 play/ */
function stage() {
  const src = path.join(ROOT, 'play', DIR, 'index.html');
  let html = fs.readFileSync(src, 'utf8');
  if (FORGE !== null) {
    if (!/"rebuilt"\s*:\s*1/.test(html)) throw new Error('seed 里没有 rebuilt 标记');
    html = html.replace(/("rebuilt"\s*:\s*1)/, `$1, "prof": {"forge": ${FORGE}, "forged": ${FORGED}}`);
    if (!html.includes('"prof"')) throw new Error('prof 注入失败');
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v952shot-'));
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
  const port = 9952;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v952prof-'));
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
    const strip = () => ev(`(function(){var e=document.querySelector('#panel-root .forge-prof');if(!e)return '';
      var r=document.querySelector('#panel-root .forge-rate');
      return (e.innerText||'').replace(/\\s+/g,' ').trim()+' | '+(r?(r.innerText||'').replace(/\\s+/g,' ').trim():'（无出率条）');})()`);

    await send('Runtime.enable'); await send('Page.enable');
    for (const [w, h] of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(650);
      await closeAll();
      await click('[data-a="panel"][data-name="craft"]'); await sleep(620);
      console.log(`  ${w}x${h} 炼制 ${w === 360 ? await strip() : ''}`);
      await shot(`${w}x${h}-craft.png`);
      /* 进「装备」品类：1 阶配方行会显示当前仙品概率 */
      await click('[data-a="panel-step"][data-name="craft-cat"][data-cat="gear"]'); await sleep(560);
      await click('[data-a="panel-step"][data-name="craft-tier"][data-tier="1"]'); await sleep(560);
      await shot(`${w}x${h}-craft-gear.png`);
    }
    console.log(`  截图 -> visual/v952-craft/${TAG}/`);
  } catch (e) { console.error('FAIL: ' + e.message); process.exitCode = 1; }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
