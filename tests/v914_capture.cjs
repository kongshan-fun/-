'use strict';
/* V90.14 入口去重前后对比 + 功法/仓库/见闻量测 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v914-entries');
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

async function run(dir, tag) {
  const srv = await serve(path.join(ROOT, 'play', dir));
  const port = 9890 + Math.floor(Math.random() * 40);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v914-'));
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
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const m = () => ev(`(function(){var b=document.getElementById('panel-body');if(!b)return null;
      return {h:b.scrollHeight,c:b.clientHeight,r:+(b.scrollHeight/b.clientHeight).toFixed(2),
              t:(document.getElementById('panel-root')?.querySelector('.panel')?.getAttribute('aria-label')||'?')};})()`);
    const close = () => ev(`(function(){document.querySelectorAll('[data-a="panel-back"]').forEach(b=>b.click());})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    // 顶栏
    const top = await ev(`(function(){var b=document.querySelector('.top-buttons');return b?[...b.querySelectorAll('button')].map(x=>x.textContent.trim()):[];})()`);
    console.log(`${tag} 顶栏按钮: ${top.join(' | ')}`);

    // 背包
    await click('[data-a="panel"][data-name="pack"]'); await sleep(800);
    await ev(`(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=0;})()`); await sleep(250);
    await shot(`${tag}-pack.png`);
    const pk = await ev(`(function(){var b=document.getElementById('panel-body');
      return {r:+(b.scrollHeight/b.clientHeight).toFixed(2),ext:[...b.querySelectorAll('[data-a="panel"]')].map(x=>x.dataset.name)};})()`);
    console.log(`   ${tag} 背包  ${pk.r} 屏  外部入口: ${pk.ext.join(',') || '无'}`);

    // 仓库（背包内入口）
    if (pk.ext.includes('warehouse')) {
      await click('[data-a="panel"][data-name="warehouse"]'); await sleep(800);
      const w = await m(); console.log(`   ${tag} 仓库  ${w.t}  ${w.h}/${w.c}  ${w.r} 屏`);
      await shot(`${tag}-warehouse.png`);
      await close(); await sleep(400);
    }

    // 人物
    await close(); await sleep(300);
    await click('[data-a="panel"][data-name="character"]'); await sleep(800);
    await shot(`${tag}-character.png`);
    const ch = await m(); console.log(`   ${tag} 人物  ${ch.r} 屏`);

    // 功法（洞府内）
    await close(); await sleep(300);
    await click('[data-a="panel"][data-name="camp"]'); await sleep(700);
    const mt = await click('[data-a="panel"][data-name="manuals"]');
    await sleep(800);
    if (mt) { const x = await m(); console.log(`   ${tag} 功法  ${x.t}  ${x.h}/${x.c}  ${x.r} 屏`); await shot(`${tag}-manuals.png`); }
    else console.log(`   ${tag} 功法  入口未找到`);

    // 见闻（主线内 lore-open）
    await close(); await sleep(300);
    await click('[data-a="panel"][data-name="quest"]'); await sleep(700);
    const lo = await click('[data-a="lore-open"]');
    await sleep(800);
    if (lo) { const x = await m(); console.log(`   ${tag} 见闻  ${x.t}  ${x.h}/${x.c}  ${x.r} 屏`); await shot(`${tag}-lore.png`); }
    else console.log(`   ${tag} 见闻  入口未找到`);
  } catch (e) { console.error(tag + ' FAIL: ' + e.message); }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await run('jindan-v913', 'before');
  await run('jindan-v914', 'after');
})();
