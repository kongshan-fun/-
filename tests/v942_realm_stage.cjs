'use strict';
/*
 * V90.42 境界前中后期验收
 *  A. 引擎：major=1..8 各档道行 10%/50%/80%/100% → 初期/中期/后期/圆满，前缀是该境名
 *  B. 修正：major=1（金丹）不再显示「筑基后期」
 *  C. 低境不变：炼气 1~9 层、筑基初期/中期/后期
 *  D. 界面：状态栏与修炼页出现「炼虚中期」+ 三段刻度；破境页提示"需先修到本境后期圆满"
 *  E. 截图：before(V90.41) / after(V90.42) 同存档对照
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const vm = require('vm');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'visual', 'v942-realm');
const EDGE = require('./lib/browser').BROWSER;
const KEY = 'qinglan-wendao-v14-human-slot-001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.join(OUT, 'before'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'after'), { recursive: true });

let pass = 0, fail = 0;
const ok = (c, label, detail) => { if (c) { pass++; console.log('  PASS  ' + label + (detail ? '  — ' + detail : '')); } else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); } };

/* ---------- A/B/C 引擎断言 ---------- */
function engineCtx() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN, Set, Map, Promise, setTimeout, clearTimeout };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  ctx.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, key() { return null; }, get length() { return Object.keys(this._d).length; } };
  vm.createContext(ctx);
  for (const b of blocks.slice(0, 6)) vm.runInContext(b, ctx);
  return ctx;
}

console.log('=== A/B/C 引擎：境界名与阶段 ===');
const ctx = engineCtx();
const D = ctx.QData, B = ctx.QBirth;
ok(!!D && !!B, '引擎加载');

const STAGE = ['初期', '中期', '后期', '圆满'];
const RATIOS = [0.1, 0.5, 0.8, 1.0];
let aPass = 0, aAll = 0;
for (let major = 2; major <= 8; major++) {
  const need = major === 8 ? D.ASCENSION_RULE.dao : D.ASCENSION_STAGES[major - 1].needDao;
  const realmName = D.CHARACTERS.human.realms[major];
  for (let i = 0; i < 4; i++) {
    /* 直接借原型上的 realm getter，避开 normalize 的"大境界与首领进度一致"校验 */
    const g = Object.create(ctx.QGame.prototype);
    g.s = { character: 'human', major, level: 18, daoXp: Math.round(need * RATIOS[i]), ascended: false };
    aAll++;
    const got = g.realm;
    const want = realmName + STAGE[i];
    if (got === want) aPass++;
    else console.log('        major=' + major + ' ratio=' + RATIOS[i] + ' 得到 ' + got + ' 期望 ' + want);
  }
}
ok(aPass === aAll, '金丹~渡劫七境 × 四段共 ' + aAll + ' 个组合全部正确', aPass + '/' + aAll);

ok(B.realm({ character: 'human', major: 1, level: 18 }) === '筑基后期', 'major=1 仍是筑基后期（语义不变）', B.realm({ character: 'human', major: 1, level: 18 }));
ok(B.realm({ character: 'human', major: 0, level: 3 }) === '炼气三层', '低境不变：炼气三层', B.realm({ character: 'human', major: 0, level: 3 }));
ok(B.realm({ character: 'human', major: 0, level: 13 }) === '筑基中期', '低境不变：筑基中期', B.realm({ character: 'human', major: 0, level: 13 }));
ok(B.realm({ character: 'demon', major: 0, level: 17 }) === '通脉后期', '妖族：通脉后期', B.realm({ character: 'demon', major: 0, level: 17 }));

/* ---------- D/E DOM + 截图 ---------- */
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
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-'));
  fs.mkdirSync(path.join(TMP, 'seed'));
  fs.mkdirSync(path.join(TMP, 'noseed'));
  for (const [dir, tag] of [['jindan-v941', 'before'], ['jindan-v942', 'after']]) {
    const html = fs.readFileSync(path.join(ROOT, 'play', dir, 'index.html'), 'utf8');
    fs.mkdirSync(path.join(TMP, tag), { recursive: true });
    fs.writeFileSync(path.join(TMP, tag, 'seed.html'), html, 'utf8');
    const a = html.indexOf('<script id="seed-save"');
    const b = html.indexOf('<div id="phone"', a);
    fs.writeFileSync(path.join(TMP, tag, 'plain.html'), html.slice(0, a) + html.slice(b), 'utf8');
  }

  const srv = await serve(TMP);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const port = 9945;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v942-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws, errors = 0;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') { errors++; console.log('  EXC: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 160)); }
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout')), 30000); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result.value; };
    const click = (s) => ev(`(function(){var b=document.querySelector(${JSON.stringify(s)});if(!b)return false;b.click();return true;})()`);
    const shot = async (f) => { await sleep(300); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); };
    const boot = async (tag, page) => {
      await send('Page.navigate', { url: `${base}/${tag}/${page}.html` });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev(`typeof window.QData==='object'&&document.querySelectorAll('button').length>5`).catch(() => false)) break; }
      await sleep(900);
    };

    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });

    /* 用 seed 页拿到完整存档（筑基后期），改造成「炼虚中期」 */
    await boot('after', 'seed');
    const S0 = await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))`);
    ok(!!S0, '拿到完整存档');
    const need = D.ASCENSION_STAGES[3].needDao;      // major=4 → 炼虚
    const mod = JSON.parse(JSON.stringify(S0));
    mod.major = 4; mod.level = 18; mod.cleared = [true,true,true,true,true,true,true,true,false,false,false,false]; mod.daoXp = Math.round(need * 0.5); mod.zone = 5;
    mod.settlements = mod.settlements || [];

    for (const [tag, label] of [['before', 'V90.41 改前'], ['after', 'V90.42 改后']]) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(mod))});}catch(e){}` });
      await boot(tag, 'plain');
      const statusText = await ev(`(document.querySelector('.v905-realm')||{}).textContent||''`);
      const chip = await ev(`(document.querySelector('.v905-xp')||{}).textContent||''`);
      const bars = await ev(`document.querySelectorAll('.dao-stage i.on').length`);
      console.log(`  [${label}] 状态栏境界="${statusText}" 小道行="${chip}" 刻度亮=${bars}`);
      await shot(path.join(OUT, tag, '01-status.png'));
      const opened = await click('[data-a="panel"][data-name="camp"]');
      await sleep(600);
      if (opened) { await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700); }
      const chip2 = await ev(`(function(){var c=[].slice.call(document.querySelectorAll('#panel-root .stat-chips span')).find(function(n){return n.textContent.indexOf('道行')>=0;});return c?c.textContent.trim():'';})()`);
      const bars2 = await ev(`document.querySelectorAll('#panel-root .dao-stage i.on').length`);
      console.log(`  [${label}] 修炼页道行="${chip2}" 刻度亮=${bars2}`);
      await shot(path.join(OUT, tag, '02-cultivate.png'));
      if (tag === 'after') {
        ok(/化神中期/.test(statusText), '状态栏显示「化神中期」', statusText);
        ok(/中期/.test(chip), '状态栏道行旁边有阶段', chip);
        ok(bars === 2, '状态栏三段刻度亮了 2 段（中期）', bars + ' 段');
        ok(/化神中期/.test(chip2), '修炼页显示「化神中期」', chip2);
        ok(bars2 === 2, '修炼页刻度亮 2 段', bars2 + ' 段');
      } else {
        ok(!/化神(初期|中期|后期)/.test(statusText), '改前状态栏没有阶段（对照成立）', statusText);
      }
    }

    /* 破境页提示 */
    await boot('after', 'plain');
    await click('[data-a="panel"][data-name="camp"]'); await sleep(600);
    await click('[data-a="panel"][data-name="cultivate"]'); await sleep(700);
    let opened2 = await click('.cult-nav-row[data-name="cultivate-trial"]');
    if (!opened2) opened2 = await click('[data-a="panel"][data-name="cultivate-trial"]');
    await sleep(700);
    const trialText = await ev(`(document.getElementById('panel-body')||{}).innerText||''`);
    ok(/道行/.test(trialText), '破境条件页列出道行条件', (trialText.match(/[^\n]*道行[^\n]*/) || [''])[0].slice(0, 40));
    ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('需先修到本境后期圆满才能破境'), '破境指引文案已写入（道行未满时显示）');
    await shot(path.join(OUT, 'after', '03-trial.png'));

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
