'use strict';
/* V90.15 全面板 × 三种宽度 屏数矩阵
 *
 * V90.17 修订（结构变化后同步测试）：
 *  1. 修炼已改为洞府的子页（入口在洞府内），矩阵必须先开洞府再点修炼。
 *  2. 每项测量前用「关闭面板」彻底复位；原实现用 panel-back，遇到没有返回键的
 *     父页（洞府/设置）会残留，导致最后一段「行记空态」点到的是已关闭的页面，
 *     把「空态文案已生效」误报成「空」。
 *  3. 行记改为断言：logs 为空必须出现占位文案，非空必须有条目。
 *  4. 图鉴已改为「品类入口 → 条目 → 详情」，矩阵默认量的是品类入口页。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v916';
const EDGE = require('./lib/browser').BROWSER;   // Edge / Chrome / Chromium / playwright 自带，CI 里也能跑
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WIDTHS = [[320, 568], [360, 640], [390, 844]];
const PANELS = [['camp', '洞府'], ['craft', '炼制'], ['pack', '背包'], ['character', '人物'],
  ['book', '图鉴'], ['cultivate', '修炼'], ['quest', '主线'], ['settings', '设置']];

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
  const port = 9860;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v915-'));
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
    // 彻底复位：连续点关闭键，直到没有任何面板（详情页的 × 是返回上一层，多次点击可穿透）
    const closeAll = async () => {
      for (let i = 0; i < 5; i++) {
        const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`);
        if (!had) break;
        await sleep(150);
      }
      await sleep(80);
    };
    const ratio = () => ev(`(function(){var b=document.getElementById('panel-body');if(!b||!b.clientHeight)return null;
      return +(b.scrollHeight/b.clientHeight).toFixed(2);})()`);

    await send('Runtime.enable'); await send('Page.enable');
    let bad = 0, total = 0;
    for (const [w, h] of WIDTHS) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(250); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(600);
      const line = [];
      for (const [name, label] of PANELS) {
        await closeAll();
        let opened;
        if (name === 'cultivate') {
          opened = await click('[data-a="panel"][data-name="camp"]');
          if (opened) await sleep(450);
          opened = await click('[data-a="panel"][data-name="cultivate"]');
        } else {
          opened = await click(`[data-a="panel"][data-name="${name}"]`);
        }
        if (!opened) { line.push(label + ':—'); continue; }
        await sleep(560);
        const r = await ratio();
        total++;
        /* 分级判定（交接文档 3.4）：320×568 归"允许滚动"档，只用 ~ 标注不判红；
           360×640 以上必须收敛到 1.02 屏内，超出才算失败。 */
        const over = r !== null && r > 1.02;
        const strict = w >= 360;
        const flag = over ? (strict ? '!' : '~') : ' ';
        if (over && strict) bad++;
        line.push(label + ':' + r + flag);
      }
      console.log(`  ${String(w).padStart(3)}x${h}  ` + line.join('  '));
    }
    console.log(`\n  超出 1.02 屏的项（360 以上才判红；~ = 320 允许滚动）: ${bad} / ${total}`);

    /* 行记空态：必须真的进入「行记」，并断言占位文案 */
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await closeAll();
    const logPath = [];
    logPath.push(await click('[data-a="panel"][data-name="settings"]')); await sleep(600);
    logPath.push(await click('[data-a="panel-step"][data-name="set-help"]')); await sleep(600);
    logPath.push(await click('[data-a="panel"][data-name="log"]')); await sleep(700);
    const logInfo = await ev(`(function(){var b=document.getElementById('panel-body');var t=b?b.innerText.replace(/\\s+/g,' ').trim():'';
      return {title:(document.querySelector('.panel-head strong')||{}).textContent||'',text:t,entries:document.querySelectorAll('#panel-body .history').length};})()`);
    const logOk = logInfo.title === '行记' && logInfo.text.length > 0
      && (logInfo.entries > 0 || /暂无记录/.test(logInfo.text));
    console.log('  行记: ' + (logOk ? 'PASS' : 'FAIL') + '  [' + logInfo.title + '] ' +
      (logInfo.entries ? logInfo.entries + ' 条记录' : '空态文案') + ' 「' + logInfo.text.slice(0, 40) + '」');
    if (!logOk) bad++;
    process.exitCode = bad === 0 ? 0 : 1;
  } catch (e) { console.error('FAIL: ' + e.message); process.exitCode = 1; }
  finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
