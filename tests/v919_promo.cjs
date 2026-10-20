'use strict';
/*
 * V90.19 一次性「评价 + 加群」入口验收
 *
 *  1. 入世后场景卡标题行出现「★ 评价」标点（三宽度都在屏内、且不压内容）
 *  2. 面板/弹窗打开时标点让位（因为它在场景卡里，面板覆盖上层）
 *  3. 点一次 → 弹窗：文字评价引导 + QQ 群号 854720768 + 复制群号
 *  4. 关闭后消失；刷新后不再出现（一次性标记 shanye-promo-v1）
 *  5. 无运行期异常
 * 截图：visual/v919/*.png
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v919';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'visual', 'v919');
const GROUP = '854720768';
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
  const port = 9883;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v919p-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions',
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
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const pin = () => ev(`!!document.querySelector('#promo-slot .promo-chip')`);
    const boot = async (w, h) => {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
      for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!document.querySelector('[data-a="view-slots"]')`).catch(() => false)) break; }
      await sleep(800);
    };

    await send('Runtime.enable'); await send('Page.enable');

    console.log('=== 1. 三宽度：标点出现、在屏内、不越界 ===');
    for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
      await boot(w, h);
      const has = await pin();
      ok(has, `${w}x${h} 入世后出现「★ 评价」标点`);
      if (has) {
        const box = await ev(`(function(){
          var b=document.querySelector('#promo-slot .promo-chip').getBoundingClientRect();
          var head=document.querySelector('.location-head').getBoundingClientRect();
          var risk=document.querySelector('.location-head .risk').getBoundingClientRect();
          return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),
                  headR:Math.round(head.right),riskX:Math.round(risk.x),vw:innerWidth,vh:innerHeight};})()`);
        ok(box.x >= 0 && box.x + box.w <= box.vw && box.y >= 0 && box.y + box.h <= box.vh,
          `${w}x${h} 标点在屏内`, JSON.stringify(box));
        ok(box.x + box.w <= box.riskX + 1, `${w}x${h} 未压住危险度徽章`, `chip 右缘 ${box.x + box.w} ≤ 徽章左缘 ${box.riskX}`);
        await shot(`chip-${w}x${h}.png`);
      }
    }

    console.log('\n=== 2. 面板打开时标点让位 ===');
    await boot(390, 844);
    ok(await pin(), '开局有标点');
    ok(await click('[data-a="panel"][data-name="book"]'), '打开图鉴'); await sleep(700);
    ok(!(await pin()), '面板打开后标点清空');
    await click('[data-a="close-panel"]'); await sleep(700);
    ok(await pin(), '关闭面板后标点恢复');

    console.log('\n=== 3. 点一次 → 弹窗 ===');
    ok(await click('#promo-slot .promo-chip'), '点「★ 评价」'); await sleep(700);
    const modal = await ev(`(function(){var m=document.querySelector('.modal');return {title:(m&&m.querySelector('h2')||{}).textContent||'',text:(m?m.innerText:'').replace(/\\s+/g,' '),hasCopy:!!document.querySelector('[data-a="promo-copy"]'),hasClose:!!document.querySelector('[data-a="promo-close"]')};})()`);
    ok(/给个评价/.test(modal.title), '弹窗标题是评价引导', modal.title);
    ok(modal.text.includes(GROUP), '弹窗展示 QQ 群号', GROUP);
    ok(/TapTap/.test(modal.text) && /评价/.test(modal.text), '弹窗有文字评价引导');
    ok(!/https?:/i.test(modal.text), '不出现外链（按你的选择：纯文字引导）');
    ok(modal.hasCopy && modal.hasClose, '有「复制群号」与「知道了」');
    await shot('modal-390x844.png');

    console.log('\n=== 4. 一次性：关闭后不再出现，刷新也不回来 ===');
    ok(await click('[data-a="promo-close"]'), '点「知道了」'); await sleep(700);
    ok(!(await pin()), '关闭后标点消失');
    ok(await ev(`localStorage.getItem('shanye-promo-v1')==='1'`), '已写入一次性标记');
    await boot(390, 844);
    ok(!(await pin()), '刷新后不再出现');
    ok(await ev(`(document.getElementById('promo-slot')||{}).innerHTML===''`), '插槽内容为空，无残留');
    await shot('after-close-390x844.png');

    console.log('\n=== 5. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    console.log('截图：visual/v919/');
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
