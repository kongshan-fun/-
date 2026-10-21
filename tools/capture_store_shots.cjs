'use strict';
/*
 * 抓 4 张 V90.37 商店截图（720×1280，9:16，满足 TapTap 竖版 3:8~5:8 / ≥720×1280）
 *   ① 洞府主界面  ② 战斗界面  ③ 人物装备  ④ 破境条件（渡劫）
 * 用法: node tools/capture_store_shots.cjs jindan-v937
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v937';
const OUT = path.join(ROOT, 'visual', 'store-v937');
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

(async () => {
  const srv = await serve(path.join(ROOT, 'play', DIR));
  const port = 9922;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
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
    const shot = async (f) => { await sleep(250); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); console.log('  ' + f); };
    const closeAll = async () => { for (let i = 0; i < 5; i++) { const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`); if (!had) break; await sleep(250); } };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(1200);

    /* ① 洞府 */
    await closeAll();
    for (let i = 0; i < 3; i++) { if (await click('[data-a="panel"][data-name="camp"]')) { await sleep(900); break; } }
    if (await ev(`!!document.querySelector('#panel-root .panel-overlay')`)) await shot('01-camp.png'); else console.log('  ! 洞府没打开');

    /* ② 战斗（试剑两回合，让日志有内容） */
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(800);
    if (await click('[data-a="train"]')) {
      await sleep(900);
      for (let i = 0; i < 2; i++) { await click('#combat-root [data-mode="guard"]'); await sleep(700); }
      await shot('02-combat.png');
      await click('#combat-root [data-mode="escape"]'); await sleep(1000);
    } else console.log('  ! 试剑没开起来');

    /* ③ 人物装备 */
    await closeAll();
    for (let i = 0; i < 3; i++) { if (await click('[data-a="panel"][data-name="character"]')) { await sleep(900); break; } }
    if (await ev(`!!document.querySelector('#character-root, #panel-root .panel-overlay')`)) await shot('03-character.png'); else console.log('  ! 人物没打开');

    /* ④ 破境条件 */
    await closeAll();
    await click('[data-a="panel"][data-name="camp"]'); await sleep(800);
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(800);
    await click('.cult-nav-row[data-name="cultivate-trial"]'); await sleep(900);
    await shot('04-trial.png');

    const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.png'));
    console.log('共 ' + files.length + ' 张，目录：' + OUT);
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
