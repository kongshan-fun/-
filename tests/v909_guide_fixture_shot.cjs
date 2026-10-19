'use strict';
/* 把 progGuide 的真实渲染结果套上游戏自身的 <style> 生成独立夹具页面并截图。
   注意：这是「指引卡渲染夹具」，不是完整 H5 端到端截图，证据文档里必须这样标注。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'visual', 'v909');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);

const ctx = vm.createContext({ console });
ctx.globalThis = ctx;
for (let i = 0; i <= 5; i++) vm.runInContext(blocks[i], ctx, { timeout: 10000 });
const Game = ctx.QGame;
const D = ctx.QData;

function state(zone, major, opts = {}) {
  const s = Game.fresh(20261018, opts.race || 'human');
  s.zone = zone; s.major = major; s.unlocked = zone + 1;
  s.hunger = 100; s.water = 100; s.hp = s.maxHp; s.spirit = s.maxSpirit;
  s.life.left = 200 * D.LIFE.yearMinutes;
  s.pos = { x: 1, y: 5 }; s.last = { ...s.pos };
  for (let i = 0; i < zone; i++) s.cleared[i] = true;
  s.settlements[zone] = { pos: { ...s.pos }, level: 3, buildings: { warehouse: 3, forge: 3, alchemy: 3, quiet: 3, farm: 2 }, stash: {}, storedGears: [], foundedAt: s.minutes, farmAt: s.minutes };
  for (const id of Object.keys(D.ITEMS)) s.inv[id] = 1000;
  s.storageBags = {};
  s.ritual[zone] = true; s.cleared[zone] = true; s.level = 18; s.daoXp = 999;
  Object.assign(s, opts.patch || {});
  return s;
}

const cases = [
  { file: 'prog-guide-golden.html', title: '金丹 · 条件未满足（道行与道材不足）',
    s: state(5, 1, { patch: { daoXp: 42, inv: Object.assign({}, state(5, 1).inv, { coreOre: 1, coreHerb: 1 }) } }) },
  { file: 'prog-guide-ready.html', title: '金丹 · 全部条件满足（正式突破）',
    s: state(5, 1, {}) },
];

// 让 coreTrial 完成，使「全部满足」成立
cases[1].s.flags.coreTribulation = { phase: 3, marks: 3, started: true, complete: true };

const guideSrc = fs.readFileSync(path.join(ROOT, 'tools', 'v909-progression.js'), 'utf8');

function render(s) {
  const g = new Game(s, 261014, s.character || 'human');
  const c = vm.createContext({ console, game: g, D, esc: (x) => String(x) });
  c.globalThis = c;
  vm.runInContext(guideSrc, c, { timeout: 10000 });
  return c.progGuide('core');
}

const pages = cases.map((cs) => {
  const card = render(cs.s);
  return { file: cs.file, title: cs.title, card };
});

// 写夹具页：沿用游戏自身全部 <style>，只把卡片放进 #panel-root 语境
for (const p of pages) {
  const doc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.title}</title>
<style>${styles.join('\n')}</style>
<style>body{margin:0;padding:12px;font-family:system-ui,-apple-system,"Noto Sans SC",sans-serif}
#panel-root{max-width:390px;margin:0 auto}
.fixture-note{max-width:390px;margin:0 auto 10px;font-size:11px;line-height:1.6;color:#666}</style>
</head><body><div id="panel-root"><p class="fixture-note">V90.9 阶段成长指引 · 渲染夹具（非完整 H5 截图）：${p.title}</p>${p.card}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, p.file), doc, 'utf8');
  console.log('wrote', p.file, doc.length, 'chars');
}

/* ---- 截图 ---- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(f, (e, b) => { if (e) { rsp.writeHead(404).end(); return; } rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(b); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
(async () => {
  const srv = await serve(ROOT);
  const port = 9951;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-'));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res) => ws.addEventListener('open', res, { once: true }));
    let id = 1; const pend = new Map();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res) => { const i = id++; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Page.enable', {});
    for (const p of pages) {
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 2, mobile: true });
      await send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/visual/v909/${p.file}` });
      await sleep(900);
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const out = path.join(OUT, p.file.replace('.html', '.png'));
      fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
      console.log('shot', path.basename(out));
    }
    try { ws.close(); } catch {}
    try { await send('Browser.close', {}); } catch {}
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { await sleep(300); try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} srv.close(); }
})();
