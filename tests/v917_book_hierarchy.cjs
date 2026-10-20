'use strict';
/*
 * V90.17 图鉴父子页回归测试
 *
 * 背景：图鉴原默认页是 12 行 × 42px 的折叠组（.book-list 恒为 582px，与屏宽无关），
 * 320 下 1.96 屏、360 下 1.64 屏，宽度压缩结构性无效。
 * V90.17 改为「品类入口 → 条目 → 详情」，本测试锁定该结构：
 *   1. 默认页是 12 个品类入口，且不再有折叠组
 *   2. 进品类 → 标题带品类名、条目平铺、可返回
 *   3. 进详情 → 可返回品类页
 *   4. 搜索仍可用
 *   5. 图鉴成就入口仍在（可领取按钮）
 *   6. 三种宽度入口页 ≤1.02 屏
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v917';
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
  const port = 9881;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v917b-'));
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
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const title = () => ev(`(document.querySelector('.panel-head strong')||{}).textContent||''`);
    const ratio = () => ev(`(function(){var b=document.getElementById('panel-body');if(!b||!b.clientHeight)return null;return +(b.scrollHeight/b.clientHeight).toFixed(2);})()`);

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
    await sleep(700);

    console.log('=== 1. 图鉴默认页 = 品类入口 ===');
    ok(await click('[data-a="panel"][data-name="book"]'), '图鉴可打开');
    await sleep(650);
    ok(await title() === '图鉴', '标题为「图鉴」', await title());
    const cells = await ev(`[...document.querySelectorAll('#panel-body .book-cat-cell')].map(b=>({cat:b.dataset.cat,txt:b.innerText.replace(/\\s+/g,' ').trim()}))`);
    ok(cells.length === 11, '品类入口 11 个（build 实测 11 类）', '实际 ' + cells.length);
    ok(cells.every((c) => c.cat && c.txt), '每个入口都有品类与已识数', cells[0] && cells[0].txt);
    ok(!(await ev(`!!document.querySelector('#panel-body details.book-group')`)), '不再有折叠组');
    ok(await ev(`!!document.querySelector('#panel-body [data-a="claim-book"]')`), '图鉴成就入口仍在');

    console.log('\n=== 2. 品类页 ===');
    ok(await click('#panel-body .book-cat-cell[data-cat="enemy"]'), '进入「妖兽」品类');
    await sleep(650);
    ok(await title() === '图鉴 · 妖兽', '标题带品类名', await title());
    ok(await ev(`!!document.querySelector('#panel-body .book-list-head')`), '有品类小标题行');
    const entries = await ev(`document.querySelectorAll('#panel-body .book-entry-link').length`);
    ok(entries === 40, '妖兽条目 40 条', '实际 ' + entries);
    ok(await ev(`!!document.querySelector('[data-a="book-home"]')`), '有「← 返回图鉴」');

    console.log('\n=== 3. 详情页 ===');
    ok(await click('#panel-body .book-entry-link'), '进入首条详情');
    await sleep(650);
    ok(await title() === '图鉴 · 详情', '标题为「图鉴 · 详情」', await title());
    ok(await ev(`!!document.querySelector('#panel-body .book-detail-card')`), '详情卡片渲染');
    ok(await click('[data-a="close-panel"]'), '详情页可返回');
    await sleep(600);
    ok(await title() === '图鉴 · 妖兽', '返回到品类页', await title());

    console.log('\n=== 4. 返回图鉴入口 ===');
    ok(await click('[data-a="book-home"]'), '点「← 返回图鉴」');
    await sleep(600);
    ok(await title() === '图鉴', '回到品类入口页', await title());
    ok(await ev(`document.querySelectorAll('#panel-body .book-cat-cell').length===11`), '入口页品类齐全');

    console.log('\n=== 5. 搜索仍可用 ===');
    /* 未发现条目的名称是隐藏的（显示「未发现」），所以按名字搜只能命中已识别条目；
       提示文字里带的是境域名，按「青岚」搜可稳定命中。 */
    await ev(`(function(){var i=document.getElementById('book-search');i.value='青岚';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(600);
    const searched = await ev(`(function(){var b=document.getElementById('panel-body');return {entries:document.querySelectorAll('#panel-body .book-entry-link').length,text:b.innerText.slice(0,40)};})()`);
    ok(searched.entries > 0, '搜索「青岚」有结果', searched.entries + ' 条');
    await ev(`(function(){var i=document.getElementById('book-search');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(600);
    ok(await ev(`!!document.querySelector('#panel-body .book-cat-cell')`), '清空搜索回到入口页');

    console.log('\n=== 6. 三种宽度入口页一屏 ===');
    for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(500);
      const r = await ratio();
      ok(r !== null && r <= 1.02, `${w}x${h} 图鉴入口一屏`, '屏数 ' + r);
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    console.log('\n=== 7. 运行期异常 ===');
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
