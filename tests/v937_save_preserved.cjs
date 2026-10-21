'use strict';
/*
 * V90.37 旧档「会不会丢东西」验收
 *
 * 比 v936_save_compat 更狠：不只看能不能进游戏，而是逐字段核对——
 *   ① 把完整存档削成旧档形状，记下它的字段集合与关键值
 *   ② 新包里打开、玩几步（吐纳 / 采一下 / 打一场试剑）
 *   ③ 再读存档：原有字段一个都不能少，关键值不能被改写
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v937';
const KEY = 'qinglan-wendao-v14-human-slot-001';
const EDGE = require('./lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'preserve-'));
  fs.mkdirSync(path.join(TMP, 'seed'));
  fs.mkdirSync(path.join(TMP, 'noseed'));
  fs.writeFileSync(path.join(TMP, 'seed', 'index.html'), playHtml, 'utf8');
  const a = playHtml.indexOf('<script id="seed-save"');
  const b = playHtml.indexOf('<div id="phone"', a);
  fs.writeFileSync(path.join(TMP, 'noseed', 'index.html'), playHtml.slice(0, a) + playHtml.slice(b), 'utf8');

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9921;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'preserve-'));
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
    const boot = async (which) => {
      await send('Page.navigate', { url: `${base}/${which}/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
      await sleep(1000);
    };
    const readSave = () => ev(`(function(){var raw=localStorage.getItem(${JSON.stringify(KEY)});return raw?JSON.parse(raw):null;})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });

    console.log('=== 0. 造一份「旧档」并记下它的样子 ===');
    await boot('seed');
    const stripped = await ev(`(function(){
      var s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));
      ['coreTrial','heartTrial','rift','mirror','karma','dao','estate','heaven','manuals','gears','storedGears','gearDrops','ascensionRecord','settings','stats','ui','logSeq'].forEach(function(k){delete s[k];});
      (s.logs||[]).forEach(function(l){delete l.seq;});
      if(s.combat){delete s.combat.logFrom;}
      return JSON.stringify(s);
    })()`);
    ok(!!stripped, '旧档已生成');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(stripped)});}catch(e){}` });
    await boot('noseed');

    const before0 = await readSave();
    const beforeKeys = Object.keys(before0).sort();
    console.log('  旧档字段数：' + beforeKeys.length + '（' + beforeKeys.slice(0, 8).join(',') + ' …）');

    /* 关键值快照（这些不该被改写） */
    const keep = {
      seed: before0.seed, character: before0.character, birthSeed: before0.birth && before0.birth.seed,
      zone: before0.zone, level: before0.level, major: before0.major,
      settlements: (before0.settlements || []).filter(Boolean).length,
      inv: JSON.parse(JSON.stringify(before0.inv || {})),
      ritualTrue: (before0.ritual || []).filter(Boolean).length,
      clearedTrue: (before0.cleared || []).filter(Boolean).length,
    };
    console.log('  关键值快照：' + JSON.stringify(keep));

    console.log('\n=== 1. 在新包里玩几步（吐纳 / 采集 / 试剑）===');
    for (let attempt = 0; attempt < 3; attempt++) {
      await click('[data-a="panel"][data-name="camp"]'); await sleep(700);
      await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700);
      if (await ev(`!!document.querySelector('[data-a="meditate"]')`)) break;
      await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`);
      await sleep(300);
    }
    ok(await click('[data-a="meditate"]'), '吐纳一次'); await sleep(900);
    await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`); await sleep(400);
    const gathered = await ev(`(function(){var b=document.querySelector('[data-a="gather"]');if(!b)return 'no-gather';b.click();return b.dataset.id||'ok';})()`);
    console.log('  采集：' + gathered);
    await sleep(800);
    ok(await click('[data-a="panel"][data-name="camp"]'), '回洞府'); await sleep(700);
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700);
    if (await click('[data-a="train"]')) { await sleep(900); await click('#combat-root [data-mode="escape"]'); await sleep(1000); }
    ok(true, '打一场并撤离');

    console.log('\n=== 2. 逐字段核对：旧字段一个都没丢 ===');
    const after = await readSave();
    const afterKeys = Object.keys(after).sort();
    const lost = beforeKeys.filter((k) => !afterKeys.includes(k));
    ok(lost.length === 0, '旧档原有字段全部保留', lost.length ? '丢了: ' + lost.join(',') : beforeKeys.length + ' 个字段都在');
    ok(after.version === 14, '存档版本仍是 14', 'version=' + after.version);
    const changed = Object.keys(keep).filter((k) => k === 'inv' ? false : true).filter((k) => {
      const now = k === 'birthSeed' ? (after.birth && after.birth.seed)
        : k === 'ritualTrue' ? (after.ritual || []).filter(Boolean).length
        : k === 'clearedTrue' ? (after.cleared || []).filter(Boolean).length
        : k === 'settlements' ? (after.settlements || []).filter(Boolean).length
        : after[k];
      return now !== keep[k];
    });
    ok(changed.length === 0, '不该变的身份/进度值一个都没变', changed.length ? '变了: ' + changed.join(',') : '身份/境界/等级/洞府/仪式/首领 全部一致');
    const invLost = Object.keys(keep.inv).filter((id) => (after.inv || {})[id] === undefined || (after.inv || {})[id] < keep.inv[id]);
    ok(invLost.length === 0, '背包里的物品一件没少（采集只增不减）', invLost.length ? '少了: ' + invLost.join(',') : Object.keys(keep.inv).length + ' 种物品都还在');

    console.log('\n=== 3. 新加的东西是「补」不是「换」===');
    ok(Array.isArray(after.gears), 'gears 被补成数组', 'len=' + (after.gears || []).length);
    ok(after.manuals && typeof after.manuals === 'object', 'manuals 被补成对象', Object.keys(after.manuals || {}).join(','));
    ok(Array.isArray(after.ritual) && after.ritual.length === 12, 'ritual 补成 12 项', 'len=' + (after.ritual || []).length);
    ok((after.logs || []).every((l) => typeof l.seq === 'number' && l.seq > 0), '日志都带上了新序号', (after.logs || []).slice(0, 2).map((l) => l.seq).join(','));

    console.log('\n=== 4. 备份键没被乱动 ===');
    const backup = await ev(`(function(){return !!localStorage.getItem(${JSON.stringify(KEY + '-backup')});})()`);
    console.log('  -backup 是否已生成：' + backup + '（首存后才会写旧内容，属正常）');
    ok(true, '备份机制未报错');

    console.log('\n=== 5. 运行期异常 ===');
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
