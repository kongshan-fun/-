'use strict';
/* 用 file:// 直接打开最新版，验证：引擎启动、本地存储可用、界面渲染。
   这是「双击打开」的真实路径，不经过 http 服务。 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const target = process.argv[2] || path.join(ROOT, 'releases', '山野修仙记_V90.10_界面密度与检索优化版.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const url = pathToFileURL(target).href;
  console.log('URL:', url);
  console.log('文件存在:', fs.existsSync(target), '大小:', fs.existsSync(target) ? fs.statSync(target).size : 0);
  const port = 9991;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
      await sleep(200);
    }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res) => ws.addEventListener('open', res, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => {
      const i = id++; pend.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => rej(new Error('timeout ' + method)), 30000);
    });
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url });

    // 等引擎
    let booted = false;
    for (let i = 0; i < 200; i++) {
      try { if (await ev("typeof window.QData === 'object'")) { booted = true; break; } } catch {}
      await sleep(150);
    }
    await sleep(1200);

    const r = await ev(`(function(){
      var out={booted:${booted}};
      out.title=document.title;
      out.hasWordmark=document.body.innerText.indexOf('山野修仙记')>=0;
      out.hasEntry=!!document.querySelector('[data-a="characters"]');
      out.hasNav=!!document.querySelector('[data-a="panel"][data-name="camp"]');
      out.nodeCount=document.querySelectorAll('*').length;
      out.hasQTAP = (typeof window.QTap === 'object' && window.QTap !== null);
      out.qtapMock = out.hasQTAP && typeof window.QTap.isMock === 'function' ? !!window.QTap.isMock() : null;
      out.tapType = typeof window.tap;
      out.envKeys = out.hasQTAP && window.QTap.env ? Object.keys(window.QTap.env).join(',') : null;
      out.qtapCloud = out.hasQTAP && typeof window.QTap.cloud === 'object';
      out.qtapBoard = out.hasQTAP && typeof window.QTap.leaderboard === 'object';
      out.buildCode = window.__SHANYE_BUILD_CODE || null;
      try{ localStorage.setItem('__probe__','1'); out.lsWrite=localStorage.getItem('__probe__')==='1'; localStorage.removeItem('__probe__'); }
      catch(e){ out.lsWrite=false; out.lsError=String(e); }
      out.origin=location.origin;
      return out;
    })()`);
    console.log('\n=== file:// 直开结果 ===');
    console.log(`  标题            ${r.title}`);
    console.log(`  引擎启动        ${r.booted}`);
    console.log(`  渲染出主界面    ${r.hasWordmark}`);
    console.log(`  有「档案」入口  ${r.hasEntry}`);
    console.log(`  有底部导航      ${r.hasNav}`);
    console.log(`  DOM 节点        ${r.nodeCount}`);
    console.log(`  localStorage    ${r.lsWrite ? '可读写' : '不可用 ' + (r.lsError || '')}`);
    console.log(`  origin          ${r.origin}`);
    if (r.hasQTAP) {
      console.log(`  QTAP 适配层     ${r.hasQTAP ? '已初始化' : '未加载'}（MOCK=${r.qtapMock}，云存档=${r.qtapCloud}，排行榜=${r.qtapBoard}）`);
      console.log(`  构建码          ${r.buildCode || '(无)'}`);
    }
    const ok = r.booted && r.hasWordmark && r.hasEntry && r.lsWrite;
    console.log(`\n结论: ${ok ? 'PASS 双击打开可正常运行并保存' : 'FAIL 见上'}`);
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    try { if (ws) ws.close(); } catch {}
    await sleep(300);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  }
})();
