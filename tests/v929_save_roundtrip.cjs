'use strict';
/*
 * P1「全量回归」补齐：存档往返（关闭重开 / 旧档导入 / 导出 / 备份）
 *
 * 清单里点名了「关闭重开」和「旧档导入」，之前的 15 层里只有引擎级存储回归，
 * 没有浏览器层的完整往返。本测试补的就是这一段：
 *   1. 吐纳两次 → 存档 JSON 变化（新状态真的落盘）
 *   2. 刷新页面 → 存档 JSON 与刷新前逐字节一致（关闭重开不丢档）
 *   3. 旧档导入：删掉后加字段并打灵尘指纹 → 走真实文件选择框 → 确认 → 生效 + 旧进度进备份
 *   4. 再刷新 → 导入结果持久
 *   5. 导出存档 → 下载文件可解析、信封正确、state 与本地存档同源
 *
 * 顺序说明：**导入放在导出前面**。实测先做导出（触发一次下载）再走文件选择框会失败，
 * 反过来则稳定；两件事互不依赖，所以按稳定顺序来。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v928';
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
  const srv = await serve(path.join(ROOT, 'play', DIR));
  const port = 9898;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v929-'));
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'v929dl-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map(); let errors = 0; let chooser = null;
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Page.fileChooserOpened') chooser = m.params;
      if (m.method === 'Runtime.exceptionThrown') { errors++; console.log('  EXC: ' + (m.params.exceptionDetails.text || '')); }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors++;
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const SAVE_KEY = 'qinglan-wendao-v14-human-slot-001';
    const readSave = () => ev(`localStorage.getItem(${JSON.stringify(SAVE_KEY)})`);
    const boot = async () => {
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
      await sleep(900);
    };
    const closeAll = async () => { for (let i = 0; i < 5; i++) { const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`); if (!had) break; await sleep(180); } await sleep(120); };
    const openSave = async () => {
      await closeAll();
      await click('[data-a="panel"][data-name="settings"]'); await sleep(500);
      await click('[data-a="panel-step"][data-name="set-save"]'); await sleep(500);
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.setInterceptFileChooserDialog', { enabled: true });
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, eventsEnabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await boot();

    console.log('=== 1. 吐纳两次：新状态落盘 ===');
    const s0 = await readSave();
    ok(!!s0, '种子档已存在', s0 ? (s0.length + ' B') : '空');
    await closeAll();
    await click('[data-a="panel"][data-name="camp"]'); await sleep(400);
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(500);
    ok(await click('[data-a="meditate"]'), '点「吐纳」第 1 次'); await sleep(700);
    ok(await click('[data-a="meditate"]'), '点「吐纳」第 2 次'); await sleep(700);
    const s1 = await readSave();
    ok(!!s1 && s1 !== s0, '存档已更新（吐纳生效）', `${s0 ? s0.length : 0} → ${s1 ? s1.length : 0} B`);
    const j1 = JSON.parse(s1);
    ok((j1.meditation?.uses || 0) >= 1 || (j1.minutes || 0) > 0, '吐纳次数/时间已写入', `uses=${j1.meditation?.uses} minutes=${j1.minutes}`);

    console.log('\n=== 2. 刷新页面：关闭重开不丢档 ===');
    await boot();
    const s2 = await readSave();
    ok(s2 === s1, '刷新后存档与刷新前逐字节一致', s2 === s1 ? '一致' : '不一致');
    const j2 = JSON.parse(s2);
    ok(j2.level === j1.level && j2.zone === j1.zone, '等级/地图保持', `level=${j2.level} zone=${j2.zone}`);

    console.log('\n=== 3. 旧档导入（删掉后加字段 + 灵尘指纹 999）===');
    const legacy = { format: 'QinglanWendao', version: 'V14', character: 'human', exportedAt: new Date().toISOString(), state: JSON.parse(JSON.stringify(j2)) };
    legacy.state.inv = legacy.state.inv || {};
    legacy.state.inv.dust = 999;
    for (const k of ['coreTribulation', 'heartTrial', 'progGuide', 'sites', 'bossDaily', 'farmAt', 'gearDrops', 'promo']) {
      delete legacy.state[k];
      if (legacy.state.flags) delete legacy.state.flags[k];
    }
    const legacyPath = path.join(dl, 'legacy-import.json');
    fs.writeFileSync(legacyPath, JSON.stringify(legacy, null, 2), 'utf8');
    ok(true, '旧档 JSON 已生成', legacyPath.split(path.sep).pop());
    ok((legacy.state.inv.dust === 999) && !('progGuide' in legacy.state), '已删 8 类后加字段并写入指纹');

    await openSave();
    chooser = null;
    ok(await click('[data-a="import"]'), '点「导入存档」');
    for (let i = 0; i < 30; i++) { if (chooser) break; await sleep(200); }
    ok(!!chooser, '弹出系统文件选择框（fileChooserOpened）', chooser ? ('mode=' + chooser.mode) : '未拦截到');
    if (chooser) await send('DOM.setFileInputFiles', { backendNodeId: chooser.backendNodeId, files: [legacyPath] });
    let modalReady = false;
    for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('[data-a="confirm-import"]')`)) { modalReady = true; break; } await sleep(200); }
    ok(modalReady, '弹出「载入这份进度？」确认框');
    ok(await click('[data-a="confirm-import"]'), '确认载入'); await sleep(1400);
    const s3 = await readSave();
    const j3 = s3 ? JSON.parse(s3) : null;
    ok(!!j3 && j3.inv && j3.inv.dust === 999, '导入后灵尘 = 999（旧档生效）', j3 && j3.inv ? String(j3.inv.dust) : '无存档');
    ok(!!s3 && s3 !== s2, '当前存档已被替换', s3 === s2 ? '仍是旧档' : '已替换');
    const backupRaw = await ev(`localStorage.getItem(${JSON.stringify(SAVE_KEY + '-backup')})`);
    ok(!!backupRaw && backupRaw === s2, '导入前的进度已原样备份到 -backup 键', backupRaw ? (backupRaw.length + ' B') : '空');

    console.log('\n=== 4. 再刷新：导入结果持久 ===');
    await boot();
    const s4 = await readSave();
    const j4 = s4 ? JSON.parse(s4) : null;
    ok(!!j4 && j4.inv && j4.inv.dust === 999, '刷新后仍是导入的档', j4 && j4.inv ? ('dust=' + j4.inv.dust) : '无存档');

    console.log('\n=== 5. 导出存档 ===');
    await openSave();
    ok(await click('[data-a="export"]'), '点「导出存档」');
    let file = null;
    for (let i = 0; i < 40; i++) {
      const files = fs.readdirSync(dl).filter((f) => f.endsWith('.json') && f !== 'legacy-import.json');
      if (files.length) { file = path.join(dl, files[0]); break; }
      await sleep(250);
    }
    ok(!!file, '下载到存档 JSON', file ? path.basename(file) : '无文件');
    let env = null;
    if (file) { try { env = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('  parse: ' + e.message); } }
    ok(!!env, '导出的 JSON 可解析');
    ok(env && env.format === 'QinglanWendao', '信封 format 正确', env && env.format);
    ok(env && env.character === 'human', '信封带种族', env && env.character);
    ok(env && env.state && env.state.inv && env.state.inv.dust === 999, '导出 state 与本地存档同源（dust=999）', env && env.state && env.state.inv ? String(env.state.inv.dust) : '无');

    console.log('\n=== 6. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    process.exitCode = fail === 0 ? 0 : 1;
  } catch (e) {
    console.error('FAIL: ' + e.message); process.exitCode = 1;
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
