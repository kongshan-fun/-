'use strict';
/*
 * 把 before/after 两两拼成一张左右对比图（改前 | 改后），带标题
 * 用法: node tools/make_copy_diff_sheets.cjs
 * 输出: visual/v940-copy/diff/XX-*-diff.png
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'visual', 'v940-copy');
const OUT = path.join(SRC, 'diff');
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const PAIRS = [
  ['01-help-lifespan.png', '① 教程 · 寿元（规则过期 + V10 存档术语）'],
  ['02-help-karma.png', '② 教程 · 玄阴因果（karmaWitness 变量名）'],
  ['03-help-dao.png', '③ 教程 · 大道残碑（flags.daoStele 变量名）'],
  ['05-help-heaven.png', '④ 教程 · 九霄终劫（三连否定）'],
  ['06-help-board.png', '⑤ 教程 · 资质榜（内部 roadmap）'],
  ['07-settings-bottom.png', '⑥ 设置页底部（版本变更公告）'],
  ['08-settings-life.png', '⑦ 设置 · 寿元（"无真实广告"错口径）'],
  ['09-trial-footer.png', '⑧ 雷劫页脚（产品规格腔）'],
];

function dataUri(file) {
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

(async () => {
  const port = 9940;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };

    await send('Runtime.enable'); await send('Page.enable');

    for (const [file, title] of PAIRS) {
      const b = path.join(SRC, 'before', file);
      const a = path.join(SRC, 'after', file);
      if (!fs.existsSync(b) || !fs.existsSync(a)) { console.log('  跳过（缺图）: ' + file); continue; }
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#f2f2f2;font:14px/1.4 -apple-system,"Microsoft Yahei",sans-serif;padding:14px}
        h1{font-size:16px;margin:0 0 10px;color:#222}
        .row{display:flex;gap:12px;align-items:flex-start}
        .col{background:#fff;border:1px solid #ccc;border-radius:8px;overflow:hidden}
        .cap{padding:6px 10px;font-size:13px;font-weight:700;border-bottom:1px solid #ddd}
        .cap.before{background:#fff1f0;color:#a8071a}
        .cap.after{background:#f0fff4;color:#1a7f37}
        img{display:block;width:360px;height:640px}
      </style></head><body>
        <h1>${title}</h1>
        <div class="row">
          <div class="col"><div class="cap before">改前（V90.39）</div><img src="${dataUri(b)}"></div>
          <div class="col"><div class="cap after">改后（V90.40）</div><img src="${dataUri(a)}"></div>
        </div>
      </body></html>`;
      const tmp = path.join(os.tmpdir(), 'sheet-' + file + '.html');
      fs.writeFileSync(tmp, html, 'utf8');
      await send('Page.navigate', { url: 'file:///' + tmp.replace(/\\/g, '/') });
      await sleep(700);
      const w = await ev('Math.ceil(document.body.scrollWidth)');
      const h = await ev('Math.ceil(document.body.scrollHeight)');
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
      await sleep(400);
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      const outFile = path.join(OUT, file.replace('.png', '-diff.png'));
      fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'));
      console.log('  ' + path.basename(outFile) + '  (' + w + 'x' + h + ')');
    }
    console.log('输出: ' + OUT);
  } catch (e) {
    console.error('FAIL: ' + e.message); process.exitCode = 1;
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(200);
    try { proc.kill('SIGKILL'); } catch {}
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }
})();
