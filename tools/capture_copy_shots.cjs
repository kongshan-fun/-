'use strict';
/*
 * 文案改动的前后对照截图
 * 用法: node tools/capture_copy_shots.cjs <playDir> <outDir> <tag>
 * 抓 5 张：教程·寿元条目 / 教程·因果与大道条目 / 设置页底部 / 设置·寿元说明 / 九霄与飞升教程条目 / 雷劫页页脚
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v939';
const OUT = path.join(ROOT, 'visual', 'v940-copy', process.argv[4] || 'before');
const EDGE = require('../tests/lib/browser').BROWSER;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

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
  const port = 9930;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'copyshot-'));
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { await sleep(300); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); console.log('  ' + f); };
    const closeAll = async () => { for (let i = 0; i < 5; i++) { const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`); if (!had) break; await sleep(250); } };
    /* 把含指定文字的元素滚到面板可见区顶部 */
    const scrollToOne = (needle) => ev(`(function(){
      var body=document.getElementById('panel-body'); if(!body) return false;
      var all=[].slice.call(body.querySelectorAll('*')).filter(function(n){return n.textContent.indexOf(${JSON.stringify(needle)})>=0;});
      if(!all.length) return false;
      all.sort(function(a,b){return a.getElementsByTagName('*').length - b.getElementsByTagName('*').length;});
      var el=all[0]; var top=el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      body.scrollTop=Math.max(0, top - 12); return true;
    })()`);
    const scrollTo = async (needles) => { const list = Array.isArray(needles) ? needles : [needles];
      for (const n of list) { if (await scrollToOne(n)) return n; } return false; };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'`).catch(() => false)) break; }
    await sleep(1100);

    /* ① 教程：寿元与轮回 */
    await closeAll();
    await click('[data-a="panel"][data-name="help"]'); await sleep(900);
    const okHelp = await ev(`!!document.getElementById('panel-body')`);
    await ev(`(function(){var b=document.getElementById('panel-body');if(b)[].forEach.call(b.querySelectorAll('details'),function(d){d.open=true;});})()`);
    await sleep(400);
    if (okHelp) {
      const found = await scrollTo(['寿元归零只删除当前种族', '逆命续年的机会']);
      console.log('  寿元段命中: ' + found);
      await shot('01-help-lifespan.png');
      /* ② 教程：因果 / 大道 / 资质榜 三段（同一段长文，直接再滚到因果） */
      const f2 = await scrollTo(['karmaWitness', '两处旧事各自独立记录']);
      console.log('  因果段命中: ' + f2);
      if (f2) await shot('02-help-karma.png');
      const f3 = await scrollTo(['flags.daoStele', '立下的道誓会留在本档']);
      console.log('  大道段命中: ' + f3);
      if (f3) await shot('03-help-dao.png');
      const f4 = await scrollTo(['不会伪装成能游玩的空系统', '飞升结算与存档保留照常']);
      console.log('  飞升段命中: ' + f4);
      if (f4) await shot('04-help-ascension.png');
      const f5 = await scrollTo(['不会额外卡住旧档', '该扩展只是可选挑战']);
      console.log('  九霄段命中: ' + f5);
      if (f5) await shot('05-help-heaven.png');
      const f6 = await scrollTo(['未来接入云端', '换设备不会自动带过去', '本机排行榜，最多保留前 200 条']);
      console.log('  资质榜段命中: ' + f6);
      if (f6) await shot('06-help-board.png');
    } else console.log('  ! 教程没打开');

    /* ⑦ 设置页底部（版本公告） */
    await closeAll();
    await click('[data-a="panel"][data-name="settings"]'); await sleep(900);
    await ev(`(function(){var b=document.getElementById('panel-body');if(b)b.scrollTop=b.scrollHeight;})()`);
    await shot('07-settings-bottom.png');

    /* ⑧ 设置 → 修行状态与寿元 */
    await click('[data-a="panel-step"][data-name="set-life"]'); await sleep(800);
    await ev(`(function(){var b=document.getElementById('panel-body');if(b)b.scrollTop=b.scrollHeight;})()`);
    await shot('08-settings-life.png');

    /* ⑨ 雷劫页页脚 */
    await closeAll();
    await click('[data-a="panel"][data-name="camp"]'); await sleep(700);
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700);
    await click('.cult-nav-row[data-name="cultivate-trial"]'); await sleep(800);
    if (await click('[data-a="tribulation-open"]')) { await sleep(900); }
    await ev(`(function(){var b=document.getElementById('panel-body');if(b)b.scrollTop=b.scrollHeight;})()`);
    await shot('09-trial-footer.png');

    console.log('输出目录: ' + OUT);
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
