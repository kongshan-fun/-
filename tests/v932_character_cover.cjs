'use strict';
/*
 * V90.32 人物装备面板验收
 *   1. 面板覆盖整个界面（连顶部状态条 / 标题栏 / 底部导航一起盖住）
 *   2. 装备卡里的「攻击 +N · 词条 / 替换战力 ±N」不能被裁
 *   3. 面板里仍能看到具体气血/灵力数值（这是用户要求全屏的理由）
 *   4. 三宽度截图
 *
 * 种子档没有装备，所以测试这样造数据：
 *   ① 先打开带播种脚本的页面，拿到一份合法存档
 *   ② 往存档里塞 6 件装备（2 件穿上）
 *   ③ 用 Page.addScriptToEvaluateOnNewDocument 在启动前写回 localStorage
 *   ④ 打开「去掉播种脚本」的同一份页面 —— 不被种子覆盖
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'jindan-v932';
const OUT = path.join(ROOT, 'visual', 'v932-character');
const EDGE = require('./lib/browser').BROWSER;
const KEY = 'qinglan-wendao-v14-human-slot-001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

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
  /* 准备两份页面：seed（带播种）/ noseed（去掉播种） */
  const playHtml = fs.readFileSync(path.join(ROOT, 'play', DIR, 'index.html'), 'utf8');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'v932root-'));
  fs.mkdirSync(path.join(TMP, 'seed'));
  fs.mkdirSync(path.join(TMP, 'noseed'));
  fs.writeFileSync(path.join(TMP, 'seed', 'index.html'), playHtml, 'utf8');
  const a = playHtml.indexOf('<script id="seed-save"');
  const b = playHtml.indexOf('<div id="phone"', a);
  if (a < 0 || b < 0) throw new Error('找不到播种块');
  fs.writeFileSync(path.join(TMP, 'noseed', 'index.html'), playHtml.slice(0, a) + playHtml.slice(b), 'utf8');

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9907;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v932-'));
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, f), Buffer.from(r.data, 'base64')); };
    const boot = async (which) => {
      await send('Page.navigate', { url: `${base}/${which}/index.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
      await sleep(900);
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });

    console.log('=== 0. 造数据：6 件装备（2 件穿上）===');
    await boot('seed');
    const json = await ev(`(function(){
      var raw=localStorage.getItem(${JSON.stringify(KEY)});
      if(!raw)return null;
      var s=JSON.parse(raw);var R=window.QData.RECIPES;
      var w=R.filter(function(r){return r.gear==='weapon'&&(r.zone||0)<=5;});
      var a=R.filter(function(r){return r.gear==='armor'&&(r.zone||0)<=5;});
      if(!w.length||!a.length)return null;
      var n=1;var add=function(recipe,q,ref,aff){s.gears.push({id:'g'+(n++),recipe:recipe.id,quality:q,refine:ref,affixes:aff,source:'test'});return s.gears[s.gears.length-1].id;};
      s.gears=[];
      var w0=add(w[0],1,2,[{id:'pierce',value:3}]);
      var a0=add(a[0],0,0,[{id:'armor',value:2}]);
      add(w[1]||w[0],2,0,[{id:'crit',value:4}]);
      add(w[2]||w[0],1,0,[]);
      add(a[1]||a[0],3,1,[{id:'leech',value:3}]);
      add(a[2]||a[0],1,0,[{id:'spirit',value:2}]);
      s.equipped={weapon:w0,armor:a0};s.nextGear=100;
      return JSON.stringify(s);
    })()`);
    ok(!!json, '拿到合法存档并塞入 6 件装备');
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(json)});}catch(e){}`,
    });
    await boot('noseed');

    console.log('\n=== 1. 面板覆盖整个界面 ===');
    const openCharacter = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await click('[data-a="panel"][data-name="character"]');
        await sleep(800);
        const okNow = await ev(`!!document.querySelector('#panel-root .panel-overlay')`);
        if (okNow) return true;
      }
      return false;
    };
    ok(await openCharacter(), '打开「人物」');
    await sleep(300);
    const cover = await ev(`(function(){
      var phone=document.getElementById('phone').getBoundingClientRect();
      var ov=document.querySelector('#panel-root .panel-overlay');
      var b=ov?ov.getBoundingClientRect():null;
      var st=document.getElementById('status').getBoundingClientRect();
      var tb=document.querySelector('.topbar').getBoundingClientRect();
      var nav=document.querySelector('.quick-nav').getBoundingClientRect();
      var atTop=document.elementFromPoint(Math.round(phone.left+phone.width/2),Math.round(tb.top+tb.height/2));
      var statusHidden=getComputedStyle(document.getElementById('status')).display==='none';
      var topbarHidden=getComputedStyle(document.querySelector('.topbar')).display==='none';
      var atStatus=document.elementFromPoint(Math.round(phone.left+phone.width/2),Math.round(st.top+st.height/2));
      var atNav=document.elementFromPoint(Math.round(phone.left+phone.width/2),Math.round(nav.top+nav.height/2));
      var inPanel=function(el){return !!(el&&el.closest&&el.closest('#panel-root'));};
      return {phoneTop:Math.round(phone.top),phoneH:Math.round(phone.height),
        ovTop:b?Math.round(b.top):null,ovH:b?Math.round(b.height):null,
        coversTop:b?b.top<=phone.top+2:false,coversBottom:b?b.bottom>=phone.bottom-2:false,
        topInPanel:inPanel(atTop),statusInPanel:inPanel(atStatus),navInPanel:inPanel(atNav),
        statusHit:atStatus?(atStatus.id||atStatus.className||atStatus.tagName):null,
        panelTopInPanel:inPanel(document.elementFromPoint(Math.round(phone.left+phone.width/2),Math.round(phone.top+8))),
        panelHit:(function(el){return el?(el.id||el.className||el.tagName):null;})(document.elementFromPoint(Math.round(phone.left+phone.width/2),Math.round(phone.top+8))),
        statusHidden:statusHidden,topbarHidden:topbarHidden};
    })()`);
    ok(cover.statusHidden && cover.topbarHidden, '顶部状态条与标题栏已让位（不显示）', JSON.stringify({ status: cover.statusHidden, topbar: cover.topbarHidden }));
    ok(cover.ovTop !== null && cover.ovTop <= cover.phoneTop + 8, '面板从屏幕最上方开始', `panel top=${cover.ovTop} phone top=${cover.phoneTop}`);
    ok(cover.panelTopInPanel, '屏幕顶部那块现在是面板自己的标题', `hit→${cover.panelHit}`);
    await shot('360x640-character.png');

    console.log('\n=== 2. 面板里能看到具体气血/灵力 ===');
    const stats = await ev(`(function(){var r=document.getElementById('panel-root');var txt=r.innerText.replace(/\\s+/g,' ');
      return {hp:/气血(上限)?\\s*\\d+/.test(txt),sp:/灵力(上限)?\\s*\\d+/.test(txt),head:txt.slice(0,90)};})()`);
    ok(stats.hp && stats.sp, '气血与灵力数值都在面板内', stats.head);

    console.log('\n=== 3. 装备卡文字不被裁 ===');
    const cards = await ev(`(function(){
      return [].map.call(document.querySelectorAll('#panel-root .character-v92-item'),function(c,i){
        var cb=c.getBoundingClientRect();
        var pick=function(sel){var el=c.querySelector(sel);if(!el)return null;var b=el.getBoundingClientRect();
          return {text:(el.textContent||'').trim().slice(0,44),bottom:Math.round(b.bottom),top:Math.round(b.top)};};
        return {i:i,top:Math.round(cb.top),bottom:Math.round(cb.bottom),h:Math.round(cb.height),
          scroll:c.scrollHeight,client:c.clientHeight,
          head:pick('.character-v92-item-top'),delta:pick('.character-v92-item-delta'),attrs:pick('.character-v92-item-stat'),btns:pick('strong')};
      });
    })()`);
    ok(cards.length >= 6, '渲染出装备卡', `${cards.length} 张`);
    const bad = cards.filter((c) => {
      const rows = [c.head, c.delta, c.attrs, c.btns].filter(Boolean);
      return c.scroll > c.client + 1 || rows.some((r) => r.bottom > c.bottom + 1);
    });
    ok(bad.length === 0, '每张卡的标题/战力/词条/按钮都在卡内',
      bad.length ? `${bad.length} 张被裁；例：卡 ${bad[0].i} delta=${bad[0].delta && bad[0].delta.bottom} > card ${bad[0].bottom}` : '0 张');
    const deltas = cards.map((c) => c.delta && c.delta.text).filter(Boolean);
    ok(deltas.length === cards.length, '每张卡都有战力差异文字', deltas.slice(0, 3).join(' ｜ '));
    await shot('360x640-character-cards.png');

    console.log('\n=== 4. 三宽度 ===');
    for (const [w, h] of [[320, 568], [390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      await sleep(700);
      if (!(await ev(`!!document.querySelector('#panel-root .panel-overlay')`))) await openCharacter();
      const c = await ev(`(function(){var p=document.getElementById('phone').getBoundingClientRect();
        var ov=document.querySelector('#panel-root .panel-overlay');var b=ov?ov.getBoundingClientRect():null;
        var over=[].filter.call(document.querySelectorAll('#panel-root .character-v92-item'),function(k){
          var kb=k.getBoundingClientRect();
          return [].some.call(k.querySelectorAll('.character-v92-item-top,strong,.character-v92-item-stat,.character-v92-item-delta'),function(el){
            return el.getBoundingClientRect().bottom>kb.bottom+1;});});
        var hid=getComputedStyle(document.getElementById('status')).display==='none';
        return {covers:hid&&b?b.top<=p.top+8:false,over:over.length};})()`);
      ok(c.covers && c.over === 0, `${w}x${h} 覆盖到底且无裁字`, JSON.stringify(c));
      await shot(`${w}x${h}-character.png`);
    }

    console.log('\n=== 5. 运行期异常 ===');
    ok(errors === 0, '无未捕获异常/console.error', errors + ' 个');

    console.log(`\n合计 ${pass + fail} 项：${pass} 通过 / ${fail} 失败`);
    console.log('截图：visual/v932-character/');
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
