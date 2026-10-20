'use strict';
/* 用 CDP 走真实路径：入世 → 设置导入存档（DOM.setFileInputFiles）→ 确认 → 检查金丹雷劫入口 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SAVE = path.join(ROOT, 'saves', 'shanhe-v910-jindan-ready.json');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(root, rel);
      fs.readFile(f, (e, b) => { if (e) { rsp.writeHead(404).end(); return; } rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rsp.end(b); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 1; this.pending = new Map();
    ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }); }
  static async connect(url) { const ws = new WebSocket(url);
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', () => j(new Error('ws')), { once: true }); });
    return new Cdp(ws); }
  send(method, params = {}) { const id = this.id++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 40000); }); }
  async eval(e) { const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
  async waitFor(e, ms = 25000) { const end = Date.now() + ms;
    while (Date.now() < end) { try { if (await this.eval(e)) return true; } catch {} await sleep(120); } throw new Error('waitFor ' + e); }
}
const click = (c, sel) => c.eval(`(function(){var b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true;})()`);

(async () => {
  if (!fs.existsSync(SAVE)) { console.error('缺少存档文件'); process.exit(1); }
  const srv = await serve(ROOT);
  const port = 9993;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-'));
  const proc = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  try {
    for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await Cdp.connect(t.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('DOM.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/index.html` });
    await cdp.waitFor("typeof window.QData === 'object'");
    await sleep(900);

    // 入世
    for (const [sel, w] of [['[data-a="choose-role"][data-role="human"]', 500], ['[data-a="view-slots"]', 600],
      ['[data-a="slot-open"][data-slot="1"]', 800], ['[data-a="birth-next"]', 800], ['[data-a="birth-confirm-final"]', 1500]]) {
      if (!(await click(cdp, sel))) throw new Error('onboarding ' + sel);
      await sleep(w);
    }
    await cdp.eval(`(function(){var g=document.querySelector('[data-a="guide"]');if(g)g.click();var c=document.querySelector('[data-a="modal-close"]');if(c)c.click();var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(500);

    // 通过真实 file input 导入
    const doc = await cdp.send('DOM.getDocument', { depth: -1 });
    const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#import-file' });
    await cdp.send('DOM.setFileInputFiles', { files: [SAVE], nodeId: node.nodeId });
    await sleep(900);

    const modal = await cdp.eval(`(function(){var m=document.querySelector('.modal-backdrop');return m?m.innerText.replace(/\\s+/g,' ').slice(0,80):null;})()`);
    console.log('导入确认弹窗: ' + (modal ? '「' + modal + '」' : '未出现'));

    const okBtn = await cdp.eval(`(function(){
      var b=document.querySelector('[data-a="confirm-import"]');
      if(b){b.click();return true;} return false;})()`);
    console.log('点击确认导入: ' + okBtn);
    await sleep(1200);

    // 关闭可能残留的引导
    await cdp.eval(`(function(){var p=document.querySelector('[data-a="guide"][data-mode="pause"]');if(p)p.click();})()`);
    await sleep(400);

    // 读状态
    const head = await cdp.eval(`(function(){var t=document.body.innerText;return t.replace(/\\s+/g,' ').slice(0,120);})()`);
    console.log('界面顶部: ' + head);

    // 打开修炼面板找雷劫入口
    await click(cdp, '[data-a="panel"][data-name="camp"]'); await sleep(700);
    const cultEntry = await click(cdp, '[data-a="panel"][data-name="cultivate"]'); await sleep(800);
    const panelText = await cdp.eval(`(function(){var p=document.getElementById('panel-root');return p?p.innerText.replace(/\\s+/g,' ').slice(0,300):'';})()`);
    console.log('\n进入修炼面板: ' + cultEntry);
    console.log('面板文本: ' + panelText);

    const trialBtn = await cdp.eval(`(function(){
      var b=document.querySelector('[data-a="tribulation-open"]');
      return b?{text:b.textContent.trim(),disabled:!!b.disabled}:null;})()`);
    console.log('\n雷劫入口: ' + (trialBtn ? '「' + trialBtn.text + '」 disabled=' + trialBtn.disabled : '未找到'));
    const breakBtn = await cdp.eval(`(function(){
      var b=document.querySelector('[data-a="breakthrough"]');
      return b?{text:b.textContent.trim(),disabled:!!b.disabled}:null;})()`);
    console.log('破境按钮: ' + (breakBtn ? '「' + breakBtn.text + '」 disabled=' + breakBtn.disabled : '未找到'));

    const prog = await cdp.eval(`(function(){var c=document.querySelector('#panel-body .prog-card');return c?c.innerText.replace(/\\s+/g,' ').slice(0,260):null;})()`);
    console.log('\n阶段指引卡: ' + (prog || '未渲染'));

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.join(ROOT, 'visual', 'v910-save'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'visual', 'v910-save', 'jindan-ready.png'), Buffer.from(shot.data, 'base64'));
    console.log('\n截图: visual/v910-save/jindan-ready.png');
  } catch (e) {
    console.error('FAIL: ' + e.message);
    process.exitCode = 1;
  } finally {
    if (cdp) { try { cdp.ws.close(); } catch {} }
    await sleep(200);
    try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    srv.close();
  }
})();
