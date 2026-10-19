'use strict';
/**
 * V90.10 操作流程录制器
 * 做法：真实点击 → 点击处画涟漪高亮 → 写步骤字幕 → 每步截一帧 → ffmpeg 合成 MP4
 * 不做任何状态注入，全部是真实游戏操作；「加速」只体现在步间停顿时长。
 *
 * 用法： node tests/v910_playthrough.cjs [--pilot]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'visual', 'v910-playthrough');
const FRAMES = path.join(OUT, 'frames');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const W = 390, H = 844;
const PILOT = process.argv.includes('--pilot');

const OVERLAY = `
(function(){
  if(window.__REC) return;
  // 画布下移 62px，底部留出专属字幕条，避免字幕压住导航与小地图
  var st=document.createElement('style');
  st.id='__rec_layout';
  st.textContent='body{align-items:flex-start!important;justify-content:center!important}'+
    '.phone{height:calc(100dvh - 62px)!important;max-height:calc(100dvh - 62px)!important}'+
    'html,body{overflow:hidden!important}';
  document.head.appendChild(st);

  var wrap=document.createElement('div');
  wrap.id='__rec_ui';
  wrap.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif';
  wrap.innerHTML='<div id="__rec_cap" style="position:absolute;left:0;right:0;bottom:0;height:62px;padding:8px 14px;'+
    'box-sizing:border-box;display:flex;align-items:center;gap:10px;'+
    'background:#141414;color:#fff;font-size:13px;line-height:1.35;letter-spacing:.2px;overflow:hidden">'+
    '<span id="__rec_step" style="flex:none;opacity:.62;font-size:11.5px;font-variant-numeric:tabular-nums"></span>'+
    '<span id="__rec_text" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis"></span></div>';
  document.documentElement.appendChild(wrap);
  var ring=document.createElement('div');
  ring.id='__rec_ring';
  ring.style.cssText='position:fixed;width:0;height:0;pointer-events:none;z-index:2147483647;display:none';
  document.documentElement.appendChild(ring);
  window.__REC={
    caption:function(step,text){
      var s=document.getElementById('__rec_step'),t=document.getElementById('__rec_text');
      if(s)s.textContent=step?(String(step).padStart(2,'0')+' / '):'';
      if(t)t.textContent=text||'';
    },
    clearRipple:function(){ var r=document.getElementById('__rec_ring'); if(r) r.style.display='none'; },
    ripple:function(x,y){
      var r=document.getElementById('__rec_ring');
      if(!r)return;
      r.style.display='block';
      r.style.left=(x-22)+'px'; r.style.top=(y-22)+'px';
      r.style.width='44px'; r.style.height='44px';
      r.style.borderRadius='50%';
      r.style.border='2px solid #ff3b30';
      r.style.background='rgba(255,59,48,.22)';
      r.style.boxShadow='0 0 0 6px rgba(255,59,48,.12)';
      r.style.transition='none';
      var dot=document.createElement('div');
      dot.style.cssText='position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;'+
        'border-radius:50%;background:#ff3b30';
      if(!r.firstChild) r.appendChild(dot);
      clearTimeout(window.__ringTimer);
      window.__ringTimer=setTimeout(function(){ r.style.display='none'; }, 4000);
    }
  };
})();`;

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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 40000);
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
  async waitFor(expr, timeout = 30000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch {}
      await sleep(120);
    }
    throw new Error('waitFor timeout: ' + expr);
  }
}

async function waitDebug(port) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch {}
    await sleep(200);
  }
  throw new Error('devtools');
}

/* 点击：在「可见」元素上画涟漪再点。同一 data-a 可能有多个隐藏副本，
   必须挑 getClientRects().length 且尺寸大于 0 的那个，否则涟漪会画到 (0,0)。 */
const tapInPage = (cdp, sel) => cdp.eval(`(function(){
  var list=[].slice.call(document.querySelectorAll(${JSON.stringify(sel)}));
  var el=null;
  for(var i=0;i<list.length;i++){
    var r=list[i].getBoundingClientRect();
    if(r.width>0&&r.height>0&&list[i].getClientRects().length){ el=list[i]; break; }
  }
  if(!el){
    // 回退：某些入口是隐藏副本（如顶栏档案），点击仍能触发，但无法画涟漪
    if(!list.length) return {ok:false,total:0};
    el=list[0]; el.click();
    return {ok:true,x:null,y:null,total:list.length,label:'(隐藏入口)',ripple:false};
  }
  el.scrollIntoView({block:'nearest'});
  var r=el.getBoundingClientRect();
  var x=r.left+r.width/2, y=r.top+r.height/2;
  if(window.__REC) window.__REC.ripple(x,y);
  el.click();
  return {ok:true,x:Math.round(x),y:Math.round(y),total:list.length,label:(el.textContent||'').trim().slice(0,16)};
})()`);

const setCaption = (cdp, step, text) => cdp.eval(`(function(){ if(window.__REC) window.__REC.caption(${step}, ${JSON.stringify(text)}); })()`);

/* ============ 流程定义 ============ */
function buildSteps() {
  const S = [];
  const add = (sel, label, dwell) => S.push({ sel, label, dwell: dwell || 1100 });
  const note = (label, dwell) => S.push({ sel: null, label, dwell: dwell || 900 });
  const js = (label, expr, dwell) => S.push({ js: expr, label, dwell: dwell || 1100 });

  note('《山野修仙记》V90.10 · 新人开局到核心循环', 1300);
  add('[data-a="choose-role"][data-role="human"]', '选择人族 · 问道', 1200);
  add('[data-a="view-slots"]', '进入档案，选择修行档位', 1200);
  add('[data-a="slot-open"][data-slot="1"]', '选择 001 号空白档', 1200);
  add('[data-a="birth-next"]', '抽取命格资质', 1300);
  add('[data-a="birth-confirm-final"]', '确认入世', 1500);
  js('关闭开场引导', `(function(){var g=document.querySelector('[data-a="guide"]');if(g)g.click();var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();})(),0`);
  js('收起教练浮层', `(function(){var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})(),0`);
  note('主界面：顶部状态栏 / 中部场景资源 / 底部五格导航', 1500);

  for (let i = 0; i < 5; i++) {
    js('采集资源（第 ' + (i + 1) + ' 次）',
      `(function(){var bs=[].slice.call(document.querySelectorAll('[data-a="gather"]')).filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
        var b=bs[0];if(b){var r=b.getBoundingClientRect();if(window.__REC)window.__REC.ripple(r.left+r.width/2,r.top+r.height/2);b.click();}return 0;})(),0`, 1000);
  }
  note('采集到的素材进入随身，负重在顶部与背包同步', 1100);

  add('[data-a="panel"][data-name="pack"]', '打开背包', 1300);
  add('[data-a="panel"][data-name="log"]', '从背包进入「行记」', 1300);
  js('返回背包', `(function(){var b=document.querySelector('[data-a="panel"][data-name="pack"]');if(b)b.click();return 0;})(),0`, 900);
  js('关闭背包', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('[data-a="panel"][data-name="craft"]', '打开炼制', 1400);
  js('炼制第一件工具', `(function(){
    var bs=[].slice.call(document.querySelectorAll('[data-a="craft"]')).filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
    var b=bs[0];if(b){var r=b.getBoundingClientRect();if(window.__REC)window.__REC.ripple(r.left+r.width/2,r.top+r.height/2);b.click();}return 0;})(),0`, 1500);
  js('关闭炼制', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('[data-a="panel"][data-name="camp"]', '打开洞府（选址与建筑）', 1500);
  js('关闭洞府', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('[data-a="panel"][data-name="book"]', '打开图鉴（按类别折叠）', 1500);
  js('展开「灵物」分类', `(function(){var d=document.querySelector('.book-group');if(d){var s=d.querySelector('summary');if(s){var r=s.getBoundingClientRect();if(window.__REC)window.__REC.ripple(r.left+r.width/2,r.top+r.height/2);s.click();}}return 0;})(),0`, 1400);
  js('关闭图鉴', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('[data-a="panel"][data-name="character"]', '打开人物（装备与战力）', 1500);
  js('关闭人物', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('[data-a="panel"][data-name="settings"]', '打开设置（六分区）', 1600);
  js('向下滚动查看其余分区', `(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=p.scrollHeight*0.55;return 0;})(),0`, 1400);
  js('继续滚动到底部', `(function(){var p=document.getElementById('panel-body');if(p)p.scrollTop=p.scrollHeight;return 0;})(),0`, 1400);
  js('关闭设置', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('#quest', '打开主线任务指引', 1500);
  js('关闭主线', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  add('[data-a="panel"][data-name="help"]', '打开完整教程', 1500);
  js('关闭教程', `(function(){var c=document.querySelector('.panel-close');if(c)c.click();return 0;})(),0`, 800);

  note('至此覆盖：开档 → 采集 → 行记 → 背包 → 炼制 → 洞府 → 图鉴 → 人物 → 设置 → 主线 → 教程', 2000);

  return PILOT ? S.slice(0, 16) : S;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const steps = buildSteps();
  const srv = await serve(ROOT);
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const port = 9995;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp, n = 0;
  const manifest = [];
  try {
    await waitDebug(port);
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: origin + '/index.html' });
    await cdp.waitFor("typeof window.QData === 'object'");
    await sleep(800);
    await cdp.eval(OVERLAY);
    await sleep(300);

    for (const st of steps) {
      n++;
      // 每步先清掉上一步的涟漪，确保画面里只出现当前这一次点击
      await cdp.eval(`(function(){ if(window.__REC) window.__REC.clearRipple(); })()`);
      await setCaption(cdp, n, st.label);
      await sleep(60);
      let hit = true;
      if (st.sel) {
        const r = await tapInPage(cdp, st.sel);
        hit = !!r.ok;
        if (!hit) console.log(`  跳过（未找到）第 ${n} 步: ${st.sel}`);
      } else if (st.js) {
        const code = st.js.replace(/,\s*0$/, '');
        await cdp.eval(code.endsWith(';') ? code : code + ';');
      }
      await sleep(st.dwell);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(FRAMES, String(n).padStart(4, '0') + '.png');
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      manifest.push({ n, label: st.label, sel: st.sel || null, hit, dwell: st.dwell });
      console.log(`  ${String(n).padStart(3)}/${steps.length}  ${st.label}${hit ? '' : '  [未命中]'}`);
    }
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }

  fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // ---- 合成 MP4 ----
  const listFile = path.join(OUT, 'concat.txt');
  const lines = [];
  for (const m of manifest) {
    const f = path.join(FRAMES, String(m.n).padStart(4, '0') + '.png').replace(/\\/g, '/');
    lines.push(`file '${f}'`);
    lines.push(`duration ${(m.dwell / 1000).toFixed(3)}`);
  }
  if (manifest.length) {
    const last = path.join(FRAMES, String(manifest[manifest.length - 1].n).padStart(4, '0') + '.png').replace(/\\/g, '/');
    lines.push(`file '${last}'`);
  }
  fs.writeFileSync(listFile, lines.join('\n') + '\n', 'utf8');

  const mp4 = path.join(OUT, 'shanhe-v90.10-playthrough.mp4');
  const ff = 'ffmpeg';
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-fps_mode', 'vfr', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-movflags', '+faststart', mp4];
  const r = spawn(ff, args, { stdio: 'inherit' });
  await new Promise((res) => r.on('close', res));
  if (fs.existsSync(mp4)) {
    const st = fs.statSync(mp4);
    console.log(`\n成片: ${mp4}`);
    console.log(`  大小 ${(st.size / 1048576).toFixed(2)} MB，${manifest.length} 步`);
  } else {
    console.log('\nffmpeg 未能生成 MP4，帧仍在 ' + FRAMES);
  }
})();
