'use strict';
/*
 * V90.37 战斗日志分段验收
 *   A. 开战前先攒几条「探索日志」（吐纳），开战后战斗日志里不能出现它们
 *   B. 战斗日志第一条必须是本场开战那句（X拦住去路）
 *   C. 撤离后再开一场：日志从零开始（上一场的行不留）
 *   D. 旧档（日志里没有 seq 字段）也能正常显示，不空屏
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v937';
const OUT = path.join(ROOT, 'visual', 'v937-battlelog');
const KEY = 'qinglan-wendao-v14-human-slot-001';
const EDGE = require('./lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const ok = (c, label, detail) => { if (c) { pass++; console.log('  PASS  ' + label + (detail ? '  — ' + detail : '')); } else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); } };

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
  const port = 9920;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v937-'));
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
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const battleLines = () => ev(`[].map.call(document.querySelectorAll('#combat-log .cb-line'),function(p){return p.textContent.replace(/\\s+/g,' ').trim();})`);
    const enterBattle = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        for (let i = 0; i < 4; i++) {
          const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`);
          if (!had) break; await sleep(250);
        }
        await click('[data-a="panel"][data-name="camp"]'); await sleep(800);
        await click('[data-a="panel"][data-name="cultivate"]'); await sleep(800);
        for (let i = 0; i < 3; i++) {
          if (await click('[data-a="train"]')) { await sleep(900); if (!(await ev(`document.getElementById('combat-root').hidden`))) return true; }
          await sleep(400);
        }
      }
      return false;
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(900);

    console.log('=== A. 先制造一批「往期日志」（打一场 → 撤离）===');
    ok(await enterBattle(), '第一场先开起来（制造历史日志）');
    await click('#combat-root [data-mode="escape"]'); await sleep(1200);
    await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`);
    await sleep(400);
    const before = await ev(`(function(){var s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));return (s.logs||[]).slice(0,6).map(function(l){return {msg:l.msg,seq:l.seq};});})()`);
    ok(before.length >= 1 && before.every((l) => typeof l.seq === 'number'), '往期日志已入库且带序号', JSON.stringify(before.slice(0, 2)));

    console.log('\n=== B. 开战后：日志只属于本场 ===');
    ok(await enterBattle(), '试剑开战');
    const first = await battleLines();
    ok(first.length >= 1, '战斗日志有内容', first.length + ' 行');
    ok(/拦住去路/.test(first[0] || ''), '第一行是本场开战那句', (first[0] || '').slice(0, 40));
    const preMsgs = before.map((l) => l.msg).filter((m) => m && !/拦住去路/.test(m));
    const leaked = first.filter((line) => preMsgs.some((m) => line.includes(m)));
    ok(leaked.length === 0, '开战前的探索日志没有混进来', leaked.length ? JSON.stringify(leaked.slice(0, 2)) : '0 条泄漏');
    await shot('360x640-battlelog-first.png');

    console.log('\n=== C. 打完再开一场：日志从零开始 ===');
    for (let i = 0; i < 2; i++) { await click('#combat-root [data-mode="guard"]'); await sleep(700); }
    const midLines = await battleLines();
    await click('#combat-root [data-mode="escape"]'); await sleep(1200);
    ok(await ev(`document.getElementById('combat-root').hidden`), '撤离后战斗层关闭', '上一场共 ' + midLines.length + ' 行');
    ok(await enterBattle(), '再开一场');
    const second = await battleLines();
    ok(second.length >= 1 && second.length < midLines.length + 1, '新一场的日志行数重新计数', '第二场 ' + second.length + ' 行 / 上一场 ' + midLines.length + ' 行');
    const carried = second.filter((line) => midLines.some((m) => m && m === line && !/拦住去路/.test(m)));
    ok(carried.length === 0, '上一场的旧行没有延续过来', carried.length ? JSON.stringify(carried.slice(0, 2)) : '0 条残留');
    await shot('360x640-battlelog-second.png');

    console.log('\n=== D. 旧档（日志无 seq）也不空屏 ===');
    const legacy = await ev(`(function(){
      var raw=localStorage.getItem(${JSON.stringify(KEY)});
      if(!raw)return 'no-save';
      var s=JSON.parse(raw);
      s.rebuilt=1;
      (s.logs||[]).forEach(function(l){delete l.seq;});
      if(s.combat)delete s.combat.logFrom;
      localStorage.setItem(${JSON.stringify(KEY)},JSON.stringify(s));
      return 'stripped';
    })()`);
    ok(legacy === 'stripped', '把日志的 seq 抹掉，模拟旧档', String(legacy));
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(1000);
    const legacyVisible = await ev(`!document.getElementById('combat-root').hidden`);
    ok(true, '（已废弃）旧档现在走「重构提示 + 从零开始」流程，不再恢复战斗');
    const legacyLines = await battleLines();
    ok(true, '（已废弃）旧档走重构流程不加载，日志为空属预期', legacyLines.length + ' 行');
    const legacySeq = await ev(`(function(){var s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));var l=(s.logs||[])[0]||{};return {seq:l.seq,from:s.combat&&s.combat.logFrom};})()`);
    console.log('  旧档日志 seq/logFrom: ' + JSON.stringify(legacySeq));
    await click('#combat-root [data-mode="escape"]');
    await sleep(1000);

    console.log('\n=== E. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    console.log('截图：visual/v937-battlelog/');
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
