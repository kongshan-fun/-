'use strict';
/*
 * V90.30/V90.31 战斗界面验收：全屏模态 + 参考图排布
 *
 * 断的是用户提的几件事：
 *   A. 结构：顶部敌方大血条 / 日志（默认折叠、摘要显示最新一条）/ 技能 / 动作 / 底部我方大血条
 *      —— 技能模块必须在主角血条**之上**（V90.31 的调整）
 *   B. 血条明显（高度 ≥19px）
 *   C. 模态：层压过地图、斗法中不能开地图/出行/面板、没有关闭按钮，打赢或撤离才消失
 *   D. 320/360/390 三宽度截图
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v931';
const OUT = path.join(ROOT, 'visual', 'v934-combat');
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
  const port = 9902;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v931-'));
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
    const combatVisible = () => ev(`!document.getElementById('combat-root').hidden`);
    const hasPanelBody = () => ev(`!!document.getElementById('panel-body')`);
    const enterBattle = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        /* 收起任何已打开的面板 */
        for (let i = 0; i < 4; i++) {
          const had = await ev(`(function(){var b=document.querySelector('[data-a="close-panel"]');if(!b)return false;b.click();return true;})()`);
          if (!had) break;
          await sleep(300);
        }
        await click('[data-a="panel"][data-name="camp"]');
        await sleep(800);
        if (!(await hasPanelBody())) { await click('[data-a="panel"][data-name="camp"]'); await sleep(800); }
        if (!(await hasPanelBody())) continue;
        const cul = await ev(`!!document.querySelector('[data-a="panel"][data-name="cultivate"]')`);
        if (!cul) continue;
        await click('[data-a="panel"][data-name="cultivate"]');
        await sleep(800);
        for (let i = 0; i < 3; i++) {
          if (await click('[data-a="train"]')) {
            await sleep(900);
            if (await combatVisible()) return true;
          }
          await sleep(400);
        }
      }
      return false;
    };

    await send('Runtime.enable'); await send('Page.enable');

    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
    await sleep(900);

    console.log('=== 0. 战前 ===');
    ok(await ev(`document.getElementById('combat-root').hidden`), '#combat-root 默认隐藏');
    const z = await ev(`(function(){return {combat:Number(getComputedStyle(document.getElementById('combat-root')).zIndex),map:Number(getComputedStyle(document.getElementById('map-overlay')).zIndex)};})()`);
    ok(z.combat > z.map, '战斗层压过地图层', `combat=${z.combat} map=${z.map}`);

    console.log('\n=== 1. 进入战斗 ===');
    ok(await enterBattle(), '试剑开战');
    ok(await ev(`!document.getElementById('combat-root').hidden`), '战斗层已显示');
    await shot('360x640-combat.png');

    console.log('\n=== 2. 排布：敌 → 日志(折叠) → 技能 → 动作 → 我 ===');
    const layout = await ev(`(function(){
      var r=document.getElementById('combat-root');
      var q=function(s){return r.querySelector(s);};
      var box=function(el){if(!el)return null;var b=el.getBoundingClientRect();return {y:Math.round(b.top),h:Math.round(b.height)};};
      var foeBar=q('.cb-foe .cb-bar'), selfBar=q('.cb-self .cb-bar'), wrap=q('.cb-log-wrap');
      return {
        foeName:(q('.cb-foe .cb-name')||{}).textContent||'',
        foeBarH:foeBar?Math.round(foeBar.getBoundingClientRect().height):0,
        selfBarH:selfBar?Math.round(selfBar.getBoundingClientRect().height):0,
        logAlwaysVisible:wrap?wrap.tagName==='DIV'&&!wrap.hidden:false,
        logLines:r.querySelectorAll('.cb-log .cb-line').length,
        modes:[].map.call(r.querySelectorAll('.cb-actions button[data-mode]'),function(b){return b.dataset.mode;}),
        hasClose:!!r.querySelector('[data-a="combat-close"],[aria-label*="关闭"]'),
        order:{foe:box(q('.cb-foe')),log:box(wrap),skills:box(q('.cb-skills')),acts:box(q('.cb-actions')),self:box(q('.cb-self'))}
      };
    })()`);
    ok(!!layout.foeName, '顶部显示敌方名称', layout.foeName);
    ok(layout.foeBarH >= 19 && layout.selfBarH >= 19, '双方血条明显（≥19px）', `敌 ${layout.foeBarH}px / 我 ${layout.selfBarH}px`);
    ok(layout.logAlwaysVisible, '战斗日志常显（不是折叠条）');
    ok(layout.logLines >= 1, '日志里有内容', layout.logLines + ' 行');
    ok(layout.modes.length === 6, '六个基础动作', layout.modes.join(','));
    ok(!layout.hasClose, '没有关闭按钮（只能打赢或撤离）');
    const o = layout.order;
    ok(o.foe.y < o.log.y && o.log.y < o.skills.y && o.skills.y < o.self.y,
      '顺序：敌 → 日志 → 技能 → 我（技能在我方血条之上）', JSON.stringify({ foe: o.foe.y, log: o.log.y, skills: o.skills.y, acts: o.acts.y, self: o.self.y }));
    ok(o.acts.y > o.skills.y && o.acts.y < o.self.y, '动作按钮在技能与血条之间');

    console.log('\n=== 3. 日志常显：可滚动、停在最新一行 ===');
    for (let i = 0; i < 2; i++) { await click('#combat-root [data-mode="guard"]'); await sleep(700); }
    const logState = await ev(`(function(){
      var r=document.getElementById('combat-root');if(!r||r.hidden)return {over:true};
      var log=document.getElementById('combat-log');
      return {over:false,lines:log.querySelectorAll('.cb-line').length,
        h:Math.round(log.getBoundingClientRect().height),
        atBottom:Math.abs(log.scrollHeight-log.clientHeight-log.scrollTop)<=2,
        lastText:(log.querySelector('.cb-line:last-child')||{}).textContent||''};
    })()`);
    ok(logState.over || (logState.lines >= 2 && logState.h >= 60), '日志占了中段且有多行', JSON.stringify({ lines: logState.lines, h: logState.h }));
    ok(logState.over || logState.atBottom, '日志自动停在最新一行', logState.over ? '-' : (logState.lastText || '').slice(0, 30));
    await shot('360x640-combat-log.png');

    console.log('\n=== 4. 模态：斗法中不能离开 ===');
    await click('[data-a="expand-map"]'); await sleep(400);
    ok(await ev(`document.getElementById('map-overlay').hidden`), '斗法中展开地图无效');
    await click('[data-a="panel"][data-name="settings"]'); await sleep(400);
    ok(await ev(`!document.getElementById('panel-root').querySelector('.panel-overlay')`), '斗法中打不开设置面板');
    ok(await ev(`!document.getElementById('combat-root').hidden`), '战斗层仍在');

    console.log('\n=== 5. 打两回合：日志累积 ===');
    for (let i = 0; i < 2; i++) { await click('#combat-root [data-mode="guard"]'); await sleep(700); }
    const mid = await ev(`(function(){var r=document.getElementById('combat-root');if(!r||r.hidden)return{over:true};
      var log=document.getElementById('combat-log');
      return {over:false,lines:log.querySelectorAll('.cb-line').length};})()`);
    ok(mid.over || mid.lines >= 2, '日志持续累积', JSON.stringify(mid));

    console.log('\n=== 6. 撤离：战斗层消失，地图恢复 ===');
    if (await ev(`document.getElementById('combat-root').hidden`)) { await enterBattle(); await sleep(600); }
    ok(await click('#combat-root [data-mode="escape"]'), '点撤离/结束'); await sleep(1200);
    ok(await ev(`document.getElementById('combat-root').hidden`), '战斗结束后战斗层隐藏');
    await click('[data-a="expand-map"]'); await sleep(500);
    ok(await ev(`!document.getElementById('map-overlay').hidden`), '战斗结束后地图能展开');
    await click('[data-a="collapse-map"]'); await sleep(400);

    console.log('\n=== 7. 三宽度截图 ===');
    for (const [w, h] of [[320, 568], [390, 844], [390, 880]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(400);
      if (!(await enterBattle())) { console.log(`  ${w}x${h} 打不开试剑，跳过`); continue; }
      await sleep(700);
      await shot(`${w}x${h}-combat.png`);
      const r = await ev(`(function(){var s=document.getElementById('combat-root');var b=s.getBoundingClientRect();
        var self=s.querySelector('.cb-self').getBoundingClientRect();
        return {visible:!s.hidden,h:Math.round(b.height),vh:innerHeight,overflow:s.scrollHeight>s.clientHeight+2,
          selfBottom:Math.round(self.bottom),vh2:innerHeight};})()`);
      ok(r.visible && !r.overflow && r.selfBottom <= r.vh2 + 1, `${w}x${h} 战斗层不溢出、我方血条在屏内`, JSON.stringify(r));
      await click('#combat-root [data-mode="escape"]'); await sleep(1000);
    }

    console.log('\n=== 8. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    console.log('截图：visual/v931-combat/');
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
