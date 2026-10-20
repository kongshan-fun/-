'use strict';
/* 按「一页只放同一类内容」扫一遍：哪一面板里塞了多类功能 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v913';
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
  const port = 9910;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aud3-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
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

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    const targets = [['camp', '洞府'], ['craft', '炼制'], ['pack', '背包'], ['character', '人物装备'], ['book', '图鉴'], ['cultivate', '修炼'], ['quest', '主线'], ['warehouse', '仓库'], ['lore', '见闻'], ['manuals', '功法'], ['help', '教程'], ['settings', '设置']];
    console.log('\n  面板        屏数   h3数  按钮动作类型数  各类动作（前8）');
    for (const [name, label] of targets) {
      await ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`); await sleep(250);
      if (!(await click(`[data-a="panel"][data-name="${name}"]`))) { console.log('  ' + label.padEnd(12) + ' 打不开'); continue; }
      await sleep(700);
      const info = await ev(`(function(){
        var body=document.getElementById('panel-body');if(!body)return null;
        var h3=body.querySelectorAll('h3').length;
        var acts=[...new Set([...body.querySelectorAll('[data-a]')].map(b=>b.dataset.a))];
        var names=[...body.querySelectorAll('[data-a="panel"]')].map(b=>b.dataset.name);
        return {r:+(body.scrollHeight/body.clientHeight).toFixed(2),h3,a:acts.length,acts:acts.slice(0,8),panels:[...new Set(names)]};})()`);
      if (!info) { console.log('  ' + label.padEnd(12) + ' 无内容'); continue; }
      const flag = (info.h3 >= 3 || info.a >= 6) ? '  ⚠ 多类功能' : '';
      console.log('  ' + label.padEnd(12) + String(info.r).padStart(5) + String(info.h3).padStart(6) + String(info.a).padStart(12) + '   ' + info.acts.join(',') + flag);
      if (info.panels.length) console.log('                 └ 内含入口: ' + info.panels.join(', '));
    }
  } catch (e) { console.error('FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
