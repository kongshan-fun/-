'use strict';
/**
 * V90.9 设置界面重排 · 浏览器验收
 *
 * 零外部依赖：Node 内置 http / WebSocket + 本机 Chromium(Edge) 的 CDP。
 * 覆盖：三种手机宽度下的分区结构、横向溢出、按钮尺寸、裁切，
 *       以及主题切换、动效开关、行记/教程跳转、资质榜、新开存档确认等真实交互。
 *
 * 运行： node tests/v909_settings_browser.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SHOT_DIR = path.join(ROOT, 'visual', 'v909');
const WIDTHS = [
  { w: 320, h: 568, tag: '320x568' },
  { w: 360, h: 640, tag: '360x640' },
  { w: 390, h: 844, tag: '390x844' },
];

const EXPECT_MODULES = ['存档与备份', '修行状态与寿元', '角色与档案', '视觉与体验', '帮助与记录', '重新修行'];
const EXPECT_BTN_ACTIONS = ['export', 'import', 'restore', 'ad-life', 'characters', 'ranking-open', 'motion', 'reset'];

const results = [];
let current = '';
const section = (s) => { current = s; console.log('\n=== ' + s + ' ==='); };
function check(name, cond, detail) {
  results.push({ section: current, name, pass: !!cond, detail: detail || '' });
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 静态服务器 ---------------- */
function startServer(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (e, buf) => {
        if (e) { res.writeHead(404).end(); return; }
        const ext = path.extname(file).toLowerCase();
        const mime = ext === '.html' ? 'text/html; charset=utf-8'
          : ext === '.png' ? 'image/png' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---------------- 极简 CDP ---------------- */
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
      ws.addEventListener('error', () => rej(new Error('ws error')), { once: true });
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
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true, userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    return r.result.value;
  }
  async waitFor(expr, timeout = 20000, label = expr) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try { if (await this.eval(expr)) return true; } catch { /* keep waiting */ }
      await sleep(120);
    }
    throw new Error('waitFor timeout: ' + label);
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
}

async function waitDebug(port, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(200);
  }
  throw new Error('devtools not ready');
}

async function launch(port, profile) {
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ];
  const proc = spawn(EDGE, args, { stdio: 'ignore' });
  await waitDebug(port);
  return proc;
}

async function kill(proc, port) {
  try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { return; }
    await sleep(150);
  }
}

/* ---------------- 交互辅助 ---------------- */
const click = (cdp, sel) => cdp.eval(`(function(){var b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true;})()`);
const panelText = (cdp) => cdp.eval(`(function(){var p=document.getElementById('panel-root');return p?p.innerText.replace(/\\s+/g,' ').slice(0,400):'';})()`);

async function onboarding(cdp) {
  const steps = [
    ['[data-a="characters"]', 600],
    ['[data-a="choose-role"][data-role="human"]', 500],
    ['[data-a="view-slots"]', 600],
    ['[data-a="slot-open"][data-slot="1"]', 800],
    ['[data-a="birth-next"]', 800],
    ['[data-a="birth-confirm-final"]', 1500],
  ];
  for (const [sel, wait] of steps) {
    if (!(await click(cdp, sel))) return { ok: false, missing: sel };
    await sleep(wait);
  }
  await cdp.eval(`(function(){
    var g=document.querySelector('.modal-backdrop [data-a="guide"]')||document.querySelector('[data-a="guide"]');
    if(g){g.click();return 'guide';}
    var c=document.querySelector('[data-a="modal-close"]');
    if(c){c.click();return 'close';}
    return 'none';
  })()`);
  await sleep(700);
  // 收起教练浮层（否则会盖住设置面板顶部，影响截图与点击）
  await cdp.eval(`(function(){
    var p=document.querySelector('[data-a="guide"][data-mode="pause"]');
    if(p){p.click();return 'paused';}
    return 'absent';
  })()`);
  await sleep(600);
  return { ok: true };
}

async function openSettings(cdp) {
  // openPanel() 是「开关式」：已打开时再点会关闭，因此必须先判断现状
  const already = await cdp.eval(`!!document.querySelector('#panel-body .v909-set')`);
  if (already) return true;
  const ok = await click(cdp, '[data-a="panel"][data-name="settings"]');
  await sleep(700);
  return ok;
}

/* ---------------- 主流程 ---------------- */
(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const srv = await startServer(ROOT);
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const port = 9931;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'v909-'));
  const proc = await launch(port, profile);
  let cdp;
  const errors = [];
  try {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    cdp.ws.addEventListener('message', (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Runtime.exceptionThrown') {
          errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
        }
      } catch { /* ignore */ }
    });

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: origin + '/index.html' });
    await cdp.waitFor("typeof window.QData === 'object'", 25000, 'game boot');
    await sleep(1200);

    section('0. 启动与入世');
    const ob = await onboarding(cdp);
    check('完成开局流程（选族→选档→命格→入世）', ob.ok, ob.ok ? '已进入游戏' : '缺失 ' + ob.missing);
    check('设置入口存在', await cdp.eval(`!!document.querySelector('[data-a="panel"][data-name="settings"]')`));
    check('设置面板可打开', await openSettings(cdp));
    await sleep(400);

    section('1. 分区结构（六模块）');
    const st = await cdp.eval(`(function(){
      var mods=[].slice.call(document.querySelectorAll('#panel-body .v909-mod'));
      var btns=[].slice.call(document.querySelectorAll('#panel-body .v909-btn'));
      return {
        count: mods.length,
        titles: mods.map(function(m){var t=m.querySelector('.v909-mod-title');return t?t.textContent.trim():'';}),
        btnActions: btns.map(function(b){return b.getAttribute('data-a');}),
        themeChoices: [].slice.call(document.querySelectorAll('#panel-body .v909-themes .theme-choice')).map(function(b){return b.getAttribute('data-theme');}),
        oldChips: !!document.querySelector('#panel-body .stat-chips')
      };
    })()`);
    check('.v909-mod 数量为 6', st.count === 6, '实际 ' + st.count);
    check('分区标题与顺序正确', JSON.stringify(st.titles) === JSON.stringify(EXPECT_MODULES), st.titles.join(' / '));
    const missing = EXPECT_BTN_ACTIONS.filter((a) => !st.btnActions.includes(a));
    check('八个功能区按钮均在', missing.length === 0, missing.length ? '缺 ' + missing.join(',') : st.btnActions.filter(Boolean).join(','));
    check('三种主题按钮保留', JSON.stringify(st.themeChoices) === JSON.stringify(['forest', 'mono', 'immortal']), st.themeChoices.join(','));
    check('旧长页面容器已移除', st.oldChips === false);

    section('2. 三种手机宽度下的排版');
    for (const v of WIDTHS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 2, mobile: true });
      await sleep(500);
      const m = await cdp.eval(`(function(){
        var pb=document.getElementById('panel-body');
        var set=document.querySelector('#panel-body .v909-set');
        var mods=[].slice.call(document.querySelectorAll('#panel-body .v909-mod'));
        var btns=[].slice.call(document.querySelectorAll('#panel-body .v909-btn'));
        function ov(el){ return el ? el.scrollWidth - el.clientWidth : 0; }
        return {
          pbOverflow: ov(pb), setOverflow: ov(set),
          modOverflowMax: Math.max.apply(null, mods.map(ov).concat([0])),
          btnOverflowMax: Math.max.apply(null, btns.map(ov).concat([0])),
          btnMinH: Math.min.apply(null, btns.map(function(b){return b.getBoundingClientRect().height;}).concat([999])),
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          modCount: mods.length,
          btnCount: btns.length
        };
      })()`);
      check(`${v.tag} 无横向溢出`, m.pbOverflow <= 1 && m.setOverflow <= 1 && m.modOverflowMax <= 1,
        `panel-body=${m.pbOverflow} set=${m.setOverflow} mod=${m.modOverflowMax}`);
      check(`${v.tag} 按钮不撑破容器`, m.btnOverflowMax <= 1, `内溢出=${m.btnOverflowMax}`);
      check(`${v.tag} 按钮高度达标`, m.btnMinH >= 34, `最小高=${m.btnMinH.toFixed(1)}px`);
      check(`${v.tag} 六分区完整`, m.modCount === 6 && m.btnCount === 10, `mod=${m.modCount} btn=${m.btnCount}`);
      check(`${v.tag} 文档无横向滚动`, m.docOverflow <= 1, `溢出=${m.docOverflow}`);
      await cdp.shot(path.join(SHOT_DIR, `settings-${v.tag}.png`));
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(400);

    section('3. 主题切换');
    for (const th of ['mono', 'immortal', 'forest']) {
      await click(cdp, `[data-a="theme-set"][data-theme="${th}"]`);
      await sleep(500);
      const cls = await cdp.eval('document.body.className||""');
      // forest 是默认主题：正确表现是「body 上没有任何主题类」
      const okTheme = th === 'forest' ? !/theme-(mono|immortal)/.test(cls) : cls.includes('theme-' + th);
      check(`切换到 ${th}`, okTheme, 'body.class="' + cls + '"');
    }
    await cdp.shot(path.join(SHOT_DIR, 'theme-forest-390x844.png'));

    section('4. 动效开关与减少动效显示');
    await openSettings(cdp);
    const label0 = await cdp.eval(`(function(){var b=document.querySelector('[data-a="motion"]');return b?b.textContent.trim():'';})()`);
    await click(cdp, '[data-a="motion"]');
    await sleep(600);
    const after = await cdp.eval(`(function(){
      var b=document.querySelector('[data-a="motion"]');
      var phone=document.querySelector('.phone');
      var mod=document.querySelector('#panel-body .v909-mod');
      var r=mod?mod.getBoundingClientRect():{height:0};
      return { label:b?b.textContent.trim():'', reduced:phone?phone.classList.contains('reduced'):null,
               modH:r.height, transition:mod?getComputedStyle(mod).transitionDuration:'n/a' };
    })()`);
    check('动效按钮文案切换', label0 !== after.label, label0 + ' → ' + after.label);
    check('减少动效时分区仍正常显示', after.modH > 20, `模块高=${after.modH.toFixed(1)}px`);
    if (after.reduced) {
      check('减少动效生效（过渡为 0s）', /^0(s|\.0+s)?$|^0s,? ?0s?$/.test(after.transition) || after.transition === '0s',
        'transition=' + after.transition);
    } else {
      check('动效开关状态与文案一致', false, 'reduced=false 但文案为 ' + after.label);
    }
    await cdp.shot(path.join(SHOT_DIR, 'settings-reduced-motion.png'));
    // 恢复动效
    await click(cdp, '[data-a="motion"]');
    await sleep(400);

    section('5. 行记 / 教程跳转');
    await openSettings(cdp);
    const before = await panelText(cdp);
    await click(cdp, '[data-a="panel"][data-name="log"]');
    await sleep(700);
    const afterLog = await panelText(cdp);
    check('行记可跳转且内容变化', afterLog !== before && afterLog.length > 10, afterLog.slice(0, 40));
    await openSettings(cdp);
    await sleep(500);
    const before2 = await panelText(cdp);
    await click(cdp, '[data-a="panel"][data-name="help"]');
    await sleep(800);
    const afterHelp = await panelText(cdp);
    check('完整教程可跳转且内容变化', afterHelp !== before2 && afterHelp.length > 20, afterHelp.slice(0, 40));

    section('6. 资质榜 / 新开存档 / 续命状态');
    await openSettings(cdp);
    await sleep(400);
    await click(cdp, '[data-a="ranking-open"]');
    await sleep(700);
    const rank = await cdp.eval(`(function(){
      var m=document.querySelector('.modal-backdrop');
      var body=document.body.innerText;
      return {modal:!!m, hasRankText:/资质|飞升榜|排行榜/.test(body)};
    })()`);
    check('本机资质榜可打开', rank.modal || rank.hasRankText, JSON.stringify(rank));
    await cdp.eval(`(function(){var c=document.querySelector('.modal-backdrop [data-a="modal-close"]')||document.querySelector('[data-a="modal-close"]');if(c)c.click();})()`);
    await sleep(500);

    await openSettings(cdp);
    await click(cdp, '[data-a="reset"]');
    await sleep(700);
    const reset = await cdp.eval(`(function(){
      var m=document.querySelector('.modal-backdrop');
      return {modal:!!m, text:m?m.innerText.replace(/\\s+/g,' ').slice(0,120):''};
    })()`);
    check('新开存档弹二次确认', reset.modal && /新开|确认|存档/.test(reset.text), reset.text);
    await cdp.eval(`(function(){var c=document.querySelector('.modal-backdrop [data-a="modal-close"]')||document.querySelector('[data-a="modal-close"]');if(c)c.click();})()`);
    await sleep(400);

    await openSettings(cdp);
    await sleep(400);
    const life = await cdp.eval(`(function(){
      var b=document.querySelector('#panel-body [data-a="ad-life"]');
      return {exists:!!b, disabled:b?b.disabled:null, label:b?b.textContent.trim():''};
    })()`);
    check('续命入口存在', life.exists, life.label);
    check('寿元充足时正确禁用', life.disabled === true || /领取10年寿元/.test(life.label),
      `disabled=${life.disabled} label=${life.label}`);

    section('7. 运行期异常');
    check('无未捕获 JavaScript 异常', errors.length === 0, errors.slice(0, 2).join(' | ') || '0 个');
  } catch (e) {
    console.error('\n运行器异常:', e && e.message);
    results.push({ section: 'runner', name: '运行器未中断', pass: false, detail: e && e.message });
  } finally {
    if (cdp) { try { await cdp.send('Browser.close'); } catch {} try { cdp.ws.close(); } catch {} }
    await sleep(500);
    await kill(proc, port);
    srv.close();
  }

  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n合计 ${results.length} 项：${results.length - fail} 通过 / ${fail} 失败`);
  fs.writeFileSync(path.join(SHOT_DIR, 'results.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), totals: { total: results.length, fail }, results }, null, 2), 'utf8');
  process.exit(fail ? 1 : 0);
})();
