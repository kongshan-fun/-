'use strict';
/**
 * V90.10 全流程通关机器人（加速）
 * 目标：从 0 境一路推到飞升，只走真实 UI 点击；资源/道行/等级用加速注入，不修改产品文件。
 * 找不到入口时打印当前可见按钮并中止 -> 用来定位「流程跑不通」的具体卡点。
 *
 * 用法： node tests/v910_clear_bot.cjs [--max-realms=12] [--dwell=260]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'visual', 'v910-clear');
const FRAMES = path.join(OUT, 'frames');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const W = 390, H = 844;

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith('--' + k + '='));
  return m ? Number(m.split('=')[1]) : d;
};
const MAX_REALMS = arg('max-realms', 12);
const DWELL = arg('dwell', 260);

const HOOK = `
window.__BOT={
  g:function(){return game;},
  s:function(){return game.s;},
  topUp:function(){
    var s=game.s;
    for(var k in D.ITEMS) s.inv[k]=2000;
    s.daoXp=99999; s.level=18; s.minutes+=0;
    s.hp=s.maxHp; s.spirit=s.maxSpirit; s.hunger=100; s.water=100;
    if(s.life) s.life.left=Math.max(s.life.left,999*D.LIFE.yearMinutes);
    render();
    return true;
  },
  snapshot:function(){
    var s=game.s,z=s.zone;
    var st=D.ASCENSION_STAGES[z-5]||null;
    return {
      zone:z, major:s.major, level:s.level, daoXp:s.daoXp,
      lifeYears:+game.lifeYears.toFixed(1),
      ritual:!!s.ritual[z], cleared:!!s.cleared[z],
      settled:!!s.settlements[z], atCamp:!!game.atCamp,
      ascended:!!s.ascended, ended:!!s.ended,
      combat:!!s.combat,
      coreTrial:s.flags.coreTribulation?{...s.flags.coreTribulation}:null,
      heartTrial:s.flags.heartTrial?s.flags.heartTrial:null,
      needDao: st?st.needDao:null,
      primary: st?st.primary:null, secondary: st?st.secondary:null,
      panel: (typeof panel!=='undefined')?panel:null,
      modal: (typeof modal!=='undefined'&&modal)?modal.kind:null
    };
  },
  visible:function(){
    var out=[];
    for(var el of document.querySelectorAll('[data-a]')){
      var r=el.getBoundingClientRect();
      if(!(r.width>0&&r.height>0)||el.getClientRects().length===0) continue;
      out.push({a:el.getAttribute('data-a'),n:el.getAttribute('data-name')||'',
                i:el.getAttribute('data-index')||el.getAttribute('data-id')||'',
                t:(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,14)});
    }
    return out;
  },
  openPanel:function(name){ panel=name; render(); return true; },
  closePanel:function(){ panel=null; render(); return true; }
};`;

const OVERLAY = `
(function(){
  if(window.__MARK) return;
  var d=document.createElement('div');
  d.id='__mark';
  d.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;display:none;'+
    'width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#ff2d55;'+
    'box-shadow:0 0 0 3px rgba(255,45,85,.35),0 0 8px rgba(255,45,85,.6)';
  document.documentElement.appendChild(d);
  var cap=document.createElement('div');
  cap.id='__cap';
  cap.style.cssText='position:fixed;left:0;right:0;bottom:0;height:44px;display:flex;align-items:center;gap:8px;'+
    'padding:0 12px;background:#141414;color:#fff;font:12.5px/1.3 system-ui,-apple-system,"Microsoft YaHei",sans-serif;z-index:2147483647';
  cap.innerHTML='<span id="__capN" style="opacity:.6;font-variant-numeric:tabular-nums"></span><span id="__capT"></span>';
  document.documentElement.appendChild(cap);
  var st=document.createElement('style');
  st.textContent='body{align-items:flex-start!important}.phone{height:calc(100dvh - 44px)!important;max-height:calc(100dvh - 44px)!important}html,body{overflow:hidden!important}';
  document.head.appendChild(st);
  window.__MARK={
    mark:function(x,y){var e=document.getElementById('__mark');if(!e)return;e.style.display='block';
      e.style.left=x+'px';e.style.top=y+'px';},
    clear:function(){var e=document.getElementById('__mark');if(e)e.style.display='none';},
    cap:function(n,t){var a=document.getElementById('__capN'),b=document.getElementById('__capT');
      if(a)a.textContent=n?String(n).padStart(3,'0'):'';if(b)b.textContent=t||'';}
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
      fs.readFile(f, (e, b) => { if (e) { rsp.writeHead(404).end(); return; } rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(b); });
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
}

async function waitDebug(port) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return; } catch {}
    await sleep(150);
  }
  throw new Error('devtools');
}

/* 可见元素点击 + 最小标记 */
const tap = (cdp, sel) => cdp.eval(`(function(){
  var list=[].slice.call(document.querySelectorAll(${JSON.stringify(sel)}));
  var el=null;
  for(var i=0;i<list.length;i++){var r=list[i].getBoundingClientRect();
    if(r.width>0&&r.height>0&&list[i].getClientRects().length){el=list[i];break;}}
  if(!el){ if(!list.length) return {ok:false}; el=list[0]; el.click(); return {ok:true,hidden:true}; }
  var r=el.getBoundingClientRect();
  if(window.__MARK) window.__MARK.mark(r.left+r.width/2, r.top+r.height/2);
  el.click();
  return {ok:true,x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};
})()`);

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const srv = await serve(ROOT);
  const port = 9999;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp, n = 0, srv2 = null;
  const log = [];
  const trail = [];
  try {
    await waitDebug(port);
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });

    // 注入 bot 钩子（锚点 window.QinglanDemo= 在 IIFE 内）
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const anchor = 'window.QinglanDemo=';
    if (html.split(anchor).length - 1 !== 1) throw new Error('注入锚点不唯一，已中止');
    const patched = html.replace(anchor, HOOK + '\n' + anchor);
    const td = fs.mkdtempSync(path.join(os.tmpdir(), 'page-'));
    fs.writeFileSync(path.join(td, 'index.html'), patched, 'utf8');
    srv2 = await serve(td);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${srv2.address().port}/index.html` });

    for (let i = 0; i < 200; i++) { try { if (await cdp.eval("typeof window.__BOT==='object'")) break; } catch {} await sleep(150); }
    await sleep(800);
    await cdp.eval(OVERLAY);
    await sleep(200);

    const shot = async (label) => {
      n++;
      await cdp.eval(`window.__MARK && window.__MARK.cap(${n}, ${JSON.stringify(label)})`);
      await sleep(40);
      const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(FRAMES, String(n).padStart(4, '0') + '.png'), Buffer.from(s.data, 'base64'));
      trail.push({ n, label, at: Date.now() });
    };
    const snap = () => cdp.eval('window.__BOT.snapshot()');
    const visible = () => cdp.eval('window.__BOT.visible()');
    const doTap = async (sel, label) => {
      await cdp.eval('window.__MARK && window.__MARK.clear()');
      const r = await tap(cdp, sel);
      if (!r.ok) return false;

      return true;
    };

    // 开局：选族 → 档案 → 001 → 命格 → 入世
    await doTap('[data-a="choose-role"][data-role="human"]', '选择人族');
    await doTap('[data-a="view-slots"]', '进入档案');
    await doTap('[data-a="slot-open"][data-slot="1"]', '选择 001 档');
    await doTap('[data-a="birth-next"]', '抽取命格');
    await doTap('[data-a="birth-confirm-final"]', '确认入世');
    await cdp.eval(`(function(){var g=document.querySelector('[data-a="guide"]');if(g)g.click();var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(400);
    await shot('入世完成');

    let stall = null;
    for (let realm = 0; realm <= MAX_REALMS && !stall; realm++) {
      let st = await snap();
      console.log('  [第 '+(st.zone+1)+' 境] major='+st.major+' ritual='+st.ritual+' cleared='+st.cleared+' settled='+st.settled);
      if (st.ascended) { log.push({ realm: 'ASCENDED', st }); break; }

      for (let guard = 0; guard < 26 && !stall; guard++) {
        st = await snap();
        if (st.ascended) break;

        // 每轮补齐加速资源
        await cdp.eval('window.__BOT.topUp && window.__BOT.topUp()');
        await sleep(60);

        // 1) 未定居 → 定居
        if (!st.settled) {
          await cdp.eval('window.__BOT.openPanel && window.__BOT.openPanel("camp")');
          await sleep(200);
          const okSettle = await doTap('[data-a="plan-settle"]', `第${st.zone + 1}境 · 选址筑庐`);
          if (!okSettle) {
            const m = await cdp.eval(`(function(){var d=document.querySelector('[data-a="plan-settle"]');return {why:game? '':''};})()`);
            const vis = await visible();
            stall = { at: 'settle', realm: st.zone, visible: vis };
            break;
          }
          // 定居确认弹窗
          await cdp.eval(`(function(){var b=document.querySelector('[data-a="confirm-settle"], .modal-backdrop [data-a="confirm-settle"]');if(b)b.click();})()`);
          await sleep(DWELL);
          continue;
        }

        // 2) 问道坛（gate 建筑）
        if (!st.ritual) {
          await cdp.eval('window.__BOT.openPanel && window.__BOT.openPanel("camp")');
          await sleep(200);
          const okGate = await doTap('[data-a="build"][data-id="gate"]', `第${st.zone + 1}境 · 修问道坛`);
          if (!okGate) {
            const vis = await visible();
            stall = { at: 'gate', realm: st.zone, visible: vis };
            break;
          }
          continue;
        }

        // 3) 首领
        if (!st.cleared) {
          await cdp.eval('window.__BOT.closePanel && window.__BOT.closePanel()');
          await sleep(150);
          const okBoss = await doTap('[data-a="challenge"]', `第${st.zone + 1}境 · 挑战首领`);
          if (!okBoss) {
            const vis = await visible();
            stall = { at: 'boss', realm: st.zone, visible: vis };
            break;
          }
          continue;
        }

        // 4) 破境
        await cdp.eval('window.__BOT.openPanel && window.__BOT.openPanel("cultivate")');
        await sleep(200);
        const okBreak = await doTap('[data-a="breakthrough"]', `第${st.zone + 1}境 · 破境`);
        if (!okBreak) {
          const vis = await visible();
          stall = { at: 'breakthrough', realm: st.zone, visible: vis };
          break;
        }
        const after = await snap();
        log.push({ realm: st.zone, majorBefore: st.major, majorAfter: after.major, zoneAfter: after.zone });
        if (after.zone === st.zone && after.major === st.major) {
          stall = { at: 'no-progress', realm: st.zone, after };
          break;
        }
      }
    }

    const fin = await snap();
    console.log('\n=== 通关机器人结果 ===');
    console.log('  最终状态:', JSON.stringify(fin));
    console.log('  推进记录:');
    for (const r of log) console.log('    ' + JSON.stringify(r));
    if (stall) {
      console.log('\n  !! 卡住位置: ' + stall.at + '  第 ' + (stall.realm + 1) + ' 境');
      console.log('  当时可见按钮:');
      const vs = stall.visible || [];
      const uniq = [...new Set(vs.map((v) => `${v.a}${v.n ? ' name=' + v.n : ''}${v.i ? ' id=' + v.i : ''} "${v.t}"`))];
      for (const u of uniq.slice(0, 40)) console.log('    ' + u);
    }
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ final: fin, log, stall, frames: n }, null, 2), 'utf8');
    process.exitCode = stall ? 2 : 0;
  } catch (e) {
    console.error('BOT FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    try { srv.close(); } catch { }
    try { if (srv2) srv2.close(); } catch { }
  }
  console.log('\n帧数: ' + n + '  (' + FRAMES + ')');
})();
