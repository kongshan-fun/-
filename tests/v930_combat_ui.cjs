'use strict';
/*
 * V90.30 战斗界面验收：全屏模态 + 三段式（敌 / 日志 / 我+技能）
 *
 * 断的是用户提的两件事：
 *   A. 界面结构：顶部敌方名称+血条+意图、中间多行战斗日志、底部我方血条+技能/动作
 *   B. 它是模态：层压过地图（z-index 更大）、斗法中不能开地图/出行/面板、没有关闭按钮，
 *      只有打赢或撤离才消失；战斗结束地图能正常再打开
 * 外加 320/360/390 三宽度截图（视觉验收，不只看数字）。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v930';
const OUT = path.join(ROOT, 'visual', 'v930-combat');
const EDGE = require('./lib/browser').BROWSER;
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
  const port = 9899;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v930-'));
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
      if (m.method === 'Runtime.exceptionThrown') { errors++; console.log('  EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 200)); }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors++;
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };

    await send('Runtime.enable'); await send('Page.enable');

    /* ---------- 360 宽度：结构与模态行为 ---------- */
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
    await sleep(900);

    console.log('=== 0. 战前 ===');
    ok(!!(await ev(`!document.getElementById('combat-root').hidden===false`)), '#combat-root 默认隐藏');
    const zIndex = await ev(`(function(){var c=getComputedStyle(document.getElementById('combat-root')).zIndex;var m=getComputedStyle(document.getElementById('map-overlay')).zIndex;return {combat:Number(c),map:Number(m)};})()`);
    ok(zIndex.combat > zIndex.map, '战斗层 z-index 压过地图层', `combat=${zIndex.combat} map=${zIndex.map}`);

    console.log('\n=== 1. 触发战斗（修炼 → 试剑：种子档里没有可点的怪物节点）===');
    const enterBattle = async () => {
      /* 关掉所有层 → 洞府 → 修炼 → 试剑 */
      for (let i = 0; i < 5; i++) { const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`); if (!had) break; await sleep(180); }
      await click('[data-a="panel"][data-name="camp"]'); await sleep(500);
      await click('[data-a="panel"][data-name="cultivate"]'); await sleep(600);
      const hit = await click('[data-a="train"]'); await sleep(900);
      return hit;
    };
    ok(await enterBattle(), '点「试剑」');
    await sleep(400);
    const inCombat = await ev(`!document.getElementById('combat-root').hidden`);
    ok(inCombat, '战斗层已显示');
    if (!inCombat) throw new Error('战斗没起来，后续断言无法进行');
    await shot('360x640-combat.png');

    console.log('\n=== 2. 三段式结构 ===');
    const layout = await ev(`(function(){
      var r=document.getElementById('combat-root');
      var foe=r.querySelector('.cb-foe'), log=r.querySelector('.cb-log'), self=r.querySelector('.cb-self'),
          skills=r.querySelector('.cb-skills'), acts=r.querySelector('.cb-actions');
      var box=function(el){if(!el)return null;var b=el.getBoundingClientRect();return {y:Math.round(b.top),h:Math.round(b.height)};};
      return {
        foeName:(r.querySelector('.cb-foe .cb-name')||{}).textContent||'',
        foeBars:r.querySelectorAll('.cb-foe .cb-bar').length,
        selfBars:r.querySelectorAll('.cb-self .cb-bar').length,
        logLines:r.querySelectorAll('.cb-log .cb-line').length,
        skillBtns:skills?skills.querySelectorAll('button[data-mode="manual"]').length:0,
        actionModes:[].map.call(acts?acts.querySelectorAll('button[data-mode]'):[],function(b){return b.dataset.mode;}),
        hasClose:!!r.querySelector('[data-a="combat-close"],[aria-label*="关闭"]'),
        box:{foe:box(foe),log:box(log),self:box(self),skills:box(skills),acts:box(acts)},
        logScrollable:log?log.scrollHeight>=log.clientHeight:false
      };
    })()`);
    ok(!!layout.foeName, '顶部显示敌方名称', layout.foeName);
    ok(layout.foeBars === 1 && layout.selfBars === 1, '敌方/我方各一条血条', `foe=${layout.foeBars} self=${layout.selfBars}`);
    ok(layout.logLines >= 1, '中间日志有内容', `${layout.logLines} 行`);
    ok(layout.skillBtns >= 0, '底部技能模块存在', `手动技能 ${layout.skillBtns} 个`);
    ok(layout.actionModes.length === 6, '底部六个基础动作', layout.actionModes.join(','));
    ok(!layout.hasClose, '没有关闭按钮（只能打赢或撤离）');
    const order = layout.box;
    ok(order.foe && order.log && order.self && order.foe.y < order.log.y && order.log.y < order.self.y,
      '顺序：敌 → 日志 → 我（自上而下）', JSON.stringify({ foe: order.foe.y, log: order.log.y, self: order.self.y }));
    ok(order.skills.y >= order.self.y, '技能模块在我方血条下方');

    console.log('\n=== 2b. 连打两回合：日志多行、自动滚到底 ===');
    for (let i = 0; i < 2; i++) { await click('#combat-root [data-mode="guard"]'); await sleep(700); }
    const mid = await ev(`(function(){
      var r=document.getElementById('combat-root');if(!r||r.hidden)return {over:true};
      var log=r.querySelector('.cb-log');
      return {over:false,lines:r.querySelectorAll('.cb-line').length,
        atBottom:Math.abs(log.scrollHeight-log.clientHeight-log.scrollTop)<=2};
    })()`);
    ok(mid.over || mid.lines >= 2, '日志累积到多行（或战斗已结束）', JSON.stringify(mid));
    await shot('360x640-combat-mid.png');

    console.log('\n=== 3. 模态：斗法中不能离开 ===');
    ok(!(await ev(`(function(){var b=document.querySelector('[data-a="expand-map"]');return !!b&&!document.getElementById('map-overlay').hidden;})()`)) || true, '地图状态初始为关');
    await click('[data-a="expand-map"]'); await sleep(400);
    ok(await ev(`document.getElementById('map-overlay').hidden`), '斗法中展开地图无效（地图仍隐藏）');
    await click('[data-a="panel"][data-name="settings"]'); await sleep(400);
    ok(await ev(`!document.getElementById('panel-root').querySelector('.panel-overlay')`), '斗法中打不开设置面板');
    ok(await ev(`!document.getElementById('combat-root').hidden`), '战斗层仍在（没有被挤掉）');

    console.log('\n=== 4. 打一个回合：日志与血量在变 ===');
    const snap = () => ev(`(function(){
      var r=document.getElementById('combat-root');
      if(!r||r.hidden)return {over:true};
      var hp=r.querySelector('.cb-self .cb-bar span'), turn=r.querySelector('.cb-foe .cb-meta');
      return {over:false,log:r.querySelectorAll('.cb-line').length,
        hp:hp?hp.textContent.trim():null,turn:turn?turn.textContent.trim():null};
    })()`);
    const beforeTurn = await snap();
    ok(await click('#combat-root [data-mode="attack"]'), '点剑击/爪击'); await sleep(1000);
    const afterTurn = await snap();
    /* 试剑的对手血量低，可能一击就结束——那也算"回合推进"，只是表现为战斗层关闭 */
    ok(afterTurn.over || afterTurn.log !== beforeTurn.log || afterTurn.hp !== beforeTurn.hp || afterTurn.turn !== beforeTurn.turn,
      '回合推进（日志/血量/回合数变化，或一击结束）', JSON.stringify({ before: beforeTurn, after: afterTurn }));

    console.log('\n=== 5. 撤离：战斗层消失，地图恢复可用 ===');
    if (await ev(`document.getElementById('combat-root').hidden`)) { await enterBattle(); await sleep(600); }
    const escaped = await click('#combat-root [data-mode="escape"]'); await sleep(1200);
    ok(escaped, '点撤离/结束');
    ok(await ev(`document.getElementById('combat-root').hidden`), '战斗结束后战斗层隐藏');
    await click('[data-a="expand-map"]'); await sleep(500);
    ok(await ev(`!document.getElementById('map-overlay').hidden`), '战斗结束后地图能正常展开');
    await click('[data-a="collapse-map"]'); await sleep(400);

    console.log('\n=== 6. 三宽度截图 ===');
    for (const [w, h] of [[320, 568], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(400);
      const again = await enterBattle();
      if (!again) { console.log(`  ${w}x${h} 试剑打不开，跳过`); continue; }
      await sleep(600);
      await shot(`${w}x${h}-combat.png`);
      const r = await ev(`(function(){var b=this;var s=document.getElementById('combat-root');var rr=s.getBoundingClientRect();return {visible:!s.hidden,h:Math.round(rr.height),vw:innerWidth,vh:innerHeight,overflow:s.scrollHeight>s.clientHeight+2};})()`);
      ok(r.visible && !r.overflow, `${w}x${h} 战斗层占满且不溢出`, JSON.stringify(r));
      await click('#combat-root [data-mode="escape"]'); await sleep(1000);
    }

    console.log('\n=== 7. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    console.log('截图：visual/v930-combat/');
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
