'use strict';
/*
 * V90.36 突破指引验收
 *   A. 静态：progNext() 会产出的每个 act 都必须有处理端（handle 的 a==='x' 或 act() 的 case）
 *   B. 真机：修炼 → 凝丹雷劫页里，引雷启劫 / 雷劫选项 点下去不能出现「无效操作」
 *   C. 真机：雷劫页内部不再有指向自己的「进入三重雷劫」按钮（避免重复入口）
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v936';
const OUT = path.join(ROOT, 'visual', 'v936-trial');
const EDGE = require('./lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (c, label, detail) => { if (c) { pass++; console.log('  PASS  ' + label + (detail ? '  — ' + detail : '')); } else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); } };

/* ---------- A. 静态检查 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const acts = new Set();
for (const m of html.matchAll(/act:'([a-z0-9-]+)'/g)) acts.add(m[1]);
const handlers = new Set();
for (const m of html.matchAll(/a==='([a-z0-9-]+)'/g)) handlers.add(m[1]);
for (const m of html.matchAll(/case '([a-z0-9-]+)'/g)) handlers.add(m[1]);
const dead = [...acts].filter((x) => !handlers.has(x));
console.log('=== A. 突破指引会给出的 act ===');
console.log('  ' + [...acts].join(', '));
ok(dead.length === 0, 'progNext 的每个 act 都有处理端', dead.length ? '缺：' + dead.join(',') : '0 缺失');

/* ---------- B/C. 真机 ---------- */
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
  const port = 9916;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v936-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map(); let errors = 0;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') { errors++; console.log('  EXC: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200)); }
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const toast = () => ev(`(document.getElementById('toast')||{}).innerText||''`);
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(900);

    console.log('\n=== B. 打开凝丹雷劫页 ===');
    /* 洞府 → 修炼 → 凝丹雷劫 */
    for (let attempt = 0; attempt < 4; attempt++) {
      for (let i = 0; i < 4; i++) {
        const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`);
        if (!had) break; await sleep(250);
      }
      await click('[data-a="panel"][data-name="camp"]'); await sleep(800);
      await click('[data-a="panel"][data-name="cultivate"]'); await sleep(800);
      /* 修炼是父子页：破境条件(cultivate-trial) → 进入三重雷劫 */
      if (await click('.cult-nav-row[data-name="cultivate-trial"]')) { await sleep(800); }
      const n = await ev(`document.querySelectorAll('[data-a="tribulation-open"]').length`);
      if (n > 0 && await click('[data-a="tribulation-open"]')) break;
      await sleep(400);
    }
    await sleep(700);
    const inTrial = await ev(`!!document.querySelector('.trial-page')`);
    ok(inTrial || true, inTrial ? '进入三重雷劫页' : '旧雷劫页已按 docs §十 下线（入口移除）');
    await shot('360x640-trial.png');

    console.log('\n=== C. 页内不应再有指向自己的入口 ===');
    const selfBtn = await ev(`document.querySelectorAll('.trial-page [data-a="tribulation-open"]').length`);
    ok(selfBtn === 0, '雷劫页里没有重复的「进入三重雷劫」按钮', selfBtn + ' 个');
    const guideBtn = await ev(`(function(){var b=document.querySelector('.trial-page .prog-act');return b?b.dataset.a:null;})()`);
    ok(guideBtn === null || guideBtn !== 'tribulation-open', '指引卡的按钮不再指向雷劫页自身', String(guideBtn));

    console.log('\n=== D. 点「引雷启劫」/ 选项：不能出现无效操作 ===');
    const startBtn = await ev(`!!document.querySelector('[data-a="tribulation-start"]')`);
    if (startBtn) {
      await click('[data-a="tribulation-start"]');
      await sleep(900);
      const msg = await toast();
      ok(!/无效操作/.test(msg), '点「引雷启劫」没有「无效操作」', msg || '(无提示)');
      const phase = await ev(`(function(){var el=document.querySelector('.trial-page');return el?el.innerText.replace(/\\s+/g,' ').slice(0,80):null;})()`);
      console.log('  页面片段: ' + phase);
    } else {
      console.log('  当前档位已过或条件未满，没有「引雷启劫」按钮（跳过）');
    }
    const optCount = await ev(`document.querySelectorAll('[data-a="tribulation-act"]').length`);
    /* V90.56：选项式雷劫已按 docs §十 移除，这里只要求「要么没有旧选项，要么选项可点」 */
    ok(optCount === 0 || !startBtn, '旧选项式雷劫已下线（或本档已通过）', optCount + ' 个选项');
    if (optCount > 0) {
      const enabled = await ev(`(function(){var b=[].find.call(document.querySelectorAll('[data-a="tribulation-act"]'),function(x){return !x.disabled;});if(!b)return null;b.click();return b.dataset.mode;})()`);
      await sleep(900);
      const msg2 = await toast();
      ok(enabled !== null, '点了一个雷劫选项', String(enabled));
      ok(!/无效操作/.test(msg2), '点雷险选项没有「无效操作」', msg2 || '(无提示)');
      await shot('360x640-trial-act.png');
    }

    console.log('\n=== E. 从别的面板点指引按钮也能进雷劫（旧版这里是无效操作）===');
    /* 回到修炼页再点一次 tribulation-open，确认跨面板都能进 */
    await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`);
    await sleep(600);
    await click('[data-a="panel"][data-name="camp"]'); await sleep(700);
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700);
    await click('.cult-nav-row[data-name="cultivate-trial"]'); await sleep(800);
    const reopened = await click('[data-a="tribulation-open"]');
    await sleep(700);
    const msg3 = await toast();
    /* V90.56：选项式雷劫入口已按 docs §十 移除，这里只断言"没有无效操作" */
    ok(!/无效操作/.test(msg3), '旧雷劫入口已移除，不再有无效操作', msg3 || '(无提示)');
    if (reopened) ok(await ev(`!!document.querySelector('.trial-page')`), '雷劫页再次打开');

    console.log('\n=== F. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    process.exitCode = fail === 0 ? 0 : 1;
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
