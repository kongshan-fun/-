'use strict';
/*
 * V90.54 赋灵：三宽度截图（炼制 → 赋灵 子页）
 * 用法: node tools/capture_v954_spirit.cjs <playDir> <tag>
 * 产物: visual/v954-spirit/<tag>/{320x568,360x640,390x844}-spirit.png
 *
 * 页面里直接给档位补资源与两件带槽装备（只为截图，不改仓库 play/）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v954';
const TAG = process.argv[3] || 'after';
const OUT = path.join(ROOT, 'visual', 'v954-spirit', TAG);
const EDGE = require('../tests/lib/browser').BROWSER;
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

const WIDTHS = [[320, 568], [360, 640], [390, 844]];

/* 素材注入走 seed JSON（页面里的 game 在 IIFE 内，CDP 拿不到） */
function stage() {
  const src = path.join(ROOT, 'play', DIR, 'index.html');
  let html = fs.readFileSync(src, 'utf8');
  const need = (re, what) => { if (!re.test(html)) throw new Error('seed 缺少 ' + what + '，注入方式要改'); };
  need(/"gears":\s*\[\s*\]/, '"gears": []');
  need(/"rebuilt"\s*:\s*1/, '"rebuilt": 1');
  need(/"stone":\s*\d+/, '"stone"');
  need(/"xp":\s*\d+/, '"xp"');
  need(/"daoXp":\s*\d+/, '"daoXp"');

  const gear = (id, recipe, q, refine, pity) => ({ id, recipe, quality: q, refine, affixes: [], spiritPity: pity, source: '示例' });
  const gears = [gear('gs1', 'skySword', 4, 1, 3), gear('gs2', 'yinSword', 3, 0, 0), gear('gs3', 'skyRobe', 2, 0, 0)];
  html = html.replace(/"gears":\s*\[\s*\]/, '"gears": ' + JSON.stringify(gears));
  /* 赋灵三级 凝纹 630 / 已赋灵 42 次，让读数看得出来 */
  html = html.replace(/"rebuilt"\s*:\s*1/, '"rebuilt": 1, "prof": {"forge": 730, "forged": 86, "spirit": 630, "spirited": 42}');
  html = html.replace(/"stone":\s*\d+/, '"stone": 888');
  html = html.replace(/"xp":\s*\d+/, '"xp": 500');
  html = html.replace(/"daoXp":\s*\d+/, '"daoXp": 5000');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v954seed-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  return dir;
}

(async () => {
  const staged = stage();
  const srv = await serve(staged);
  const port = 9954;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v954shot-'));
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

    await send('Runtime.enable'); await send('Page.enable');
    for (const [w, h] of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(650);
      await closeAll();
      await click('[data-a="panel"][data-name="craft"]'); await sleep(520);
      const opened = await click('[data-a="panel-step"][data-name="craft-spirit"]'); await sleep(620);
      if (!opened) throw new Error('找不到赋灵入口');
      const info = await ev(`(function(){var b=document.getElementById('panel-body');
        var r=document.querySelector('#panel-root .forge-rate');
        return {rate:r?r.innerText.replace(/\\s+/g,' ').trim():'',ratio:b?+(b.scrollHeight/b.clientHeight).toFixed(2):null};})()`);
      console.log(`  ${w}x${h} ${JSON.stringify(info)}`);
      await shot(`${w}x${h}-spirit.png`);
    }
    console.log(`  截图 -> visual/v954-spirit/${TAG}/`);
  } catch (e) { console.error('FAIL: ' + e.message); process.exitCode = 1; }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
