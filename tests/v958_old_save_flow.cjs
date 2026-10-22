'use strict';
/* V90.58 验收②：旧档流程补齐
   A 弹窗有「导出旧档 JSON」按钮，点击能真的生成文件
   B 「从零开始」发放补偿
   C 同一档再次触发重置时，补偿不再叠加（一次性保护）
   D 「暂时不玩」不删档
*/
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = require('./lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = path.join(ROOT, 'visual', 'v958-oldsave');
fs.mkdirSync(OUT, { recursive: true });
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'v958dl-'));

let pass = 0, fail = 0;
const ok = (c, l, d) => { if (c) { pass++; console.log('  PASS  ' + l + (d ? '  — ' + d : '')); } else { fail++; console.log('  FAIL  ' + l + (d ? '  — ' + d : '')); } };

function oldSave(over) {
  return Object.assign({
    version: 14, race: 'human', character: 'human', seed: 20261019,
    birth: { race: 'human', seed: 20261019, root: 'mixed', element: 'fire', grade: 2, name: '旧档测试' },
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
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'v958-'));
  const html = fs.readFileSync(path.join(ROOT, 'play', 'jindan-v958', 'index.html'), 'utf8');
  const a = html.indexOf('<script id="seed-save"');
  const b = html.indexOf('<div id="phone"', a);
  fs.mkdirSync(path.join(TMP, 'plain'));
  fs.writeFileSync(path.join(TMP, 'plain', 'index.html'), html.slice(0, a) + html.slice(b), 'utf8');

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9812;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v958p-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run',
    '--disable-extensions', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
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
    const boot = async () => {
      await send('Page.navigate', { url: `${base}/plain/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
      await sleep(900);
    };
    const findKey = `(function(){for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('qinglan-wendao')===0&&/-slot-\\d+$/.test(k))return k;}return null;})()`;
    const probe = (key) => ev(`(function(){var k=${JSON.stringify('__K__')};if(!k)return null;var o=JSON.parse(localStorage.getItem(k));if(!o)return null;var led=localStorage.getItem(k+'-legacy-v1');var done=localStorage.getItem(k+'-rebuild-compensated');return {v:o.version,r:o.rebuilt,led:led?JSON.parse(led).balance:null,done:!!done};})()`.replace('"__K__"', JSON.stringify(key)));
    const openSlot = async () => {
      if (await ev(`!!document.querySelector('[data-a="view-slots"]')`)) { await click('[data-a="view-slots"]'); await sleep(500); }
      if (!(await ev(`!!document.querySelector('[data-a="slot-open"]')`))) { await click('[data-a="slot-page"]'); await sleep(400); }
      if (!(await click('[data-a="slot-open"][data-n="1"]'))) await click('[data-a="slot-open"]');
      await sleep(700);
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL }).catch(() => {});

    /* 注入旧档 */
    const inject = async () => {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('qinglan-wendao-v14-human-slot-001', ${JSON.stringify(JSON.stringify(oldSave({ major: 6 })))});localStorage.removeItem('qinglan-wendao-v14-human-slot-001-rebuild-compensated');localStorage.removeItem('qinglan-wendao-v14-human-slot-001-legacy-v1');}catch(e){}` });
    };

    await inject(); await boot(); await openSlot();
    const KEY = await ev(findKey);
    ok(!!KEY, '识别到存档键', String(KEY));
    ok(await ev(`!!document.querySelector('[data-a="reset-export"]')`), '弹窗出现「导出旧档 JSON」按钮');
    ok(await ev(`!!document.querySelector('[data-a="reset-confirm"]')`), '弹窗出现「从零开始」按钮');

    /* A 导出 */
    await click('[data-a="reset-export"]'); await sleep(1200);
    const files = fs.readdirSync(DL).filter((f) => f.endsWith('.json'));
    ok(files.length >= 1, '导出确实生成了文件', files.join(',') || '(空目录)');
    if (files.length) {
      const j = JSON.parse(fs.readFileSync(path.join(DL, files[0]), 'utf8'));
      ok(j.format === 'QinglanWendaoLegacy' && j.raw && j.raw.major === 6, '导出内容含原始状态', 'major=' + (j.raw && j.raw.major));
    } else ok(false, '导出内容含原始状态', '无文件');

    /* D 暂时不玩不删 */
    await click('[data-a="modal-close"]'); await sleep(400);
    const kept = await probe(KEY);
    ok(kept && !kept.r, '「暂时不玩」不删档不改写', JSON.stringify(kept));

    /* B 从零开始 → 补偿 */
    await boot(); await openSlot();
    ok(await click('[data-a="reset-confirm"]'), '点「从零开始」');
    await sleep(1300);
    const after1 = await probe(KEY);
    ok(after1 && after1.r === 1, '重置后写新格式档', JSON.stringify(after1));
    ok(after1 && after1.led === 600, '首次补偿 600 到账', 'balance=' + (after1 && after1.led));
    ok(after1 && after1.done === true, '写入一次性补偿标记');

    /* C 再来一次旧档 → 不再叠加 */
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('qinglan-wendao-v14-human-slot-001', ${JSON.stringify(JSON.stringify(oldSave({ major: 6 })))});}catch(e){}` });
    await boot(); await openSlot();
    const again = await ev(`!!document.querySelector('[data-a="reset-confirm"]')`);
    ok(again, '旧档再次出现重构弹窗');
    await click('[data-a="reset-confirm"]'); await sleep(1300);
    const after2 = await probe(KEY);
    ok(after2 && after2.led === 600, '二次重置不再叠加补偿（仍 600）', 'balance=' + (after2 && after2.led));

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
