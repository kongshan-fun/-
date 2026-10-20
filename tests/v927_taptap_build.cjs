'use strict';
/*
 * TapTap 适配包自测（容器外的本地复现）
 *
 * 检查点的目的：**在扫码之前**就确认候选包本身没坏。
 *   1. QTAP 适配层已注入并识别为 MOCK（本地没有真实 tap 对象）
 *   2. 构建码已烙进包体，且与 build-manifest.json 一致
 *   3. 四个广告入口都在（birth-ad / birth-jade-ad / ad-life / ad-life-confirm）
 *   4. 玩法没有被适配层改回去：首领器材掉落、广告奖励可重复领取、金额 100
 *   5. 云端存档/排行榜/成就 UI 文案已替换
 *   6. 冷启动无未捕获异常
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
/* 自动挑「与 index.html 标题版本同号」的 TapTap 构建目录，升版本不用改本测试 */
function detectBuild() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const version = (html.match(/<title>[^<]*?(V\d+\.\d+)/) || [])[1];
  const root = path.join(ROOT, 'taptap-build');
  if (!fs.existsSync(root)) return path.join(root, 'missing');
  const dirs = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'build-manifest.json')));
  const hit = dirs.find((d) => {
    try { return JSON.parse(fs.readFileSync(path.join(root, d, 'build-manifest.json'), 'utf8')).version === version; }
    catch { return false; }
  });
  if (hit) return path.join(root, hit);
  return dirs.length ? path.join(root, dirs.sort().pop()) : path.join(root, 'missing');
}
const BUILD = process.argv[2] ? path.join(ROOT, 'taptap-build', process.argv[2]) : detectBuild();
const EDGE = require('./lib/browser').BROWSER;   // Edge / Chrome / Chromium / playwright 自带，CI 里也能跑
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const manifest = JSON.parse(fs.readFileSync(path.join(BUILD, 'build-manifest.json'), 'utf8'));
  console.log(`包体：${manifest.version}  ${manifest.outputBytes.toLocaleString()} B  测试码 ${manifest.buildCode}\n`);

  /* ---- 静态层 ---- */
  const html = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');
  ok(html.includes(manifest.buildCode), '构建码与 manifest 一致', manifest.buildCode);
  ok(html.includes('"PENDING"') === false, '没有残留构建码占位');
  for (const a of ['birth-ad', 'birth-jade-ad', 'ad-life', 'ad-life-confirm']) {
    ok(html.includes(`data-a="${a}"`), `广告入口 ${a} 存在`);
  }
  for (const [needle, label] of [
    ['dropLoot(){', '首领器材掉落（V90.23）'],
    ['领取100轮回玉', '广告奖励单次 100（V90.29）'],
    ['可重复领取', '可重复领取文案（V90.29）'],
    ['grantLegacyJade(selectedRole,draftSlot,100)', '广告发放 100（V90.29）'],
    ['进度自动保存并同步到 TapTap 云端', '云存档文案'],
    ['QTAP', '适配层命名空间'],
  ]) ok(html.includes(needle), `${label} 仍在包体里`);

  /* ---- 运行层 ---- */
  const srv = await serve(BUILD);
  const port = 9892;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qtap927-'));
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
      if (m.method === 'Runtime.exceptionThrown') errors++;
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors++;
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&!!window.QTap`).catch(() => false)) break; }
    await sleep(900);

    const info = await ev(`(function(){
      var q=window.QTap||{};
      return {
        build: window.__SHANYE_BUILD_CODE||null,
        hasQTAP: !!window.QTap,
        isMock: typeof q.isMock==='function'?!!q.isMock():null,
        cloud: typeof q.cloud==='object',
        board: typeof q.leaderboard==='object',
        ach: typeof q.achievements==='object',
        tapType: typeof window.tap,
        ads: document.querySelectorAll('[data-a="birth-ad"],[data-a="birth-jade-ad"],[data-a="ad-life"],[data-a="ad-life-confirm"]').length,
        entry: !!document.querySelector('[data-a="choose-role"]'),
        title: document.title
      };
    })()`);
    ok(info.hasQTAP, 'QTAP 适配层已初始化');
    ok(info.isMock === true, '无真实 tap 时自动降级为 MOCK', `isMock=${info.isMock} tap=${info.tapType}`);
    ok(info.cloud && info.board && info.ach, '云存档/排行榜/成就三模块就绪');
    ok(info.build === manifest.buildCode, '运行时构建码与 manifest 一致', String(info.build));
    ok(info.entry, '首屏入世入口正常渲染', info.title);
    ok(errors === 0, '冷启动无未捕获异常', errors + ' 个');

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
