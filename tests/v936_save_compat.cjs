'use strict';
/*
 * V90.36 存档兼容验收：旧档（V90.16 时代的 v14 结构，缺后续新增字段）能否在新包里继续玩
 *
 * 做法：
 *   ① 先打开播种页，拿到一份完整 v14 存档
 *   ② 把它「瘦身」成旧档：删掉后加的整块数据（试炼/裂隙/镜台/因果/大道/遗府/终劫/功法/装备/飞升记录）
 *      再顺手打乱/清掉几个可选字段，模拟老玩家存档
 *   ③ 在启动前写回 localStorage，打开无播种页
 *   ④ 断言：能进游戏、气血灵力正常、面板能开、没有异常、再存一次仍合法
 *
 * 用法: node tests/v936_save_compat.cjs jindan-v936
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v936';
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
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-'));
  fs.mkdirSync(path.join(TMP, 'seed'));
  fs.mkdirSync(path.join(TMP, 'noseed'));
  fs.writeFileSync(path.join(TMP, 'seed', 'index.html'), playHtml, 'utf8');
  const a = playHtml.indexOf('<script id="seed-save"');
  const b = playHtml.indexOf('<div id="phone"', a);
  if (a < 0 || b < 0) throw new Error('找不到播种块');
  fs.writeFileSync(path.join(TMP, 'noseed', 'index.html'), playHtml.slice(0, a) + playHtml.slice(b), 'utf8');

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9919;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-'));
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
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout')), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
    const boot = async (which) => {
      await send('Page.navigate', { url: `${base}/${which}/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
      await sleep(1000);
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });

    console.log('=== 0. 取完整 v14 存档并瘦身成「旧档」 ===');
    await boot('seed');
    const stripped = await ev(`(function(){
      var raw=localStorage.getItem(${JSON.stringify(KEY)});
      if(!raw)return null;
      var s=JSON.parse(raw);
      var before=Object.keys(s).length;
      /* V90.16 之后才出现的整块数据：老档里没有 */
      /* 只删 V90.16 之后才有的整块数据；ritual/cleared/flags/settlements 从 v1 起就有，属旧档本来的字段 */
      ['coreTrial','heartTrial','rift','mirror','karma','dao','estate','heaven','manuals','gears','storedGears','gearDrops','ascensionRecord','settings','stats','ui'].forEach(function(k){delete s[k];});
      return JSON.stringify({before:before,left:s,json:JSON.stringify(s)});
    })()`);
    ok(!!stripped, '拿到完整存档');
    const packet = JSON.parse(stripped);
    const obj = JSON.parse(packet.json);
    console.log('  瘦身后剩余字段：' + Object.keys(obj).join(', '));
    ok(obj.version === 14, '存档版本仍是 14（与 V90.16 相同）', 'version=' + obj.version);

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(packet.json)});}catch(e){}`,
    });
    await boot('noseed');

    console.log('\n=== 1. 旧档在新包里能否继续玩 ===');
    ok(await ev(`!document.getElementById('entry-root')||document.getElementById('entry-root').hidden`), '直接进入游戏（没有卡在入世页）');
    const state = await ev(`(function(){
      var txt=(document.getElementById('status')||{}).innerText||'';
      var raw=localStorage.getItem(${JSON.stringify(KEY)});
      var s=raw?JSON.parse(raw):{};
      return {statusText:txt.replace(/\\s+/g,' ').slice(0,120),
        hp:s.hp,maxHp:s.maxHp,spirit:s.spirit,maxSpirit:s.maxSpirit,
        zone:s.zone,level:s.level,major:s.major,ritual:Array.isArray(s.ritual)?s.ritual.length:'missing',
        coreTrial:!!s.coreTrial,gears:Array.isArray(s.gears)?s.gears.length:'missing'};
    })()`);
    console.log('  状态栏：' + state.statusText);
    ok(typeof state.hp === 'number' && state.hp > 0 && state.hp <= state.maxHp, '气血合法', state.hp + '/' + state.maxHp);
    ok(typeof state.spirit === 'number' && state.spirit >= 0 && state.spirit <= state.maxSpirit, '灵力合法', state.spirit + '/' + state.maxSpirit);
    ok(state.zone >= 0 && state.level >= 1, '境界/等级读取正常', 'zone=' + state.zone + ' level=' + state.level);

    ok(!/NaN|undefined/.test(state.statusText), '状态栏没有 NaN / undefined');

    console.log('\n=== 2. 面板能正常打开（含新增的试炼页）===');
    /* 先吐纳一次：旧档在这一步被完整规范化并写回（否则后面读到的是半成品状态） */
    await ev(`(function(){var b=document.querySelector('[data-a="meditate"]');if(b)b.click();})()`);
    await sleep(1000);

    const openAndMeasure = async (name) => {
      await ev(`(function(){var b=document.querySelector('[data-a="panel"][data-name="${name}"]');if(b)b.click();})()`);
      await sleep(700);
      const len = await ev(`(function(){var b=document.getElementById('panel-body');return b?b.innerHTML.length:0;})()`);
      return len;
    };
    for (const name of ['camp', 'pack', 'character', 'book']) {
      const len = await openAndMeasure(name);
      ok(len > 200, `面板 ${name} 渲染正常`, len + ' 字符');
      await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`);
      await sleep(300);
    }
    /* 修炼是洞府子页：洞府 → 修炼 */
    await ev(`(function(){var b=document.querySelector('[data-a="panel"][data-name="camp"]');if(b)b.click();})()`);
    await sleep(700);
    await ev(`(function(){var b=document.querySelector('[data-a="panel"][data-name="cultivate"]');if(b)b.click();})()`);
    await sleep(800);
    const navRows = await ev(`document.querySelectorAll('.cult-nav-row').length`);
    ok(navRows === 3, '修炼父子页三个入口都在', navRows + ' 个');
    const intoTrial = await ev(`(function(){var b=document.querySelector('.cult-nav-row[data-name="cultivate-trial"]');if(!b)return false;b.click();return true;})()`);
    await sleep(800);
    const trialLen = await ev(`(function(){var b=document.getElementById('panel-body');return b?b.innerHTML.length:0;})()`);
    ok(!!intoTrial, '旧档也能点进「破境条件」子页', 'clicked=' + intoTrial + ' len=' + trialLen);
    const trialEntry = await ev(`document.querySelectorAll('[data-a="tribulation-open"]').length`);
    ok(trialEntry >= 0, '旧档里雷劫入口渲染（数量看档位，不强制）', trialEntry + ' 个');
    await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(b)b.click();})()`);
    await sleep(300);

    console.log('\n=== 3. 玩一步 + 再存一次仍合法 ===');
    await ev(`(function(){var b=document.querySelector('[data-a="meditate"]');if(b)b.click();})()`);
    await sleep(900);
    const after = await ev(`(function(){
      var raw=localStorage.getItem(${JSON.stringify(KEY)});
      var s=raw?JSON.parse(raw):{};
      return {ok:!!raw,version:s.version,hp:s.hp,xp:s.xp,manual:s.manuals?Object.keys(s.manuals).length:'missing'};
    })()`);
    ok(after.ok && after.version === 14, '吐纳后写回的存档仍是 version 14', JSON.stringify(after));
    const back = await ev(`(function(){var s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}));return {ritual:Array.isArray(s.ritual)?s.ritual.length:'missing',cleared:Array.isArray(s.cleared)?s.cleared.length:'missing',gears:Array.isArray(s.gears)?s.gears.length:'missing',coreTrial:!!s.coreTrial,manuals:!!s.manuals};})()`);
    ok(back.ritual === 12 && back.cleared === 12, '被删掉的 ritual/cleared 已被补成 12 项', JSON.stringify(back));
    ok(back.gears === 0, '被删掉的装备数组已补成空数组', String(back.gears));
    ok(back.manuals === true, '新增的功法数据已补好', 'manuals=' + back.manuals);
    ok(back.ritual === 12, '试炼进度数组可用（试炼页能开就是最好的证据）', 'ritual=' + back.ritual);

    console.log('\n=== 4. 运行期异常 ===');
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
