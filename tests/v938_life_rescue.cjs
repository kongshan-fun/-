'use strict';
/*
 * V90.38 寿元改动验收
 *   A. 续命不再限制「最后 15 年」：寿元还有 60 年时也能续（+10 年）
 *   B. 寿元耗尽先给救援：弹「还有一线生机」，存档不清
 *   C. 看广告续命 15 年，本世继续（rescued=true）
 *   D. 救援用过后再耗尽：才真正结算清档 → permadeath
 *
 * 关键：寿元值必须在**页面加载前**注入（用 addScriptToEvaluateOnNewDocument），
 * 否则运行中的页面会把 localStorage 覆盖回去。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v938';
const OUT = path.join(ROOT, 'visual', 'v938-life');
const KEY = 'qinglan-wendao-v14-human-slot-001';
const EDGE = require('./lib/browser').BROWSER;
const YEAR = 5760;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (c, label, detail) => { if (c) { pass++; console.log('  PASS  ' + label + (detail ? '  — ' + detail : '')); } else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); } };

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/seed/index.html';
      fs.readFile(path.join(root, rel), (e, b) => { if (e) { rsp.writeHead(404).end(); return; } rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(b); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const playHtml = fs.readFileSync(path.join(ROOT, 'play', DIR, 'index.html'), 'utf8');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'life-'));
  fs.mkdirSync(path.join(TMP, 'seed'));
  fs.mkdirSync(path.join(TMP, 'noseed'));
  fs.writeFileSync(path.join(TMP, 'seed', 'index.html'), playHtml, 'utf8');
  const a = playHtml.indexOf('<script id="seed-save"');
  const b = playHtml.indexOf('<div id="phone"', a);
  fs.writeFileSync(path.join(TMP, 'noseed', 'index.html'), playHtml.slice(0, a) + playHtml.slice(b), 'utf8');

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9923;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v938-'));
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { await sleep(200); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const boot = async (which) => {
      await send('Page.navigate', { url: `${base}/${which}/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
      await sleep(1000);
    };
    const inject = async (saveObj) => {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(saveObj))});}catch(e){}` });
    };
    const readSave = () => ev(`(function(){var r=localStorage.getItem(${JSON.stringify(KEY)});return r?JSON.parse(r):null;})()`);
    const modalKind = () => ev(`(function(){if(document.querySelector('[data-a="ad-life-rescue"]'))return 'life-rescue';if(document.querySelector('[data-a="rebirth"]'))return 'permadeath';if(document.querySelector('[data-a="ad-life-confirm"]'))return 'ad-life';var m=document.querySelector('.modal, .modal-backdrop');return m?'other':null;})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await boot('seed');
    const S0 = await readSave();
    ok(!!S0, '拿到完整存档');

    console.log('=== A. 寿元还有 60 年时也能续命 ===');
    const sA = JSON.parse(JSON.stringify(S0)); sA.life.left = 60 * YEAR; sA.life.rescued = false;
    await inject(sA);
    await boot('noseed');
    const labelA = await ev(`document.querySelector('.life-label').textContent.replace(/\\s+/g,' ')`);
    console.log('  状态栏：' + labelA);
    ok(await ev(`!!document.querySelector('[data-a="ad-life"]')`), '顶部「续命+10」按钮已出现（旧版要 ≤15 年才出现）');
    await shot('360x640-life-ready.png');
    ok(await click('[data-a="ad-life"]'), '点「续命+10」'); await sleep(1000);
    const afterA = await readSave();
    ok(afterA && Math.abs(afterA.life.left / YEAR - 70) < 0.2, '寿元 60 → 70 年', (afterA.life.left / YEAR).toFixed(1) + ' 年');

    console.log('\n=== B. 寿元耗尽：先给一次救援，不清档 ===');
    const sB = JSON.parse(JSON.stringify(afterA)); sB.life.left = 1; sB.life.rescued = false; delete sB.combat;
    await inject(sB);
    await boot('noseed');
    ok(await click('[data-a="quick-rest"]'), '触发耗时动作（调息）'); await sleep(1400);
    const kindB = await modalKind();
    ok(kindB === 'life-rescue', '弹出「还有一线生机」救援弹窗', String(kindB));
    const stillThere = await readSave();
    ok(stillThere !== null, '此时存档没有被清除（旧版这里已经清档）');
    ok(stillThere && stillThere.life.left === 1, '磁盘上的存档停在死前那一刻（没有被写成 death）', 'life.left=' + (stillThere && stillThere.life.left) + ' 分钟');
    await shot('360x640-life-rescue.png');

    console.log('\n=== C. 看广告续命 15 年 ===');
    ok(await click('[data-a="ad-life-rescue"]'), '点「看广告续命」'); await sleep(1400);
    const afterC = await readSave();
    ok(afterC !== null, '救援后存档仍在');
    ok(afterC && afterC.ended === false, '本世继续（ended=false）');
    ok(afterC && Math.abs(afterC.life.left / YEAR - 15) < 0.1, '寿元回到 15 年', (afterC.life.left / YEAR).toFixed(1) + ' 年');
    ok(afterC && afterC.hp > 0, '气血被救回到安全值', afterC.hp + '/' + afterC.maxHp);
    ok(afterC && afterC.life.rescued === true, '本世救援机会已标记用掉');
    ok((await modalKind()) === null, '救援弹窗已关闭', String(await modalKind()));
    await shot('360x640-life-after-rescue.png');

    console.log('\n=== D. 救援用过后再耗尽：才真正结算清档 ===');
    const sD = JSON.parse(JSON.stringify(afterC)); sD.life.left = 1;
    await inject(sD);
    await boot('noseed');
    ok(await click('[data-a="quick-rest"]'), '再次触发耗时动作'); await sleep(1600);
    const kindD = await modalKind();
    ok(kindD === 'permadeath', '这次直接进入 permadeath 结算', String(kindD));
    const gone = await readSave();
    ok(gone === null, '主档键已被删除（结算完成）');
    await shot('360x640-permadeath.png');

    console.log('\n=== E. 运行期异常 ===');
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
