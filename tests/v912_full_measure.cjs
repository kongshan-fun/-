'use strict';
/* 量测 V90.12（最新）所有页面屏数，找出仍然滚动的界面 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v912';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
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

(async () => {
  const srv = await serve(path.join(ROOT, 'play', DIR));
  const port = 9940;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ms2-'));
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const m = () => ev(`(function(){var b=document.getElementById('panel-body');if(!b)return null;
      return {h:b.scrollHeight,c:b.clientHeight,r:+(b.scrollHeight/b.clientHeight).toFixed(2),
              t:(document.getElementById('panel-root')?.querySelector('.panel')?.getAttribute('aria-label')||'?')};})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    const rows = [];
    const add = async (label) => { const x = await m(); if (x && x.c) rows.push([label, x.t, x.h, x.c, x.r]); };

    // 底部导航直达
    for (const [name, label] of [['camp', '洞府'], ['craft', '炼制'], ['pack', '背包'], ['character', '人物装备'], ['book', '图鉴']]) {
      await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(300);
      await click(`[data-a="panel"][data-name="${name}"]`); await sleep(700);
      await ev(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`);
      await add(label);
    }
    // 炼制三级
    await click('[data-a="panel"][data-name="craft"]'); await sleep(600);
    await click('[data-a="panel-step"][data-name="craft-cat"][data-cat="gear"]'); await sleep(700); await add('炼制·装备(品阶段)');
    await click('[data-a="panel-step"][data-name="craft-tier"]'); await sleep(700); await add('炼制·装备1阶(配方)');
    await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(400);
    // 修炼与子页
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700); await add('修炼');
    await click('[data-a="cult-step"][data-name="cultivate-trial"]'); await sleep(800); await add('修炼·破境条件');
    await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(400);
    await click('[data-a="cult-step"][data-name="cultivate-art"]'); await sleep(600); await add('修炼·境界法门');
    await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(400);
    // 其他面板
    for (const [name, label] of [['manuals', '功法'], ['warehouse', '仓库'], ['lore', '见闻'], ['help', '教程'], ['settings', '设置'], ['quest', '主线']]) {
      await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(300);
      if (await click(`[data-a="panel"][data-name="${name}"]`)) { await sleep(700); await add(label); }
    }

    console.log('\n  页面                        内容高  可视  屏数  判定');
    rows.sort((a, b) => b[4] - a[4]).forEach(([label, title, h, c, r]) => {
      const flag = r <= 1.02 ? '✅ 一屏' : r <= 1.15 ? '🟡 微滚' : '🔴 滚动';
      console.log('  ' + label.padEnd(24) + String(h).padStart(6) + String(c).padStart(6) + String(r).padStart(6) + '  ' + flag);
    });
  } catch (e) { console.error('FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
