'use strict';
/**
 * V90.9 界面优化 · 版面审计
 * 逐个真实打开面板，测量：横向溢出、容器内溢出、按钮密度、标题数、长段落数、
 * 内容高度/可视高度比、可点区域过小元素。并保存每个面板截图。
 *
 * 运行： node tests/v909_panel_audit.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, process.env.AUDIT_OUT || 'visual/v909-audit');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const W = 390, H = 844;

const PANELS = [
  ['character', '人物'],
  ['pack', '背包'],
  ['warehouse', '仓库'],
  ['craft', '炼制'],
  ['camp', '洞府'],
  ['cultivate', '修炼'],
  ['quest', '主线'],
  ['book', '图鉴'],
  ['manuals', '功法'],
  ['log', '行记'],
  ['help', '教程'],
  ['lore', '见闻'],
  ['settings', '设置'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(root, rel);
      if (!f.startsWith(root)) { rsp.writeHead(403).end(); return; }
      fs.readFile(f, (e, b) => {
        if (e) { rsp.writeHead(404).end(); return; }
        rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        rsp.end(b);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 1; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('ws')), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    return r.result.value;
  }
  async waitFor(expr, timeout = 25000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch {}
      await sleep(120);
    }
    throw new Error('waitFor timeout: ' + expr);
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }
}

const click = (cdp, sel) => cdp.eval(`(function(){var b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true;})()`);

async function waitDebug(port) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('devtools');
}

const MEASURE = `(function(){
  var pb=document.getElementById('panel-root');
  if(!pb) return {missing:true};
  var body=document.getElementById('panel-body')||pb;
  var cs=getComputedStyle(body);
  var padL=parseFloat(cs.paddingLeft)||0, padR=parseFloat(cs.paddingRight)||0;
  var innerW=body.clientWidth-padL-padR;
  var btns=[].slice.call(body.querySelectorAll('.btn'));
  var h3=[].slice.call(body.querySelectorAll('h3'));
  var all=[].slice.call(body.querySelectorAll('*'));
  var overflowInside=[], tiny=[], wideText=[];
  var left=body.getBoundingClientRect().left+padL;
  for(const el of all){
    if(el.scrollWidth-el.clientWidth>2 && el.clientWidth>0) overflowInside.push(el.className||el.tagName);
    var r=el.getBoundingClientRect();
    if(r.width>0 && (r.right>left+innerW+2||r.left<left-2)) wideText.push((el.className||el.tagName)+' right='+Math.round(r.right));
    if(el.tagName==='BUTTON'||el.classList.contains('btn')){
      if(r.height>0 && r.height<32) tiny.push((el.textContent||'').trim().slice(0,8)+':'+Math.round(r.height));
    }
  }
  var paragraphs=[].slice.call(body.querySelectorAll('p')).map(function(p){return (p.textContent||'').trim();});
  return {
    missing:false,
    scrollH: body.scrollHeight, clientH: body.clientHeight,
    ratio: body.clientHeight? +(body.scrollHeight/body.clientHeight).toFixed(2):0,
    overflowX: body.scrollWidth-body.clientWidth,
    docOverflowX: document.documentElement.scrollWidth-window.innerWidth,
    btnCount: btns.length,
    btnActions: [...new Set(btns.map(function(b){return b.getAttribute('data-a');}))].filter(Boolean),
    h3Count: h3.length,
    overflowInsideCount: overflowInside.length,
    overflowInsideSample: overflowInside.slice(0,4),
    wideCount: wideText.length,
    wideSample: wideText.slice(0,3),
    tinyBtnCount: tiny.length,
    tinySample: tiny.slice(0,3),
    longParas: paragraphs.filter(function(t){return t.length>120;}).length,
    maxParaLen: paragraphs.reduce(function(a,t){return Math.max(a,t.length);},0),
    textLen: (body.innerText||'').length,
    signature: (body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,40)
  };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT);
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const port = 9961;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  const rows = [];
  try {
    await waitDebug(port);
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: origin + '/index.html' });
    await cdp.waitFor("typeof window.QData === 'object'");
    await sleep(1200);

    for (const [sel, w] of [['[data-a="characters"]', 600], ['[data-a="choose-role"][data-role="human"]', 500],
      ['[data-a="view-slots"]', 600], ['[data-a="slot-open"][data-slot="1"]', 800],
      ['[data-a="birth-next"]', 800], ['[data-a="birth-confirm-final"]', 1500]]) {
      if (!(await click(cdp, sel))) throw new Error('onboarding ' + sel);
      await sleep(w);
    }
    await cdp.eval(`(function(){
      var g=document.querySelector('.modal-backdrop [data-a="guide"]')||document.querySelector('[data-a="guide"]');
      if(g){g.click();return;}
      var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();
    })()`);
    await sleep(700);
    await cdp.eval(`(function(){var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(600);

    for (const [name, label] of PANELS) {
      // 关闭当前面板（openPanel 是开关式）
      await cdp.eval(`(function(){
        var p=document.getElementById('panel-root');
        if(p&&p.innerHTML.trim()!==''){
          var c=document.querySelector('.panel-close')||document.querySelector('[data-a="close-panel"]');
          if(c)c.click();
        }
      })()`);
      await sleep(350);

      // 入口级联：直接入口 → 各宿主面板内的嵌套入口 → 专用动作
      const opened = await cdp.eval(`(function(name){
        function clickIt(sel){var b=document.querySelector(sel);if(b){b.click();return true;}return false;}
        var direct='[data-a="panel"][data-name="'+name+'"]';
        if(clickIt(direct)) return 'direct';
        if(name==='quest' && clickIt('#quest')) return 'id-quest';
        var hosts=['birth','camp','craft','pack','character','book','quest','settings','help'];
        for(var i=0;i<hosts.length;i++){
          if(hosts[i]===name) continue;
          var hb=document.querySelector('[data-a="panel"][data-name="'+hosts[i]+'"]')||
                 (hosts[i]==='quest'?document.querySelector('#quest'):null);
          if(!hb) continue;
          hb.click();
          if(clickIt(direct)) return 'via-'+hosts[i];
          if(name==='lore' && clickIt('[data-a="lore-open"]')) return 'via-lore-open';
        }
        return 'none';
      })(${JSON.stringify(name)})`);
      await sleep(750);

      let m;
      try { m = await cdp.eval(MEASURE); } catch (e) { m = { missing: true, error: e.message }; }
      m.name = name; m.label = label; m.opener = opened;
      // 判定「确实渲染了目标面板」：面板有内容且标题/动作能对上
      m.rendered = !m.missing && (m.textLen > 0);
      rows.push(m);
      if (m.rendered) await cdp.shot(path.join(OUT, `panel-${name}.png`));
      console.log(`${name.padEnd(11)} ${String(opened).padEnd(12)} ${m.missing ? 'missing' : `h=${m.scrollH} ratio=${m.ratio} ovX=${m.overflowX} btn=${m.btnCount} h3=${m.h3Count} text=${m.textLen}`}`);
    }

    const st = await cdp.eval(`document.querySelectorAll('.modal-backdrop').length`);
    console.log('\n残留弹窗:', st);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(300);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }

  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(rows, null, 2), 'utf8');
  console.log('\n明细: visual/v909-audit/audit.json');
})();
