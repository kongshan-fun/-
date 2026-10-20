'use strict';
/*
 * 浏览器可执行文件解析（P1-3 收尾）
 *
 * 背景：仓库里 35 个 CDP 测试原来都写死
 *   C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
 * 于是 GitHub Actions（Ubuntu）只能跑 python 的 playwright 套件，
 * 界面层（UI 结构、设置、图鉴、评价、轮回玉、存档往返）在 CI 里等于没跑。
 *
 * 这里统一解析：环境变量 SHANHE_BROWSER 优先，其次 Edge / Chrome / Chromium，
 * 最后找 playwright 自带的 chromium（CI 里 `playwright install chromium` 就有）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function playwrightChromium() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
  try {
    for (const dir of fs.readdirSync(cache).filter((d) => d.startsWith('chromium-'))) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(cache, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch { /* 忽略 */ }
  return null;
}

const CANDIDATES = [
  process.env.SHANHE_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const BROWSER = CANDIDATES.find((p) => fs.existsSync(p)) || playwrightChromium() || 'chromium';

module.exports = { BROWSER, CANDIDATES, playwrightChromium };
