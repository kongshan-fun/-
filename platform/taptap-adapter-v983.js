
/* ============================================================================
 * 山野修仙记 V90.7 · TapTap H5 平台适配层 (QTAP 3.0.0 · 云存档为主)
 * ----------------------------------------------------------------------------
 * 2.0.0 相对 1.2.0 的变化
 *   1) 重新接入 TapTap 激励视频（广告位 1054324），恢复三处「观看领取」入口：
 *        data-a="birth-ad"         命格页 · 看完 +3 次抽取机会
 *        data-a="birth-jade-ad"    属性确认页 · 看完 +200 轮回玉
 *        data-a="ad-life-confirm"  续命弹窗「观看领取」· 看完 +10 年寿元
 *   2) 战力榜填真实客户端榜单 ID：a7m6yjlef2giizektn（综合战力榜 · 永久 · 取历史最高）
 *   3) 云存档逻辑与 1.2.0 一致，未改动。
 *
 * 设计原则（仍是「游戏逻辑零改动」）
 *   1) 适配层不改写任何游戏内按钮的发奖逻辑。它只在捕获阶段拦下这三个按钮，
 *      播完激励视频、且 onClose 回传 isEnded===true 时，才把这次点击「还给」
 *      游戏自己的 handler，由游戏发奖。
 *   2) 环境兜底。没有 tap 对象（浏览器 / APK 直开）时不拦截，三个入口退回
 *      「点一下即到账」，游戏照样能玩。
 *   3) 广告兜底。拉不到广告（onError / show+load 重试仍失败）时直接放行发奖，
 *      绝不把玩家卡在「点了没反应」。
 *   4) 存档兜底。若运行环境屏蔽了 localStorage，自动用 tap.setStorageSync 垫片。
 * ========================================================================== */
(function () {
  'use strict';

  var VERSION = 'qtap-3.1.0-v983';

  /* ==========================================================================
   * 1. 部署前需要填写的配置
   * ======================================================================== */
  var CONFIG = {
    ads: {
      spaceId: '1054324',   // TapTap 小游戏/H5 广告位（由 check_ads_status 查询得到）
      enabled: true         // false = 完全关闭广告拦截（入口退回免费领取）
    },
    leaderboard: {
      power: 'a7m6yjlef2giizektn',   // 综合战力榜（客户端 ID，不是后台数据库 ID）
      speedrun: '89uvqr12t55efn1ff6'  // 飞升速通榜（升序：分数越小越好，分数 = 耗寿年（向下取整）（354 = 35.4 年））
    },
    // 寿命换算：一游戏年 = 5760 游戏分钟（四游戏日）；战败额外折寿 16 年
    life: {
      yearMinutes: 5760,
      defeatYears: 16,
      scoreScale: 1
    },
    cloudSave: {
      archiveName: 'shanye_v907_all',  // 云存档名：≤60 字节、不能有空格和中文
      minIntervalMs: 90000,           // 自动上传最小间隔（接口限流 60 秒/次，留余量）
      autoSync: true,                 // 存档变化后自动上传（本轮起为官方存档方式）
      autoRestore: true               // 本地完全没有存档时，启动自动从云端拉回
    },
    // 官方成就：achievementId 必须在「开发者中心 → 游戏服务 → 成就」创建后填入。
    // 空字符串表示该阈值不发起解锁请求（不会报错，也不会误解锁）。
    achievements: {
      boss: { '1': '', '3': '', '5': '', '10': '' }
    },
    leaderboardAuto: {
      enabled: true,
      minIntervalMs: 120000           // 自动上报战力最小间隔
    },
    forceMock: false,   // true = 强制模拟（不调真实平台接口），便于本地验收
    debug: false
  };

  /**
   * 需要「观看激励视频才发奖」的入口（按钮 data-a → 奖励文案）
   *   birth-ad          命格页 · 3 次抽取机会
   *   birth-jade-ad     属性确认页 · 200 轮回玉
   *   ad-life           续命机缘（状态栏快捷入口 + 设置页按钮，游戏里两处同 action）
   *   ad-life-confirm   续命确认弹窗里的「观看领取」按钮（兼容旧入口）
   */
  var AD_ACTIONS = {
    'birth-ad': '3 次抽取机会',
    'birth-jade-ad': '200 轮回玉',
    'ad-life': '10 年寿元',
    'ad-life-confirm': '10 年寿元',
    'ad-life-rescue': '15 年寿元'
  };

  /* ==========================================================================
   * 2. 环境探测
   * ======================================================================== */
  var TAP = (typeof globalThis !== 'undefined' && globalThis.tap) ? globalThis.tap : null;
  var MOCK = !!CONFIG.forceMock || !TAP;
  var START_AT = Date.now();

  function log() {
    if (!CONFIG.debug) return;
    try { console.log.apply(console, ['[QTAP]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  /** 安全调用 tap 上的成员，任何异常都吞掉并返回 null */
  function tapCall(path, args) {
    if (!TAP) return null;
    try {
      var parts = String(path).split('.');
      var ctx = TAP;
      for (var i = 0; i < parts.length - 1; i++) {
        ctx = ctx[parts[i]];
        if (!ctx) return null;
      }
      var fn = ctx[parts[parts.length - 1]];
      if (typeof fn !== 'function') return null;
      return fn.apply(ctx, args || []);
    } catch (e) {
      log('tapCall failed: ' + path, e);
      return null;
    }
  }

  /* ==========================================================================
   * 3. localStorage 垫片（仅在原生不可用时安装）
   * ======================================================================== */
  function storageMode() {
    try {
      if (!globalThis.localStorage) return 'missing';
      var k = '__qtap_probe__';
      globalThis.localStorage.setItem(k, '1');
      if (globalThis.localStorage.getItem(k) !== '1') return 'broken';
      globalThis.localStorage.removeItem(k);
      return 'native';
    } catch (e) {
      return 'blocked';
    }
  }

  function installStorageShim() {
    if (!TAP || typeof TAP.setStorageSync !== 'function') return false;
    var IDX = '__qtap_ls_index__';
    function readIdx() {
      try { var s = TAP.getStorageSync(IDX); return s ? JSON.parse(s) : []; } catch (e) { return []; }
    }
    function writeIdx(a) {
      try { TAP.setStorageSync(IDX, JSON.stringify(a)); } catch (e) {}
    }
    var api = {
      getItem: function (k) {
        try {
          var v = TAP.getStorageSync(String(k));
          return (v === '' || v === undefined || v === null) ? null : String(v);
        } catch (e) { return null; }
      },
      setItem: function (k, v) {
        var key = String(k);
        var i = readIdx();
        if (i.indexOf(key) < 0) { i.push(key); writeIdx(i); }
        TAP.setStorageSync(key, String(v));
      },
      removeItem: function (k) {
        var key = String(k);
        try { TAP.removeStorageSync(key); } catch (e) {}
        var i = readIdx(), p = i.indexOf(key);
        if (p >= 0) { i.splice(p, 1); writeIdx(i); }
      },
      clear: function () {
        readIdx().forEach(function (k) { try { TAP.removeStorageSync(k); } catch (e) {} });
        writeIdx([]);
      },
      key: function (n) {
        var i = readIdx();
        return (n >= 0 && n < i.length) ? i[n] : null;
      }
    };
    try {
      Object.defineProperty(api, 'length', { get: function () { return readIdx().length; } });
      Object.defineProperty(globalThis, 'localStorage', {
        value: api, configurable: true, writable: true
      });
      log('localStorage shim installed');
      return true;
    } catch (e) {
      log('localStorage shim failed', e);
      return false;
    }
  }

  var STORAGE = storageMode();
  if (STORAGE !== 'native') installStorageShim();

  /* ==========================================================================
   * 4. 存档键范围
   * ======================================================================== */
  var PREFIXES = ['qinglan-wendao-v14-', 'shanye_birth_ads_v36_', 'qinglan-wendao-v',
    // V90.7 本机资质榜（最快飞升记录）：随存档一起备份，避免换设备丢成绩
    'shanye-v907-local-ascension-board','shanye-v978-local-ascension-board-v1','shanye-v982-local-ascension-board-v1'];

  function isGameKey(k) {
    if (!k) return false;
    for (var i = 0; i < PREFIXES.length; i++) {
      if (k.indexOf(PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function collectPayload() {
    var keys = {}, n = 0;
    try {
      var ls = globalThis.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (isGameKey(k) && !/-(?:presync-backup|restore-stage|restore-rollback)$/.test(k)) {
          var v = ls.getItem(k);
          if (v !== null) { keys[k] = v; n++; }
        }
      }
    } catch (e) { throw Error('读取本地档案失败，停止云同步：'+(e.message||e)); }
    return { v: 1, game: 'shanye-v983', ts: Date.now(), count: n, keys: keys };
  }

  function countSlots() {
    var n = 0;
    try {
      var ls = globalThis.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && /-slot-\d{3}$/.test(k)) n++;
      }
    } catch (e) {}
    return n;
  }

  /* ==========================================================================
   * 5. 提示条（优先复用游戏自带 notify）
   * ======================================================================== */
  function toast(msg, kind) {
    var bridgeNotify = globalThis.__QTAP_NOTIFY || globalThis.notify;
    if (typeof bridgeNotify === 'function') {
      try { bridgeNotify(msg, kind || 'ok'); return; } catch (e) {}
    }
    var el = document.getElementById('qtap-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'qtap-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'show';
    clearTimeout(el.__t);
    el.__t = setTimeout(function () { el.className = ''; }, 2600);
  }

  /* ==========================================================================
   * 6. 状态桥（由游戏 render()/persist() 发布）
   * ======================================================================== */
  function state() {
    var st = globalThis.__QTAP_STATE || null;
    if (!st || !st.game) return null;
    return st;
  }

  function livePower() {
    var st = state();
    if (!st) return 0;
    // V90.4 把 QCombatRating 收进了 IIFE，改由 P2 补丁在 render() 里把战力发布到状态桥
    if (typeof st.power === 'number' && isFinite(st.power) && st.power > 0) return st.power;
    try {
      if (globalThis.QCombatRating && globalThis.QCombatRating.live) {
        return globalThis.QCombatRating.live(st.game).total || 0;
      }
    } catch (e) { log('power failed', e); }
    return 0;
  }

  /* ==========================================================================
   * 7. 激励视频
   * --------------------------------------------------------------------------
   * 单例：整个生命周期只有一个 RewardedVideoAd 实例（平台要求）。
   * 流程：点击入口 → 记录被打断的按钮 → show()（未就绪则 load 后重试一次）
   *       → onClose(isEnded) → 真 → 把点击还给按钮；假 → 不发奖。
   * ======================================================================== */
  var adState = {
    instance: null,
    ready: false,
    playing: false,
    pending: null,        // { action, label, id, settled }
    requestSeq: 0,
    lastError: '',
    plays: 0,
    rewards: 0,
    declines: 0,
    failures: 0
  };

  function adsAvailable() {
    return !MOCK && CONFIG.ads.enabled && !!TAP && typeof TAP.createRewardedVideoAd === 'function';
  }

  function ensureAd() {
    if (!adsAvailable()) return null;
    if (adState.instance) return adState.instance;
    try {
      var ad = TAP.createRewardedVideoAd({ adUnitId: CONFIG.ads.spaceId });
      if (!ad) return null;
      ad.onLoad(function () { adState.ready = true; });
      ad.onError(function (err) {
        adState.ready = false;
        adState.lastError = (err && (err.errMsg || err.errCode)) || 'unknown';
        log('ad error: ' + adState.lastError);
        var pending = adState.pending;
        if (pending) settleAd(pending.id, 'fallback');
      });
      ad.onClose(function (res) {
        var pending = adState.pending;
        if (!pending) return;
        settleAd(pending.id, res && res.isEnded ? 'reward' : 'decline');
      });
      adState.instance = ad;
      try {
        ad.load().then(function () { adState.ready = true; },
                       function (e) { log('preload failed', e); });
      } catch (e) { log('preload threw', e); }
      return ad;
    } catch (e) {
      log('createRewardedVideoAd failed', e);
      adState.lastError = (e && e.message) || String(e);
      return null;
    }
  }

  function settleAd(requestId, outcome) {
    var pending = adState.pending;
    if (!pending || pending.id !== requestId || pending.settled) return false;
    pending.settled = true;
    adState.pending = null;
    adState.playing = false;
    adState.ready = false;
    if (outcome === 'reward') {
      adState.rewards++;
      grant(pending.action);
    } else if (outcome === 'fallback') {
      adState.failures++;
      toast('广告暂时拉不到，本次按离线兜底规则发放', 'warn');
      grant(pending.action);
    } else {
      adState.declines++;
      toast('需完整看完视频才能领取 ' + pending.label, 'warn');
    }
    return true;
  }

  function showAd(action) {
    var label = AD_ACTIONS[action] || '奖励';
    if (adState.playing) { toast('广告播放中，请稍候', 'warn'); return; }
    var ad = ensureAd();
    if (!ad) { grant(action); return; }
    var requestId = ++adState.requestSeq;
    adState.playing = true;
    adState.pending = { action: action, label: label, id: requestId, settled: false };
    adState.plays++;
    var p;
    try { p = ad.show(); } catch (e) { p = Promise.reject(e); }
    if (!p || typeof p.then !== 'function') return;
    p.then(function () {
      if (adState.pending && adState.pending.id === requestId) adState.ready = false;
    }, function (showErr) {
      if (!adState.pending || adState.pending.id !== requestId) return;
      log('ad show failed, retry once', showErr);
      try {
        Promise.resolve(ad.load()).then(function () {
          if (!adState.pending || adState.pending.id !== requestId) return;
          return ad.show();
        }).then(function () {
          if (adState.pending && adState.pending.id === requestId) adState.ready = false;
        }).catch(function (retryErr) {
          if (!adState.pending || adState.pending.id !== requestId) return;
          log('ad retry failed', retryErr);
          settleAd(requestId, 'fallback');
        });
      } catch (e) {
        if (adState.pending && adState.pending.id === requestId) settleAd(requestId, 'fallback');
      }
    });
  }

  /* ---- 发奖：把这次点击还给游戏自己的 handler ---- */
  var replaying = false;

  function findAdButton(action) {
    var nodes = document.querySelectorAll('[data-a="' + action + '"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n && !n.disabled) return n;
    }
    return nodes[0] || null;
  }

  function grant(action) {
    var btn = findAdButton(action);
    if (!btn) {
      toast('面板已刷新，请重新点击领取', 'warn');
      return;
    }
    replaying = true;
    try {
      // btn.click() 同步派发事件，游戏 handler 在本次调用返回前就已经跑完，
      // 所以标志位在 finally 里立刻复位即可，不需要留时间窗。
      btn.click();
    } catch (e) {
      log('replay click failed', e);
      toast('领取失败，请重试', 'warn');
    } finally {
      replaying = false;
    }
  }

  /** 捕获阶段拦截：拦下三个需看广告的按钮，播完再放行 */
  function installAdInterceptor() {
    if (!adsAvailable()) { log('ad interceptor skipped (no tap / disabled)'); return; }
    document.addEventListener('click', function (e) {
      if (replaying) return;                    // 发奖回放，直接放行给游戏
      var t = e.target;
      while (t && t.nodeType === 1 && t.tagName !== 'BUTTON') t = t.parentNode;
      if (!t || t.nodeType !== 1) return;
      var action = t.getAttribute('data-a');
      if (!action || !AD_ACTIONS[action]) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      showAd(action);
    }, true);
    log('ad interceptor installed, spaceId=' + CONFIG.ads.spaceId);
  }

  /* ==========================================================================
   * 8. 云存档
   * ======================================================================== */
  var UUID_KEY = '__qtap_archive_uuid__';
  var lastUploadAt = 0;

  function archiveUuid() {
    try { return globalThis.localStorage.getItem(UUID_KEY) || ''; } catch (e) { return ''; }
  }
  function saveUuid(u) {
    try { if (u) globalThis.localStorage.setItem(UUID_KEY, String(u)); } catch (e) {}
  }

  function cloudAvailable() {
    return !MOCK && !!TAP && typeof TAP.getCloudSaveManager === 'function' && typeof TAP.getFileSystemManager === 'function';
  }

  function writeLocalFile(payload) {
    return new Promise(function (resolve, reject) {
      var fs = TAP.getFileSystemManager();
      var dir = (TAP.env && TAP.env.USER_DATA_PATH) ? TAP.env.USER_DATA_PATH : '';
      if (!dir) { reject(new Error('缺少 USER_DATA_PATH')); return; }
      var filePath = dir + '/shanye_cloudsave.json';
      fs.writeFile({
        filePath: filePath,
        data: JSON.stringify(payload),
        encoding: 'utf8',
        success: function () { resolve(filePath); },
        fail: function (e) { reject(new Error('写本地文件失败：' + ((e && e.errMsg) || ''))); }
      });
    });
  }

  function pushArchive(filePath) {
    return new Promise(function (resolve, reject) {
      var cs = TAP.getCloudSaveManager();
      var payload = collectPayload();
      var meta = {
        name: CONFIG.cloudSave.archiveName,     // ASCII、无空格
        summary: '山野修仙记 V90.83 · ' + countSlots() + ' 存档位 · ' +
                 new Date().toISOString().slice(0, 16).replace('T', ' '),
        extra: JSON.stringify({ v: 1, archive: 'all', slots: countSlots() }),
        playtime: Math.max(0, Math.floor((Date.now() - START_AT) / 1000))
      };
      var opts = {
        archiveMetaData: meta,
        archiveFilePath: filePath,
        success: function (res) {
          if (res && res.uuid) saveUuid(res.uuid);
          resolve(res || {});
        },
        fail: function (e) {
          var code = e && (e.errno || e.errCode);
          var msg = (e && e.errMsg) || '';
          if (code === 400001) msg = '上传过于频繁（每分钟限 1 次）';
          reject(new Error(msg || ('云存档失败(' + code + ')')));
        }
      };
      var uuid = archiveUuid();
      if (uuid) cs.updateArchive(Object.assign({ archiveUUID: uuid }, opts));
      else cs.createArchive(opts);
    });
  }

  function uploadCloud(force) {
    if (!cloudAvailable()) return Promise.reject(new Error('当前环境没有 TapTap 云存档'));
    var now = Date.now();
    if (!force && now - lastUploadAt < CONFIG.cloudSave.minIntervalMs) {
      return Promise.reject(new Error('距上次上传不足 ' +
        Math.ceil(CONFIG.cloudSave.minIntervalMs / 1000) + ' 秒，请稍后'));
    }
    var payload = collectPayload();
    if (!payload.count) return Promise.reject(new Error('没有可上传的存档'));
    lastUploadAt = now;
    return writeLocalFile(payload).then(pushArchive);
  }

  /* ------------------------------------------------------------------------
   * 云存档成为官方存档方式后新增的两块：
   *   1) 启动引导 bootstrapCloud()：本地有档 → 本地为准；本地完全没有 → 自动拉回
   *   2) 状态展示 cloudMode/cloudMessage：设置页顶部一句话说明当前同步状态
   * 自动上传仍由 watchSave() 负责（轮询 __QTAP_SAVE_TICK + 90 秒节流）。
   * ---------------------------------------------------------------------- */
  var AUTORESTORE_FLAG = '__qtap_autorestore_done__';
  var cloudMode = 'idle';        // idle | local | empty | restoring | restored | error
  var cloudMessage = '';

  function setCloudMode(mode, msg) {
    cloudMode = mode;
    cloudMessage = msg || '';
    var line = document.getElementById('qtap-cloud-line');
    if (line) line.textContent = cloudSummary();
    log('cloud mode', mode, msg);
  }

  function hasLocalMainSave() {
    try {
      var ls=globalThis.localStorage;
      for(var i=0;i<ls.length;i++){
        var k=ls.key(i),m=k&&/^qinglan-wendao-v14-(?:(easy|standard|challenge)-)?(human|demon)-slot-(\d{3})$/.exec(k);
        if(!m||Number(m[3])<1||Number(m[3])>100)continue;
        // A damaged local role slot must not be silently overwritten via cloud restore.
        if(ls.getItem(k)!==null)return true;
      }
    }catch(e){log('local save probe failed',e);return true;}
    return false;
  }
  function readFlag(k) {
    try { return globalThis.localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function writeFlag(k, v) {
    try { globalThis.localStorage.setItem(k, String(v)); } catch (e) {}
  }

  /** 启动引导：决定「本地为准」还是「从云端拉回」 */
  function bootstrapCloud() {
    if (!cloudAvailable() || !CONFIG.cloudSave.autoSync) return;
    if (hasLocalMainSave()) {
      setCloudMode('local', '本地进度为准 · 存档自动同步到 TapTap 云端');
      return;
    }
    setCloudMode('empty', '正在检查云端存档…');
    listCloud().then(function (list) {
      if (!list || !list.length) {
        setCloudMode('empty', '尚无云端存档 · 此档首次保存后自动上传');
        return;
      }
      if (!CONFIG.cloudSave.autoRestore) {
        setCloudMode('empty', '云端已有存档 · 可在下方「存档排障」手动恢复');
        return;
      }
      if (readFlag(AUTORESTORE_FLAG) === '1') {
        setCloudMode('error', '已尝试自动恢复但本机仍无存档 · 请在「存档排障」手动恢复');
        return;
      }
      var item = list[0];
      if (item && item.uuid) saveUuid(item.uuid);
      setCloudMode('restoring', '正在从云端恢复存档…');
      return restoreCloud(item && item.uuid).then(function (r) {
        writeFlag(AUTORESTORE_FLAG, '1');
        setCloudMode('restored', '已从云端恢复 ' + (r && r.count) + ' 个存档键 · 正在重新载入…');
        try { window.__QTAP_NOTIFY && window.__QTAP_NOTIFY('已从云端恢复存档'); } catch (e) {}
        setTimeout(function () { try { globalThis.location.reload(); } catch (e) {} }, 900);
      });
    }).catch(function (err) {
      setCloudMode('error', '云端不可用：' + err.message);
    });
  }

  /** 云存档一句话状态（放在设置面板顶部，替代原来的三个手动按钮） */
  function cloudSummary() {
    if (!cloudAvailable()) return '当前环境没有 TapTap 云存档（浏览器 / 本地 APK 版请用「存档排障」里的 JSON 导出）';
    if (!CONFIG.cloudSave.autoSync) return '自动同步未启用';
    if (cloudMode === 'error' || cloudMode === 'restored' || cloudMode === 'restoring') {
      return cloudMessage || '';
    }
    if (cloudMode === 'empty') return cloudMessage || '尚无云端存档 · 首次保存后自动上传';
    if (cloudMode === 'local') return '进度自动保存并同步到 TapTap 云端 · 换设备登录同一账号即可接续';
    return '进度自动保存并同步到 TapTap 云端';
  }

  function listCloud() {
    return new Promise(function (resolve, reject) {
      if (!cloudAvailable()) { reject(new Error('当前环境没有 TapTap 云存档')); return; }
      var cs = TAP.getCloudSaveManager();
      cs.getArchiveList({
        success: function (res) { resolve((res && res.saves) || []); },
        fail: function (e) { reject(new Error((e && e.errMsg) || '获取云存档列表失败')); }
      });
    });
  }

  function applyPayload(payload) {
    var incoming=payload&&payload.keys;
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw Error('云存档内容无法识别');
    var ls=globalThis.localStorage,clean={};
    Object.keys(incoming).forEach(function(k){
      if(!isGameKey(k)||k===UUID_KEY||/-(?:presync-backup|restore-stage|restore-rollback)$/.test(k))throw Error('云存档包含不允许恢复的键：'+k);
      if(typeof incoming[k]!=='string')throw Error('云存档键值格式错误：'+k);
      var identity=/^qinglan-wendao-v14-(?:(easy|standard|challenge)-)?(human|demon)-slot-(\d{3})$/.exec(k);
      if(identity){
        var state;
        try{state=JSON.parse(incoming[k]);}catch(_){throw Error('云角色存档JSON损坏，拒绝覆盖：'+k);}
        if(!state||state.version!==14||state.race!==identity[2]||state.character!==identity[2]||
            (state.difficulty===undefined?'challenge':state.difficulty)!==(identity[1]||'challenge')||
            !state.birth||typeof state.birth!=='object'||!Number.isInteger(state.birth.seed))
          throw Error('云角色档身份或版本错误，拒绝覆盖：'+k);
      }
      clean[k]=incoming[k];
    });
    if(!Object.keys(clean).some(function(k){return /^qinglan-wendao-v14-(?:(?:easy|standard|challenge)-)?(?:human|demon)-slot-\d{3}$/.test(k)||/^qinglan-wendao-v(?:10|11)-/.test(k);}))throw Error('云存档不包含可恢复角色，禁止清理本地记录');
    var before={};
    for(var i=0;i<ls.length;i++){var k=ls.key(i);if(isGameKey(k)&&k!==UUID_KEY&&!/-(?:presync-backup|restore-stage|restore-rollback)$/.test(k)){var v=ls.getItem(k);if(v!==null)before[k]=v;}}
    var backupKey='__qtap_presync_backup_v1__',stageKey='__qtap_restore_stage_v1__';
    var backup=JSON.stringify({v:1,reason:'before-cloud-restore',ts:Date.now(),keys:before});
    var stage=JSON.stringify({v:1,ts:Date.now(),keys:clean});
    try{ls.setItem(backupKey,backup);if(ls.getItem(backupKey)!==backup)throw Error('恢复前备份校验失败');ls.setItem(stageKey,stage);if(ls.getItem(stageKey)!==stage)throw Error('临时云档校验失败');}
    catch(e){try{ls.removeItem(stageKey)}catch(_){}throw Error('无法建立可靠的恢复保护，未改动本地存档：'+(e.message||e));}
    try{
      Object.keys(clean).forEach(function(k){ls.setItem(k,clean[k]);if(ls.getItem(k)!==clean[k])throw Error('写入后校验不一致：'+k);});
      Object.keys(clean).forEach(function(k){if(ls.getItem(k)!==clean[k])throw Error('恢复复核失败：'+k);});
      Object.keys(before).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(clean,k))ls.removeItem(k);});
      Object.keys(before).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(clean,k)&&ls.getItem(k)!==null)throw Error('旧键清理校验失败：'+k);});
      Object.keys(clean).forEach(function(k){if(ls.getItem(k)!==clean[k])throw Error('最终复核失败：'+k);});
      try{ls.removeItem(stageKey)}catch(_){}
      log('cloud restore committed ('+Object.keys(clean).length+' keys)');
      return Object.keys(clean).length;
    }catch(err){
      var rollbackError=null;
      try{
        var current=[];for(var j=0;j<ls.length;j++){var ck=ls.key(j);if(isGameKey(ck)&&ck!==UUID_KEY&&!/-(?:presync-backup|restore-stage|restore-rollback)$/.test(ck))current.push(ck);}
        current.forEach(function(k){ls.removeItem(k);});
        Object.keys(before).forEach(function(k){ls.setItem(k,before[k]);});
        Object.keys(before).forEach(function(k){if(ls.getItem(k)!==before[k])throw Error('回滚校验失败：'+k);});
      }catch(rb){rollbackError=rb;}
      try{ls.removeItem(stageKey)}catch(_){}
      if(rollbackError)throw Error('云存档恢复失败，自动回滚未能完成；保护快照保留在本机：'+(rollbackError.message||rollbackError));
      throw Error('云存档恢复失败，已完整恢复原本地存档：'+(err.message||err));
    }
  }
  function restoreCloud(uuid) {
    return new Promise(function (resolve, reject) {
      if (!cloudAvailable()) { reject(new Error('当前环境没有 TapTap 云存档')); return; }
      var cs = TAP.getCloudSaveManager();
      var archiveId = uuid || archiveUuid();
      if (!archiveId) { reject(new Error('本机还没有绑定云存档，请先上传一次')); return; }
      var dir = (TAP.env && TAP.env.USER_DATA_PATH) ? TAP.env.USER_DATA_PATH : '';
      var target = dir + '/shanye_restore.json';
      cs.getArchiveList({
        success: function (res) {
          var list = (res && res.saves) || [];
          var item = null;
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].uuid === archiveId) { item = list[i]; break; }
          }
          if (!item) { reject(new Error('云端找不到该存档，可能已被删除')); return; }
          cs.getArchiveData({
            archiveUUID: archiveId,
            archiveFileId: item.fileId,
            targetFilePath: target,
            success: function () {
              var fs = TAP.getFileSystemManager();
              fs.readFile({
                filePath: target,
                encoding: 'utf8',
                success: function (r) {
                  try {
                    var payload = JSON.parse(r.data);
                    var n = applyPayload(payload);
                    resolve({ count: n, ts: payload.ts });
                  } catch (e) { reject(new Error('云存档解析失败：' + e.message)); }
                },
                fail: function (e) { reject(new Error('读取云存档文件失败')); }
              });
            },
            fail: function (e) { reject(new Error((e && e.errMsg) || '下载云存档失败')); }
          });
        },
        fail: function (e) { reject(new Error((e && e.errMsg) || '获取云存档列表失败')); }
      });
    });
  }

  /* ==========================================================================
   * 8.5 官方成就（tap.createAchievementManager，基础库 1.5.0+）
   * ======================================================================== */
  var achievementManager = null;
  var unlockedAchievements = {};

  function achievementAvailable() {
    return !MOCK && !!TAP && typeof TAP.createAchievementManager === 'function';
  }

  function ensureAchievements() {
    if (achievementManager) return achievementManager;
    if (!achievementAvailable()) return null;
    try {
      achievementManager = TAP.createAchievementManager({ toastEnable: true });
    } catch (e) {
      log('createAchievementManager failed', e);
      achievementManager = null;
    }
    return achievementManager;
  }

  function unlockAchievement(achievementId) {
    var id = String(achievementId || '').trim();
    if (!id) return Promise.resolve({ ok: false, reason: 'no-id' });
    if (unlockedAchievements[id]) return Promise.resolve({ ok: true, skipped: true, achievementId: id });
    var manager = ensureAchievements();
    if (!manager || typeof manager.unlockAchievement !== 'function') {
      return Promise.resolve({ ok: false, reason: 'unavailable' });
    }
    try {
      manager.unlockAchievement({ achievementId: id });
      unlockedAchievements[id] = true;
      return Promise.resolve({ ok: true, achievementId: id });
    } catch (e) {
      return Promise.resolve({ ok: false, reason: 'throw', error: e });
    }
  }

  /** 按当前 Boss 击杀数解锁对应阈值成就（取已达成的最高阈值） */
  function unlockBossAchievement(bossCount) {
    var map = CONFIG.achievements && CONFIG.achievements.boss;
    var total = Number(bossCount);
    if (!map || !isFinite(total)) return Promise.resolve({ ok: false, reason: 'unconfigured' });
    var hits = Object.keys(map).map(Number)
      .filter(function (n) { return isFinite(n) && n > 0 && total >= n && String(map[String(n)] || '').trim(); })
      .sort(function (a, b) { return a - b; });
    if (!hits.length) return Promise.resolve({ ok: false, reason: 'below-threshold-or-empty' });
    return unlockAchievement(map[String(hits[hits.length - 1])]);
  }

  function showAchievements() {
    var manager = ensureAchievements();
    if (!manager || typeof manager.showAchievements !== 'function') return false;
    try { manager.showAchievements(); return true; } catch (e) { return false; }
  }

  /* ==========================================================================
   * 9. 排行榜（战力）
   * ======================================================================== */
  function leaderboardAvailable() {
    return !MOCK && !!TAP && typeof TAP.getLeaderboardManager === 'function' && !!CONFIG.leaderboard.power;
  }

  var lastSubmitAt = 0, bestSubmitted = 0;

  function submitPower(force) {
    return new Promise(function (resolve, reject) {
      if (!leaderboardAvailable()) { reject(new Error('当前环境没有 TapTap 排行榜')); return; }
      var st = state();
      if (!st) { reject(new Error('还没有进行中的档位，先入世修行')); return; }
      if (st.game && st.game.s && st.game.s.ended) { reject(new Error('本档已结束，无法上报')); return; }
      var score = livePower();
      if (!score) { reject(new Error('读不到战力数值')); return; }
      if (!force && score <= bestSubmitted) { resolve({ skipped: true, score: score }); return; }
      var now = Date.now();
      if (!force && now - lastSubmitAt < CONFIG.leaderboardAuto.minIntervalMs) {
        resolve({ skipped: true, score: score });
        return;
      }
      var lb = TAP.getLeaderboardManager();
      lastSubmitAt = now;
      lb.submitScores({
        scores: [{ leaderboardId: CONFIG.leaderboard.power, score: Math.round(score) }],
        callback: {
          onSuccess: function (res) {
            bestSubmitted = Math.max(bestSubmitted, score);
            resolve({ score: score, res: res });
          },
          onFailure: function (code, message) {
            reject(new Error('上报失败(' + code + ')：' + (message || '')));
          }
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
   * 飞升速通榜：按「消耗的寿命」排序，越小越好
   *   耗寿分钟 = 历时分钟 + 战败次数 × 16 年 × 5760 分钟/年
   *   分数     = round(耗寿分钟 / 5760 × 100)   → 35 = 耗寿 35 年
   * 用 ×100 是为了保留两位小数：一次通关约 20~40 年，
   * 若直接取整年，全服只有 20 来个不同数值，大面积并列。
   * ---------------------------------------------------------------------- */
  function ascensionCostScore(record) {
    var cfg = CONFIG.life;
    var minutes = Number(record && record.elapsedMinutes);
    if (!isFinite(minutes) || minutes < 0) return 0;
    var defeats = Number(record && record.defeats) || 0;
    if (!isFinite(defeats) || defeats < 0) defeats = 0;
    var lifeMinutes = minutes + defeats * cfg.defeatYears * cfg.yearMinutes;
    return Math.floor(lifeMinutes / cfg.yearMinutes * cfg.scoreScale);
  }

  function submitAscension(record) {
    return new Promise(function (resolve, reject) {
      if (!leaderboardAvailable() || !CONFIG.leaderboard.speedrun) {
        reject(new Error('当前环境没有速通榜')); return;
      }
      var score = ascensionCostScore(record);
      if (!(score > 0)) { reject(new Error('没有可上报的飞升记录')); return; }
      var lb = TAP.getLeaderboardManager();
      lb.submitScores({
        scores: [{ leaderboardId: CONFIG.leaderboard.speedrun, score: score }],
        callback: {
          onSuccess: function (res) { resolve({ score: score, res: res }); },
          onFailure: function (code, message) {
            reject(new Error('速通榜上报失败(' + code + ')：' + (message || '')));
          }
        }
      });
    });
  }

  function openSpeedrunLeaderboard() {
    return new Promise(function (resolve, reject) {
      if (!leaderboardAvailable() || !CONFIG.leaderboard.speedrun) {
        reject(new Error('当前环境没有速通榜')); return;
      }
      var lb = TAP.getLeaderboardManager();
      lb.openLeaderboard({
        leaderboardId: CONFIG.leaderboard.speedrun,
        callback: {
          onSuccess: function (r) { resolve(r); },
          onFailure: function (code, message) { reject(new Error('打开速通榜失败(' + code + ')：' + (message || ''))); }
        }
      });
    });
  }

  function openLeaderboard() {
    return new Promise(function (resolve, reject) {
      if (!leaderboardAvailable()) { reject(new Error('当前环境没有 TapTap 排行榜')); return; }
      var lb = TAP.getLeaderboardManager();
      lb.openLeaderboard({
        leaderboardId: CONFIG.leaderboard.power,
        callback: {
          onSuccess: function (r) { resolve(r); },
          onFailure: function (code, message) { reject(new Error('打开榜单失败(' + code + ')：' + (message || ''))); }
        }
      });
    });
  }

  /* ==========================================================================
   * 10. 自动同步（保守节流，只在存档真的变化时触发）
   * ======================================================================== */
  var lastTick = -1;

  function watchSave() {
    setInterval(function () {
      var tick = globalThis.__QTAP_SAVE_TICK || 0;
      if (tick === lastTick) return;
      lastTick = tick;
      var now = Date.now();
      if (CONFIG.cloudSave.autoSync && cloudAvailable() &&
          now - lastUploadAt >= CONFIG.cloudSave.minIntervalMs) {
        uploadCloud(false).catch(function (e) { log('auto cloud skipped: ' + e.message); });
      }
      if (CONFIG.leaderboardAuto.enabled && leaderboardAvailable()) {
        submitPower(false).catch(function (e) { log('auto lb skipped: ' + e.message); });
      }
    }, 5000);
  }

  /* ==========================================================================
   * 11. 界面：并入游戏「设置」面板，不占用任何游戏画面
   * ======================================================================== */
  var CSS = [
    '#qtap-settings-block .qtap-cloud-line{margin:4px 0 8px;color:#4a5a4a;line-height:1.6}',
    '#qtap-settings-block .qtap-troubleshoot{margin-top:8px;border-top:1px dashed #cfd6cf;padding-top:6px}',
    '#qtap-settings-block .qtap-troubleshoot summary{cursor:pointer;color:#5a6b5a;font-size:13px;padding:4px 0}',
    '#qtap-toast{position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:10000;background:#111;color:#fff;',
    'padding:9px 14px;border-radius:6px;font-size:12px;max-width:80vw;opacity:0;pointer-events:none;',
    'transition:opacity .18s;text-align:center}',
    '#qtap-toast.show{opacity:1}',
    '#qtap-settings-block{margin-top:2px}',
    '#qtap-settings-block .qtap-status{font-size:11px;line-height:1.7;margin:5px 0 0;white-space:pre-wrap;',
    'word-break:break-all;color:inherit;opacity:.72}',
    '#qtap-settings-block .qtap-status.is-warn{color:#a04b42;opacity:1}'
  ].join('\n');

  function closestEl(node, sel) {
    while (node && node !== document) {
      if (node.nodeType === 1 && node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function hasBossAchievementIds() {
    var map = CONFIG.achievements && CONFIG.achievements.boss;
    if (!map) return false;
    return Object.keys(map).some(function (k) { return String(map[k] || '').trim(); });
  }

  function envSummary() {
    return (MOCK ? '模拟模式（未接入真实 TapTap 环境）' : 'TapTap 运行环境') +
      ' · 激励视频 ' + (adsAvailable() ? ('可用 · 广告位 ' + CONFIG.ads.spaceId) : '不可用（直接发放）') +
      ' · 云存档 ' + (cloudAvailable() ? '可用' : '不可用') +
      ' · 战力榜 ' + (leaderboardAvailable() ? '可用' : '未配置') +
      ' · 成就 ' + (achievementAvailable() ? (hasBossAchievementIds() ? '可用' : '待填 ID') : '不可用');
  }

  function injectSettingsEntry() {
    var body = document.getElementById('panel-body');
    if (!body) return false;
    if (!body.querySelector('[data-a="theme-set"]')) return false;    // 不是设置面板
    if (body.querySelector('#qtap-settings-block')) return true;      // 已经注入过

    hideLegacySaveRow(body);

    var block = document.createElement('div');
    block.id = 'qtap-settings-block';
    block.innerHTML =
      '<h3>云端存档</h3>' +
      '<p class="qtap-cloud-line" id="qtap-cloud-line"></p>' +
      '<div class="inline-buttons">' +
        '<button class="btn" data-qtap="lbsubmit">上报战力</button>' +
        '<button class="btn" data-qtap="lbopen">打开战力榜</button>' +
        '<button class="btn" data-qtap="lbopen-speed">飞升速通榜</button>' +
        '<button class="btn" data-qtap="achievements">成就</button>' +
      '</div>' +
      '<details class="qtap-troubleshoot">' +
        '<summary>存档排障</summary>' +
        '<div class="inline-buttons">' +
          '<button class="btn" data-qtap-legacy="export">导出存档</button>' +
          '<button class="btn" data-qtap-legacy="import">导入存档</button>' +
          '<button class="btn" data-qtap-legacy="restore">恢复上次备份</button>' +
        '</div>' +
        '<div class="inline-buttons" style="margin-top:5px">' +
          '<button class="btn" data-qtap="upload">立即同步云端</button>' +
          '<button class="btn" data-qtap="restore">从云端恢复</button>' +
          '<button class="btn" data-qtap="list">查看云存档</button>' +
        '</div>' +
        '<p class="qtap-status" id="qtap-inline-status"></p>' +
      '</details>';

    // 位置：紧贴游戏原本的存档按钮行（该行已被隐藏）之前，保证在面板顶部可见
    var legacyRow = body.querySelector('[data-qtap-hidden="1"]');
    if (legacyRow && legacyRow.parentNode === body) body.insertBefore(block, legacyRow);
    else body.insertBefore(block, body.firstChild);

    var line = document.getElementById('qtap-cloud-line');
    if (line) line.textContent = cloudSummary();
    var st = document.getElementById('qtap-inline-status');
    if (st) st.textContent = envSummary();
    return true;
  }

  /** 把游戏原生的「导出/导入/恢复上次备份」整行及提示句隐藏，改由排障区代理 */
  function hideLegacySaveRow(body) {
    try {
      var exportBtn = body.querySelector('[data-a="export"]');
      if (!exportBtn) return;
      var row = closestEl(exportBtn, '.inline-buttons');
      if (row) { row.setAttribute('data-qtap-hidden', '1'); row.style.display = 'none'; }
      var hint = row && row.nextElementSibling;
      if (hint && hint.tagName === 'P' && /换文件路径|先导出/.test(hint.textContent || '')) {
        hint.setAttribute('data-qtap-hidden', '1');
        hint.style.display = 'none';
      }
    } catch (e) {}
  }

  function setStatus(msg, isWarn) {
    var n = document.getElementById('qtap-inline-status');
    if (n) {
      n.textContent = msg;
      n.className = 'qtap-status' + (isWarn ? ' is-warn' : '');
    } else {
      toast(msg, isWarn ? 'warn' : 'ok');
    }
  }

  function act(kind) {
    var p;
    if (kind === 'upload') {
      setStatus('正在上传…');
      p = uploadCloud(true).then(function () {
        setStatus('已上传 ' + collectPayload().count + ' 个存档键 · uuid: ' +
          (archiveUuid() || '-'));
      });
    } else if (kind === 'restore') {
      setStatus('正在从云端恢复…');
      p = restoreCloud().then(function (r) {
        setStatus('已恢复 ' + r.count + ' 个键，正在重载游戏…');
        setTimeout(function () { location.reload(); }, 1000);
      });
    } else if (kind === 'list') {
      setStatus('正在读取…');
      p = listCloud().then(function (list) {
        if (!list.length) { setStatus('云端还没有存档'); return; }
        setStatus(list.map(function (s, i) {
          return (i + 1) + ') ' + (s.name || '-') + '  ' + (s.summary || '') +
                 '\n   uuid: ' + (s.uuid || '-');
        }).join('\n'));
      });
    } else if (kind === 'lbsubmit') {
      setStatus('正在上报战力…');
      p = submitPower(true).then(function (r) {
        setStatus(r.skipped ? '战力未超过已上报值，已跳过'
                            : ('已上报战力 ' + Math.round(r.score)));
      });
    } else if (kind === 'lbopen-speed') {
      setStatus('正在打开速通榜…');
      openSpeedrunLeaderboard().then(function () {
        setStatus('速通榜已打开（数字即耗寿年数，越小越好）');
      }).catch(function (err) { setStatus(err.message, true); });
      return;
    } else if (kind === 'achievements') {
      setStatus('正在打开成就…');
      if (!showAchievements()) setStatus('当前环境暂不支持成就面板', true);
      else setStatus('成就面板已打开');
      return;
    } else if (kind === 'lbopen') {
      setStatus('正在打开榜单…');
      p = openLeaderboard().then(function () { setStatus('榜单已打开'); });
    } else {
      return;
    }
    p.catch(function (e) { setStatus((e && e.message) || String(e), true); });
  }

  function bindPanelActions() {
    var root = document.getElementById('panel-root');
    if (!root || root.__qtapBound) return;
    root.__qtapBound = true;
    root.addEventListener('click', function (e) {
      var legacy = closestEl(e.target, '[data-qtap-legacy]');
      if (legacy) {
        e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.stopPropagation();
        var legacyAct = legacy.getAttribute('data-qtap-legacy');
        var native = document.querySelector('[data-a="' + legacyAct + '"]');
        if (native) native.click();
        return;
      }
      var b = closestEl(e.target, '[data-qtap]');
      if (!b) return;
      e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      e.stopPropagation();
      act(b.getAttribute('data-qtap'));
    }, false);
  }

  var panelObserver = null;
  function watchPanel() {
    bindPanelActions();
    var root = document.getElementById('panel-root');
    if (!root) return;
    if (!panelObserver) {
      panelObserver = new MutationObserver(function () { injectSettingsEntry(); });
      panelObserver.observe(root, { childList: true, subtree: true });
    }
    injectSettingsEntry();
  }

  function openSettings() {
    var b = document.querySelector('[data-a="panel"][data-name="settings"]');
    if (b) b.click();
  }

  /* ==========================================================================
   * 12. 启动
   * ======================================================================== */
  function boot() {
    try {
      var style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);
    } catch (e) { log('style inject failed', e); }
    try { ensureAd(); } catch (e) { log('ad init failed', e); }
    try { installAdInterceptor(); } catch (e) { log('interceptor failed', e); }
    try { watchPanel(); } catch (e) { log('watchPanel failed', e); }
    setTimeout(function () { try { watchPanel(); } catch (e) {} }, 800);
    watchSave();
    try { setTimeout(bootstrapCloud, 600); } catch (e) { log('cloud bootstrap failed', e); }
    log('booted, mode=' + (MOCK ? 'mock' : 'taptap') + ', storage=' + STORAGE);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ==========================================================================
   * 13. 对外接口
   * ======================================================================== */
  globalThis.QTap = {
    version: VERSION,
    config: CONFIG,
    isMock: function () { return MOCK; },
    env: {
      hasTap: !!TAP,
      storage: STORAGE,
      cloud: cloudAvailable,
      leaderboard: leaderboardAvailable,
      achievements: achievementAvailable,
      ads: adsAvailable
    },
    ads: {
      spaceId: CONFIG.ads.spaceId,
      available: adsAvailable,
      show: showAd,
      stats: function () {
        return { plays: adState.plays, rewards: adState.rewards, declines: adState.declines,
                 failures: adState.failures, ready: adState.ready, playing: adState.playing,
                 lastError: adState.lastError };
      }
    },
    cloud: {
      upload: uploadCloud,
      list: listCloud,
      restore: restoreCloud,
      collect: collectPayload,
      uuid: archiveUuid,
      mode: function () { return cloudMode; },
      status: function () { return cloudMessage; },
      hasLocalMainSave: hasLocalMainSave,
      bootstrap: bootstrapCloud
    },
    achievements: {
      available: achievementAvailable,
      unlock: unlockAchievement,
      unlockBoss: unlockBossAchievement,
      show: showAchievements
    },
    leaderboard: {
      submit: submitPower,
      open: openLeaderboard,
      submitAscension: submitAscension,
      openSpeedrun: openSpeedrunLeaderboard,
      ascensionCostScore: ascensionCostScore
    },
    getState: state,
    getPower: livePower,
    ui: {
      openSettings: openSettings,
      status: setStatus,
      inject: injectSettingsEntry
    }
  };
})();

window.__SHANYE_STANDARD_BOARD_IDS={"power":"x2vrind450ieimxazy","speedrun":"gohqzrhs79kgpryrbr"};
/* V90.64 TapTap ranked modes. Install immediately AFTER the existing QTap adapter.
   This guard also protects the adapter's PRIVATE auto-power and settings handlers:
   those read QTap.config.leaderboard, not the public methods alone.
   Never invent an official standard leaderboard ID. */
(function (g) {
  'use strict';
  const q=g.QTap;
  if (!q?.config?.leaderboard || !q.leaderboard || q.rankDifficulty?.sync) return;
  const cfg=q.config.leaderboard;
  const original={
    power:String(cfg.power||''), speedrun:String(cfg.speedrun||'')
  };
  const supplied=g.__SHANYE_STANDARD_BOARD_IDS||{};
  const standard={
    power:String(supplied.power||''), speedrun:String(supplied.speedrun||'')
  };
  if(standard.power===original.power||standard.speedrun===original.speedrun ||
     (standard.power && standard.power===standard.speedrun)){
    standard.power='';standard.speedrun='';
  }
  // Underlying qtap-3 adapter otherwise submits to its single hardcoded power
  // leaderboard from a private watchSave() closure, bypassing public API guards.
  // Disable THAT watcher and reimplement safe, mode-scoped auto-submission.
  const auto=q.config.leaderboardAuto;
  const autoInterval=auto?.minIntervalMs||120000;
  if(auto)auto.enabled=false;
  const baseApi={
    submit:q.leaderboard.submit,
    submitAscension:q.leaderboard.submitAscension,
    open:q.leaderboard.open,
    openSpeedrun:q.leaderboard.openSpeedrun
  };
  function currentMode(){
    const st=g.__QTAP_STATE;
    if(!st?.role || !st?.game?.s?.difficulty)return null;
    const mode=st.game.s.difficulty;
    return mode==='standard'||mode==='challenge'||mode==='easy'?mode:null;
  }
  function sync(){
    const mode=currentMode();
    const dest=mode==='challenge'?original:mode==='standard'?standard:null;
    // Empty SDK IDs are fail-closed for easy, missing, or unconfigured standard;
    // no score is ever written to a challenge board by a standard/easy player.
    cfg.power=dest?.power||'';
    cfg.speedrun=dest?.speedrun||'';
    if(auto)auto.enabled=false;
    return {mode, powerReady:!!cfg.power,speedrunReady:!!cfg.speedrun};
  }
  function guard(method,kind,args){
    const state=sync();
    if(state.mode==='easy'||!state.mode)
      return Promise.resolve({skipped:true,reason:state.mode==='easy'?'easy-unranked':'no-playing-character'});
    if(!state[kind+'Ready'])
      return Promise.reject(new Error(state.mode==='standard'?'标准模式排行榜未配置独立 TapTap 榜单 ID':'挑战排行榜暂不可用'));
    const fn=baseApi[method];
    if(typeof fn!=='function')return Promise.reject(new Error('TapTap 排行榜接口不可用'));
    try{return Promise.resolve(fn.apply(q.leaderboard,args))}
    catch(e){return Promise.reject(e)}
  }
  q.leaderboard.submit=function(force){return guard('submit','power',[force]);};
  q.leaderboard.submitAscension=function(record){
    const mode=currentMode();
    if(record?.difficulty && record.difficulty!==mode)
      return Promise.reject(new Error('飞升成绩难度与角色存档不一致'));
    return guard('submitAscension','speedrun',[record]);
  };
  q.leaderboard.open=function(){return guard('open','power',[]);};
  q.leaderboard.openSpeedrun=function(){return guard('openSpeedrun','speedrun',[]);};
  q.rankDifficulty={
    sync,
    mode:currentMode,
    standardConfigured:()=>!!standard.power&&!!standard.speedrun,
    originalChallengeIdsUnchanged:()=>!!original.power&&!!original.speedrun,
    // Client IDs are not secrets; diagnostics avoid logging user identifiers.
    readiness:()=>sync()
  };
  // Begin with no leaderboard available until a SAVED/PLAYING character is
  // known. The render/persist bridge should call rankDifficulty.sync().
  sync();
  let lastTick=-1, lastSubmitAt=0, lastMode=null;
  if(typeof g.setInterval==='function')g.setInterval(function(){
    const tick=g.__QTAP_SAVE_TICK||0;
    if(tick===lastTick)return;
    lastTick=tick;
    const state=sync();
    if(!state.powerReady || !q.env?.leaderboard?.())return;
    const now=Date.now(),change=lastMode!==state.mode;
    if(!change && now-lastSubmitAt<autoInterval)return;
    lastSubmitAt=now;lastMode=state.mode;
    q.leaderboard.submit(true).catch(function(){});
  },5000);
})(globalThis);

