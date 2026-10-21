'use strict';
/* V90.43a 验收：旧档识别 → 重构弹窗 → 阶梯补轮回玉 → 从零开始 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = require('./lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(ROOT, 'visual', 'v943-reset');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (c, l, d) => { if (c) { pass++; console.log('  PASS  ' + l + (d ? '  — ' + d : '')); } else { fail++; console.log('  FAIL  ' + l + (d ? '  — ' + d : '')); } };

function oldSave(over) {
  return Object.assign({
    version: 14, race: 'human', character: 'human', seed: 20261019,
    birth: { race: 'human', seed: 20261019, root: 'mixed', element: 'fire', grade: 2, name: '重构测试' },
    minutes: 1000, level: 18, xp: 0, major: 2, daoXp: 30,
    hp: 100, maxHp: 190, spirit: 100, maxSpirit: 120, attack: 30,
    life: { left: 40 * 5760, losses: 0, elixirs: 0, adYearsClaimed: false, rescued: false },
    zone: 5, pos: { x: 2, y: 2 }, last: { x: 2, y: 2 },
    settlements: Array(12).fill(null), inv: { wood: 3 }, stash: {}, storageBags: {}, gears: [], pending: [], equipped: {},
    codex: { items: {}, enemies: {}, gears: {}, claims: {} }, flags: {}, buffs: {}, ascended: false,
    ritual: Array(12).fill(false), cleared: Array(12).fill(false),
    meditation: { day: 1, uses: 0 }, logs: [],
  }, over || {});
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

(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'v943a-'));
  const html = fs.readFileSync(path.join(ROOT, 'play', 'jindan-v943a', 'index.html'), 'utf8');
  const a = html.indexOf('<script id="seed-save"');
  const b = html.indexOf('<div id="phone"', a);
  fs.mkdirSync(path.join(TMP, 'seed'), { recursive: true });
  fs.mkdirSync(path.join(TMP, 'plain'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'seed', 'index.html'), html, 'utf8');
  fs.writeFileSync(path.join(TMP, 'plain', 'index.html'), html.slice(0, a) + html.slice(b), 'utf8');

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9951;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v943p-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws, errors = 0;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') { errors++; console.log('  EXC: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 140)); }
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout')), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { await sleep(250); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const boot = async (which) => {
      await send('Page.navigate', { url: `${base}/${which}/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
      await sleep(900);
    };
    const findKey = `(function(){for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('qinglan-wendao')===0&&/-slot-\\d+$/.test(k))return k;}return null;})()`;
    const probe = (key) => ev(`(function(){var k=${JSON.stringify(key)};if(!k){return null;}var o=JSON.parse(localStorage.getItem(k));if(!o)return null;var led=localStorage.getItem(k.replace(/-slot-(\\d+)$/,'-legacy-$1'));return {v:o.version,r:o.rebuilt,led:led?JSON.parse(led).balance:null};})()`);
    const openSlot = async () => {
      await click('[data-a="slot"][data-n="1"]'); await sleep(500);
      if (!(await ev(`!!document.querySelector('[data-a="reset-confirm"]')`))) { await click('[data-a="slot"][data-slot="1"]'); await sleep(500); }
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });

    /* A. 新档带 rebuilt:1，不弹重置窗 */
    await boot('seed');
    const KEY = await ev(findKey);
    ok(!!KEY, '找到存档键', String(KEY));
    const freshInfo = await probe(KEY);
    ok(freshInfo && freshInfo.v === 14 && freshInfo.r === 1, '新档 version 14 + rebuilt:1', JSON.stringify(freshInfo));
    await boot('seed');
    ok(!(await ev(`!!document.querySelector('[data-a="reset-confirm"]')`)), '新档不触发重置弹窗');

    /* B. 旧档 → 弹窗 */
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(oldSave({ major: 2 })))});localStorage.removeItem(${JSON.stringify(KEY)}+'-legacy');}catch(e){}` });
    await boot('plain'); await openSlot();
    const kind = await ev(`document.querySelector('[data-a="reset-confirm"]')?'rebuild-reset':'none'`);
    ok(kind === 'rebuild-reset', '打开旧档弹出重构提示', kind);
    const text = await ev(`(document.getElementById('modal-root')||{}).innerText||''`);
    ok(/旧存档无法沿用/.test(text), '标题正确');
    ok(/600 轮回玉/.test(text), '大境界≥6 档补偿 600', (text.match(/[0-9]+ 轮回玉/) || [''])[0]);
    await shot('360-reset-modal.png');

    /* C. 暂时不玩 → 不删不改写 */
    await click('[data-a="modal-close"]'); await sleep(400);
    const kept = await probe(KEY);
    ok(kept && !kept.r, '「暂时不玩」不删档、不改写', JSON.stringify(kept));

    /* D. 从零开始 → 新档 + 补偿 */
    await boot('plain'); await openSlot();
    ok(await click('[data-a="reset-confirm"]'), '点「从零开始」');
    await sleep(1200);
    const after = await probe(KEY);
    ok(after && after.r === 1, '重置后写入新格式档', JSON.stringify(after));
    ok(after && after.led === 600, '补偿 600 进轮回账本', 'balance=' + (after && after.led));
    await shot('360-after-reset.png');

    /* E. 三档补偿 */
    for (const [label, over, want] of [
      ['飞升档', { ascended: true, major: 9 }, 1000],
      ['高境档', { major: 6 }, 600],
      ['低境档', { major: 1, cleared: Array(12).fill(false) }, 300],
    ]) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(oldSave(over)))});}catch(e){}` });
      await boot('plain'); await openSlot();
      const txt = await ev(`(document.getElementById('modal-root')||{}).innerText||''`);
      ok(txt.includes(String(want) + ' 轮回玉'), label + ' 补偿 ' + want, (txt.match(/[0-9]+ 轮回玉/) || [''])[0]);
      await ev(`localStorage.removeItem(${JSON.stringify(KEY)})`);
    }

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
