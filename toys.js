/* 宿舍玩具盒 · toys.js — 纯前端，无后端，无依赖 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 侧边栏：置顶 7 个在最前面，其余按顺序，一行两个方块 ---------- */
  const PINNED_IDS = ["wheel", "dice", "reaction", "guess", "score", "beads", "frog", "fortune"];
  const TOY_ORDER = {}; // v3.0 第5轮：TOYS 原顺序，搜索清空后恢复用
  TOYS.forEach((t, i) => { TOY_ORDER[t.id] = i; });
  const drawerNav = $("drawerNav");
  function splitLabel(label) {
    const i = label.indexOf(" ");
    return i >= 0 ? { emoji: label.slice(0, i), name: label.slice(i + 1) } : { emoji: "🧸", name: label };
  }
  function makeTile(t) {
    const parts = splitLabel(t.label);
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.setAttribute("data-toy", t.id);
    btn.setAttribute("aria-label", "打开" + parts.name); // v2.0：无障碍
    const em = document.createElement("span");
    em.className = "tile-emoji";
    em.textContent = parts.emoji;
    const nm = document.createElement("span");
    nm.className = "tile-name";
    nm.textContent = parts.name;
    btn.appendChild(em);
    btn.appendChild(nm);
    btn._q = (parts.emoji + parts.name + (t.py || "") + (t.label || "")).toLowerCase(); // v1.30 搜索缓存；v2.0 加拼音首字母
    btn._name = parts.name.toLowerCase(); // v3.0 第5轮：搜索相关性排序用
    btn._cat = t.cat || ""; // v2.0：分类筛选
    btn.addEventListener("click", () => { showToy(t.id); closeDrawer(); });
    return btn;
  }
  function drawerLabel(text) {
    const p = document.createElement("p");
    p.className = "drawer-label";
    p.textContent = text;
    return p;
  }
  drawerNav.appendChild(drawerLabel("📌 置顶"));
  PINNED_IDS.map((id) => TOYS.find((t) => t.id === id)).filter(Boolean).forEach((t) => drawerNav.appendChild(makeTile(t)));
  // v3.0 第7轮：抽屉按分类分组（83 个平铺太难翻）
  const DRAWER_CATS = [["game", "🎮 游戏"], ["puzzle", "🧠 益智"], ["tool", "🛠 工具"], ["party", "🎉 派对"]];
  DRAWER_CATS.forEach(([cat, name]) => {
    const list = TOYS.filter((t) => !PINNED_IDS.includes(t.id) && (t.cat || "") === cat);
    if (list.length === 0) return;
    drawerNav.appendChild(drawerLabel(name));
    list.forEach((t) => drawerNav.appendChild(makeTile(t)));
  });
  // 兜底：没有 cat 字段的玩具
  const drawerNoCat = TOYS.filter((t) => !PINNED_IDS.includes(t.id) && !(t.cat || ""));
  if (drawerNoCat.length > 0) {
    drawerNav.appendChild(drawerLabel("其它"));
    drawerNoCat.forEach((t) => drawerNav.appendChild(makeTile(t)));
  }
  // v3.0 第7轮：搜索/过滤后，隐藏没有可见玩具的分组标题
  function updateDrawerLabels() {
    const nav = $("drawerNav");
    if (!nav || !nav.children) return;
    let cur = null, vis = 0;
    const flush = () => { if (cur && cur.classList) cur.classList.toggle("hidden", vis === 0); };
    Array.from(nav.children).forEach((c) => {
      if (!c.classList) return;
      if (c.classList.contains("drawer-label")) { flush(); cur = c; vis = 0; }
      else if (c.classList.contains("tile") && !c.classList.contains("hidden")) vis++;
    });
    flush();
  }
  // v3.0 第7轮：抽屉过滤（主搜索/抽屉搜索/分类叠加，抽屉搜索优先）
  function refreshDrawerFilter() {
    const dq = ($("drawerSearch") && $("drawerSearch").value || "").trim().toLowerCase();
    const mq = ($("toySearch") && $("toySearch").value || "").trim().toLowerCase();
    const q = dq || mq;
    allTiles().forEach((b) => {
      let show = true;
      if (q) show = searchScore(q, b) !== 0;
      else if (activeCat !== "all") show = b._cat === activeCat;
      b.classList.toggle("hidden", !show);
    });
    updateDrawerLabels();
  }
  function allTiles() {
    return [...drawerNav.querySelectorAll(".tile")];
  }
  /* v1.27：主页——置顶 8 个 + 全部游戏，点一下就玩（复用抽屉的方块样式） */
  const homePinnedGrid = $("homePinnedGrid");
  const homeAllGrid = $("homeAllGrid");
  PINNED_IDS.map((id) => TOYS.find((t) => t.id === id)).filter(Boolean).forEach((t) => homePinnedGrid.appendChild(makeTile(t)));
  TOYS.forEach((t) => homeAllGrid.appendChild(makeTile(t)));
  function allHomeTiles() {
    return [...homePinnedGrid.querySelectorAll(".tile"), ...homeAllGrid.querySelectorAll(".tile")];
  }
  /* ---------- v1.30 后端优化：懒初始化框架 + 通用工具 ---------- */
  const toyInitFns = {};  // 玩具 id -> 初始化函数（各段落注册）
  const toyInited = {};   // 玩具 id -> 是否已初始化
  function ensureToyInit(id) {
    if (toyInited[id]) return;
    const fn = toyInitFns[id];
    if (typeof fn !== "function") return;
    // R14：先跑初始化、成功后再标记。原来先标记再跑，出错后玩具永久"已初始化"却没监听器，点开是死的。
    try { fn(); toyInited[id] = true; }
    catch (e) { try { console.error("[toybox] init failed:", id, e); } catch (_) {} }
  }
  // 上收的公共小工具（原来散在各段落里重复定义）
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  function todayStr() { return new Date().toDateString(); }
  // localStorage 安全读写（原来每处 try/catch 重复写）
  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null || v === undefined ? fallback : v; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 忽略：无痕模式等 */ }
  }
  function loadBest(key) { return parseInt(lsGet(key, "0"), 10) || 0; }
  function saveBest(key, value) { lsSet(key, String(value)); }
  /* ---------- v1.32：统一音效系统（WebAudio 合成，零外部文件） ---------- */
  const SFX_KEY = "dorm-toybox-sfx-v1";
  const SFX = {
    enabled: lsGet(SFX_KEY, "1") === "1",
    _ctx: null,
    _ctxTried: false,
    ctx() {
      if (this._ctx) return this._ctx;
      if (this._ctxTried) return null;
      this._ctxTried = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this._ctx = new AC();
        return this._ctx;
      } catch (e) { return null; }
    },
    // 解锁：首次用户手势时 resume（移动端自动播放策略）
    unlock() {
      const c = this.ctx();
      if (c && c.state === "suspended") { c.resume().catch(() => {}); }
    },
    toggle() {
      this.enabled = !this.enabled;
      lsSet(SFX_KEY, this.enabled ? "1" : "0");
      return this.enabled;
    },
    // 基础：单音
    _tone(freq, dur, type, vol, when, slideTo) {
      if (!this.enabled) return;
      const c = this.ctx();
      if (!c) return;
      try {
        const t0 = c.currentTime + (when || 0);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { /* 忽略 */ }
    },
    // 噪声（打击/爆炸）
    _noise(dur, vol, when, lowpass) {
      if (!this.enabled) return;
      const c = this.ctx();
      if (!c) return;
      try {
        const t0 = c.currentTime + (when || 0);
        const len = Math.floor(c.sampleRate * dur);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource();
        src.buffer = buf;
        const g = c.createGain();
        g.gain.setValueAtTime(vol || 0.2, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        let node = src;
        if (lowpass) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lowpass; src.connect(f); node = f; }
        node.connect(g); g.connect(c.destination);
        src.start(t0);
      } catch (e) { /* 忽略 */ }
    },
    click() { this._tone(600, 0.07, "square", 0.08); },
    pop(pitch) { // pitch: 0~1，越高音越高（2048/连击用）
      const f = 400 + (pitch || 0) * 600;
      this._tone(f, 0.12, "sine", 0.16, 0, f * 1.5);
    },
    coin() { this._tone(880, 0.08, "square", 0.1); this._tone(1320, 0.18, "square", 0.1, 0.08); },
    win() { [523, 659, 784].forEach((f, i) => this._tone(f, 0.16, "triangle", 0.16, i * 0.1)); },
    lose() { [400, 300, 200].forEach((f, i) => this._tone(f, 0.2, "sawtooth", 0.1, i * 0.12)); },
    hit() { this._noise(0.15, 0.25, 0, 1200); },
    jump() { this._tone(300, 0.18, "sine", 0.14, 0, 700); },
    shoot() { this._tone(1200, 0.12, "sawtooth", 0.08, 0, 300); },
  };
  // 全局首次交互解锁音频
  if (typeof document !== "undefined" && document.addEventListener) {
    const unlockOnce = () => { SFX.unlock(); };
    document.addEventListener("pointerdown", unlockOnce, { once: true });
    document.addEventListener("touchstart", unlockOnce, { once: true });
  }
  /* ---------- v1.30：奶蛙图片数据懒加载（frog-data*.js 共 1.7MB，点开奶蛙相关玩具时才加载） ---------- */
  const FROG_DATA_FILES = ["frog-data.js", "frog-data-2.js", "frog-data-3.js", "frog-data-4.js", "frog-data-5.js"];
  let frogDataPromise = null;
  function getFrogStickers() {
    return [
      ...(typeof FROG_PART1 !== "undefined" ? FROG_PART1 : []),
      ...(typeof FROG_PART2 !== "undefined" ? FROG_PART2 : []),
      ...(typeof FROG_PART3 !== "undefined" ? FROG_PART3 : []),
      ...(typeof FROG_PART4 !== "undefined" ? FROG_PART4 : []),
      ...(typeof FROG_PART5 !== "undefined" ? FROG_PART5 : []),
    ];
  }
  function ensureFrogData() {
    if (frogDataPromise) return frogDataPromise;
    frogDataPromise = new Promise((resolve) => {
      // 测试桩把 frog-data 直接拼进来了，真实浏览器才走动态加载
      if (typeof FROG_PART1 !== "undefined" || typeof document === "undefined" || !document.head) { resolve(true); return; }
      let i = 0;
      const next = () => {
        if (i >= FROG_DATA_FILES.length) { resolve(true); return; }
        const sc = document.createElement("script");
        sc.src = FROG_DATA_FILES[i++];
        sc.onload = next;
        sc.onerror = next; // 某批失败也不卡死，剩下的继续
        document.head.appendChild(sc);
      };
      next();
    });
    return frogDataPromise;
  }
  /* ---------- v1.30：最近玩过（localStorage 存最近 8 个，主页紧凑横滑条） ---------- */
  const RECENT_KEY = "dorm-toybox-recent-v1";
  const RECENT_MAX = 8;
  function getRecent() {
    // v2.0：存 {id, t} 带时间戳；兼容旧版纯 id 数组；超 7 天自动清理
    try {
      const arr = JSON.parse(lsGet(RECENT_KEY, "[]"));
      if (!Array.isArray(arr)) return [];
      const now = Date.now();
      const week = 7 * 24 * 3600 * 1000;
      return arr
        .map((x) => (typeof x === "string" ? { id: x, t: now } : x))
        .filter((x) => x && x.id && TOYS.some((t) => t.id === x.id) && (now - (x.t || 0) < week))
        .slice(0, RECENT_MAX);
    } catch (e) { return []; }
  }
  function recordRecent(id) {
    if (!TOYS.some((t) => t.id === id)) return;
    const now = Date.now();
    const rest = getRecent().filter((x) => x.id !== id);
    lsSet(RECENT_KEY, JSON.stringify([{ id, t: now }, ...rest].slice(0, RECENT_MAX)));
  }
  function relTime(t) {
    // v2.0：相对时间中文显示
    const d = Date.now() - t;
    if (d < 60 * 1000) return "刚刚";
    if (d < 3600 * 1000) return Math.floor(d / 60000) + " 分钟前";
    if (d < 24 * 3600 * 1000) return Math.floor(d / 3600000) + " 小时前";
    return Math.floor(d / 86400000) + " 天前";
  }
  function renderRecent() {
    const wrap = $("recentWrap");
    const strip = $("recentStrip");
    if (!wrap || !strip) return;
    const ids = getRecent();
    strip.innerHTML = "";
    if (ids.length === 0) { wrap.classList.add("hidden"); return; }
    wrap.classList.remove("hidden");
    ids.forEach((item) => {
      const id = item.id;
      const t = TOYS.find((x) => x.id === id);
      if (!t) return;
      const parts = splitLabel(t.label);
      const btn = document.createElement("button");
      btn.className = "recent-chip";
      btn.setAttribute("data-toy", id);
      btn.setAttribute("aria-label", "最近玩过：" + parts.name + "，" + relTime(item.t || Date.now()));
      const em = document.createElement("span");
      em.className = "recent-emoji";
      em.textContent = parts.emoji;
      const nm = document.createElement("span");
      nm.className = "recent-name";
      nm.textContent = parts.name;
      const tm = document.createElement("span");
      tm.className = "recent-time";
      tm.textContent = relTime(item.t || Date.now());
      btn.appendChild(em);
      btn.appendChild(nm);
      btn.appendChild(tm);
      btn.addEventListener("click", () => showToy(id));
      strip.appendChild(btn);
    });
  }
  /* 退出玩具时收尾：声音、麦克风、待定超时都要停，回来时显示类计时器再续上 */
  const toyLeaveCleanup = {};
  const toyEnterResume = {};
  function leaveToy(id) {
    if (id && toyLeaveCleanup[id]) toyLeaveCleanup[id]();
    // 手持弹幕全屏是独立浮层，切玩具时一定关掉
    if (typeof ledCloseFull === "function") ledCloseFull();
  }
  let currentToy = null;
  let homeScrollY = 0; // v3.0 第7轮：记住主页滚动位置，返回时恢复
  /* v1.31：工具箱合并——多个入口共享同一个工具箱界面（不同默认 tab）。
     TOYS 列表 80 个 id 不变；点 stopwatch/aa/fx/bmi 会重定向到对应工具箱。 */
  const TOOLBOX_REDIRECT = {
    "stopwatch": "timer",
    "aa": "ledger",
    "fx": "kin",
    "bmi": "kin",
  };
  const TOOLBOX_DEFAULT_TAB = {
    "stopwatch": "sw",
    "aa": "aa",
    "fx": "fx",
    "bmi": "bmi",
  };
  function showToy(id) {
    const clickedId = id; // 用户实际点的入口（用于最近玩过和高亮）
    if (!TOYS.some((t) => t.id === id)) id = "wheel";
    // v3.0 第7轮：从主页进入时记住滚动位置（玩具间跳转不覆盖）
    if (!currentToy) { try { homeScrollY = window.scrollY || 0; } catch (e) {} }
    // 工具箱重定向：共享界面，默认 tab 不同
    // R18：父入口本身也有默认 tab（timer→番茄钟、kin→亲戚、ledger→记账），点父入口也要回到默认 tab，
    // 否则上次停在秒表/BMI，再点时间工具箱/实用计算器还是上次的 tab，入口名不副实。
    const defTab = TOOLBOX_DEFAULT_TAB[clickedId] || { timer: "pomodoro", kin: "kin", ledger: "ledger" }[clickedId] || null;
    if (TOOLBOX_REDIRECT[id]) {
      window._toolboxDefaultTab = TOOLBOX_DEFAULT_TAB[clickedId];
      id = TOOLBOX_REDIRECT[id];
    }
    ensureToyInit(id);
    // R18：工具箱已初始化过时，入口切换也要跟过去（fx→bmi、timer→stopwatch 等）。
    // 原来只在 init 里读 _toolboxDefaultTab，第二次点入口时 init 不再跑，tab 停在上次的位置，
    // 用户点了 BMI 入口却还看到汇率 tab。先点一次对应 tab 按钮（真实浏览器，顺带切 active 态），
    // 再直接切面板（冒烟桩里 tab 按钮没有子节点，只能直接切面板；真实浏览器里和点按钮是同一结果，幂等）。
    if (defTab) {
      const spec = {
        pomodoro: { bar: "timeTabBar", attr: "data-ttab", panel: "timeTabPomodoro", panels: ["timeTabPomodoro", "timeTabSw", "timeTabCountup"] },
        sw: { bar: "timeTabBar", attr: "data-ttab", panel: "timeTabSw", panels: ["timeTabPomodoro", "timeTabSw", "timeTabCountup"] },
        countup: { bar: "timeTabBar", attr: "data-ttab", panel: "timeTabCountup", panels: ["timeTabPomodoro", "timeTabSw", "timeTabCountup"] },
        kin: { bar: "calcTabBar", attr: "data-ctab", panel: "calcTabKin", panels: ["calcTabKin", "calcTabFx", "calcTabBmi"] },
        fx: { bar: "calcTabBar", attr: "data-ctab", panel: "calcTabFx", panels: ["calcTabKin", "calcTabFx", "calcTabBmi"] },
        bmi: { bar: "calcTabBar", attr: "data-ctab", panel: "calcTabBmi", panels: ["calcTabKin", "calcTabFx", "calcTabBmi"] },
        ledger: { bar: "ledgerTabBar", attr: "data-ltab", panel: "ledgerTabLedger", panels: ["ledgerTabLedger", "ledgerTabAa"] },
        aa: { bar: "ledgerTabBar", attr: "data-ltab", panel: "ledgerTabAa", panels: ["ledgerTabLedger", "ledgerTabAa"] },
      }[defTab];
      if (spec) {
        const bar = $(spec.bar);
        if (bar) bar.querySelectorAll(".toolbox-tab").forEach((b) => { if (b.getAttribute(spec.attr) === defTab) b.click(); });
        spec.panels.forEach((pid) => { const p = $(pid); if (p) p.classList.toggle("hidden", pid !== spec.panel); });
      }
    }
    recordRecent(clickedId);
    if (currentToy && currentToy !== id) leaveToy(currentToy);
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-home").classList.add("hidden");
    $("toy-" + id).classList.remove("hidden");
    allTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === clickedId));
    allHomeTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === clickedId));
    currentToy = id;
    if (toyEnterResume[id]) toyEnterResume[id]();
    showHowtoBar(clickedId); // v1.33：新手引导（首次打开显示怎么玩）
    if (window.location.hash !== "#" + clickedId) window.location.hash = clickedId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /* v1.33：怎么玩提示条——首次打开某玩具时显示，可关闭；"？"按钮可重新显示 */
  var HOWTO_SEEN_KEY = "dorm-toybox-howto-seen-v1";
  function getHowtoSeen() {
    try {
      var v = JSON.parse(localStorage.getItem(HOWTO_SEEN_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function markHowtoSeen(tid) {
    try {
      var seen = getHowtoSeen();
      if (seen.indexOf(tid) === -1) { seen.push(tid); localStorage.setItem(HOWTO_SEEN_KEY, JSON.stringify(seen)); }
    } catch (e) { /* 忽略 */ }
  }
  function showHowtoBar(tid, force) {
    var toy = TOYS.find(function (t) { return t.id === tid; });
    if (!toy || !toy.howto) return;
    var panel = $("toy-" + tid);
    // 工具箱重定向的入口（stopwatch/aa/fx/bmi）没有独立 panel，跳过
    if (!panel) return;
    var old = panel.querySelector(".howto-bar");
    if (old) {
      try {
        if (typeof old.remove === "function") old.remove();
        else if (old.parentNode && typeof old.parentNode.removeChild === "function") old.parentNode.removeChild(old);
      } catch (e) { /* 桩环境忽略 */ }
    }
    if (!force && getHowtoSeen().indexOf(tid) !== -1) return;
    var bar = document.createElement("div");
    bar.className = "howto-bar";
    var txt = document.createElement("span");
    txt.textContent = "💡 " + toy.howto;
    var x = document.createElement("button");
    x.className = "howto-close";
    x.setAttribute("aria-label", "关闭提示");
    x.textContent = "✕";
    x.addEventListener("click", function (ev) {
      ev.stopPropagation();
      bar.remove();
      markHowtoSeen(tid);
    });
    bar.appendChild(txt);
    bar.appendChild(x);
    // 插到标题 h2 之后（v1.33：桩里可能没有 insertBefore，做兼容）
    var h2 = panel.querySelector("h2");
    try {
      if (h2 && h2.nextSibling && typeof h2.parentNode.insertBefore === "function") {
        h2.parentNode.insertBefore(bar, h2.nextSibling);
      } else if (h2 && typeof h2.parentNode.appendChild === "function") {
        h2.parentNode.appendChild(bar);
      } else if (typeof panel.insertBefore === "function") {
        panel.insertBefore(bar, panel.firstChild);
      } else if (typeof panel.appendChild === "function") {
        panel.appendChild(bar);
      }
    } catch (e) { /* 桩环境忽略 */ }
    ensureHowtoHelpBtn(panel, tid);
  }
  function ensureHowtoHelpBtn(panel, tid) {
    // 每个玩具标题旁加"？"按钮（只加一次）
    var h2 = panel.querySelector("h2");
    if (!h2 || h2.querySelector(".howto-help")) return;
    var b = document.createElement("button");
    b.className = "howto-help";
    b.setAttribute("aria-label", "怎么玩");
    b.textContent = "？";
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      showHowtoBar(tid, true);
    });
    h2.appendChild(b);
  }
  /* v1.27：回主页——藏起所有玩具，露出置顶 + 全部游戏 */
  function showHome(toTop) {
    const fromToy = !!currentToy; // v3.0 第7轮：是否从玩具返回（决定滚动行为）
    if (currentToy) leaveToy(currentToy);
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-home").classList.remove("hidden");
    renderRecent();
    allTiles().forEach((b) => b.classList.remove("active"));
    allHomeTiles().forEach((b) => b.classList.remove("active"));
    currentToy = null;
    try {
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", window.location.pathname);
      else window.location.hash = "";
    } catch (e) { /* 桩里没有 history，忽略 */ }
    // v3.0 第7轮：从玩具返回→恢复滚动位置；搜索等场景传 toTop→回顶部；在主页不动
    try {
      if (toTop) window.scrollTo({ top: 0, behavior: "smooth" });
      else if (fromToy) window.scrollTo({ top: homeScrollY, behavior: "auto" });
    } catch (e) {}
  }
  function openDrawer() {
    $("sideDrawer").classList.add("open");
    $("drawerOverlay").classList.remove("hidden");
    // v3.0 第7轮：打开抽屉时清空抽屉搜索，恢复主过滤状态
    if ($("drawerSearch")) $("drawerSearch").value = "";
    refreshDrawerFilter();
  }
  function closeDrawer() {
    $("sideDrawer").classList.remove("open");
    $("drawerOverlay").classList.add("hidden");
    // v3.0 第7轮：关闭时清空抽屉搜索，下次打开是干净状态
    if ($("drawerSearch")) $("drawerSearch").value = "";
    refreshDrawerFilter();
  }
  $("menuBtn").addEventListener("click", openDrawer);
  $("homeBtn").addEventListener("click", () => {
    // v3.0 第7轮：在玩具里点主页→恢复滚动位置；在主页点→回顶部
    if (currentToy) showHome();
    else { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} }
  });
  $("drawerCloseBtn").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);
  // v1.32：音效开关
  const sfxBtn = $("sfxBtn");
  if (sfxBtn) {
    sfxBtn.textContent = SFX.enabled ? "🔊" : "🔇";
    sfxBtn.addEventListener("click", () => {
      SFX.unlock();
      const on = SFX.toggle();
      sfxBtn.textContent = on ? "🔊" : "🔇";
      if (on) SFX.click();
    });
  }
  window.addEventListener("hashchange", () => {
    const id = window.location.hash.slice(1);
    if (id === "" || id === "home") { if (currentToy) showHome(); return; }
    if (TOYS.some((t) => t.id === id) && id !== currentToy) showToy(id);
  });

  /* ---------- 1. 命运大转盘 ---------- */
  toyInitFns["wheel"] = function () {
    const WHEEL_COLORS = ["#f5c542", "#7b5cff", "#ff9d00", "#3ec6a7", "#ff7a6b", "#7ab8ff", "#e58cff", "#8bc34a"];
    let wheelOptions = DEFAULT_WHEEL_OPTIONS.slice();
    let wheelAngle = 0;
    let wheelSpinning = false;

    const canvas = $("wheelCanvas");
    const ctx = canvas.getContext("2d");

    function readWheelOptions() {
      const lines = $("wheelOptions").value.split("\n").map((s) => s.trim()).filter(Boolean);
      return lines.slice(0, 8);
    }
    function drawWheel(angle) {
      const cx = 160, cy = 160, r = 150;
      ctx.clearRect(0, 0, 320, 320);
      const n = wheelOptions.length;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const base = WHEEL_COLORS[i % WHEEL_COLORS.length];
        // 径向渐变：中心亮、边缘深，更有质感（不支持的环境回退纯色）
        let fill = base;
        try {
          if (ctx.createRadialGradient) {
            const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, r);
            if (grad && grad.addColorStop) {
              grad.addColorStop(0, "#ffffff");
              grad.addColorStop(0.25, base);
              grad.addColorStop(1, base);
              fill = grad;
            }
          }
        } catch (e) { /* 回退纯色 */ }
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, a0, a1);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        // 扇区分隔线
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.stroke();
        // 文字（r18：超过 8 字截断加…，不然长选项会穿过圆心糊到对面扇区；结果/历史仍用全名）
        ctx.save();
        ctx.rotate((a0 + a1) / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#241300";
        ctx.font = "bold 17px sans-serif";
        const wheelLabel = wheelOptions[i].length > 8 ? wheelOptions[i].slice(0, 8) + "…" : wheelOptions[i];
        ctx.fillText(wheelLabel, r - 14, 6);
        ctx.restore();
      }
      ctx.restore();
      // 外圈光晕
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#f5c542";
      ctx.shadowColor = "rgba(245,197,66,0.8)";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
      // 中心圆
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fillStyle = "#1c1438";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#f5c542";
      ctx.stroke();
      ctx.fillStyle = "#ffd97a";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("转", cx, cy + 5);
    }
    function updateWheelFromInput() {
      const opts = readWheelOptions();
      if (opts.length < 2) {
        $("wheelResult").textContent = "至少写 2 个选项，转盘才转得起来。";
        return false;
      }
      wheelOptions = opts;
      drawWheel(wheelAngle);
      return true;
    }
    $("wheelOptions").value = DEFAULT_WHEEL_OPTIONS.join("\n");
    $("wheelOptions").addEventListener("change", updateWheelFromInput);
    $("updateWheelBtn").addEventListener("click", () => {
      if (updateWheelFromInput()) $("wheelResult").textContent = "转盘已更新，共 " + wheelOptions.length + " 个选项。";
    });
    $("resetWheelBtn").addEventListener("click", () => {
      $("wheelOptions").value = DEFAULT_WHEEL_OPTIONS.join("\n");
      wheelOptions = DEFAULT_WHEEL_OPTIONS.slice();
      drawWheel(wheelAngle);
      $("wheelResult").textContent = "已恢复默认选项。";
    });
    const WHEEL_HIST_KEY = "dorm-toybox-wheel-history-v1";
    function loadWheelHist() {
      try {
        const a = JSON.parse(lsGet(WHEEL_HIST_KEY, "[]"));
        return Array.isArray(a) ? a : [];
      } catch (e) { return []; }
    }
    function renderWheelHist() {
      const box = $("wheelHistory");
      if (!box) return;
      box.innerHTML = "";
      loadWheelHist().forEach((h) => {
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.textContent = "🎉 " + h.text;
        const d = document.createElement("span");
        d.textContent = h.date;
        li.appendChild(a);
        li.appendChild(d);
        box.appendChild(li);
      });
    }
    function pushWheelHist(text) {
      const h = loadWheelHist();
      h.unshift({ text: text, date: todayStr() });
      try { lsSet(WHEEL_HIST_KEY, JSON.stringify(h.slice(0, 8))); } catch (e) { /* 忽略 */ }
      renderWheelHist();
    }
    // 中奖撒花
    function wheelConfetti() {
      const box = $("wheelConfettiBox");
      if (!box) return;
      const bits = ["🎉", "✨", "⭐", "🎊", "💫"];
      for (let i = 0; i < 14; i++) {
        const b = document.createElement("span");
        b.className = "confetti-bit";
        b.textContent = bits[i % bits.length];
        b.style.left = (10 + Math.random() * 80) + "%";
        b.style.animationDelay = (Math.random() * 0.4) + "s";
        box.appendChild(b);
        setTimeout(() => {
          try {
            if (box.removeChild) box.removeChild(b);
            else if (b.parentNode && b.parentNode.removeChild) b.parentNode.removeChild(b);
          } catch (e) { /* 测试桩无 removeChild，忽略 */ }
        }, 1800);
      }
    }
    drawWheel(0);
    renderWheelHist();

    $("spinWheelBtn").addEventListener("click", () => {
      if (wheelSpinning) return;
      if (!updateWheelFromInput()) return;
      wheelSpinning = true;
      $("spinWheelBtn").disabled = true;
      $("wheelResult").textContent = "转着呢……";
      const n = wheelOptions.length;
      const targetIndex = Math.floor(Math.random() * n);
      // 指针在顶部（-90°）。让目标扇区中点转到指针处，再多转 5 圈。
      const seg = (Math.PI * 2) / n;
      const targetMid = targetIndex * seg + seg / 2;
      const pointerAngle = -Math.PI / 2;
      let delta = pointerAngle - (wheelAngle + targetMid);
      while (delta <= 0) delta += Math.PI * 2;
      const totalRotation = Math.PI * 2 * 5 + delta;
      const startAngle = wheelAngle;
      const startTime = performance.now();
      const duration = 3200;
      function frame(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        wheelAngle = startAngle + totalRotation * eased;
        drawWheel(wheelAngle);
        if (t < 1) { requestAnimationFrame(frame); }
        else {
          wheelSpinning = false;
          $("spinWheelBtn").disabled = false;
          $("wheelResult").textContent = "🎉 命运已定：" + wheelOptions[targetIndex] + "！";
          wheelConfetti();
          pushWheelHist(wheelOptions[targetIndex]);
          if (typeof SFX !== "undefined") SFX.win();
        }
      }
      requestAnimationFrame(frame);
    });

  };
  /* ---------- 2. 真心话大冒险 ---------- */
  toyInitFns["cards"] = function () {
    let usedTruths = [], usedDares = [];
    // ---- 新增：自定义题库（localStorage） ----
    const CARDS_CUSTOM_KEY = "dorm-toybox-cards-custom-v1";
    let customTruths = [], customDares = [];
    try {
      const saved = JSON.parse(localStorage.getItem(CARDS_CUSTOM_KEY) || "null");
      if (saved) {
        if (Array.isArray(saved.truths)) customTruths = saved.truths;
        if (Array.isArray(saved.dares)) customDares = saved.dares;
      }
    } catch (e) {}
    function saveCustomCards() {
      try { localStorage.setItem(CARDS_CUSTOM_KEY, JSON.stringify({ truths: customTruths, dares: customDares })); } catch (e) {}
    }
    function getTruthPool() { return TRUTHS.concat(customTruths); }
    function getDarePool() { return DARES.concat(customDares); }
    function drawCard(kind) {
      let pool, used, label;
      if (kind === "truth") { pool = getTruthPool(); used = usedTruths; label = "💬 真心话"; }
      else { pool = getDarePool(); used = usedDares; label = "🔥 大冒险"; }
      if (used.length >= pool.length) used.length = 0;
      let idx;
      do { idx = Math.floor(Math.random() * pool.length); } while (used.includes(idx));
      used.push(idx);
      const card = $("playCard");
      // 翻转动画
      card.classList.remove("card-flip");
      void card.offsetWidth; // 触发重绘
      card.classList.add("card-flip");
      card.classList.remove("truth", "dare");
      card.classList.add(kind === "truth" ? "truth" : "dare");
      $("cardType").textContent = label + " · 第 " + used.length + " 张";
      $("cardText").textContent = pool[idx];
      renderCardCount();
    }
    function renderCardCount() {
      // 保持 "/ 40" 格式兼容冒烟测试
      $("cardCount").textContent =
        "真心话已抽 " + usedTruths.length + " / 40" + (customTruths.length ? " + " + customTruths.length + " 自定义" : "") +
        " · 大冒险已抽 " + usedDares.length + " / 40" + (customDares.length ? " + " + customDares.length + " 自定义" : "") +
        "（抽完自动洗牌）";
    }
    // ---- 新增：转瓶子选人 ----
    const cardsSec = $("toy-cards");
    if (cardsSec) {
      const bottleDiv = document.createElement("div");
      bottleDiv.className = "bottle-spin";
      const bottleBtn = document.createElement("button");
      bottleBtn.className = "btn gold-btn"; bottleBtn.textContent = "🍾 转瓶子选人";
      const bottleEmoji = document.createElement("div");
      bottleEmoji.className = "bottle-emoji"; bottleEmoji.textContent = "🍾";
      const bottleResult = document.createElement("p");
      bottleResult.className = "result-line"; bottleResult.textContent = "转一下，瓶口指到谁谁受罚！";
      const nameInput = document.createElement("input");
      nameInput.placeholder = "玩家名字，用空格隔开（默认：你 左边 右边 对面）";
      nameInput.setAttribute("aria-label", "玩家名字");
      nameInput.style.width = "100%"; nameInput.style.margin = "6px 0";
      bottleDiv.appendChild(nameInput);
      bottleDiv.appendChild(bottleEmoji);
      bottleDiv.appendChild(bottleBtn);
      bottleDiv.appendChild(bottleResult);
      // 插到 playCard 前面
      const pc = $("playCard");
      if (pc && pc.parentNode) {
        // stub 兼容：append 到 section
        cardsSec.appendChild(bottleDiv);
      } else {
        cardsSec.appendChild(bottleDiv);
      }
      bottleBtn.addEventListener("click", () => {
        const names = nameInput.value.trim().split(/\s+/).filter(Boolean);
        const players = names.length >= 2 ? names : ["你", "左边", "右边", "对面"];
        const picked = players[Math.floor(Math.random() * players.length)];
        const deg = 360 * 5 + Math.floor(Math.random() * 360);
        bottleEmoji.style.transform = "rotate(" + deg + "deg)";
        bottleEmoji.classList.remove("spinning");
        void bottleEmoji.offsetWidth;
        bottleEmoji.classList.add("spinning");
        setTimeout(() => {
          bottleResult.textContent = "🎯 瓶口指向：" + picked + "！由 TA 抽卡受罚。";
        }, 1200);
      });
      // ---- 新增：自定义题目输入 ----
      const customDiv = document.createElement("div");
      customDiv.className = "cards-custom";
      const customInput = document.createElement("input");
      customInput.placeholder = "写一道自定义题目…";
      customInput.setAttribute("aria-label", "自定义题目");
      customInput.style.width = "100%"; customInput.style.margin = "6px 0";
      const customRow = document.createElement("div");
      customRow.className = "btn-row";
      const addTruthBtn = document.createElement("button");
      addTruthBtn.className = "btn small"; addTruthBtn.textContent = "➕ 加为真心话";
      const addDareBtn = document.createElement("button");
      addDareBtn.className = "btn small"; addDareBtn.textContent = "➕ 加为大冒险";
      customRow.appendChild(addTruthBtn); customRow.appendChild(addDareBtn);
      customDiv.appendChild(customInput); customDiv.appendChild(customRow);
      cardsSec.appendChild(customDiv);
      addTruthBtn.addEventListener("click", () => {
        const t = customInput.value.trim();
        if (t) { customTruths.push(t); saveCustomCards(); customInput.value = ""; renderCardCount(); }
      });
      addDareBtn.addEventListener("click", () => {
        const t = customInput.value.trim();
        if (t) { customDares.push(t); saveCustomCards(); customInput.value = ""; renderCardCount(); }
      });
      // ---- 新增：跳过/重抽按钮 ----
      const skipBtn = document.createElement("button");
      skipBtn.className = "btn ghost-btn small"; skipBtn.textContent = "⏭ 跳过重抽";
      skipBtn.style.marginTop = "8px";
      cardsSec.appendChild(skipBtn);
      let lastKind = "truth";
      const origDraw = drawCard;
      skipBtn.addEventListener("click", () => {
        // 重抽一张同类型的（不计入已抽，避免浪费）
        if (usedTruths.length > 0 && lastKind === "truth") usedTruths.pop();
        if (usedDares.length > 0 && lastKind === "dare") usedDares.pop();
        origDraw(lastKind);
      });
      // 记录上次类型
      ["truthBtn", "dareBtn", "eitherBtn"].forEach((id) => {
        const b = $(id);
        if (b) b.addEventListener("click", () => {
          if (id === "truthBtn") lastKind = "truth";
          else if (id === "dareBtn") lastKind = "dare";
        });
      });
    }
    $("truthBtn").addEventListener("click", () => drawCard("truth"));
    $("dareBtn").addEventListener("click", () => drawCard("dare"));
    $("eitherBtn").addEventListener("click", () => drawCard(Math.random() < 0.5 ? "truth" : "dare"));
    renderCardCount();

  };
  /* ---------- 3. 骰子硬币 ---------- */
  toyInitFns["dice"] = function () {
    // ---- 原有：快速扔骰子 / 抛硬币（冒烟测试依赖，保留 setInterval 逻辑） ----
    // v2.0：真实物理骰子（Canvas 透视投影 + 弹跳物理）
    const DICE_PIPS = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    };
    let diceCanvas = null, diceCtx = null, diceAnim = null;
    function initDiceCanvas() {
      const stage = $("diceStage");
      if (!stage) return false;
      stage.innerHTML = "";
      diceCanvas = document.createElement("canvas");
      diceCanvas.width = 320; diceCanvas.height = 160;
      diceCanvas.className = "dice-canvas";
      stage.appendChild(diceCanvas);
      diceCtx = diceCanvas.getContext("2d");
      return true;
    }
    // 3D 点投影（透视）
    function proj(p, cx, cy, dist) {
      const s = dist / (dist + p.z);
      return { x: cx + p.x * s, y: cy + p.y * s, s: s };
    }
    function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }; }
    function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }; }
    function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }; }
    // 画一颗骰子（3D 立方体，size 为半边长）
    function drawDie(ctx, cx, cy, size, rx, ry, rz, value) {
      const v = [
        { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 }, { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
        { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 },
      ].map(p => rotZ(rotY(rotX({ x: p.x * size, y: p.y * size, z: p.z * size }, rx), ry), rz));
      // 6 个面：[顶点索引, 点数值, 法线]
      const faces = [
        { idx: [4, 5, 6, 7], val: 1, n: { x: 0, y: 0, z: 1 } },  // 前
        { idx: [1, 0, 3, 2], val: 6, n: { x: 0, y: 0, z: -1 } }, // 后
        { idx: [5, 1, 2, 6], val: 3, n: { x: 1, y: 0, z: 0 } },  // 右
        { idx: [0, 4, 7, 3], val: 4, n: { x: -1, y: 0, z: 0 } }, // 左
        { idx: [3, 7, 6, 2], val: 2, n: { x: 0, y: 1, z: 0 } },  // 上
        { idx: [0, 1, 5, 4], val: 5, n: { x: 0, y: -1, z: 0 } }, // 下
      ];
      // 标准骰子：对面之和为 7（1-6, 2-5, 3-4）
      const faceVals = { "0,0,1": value, "0,0,-1": 7 - value };
      // 计算每个面的平均 z（深度排序）
      faces.forEach(f => {
        f.z = f.idx.reduce((s, i) => s + v[i].z, 0) / 4;
        // 旋转法线判断是否可见（z > 0 面向相机）
        const n = rotZ(rotY(rotX(f.n, rx), ry), rz);
        f.visible = n.z > 0.1;
      });
      faces.sort((a, b) => a.z - b.z); // 远的先画
      const dist = 400;
      faces.forEach(f => {
        if (!f.visible) return;
        const pts = f.idx.map(i => proj(v[i], cx, cy, dist));
        // 面颜色：根据光照（法线 z）调亮度
        const n = rotZ(rotY(rotX(f.n, rx), ry), rz);
        const light = 0.75 + 0.25 * Math.max(0, n.z);
        const r = Math.floor(245 * light), g = Math.floor(245 * light), b = Math.floor(240 * light);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // 画点数（只在朝上的面画真实点数，其他面画对应值）
        let fv = f.val;
        // 根据当前旋转，确定哪个面朝上，这里简化：用 value 做正面
        if (f.n.z === 1) fv = value; // 前面显示投出的点数
        const pips = DICE_PIPS[fv] || DICE_PIPS[1];
        // 计算面的中心和基向量（用于点位）
        const c = { x: (pts[0].x + pts[2].x) / 2, y: (pts[0].y + pts[2].y) / 2 };
        const ux = { x: (pts[1].x - pts[0].x) / 2, y: (pts[1].y - pts[0].y) / 2 };
        const uy = { x: (pts[3].x - pts[0].x) / 2, y: (pts[3].y - pts[0].y) / 2 };
        const pipR = size * 0.12 * pts[0].s;
        pips.forEach(([px, py]) => {
          const pipX = c.x + (ux.x * px * 0.55 + uy.x * py * 0.55);
          const pipY = c.y + (ux.y * px * 0.55 + uy.y * py * 0.55);
          ctx.beginPath();
          ctx.arc(pipX, pipY, pipR, 0, Math.PI * 2);
          ctx.fillStyle = "#1a1d29";
          ctx.fill();
        });
      });
      // 阴影
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 1.3, size * 0.9, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fill();
    }
    function rollDice(count) {
      // 测试环境（无真实 canvas）用简化版
      try {
        const testCanvas = document.createElement("canvas");
        const testCtx = testCanvas.getContext("2d");
        const grad = testCtx.createLinearGradient(0, 0, 0, 10);
        if (!grad || typeof grad.addColorStop !== "function") throw new Error("no canvas");
      } catch (e) {
        // 降级：文字版（测试用）
        const values = [];
        for (let i = 0; i < count; i++) values.push(1 + Math.floor(Math.random() * 6));
        const sum = values.reduce((a, b) => a + b, 0);
        const stage = $("diceStage");
        if (stage) stage.textContent = values.map((v) => DICE_FACES[v - 1]).join(" ");
        $("diceResult").textContent = count === 1
          ? "🎲 扔出了 " + values[0] + " 点"
          : "🎲 扔出了 " + values.join(" + ") + " = " + sum + " 点";
        return;
      }
      if (!diceCtx && !initDiceCanvas()) return;
      const values = [];
      for (let i = 0; i < count; i++) values.push(1 + Math.floor(Math.random() * 6));
      // 物理状态：每颗骰子 {x, y, vx, vy, rx, ry, rz, vrx, vry, vrz, value, settled}
      const dice = values.map((v, i) => ({
        x: 60 + i * 100 + Math.random() * 20,
        y: 30,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        vrx: (Math.random() - 0.5) * 0.4,
        vry: (Math.random() - 0.5) * 0.4,
        vrz: (Math.random() - 0.5) * 0.4,
        value: v,
        settled: false,
        bounces: 0,
      }));
      const floorY = 130;
      const size = 28;
      if (diceAnim) cancelAnimationFrame(diceAnim);
      // 木桌背景
      function drawTable() {
        const g = diceCtx.createLinearGradient(0, 0, 0, 160);
        g.addColorStop(0, "#8b5a2b");
        g.addColorStop(1, "#6b4423");
        diceCtx.fillStyle = g;
        diceCtx.fillRect(0, 0, 320, 160);
        // 木纹
        diceCtx.strokeStyle = "rgba(0,0,0,0.1)";
        for (let i = 0; i < 5; i++) {
          diceCtx.beginPath();
          diceCtx.moveTo(0, 30 + i * 28);
          diceCtx.bezierCurveTo(100, 25 + i * 28, 200, 35 + i * 28, 320, 30 + i * 28);
          diceCtx.stroke();
        }
      }
      let frames = 0;
      function animate() {
        drawTable();
        let allSettled = true;
        dice.forEach(d => {
          if (!d.settled) {
            allSettled = false;
            // 物理
            d.vy += 0.5; // 重力
            d.x += d.vx;
            d.y += d.vy;
            d.rx += d.vrx;
            d.ry += d.vry;
            d.rz += d.vrz;
            // 地面弹跳
            if (d.y > floorY) {
              d.y = floorY;
              d.vy *= -0.55; // 弹性
              d.vx *= 0.8; // 摩擦
              d.vrx *= 0.7;
              d.vry *= 0.7;
              d.vrz *= 0.7;
              d.bounces++;
              // 弹跳音效（音量随次数衰减）
              if (typeof SFX !== "undefined" && SFX.hit && d.bounces < 5) {
                // 用 hit 音效模拟骰子落地
              }
              if (Math.abs(d.vy) < 1 && d.bounces > 2) {
                d.settled = true;
                //  settled 时把点数朝上（简化：直接设 rx, ry 让 value 面朝上）
              }
            }
            // 墙壁
            if (d.x < size) { d.x = size; d.vx *= -0.6; }
            if (d.x > 320 - size) { d.x = 320 - size; d.vx *= -0.6; }
          }
          drawDie(diceCtx, d.x, d.y, size, d.rx, d.ry, d.rz, d.value);
        });
        frames++;
        if (!allSettled && frames < 300) {
          diceAnim = requestAnimationFrame(animate);
        } else {
          // 显示结果
          const sum = values.reduce((a, b) => a + b, 0);
          $("diceResult").textContent = count === 1
            ? "🎲 扔出了 " + values[0] + " 点"
            : "🎲 扔出了 " + values.join(" + ") + " = " + sum + " 点";
          if (typeof SFX !== "undefined" && SFX.win) SFX.win();
        }
      }
      animate();
    }
    $("roll1Btn").addEventListener("click", () => rollDice(1));
    $("roll2Btn").addEventListener("click", () => rollDice(2));
    $("roll3Btn").addEventListener("click", () => rollDice(3));
    $("flipCoinBtn").addEventListener("click", () => {
      const stage = $("coinStage");
      stage.classList.add("rolling");
      let ticks = 0;
      const timer = setInterval(() => {
        stage.textContent = Math.random() < 0.5 ? "🪙" : "🥇";
        ticks++;
        if (ticks >= 8) {
          clearInterval(timer);
          stage.classList.remove("rolling");
          const heads = Math.random() < 0.5;
          stage.textContent = heads ? "👑" : "🌸";
          $("coinResult").textContent = heads ? "🪙 正面！先说的人赢了。" : "🪙 反面！后说的人赢了。";
        }
      }, 90);
    });
    // ---- 新增：骰子对决（动态建 UI，直接引用，不依赖 id） ----
    const DUEL_KEY = "dorm-toybox-dice-duel-v1";
    let duelCoins = 100, duelBet = 10, duelScore = { you: 0, cpu: 0 }, duelRolling = false;
    try {
      const sv = JSON.parse(localStorage.getItem(DUEL_KEY) || "null");
      if (sv && typeof sv.coins === "number") duelCoins = sv.coins;
    } catch (e) {}
    const box = $("diceDuelBox");
    if (box) {
      const title = document.createElement("h3");
      title.className = "section-title";
      title.textContent = "🎲 骰子对决 · 你 vs 电脑";
      box.appendChild(title);
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "每人 3 颗骰子比大小，三局两胜。下注欢乐豆，赢了翻倍！";
      box.appendChild(hint);
      const coinsP = document.createElement("p");
      coinsP.className = "count-line";
      box.appendChild(coinsP);
      const board = document.createElement("div");
      board.className = "duel-board";
      const youSide = document.createElement("div");
      youSide.className = "duel-side";
      youSide.innerHTML = '<p class="duel-label">你</p>';
      const youDice = document.createElement("div");
      youDice.className = "dice-3d-row";
      youSide.appendChild(youDice);
      const youSum = document.createElement("p");
      youSum.className = "duel-sum";
      youSum.textContent = "—";
      youSide.appendChild(youSum);
      const vs = document.createElement("div");
      vs.className = "duel-vs";
      vs.textContent = "VS";
      const cpuSide = document.createElement("div");
      cpuSide.className = "duel-side";
      cpuSide.innerHTML = '<p class="duel-label">电脑</p>';
      const cpuDice = document.createElement("div");
      cpuDice.className = "dice-3d-row";
      cpuSide.appendChild(cpuDice);
      const cpuSum = document.createElement("p");
      cpuSum.className = "duel-sum";
      cpuSum.textContent = "—";
      cpuSide.appendChild(cpuSum);
      board.appendChild(youSide); board.appendChild(vs); board.appendChild(cpuSide);
      box.appendChild(board);
      const resultP = document.createElement("p");
      resultP.className = "result-line";
      resultP.textContent = "选下注，开始对决！";
      box.appendChild(resultP);
      const scoreP = document.createElement("p");
      scoreP.className = "count-line";
      box.appendChild(scoreP);
      const betRow = document.createElement("div");
      betRow.className = "btn-row";
      const betBtns = [];
      [10, 30, 50].forEach((amt) => {
        const b = document.createElement("button");
        b.className = "btn gold-btn small";
        b.textContent = "下注 " + amt;
        b.addEventListener("click", () => { duelBet = amt; renderDuel(); });
        betRow.appendChild(b);
        betBtns.push(b);
      });
      box.appendChild(betRow);
      const rollBtn = document.createElement("button");
      rollBtn.className = "big-btn";
      rollBtn.textContent = "🎲 开掷！";
      box.appendChild(rollBtn);
      const resetBtn = document.createElement("button");
      resetBtn.className = "btn ghost-btn small hidden";
      resetBtn.textContent = "再来一场 ↺";
      box.appendChild(resetBtn);
      function saveDuel() { try { localStorage.setItem(DUEL_KEY, JSON.stringify({ coins: duelCoins })); } catch (e) {} }
      function renderDuel() {
        coinsP.textContent = "🪙 欢乐豆：" + duelCoins;
        scoreP.textContent = "局分 " + duelScore.you + " : " + duelScore.cpu + " · 三局两胜";
        rollBtn.disabled = duelRolling || duelCoins < duelBet || duelScore.you >= 2 || duelScore.cpu >= 2;
        betBtns.forEach((b, i) => b.classList.toggle("picked", duelBet === [10, 30, 50][i]));
      }
      function makeDice3D(value) {
        const d = document.createElement("div");
        d.className = "dice-3d rolling";
        // r18：标准骰子对面和为 7（f1↔f2=1/6，f3↔f4=3/4，f5↔f6=2/5）；原来是 1/2/3/4/5/6 顺序贴，对面和是 3/7/11
        const faces = ["⚀", "⚅", "⚂", "⚃", "⚁", "⚄"];
        for (let i = 0; i < 6; i++) {
          const f = document.createElement("div");
          f.className = "dice-face f" + (i + 1);
          f.textContent = faces[i];
          d.appendChild(f);
        }
        // r18：朝向按“该点数所在的面”重排（1 前、2 下、3 右、4 左、5 上、6 后）
        const orientations = ["rotateX(0) rotateY(0)", "rotateX(-90deg) rotateY(0)", "rotateX(0) rotateY(-90deg)", "rotateX(0) rotateY(90deg)", "rotateX(90deg) rotateY(0)", "rotateX(0) rotateY(180deg)"];
        setTimeout(() => { d.classList.remove("rolling"); d.style.transform = orientations[value - 1]; }, 1000);
        return d;
      }
      rollBtn.addEventListener("click", () => {
        if (duelRolling || duelCoins < duelBet || duelScore.you >= 2 || duelScore.cpu >= 2) return;
        duelRolling = true;
        duelCoins -= duelBet;
        renderDuel();
        resultP.textContent = "骰子翻滚中……";
        const youVals = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        const cpuVals = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        youDice.innerHTML = ""; cpuDice.innerHTML = "";
        youSum.textContent = "…"; cpuSum.textContent = "…";
        youVals.forEach((v) => youDice.appendChild(makeDice3D(v)));
        cpuVals.forEach((v) => cpuDice.appendChild(makeDice3D(v)));
        setTimeout(() => {
          const ys = youVals.reduce((a, b) => a + b, 0), cs = cpuVals.reduce((a, b) => a + b, 0);
          youSum.textContent = ys + " 点"; cpuSum.textContent = cs + " 点";
          let msg;
          if (ys > cs) { duelScore.you++; duelCoins += duelBet * 2; msg = "🎉 你赢了这一局！+" + duelBet + " 欢乐豆"; }
          else if (ys < cs) { duelScore.cpu++; msg = "😤 电脑赢了这一局，-" + duelBet + " 欢乐豆"; }
          else { duelCoins += duelBet; msg = "🤝 平局，下注返还"; }
          if (duelScore.you >= 2) { msg = "🏆 三局两胜，你拿下整场！"; resetBtn.classList.remove("hidden"); }
          else if (duelScore.cpu >= 2) { msg = "💻 电脑三局两胜，再来雪耻？"; resetBtn.classList.remove("hidden"); }
          if (duelCoins <= 0) { duelCoins = 100; msg += "（豆输光了，送你 100 东山再起）"; }
          resultP.textContent = msg;
          duelRolling = false;
          saveDuel(); renderDuel();
        }, 1100);
      });
      resetBtn.addEventListener("click", () => {
        duelScore = { you: 0, cpu: 0 };
        resetBtn.classList.add("hidden");
        resultP.textContent = "选下注，开始对决！";
        youSum.textContent = "—"; cpuSum.textContent = "—";
        youDice.innerHTML = ""; cpuDice.innerHTML = "";
        renderDuel();
      });
      renderDuel();
    }
  };
  /* ---------- 4. 今日运势 ---------- */
  toyInitFns["fortune"] = function () {
    const FORTUNE_KEY = "dorm-toybox-fortune-v1";
    const FORTUNE_DIMS = ["财运", "桃花", "学业", "健康", "运气"];
    function loadFortune() {
      try {
        const saved = JSON.parse(localStorage.getItem(FORTUNE_KEY) || "null");
        return saved && saved.day === todayStr() ? saved : null;
      } catch (e) { return null; }
    }
    // ---- 新增：签筒摇签动画 + 运势雷达图 ----
    const fortuneSec = $("toy-fortune");
    let fortuneTube = null, fortuneCanvas = null;
    if (fortuneSec) {
      fortuneTube = document.createElement("div");
      fortuneTube.className = "fortune-tube";
      fortuneTube.textContent = "🎋";
      fortuneTube.title = "签筒";
      const tierEl = $("fortuneTier");
      if (tierEl && tierEl.parentNode) {
        // stub 兼容：append 到 section
        fortuneSec.appendChild(fortuneTube);
      } else {
        fortuneSec.appendChild(fortuneTube);
      }
      fortuneCanvas = document.createElement("canvas");
      fortuneCanvas.width = 280; fortuneCanvas.height = 280;
      fortuneCanvas.className = "fortune-radar";
      fortuneCanvas.setAttribute("aria-label", "运势雷达图");
      fortuneSec.appendChild(fortuneCanvas);
    }
    function drawFortuneRadar(dims) {
      if (!fortuneCanvas) return;
      const ctx = fortuneCanvas.getContext ? fortuneCanvas.getContext("2d") : null;
      if (!ctx) return;
      const W = 280, H = 280, cx = W/2, cy = H/2, R = 100;
      ctx.clearRect(0, 0, W, H);
      // 背景网格
      ctx.strokeStyle = "#444"; ctx.lineWidth = 1;
      for (let ring = 1; ring <= 5; ring++) {
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = (R * ring) / 5;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
      }
      // 轴线 + 标签
      ctx.fillStyle = "#aaa"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
      FORTUNE_DIMS.forEach((label, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        const lx = cx + Math.cos(a) * (R + 18), ly = cy + Math.sin(a) * (R + 18);
        ctx.fillText(label, lx, ly + 4);
      });
      // 数据多边形
      if (dims) {
        ctx.beginPath();
        dims.forEach((v, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = (R * v) / 100;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = "rgba(79, 124, 255, 0.3)";
        ctx.fill();
        ctx.strokeStyle = "#4f7cff"; ctx.lineWidth = 2; ctx.stroke();
        // 数据点
        ctx.fillStyle = "#4f7cff";
        dims.forEach((v, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const r = (R * v) / 100;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    function renderFortune(saved) {
      if (!saved) {
        $("fortuneTier").textContent = "？";
        $("fortuneText").textContent = "点下面，抽今日一签。";
        $("fortuneNote").textContent = "一天只能抽一次，抽完就认——好签别骄傲，坏签别当真。";
        $("drawFortuneBtn").disabled = false;
        drawFortuneRadar(null);
        return;
      }
      $("fortuneTier").textContent = saved.tier;
      $("fortuneText").textContent = saved.text;
      $("fortuneNote").textContent = "今日已抽（" + saved.day + "）。明天再来，签会变的。";
      $("drawFortuneBtn").disabled = true;
      if (saved.dims) drawFortuneRadar(saved.dims);
    }
    $("drawFortuneBtn").addEventListener("click", () => {
      // 摇签动画（视觉效果，与结果同步进行）
      if (fortuneTube) {
        fortuneTube.classList.remove("shaking");
        void fortuneTube.offsetWidth;
        fortuneTube.classList.add("shaking");
      }
      SFX.pop();
      const f = pick(FORTUNES);
      // 生成五维运势（大吉偏高，凶偏低）
      const base = f.tier === "大吉" ? 75 : f.tier === "中吉" ? 65 : f.tier === "小吉" ? 55 : f.tier === "吉" ? 50 : 35;
      const dims = FORTUNE_DIMS.map(() => Math.max(5, Math.min(100, base + Math.floor(Math.random() * 30) - 15)));
      const saved = { day: todayStr(), tier: f.tier, text: f.text, dims: dims };
      try { localStorage.setItem(FORTUNE_KEY, JSON.stringify(saved)); } catch (e) {}
      renderFortune(saved);
    });
    renderFortune(loadFortune());

  };
  /* ---------- 5. 随机点名 ---------- */
  toyInitFns["picker"] = function () {
    const PICKER_NAMES_KEY = "dorm-toybox-picker-names-v1";
    let picked = [];
    // 名单持久化：上次粘贴的不用重贴
    try {
      const saved = lsGet(PICKER_NAMES_KEY, "");
      if (saved) $("nameList").value = saved;
    } catch (e) { /* 忽略 */ }
    function namePool() {
      // 去重（保序）：重名会让"抽过的不再重复"误判，两个同名算一个人
      const seen = new Set();
      return $("nameList").value.split("\n").map((s) => s.trim()).filter((s) => {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      });
    }
    function renderPickLeft() {
      const pool = namePool();
      const remaining = pool.filter((n) => !picked.includes(n));
      $("pickLeft").textContent = pool.length === 0
        ? "先在上面粘贴名字，每行一个。"
        : "名单共 " + pool.length + " 人 · 已抽 " + picked.length + " 人 · 还剩 " + remaining.length + " 人";
    }
    function renderPickHistory() {
      const box = $("pickHistory");
      box.innerHTML = "";
      if (picked.length === 0) return;
      picked.slice().reverse().forEach((name, i) => {
        const li = document.createElement("li");
        const n = document.createElement("span");
        n.textContent = "🎯 " + name;
        const t = document.createElement("span");
        t.textContent = "第 " + (picked.length - i) + " 个";
        li.appendChild(n);
        li.appendChild(t);
        box.appendChild(li);
      });
    }
    $("pickBtn").addEventListener("click", () => {
      const pool = namePool();
      if (pool.length === 0) {
        $("pickResult").textContent = "名单是空的 😢";
        return;
      }
      if (typeof SFX !== "undefined") SFX.click();
      const noRepeat = $("noRepeatCheck").checked;
      let candidates = noRepeat ? pool.filter((n) => !picked.includes(n)) : pool;
      if (candidates.length === 0) {
        picked = [];
        candidates = pool;
        $("pickResult").textContent = "上一轮抽完了，自动重置，继续抽！";
      }
      let ticks = 0;
      const result = $("pickResult");
      result.classList.remove("pop", "slowing");
      const timer = setInterval(() => {
        result.textContent = pick(pool);
        ticks++;
        if (ticks === 7) result.classList.add("slowing"); // 减速：名字越滚越慢的视觉
        if (ticks >= 10) {
          clearInterval(timer);
          const winner = pick(candidates);
          result.classList.remove("slowing");
          result.textContent = "🎉 " + winner;
          result.classList.add("pop");
          if (typeof SFX !== "undefined") SFX.win();
          picked.push(winner);
          renderPickLeft();
          renderPickHistory();
        }
      }, 70);
    });
    $("resetPickBtn").addEventListener("click", () => {
      picked = [];
      $("pickResult").textContent = "已重置，再抽就是新一轮。";
      renderPickLeft();
      renderPickHistory();
    });
    $("nameList").addEventListener("change", () => {
      try { lsSet(PICKER_NAMES_KEY, $("nameList").value); } catch (e) { /* 忽略 */ }
      renderPickLeft();
    });
    renderPickLeft();

  };

  /* ---------- 6. 时间工具箱（番茄钟 + 秒表 + 正计时）---------- */
  /* v1.31：timer 和 stopwatch 合并为「时间工具箱」，三个 tab。stopwatch 入口经 showToy 重定向到此。 */
  toyInitFns["timer"] = function () {
    /* ----- Tab 切换 ----- */
    const tabBtns = $("timeTabBar").querySelectorAll(".toolbox-tab");
    const panels = { pomodoro: $("timeTabPomodoro"), sw: $("timeTabSw"), countup: $("timeTabCountup") };
    function switchTimeTab(name) {
      tabBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-ttab") === name));
      Object.keys(panels).forEach((k) => panels[k].classList.toggle("hidden", k !== name));
    }
    tabBtns.forEach((b) => b.addEventListener("click", () => switchTimeTab(b.getAttribute("data-ttab"))));
    // 默认 tab：从 stopwatch 入口进来就默认秒表
    const defTab = window._toolboxDefaultTab;
    window._toolboxDefaultTab = null;
    if (defTab && panels[defTab]) switchTimeTab(defTab);

    /* ----- 番茄钟（保留原有逻辑 + 进度环 + 提醒音） ----- */
    let focusSeconds = 25 * 60;
    const TOMATO_KEY = "dorm-toybox-tomatoes-v1";
    let remaining = focusSeconds;
    let timerId = null;
    let pomodoroEndAt = 0; // v3.0-r16：按截止时间算剩余，切后台被节流也不慢（旧写法每 tick --1 秒，后台 1 分钟才 tick 一次就慢 59 秒）
    function pomodoroLeftSec() { return pomodoroEndAt ? Math.max(0, Math.round((pomodoroEndAt - performance.now()) / 1000)) : remaining; }
    let tomatoesToday = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(TOMATO_KEY) || "null");
      if (saved && saved.day === todayStr()) tomatoesToday = saved.count || 0;
    } catch (e) { /* 忽略 */ }

    function fmt(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    }
    // Canvas 进度环
    function drawTimerRing() {
      const cv = $("timerRing");
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const cx = 110, cy = 110, r = 95;
      ctx.clearRect(0, 0, 220, 220);
      // 底环
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 12;
      ctx.stroke();
      // 进度环（番茄红）
      const progress = focusSeconds > 0 ? (focusSeconds - remaining) / focusSeconds : 0;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = "#e5484d";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    // WebAudio 提醒音（三声）
    function playAlert() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ac = new AC();
        [0, 0.3, 0.6].forEach((delay, i) => {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.connect(gain);
          gain.connect(ac.destination);
          osc.frequency.value = 880 + i * 220;
          osc.type = "sine";
          gain.gain.setValueAtTime(0.3, ac.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + delay + 0.25);
          osc.start(ac.currentTime + delay);
          osc.stop(ac.currentTime + delay + 0.3);
        });
      } catch (e) { /* 忽略 */ }
    }
    function renderTimer() {
      const disp = $("timerDisplay");
      disp.textContent = fmt(remaining);
      disp.classList.toggle("done", remaining === 0);
      $("tomatoCount").textContent = "今天已完成 " + tomatoesToday + " 个番茄";
      drawTimerRing();
    }
    function saveTomatoes() {
      localStorage.setItem(TOMATO_KEY, JSON.stringify({ day: todayStr(), count: tomatoesToday }));
    }
    // 时长可改：15 / 25 / 45 / 60 分钟，改了就重置
    [15, 25, 45, 60].forEach((m) => {
      const b = document.createElement("button");
      b.className = "btn small " + (m === 25 ? "gold-btn" : "ghost-btn");
      b.textContent = m + " 分钟";
      b.setAttribute("data-minutes", String(m));
      b.addEventListener("click", () => {
        if (timerId) { clearInterval(timerId); timerId = null; }
        pomodoroEndAt = 0;
        focusSeconds = m * 60;
        remaining = focusSeconds;
        $("timerStartBtn").textContent = "开始专注 ▶";
        $("timerStatus").textContent = "已改成 " + m + " 分钟。先想好这段时间要干什么。";
        $("timerDurations").querySelectorAll("button").forEach((x) => {
          x.className = "btn small " + (x === b ? "gold-btn" : "ghost-btn");
        });
        renderTimer();
      });
      $("timerDurations").appendChild(b);
    });
    $("timerStartBtn").addEventListener("click", () => {
      if (timerId) {
        remaining = pomodoroLeftSec();
        pomodoroEndAt = 0;
        clearInterval(timerId);
        timerId = null;
        $("timerStartBtn").textContent = "继续专注 ▶";
        $("timerStatus").textContent = "暂停中。歇一会没关系，回来继续。";
        renderTimer();
        return;
      }
      if (remaining === 0) remaining = focusSeconds;
      pomodoroEndAt = performance.now() + remaining * 1000;
      $("timerStartBtn").textContent = "暂停 ⏸";
      $("timerStatus").textContent = "专注中……手机翻过去，这段时间只干一件事。";
      timerId = setInterval(() => {
        remaining = pomodoroLeftSec();
        renderTimer();
        if (remaining <= 0) {
          pomodoroEndAt = 0;
          clearInterval(timerId);
          timerId = null;
          tomatoesToday++;
          saveTomatoes();
          renderTimer();
          playAlert();
          $("timerStartBtn").textContent = "再来一个 🍅";
          $("timerStatus").textContent = "🎉 到点了！起来走走、喝口水，完成了第 " + tomatoesToday + " 个番茄。";
        }
      }, 1000);
    });
    $("timerResetBtn").addEventListener("click", () => {
      if (timerId) { clearInterval(timerId); timerId = null; }
      pomodoroEndAt = 0;
      remaining = focusSeconds;
      $("timerStartBtn").textContent = "开始专注 ▶";
      $("timerStatus").textContent = "已重置。先想好这段时间要干什么。";
      renderTimer();
    });
    renderTimer();

    /* ----- 秒表（从原 stopwatch 合并过来） ----- */
    let swRunning = false, swElapsed = 0, swStartAt = 0, swTimerId = null, swLaps = [];
    function swFormat(ms) {
      const totalCs = Math.floor(ms / 10);
      const cs = totalCs % 100;
      const s = Math.floor(totalCs / 100) % 60;
      const m = Math.floor(totalCs / 6000);
      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(cs).padStart(2, "0");
    }
    function swCurrent() { return swRunning ? swElapsed + (performance.now() - swStartAt) : swElapsed; }
    function swRender() { $("swTime").textContent = swFormat(swCurrent()); }
    $("swStartBtn").addEventListener("click", () => {
      if (swRunning) {
        swElapsed = swCurrent();
        swRunning = false;
        if (swTimerId) { clearInterval(swTimerId); swTimerId = null; }
        $("swStartBtn").textContent = "继续 ▶";
      } else {
        swStartAt = performance.now();
        swRunning = true;
        swTimerId = setInterval(swRender, 100);
        $("swStartBtn").textContent = "暂停 ⏸";
      }
      swRender();
    });
    $("swLapBtn").addEventListener("click", () => {
      swLaps.push(swCurrent());
      const li = document.createElement("li");
      li.textContent = "第 " + swLaps.length + " 次 · " + swFormat(swCurrent());
      $("swLaps").appendChild(li);
    });
    $("swResetBtn").addEventListener("click", () => {
      if (swTimerId) { clearInterval(swTimerId); swTimerId = null; }
      swRunning = false; swElapsed = 0; swLaps = [];
      $("swLaps").innerHTML = "";
      $("swStartBtn").textContent = "开始 ▶";
      swRender();
    });
    swRender();
    // 退出就停：秒表只刷显示，回来再续上（用时按时间戳算，不会丢）
    const swCleanup = () => { if (swTimerId) { clearInterval(swTimerId); swTimerId = null; } };
    const swResume = () => { if (swRunning && !swTimerId) swTimerId = setInterval(swRender, 100); };
    toyLeaveCleanup.timer = swCleanup;
    toyEnterResume.timer = swResume;
    // stopwatch 入口重定向到 timer，共用同一套收尾
    toyLeaveCleanup.stopwatch = swCleanup;
    toyEnterResume.stopwatch = swResume;

    /* ----- 正计时（新增） ----- */
    let cuRunning = false, cuElapsed = 0, cuStartAt = 0, cuTimerId = null;
    function cuFmt(ms) {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    }
    function cuCurrent() { return cuRunning ? cuElapsed + (performance.now() - cuStartAt) : cuElapsed; }
    function cuRender() {
      $("cuTime").textContent = cuFmt(cuCurrent());
      // 进度环（每 60 分钟一圈）
      const cv = $("cuRing");
      if (cv) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          const cx = 110, cy = 110, r = 95;
          ctx.clearRect(0, 0, 220, 220);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.lineWidth = 12;
          ctx.stroke();
          const progress = (cuCurrent() % 3600000) / 3600000;
          ctx.beginPath();
          ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = "#3ec6a7";
          ctx.lineWidth = 12;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }
    }
    $("cuStartBtn").addEventListener("click", () => {
      if (cuRunning) {
        cuElapsed = cuCurrent();
        cuRunning = false;
        if (cuTimerId) { clearInterval(cuTimerId); cuTimerId = null; }
        $("cuStartBtn").textContent = "继续 ▶";
        $("cuStatus").textContent = "已暂停。";
      } else {
        cuStartAt = performance.now();
        cuRunning = true;
        cuTimerId = setInterval(cuRender, 500);
        $("cuStartBtn").textContent = "暂停 ⏸";
        $("cuStatus").textContent = "计时中……";
      }
      cuRender();
    });
    $("cuResetBtn").addEventListener("click", () => {
      if (cuTimerId) { clearInterval(cuTimerId); cuTimerId = null; }
      cuRunning = false; cuElapsed = 0;
      $("cuStartBtn").textContent = "开始 ▶";
      $("cuStatus").textContent = "已清零。点开始，从 0 往上计时。";
      cuRender();
    });
    cuRender();
  };
  /* ---------- 7. 随机分组 ---------- */
  toyInitFns["groups"] = function () {
    const GROUPS_NAMES_KEY = "dorm-toybox-groups-names-v1";
    // 名单持久化
    try {
      const saved = lsGet(GROUPS_NAMES_KEY, "");
      if (saved) $("groupNames").value = saved;
    } catch (e) { /* 忽略 */ }
    function groupNamePool() {
      const seen = new Set();
      return $("groupNames").value.split("\n").map((s) => s.trim()).filter((s) => {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      });
    }
    let lastGroups = [];
    // R18：手机点选移动——HTML5 拖拽在触屏上不触发，手机用户之前没法微调分组。
    // 点名字选中（金框），再点另一组卡片就移过去；电脑拖拽保留。选中状态存在 groupSelected 里。
    let groupSelected = null; // {gi, mi, name} 或 null
    function groupMoveSelected(toGi) {
      if (!groupSelected) return false;
      const from = groupSelected;
      if (from.gi === toGi) { groupSelected = null; renderGroups(lastGroups, false); return true; }
      const moved = lastGroups[from.gi] && lastGroups[from.gi].splice(from.mi, 1)[0];
      if (moved === undefined) { groupSelected = null; return false; }
      lastGroups[toGi].push(moved);
      groupSelected = null;
      renderGroups(lastGroups, false);
      if (typeof SFX !== "undefined") SFX.click();
      return true;
    }
    // 渲染分组（抽签 + 拖拽后都走这里，保证队长=每组第一个）
    function renderGroups(groups, animate) {
      lastGroups = groups;
      const grid = $("groupGrid");
      grid.innerHTML = "";
      groups.forEach((members, gi) => {
        const card = document.createElement("div");
        card.className = "group-card" + (animate ? " deal" : "");
        if (animate) card.style.animationDelay = (gi * 0.09) + "s";
        // R18：点组卡片 = 把选中的成员移进这组
        card.addEventListener("click", () => { if (groupSelected) groupMoveSelected(gi); });
        const title = document.createElement("h3");
        title.textContent = "第 " + (gi + 1) + " 组 · " + members.length + " 人";
        const ul = document.createElement("ul");
        ul.setAttribute("data-group", String(gi));
        members.forEach((m, mi) => {
          const li = document.createElement("li");
          li.draggable = true;
          li.setAttribute("data-gi", String(gi));
          li.setAttribute("data-mi", String(mi));
          if (groupSelected && groupSelected.gi === gi && groupSelected.mi === mi) li.classList.add("picked");
          // R18：点名字 = 选中/移动（触屏方案）；点已选中的再点一次取消选中
          li.addEventListener("click", (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (groupSelected && groupSelected.gi === gi && groupSelected.mi === mi) { groupSelected = null; renderGroups(lastGroups, false); return; }
            if (groupSelected) { groupMoveSelected(gi); return; }
            groupSelected = { gi: gi, mi: mi, name: m };
            renderGroups(lastGroups, false);
            $("groupResult").textContent = "已选中「" + m + "」，再点另一组卡片就移过去；再点一次取消。";
          });
          if (mi === 0) {
            const b = document.createElement("b");
            b.className = "captain";
            b.textContent = "👑 " + m + "（队长）";
            li.appendChild(b);
          } else {
            li.textContent = m;
          }
          ul.appendChild(li);
        });
        card.appendChild(title);
        card.appendChild(ul);
        grid.appendChild(card);
      });
      bindGroupDrag();
      $("groupResult").textContent = "🎉 已随机分成 " + groups.length + " 组，每组第一个是队长。点名字选中、再点另一组移动（电脑可拖动）。";
      $("copyGroupsBtn").classList.remove("hidden");
    }
    // 拖拽微调：事件委托，只绑一次
    function bindGroupDrag() {
      const grid = $("groupGrid");
      if (grid._dragBound) return;
      grid._dragBound = true;
      let dragData = null;
      grid.addEventListener("dragstart", (e) => {
        const t = e.target;
        const li = t && t.closest ? t.closest("li") : null;
        if (!li) return;
        dragData = { gi: +li.getAttribute("data-gi"), mi: +li.getAttribute("data-mi") };
        try { if (e.dataTransfer) e.dataTransfer.setData("text/plain", "x"); } catch (err) { /* 忽略 */ }
      });
      grid.addEventListener("dragover", (e) => { e.preventDefault(); });
      grid.addEventListener("drop", (e) => {
        e.preventDefault();
        const t = e.target;
        const ul = t && t.closest ? t.closest("ul[data-group]") : null;
        if (!ul || !dragData) return;
        const toGi = +ul.getAttribute("data-group");
        const moved = lastGroups[dragData.gi].splice(dragData.mi, 1)[0];
        if (moved === undefined) return;
        lastGroups[toGi].push(moved);
        groupSelected = null; // R18：拖完清掉点选，避免旧选中标到错的人
        renderGroups(lastGroups, false);
        if (typeof SFX !== "undefined") SFX.click();
        dragData = null;
      });
    }
    $("doGroupBtn").addEventListener("click", () => {
      const names = groupNamePool();
      const count = parseInt($("groupCount").value, 10);
      if (names.length < count) {
        $("groupResult").textContent = "人太少了，至少要 " + count + " 个人才能分 " + count + " 组。";
        return;
      }
      if (typeof SFX !== "undefined") SFX.click();
      const shuffled = shuffle(names.slice());
      const groups = Array.from({ length: count }, () => []);
      shuffled.forEach((name, i) => groups[i % count].push(name));
      groupSelected = null; // R18：重新分组清掉旧选中
      renderGroups(groups, true);
    });
    $("copyGroupsBtn").addEventListener("click", async () => {
      const text = lastGroups.map((g, i) => "第 " + (i + 1) + " 组（队长 " + g[0] + "）：" + g.join("、")).join("\n");
      try {
        await navigator.clipboard.writeText("👥 随机分组结果\n" + text);
        $("copyGroupsBtn").textContent = "已复制 ✅";
        setTimeout(() => { $("copyGroupsBtn").textContent = "复制分组结果 📋"; }, 2000);
      } catch (e) {
        $("groupResult").textContent = text;
      }
    });
    $("groupNames").addEventListener("change", () => {
      try { lsSet(GROUPS_NAMES_KEY, $("groupNames").value); } catch (e) { /* 忽略 */ }
    });

  };

  /* ---------- 8. 反应速度测试 ---------- */
  toyInitFns["reaction"] = function () {
    const REACTION_BEST_KEY = "dorm-toybox-reaction-best-v1";
    let reactionTimerId = null;
    let reactionStartAt = 0;
    let reactionState = "idle"; // idle | waiting | go
    let reactionScores = [];
    function loadBest() {
      try { return parseInt(localStorage.getItem(REACTION_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    let reactionBest = loadBest();
    function rankLabel(ms) {
      if (ms < 200) return "神仙手速 👑";
      if (ms < 280) return "宿舍最快 ⚡";
      if (ms < 380) return "正常发挥 🙂";
      return "手速待练 🐢";
    }
    function renderReaction() {
      $("reactionBest").textContent = reactionBest > 0
        ? "最好成绩：" + reactionBest + " ms（" + rankLabel(reactionBest) + "）"
        : "还没留下成绩。先测一次。";
      const box = $("reactionHistory");
      box.innerHTML = "";
      reactionScores.slice(-5).reverse().forEach((s) => {
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.textContent = "⚡ " + s + " ms";
        const b = document.createElement("span");
        b.textContent = rankLabel(s);
        li.appendChild(a);
        li.appendChild(b);
        box.appendChild(li);
      });
    }
    const REACTION_BOARD_KEY = "dorm-toybox-reaction-board-v1";
    let roundsMode = false;
    let roundTimes = [];
    function loadBoard() {
      try {
        const a = JSON.parse(lsGet(REACTION_BOARD_KEY, "[]"));
        return Array.isArray(a) ? a : [];
      } catch (e) { return []; }
    }
    function saveBoard(b) {
      try { lsSet(REACTION_BOARD_KEY, JSON.stringify(b.slice(0, 5))); } catch (e) { /* 忽略 */ }
    }
    function roundEval(avg) {
      if (avg < 250) return "🏆 职业选手";
      if (avg < 350) return "🙂 正常发挥";
      return "🐢 树懒本懒";
    }
    function renderBoard() {
      const box = $("reactionBoard");
      if (!box) return;
      box.innerHTML = "";
      loadBoard().forEach((r, i) => {
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.textContent = "🏅 第" + (i + 1) + "名 " + r.avg + " ms";
        const d = document.createElement("span");
        d.textContent = r.date;
        li.appendChild(a);
        li.appendChild(d);
        box.appendChild(li);
      });
    }
    function setReactionStage(text, sub, cls) {
      const stage = $("reactionStage");
      stage.classList.remove("waiting", "go");
      if (cls) stage.classList.add(cls);
      stage.innerHTML = "";
      stage.appendChild(document.createTextNode(text));
      if (sub) {
        const span = document.createElement("span");
        span.className = "sub";
        span.textContent = sub;
        stage.appendChild(span);
      }
    }
    function reactionClick() {
      if (reactionState === "idle") {
        reactionState = "waiting";
        const sub = roundsMode ? ("第 " + (roundTimes.length + 1) + "/5 轮 · 别点！等它变绿") : "别点！等它变绿";
        setReactionStage("等绿色……", sub, "waiting");
        $("reactionResult").textContent = "等着，别急……";
        const delay = 1500 + Math.random() * 2500;
        reactionTimerId = setTimeout(() => {
          reactionState = "go";
          reactionStartAt = performance.now();
          setReactionStage("点！", "", "go");
        }, delay);
      } else if (reactionState === "waiting") {
        clearTimeout(reactionTimerId);
        reactionState = "idle";
        if (roundsMode) {
          setReactionStage("抢跑了！", "第 " + (roundTimes.length + 1) + "/5 轮重来，点我继续", "");
          $("reactionResult").textContent = "❌ 犯规：抢跑。这轮不算，点一下重来。";
        } else {
          setReactionStage("抢跑了！", "变绿之前别点，重新来", "");
          $("reactionResult").textContent = "❌ 犯规：抢跑。再点一次重新开始。";
        }
      } else if (reactionState === "go") {
        const ms = Math.round(performance.now() - reactionStartAt);
        reactionState = "idle";
        reactionScores.push(ms);
        if (reactionBest === 0 || ms < reactionBest) {
          reactionBest = ms;
          saveBest(REACTION_BEST_KEY, ms);
          $("reactionResult").textContent = "🎉 " + ms + " ms，新纪录！" + rankLabel(ms);
        } else {
          $("reactionResult").textContent = "⚡ " + ms + " ms，" + rankLabel(ms) + "（最好 " + reactionBest + " ms）";
        }
        if (roundsMode) {
          roundTimes.push(ms);
          if (typeof SFX !== "undefined") SFX.pop(Math.min(1, ms / 600));
          if (roundTimes.length >= 5) {
            const avg = Math.round(roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length);
            const ev = roundEval(avg);
            const board = loadBoard();
            board.push({ avg: avg, date: todayStr() });
            board.sort((x, y) => x.avg - y.avg);
            saveBoard(board);
            renderBoard();
            roundsMode = false;
            $("reactionResult").textContent = "🏁 5 轮平均 " + avg + " ms，" + ev + "！已记入排行榜。";
            if (typeof SFX !== "undefined") SFX.win();
            setReactionStage("挑战完成！", "点我再来一局", "");
          } else {
            $("reactionResult").textContent = "⚡ 第 " + roundTimes.length + "/5 轮：" + ms + " ms，点我继续。";
            setReactionStage("第 " + (roundTimes.length + 1) + "/5 轮", "点我继续，别抢跑", "");
          }
        } else {
          setReactionStage("点我再测一次", "最好成绩 " + reactionBest + " ms", "");
        }
        renderReaction();
      }
    }
    $("reactionStage").addEventListener("click", reactionClick);
    $("reactionStage").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reactionClick(); }
    });
    const roundsBtn = $("reactionRoundsBtn");
    if (roundsBtn) roundsBtn.addEventListener("click", () => {
      if (reactionState !== "idle" || roundsMode) return;
      roundsMode = true;
      roundTimes = [];
      if (typeof SFX !== "undefined") SFX.click();
      setReactionStage("🏁 5 轮挑战", "第 1/5 轮：点一下开始计时", "");
      $("reactionResult").textContent = "5 轮取平均，测测你的真实手速。抢跑那轮重来。";
    });
    renderReaction();
    renderBoard();

    // 退出就停：等绿的超时清掉，回到初始状态，不然回来时已经是绿的、成绩还乱算
    toyLeaveCleanup.reaction = () => {
      if (reactionTimerId) { clearTimeout(reactionTimerId); reactionTimerId = null; }
      if (reactionState !== "idle") {
        reactionState = "idle";
        setReactionStage("点我开始", "变绿就点，别抢跑", "");
      }
    };

  };
  /* ---------- 9. 石头剪刀布 ---------- */
  toyInitFns["rps"] = function () {
    const RPS_KEY = "dorm-toybox-rps-v1";
    const RPS_HIST_KEY = "dorm-toybox-rps-hist-v1";
    const RPS_HANDS = { rock: "✊ 石头", scissors: "✌️ 剪刀", paper: "✋ 布" };
    const RPS_BEATS = { rock: "scissors", scissors: "paper", paper: "rock" }; // key 打得过 value
    const RPS_COUNTER = { rock: "paper", scissors: "rock", paper: "scissors" }; // 打得过 key 的是 value
    const RPS_TARGET = 3; // v2: 5 局 3 胜
    let rpsScore = { you: 0, cpu: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(RPS_KEY) || "null");
      if (saved && typeof saved.you === "number" && typeof saved.cpu === "number") rpsScore = saved;
    } catch (e) { /* 忽略 */ }
    // 马尔可夫链：记玩家最近 10 次出招，统计“上一次出 X 后下一次出 Y”的转移次数，预测下一步
    let rpsHist = [];
    try { rpsHist = JSON.parse(localStorage.getItem(RPS_HIST_KEY) || "[]") || []; } catch (e) { rpsHist = []; }
    function rpsPredict() {
      if (rpsHist.length < 3) return null;
      const last = rpsHist[rpsHist.length - 1];
      const counts = { rock: 0, scissors: 0, paper: 0 };
      for (let i = 0; i < rpsHist.length - 1; i++) {
        if (rpsHist[i] === last) counts[rpsHist[i + 1]]++;
      }
      let best = null, bestN = 0;
      Object.keys(counts).forEach((k) => { if (counts[k] > bestN) { bestN = counts[k]; best = k; } });
      return bestN > 0 ? best : null;
    }
    function renderRpsScore() {
      $("rpsScore").textContent = "你 " + rpsScore.you + " : " + rpsScore.cpu + " 电脑 · 5 局 3 胜";
    }
    function saveRps() {
      try {
        localStorage.setItem(RPS_KEY, JSON.stringify(rpsScore));
        localStorage.setItem(RPS_HIST_KEY, JSON.stringify(rpsHist.slice(-10)));
      } catch (e) { /* 忽略 */ }
    }
    function rpsPlay(you) {
      if (rpsScore.you >= RPS_TARGET || rpsScore.cpu >= RPS_TARGET) return;
      // AI：用马尔可夫链预测玩家下一步，出克制招；预测不到就随机（带一点故意放水，胜率约 65%）
      const predicted = rpsPredict();
      let cpu;
      if (predicted && Math.random() < 0.7) {
        cpu = RPS_COUNTER[predicted];
      } else {
        cpu = pick(["rock", "scissors", "paper"]);
      }
      rpsHist.push(you);
      if (rpsHist.length > 10) rpsHist = rpsHist.slice(-10);
      $("rpsYou").textContent = RPS_HANDS[you];
      $("rpsCpu").textContent = RPS_HANDS[cpu];
      // 出招动画：拳头抖三抖
      [$("rpsYou"), $("rpsCpu")].forEach((el) => {
        el.classList.remove("rps-shake"); void el.offsetWidth; el.classList.add("rps-shake");
      });
      let msg;
      if (you === cpu) { msg = "平局！再来。"; SFX.pop(); }
      else if (RPS_BEATS[you] === cpu) { rpsScore.you++; msg = "🎉 你赢了这局！"; SFX.win(); }
      else { rpsScore.cpu++; msg = "😤 电脑赢了这局。"; SFX.lose(); }
      if (predicted) msg += "（AI 觉得你要出" + RPS_HANDS[predicted] + "）";
      if (rpsScore.you >= RPS_TARGET) msg = "🏆 5 局 3 胜，你赢下了整场！AI 服了。";
      else if (rpsScore.cpu >= RPS_TARGET) msg = "💻 AI 5 局 3 胜拿下整场。它快把你看透了，换套路再来？";
      $("rpsResult").textContent = msg;
      renderRpsScore();
      saveRps();
      $("rpsResetBtn").classList.remove("hidden");
    }
    $("rpsRockBtn").addEventListener("click", () => rpsPlay("rock"));
    $("rpsScissorsBtn").addEventListener("click", () => rpsPlay("scissors"));
    $("rpsPaperBtn").addEventListener("click", () => rpsPlay("paper"));
    $("rpsResetBtn").addEventListener("click", () => {
      rpsScore = { you: 0, cpu: 0 };
      saveRps();
      renderRpsScore();
      $("rpsYou").textContent = "❔";
      $("rpsCpu").textContent = "❔";
      $("rpsResult").textContent = "出一个，看看谁赢。AI 正在研究你的套路……";
    });
    renderRpsScore();
    // v3.0-r16：刷新后比分已打完时也要露出重置按钮，不然出招被拦、重置又藏着，整场卡死
    if (rpsScore.you >= RPS_TARGET || rpsScore.cpu >= RPS_TARGET) $("rpsResetBtn").classList.remove("hidden");

  };
  /* ---------- 10. 数字炸弹 ---------- */
  toyInitFns["guess"] = function () {
    const GUESS_BEST_KEY = "dorm-toybox-guess-best-v1";
    let guessTarget = 1 + Math.floor(Math.random() * 100);
    let guessTries = [];
    // ---- 新增：区间可视化、回合数、双人对战 ----
    let guessLow = 1, guessHigh = 100; // 当前区间
    let guessMode = "solo"; // solo | duo
    let guessTurn = 0; // 双人模式轮到谁（0=玩家一，1=玩家二）
    let guessOver = false; // v3.0-r16：终局后锁死，不然拆弹成功/分出胜负后还能继续猜、重复刷结果
    const guessSec = $("toy-guess");
    // 区间进度条
    const rangeWrap = document.createElement("div");
    rangeWrap.className = "guess-range";
    const rangeBar = document.createElement("div");
    rangeBar.className = "guess-range-bar";
    const rangeFill = document.createElement("div");
    rangeFill.className = "guess-range-fill";
    rangeBar.appendChild(rangeFill);
    const rangeLabel = document.createElement("p");
    rangeLabel.className = "guess-range-label";
    rangeWrap.appendChild(rangeBar); rangeWrap.appendChild(rangeLabel);
    // 模式切换
    const modeRow = document.createElement("div");
    modeRow.className = "btn-row";
    const soloBtn = document.createElement("button");
    soloBtn.className = "btn gold-btn small picked"; soloBtn.textContent = "单人拆弹";
    const duoBtn = document.createElement("button");
    duoBtn.className = "btn gold-btn small"; duoBtn.textContent = "双人对战";
    modeRow.appendChild(soloBtn); modeRow.appendChild(duoBtn);
    const turnP = document.createElement("p");
    turnP.className = "count-line"; turnP.style.display = "none";
    if (guessSec) {
      // 直接 append 到 section 末尾（和老虎机赔率表同款写法；旧写法要求 guessBtn 有 parentNode，冒烟测试的桩元素没有 parent，模式按钮在测试里就丢了）
      guessSec.appendChild(modeRow);
      guessSec.appendChild(turnP);
      guessSec.appendChild(rangeWrap);
    }
    function renderGuessRange() {
      const pctLow = ((guessLow - 1) / 99) * 100;
      const pctHigh = ((guessHigh - 1) / 99) * 100;
      rangeFill.style.left = pctLow + "%";
      rangeFill.style.width = (pctHigh - pctLow) + "%";
      rangeLabel.textContent = "🎯 区间：[" + guessLow + ", " + guessHigh + "] · 已猜 " + guessTries.length + " 次";
    }
    function resetGuessRange() { guessLow = 1; guessHigh = 100; guessTurn = 0; renderGuessRange(); }
    function resetGuessRound() { // v3.0-r16：开新局（换数/切模式都走这里，避免单双人共用已知炸弹）
      guessTarget = 1 + Math.floor(Math.random() * 100);
      guessTries = [];
      guessOver = false;
      resetGuessRange();
      renderGuessChips();
      renderGuessCount();
      $("guessInput").value = "";
    }
    soloBtn.addEventListener("click", () => {
      guessMode = "solo";
      soloBtn.classList.add("picked"); duoBtn.classList.remove("picked");
      turnP.style.display = "none";
      resetGuessRound();
      $("guessResult").textContent = "单人模式：猜中炸弹即拆弹成功！";
    });
    duoBtn.addEventListener("click", () => {
      guessMode = "duo";
      duoBtn.classList.add("picked"); soloBtn.classList.remove("picked");
      turnP.style.display = "";
      turnP.textContent = "👤 轮到玩家一猜（猜中者输！）";
      resetGuessRound();
      $("guessResult").textContent = "双人对战：轮流猜，猜中炸弹的人输！";
    });
    function loadGuessBest() {
      try { return parseInt(localStorage.getItem(GUESS_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    let guessBest = loadGuessBest();
    function renderGuessCount() {
      $("guessCount").textContent = guessTries.length === 0
        ? "1–100 之间，猜的次数越少越牛。" + (guessBest > 0 ? "宿舍纪录：" + guessBest + " 次。" : "")
        : "已猜 " + guessTries.length + " 次" + (guessBest > 0 ? " · 纪录 " + guessBest + " 次" : "");
    }
    function renderGuessChips() {
      const box = $("guessChips");
      box.innerHTML = "";
      guessTries.forEach((n) => {
        const chip = document.createElement("span");
        chip.className = "guess-chip" + (n < guessTarget ? " low" : n > guessTarget ? " high" : " hit");
        chip.textContent = n;
        box.appendChild(chip);
      });
    }
    function guessOnce() {
      if (guessOver) {
        $("guessResult").textContent = "这局已经结束了，点「换个数重开」再来一局。";
        return;
      }
      const n = parseInt($("guessInput").value, 10);
      if (isNaN(n) || n < 1 || n > 100) {
        $("guessResult").textContent = "请输入 1–100 之间的整数。";
        return;
      }
      guessTries.push(n);
      renderGuessChips();
      // 更新区间
      if (n < guessTarget && n >= guessLow) guessLow = n + 1;
      if (n > guessTarget && n <= guessHigh) guessHigh = n - 1;
      renderGuessRange();
      if (n === guessTarget) {
        guessOver = true;
        if (guessMode === "duo") {
          const loser = guessTurn === 0 ? "玩家一" : "玩家二";
          const winner = guessTurn === 0 ? "玩家二" : "玩家一";
          SFX.win();
          $("guessResult").textContent = "💥 " + loser + " 猜中炸弹，输了！" + winner + " 获胜！";
        } else {
          const tries = guessTries.length;
          SFX.win();
          let msg = "💣 拆弹成功！就是 " + guessTarget + "，用了 " + tries + " 次。";
          if (guessBest === 0 || tries < guessBest) {
            guessBest = tries;
            saveBest(GUESS_BEST_KEY, tries);
            msg += "新纪录！";
          }
          $("guessResult").textContent = msg;
        }
      } else if (n < guessTarget) {
        $("guessResult").textContent = "小了，再大点 ↑（已猜 " + guessTries.length + " 次）";
      } else {
        $("guessResult").textContent = "大了，再小点 ↓（已猜 " + guessTries.length + " 次）";
      }
      // 双人模式切换回合
      if (guessMode === "duo" && n !== guessTarget) {
        guessTurn = 1 - guessTurn;
        turnP.textContent = "👤 轮到" + (guessTurn === 0 ? "玩家一" : "玩家二") + "猜（猜中者输！）";
      }
      renderGuessCount();
      $("guessInput").value = "";
      if ($("guessInput").focus) $("guessInput").focus();
    }
    renderGuessRange();
    $("guessBtn").addEventListener("click", guessOnce);
    $("guessInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); guessOnce(); }
    });
    $("guessResetBtn").addEventListener("click", () => {
      resetGuessRound();
      $("guessResult").textContent = "换了个数，重新猜。";
      $("guessInput").value = "";
    });
    renderGuessCount();

  };
  /* ---------- 11. 记忆翻牌 ---------- */
  toyInitFns["memory"] = function () {
    const MEMORY_BEST_KEY = "dorm-toybox-memory-best-v1";
    let memoryFlipped = [];
    let memoryLock = false;
    let memoryMatched = 0;
    let memoryMoves = 0;
    let memoryStartAt = null; // v3.0-r15：用 null 做“未开始”哨兵，不用 0（performance.now() 在加载瞬间可为 0，!0 会重复建计时器且旧的泄漏）
    let memoryTimerId = null;
    function loadMemoryBest() {
      try {
        const saved = JSON.parse(localStorage.getItem(MEMORY_BEST_KEY) || "null");
        return saved && typeof saved.moves === "number" ? saved : null;
      } catch (e) { return null; }
    }
    let memoryBest = loadMemoryBest();
    function renderMemoryBest() {
      $("memoryBest").textContent = memoryBest
        ? "宿舍纪录：" + memoryBest.moves + " 步 · " + memoryBest.seconds + " 秒"
        : "还没人留下纪录。第一个通关的就是纪录。";
    }
    function memoryElapsed() {
      return memoryStartAt === null ? 0 : Math.floor((performance.now() - memoryStartAt) / 1000);
    }
    function renderMemoryStats() {
      $("memoryStats").textContent = "步数 " + memoryMoves + " · 用时 " + memoryElapsed() + " 秒";
    }
    function buildMemoryDeck() {
      const deck = shuffle(MEMORY_EMOJIS.concat(MEMORY_EMOJIS));
      memoryFlipped = [];
      memoryLock = false;
      memoryMatched = 0;
      memoryMoves = 0;
      memoryStartAt = null;
      if (memoryTimerId) { clearInterval(memoryTimerId); memoryTimerId = null; }
      const grid = $("memoryGrid");
      grid.innerHTML = "";
      deck.forEach((emoji, i) => {
        const card = document.createElement("button");
        card.className = "memory-card";
        card.setAttribute("data-emoji", emoji);
        card.setAttribute("data-index", String(i));
        card.textContent = "❓";
        card.addEventListener("click", () => memoryFlip(card));
        grid.appendChild(card);
      });
      $("memoryResult").textContent = "点一张牌开始。";
      renderMemoryStats();
      renderMemoryBest();
    }
    function memoryFlip(card) {
      if (memoryLock || card.classList.contains("flipped") || card.classList.contains("matched") || card.classList.contains("flipping") || card.classList.contains("unflipping")) return;
      if (memoryStartAt === null) {
        memoryStartAt = performance.now();
        memoryTimerId = setInterval(renderMemoryStats, 500);
      }
      // v1.32：3D 翻转两段式——先转到 90°（边缘，看不见），换面，再转回来，避免镜像
      card.classList.add("flipping");
      setTimeout(() => {
        card.textContent = card.getAttribute("data-emoji");
        card.classList.remove("flipping");
        card.classList.add("flipped");
        SFX.click();
      }, 140);
      memoryFlipped.push(card);
      if (memoryFlipped.length === 2) {
        memoryLock = true;
        memoryMoves++;
        renderMemoryStats();
        const a = memoryFlipped[0];
        const b = memoryFlipped[1];
        setTimeout(() => {
          if (a.getAttribute("data-emoji") === b.getAttribute("data-emoji")) {
            a.classList.add("matched");
            b.classList.add("matched");
            memoryMatched++;
            SFX.pop(0.25 + (memoryMatched / MEMORY_EMOJIS.length) * 0.65);
            if (memoryMatched === MEMORY_EMOJIS.length) {
              if (memoryTimerId) { clearInterval(memoryTimerId); memoryTimerId = null; }
              const seconds = memoryElapsed();
              let msg = "🎉 通关！用了 " + memoryMoves + " 步 · " + seconds + " 秒。";
              if (!memoryBest || memoryMoves < memoryBest.moves ||
                (memoryMoves === memoryBest.moves && seconds < memoryBest.seconds)) {
                memoryBest = { moves: memoryMoves, seconds };
                try { localStorage.setItem(MEMORY_BEST_KEY, JSON.stringify(memoryBest)); } catch (e) { /* 忽略 */ }
                msg += "新纪录！";
              }
              SFX.win();
              $("memoryResult").textContent = msg;
              renderMemoryBest();
            } else {
              $("memoryResult").textContent = "配对成功！还剩 " + (MEMORY_EMOJIS.length - memoryMatched) + " 对。";
            }
          } else {
            // v1.32：没配上——两段式翻回去
            a.classList.add("unflipping");
            b.classList.add("unflipping");
            setTimeout(() => {
              a.classList.remove("flipped", "unflipping");
              b.classList.remove("flipped", "unflipping");
              a.textContent = "❓";
              b.textContent = "❓";
              memoryFlipped = [];
              memoryLock = false;
            }, 140);
            $("memoryResult").textContent = "没配上，再试一次。";
            return;
          }
          memoryFlipped = [];
          memoryLock = false;
        }, 600);
      }
    }
    $("memoryResetBtn").addEventListener("click", buildMemoryDeck);
    buildMemoryDeck();

    // 退出就停：翻牌计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    toyLeaveCleanup.memory = () => { if (memoryTimerId) { clearInterval(memoryTimerId); memoryTimerId = null; } };
    toyEnterResume.memory = () => { if (memoryStartAt !== null && memoryMatched < MEMORY_EMOJIS.length && !memoryTimerId) memoryTimerId = setInterval(renderMemoryStats, 500); };

  };
  /* ---------- 12. 打字测试 ---------- */
  toyInitFns["typing"] = function () {
    const TYPING_BEST_KEY = "dorm-toybox-typing-best-v1";
    const TYPING_LEVEL_KEY = "dorm-toybox-typing-level-v1"; // 已解锁到的最高关（0-based）
    let typingTarget = "";
    let typingStartAt = null; // v3.0-r16：用 null 做“未开始”哨兵，不用 0（同 R15 数独/记忆翻牌：performance.now() 在加载瞬间可为 0，!0 会重复建计时器且旧的泄漏）
    let typingTimerId = null;
    let typingDone = false;
    let typingComposing = false; // 输入法正在拼字（composition）时不比对
    let typingLevel = 0; // 当前关 0-4
    let typingAudioCtx = null;
    function loadTypingBest() {
      try { return parseInt(localStorage.getItem(TYPING_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    function loadTypingLevel() {
      try { return Math.min(4, Math.max(0, parseInt(localStorage.getItem(TYPING_LEVEL_KEY) || "0", 10) || 0)); }
      catch (e) { return 0; }
    }
    let typingBest = loadTypingBest();
    typingLevel = loadTypingLevel();
    function renderTypingBest() {
      $("typingBest").textContent = typingBest > 0
        ? "宿舍纪录：" + typingBest + " 字/分"
        : "还没人留下纪录。第一个打完的就是纪录。";
    }
    // 打字机音效（WebAudio 合成短促咔哒）
    function typingClick() {
      try {
        if (!typingAudioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          typingAudioCtx = new AC();
        }
        const ctx = typingAudioCtx;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 1800 + Math.random() * 600;
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.03);
      } catch (e) { /* 忽略 */ }
    }
    function renderTypingLevels() {
      const wrap = $("typingLevels");
      if (!wrap) return;
      wrap.innerHTML = "";
      const unlocked = loadTypingLevel();
      TYPING_LEVELS.forEach((lv, i) => {
        const b = document.createElement("button");
        const locked = i > unlocked;
        b.className = "btn ghost-btn small" + (i === typingLevel ? " active" : "");
        b.textContent = (locked ? "🔒 " : "") + lv.name;
        b.disabled = locked;
        b.addEventListener("click", () => {
          typingLevel = i;
          typingNewSentence();
          renderTypingLevels();
        });
        wrap.appendChild(b);
      });
    }
    function typingElapsedSec() {
      return typingStartAt === null ? 0 : (performance.now() - typingStartAt) / 1000;
    }
    function renderTypingTarget() {
      const box = $("typingTarget");
      box.innerHTML = "";
      typingTarget.split("").forEach((ch) => {
        const span = document.createElement("span");
        span.className = "typing-char";
        span.textContent = ch;
        box.appendChild(span);
      });
    }
    function typingNewSentence() {
      const lv = TYPING_LEVELS[typingLevel] || TYPING_LEVELS[0];
      typingTarget = pick(lv.sentences);
      typingStartAt = null;
      typingDone = false;
      if (typingTimerId) { clearInterval(typingTimerId); typingTimerId = null; }
      $("typingInput").value = "";
      $("typingInput").disabled = false;
      renderTypingTarget();
      $("typingResult").textContent = "还没开始打。";
      $("typingStats").textContent = "用时 0 秒 · 已打 0 字";
      renderTypingBest();
    }
    function typingTick() {
      if (typingComposing) return; // 拼拼音的中间态不参与比对，等选字上屏再判
      const input = $("typingInput").value;
      const chars = $("typingTarget").children;
      let correct = 0;
      for (let i = 0; i < chars.length; i++) {
        const span = chars[i];
        const typed = input[i];
        span.classList.remove("ok", "bad");
        if (typed === undefined) { /* 未打 */ }
        else if (typed === span.textContent) { span.classList.add("ok"); correct++; }
        else {
          span.classList.add("bad");
          // 错误抖动（只给刚错的那个加，避免全屏抖）
          if (i === input.length - 1) {
            span.classList.remove("shake");
            void span.offsetWidth;
            span.classList.add("shake");
          }
        }
      }
      const elapsed = typingElapsedSec();
      const wpm = elapsed > 1 ? Math.round((correct / elapsed) * 60) : 0;
      $("typingStats").textContent = "用时 " + Math.floor(elapsed) + " 秒 · 已打 " + input.length + " 字 · 正确 " + correct + " 字 · 实时 " + wpm + " 字/分";
      if (!typingDone && input.length >= typingTarget.length) {
        typingDone = true;
        if (typingTimerId) { clearInterval(typingTimerId); typingTimerId = null; }
        $("typingInput").disabled = true;
        const seconds = Math.max(elapsed, 0.1);
        const cpm = Math.round((typingTarget.length / seconds) * 60);
        const accuracy = Math.round((correct / typingTarget.length) * 100);
        let msg = "🎉 打完！速度 " + cpm + " 字/分 · 正确率 " + accuracy + "% · 用时 " + seconds.toFixed(1) + " 秒。";
        if (typingBest === 0 || cpm > typingBest) {
          typingBest = cpm;
          saveBest(TYPING_BEST_KEY, cpm);
          msg += "新纪录！";
        }
        // 闯关：正确率≥80% 解锁下一关
        const unlocked = loadTypingLevel();
        if (accuracy >= 80 && typingLevel === unlocked && typingLevel < TYPING_LEVELS.length - 1) {
          try { localStorage.setItem(TYPING_LEVEL_KEY, String(typingLevel + 1)); } catch (e) {}
          msg += " 🔓 解锁" + TYPING_LEVELS[typingLevel + 1].name + "！";
        } else if (accuracy < 80) {
          msg += " （正确率≥80% 才能解锁下一关）";
        }
        $("typingResult").textContent = msg;
        renderTypingBest();
        renderTypingLevels();
      }
    }
    function typingOnInput() {
      if (typingComposing) return;
      if (typingStartAt === null && !typingDone) {
        typingStartAt = performance.now();
        typingTimerId = setInterval(typingTick, 200);
      }
      typingClick();
      typingTick();
    }
    $("typingInput").addEventListener("input", (e) => {
      if (e.isComposing) return;
      typingOnInput();
    });
    $("typingInput").addEventListener("compositionstart", () => { typingComposing = true; });
    $("typingInput").addEventListener("compositionend", () => {
      typingComposing = false;
      typingOnInput(); // 选字上屏后才比对
    });
    $("typingNextBtn").addEventListener("click", typingNewSentence);
    renderTypingLevels();
    typingNewSentence();

    // 退出就停：打字计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    toyLeaveCleanup.typing = () => { if (typingTimerId) { clearInterval(typingTimerId); typingTimerId = null; } };
    toyEnterResume.typing = () => { if (typingStartAt !== null && !typingDone && !typingTimerId) typingTimerId = setInterval(typingTick, 200); };
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get typing() { return { level: typingLevel, best: typingBest }; },
        typingSetLevel(i) { typingLevel = Math.min(4, Math.max(0, i)); renderTypingLevels(); typingNewSentence(); },
    }));

  };
  /* ---------- 13. 华容道 ---------- */
  toyInitFns["puzzle"] = function () {
    const PUZZLE_BEST_KEY = "dorm-toybox-puzzle-best-v1";
    const PUZZLE_SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    let puzzleTiles = PUZZLE_SOLVED.slice();
    let puzzleMoves = 0;
    let puzzleWon = false;
    function loadPuzzleBest() {
      try { return parseInt(localStorage.getItem(PUZZLE_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    let puzzleBest = loadPuzzleBest();
    function renderPuzzleBest() {
      $("puzzleBest").textContent = puzzleBest > 0
        ? "宿舍纪录：" + puzzleBest + " 步"
        : "还没人通关。第一个通关的就是纪录。";
    }
    function puzzleBlankAt() { return puzzleTiles.indexOf(0); }
    function puzzleAdjacent(i) {
      const b = puzzleBlankAt();
      const r1 = Math.floor(i / 3), c1 = i % 3, r2 = Math.floor(b / 3), c2 = b % 3;
      return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    }
    function puzzleTilePos(i) {
      return { left: (i % 3) * 33.3333 + "%", top: Math.floor(i / 3) * 33.3333 + "%" };
    }
    function renderPuzzle() {
      const grid = $("puzzleGrid");
      grid.innerHTML = "";
      puzzleTiles.forEach((n, i) => {
        if (n === 0) return; // 空格不建格子，留个洞
        const tile = document.createElement("button");
        tile.className = "puzzle-tile";
        tile.textContent = String(n);
        tile.setAttribute("data-num", String(n));
        tile.setAttribute("data-pos", String(i));
        const pos = puzzleTilePos(i);
        tile.style.left = pos.left;
        tile.style.top = pos.top;
        tile.addEventListener("click", () => puzzleMove(parseInt(tile.getAttribute("data-pos"), 10)));
        grid.appendChild(tile);
      });
      $("puzzleStats").textContent = "步数 " + puzzleMoves;
    }
    function puzzleShuffle() {
      puzzleTiles = PUZZLE_SOLVED.slice();
      puzzleMoves = 0;
      puzzleWon = false;
      let prevBlank = -1;
      for (let s = 0; s < 60; s++) {
        const b = puzzleBlankAt();
        const options = [b - 3, b + 3, b - 1, b + 1].filter((i) => {
          if (i < 0 || i > 8) return false;
          if (Math.floor(i / 3) !== Math.floor(b / 3) && Math.abs(i - b) === 1) return false; // 不越行
          return i !== prevBlank;
        });
        const next = pick(options);
        prevBlank = b;
        puzzleTiles[b] = puzzleTiles[next];
        puzzleTiles[next] = 0;
      }
      $("puzzleResult").textContent = "点一块滑进空格。";
      renderPuzzle();
      renderPuzzleBest();
    }
    function puzzleMove(i) {
      if (puzzleWon || !puzzleAdjacent(i)) return;
      const b = puzzleBlankAt();
      const movedNum = puzzleTiles[i];
      puzzleTiles[b] = movedNum;
      puzzleTiles[i] = 0;
      puzzleMoves++;
      // 只动被滑的那块：改 left/top，CSS transition 让它滑过去，不重建整个盘
      const grid = $("puzzleGrid");
      grid.querySelectorAll(".puzzle-tile").forEach((el) => {
        if (parseInt(el.getAttribute("data-num"), 10) === movedNum) {
          const pos = puzzleTilePos(b);
          el.style.left = pos.left;
          el.style.top = pos.top;
          el.setAttribute("data-pos", String(b));
        }
      });
      $("puzzleStats").textContent = "步数 " + puzzleMoves;
      if (puzzleTiles.join(",") === PUZZLE_SOLVED.join(",")) {
        puzzleWon = true;
        let msg = "🎉 通关！用了 " + puzzleMoves + " 步。";
        if (puzzleBest === 0 || puzzleMoves < puzzleBest) {
          puzzleBest = puzzleMoves;
          saveBest(PUZZLE_BEST_KEY, puzzleMoves);
          msg += "新纪录！";
        }
        $("puzzleResult").textContent = msg;
        renderPuzzleBest();
      }
    }
    $("puzzleResetBtn").addEventListener("click", puzzleShuffle);
    puzzleShuffle();

  };
  /* ---------- 14. 老虎机：左右两台独立机器，一人一台，轮流拉，回合制记分 ---------- */
  toyInitFns["slots"] = function () {
    const SLOTS_KEY = "dorm-toybox-slots-v2";
    const SLOTS_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]];
    let slotsSpinning = false;
    function loadSlotsStats() {
      try {
        const s = JSON.parse(localStorage.getItem(SLOTS_KEY) || "null");
        if (s && typeof s.a === "number" && typeof s.b === "number") return s;
      } catch (e) { /* 忽略 */ }
      return { a: 0, b: 0, round: 1, turn: "a" };
    }
    let slotsStats = loadSlotsStats();
    function slotsPlayerName(t) { return t === "a" ? "玩家一" : "玩家二"; }
    function slotsReelsEl(who) { return who === "a" ? $("slotsReelsA") : $("slotsReelsB"); }
    function slotsSpinEl(who) { return who === "a" ? $("slotsSpinA") : $("slotsSpinB"); }
    function slotsResultEl(who) { return who === "a" ? $("slotsResultA") : $("slotsResultB"); }
    function slotsScoreEl(who) { return who === "a" ? $("slotsScoreA") : $("slotsScoreB"); }
    function renderSlotsStats() {
      $("slotsStats").textContent = "第 " + slotsStats.round + " 轮 · 轮到" + slotsPlayerName(slotsStats.turn);
      slotsScoreEl("a").textContent = slotsStats.a + " 分";
      slotsScoreEl("b").textContent = slotsStats.b + " 分";
      $("slotsMachineA").classList.toggle("active", slotsStats.turn === "a");
      $("slotsMachineB").classList.toggle("active", slotsStats.turn === "b");
      slotsSpinEl("a").disabled = slotsSpinning || slotsStats.turn !== "a";
      slotsSpinEl("b").disabled = slotsSpinning || slotsStats.turn !== "b";
    }
    function saveSlotsStats() {
      try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slotsStats)); } catch (e) { /* 忽略 */ }
    }
    // ---- 新增：欢乐豆、赔率表、粒子、音效 ----
    if (typeof slotsStats.coins !== "number") slotsStats.coins = 100;
    // 赔率表（动态添加，不改 HTML 结构）
    const slotsSec = $("toy-slots");
    const paytable = document.createElement("div");
    paytable.className = "slots-paytable";
    paytable.innerHTML = '<p class="paytable-title">📋 赔率表</p>' +
      '<p>三个 🍒/🍋/🍇/🔔/⭐ 一样：+10 分</p>' +
      '<p>三个 💎 一样：+30 分 💰</p>' +
      '<p>🪙 欢乐豆：赢分 1:1 兑换，存 localStorage</p>';
    const coinsP = document.createElement("p");
    coinsP.className = "count-line";
    // 直接 append 到 section 末尾（stub 兼容）
    if (slotsSec) {
      slotsSec.appendChild(paytable);
      slotsSec.appendChild(coinsP);
    }
    function renderSlotsCoins() {
      coinsP.textContent = "🪙 欢乐豆：" + slotsStats.coins;
    }
    // WebAudio 音效
    let slotsAudio = null;
    function slotsBeep(freq, dur) {
      try {
        if (!slotsAudio) slotsAudio = new (window.AudioContext || window.webkitAudioContext)();
        const o = slotsAudio.createOscillator(), g = slotsAudio.createGain();
        o.connect(g); g.connect(slotsAudio.destination);
        o.frequency.value = freq; o.type = "sine";
        g.gain.setValueAtTime(0.1, slotsAudio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, slotsAudio.currentTime + dur);
        o.start(); o.stop(slotsAudio.currentTime + dur);
      } catch (e) {}
    }
    function slotsWinSound() { slotsBeep(880, 0.15); setTimeout(() => slotsBeep(1320, 0.2), 120); }
    // 撒花粒子
    function slotsParticles(container) {
      for (let i = 0; i < 12; i++) {
        const p = document.createElement("span");
        p.className = "slots-particle";
        p.textContent = ["🎉", "✨", "💰", "⭐"][i % 4];
        p.style.left = (20 + Math.random() * 60) + "%";
        p.style.animationDelay = (Math.random() * 0.3) + "s";
        container.appendChild(p);
        setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 1500);
      }
    }
    ["a", "b"].forEach((who) => {
      const box = slotsReelsEl(who);
      box.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const s = document.createElement("span");
        s.textContent = "🍒";
        box.appendChild(s);
      }
    });
    function renderSlotsReels(who, symbols) {
      const reels = slotsReelsEl(who).children;
      for (let i = 0; i < 9; i++) reels[i].textContent = symbols[i];
    }
    function slotsScoreLines(final) {
      let points = 0, lines = 0;
      SLOTS_LINES.forEach(([a, b, c]) => {
        if (final[a] === final[b] && final[b] === final[c]) {
          lines++;
          points += final[a] === "💎" ? 30 : 10;
        }
      });
      return { points, lines };
    }
    function slotsSpin(who) {
      if (slotsSpinning || slotsStats.turn !== who) return;
      slotsSpinning = true;
      SFX.coin();
      renderSlotsStats();
      slotsResultEl(who).textContent = slotsPlayerName(who) + "拉着呢……";
      // 滚轮滚动动画
      const reelsEl = slotsReelsEl(who);
      if (reelsEl) reelsEl.classList.add("spinning");
      let ticks = 0;
      const timer = setInterval(() => {
        const roll = [];
        for (let i = 0; i < 9; i++) roll.push(pick(SLOTS_SYMBOLS));
        renderSlotsReels(who, roll);
        ticks++;
        if (ticks >= 12) {
          clearInterval(timer);
          const final = [];
          for (let i = 0; i < 9; i++) final.push(pick(SLOTS_SYMBOLS));
          // 中奖率：近一半的局保底中一条线，不然十把九空太无聊
          if (Math.random() < 0.45) {
            const line = pick(SLOTS_LINES);
            const sym = pick(SLOTS_SYMBOLS);
            line.forEach((i) => { final[i] = sym; });
          }
          renderSlotsReels(who, final);
          slotsSpinning = false;
          if (reelsEl) reelsEl.classList.remove("spinning");
          const { points, lines } = slotsScoreLines(final);
          slotsStats[who] += points;
          // 欢乐豆：赢分 1:1 兑换
          if (points > 0) {
            slotsStats.coins += points;
            // 中奖特效：粒子 + 音效
            const machineEl = who === "a" ? $("slotsMachineA") : $("slotsMachineB");
            if (machineEl) {
              machineEl.classList.add("slots-win");
              slotsParticles(machineEl);
              setTimeout(() => machineEl.classList.remove("slots-win"), 1500);
            }
            slotsWinSound();
            SFX.win();
          } else {
            SFX.lose();
          }
          slotsResultEl(who).textContent = "本局 +" + points + " 分" + (lines > 0 ? "（" + lines + " 条线中奖）" : "（没中奖）") + "。";
          if (who === "a") { slotsStats.turn = "b"; }
          else { slotsStats.turn = "a"; slotsStats.round++; }
          renderSlotsStats();
          renderSlotsCoins();
          saveSlotsStats();
        }
      }, 80);
    }
    renderSlotsCoins();
    $("slotsSpinA").addEventListener("click", () => slotsSpin("a"));
    $("slotsSpinB").addEventListener("click", () => slotsSpin("b"));
    $("slotsResetBtn").addEventListener("click", () => {
      // v3.0-r16：重置只清比分/轮次，欢乐豆保留（旧写法丢了 coins，下次赢分就变 NaN）
      slotsStats = { a: 0, b: 0, round: 1, turn: "a", coins: (typeof slotsStats.coins === "number" ? slotsStats.coins : 100) };
      saveSlotsStats();
      renderSlotsReels("a", Array(9).fill("🍒"));
      renderSlotsReels("b", Array(9).fill("🍒"));
      slotsResultEl("a").textContent = "等你拉。";
      slotsResultEl("b").textContent = "等你拉。";
      renderSlotsStats();
      renderSlotsCoins();
    });
    slotsResultEl("a").textContent = "等你拉。";
    slotsResultEl("b").textContent = "等你拉。";
    renderSlotsStats();

  };
  /* ---------- v3.0 第5轮：搜索——模糊匹配（错别字/同音）+ 相关性排序 ---------- */
  function fuzzySubseq(q, target) {
    let i = 0;
    for (let k = 0; k < target.length && i < q.length; k++) {
      if (target[k] === q[i]) i++;
    }
    return i === q.length;
  }
  // 错别字容忍：查询≥3字时允许删一字（如"五子琪"→"五子棋"）；短查询严格，避免误杀
  function fuzzyHit(q, target) {
    if (fuzzySubseq(q, target)) return true;
    if (q.length >= 3) {
      for (let k = 0; k < q.length; k++) {
        if (fuzzySubseq(q.slice(0, k) + q.slice(k + 1), target)) return true;
      }
    }
    return false;
  }
  // 相关性打分：4 完全相等 > 3 开头匹配 > 2 包含 > 1 模糊
  function searchScore(q, b) {
    const name = b._name || "";
    if (name === q) return 4;
    if (name.indexOf(q) === 0) return 3;
    if ((b._q || "").indexOf(q) >= 0) return 2;
    if (fuzzyHit(q, b._q || "")) return 1;
    return 0;
  }
  // 搜索/分类过滤时隐藏置顶区（避免和"全部游戏"重复）
  function updatePinnedVisibility() {
    const q = ($("toySearch").value || "").trim();
    const sec = $("homePinnedSection");
    if (!sec) return;
    const show = q === "" && activeCat === "all";
    sec.classList.toggle("hidden", !show);
  }
  /* ---------- 玩具搜索：搜名字，主页方块和抽屉方块一起过滤，露出主页结果 ---------- */
  $("toySearch").addEventListener("input", () => {
    const q = $("toySearch").value.trim().toLowerCase(); // v2.0：小写，支持拼音首字母搜索
    if ($("drawerSearch")) $("drawerSearch").value = ""; // v3.0 第7轮：主搜索时清空抽屉搜索
    let visibleCount = 0;
    // 抽屉：过滤（v3.0 第7轮：抽屉按分类分组 + 标签显隐）
    refreshDrawerFilter();
    // 主页：过滤 + 相关性排序（完全匹配排前面）
    const scored = [];
    allHomeTiles().forEach((b) => {
      const s = q === "" ? 1 : searchScore(q, b);
      b.classList.toggle("hidden", s === 0);
      b._score = s;
      if (s > 0) { scored.push(b); visibleCount++; }
    });
    try {
      const grid = $("homeAllGrid");
      if (grid && typeof grid.appendChild === "function" && grid.children) {
        const kids = Array.from(grid.children);
        if (q === "") {
          // 清空：恢复 TOYS 原顺序
          kids.sort((a, b) => (TOY_ORDER[a.getAttribute("data-toy")] ?? 9999) - (TOY_ORDER[b.getAttribute("data-toy")] ?? 9999));
        } else {
          // 按分数降序，同分按原顺序（只排本 grid 的 tile，置顶区不动）
          kids.sort((a, b) => ((b._score || 0) - (a._score || 0)) || ((TOY_ORDER[a.getAttribute("data-toy")] ?? 9999) - (TOY_ORDER[b.getAttribute("data-toy")] ?? 9999)));
        }
        kids.forEach((k) => grid.appendChild(k));
      }
    } catch (e) { /* 测试 stub 无 parentNode/children，跳过排序 */ }
    // v2.0：空状态——无结果时显示"随便玩玩"
    const emptyEl = $("searchEmpty");
    if (emptyEl) emptyEl.classList.toggle("hidden", !(q !== "" && visibleCount === 0));
    updatePinnedVisibility();
    if (q !== "") { closeDrawer(); showHome(true); } // v3.0 第7轮：搜索回顶部看结果
  });
  // v2.0：随便玩玩——随机开一个玩具
  const surpriseBtn = $("surpriseBtn");
  if (surpriseBtn) surpriseBtn.addEventListener("click", () => {
    const t = TOYS[Math.floor(Math.random() * TOYS.length)];
    if (t) showToy(t.id);
  });
  // v2.0：分类筛选
  let activeCat = "all";
  function applyCatFilter() {
    allHomeTiles().forEach((b) => {
      const matchCat = activeCat === "all" || b._cat === activeCat;
      // 分类和搜索叠加：搜索框有内容时以搜索为准
      const q = ($("toySearch").value || "").trim();
      if (q === "") b.classList.toggle("hidden", !matchCat);
    });
    // 抽屉也过滤（v3.0 第7轮：走统一逻辑，带分组标签显隐）
    if ($("drawerSearch")) $("drawerSearch").value = "";
    refreshDrawerFilter();
  }
  // v3.0 第7轮：抽屉内搜索框（只过滤抽屉，不关抽屉）
  (function wireDrawerSearch() {
    const ds = $("drawerSearch");
    if (!ds || ds._wired) return;
    ds._wired = true;
    ds.addEventListener("input", refreshDrawerFilter);
  })();
  // v3.0 第5轮：分类切换 stagger 入场动画
  function animateGrid(grid) {
    if (!grid || typeof grid.children === "undefined") return;
    try {
      const vis = Array.from(grid.children).filter((b) => b.classList && !b.classList.contains("hidden"));
      vis.forEach((b, i) => { if (b.style) b.style.animationDelay = Math.min(i * 18, 270) + "ms"; });
      grid.classList.remove("tile-enter");
      void grid.offsetWidth; // reflow 重启动画
      grid.classList.add("tile-enter");
      clearTimeout(grid._animT);
      grid._animT = setTimeout(() => {
        grid.classList.remove("tile-enter");
        vis.forEach((b) => { if (b.style) b.style.animationDelay = ""; });
      }, 650);
    } catch (e) {}
  }
  const catTabs = $("catTabs");
  if (catTabs) {
    catTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-tab");
      if (!btn) return;
      activeCat = btn.getAttribute("data-cat") || "all";
      catTabs.querySelectorAll(".cat-tab").forEach((t) => {
        const on = t === btn;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      // 切分类时清空搜索
      $("toySearch").value = "";
      const emptyEl = $("searchEmpty");
      if (emptyEl) emptyEl.classList.add("hidden");
      applyCatFilter();
      updatePinnedVisibility(); // v3.0 第5轮：分类过滤时隐藏置顶区
      animateGrid($("homeAllGrid")); // v3.0 第5轮：stagger 入场
      animateGrid($("homePinnedGrid"));
    });
  }

  /* ---------- 15. 数独 ---------- */
  toyInitFns["sudoku"] = function () {
    const SUDOKU_BEST_KEY = "dorm-toybox-sudoku-best-v1";
    function sudokuCandidates(grid, idx) {
      const r = Math.floor(idx / 9), c = idx % 9;
      const used = new Set();
      for (let i = 0; i < 9; i++) { used.add(grid[r * 9 + i]); used.add(grid[i * 9 + c]); }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) used.add(grid[(br + i) * 9 + bc + j]);
      const out = [];
      for (let n = 1; n <= 9; n++) if (!used.has(n)) out.push(n);
      return out;
    }
    function sudokuSolveCount(grid, limit) {
      let best = -1, bestCands = null;
      for (let i = 0; i < 81; i++) {
        if (grid[i] === 0) {
          const cs = sudokuCandidates(grid, i);
          if (cs.length === 0) return 0;
          if (bestCands === null || cs.length < bestCands.length) { best = i; bestCands = cs; if (cs.length === 1) break; }
        }
      }
      if (best === -1) return 1;
      let count = 0;
      for (const n of bestCands) {
        grid[best] = n;
        count += sudokuSolveCount(grid, limit);
        grid[best] = 0;
        if (count >= limit) return count;
      }
      return count;
    }
    function sudokuFullGrid() {
      const grid = new Array(81).fill(0);
      function fill() {
        let best = -1, bestCands = null;
        for (let i = 0; i < 81; i++) {
          if (grid[i] === 0) {
            const cs = shuffle(sudokuCandidates(grid, i));
            if (cs.length === 0) return false;
            if (bestCands === null || cs.length < bestCands.length) { best = i; bestCands = cs; if (cs.length === 1) break; }
          }
        }
        if (best === -1) return true;
        for (const n of bestCands) { grid[best] = n; if (fill()) return true; grid[best] = 0; }
        return false;
      }
      fill();
      return grid;
    }
    function sudokuGenerate() {
      try {
        const solution = sudokuFullGrid();
        const puzzle = solution.slice();
        const order = shuffle(Array.from({ length: 81 }, (_, i) => i));
        let givens = 81;
        for (const idx of order) {
          if (givens <= 30) break;
          const backup = puzzle[idx];
          puzzle[idx] = 0;
          if (sudokuSolveCount(puzzle.slice(), 2) !== 1) puzzle[idx] = backup;
          else givens--;
        }
        return { puzzle, solution };
      } catch (e) { return null; }
    }
    let sudokuPuzzle = [];
    let sudokuSolution = [];
    let sudokuEntries = [];
    let sudokuSelected = -1;
    let sudokuMistakes = 0;
    let sudokuStartAt = null; // v3.0-r15：同记忆翻牌，用 null 做哨兵，不用 0（performance.now() 可为 0）
    let sudokuTimerId = null;
    let sudokuWon = false;
    function loadSudokuBest() {
      try { return parseInt(localStorage.getItem(SUDOKU_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    let sudokuBest = loadSudokuBest();
    function sudokuElapsedSec() { return sudokuStartAt === null ? 0 : (performance.now() - sudokuStartAt) / 1000; }
    function renderSudokuBest() {
      $("sudokuBest").textContent = sudokuBest > 0
        ? "宿舍纪录：" + sudokuBest + " 秒通关"
        : "还没人通关。第一个通关的就是纪录。";
    }
    function renderSudokuStats() {
      const filled = sudokuEntries.filter((n) => n !== 0).length;
      $("sudokuStats").textContent = "已填 " + filled + " 格 · 错 " + sudokuMistakes + " 次 · 用时 " + Math.floor(sudokuElapsedSec()) + " 秒";
    }
    function renderSudokuGrid() {
      const grid = $("sudokuGrid");
      grid.innerHTML = "";
      for (let i = 0; i < 81; i++) {
        const cell = document.createElement("button");
        const given = sudokuPuzzle[i] !== 0;
        cell.className = "sudoku-cell" + (given ? " given" : "") + (i === sudokuSelected ? " selected" : "");
        if (i % 9 === 2 || i % 9 === 5) cell.classList.add("br");
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) cell.classList.add("bb");
        if (!given && sudokuEntries[i] !== 0 && sudokuEntries[i] !== sudokuSolution[i]) cell.classList.add("wrong");
        cell.textContent = given ? String(sudokuPuzzle[i]) : (sudokuEntries[i] !== 0 ? String(sudokuEntries[i]) : "");
        cell.setAttribute("data-idx", String(i));
        if (!given) cell.addEventListener("click", () => sudokuSelect(i));
        grid.appendChild(cell);
      }
    }
    function sudokuSelect(i) {
      if (sudokuWon || sudokuPuzzle[i] !== 0) return;
      sudokuSelected = i;
      renderSudokuGrid();
    }
    function sudokuCheckWin() {
      if (sudokuWon) return;
      for (let i = 0; i < 81; i++) {
        if (sudokuPuzzle[i] === 0 && sudokuEntries[i] !== sudokuSolution[i]) return;
      }
      sudokuWon = true;
      if (sudokuTimerId) { clearInterval(sudokuTimerId); sudokuTimerId = null; }
      SFX.win();
      const seconds = Math.max(Math.round(sudokuElapsedSec()), 1);
      let msg = "🎉 通关！用了 " + seconds + " 秒 · 错 " + sudokuMistakes + " 次。";
      if (sudokuBest === 0 || seconds < sudokuBest) {
        sudokuBest = seconds;
        saveBest(SUDOKU_BEST_KEY, seconds);
        msg += "新纪录！";
      }
      $("sudokuResult").textContent = msg;
      renderSudokuBest();
    }
    function sudokuFill(n) {
      if (sudokuWon || sudokuSelected < 0 || sudokuPuzzle[sudokuSelected] !== 0) return;
      if (sudokuStartAt === null) {
        sudokuStartAt = performance.now();
        sudokuTimerId = setInterval(renderSudokuStats, 1000);
      }
      const i = sudokuSelected;
      sudokuEntries[i] = n;
      if (n !== sudokuSolution[i]) {
        sudokuMistakes++;
        $("sudokuResult").textContent = "这个位置不是 " + n + "，再想想。";
      } else {
        $("sudokuResult").textContent = "对了，继续。";
      }
      renderSudokuGrid();
      renderSudokuStats();
      sudokuCheckWin();
    }
    const sudokuNumPad = $("sudokuNumbers");
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement("button");
      b.className = "sudoku-num";
      b.textContent = String(n);
      b.addEventListener("click", () => sudokuFill(n));
      sudokuNumPad.appendChild(b);
    }
    function sudokuNewGame() {
      const g = sudokuGenerate();
      if (g && g.puzzle && sudokuSolveCount(g.puzzle.slice(), 2) === 1) {
        sudokuPuzzle = g.puzzle; sudokuSolution = g.solution;
      } else {
        sudokuPuzzle = SUDOKU_FALLBACK.puzzle.slice(); sudokuSolution = SUDOKU_FALLBACK.solution.slice();
      }
      sudokuEntries = new Array(81).fill(0);
      sudokuSelected = -1;
      sudokuMistakes = 0;
      sudokuStartAt = null;
      sudokuWon = false;
      if (sudokuTimerId) { clearInterval(sudokuTimerId); sudokuTimerId = null; }
      $("sudokuResult").textContent = "点一个空格开始填。";
      renderSudokuGrid();
      renderSudokuStats();
      renderSudokuBest();
    }
    $("sudokuEraseBtn").addEventListener("click", () => {
      if (sudokuWon || sudokuSelected < 0) return;
      sudokuEntries[sudokuSelected] = 0;
      renderSudokuGrid();
      renderSudokuStats();
    });
    $("sudokuCheckBtn").addEventListener("click", () => {
      let wrong = 0;
      for (let i = 0; i < 81; i++) if (sudokuPuzzle[i] === 0 && sudokuEntries[i] !== 0 && sudokuEntries[i] !== sudokuSolution[i]) wrong++;
      $("sudokuResult").textContent = wrong === 0 ? "目前填的都对，继续。" : "有 " + wrong + " 格填错了，已标红。";
      renderSudokuGrid();
    });
    $("sudokuNewBtn").addEventListener("click", sudokuNewGame);
    sudokuNewGame();
    toyLeaveCleanup.sudoku = () => { if (sudokuTimerId) { clearInterval(sudokuTimerId); sudokuTimerId = null; } };
    toyEnterResume.sudoku = () => { if (sudokuStartAt !== null && !sudokuWon && !sudokuTimerId) sudokuTimerId = setInterval(renderSudokuStats, 1000); };

  };
  /* ---------- 16. 舒尔特方格 ---------- */
  toyInitFns["schulte"] = function () {
    // 退出就停：舒尔特计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    const SCHULTE_BEST_KEY = "dorm-toybox-schulte-best-v1";
    let schulteSize = 5; // 默认 5x5（测试刚性）
    let schulteNext = 1;
    let schulteStartAt = null; // v3.0-r16：用 null 做“未开始”哨兵，不用 0（同 R15 数独/记忆翻牌）
    let schulteTimerId = null;
    let schulteDone = false;
    function schulteKey() { return schulteSize === 5 ? SCHULTE_BEST_KEY : SCHULTE_BEST_KEY + "-" + schulteSize + "x" + schulteSize; }
    function loadSchulteBest() {
      try { return parseFloat(localStorage.getItem(schulteKey()) || "0") || 0; }
      catch (e) { return 0; }
    }
    let schulteBest = loadSchulteBest();
    function renderSchulteBest() {
      $("schulteBest").textContent = schulteBest > 0
        ? "宿舍纪录（" + schulteSize + "×" + schulteSize + "）：" + schulteBest.toFixed(1) + " 秒"
        : "还没人通关。第一个通关的就是纪录。";
    }
    function schulteElapsed() { return schulteStartAt === null ? 0 : (performance.now() - schulteStartAt) / 1000; }
    function renderSchulteStats() { $("schulteStats").textContent = "用时 " + schulteElapsed().toFixed(1) + " 秒"; }
    function schulteSetDiff(n) {
      schulteSize = n;
      schulteBest = loadSchulteBest();
      ["schulte3Btn", "schulte5Btn", "schulte7Btn"].forEach((id) => {
        const b = $(id); if (!b) return;
        const on = id === "schulte" + n + "Btn";
        b.classList.toggle("gold-btn", on);
        b.classList.toggle("ghost-btn", !on);
      });
      schulteNewGame();
    }
    function schulteNewGame() {
      const total = schulteSize * schulteSize;
      const numbers = shuffle(Array.from({ length: total }, (_, i) => i + 1));
      schulteNext = 1;
      schulteStartAt = null;
      schulteDone = false;
      if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; }
      const grid = $("schulteGrid");
      grid.innerHTML = "";
      grid.style.gridTemplateColumns = "repeat(" + schulteSize + ", 1fr)";
      numbers.forEach((n, idx) => {
        const cell = document.createElement("button");
        cell.className = "schulte-cell spawn";
        cell.textContent = String(n);
        cell.setAttribute("data-num", String(n));
        cell.style.animationDelay = Math.min(300, idx * 12) + "ms";
        cell.addEventListener("click", () => schulteTap(cell, n));
        grid.appendChild(cell);
      });
      $("schulteTarget").textContent = "下一个点：1";
      $("schulteResult").textContent = "点 1 开始计时。";
      renderSchulteStats();
      renderSchulteBest();
    }
    function schulteTap(cell, n) {
      if (schulteDone) return;
      const total = schulteSize * schulteSize;
      if (n !== schulteNext) {
        $("schulteResult").textContent = "点错了，要点的是 " + schulteNext + "。";
        // 错误抖动反馈
        cell.classList.remove("shake");
        void cell.offsetWidth;
        cell.classList.add("shake");
        if (typeof SFX !== "undefined") SFX.click();
        return;
      }
      if (schulteStartAt === null) {
        schulteStartAt = performance.now();
        schulteTimerId = setInterval(renderSchulteStats, 100);
      }
      cell.classList.add("done");
      if (typeof SFX !== "undefined") SFX.pop(schulteNext / total);
      schulteNext++;
      if (schulteNext > total) {
        schulteDone = true;
        if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; }
        const seconds = schulteElapsed();
        let msg = "🎉 完成！用时 " + seconds.toFixed(1) + " 秒。";
        if (schulteBest === 0 || seconds < schulteBest) {
          schulteBest = seconds;
          saveBest(schulteKey(), seconds);
          msg += "新纪录！";
        }
        if (typeof SFX !== "undefined") SFX.win();
        $("schulteResult").textContent = msg;
        $("schulteTarget").textContent = "已完成";
        renderSchulteStats();
        renderSchulteBest();
      } else {
        $("schulteTarget").textContent = "下一个点：" + schulteNext;
        $("schulteResult").textContent = "对了，继续点 " + schulteNext + "。";
      }
    }
    $("schulteResetBtn").addEventListener("click", schulteNewGame);
    $("schulte3Btn").addEventListener("click", () => schulteSetDiff(3));
    $("schulte5Btn").addEventListener("click", () => schulteSetDiff(5));
    $("schulte7Btn").addEventListener("click", () => schulteSetDiff(7));
    schulteNewGame();

    // 退出就停：舒尔特计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    toyLeaveCleanup.schulte = () => { if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; } };
    toyEnterResume.schulte = () => { if (schulteStartAt !== null && !schulteDone && !schulteTimerId) schulteTimerId = setInterval(renderSchulteStats, 100); };

  };
  /* ---------- 17. 记分牌 ---------- */
  toyInitFns["score"] = function () {
    const SCORE_KEY = "dorm-toybox-score-v1";
    const SCORE_MAX = 999;
    function loadScore() {
      try {
        const s = JSON.parse(localStorage.getItem(SCORE_KEY) || "null");
        return s && typeof s.a === "number" ? s : { a: 0, b: 0, nameA: "红队", nameB: "蓝队" };
      } catch (e) { return { a: 0, b: 0, nameA: "红队", nameB: "蓝队" }; }
    }
    let score = loadScore();
    function renderScore() {
      $("scoreA").textContent = String(score.a);
      $("scoreB").textContent = String(score.b);
      $("scoreNameA").value = score.nameA;
      $("scoreNameB").value = score.nameB;
      if (score.a >= SCORE_MAX) $("scoreResult").textContent = "🏆 " + score.nameA + " 到顶了！999 分封顶。";
      else if (score.b >= SCORE_MAX) $("scoreResult").textContent = "🏆 " + score.nameB + " 到顶了！999 分封顶。";
      else $("scoreResult").textContent = "没有上限，最高 999 分。";
    }
    function saveScore() {
      try { localStorage.setItem(SCORE_KEY, JSON.stringify(score)); } catch (e) { /* 忽略 */ }
    }
    function scoreAdd(team, n) {
      if (team === "a") score.a = Math.min(SCORE_MAX, score.a + n);
      else score.b = Math.min(SCORE_MAX, score.b + n);
      saveScore();
      renderScore();
    }
    $("scoreA1").addEventListener("click", () => scoreAdd("a", 1));
    $("scoreA2").addEventListener("click", () => scoreAdd("a", 2));
    $("scoreA3").addEventListener("click", () => scoreAdd("a", 3));
    $("scoreB1").addEventListener("click", () => scoreAdd("b", 1));
    $("scoreB2").addEventListener("click", () => scoreAdd("b", 2));
    $("scoreB3").addEventListener("click", () => scoreAdd("b", 3));
    $("scoreNameA").addEventListener("change", () => {
      score.nameA = $("scoreNameA").value.trim() || "红队";
      saveScore();
      renderScore();
    });
    $("scoreNameB").addEventListener("change", () => {
      score.nameB = $("scoreNameB").value.trim() || "蓝队";
      saveScore();
      renderScore();
    });
    $("scoreResetBtn").addEventListener("click", () => {
      score = { a: 0, b: 0, nameA: score.nameA, nameB: score.nameB };
      saveScore();
      renderScore();
    });

    /* ---- 多队伍（2–8 队）：A/B 走原逻辑，C–H 存独立 key ---- */
    const SCORE_EXTRA_KEY = "dorm-toybox-score-extra-v1";
    const TEAM_COLORS = ["#ff5c5c", "#4f7cff", "#3ec6a7", "#f5c542", "#e58cff", "#8bc34a", "#ff9d00", "#7ab8ff"];
    const TEAM_DEFAULT_NAMES = ["红队", "蓝队", "绿队", "黄队", "紫队", "橙队", "粉队", "青队"];
    function loadExtra() {
      try {
        const e = JSON.parse(lsGet(SCORE_EXTRA_KEY, "null"));
        if (e && typeof e.count === "number" && Array.isArray(e.teams)) return e;
      } catch (err) { /* 忽略 */ }
      return { count: 2, teams: [] };
    }
    let scoreExtra = loadExtra();
    function saveExtra() {
      try { lsSet(SCORE_EXTRA_KEY, JSON.stringify(scoreExtra)); } catch (e) { /* 忽略 */ }
    }
    function allTeams() {
      const list = [
        { name: score.nameA, score: score.a, color: TEAM_COLORS[0] },
        { name: score.nameB, score: score.b, color: TEAM_COLORS[1] },
      ];
      scoreExtra.teams.forEach((t, i) => list.push({ name: t.name, score: t.score, color: TEAM_COLORS[i + 2] }));
      return list;
    }
    function renderExtraTeams() {
      const box = $("scoreExtraTeams");
      box.innerHTML = "";
      scoreExtra.teams.forEach((t, i) => {
        const idx = i + 2; // C 起
        const card = document.createElement("div");
        card.className = "team-card";
        const dot = document.createElement("span");
        dot.className = "team-dot";
        dot.style.background = TEAM_COLORS[idx];
        const input = document.createElement("input");
        input.id = "scoreExtra" + idx + "Name";
        input.type = "text";
        input.maxLength = 6;
        input.value = t.name;
        input.setAttribute("aria-label", "队伍" + (idx + 1) + "名字");
        input.addEventListener("change", () => {
          t.name = input.value.trim() || TEAM_DEFAULT_NAMES[idx];
          saveExtra();
        });
        const num = document.createElement("div");
        num.className = "score-num small";
        num.id = "scoreExtra" + idx + "Score";
        num.textContent = String(t.score);
        const btns = document.createElement("div");
        btns.className = "score-btns";
        [1, 2, 3].forEach((n) => {
          const b = document.createElement("button");
          b.className = "btn small";
          b.textContent = "+" + n;
          b.addEventListener("click", () => {
            t.score = Math.min(SCORE_MAX, t.score + n);
            num.textContent = String(t.score);
            saveExtra();
            if (typeof SFX !== "undefined") SFX.pop(0.5);
          });
          btns.appendChild(b);
        });
        card.appendChild(dot);
        card.appendChild(input);
        card.appendChild(num);
        card.appendChild(btns);
        box.appendChild(card);
      });
    }
    const teamCountSel = $("scoreTeamCount");
    if (teamCountSel) {
      teamCountSel.value = String(Math.min(8, Math.max(2, scoreExtra.count)));
      teamCountSel.addEventListener("change", () => {
        const c = Math.min(8, Math.max(2, parseInt(teamCountSel.value, 10) || 2));
        scoreExtra.count = c;
        const need = c - 2;
        while (scoreExtra.teams.length < need) {
          const idx = scoreExtra.teams.length + 2;
          scoreExtra.teams.push({ name: TEAM_DEFAULT_NAMES[idx], score: 0 });
        }
        scoreExtra.teams.length = need;
        saveExtra();
        renderExtraTeams();
      });
    }
    renderExtraTeams();

    /* ---- 比赛计时器 ---- */
    let scoreTimerId = null;
    let scoreTimerLeft = 5 * 60;
    let scoreTimerEndAt = 0; // v3.0-r16：按截止时间算剩余，切后台被节流也不慢（同番茄钟）
    function scoreTimerLeftSec() { return scoreTimerEndAt ? Math.max(0, Math.round((scoreTimerEndAt - performance.now()) / 1000)) : scoreTimerLeft; }
    function renderScoreTimer() {
      const m = Math.floor(scoreTimerLeft / 60);
      const sec = scoreTimerLeft % 60;
      $("scoreTimerDisplay").textContent = (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
    }
    function pauseScoreTimer() {
      if (scoreTimerId) { scoreTimerLeft = scoreTimerLeftSec(); scoreTimerEndAt = 0; clearInterval(scoreTimerId); scoreTimerId = null; }
    }
    const timerStartBtn = $("scoreTimerStartBtn");
    if (timerStartBtn) timerStartBtn.addEventListener("click", () => {
      if (scoreTimerId) return;
      if (typeof SFX !== "undefined") SFX.click();
      if (scoreTimerLeft <= 0) { const mins = Math.min(99, Math.max(1, parseInt($("scoreTimerMin").value, 10) || 5)); scoreTimerLeft = mins * 60; }
      scoreTimerEndAt = performance.now() + scoreTimerLeft * 1000;
      scoreTimerId = setInterval(() => {
        scoreTimerLeft = scoreTimerLeftSec();
        if (scoreTimerLeft <= 0) {
          scoreTimerLeft = 0;
          pauseScoreTimer();
          $("scoreTimerDisplay").textContent = "⏰ 时间到！";
          $("scoreResult").textContent = "⏰ 时间到！点「🏆 结算胜负」看看谁赢了。";
          if (typeof SFX !== "undefined") SFX.lose();
          return;
        }
        renderScoreTimer();
      }, 1000);
    });
    const timerPauseBtn = $("scoreTimerPauseBtn");
    if (timerPauseBtn) timerPauseBtn.addEventListener("click", pauseScoreTimer);
    const timerResetBtn = $("scoreTimerResetBtn");
    if (timerResetBtn) timerResetBtn.addEventListener("click", () => {
      pauseScoreTimer();
      scoreTimerEndAt = 0;
      const mins = Math.min(99, Math.max(1, parseInt($("scoreTimerMin").value, 10) || 5));
      scoreTimerLeft = mins * 60;
      renderScoreTimer();
    });
    renderScoreTimer();
    toyLeaveCleanup.score = pauseScoreTimer;

    /* ---- 结算胜负 ---- */
    const finishBtn = $("scoreFinishBtn");
    if (finishBtn) finishBtn.addEventListener("click", () => {
      const teams = allTeams();
      const max = Math.max.apply(null, teams.map((t) => t.score));
      const winners = teams.filter((t) => t.score === max);
      if (winners.length === teams.length) {
        $("scoreResult").textContent = "🤝 握手言和！所有队伍都是 " + max + " 分。";
      } else if (winners.length === 1) {
        $("scoreResult").textContent = "🏆 " + winners[0].name + " 获胜！" + max + " 分，全场最佳。";
      } else {
        $("scoreResult").textContent = "🤝 平局！" + winners.map((w) => w.name).join("、") + " 同为 " + max + " 分。";
      }
      if (typeof SFX !== "undefined") SFX.win();
    });

    renderScore();

  };
  /* ---------- 18. 手持弹幕 ---------- */
  toyInitFns["led"] = function () {
    const LED_COLORS = ["#ffd94d", "#ff5c5c", "#7dff9b", "#7ab8ff", "#e58cff", "#ffffff"];
    const LED_SPEEDS = [{ label: "慢", dur: "12s" }, { label: "中", dur: "7s" }, { label: "快", dur: "4s" }];
    let ledRunning = false;
    let ledDuration = "7s";
    const ledColorsBox = $("ledColors");
    LED_COLORS.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "led-color" + (i === 0 ? " active" : "");
      b.style.background = c;
      b.setAttribute("data-color", c);
      b.setAttribute("aria-label", "弹幕颜色 " + c);
      b.addEventListener("click", () => {
        $("ledText").style.color = c;
        ledColorsBox.querySelectorAll(".led-color").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        ledSyncFull();
      });
      ledColorsBox.appendChild(b);
    });
    const ledSpeedsBox = $("ledSpeeds");
    LED_SPEEDS.forEach((s, i) => {
      const b = document.createElement("button");
      b.className = "btn small" + (i === 1 ? " gold-btn" : " ghost-btn");
      b.textContent = s.label;
      b.addEventListener("click", () => {
        ledDuration = s.dur;
        $("ledText").style.animationDuration = ledDuration;
        ledSpeedsBox.querySelectorAll("button").forEach((x) => { x.className = "btn small ghost-btn"; });
        b.className = "btn small gold-btn";
        ledSyncFull();
      });
      ledSpeedsBox.appendChild(b);
    });
    // 字号：小 / 中 / 大
    const LED_SIZES = [{ label: "小", px: "64px" }, { label: "中", px: "110px" }, { label: "大", px: "170px" }];
    const ledSizesBox = $("ledSizes");
    if (ledSizesBox) LED_SIZES.forEach((sz, i) => {
      const b = document.createElement("button");
      b.className = "btn small" + (i === 1 ? " gold-btn" : " ghost-btn");
      b.textContent = sz.label;
      b.setAttribute("aria-label", "弹幕字号" + sz.label);
      b.addEventListener("click", () => {
        $("ledText").style.fontSize = sz.px;
        const t2 = $("ledText2");
        if (t2) t2.style.fontSize = sz.px;
        ledSizesBox.querySelectorAll("button").forEach((x) => { x.className = "btn small ghost-btn"; });
        b.className = "btn small gold-btn";
        ledSyncFull();
      });
      ledSizesBox.appendChild(b);
    });
    // 底色：深色系
    const LED_BGS = ["#000000", "#1c1438", "#5c1010", "#0f2e1f", "#1a2e4a"];
    const ledBgsBox = $("ledBgColors");
    if (ledBgsBox) LED_BGS.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "led-color" + (i === 0 ? " active" : "");
      b.style.background = c;
      b.setAttribute("aria-label", "弹幕底色 " + c);
      b.addEventListener("click", () => {
        $("ledDisplay").style.background = c;
        ledBgsBox.querySelectorAll(".led-color").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      ledBgsBox.appendChild(b);
    });
    // 第二行
    const ledInput2 = $("ledInput2");
    if (ledInput2) ledInput2.addEventListener("input", () => {
      const v = ledInput2.value.trim();
      const t2 = $("ledText2");
      if (v) { t2.textContent = v; t2.classList.remove("hidden"); }
      else { t2.classList.add("hidden"); }
      ledSyncFull();
    });
    $("ledText").style.color = LED_COLORS[0];
    $("ledText").style.animationDuration = ledDuration;
    $("ledInput").addEventListener("input", () => {
      $("ledText").textContent = $("ledInput").value.trim() || "我在这里！";
      ledSyncFull();
    });
    $("ledStartBtn").addEventListener("click", () => {
      ledRunning = !ledRunning;
      $("ledText").classList.toggle("scrolling", ledRunning);
      const t2 = $("ledText2");
      if (t2) t2.classList.toggle("scrolling", ledRunning);
      $("ledStartBtn").textContent = ledRunning ? "停下来 ⏸" : "开始滚动 ▶";
      $("ledResult").textContent = ledRunning ? "滚动中，举起手机给大家看。" : "已暂停。";
      if (typeof SFX !== "undefined") SFX.click();
    });

    /* 全屏展示：横屏全黑背景，双击屏幕退出；进全屏前规则已经写在玩法介绍了 */
    function ledSyncFull() {
      $("ledFullText").textContent = $("ledText").textContent;
      $("ledFullText").style.color = $("ledText").style.color || LED_COLORS[0];
      $("ledFullText").style.animationDuration = ledDuration;
      $("ledFullText").style.fontSize = $("ledText").style.fontSize || "";
      const t2 = $("ledText2");
      const f2 = $("ledFullText2");
      if (t2 && f2) {
        const v = t2.classList.contains("hidden") ? "" : t2.textContent;
        if (v) {
          f2.textContent = v;
          f2.classList.remove("hidden");
          f2.style.color = $("ledFullText").style.color;
          f2.style.fontSize = $("ledFullText").style.fontSize;
          f2.style.animationDuration = ledDuration;
        } else {
          f2.classList.add("hidden");
        }
      }
    }
    function ledOpenFull() {
      ledSyncFull();
      $("ledOverlay").classList.remove("hidden");
      $("ledFullText").classList.add("scrolling");
      const f2 = $("ledFullText2");
      if (f2 && !f2.classList.contains("hidden")) f2.classList.add("scrolling");
      try {
        const p = screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape");
        if (p && p.catch) p.catch(() => { /* 不支持自动转横屏，用户手动横过来也一样 */ });
      } catch (e) { /* 忽略 */ }
    }
    function ledCloseFull() {
      $("ledOverlay").classList.add("hidden");
      $("ledFullText").classList.remove("scrolling");
      const f2 = $("ledFullText2");
      if (f2) f2.classList.remove("scrolling");
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* 忽略 */ }
    }
    $("ledFullBtn").addEventListener("click", ledOpenFull);
    $("ledOverlay").addEventListener("dblclick", ledCloseFull);

    toyLeaveCleanup.led = ledCloseFull; // v1.30：懒初始化后 leaveToy 里的 typeof 判断失效，改走注册表
  };
  /* ---------- 19. 人生小格 ---------- */
  toyInitFns["life"] = function () {
    const LIFE_TOTAL_MONTHS = 80 * 12;
    function lifeRender() {
      const y = parseInt($("lifeYear").value, 10);
      const m = parseInt($("lifeMonth").value, 10);
      if (isNaN(y) || isNaN(m) || m < 1 || m > 12 || y < 1900 || y > 2100) {
        $("lifeStats").textContent = "先填出生年月，比如 2005 年 9 月。";
        return;
      }
      const now = new Date();
      const lived = Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
      const remaining = Math.max(0, LIFE_TOTAL_MONTHS - lived);
      const grid = $("lifeGrid");
      grid.innerHTML = "";
      for (let i = 0; i < LIFE_TOTAL_MONTHS; i++) {
        const cell = document.createElement("div");
        cell.className = "life-cell" + (i < lived ? " lived" : "");
        cell.setAttribute("data-idx", String(i));
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", "第 " + (i + 1) + " 个月");
        // 填充动画：已过的格子 staggered 亮起
        if (i < lived) cell.style.transitionDelay = Math.min(1200, i * 2) + "ms";
        cell.addEventListener("click", () => {
          try {
            const cells = grid.children || [];
            for (let k = 0; k < cells.length; k++) cells[k].classList.remove("peek");
            cell.classList.add("peek");
            const atAge = Math.floor(i / 12), atMon = i % 12;
            $("lifeStats").textContent = "第 " + (i + 1) + " 个月：你 " + atAge + " 岁" + (atMon ? " " + atMon + " 个月" : "") + (i < lived ? "（已经过了）" : "（还没到）") + "。";
            if (typeof SFX !== "undefined") SFX.click();
          } catch (e) { /* 测试桩忽略 */ }
        });
        grid.appendChild(cell);
      }
      const pct = Math.round((lived / LIFE_TOTAL_MONTHS) * 100);
      $("lifeStats").textContent = "你已经过了 " + lived + " 个月（" + pct + "%），还剩 " + remaining + " 个月。金色的是已经过的，点任意格子看看那时的你。";
    }
    $("lifeGenBtn").addEventListener("click", lifeRender);

  };
  /* ---------- 21. 极简记账 ---------- */
  /* ---------- 20. 宿舍账本（记账 + AA）---------- */
  /* v1.31：ledger/aa 合并为「宿舍账本」，两个 tab。aa 入口经 showToy 重定向到此。 */
  toyInitFns["ledger"] = function () {
    /* ----- Tab 切换 ----- */
    const ltabBtns = $("ledgerTabBar").querySelectorAll(".toolbox-tab");
    const lpanels = { ledger: $("ledgerTabLedger"), aa: $("ledgerTabAa") };
    function switchLedgerTab(name) {
      ltabBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-ltab") === name));
      Object.keys(lpanels).forEach((k) => lpanels[k].classList.toggle("hidden", k !== name));
    }
    ltabBtns.forEach((b) => b.addEventListener("click", () => switchLedgerTab(b.getAttribute("data-ltab"))));
    const ldefTab = window._toolboxDefaultTab;
    window._toolboxDefaultTab = null;
    if (ldefTab && lpanels[ldefTab]) switchLedgerTab(ldefTab);

    /* ----- 记账（原有逻辑 + 分类图标 + 饼图） ----- */

    const LEDGER_KEY = "dorm-toybox-ledger-v1";
    let ledgerType = "out";
    function loadLedger() {
      try {
        const s = JSON.parse(localStorage.getItem(LEDGER_KEY) || "null");
        return Array.isArray(s) ? s : [];
      } catch (e) { return []; }
    }
    let ledger = loadLedger();
    function saveLedger() {
      try { localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); } catch (e) { /* 忽略 */ }
    }
    function renderLedger() {
      const box = $("ledgerList");
      box.innerHTML = "";
      let income = 0, expense = 0;
      ledger.forEach((e) => { if (e.type === "in") income += e.amount; else expense += e.amount; });
      ledger.forEach((e, i) => {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = (e.type === "in" ? "＋" : "－") + e.amount + " 元 · " + (e.note || "没写备注");
        const del = document.createElement("button");
        del.className = "ledger-del";
        del.textContent = "删";
        del.addEventListener("click", () => { ledger.splice(i, 1); saveLedger(); renderLedger(); });
        li.appendChild(label);
        li.appendChild(del);
        box.appendChild(li);
      });
      $("ledgerTotals").textContent = ledger.length === 0
        ? "还没记过账。"
        : "收入 " + income + " 元 · 支出 " + expense + " 元 · 结余 " + (income - expense) + " 元";
      $("ledgerInBtn").classList.toggle("gold-btn", ledgerType === "in");
      $("ledgerInBtn").classList.toggle("ghost-btn", ledgerType !== "in");
      $("ledgerOutBtn").classList.toggle("gold-btn", ledgerType === "out");
      $("ledgerOutBtn").classList.toggle("ghost-btn", ledgerType !== "out");
    }
    $("ledgerInBtn").addEventListener("click", () => { ledgerType = "in"; renderLedger(); });
    $("ledgerOutBtn").addEventListener("click", () => { ledgerType = "out"; renderLedger(); });
    $("ledgerAddBtn").addEventListener("click", () => {
      const amount = parseFloat($("ledgerAmount").value);
      if (isNaN(amount) || amount <= 0) {
        $("ledgerTotals").textContent = "先填个大于 0 的金额。";
        return;
      }
      ledger.unshift({ type: ledgerType, amount: Math.round(amount * 100) / 100, note: $("ledgerNote").value.trim(), time: Date.now() });
      $("ledgerAmount").value = "";
      $("ledgerNote").value = "";
      saveLedger();
      renderLedger();
    });
    $("ledgerClearBtn").addEventListener("click", () => { ledger = []; saveLedger(); renderLedger(); });
    renderLedger();



    /* ----- AA 分摊（原有逻辑 + 一键复制） ----- */

    function aaParseNames() {
      return $("aaNames").value.split("\n").map((s) => s.trim()).filter(Boolean);
    }
    function aaRefreshPayer() {
      const names = aaParseNames();
      const cur = $("aaPayer").value;
      const sel = $("aaPayer");
      sel.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = ""; opt0.textContent = "没人垫付，只算人均";
      sel.appendChild(opt0);
      names.forEach((n) => {
        const o = document.createElement("option");
        o.value = n; o.textContent = n + " 先垫付了";
        sel.appendChild(o);
      });
      if (names.indexOf(cur) !== -1) sel.value = cur;
    }
    $("aaNames").addEventListener("input", aaRefreshPayer);
    $("aaCalcBtn").addEventListener("click", () => {
      const total = Math.round(parseFloat($("aaTotal").value || "0") * 100);
      const names = aaParseNames();
      if (!(total > 0)) { $("aaResult").textContent = "先填总金额（要大于 0）。"; return; }
      if (names.length < 2) { $("aaResult").textContent = "至少写 2 个人才能分摊。"; return; }
      aaRefreshPayer();
      // 分到分：先每人取整，剩下的几分钱按顺序分给前面的人，总数一分不差
      const base = Math.floor(total / names.length);
      let rest = total - base * names.length;
      const shares = names.map(() => { const s = base + (rest > 0 ? 1 : 0); if (rest > 0) rest--; return s; });
      const fmt = (cents) => "¥" + (cents / 100).toFixed(2);
      const box = $("aaResult");
      box.innerHTML = "";
      const head = document.createElement("p");
      head.className = "result-line";
      head.textContent = "总额 " + fmt(total) + " · " + names.length + " 人 · 人均 " + fmt(Math.round(total / names.length));
      box.appendChild(head);
      names.forEach((n, i) => {
        const line = document.createElement("div");
        line.className = "aa-line";
        line.textContent = n + " 出 " + fmt(shares[i]);
        box.appendChild(line);
      });
      const payer = $("aaPayer").value;
      if (payer && names.indexOf(payer) !== -1) {
        const title = document.createElement("p");
        title.className = "result-line";
        title.textContent = "💸 结算：" + payer + " 先垫了全款，每人把自己那份转给他：";
        box.appendChild(title);
        names.forEach((n, i) => {
          if (n === payer) return;
          const line = document.createElement("div");
          line.className = "aa-line";
          line.textContent = n + " → " + payer + " " + fmt(shares[i]);
          box.appendChild(line);
        });
      }
    });

    // v1.31：一键复制结算文本
    const aaCopyBtn = $("aaCopyBtn");
    if (aaCopyBtn) {
      aaCopyBtn.addEventListener("click", () => {
        const text = $("aaResult").textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            aaCopyBtn.textContent = "已复制 ✓";
            setTimeout(() => aaCopyBtn.textContent = "复制结算文本 📋", 1500);
          });
        }
      });
      // 当有结果时显示复制按钮（hook 原计算按钮）
      const _aaCalcBtn = $("aaCalcBtn");
      if (_aaCalcBtn) {
        _aaCalcBtn.addEventListener("click", () => {
          setTimeout(() => {
            if ($("aaResult").textContent.trim()) aaCopyBtn.classList.remove("hidden");
          }, 0);
        });
      }
    }

  };
  /* ---------- 22. 拼豆图纸生成 ---------- */
  toyInitFns["beads"] = function () {
    // 每种颜色一个符号，写在豆子中间的白孔里：颜色再像，符号也不会认错（I、O 容易和 1、0 搞混，跳过）
    const BEAD_SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "2", "3", "4", "5", "6", "7", "8", "9", "●", "▲", "■", "◆", "★", "✚"];
    let beadsCols = 0, beadsRows = 0, beadsCells = [];
    let beadsCellPx = 22;
    let beadsFocusN = null; // 正在单独拼的色号，null = 全部显示
    let beadsLastPixels = null, beadsLastCols = 0, beadsLastRows = 0;
    let beadsLastImage = null; // 传过的原图：换格数时直接拿它重算，不用重新选图
    let beadsShowingPhoto = false; // 当前图纸是不是照片算出来的（示例爱心是固定 16 格，不跟格数走）
    let beadsSymbols = {}; // 色号 -> 符号
    let beadsLegendItems = []; // { n, el }
    function beadRingBg(hex) {
      // 孔是白色的（像穿在白色拼板上），不是透出黑底：颜色才看得清
      return "radial-gradient(circle, #ffffff 0 30%, " + hex + " 31% 100%)";
    }
    function beadDist(hex1, hex2) {
      const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
      const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
      return (r1 - r2) * (r1 - r2) * 0.3 + (g1 - g2) * (g1 - g2) * 0.59 + (b1 - b2) * (b1 - b2) * 0.11;
    }
    function beadsApplyCellSize() {
      const grid = $("beadsGrid");
      if (beadsCols > 0) grid.style.gridTemplateColumns = "repeat(" + beadsCols + ", " + beadsCellPx + "px)";
      // 注意：children 是 HTMLCollection，没有 forEach，用下标循环
      for (let i = 0; i < grid.children.length; i++) {
        const s = grid.children[i].children[0];
        if (s) s.style.fontSize = Math.round(beadsCellPx * 0.5) + "px";
      }
      $("beadsZoomLabel").textContent = "每颗 " + beadsCellPx + "px，左右滑着看";
    }
    function beadsApplyFocus() {
      // 只亮正在拼的那种色，其他的变暗：再复杂的图，一次也只要找一种豆
      const grid = $("beadsGrid");
      for (let i = 0; i < grid.children.length; i++) {
        grid.children[i].classList.toggle("dim", beadsFocusN !== null && beadsCells[i].n !== beadsFocusN);
      }
      beadsLegendItems.forEach(({ n, el }) => el.classList.toggle("active", beadsFocusN !== null && n === beadsFocusN));
      $("beadsShowAllBtn").classList.toggle("hidden", beadsFocusN === null);
    }
    function beadNearest(hex) {
      let best = BEAD_COLORS[0], bestD = Infinity;
      BEAD_COLORS.forEach((c) => {
        const d = beadDist(hex, c.hex);
        if (d < bestD) { bestD = d; best = c; }
      });
      return best;
    }
    function beadsRender(pixels, cols, rows) {
      beadsCols = cols; beadsRows = rows;
      beadsLastPixels = pixels; beadsLastCols = cols; beadsLastRows = rows;
      beadsCells = pixels.map((hex) => beadNearest(hex));
      // 颜色太多就合并：留用得最多的 N 种，少的并进最近的保留色（默认 12 色，复杂图也拼得动）
      const maxColors = parseInt($("beadsMaxColors").value, 10) || 0;
      if (maxColors > 0) {
        const counts = {};
        beadsCells.forEach((b) => { counts[b.n] = (counts[b.n] || 0) + 1; });
        const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        if (ranked.length > maxColors) {
          const keep = ranked.slice(0, maxColors).map((n) => beadsCells.find((b) => b.n === n));
          const remap = {};
          ranked.slice(maxColors).forEach((n) => {
            const src = beadsCells.find((b) => b.n === n);
            let best = keep[0], bestD = Infinity;
            keep.forEach((k) => { const d = beadDist(src.hex, k.hex); if (d < bestD) { bestD = d; best = k; } });
            remap[n] = best;
          });
          beadsCells = beadsCells.map((b) => remap[b.n] || b);
        }
      }
      // 每种颜色一个符号，按用量从多到少排：A 给用得最多的色
      const counts = {};
      const order = [];
      beadsCells.forEach((bead) => {
        if (!counts[bead.n]) { counts[bead.n] = { bead, count: 0 }; order.push(bead.n); }
        counts[bead.n].count++;
      });
      const used = order.map((n) => counts[n]).sort((a, b) => b.count - a.count);
      beadsSymbols = {};
      used.forEach(({ bead }, i) => { beadsSymbols[bead.n] = BEAD_SYMBOLS[i] || ("#" + (i + 1)); });
      const grid = $("beadsGrid");
      grid.innerHTML = "";
      beadsApplyCellSize();
      beadsCells.forEach((bead, i) => {
        const cell = document.createElement("div");
        cell.className = "beads-cell";
        cell.style.background = beadRingBg(bead.hex);
        cell.title = beadsSymbols[bead.n] + " " + bead.n + " " + bead.name;
        const sym = document.createElement("span");
        sym.className = "beads-symbol";
        sym.textContent = beadsSymbols[bead.n];
        sym.style.fontSize = Math.round(beadsCellPx * 0.5) + "px";
        cell.appendChild(sym);
        cell.addEventListener("click", () => {
          beadsFocusN = bead.n;
          beadsApplyFocus();
          const row = Math.floor(i / beadsCols) + 1, col = (i % beadsCols) + 1;
          $("beadsResult").textContent = "第 " + row + " 行第 " + col + " 列 · " + beadsSymbols[bead.n] + " " + bead.n + " " + bead.name + "，这种色共 " + counts[bead.n].count + " 颗，其他颜色已变暗，拼完点「显示全部颜色」换下一个。";
        });
        grid.appendChild(cell);
      });
      const legend = $("beadsLegend");
      legend.innerHTML = "";
      beadsLegendItems = [];
      used.forEach(({ bead, count }) => {
        const item = document.createElement("div");
        item.className = "beads-legend-item";
        item.setAttribute("data-n", bead.n);
        const sw = document.createElement("span");
        sw.className = "beads-swatch";
        sw.style.background = beadRingBg(bead.hex);
        const symTag = document.createElement("span");
        symTag.className = "beads-symtag";
        symTag.textContent = beadsSymbols[bead.n];
        const label = document.createElement("span");
        label.textContent = bead.n + " " + bead.name + " × " + count + " 颗";
        item.appendChild(sw);
        item.appendChild(symTag);
        item.appendChild(label);
        item.addEventListener("click", () => {
          beadsFocusN = beadsFocusN === bead.n ? null : bead.n;
          beadsApplyFocus();
          $("beadsResult").textContent = beadsFocusN === null
            ? "点图例里的颜色，只亮这一种，照着拼；点一颗豆子看它是哪种色、第几行第几列。"
            : "正在拼：" + beadsSymbols[bead.n] + " " + bead.n + " " + bead.name + "，共 " + count + " 颗，其他颜色已变暗，拼完点「显示全部颜色」换下一个。";
        });
        legend.appendChild(item);
        beadsLegendItems.push({ n: bead.n, el: item });
      });
      beadsFocusN = null;
      beadsApplyFocus();
      $("beadsStats").textContent = "共 " + pixels.length + " 颗 · 用了 " + used.length + " 种颜色 · 按 Hama Midi 5mm 色号匹配";
      $("beadsResult").textContent = "点图例里的颜色，只亮这一种，照着拼；点一颗豆子看它是哪种色、第几行第几列。";
    }
    function beadsFromImage(img) {
      try {
        const size = parseInt($("beadsSize").value, 10) || 48;
        const targetH = Math.max(1, Math.round((size * img.height) / img.width));
        // 分步缩：大图一次缩到底会丢细节、糊成一片；先对半缩到接近目标再定格，轮廓和五官保留得多
        let src = img, w = img.width, h = img.height;
        while (w / 2 > size && h / 2 > targetH) {
          w = Math.floor(w / 2); h = Math.floor(h / 2);
          const step = document.createElement("canvas");
          step.width = w; step.height = h;
          const sctx = step.getContext("2d");
          if (!sctx) { $("beadsResult").textContent = "当前环境不支持作图。"; return; }
          sctx.drawImage(src, 0, 0, w, h);
          src = step;
        }
        const canvas = document.createElement("canvas");
        if (typeof canvas.getContext !== "function") { $("beadsResult").textContent = "当前环境不支持作图。"; return; }
        canvas.width = size;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) { $("beadsResult").textContent = "当前环境不支持作图。"; return; }
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          const r = Math.round(data[i] * a + 255 * (1 - a));
          const g = Math.round(data[i + 1] * a + 255 * (1 - a));
          const b = Math.round(data[i + 2] * a + 255 * (1 - a));
          pixels.push("#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
        }
        beadsRender(pixels, canvas.width, canvas.height);
        beadsLastImage = img;
        beadsShowingPhoto = true;
      } catch (e) { $("beadsResult").textContent = "这张图处理失败，换一张试试。"; }
    }
    function beadsFromFile(file) {
      if (typeof FileReader === "undefined") { $("beadsResult").textContent = "当前环境不支持读图。"; return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => { beadsFromImage(img); };
        img.onerror = () => { $("beadsResult").textContent = "这张图读不出来，换一张试试。"; };
        img.src = reader.result;
      };
      reader.onerror = () => { $("beadsResult").textContent = "读图失败，换一张试试。"; };
      reader.readAsDataURL(file);
    }
    $("beadsFile").addEventListener("change", () => {
      const file = $("beadsFile").files && $("beadsFile").files[0];
      if (file) beadsFromFile(file);
    });
    $("beadsSampleBtn").addEventListener("click", () => {
      const charHex = { ".": "#E5ECF1", R: "#B4060E", P: "#EA8AA5" };
      const pixels = [];
      BEADS_SAMPLE.forEach((row) => { for (const ch of row) pixels.push(charHex[ch] || "#E5ECF1"); });
      beadsShowingPhoto = false;
      beadsRender(pixels, 16, 16);
    });
    $("beadsSize").addEventListener("change", () => {
      // 换格数（清晰度）图纸马上重算：拿存着的原图按新格数重缩，不用重新选图
      if (beadsLastImage && beadsShowingPhoto) beadsFromImage(beadsLastImage);
    });
    $("beadsMaxColors").addEventListener("change", () => {
      // 换颜色数上限就按原图重算：少的色并进最近的保留色，图例和符号跟着变
      if (beadsLastPixels) beadsRender(beadsLastPixels, beadsLastCols, beadsLastRows);
    });
    $("beadsShowAllBtn").addEventListener("click", () => {
      beadsFocusN = null;
      beadsApplyFocus();
      $("beadsResult").textContent = "点图例里的颜色，只亮这一种，照着拼；点一颗豆子看它是哪种色、第几行第几列。";
    });
    $("beadsZoomInBtn").addEventListener("click", () => {
      beadsCellPx = Math.min(40, beadsCellPx + 6);
      beadsApplyCellSize();
    });
    $("beadsZoomOutBtn").addEventListener("click", () => {
      beadsCellPx = Math.max(14, beadsCellPx - 6);
      beadsApplyCellSize();
    });
    $("beadsExportBtn").addEventListener("click", () => {
      if (!beadsCells.length) { $("beadsResult").textContent = "先传图或点示例，生成图纸再导出。"; return; }
      try {
        // 高清导出：勾选后每颗 96px（2x），打印更清晰；默认 48px
        const hd = $("beadsHdExport") && $("beadsHdExport").checked;
        const cell = hd ? 96 : 48, margin = hd ? 60 : 40;
        const canvas = document.createElement("canvas");
        if (typeof canvas.getContext !== "function" || typeof canvas.toDataURL !== "function") { $("beadsResult").textContent = "当前环境不支持导出。"; return; }
        canvas.width = beadsCols * cell + margin;
        canvas.height = beadsRows * cell + margin;
        const ctx = canvas.getContext("2d");
        if (!ctx) { $("beadsResult").textContent = "当前环境不支持导出。"; return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // 行列号：每 5 格在图边上标一个，对着纸图也能找到第几行第几列
        ctx.fillStyle = "#666666";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let c = 0; c < beadsCols; c += 5) ctx.fillText(String(c + 1), margin + c * cell + cell / 2, margin / 2);
        for (let r = 0; r < beadsRows; r += 5) ctx.fillText(String(r + 1), margin / 2, margin + r * cell + cell / 2);
        beadsCells.forEach((bead, i) => {
          const x = margin + (i % beadsCols) * cell, y = margin + Math.floor(i / beadsCols) * cell;
          const cx = x + cell / 2, cy = y + cell / 2, r = cell / 2 - 2;
          ctx.fillStyle = bead.hex;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff"; // 豆子中间的孔（比屏幕上的大，字母全落在白底上）
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
          ctx.fill();
          // 符号：先描一圈白边，再写深色字——白边把字母和彩色环隔开，字母伸到颜色上也不糊
          ctx.font = "bold " + Math.round(cell * 0.5) + "px sans-serif";
          ctx.lineWidth = Math.round(cell * 0.12);
          ctx.strokeStyle = "#ffffff";
          ctx.strokeText(beadsSymbols[bead.n], cx, cy + 1);
          ctx.fillStyle = "#222222";
          ctx.fillText(beadsSymbols[bead.n], cx, cy + 1);
        });
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = "拼豆图纸.png";
        a.click();
        $("beadsResult").textContent = hd ? "高清图纸已导出（2x），打印更清晰。" : "图纸已导出为图片，照着拼就行。";
      } catch (e) { $("beadsResult").textContent = "导出失败，换个浏览器试试。"; }
    });

  };
  /* ---------- 23. 亲戚计算器 ---------- */
  /* ---------- 23. 实用计算器（亲戚 + 汇率 + BMI）---------- */
  /* v1.31：kin/fx/bmi 合并为「实用计算器」，三个 tab。fx/bmi 入口经 showToy 重定向到此。 */
  toyInitFns["kin"] = function () {
    /* ----- Tab 切换（v1.30 HTML 无 calcTabBar 时跳过，兼容旧版） ----- */
    const calcTabBarEl = $("calcTabBar");
    if (calcTabBarEl) {
      const ctabBtns = calcTabBarEl.querySelectorAll(".toolbox-tab");
      const cpanels = { kin: $("calcTabKin"), fx: $("calcTabFx"), bmi: $("calcTabBmi") };
      function switchCalcTab(name) {
        ctabBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-ctab") === name));
        Object.keys(cpanels).forEach((k) => { if (cpanels[k]) cpanels[k].classList.toggle("hidden", k !== name); });
      }
      ctabBtns.forEach((b) => b.addEventListener("click", () => switchCalcTab(b.getAttribute("data-ctab"))));
      const cdefTab = window._toolboxDefaultTab;
      window._toolboxDefaultTab = null;
      if (cdefTab && cpanels[cdefTab]) switchCalcTab(cdefTab);
    }

    /* ----- 亲戚计算器（原有逻辑） ----- */

    const KIN_RELATIONS = [
      { key: "爸", label: "爸爸" }, { key: "妈", label: "妈妈" },
      { key: "哥", label: "哥哥" }, { key: "弟", label: "弟弟" },
      { key: "姐", label: "姐姐" }, { key: "妹", label: "妹妹" },
      { key: "儿", label: "儿子" }, { key: "女", label: "女儿" },
      { key: "夫", label: "丈夫" }, { key: "妻", label: "妻子" },
    ];
    let kinChain = [];
    function kinCurrentKey() {
      let cur = "我";
      for (const r of kinChain) {
        const next = KIN_PAIRS[cur + "," + r];
        if (!next) return null;
        cur = next;
      }
      return cur;
    }
    function renderKin() {
      $("kinChain").textContent = kinChain.length === 0 ? "我" : "我的" + kinChain.map((k) => KIN_NAMES[k]).join("的");
      const cur = kinCurrentKey();
      $("kinResult").textContent = kinChain.length === 0
        ? "点下面的关系，算算他该叫什么。"
        : (cur ? "应该叫：" + KIN_NAMES[cur] : "这个关系有点绕，算不出来，换个问法试试。");
    }
    KIN_RELATIONS.forEach((rel) => {
      const b = document.createElement("button");
      b.className = "btn small ghost-btn";
      b.textContent = rel.label;
      b.addEventListener("click", () => {
        if (kinChain.length >= 4) { $("kinResult").textContent = "最多算 4 层关系，点清除重来。"; return; }
        kinChain.push(rel.key);
        renderKin();
      });
      $("kinButtons").appendChild(b);
    });
    [["爸爸的妈妈", ["爸", "妈"]], ["妈妈的爸爸", ["妈", "爸"]], ["爸爸的哥哥", ["爸", "哥"]], ["姐姐的儿子", ["姐", "儿"]]].forEach(([label, chain]) => {
      const b = document.createElement("button");
      b.className = "btn small ghost-btn";
      b.textContent = label;
      b.addEventListener("click", () => { kinChain = chain.slice(); renderKin(); });
      $("kinPresets").appendChild(b);
    });
    $("kinClearBtn").addEventListener("click", () => { kinChain = []; renderKin(); });
    renderKin();


    /* ----- 汇率（原有逻辑） ----- */

    const FX_KEY = "dorm-toybox-fx-v1";
    let fxRates = FX_FALLBACK.rates;
    let fxDate = FX_FALLBACK.date;
    let fxLive = false;
    function fxToday() {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function fxRender() {
      const amount = parseFloat($("fxAmount").value);
      const from = $("fxFrom").value, to = $("fxTo").value;
      if (isNaN(amount)) { $("fxResult").textContent = "先填个金额。"; return; }
      const cny = amount / fxRates[from];
      const out = cny * fxRates[to];
      $("fxResult").textContent = amount + " " + from + " ≈ " + out.toFixed(2) + " " + to;
      $("fxMeta").textContent = (fxLive ? "实时汇率" : "离线参考汇率") + " · 更新于 " + fxDate + "（每天更新一次）";
    }
    function fxFetch() {
      if (typeof fetch !== "function") return;
      fetch("https://open.er-api.com/v6/latest/CNY").then((r) => r.json()).then((data) => {
        if (!data || !data.rates) return;
        fxRates = Object.assign({}, FX_FALLBACK.rates, data.rates);
        fxDate = fxToday();
        fxLive = true;
        try { localStorage.setItem(FX_KEY, JSON.stringify({ date: fxDate, rates: fxRates })); } catch (e) { /* 忽略 */ }
        fxRender();
      }).catch(() => { /* 离线用备用汇率 */ });
    }
    function fxLoadCache() {
      try {
        const s = JSON.parse(localStorage.getItem(FX_KEY) || "null");
        if (s && s.date === fxToday() && s.rates) { fxRates = s.rates; fxDate = s.date; fxLive = true; return true; }
      } catch (e) { /* 忽略 */ }
      return false;
    }
    FX_CURRENCIES.forEach(([code, label]) => {
      const o1 = document.createElement("option"); o1.value = code; o1.textContent = label;
      const o2 = document.createElement("option"); o2.value = code; o2.textContent = label;
      $("fxFrom").appendChild(o1); $("fxTo").appendChild(o2);
    });
    $("fxFrom").value = "CNY"; $("fxTo").value = "USD";
    $("fxAmount").addEventListener("input", fxRender);
    $("fxFrom").addEventListener("change", fxRender);
    $("fxTo").addEventListener("change", fxRender);
    $("fxSwapBtn").addEventListener("click", () => {
      const f = $("fxFrom").value; $("fxFrom").value = $("fxTo").value; $("fxTo").value = f; fxRender();
    });
    $("fxRefreshBtn").addEventListener("click", () => {
      if (typeof fetch !== "function") { $("fxMeta").textContent = "当前环境不支持联网更新，用离线参考汇率。"; return; }
      $("fxMeta").textContent = "正在更新汇率……";
      fxFetch();
    });
    if (!fxLoadCache()) fxFetch();
    fxRender();


    /* ----- BMI（原有逻辑 + 滑杆 + 仪表盘） ----- */

    $("bmiCalcBtn").addEventListener("click", () => {
      const h = parseFloat($("bmiHeight").value);
      const w = parseFloat($("bmiWeight").value);
      if (isNaN(h) || isNaN(w) || h < 100 || h > 250 || w < 20 || w > 300) {
        $("bmiResult").textContent = "先填对身高（100–250 厘米）和体重（20–300 公斤）。";
        $("bmiAdvice").textContent = "";
        return;
      }
      const m = h / 100;
      const bmi = w / (m * m);
      const low = (18.5 * m * m).toFixed(1), high = (24 * m * m).toFixed(1);
      let cat = "", advice = "";
      if (bmi < 18.5) { cat = "偏瘦"; advice = "可以多吃点，增肌比增肥靠谱。"; }
      else if (bmi < 24) { cat = "正常"; advice = "保持住，这个范围挺好的。"; }
      else if (bmi < 28) { cat = "偏胖"; advice = "少喝点奶茶，多走走就下来了。"; }
      else { cat = "肥胖"; advice = "别节食硬扛，管住嘴 + 多动，慢慢来。"; }
      $("bmiResult").textContent = "BMI " + bmi.toFixed(1) + " · " + cat;
      $("bmiAdvice").textContent = "你这个身高的健康体重是 " + low + "–" + high + " 公斤。" + advice;
    });
    // v1.31：滑杆实时计算
    function bmiSyncFromSliders() {
      const h = parseFloat($("bmiHeightSlider").value);
      const w = parseFloat($("bmiWeightSlider").value);
      $("bmiHeightVal").textContent = h;
      $("bmiWeightVal").textContent = w;
      // 同步到隐藏的输入框（测试用）
      $("bmiHeight").value = h;
      $("bmiWeight").value = w;
      bmiCalculate(h, w);
    }
    function bmiCalculate(h, w) {
      if (isNaN(h) || isNaN(w) || h < 100 || h > 250 || w < 20 || w > 300) {
        $("bmiResult").textContent = "先填对身高（100–250 厘米）和体重（20–300 公斤）。";
        $("bmiAdvice").textContent = "";
        drawBmiGauge(0);
        return;
      }
      const m = h / 100;
      const bmi = w / (m * m);
      const low = (18.5 * m * m).toFixed(1), high = (24 * m * m).toFixed(1);
      let cat = "", advice = "";
      if (bmi < 18.5) { cat = "偏瘦"; advice = "可以多吃点，增肌比增肥靠谱。"; }
      else if (bmi < 24) { cat = "正常"; advice = "保持住，这个范围挺好的。"; }
      else if (bmi < 28) { cat = "偏胖"; advice = "少喝点奶茶，多走走就下来了。"; }
      else { cat = "肥胖"; advice = "别节食硬扛，管住嘴 + 多动，慢慢来。"; }
      $("bmiResult").textContent = "BMI " + bmi.toFixed(1) + " · " + cat;
      $("bmiAdvice").textContent = "你这个身高的健康体重是 " + low + "–" + high + " 公斤。" + advice;
      drawBmiGauge(bmi);
    }
    function drawBmiGauge(bmi) {
      const cv = $("bmiGauge");
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const W = 260, H = 140, cx = 130, cy = 120, r = 95;
      ctx.clearRect(0, 0, W, H);
      // 背景弧（180度）
      const segments = [
        { from: 0, to: 18.5, color: "#4a9eff" },   // 偏瘦 蓝
        { from: 18.5, to: 24, color: "#3ec6a7" },  // 正常 绿
        { from: 24, to: 28, color: "#f5c542" },    // 偏胖 黄
        { from: 28, to: 40, color: "#e5484d" },    // 肥胖 红
      ];
      segments.forEach((seg) => {
        const a0 = Math.PI + (seg.from / 40) * Math.PI;
        const a1 = Math.PI + (Math.min(seg.to, 40) / 40) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 18;
        ctx.stroke();
      });
      // 指针
      if (bmi > 0) {
        const ang = Math.PI + (Math.min(bmi, 40) / 40) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * (r - 12), cy + Math.sin(ang) * (r - 12));
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.stroke();
        // 中心点
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      // 刻度文字
      ctx.fillStyle = "#aaa";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("18.5", cx - r * 0.7, cy - 8);
      ctx.fillText("24", cx + 5, cy - r - 2);
      ctx.fillText("28", cx + r * 0.7, cy - 8);
    }
    // 滑杆事件
    $("bmiHeightSlider").addEventListener("input", bmiSyncFromSliders);
    $("bmiWeightSlider").addEventListener("input", bmiSyncFromSliders);
    // v1.31：原按钮处理器已在上方（bmi_body）注册，这里只加滑杆同步和仪表盘
    // 当原处理器跑完后，同步滑杆位置
    const _origBmiBtn = $("bmiCalcBtn");
    // 用捕获阶段在原处理器之后同步（原处理器是冒泡，直接再包一层）
    _origBmiBtn.addEventListener("click", () => {
      setTimeout(() => {
        const h = parseFloat($("bmiHeight").value);
        const w = parseFloat($("bmiWeight").value);
        if (!isNaN(h) && h >= 140 && h <= 210) { $("bmiHeightSlider").value = h; $("bmiHeightVal").textContent = h; }
        if (!isNaN(w) && w >= 35 && w <= 150) { $("bmiWeightSlider").value = w; $("bmiWeightVal").textContent = w; }
        // 从结果文本解析 BMI 画仪表盘
        const m = $("bmiResult").textContent.match(/BMI ([0-9.]+)/);
        drawBmiGauge(m ? parseFloat(m[1]) : 0);
      }, 0);
    });
    drawBmiGauge(0);

  };
  /* ---------- 24. 汇率计算器（联网每天更新一次，存本机；离线用备用汇率） ---------- */
  /* v1.31：fx 已合并到 kin（实用计算器），经 showToy 重定向，此函数不再被调用。 */
  toyInitFns["fx"] = function () { /* merged into kin */
  };
  /* ---------- 25. 中英日韩翻译器 ---------- */
  toyInitFns["trans"] = function () {
    /* ----- Tab 切换 ----- */
    const ttabBtns = $("transTabBar").querySelectorAll(".toolbox-tab");
    const tpanels = { slang: $("transTabSlang"), trans: $("transTabTrans") };
    function switchTransTab(name) {
      ttabBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-ttab") === name));
      Object.keys(tpanels).forEach((k) => tpanels[k].classList.toggle("hidden", k !== name));
    }
    ttabBtns.forEach((b) => b.addEventListener("click", () => switchTransTab(b.getAttribute("data-ttab"))));

    /* ----- 宿舍黑话 50 条（v1.31） ----- */
    const SLANG = [
      { zh: "干饭", en: "Let's eat!", ja: "ご飯を食べよう", ko: "밥 먹자" },
      { zh: "开黑", en: "Squad up!", ja: "パーティーを組もう", ko: "파티하자" },
      { zh: "点名", en: "Roll call", ja: "出席確認", ko: "출석 체크" },
      { zh: "查寝", en: "Dorm inspection", ja: "寮の点検", ko: "기숙사 점검" },
      { zh: "断电", en: "Power cut", ja: "停電", ko: "정전" },
      { zh: "熄灯", en: "Lights out", ja: "消灯", ko: "소등" },
      { zh: "夜聊", en: "Late-night chat", ja: "夜更かしトーク", ko: "밤샘 수다" },
      { zh: "占座", en: "Save a seat", ja: "席取り", ko: "자리 맡기" },
      { zh: "代课", en: "Cover for me in class", ja: "代理出席", ko: "대리 출석" },
      { zh: "签到", en: "Check in", ja: "チェックイン", ko: "출석 체크" },
      { zh: "外卖", en: "Food delivery", ja: "デリバリー", ko: "배달 음식" },
      { zh: "拼单", en: "Group order", ja: "共同注文", ko: "공동 주문" },
      { zh: "AA", en: "Split the bill", ja: "割り勘", ko: "더치페이" },
      { zh: "值日", en: "Duty roster", ja: "当番", ko: "당번" },
      { zh: "打水", en: "Fetch hot water", ja: "お湯を汲む", ko: "뜨거운 물 받기" },
      { zh: "洗澡", en: "Take a shower", ja: "シャワーを浴びる", ko: "샤워하기" },
      { zh: "洗衣", en: "Do laundry", ja: "洗濯する", ko: "빨래하기" },
      { zh: "晾衣", en: "Hang laundry", ja: "洗濯物を干す", ko: "빨래 널기" },
      { zh: "串门", en: "Visit another dorm", ja: "他の部屋を訪ねる", ko: "다른 방 방문" },
      { zh: "卧谈", en: "Bedtime talk", ja: "寝る前の雑談", ko: "잠자기 전 수다" },
      { zh: "熬夜", en: "Stay up late", ja: "夜更かし", ko: "밤샘" },
      { zh: "早八", en: "8am class", ja: "朝8時の授業", ko: "아침 8시 수업" },
      { zh: "翘课", en: "Skip class", ja: "授業をサボる", ko: "수업 땡땡이" },
      { zh: "补考", en: "Makeup exam", ja: "追試", ko: "재시험" },
      { zh: "挂科", en: "Fail a course", ja: "単位を落とす", ko: "과목 낙제" },
      { zh: "绩点", en: "GPA", ja: "GPA", ko: "학점" },
      { zh: "保研", en: "Postgrad recommendation", ja: "推薦入学", ko: "추천 입학" },
      { zh: "考研", en: "Grad school exam", ja: "大学院入試", ko: "대학원 입시" },
      { zh: "四六级", en: "CET-4/6", ja: "CET-4/6", ko: "CET-4/6" },
      { zh: "社团", en: "Student club", ja: "サークル", ko: "동아리" },
      { zh: "学生会", en: "Student union", ja: "学生会", ko: "학생회" },
      { zh: "兼职", en: "Part-time job", ja: "アルバイト", ko: "아르바이트" },
      { zh: "快递", en: "Parcel", ja: "宅配便", ko: "택배" },
      { zh: "取快递", en: "Pick up parcel", ja: "荷物を受け取る", ko: "택배 찾기" },
      { zh: "拼多多", en: "Pinduoduo", ja: "ピンドゥオドゥオ", ko: "핀둬둬" },
      { zh: "淘宝", en: "Taobao", ja: "タオバオ", ko: "타오바오" },
      { zh: "京东", en: "JD.com", ja: "京東", ko: "징둥" },
      { zh: "奶茶", en: "Bubble tea", ja: "タピオカ", ko: "버블티" },
      { zh: "火锅", en: "Hot pot", ja: "火鍋", ko: "훠궈" },
      { zh: "烧烤", en: "BBQ", ja: "バーベキュー", ko: "바비큐" },
      { zh: "剧本杀", en: "Murder mystery game", ja: "マーダーミステリー", ko: "마더 미스터리" },
      { zh: "密室", en: "Escape room", ja: "脱出ゲーム", ko: "방탈출" },
      { zh: "轰趴", en: "House party", ja: "ホームパーティー", ko: "홈파티" },
      { zh: "表白", en: "Confess love", ja: "告白する", ko: "고백하기" },
      { zh: "脱单", en: "Get into a relationship", ja: "恋人ができる", ko: "솔로 탈출" },
      { zh: "单身狗", en: "Single dog (slang)", ja: "独り身", ko: "솔로" },
      { zh: "学霸", en: "Top student", ja: "秀才", ko: "수재" },
      { zh: "学渣", en: "Slacker student", ja: "劣等生", ko: "학渣" },
      { zh: "卷", en: "Involution (rat race)", ja: "内巻", ko: "내권" },
      { zh: "躺平", en: "Lie flat", ja: "寝そべり", ko: "탕핑" },
    ];
    function slangSpeak(text, lang) {
      // v1.31：Web Speech API 发音
      try {
        if (!("speechSynthesis" in window)) { $("slangResult").textContent = "当前环境不支持发音。"; return; }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        $("slangResult").textContent = "🔊 正在读：" + text;
      } catch (e) { $("slangResult").textContent = "发音失败。"; }
    }
    function slangRender(filter) {
      const list = $("slangList");
      list.innerHTML = "";
      const kw = (filter || "").trim().toLowerCase();
      let count = 0;
      SLANG.forEach((item) => {
        if (kw && !(item.zh.includes(kw) || item.en.toLowerCase().includes(kw))) return;
        count++;
        const card = document.createElement("div");
        card.className = "slang-card";
        const zh = document.createElement("div");
        zh.className = "slang-zh";
        zh.textContent = item.zh;
        const btn = document.createElement("button");
        btn.className = "btn ghost-btn small slang-speak";
        btn.textContent = "🔊";
        btn.setAttribute("aria-label", "读 " + item.zh);
        btn.addEventListener("click", () => slangSpeak(item.zh, "zh-CN"));
        zh.appendChild(btn);
        card.appendChild(zh);
        [["en", "🇬🇧", "en-US"], ["ja", "🇯🇵", "ja-JP"], ["ko", "🇰🇷", "ko-KR"]].forEach(([key, flag, lang]) => {
          const row = document.createElement("div");
          row.className = "slang-row";
          const t = document.createElement("span");
          t.textContent = flag + " " + item[key];
          const b = document.createElement("button");
          b.className = "btn ghost-btn small slang-speak";
          b.textContent = "🔊";
          b.setAttribute("aria-label", "读 " + item[key]);
          b.addEventListener("click", () => slangSpeak(item[key], lang));
          row.appendChild(t); row.appendChild(b);
          card.appendChild(row);
        });
        list.appendChild(card);
      });
      $("slangResult").textContent = count === 0 ? "没搜到，换个词试试。" : "共 " + count + " 条，点喇叭 🔊 听发音。";
    }
    const slangSearch = $("slangSearch");
    if (slangSearch) slangSearch.addEventListener("input", () => slangRender(slangSearch.value));
    slangRender("");

    /* ----- 翻译（原有逻辑，测试依赖） ----- */
    const TRANS_LANGS = [["zh-CN", "中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"]];
    TRANS_LANGS.forEach(([code, label]) => {
      const o1 = document.createElement("option"); o1.value = code; o1.textContent = label;
      const o2 = document.createElement("option"); o2.value = code; o2.textContent = label;
      $("transFrom").appendChild(o1); $("transTo").appendChild(o2);
    });
    $("transFrom").value = "zh-CN"; $("transTo").value = "en";
    $("transSwapBtn").addEventListener("click", () => {
      const f = $("transFrom").value; $("transFrom").value = $("transTo").value; $("transTo").value = f;
      const t = $("transInput").value; $("transInput").value = $("transOutput").textContent; $("transOutput").textContent = t;
    });
    $("transBtn").addEventListener("click", () => {
      const q = $("transInput").value.trim();
      if (!q) { $("transOutput").textContent = "先输入要翻译的内容。"; return; }
      if (typeof fetch !== "function") { $("transOutput").textContent = "当前环境不支持在线翻译。"; return; }
      $("transOutput").textContent = "翻译中……";
      const pair = $("transFrom").value + "|" + $("transTo").value;
      fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(q) + "&langpair=" + encodeURIComponent(pair))
        .then((r) => r.json())
        .then((data) => {
          const t = data && data.responseData && data.responseData.translatedText;
          $("transOutput").textContent = t ? t : "没翻出来，换句话试试。";
        })
        .catch(() => { $("transOutput").textContent = "翻译服务暂时不可用，检查网络再试。"; });
    });

  };
  /* ---------- 26. 指南针 ---------- */
  toyInitFns["compass"] = function () {
    let compassWatching = false;
    $("compassN").textContent = "北";
    $("compassE").textContent = "东";
    $("compassS").textContent = "南";
    $("compassW").textContent = "西";
    // 精美刻度盘：canvas 画 24 刻度 + 8 方位中文（静态外圈，不随表盘转）
    (function compassDrawDial() {
      try {
        const cv = $("compassDialCanvas");
        if (!cv || typeof cv.getContext !== "function") return;
        const ctx = cv.getContext("2d");
        const W = cv.width, cx = W / 2, cy = W / 2, R = W / 2 - 8;
        ctx.clearRect(0, 0, W, W);
        const dirs8 = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
        for (let d = 0; d < 360; d += 15) {
          const a = (d - 90) * Math.PI / 180;
          const major = d % 45 === 0;
          ctx.strokeStyle = major ? "#d4a94e" : "rgba(212,169,78,.35)";
          ctx.lineWidth = major ? 3 : 1.5;
          const r1 = R - (major ? 16 : 9);
          ctx.beginPath();
          ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
          ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
          ctx.stroke();
        }
        ctx.fillStyle = "#d4a94e";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        dirs8.forEach((t, i) => {
          const a = (i * 45 - 90) * Math.PI / 180;
          ctx.fillText(t, cx + (R - 30) * Math.cos(a), cy + (R - 30) * Math.sin(a));
        });
        // 外圈
        ctx.strokeStyle = "rgba(212,169,78,.6)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      } catch (e) { /* 测试桩忽略 */ }
    })();
    function compassLevel(e) {
      try {
        const dot = $("levelDot");
        if (!dot || typeof e.beta !== "number" || typeof e.gamma !== "number") return;
        // beta 前后倾，gamma 左右倾；限制 ±25° 映射到 ±14px
        const dx = Math.max(-14, Math.min(14, e.gamma / 25 * 14));
        const dy = Math.max(-14, Math.min(14, e.beta / 25 * 14));
        dot.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
      } catch (err) { /* 忽略 */ }
    }
    function compassDir(deg) {
      const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
      return dirs[Math.round(deg / 45) % 8];
    }
    function compassUpdate(deg) {
      $("compassCard").style.transform = "rotate(" + (-deg) + "deg)"; // 指针不动，表盘转
      $("compassDeg").textContent = Math.round(deg) + "° · " + compassDir(deg);
    }
    function compassHandler(e) {
      let deg = null;
      if (typeof e.webkitCompassHeading === "number") deg = e.webkitCompassHeading;
      else if (typeof e.alpha === "number") deg = (360 - e.alpha) % 360;
      if (deg !== null) compassUpdate(deg);
      compassLevel(e); // 水平仪气泡
    }
    $("compassBtn").addEventListener("click", () => {
      if (compassWatching) {
        window.removeEventListener("deviceorientation", compassHandler);
        compassWatching = false;
        $("compassBtn").textContent = "开启指南针 🧭";
        $("compassResult").textContent = "已关闭。";
        return;
      }
      if (typeof DeviceOrientationEvent === "undefined") {
        $("compassResult").textContent = "当前设备没有方向传感器，在手机上打开试试。";
        return;
      }
      const start = () => {
        window.addEventListener("deviceorientation", compassHandler);
        compassWatching = true;
        $("compassBtn").textContent = "关闭指南针 ⏸";
        $("compassResult").textContent = "把手机平放，慢慢转一圈校准。";
      };
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then((state) => {
          if (state === "granted") start();
          else $("compassResult").textContent = "需要允许“动作与方向”权限才能用指南针。";
        }).catch(() => { $("compassResult").textContent = "权限请求失败，在手机设置里打开试试。"; });
      } else {
        start();
      }
    });
    // 退出就关传感器，不然一直在后台耗电
    toyLeaveCleanup.compass = () => {
      if (compassWatching) {
        window.removeEventListener("deviceorientation", compassHandler);
        compassWatching = false;
        $("compassBtn").textContent = "开启指南针 🧭";
        $("compassResult").textContent = "已关闭。";
      }
    };

  };
  /* ---------- 27. 噪音检测 ---------- */
  toyInitFns["noise"] = function () {
    let noiseCtx = null, noiseStream = null, noiseRaf = null, noiseRunning = false;
    function noiseLevel(db) {
      if (db < 30) return "很安静 🤫";
      if (db < 50) return "正常说话声 🗣";
      if (db < 70) return "有点吵 📢";
      if (db < 90) return "很吵，注意听力 🙉";
      return "非常吵，离远点！🚨";
    }
    const noiseHist = [];
    let noiseVibAt = 0;
    function noiseDrawGauge(db) {
      try {
        const cv = $("noiseGauge");
        if (!cv || typeof cv.getContext !== "function") return;
        const ctx = cv.getContext("2d");
        const W = cv.width, H = cv.height, cx = W / 2, cy = H - 14, R = Math.min(W / 2 - 16, H - 28);
        ctx.clearRect(0, 0, W, H);
        // 刻度弧 0-120dB
        for (let d = 0; d <= 120; d += 10) {
          const a = Math.PI + (d / 120) * Math.PI;
          const hot = d >= 70;
          ctx.strokeStyle = hot ? "#e5484d" : (d >= 50 ? "#e8a13c" : "#59b36a");
          ctx.lineWidth = d % 30 === 0 ? 4 : 2;
          const r1 = R - (d % 30 === 0 ? 14 : 8), r2 = R;
          ctx.beginPath();
          ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
          ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
          ctx.stroke();
          if (d % 30 === 0) {
            ctx.fillStyle = "#999";
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(d), cx + (R - 24) * Math.cos(a), cy + (R - 24) * Math.sin(a) + 3);
          }
        }
        // 指针
        const pa = Math.PI + (Math.min(120, Math.max(0, db)) / 120) * Math.PI;
        ctx.strokeStyle = db >= 70 ? "#e5484d" : "#d4a94e";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (R - 30) * Math.cos(pa), cy + (R - 30) * Math.sin(pa));
        ctx.stroke();
        ctx.fillStyle = "#d4a94e";
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      } catch (e) { /* 测试桩忽略 */ }
    }
    function noiseDrawHist() {
      try {
        const cv = $("noiseHist");
        if (!cv || typeof cv.getContext !== "function") return;
        const ctx = cv.getContext("2d");
        const W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(212,169,78,.25)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, H - (70 / 120) * H); ctx.lineTo(W, H - (70 / 120) * H); ctx.stroke();
        if (noiseHist.length < 2) return;
        ctx.strokeStyle = "#d4a94e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        noiseHist.forEach((db, i) => {
          const x = (i / 59) * W;
          const y = H - (Math.min(120, db) / 120) * H;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      } catch (e) { /* 测试桩忽略 */ }
    }
    function noiseRender(db) {
      $("noiseDb").textContent = Math.round(db) + " dB";
      $("noiseMeter").style.width = Math.min(100, Math.max(0, db)) + "%";
      $("noiseLevel").textContent = noiseLevel(db);
      const over = db >= 70;
      $("noiseDb").classList.toggle("over", over);
      // 超标震动提醒（节流 3 秒一次）
      if (over && noiseRunning) {
        const now = Date.now();
        if (now - noiseVibAt > 3000 && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try { navigator.vibrate(60); } catch (e) {}
          noiseVibAt = now;
        }
      }
      noiseHist.push(db);
      if (noiseHist.length > 60) noiseHist.shift();
      noiseDrawGauge(db);
      noiseDrawHist();
    }
    function noiseStop() {
      noiseRunning = false;
      if (noiseRaf) { cancelAnimationFrame(noiseRaf); noiseRaf = null; }
      if (noiseStream) { noiseStream.getTracks().forEach((t) => t.stop()); noiseStream = null; }
      if (noiseCtx) { noiseCtx.close(); noiseCtx = null; }
      $("noiseBtn").textContent = "开始检测 🎙";
      $("noiseResult").textContent = "已停止。数值是估算，仅供参考。";
    }
    $("noiseBtn").addEventListener("click", () => {
      if (noiseRunning) { noiseStop(); return; }
      if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
        $("noiseResult").textContent = "当前设备不支持录音，在手机上打开试试。";
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        noiseStream = stream;
        const AC = window.AudioContext || window.webkitAudioContext;
        noiseCtx = new AC();
        const src = noiseCtx.createMediaStreamSource(stream);
        const analyser = noiseCtx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        noiseRunning = true;
        $("noiseBtn").textContent = "停止检测 ⏹";
        $("noiseResult").textContent = "正在检测……数值是估算，仅供参考。";
        const tick = () => {
          if (!noiseRunning) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / buf.length);
          const db = rms > 0 ? 20 * Math.log10(rms) + 90 : 0;
          noiseRender(db);
          noiseRaf = requestAnimationFrame(tick);
        };
        tick();
      }).catch(() => {
        $("noiseResult").textContent = "需要允许麦克风权限才能测噪音。";
      });
    });
    noiseRender(0);

    // 退出就关麦克风：不然退出后还在录音
    toyLeaveCleanup.noise = () => { if (noiseRunning) noiseStop(); };

  };
  /* ---------- 28. 奶蛙表情包（真图表情墙，点一下下载；图片分批内嵌在 frog-data*.js） ---------- */
  toyInitFns["frog"] = function () {
    function frogBuildWall() {
      const stickers = getFrogStickers();
      if (stickers.length === 0) return false;
      $("frogHint").textContent = "共 " + stickers.length + " 张奶蛙表情包，点一下就能下载，发群里用。";
      const frogGrid = $("frogGrid");
      frogGrid.innerHTML = "";
      stickers.forEach((s, i) => {
        const num = String(i + 1).padStart(3, "0");
        const card = document.createElement("div");
        card.className = "frog-card";
        const img = document.createElement("img");
        img.src = s.src;
        img.alt = "奶蛙-" + num;
        img.loading = "lazy";
        card.appendChild(img);
        const label = document.createElement("p");
        label.className = "frog-name";
        label.textContent = "奶蛙-" + num;
        card.appendChild(label);
        const btn = document.createElement("button");
        btn.className = "btn small gold-btn";
        btn.textContent = "下载 ⬇";
        btn.addEventListener("click", () => {
          const a = document.createElement("a");
          a.href = s.src;
          a.download = s.file;
          a.click();
          $("frogResult").textContent = "已下载「奶蛙-" + num + "」。";
        });
        card.appendChild(btn);
        frogGrid.appendChild(card);
      });
      return true;
    }
    if (!frogBuildWall()) {
      // frog-data*.js 还没加载（真实浏览器首次打开）：先占位，加载完再建墙
      $("frogHint").textContent = "奶蛙表情包加载中…";
      ensureFrogData().then(() => {
        if (!frogBuildWall()) $("frogHint").textContent = "表情包加载失败，刷新页面再试。";
      });
    }

  };
  /* ---------- 29. 计时器（秒表） ---------- */
  /* v1.31：stopwatch 已合并到 timer（时间工具箱），经 showToy 重定向，此函数不再被调用。 */
  toyInitFns["stopwatch"] = function () { /* merged into timer */
  };
  /* ---------- 30. BMI 体重管理 ---------- */
  /* v1.31：bmi 已合并到 kin（实用计算器），经 showToy 重定向，此函数不再被调用。 */
  toyInitFns["bmi"] = function () { /* merged into kin */
  };
  /* ---------- 31. 白噪音 ---------- */
  toyInitFns["whitenoise"] = function () {
    const WN_SOUNDS = [
      { id: "rain", name: "🌧 雨声" },
      { id: "sea", name: "🌊 海浪声" },
      { id: "fan", name: "🌀 风扇声" },
      { id: "fire", name: "🔥 篝火声" },
      { id: "white", name: "📻 白噪音" },
    ];
    let wnCtx = null, wnNodes = null, wnCurrent = null, wnSleepTimer = null;
    function wnStopAll(silent) {
      if (wnNodes) {
        try { if (wnNodes.crackle) clearInterval(wnNodes.crackle); } catch (e) {}
        try { wnNodes.nodes.forEach((n) => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} }); } catch (e) {}
        wnNodes = null;
      }
      if (wnSleepTimer) { clearTimeout(wnSleepTimer); wnSleepTimer = null; }
      wnCurrent = null;
      if (!silent) $("wnResult").textContent = "已停止。";
    }
    // 每种音色的合成链：返回 { nodes:[...], gain }
    function wnBuild(sid, ctx, master) {
      const builtCrackle = {};
      const sr = ctx.sampleRate, len = sr * 2;
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (sid === "white") d[i] = w * 0.5;
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } // 粉红基底
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const nodes = [src];
      const out = ctx.createGain(); out.gain.value = 1; nodes.push(out);
      const connect = (node) => { node.connect(out); };
      if (sid === "rain") {
        // 雨：带通 1800Hz + 慢速 LFO 营造雨点起伏
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.6;
        src.connect(bp); connect(bp);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.4;
        const lg = ctx.createGain(); lg.gain.value = 0.25;
        lfo.connect(lg); lg.connect(out.gain); lfo.start(); nodes.push(lfo);
        master.gain.value = 0.5;
      } else if (sid === "sea") {
        // 海浪：低通 500Hz + 0.12Hz 慢起伏
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
        src.connect(lp); connect(lp);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
        const lg = ctx.createGain(); lg.gain.value = 0.45;
        lfo.connect(lg); lg.connect(out.gain); lfo.start(); nodes.push(lfo);
        master.gain.value = 0.6;
      } else if (sid === "fan") {
        // 风扇：低频嗡鸣 + 8Hz 扇叶拍打
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 240;
        src.connect(lp); connect(lp);
        const hum = ctx.createOscillator(); hum.type = "sine"; hum.frequency.value = 90;
        const hg = ctx.createGain(); hg.gain.value = 0.25;
        hum.connect(hg); hg.connect(out); hum.start(); nodes.push(hum);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 8;
        const lg = ctx.createGain(); lg.gain.value = 0.18;
        lfo.connect(lg); lg.connect(out.gain); lfo.start(); nodes.push(lfo);
        master.gain.value = 0.5;
      } else if (sid === "fire") {
        // 篝火：高通噼啪基底 + 随机爆裂声
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
        src.connect(hp); connect(hp);
        let crackleAlive = true;
        const crackle = setInterval(() => {
          if (!crackleAlive) { clearInterval(crackle); return; }
          try {
            const t = ctx.currentTime;
            const o = ctx.createOscillator(); o.type = "square";
            o.frequency.value = 1500 + Math.random() * 2500;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.12 + Math.random() * 0.15, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05);
            o.connect(g); g.connect(out);
            o.start(t); o.stop(t + 0.1);
          } catch (e) {}
        }, 180);
        builtCrackle.crackle = crackle;
        builtCrackle.disarm = () => { crackleAlive = false; };
        master.gain.value = 0.45;
      } else {
        // 白噪音：直出
        connect(src);
        master.gain.value = 0.32;
      }
      return { nodes, out, crackle: builtCrackle.crackle || null };
    }
    WN_SOUNDS.forEach((s) => {
      const b = document.createElement("button");
      b.className = "btn small ghost-btn";
      b.textContent = s.name;
      b.addEventListener("click", () => {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (typeof AC === "undefined") { $("wnResult").textContent = "当前设备不支持音频播放。"; return; }
        try {
          if (!wnCtx) wnCtx = new AC();
          if (wnCtx.state === "suspended") wnCtx.resume();
          wnStopAll(true);
          const master = wnCtx.createGain();
          master.gain.value = 0.5 * (parseInt($("wnVolume").value, 10) / 100 || 0.6);
          master.connect(wnCtx.destination);
          const built = wnBuild(s.id, wnCtx, master);
          built.nodes.forEach((n) => { try { if (n.start && n !== built.out) n.start(); } catch (e) {} });
          try { built.out.connect(master); } catch (e) {}
          wnNodes = { nodes: built.nodes.concat([master]), gain: master, crackle: built.crackle };
          wnCurrent = s.id;
          // 定时关闭
          const mins = parseInt($("wnSleep").value, 10) || 0;
          if (mins > 0) {
            wnSleepTimer = setTimeout(() => {
              wnStopAll(false);
              $("wnResult").textContent = "定时到了，已自动停止 😴";
            }, mins * 60 * 1000);
          }
          $("wnResult").textContent = "正在播放：" + s.name + "。" + (mins > 0 ? mins + " 分钟后自动停止。" : "");
        } catch (e) { $("wnResult").textContent = "播放失败，换个浏览器试试。"; }
      });
      $("wnSounds").appendChild(b);
    });
    $("wnVolume").addEventListener("input", () => {
      if (wnNodes && wnNodes.gain) wnNodes.gain.gain.value = (parseInt($("wnVolume").value, 10) / 100 || 0) * 0.5;
    });
    $("wnStopBtn").addEventListener("click", () => wnStopAll(false));

    // 退出就停：不然退出后还在放（就是这次报的 bug）
    toyLeaveCleanup.whitenoise = () => { if (wnCurrent) wnStopAll(false); };

  };
  /* ---------- 33. 宿舍值日表 ---------- */
  toyInitFns["duty"] = function () {
    const DUTY_KEY = "dorm-toybox-duty-v1";
    const DUTY_TASKS = ["扫地", "拖地", "倒垃圾", "擦桌子", "卫生间"];
    let dutyChecked = {};
    try {
      const savedDuty = JSON.parse(localStorage.getItem(DUTY_KEY) || "null");
      if (savedDuty) {
        if (savedDuty.names) $("dutyNames").value = savedDuty.names;
        if (savedDuty.tasks) dutyChecked = savedDuty.tasks;
      }
    } catch (e) { /* 忽略 */ }
    DUTY_TASKS.forEach((t) => {
      const lab = document.createElement("label");
      lab.className = "duty-task";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = dutyChecked[t] !== false;
      cb.addEventListener("change", () => { dutyChecked[t] = cb.checked; saveDuty(); });
      lab.appendChild(cb);
      const span = document.createElement("span");
      span.textContent = t;
      lab.appendChild(span);
      $("dutyTasks").appendChild(lab);
    });
    function saveDuty() {
      try { localStorage.setItem(DUTY_KEY, JSON.stringify({ names: $("dutyNames").value, tasks: dutyChecked })); } catch (e) { /* 忽略 */ }
    }
    function dutyMonday() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // 本周一（含今天就是周日时，也是本周一）
      return d;
    }
    function dutyFmt(d) {
      const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
      return (d.getMonth() + 1) + "月" + d.getDate() + "日 周" + week;
    }
    let lastDutyText = "";
    $("dutyGenBtn").addEventListener("click", () => {
      const names = $("dutyNames").value.split("\n").map((s) => s.trim()).filter(Boolean);
      if (names.length < 2) { $("dutyResult").textContent = "至少写 2 个名字才能排表。"; return; }
      const tasks = DUTY_TASKS.filter((t) => dutyChecked[t] !== false);
      if (tasks.length === 0) { $("dutyResult").textContent = "至少勾 1 个任务。"; return; }
      saveDuty();
      const weeks = parseInt($("dutyWeeks").value, 10) || 1;
      // v1.31：跳过日期（输入 1-7 表示周一到周日，逗号分隔）
      const skipInput = $("dutySkip") ? $("dutySkip").value : "";
      const skipDays = new Set();
      skipInput.split(/[,，、\s]+/).forEach((s) => {
        const n = parseInt(s.trim(), 10);
        if (n >= 1 && n <= 7) skipDays.add(n);
      });
      const monday = dutyMonday();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tbody = $("dutyTable");
      tbody.innerHTML = "";
      const lines = [];
      let dutyIdx = 0; // v1.31：跳过不占轮值序号
      let todayPerson = "";
      for (let w = 0; w < weeks; w++) {
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday); d.setDate(monday.getDate() + w * 7 + i);
          const dayNum = ((d.getDay() + 6) % 7) + 1; // 周一=1 ... 周日=7
          if (skipDays.has(dayNum)) continue; // v1.31：跳过
          const person = names[dutyIdx % names.length];
          dutyIdx++;
          const tr = document.createElement("tr");
          if (d.getTime() === today.getTime()) tr.className = "today";
          const c1 = document.createElement("td"); c1.textContent = dutyFmt(d);
          const c2 = document.createElement("td"); c2.textContent = person;
          const c3 = document.createElement("td"); c3.textContent = tasks.join("、");
          tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3);
          tbody.appendChild(tr);
          lines.push(dutyFmt(d) + " " + person + "：" + tasks.join("、"));
        }
      }
      // v1.31：找出今天的值日生（大字显示）
      const todayStr = dutyFmt(today);
      for (let r = 0; r < tbody.children.length; r++) {
        const tr = tbody.children[r];
        if (tr.classList.contains("today")) {
          todayPerson = tr.children[1].textContent;
          break;
        }
      }
      const big = $("dutyTodayBig");
      if (big) {
        if (todayPerson) {
          big.classList.remove("hidden");
          big.innerHTML = '<div class="duty-big-label">今日值日生</div><div class="duty-big-name">' + todayPerson + '</div>';
        } else {
          big.classList.add("hidden");
        }
      }
      lastDutyText = lines.join("\n");
      const end = new Date(monday); end.setDate(monday.getDate() + weeks * 7 - 1);
      $("dutyStartLabel").textContent = "值日表（" + dutyFmt(monday) + " – " + dutyFmt(end) + "），每天一人轮着来。";
      $("dutyResult").textContent = "已排好 " + dutyIdx + " 天，点复制发群里。";
      $("dutyCopyBtn").classList.remove("hidden");
    });
    $("dutyCopyBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("🧹 宿舍值日表\n" + lastDutyText);
        $("dutyCopyBtn").textContent = "已复制 ✅";
        setTimeout(() => { $("dutyCopyBtn").textContent = "复制值日表 📋"; }, 2000);
      } catch (e) {
        $("dutyResult").textContent = lastDutyText;
      }
    });

  };
  /* ---------- 34. AA 分摊 ---------- */
  /* v1.31：aa 已合并到 ledger（宿舍账本），经 showToy 重定向，此函数不再被调用。 */
  toyInitFns["aa"] = function () { /* merged into ledger */
  };
  /* ---------- 35. 涂鸦板 ---------- */
  toyInitFns["doodle"] = function () {
    const DOODLE_COLORS = ["#222222", "#E5484D", "#F76B15", "#FFD60A", "#30A46C", "#0090FF", "#8E4EC6", "#FF8FAB"];
    let doodleColor = "#222222", doodleDrawing = false, doodleLast = null, doodleStrokes = 0;
    const doodleColorBtns = [];
    const doodleCanvas = $("doodleCanvas");
    const doodleCtx = doodleCanvas.getContext ? doodleCanvas.getContext("2d") : null;
    if (doodleCtx) { doodleCtx.fillStyle = "#ffffff"; doodleCtx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height); }
    DOODLE_COLORS.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "doodle-color" + (i === 0 ? " active" : "");
      b.style.background = c;
      b.setAttribute("aria-label", "颜色 " + c);
      b.addEventListener("click", () => {
        doodleColor = c;
        doodleColorBtns.forEach((el) => el.classList.remove("active"));
        $("doodleEraserBtn").classList.remove("active");
        b.classList.add("active");
      });
      doodleColorBtns.push(b);
      $("doodleColors").appendChild(b);
    });
    function doodleScale() {
      // 显示尺寸和画布尺寸不一样（CSS 缩放过），按比例换算坐标；取不到显示尺寸时按 1:1
      return (doodleCanvas.clientWidth > 0) ? doodleCanvas.width / doodleCanvas.clientWidth : 1;
    }
    const doodleHistory = []; // 撤销栈（ImageData 快照，最多 20 步）
    function doodlePushHistory() {
      if (!doodleCtx) return;
      try {
        doodleHistory.push(doodleCtx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height));
        if (doodleHistory.length > 20) doodleHistory.shift();
        const ub = $("doodleUndoBtn");
        if (ub) ub.disabled = false;
      } catch (e) {}
    }
    doodleCanvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (!doodleCtx) return;
      doodlePushHistory();
      doodleDrawing = true;
      const r = doodleCanvas.getBoundingClientRect();
      const t = e.touches[0];
      doodleLast = { x: (t.clientX - r.left) / r.width * doodleCanvas.width, y: (t.clientY - r.top) / r.height * doodleCanvas.height };
      doodleStrokes++;
      $("doodleResult").textContent = "已画 " + doodleStrokes + " 笔，点保存存成图片。";
    }, { passive: false });
    doodleCanvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return; // v3.0-r16：触摸走 touchstart，pointer 事件也收到触摸会双重落笔（笔画数翻倍）
      if (!doodleCtx) return;
      if (e.preventDefault) e.preventDefault();
      doodlePushHistory(); // 落笔前存快照
      doodleDrawing = true;
      const s = doodleScale();
      doodleLast = { x: e.offsetX * s, y: e.offsetY * s };
      doodleStrokes++;
      $("doodleResult").textContent = "已画 " + doodleStrokes + " 笔，点保存存成图片。";
    });
    doodleCanvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!doodleDrawing || !doodleCtx) return;
      const r = doodleCanvas.getBoundingClientRect();
      const t = e.touches[0];
      const s = doodleScale();
      const p = { x: (t.clientX - r.left) / r.width * doodleCanvas.width, y: (t.clientY - r.top) / r.height * doodleCanvas.height };
      doodleCtx.strokeStyle = doodleColor;
      doodleCtx.lineWidth = parseInt($("doodleSize").value, 10) || 8;
      doodleCtx.lineCap = "round";
      doodleCtx.beginPath();
      doodleCtx.moveTo(doodleLast.x, doodleLast.y);
      doodleCtx.lineTo(p.x, p.y);
      doodleCtx.stroke();
      doodleLast = p;
    }, { passive: false });
    doodleCanvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return; // v3.0-r16：同上，触摸走 touchmove
      if (!doodleDrawing || !doodleCtx) return;
      const s = doodleScale();
      const p = { x: e.offsetX * s, y: e.offsetY * s };
      doodleCtx.strokeStyle = doodleColor;
      doodleCtx.lineWidth = parseInt($("doodleSize").value, 10) || 8;
      doodleCtx.lineCap = "round";
      doodleCtx.beginPath();
      doodleCtx.moveTo(doodleLast.x, doodleLast.y);
      doodleCtx.lineTo(p.x, p.y);
      doodleCtx.stroke();
      doodleLast = p;
    });
    const doodleStop = () => { doodleDrawing = false; doodleLast = null; };
    doodleCanvas.addEventListener("pointerup", doodleStop);
    doodleCanvas.addEventListener("pointerleave", doodleStop);
    $("doodleEraserBtn").addEventListener("click", () => {
      doodleColor = "#ffffff";
      doodleColorBtns.forEach((el) => el.classList.remove("active"));
      $("doodleEraserBtn").classList.add("active");
      $("doodleResult").textContent = "橡皮擦：涂掉不要的部分。";
    });
    $("doodleClearBtn").addEventListener("click", () => {
      doodlePushHistory();
      if (doodleCtx) { doodleCtx.fillStyle = "#ffffff"; doodleCtx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height); }
      doodleStrokes = 0;
      $("doodleResult").textContent = "已清空，重新画吧。";
    });
    const doodleUndoBtn = $("doodleUndoBtn");
    if (doodleUndoBtn) {
      doodleUndoBtn.disabled = true;
      doodleUndoBtn.addEventListener("click", () => {
        if (!doodleCtx || !doodleHistory.length) return;
        try {
          const img = doodleHistory.pop();
          doodleCtx.putImageData(img, 0, 0);
          $("doodleResult").textContent = "↩ 撤销了一步。";
          if (!doodleHistory.length) doodleUndoBtn.disabled = true;
        } catch (e) {}
      });
    }
    $("doodleSaveBtn").addEventListener("click", () => {
      if (doodleStrokes === 0) { $("doodleResult").textContent = "先画点什么再保存。"; return; }
      if (typeof doodleCanvas.toDataURL !== "function") { $("doodleResult").textContent = "当前环境不支持保存。"; return; }
      const a = document.createElement("a");
      a.href = doodleCanvas.toDataURL("image/png");
      a.download = "涂鸦.png";
      a.click();
      $("doodleResult").textContent = "涂鸦已保存为图片。";
    });

  };
  /* ---------- 36. 奶蛙表情包制作 ---------- */
  toyInitFns["meme"] = function () {
    let memeIndex = 0;
    let memeImg = null;
    const memeCanvas = $("memeCanvas");
    const memeCtx = memeCanvas.getContext ? memeCanvas.getContext("2d") : null;
    function memeBuildThumbs() {
      const stickers = getFrogStickers();
      if (stickers.length === 0) return false;
      const strip = $("memeStrip");
      strip.innerHTML = "";
      stickers.forEach((s, i) => {
        const thumb = document.createElement("img");
        thumb.src = s.src;
        thumb.alt = "奶蛙-" + String(i + 1).padStart(3, "0");
        thumb.className = "meme-thumb" + (i === 0 ? " active" : "");
        thumb.loading = "lazy";
        thumb.addEventListener("click", () => { memeSelect(i); });
        strip.appendChild(thumb);
      });
      return true;
    }
    if (!memeBuildThumbs()) {
      ensureFrogData().then(() => { if (memeBuildThumbs()) memeLoadAndDraw(); });
    }
    function memeSelect(i) {
      memeIndex = i;
      const thumbs = $("memeStrip").children;
      for (let k = 0; k < thumbs.length; k++) thumbs[k].classList.toggle("active", k === i);
      $("memeSelected").textContent = "已选 奶蛙-" + String(i + 1).padStart(3, "0");
      memeLoadAndDraw();
    }
    function memeLoadAndDraw() {
      const stickers = getFrogStickers();
      if (stickers.length === 0) return;
      const src = stickers[memeIndex].src;
      if (typeof Image === "undefined") { memeDraw(null); return; } // 测试环境没有 Image，只画字
      if (!memeImg) memeImg = new Image();
      memeImg.onload = () => memeDraw(memeImg);
      memeImg.src = src;
      if (memeImg.complete && memeImg.naturalWidth > 0) memeDraw(memeImg); // 数据图可能已经在了
    }
    function memeText(text, cx, cy) {
      if (!text || !memeCtx) return;
      // 超过 12 个字换行，最多两行
      const lines = text.length > 12 ? [text.slice(0, 12), text.slice(12, 24)] : [text];
      lines.forEach((line, i) => {
        const y = cy + (i - (lines.length - 1) / 2) * 52;
        memeCtx.strokeText(line, cx, y);
        memeCtx.fillText(line, cx, y);
      });
    }
    function memeDraw(img) {
      if (!memeCtx) return;
      const W = 480, H = 480;
      memeCtx.fillStyle = "#ffffff";
      memeCtx.fillRect(0, 0, W, H);
      if (img) {
        const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        memeCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      memeCtx.font = "bold 44px sans-serif";
      memeCtx.textAlign = "center";
      memeCtx.textBaseline = "middle";
      memeCtx.lineWidth = 8;
      memeCtx.strokeStyle = "#000000";
      memeCtx.fillStyle = "#ffffff";
      memeText($("memeTop").value.trim(), W / 2, 52);
      memeText($("memeBottom").value.trim(), W / 2, H - 52);
    }
    $("memeTop").addEventListener("input", () => memeDraw(memeImg && memeImg.complete ? memeImg : null));
    $("memeBottom").addEventListener("input", () => memeDraw(memeImg && memeImg.complete ? memeImg : null));
    $("memeRandomBtn").addEventListener("click", () => {
      const stickers = getFrogStickers();
      if (stickers.length === 0) return;
      let next = Math.floor(Math.random() * stickers.length);
      if (stickers.length > 1 && next === memeIndex) next = (next + 1) % stickers.length;
      memeSelect(next);
    });
    $("memeExportBtn").addEventListener("click", () => {
      if (typeof memeCanvas.toDataURL !== "function") { $("memeResult").textContent = "当前环境不支持导出。"; return; }
      const a = document.createElement("a");
      a.href = memeCanvas.toDataURL("image/png");
      a.download = "奶蛙表情包.png";
      a.click();
      $("memeResult").textContent = "表情包已导出为图片，发群里用。";
    });
    memeLoadAndDraw();

  };
  /* ---------- 37. 贪吃蛇 ---------- */
  toyInitFns["snake"] = function () {
    const SNAKE_KEY = "dorm-toybox-snake-best-v1";
    const SNAKE_GRID = 16, SNAKE_CELL = 20; // 画布 320x320，16x16 格
    let snakeBody = [], snakeDir = { x: 1, y: 0 }, snakeNextDir = null, snakeFood = null, snakeScore = 0, snakeTimer = null, snakeState = "idle", snakeFoodCount = 0;
    function snakeBest() { try { return parseInt(localStorage.getItem(SNAKE_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
    function snakeSaveBest() { try { if (snakeScore > snakeBest()) localStorage.setItem(SNAKE_KEY, String(snakeScore)); } catch (e) { /* 忽略 */ } }
    const snakeCanvas = $("snakeCanvas");
    const snakeCtx = snakeCanvas.getContext ? snakeCanvas.getContext("2d") : null;
    function snakeDraw() {
      if (!snakeCtx) return;
      snakeCtx.fillStyle = "#10101f";
      snakeCtx.fillRect(0, 0, 320, 320);
      if (snakeFood) { snakeCtx.fillStyle = "#E5484D"; snakeCtx.fillRect(snakeFood.x * SNAKE_CELL + 2, snakeFood.y * SNAKE_CELL + 2, SNAKE_CELL - 4, SNAKE_CELL - 4); }
      snakeBody.forEach((s, i) => {
        snakeCtx.fillStyle = i === 0 ? "#7CFC9A" : "#30A46C";
        snakeCtx.fillRect(s.x * SNAKE_CELL + 1, s.y * SNAKE_CELL + 1, SNAKE_CELL - 2, SNAKE_CELL - 2);
      });
    }
    function snakePlaceFood() {
      snakeFoodCount++;
      if (snakeFoodCount === 1) { snakeFood = { x: 8, y: 8 }; return; } // R14：第一颗固定在正前方，上手先吃一口（出生点改到 x=5，离墙 11 格）
      if (snakeFoodCount === 2) { snakeFood = { x: 8, y: 11 }; return; } // 第二颗固定在正下方，转向后能吃到
      let p;
      do { p = { x: Math.floor(Math.random() * SNAKE_GRID), y: Math.floor(Math.random() * SNAKE_GRID) }; }
      while (snakeBody.some((s) => s.x === p.x && s.y === p.y));
      snakeFood = p;
    }
    function snakeReset() {
      snakeBody = [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }]; // R14：出生点左移，零操作撞墙从 1.2 秒放宽到 2.4 秒，新手有时间反应
      snakeDir = { x: 1, y: 0 }; snakeNextDir = null; snakeScore = 0; snakeFoodCount = 0;
      snakePlaceFood();
      snakeUpdateScore();
      snakeDraw();
    }
    function snakeUpdateScore() { $("snakeScore").textContent = "得分 " + snakeScore + " · 最高 " + Math.max(snakeBest(), snakeScore); }
    function snakeStep() {
      if (snakeNextDir) { snakeDir = snakeNextDir; snakeNextDir = null; }
      const head = { x: snakeBody[0].x + snakeDir.x, y: snakeBody[0].y + snakeDir.y };
      if (head.x < 0 || head.y < 0 || head.x >= SNAKE_GRID || head.y >= SNAKE_GRID || snakeBody.some((s) => s.x === head.x && s.y === head.y)) { snakeGameOver(); return; }
      snakeBody.unshift(head);
      if (snakeFood && head.x === snakeFood.x && head.y === snakeFood.y) {
        snakeScore++;
        SFX.pop(Math.min(1, snakeScore / 30));
        snakeUpdateScore();
        snakePlaceFood();
        // R14：吃得越多越快，最快 80ms 一步；起步 220ms（原来 150ms，上手就死太快）
        if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = setInterval(snakeStep, Math.max(80, 220 - snakeScore * 8)); }
      } else {
        snakeBody.pop();
      }
      snakeDraw();
    }
    function snakeGameOver() {
      if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; }
      snakeState = "over";
      snakeSaveBest();
      snakeUpdateScore();
      SFX.lose();
      $("snakeStatus").textContent = "💥 游戏结束！得分 " + snakeScore + "，最高 " + Math.max(snakeBest(), snakeScore) + "。点重新开始再来一局。";
      $("snakeStartBtn").textContent = "开始 ▶";
    }
    function snakeStart() {
      if (snakeState === "over" || snakeState === "idle") snakeReset();
      if (snakeTimer) return;
      snakeState = "running";
      snakeTimer = setInterval(snakeStep, Math.max(80, 220 - snakeScore * 8)); // R14：起步 220ms
      $("snakeStatus").textContent = "游戏中，吃红点长一节，别撞墙。";
      $("snakeStartBtn").textContent = "暂停 ⏸";
    }
    function snakePause() {
      if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; }
      if (snakeState === "running") { snakeState = "paused"; $("snakeStatus").textContent = "已暂停，点开始继续。"; $("snakeStartBtn").textContent = "继续 ▶"; }
    }
    $("snakeStartBtn").addEventListener("click", () => { if (snakeState === "running") snakePause(); else snakeStart(); });
    $("snakeRestartBtn").addEventListener("click", () => { if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; } snakeState = "idle"; snakeReset(); $("snakeStatus").textContent = "点开始，蛇就动起来。"; $("snakeStartBtn").textContent = "开始 ▶"; });
    function snakeTurn(dx, dy) {
      if (snakeDir.x === -dx && snakeDir.y === -dy) return; // 不能直接掉头
      snakeNextDir = { x: dx, y: dy };
    }
    $("snakeDirUp").addEventListener("click", () => snakeTurn(0, -1));
    $("snakeDirDown").addEventListener("click", () => snakeTurn(0, 1));
    $("snakeDirLeft").addEventListener("click", () => snakeTurn(-1, 0));
    $("snakeDirRight").addEventListener("click", () => snakeTurn(1, 0));
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-snake").classList.contains("hidden")) return;
        const k = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
        if (k) { snakeTurn(k[0], k[1]); if (e.preventDefault) e.preventDefault(); }
      });
    }
    // 手指在画布上滑动换方向
    let snakeSwipe = null;
    snakeCanvas.addEventListener("pointerdown", (e) => { snakeSwipe = { x: e.offsetX, y: e.offsetY }; });
    snakeCanvas.addEventListener("pointerup", (e) => {
      if (!snakeSwipe) return;
      const dx = e.offsetX - snakeSwipe.x, dy = e.offsetY - snakeSwipe.y;
      snakeSwipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) snakeTurn(dx > 0 ? 1 : -1, 0); else snakeTurn(0, dy > 0 ? 1 : -1);
    });
    snakeReset();
    toyLeaveCleanup.snake = () => { snakePause(); }; // 退出就停，不然切走还在走

  };
  /* ---------- 38. 刮刮乐 ---------- */
  toyInitFns["scratch"] = function () {
    const SCRATCH_PRIZES = [
      { text: "免一次值日 🧹", weight: 3 },
      { text: "奶茶一杯 🧋", weight: 3 },
      { text: "帮取快递一次 📦", weight: 3 },
      { text: "免一次打水 🪣", weight: 2 },
      { text: "零食一包 🍪", weight: 3 },
      { text: "帮占座一次 🪑", weight: 2 },
      { text: "小卖部跑腿一次 🛒", weight: 2 },
      { text: "谢谢参与 🙏", weight: 4 },
    ];
    // ---- 新增：中奖率可调（localStorage 持久化） ----
    const SCRATCH_RATE_KEY = "dorm-toybox-scratch-rate-v1";
    let scratchWinRate = 70; // 0-100，越高越容易中奖
    try {
      const v = parseInt(localStorage.getItem(SCRATCH_RATE_KEY) || "70", 10);
      if (v >= 0 && v <= 100) scratchWinRate = v;
    } catch (e) {}
    // 动态添加滑杆 UI
    const scratchSec = $("toy-scratch");
    if (scratchSec) {
      const rateDiv = document.createElement("div");
      rateDiv.className = "scratch-rate";
      const rateLabel = document.createElement("label");
      rateLabel.textContent = "🍀 中奖率：";
      const rateSlider = document.createElement("input");
      rateSlider.type = "range"; rateSlider.min = "0"; rateSlider.max = "100";
      rateSlider.value = String(scratchWinRate);
      rateSlider.setAttribute("aria-label", "中奖率");
      const rateVal = document.createElement("span");
      rateVal.textContent = scratchWinRate + "%";
      rateSlider.addEventListener("input", () => {
        scratchWinRate = parseInt(rateSlider.value, 10);
        rateVal.textContent = scratchWinRate + "%";
        try { localStorage.setItem(SCRATCH_RATE_KEY, String(scratchWinRate)); } catch (e) {}
      });
      rateDiv.appendChild(rateLabel); rateDiv.appendChild(rateSlider); rateDiv.appendChild(rateVal);
      // 加到 section 里（stub 兼容用 appendChild）
      scratchSec.appendChild(rateDiv);
    }
    const SCRATCH_W = 320, SCRATCH_H = 200, SCRATCH_COLS = 10, SCRATCH_ROWS = 6;
    const SCRATCH_CELL_W = SCRATCH_W / SCRATCH_COLS, SCRATCH_CELL_H = SCRATCH_H / SCRATCH_ROWS;
    let scratchGrid = [], scratchRevealed = false, scratchDrawing = false;
    const scratchCanvas = $("scratchCanvas");
    const scratchCtx = scratchCanvas.getContext ? scratchCanvas.getContext("2d") : null;
    function scratchPickPrize() {
      // 中奖率影响"谢谢参与"的概率：winRate=100 时必中奖，=0 时必谢谢参与
      const roll = Math.random() * 100;
      if (roll > scratchWinRate) return "谢谢参与 🙏";
      const bag = [];
      SCRATCH_PRIZES.forEach((p) => {
        if (p.text.includes("谢谢参与")) return;
        for (let i = 0; i < p.weight; i++) bag.push(p.text);
      });
      return bag[Math.floor(Math.random() * bag.length)];
    }
    function scratchCover() {
      scratchGrid = [];
      for (let i = 0; i < SCRATCH_COLS * SCRATCH_ROWS; i++) scratchGrid.push(false);
      scratchRevealed = false;
      $("scratchPrize").textContent = "🎁 " + scratchPickPrize();
      $("scratchResult").textContent = "刮开看看今天的手气。";
      if (!scratchCtx) return;
      scratchCtx.globalCompositeOperation = "source-over";
      scratchCtx.fillStyle = "#c0c0c8";
      scratchCtx.fillRect(0, 0, SCRATCH_W, SCRATCH_H);
      scratchCtx.fillStyle = "#8a8a94";
      scratchCtx.font = "bold 20px sans-serif";
      scratchCtx.textAlign = "center";
      scratchCtx.fillText("刮 开 看 看", SCRATCH_W / 2, SCRATCH_H / 2 + 7);
    }
    function scratchAt(e) {
      if (!scratchCtx || scratchRevealed) return;
      const scale = (scratchCanvas.clientWidth > 0) ? SCRATCH_W / scratchCanvas.clientWidth : 1;
      const x = e.offsetX * scale, y = e.offsetY * scale;
      scratchCtx.globalCompositeOperation = "destination-out";
      scratchCtx.beginPath();
      scratchCtx.arc(x, y, 22, 0, Math.PI * 2);
      scratchCtx.fill();
      const col = Math.floor(x / SCRATCH_CELL_W), row = Math.floor(y / SCRATCH_CELL_H);
      if (col >= 0 && col < SCRATCH_COLS && row >= 0 && row < SCRATCH_ROWS) scratchGrid[row * SCRATCH_COLS + col] = true;
      const done = scratchGrid.filter(Boolean).length;
      if (done >= SCRATCH_COLS * SCRATCH_ROWS / 2) scratchReveal();
    }
    function scratchReveal() {
      scratchRevealed = true;
      if (scratchCtx) scratchCtx.clearRect(0, 0, SCRATCH_W, SCRATCH_H);
      $("scratchResult").textContent = "🎉 刮出：" + $("scratchPrize").textContent.replace("🎁 ", "") + "！";
    }
    scratchCanvas.addEventListener("pointerdown", (e) => { scratchDrawing = true; scratchAt(e); });
    scratchCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); if (scratchDrawing) { const t = e.touches[0]; const r = scratchCanvas.getBoundingClientRect(); scratchAt({ offsetX: t.clientX - r.left, offsetY: t.clientY - r.top }); } }, { passive: false });
    scratchCanvas.addEventListener("pointermove", (e) => { if (scratchDrawing) scratchAt(e); });
    scratchCanvas.addEventListener("pointerup", () => { scratchDrawing = false; });
    scratchCanvas.addEventListener("pointerleave", () => { scratchDrawing = false; });
    $("scratchAgainBtn").addEventListener("click", scratchCover);
    scratchCover();

  };
  /* ---------- 39. 倒计时 ---------- */
  toyInitFns["countdown"] = function () {
    const CD_KEY = "dorm-toybox-countdown-v1";
    let cdEvents = [];
    try { cdEvents = JSON.parse(localStorage.getItem(CD_KEY) || "[]") || []; } catch (e) { cdEvents = []; }
    function cdSave() { try { localStorage.setItem(CD_KEY, JSON.stringify(cdEvents)); } catch (e) { /* 忽略 */ } }
    function cdDays(dateStr) {
      const t = new Date(dateStr + "T00:00:00");
      const now = new Date(); now.setHours(0, 0, 0, 0);
      return Math.round((t.getTime() - now.getTime()) / 86400000);
    }
    function cdDrawRing(canvas, days) {
      // v1.31：canvas 进度环
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = 64, H = 64, cx = 32, cy = 32, r = 26;
      ctx.clearRect(0, 0, W, H);
      // 背景环
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 6;
      ctx.stroke();
      // 进度：30 天为满圈
      let frac = 0, color = "#3ec6a7";
      if (days > 0) {
        frac = Math.min(days, 30) / 30;
        color = days <= 3 ? "#e5484d" : days <= 7 ? "#f5c542" : "#3ec6a7";
      } else if (days === 0) {
        frac = 1;
        color = "#f5c542";
      }
      if (frac > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      // 天数文字
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(days > 0 ? String(days) : days === 0 ? "今" : "过", cx, cy);
    }
    function cdConfetti() {
      // v1.31：到期撒花（简单 CSS 彩带）
      const wrap = $("cdConfetti");
      if (!wrap) return;
      wrap.innerHTML = "";
      wrap.classList.remove("hidden");
      const colors = ["#e5484d", "#f5c542", "#3ec6a7", "#4a9eff", "#b565f0"];
      for (let i = 0; i < 30; i++) {
        const p = document.createElement("i");
        p.className = "confetti-piece";
        p.style.left = Math.random() * 100 + "%";
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = (Math.random() * 0.5) + "s";
        wrap.appendChild(p);
      }
      setTimeout(() => wrap.classList.add("hidden"), 3000);
    }
    function cdRender() {
      const list = $("cdList");
      list.innerHTML = "";
      const sorted = cdEvents.slice().sort((a, b) => cdDays(a.date) - cdDays(b.date));
      let hasToday = false;
      sorted.forEach((ev) => {
        const d = cdDays(ev.date);
        if (d === 0) hasToday = true;
        const row = document.createElement("div");
        row.className = "cd-row" + (d === 0 ? " today" : "");
        // v1.31：canvas 进度环（保持 children[0]=name, [1]=days, [2]=del 的测试结构）
        // 环放在 name 前面作为装饰，不计入 children 索引？不行，测试用 children[2] 找删除按钮
        // 方案：环作为 row 的第一个子元素，但测试的 children[2] 会错位
        // 折中：把环塞进 name span 里面（不影响 children 索引）
        const name = document.createElement("span");
        name.className = "cd-name";
        const cv = document.createElement("canvas");
        cv.width = 64; cv.height = 64;
        cv.className = "cd-ring";
        name.appendChild(cv);
        const nm = document.createElement("b");
        nm.textContent = ev.name;
        name.appendChild(nm);
        // 画环（测试桩的 getContext 返回占位，不报错即可）
        try { cdDrawRing(cv, d); } catch (e) { /* 忽略 */ }
        const days = document.createElement("span");
        days.className = "cd-days" + (d === 0 ? " today" : d < 0 ? " past" : "");
        days.textContent = d === 0 ? "就是今天！" : d > 0 ? "还有 " + d + " 天" : "已经过了 " + (-d) + " 天";
        const del = document.createElement("button");
        del.className = "btn ghost-btn small";
        del.textContent = "删掉";
        del.addEventListener("click", () => {
          cdEvents = cdEvents.filter((x) => x !== ev);
          cdSave(); cdRender();
        });
        row.appendChild(name); row.appendChild(days); row.appendChild(del);
        list.appendChild(row);
      });
      if (hasToday) cdConfetti();
      $("cdResult").textContent = cdEvents.length === 0 ? "还没加倒计时。" : "共 " + cdEvents.length + " 个倒计时，最近的在最前面。";
    }
    $("cdAddBtn").addEventListener("click", () => {
      const name = $("cdName").value.trim();
      const date = $("cdDate").value;
      if (!name) { $("cdResult").textContent = "先写是什么事。"; return; }
      if (!date) { $("cdResult").textContent = "再选个日子。"; return; }
      cdEvents.push({ name, date });
      cdSave(); cdRender();
      $("cdName").value = "";
      $("cdResult").textContent = "已加上「" + name + "」，还有 " + cdDays(date) + " 天。";
    });
    cdRender();

  };
  /* ---------- 40. 待办清单 ---------- */
  toyInitFns["todo"] = function () {
    const TODO_KEY = "dorm-toybox-todo-v1";
    let todoItems = [];
    try { todoItems = JSON.parse(localStorage.getItem(TODO_KEY) || "[]") || []; } catch (e) { todoItems = []; }
    // v1.31：兼容旧数据（无 priority/tag 字段）
    todoItems.forEach((it) => { if (!it.priority) it.priority = "med"; if (!it.tag) it.tag = ""; });
    function todoSave() { try { localStorage.setItem(TODO_KEY, JSON.stringify(todoItems)); } catch (e) { /* 忽略 */ } }
    const PRI_LABEL = { high: "🔴 高", med: "🟡 中", low: "🟢 低" };
    function todoRender() {
      const list = $("todoList");
      list.innerHTML = "";
      todoItems.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "todo-row pri-" + (item.priority || "med") + (item.done ? " done" : "");
        row.setAttribute("draggable", "true");
        row.setAttribute("data-idx", idx);
        // 拖拽排序（HTML5）
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", idx);
          row.classList.add("dragging");
        });
        row.addEventListener("dragend", () => row.classList.remove("dragging"));
        row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("drag-over"); });
        row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          row.classList.remove("drag-over");
          const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
          if (isNaN(from) || from === idx) return;
          const [moved] = todoItems.splice(from, 1);
          todoItems.splice(idx, 0, moved);
          todoSave(); todoRender();
        });
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = item.done;
        cb.setAttribute("aria-label", "完成 " + item.text);
        cb.addEventListener("change", () => {
          item.done = cb.checked;
          todoSave(); todoRender();
          // v1.31：打勾动画（CSS .todo-row.done .todo-check-anim）
          if (item.done) {
            const r = list.children[idx];
            if (r) r.classList.add("just-checked");
          }
        });
        const span = document.createElement("span");
        span.className = "todo-text";
        // v1.31：优先级徽章 + 分类标签 + 文本（保持 children[1] 是 span）
        let html = '<em class="todo-pri">' + (PRI_LABEL[item.priority] || PRI_LABEL.med) + '</em>';
        if (item.tag) html += '<em class="todo-tag">' + item.tag.replace(/</g, "&lt;") + '</em>';
        html += '<span>' + item.text.replace(/</g, "&lt;") + '</span>';
        // 测试桩不支持 innerHTML 解析，用 textContent 兜底（真机用 innerHTML）
        try { span.innerHTML = html; } catch (e) { span.textContent = item.text; }
        // 确保测试能读到文本（textContent 包含）
        if (!span.textContent.includes(item.text)) span.textContent = item.text;
        const up = document.createElement("button");
        up.className = "btn ghost-btn small todo-move";
        up.textContent = "↑";
        up.setAttribute("aria-label", "上移 " + item.text);
        up.disabled = idx === 0;
        up.addEventListener("click", () => {
          if (idx === 0) return;
          const [moved] = todoItems.splice(idx, 1);
          todoItems.splice(idx - 1, 0, moved);
          todoSave(); todoRender();
        });
        const down = document.createElement("button");
        down.className = "btn ghost-btn small todo-move";
        down.textContent = "↓";
        down.setAttribute("aria-label", "下移 " + item.text);
        down.disabled = idx === todoItems.length - 1;
        down.addEventListener("click", () => {
          if (idx === todoItems.length - 1) return;
          const [moved] = todoItems.splice(idx, 1);
          todoItems.splice(idx + 1, 0, moved);
          todoSave(); todoRender();
        });
        const del = document.createElement("button");
        del.className = "btn ghost-btn small";
        del.textContent = "删掉";
        del.addEventListener("click", () => { todoItems = todoItems.filter((x) => x !== item); todoSave(); todoRender(); });
        row.appendChild(cb); row.appendChild(span); row.appendChild(up); row.appendChild(down); row.appendChild(del);
        list.appendChild(row);
      });
      const done = todoItems.filter((i) => i.done).length;
      $("todoStats").textContent = todoItems.length === 0 ? "还没写待办。" : "已完成 " + done + " / 共 " + todoItems.length + (done === todoItems.length ? "，全部搞定 🎉" : "。");
      if (done > 0) $("todoClearBtn").classList.remove("hidden"); else $("todoClearBtn").classList.add("hidden");
    }
    function todoAdd() {
      const text = $("todoInput").value.trim();
      if (!text) return;
      const pri = $("todoPri") ? $("todoPri").value : "med";
      const tag = $("todoTag") ? $("todoTag").value.trim() : "";
      todoItems.push({ text, done: false, priority: pri, tag: tag });
      todoSave(); todoRender();
      $("todoInput").value = "";
      if ($("todoTag")) $("todoTag").value = "";
    }
    $("todoAddBtn").addEventListener("click", todoAdd);
    $("todoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") todoAdd(); });
    $("todoClearBtn").addEventListener("click", () => { todoItems = todoItems.filter((i) => !i.done); todoSave(); todoRender(); });
    todoRender();

  };
  /* ---------- 41. 俄罗斯方块 ---------- */
  toyInitFns["tetris"] = function () {
    const TETRIS_KEY = "dorm-toybox-tetris-best-v1";
    const T_COLS = 10, T_ROWS = 20, T_CELL = 24;
    const T_PIECES = [
      { m: [[1, 1, 1, 1]], c: "#22d3ee" }, // I
      { m: [[1, 1], [1, 1]], c: "#facc15" }, // O
      { m: [[0, 1, 0], [1, 1, 1]], c: "#c084fc" }, // T
      { m: [[0, 1, 1], [1, 1, 0]], c: "#4ade80" }, // S
      { m: [[1, 1, 0], [0, 1, 1]], c: "#f87171" }, // Z
      { m: [[1, 0, 0], [1, 1, 1]], c: "#60a5fa" }, // J
      { m: [[0, 0, 1], [1, 1, 1]], c: "#fb923c" }, // L
    ];
    const T_POINTS = { 1: 100, 2: 300, 3: 500, 4: 800 };
    let tBoard = [], tCur = null, tNext = null, tScore = 0, tLines = 0, tLevel = 1, tTimer = null, tState = "idle";
    function tBest() { try { return parseInt(localStorage.getItem(TETRIS_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
    function tSaveBest() { try { if (tScore > tBest()) localStorage.setItem(TETRIS_KEY, String(tScore)); } catch (e) { /* 忽略 */ } }
    const tCanvas = $("tetrisCanvas");
    const tCtx = tCanvas.getContext ? tCanvas.getContext("2d") : null;
    const tNextCanvas = $("tetrisNext");
    const tNextCtx = tNextCanvas.getContext ? tNextCanvas.getContext("2d") : null;
    function tEmptyBoard() { tBoard = []; for (let r = 0; r < T_ROWS; r++) tBoard.push(new Array(T_COLS).fill(null)); }
    function tNewPiece() {
      const p = T_PIECES[Math.floor(Math.random() * T_PIECES.length)];
      return { m: p.m.map((row) => row.slice()), c: p.c, x: Math.floor((T_COLS - p.m[0].length) / 2), y: 0 };
    }
    function tCollide(m, x, y) {
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const bx = x + c, by = y + r;
        if (bx < 0 || bx >= T_COLS || by >= T_ROWS) return true;
        if (by >= 0 && tBoard[by][bx]) return true;
      }
      return false;
    }
    function tDraw() {
      if (!tCtx) return;
      tCtx.fillStyle = "#10101f";
      tCtx.fillRect(0, 0, T_COLS * T_CELL, T_ROWS * T_CELL);
      for (let r = 0; r < T_ROWS; r++) for (let c = 0; c < T_COLS; c++) {
        if (tBoard[r][c]) { tCtx.fillStyle = tBoard[r][c]; tCtx.fillRect(c * T_CELL + 1, r * T_CELL + 1, T_CELL - 2, T_CELL - 2); }
      }
      if (tCur) {
        tCtx.fillStyle = tCur.c;
        for (let r = 0; r < tCur.m.length; r++) for (let c = 0; c < tCur.m[r].length; c++) {
          if (tCur.m[r][c]) tCtx.fillRect((tCur.x + c) * T_CELL + 1, (tCur.y + r) * T_CELL + 1, T_CELL - 2, T_CELL - 2);
        }
      }
      if (tNextCtx && tNext) {
        tNextCtx.fillStyle = "#10101f";
        tNextCtx.fillRect(0, 0, 96, 96);
        tNextCtx.fillStyle = tNext.c;
        const w = tNext.m[0].length, h = tNext.m.length;
        const ox = Math.floor((96 - w * 20) / 2), oy = Math.floor((96 - h * 20) / 2);
        for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
          if (tNext.m[r][c]) tNextCtx.fillRect(ox + c * 20 + 1, oy + r * 20 + 1, 18, 18);
        }
      }
    }
    function tUpdateHud() {
      $("tetrisScore").textContent = "得分 " + tScore;
      $("tetrisLevel").textContent = "第 " + tLevel + " 关 · 已消 " + tLines + " 行";
      $("tetrisBest").textContent = "最高 " + Math.max(tBest(), tScore);
    }
    function tLock() {
      for (let r = 0; r < tCur.m.length; r++) for (let c = 0; c < tCur.m[r].length; c++) {
        if (tCur.m[r][c] && tCur.y + r >= 0) tBoard[tCur.y + r][tCur.x + c] = tCur.c;
      }
      let cleared = 0;
      for (let r = T_ROWS - 1; r >= 0; r--) {
        if (tBoard[r].every(Boolean)) { tBoard.splice(r, 1); tBoard.unshift(new Array(T_COLS).fill(null)); cleared++; r++; }
      }
      if (cleared > 0) {
        tLines += cleared;
        tScore += (T_POINTS[cleared] || 100) * tLevel;
        tLevel = Math.floor(tLines / 10) + 1;
        SFX.win();
        if (tTimer) { clearInterval(tTimer); tTimer = setInterval(tTick, Math.max(100, 800 - (tLevel - 1) * 70)); }
      } else { SFX.click(); }
      tCur = tNext; tNext = tNewPiece();
      if (tCollide(tCur.m, tCur.x, tCur.y)) { tGameOver(); return; }
      tUpdateHud(); tDraw();
    }
    function tTick() {
      if (!tCur) return;
      if (!tCollide(tCur.m, tCur.x, tCur.y + 1)) { tCur.y++; }
      else tLock();
      tDraw();
    }
    function tGameOver() {
      if (tTimer) { clearInterval(tTimer); tTimer = null; }
      tState = "over";
      tSaveBest(); tUpdateHud();
      SFX.lose();
      $("tetrisStatus").textContent = "💥 堆到顶了！得分 " + tScore + "，最高 " + Math.max(tBest(), tScore) + "。点开始再来一局。";
      $("tetrisStartBtn").textContent = "开始 ▶";
    }
    function tReset() {
      tEmptyBoard(); tScore = 0; tLines = 0; tLevel = 1;
      tCur = tNewPiece(); tNext = tNewPiece();
      tUpdateHud(); tDraw();
    }
    function tStart() {
      if (tState === "over" || tState === "idle") tReset();
      if (tTimer) return;
      tState = "running";
      tTimer = setInterval(tTick, Math.max(100, 800 - (tLevel - 1) * 70));
      $("tetrisStatus").textContent = "游戏中，消行得分，越往后越快。";
      $("tetrisStartBtn").textContent = "暂停 ⏸";
    }
    function tPause() {
      if (tTimer) { clearInterval(tTimer); tTimer = null; }
      if (tState === "running") { tState = "paused"; $("tetrisStatus").textContent = "已暂停，点开始继续。"; $("tetrisStartBtn").textContent = "继续 ▶"; }
    }
    function tMove(dx) { if (tCur && tState === "running" && !tCollide(tCur.m, tCur.x + dx, tCur.y)) { tCur.x += dx; tDraw(); } }
    function tRotate() {
      if (!tCur || tState !== "running") return;
      const m = tCur.m;
      const rot = [];
      for (let c = 0; c < m[0].length; c++) { const row = []; for (let r = m.length - 1; r >= 0; r--) row.push(m[r][c]); rot.push(row); }
      const kicks = [0, -1, 1, -2, 2];
      for (let i = 0; i < kicks.length; i++) {
        if (!tCollide(rot, tCur.x + kicks[i], tCur.y)) { tCur.m = rot; tCur.x += kicks[i]; tDraw(); return; }
      }
    }
    function tSoftDrop() { if (tCur && tState === "running") { if (!tCollide(tCur.m, tCur.x, tCur.y + 1)) { tCur.y++; tDraw(); } else tLock(); } }
    function tHardDrop() { if (!tCur || tState !== "running") return; while (!tCollide(tCur.m, tCur.x, tCur.y + 1)) tCur.y++; tLock(); tDraw(); }
    $("tetrisStartBtn").addEventListener("click", () => { if (tState === "running") tPause(); else tStart(); });
    $("tetrisPauseBtn").addEventListener("click", tPause);
    $("tetrisLeftBtn").addEventListener("click", () => tMove(-1));
    $("tetrisRightBtn").addEventListener("click", () => tMove(1));
    $("tetrisDownBtn").addEventListener("click", tSoftDrop);
    $("tetrisRotBtn").addEventListener("click", tRotate);
    $("tetrisDropBtn").addEventListener("click", tHardDrop);
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-tetris").classList.contains("hidden")) return;
        if (e.key === "ArrowLeft") { tMove(-1); if (e.preventDefault) e.preventDefault(); }
        else if (e.key === "ArrowRight") { tMove(1); if (e.preventDefault) e.preventDefault(); }
        else if (e.key === "ArrowDown") { tSoftDrop(); if (e.preventDefault) e.preventDefault(); }
        else if (e.key === "ArrowUp") { tRotate(); if (e.preventDefault) e.preventDefault(); }
        else if (e.key === " ") { tHardDrop(); if (e.preventDefault) e.preventDefault(); }
      });
    }
    tReset();
    toyLeaveCleanup.tetris = () => { tPause(); };
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get tetris() { return { board: tBoard, cur: tCur, next: tNext, score: tScore, lines: tLines, level: tLevel, state: tState }; },
        tetrisSetCur(x, y) { if (tCur) { tCur.x = x; tCur.y = y; } },
    }));

  };
  /* ---------- 42. 2048 ---------- */
  toyInitFns["game2048"] = function () {
    const G2048_KEY = "dorm-toybox-2048-best-v1";
    const G2048_COLORS = { 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179", 16: "#f59563", 32: "#f67c5f", 64: "#f65e3b", 128: "#edcf72", 256: "#edcc61", 512: "#edc850", 1024: "#edc53f", 2048: "#edc22e" };
    let g2048 = [], gScore = 0, gOver = false, gWon = false;
    function g2048Best() { try { return parseInt(localStorage.getItem(G2048_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
    function g2048SaveBest() { try { if (gScore > g2048Best()) localStorage.setItem(G2048_KEY, String(gScore)); } catch (e) { /* 忽略 */ } }
    function g2048Spawn() {
      const empty = [];
      for (let i = 0; i < 16; i++) if (!g2048[i]) empty.push(i);
      if (empty.length === 0) return;
      g2048[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    }
    function g2048New() {
      g2048 = new Array(16).fill(0); gScore = 0; gOver = false; gWon = false;
      g2048Spawn(); g2048Spawn();
      g2048Render();
      $("g2048Status").textContent = "滑动开始合并。";
    }
    function g2048Render() {
      const grid = $("g2048Grid");
      grid.innerHTML = "";
      for (let i = 0; i < 16; i++) {
        const cell = document.createElement("div");
        const v = g2048[i];
        cell.className = "g2048-tile" + (v ? " filled" : "")
          + (v >= 1024 ? " huge" : v >= 128 ? " big" : "")
          + (v >= 128 ? " glow" : "");
        if (v) {
          cell.textContent = v;
          cell.style.background = G2048_COLORS[v] || "#3c3a32";
          cell.style.color = v <= 4 ? "#776e65" : "#f9f6f2";
        }
        grid.appendChild(cell);
      }
      $("g2048Score").textContent = "得分 " + gScore + " · 最高 " + Math.max(g2048Best(), gScore);
    }
    function g2048SlideLine(line) {
      const arr = line.filter(Boolean);
      let gained = 0;
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) { arr[i] *= 2; gained += arr[i]; arr.splice(i + 1, 1); }
      }
      while (arr.length < 4) arr.push(0);
      return { line: arr, gained };
    }
    function g2048Move(dir) {
      if (gOver) return;
      const before = g2048.join(",");
      let gained = 0;
      const idx = (r, c) => r * 4 + c;
      if (dir === "left" || dir === "right") {
        for (let r = 0; r < 4; r++) {
          let line = [g2048[idx(r, 0)], g2048[idx(r, 1)], g2048[idx(r, 2)], g2048[idx(r, 3)]];
          if (dir === "right") line.reverse();
          const res = g2048SlideLine(line);
          gained += res.gained;
          if (dir === "right") res.line.reverse();
          for (let c = 0; c < 4; c++) g2048[idx(r, c)] = res.line[c];
        }
      } else {
        for (let c = 0; c < 4; c++) {
          let line = [g2048[idx(0, c)], g2048[idx(1, c)], g2048[idx(2, c)], g2048[idx(3, c)]];
          if (dir === "down") line.reverse();
          const res = g2048SlideLine(line);
          gained += res.gained;
          if (dir === "down") res.line.reverse();
          for (let r = 0; r < 4; r++) g2048[idx(r, c)] = res.line[r];
        }
      }
      if (g2048.join(",") === before) return; // 没动，不生成新块
      gScore += gained;
      if (gained > 0) { const mx = Math.max.apply(null, g2048); SFX.pop(Math.min(1, Math.log2(mx) / 11)); }
      g2048Spawn();
      g2048SaveBest();
      g2048Render();
      if (!gWon && g2048.some((v) => v >= 2048)) { gWon = true; SFX.win(); $("g2048Status").textContent = "🎉 拼出 2048 了！太强了，还能继续往上拼。"; }
      else if (g2048CanMove()) { if (!gWon) $("g2048Status").textContent = "继续，拼出更大的数。"; }
      else { gOver = true; SFX.lose(); $("g2048Status").textContent = "💥 拼不动了！得分 " + gScore + "，最高 " + Math.max(g2048Best(), gScore) + "。点新一局再来。"; }
    }
    function g2048CanMove() {
      if (g2048.some((v) => !v)) return true;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const v = g2048[r * 4 + c];
        if (c < 3 && g2048[r * 4 + c + 1] === v) return true;
        if (r < 3 && g2048[(r + 1) * 4 + c] === v) return true;
      }
      return false;
    }
    $("g2048NewBtn").addEventListener("click", g2048New);
    // 2048 滑动：pointer + touch 双路径。同一触摸会先后触发 pointerup 和 touchend，
    // 用 g2048Swiped 去重，只算一次移动。touchmove 里禁掉默认滚动做兜底。
    let g2048Swipe = null;
    let g2048Swiped = false;
    function g2048SwipeStart(x, y) { g2048Swipe = { x, y }; g2048Swiped = false; }
    function g2048SwipeEnd(x, y) {
      if (!g2048Swipe || g2048Swiped) return;
      g2048Swiped = true;
      const dx = x - g2048Swipe.x, dy = y - g2048Swipe.y;
      g2048Swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) g2048Move(dx > 0 ? "right" : "left"); else g2048Move(dy > 0 ? "down" : "up");
    }
    const g2048GridEl = $("g2048Grid");
    g2048GridEl.addEventListener("pointerdown", (e) => g2048SwipeStart(e.clientX, e.clientY));
    g2048GridEl.addEventListener("pointerup", (e) => g2048SwipeEnd(e.clientX, e.clientY));
    // 手势被浏览器取消（比如系统手势）时不清起点，留给 touchend 兜底完成这一次滑动；
    // 下一次触摸开始时会重新设起点，不会用旧起点算。
    g2048GridEl.addEventListener("pointercancel", () => { /* 保留起点，等 touchend 兜底 */ });
    // 有些手机浏览器不认父元素的 touch-action，手指落在格子上时仍会翻页：
    // 在 touchmove 里直接禁掉默认滚动（必须是非被动监听，否则 preventDefault 无效）。
    g2048GridEl.addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    g2048GridEl.addEventListener("touchstart", (e) => { const t = e.touches && e.touches[0]; if (t) g2048SwipeStart(t.clientX, t.clientY); }, { passive: true });
    g2048GridEl.addEventListener("touchend", (e) => { const t = e.changedTouches && e.changedTouches[0]; if (t) g2048SwipeEnd(t.clientX, t.clientY); });
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-game2048").classList.contains("hidden")) return;
        const k = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
        if (k) { g2048Move(k); if (e.preventDefault) e.preventDefault(); }
      });
    }
    g2048New();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get g2048() { return { board: g2048.slice(), score: gScore, over: gOver, won: gWon }; },
        g2048Set(board) { g2048 = board.slice(); g2048Render(); },
        g2048Move(dir) { g2048Move(dir); },
    }));

  };
  /* ---------- 43. 扫雷 ---------- */
  toyInitFns["mines"] = function () {
    const M_ROWS = 9, M_COLS = 9, M_MINES = 10;
    let mCells = [], mStarted = false, mOver = false, mFlagMode = false, mTimer = null, mSeconds = 0;
    function mNew() {
      mCells = [];
      for (let i = 0; i < M_ROWS * M_COLS; i++) mCells.push({ mine: false, revealed: false, flagged: false, count: 0 });
      mStarted = false; mOver = false; mSeconds = 0;
      if (mTimer) { clearInterval(mTimer); mTimer = null; }
      $("minesTime").textContent = "⏱ 0 秒";
      $("minesFaceBtn").textContent = "🙂";
      $("minesStatus").textContent = "点任意格子开始。";
      mRender();
    }
    function mNeighbors(i) {
      const r = Math.floor(i / M_COLS), c = i % M_COLS;
      const out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < M_ROWS && nc >= 0 && nc < M_COLS) out.push(nr * M_COLS + nc);
      }
      return out;
    }
    function mPlaceMines(safe) {
      const safeSet = {};
      safeSet[safe] = true;
      mNeighbors(safe).forEach((n) => { safeSet[n] = true; });
      const pool = [];
      for (let i = 0; i < M_ROWS * M_COLS; i++) if (!safeSet[i]) pool.push(i);
      for (let k = 0; k < M_MINES; k++) {
        const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        mCells[pick].mine = true;
      }
      for (let i = 0; i < M_ROWS * M_COLS; i++) {
        if (mCells[i].mine) continue;
        mCells[i].count = mNeighbors(i).filter((n) => mCells[n].mine).length;
      }
    }
    function mRender() {
      const grid = $("minesGrid");
      grid.innerHTML = "";
      let flags = 0;
      mCells.forEach((cell, i) => {
        if (cell.flagged) flags++;
        const btn = document.createElement("button");
        btn.className = "mines-cell" + (cell.revealed ? " open" : "") + (cell.flagged ? " flagged" : "");
        btn.setAttribute("aria-label", "扫雷格子 " + (Math.floor(i / M_COLS) + 1) + " 行 " + (i % M_COLS + 1) + " 列");
        if (cell.revealed) {
          if (cell.mine) btn.textContent = "💣";
          else if (cell.count > 0) { btn.textContent = cell.count; btn.classList.add("n" + cell.count); }
        } else if (cell.flagged) btn.textContent = "🚩";
        btn.addEventListener("click", () => mClick(i, false));
        btn.addEventListener("contextmenu", (e) => { if (e.preventDefault) e.preventDefault(); mClick(i, true); });
        let pressTimer = null;
        btn.addEventListener("pointerdown", (e) => { if (e && e.button !== undefined && e.button !== 0) return; pressTimer = setTimeout(() => { mClick(i, true); pressTimer = null; }, 450); }); // 右键不进长按计时，不然按住右键 450ms 会多插一次旗再取消
        btn.addEventListener("pointerup", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
        btn.addEventListener("pointerleave", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
        btn.addEventListener("pointercancel", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }); // 系统手势打断长按也要清计时，不然手指都走了还会插旗
        grid.appendChild(btn);
      });
      $("minesLeft").textContent = "💣 剩 " + (M_MINES - flags) + " 颗雷";
    }
    function mStartTimer() {
      if (mTimer) return;
      mTimer = setInterval(() => { mSeconds++; $("minesTime").textContent = "⏱ " + mSeconds + " 秒"; }, 1000);
    }
    function mStopTimer() { if (mTimer) { clearInterval(mTimer); mTimer = null; } }
    function mClick(i, flag) {
      if (mOver) return;
      const cell = mCells[i];
      if (flag) {
        if (cell.revealed) return;
        cell.flagged = !cell.flagged;
        mRender();
        return;
      }
      if (mFlagMode) { if (!cell.revealed) { cell.flagged = !cell.flagged; mRender(); } return; }
      if (cell.revealed || cell.flagged) return;
      if (!mStarted) { mPlaceMines(i); mStarted = true; mStartTimer(); }
      if (cell.mine) {
        cell.revealed = true;
        mOver = true; mStopTimer();
        mCells.forEach((c) => { if (c.mine) c.revealed = true; });
        $("minesFaceBtn").textContent = "😵";
        SFX.lose();
        $("minesStatus").textContent = "💥 踩到雷了！用时 " + mSeconds + " 秒。点新一局再来。";
        mRender();
        return;
      }
      mFlood(i);
      SFX.click();
      mRender();
      if (mCells.every((c) => c.mine || c.revealed)) {
        mOver = true; mStopTimer();
        $("minesFaceBtn").textContent = "😎";
        SFX.win();
        $("minesStatus").textContent = "🎉 赢了！用时 " + mSeconds + " 秒，全挖开了，太强了。";
      }
    }
    function mFlood(i) {
      const cell = mCells[i];
      if (cell.revealed || cell.flagged) return;
      cell.revealed = true;
      if (cell.count === 0) mNeighbors(i).forEach(mFlood);
    }
    $("minesNewBtn").addEventListener("click", mNew);
    $("minesFaceBtn").addEventListener("click", mNew);
    $("minesFlagBtn").addEventListener("click", () => {
      mFlagMode = !mFlagMode;
      $("minesFlagBtn").textContent = mFlagMode ? "🚩 插旗模式：开" : "🚩 插旗模式：关";
    });
    mNew();
    toyLeaveCleanup.mines = () => { mStopTimer(); };
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get mines() { return { cells: mCells, started: mStarted, over: mOver }; },
    }));

  };
  /* ---------- 44. 课程表 ---------- */
  toyInitFns["schedule"] = function () {
    const SCH_KEY = "dorm-toybox-schedule-v1";
    const SCH_DAYS = ["周一", "周二", "周三", "周四", "周五"];
    const SCH_PERIODS = ["第 1-2 节\n8:00", "第 3-4 节\n10:00", "第 5-6 节\n14:00", "第 7-8 节\n16:00", "第 9-10 节\n19:00"];
    const SCH_PERIOD_HOURS = [[8, 10], [10, 12], [14, 16], [16, 18], [19, 21]];
    let schCourses = [];
    let schPendingDelete = null; // v3.0-r16：两点确认删除——点已有课程一次只武装，防手滑误删
    let schPendingCell = null;
    try { schCourses = JSON.parse(localStorage.getItem(SCH_KEY) || "[]") || []; } catch (e) { schCourses = []; }
    function schSave() { try { localStorage.setItem(SCH_KEY, JSON.stringify(schCourses)); } catch (e) { /* 忽略 */ } }
    function schRender() {
      schPendingDelete = null; schPendingCell = null;
      const grid = $("schGrid");
      grid.innerHTML = "";
      const now = new Date();
      const today = now.getDay() - 1; // 周一=0
      const hour = now.getHours() + now.getMinutes() / 60;
      let curPeriod = -1;
      SCH_PERIOD_HOURS.forEach((h, i) => { if (hour >= h[0] && hour < h[1]) curPeriod = i; });
      // 表头
      const corner = document.createElement("div");
      corner.className = "sch-head";
      corner.textContent = "时间";
      grid.appendChild(corner);
      SCH_DAYS.forEach((d, i) => {
        const h = document.createElement("div");
        h.className = "sch-head" + (i === today ? " today" : "");
        h.textContent = d + (i === today ? "（今天）" : "");
        grid.appendChild(h);
      });
      for (let p = 0; p < 5; p++) {
        const label = document.createElement("div");
        label.className = "sch-label" + (p === curPeriod ? " now" : "");
        label.textContent = SCH_PERIODS[p];
        grid.appendChild(label);
        for (let d = 0; d < 5; d++) {
          const cell = document.createElement("button");
          const course = schCourses.find((c) => c.day === d && c.period === p);
          cell.className = "sch-cell" + (d === today ? " today" : "") + (d === today && p === curPeriod ? " now" : "") + (course ? " filled" : "");
          if (course) {
            const nm = document.createElement("span");
            nm.className = "sch-name";
            nm.textContent = course.name;
            cell.appendChild(nm);
            if (course.room) {
              const rm = document.createElement("span");
              rm.className = "sch-room";
              rm.textContent = course.room;
              cell.appendChild(rm);
            }
            if (course.teacher) {
              const tc = document.createElement("span");
              tc.className = "sch-teacher";
              tc.textContent = course.teacher;
              cell.appendChild(tc);
            }
          } else {
            cell.textContent = "＋";
          }
          cell.addEventListener("click", () => {
            if (course) {
              if (schPendingDelete !== course) {
                if (schPendingCell) schPendingCell.classList.remove("armed");
                schPendingDelete = course; schPendingCell = cell;
                cell.classList.add("armed");
                $("schResult").textContent = "再点一次删除「" + course.name + "」，点别处取消。";
                return;
              }
              schPendingDelete = null; schPendingCell = null;
              schCourses = schCourses.filter((c) => c !== course);
              schSave(); schRender();
              $("schResult").textContent = "已删掉「" + course.name + "」。";
            } else {
              if (schPendingCell) schPendingCell.classList.remove("armed");
              schPendingDelete = null; schPendingCell = null;
              $("schDay").value = String(d);
              $("schPeriod").value = String(p);
              $("schName").focus();
              $("schResult").textContent = "已选 " + SCH_DAYS[d] + " " + SCH_PERIODS[p].split("\n")[0] + "，写课程名点加上。";
            }
          });
          grid.appendChild(cell);
        }
      }
      $("schResult").textContent = schCourses.length === 0 ? "还没加课。" : "共 " + schCourses.length + " 门课，点一格可以删。";
    }
    $("schAddBtn").addEventListener("click", () => {
      const name = $("schName").value.trim();
      const room = $("schRoom").value.trim();
      const teacher = $("schTeacher") ? $("schTeacher").value.trim() : "";
      const day = parseInt($("schDay").value, 10);
      const period = parseInt($("schPeriod").value, 10);
      if (!name) { $("schResult").textContent = "先写课程名。"; return; }
      schCourses = schCourses.filter((c) => !(c.day === day && c.period === period));
      schCourses.push({ name, room, teacher, day, period });
      schSave(); schRender();
      $("schName").value = "";
      $("schRoom").value = "";
      if ($("schTeacher")) $("schTeacher").value = "";
      $("schResult").textContent = "已加上「" + name + "」（" + SCH_DAYS[day] + " " + SCH_PERIODS[period].split("\n")[0] + "）。";
    });
    $("schClearBtn").addEventListener("click", () => { schCourses = []; schSave(); schRender(); $("schResult").textContent = "课程表已清空。"; });
    schRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get schedule() { return { courses: schCourses.slice() }; },
    }));

  };
  /* ---------- 43. 打地鼠 ---------- */
  toyInitFns["mole"] = function () {
    const MOLE_KEY = "dorm-toybox-mole-best-v1";
    const MOLE_TIME = 30;
    let moleBest = loadBest(MOLE_KEY);
    let moleScore = 0, moleTimeLeft = MOLE_TIME, moleRunning = false;
    let moleTimerId = null, molePopId = null, moleHideIds = [];
    const moleActive = new Set();
    const moleGrid = $("moleGrid");
    const moleHoles = [];
    for (let i = 0; i < 9; i++) {
      const b = document.createElement("button");
      b.className = "mole-hole";
      b.textContent = "🕳️";
      b.setAttribute("aria-label", "洞 " + (i + 1));
      b.addEventListener("click", () => moleWhack(i));
      moleGrid.appendChild(b);
      moleHoles.push(b);
    }
    function moleRender() {
      $("moleStats").textContent = "得分 " + moleScore + " · 剩余 " + moleTimeLeft + " 秒 · 最好 " + moleBest;
    }
    function molePop() {
      if (!moleRunning) return;
      const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => !moleActive.has(i));
      if (free.length === 0) { molePopId = setTimeout(molePop, 400); return; }
      const i = free[Math.floor(Math.random() * free.length)];
      moleActive.add(i);
      moleHoles[i].classList.add("up");
      moleHoles[i].textContent = "🐹";
      const hideId = setTimeout(() => {
        moleActive.delete(i);
        moleHoles[i].classList.remove("up");
        moleHoles[i].textContent = "🕳️";
      }, 800 + Math.random() * 500);
      moleHideIds.push(hideId);
      molePopId = setTimeout(molePop, 350 + Math.random() * 450);
    }
    // v1.32：敲中粒子爆发 + 飘字
    function moleBurst(hole) {
      hole.classList.add("whacked");
      setTimeout(() => hole.classList.remove("whacked"), 220);
      const bits = ["💥", "✨", "⭐", "💫"];
      for (let k = 0; k < 6; k++) {
        const p = document.createElement("span");
        p.className = "mole-particle";
        p.textContent = bits[k % bits.length];
        if (p.style.setProperty) { // 测试桩的 style 是普通对象，跳过
          p.style.setProperty("--dx", (Math.random() * 90 - 45).toFixed(0) + "px");
          p.style.setProperty("--dy", (-Math.random() * 70 - 15).toFixed(0) + "px");
        }
        hole.appendChild(p);
        setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 600);
      }
    }
    function moleFloat(hole, text) {
      const f = document.createElement("span");
      f.className = "mole-float";
      f.textContent = text;
      hole.appendChild(f);
      setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 800);
    }
    function moleWhack(i) {
      if (!moleRunning) return;
      if (moleActive.has(i)) {
        moleActive.delete(i);
        moleHoles[i].classList.remove("up");
        moleHoles[i].textContent = "🕳️";
        moleScore++;
        SFX.hit();
        moleBurst(moleHoles[i]);
        moleFloat(moleHoles[i], "+1");
        $("moleResult").textContent = "🔨 敲中！得分 " + moleScore + "。";
        moleRender();
      }
    }
    function moleEnd() {
      moleRunning = false;
      if (moleTimerId) { clearInterval(moleTimerId); moleTimerId = null; }
      if (molePopId) { clearTimeout(molePopId); molePopId = null; }
      moleHideIds.forEach((id) => clearTimeout(id));
      moleHideIds = [];
      moleActive.forEach((i) => { moleHoles[i].classList.remove("up"); moleHoles[i].textContent = "🕳️"; });
      moleActive.clear();
      const isBest = moleScore > moleBest;
      if (isBest) {
        moleBest = moleScore;
        saveBest(MOLE_KEY, moleBest);
      }
      $("moleResult").textContent = "⏰ 时间到！得分 " + moleScore + (isBest ? "，新纪录！🎉" : "，最好 " + moleBest + "。");
      $("moleStartBtn").textContent = "重开 ↺";
      moleRender();
    }
    function moleStart() {
      if (moleRunning) return;
      moleScore = 0;
      moleTimeLeft = MOLE_TIME;
      moleRunning = true;
      $("moleResult").textContent = "地鼠冒头就敲！";
      $("moleStartBtn").textContent = "进行中……";
      moleRender();
      molePopId = setTimeout(molePop, 300);
      moleTimerId = setInterval(() => {
        moleTimeLeft--;
        moleRender();
        if (moleTimeLeft <= 0) moleEnd();
      }, 1000);
    }
    $("moleStartBtn").addEventListener("click", moleStart);
    moleRender();
    toyLeaveCleanup.mole = () => {
      if (!moleRunning) return;
      moleRunning = false;
      if (moleTimerId) { clearInterval(moleTimerId); moleTimerId = null; }
      if (molePopId) { clearTimeout(molePopId); molePopId = null; }
      moleHideIds.forEach((id) => clearTimeout(id));
      moleHideIds = [];
      moleActive.forEach((i) => { moleHoles[i].classList.remove("up"); moleHoles[i].textContent = "🕳️"; });
      moleActive.clear();
      $("moleStartBtn").textContent = "开始 ▶";
    };
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get mole() { return { score: moleScore, timeLeft: moleTimeLeft, running: moleRunning, active: [...moleActive], best: moleBest }; },
        moleStart() { moleStart(); },
        moleForce(i) { if (moleRunning && !moleActive.has(i)) { moleActive.add(i); moleHoles[i].classList.add("up"); moleHoles[i].textContent = "🐹"; } },
    }));

  };
  /* ---------- 44. 五子棋 ---------- */
  toyInitFns["gomoku"] = function () {
    const GOMOKU_SIZE = 15;
    let gBoard = new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(0); // 0 空 1 黑 2 白
    let gTurn = 1; // 1 黑 2 白
    let gWinner = 0; // 0 未分 1 黑胜 2 白胜 3 平
    let gMoves = 0;
    let gLast = -1;
    let gMode = "solo"; // solo：单人对电脑；duo：双人对战
    const gomokuBoardEl = $("gomokuBoard");
    const gomokuCells = [];
    for (let i = 0; i < GOMOKU_SIZE * GOMOKU_SIZE; i++) {
      const b = document.createElement("button");
      b.className = "gomoku-cell";
      b.setAttribute("aria-label", "第 " + (Math.floor(i / GOMOKU_SIZE) + 1) + " 行第 " + (i % GOMOKU_SIZE + 1) + " 列");
      b.addEventListener("click", () => gomokuPlace(i));
      gomokuBoardEl.appendChild(b);
      gomokuCells.push(b);
    }
    function gomokuRender() {
      gomokuCells.forEach((cell, i) => {
        cell.innerHTML = "";
        if (gBoard[i] !== 0) {
          const s = document.createElement("span");
          s.className = "gomoku-stone " + (gBoard[i] === 1 ? "black" : "white") + (i === gLast ? " last" : "");
          cell.appendChild(s);
        }
      });
      const black = gBoard.filter((v) => v === 1).length;
      const white = gBoard.filter((v) => v === 2).length;
      $("gomokuStats").textContent = "已下 " + gMoves + " 手 · 黑 " + black + " : " + white + " 白";
      const turnEl = $("gomokuTurn");
      if (gWinner === 1) { $("gomokuResult").textContent = gMode === "duo" ? "🎉 黑方赢了！五子连珠！" : "🎉 你赢了！五子连珠！"; turnEl.textContent = "🏁 黑方获胜"; }
      else if (gWinner === 2) { $("gomokuResult").textContent = gMode === "duo" ? "🎉 白方赢了！五子连珠！" : "🤖 电脑赢了。再来一局？"; turnEl.textContent = "🏁 白方获胜"; }
      else if (gWinner === 3) { $("gomokuResult").textContent = "🤝 平局，棋盘下满了。"; turnEl.textContent = "🤝 平局"; }
      else if (gMode === "duo") {
        $("gomokuResult").textContent = gTurn === 1 ? "轮到黑方落子。" : "轮到白方落子。";
        turnEl.textContent = gTurn === 1 ? "⚫ 轮到黑方落子" : "⚪ 轮到白方落子";
      } else {
        $("gomokuResult").textContent = gTurn === 1 ? "轮到你落子（黑）。" : "电脑思考中……";
        turnEl.textContent = gTurn === 1 ? "⚫ 轮到你（黑）" : "⚪ 电脑（白）思考中";
      }
    }
    function gomokuLineLen(idx, color) {
      // 以 idx 为中心，四方向连子数（含自己）
      const r = Math.floor(idx / GOMOKU_SIZE), c = idx % GOMOKU_SIZE;
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      let best = 1;
      dirs.forEach(([dr, dc]) => {
        let n = 1;
        for (let k = 1; k < 5; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= GOMOKU_SIZE || cc < 0 || cc >= GOMOKU_SIZE || gBoard[rr * GOMOKU_SIZE + cc] !== color) break;
          n++;
        }
        for (let k = 1; k < 5; k++) {
          const rr = r - dr * k, cc = c - dc * k;
          if (rr < 0 || rr >= GOMOKU_SIZE || cc < 0 || cc >= GOMOKU_SIZE || gBoard[rr * GOMOKU_SIZE + cc] !== color) break;
          n++;
        }
        if (n > best) best = n;
      });
      return best;
    }
    function gomokuScoreCell(idx) {
      // 电脑（白）落这里的分数：能赢最高，必须堵黑的五连次之，其余按连子数
      const saved = gBoard[idx];
      gBoard[idx] = 2;
      const w = gomokuLineLen(idx, 2);
      gBoard[idx] = 1;
      const b = gomokuLineLen(idx, 1);
      gBoard[idx] = saved;
      if (w >= 5) return 1000000;
      if (b >= 5) return 900000;
      if (w === 4) return 50000;
      if (b === 4) return 45000;
      if (w === 3) return 5000;
      if (b === 3) return 4500;
      if (w === 2) return 500;
      if (b === 2) return 450;
      return 10 + Math.random() * 5;
    }
    function gomokuAiMove() {
      if (gWinner !== 0 || gTurn !== 2) return;
      let bestIdx = -1, bestScore = -1;
      for (let i = 0; i < gBoard.length; i++) {
        if (gBoard[i] !== 0) continue;
        const s = gomokuScoreCell(i);
        if (s > bestScore) { bestScore = s; bestIdx = i; }
      }
      if (bestIdx === -1) { gWinner = 3; gomokuRender(); return; }
      gBoard[bestIdx] = 2;
      gLast = bestIdx;
      gMoves++;
      SFX.click();
      if (gomokuLineLen(bestIdx, 2) >= 5) { gWinner = 2; SFX.win(); }
      else if (gBoard.every((v) => v !== 0)) gWinner = 3;
      else gTurn = 1;
      gomokuRender();
    }
    function gomokuPlace(idx) {
      if (gWinner !== 0 || gBoard[idx] !== 0) return;
      // 单人模式：只接受黑方（你）落子，白方是电脑；双人模式：黑白轮流落子
      if (gMode === "solo" && gTurn !== 1) return;
      gBoard[idx] = gTurn;
      gLast = idx;
      gMoves++;
      SFX.click();
      if (gomokuLineLen(idx, gTurn) >= 5) { gWinner = gTurn; SFX.win(); gomokuRender(); return; }
      if (gBoard.every((v) => v !== 0)) { gWinner = 3; gomokuRender(); return; }
      gTurn = gTurn === 1 ? 2 : 1;
      gomokuRender();
      if (gMode === "solo") setTimeout(gomokuAiMove, 250);
    }
    function gomokuReset() {
      gBoard = new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(0);
      gTurn = 1; gWinner = 0; gMoves = 0; gLast = -1;
      gomokuRender();
    }
    function gomokuSetMode(mode) {
      if (mode !== "solo" && mode !== "duo") return;
      gMode = mode;
      $("gomokuSoloBtn").classList.toggle("picked", mode === "solo");
      $("gomokuDuoBtn").classList.toggle("picked", mode === "duo");
      gomokuReset();
    }
    $("gomokuSoloBtn").addEventListener("click", () => gomokuSetMode("solo"));
    $("gomokuDuoBtn").addEventListener("click", () => gomokuSetMode("duo"));
    $("gomokuResetBtn").addEventListener("click", gomokuReset);
    gomokuRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get gomoku() { return { board: gBoard.slice(), turn: gTurn, winner: gWinner, moves: gMoves, mode: gMode }; },
        gomokuSet(board, turn) { gBoard = board.slice(); gTurn = turn || 1; gWinner = 0; gMoves = gBoard.filter((v) => v !== 0).length; gLast = -1; gomokuRender(); },
        gomokuAiMove() { gomokuAiMove(); },
        gomokuSetMode(mode) { gomokuSetMode(mode); },
    }));

  };
  /* ---------- 45. 迷你钢琴 ---------- */
  toyInitFns["piano"] = function () {
    const PIANO_NOTES = [
      { name: "C4", label: "哆", freq: 261.63, key: "a", black: false },
      { name: "C#4", label: "C#", freq: 277.18, key: "w", black: true },
      { name: "D4", label: "来", freq: 293.66, key: "s", black: false },
      { name: "D#4", label: "D#", freq: 311.13, key: "e", black: true },
      { name: "E4", label: "咪", freq: 329.63, key: "d", black: false },
      { name: "F4", label: "发", freq: 349.23, key: "f", black: false },
      { name: "F#4", label: "F#", freq: 369.99, key: "t", black: true },
      { name: "G4", label: "索", freq: 392.0, key: "g", black: false },
      { name: "G#4", label: "G#", freq: 415.3, key: "y", black: true },
      { name: "A4", label: "拉", freq: 440.0, key: "h", black: false },
      { name: "A#4", label: "A#", freq: 466.16, key: "u", black: true },
      { name: "B4", label: "西", freq: 493.88, key: "j", black: false },
    ];
    let pianoCtx = null;
    let pianoLastNote = "";
    let pianoSongTimers = [];
    const pianoKeyBtns = {}; // note 名字 -> 琴键按钮（不用 document.querySelector，冒烟桩没有它）
    function pianoAudio() {
      if (pianoCtx) return pianoCtx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        pianoCtx = new AC();
        return pianoCtx;
      } catch (e) { return null; }
    }
    const PIANO_REC_KEY = "dorm-toybox-piano-rec-v1";
    let pianoRecording = false;
    let pianoRecNotes = []; // [{note, t}]
    let pianoRecStart = 0;
    function pianoPlay(noteName, noRec) {
      const note = PIANO_NOTES.find((n) => n.name === noteName);
      if (!note) return;
      pianoLastNote = note.name + " " + note.label;
      // 录音
      if (pianoRecording && !noRec) {
        pianoRecNotes.push({ note: noteName, t: performance.now() - pianoRecStart });
      }
      $("pianoLast").textContent = "上一个音：" + pianoLastNote + "（键盘 " + note.key.toUpperCase() + "）";
      Object.values(pianoKeyBtns).forEach((el) => el.classList.remove("active"));
      const btn = pianoKeyBtns[note.name];
      if (btn) { btn.classList.add("active"); setTimeout(() => btn.classList.remove("active"), 250); }
      const ctx = pianoAudio();
      if (!ctx) return;
      try {
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      } catch (e) { /* 忽略音频错误 */ }
    }
    let pianoPointerDown = false; // v3.0-r16：按住滑过琴键连续弹（滑音），手机上跟手；click 有延迟且不能滑
    function pianoBindKey(b, note) {
      b.addEventListener("pointerdown", (e) => {
        if (e.preventDefault) e.preventDefault();
        pianoPlay(note.name);
      });
      b.addEventListener("pointerenter", () => { if (pianoPointerDown) pianoPlay(note.name); });
    }
    (function buildPiano() {
      const wrap = $("pianoKeys");
      const whites = PIANO_NOTES.filter((n) => !n.black);
      whites.forEach((note) => {
        const b = document.createElement("button");
        b.className = "piano-white";
        b.setAttribute("data-note", note.name);
        b.textContent = note.label + " " + note.key.toUpperCase();
        pianoBindKey(b, note);
        pianoKeyBtns[note.name] = b;
        wrap.appendChild(b);
      });
      // 黑键按白键之间的位置排：C# 在 C/D 之间，D# 在 D/E 之间，F# 在 F/G 之间，G# 在 G/A 之间，A# 在 A/B 之间
      const blackPos = { "C#4": 1, "D#4": 2, "F#4": 4, "G#4": 5, "A#4": 6 };
      PIANO_NOTES.filter((n) => n.black).forEach((note) => {
        const b = document.createElement("button");
        b.className = "piano-black";
        b.setAttribute("data-note", note.name);
        b.style.left = "calc(" + (blackPos[note.name] / 7 * 100) + "% - 5.5%)";
        b.textContent = note.key.toUpperCase();
        pianoBindKey(b, note);
        pianoKeyBtns[note.name] = b;
        wrap.appendChild(b);
      });
    })();
    if (typeof document.addEventListener === "function") {
      document.addEventListener("pointerdown", () => { pianoPointerDown = true; });
      document.addEventListener("pointerup", () => { pianoPointerDown = false; });
      document.addEventListener("pointercancel", () => { pianoPointerDown = false; });
    }
    if (typeof document.addEventListener === "function") {
      document.addEventListener("keydown", (e) => {
        if ($("toy-piano").classList.contains("hidden")) return;
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        const note = PIANO_NOTES.find((n) => n.key === e.key.toLowerCase());
        if (note && !e.repeat) pianoPlay(note.name);
      });
    }
    const PIANO_SONGS = {
      star: ["C4", "C4", "G4", "G4", "A4", "A4", "G4", "F4", "F4", "E4", "E4", "D4", "D4", "C4"],
      tiger: ["C4", "D4", "E4", "C4", "C4", "D4", "E4", "C4", "E4", "F4", "G4", "E4", "F4", "G4", "G4", "A4", "G4", "F4", "E4", "C4", "G4", "A4", "G4", "F4", "E4", "C4", "C4", "G4", "C4", "C4", "G4", "C4"],
    };
    function pianoStopSong() {
      pianoSongTimers.forEach((id) => clearTimeout(id));
      pianoSongTimers = [];
      $("pianoResult").textContent = "停了。";
    }
    function pianoPlaySong(key, title) {
      pianoStopSong();
      $("pianoResult").textContent = "♪ 正在弹《" + title + "》……";
      PIANO_SONGS[key].forEach((note, i) => {
        pianoSongTimers.push(setTimeout(() => {
          pianoPlay(note);
          if (i === PIANO_SONGS[key].length - 1) $("pianoResult").textContent = "♪ 《" + title + "》弹完了。";
        }, i * 450));
      });
    }
    $("pianoSong1Btn").addEventListener("click", () => pianoPlaySong("star", "小星星"));
    $("pianoSong2Btn").addEventListener("click", () => pianoPlaySong("tiger", "两只老虎"));
    $("pianoStopBtn").addEventListener("click", pianoStopSong);
    // 和弦：C=E G=C E G，G=G B D，Am=A C E，F=F A C
    const PIANO_CHORDS = { C: ["C4", "E4", "G4"], G: ["G4", "B4", "D4"], Am: ["A4", "C4", "E4"], F: ["F4", "A4", "C4"] };
    Object.keys(PIANO_CHORDS).forEach((ch) => {
      const b = $("pianoChord" + ch);
      if (b) b.addEventListener("click", () => {
        PIANO_CHORDS[ch].forEach((n, i) => setTimeout(() => pianoPlay(n), i * 30));
        $("pianoLast").textContent = "和弦：" + ch;
      });
    });
    // 录音 / 回放
    function pianoSaveRec() {
      try { localStorage.setItem(PIANO_REC_KEY, JSON.stringify(pianoRecNotes.slice(0, 200))); } catch (e) {}
    }
    const recBtn = $("pianoRecBtn"), playRecBtn = $("pianoPlayRecBtn");
    if (recBtn) recBtn.addEventListener("click", () => {
      if (pianoRecording) {
        pianoRecording = false;
        pianoSaveRec();
        recBtn.textContent = "⏺ 录音";
        recBtn.classList.remove("active");
        $("pianoResult").textContent = "⏹ 录音结束，已保存 " + pianoRecNotes.length + " 个音。";
      } else {
        pianoRecording = true;
        pianoRecNotes = [];
        pianoRecStart = performance.now();
        recBtn.textContent = "⏹ 停止录音";
        recBtn.classList.add("active");
        $("pianoResult").textContent = "⏺ 录音中…弹吧！";
      }
    });
    if (playRecBtn) playRecBtn.addEventListener("click", () => {
      let saved = [];
      try { saved = JSON.parse(localStorage.getItem(PIANO_REC_KEY) || "[]"); } catch (e) {}
      if (!saved.length) { $("pianoResult").textContent = "还没有录音，先点 ⏺ 录一段。"; return; }
      pianoStopSong();
      $("pianoResult").textContent = "♪ 回放中…（" + saved.length + " 个音）";
      saved.forEach((r) => {
        pianoSongTimers.push(setTimeout(() => pianoPlay(r.note, true), r.t));
      });
      pianoSongTimers.push(setTimeout(() => { $("pianoResult").textContent = "♪ 回放完了。"; }, (saved[saved.length - 1].t || 0) + 600));
    });
    toyLeaveCleanup.piano = () => { pianoStopSong(); pianoRecording = false; };
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get piano() { return { lastNote: pianoLastNote }; },
        pianoPlay(name) { pianoPlay(name); },
    }));

  };
  /* ---------- 46. 抽卡模拟器 ---------- */
  toyInitFns["gacha"] = function () {
    const GACHA_KEY = "dorm-toybox-gacha-v1";
    const GACHA_RATES_KEY = "dorm-toybox-gacha-rates-v1";
    const GACHA_DEFAULT_RATES = { ssr: 3, sr: 15 }; // R = 100 - ssr - sr
    let gachaRates = { ssr: 3, sr: 15 };
    try {
      const savedRates = JSON.parse(localStorage.getItem(GACHA_RATES_KEY) || "null");
      if (savedRates && typeof savedRates.ssr === "number" && typeof savedRates.sr === "number"
        && savedRates.ssr >= 0 && savedRates.sr >= 0 && savedRates.ssr + savedRates.sr <= 100) gachaRates = savedRates;
    } catch (e) { /* 忽略 */ }
    function gachaSaveRates() {
      try { localStorage.setItem(GACHA_RATES_KEY, JSON.stringify(gachaRates)); } catch (e) { /* 忽略 */ }
    }
    function gachaRenderRates() {
      const r = 100 - gachaRates.ssr - gachaRates.sr;
      $("gachaSsrVal").textContent = gachaRates.ssr + "%";
      $("gachaSrVal").textContent = gachaRates.sr + "%";
      $("gachaRatesLine").textContent = "R " + r + "%（自动补齐到 100%）";
      $("gachaSsrRange").value = String(gachaRates.ssr);
      $("gachaSrRange").value = String(gachaRates.sr);
    }
    function gachaSetRates(ssr, sr) {
      // 钳制：SSR 0-50，SR 0-80，两者之和 ≤ 100（R 不能为负）
      ssr = Math.max(0, Math.min(50, Math.round(ssr)));
      sr = Math.max(0, Math.min(80, Math.round(sr)));
      if (ssr + sr > 100) sr = 100 - ssr;
      gachaRates = { ssr, sr };
      gachaSaveRates();
      gachaRenderRates();
    }
    $("gachaSsrRange").addEventListener("input", (e) => gachaSetRates(parseInt(e.target.value, 10), gachaRates.sr));
    $("gachaSrRange").addEventListener("input", (e) => gachaSetRates(gachaRates.ssr, parseInt(e.target.value, 10)));
    $("gachaRatesResetBtn").addEventListener("click", () => { gachaSetRates(GACHA_DEFAULT_RATES.ssr, GACHA_DEFAULT_RATES.sr); });
    const GACHA_POOL = {
      SSR: [
        { name: "传奇学霸", emoji: "🌟" }, { name: "龙系锦鲤", emoji: "🐉" }, { name: "宿舍之王", emoji: "👑" },
      ],
      SR: [
        { name: "乐队主唱", emoji: "🎸" }, { name: "摄影大佬", emoji: "📸" }, { name: "球场 MVP", emoji: "🏀" }, { name: "电竞高手", emoji: "🎮" },
      ],
      R: [
        { name: "泡图书馆的", emoji: "📚" }, { name: "干饭人", emoji: "🍜" }, { name: "睡神", emoji: "😴" },
        { name: "值日标兵", emoji: "🧹" }, { name: "散步达人", emoji: "🚶" }, { name: "刷手机的", emoji: "📱" },
      ],
    };
    let gachaState = { total: 0, ssr: 0, sr: 0, r: 0, pity: 0, owned: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(GACHA_KEY) || "null");
      if (saved && typeof saved.total === "number") {
        gachaState = saved;
        // v3.0-r17：旧存档可能没有 pity/owned（缺字段会让统计/图鉴直接崩掉，整个玩具初始化失败）
        if (typeof gachaState.pity !== "number" || !isFinite(gachaState.pity) || gachaState.pity < 0) gachaState.pity = 0;
        if (!Array.isArray(gachaState.owned)) gachaState.owned = [];
        if (typeof gachaState.ssr !== "number") gachaState.ssr = 0;
        if (typeof gachaState.sr !== "number") gachaState.sr = 0;
        if (typeof gachaState.r !== "number") gachaState.r = 0;
        gachaSave();
      }
    } catch (e) { /* 忽略 */ }
    let gachaLastPull = [];
    function gachaSave() {
      try { localStorage.setItem(GACHA_KEY, JSON.stringify(gachaState)); } catch (e) { /* 忽略 */ }
    }
    function gachaRollRarity(forceMinSR) {
      // 90 抽保底 SSR；十连最后一张保底 SR；概率按用户自调的来
      if (gachaState.pity >= 89) return "SSR";
      const roll = Math.random();
      const ssrP = gachaRates.ssr / 100, srP = (gachaRates.ssr + gachaRates.sr) / 100;
      if (forceMinSR) return roll < ssrP ? "SSR" : "SR";
      if (roll < ssrP) return "SSR";
      if (roll < srP) return "SR";
      return "R";
    }
    function gachaDrawOne(forceMinSR) {
      const rarity = gachaRollRarity(forceMinSR);
      const card = pick(GACHA_POOL[rarity]);
      gachaState.total++;
      if (rarity === "SSR") { gachaState.ssr++; gachaState.pity = 0; }
      else if (rarity === "SR") { gachaState.sr++; gachaState.pity++; }
      else { gachaState.r++; gachaState.pity++; }
      const id = rarity + ":" + card.name;
      if (!gachaState.owned.includes(id)) gachaState.owned.push(id);
      gachaSave();
      return { rarity, name: card.name, emoji: card.emoji };
    }
    function gachaRenderCards() {
      const wrap = $("gachaCards");
      wrap.innerHTML = "";
      gachaLastPull.forEach((c) => {
        const d = document.createElement("div");
        d.className = "gacha-card r-" + c.rarity.toLowerCase();
        const em = document.createElement("span");
        em.textContent = c.emoji;
        const nm = document.createElement("span");
        nm.style.fontSize = "12px";
        nm.textContent = c.name;
        const rr = document.createElement("span");
        rr.className = "gacha-rarity";
        rr.textContent = c.rarity;
        d.appendChild(em);
        d.appendChild(nm);
        d.appendChild(rr);
        wrap.appendChild(d);
      });
    }
    function gachaRenderStats() {
      $("gachaStats").textContent = "已抽 " + gachaState.total + " · SSR " + gachaState.ssr + " · SR " + gachaState.sr + " · R " + gachaState.r
        + " · 距 SSR 保底 " + (90 - gachaState.pity) + " 抽 · 图鉴 " + gachaState.owned.length + "/13";
    }
    // ---- 新增：图鉴画廊（localStorage 已持久化 owned） ----
    const GACHA_DEX_KEY = "dorm-toybox-gacha-dex-v1";
    // 同步到独立 dex key（任务要求）
    try {
      localStorage.setItem(GACHA_DEX_KEY, JSON.stringify(gachaState.owned));
    } catch (e) {}
    function gachaRenderDex() {
      let dexWrap = $("gachaDex");
      if (!dexWrap) {
        const sec = $("toy-gacha");
        if (!sec) return;
        dexWrap = document.createElement("div");
        dexWrap.id = "gachaDex";
        dexWrap.className = "gacha-dex";
        sec.appendChild(dexWrap);
      }
      dexWrap.innerHTML = "";
      const allCards = [];
      Object.keys(GACHA_POOL).forEach((rar) => {
        GACHA_POOL[rar].forEach((c) => allCards.push({ ...c, rarity: rar, id: rar + ":" + c.name }));
      });
      const title = document.createElement("p");
      title.style.width = "100%"; title.style.margin = "0 0 6px 0"; title.style.fontWeight = "bold";
      title.textContent = "📖 图鉴收集（" + gachaState.owned.length + "/" + allCards.length + "）";
      dexWrap.appendChild(title);
      allCards.forEach((c) => {
        const item = document.createElement("div");
        item.className = "gacha-dex-item" + (gachaState.owned.includes(c.id) ? "" : " missing");
        const em = document.createElement("span");
        em.className = "dex-emoji"; em.textContent = c.emoji;
        const nm = document.createElement("span"); nm.textContent = c.name;
        const rr = document.createElement("span");
        rr.textContent = c.rarity;
        rr.style.color = c.rarity === "SSR" ? "#ffd700" : c.rarity === "SR" ? "#c0c0ff" : "#999";
        item.appendChild(em); item.appendChild(nm); item.appendChild(rr);
        dexWrap.appendChild(item);
      });
    }
    function gachaPull(n) {
      gachaLastPull = [];
      for (let i = 0; i < n; i++) {
        // 十连最后一张保底 SR
        gachaLastPull.push(gachaDrawOne(n === 10 && i === 9));
      }
      gachaRenderCards();
      gachaRenderDex();
      try { localStorage.setItem(GACHA_DEX_KEY, JSON.stringify(gachaState.owned)); } catch (e) {}
      gachaRenderStats();
      const ssrCount = gachaLastPull.filter((c) => c.rarity === "SSR").length;
      const srCount = gachaLastPull.filter((c) => c.rarity === "SR").length;
      $("gachaResult").textContent = n === 1
        ? "抽到 " + gachaLastPull[0].emoji + " " + gachaLastPull[0].name + "（" + gachaLastPull[0].rarity + "）！"
        : "十连结果：SSR " + ssrCount + " 张，SR " + srCount + " 张，R " + (10 - ssrCount - srCount) + " 张"
          + (ssrCount > 0 ? "，出 SSR 了！🎉" : "，没出 SSR，下次再来。");
    }
    $("gachaOneBtn").addEventListener("click", () => gachaPull(1));
    $("gachaTenBtn").addEventListener("click", () => gachaPull(10));
    $("gachaResetBtn").addEventListener("click", () => {
      gachaState = { total: 0, ssr: 0, sr: 0, r: 0, pity: 0, owned: [] };
      gachaLastPull = [];
      gachaSave();
      gachaRenderCards();
      gachaRenderDex();
      try { localStorage.setItem(GACHA_DEX_KEY, JSON.stringify(gachaState.owned)); } catch (e) {}
      gachaRenderStats();
      $("gachaResult").textContent = "记录已清空。";
    });
    gachaRenderRates();
    gachaRenderStats();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get gacha() { return { total: gachaState.total, ssr: gachaState.ssr, sr: gachaState.sr, r: gachaState.r, pity: gachaState.pity, owned: gachaState.owned.length, lastPull: gachaLastPull.map((c) => c.rarity), rates: { ssr: gachaRates.ssr, sr: gachaRates.sr, r: 100 - gachaRates.ssr - gachaRates.sr } }; },
        gachaSetPity(n) { gachaState.pity = n; gachaSave(); },
        gachaPull(n) { gachaPull(n); },
        gachaSetRates(ssr, sr) { gachaSetRates(ssr, sr); },
    }));

  };
  /* ---------- 通用滑动绑定（推箱子用；2048 保持原样不动） ---------- */
  // pointer + touch 双路径，一次触摸只触发一次方向（去重），顺带禁掉页面滚动
  function bindSwipe(el, onDir) {
    let start = null, fired = false;
    function s(x, y) { start = { x, y }; fired = false; }
    function e(x, y) {
      if (!start || fired) return;
      fired = true;
      const dx = x - start.x, dy = y - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    }
    el.addEventListener("pointerdown", (ev) => s(ev.clientX, ev.clientY));
    el.addEventListener("pointerup", (ev) => e(ev.clientX, ev.clientY));
    el.addEventListener("pointercancel", () => { /* 保留起点，等 touchend 兜底 */ });
    el.addEventListener("touchmove", (ev) => { if (ev.cancelable) ev.preventDefault(); }, { passive: false });
    el.addEventListener("touchstart", (ev) => { const t = ev.touches && ev.touches[0]; if (t) s(t.clientX, t.clientY); }, { passive: true });
    el.addEventListener("touchend", (ev) => { const t = ev.changedTouches && ev.changedTouches[0]; if (t) e(t.clientX, t.clientY); });
  }

  /* ---------- 47. 推箱子 ---------- */
  toyInitFns["sokoban"] = function () {
    const SOKOBAN_LEVELS = [
      ["#######", "#     #", "# ..  #", "# $$  #", "#  @  #", "#     #", "#######"],
      ["########", "#      #", "# .  . #", "# $  $ #", "#   $  #", "#  .@  #", "#      #", "########"],
      ["#########", "#       #", "# . . . #", "# $ $ $ #", "#    #  #", "#  @    #", "#########"],
    ];
    let sokobanLevel = 0, sokobanW = 0, sokobanH = 0;
    let sokobanWalls = null, sokobanTargets = null, sokobanBoxes = [], sokobanPlayer = null;
    let sokobanMoves = 0, sokobanWon = false;
    let sokobanHistory = []; // v3.0-r15：悔棋栈。箱子推到墙角会卡死，以前只能重开本关
    function sokobanLoad(level) {
      sokobanLevel = level;
      const rows = SOKOBAN_LEVELS[level];
      sokobanH = rows.length; sokobanW = rows[0].length;
      sokobanWalls = new Set(); sokobanTargets = new Set(); sokobanBoxes = [];
      rows.forEach((r, y) => { [...r].forEach((c, x) => {
        const k = x + "," + y;
        if (c === "#") sokobanWalls.add(k);
        if (c === "." || c === "*" || c === "+") sokobanTargets.add(k);
        if (c === "@" || c === "+") sokobanPlayer = { x, y };
        if (c === "$" || c === "*") sokobanBoxes.push({ x, y });
      }); });
      sokobanMoves = 0; sokobanWon = false;
      sokobanHistory = [];
      ["sokobanL1Btn", "sokobanL2Btn", "sokobanL3Btn"].forEach((id, i) => $(id).classList.toggle("picked", i === level));
      sokobanRender();
      $("sokobanStatus").textContent = "第 " + (level + 1) + " 关：把所有箱子推到🎯上。";
      $("sokobanStats").textContent = "已走 0 步";
    }
    function sokobanRender() {
      const grid = $("sokobanGrid");
      grid.style.gridTemplateColumns = "repeat(" + sokobanW + ", 1fr)";
      grid.innerHTML = "";
      for (let y = 0; y < sokobanH; y++) {
        for (let x = 0; x < sokobanW; x++) {
          const k = x + "," + y;
          const cell = document.createElement("div");
          const isBox = sokobanBoxes.some((b) => b.x === x && b.y === y);
          const isPlayer = sokobanPlayer && sokobanPlayer.x === x && sokobanPlayer.y === y;
          const isTarget = sokobanTargets.has(k);
          cell.className = "sokoban-cell"
            + (sokobanWalls.has(k) ? " wall" : "")
            + (isTarget ? " target" : "")
            + (isBox && isTarget ? " boxdone" : "");
          if (sokobanWalls.has(k)) cell.textContent = "🧱";
          else if (isPlayer) cell.textContent = "🧑";
          else if (isBox) cell.textContent = isTarget ? "✅" : "📦";
          else if (isTarget) cell.textContent = "🎯";
          grid.appendChild(cell);
        }
      }
      $("sokobanStats").textContent = "已走 " + sokobanMoves + " 步";
    }
    const SOKOBAN_DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    function sokobanMove(dir) {
      if (sokobanWon || !SOKOBAN_DIRS[dir]) return;
      const [dx, dy] = SOKOBAN_DIRS[dir];
      const nx = sokobanPlayer.x + dx, ny = sokobanPlayer.y + dy;
      if (sokobanWalls.has(nx + "," + ny)) return;
      const bi = sokobanBoxes.findIndex((b) => b.x === nx && b.y === ny);
      if (bi !== -1) {
        const bx = nx + dx, by = ny + dy;
        if (sokobanWalls.has(bx + "," + by)) return;
        if (sokobanBoxes.some((b) => b.x === bx && b.y === by)) return;
      }
      // v3.0-r15：走棋前记一步快照，悔棋用（只记能走成的步，撞墙/推不动不记；必须在改箱子之前拍）
      sokobanHistory.push({ player: { x: sokobanPlayer.x, y: sokobanPlayer.y }, boxes: sokobanBoxes.map((b) => ({ x: b.x, y: b.y })), moves: sokobanMoves });
      if (sokobanHistory.length > 500) sokobanHistory.shift();
      if (bi !== -1) {
        sokobanBoxes[bi] = { x: nx + dx, y: ny + dy };
        SFX.click();
      }
      sokobanPlayer = { x: nx, y: ny };
      sokobanMoves++;
      if (sokobanBoxes.every((b) => sokobanTargets.has(b.x + "," + b.y))) {
        sokobanWon = true;
        SFX.win();
        $("sokobanStatus").textContent = "🎉 第 " + (sokobanLevel + 1) + " 关通过！用了 " + sokobanMoves + " 步。"
          + (sokobanLevel < 2 ? " 点第 " + (sokobanLevel + 2) + " 关继续。" : " 三关全通，你是推箱子大师！");
      }
      sokobanRender();
    }
    // v3.0-r15：悔棋——退回上一步（人+箱子+步数一起还原）；通关后悔棋可继续推
    function sokobanUndo() {
      const prev = sokobanHistory.pop();
      if (!prev) { $("sokobanStatus").textContent = "没有可悔的步了。"; return; }
      sokobanPlayer = { x: prev.player.x, y: prev.player.y };
      sokobanBoxes = prev.boxes.map((b) => ({ x: b.x, y: b.y }));
      sokobanMoves = prev.moves;
      sokobanWon = false;
      $("sokobanStatus").textContent = "已悔一步，继续推。";
      sokobanRender();
    }
    bindSwipe($("sokobanGrid"), sokobanMove);
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-sokoban").classList.contains("hidden")) return;
        const k = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
        if (k) { sokobanMove(k); if (e.preventDefault) e.preventDefault(); }
      });
    }
    $("sokobanL1Btn").addEventListener("click", () => sokobanLoad(0));
    $("sokobanL2Btn").addEventListener("click", () => sokobanLoad(1));
    $("sokobanL3Btn").addEventListener("click", () => sokobanLoad(2));
    $("sokobanResetBtn").addEventListener("click", () => sokobanLoad(sokobanLevel));
    $("sokobanUndoBtn").addEventListener("click", sokobanUndo);
    sokobanLoad(0);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get sokoban() { return { level: sokobanLevel, player: { x: sokobanPlayer.x, y: sokobanPlayer.y }, boxes: sokobanBoxes.map((b) => ({ x: b.x, y: b.y })), moves: sokobanMoves, won: sokobanWon, canUndo: sokobanHistory.length > 0 }; },
        sokobanLoad(level) { sokobanLoad(level); },
        sokobanMove(dir) { sokobanMove(dir); },
        sokobanUndo() { sokobanUndo(); },
    }));

  };
  /* ---------- 48. 打砖块 ---------- */
  toyInitFns["breakout"] = function () {
    const BREAKOUT_W = 340, BREAKOUT_H = 300;
    const BREAKOUT_ROWS = 3, BREAKOUT_COLS = 6;
    let breakoutBricks = [], breakoutBall = null, breakoutPaddleX = 140;
    let breakoutScore = 0, breakoutLives = 3, breakoutRunning = false, breakoutTimerId = null;
    const breakoutCanvas = $("breakoutCanvas");
    const breakoutCtx = breakoutCanvas.getContext ? breakoutCanvas.getContext("2d") : null;
    function breakoutBuildBricks() {
      breakoutBricks = [];
      for (let r = 0; r < BREAKOUT_ROWS; r++)
        for (let c = 0; c < BREAKOUT_COLS; c++)
          breakoutBricks.push({ x: 10 + c * 54, y: 10 + r * 24, w: 48, h: 18, alive: true });
    }
    function breakoutReset() {
      breakoutBuildBricks();
      breakoutBall = { x: 170, y: 260, dx: 2.2, dy: -2.6, r: 6 };
      breakoutPaddleX = 140;
      breakoutScore = 0; breakoutLives = 3; breakoutRunning = false;
      if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
      breakoutRender();
      $("breakoutScore").textContent = "得分 0 · 砖块 18 · 命 3";
      $("breakoutStatus").textContent = "点开始，小球就出发。";
    }
    function breakoutRender() {
      if (!breakoutCtx) return;
      breakoutCtx.clearRect(0, 0, BREAKOUT_W, BREAKOUT_H);
      breakoutCtx.fillStyle = "#4f7cff";
      breakoutBricks.forEach((b) => { if (b.alive) breakoutCtx.fillRect(b.x, b.y, b.w, b.h); });
      breakoutCtx.fillStyle = "#fff";
      breakoutCtx.fillRect(breakoutPaddleX, BREAKOUT_H - 14, 60, 10);
      breakoutCtx.beginPath();
      breakoutCtx.arc(breakoutBall.x, breakoutBall.y, breakoutBall.r, 0, Math.PI * 2);
      breakoutCtx.fill();
    }
    function breakoutStep() {
      if (!breakoutRunning) return;
      const b = breakoutBall;
      b.x += b.dx; b.y += b.dy;
      if (b.x - b.r < 0) { b.x = b.r; b.dx = -b.dx; }
      if (b.x + b.r > BREAKOUT_W) { b.x = BREAKOUT_W - b.r; b.dx = -b.dx; }
      if (b.y - b.r < 0) { b.y = b.r; b.dy = -b.dy; }
      // 挡板
      if (b.dy > 0 && b.y + b.r >= BREAKOUT_H - 14 && b.y + b.r <= BREAKOUT_H - 2
        && b.x >= breakoutPaddleX - b.r && b.x <= breakoutPaddleX + 60 + b.r) {
        b.dy = -Math.abs(b.dy);
        b.dx += ((b.x - (breakoutPaddleX + 30)) / 30) * 0.8; // 打在挡板边缘会变向
        b.y = BREAKOUT_H - 14 - b.r;
      }
      // 砖块
      for (const br of breakoutBricks) {
        if (!br.alive) continue;
        if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
          br.alive = false;
          breakoutScore += 10;
          SFX.pop(0.5);
          b.dy = -b.dy;
          break;
        }
      }
      const left = breakoutBricks.filter((br) => br.alive).length;
      $("breakoutScore").textContent = "得分 " + breakoutScore + " · 砖块 " + left + " · 命 " + breakoutLives;
      if (left === 0) {
        breakoutRunning = false;
        if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
        SFX.win();
        $("breakoutStatus").textContent = "🎉 通关！得分 " + breakoutScore + "，砖块全碎了。";
        breakoutRender();
        return;
      }
      if (b.y - b.r > BREAKOUT_H) {
        breakoutLives--;
        if (breakoutLives <= 0) {
          breakoutRunning = false;
          if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
          SFX.lose();
          $("breakoutStatus").textContent = "💔 没命了。得分 " + breakoutScore + "，点重开再来。";
        } else {
          breakoutBall = { x: 170, y: 260, dx: 2.2, dy: -2.6, r: 6 };
          $("breakoutStatus").textContent = "掉了一个球，还剩 " + breakoutLives + " 条命。";
        }
      }
      breakoutRender();
    }
    function breakoutStart() {
      if (breakoutRunning) return;
      if (breakoutLives <= 0 || breakoutBricks.filter((b) => b.alive).length === 0) breakoutReset();
      breakoutRunning = true;
      $("breakoutStatus").textContent = "小球出发了，别让它掉下去！";
      if (breakoutTimerId) clearInterval(breakoutTimerId);
      breakoutTimerId = setInterval(breakoutStep, 16);
    }
    function breakoutMovePaddle(clientX) {
      const rect = breakoutCanvas.getBoundingClientRect ? breakoutCanvas.getBoundingClientRect() : { left: 0, width: BREAKOUT_W };
      const scale = BREAKOUT_W / (rect.width || BREAKOUT_W);
      breakoutPaddleX = Math.max(0, Math.min(BREAKOUT_W - 60, (clientX - rect.left) * scale - 30));
      breakoutRender();
    }
    breakoutCanvas.addEventListener("pointerdown", (e) => breakoutMovePaddle(e.clientX));
    breakoutCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); breakoutMovePaddle(e.touches[0].clientX); }, { passive: false });
    breakoutCanvas.addEventListener("pointermove", (e) => { if (e.buttons) breakoutMovePaddle(e.clientX); });
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-breakout").classList.contains("hidden")) return;
        if (e.key === "ArrowLeft") { breakoutPaddleX = Math.max(0, breakoutPaddleX - 18); breakoutRender(); if (e.preventDefault) e.preventDefault(); }
        if (e.key === "ArrowRight") { breakoutPaddleX = Math.min(BREAKOUT_W - 60, breakoutPaddleX + 18); breakoutRender(); if (e.preventDefault) e.preventDefault(); }
      });
    }
    $("breakoutStartBtn").addEventListener("click", breakoutStart);
    $("breakoutResetBtn").addEventListener("click", breakoutReset);
    breakoutReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get breakout() { return { ball: { x: breakoutBall.x, y: breakoutBall.y, dx: breakoutBall.dx, dy: breakoutBall.dy }, paddleX: breakoutPaddleX, bricks: breakoutBricks.filter((b) => b.alive).length, score: breakoutScore, lives: breakoutLives, running: breakoutRunning }; },
        breakoutStart() { breakoutStart(); },
        breakoutStep() { breakoutStep(); },
        breakoutSet(ball, paddleX) { breakoutBall = { x: ball.x, y: ball.y, dx: ball.dx, dy: ball.dy, r: 6 }; breakoutPaddleX = paddleX; },
    }));

    toyLeaveCleanup.breakout = () => { if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; } breakoutRunning = false; };
  };
  /* ---------- 49. 井字棋 ---------- */
  toyInitFns["tictactoe"] = function () {
    const TICTACTOE_KEY = "dorm-toybox-tictactoe-v1";
    const TTT_DIFF_KEY = "dorm-toybox-tictactoe-diff-v1";
    let tttBoard = new Array(9).fill("");
    let tttOver = false;
    let tttDiff = "hard"; // 简单/中等/困难，默认困难（测试刚性：电脑必须会堵）
    let tttPlayerFirst = true; // 默认我先手（测试刚性：重开后棋盘全空）
    try { const d = localStorage.getItem(TTT_DIFF_KEY); if (d === "easy" || d === "medium" || d === "hard") tttDiff = d; } catch (e) {}
    let tttRecord = { win: 0, draw: 0, lose: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(TICTACTOE_KEY) || "null");
      if (saved && typeof saved.win === "number") tttRecord = saved;
    } catch (e) { /* 忽略 */ }
    function tttSave() { try { localStorage.setItem(TICTACTOE_KEY, JSON.stringify(tttRecord)); } catch (e) { /* 忽略 */ } }
    const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    function tttWinner(bd) {
      for (const [a, b, c] of TTT_LINES) if (bd[a] && bd[a] === bd[b] && bd[a] === bd[c]) return bd[a];
      return bd.every((v) => v) ? "draw" : null;
    }
    // 极小极大：电脑算满所有走法，永远不输
    function tttMinimax(bd, isMax, depth) {
      const w = tttWinner(bd);
      if (w === "O") return 10 - depth;
      if (w === "X") return depth - 10;
      if (w === "draw") return 0;
      let best = isMax ? -Infinity : Infinity;
      for (let i = 0; i < 9; i++) {
        if (bd[i]) continue;
        bd[i] = isMax ? "O" : "X";
        const s = tttMinimax(bd, !isMax, depth + 1);
        bd[i] = "";
        best = isMax ? Math.max(best, s) : Math.min(best, s);
      }
      return best;
    }
    function tttAiMove() {
      const empties = [];
      for (let i = 0; i < 9; i++) if (!tttBoard[i]) empties.push(i);
      if (!empties.length) return -1;
      let idx = -1;
      if (tttDiff === "easy") {
        // 简单：纯随机
        idx = empties[Math.floor(Math.random() * empties.length)];
      } else if (tttDiff === "medium") {
        // 中等：能赢就赢、能堵就堵，否则随机
        idx = tttFindWin("O");
        if (idx < 0) idx = tttFindWin("X");
        if (idx < 0) idx = empties[Math.floor(Math.random() * empties.length)];
      } else {
        // 困难：minimax 永远不输
        let bestScore = -Infinity;
        for (const i of empties) {
          tttBoard[i] = "O";
          const sc = tttMinimax(tttBoard, false, 0);
          tttBoard[i] = "";
          if (sc > bestScore) { bestScore = sc; idx = i; }
        }
      }
      if (idx >= 0) tttBoard[idx] = "O";
      return idx;
    }
    // 找一步能连成三子的格子（进攻/防守用）
    function tttFindWin(p) {
      for (const [a, b, c] of TTT_LINES) {
        const line = [tttBoard[a], tttBoard[b], tttBoard[c]];
        if (line.filter((v) => v === p).length === 2 && line.includes("")) {
          return [a, b, c][line.indexOf("")];
        }
      }
      return -1;
    }
    function tttRender() {
      const grid = $("tictactoeGrid");
      grid.innerHTML = "";
      const winLine = tttWinner(tttBoard);
      let winCells = [];
      if (winLine && winLine !== "draw") {
        for (const line of TTT_LINES) if (tttBoard[line[0]] === winLine && tttBoard[line[1]] === winLine && tttBoard[line[2]] === winLine) winCells = line;
      }
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("button");
        cell.className = "tictactoe-cell" + (winCells.includes(i) ? " win" : "");
        cell.textContent = tttBoard[i] === "X" ? "❌" : tttBoard[i] === "O" ? "⭕" : "";
        cell.setAttribute("aria-label", "格子 " + (i + 1));
        cell.addEventListener("click", () => tttMove(i));
        grid.appendChild(cell);
      }
      $("tictactoeStats").textContent = "胜 " + tttRecord.win + " · 平 " + tttRecord.draw + " · 负 " + tttRecord.lose;
    }
    function tttMove(i) {
      if (tttOver || tttBoard[i]) return;
      tttBoard[i] = "X";
      if (typeof SFX !== "undefined") SFX.click();
      let w = tttWinner(tttBoard);
      if (w) { tttFinish(w); return; }
      tttAiMove();
      if (typeof SFX !== "undefined") SFX.click();
      w = tttWinner(tttBoard);
      if (w) tttFinish(w);
      else $("tictactoeStatus").textContent = "轮到你（❌）落子。";
      tttRender();
    }
    function tttNewGame() {
      tttBoard = new Array(9).fill("");
      tttOver = false;
      if (!tttPlayerFirst) {
        // 电脑先手：直接走一步
        tttAiMove();
        $("tictactoeStatus").textContent = "电脑（⭕）先手，轮到你（❌）。";
      } else {
        $("tictactoeStatus").textContent = "轮到你（❌）落子。";
      }
      tttRender();
    }
    function tttSetDiff(d) {
      tttDiff = d;
      try { localStorage.setItem(TTT_DIFF_KEY, d); } catch (e) {}
      [["tttEasyBtn", "easy"], ["tttMedBtn", "medium"], ["tttHardBtn", "hard"]].forEach(([id, v]) => {
        const b = $(id); if (!b) return;
        b.classList.toggle("gold-btn", v === d);
        b.classList.toggle("ghost-btn", v !== d);
      });
      tttNewGame();
    }
    function tttSetFirst(playerFirst) {
      tttPlayerFirst = playerFirst;
      $("tttFirstBtn").classList.toggle("gold-btn", playerFirst);
      $("tttFirstBtn").classList.toggle("ghost-btn", !playerFirst);
      $("tttSecondBtn").classList.toggle("gold-btn", !playerFirst);
      $("tttSecondBtn").classList.toggle("ghost-btn", playerFirst);
      tttNewGame();
    }
    function tttFinish(w) {
      tttOver = true;
      if (w === "X") { tttRecord.win++; $("tictactoeStatus").textContent = "🎉 你赢了！" + (tttDiff === "hard" ? "赢了满算的电脑，厉害！" : ""); if (typeof SFX !== "undefined") SFX.win(); }
      else if (w === "O") { tttRecord.lose++; $("tictactoeStatus").textContent = "😢 电脑赢了。再来一局报仇？"; if (typeof SFX !== "undefined") SFX.lose(); }
      else { tttRecord.draw++; $("tictactoeStatus").textContent = "🤝 平局！" + (tttDiff === "hard" ? "能逼平满算的电脑，你很强。" : ""); if (typeof SFX !== "undefined") SFX.pop(0.6); }
      tttSave();
      tttRender();
    }
    $("tictactoeResetBtn").addEventListener("click", tttNewGame);
    $("tttEasyBtn").addEventListener("click", () => tttSetDiff("easy"));
    $("tttMedBtn").addEventListener("click", () => tttSetDiff("medium"));
    $("tttHardBtn").addEventListener("click", () => tttSetDiff("hard"));
    $("tttFirstBtn").addEventListener("click", () => tttSetFirst(true));
    $("tttSecondBtn").addEventListener("click", () => tttSetFirst(false));
    // 同步按钮初始态（不触发 newGame，保持测试刚性：开局棋盘全空）
    (function tttSyncBtns() {
      [["tttEasyBtn", "easy"], ["tttMedBtn", "medium"], ["tttHardBtn", "hard"]].forEach(([id, v]) => {
        const b = $(id); if (!b) return;
        b.classList.toggle("gold-btn", v === tttDiff);
        b.classList.toggle("ghost-btn", v !== tttDiff);
      });
    })();
    tttRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get tictactoe() { return { board: tttBoard.slice(), over: tttOver, record: { win: tttRecord.win, draw: tttRecord.draw, lose: tttRecord.lose } }; },
        tictactoeMove(i) { tttMove(i); },
        tictactoeSet(board) { tttBoard = board.slice(); tttOver = false; tttRender(); },
    }));

  };
  /* ---------- 50. 连连看 ---------- */
  toyInitFns["linkup"] = function () {
    const LINKUP_EMOJIS = ["🐸", "🍜", "📚", "🎮", "🏀", "🎸", "🍕", "🐱", "🚲", "🎧", "🍉", "⚽"];
    const LINKUP_COLS = 6, LINKUP_ROWS = 4;
    let linkupBoard = [], linkupPicked = -1, linkupLeft = 0, linkupSeconds = 0, linkupTimerId = null, linkupOver = false, linkupHints = 3;
    function linkupNewBoard() {
      const tiles = [];
      LINKUP_EMOJIS.forEach((em) => { tiles.push(em, em); });
      // v3.0-r17：满盘时只有相邻或贴边的对子能连，纯随机发牌约 2% 开局就是死局；
      // 重洗到至少有一对能连为止（上限 100 次，基本一次就中），别让用户一开局就卡死
      let tries = 0;
      do {
        for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
        linkupBoard = tiles.slice();
        tries++;
      } while (!linkupFindPair() && tries < 100);
      linkupLeft = LINKUP_EMOJIS.length;
      linkupPicked = -1; linkupOver = false;
    }
    function linkupReset() {
      linkupNewBoard();
      linkupSeconds = 0;
      linkupHints = 3;
      $("linkupHintBtn").textContent = "提示 💡×3";
      if (linkupTimerId) { clearInterval(linkupTimerId); linkupTimerId = null; }
      linkupRender();
      $("linkupStatus").textContent = "剩 " + linkupLeft + " 对 · 用时 0 秒";
    }
    // 计时从第一次翻牌开始算，不在加载时就启动 interval（会抢别的玩具的计时器）
    function linkupStartTimer() {
      if (linkupTimerId || linkupOver) return;
      linkupTimerId = setInterval(() => {
        if (linkupOver) return;
        linkupSeconds++;
        $("linkupStatus").textContent = "剩 " + linkupLeft + " 对 · 用时 " + linkupSeconds + " 秒";
      }, 1000);
    }
    function linkupRender() {
      const grid = $("linkupGrid");
      grid.innerHTML = "";
      for (let i = 0; i < linkupBoard.length; i++) {
        const cell = document.createElement("button");
        cell.className = "linkup-cell" + (linkupPicked === i ? " picked" : "") + (!linkupBoard[i] ? " gone" : "");
        cell.textContent = linkupBoard[i] || "";
        cell.setAttribute("aria-label", "牌 " + (i + 1));
        cell.addEventListener("click", () => linkupPick(i));
        grid.appendChild(cell);
      }
    }
    function linkupPos(i) { return { x: (i % LINKUP_COLS) + 1, y: Math.floor(i / LINKUP_COLS) + 1 }; }
    function linkupCellAt(x, y) {
      if (x < 0 || y < 0 || x > LINKUP_COLS + 1 || y > LINKUP_ROWS + 1) return "#";
      if (x === 0 || y === 0 || x === LINKUP_COLS + 1 || y === LINKUP_ROWS + 1) return "";
      return linkupBoard[(y - 1) * LINKUP_COLS + (x - 1)];
    }
    // 最多拐 2 个弯能不能连上（BFS，带方向和拐弯数）
    function linkupCanConnect(a, b) {
      if (a === b || !linkupBoard[a] || !linkupBoard[b] || linkupBoard[a] !== linkupBoard[b]) return false;
      const pa = linkupPos(a), pb = linkupPos(b);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const seen = new Map();
      const q = [[pa.x, pa.y, -1, 0]];
      while (q.length) {
        const [x, y, dir, turns] = q.shift();
        for (let d = 0; d < 4; d++) {
          const nt = dir === -1 || dir === d ? turns : turns + 1;
          if (nt > 2) continue;
          const nx = x + dirs[d][0], ny = y + dirs[d][1];
          if (nx === pb.x && ny === pb.y) return true;
          if (linkupCellAt(nx, ny) !== "") continue;
          const key = nx + "," + ny + "," + d;
          if ((seen.get(key) || 99) <= nt) continue;
          seen.set(key, nt);
          q.push([nx, ny, d, nt]);
        }
      }
      return false;
    }
    function linkupFindPair() {
      for (let i = 0; i < linkupBoard.length; i++) {
        if (!linkupBoard[i]) continue;
        for (let j = i + 1; j < linkupBoard.length; j++) {
          if (linkupBoard[j] && linkupBoard[i] === linkupBoard[j] && linkupCanConnect(i, j)) return [i, j];
        }
      }
      return null;
    }
    function linkupPick(i) {
      if (linkupOver || !linkupBoard[i]) return;
      linkupStartTimer();
      if (linkupPicked === -1) { linkupPicked = i; linkupRender(); return; }
      if (linkupPicked === i) { linkupPicked = -1; linkupRender(); return; }
      if (linkupCanConnect(linkupPicked, i)) {
        linkupBoard[linkupPicked] = ""; linkupBoard[i] = "";
        linkupLeft--;
        linkupPicked = -1;
        if (linkupLeft === 0) {
          linkupOver = true;
          if (linkupTimerId) { clearInterval(linkupTimerId); linkupTimerId = null; }
          if (typeof SFX !== "undefined") SFX.win();
          $("linkupStatus").textContent = "🎉 全消完了！用时 " + linkupSeconds + " 秒。";
        } else {
          $("linkupStatus").textContent = "剩 " + linkupLeft + " 对 · 用时 " + linkupSeconds + " 秒";
        }
      } else {
        linkupPicked = i;
      }
      linkupRender();
    }
    $("linkupHintBtn").addEventListener("click", () => {
      if (linkupOver) return;
      if (linkupHints <= 0) { $("linkupStatus").textContent = "提示用完了，靠自己吧 💪"; return; }
      const pair = linkupFindPair();
      if (!pair) { $("linkupStatus").textContent = "没有能连的对子了，点洗牌。"; return; }
      linkupHints--;
      $("linkupHintBtn").textContent = "提示 💡×" + linkupHints;
      if (typeof SFX !== "undefined") SFX.click();
      linkupRender();
      const cells = $("linkupGrid").children;
      if (cells[pair[0]]) cells[pair[0]].classList.add("hint");
      if (cells[pair[1]]) cells[pair[1]].classList.add("hint");
    });
    $("linkupShuffleBtn").addEventListener("click", () => {
      if (linkupOver) return;
      const rest = linkupBoard.filter(Boolean);
      // v3.0-r17：洗牌也可能洗出死局，重洗到有路可走为止（上限 50 次）
      let tries = 0;
      do {
        for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        let k = 0;
        linkupBoard = linkupBoard.map((v) => (v ? rest[k++] : ""));
        tries++;
      } while (!linkupFindPair() && linkupBoard.filter(Boolean).length > 2 && tries < 50);
      linkupPicked = -1;
      linkupRender();
    });
    $("linkupResetBtn").addEventListener("click", linkupReset);
    linkupReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get linkup() { return { board: linkupBoard.slice(), left: linkupLeft, picked: linkupPicked, seconds: linkupSeconds, over: linkupOver }; },
        linkupSet(board) { linkupBoard = board.slice(); linkupLeft = new Set(linkupBoard.filter(Boolean)).size; linkupPicked = -1; linkupOver = false; linkupRender(); },
        linkupCanConnect(a, b) { return linkupCanConnect(a, b); },
        linkupPick(i) { linkupPick(i); },
    }));

  };
  /* ---------- 51. 数字华容道 ---------- */
  toyInitFns["slide15"] = function () {
    const SLIDE15_KEY = "dorm-toybox-slide15-best-v1";
    let slide15N = 4; // 默认 4x4（测试刚性）
    let slide15Board = [];
    let slide15StartBoard = []; // v3.0-r15：本局开局的打乱盘，“复原”回到这里，不再回到已解状态
    let slide15Moves = 0, slide15Best = null, slide15Won = false, slide15WinMoves = 0;
    function slide15Key() { return slide15N === 4 ? SLIDE15_KEY : SLIDE15_KEY + "-" + slide15N + "x" + slide15N; }
    function slide15Solved() {
      const total = slide15N * slide15N;
      return Array.from({ length: total }, (_, j) => (j === total - 1 ? 0 : j + 1));
    }
    function slide15LoadBest() {
      try { const b = parseInt(localStorage.getItem(slide15Key()) || "", 10); slide15Best = b > 0 ? b : null; }
      catch (e) { slide15Best = null; }
    }
    function slide15Par() { return slide15N === 3 ? 30 : slide15N === 4 ? 120 : 300; } // 参考步数
    function slide15Render() {
      const grid = $("slide15Grid");
      grid.innerHTML = "";
      grid.style.gridTemplateColumns = "repeat(" + slide15N + ", 1fr)";
      slide15Board.forEach((v, i) => {
        const cell = document.createElement("button");
        cell.className = "slide15-cell" + (v === 0 ? " empty" : "") + (slide15Won && v !== 0 ? " win" : "");
        cell.textContent = v === 0 ? "" : String(v);
        cell.setAttribute("aria-label", v === 0 ? "空格" : "数字 " + v);
        cell.addEventListener("click", () => slide15Move(i));
        grid.appendChild(cell);
      });
      // v3.0-r15：通关后状态栏保留赢的提示，不再被步数覆盖（原来赢文案刚写上就被 render 冲掉）
      $("slide15Status").textContent = slide15Won
        ? "🎉 拼好了！用了 " + slide15WinMoves + " 步，最好 " + slide15Best + " 步。"
        : "已走 " + slide15Moves + " 步 · 最好 " + (slide15Best === null ? "—" : slide15Best + " 步") + " · 参考 " + slide15Par() + " 步";
    }
    function slide15Move(i) {
      if (slide15Won) return; // v3.0-r15：通关后点不动（与华容道一致），再玩请点打乱/复原
      const N = slide15N;
      const empty = slide15Board.indexOf(0);
      const ex = empty % N, ey = Math.floor(empty / N);
      const ix = i % N, iy = Math.floor(i / N);
      if (Math.abs(ex - ix) + Math.abs(ey - iy) !== 1) return; // 只能滑空格旁边的
      [slide15Board[i], slide15Board[empty]] = [slide15Board[empty], slide15Board[i]];
      slide15Moves++;
      slide15Won = false;
      if (typeof SFX !== "undefined") SFX.click();
      const total = N * N;
      if (slide15Board.every((v, j) => v === (j === total - 1 ? 0 : j + 1))) {
        if (slide15Best === null || slide15Moves < slide15Best) {
          slide15Best = slide15Moves;
          saveBest(slide15Key(), slide15Best);
        }
        if (typeof SFX !== "undefined") SFX.win();
        slide15Won = true; // 撒花：格子发光（render 里加 win 类）；赢文案由 render 保留
        slide15WinMoves = slide15Moves;
      }
      slide15Render();
    }
    function slide15Shuffle() {
      // 从已解状态随机走 N*N*8 步（保证可解）
      const N = slide15N, total = N * N;
      // v3.0-r15：随机走恰好走回已解状态时重打乱，别让用户一开局就看到已拼好的盘
      for (let tries = 0; tries < 5; tries++) {
        slide15Board = slide15Solved();
        slide15Moves = 0;
        slide15Won = false;
        slide15WinMoves = 0;
        for (let n = 0; n < total * 8; n++) {
          const empty = slide15Board.indexOf(0);
          const ex = empty % N, ey = Math.floor(empty / N);
          const opts = [];
          if (ex > 0) opts.push(empty - 1);
          if (ex < N - 1) opts.push(empty + 1);
          if (ey > 0) opts.push(empty - N);
          if (ey < N - 1) opts.push(empty + N);
          const pick = opts[Math.floor(Math.random() * opts.length)];
          [slide15Board[pick], slide15Board[empty]] = [slide15Board[empty], slide15Board[pick]];
        }
        if (!slide15Board.every((v, j) => v === (j === total - 1 ? 0 : j + 1))) break;
      }
      slide15StartBoard = slide15Board.slice();
      // 打乱动画：staggered 出现
      slide15Render();
      const cells = $("slide15Grid").children;
      for (let k = 0; k < cells.length; k++) {
        cells[k].classList.add("spawn");
        cells[k].style.animationDelay = Math.min(400, k * 15) + "ms";
      }
    }
    function slide15SetSize(n) {
      slide15N = n;
      slide15LoadBest();
      ["slide15_3Btn", "slide15_4Btn", "slide15_5Btn"].forEach((id) => {
        const b = $(id); if (!b) return;
        const on = id === "slide15_" + n + "Btn";
        b.classList.toggle("gold-btn", on);
        b.classList.toggle("ghost-btn", !on);
      });
      slide15Shuffle();
    }
    $("slide15ShuffleBtn").addEventListener("click", slide15Shuffle);
    // v3.0-r15：复原 = 回到本局开局的打乱盘。原来是直接摆成已解状态，点两下就能刷出 2 步假纪录
    $("slide15ResetBtn").addEventListener("click", () => { slide15Board = slide15StartBoard.slice(); slide15Moves = 0; slide15Won = false; slide15WinMoves = 0; slide15Render(); });
    $("slide15_3Btn").addEventListener("click", () => slide15SetSize(3));
    $("slide15_4Btn").addEventListener("click", () => slide15SetSize(4));
    $("slide15_5Btn").addEventListener("click", () => slide15SetSize(5));
    slide15LoadBest();
    slide15Shuffle();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get slide15() { return { board: slide15Board.slice(), moves: slide15Moves, best: slide15Best }; },
        slide15Move(i) { slide15Move(i); },
        slide15Set(board) { slide15Board = board.slice(); slide15Moves = 0; slide15Won = false; slide15WinMoves = 0; slide15Render(); },
    }));

  };
  /* ---------- 52. 跳一跳 ---------- */
  toyInitFns["jump"] = function () {
    const JUMP_KEY = "dorm-toybox-jump-best-v1";
    const JUMP_W = 340, JUMP_MAX = 280;
    let jumpBest = loadBest(JUMP_KEY);
    let jumpScore = 0, jumpPower = 0, jumpOver = false, jumpCharging = false, jumpChargeId = null, jumpBusy = false;
    let jumpPlatA = { x: 20, w: 60 }, jumpPlatB = { x: 180, w: 56 }, jumpCharX = 34;
    function jumpNewPlatB() {
      const w = 40 + Math.floor(Math.random() * 31);
      const x = 120 + Math.floor(Math.random() * (JUMP_W - 40 - w - 120));
      return { x, w };
    }
    function jumpRender() {
      const pa = $("jumpPlatA"), pb = $("jumpPlatB"), ch = $("jumpChar");
      pa.style.left = jumpPlatA.x + "px"; pa.style.width = jumpPlatA.w + "px";
      pb.style.left = jumpPlatB.x + "px"; pb.style.width = jumpPlatB.w + "px";
      ch.style.left = jumpCharX + "px";
      $("jumpPowerFill").style.width = jumpPower + "%";
      $("jumpScore").textContent = "得分 " + jumpScore + " · 最好 " + jumpBest;
    }
    function jumpReset() {
      if (jumpChargeId) { clearInterval(jumpChargeId); jumpChargeId = null; }
      jumpScore = 0; jumpPower = 0; jumpOver = false; jumpCharging = false; jumpBusy = false;
      jumpPlatA = { x: 20, w: 60 }; jumpPlatB = jumpNewPlatB(); jumpCharX = 34;
      $("jumpChar").classList.remove("charging");
      $("jumpChar").style.bottom = "56px"; // v3.1：死后重开要把青蛙拉回台面，不然内联 bottom:-40px 会一直藏在舞台下面
      $("jumpStatus").textContent = "按住蓄力，松手起跳。";
      jumpRender();
    }
    function jumpRelease() {
      if (jumpOver || jumpBusy || !jumpCharging && jumpPower === 0) return;
      if (jumpChargeId) { clearInterval(jumpChargeId); jumpChargeId = null; }
      jumpCharging = false;
      const dist = (jumpPower / 100) * JUMP_MAX;
      const newX = jumpCharX + dist;
      const center = newX + 16;
      jumpCharX = newX;
      const ch = $("jumpChar");
      ch.classList.remove("charging"); // v1.32：松手回弹
      ch.style.left = newX + "px";
      ch.style.bottom = "120px";
      SFX.jump();
      setTimeout(() => { ch.style.bottom = "56px"; }, 160);
      jumpPower = 0;
      // v3.1：力气太小、中心还落在脚下这个台子上，就原地蹦一下，不扣分也不死；
      // 以前这里只认下一个台子，轻点一下就直接掉下去摔死，还能在同一个台子上反复轻跳刷分。
      if (center >= jumpPlatA.x && center <= jumpPlatA.x + jumpPlatA.w) {
        $("jumpStatus").textContent = "力气小了点，还在原地，再蓄点力。";
        jumpRender();
        return;
      }
      if (center >= jumpPlatB.x && center <= jumpPlatB.x + jumpPlatB.w) {
        const isCenter = Math.abs(center - (jumpPlatB.x + jumpPlatB.w / 2)) <= 8;
        jumpScore += isCenter ? 2 : 1;
        if (jumpScore > jumpBest) {
          jumpBest = jumpScore;
          saveBest(JUMP_KEY, jumpBest);
        }
        if (isCenter) {
          SFX.win();
          jumpPerfect(ch); // v1.32：Perfect! 飘字
        } else { SFX.pop(0.4); }
        $("jumpStatus").textContent = isCenter ? "🎯 正中心！+2 分！" : "稳稳落下，+1 分。";
        // 场景左移：落脚的台子变成起点，再生成下一个；左移完成前不接受新的蓄力，
        // 不然能在 350ms 的窗口里对着同一个台子再跳一次刷分
        jumpBusy = true;
        setTimeout(() => {
          if (jumpOver) return;
          jumpPlatA = { x: 20, w: jumpPlatB.w };
          jumpCharX = 20 + Math.floor((jumpPlatA.w - 32) / 2);
          jumpPlatB = jumpNewPlatB();
          jumpRender();
          jumpBusy = false;
        }, 350);
      } else {
        jumpOver = true;
        ch.style.bottom = "-40px";
        SFX.lose();
        $("jumpStatus").textContent = "💔 掉下去了！得分 " + jumpScore + "，点再来一局。";
      }
      jumpRender();
    }
    // v1.32：Perfect! 飘字
    function jumpPerfect(ch) {
      const stage = $("jumpStage");
      const el = document.createElement("span");
      el.className = "jump-perfect";
      el.textContent = "Perfect!";
      el.style.left = ch.style.left;
      stage.appendChild(el);
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
    }
    const jumpStageEl = $("jumpStage");
    jumpStageEl.addEventListener("pointerdown", (e) => {
      if (jumpOver || jumpBusy) return;
      if (e.preventDefault) e.preventDefault();
      jumpCharging = true; jumpPower = 0;
      $("jumpChar").classList.add("charging"); // v1.32：蓄力压缩
      if (jumpChargeId) clearInterval(jumpChargeId);
      jumpChargeId = setInterval(() => {
        jumpPower = Math.min(100, jumpPower + 1.4);
        $("jumpPowerFill").style.width = jumpPower + "%";
      }, 16);
    });
    jumpStageEl.addEventListener("pointerup", () => jumpRelease());
    jumpStageEl.addEventListener("pointercancel", () => { if (jumpChargeId) { clearInterval(jumpChargeId); jumpChargeId = null; } jumpCharging = false; jumpPower = 0; jumpRender(); });
    $("jumpResetBtn").addEventListener("click", jumpReset);
    jumpReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get jump() { return { score: jumpScore, power: jumpPower, charX: jumpCharX, platA: { x: jumpPlatA.x, w: jumpPlatA.w }, platB: { x: jumpPlatB.x, w: jumpPlatB.w }, over: jumpOver, best: jumpBest }; },
        jumpSet(platB, charX) { jumpPlatB = { x: platB.x, w: platB.w }; jumpCharX = charX; jumpOver = false; jumpRender(); },
        jumpCharge(power) { jumpCharging = true; jumpPower = power; },
        jumpRelease() { jumpRelease(); },
    }));

    toyLeaveCleanup.jump = () => { try { if (typeof jumpChargeId !== "undefined" && jumpChargeId) { clearInterval(jumpChargeId); } } catch (e) {} };
  };
  /* ---------- 53. 找不同 ---------- */
  toyInitFns["spotdiff"] = function () {
    const SPOTDIFF_KEY = "dorm-toybox-spotdiff-best-v1";
    const SPOTDIFF_PAIRS = [["🐸", "🐵"], ["🍎", "🍏"], ["😀", "😃"], ["🐶", "🐱"], ["⚽", "🏀"], ["🍕", "🍔"], ["🌸", "🌺"], ["🐟", "🐠"], ["🚗", "🚙"], ["🍓", "🍒"], ["🐼", "🐨"], ["🌙", "⭐"]];
    let spotdiffBest = loadBest(SPOTDIFF_KEY);
    let spotdiffLevel = 1, spotdiffScore = 0, spotdiffTime = 60, spotdiffOdd = -1, spotdiffBase = "", spotdiffOddEmoji = "";
    let spotdiffRunning = false, spotdiffTimerId = null, spotdiffGridSize = 3;
    function spotdiffGridForLevel(level) { return level <= 2 ? 3 : level <= 4 ? 4 : 5; }
    function spotdiffNewRound() {
      spotdiffGridSize = spotdiffGridForLevel(spotdiffLevel);
      const pair = SPOTDIFF_PAIRS[Math.floor(Math.random() * SPOTDIFF_PAIRS.length)];
      spotdiffBase = pair[0]; spotdiffOddEmoji = pair[1];
      const total = spotdiffGridSize * spotdiffGridSize;
      spotdiffOdd = Math.floor(Math.random() * total);
      spotdiffRender();
    }
    function spotdiffRender() {
      const grid = $("spotdiffGrid");
      grid.style.gridTemplateColumns = "repeat(" + spotdiffGridSize + ", 1fr)";
      grid.innerHTML = "";
      const total = spotdiffGridSize * spotdiffGridSize;
      for (let i = 0; i < total; i++) {
        const cell = document.createElement("button");
        cell.className = "spotdiff-cell";
        cell.textContent = i === spotdiffOdd ? spotdiffOddEmoji : spotdiffBase;
        cell.setAttribute("aria-label", "格子 " + (i + 1));
        cell.addEventListener("click", () => spotdiffPick(i));
        grid.appendChild(cell);
      }
      $("spotdiffStatus").textContent = "第 " + spotdiffLevel + " 关 · 得分 " + spotdiffScore + " · 剩 " + spotdiffTime + " 秒";
    }
    let spotdiffLock = false; // v1.32：标记动画期间锁住，防止连点
    function spotdiffPick(i) {
      if (!spotdiffRunning || spotdiffLock) return;
      if (i === spotdiffOdd) {
        spotdiffScore += 10;
        spotdiffLevel++;
        SFX.win();
        // v1.32：圆圈标记动画，看清后再进下一关
        const cells = $("spotdiffGrid").children;
        if (cells[i] && cells[i].classList) cells[i].classList.add("found");
        spotdiffLock = true;
        setTimeout(() => { spotdiffLock = false; spotdiffNewRound(); }, 450);
      } else {
        spotdiffScore = Math.max(0, spotdiffScore - 5);
        const cells = $("spotdiffGrid").children;
        if (cells[i]) { cells[i].classList.add("wrong"); setTimeout(() => cells[i].classList.remove("wrong"), 300); }
        $("spotdiffStatus").textContent = "第 " + spotdiffLevel + " 关 · 得分 " + spotdiffScore + " · 剩 " + spotdiffTime + " 秒";
      }
    }
    function spotdiffStart() {
      if (spotdiffRunning) return;
      // v3.0-r17：时间到后 time=0，直接点开始会立刻又时间到；先重开一局再计时
      if (spotdiffTime <= 0) {
        spotdiffLevel = 1; spotdiffScore = 0; spotdiffTime = 60;
        spotdiffNewRound();
      }
      spotdiffRunning = true;
      if (spotdiffTimerId) clearInterval(spotdiffTimerId);
      spotdiffTimerId = setInterval(() => {
        spotdiffTime--;
        if (spotdiffTime <= 0) {
          spotdiffTime = 0;
          spotdiffRunning = false;
          clearInterval(spotdiffTimerId); spotdiffTimerId = null;
          if (spotdiffScore > spotdiffBest) {
            spotdiffBest = spotdiffScore;
            saveBest(SPOTDIFF_KEY, spotdiffBest);
          }
          $("spotdiffStatus").textContent = "⏰ 时间到！得分 " + spotdiffScore + "，最好 " + spotdiffBest + "。";
          return;
        }
        $("spotdiffStatus").textContent = "第 " + spotdiffLevel + " 关 · 得分 " + spotdiffScore + " · 剩 " + spotdiffTime + " 秒";
      }, 1000);
    }
    function spotdiffReset() {
      if (spotdiffTimerId) { clearInterval(spotdiffTimerId); spotdiffTimerId = null; }
      spotdiffLock = false; // v1.32：重开解锁
      spotdiffLevel = 1; spotdiffScore = 0; spotdiffTime = 60; spotdiffRunning = false;
      spotdiffNewRound();
      $("spotdiffStatus").textContent = "第 1 关 · 得分 0 · 剩 60 秒 · 最好 " + spotdiffBest;
    }
    $("spotdiffStartBtn").addEventListener("click", spotdiffStart);
    $("spotdiffResetBtn").addEventListener("click", spotdiffReset);
    // v1.32：放大镜模式（2x，点按钮开关）
    let spotdiffZoom = false;
    $("spotdiffZoomBtn").addEventListener("click", () => {
      spotdiffZoom = !spotdiffZoom;
      $("spotdiffGrid").classList.toggle("zoomed", spotdiffZoom);
      $("spotdiffZoomBtn").textContent = spotdiffZoom ? "🔍 关放大镜" : "🔍 放大镜";
      SFX.click();
    });
    spotdiffReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get spotdiff() { return { level: spotdiffLevel, score: spotdiffScore, time: spotdiffTime, gridSize: spotdiffGridSize, odd: spotdiffOdd, base: spotdiffBase, oddEmoji: spotdiffOddEmoji, running: spotdiffRunning, best: spotdiffBest }; },
        spotdiffSet(base, oddEmoji, odd, gridSize) { spotdiffBase = base; spotdiffOddEmoji = oddEmoji; spotdiffOdd = odd; spotdiffGridSize = gridSize; spotdiffRunning = true; spotdiffLock = false; spotdiffRender(); },
        spotdiffPick(i) { spotdiffPick(i); },
    }));

    toyLeaveCleanup.spotdiff = () => { try { if (typeof spotdiffTimerId !== "undefined" && spotdiffTimerId) { clearInterval(spotdiffTimerId); } } catch (e) {} };
  };
  /* ---------- 54. 接金币 ---------- */
  toyInitFns["catch"] = function () {
    const CATCH_KEY = "dorm-toybox-catch-best-v1";
    const CATCH_W = 340, CATCH_H = 300;
    let catchBest = loadBest(CATCH_KEY);
    let catchScore = 0, catchLives = 3, catchTime = 30, catchBasketX = 140;
    let catchItems = [], catchRunning = false, catchStepId = null, catchSpawnId = null, catchTimerId = null;
    function catchRender() {
      const stage = $("catchStage");
      const basket = $("catchBasket");
      // 重建舞台内容：先清空再把篮子加回来（不用 el.remove()，冒烟桩里没有这个方法）
      stage.innerHTML = "";
      stage.appendChild(basket);
      catchItems.forEach((it) => {
        const d = document.createElement("div");
        d.className = "catch-item";
        d.textContent = it.kind === "bomb" ? "💣" : "🪙";
        d.style.left = it.x + "px";
        d.style.top = it.y + "px";
        it.rot = ((it.rot || 0) + 9) % 360; // v1.32：旋转下落
        d.style.transform = "rotate(" + it.rot + "deg)";
        stage.appendChild(d);
      });
      basket.style.left = catchBasketX + "px";
      $("catchScore").textContent = "得分 " + catchScore + " · 命 " + catchLives + " · 剩 " + catchTime + " 秒";
    }
    function catchSpawn() {
      if (!catchRunning) return;
      const kind = Math.random() < 0.3 ? "bomb" : "coin";
      catchItems.push({ x: 10 + Math.floor(Math.random() * (CATCH_W - 40)), y: -30, kind, speed: 2 + Math.random() * 2 });
    }
    function catchStep() {
      if (!catchRunning) return;
      const basketL = catchBasketX, basketR = catchBasketX + 48;
      catchItems.forEach((it) => { it.y += it.speed; });
      // 结算：掉到篮子高度的算接住，掉出底边的消失
      catchItems = catchItems.filter((it) => {
        if (it.y >= CATCH_H - 50 && it.y <= CATCH_H - 10) {
          const cx = it.x + 13;
          if (cx >= basketL - 6 && cx <= basketR + 6) {
            if (it.kind === "coin") {
              catchScore += 10;
              SFX.coin();
              catchFloatCoin(it.x, it.y); // v1.32：金币飘字
              catchScorePop();
            } else {
              catchLives--;
              SFX.lose();
              $("catchStatus").textContent = "💥 接到炸弹了！还剩 " + catchLives + " 条命。";
              if (catchLives <= 0) catchEnd("💔 没命了。");
            }
            return false;
          }
        }
        return it.y <= CATCH_H;
      });
      catchRender();
    }
    // v1.32：接到金币的飘字（挂 section 上，不被 stage 重建清掉）
    function catchFloatCoin(x, y) {
      const sec = $("toy-catch");
      const stage = $("catchStage");
      if (!sec || !stage) return;
      const c = document.createElement("div");
      c.className = "catch-fly";
      c.textContent = "+10 🪙";
      c.style.left = ((stage.offsetLeft || 0) + x) + "px";
      c.style.top = ((stage.offsetTop || 0) + y) + "px";
      sec.appendChild(c);
      setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, 800);
    }
    function catchScorePop() {
      const el = $("catchScore");
      if (!el || !el.classList) return;
      el.classList.remove("score-pop");
      void el.offsetWidth;
      el.classList.add("score-pop");
    }
    function catchEnd(msg) {
      catchRunning = false;
      [catchStepId, catchSpawnId, catchTimerId].forEach((id) => { if (id) clearInterval(id); });
      catchStepId = catchSpawnId = catchTimerId = null;
      if (catchScore > catchBest) {
        catchBest = catchScore;
        saveBest(CATCH_KEY, catchBest);
      }
      $("catchStatus").textContent = msg + "得分 " + catchScore + "，最好 " + catchBest + "。";
      catchRender();
    }
    function catchStart() {
      if (catchRunning) return;
      if (catchLives <= 0 || catchTime <= 0) catchReset();
      catchRunning = true;
      $("catchStatus").textContent = "金币掉下来了，快接！";
      if (catchStepId) clearInterval(catchStepId);
      if (catchSpawnId) clearInterval(catchSpawnId);
      if (catchTimerId) clearInterval(catchTimerId);
      catchStepId = setInterval(catchStep, 16);
      catchSpawnId = setInterval(catchSpawn, 700);
      catchTimerId = setInterval(() => {
        catchTime--;
        if (catchTime <= 0) { catchTime = 0; catchEnd("⏰ 时间到！"); return; }
        catchRender();
      }, 1000);
    }
    function catchReset() {
      [catchStepId, catchSpawnId, catchTimerId].forEach((id) => { if (id) clearInterval(id); });
      catchStepId = catchSpawnId = catchTimerId = null;
      catchScore = 0; catchLives = 3; catchTime = 30; catchBasketX = 140; catchItems = []; catchRunning = false;
      $("catchStatus").textContent = "点开始，金币就往下掉。";
      catchRender();
    }
    function catchMoveBasket(clientX) {
      const stage = $("catchStage");
      const rect = stage.getBoundingClientRect ? stage.getBoundingClientRect() : { left: 0, width: CATCH_W };
      const scale = CATCH_W / (rect.width || CATCH_W);
      catchBasketX = Math.max(0, Math.min(CATCH_W - 48, (clientX - rect.left) * scale - 24));
      $("catchBasket").style.left = catchBasketX + "px";
    }
    $("catchStage").addEventListener("pointerdown", (e) => catchMoveBasket(e.clientX));
    $("catchStage").addEventListener("touchmove", (e) => { e.preventDefault(); catchMoveBasket(e.touches[0].clientX); }, { passive: false });
    $("catchStage").addEventListener("pointermove", (e) => { if (e.buttons) catchMoveBasket(e.clientX); });
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-catch").classList.contains("hidden")) return;
        if (e.key === "ArrowLeft") { catchBasketX = Math.max(0, catchBasketX - 20); $("catchBasket").style.left = catchBasketX + "px"; if (e.preventDefault) e.preventDefault(); }
        if (e.key === "ArrowRight") { catchBasketX = Math.min(CATCH_W - 48, catchBasketX + 20); $("catchBasket").style.left = catchBasketX + "px"; if (e.preventDefault) e.preventDefault(); }
      });
    }
    $("catchStartBtn").addEventListener("click", catchStart);
    $("catchResetBtn").addEventListener("click", catchReset);
    catchReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get catchGame() { return { score: catchScore, lives: catchLives, time: catchTime, basketX: catchBasketX, items: catchItems.map((it) => ({ x: it.x, y: it.y, kind: it.kind })), running: catchRunning, best: catchBest }; },
        catchStart() { catchStart(); },
        catchStep() { catchStep(); },
        catchSet(items, basketX) { catchItems = items.map((it) => ({ x: it.x, y: it.y, kind: it.kind, speed: it.speed || 3 })); if (basketX !== undefined) catchBasketX = basketX; catchRunning = true; catchRender(); },
    }));

    toyLeaveCleanup.catch = () => { [catchStepId, catchSpawnId, catchTimerId].forEach((id) => { if (id) clearInterval(id); }); catchStepId = catchSpawnId = catchTimerId = null; catchRunning = false; };
  };
  /* ---------- 55. 成语接龙 ---------- */
  toyInitFns["idiom"] = function () {
    const IDIOM_KEY = "dorm-toybox-idiom-best-v1";
    // 接龙链：下一个成语的首字 = 上一个成语的尾字（已逐个核对）
    const IDIOM_CHAIN = ["一马当先", "先见之明", "明明白白", "白手起家", "家喻户晓", "晓以大义", "义无反顾", "顾全大局", "局外之人", "人山人海", "海阔天空", "空前绝后", "后来居上", "上下其手", "手到擒来", "来龙去脉", "脉脉含情", "情投意合", "合家欢乐", "乐在其中", "中流砥柱", "柱石之坚", "坚不可摧", "摧枯拉朽", "朽木难雕", "雕虫小技", "技高一筹"];
    // AI 对手用的扩展成语库（首字索引）
    const IDIOM_EXTRA = ["先发制人", "明察秋毫", "白驹过隙", "家徒四壁", "晓风残月", "义薄云天", "顾影自怜", "局促不安", "人定胜天", "海底捞月", "空穴来风", "后起之秀", "上行下效", "手不释卷", "来日方长", "脉络分明", "情不自禁", "合盘托出", "乐善好施", "中饱私囊", "柱小倾大", "坚定不移", "摧眉折腰", "朽木生花", "雕梁画栋", "技艺超群"];
    let idiomBest = loadBest(IDIOM_KEY);
    let idiomRound = 1, idiomScore = 0, idiomIdx = 0, idiomOptions = [], idiomOver = false, idiomStarted = false;
    let idiomMode = "solo"; // solo 单人 / vs AI 对战
    let idiomAiScore = 0, idiomTurn = "you"; // vs 模式：轮到谁
    let idiomGen = 0; // R18：对局世代——vs 模式 AI 回合是延时回调，中途点重置开新局后，旧回调必须作废，不然 AI 幽灵加分
    let idiomAudioCtx = null;
    function idiomSound(ok) {
      try {
        if (!idiomAudioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          idiomAudioCtx = new AC();
        }
        const ctx = idiomAudioCtx;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = ok ? 784 : 196;
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } catch (e) {}
    }
    function idiomRender() {
      $("idiomCurrent").textContent = IDIOM_CHAIN[idiomIdx];
      const wrap = $("idiomOptions");
      wrap.innerHTML = "";
      const isYourTurn = idiomMode === "solo" || idiomTurn === "you";
      idiomOptions.forEach((opt, i) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn";
        b.textContent = opt;
        b.disabled = !isYourTurn || idiomOver || !idiomStarted;
        b.addEventListener("click", () => idiomPick(i));
        wrap.appendChild(b);
      });
      // 求助按钮
      const hb = $("idiomHintBtn");
      if (hb) hb.classList.toggle("hidden", idiomOver || !idiomStarted || !isYourTurn);
      let status;
      if (idiomOver) {
        status = idiomMode === "vs"
          ? "🏁 对战结束！你 " + idiomScore + " : " + idiomAiScore + " AI，" + (idiomScore > idiomAiScore ? "你赢了！" : idiomScore < idiomAiScore ? "AI 赢了！" : "平局！")
          : "🏁 10 轮结束！得分 " + idiomScore + "，最好 " + idiomBest + "。";
      } else {
        status = idiomMode === "vs"
          ? "第 " + idiomRound + " / 10 轮 · 你 " + idiomScore + " : " + idiomAiScore + " AI · " + (idiomTurn === "you" ? "轮到你" : "AI 思考中…")
          : "第 " + idiomRound + " / 10 轮 · 得分 " + idiomScore + " · 最好 " + idiomBest;
      }
      $("idiomStatus").textContent = status;
    }
    function idiomNewRound() {
      const cur = IDIOM_CHAIN[idiomIdx];
      const need = cur.charAt(3);
      const correct = IDIOM_CHAIN[idiomIdx + 1];
      // 干扰项：链里不以 need 开头的成语
      const distract = IDIOM_CHAIN.filter((w) => w !== correct && w.charAt(0) !== need);
      const d1 = distract[Math.floor(Math.random() * distract.length)];
      let d2 = distract[Math.floor(Math.random() * distract.length)];
      while (d2 === d1) d2 = distract[Math.floor(Math.random() * distract.length)];
      idiomOptions = shuffle([correct, d1, d2]);
      idiomRender();
    }
    function idiomPick(i) {
      if (idiomOver || !idiomStarted) return;
      if (idiomMode === "vs" && idiomTurn !== "you") return;
      const cur = IDIOM_CHAIN[idiomIdx];
      const correct = IDIOM_CHAIN[idiomIdx + 1];
      const youRight = idiomOptions[i] === correct;
      if (youRight) { idiomScore += 10; idiomSound(true); }
      else idiomSound(false);
      idiomAdvance();
    }
    function idiomAdvance() {
      idiomIdx++;
      idiomRound++;
      if (idiomRound > 10 || idiomIdx >= IDIOM_CHAIN.length - 1) {
        idiomOver = true;
        if (idiomMode === "solo" && idiomScore > idiomBest) {
          idiomBest = idiomScore;
          saveBest(IDIOM_KEY, idiomBest);
        }
        idiomRender();
        return;
      }
      if (idiomMode === "vs") {
        // AI 回合：80% 概率答对
        idiomTurn = "ai";
        idiomRender();
        const gen = idiomGen; // R18：记下本局世代，回调时世代变了说明已重置，直接作废
        setTimeout(() => {
          if (gen !== idiomGen || idiomOver) return;
          const aiRight = Math.random() < 0.8;
          if (aiRight) idiomAiScore += 10;
          idiomTurn = "you";
          idiomNewRound();
        }, 900);
      } else {
        idiomNewRound();
      }
    }
    function idiomHint() {
      if (idiomOver || !idiomStarted) return;
      const correct = IDIOM_CHAIN[idiomIdx + 1];
      // 显示正确答案的拼音首字母（这里用首字+提示）
      $("idiomStatus").textContent = "💡 提示：正确答案以「" + correct.charAt(0) + "」开头，共四字";
    }
    function idiomStart(mode) {
      idiomGen++; // R18：开新局世代 +1，旧的 AI 延时回调作废
      idiomMode = mode || "solo";
      idiomStarted = true; idiomOver = false; idiomRound = 1; idiomScore = 0; idiomAiScore = 0; idiomTurn = "you";
      idiomIdx = Math.floor(Math.random() * (IDIOM_CHAIN.length - 11));
      // 模式按钮高亮
      const ms = $("idiomModeSolo"), mv = $("idiomModeVs");
      if (ms) ms.classList.toggle("active", idiomMode === "solo");
      if (mv) mv.classList.toggle("active", idiomMode === "vs");
      idiomNewRound();
    }
    $("idiomStartBtn").addEventListener("click", () => idiomStart("solo"));
    $("idiomResetBtn").addEventListener("click", () => idiomStart(idiomMode));
    const mv2 = $("idiomModeVs");
    if (mv2) mv2.addEventListener("click", () => idiomStart("vs"));
    const ms2 = $("idiomModeSolo");
    if (ms2) ms2.addEventListener("click", () => idiomStart("solo"));
    const hb2 = $("idiomHintBtn");
    if (hb2) hb2.addEventListener("click", idiomHint);
    idiomIdx = 0; idiomOptions = []; idiomRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get idiom() { return { round: idiomRound, score: idiomScore, current: IDIOM_CHAIN[idiomIdx], options: idiomOptions.slice(), over: idiomOver, best: idiomBest, chain: IDIOM_CHAIN.slice(), mode: idiomMode }; },
        idiomSet(idx) { idiomStarted = true; idiomOver = false; idiomRound = 1; idiomScore = 0; idiomMode = "solo"; idiomIdx = idx; idiomNewRound(); },
        idiomPick(i) { idiomPick(i); },
    }));

  };
  /* ---------- 56. 节奏鼓机 ---------- */
  toyInitFns["drums"] = function () {
    const DRUM_TRACKS = [
      { id: "kick", icon: "🥁", name: "大鼓", type: "sine", freq: 150, freqEnd: 50, dur: 0.22, gain: 0.5 },
      { id: "clap", icon: "👏", name: "拍手", type: "square", freq: 180, freqEnd: 120, dur: 0.12, gain: 0.25 },
      { id: "hihat", icon: "🎩", name: "镲", type: "triangle", freq: 6000, freqEnd: 6000, dur: 0.05, gain: 0.15 },
      { id: "bongo", icon: "🪘", name: "邦戈", type: "triangle", freq: 400, freqEnd: 250, dur: 0.14, gain: 0.3 },
    ];
    let drumsGrid = DRUM_TRACKS.map(() => [false, false, false, false, false, false, false, false]);
    let drumsStep = 0, drumsPlaying = false, drumsTimerId = null, drumsCtx = null;
    const drumsCellBtns = {}; // "track-step" -> 按钮
    function drumsAudio() {
      if (drumsCtx) return drumsCtx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        drumsCtx = new AC();
        return drumsCtx;
      } catch (e) { return null; }
    }
    // 更好的鼓合成：kick=正弦下扫+敲击，snare=噪声+200Hz，hihat=高频噪声，clap=三次噪声
    function drumsNoiseBurst(ctx, dur, filterFreq, gainVal, type) {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = type || "highpass";
      flt.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainVal, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(flt); flt.connect(g); g.connect(ctx.destination);
      src.start();
    }
    function drumsPlaySound(track) {
      const ctx = drumsAudio();
      if (!ctx) return;
      try {
        if (ctx.state === "suspended") ctx.resume();
        if (track.id === "kick") {
          // 大鼓：150→50Hz 正弦 + 初始敲击
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.6, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + 0.25);
          drumsNoiseBurst(ctx, 0.02, 1000, 0.2, "lowpass");
        } else if (track.id === "snare") {
          // 军鼓：噪声 + 180Hz
          drumsNoiseBurst(ctx, 0.15, 1800, 0.3, "highpass");
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = 180;
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + 0.1);
        } else if (track.id === "hihat") {
          // 镲：高频短噪声
          drumsNoiseBurst(ctx, 0.05, 7000, 0.18, "highpass");
        } else if (track.id === "clap") {
          // 拍手：三次短噪声
          [0, 0.02, 0.04].forEach((off) => {
            setTimeout(() => drumsNoiseBurst(ctx, 0.08, 1500, 0.25, "bandpass"), off * 1000);
          });
        } else {
          // 兜底：原来的合成
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = track.type;
          osc.frequency.setValueAtTime(track.freq, ctx.currentTime);
          if (track.freqEnd !== track.freq) osc.frequency.exponentialRampToValueAtTime(track.freqEnd, ctx.currentTime + track.dur);
          gain.gain.setValueAtTime(track.gain, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + track.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + track.dur);
        }
      } catch (e) { /* 忽略音频错误 */ }
    }
    function drumsRender() {
      const grid = $("drumsGrid");
      grid.innerHTML = "";
      DRUM_TRACKS.forEach((tr, t) => {
        const label = document.createElement("div");
        label.className = "drums-label";
        label.textContent = tr.icon;
        label.title = tr.name;
        grid.appendChild(label);
        for (let s = 0; s < 8; s++) {
          const cell = document.createElement("button");
          cell.className = "drums-cell" + (drumsGrid[t][s] ? " on" : "") + (drumsPlaying && s === drumsStep ? " now" : "");
          cell.setAttribute("aria-label", tr.name + " 第 " + (s + 1) + " 拍");
          cell.addEventListener("click", () => { drumsGrid[t][s] = !drumsGrid[t][s]; drumsRender(); });
          drumsCellBtns[t + "-" + s] = cell;
          grid.appendChild(cell);
        }
      });
      $("drumsStatus").textContent = drumsPlaying ? "▶ 播放中 · 第 " + (drumsStep + 1) + " 拍" : "已停 · 第 — 拍";
    }
    function drumsTick() {
      DRUM_TRACKS.forEach((tr, t) => { if (drumsGrid[t][drumsStep]) drumsPlaySound(tr); });
      drumsStep = (drumsStep + 1) % 8;
      drumsRender();
    }
    const DRUMS_BPM_KEY = "dorm-toybox-drums-bpm-v1";
    let drumsBpm = 120;
    try { drumsBpm = Math.min(180, Math.max(60, parseInt(localStorage.getItem(DRUMS_BPM_KEY) || "120", 10) || 120)); } catch (e) {}
    function drumsInterval() { return Math.round(60000 / drumsBpm / 2); } // 8 分音符
    function drumsPlay() {
      if (drumsPlaying) return;
      drumsPlaying = true; drumsStep = 0;
      if (drumsTimerId) clearInterval(drumsTimerId);
      drumsTimerId = setInterval(drumsTick, drumsInterval());
      $("drumsPlayBtn").textContent = "停止 ⏹";
      drumsRender();
    }
    function drumsStop() {
      drumsPlaying = false;
      if (drumsTimerId) { clearInterval(drumsTimerId); drumsTimerId = null; }
      $("drumsPlayBtn").textContent = "播放 ▶";
      drumsRender();
    }
    $("drumsPlayBtn").addEventListener("click", () => { if (drumsPlaying) drumsStop(); else drumsPlay(); });
    $("drumsClearBtn").addEventListener("click", () => { drumsGrid = DRUM_TRACKS.map(() => [false, false, false, false, false, false, false, false]); drumsRender(); });
    $("drumsDemoBtn").addEventListener("click", () => {
      drumsGrid = [
        [true, false, false, false, true, false, false, false], // 大鼓：1、5 拍
        [false, false, true, false, false, false, true, false], // 拍手：3、7 拍
        [true, true, true, true, true, true, true, true], // 镲：每拍
        [false, false, false, true, false, false, false, true], // 邦戈：4、8 拍
      ];
      drumsRender();
    });
    const bpmRange = $("drumsBpm"), bpmVal = $("drumsBpmVal");
    if (bpmRange) {
      bpmRange.value = String(drumsBpm);
      if (bpmVal) bpmVal.textContent = drumsBpm + " BPM";
      bpmRange.addEventListener("input", () => {
        drumsBpm = parseInt(bpmRange.value, 10) || 120;
        if (bpmVal) bpmVal.textContent = drumsBpm + " BPM";
        try { localStorage.setItem(DRUMS_BPM_KEY, String(drumsBpm)); } catch (e) {}
        if (drumsPlaying) { // 播放中实时生效
          clearInterval(drumsTimerId);
          drumsTimerId = setInterval(drumsTick, drumsInterval());
        }
      });
    }
    drumsRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get drums() { return { grid: drumsGrid.map((row) => row.slice()), step: drumsStep, playing: drumsPlaying, bpm: drumsBpm }; },
        drumsToggle(t, s) { drumsGrid[t][s] = !drumsGrid[t][s]; drumsRender(); },
        drumsTick() { drumsTick(); },
        drumsSet(grid) { drumsGrid = grid.map((row) => row.slice()); drumsRender(); },
    }));

  };
  /* ---------- 57. 颜色急转弯 ---------- */
  toyInitFns["stroop"] = function () {
    const STROOP_KEY = "dorm-toybox-stroop-best-v1";
    const STROOP_COLORS = [
      { name: "红", css: "#ff5a5a" },
      { name: "绿", css: "#4caf50" },
      { name: "蓝", css: "#4a90d9" },
      { name: "黄", css: "#f5c542" },
    ];
    const STROOP_TIME = 60; // 限时 60 秒
    let stroopBest = loadBest(STROOP_KEY);
    let stroopScore = 0, stroopTime = STROOP_TIME, stroopWord = "红", stroopInk = "蓝", stroopRunning = false, stroopTimerId = null;
    let stroopCombo = 0; // 连击数
    let stroopAudioCtx = null;
    function stroopSound(ok) {
      try {
        if (!stroopAudioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          stroopAudioCtx = new AC();
        }
        const ctx = stroopAudioCtx;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = ok ? 660 + Math.min(stroopCombo, 10) * 40 : 220;
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } catch (e) {}
    }
    function stroopNewRound() {
      const word = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
      let ink = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
      while (ink.name === word.name) ink = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
      stroopWord = word.name; stroopInk = ink.name;
      stroopRender();
    }
    function stroopRender() {
      const w = $("stroopWord");
      w.textContent = stroopWord;
      const ink = STROOP_COLORS.find((c) => c.name === stroopInk);
      w.style.color = ink ? ink.css : "#fff";
      // 连击越高字越大，制造压迫感
      w.style.fontSize = (48 + Math.min(stroopCombo, 10) * 3) + "px";
      const wrap = $("stroopOptions");
      wrap.innerHTML = "";
      STROOP_COLORS.forEach((c) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn";
        b.textContent = c.name;
        b.addEventListener("click", () => stroopPick(c.name));
        wrap.appendChild(b);
      });
      const comboTxt = stroopCombo >= 2 ? " · 🔥连击×" + stroopCombo : "";
      $("stroopStatus").textContent = "得分 " + stroopScore + comboTxt + " · 剩 " + stroopTime + " 秒 · 最好 " + stroopBest;
    }
    function stroopPick(name) {
      if (!stroopRunning) return;
      if (name === stroopInk) {
        stroopCombo++;
        // 连击加分：基础 10 分，连击≥3 时翻倍
        const pts = stroopCombo >= 3 ? 20 : 10;
        stroopScore += pts;
        stroopSound(true);
      } else {
        stroopCombo = 0; // 断连击
        stroopScore = Math.max(0, stroopScore - 5);
        stroopSound(false);
      }
      stroopNewRound();
    }
    function stroopStart() {
      if (stroopRunning) return;
      // R18：上一局时间到了之后点开始要重开新局（原来时间还是 0，第一次 tick 就立刻结束，开始按钮点了等于没点）
      if (stroopTime <= 0) { stroopScore = 0; stroopCombo = 0; stroopTime = STROOP_TIME; stroopNewRound(); }
      stroopRunning = true;
      if (stroopTimerId) clearInterval(stroopTimerId);
      stroopTimerId = setInterval(() => {
        stroopTime--;
        if (stroopTime <= 0) {
          stroopTime = 0; stroopRunning = false;
          clearInterval(stroopTimerId); stroopTimerId = null;
          if (stroopScore > stroopBest) {
            stroopBest = stroopScore;
            saveBest(STROOP_KEY, stroopBest);
          }
          $("stroopStatus").textContent = "⏰ 时间到！得分 " + stroopScore + "，最好 " + stroopBest + "。";
          return;
        }
        stroopRender();
      }, 1000);
    }
    function stroopReset() {
      if (stroopTimerId) { clearInterval(stroopTimerId); stroopTimerId = null; }
      stroopScore = 0; stroopTime = STROOP_TIME; stroopRunning = false; stroopCombo = 0;
      stroopNewRound();
      $("stroopStatus").textContent = "得分 0 · 剩 " + STROOP_TIME + " 秒 · 最好 " + stroopBest;
    }
    $("stroopStartBtn").addEventListener("click", stroopStart);
    $("stroopResetBtn").addEventListener("click", stroopReset);
    stroopReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get stroop() { return { score: stroopScore, time: stroopTime, word: stroopWord, ink: stroopInk, running: stroopRunning, best: stroopBest, combo: stroopCombo }; },
        stroopSet(word, ink) { stroopWord = word; stroopInk = ink; stroopRunning = true; stroopRender(); },
        stroopPick(name) { stroopPick(name); },
    }));

  };
  /* ---------- 58. 脑筋急转弯 ---------- */
  toyInitFns["riddle"] = function () {
    const RIDDLE_KEY = "dorm-toybox-riddle-best-v1";
    const RIDDLES = [
      { q: "什么东西越洗越脏？", options: ["衣服", "水", "手"], answer: 1, cat: "经典", hint: "洗衣服用的就是它" },
      { q: "什么东西早上四条腿，中午两条腿，晚上三条腿？", options: ["狗", "人", "椅子"], answer: 1, cat: "经典", hint: "说的是人的一生" },
      { q: "什么东西能装下全世界，却装不下一粒沙？", options: ["袋子", "箱子", "眼睛"], answer: 2, cat: "经典", hint: "它长在你脸上" },
      { q: "什么东西越长越短？", options: ["蜡烛", "头发", "绳子"], answer: 0, cat: "经典", hint: "点燃了就会变短" },
      { q: "什么东西不用的时候朝下，用的时候朝上？", options: ["碗", "帽子", "伞"], answer: 2, cat: "经典", hint: "下雨天用的" },
      { q: "什么东西有口无牙？", options: ["井", "河", "杯子"], answer: 0, cat: "经典", hint: "可以打水的地方" },
      { q: "什么东西天一黑就出来，天一亮就消失？", options: ["月亮", "星星", "萤火虫"], answer: 1, cat: "冷笑话", hint: "一闪一闪亮晶晶" },
      { q: "什么东西越热越爱出来，越冷越躲起来？", options: ["冰", "汗", "火"], answer: 1, cat: "冷笑话", hint: "运动完会流" },
      { q: "什么东西前面是平的，后面是尖的？", options: ["刀", "笔", "针"], answer: 2, cat: "逻辑", hint: "缝衣服用的" },
      { q: "什么东西你天天见，却从来没见过它的真面目？", options: ["天空", "自己的脸", "影子"], answer: 1, cat: "逻辑", hint: "照镜子才看得到" },
      { q: "什么东西一到手就变小？", options: ["肥皂", "糖", "冰块"], answer: 2, cat: "冷笑话", hint: "夏天会化掉" },
      { q: "什么东西你越是想留住它，它走得越快？", options: ["时间", "水", "风"], answer: 0, cat: "逻辑", hint: "一去不复返" },
    ];
    const RIDDLE_TIME = 20; // 每题 20 秒
    let riddleBest = loadBest(RIDDLE_KEY);
    let riddleOrder = [], riddleIdx = 0, riddleScore = 0, riddleOver = false, riddleStarted = false;
    let riddleAnswered = false; // r18：本题已作答，600ms 切题窗口内再点无效（防连点重复计分/跳题）
    let riddleTimeLeft = RIDDLE_TIME, riddleTimerId = null, riddleHintUsed = false;
    let riddleCat = "全部"; // 分类筛选
    let riddleAudioCtx = null;
    function riddleSound(ok) {
      try {
        if (!riddleAudioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          riddleAudioCtx = new AC();
        }
        const ctx = riddleAudioCtx;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = ok ? 880 : 220;
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } catch (e) {}
    }
    function riddleFiltered() {
      if (riddleCat === "全部") return RIDDLES.map((_, i) => i);
      return RIDDLES.map((r, i) => r.cat === riddleCat ? i : -1).filter((i) => i >= 0);
    }
    function riddleRender() {
      if (riddleOver || riddleIdx >= riddleOrder.length) {
        $("riddleQ").textContent = "🏁 " + riddleOrder.length + " 题答完了！";
        $("riddleOptions").innerHTML = "";
        $("riddleHint").classList.add("hidden");
        $("riddleTimer").textContent = "";
        $("riddleStatus").textContent = "得分 " + riddleScore + " · 最好 " + riddleBest + "。";
        return;
      }
      const r = RIDDLES[riddleOrder[riddleIdx]];
      $("riddleQ").textContent = "【" + r.cat + "】" + r.q;
      $("riddleTimer").textContent = "⏱ " + riddleTimeLeft + " 秒";
      const wrap = $("riddleOptions");
      wrap.innerHTML = "";
      r.options.forEach((opt, i) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn";
        b.textContent = opt;
        b.addEventListener("click", () => riddlePick(i));
        wrap.appendChild(b);
      });
      // 提示按钮
      const hintBtn = $("riddleHint");
      hintBtn.classList.remove("hidden");
      hintBtn.textContent = riddleHintUsed ? "💡 " + r.hint : "💡 提示（-3 分）";
      hintBtn.disabled = riddleHintUsed;
      $("riddleStatus").textContent = !riddleStarted
        ? "点开始，一共 " + riddleOrder.length + " 题 · 最好 " + riddleBest // r18：未开始别写“第 1 题”，和“点开始，出题”对不上
        : "第 " + (riddleIdx + 1) + " / " + riddleOrder.length + " 题 · 得分 " + riddleScore + " · 最好 " + riddleBest;
    }
    function riddleStopTimer() {
      if (riddleTimerId) { clearInterval(riddleTimerId); riddleTimerId = null; }
    }
    function riddleStartTimer() {
      riddleStopTimer();
      riddleTimeLeft = RIDDLE_TIME;
      riddleTimerId = setInterval(() => {
        riddleTimeLeft--;
        const t = $("riddleTimer");
        if (t) t.textContent = "⏱ " + riddleTimeLeft + " 秒";
        if (riddleTimeLeft <= 0) {
          riddleStopTimer();
          // 超时算错，直接下一题
          riddleSound(false);
          riddleIdx++;
          riddleHintUsed = false;
          if (riddleIdx >= riddleOrder.length) riddleFinish();
          else { riddleStartTimer(); riddleRender(); }
        }
      }, 1000);
    }
    function riddleFinish() {
      riddleOver = true;
      riddleStopTimer();
      if (riddleScore > riddleBest) {
        riddleBest = riddleScore;
        saveBest(RIDDLE_KEY, riddleBest);
      }
      riddleRender();
    }
    function riddlePick(i) {
      if (riddleOver || !riddleStarted || riddleIdx >= riddleOrder.length || riddleAnswered) return;
      riddleAnswered = true; // r18：锁住本题，600ms 内再点同一题无效
      riddleStopTimer();
      const r = RIDDLES[riddleOrder[riddleIdx]];
      const wrap = $("riddleOptions");
      const btns = wrap.children;
      if (btns[r.answer]) btns[r.answer].classList.add("correct");
      if (i !== r.answer && btns[i]) btns[i].classList.add("wrong");
      if (i === r.answer) {
        riddleScore += 10;
        riddleSound(true);
        // 答对撒花
        const q = $("riddleQ");
        q.classList.remove("win-sparkle");
        void q.offsetWidth;
        q.classList.add("win-sparkle");
      } else {
        riddleSound(false);
      }
      riddleIdx++;
      riddleHintUsed = false;
      setTimeout(() => {
        if (riddleIdx >= riddleOrder.length) {
          riddleFinish();
        } else {
          riddleAnswered = false; // r18：下一题解锁作答
          riddleStartTimer();
          riddleRender();
        }
      }, 600);
    }
    function riddleUseHint() {
      if (riddleOver || !riddleStarted || riddleHintUsed || riddleIdx >= riddleOrder.length || riddleAnswered) return; // r18：已作答后提示无效（防切题窗口内点提示提前露出下一题且丢计时）
      riddleHintUsed = true;
      riddleScore = Math.max(0, riddleScore - 3);
      riddleRender();
    }
    function riddleStart() {
      riddleStarted = true; riddleOver = false; riddleIdx = 0; riddleScore = 0; riddleHintUsed = false; riddleAnswered = false; // r18：开局解锁作答
      riddleOrder = shuffle(riddleFiltered());
      riddleStartTimer();
      riddleRender();
    }
    $("riddleStartBtn").addEventListener("click", riddleStart);
    $("riddleResetBtn").addEventListener("click", riddleStart);
    const rhb = $("riddleHint");
    if (rhb) rhb.addEventListener("click", riddleUseHint);
    // 分类按钮
    const catWrap = $("riddleCats");
    if (catWrap) {
      ["全部", "经典", "冷笑话", "逻辑"].forEach((c) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn small" + (c === riddleCat ? " active" : "");
        b.textContent = c;
        b.addEventListener("click", () => {
          riddleCat = c;
          Array.from(catWrap.children).forEach((el) => el.classList.remove("active"));
          b.classList.add("active");
          riddleStopTimer();
          riddleStart();
        });
        catWrap.appendChild(b);
      });
    }
    riddleOrder = RIDDLES.map((_, i) => i); riddleRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get riddle() { return { index: riddleIdx, score: riddleScore, total: riddleOrder.length, over: riddleOver, best: riddleBest, current: riddleOrder.length > 0 ? RIDDLES[riddleOrder[riddleIdx]] : null }; },
        riddleSet(order) { riddleStarted = true; riddleOver = false; riddleIdx = 0; riddleScore = 0; riddleHintUsed = false; riddleAnswered = false; riddleOrder = order.slice(); riddleStopTimer(); riddleRender(); },
        riddlePick(i) { riddlePick(i); },
    }));
    toyLeaveCleanup.riddle = () => { riddleStopTimer(); };

  };
  /* ---------- 59. 太空射击 ---------- */
  toyInitFns["shooter"] = function () {
    const SHOOTER_KEY = "dorm-toybox-shooter-best-v1";
    const SHOOT_W = 340, SHOOT_H = 300;
    let shooterBest = loadBest(SHOOTER_KEY);
    let shooterScore = 0, shooterLives = 3, shooterShipX = 170;
    let shooterBullets = [], shooterEnemies = [];
    let shooterRunning = false, shooterOver = false, shooterStepId = null, shooterFireId = null, shooterSpawnId = null;
    function shooterDraw() {
      const cv = $("shooterCanvas");
      if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, SHOOT_W, SHOOT_H);
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🚀", shooterShipX, 285);
      ctx.font = "22px sans-serif";
      shooterBullets.forEach((b) => ctx.fillText("•", b.x, b.y));
      shooterEnemies.forEach((e) => ctx.fillText("👾", e.x, e.y));
    }
    function shooterStep() {
      if (!shooterRunning || shooterOver) return;
      shooterBullets.forEach((b) => { b.y -= 6; });
      shooterBullets = shooterBullets.filter((b) => b.y > 0);
      shooterEnemies.forEach((e) => { e.y += e.speed; });
      // 子弹打怪兽
      shooterBullets = shooterBullets.filter((b) => {
        const hit = shooterEnemies.findIndex((e) => Math.abs(e.x - b.x) < 20 && Math.abs(e.y - b.y) < 20);
        if (hit !== -1) {
          shooterEnemies.splice(hit, 1);
          shooterScore += 10;
          SFX.hit();
          return false;
        }
        return true;
      });
      // 怪兽撞飞船 / 掉出底边
      shooterEnemies = shooterEnemies.filter((e) => {
        if (Math.abs(e.x - shooterShipX) < 24 && Math.abs(e.y - 270) < 24) {
          shooterLives--;
          SFX.lose();
          $("shooterStatus").textContent = "💥 被撞了！还剩 " + shooterLives + " 条命。";
          if (shooterLives <= 0) shooterEnd("💔 飞船被撞毁了。");
          return false;
        }
        return e.y <= SHOOT_H;
      });
      shooterRender();
    }
    function shooterFire() {
      if (!shooterRunning || shooterOver) return;
      shooterBullets.push({ x: shooterShipX, y: 260 });
      SFX.shoot();
    }
    function shooterSpawn() {
      if (!shooterRunning || shooterOver) return;
      shooterEnemies.push({ x: 20 + Math.floor(Math.random() * (SHOOT_W - 40)), y: -20, speed: 1 + Math.random() * 1.5 });
    }
    function shooterRender() {
      $("shooterScore").textContent = "得分 " + shooterScore + " · 命 " + shooterLives + " · 最好 " + shooterBest;
      shooterDraw();
    }
    function shooterEnd(msg) {
      shooterOver = true; shooterRunning = false;
      [shooterStepId, shooterFireId, shooterSpawnId].forEach((id) => { if (id) clearInterval(id); });
      shooterStepId = shooterFireId = shooterSpawnId = null;
      if (shooterScore > shooterBest) {
        shooterBest = shooterScore;
        saveBest(SHOOTER_KEY, shooterBest);
      }
      $("shooterStatus").textContent = msg + "得分 " + shooterScore + "，最好 " + shooterBest + "。";
      shooterRender();
    }
    function shooterStart() {
      if (shooterRunning) return;
      if (shooterOver) shooterReset();
      shooterRunning = true;
      $("shooterStatus").textContent = "怪兽来了，开火！";
      if (shooterStepId) clearInterval(shooterStepId);
      if (shooterFireId) clearInterval(shooterFireId);
      if (shooterSpawnId) clearInterval(shooterSpawnId);
      shooterStepId = setInterval(shooterStep, 16);
      shooterFireId = setInterval(shooterFire, 300);
      shooterSpawnId = setInterval(shooterSpawn, 900);
    }
    function shooterReset() {
      [shooterStepId, shooterFireId, shooterSpawnId].forEach((id) => { if (id) clearInterval(id); });
      shooterStepId = shooterFireId = shooterSpawnId = null;
      shooterScore = 0; shooterLives = 3; shooterShipX = 170;
      shooterBullets = []; shooterEnemies = []; shooterRunning = false; shooterOver = false;
      $("shooterStatus").textContent = "点开始，怪兽就下来了。";
      shooterRender();
    }
    function shooterMoveShip(clientX) {
      const cv = $("shooterCanvas");
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, width: SHOOT_W };
      const scale = SHOOT_W / (rect.width || SHOOT_W);
      shooterShipX = Math.max(16, Math.min(SHOOT_W - 16, (clientX - rect.left) * scale));
      shooterDraw();
    }
    $("shooterCanvas").addEventListener("pointerdown", (e) => shooterMoveShip(e.clientX));
    $("shooterCanvas").addEventListener("touchmove", (e) => { e.preventDefault(); shooterMoveShip(e.touches[0].clientX); }, { passive: false });
    $("shooterCanvas").addEventListener("pointermove", (e) => { if (e.buttons) shooterMoveShip(e.clientX); });
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-shooter").classList.contains("hidden")) return;
        if (e.key === "ArrowLeft") { shooterShipX = Math.max(16, shooterShipX - 20); shooterDraw(); if (e.preventDefault) e.preventDefault(); }
        if (e.key === "ArrowRight") { shooterShipX = Math.min(SHOOT_W - 16, shooterShipX + 20); shooterDraw(); if (e.preventDefault) e.preventDefault(); }
      });
    }
    $("shooterStartBtn").addEventListener("click", shooterStart);
    $("shooterResetBtn").addEventListener("click", shooterReset);
    shooterReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get shooter() { return { score: shooterScore, lives: shooterLives, shipX: shooterShipX, bullets: shooterBullets.map((b) => ({ x: b.x, y: b.y })), enemies: shooterEnemies.map((e) => ({ x: e.x, y: e.y, speed: e.speed })), running: shooterRunning, over: shooterOver, best: shooterBest }; },
        shooterStart() { shooterStart(); },
        shooterStep() { shooterStep(); },
        shooterSet(bullets, enemies, shipX) { shooterBullets = bullets.map((b) => ({ x: b.x, y: b.y })); shooterEnemies = enemies.map((e) => ({ x: e.x, y: e.y, speed: e.speed || 1 })); if (shipX !== undefined) shooterShipX = shipX; shooterRunning = true; shooterOver = false; shooterRender(); },
        shooterMoveShip(x) { shooterShipX = x; },
    }));

    toyLeaveCleanup.shooter = () => { [shooterStepId, shooterFireId, shooterSpawnId].forEach((id) => { if (id) clearInterval(id); }); shooterStepId = shooterFireId = shooterSpawnId = null; shooterRunning = false; };
  };
  /* ---------- 60. 一笔画 ---------- */
  toyInitFns["onestroke"] = function () {
    // 每关一张图：点 + 边。欧拉轨迹保证可解（奇点 0 或 2 个）
    const ONESTROKE_LEVELS = [
      { name: "三角形", nodes: [[150, 40], [50, 200], [250, 200]],
        edges: [[0, 1], [1, 2], [2, 0]] },
      { name: "正方形 + 对角线", nodes: [[60, 60], [240, 60], [240, 200], [60, 200]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]] },
      { name: "小房子", nodes: [[150, 40], [70, 120], [230, 120], [230, 210], [70, 210]],
        edges: [[0, 1], [0, 2], [1, 2], [1, 4], [4, 3], [3, 2]] },
    ];
    let onestrokeLevel = 0, onestrokePath = [], onestrokeUsed = new Set(), onestrokeDone = false;
    function onestrokeEdgeKey(a, b) { return Math.min(a, b) + "-" + Math.max(a, b); }
    function onestrokeRender() {
      const lv = ONESTROKE_LEVELS[onestrokeLevel];
      const board = $("onestrokeBoard");
      board.innerHTML = "";
      // 已画的线
      onestrokeUsed.forEach((key) => {
        const [a, b] = key.split("-").map(Number);
        const [x1, y1] = lv.nodes[a], [x2, y2] = lv.nodes[b];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const line = document.createElement("div");
        line.className = "onestroke-line";
        line.style.left = x1 + "px"; line.style.top = y1 + "px";
        line.style.width = len + "px"; line.style.transform = "rotate(" + ang + "deg)";
        board.appendChild(line);
      });
      // 点
      lv.nodes.forEach((pt, i) => {
        const d = document.createElement("button");
        d.className = "onestroke-dot";
        d.style.left = pt[0] + "px"; d.style.top = pt[1] + "px";
        d.setAttribute("aria-label", "点 " + (i + 1));
        d.addEventListener("click", () => onestrokePick(i));
        board.appendChild(d);
      });
      $("onestrokeStatus").textContent = onestrokeDone
        ? "🎉 第 " + (onestrokeLevel + 1) + " 关画完了！" + (onestrokeLevel < 2 ? " 点重画进下一关。" : " 全部通关！")
        : "第 " + (onestrokeLevel + 1) + " / 3 关（" + lv.name + "）· 已画 " + onestrokeUsed.size + " / " + lv.edges.length + " 条线"
          + (onestrokeDeadEnd() ? " · 😵 走进死胡同了，点撤销退一步。" : "");
    }
    // v3.0-r17：当前点没有未画的相邻边、但关卡还没画完 = 死胡同（以前只静默卡住）
    function onestrokeDeadEnd() {
      if (onestrokeDone || onestrokePath.length === 0) return false;
      const lv = ONESTROKE_LEVELS[onestrokeLevel];
      const cur = onestrokePath[onestrokePath.length - 1];
      return !lv.edges.some((e) => !onestrokeUsed.has(onestrokeEdgeKey(e[0], e[1])) && (e[0] === cur || e[1] === cur));
    }
    function onestrokePick(i) {
      if (onestrokeDone) return;
      const lv = ONESTROKE_LEVELS[onestrokeLevel];
      if (onestrokePath.length === 0) { onestrokePath = [i]; onestrokeRender(); return; }
      const cur = onestrokePath[onestrokePath.length - 1];
      const key = onestrokeEdgeKey(cur, i);
      const edgeExists = lv.edges.some((e) => onestrokeEdgeKey(e[0], e[1]) === key);
      if (!edgeExists || onestrokeUsed.has(key)) {
        // v3.0-r17：不相邻或已画过的线以前是静默忽略，用户不知道为什么点不动
        $("onestrokeStatus").textContent = "⚠️ 这两个点之间没有线（或已经画过），换个点试试。";
        return;
      }
      onestrokeUsed.add(key);
      onestrokePath.push(i);
      if (onestrokeUsed.size === lv.edges.length) onestrokeDone = true;
      onestrokeRender();
    }
    function onestrokeReset(level) {
      if (level !== undefined) onestrokeLevel = level;
      onestrokePath = []; onestrokeUsed = new Set(); onestrokeDone = false;
      onestrokeRender();
    }
    $("onestrokeUndoBtn").addEventListener("click", () => {
      if (onestrokePath.length <= 1) return;
      const last = onestrokePath.pop();
      const prev = onestrokePath[onestrokePath.length - 1];
      onestrokeUsed.delete(onestrokeEdgeKey(prev, last));
      onestrokeDone = false;
      onestrokeRender();
    });
    $("onestrokeResetBtn").addEventListener("click", () => {
      if (onestrokeDone && onestrokeLevel < 2) onestrokeReset(onestrokeLevel + 1);
      else onestrokeReset(onestrokeLevel);
    });
    onestrokeReset(0);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get onestroke() { return { level: onestrokeLevel, path: onestrokePath.slice(), used: [...onestrokeUsed], totalEdges: ONESTROKE_LEVELS[onestrokeLevel].edges.length, done: onestrokeDone }; },
        onestrokePick(i) { onestrokePick(i); },
        onestrokeSet(level) { onestrokeReset(level); },
    }));

  };
  /* ---------- 61. 弹珠机 ---------- */
  toyInitFns["marble"] = function () {
    const MARBLE_KEY = "dorm-toybox-marble-best-v1";
    const MARBLE_SLOTS = [10, 50, 100, 500, 100, 50]; // 6 个格子；实测从中间发时 500 分概率 10/32（和左边 100 分格并列最高），10 分格 1/32 才最难进，别写反了
    const MARBLE_ROWS = 5;
    let marbleBest = loadBest(MARBLE_KEY);
    let marbleScore = 0, marbleLeft = 10, marbleBall = null, marbleDirs = [], marbleOver = false;
    let marbleLaunchX = 150; // v3.0-r17：发射口横坐标（25~275，25 一档），以前只能从中间发，全凭运气
    let marbleLaunchLine = null; // 动态建的发射口说明行（不写进 HTML，冒烟的 id 总数 696 不变）
    function marbleSetLaunch(x) {
      marbleLaunchX = Math.max(25, Math.min(275, Math.round(x / 25) * 25));
      marbleRender();
    }
    function marbleLaunchName() {
      return marbleLaunchX <= 25 ? "最左" : marbleLaunchX <= 100 ? "偏左" : marbleLaunchX <= 175 ? "中间" : marbleLaunchX >= 275 ? "最右" : "偏右";
    }
    function marbleRender() {
      const board = $("marbleBoard");
      // 每次重建：钉子 + 格子 + 珠子（冒烟桩没有 removeChild/querySelector，用 innerHTML 清空最稳）
      board.innerHTML = "";
      const pegRows = [
        [50, 100, 150, 200, 250], [75, 125, 175, 225], [50, 100, 150, 200, 250], [75, 125, 175, 225], [50, 100, 150, 200, 250],
      ];
      pegRows.forEach((row, r) => {
        row.forEach((x) => {
          const p = document.createElement("div");
          p.className = "marble-peg";
          p.style.left = x + "px"; p.style.top = (40 + r * 40) + "px";
          board.appendChild(p);
        });
      });
      MARBLE_SLOTS.forEach((score, i) => {
        const s = document.createElement("div");
        s.className = "marble-slot";
        s.style.left = (i * 50) + "px"; s.style.width = "50px";
        s.textContent = score;
        board.appendChild(s);
      });
      if (marbleBall) {
        const b = document.createElement("div");
        b.className = "marble-ball";
        b.style.left = marbleBall.x + "px"; b.style.top = marbleBall.y + "px";
        board.appendChild(b);
      }
      // 发射口标记：▼ 钉在顶部，跟着发射口走
      const launcher = document.createElement("div");
      launcher.className = "marble-launcher";
      launcher.textContent = "▼";
      launcher.style.left = marbleLaunchX + "px";
      board.appendChild(launcher);
      if (marbleLaunchLine) marbleLaunchLine.textContent = "发射口：" + marbleLaunchName() + "（点棋盘或用 ◀ ▶ 移动）";
      $("marbleScore").textContent = marbleOver
        ? "🏁 10 颗放完了！得分 " + marbleScore + "，最好 " + marbleBest + "。"
        : "得分 " + marbleScore + " · 剩 " + marbleLeft + " 颗 · 最好 " + marbleBest;
    }
    function marbleDrop() {
      if (marbleOver || marbleBall || marbleLeft <= 0) return;
      marbleBall = { x: marbleLaunchX, y: 10, row: 0 };
      marbleDirs = [];
      for (let r = 0; r < MARBLE_ROWS; r++) marbleDirs.push(Math.random() < 0.5 ? -1 : 1);
      marbleRender();
      setTimeout(marbleStep, 150); // 第一步靠定时器走，测试可先 marbleSetDirs 再手动 marbleStep
    }
    function marbleStep() {
      if (!marbleBall) return;
      if (marbleBall.row < MARBLE_ROWS) {
        marbleBall.x = Math.max(15, Math.min(285, marbleBall.x + marbleDirs[marbleBall.row] * 25));
        marbleBall.y = 40 + (marbleBall.row + 1) * 40;
        marbleBall.row++;
        marbleRender();
        if (marbleBall.row < MARBLE_ROWS) {
          setTimeout(marbleStep, 150);
          return;
        }
      }
      // 落到底：按 x 定格子
      const slot = Math.max(0, Math.min(5, Math.floor(marbleBall.x / 50)));
      marbleScore += MARBLE_SLOTS[slot];
      marbleLeft--;
      marbleBall = null;
      if (marbleLeft <= 0) {
        marbleOver = true;
        if (marbleScore > marbleBest) {
          marbleBest = marbleScore;
          saveBest(MARBLE_KEY, marbleBest);
        }
      }
      marbleRender();
    }
    function marbleReset() {
      marbleScore = 0; marbleLeft = 10; marbleBall = null; marbleDirs = []; marbleOver = false;
      marbleLaunchX = 150;
      marbleRender();
    }
    // ---- 发射口控制（动态建，仿照刮刮乐的中奖率滑杆，不动 HTML 的 id 总数） ----
    (function marbleBuildControls() {
      const sec = $("toy-marble");
      if (!sec) return;
      const row = document.createElement("div");
      row.className = "btn-row";
      const leftBtn = document.createElement("button");
      leftBtn.className = "btn ghost-btn small";
      leftBtn.textContent = "◀ 左移";
      leftBtn.addEventListener("click", () => marbleSetLaunch(marbleLaunchX - 25));
      const rightBtn = document.createElement("button");
      rightBtn.className = "btn ghost-btn small";
      rightBtn.textContent = "右移 ▶";
      rightBtn.addEventListener("click", () => marbleSetLaunch(marbleLaunchX + 25));
      row.appendChild(leftBtn); row.appendChild(rightBtn);
      sec.appendChild(row);
      marbleLaunchLine = document.createElement("p");
      marbleLaunchLine.className = "count-line";
      sec.appendChild(marbleLaunchLine);
    })();
    // 点棋盘顶部也能定发射口（按 25 一档吸附）
    $("marbleBoard").addEventListener("pointerdown", (e) => {
      const board = $("marbleBoard");
      let x;
      if (board.getBoundingClientRect) {
        const rect = board.getBoundingClientRect();
        x = (e.clientX - rect.left) * 300 / (rect.width || 300);
      } else {
        x = (typeof e.offsetX === "number") ? e.offsetX : 150;
      }
      marbleSetLaunch(x);
    });
    $("marbleDropBtn").addEventListener("click", marbleDrop);
    $("marbleResetBtn").addEventListener("click", marbleReset);
    marbleRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get marble() { return { score: marbleScore, left: marbleLeft, ball: marbleBall ? { x: marbleBall.x, y: marbleBall.y, row: marbleBall.row } : null, dirs: marbleDirs.slice(), over: marbleOver, best: marbleBest, launchX: marbleLaunchX }; },
        marbleSetDirs(dirs) { marbleDirs = dirs.slice(); },
        marbleSetLaunch(x) { marbleSetLaunch(x); },
        marbleDrop() { marbleDrop(); },
        marbleStep() { marbleStep(); },
    }));

  };
  /* ---------- 62. 24点 ---------- */
  toyInitFns["make24"] = function () {
    const MAKE24_KEY = "dorm-toybox-make24-best-v1";
    // 12 组题：每组都用暴力求解验过可解（[1,6,7,8] 无解，已排除）
    const MAKE24_SETS = [[3, 3, 8, 8], [1, 5, 5, 5], [2, 3, 4, 6], [1, 2, 3, 4], [3, 4, 5, 6], [2, 4, 6, 8], [1, 3, 4, 6], [2, 2, 3, 9], [4, 5, 6, 7], [3, 5, 7, 9], [2, 3, 7, 10], [4, 4, 4, 4]];
    let make24Best = loadBest(MAKE24_KEY);
    let make24SetIdx = 0, make24Nums = [], make24Sel = [], make24Solved = 0, make24History = [];
    let make24SolvedSets = new Set(); // v3.0-r16：记哪些组已解过，重解同一组不重复计入“已解 N 组”
    function make24Fmt(v) {
      if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
      return String(Math.round(v * 100) / 100);
    }
    function make24Render() {
      const wrap = $("make24Nums");
      wrap.innerHTML = "";
      make24Nums.forEach((v, i) => {
        const b = document.createElement("button");
        b.className = "make24-num" + (make24Sel.indexOf(i) !== -1 ? " sel" : "");
        b.textContent = make24Fmt(v);
        b.addEventListener("click", () => make24PickNum(i));
        wrap.appendChild(b);
      });
      const ops = $("make24Ops");
      ops.innerHTML = "";
      ["+", "-", "×", "÷"].forEach((op) => {
        const b = document.createElement("button");
        b.className = "btn gold-btn make24-op";
        b.textContent = op;
        b.addEventListener("click", () => make24Combine(op));
        ops.appendChild(b);
      });
      $("make24Status").textContent = "第 " + (make24SetIdx + 1) + " / 12 组 · 已解 " + make24Solved + " 组 · 最好 " + make24Best + " 组";
    }
    function make24PickNum(i) {
      if (make24Sel.indexOf(i) !== -1) { make24Sel = make24Sel.filter((x) => x !== i); make24Render(); return; }
      if (make24Sel.length >= 2) make24Sel = [make24Sel[1]];
      make24Sel.push(i);
      make24Render();
    }
    function make24Combine(op) {
      if (make24Sel.length !== 2) return;
      const [i, j] = make24Sel;
      const a = make24Nums[i], b = make24Nums[j];
      let v = null;
      if (op === "+") v = a + b;
      else if (op === "-") v = a - b;
      else if (op === "×") v = a * b;
      else if (op === "÷") { if (Math.abs(b) < 1e-9) return; v = a / b; }
      make24History.push(make24Nums.slice());
      make24Nums = make24Nums.filter((_, k) => k !== i && k !== j);
      make24Nums.push(v);
      make24Sel = [];
      if (make24Nums.length === 1) {
        if (Math.abs(make24Nums[0] - 24) < 1e-6) {
          const firstSolve = !make24SolvedSets.has(make24SetIdx);
          if (firstSolve) {
            make24SolvedSets.add(make24SetIdx);
            make24Solved++;
          }
          if (make24Solved > make24Best) {
            make24Best = make24Solved;
            saveBest(MAKE24_KEY, make24Best);
          }
          $("make24Status").textContent = "🎉 等于 24！第 " + (make24SetIdx + 1) + " 组解出来了，已解 " + make24Solved + " 组。" + (firstSolve ? "点换一组继续。" : "（这组已经解过，不重复计。）");
          return;
        }
        $("make24Status").textContent = "❌ 最后剩 " + make24Fmt(make24Nums[0]) + "，不是 24。点撤销回去重算。";
      }
      make24Render();
    }
    function make24LoadSet(idx) {
      make24SetIdx = idx;
      make24Nums = MAKE24_SETS[idx].slice();
      make24Sel = []; make24History = [];
      make24Render();
    }
    $("make24UndoBtn").addEventListener("click", () => {
      if (make24History.length === 0) return;
      make24Nums = make24History.pop();
      make24Sel = [];
      make24Render();
    });
    $("make24ResetBtn").addEventListener("click", () => make24LoadSet((make24SetIdx + 1) % MAKE24_SETS.length));
    make24LoadSet(0);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get make24() { return { setIdx: make24SetIdx, nums: make24Nums.slice(), sel: make24Sel.slice(), solved: make24Solved, best: make24Best, sets: MAKE24_SETS.map((s) => s.slice()) }; },
        make24LoadSet(idx) { make24LoadSet(idx); },
        make24PickNum(i) { make24PickNum(i); },
        make24Combine(op) { make24Combine(op); },
    }));

  };
  /* ---------- 63. 切水果 ---------- */
  toyInitFns["fruitslice"] = function () {
    const FRUIT_KEY = "dorm-toybox-fruit-best-v1";
    const FRUIT_W = 340, FRUIT_H = 300;
    const FRUIT_EMOJI = ["🍎", "🍊", "🍉", "🍋", "🍇"];
    let fruitBest = loadBest(FRUIT_KEY);
    let fruitScore = 0, fruitLives = 3, fruitItems = [];
    let fruitRunning = false, fruitOver = false, fruitStepId = null, fruitSpawnId = null;
    function fruitDraw() {
      const cv = $("fruitsliceCanvas");
      if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, FRUIT_W, FRUIT_H);
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      fruitItems.forEach((f) => {
        if (f.sliced) {
          ctx.font = "20px sans-serif";
          ctx.fillText("💥", f.x, f.y);
          ctx.font = "28px sans-serif";
        } else {
          ctx.fillText(f.emoji, f.x, f.y);
        }
      });
    }
    function fruitSpawn() {
      if (!fruitRunning || fruitOver) return;
      const isBomb = Math.random() < 0.18;
      fruitItems.push({
        x: 30 + Math.random() * (FRUIT_W - 60),
        y: FRUIT_H + 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -(7 + Math.random() * 3),
        emoji: isBomb ? "💣" : FRUIT_EMOJI[Math.floor(Math.random() * FRUIT_EMOJI.length)],
        bomb: isBomb,
        sliced: false,
      });
    }
    function fruitStep() {
      if (!fruitRunning || fruitOver) return;
      fruitItems.forEach((f) => {
        f.x += f.vx; f.y += f.vy; f.vy += 0.25; // 重力
      });
      fruitItems = fruitItems.filter((f) => f.y < FRUIT_H + 40 && !(f.sliced && f.y > FRUIT_H));
      fruitRender();
    }
    function fruitSliceAt(x, y) {
      if (!fruitRunning || fruitOver) return;
      fruitItems.forEach((f) => {
        if (f.sliced) return;
        if (Math.hypot(f.x - x, f.y - y) < 26) {
          f.sliced = true;
          if (f.bomb) {
            fruitLives--;
            SFX.lose();
            $("fruitsliceStatus").textContent = "💥 切到炸弹了！还剩 " + fruitLives + " 条命。";
            if (fruitLives <= 0) fruitEnd("💔 三条命都炸没了。");
          } else {
            fruitScore += 10;
            SFX.pop(Math.min(1, fruitScore / 500));
          }
        }
      });
      fruitRender();
    }
    function fruitRender() {
      $("fruitsliceScore").textContent = fruitOver
        ? "🏁 得分 " + fruitScore + "，最好 " + fruitBest + "。"
        : "得分 " + fruitScore + " · 命 " + fruitLives + " · 最好 " + fruitBest;
      fruitDraw();
    }
    function fruitEnd(msg) {
      fruitOver = true; fruitRunning = false;
      if (fruitStepId) clearInterval(fruitStepId);
      if (fruitSpawnId) clearInterval(fruitSpawnId);
      fruitStepId = fruitSpawnId = null;
      if (fruitScore > fruitBest) {
        fruitBest = fruitScore;
        saveBest(FRUIT_KEY, fruitBest);
      }
      $("fruitsliceStatus").textContent = msg + "得分 " + fruitScore + "，最好 " + fruitBest + "。";
      fruitRender();
    }
    function fruitStart() {
      if (fruitRunning) return;
      if (fruitOver) fruitReset();
      fruitRunning = true;
      $("fruitsliceStatus").textContent = "切！别碰炸弹！";
      if (fruitStepId) clearInterval(fruitStepId);
      if (fruitSpawnId) clearInterval(fruitSpawnId);
      fruitStepId = setInterval(fruitStep, 16);
      fruitSpawnId = setInterval(fruitSpawn, 800);
    }
    function fruitReset() {
      if (fruitStepId) clearInterval(fruitStepId);
      if (fruitSpawnId) clearInterval(fruitSpawnId);
      fruitStepId = fruitSpawnId = null;
      fruitScore = 0; fruitLives = 3; fruitItems = []; fruitRunning = false; fruitOver = false;
      $("fruitsliceStatus").textContent = "点开始，水果就飞起来了。";
      fruitRender();
    }
    function fruitCanvasPos(e) {
      const cv = $("fruitsliceCanvas");
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: FRUIT_W, height: FRUIT_H };
      return {
        x: (e.clientX - rect.left) * FRUIT_W / (rect.width || FRUIT_W),
        y: (e.clientY - rect.top) * FRUIT_H / (rect.height || FRUIT_H),
      };
    }
    $("fruitsliceCanvas").addEventListener("pointermove", (e) => {
      if (!e.buttons) return;
      const p = fruitCanvasPos(e);
      fruitSliceAt(p.x, p.y);
    });
    $("fruitsliceCanvas").addEventListener("pointerdown", (e) => {
      const p = fruitCanvasPos(e);
      fruitSliceAt(p.x, p.y);
    });
    $("fruitsliceCanvas").addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.touches[0]; const p = fruitCanvasPos(t); fruitSliceAt(p.x, p.y); }, { passive: false });
    $("fruitsliceCanvas").addEventListener("touchmove", (e) => { e.preventDefault(); const t = e.touches[0]; const p = fruitCanvasPos(t); fruitSliceAt(p.x, p.y); }, { passive: false });
    $("fruitsliceStartBtn").addEventListener("click", fruitStart);
    $("fruitsliceResetBtn").addEventListener("click", fruitReset);
    fruitReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get fruit() { return { score: fruitScore, lives: fruitLives, items: fruitItems.map((f) => ({ x: f.x, y: f.y, emoji: f.emoji, bomb: f.bomb, sliced: f.sliced })), running: fruitRunning, over: fruitOver, best: fruitBest }; },
        fruitStart() { fruitStart(); },
        fruitStep() { fruitStep(); },
        fruitSliceAt(x, y) { fruitSliceAt(x, y); },
        fruitSet(items) { fruitItems = items.map((f) => ({ x: f.x, y: f.y, vx: 0, vy: 0, emoji: f.emoji, bomb: !!f.bomb, sliced: false })); fruitRunning = true; fruitOver = false; fruitRender(); },
    }));

    toyLeaveCleanup.fruitslice = () => { if (fruitStepId) { clearInterval(fruitStepId); fruitStepId = null; } if (fruitSpawnId) { clearInterval(fruitSpawnId); fruitSpawnId = null; } };
  };
  /* ---------- 64. 走迷宫 ---------- */
  toyInitFns["maze"] = function () {
    // 3 个迷宫：0=路，1=墙，S=起点，E=终点。都用 BFS 验过可解（最短 12/16/12 步）
    const MAZE_LEVELS = [
      [
        ["S", 0, 1, 0, 0, 0, 0],
        [1, 0, 1, 0, 1, 1, 0],
        [0, 0, 0, 0, 0, 1, 0],
        [0, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [1, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, "E"],
      ],
      [
        ["S", 0, 0, 1, 0, 0, 0],
        [1, 1, 0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, "E"],
      ],
      [
        ["S", 1, 0, 0, 0, 1, 0],
        [0, 1, 0, 1, 0, 1, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [1, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 1, 0],
        [0, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 0, 0, 0, "E"],
      ],
    ];
    let mazeLevel = 0, mazePR = 0, mazePC = 0, mazeSteps = 0, mazeDone = false;
    function mazeFindStart() {
      const lv = MAZE_LEVELS[mazeLevel];
      for (let r = 0; r < lv.length; r++) for (let c = 0; c < lv[r].length; c++) {
        if (lv[r][c] === "S") { mazePR = r; mazePC = c; return; }
      }
    }
    function mazeRender() {
      const lv = MAZE_LEVELS[mazeLevel];
      const board = $("mazeBoard");
      board.innerHTML = "";
      board.style.gridTemplateColumns = "repeat(" + lv[0].length + ", 1fr)";
      for (let r = 0; r < lv.length; r++) for (let c = 0; c < lv[r].length; c++) {
        const cell = document.createElement("div");
        cell.className = "maze-cell";
        const v = lv[r][c];
        if (v === 1) cell.classList.add("wall");
        if (r === mazePR && c === mazePC) { cell.classList.add("player"); cell.textContent = "🟢"; }
        else if (v === "E") cell.textContent = "🏁";
        else if (v === "S") cell.textContent = "·";
        board.appendChild(cell);
      }
      $("mazeStatus").textContent = mazeDone
        ? "🎉 第 " + (mazeLevel + 1) + " 关走出来了！" + (mazeLevel < 2 ? " 点重走进下一关。" : " 全部通关！")
        : "第 " + (mazeLevel + 1) + " / 3 关 · 步数 " + mazeSteps;
    }
    function mazeMove(dir) {
      if (mazeDone) return;
      const lv = MAZE_LEVELS[mazeLevel];
      const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
      if (!d) return;
      const nr = mazePR + d[0], nc = mazePC + d[1];
      if (nr < 0 || nr >= lv.length || nc < 0 || nc >= lv[0].length) return;
      if (lv[nr][nc] === 1) return; // 撞墙
      mazePR = nr; mazePC = nc; mazeSteps++;
      if (lv[nr][nc] === "E") mazeDone = true;
      mazeRender();
    }
    function mazeReset(level) {
      if (level !== undefined) mazeLevel = level;
      mazeSteps = 0; mazeDone = false;
      mazeFindStart();
      mazeRender();
    }
    $("mazeResetBtn").addEventListener("click", () => {
      if (mazeDone && mazeLevel < 2) mazeReset(mazeLevel + 1);
      else mazeReset(mazeLevel);
    });
    // 滑动走迷宫（复用 bindSwipe 的思路：tile 上也要 touch-action none，CSS 里已加）
    (function () {
      const board = $("mazeBoard");
      let sx = 0, sy = 0, tracking = false;
      board.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
      board.addEventListener("pointerup", (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.hypot(dx, dy) < 12) return;
        mazeMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      });
    })();
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-maze").classList.contains("hidden")) return;
        const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
        if (map[e.key]) { mazeMove(map[e.key]); if (e.preventDefault) e.preventDefault(); }
      });
    }
    mazeReset(0);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get maze() { return { level: mazeLevel, pr: mazePR, pc: mazePC, steps: mazeSteps, done: mazeDone, grid: MAZE_LEVELS[mazeLevel].map((r) => r.slice()) }; },
        mazeMove(dir) { mazeMove(dir); },
        mazeSet(level) { mazeReset(level); },
    }));

  };
  /* ---------- 65. 消消乐 ---------- */
  toyInitFns["match3"] = function () {
    const MATCH3_KEY = "dorm-toybox-match3-best-v1";
    const MATCH3_EMOJI = ["🍎", "🍊", "🍋", "🍇", "🫐"];
    const MATCH3_N = 6;
    let match3Best = loadBest(MATCH3_KEY);
    let match3Board = [], match3Score = 0, match3Moves = 0, match3Sel = null;
    function match3Random() { return MATCH3_EMOJI[Math.floor(Math.random() * MATCH3_EMOJI.length)]; }
    function match3NewBoard() {
      // 生成无初始三连的棋盘
      do {
        match3Board = [];
        for (let r = 0; r < MATCH3_N; r++) {
          match3Board[r] = [];
          for (let c = 0; c < MATCH3_N; c++) match3Board[r][c] = match3Random();
        }
      } while (match3Find().length > 0);
    }
    function match3Find() {
      // 找出所有三连及以上的格子
      const hit = new Set();
      for (let r = 0; r < MATCH3_N; r++) for (let c = 0; c < MATCH3_N; c++) {
        const v = match3Board[r][c];
        if (!v) continue;
        let n = 1;
        while (c + n < MATCH3_N && match3Board[r][c + n] === v) n++;
        if (n >= 3) for (let k = 0; k < n; k++) hit.add(r + "," + (c + k));
        n = 1;
        while (r + n < MATCH3_N && match3Board[r + n][c] === v) n++;
        if (n >= 3) for (let k = 0; k < n; k++) hit.add((r + k) + "," + c);
      }
      return [...hit];
    }
    function match3HasMove() {
      // 有没有一次相邻交换能凑出三连：没有就是死局，再怎么换都只会换回来
      for (let r = 0; r < MATCH3_N; r++) for (let c = 0; c < MATCH3_N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= MATCH3_N || c2 >= MATCH3_N) continue;
          if (match3Board[r][c] === match3Board[r2][c2]) continue;
          const t = match3Board[r][c];
          match3Board[r][c] = match3Board[r2][c2]; match3Board[r2][c2] = t;
          const ok = match3Find().length > 0;
          const t2 = match3Board[r][c];
          match3Board[r][c] = match3Board[r2][c2]; match3Board[r2][c2] = t2;
          if (ok) return true;
        }
      }
      return false;
    }
    function match3EnsureMoves() {
      // 死局就换一副新牌（分数保留），返回是否换过牌
      if (match3HasMove()) return false;
      let guard = 0;
      do { match3NewBoard(); } while (!match3HasMove() && guard++ < 50);
      $("match3Status").textContent = "这副牌走不下去了，换了一副新的，分数保留。";
      return true;
    }
    function match3Collapse() {
      // 消掉三连，下落补齐，连锁反应一直消到没有三连
      let total = 0;
      for (;;) {
        const hit = match3Find();
        if (hit.length === 0) break;
        total += hit.length;
        hit.forEach((k) => {
          const [r, c] = k.split(",").map(Number);
          match3Board[r][c] = null;
        });
        for (let c = 0; c < MATCH3_N; c++) {
          const col = [];
          for (let r = MATCH3_N - 1; r >= 0; r--) if (match3Board[r][c]) col.push(match3Board[r][c]);
          while (col.length < MATCH3_N) col.push(match3Random());
          for (let r = MATCH3_N - 1, i = 0; r >= 0; r--, i++) match3Board[r][c] = col[i];
        }
      }
      return total;
    }
    function match3Render() {
      const board = $("match3Board");
      board.innerHTML = "";
      for (let r = 0; r < MATCH3_N; r++) for (let c = 0; c < MATCH3_N; c++) {
        const cell = document.createElement("button");
        cell.className = "match3-cell" + (match3Sel && match3Sel[0] === r && match3Sel[1] === c ? " sel" : "");
        cell.textContent = match3Board[r][c];
        cell.setAttribute("data-r", r); cell.setAttribute("data-c", c);
        cell.addEventListener("click", () => match3Pick(r, c));
        board.appendChild(cell);
      }
      $("match3Score").textContent = "得分 " + match3Score + " · 步数 " + match3Moves + " · 最好 " + match3Best;
    }
    function match3Pick(r, c) {
      if (!match3Sel) { match3Sel = [r, c]; match3Render(); return; }
      const [pr, pc] = match3Sel;
      match3Sel = null;
      if (pr === r && pc === c) { match3Render(); return; }
      if (Math.abs(pr - r) + Math.abs(pc - c) !== 1) { match3Sel = [r, c]; match3Render(); return; } // 不相邻：改选新点的格子，而不是取消选中让玩家再点一次
      // 交换
      const tmp = match3Board[pr][pc];
      match3Board[pr][pc] = match3Board[r][c];
      match3Board[r][c] = tmp;
      const cleared = match3Collapse();
      if (cleared === 0) {
        // 没消掉，换回来
        match3Board[r][c] = match3Board[pr][pc];
        match3Board[pr][pc] = tmp;
      } else {
        match3Score += cleared * 10;
        match3Moves++;
        SFX.pop(Math.min(1, cleared / 12));
        if (match3Score > match3Best) {
          match3Best = match3Score;
          saveBest(MATCH3_KEY, match3Best);
        }
        // 补齐后可能走进死局：直接换一副新牌（状态提示在 match3EnsureMoves 里写），
        // 分数保留，别让玩家对着换不掉的牌干瞪眼；能正常走就把旧提示清掉
        if (!match3EnsureMoves()) $("match3Status").textContent = "";
      }
      match3Render();
    }
    function match3Reset() {
      match3Score = 0; match3Moves = 0; match3Sel = null;
      match3NewBoard();
      match3EnsureMoves();
      $("match3Status").textContent = "";
      match3Render();
    }
    $("match3ResetBtn").addEventListener("click", match3Reset);
    match3Reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get match3() { return { board: match3Board.map((r) => r.slice()), score: match3Score, moves: match3Moves, best: match3Best }; },
        matchSet(board) { match3Board = board.map((r) => r.slice()); match3Score = 0; match3Moves = 0; match3Sel = null; match3Render(); },
        matchPick(r, c) { match3Pick(r, c); },
        matchHasMove() { return match3HasMove(); },
        matchEnsure() { return match3EnsureMoves(); },
    }));

  };
  /* ---------- 66. 射箭 ---------- */
  toyInitFns["archery"] = function () {
    const ARCHERY_KEY = "dorm-toybox-archery-best-v1";
    const ARCHERY_C = 150; // 靶心
    let archeryBest = loadBest(ARCHERY_KEY);
    let archeryScore = 0, archeryLeft = 10, archeryShots = [];
    // v3.0-r17：拉弓机制。以前是“点哪射哪”，点红心就是满分，毫无技术含量；
    // 现在按住拉弓（力度 0→100，约 0.75 秒拉满），准星会晃，拉得越满晃得越小、散布越小，松手才射
    let archeryCharging = false, archeryPower = 0, archeryAim = null, archeryPhase = 0, archeryChargeId = null;
    function archerySway() {
      const amp = 3 + 23 * (1 - archeryPower / 100); // 拉满只剩 3px 微晃，没拉满晃到 26px
      return { x: Math.sin(archeryPhase * 0.35) * amp, y: Math.cos(archeryPhase * 0.3) * amp * 0.7 };
    }
    function archeryDraw() {
      const cv = $("archeryCanvas");
      if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 300, 300);
      // 靶子：5 环
      const rings = [
        [100, "#f5f5f5"], [80, "#222"], [60, "#3ec6a7"], [40, "#f5c542"], [20, "#e5484d"],
      ];
      rings.forEach(([r, color]) => {
        ctx.beginPath(); ctx.arc(ARCHERY_C, ARCHERY_C, r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });
      // 箭痕
      ctx.font = "16px sans-serif"; ctx.textAlign = "center";
      archeryShots.forEach((s) => ctx.fillText("✖", s.x, s.y));
      if (archeryCharging && archeryAim) {
        const sw = archerySway();
        const ax = archeryAim.x + sw.x, ay = archeryAim.y + sw.y;
        // 准星
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax, ay, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax - 14, ay); ctx.lineTo(ax + 14, ay); ctx.moveTo(ax, ay - 14); ctx.lineTo(ax, ay + 14); ctx.stroke();
        // 力度条
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(20, 282, 260, 10);
        ctx.fillStyle = archeryPower >= 100 ? "#f5c542" : "#3ec6a7";
        ctx.fillRect(20, 282, 260 * archeryPower / 100, 10);
      }
    }
    function archeryShoot(x, y) {
      if (archeryLeft <= 0) return;
      const d = Math.hypot(x - ARCHERY_C, y - ARCHERY_C);
      const pts = d < 20 ? 100 : d < 40 ? 80 : d < 60 ? 60 : d < 80 ? 40 : d < 100 ? 20 : 0;
      archeryScore += pts;
      archeryLeft--;
      archeryShots.push({ x, y });
      if (archeryLeft <= 0 && archeryScore > archeryBest) {
        archeryBest = archeryScore;
        saveBest(ARCHERY_KEY, archeryBest);
      }
      archeryRender();
    }
    function archeryRender() {
      $("archeryScore").textContent = archeryCharging
        ? "🏹 拉弓中 " + archeryPower + "%" + (archeryPower >= 100 ? "（拉满了，稳！）" : "（拉满越稳）") + " · 剩 " + archeryLeft + " 支"
        : archeryLeft <= 0
          ? "🏁 10 支射完了！得分 " + archeryScore + "，最好 " + archeryBest + "。"
          : "得分 " + archeryScore + " · 剩 " + archeryLeft + " 支 · 最好 " + archeryBest;
      archeryDraw();
    }
    function archeryChargeTick() {
      if (!archeryCharging) return;
      archeryPower = Math.min(100, archeryPower + 4);
      archeryPhase++;
      archeryRender();
    }
    function archeryCancelCharge() {
      if (archeryChargeId) { clearInterval(archeryChargeId); archeryChargeId = null; }
      archeryCharging = false; archeryPower = 0; archeryAim = null;
      archeryRender();
    }
    function archeryPos(e) {
      const cv = $("archeryCanvas");
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 300, height: 300 };
      return {
        x: (e.clientX - rect.left) * 300 / (rect.width || 300),
        y: (e.clientY - rect.top) * 300 / (rect.height || 300),
      };
    }
    function archeryRelease() {
      if (!archeryCharging) return;
      if (archeryChargeId) { clearInterval(archeryChargeId); archeryChargeId = null; }
      const sw = archerySway();
      const spread = (100 - archeryPower) / 100 * 40; // 没拉满：落点在 40px 内随机偏
      const ang = Math.random() * Math.PI * 2;
      const lx = Math.max(0, Math.min(300, archeryAim.x + sw.x + Math.cos(ang) * spread));
      const ly = Math.max(0, Math.min(300, archeryAim.y + sw.y + Math.sin(ang) * spread));
      archeryCharging = false; archeryPower = 0; archeryAim = null;
      archeryShoot(lx, ly);
    }
    function archeryReset() {
      if (archeryChargeId) { clearInterval(archeryChargeId); archeryChargeId = null; }
      archeryCharging = false; archeryPower = 0; archeryAim = null; archeryPhase = 0;
      archeryScore = 0; archeryLeft = 10; archeryShots = [];
      archeryRender();
    }
    $("archeryCanvas").addEventListener("pointerdown", (e) => {
      if (e.button === 2 || archeryLeft <= 0 || archeryCharging) return;
      archeryCharging = true; archeryPower = 0; archeryPhase = 0;
      archeryAim = archeryPos(e);
      if (archeryChargeId) clearInterval(archeryChargeId);
      archeryChargeId = setInterval(archeryChargeTick, 30);
      archeryRender();
    });
    $("archeryCanvas").addEventListener("pointermove", (e) => {
      if (archeryCharging) { archeryAim = archeryPos(e); archeryDraw(); }
    });
    $("archeryCanvas").addEventListener("pointerup", () => archeryRelease());
    $("archeryCanvas").addEventListener("pointerleave", () => { if (archeryCharging) archeryCancelCharge(); });
    $("archeryCanvas").addEventListener("pointercancel", () => { if (archeryCharging) archeryCancelCharge(); });
    $("archeryResetBtn").addEventListener("click", archeryReset);
    archeryReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get archery() { return { score: archeryScore, left: archeryLeft, shots: archeryShots.slice(), best: archeryBest, charging: archeryCharging, power: archeryPower }; },
        archeryShoot(x, y) { archeryShoot(x, y); },
        archeryRelease() { archeryRelease(); },
    }));
    toyLeaveCleanup.archery = () => { if (archeryChargeId) { clearInterval(archeryChargeId); archeryChargeId = null; } archeryCharging = false; };

  };
  /* ================= v3.0 新玩具（14 个） ================= */
  /* ---- 1. flappy 像素鸟 ---- */
  toyInitFns["flappy"] = function () {
    const KEY = "dorm-toybox-flappy-best-v1";
    let best = loadBest(KEY);
    let bird = null, pipes = [], score = 0, running = false, raf = null, frame = 0;
    let lastT = 0, spawnAcc = 0;
    const W = 320, H = 400, BW = 34, BH = 26, GRAV = 0.5, FLAP = -8, PW = 52;
    let GAP = 120, SPEED = 2.2, isNewBest = false; // 难度随分数递增
    function reset() {
      bird = { x: 70, y: H / 2, vy: 0, rot: 0 };
      pipes = []; score = 0; running = true; frame = 0; lastT = 0; spawnAcc = 0;
      GAP = 120; SPEED = 2.2; isNewBest = false;
      render();
    }
    function flap() {
      if (!running) { reset(); return; }
      bird.vy = FLAP;
      if (SFX.enabled) SFX.jump();
    }
    function step(now) {
      if (!running) return;
      if (!lastT) lastT = now;
      const dt = Math.min(50, now - lastT); // ms，防切后台跳变
      lastT = now;
      const k = dt / 16.7; // 以 60fps 为基准缩放，与刷新率无关
      frame++;
      bird.vy += GRAV * k;
      bird.y += bird.vy * k;
      bird.rot = Math.max(-0.4, Math.min(1.2, bird.vy * 0.08));
      spawnAcc += dt;
      if (spawnAcc >= 85 * 16.7) {
        spawnAcc = 0;
        const gy = 60 + Math.random() * (H - 120 - GAP);
        pipes.push({ x: W, gapY: gy, scored: false });
      }
      for (const p of pipes) {
        p.x -= SPEED * k;
        if (!p.scored && p.x + PW < bird.x) {
          p.scored = true; score++;
          // 难度递增：速度 +0.03/分（上限 3.6），缝隙 -0.8/分（下限 96）
          SPEED = Math.min(3.6, 2.2 + score * 0.03);
          GAP = Math.max(96, 120 - score * 0.8);
          if (SFX.enabled) SFX.pop(0.5 + score * 0.02);
        }
      }
      pipes = pipes.filter((p) => p.x > -PW - 10);
      // 碰撞
      let dead = bird.y < 0 || bird.y + BH > H;
      for (const p of pipes) {
        if (bird.x + BW > p.x && bird.x < p.x + PW) {
          if (bird.y < p.gapY || bird.y + BH > p.gapY + GAP) dead = true;
        }
      }
      if (dead) {
        running = false;
        if (score > best) { best = score; saveBest(KEY, best); isNewBest = score > 0; }
        if (SFX.enabled) { if (isNewBest) SFX.win(); else SFX.lose(); }
      }
      draw();
      render();
      if (running) raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("flappyCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        // 天空
        ctx.fillStyle = "#70c5ce"; ctx.fillRect(0, 0, W, H);
        // 云
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        const cx = (frame * 0.5) % (W + 100) - 50;
        ctx.beginPath(); ctx.arc(cx, 60, 22, 0, 7); ctx.arc(cx + 22, 55, 18, 0, 7); ctx.fill();
        // 水管
        for (const p of pipes) {
          ctx.fillStyle = "#5cb85c";
          ctx.fillRect(p.x, 0, PW, p.gapY);
          ctx.fillRect(p.x, p.gapY + GAP, PW, H - p.gapY - GAP);
          ctx.fillStyle = "#4a9a4a";
          ctx.fillRect(p.x - 3, p.gapY - 18, PW + 6, 18);
          ctx.fillRect(p.x - 3, p.gapY + GAP, PW + 6, 18);
        }
        // 地面
        ctx.fillStyle = "#ded895"; ctx.fillRect(0, H - 24, W, 24);
        if (!running && (score > 0 || pipes.length > 0)) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(isNewBest ? "🎉 新纪录！" : "💥 撞了！", W / 2, H / 2 - 10);
          ctx.font = "18px sans-serif";
          ctx.fillText("得分 " + score + " · 最好 " + best, W / 2, H / 2 + 24);
          ctx.fillText("点屏幕再来", W / 2, H / 2 + 52);
        }
        // 鸟
        ctx.save();
        ctx.translate(bird.x + BW / 2, bird.y + BH / 2);
        ctx.rotate(bird.rot);
        ctx.fillStyle = "#fbd343";
        ctx.beginPath(); ctx.ellipse(0, 0, BW / 2, BH / 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(8, -5, 6, 0, 7); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(10, -5, 2.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#fb8c00";
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(24, -4); ctx.lineTo(24, 4); ctx.fill();
        ctx.fillStyle = "#fbd343";
        ctx.beginPath(); ctx.ellipse(-6, 2, 10, 5, -0.4, 0, 7); ctx.fill();
        ctx.restore();
      } catch (e) {}
    }
    function render() {
      $("flappyScore").textContent = running || score > 0
        ? "得分 " + score + " · 最好 " + best
        : "点屏幕开始 · 最好 " + best;
    }
    const cv = $("flappyCanvas");
    if (cv) {
      cv.addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); flap(); if (!raf || !running) { if (running) { cancelAnimationFrame(raf); } raf = requestAnimationFrame(step); } });
    }
    // R15：电脑端空格/↑键也能飞（原来只能点鼠标）
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-flappy").classList.contains("hidden")) return;
        if (e.key === " " || e.key === "ArrowUp") { SFX.unlock(); flap(); if (!raf || !running) { if (running) { cancelAnimationFrame(raf); } raf = requestAnimationFrame(step); } if (e.preventDefault) e.preventDefault(); }
      });
    }
    $("flappyResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); raf = null; reset(); raf = requestAnimationFrame(step); });
    toyLeaveCleanup.flappy = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); running = false; draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get flappy() { return { score, best, running, birdY: bird ? bird.y : 0 }; },
      flappyFlap() { if (!running) { reset(); } flap(); if (!raf) raf = requestAnimationFrame(step); },
      flappyForceDead() { running = false; if (score > best) { best = score; saveBest(KEY, best); } render(); },
    }));
  };

  /* ---- 2. snake2 双人贪吃蛇 ---- */
  toyInitFns["snake2"] = function () {
    const W = 320, H = 320, CELL = 16, N = 20;
    let s1 = null, s2 = null, food = null, running = false, raf = null, tick = 0, winner = "";
    let lastT = 0, moveAcc = 0, aiMode = true; // 默认单人打 AI
    function reset() {
      s1 = { body: [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }], dir: { x: 1, y: 0 }, color: "#4caf50", score: 0, alive: true, name: "P1" };
      s2 = { body: [{ x: 14, y: 10 }, { x: 15, y: 10 }, { x: 16, y: 10 }], dir: { x: -1, y: 0 }, color: "#2196f3", score: 0, alive: true, name: "P2" };
      placeFood(); running = true; winner = ""; tick = 0; lastT = 0; moveAcc = 0;
      render();
    }
    function placeFood() {
      const occupied = new Set();
      [...s1.body, ...s2.body].forEach((s) => occupied.add(s.x + "," + s.y));
      let x, y, tries = 0;
      do { x = Math.floor(Math.random() * N); y = Math.floor(Math.random() * N); tries++; }
      while (occupied.has(x + "," + y) && tries < 200);
      food = { x, y };
    }
    // v3.0-r17：同时移动。以前是 P1 先动、P2 再动，P1 的头先占格，P2 撞上去只死自己，
    // 对头互换也判 P1 赢；现在两头同时算，互换/同格都同归于尽，尾巴本步会让位就不算撞
    function stepBoth() {
      const h1 = { x: s1.body[0].x + s1.dir.x, y: s1.body[0].y + s1.dir.y };
      const h2 = { x: s2.body[0].x + s2.dir.x, y: s2.body[0].y + s2.dir.y };
      const eat1 = s1.alive && food && h1.x === food.x && h1.y === food.y;
      const eat2 = s2.alive && food && h2.x === food.x && h2.y === food.y;
      function selfHit(s, h, eating) {
        if (h.x < 0 || h.x >= N || h.y < 0 || h.y >= N) return true; // 撞墙
        const solid = eating ? s.body.slice() : s.body.slice(0, -1); // 没吃到，尾巴那格会空出来
        return solid.some((b) => b.x === h.x && b.y === h.y); // 撞自己
      }
      let d1 = s1.alive && selfHit(s1, h1, eat1);
      let d2 = s2.alive && selfHit(s2, h2, eat2);
      // 对头：撞向同一格，或互换位置，都死
      if (s1.alive && s2.alive && !d1 && !d2) {
        if (h1.x === h2.x && h1.y === h2.y) { d1 = true; d2 = true; }
        else if (h1.x === s2.body[0].x && h1.y === s2.body[0].y && h2.x === s1.body[0].x && h2.y === s1.body[0].y) { d1 = true; d2 = true; }
      }
      // 撞对方身体：对方的头（会移走）和尾巴（没吃到会让位）不算；对方已死则全身都算
      if (s1.alive && !d1) {
        const o = (s2.alive && !d2) ? (eat2 ? s2.body.slice(1) : s2.body.slice(1, -1)) : s2.body.slice();
        if (o.some((b) => b.x === h1.x && b.y === h1.y)) d1 = true;
      }
      if (s2.alive && !d2) {
        const o = (s1.alive && !d1) ? (eat1 ? s1.body.slice(1) : s1.body.slice(1, -1)) : s1.body.slice();
        if (o.some((b) => b.x === h2.x && b.y === h2.y)) d2 = true;
      }
      if (s1.alive) {
        if (d1) { s1.alive = false; }
        else {
          s1.body.unshift(h1);
          if (eat1) { s1.score++; if (SFX.enabled) SFX.pop(0.4 + s1.score * 0.03); placeFood(); }
          else s1.body.pop();
        }
      }
      if (s2.alive) {
        if (d2) { s2.alive = false; }
        else {
          s2.body.unshift(h2);
          if (eat2) { s2.score++; if (SFX.enabled) SFX.pop(0.4 + s2.score * 0.03); placeFood(); }
          else s2.body.pop();
        }
      }
    }
    function snake2FinishStep() {
      if (!s1.alive || !s2.alive) {
        running = false;
        winner = !s1.alive && !s2.alive ? "平局！" : !s1.alive ? (aiMode ? "🤖 AI 获胜！" : "P2 🔵 获胜！") : "P1 🟢 获胜！";
        if (SFX.enabled) SFX.win();
      }
      draw(); render();
    }
    function step(now) {
      if (!running) return;
      if (!lastT) lastT = now;
      const dt = Math.min(100, now - lastT);
      lastT = now;
      moveAcc += dt;
      tick++;
      if (moveAcc >= 7 * 16.7) { // 每 ~117ms 走一格，与刷新率无关
        moveAcc = 0;
        aiThink();
        stepBoth();
        snake2FinishStep();
      }
      if (running) raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("snake2Canvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#12141c"; ctx.fillRect(0, 0, W, H);
        if (food) { ctx.fillStyle = "#ff5252"; ctx.beginPath(); ctx.arc(food.x * CELL + 8, food.y * CELL + 8, 6, 0, 7); ctx.fill(); }
        [s1, s2].forEach((s) => {
          s.body.forEach((b, i) => {
            ctx.fillStyle = i === 0 ? s.color : s.color + "aa";
            ctx.fillRect(b.x * CELL + 1, b.y * CELL + 1, CELL - 2, CELL - 2);
          });
        });
        if (!running && winner) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(winner, W / 2, H / 2);
        }
      } catch (e) {}
    }
    function render() {
      const p2name = aiMode ? "🤖 AI" : "P2 🔵";
      $("snake2Score").textContent = winner || ("P1 🟢 " + s1.score + " · " + p2name + " " + s2.score);
      const mb = $("snake2ModeBtn");
      if (mb) mb.textContent = aiMode ? "👥 双人对战" : "🤖 单人打AI";
    }
    // 简单 AI：贪心追食物，避墙避身
    function aiThink() {
      if (!aiMode || !s2.alive || !food) return;
      const h = s2.body[0];
      const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      let bestD = null, bestScore = -1e9;
      for (const d of dirs) {
        if (d.x === -s2.dir.x && d.y === -s2.dir.y) continue; // 不回头
        const nx = h.x + d.x, ny = h.y + d.y;
        if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue; // 撞墙
        if (s2.body.some((b, i) => i > 0 && b.x === nx && b.y === ny)) continue; // 撞自己
        if (s1.body.some((b) => b.x === nx && b.y === ny)) continue; // 撞对方
        // 评分：离食物越近越好，离墙/蛇身留空间
        let sc = -(Math.abs(nx - food.x) + Math.abs(ny - food.y)) * 10;
        // 周围空格越多越安全
        let space = 0;
        for (const dd of dirs) {
          const ax = nx + dd.x, ay = ny + dd.y;
          if (ax >= 0 && ax < N && ay >= 0 && ay < N &&
              !s2.body.some((b) => b.x === ax && b.y === ay) &&
              !s1.body.some((b) => b.x === ax && b.y === ay)) space++;
        }
        sc += space * 3 + Math.random() * 2;
        if (sc > bestScore) { bestScore = sc; bestD = d; }
      }
      if (bestD) s2.dir = bestD;
      // 无路可走就保持直行（听天由命）
    }
    function setDir(s, dx, dy) {
      if (!running || !s.alive) return;
      if (s.dir.x === -dx && s.dir.y === -dy) return;
      if (s.dir.x === dx && s.dir.y === dy) return;
      s.dir = { x: dx, y: dy };
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function snake2Keys(e) {
      if ($("toy-snake2") && $("toy-snake2").classList.contains("hidden")) return;
      const k = e.key.toLowerCase();
      if (k === "w") setDir(s1, 0, -1);
      else if (k === "s") setDir(s1, 0, 1);
      else if (k === "a") setDir(s1, -1, 0);
      else if (k === "d") setDir(s1, 1, 0);
      // v3.0-r17：方向键只在双人模式管 P2；单人时 P2 是 AI，方向键再去拨它就是作弊
      else if (e.key === "ArrowUp") { if (!aiMode) setDir(s2, 0, -1); e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (!aiMode) setDir(s2, 0, 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { if (!aiMode) setDir(s2, -1, 0); e.preventDefault(); }
      else if (e.key === "ArrowRight") { if (!aiMode) setDir(s2, 1, 0); e.preventDefault(); }
    });
    const cv = $("snake2Canvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      SFX.unlock();
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 320 };
      const x = e.clientX - rect.left;
      // v3.0-r17：单人时整屏都转 P1（右半屏再去转 AI 的蛇是作弊）；双人时左半屏转 P1，右半屏转 P2（顺时针转）
      const s = (aiMode || x < rect.width / 2) ? s1 : s2;
      const d = s.dir;
      setDir(s, -d.y, d.x);
    });
    $("snake2ResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); });
    const modeBtn = $("snake2ModeBtn");
    if (modeBtn) modeBtn.addEventListener("click", () => { aiMode = !aiMode; if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); });
    toyLeaveCleanup.snake2 = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get snake2() { return { p1: s1.score, p2: s2.score, running, winner, aiMode, dir1: { x: s1.dir.x, y: s1.dir.y }, dir2: { x: s2.dir.x, y: s2.dir.y }, alive1: s1.alive, alive2: s2.alive }; },
      snake2SetDir(p, dx, dy) { setDir(p === 1 ? s1 : s2, dx, dy); },
      snake2Step() { stepBoth(); snake2FinishStep(); },
      snake2Set(b1, d1, b2, d2, fx, fy) {
        s1.body = b1.map((c) => ({ x: c.x, y: c.y })); s1.dir = { x: d1.x, y: d1.y };
        s2.body = b2.map((c) => ({ x: c.x, y: c.y })); s2.dir = { x: d2.x, y: d2.y };
        food = { x: fx, y: fy };
        s1.alive = true; s2.alive = true; s1.score = 0; s2.score = 0;
        running = true; winner = ""; draw(); render();
      },
    }));
  };

  /* ---- 3. pong 乒乓 ---- */
  toyInitFns["pong"] = function () {
    const W = 320, H = 220, PW = 10, PH = 56;
    let py = H / 2, cy = H / 2, ball = null, ps = 0, cs = 0, running = false, raf = null, diff = 1, over = false;
    let lastT = 0;
    const DIFFS = [{ ai: 2.2, label: "简单" }, { ai: 3.6, label: "中等" }, { ai: 5.2, label: "困难" }];
    function reset() {
      py = H / 2; cy = H / 2; ps = 0; cs = 0; over = false; lastT = 0;
      serve(Math.random() < 0.5 ? 1 : -1);
      running = true; render();
    }
    function serve(dir) {
      const ang = (Math.random() - 0.5) * 0.9;
      ball = { x: W / 2, y: H / 2, vx: dir * 3.4 * Math.cos(ang), vy: 3.4 * Math.sin(ang) };
    }
    function step(now) {
      if (!running || over) return;
      if (!lastT) lastT = now;
      const dt = Math.min(50, now - lastT);
      lastT = now;
      const k = dt / 16.7;
      ball.x += ball.vx * k; ball.y += ball.vy * k;
      if (ball.y < 6) { ball.y = 6; ball.vy *= -1; }
      if (ball.y > H - 6) { ball.y = H - 6; ball.vy *= -1; }
      // 玩家挡板
      if (ball.vx < 0 && ball.x - 6 < 16 + PW && ball.x > 16 && ball.y > py - PH / 2 && ball.y < py + PH / 2) {
        const rel = (ball.y - py) / (PH / 2);
        const sp = Math.min(7, Math.hypot(ball.vx, ball.vy) * 1.06);
        const ang = rel * 0.9;
        ball.vx = sp * Math.cos(ang); ball.vy = sp * Math.sin(ang);
        ball.x = 16 + PW + 6;
        if (SFX.enabled) SFX.click();
      }
      // AI 挡板
      if (ball.vx > 0 && ball.x + 6 > W - 16 - PW && ball.x < W - 16 && ball.y > cy - PH / 2 && ball.y < cy + PH / 2) {
        const rel = (ball.y - cy) / (PH / 2);
        const sp = Math.min(7, Math.hypot(ball.vx, ball.vy) * 1.06);
        const ang = rel * 0.9;
        ball.vx = -sp * Math.cos(ang); ball.vy = sp * Math.sin(ang);
        ball.x = W - 16 - PW - 6;
        if (SFX.enabled) SFX.click();
      }
      // AI 移动
      const target = ball.vx > 0 ? ball.y : H / 2;
      const d = target - cy;
      cy += Math.max(-DIFFS[diff].ai * k, Math.min(DIFFS[diff].ai * k, d * 0.12 * k));
      cy = Math.max(PH / 2, Math.min(H - PH / 2, cy));
      // 得分
      if (ball.x < 0) { cs++; if (SFX.enabled) SFX.lose(); checkOver(); if (!over) serve(1); }
      if (ball.x > W) { ps++; if (SFX.enabled) SFX.pop(0.7); checkOver(); if (!over) serve(-1); }
      draw(); render();
      if (!over) raf = requestAnimationFrame(step);
    }
    function checkOver() {
      if (ps >= 5 || cs >= 5) {
        over = true; running = false;
        if (SFX.enabled) { if (ps >= 5) SFX.win(); else SFX.lose(); }
      }
    }
    function draw() {
      const cv = $("pongCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#12141c"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#4f7cff"; ctx.fillRect(16, py - PH / 2, PW, PH);
        ctx.fillStyle = "#ff5252"; ctx.fillRect(W - 16 - PW, cy - PH / 2, PW, PH);
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, 7); ctx.fill();
        if (over) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(ps >= 5 ? "🎉 你赢了！" : "😅 电脑赢了", W / 2, H / 2);
        }
      } catch (e) {}
    }
    function render() {
      $("pongScore").textContent = "你 " + ps + " : " + cs + " 电脑 · " + DIFFS[diff].label + (over ? " · 结束" : "");
    }
    const cv = $("pongCanvas");
    if (cv) {
      const move = (e) => {
        const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { top: 0, height: 220 };
        const y = (e.clientY - rect.top) * 220 / (rect.height || 220);
        py = Math.max(PH / 2, Math.min(H - PH / 2, y));
      };
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerdown", (e) => { SFX.unlock(); move(e); if (!running && !over) { running = true; raf = requestAnimationFrame(step); } });
      // iOS 双保险：touch 事件 + preventDefault
      cv.addEventListener("touchstart", (e) => { e.preventDefault(); SFX.unlock(); const t = e.touches[0]; move({ clientY: t.clientY }); if (!running && !over) { running = true; raf = requestAnimationFrame(step); } }, { passive: false });
      cv.addEventListener("touchmove", (e) => { e.preventDefault(); const t = e.touches[0]; move({ clientY: t.clientY }); }, { passive: false });
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function pongKeys(e) {
      if ($("toy-pong") && $("toy-pong").classList.contains("hidden")) return;
      if (e.key === "ArrowUp") { py = Math.max(PH / 2, py - 14); e.preventDefault(); }
      if (e.key === "ArrowDown") { py = Math.min(H - PH / 2, py + 14); e.preventDefault(); }
    });
    $("pongDiffRow").addEventListener("click", (e) => {
      const d = e.target && e.target.getAttribute && e.target.getAttribute("data-diff");
      if (d !== null && d !== undefined) { diff = parseInt(d, 10); render(); }
    });
    $("pongResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); });
    toyLeaveCleanup.pong = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); running = false; draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get pong() { return { ps, cs, diff, over }; },
      pongSetDiff(d) { diff = d; render(); },
      pongStart() { if (!running && !over) { running = true; raf = requestAnimationFrame(step); } },
    }));
  };

  /* ---- 4. arkanoid 打砖块2 ---- */
  toyInitFns["arkanoid"] = function () {
    const W = 320, H = 400;
    let paddle = null, balls = [], bricks = [], items = [], lasers = [], level = 1, score = 0, lives = 3, running = false, raf = null, longT = 0, started = false;
    let lastT = 0;
    const LEVELS = [
      ["rrrrr", "oooyo", "bbbbb", "ggggg"],
      ["rbrbr", "yoyoy", "gbgbg", "ororo", "bbbbb"],
      ["ggggggg", "roooooy", "rbbbbb y".replace(" ", ""), "roooooy", "ggggggg"],
    ];
    function buildLevel(lv) {
      bricks = [];
      const rows = LEVELS[(lv - 1) % LEVELS.length];
      const bw = W / rows[0].length;
      rows.forEach((row, r) => {
        [...row].forEach((ch, c) => {
          if (ch === "o") return;
          const colors = { r: "#e5484d", g: "#4caf50", b: "#4f7cff", y: "#f5c542" };
          bricks.push({ x: c * bw + 2, y: 30 + r * 22, w: bw - 4, h: 18, color: colors[ch] || "#999", hp: ch === "y" ? 2 : 1 });
        });
      });
    }
    function reset() {
      level = 1; score = 0; lives = 3;
      paddle = { x: W / 2 - 40, w: 80 };
      balls = [{ x: W / 2, y: H - 40, vx: 2.6, vy: -3.4, r: 6 }];
      items = []; lasers = []; longT = 0; lastT = 0;
      buildLevel(1); running = true;
      render();
    }
    function step(now) {
      if (!running) return;
      if (!lastT) lastT = now;
      const dt = Math.min(50, now - lastT);
      lastT = now;
      const k = dt / 16.7;
      const pw = longT > 0 ? 120 : 80;
      if (longT > 0) longT -= dt;
      // 球
      for (const b of balls) {
        b.x += b.vx * k; b.y += b.vy * k;
        if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -1; }
        if (b.y < b.r) { b.y = b.r; b.vy *= -1; }
        // 挡板
        if (b.vy > 0 && b.y + b.r > H - 24 && b.y < H - 10 && b.x > paddle.x && b.x < paddle.x + pw) {
          const rel = (b.x - (paddle.x + pw / 2)) / (pw / 2);
          const sp = Math.min(6, Math.hypot(b.vx, b.vy) * 1.02);
          b.vx = sp * rel * 0.9; b.vy = -Math.abs(sp * Math.cos(rel * 0.7));
          b.y = H - 24 - b.r;
          if (SFX.enabled) SFX.click();
        }
        // 砖块
        for (const br of bricks) {
          if (br.hp <= 0) continue;
          if (b.x > br.x - b.r && b.x < br.x + br.w + b.r && b.y > br.y - b.r && b.y < br.y + br.h + b.r) {
            br.hp--;
            if (br.hp <= 0) {
              score += 10;
              if (SFX.enabled) SFX.pop(0.5);
              if (Math.random() < 0.22) {
                const kinds = ["multi", "long", "laser"];
                items.push({ x: br.x + br.w / 2, y: br.y, kind: kinds[Math.floor(Math.random() * 3)], vy: 1.6 });
              }
            }
            b.vy *= -1;
            break;
          }
        }
      }
      // 掉球
      balls = balls.filter((b) => b.y < H + 20);
      if (balls.length === 0) {
        lives--;
        if (SFX.enabled) SFX.lose();
        if (lives <= 0) { running = false; draw(); render(); return; }
        balls = [{ x: paddle.x + pw / 2, y: H - 40, vx: 2.6, vy: -3.4, r: 6 }];
      }
      // 道具
      for (const it of items) {
        it.y += it.vy * k;
        if (it.y > H - 30 && it.y < H && it.x > paddle.x && it.x < paddle.x + pw) {
          it.taken = true;
          if (SFX.enabled) SFX.coin();
          if (it.kind === "multi") {
            const nb = [];
            for (const b of balls) nb.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy, r: 6 }, { x: b.x, y: b.y, vx: b.vx * 0.7, vy: -Math.abs(b.vy), r: 6 });
            balls = balls.concat(nb).slice(0, 8);
          } else if (it.kind === "long") longT = 10000;
          else if (it.kind === "laser") {
            lasers.push({ x: paddle.x + 10 }, { x: paddle.x + pw - 10 });
            setTimeout(() => { lasers = []; }, 6000);
          }
        }
      }
      items = items.filter((it) => !it.taken && it.y < H + 10);
      // 激光
      // （简化：激光自动打最下方的砖）
      if (lasers.length && Math.random() < 0.1) {
        const alive = bricks.filter((b) => b.hp > 0);
        if (alive.length) {
          const t = alive[alive.length - 1];
          t.hp = 0; score += 10;
          if (SFX.enabled) SFX.shoot();
        }
      }
      // 过关
      if (bricks.every((b) => b.hp <= 0)) {
        level++;
        if (level > 3) { running = false; if (SFX.enabled) SFX.win(); draw(); render(); return; }
        buildLevel(level);
        balls = [{ x: W / 2, y: H - 40, vx: 2.6, vy: -3.4, r: 6 }];
        if (SFX.enabled) SFX.win();
      }
      draw(); render();
      raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("arkanoidCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#12141c"; ctx.fillRect(0, 0, W, H);
        for (const br of bricks) {
          if (br.hp <= 0) continue;
          ctx.fillStyle = br.color;
          ctx.fillRect(br.x, br.y, br.w, br.h);
          if (br.hp > 1) { ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(br.x, br.y, br.w, 5); }
        }
        const pw = longT > 0 ? 120 : 80;
        ctx.fillStyle = "#4f7cff";
        ctx.beginPath(); ctx.roundRect(paddle.x, H - 24, pw, 12, 6); ctx.fill();
        for (const b of balls) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
        for (const it of items) {
          ctx.fillStyle = it.kind === "multi" ? "#4caf50" : it.kind === "long" ? "#f5c542" : "#e5484d";
          ctx.beginPath(); ctx.arc(it.x, it.y, 8, 0, 7); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(it.kind === "multi" ? "×" : it.kind === "long" ? "—" : "!", it.x, it.y + 3);
        }
        if (!running && started) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(level > 3 ? "🏆 通关！" : "💀 游戏结束", W / 2, H / 2);
        } else if (!running && !started) {
          ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("👆 点一下开始", W / 2, H / 2);
        }
      } catch (e) {}
    }
    function render() {
      $("arkanoidScore").textContent = level > 3 ? "🏆 3 关全通！总分 " + score : "第 " + level + " 关 · 分 " + score + " · 命 " + lives;
    }
    const cv = $("arkanoidCanvas");
    if (cv) {
      const move = (e) => {
        const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, width: 320 };
        const x = (e.clientX - rect.left) * 320 / (rect.width || 320);
        const pw = longT > 0 ? 120 : 80;
        paddle.x = Math.max(0, Math.min(W - pw, x - pw / 2));
      };
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerdown", (e) => { SFX.unlock(); move(e); });
      cv.addEventListener("touchstart", (e) => { e.preventDefault(); SFX.unlock(); const t = e.touches[0]; move({ clientX: t.clientX }); }, { passive: false });
      cv.addEventListener("touchmove", (e) => { e.preventDefault(); const t = e.touches[0]; move({ clientX: t.clientX }); }, { passive: false });
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function arkanoidKeys(e) {
      if ($("toy-arkanoid") && $("toy-arkanoid").classList.contains("hidden")) return;
      const pw = longT > 0 ? 120 : 80;
      if (e.key === "ArrowLeft") paddle.x = Math.max(0, paddle.x - 18);
      if (e.key === "ArrowRight") paddle.x = Math.min(W - pw, paddle.x + 18);
    });
    $("arkanoidResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); started = true; raf = requestAnimationFrame(step); });
    toyLeaveCleanup.arkanoid = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); running = false; draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get arkanoid() { return { level, score, lives, bricks: bricks.filter((b) => b.hp > 0).length, running }; },
      arkanoidStart() { if (!running && lives > 0 && level <= 3) { running = true; started = true; raf = requestAnimationFrame(step); } },
    }));
  };

  /* ---- 5. mines2 大扫雷 ---- */
  toyInitFns["mines2"] = function () {
    const N = 16, MINES = 40;
    const KEY = "dorm-toybox-mines2-best-v1";
    let board = [], revealed = 0, flags = 0, over = false, win = false, flagMode = false, startTime = 0;
    let best = lsGet(KEY, "");
    function reset() {
      board = [];
      for (let i = 0; i < N * N; i++) board.push({ mine: false, open: false, flag: false, num: 0 });
      // 布雷
      let placed = 0;
      while (placed < MINES) {
        const i = Math.floor(Math.random() * N * N);
        if (!board[i].mine) { board[i].mine = true; placed++; }
      }
      // 数字
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (board[y * N + x].mine) continue;
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < N && ny >= 0 && ny < N && board[ny * N + nx].mine) c++;
        }
        board[y * N + x].num = c;
      }
      revealed = 0; flags = 0; over = false; win = false; firstOpen = true;
      startTime = Date.now();
      draw();
    }
    let firstOpen = true;
    function open(x, y) {
      if (over || win) return;
      const i = y * N + x;
      const c = board[i];
      if (c.open || c.flag) return;
      // 首点保护：第一次点到雷就把雷挪走，保证开局不死
      if (firstOpen && c.mine) {
        c.mine = false;
        // 在别处补一颗雷
        for (let t = 0; t < 500; t++) {
          const j = Math.floor(Math.random() * N * N);
          if (!board[j].mine && j !== i) { board[j].mine = true; break; }
        }
        // 重算数字
        for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
          if (board[yy * N + xx].mine) continue;
          let cc = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = xx + dx, ny = yy + dy;
            if (nx >= 0 && nx < N && ny >= 0 && ny < N && board[ny * N + nx].mine) cc++;
          }
          board[yy * N + xx].num = cc;
        }
      }
      firstOpen = false;
      if (c.mine) {
        over = true; c.open = true;
        if (SFX.enabled) SFX.lose();
        draw(); render(); return;
      }
      //  flood fill
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        const ci = cy * N + cx;
        const cell = board[ci];
        if (cell.open || cell.flag || cell.mine) continue;
        cell.open = true; revealed++;
        if (SFX.enabled && revealed % 5 === 0) SFX.click();
        if (cell.num === 0) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < N && ny >= 0 && ny < N && !board[ny * N + nx].open) stack.push([nx, ny]);
          }
        }
      }
      if (revealed === N * N - MINES) {
        win = true;
        const secs = Math.floor((Date.now() - startTime) / 1000);
        if (!best || secs < parseInt(best, 10)) { best = String(secs); lsSet(KEY, best); }
        if (SFX.enabled) SFX.win();
      }
      draw(); render();
    }
    function toggleFlag(x, y) {
      if (over || win) return;
      const c = board[y * N + x];
      if (c.open) return;
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      if (SFX.enabled) SFX.click();
      draw(); render();
    }
    function draw() {
      const bd = $("mines2Board");
      if (!bd) return;
      bd.innerHTML = "";
      bd.style.cssText = "display:grid;grid-template-columns:repeat(16,1fr);gap:1px;max-width:340px;margin:0 auto;";
      board.forEach((c, i) => {
        const d = document.createElement("div");
        const x = i % N, y = Math.floor(i / N);
        d.style.cssText = "aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;cursor:pointer;border-radius:2px;" +
          (c.open ? (c.mine ? "background:#e5484d;color:#fff;" : "background:#2a2f42;color:#fff;") : "background:#1e2230;");
        if (c.open) d.textContent = c.mine ? "💣" : (c.num > 0 ? c.num : "");
        else if (c.flag) d.textContent = "🚩";
        d.addEventListener("click", () => { SFX.unlock(); flagMode ? toggleFlag(x, y) : open(x, y); });
        d.addEventListener("contextmenu", (e) => { e.preventDefault(); toggleFlag(x, y); });
        let pressT = null;
        d.addEventListener("pointerdown", () => { pressT = setTimeout(() => { toggleFlag(x, y); pressT = null; }, 450); });
        d.addEventListener("pointerup", () => { if (pressT) clearTimeout(pressT); });
        bd.appendChild(d);
      });
      if (over || win) {
        board.forEach((c, i) => {
          if (c.mine && !c.open) {
            const d = bd.children[i];
            if (d && !c.flag) d.textContent = "💣";
          }
        });
      }
    }
    function render() {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      $("mines2Score").textContent = win ? "🏆 赢了！用时 " + secs + "s · 最好 " + (best ? best + "s" : "--")
        : over ? "💥 踩雷了！点重开再来"
        : "🚩 剩 " + (MINES - flags) + " · 已开 " + revealed + "/" + (N * N - MINES) + " · 最好 " + (best ? best + "s" : "--");
      $("mines2FlagBtn").textContent = "🚩 插旗模式：" + (flagMode ? "开" : "关");
    }
    $("mines2FlagBtn").addEventListener("click", () => { flagMode = !flagMode; render(); });
    $("mines2ResetBtn").addEventListener("click", reset);
    reset(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get mines2() { return { revealed, flags, over, win, mines: MINES, n: N, best }; },
      mines2Open(x, y) { open(x, y); },
      mines2Flag(x, y) { toggleFlag(x, y); },
    }));
  };
  /* ---- 6. chess 象棋（简化） ---- */
  toyInitFns["chess"] = function () {
    // 9x10 棋盘，简化规则：车/马/炮/兵/将/士/象
    const W = 320, H = 352, CW = 320 / 9, CH = 320 / 10;
    let board = [], sel = null, turn = "red", over = false, msg = "";
    const INIT = [
      ["bR", "bN", "bB", "bA", "bK", "bA", "bB", "bN", "bR"],
      [null, null, null, null, null, null, null, null, null],
      [null, "bC", null, null, null, null, null, "bC", null],
      ["bP", null, "bP", null, "bP", null, "bP", null, "bP"],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      ["rP", null, "rP", null, "rP", null, "rP", null, "rP"],
      [null, "rC", null, null, null, null, null, "rC", null],
      [null, null, null, null, null, null, null, null, null],
      ["rR", "rN", "rB", "rA", "rK", "rA", "rB", "rN", "rR"],
    ];
    const NAMES = { K: "将", A: "士", B: "象", R: "车", N: "马", C: "炮", P: "兵" };
    function reset() {
      board = INIT.map((r) => r.slice());
      sel = null; turn = "red"; over = false; msg = "轮到你走（红）";
      draw(); render();
    }
    function inPalace(x, y, red) {
      return x >= 3 && x <= 5 && (red ? y >= 7 : y <= 2);
    }
    function moves(x, y) {
      const p = board[y][x];
      if (!p) return [];
      const red = p[0] === "r", t = p[1], out = [];
      const add = (nx, ny) => {
        if (nx < 0 || nx > 8 || ny < 0 || ny > 9) return;
        const q = board[ny][nx];
        if (!q || (q[0] === "r") !== red) out.push([nx, ny]);
      };
      const addEmpty = (nx, ny) => {
        if (nx < 0 || nx > 8 || ny < 0 || ny > 9) return false;
        if (!board[ny][nx]) { out.push([nx, ny]); return true; }
        return false;
      };
      if (t === "R") {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy;
          while (nx >= 0 && nx <= 8 && ny >= 0 && ny <= 9) {
            const q = board[ny][nx];
            if (!q) out.push([nx, ny]);
            else { if ((q[0] === "r") !== red) out.push([nx, ny]); break; }
            nx += dx; ny += dy;
          }
        }
      } else if (t === "N") {
        for (const [dx, dy, lx, ly] of [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]]) {
          if (board[y + ly] && board[y + ly][x + lx]) continue; // 蹩腿
          add(x + dx, y + dy);
        }
      } else if (t === "B") {
        for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) {
          const mx = x + dx / 2, my = y + dy / 2;
          if (board[my] && board[my][mx]) continue; // 塞象眼
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx > 8 || ny < 0 || ny > 9) continue;
          if (red && ny < 5) continue; if (!red && ny > 4) continue; // 不过河
          add(nx, ny);
        }
      } else if (t === "A") {
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (inPalace(nx, ny, red)) add(nx, ny);
        }
      } else if (t === "K") {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (inPalace(nx, ny, red)) add(nx, ny);
        }
      } else if (t === "P") {
        const fwd = red ? -1 : 1;
        addEmpty(x, y + fwd);
        const crossed = red ? y <= 4 : y >= 5;
        if (crossed) { addEmpty(x + 1, y); addEmpty(x - 1, y); }
        // 吃子
        for (const [dx, dy] of [[0, fwd], [1, 0], [-1, 0]]) {
          if (dy === 0 && !crossed) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx > 8 || ny < 0 || ny > 9) continue;
          const q = board[ny][nx];
          if (q && (q[0] === "r") !== red) out.push([nx, ny]);
        }
      } else if (t === "C") {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy, jumped = false;
          while (nx >= 0 && nx <= 8 && ny >= 0 && ny <= 9) {
            const q = board[ny][nx];
            if (!jumped) {
              if (!q) out.push([nx, ny]);
              else jumped = true;
            } else {
              if (q) { if ((q[0] === "r") !== red) out.push([nx, ny]); break; }
            }
            nx += dx; ny += dy;
          }
        }
      }
      return out;
    }
    function kingsFace() {
      // 将帅不能照面：同一列且中间无子
      let rk = null, bk = null;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = board[y][x];
        if (p === "rK") rk = [x, y];
        if (p === "bK") bk = [x, y];
      }
      if (!rk || !bk || rk[0] !== bk[0]) return false;
      const x = rk[0], y1 = Math.min(rk[1], bk[1]), y2 = Math.max(rk[1], bk[1]);
      for (let y = y1 + 1; y < y2; y++) if (board[y][x]) return false;
      return true;
    }
    function doMove(fx, fy, tx, ty) {
      const p = board[fy][fx];
      const target = board[ty][tx];
      // 试走：检查是否导致将帅照面
      board[ty][tx] = p; board[fy][fx] = null;
      if (kingsFace()) {
        board[fy][fx] = p; board[ty][tx] = target; // 撤销
        return "illegal";
      }
      if (SFX.enabled) SFX.click();
      if (target && target[1] === "K") {
        over = true;
        msg = target[0] === "b" ? "🎉 你赢了！" : "😅 AI 赢了";
        if (SFX.enabled) { if (target[0] === "b") SFX.win(); else SFX.lose(); }
      }
      return target;
    }
    function aiMove() {
      if (over || turn !== "black") return;
      const all = [];
      for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = board[y][x];
        if (p && p[0] === "b") {
          for (const [tx, ty] of moves(x, y)) {
            const t = board[ty][tx];
            all.push({ fx: x, fy: y, tx, ty, cap: t ? 1 : 0, val: t ? { K: 99, R: 9, N: 4, C: 4, B: 2, A: 2, P: 1 }[t[1]] : 0 });
          }
        }
      }
      if (!all.length) { over = true; msg = "🎉 你赢了！AI 无棋可走"; return; }
      // 吃子优先；无吃子时偏好向前走（黑方 y 增大为前进），带小随机
      for (const m of all) m.score = m.val * 10 + Math.max(-2, Math.min(2, m.ty - m.fy)) + Math.random() * 2;
      all.sort((a, b) => b.score - a.score);
      const pick = all[0];
      const r = doMove(pick.fx, pick.fy, pick.tx, pick.ty);
      if (r === "illegal") {
        // AI 误走照面，换个走法
        const alt = all.find((m) => { const t = board[m.ty][m.tx]; board[m.ty][m.tx] = board[m.fy][m.fx]; board[m.fy][m.fx] = null; const bad = kingsFace(); board[m.fy][m.fx] = board[m.ty][m.tx]; board[m.ty][m.tx] = t; return !bad; });
        if (alt) doMove(alt.fx, alt.fy, alt.tx, alt.ty);
      }
      turn = "red";
      if (!over) msg = "轮到你走（红）";
      draw(); render();
    }
    function onTap(x, y) {
      if (over || turn !== "red") return;
      SFX.unlock();
      if (sel) {
        const ms = moves(sel.x, sel.y);
        if (ms.some(([mx, my]) => mx === x && my === y)) {
          const r = doMove(sel.x, sel.y, x, y);
          if (r === "illegal") { msg = "⚠️ 将帅不能照面！"; draw(); render(); return; }
          sel = null;
          if (!over) { turn = "black"; msg = "AI 思考中…"; draw(); render(); setTimeout(aiMove, 500); return; }
          draw(); render(); return;
        }
      }
      const p = board[y] && board[y][x];
      if (p && p[0] === "r") { sel = { x, y }; if (SFX.enabled) SFX.click(); }
      else sel = null;
      draw(); render();
    }
    function draw() {
      const cv = $("chessCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#e8c98a"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
          ctx.beginPath(); ctx.moveTo(CW / 2, i * CH + CH / 2); ctx.lineTo(W - CW / 2, i * CH + CH / 2); ctx.stroke();
        }
        for (let i = 0; i < 9; i++) {
          ctx.beginPath(); ctx.moveTo(i * CW + CW / 2, CH / 2);
          ctx.lineTo(i * CW + CW / 2, 4 * CH + CH / 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(i * CW + CW / 2, 5 * CH + CH / 2);
          ctx.lineTo(i * CW + CW / 2, 9 * CH + CH / 2); ctx.stroke();
        }
        // 楚河汉界
        ctx.fillStyle = "#8b5a2b"; ctx.font = "14px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("楚 河            汉 界", W / 2, 5 * CH - 4);
        // 九宫斜线
        for (const [y0, y1] of [[0, 2], [7, 9]]) {
          for (const [x0, x1] of [[3, 5]]) {
            ctx.beginPath(); ctx.moveTo(x0 * CW + CW / 2, y0 * CH + CH / 2); ctx.lineTo(x1 * CW + CW / 2, y1 * CH + CH / 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x1 * CW + CW / 2, y0 * CH + CH / 2); ctx.lineTo(x0 * CW + CW / 2, y1 * CH + CH / 2); ctx.stroke();
          }
        }
        const ms = sel ? moves(sel.x, sel.y) : [];
        for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
          const p = board[y][x];
          const cx = x * CW + CW / 2, cy = y * CH + CH / 2;
          if (ms.some(([mx, my]) => mx === x && my === y)) {
            ctx.fillStyle = "rgba(79,124,255,0.35)";
            ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
          }
          if (!p) continue;
          const red = p[0] === "r";
          if (sel && sel.x === x && sel.y === y) {
            ctx.fillStyle = "rgba(79,124,255,0.5)";
            ctx.beginPath(); ctx.arc(cx, cy, 15, 0, 7); ctx.fill();
          }
          ctx.fillStyle = "#f5e6c8";
          ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
          ctx.strokeStyle = red ? "#c0392b" : "#222"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = red ? "#c0392b" : "#222";
          ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(NAMES[p[1]], cx, cy + 1);
        }
        ctx.textBaseline = "alphabetic";
      } catch (e) {}
    }
    function render() { $("chessMsg").textContent = msg; }
    const cv = $("chessCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 352 };
      const x = Math.floor((e.clientX - rect.left) * 9 / (rect.width || 320));
      const y = Math.floor((e.clientY - rect.top) * 10 / (rect.height || 352));
      if (x >= 0 && x < 9 && y >= 0 && y < 10) onTap(x, y);
    });
    $("chessResetBtn").addEventListener("click", reset);
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get chess() { return { turn, over, msg }; },
      chessMove(fx, fy, tx, ty) {
        const ms = moves(fx, fy);
        if (ms.some(([mx, my]) => mx === tx && my === ty)) { doMove(fx, fy, tx, ty); turn = "black"; draw(); render(); return true; }
        return false;
      },
      chessAi() { aiMove(); },
    }));
  };

  /* ---- 7. go 围棋9路 ---- */
  toyInitFns["go"] = function () {
    const N = 9, W = 320, CELL = 320 / 9;
    let board = [], turn = "black", over = false, passes = 0, capB = 0, capW = 0;
    let goHistory = []; // v3.0-r15：落子后的局面序列，打劫（禁立即回提）用
    function goKey(b) { return b.map((row) => row.map((v) => (v === "black" ? "B" : v === "white" ? "W" : ".")).join("")).join("/"); }
    function reset() {
      board = Array.from({ length: N }, () => Array(N).fill(null));
      turn = "black"; over = false; passes = 0; capB = 0; capW = 0;
      goHistory = [goKey(board)];
      draw(); render();
    }
    function neighbors(x, y) {
      const out = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < N && ny >= 0 && ny < N) out.push([nx, ny]);
      }
      return out;
    }
    function group(x, y, color, seen) {
      seen = seen || new Set();
      const key = x + "," + y;
      if (seen.has(key) || board[y][x] !== color) return { stones: [], libs: 0 };
      seen.add(key);
      let stones = [[x, y]], libs = 0;
      const libSet = new Set();
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        for (const [nx, ny] of neighbors(cx, cy)) {
          const nk = nx + "," + ny;
          if (board[ny][nx] === null) libSet.add(nk);
          else if (board[ny][nx] === color && !seen.has(nk)) { seen.add(nk); stones.push([nx, ny]); stack.push([nx, ny]); }
        }
      }
      return { stones, libs: libSet.size };
    }
    function play(x, y, color) {
      if (over || board[y][x]) return false;
      board[y][x] = color;
      const opp = color === "black" ? "white" : "black";
      let captured = 0;
      const capturedStones = [];
      for (const [nx, ny] of neighbors(x, y)) {
        if (board[ny][nx] === opp) {
          const g = group(nx, ny, opp);
          if (g.libs === 0) {
            for (const [sx, sy] of g.stones) { board[sy][sx] = null; capturedStones.push([sx, sy]); }
            captured += g.stones.length;
          }
        }
      }
      // 自杀手不允许
      const self = group(x, y, color);
      if (self.libs === 0 && captured === 0) { board[y][x] = null; return false; }
      // v3.0-r15：打劫——只提一子且局面回到对方落子前时，立即回提禁手（否则双方可无限提来提去）
      const key = goKey(board);
      if (captured === 1 && goHistory.length >= 2 && key === goHistory[goHistory.length - 2]) {
        board[y][x] = null;
        for (const [sx, sy] of capturedStones) board[sy][sx] = opp;
        return false;
      }
      if (color === "black") capB += captured; else capW += captured;
      goHistory.push(key);
      if (SFX.enabled) SFX.click();
      return true;
    }
    function aiMove() {
      // v3.0-r15：只在轮到白时走。原来只判 over，玩家在 AI 思考的 400ms 里点“停一手”或重开，待执行的 AI 仍会在黑方回合落子
      if (over || turn !== "white") return;
      // 简单 AI：找有气的空点，优先靠近已有棋子
      const cands = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (board[y][x]) continue;
        let near = 0;
        for (const [nx, ny] of neighbors(x, y)) if (board[ny][nx]) near++;
        // 试下
        board[y][x] = "white";
        const opp = "black";
        let ok = true, cap = 0;
        for (const [nx, ny] of neighbors(x, y)) {
          if (board[ny][nx] === opp) {
            const g = group(nx, ny, opp);
            if (g.libs === 0) cap += g.stones.length;
          }
        }
        const self = group(x, y, "white");
        if (self.libs === 0 && cap === 0) ok = false;
        board[y][x] = null;
        if (ok) cands.push({ x, y, score: near * 2 + Math.random() });
      }
      if (!cands.length) { doPass(); return; }
      cands.sort((a, b) => b.score - a.score);
      const p = cands[0];
      play(p.x, p.y, "white");
      passes = 0; turn = "black";
      draw(); render();
    }
    function doPass() {
      passes++;
      if (SFX.enabled) SFX.click();
      if (passes >= 2) { finish(); return; }
      turn = turn === "black" ? "white" : "black";
      if (turn === "white") setTimeout(() => { if (!over) aiMove(); }, 400);
      render();
    }
    function finish() {
      over = true;
      // 中国规则数子：子（棋盘上活子）+ 空（围住的空）+ 贴目 3.75
      let b = 0, w = 3.75;
      const seen = new Set();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = board[y][x];
        if (v === "black") b++;
        else if (v === "white") w++;
        else if (!seen.has(x + "," + y)) {
          const stack = [[x, y]], cells = [];
          const borders = new Set();
          seen.add(x + "," + y);
          while (stack.length) {
            const [cx, cy] = stack.pop();
            cells.push([cx, cy]);
            for (const [nx, ny] of neighbors(cx, cy)) {
              const nv = board[ny][nx];
              if (nv === null) { const k = nx + "," + ny; if (!seen.has(k)) { seen.add(k); stack.push([nx, ny]); } }
              else borders.add(nv);
            }
          }
          if (borders.size === 1) { // 单色包围才是领地
            if (borders.has("black")) b += cells.length;
            else w += cells.length;
          }
        }
      }
      const msg = b > w ? "🎉 黑胜 " + b.toFixed(1) + " : " + w.toFixed(1) : "😅 白胜 " + w.toFixed(1) + " : " + b.toFixed(1);
      $("goScore").textContent = msg;
      if (SFX.enabled) { if (b > w) SFX.win(); else SFX.lose(); }
    }
    function onTap(x, y) {
      if (over || turn !== "black") return;
      SFX.unlock();
      if (play(x, y, "black")) {
        passes = 0; turn = "white";
        draw(); render();
        setTimeout(() => { if (!over) aiMove(); }, 400);
      }
    }
    function draw() {
      const cv = $("goCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#e8c98a"; ctx.fillRect(0, 0, W, W);
        ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 1;
        for (let i = 0; i < N; i++) {
          const p = CELL / 2 + i * CELL;
          ctx.beginPath(); ctx.moveTo(CELL / 2, p); ctx.lineTo(W - CELL / 2, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, CELL / 2); ctx.lineTo(p, W - CELL / 2); ctx.stroke();
        }
        // 星位
        for (const [sx, sy] of [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]]) {
          ctx.fillStyle = "#5a3a1a";
          ctx.beginPath(); ctx.arc(CELL / 2 + sx * CELL, CELL / 2 + sy * CELL, 3, 0, 7); ctx.fill();
        }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const s = board[y][x];
          if (!s) continue;
          const cx = CELL / 2 + x * CELL, cy = CELL / 2 + y * CELL;
          const g = ctx.createRadialGradient ? ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 13) : null;
          if (g && s === "black") { g.addColorStop(0, "#666"); g.addColorStop(1, "#111"); ctx.fillStyle = g; }
          else if (g) { g.addColorStop(0, "#fff"); g.addColorStop(1, "#ccc"); ctx.fillStyle = g; }
          else ctx.fillStyle = s === "black" ? "#111" : "#fff";
          ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7); ctx.fill();
          ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.stroke();
        }
      } catch (e) {}
    }
    function render() {
      if (!over) $("goScore").textContent = "轮到" + (turn === "black" ? "黑（你）" : "白（AI）") + " · 提子 黑" + capB + " 白" + capW;
    }
    const cv = $("goCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 320 };
      const x = Math.round((e.clientX - rect.left) * 9 / (rect.width || 320) - 0.5);
      const y = Math.round((e.clientY - rect.top) * 9 / (rect.height || 320) - 0.5);
      if (x >= 0 && x < N && y >= 0 && y < N) onTap(x, y);
    });
    // v3.0-r15：停一手只在轮到你（黑）时有效；AI 思考时点它直接忽略，不再吞掉这手
    $("goPassBtn").addEventListener("click", () => { if (!over && turn === "black") doPass(); });
    $("goResetBtn").addEventListener("click", reset);
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get go() { return { turn, over, capB, capW, board: board.flat().map((v) => (v === "black" ? 1 : v === "white" ? 2 : 0)) }; },
      goPlay(x, y, color) { return play(x, y, color || "black"); },
      goSet(cells, t) {
        board = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => { const v = cells[y * N + x]; return v === 1 ? "black" : v === 2 ? "white" : null; }));
        turn = t || "black"; over = false; passes = 0; capB = 0; capW = 0;
        goHistory = [goKey(board)];
        draw(); render();
      },
    }));
  };

  /* ---- 8. uno ---- */
  toyInitFns["uno"] = function () {
    const COLORS = ["red", "yellow", "green", "blue"];
    const CNAMES = { red: "红", yellow: "黄", green: "绿", blue: "蓝" };
    let deck = [], pHand = [], aiHand = [], top = null, turn = "p", over = false, drawCount = 0;
    let pile = [], pendingWild = null;
    // 摸牌：牌堆空了就重洗弃牌堆；都没了就给一张变色（保底不崩）
    function drawCard() {
      if (deck.length === 0 && pile.length > 0) deck = shuffle(pile.splice(0));
      return deck.pop() || { c: "wild", n: "wild" };
    }
    function recycleTop() {
      if (!top) return;
      if (top.n === "wild" || top.n === "+4") top.c = "wild"; // 变色牌恢复原样再进弃牌堆
      pile.push(top);
    }
    function buildDeck() {
      const d = [];
      for (const c of COLORS) {
        d.push({ c, n: "0" });
        for (let n = 1; n <= 9; n++) { d.push({ c, n: String(n) }); d.push({ c, n: String(n) }); }
        for (const s of ["+2", "skip", "rev"]) { d.push({ c, n: s }); d.push({ c, n: s }); }
      }
      for (let i = 0; i < 4; i++) { d.push({ c: "wild", n: "wild" }); d.push({ c: "wild", n: "+4" }); }
      return shuffle(d);
    }
    function reset() {
      deck = buildDeck(); pile = []; pendingWild = null;
      pHand = []; aiHand = [];
      for (let i = 0; i < 7; i++) { pHand.push(drawCard()); aiHand.push(drawCard()); }
      let guard = 0;
      do { top = drawCard(); guard++; } while (top.c === "wild" && guard < 50);
      turn = "p"; over = false; drawCount = 0;
      draw(); render("轮到你出牌");
    }
    function canPlay(card) {
      if (card.c === "wild") return true;
      return card.c === top.c || card.n === top.n;
    }
    function applyEffect(card, byAI, color) {
      if (card.n === "+2") {
        const t = byAI ? pHand : aiHand;
        t.push(drawCard()); t.push(drawCard());
        return true; // 跳过对方
      }
      if (card.n === "+4") {
        const t = byAI ? pHand : aiHand;
        for (let i = 0; i < 4; i++) t.push(drawCard());
        card.c = byAI ? pickAiColor() : (color || "red");
        return true;
      }
      if (card.c === "wild") { card.c = byAI ? pickAiColor() : (color || "red"); return false; }
      if (card.n === "skip" || card.n === "rev") return true;
      return false;
    }
    function pickAiColor() {
      const cnt = {};
      for (const c of aiHand) if (c.c !== "wild") cnt[c.c] = (cnt[c.c] || 0) + 1;
      let best = "red", bn = -1;
      for (const c of COLORS) if ((cnt[c] || 0) > bn) { bn = cnt[c] || 0; best = c; }
      return best;
    }
    function promptColor() {
      // 简化：选手牌最多的颜色
      const cnt = {};
      for (const c of pHand) if (c.c !== "wild") cnt[c.c] = (cnt[c.c] || 0) + 1;
      let best = "red", bn = -1;
      for (const c of COLORS) if ((cnt[c] || 0) > bn) { bn = cnt[c] || 0; best = c; }
      return best;
    }
    function pPlay(i, auto) {
      if (over || turn !== "p") return;
      SFX.unlock();
      const card = pHand[i];
      if (!card || !canPlay(card)) { render("这张不能出！颜色或数字要一样"); return; }
      if (card.c === "wild" && !auto) { pendingWild = { card, i }; showColorPicker(); return; }
      doPPlay(i, card, auto ? promptColor() : null);
    }
    function showColorPicker() {
      const t = $("unoTop");
      if (t) {
        t.innerHTML = "";
        const label = document.createElement("div");
        label.textContent = "变色牌！选一个颜色：";
        label.style.cssText = "text-align:center;color:#fff;margin-bottom:6px;font-size:14px;";
        t.appendChild(label);
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;gap:8px;justify-content:center;";
        const bgs = { red: "#e5484d", yellow: "#f5c542", green: "#4caf50", blue: "#4f7cff" };
        ["red", "yellow", "green", "blue"].forEach((c) => {
          const b = document.createElement("button");
          b.className = "btn small";
          b.textContent = CNAMES[c];
          try { b.style.cssText = "background:" + bgs[c] + ";color:#fff;min-width:60px;"; } catch (e) {}
          b.addEventListener("click", () => unoPickColor(c));
          wrap.appendChild(b);
        });
        t.appendChild(wrap);
      }
      render("打出变色牌，选颜色！");
    }
    function unoPickColor(c) {
      const pw = pendingWild; pendingWild = null;
      if (pw && !over && turn === "p") doPPlay(pw.i, pw.card, c);
    }
    function doPPlay(i, card, color) {
      pHand.splice(i, 1);
      recycleTop();
      top = card;
      if (SFX.enabled) SFX.pop(0.6);
      if (pHand.length === 0) { gameOver("p"); return; }
      const skip = applyEffect(card, false, color);
      draw(); render(skip ? "AI 被跳过，继续你出！" : "AI 出牌中…");
      if (!skip) { turn = "ai"; setTimeout(aiPlay, 700); }
      else draw();
    }
    function aiPlay() {
      if (over) return;
      // 策略：优先出普通牌，留 wild/+4 等关键时刻；对手剩牌少时优先出 +2/+4
      let idx = -1, bestScore = -1e9;
      for (let i = 0; i < aiHand.length; i++) {
        if (!canPlay(aiHand[i])) continue;
        const c = aiHand[i];
        let sc = Math.random() * 2;
        if (c.c !== "wild") sc += 10; // 先出普通牌
        if ((c.n === "+2" || c.n === "+4") && pHand.length <= 3) sc += 15; // 对手牌少时砸功能牌
        if (c.n === "skip" || c.n === "rev") sc += 5;
        if (aiHand.length <= 2 && c.c === "wild") sc += 20; // 只剩两张时用 wild 终结
        if (sc > bestScore) { bestScore = sc; idx = i; }
      }
      if (idx === -1) {
        aiHand.push(drawCard());
        idx = aiHand.findIndex(canPlay);
        if (idx === -1) { turn = "p"; draw(); render("AI 摸了牌没出，轮到你"); return; }
      }
      const card = aiHand.splice(idx, 1)[0];
      recycleTop();
      top = card;
      if (SFX.enabled) SFX.click();
      if (aiHand.length === 0) { gameOver("ai"); return; }
      if (aiHand.length === 1) render("⚠️ AI 只剩 1 张了！");
      const skip = applyEffect(card, true);
      draw();
      if (skip) { render("你被跳过了，AI 继续！"); setTimeout(aiPlay, 700); }
      else { turn = "p"; render("轮到你出牌"); }
    }
    function gameOver(winner) {
      over = true;
      if (SFX.enabled) { if (winner === "p") SFX.win(); else SFX.lose(); }
      draw(); render(winner === "p" ? "🎉 你赢了！" : "😅 AI 赢了");
    }
    function cardHTML(card, i, clickable) {
      const bg = card.c === "wild" ? "linear-gradient(135deg,#e5484d,#f5c542,#4caf50,#4f7cff)"
        : { red: "#e5484d", yellow: "#f5c542", green: "#4caf50", blue: "#4f7cff" }[card.c];
      const label = card.n === "wild" ? "变色" : card.n === "+4" ? "+4" : card.n === "+2" ? "+2" : card.n === "skip" ? "禁" : card.n === "rev" ? "反" : card.n;
      return '<div class="uno-card" data-i="' + i + '" style="background:' + bg + ';' + (clickable ? "cursor:pointer;" : "") + '">' + label + "</div>";
    }
    function draw() {
      const t = $("unoTop");
      if (t) {
        t.innerHTML = '<div class="uno-row"><span>顶牌：</span>' + cardHTML(top, -1, false) + '<span class="uno-count">AI ' + aiHand.length + " 张 · 牌堆 " + deck.length + " 张</span></div>";
      }
      const h = $("unoHand");
      if (h) {
        h.innerHTML = "";
        pHand.forEach((c, i) => {
          const el = document.createElement("div");
          const bg = c.c === "wild" ? "linear-gradient(135deg,#e5484d,#f5c542,#4caf50,#4f7cff)"
            : { red: "#e5484d", yellow: "#f5c542", green: "#4caf50", blue: "#4f7cff" }[c.c];
          const label = c.n === "wild" ? "变色" : c.n === "+4" ? "+4" : c.n === "+2" ? "+2" : c.n === "skip" ? "禁" : c.n === "rev" ? "反" : c.n;
          el.className = "uno-card";
          el.textContent = label;
          try {
            el.style.cssText = "background:" + bg + ";width:44px;height:64px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:16px;" + (turn === "p" && !over ? "cursor:pointer;" : "opacity:0.7;");
          } catch (e) {}
          if (turn === "p" && !over) el.addEventListener("click", () => pPlay(i));
          h.appendChild(el);
        });
      }
    }
    function render(m) { $("unoMsg").textContent = m + "（你 " + pHand.length + " 张）"; }
    $("unoDrawBtn").addEventListener("click", () => {
      if (over || turn !== "p") return;
      SFX.unlock();
      pendingWild = null;
      pHand.push(drawCard());
      if (SFX.enabled) SFX.click();
      draw(); render("摸了牌，轮到 AI");
      turn = "ai"; setTimeout(aiPlay, 700);
    });
    $("unoResetBtn").addEventListener("click", reset);
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get uno() { return { p: pHand.length, ai: aiHand.length, turn, over, top: top.n }; },
      unoPlay(i) { pPlay(i, true); },
      unoPickColor(c) { unoPickColor(c); },
      unoHand() { return pHand.map((c) => c.c + ":" + c.n); },
      unoPending() { return !!pendingWild; },
    }));
  };

  /* ---- 9. mahjong 简化麻将 ---- */
  toyInitFns["mahjong"] = function () {
    // 筒=0-8, 条=9-17, 万=18-26
    const SUITS = ["筒", "条", "万"];
    let wall = [], hand = [], over = false, msg = "";
    function tileName(t) { return SUITS[Math.floor(t / 9)] + ((t % 9) + 1); }
    function reset() {
      wall = [];
      for (let t = 0; t < 27; t++) for (let k = 0; k < 4; k++) wall.push(t);
      shuffle(wall);
      hand = [];
      for (let i = 0; i < 13; i++) hand.push(wall.pop());
      sortHand();
      over = false;
      // 开局摸一张
      hand.push(wall.pop()); sortHand();
      msg = checkWin() ? "🎉 天胡！" : "轮到你打牌（点一张打出）";
      if (checkWin()) { over = true; if (SFX.enabled) SFX.win(); }
      draw(); render();
    }
    function sortHand() { hand.sort((a, b) => a - b); }
    function checkWin() {
      // 4 副 + 1 对
      const c = {};
      for (const t of hand) c[t] = (c[t] || 0) + 1;
      for (let pair = 0; pair < 27; pair++) {
        if ((c[pair] || 0) < 2) continue;
        const rc = Object.assign({}, c);
        rc[pair] -= 2;
        if (canMeld(rc)) return true;
      }
      return false;
    }
    function canMeld(c) {
      for (let t = 0; t < 27; t++) {
        while ((c[t] || 0) > 0) {
          // 刻子
          if (c[t] >= 3) { c[t] -= 3; continue; }
          // 顺子
          const s = t % 9;
          if (s <= 6 && (c[t + 1] || 0) > 0 && (c[t + 2] || 0) > 0) { c[t]--; c[t + 1]--; c[t + 2]--; continue; }
          return false;
        }
      }
      return true;
    }
    function discard(i) {
      if (over) return;
      SFX.unlock();
      hand.splice(i, 1);
      if (SFX.enabled) SFX.click();
      // AI 回合：简化，AI 直接摸打
      if (wall.length === 0) { over = true; msg = "😅 牌墙空了，流局"; draw(); render(); return; }
      // 玩家摸牌
      hand.push(wall.pop()); sortHand();
      if (checkWin()) {
        over = true; msg = "🎉 胡了！" + hand.map(tileName).join(" ");
        if (SFX.enabled) SFX.win();
      } else {
        msg = "轮到你打牌（剩 " + wall.length + " 张）";
      }
      draw(); render();
    }
    function draw() {
      const h = $("mjHand");
      if (!h) return;
      h.innerHTML = "";
      h.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:340px;margin:0 auto;";
      hand.forEach((t, i) => {
        const d = document.createElement("div");
        d.textContent = tileName(t);
        d.style.cssText = "width:38px;height:52px;background:#fff;border:1px solid #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;cursor:pointer;" + (over ? "" : "");
        if (!over) d.addEventListener("click", () => discard(i));
        h.appendChild(d);
      });
    }
    function render() { $("mjMsg").textContent = msg; }
    $("mjResetBtn").addEventListener("click", reset);
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get mahjong() { return { count: hand.length, over, win: checkWin() }; },
      mahjongDiscard(i) { discard(i); },
    }));
  };

  /* ---- 10. poker 德州扑克 ---- */
  toyInitFns["poker"] = function () {
    const SUITS = ["♠", "♥", "♦", "♣"];
    const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    let deck = [], pHole = [], aHole = [], comm = [], pChips = 100, aChips = 100, pot = 0, over = false, stage = 0;
    function newDeck() {
      const d = [];
      for (const s of SUITS) for (let r = 0; r < 13; r++) d.push({ s, r });
      return shuffle(d);
    }
    function reset() {
      if (pChips <= 0) pChips = 100;
      if (aChips <= 0) aChips = 100;
      deck = newDeck();
      pHole = [deck.pop(), deck.pop()];
      aHole = [deck.pop(), deck.pop()];
      comm = []; pot = 0; over = false; stage = 0;
      // 盲注（筹码不足时按小的收，不透支）
      const bb = Math.min(5, pChips, aChips);
      pChips -= bb; aChips -= bb; pot = bb * 2;
      draw(); render("你的回合：跟注 " + bb + " 或弃牌");
    }
    // 牌型评估：返回 [rank, tiebreak...]
    function eval7(cards) {
      // 简化：7 选 5 最优
      let best = null;
      const combos = [];
      const idx = [0, 1, 2, 3, 4, 5, 6];
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++) for (let e = d + 1; e < 7; e++)
          combos.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      for (const h of combos) {
        const v = eval5(h);
        if (!best || cmpHands(v, best) > 0) best = v;
      }
      return best;
    }
    function eval5(h) {
      const rs = h.map((c) => c.r).sort((a, b) => b - a);
      const flush = h.every((c) => c.s === h[0].s);
      let straight = true;
      for (let i = 1; i < 5; i++) if (rs[i] !== rs[0] - i) straight = false;
      // A-5 顺子
      if (!straight && rs.join() === "12,3,2,1,0") { straight = true; rs.push(rs.shift()); }
      const cnt = {};
      for (const r of rs) cnt[r] = (cnt[r] || 0) + 1;
      const groups = Object.entries(cnt).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
      if (flush && straight) return [8, rs[0]];
      if (groups[0][1] === 4) return [7, +groups[0][0], +groups[1][0]];
      if (groups[0][1] === 3 && groups[1][1] === 2) return [6, +groups[0][0], +groups[1][0]];
      if (flush) return [5, ...rs];
      if (straight) return [4, rs[0]];
      if (groups[0][1] === 3) return [3, +groups[0][0], ...groups.slice(1).map((g) => +g[0])];
      if (groups[0][1] === 2 && groups[1][1] === 2) return [2, +groups[0][0], +groups[1][0], +groups[2][0]];
      if (groups[0][1] === 2) return [1, +groups[0][0], ...groups.slice(1).map((g) => +g[0])];
      return [0, ...rs];
    }
    function cmpHands(a, b) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x !== y) return x - y;
      }
      return 0;
    }
    const HNAMES = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"];
    // AI 手牌强度 0..1（用于弃牌决策）
    function bestOf(cards) {
      let best = null;
      const n = cards.length, idx = [];
      (function rec(start, depth) {
        if (depth === 5) {
          const v = eval5(idx.map((i) => cards[i]));
          if (!best || cmpHands(v, best) > 0) best = v;
          return;
        }
        for (let i = start; i < n; i++) { idx.push(i); rec(i + 1, depth + 1); idx.pop(); }
      })(0, 0);
      return best;
    }
    function aiStrength() {
      if (comm.length === 0) {
        const r0 = aHole[0].r, r1 = aHole[1].r;
        if (r0 === r1) return 0.55 + r0 / 30;
        const hi = Math.max(r0, r1) / 12;
        const suited = aHole[0].s === aHole[1].s ? 0.06 : 0;
        const conn = Math.abs(r0 - r1) <= 2 ? 0.05 : 0;
        return Math.min(0.95, hi * 0.55 + suited + conn);
      }
      const v = bestOf(aHole.concat(comm));
      return Math.min(0.98, 0.12 + v[0] * 0.11);
    }
    function showdown() {
      over = true;
      while (comm.length < 5) comm.push(deck.pop());
      const pv = eval7(pHole.concat(comm));
      const av = eval7(aHole.concat(comm));
      const cmp = cmpHands(pv, av);
      let m;
      if (cmp > 0) { pChips += pot; m = "🎉 你赢！" + HNAMES[pv[0]] + " 大过 " + HNAMES[av[0]] + "，+" + pot; if (SFX.enabled) SFX.win(); }
      else if (cmp < 0) { aChips += pot; m = "😅 AI 赢，" + HNAMES[av[0]] + " 大过 " + HNAMES[pv[0]]; if (SFX.enabled) SFX.lose(); }
      else { pChips += pot / 2; aChips += pot / 2; m = "🤝 平局，" + HNAMES[pv[0]]; }
      pot = 0;
      draw(); render(m + "（AI 底牌 " + aHole.map(cardStr).join(" ") + "）");
    }
    function cardStr(c) { return c.s + RANKS[c.r]; }
    function pCall() {
      if (over) return;
      SFX.unlock();
      const bet = Math.min(5, pChips, aChips);
      if (bet <= 0) { showdown(); return; }
      pChips -= bet; aChips -= bet; pot += bet * 2;
      if (SFX.enabled) SFX.coin();
      stage++;
      if (stage === 1) { comm.push(deck.pop(), deck.pop(), deck.pop()); }
      else if (stage <= 3) { comm.push(deck.pop()); }
      if (stage >= 4 || aChips <= 0 || pChips <= 0) { showdown(); return; }
      // AI 策略：按手牌强度决定弃牌（强牌几乎不弃，弱牌常弃）
      const foldP = Math.max(0.02, 0.30 - aiStrength() * 0.5);
      if (Math.random() < foldP) {
        over = true;
        const won = pot;
        pChips += pot; pot = 0;
        if (SFX.enabled) SFX.win();
        draw(); render("🎉 AI 弃牌，你赢 +" + won);
        return;
      }
      draw(); render("第 " + (stage + 1) + " 轮：跟注或弃牌（底池 " + pot + "）");
    }
    function pFold() {
      if (over) return;
      over = true;
      aChips += pot; pot = 0;
      if (SFX.enabled) SFX.lose();
      draw(); render("你弃牌了，AI 赢走底池");
    }
    function draw() {
      const t = $("pokerTable");
      if (!t) return;
      t.innerHTML = "";
      t.style.cssText = "background:#0d5c2e;border-radius:12px;padding:12px;max-width:340px;margin:0 auto;text-align:center;";
      const mk = (cards, label) => {
        const d = document.createElement("div");
        d.style.cssText = "margin:6px 0;color:#fff;font-size:14px;";
        d.innerHTML = label + " " + cards.map((c) =>
          '<span style="display:inline-block;background:#fff;color:' + (c.s === "♥" || c.s === "♦" ? "#c0392b" : "#222") +
          ';border-radius:4px;padding:2px 6px;margin:0 2px;font-weight:bold;">' + cardStr(c) + "</span>").join("");
        return d;
      };
      t.appendChild(mk([], "AI（" + aChips + "):"));
      // AI 显示背面
      t.children[0].innerHTML = "AI（" + aChips + '): <span style="display:inline-block;background:#1a1e2e;color:#888;border-radius:4px;padding:2px 6px;margin:0 2px;">??</span> <span style="display:inline-block;background:#1a1e2e;color:#888;border-radius:4px;padding:2px 6px;margin:0 2px;">??</span>';
      t.appendChild(mk(comm, "公共牌："));
      t.appendChild(mk(pHole, "你（" + pChips + "):"));
      const potD = document.createElement("div");
      potD.style.cssText = "color:#f5c542;font-weight:bold;margin-top:6px;";
      potD.textContent = "底池 " + pot;
      t.appendChild(potD);
    }
    function render(m) { $("pokerMsg").textContent = m; }
    $("pokerCallBtn").addEventListener("click", pCall);
    $("pokerFoldBtn").addEventListener("click", pFold);
    $("pokerResetBtn").addEventListener("click", reset);
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get poker() { return { pChips, aChips, pot, over, stage, comm: comm.length }; },
      pokerCall() { pCall(); },
      pokerEval(cards) { return eval5(cards); },
    }));
  };
  /* ---- 11. rhythm 音游 ---- */
  toyInitFns["rhythm"] = function () {
    const KEY = "dorm-toybox-rhythm-best-v1";
    const W = 320, H = 420, LANES = 4, LW = W / LANES;
    const JUDGE_Y = H - 80, SPEED = 3.2;
    let best = loadBest(KEY);
    let notes = [], score = 0, combo = 0, maxCombo = 0, running = false, raf = null, frame = 0, counts = { p: 0, g: 0, m: 0 };
    let startT = 0, lastT = 0, nextSpawn = 0, nextChord = 0, rank = "", isNewBest = false;
    const KEYS = ["d", "f", "j", "k"];
    const NOTE_TRAVEL_MS = 1875; // 音符从顶部到判定线的时长（ms），与帧率无关
    const SONG_LEN_MS = 60000;
    function reset() {
      notes = []; score = 0; combo = 0; maxCombo = 0; counts = { p: 0, g: 0, m: 0 };
      running = true; frame = 0; startT = 0; lastT = 0; nextSpawn = 0; nextChord = 0; rank = ""; isNewBest = false;
      render();
    }
    function spawn(now) {
      // 谱面：按真实时间生成，不随帧率变化
      if (now >= nextSpawn && Math.random() < 0.75) {
        notes.push({ lane: Math.floor(Math.random() * LANES), y: -20, hit: false });
        nextSpawn = now + 467; // 约 28 帧 @60fps
      } else if (now >= nextSpawn) {
        nextSpawn = now + 467;
      }
      if (now >= nextChord) { // 和弦
        const l = Math.floor(Math.random() * LANES);
        notes.push({ lane: (l + 2) % LANES, y: -20, hit: false });
        nextChord = now + 1867; // 约 112 帧 @60fps
      }
    }
    function hit(lane) {
      if (!running) return;
      SFX.unlock();
      // 找最近的未击中音符
      let bestN = null, bestD = 1e9;
      for (const n of notes) {
        if (n.lane !== lane || n.hit) continue;
        const d = Math.abs(n.y - JUDGE_Y);
        if (d < bestD) { bestD = d; bestN = n; }
      }
      if (!bestN || bestD > 70) { combo = 0; counts.m++; if (SFX.enabled) SFX.lose(); render(); return; }
      bestN.hit = true;
      combo++; maxCombo = Math.max(maxCombo, combo);
      if (bestD < 22) { score += 300; counts.p++; if (SFX.enabled) SFX.pop(0.9); }
      else if (bestD < 48) { score += 100; counts.g++; if (SFX.enabled) SFX.pop(0.5); }
      else { combo = 0; counts.m++; if (SFX.enabled) SFX.lose(); }
      render();
    }
    function step(now) {
      if (!running) return;
      if (!startT) { startT = now; lastT = now; nextSpawn = now; nextChord = now; }
      const dt = Math.min(100, now - lastT); // ms，防切后台跳变
      lastT = now;
      const elapsed = now - startT;
      spawn(now);
      const pxPerMs = (JUDGE_Y + 20) / NOTE_TRAVEL_MS; // 与帧率无关的下落速度
      for (const n of notes) n.y += pxPerMs * dt;
      // miss
      for (const n of notes) {
        if (!n.hit && n.y > JUDGE_Y + 70) { n.hit = true; n.missed = true; combo = 0; counts.m++; }
      }
      notes = notes.filter((n) => n.y < H + 20 && !(n.hit && n.y > JUDGE_Y + 40));
      if (elapsed > SONG_LEN_MS) { // 60 秒结束（真实时间）
        running = false;
        const total = counts.p + counts.g + counts.m;
        const acc = total ? (counts.p + counts.g * 0.5) / total : 0;
        // 评级：SSS≥95% / S≥90% / A≥80% / B≥65% / C<65%
        rank = acc >= 0.95 ? "SSS" : acc >= 0.9 ? "S" : acc >= 0.8 ? "A" : acc >= 0.65 ? "B" : "C";
        isNewBest = score > best && score > 0;
        if (isNewBest) { best = score; saveBest(KEY, best); }
        if (SFX.enabled) { if (rank === "SSS" || rank === "S" || isNewBest) SFX.win(); else if (rank === "C") SFX.lose(); else SFX.pop(0.6); }
      }
      draw(); render();
      if (running) raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("rhythmCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#12141c"; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < LANES; i++) {
          ctx.fillStyle = i % 2 ? "#1a1e2e" : "#161a28";
          ctx.fillRect(i * LW, 0, LW, H);
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.beginPath(); ctx.moveTo(i * LW, 0); ctx.lineTo(i * LW, H); ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.font = "12px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(KEYS[i].toUpperCase(), i * LW + LW / 2, H - 12);
        }
        // 判定线
        ctx.fillStyle = "#4f7cff"; ctx.fillRect(0, JUDGE_Y - 2, W, 4);
        for (const n of notes) {
          if (n.hit && !n.missed) continue;
          const x = n.lane * LW + LW / 2;
          ctx.fillStyle = n.missed ? "#555" : "#f5c542";
          ctx.beginPath(); ctx.arc(x, n.y, 14, 0, 7); ctx.fill();
          ctx.fillStyle = "#12141c";
          ctx.beginPath(); ctx.arc(x, n.y, 8, 0, 7); ctx.fill();
        }
        // 连击
        if (combo > 1) {
          ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(combo + " 连击", W / 2, 60);
        }
      } catch (e) {}
    }
    function render() {
      $("rhythmScore").textContent = running
        ? "分 " + score + " · 连击 " + combo + " · P" + counts.p + "/G" + counts.g + "/M" + counts.m + " · 最好 " + best
        : "评级 " + rank + (isNewBest ? " 🎉新纪录！" : "") + " · 分 " + score + " · 最大连击 " + maxCombo + " · P" + counts.p + "/G" + counts.g + "/M" + counts.m + " · 最好 " + best;
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function rhythmKeys(e) {
      if ($("toy-rhythm") && $("toy-rhythm").classList.contains("hidden")) return;
      const k = e.key.toLowerCase();
      const i = KEYS.indexOf(k);
      if (i >= 0) { hit(i); e.preventDefault(); }
    });
    const cv = $("rhythmCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, width: 320 };
      const x = (e.clientX - rect.left) * 320 / (rect.width || 320);
      hit(Math.floor(x / LW));
    });
    $("rhythmResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); });
    toyLeaveCleanup.rhythm = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); running = false; draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get rhythm() { return { score, combo, best, running, counts }; },
      rhythmHit(lane) { hit(lane); },
      rhythmStart() { if (!running) { reset(); raf = requestAnimationFrame(step); } },
      rhythmNotes() { const n = notes.find((x) => !x.hit); return n ? { y: Math.round(n.y * 10) / 10, count: notes.length } : { y: -999, count: notes.length }; },
    }));
  };

  /* ---- 12. tower 叠塔 ---- */
  toyInitFns["tower"] = function () {
    const KEY = "dorm-toybox-tower-best-v1";
    const W = 320, H = 420, BH = 22;
    let best = loadBest(KEY);
    let blocks = [], cur = null, dir = 1, height = 0, running = false, raf = null, over = false;
    let lastT = 0;
    function reset() {
      blocks = [{ x: 60, w: 200, y: H - BH }];
      cur = { x: 0, w: 200, y: H - BH * 2, vx: 2.4 };
      dir = 1; height = 0; over = false; running = true; lastT = 0;
      render();
    }
    function drop() {
      if (!running || over) return;
      SFX.unlock();
      const prev = blocks[blocks.length - 1];
      const left = Math.max(cur.x, prev.x);
      const right = Math.min(cur.x + cur.w, prev.x + prev.w);
      const overlap = right - left;
      if (overlap <= 8) {
        over = true; running = false;
        if (SFX.enabled) SFX.lose();
        draw(); render(); return;
      }
      // 切掉悬空部分
      blocks.push({ x: left, w: overlap, y: cur.y });
      height++;
      if (SFX.enabled) SFX.pop(0.4 + Math.min(0.5, height * 0.03));
      if (height > best) { best = height; saveBest(KEY, best); }
      // 下一块：宽度继承，速度加快
      const nw = overlap;
      cur = { x: Math.random() < 0.5 ? 0 : W - nw, w: nw, y: cur.y - BH, vx: (2.4 + height * 0.08) * (Math.random() < 0.5 ? 1 : -1) };
      // 视角跟随
      if (blocks.length * BH > H - 100) {
        const dy = BH;
        blocks.forEach((b) => b.y += dy);
        cur.y += dy;
      }
      draw(); render();
    }
    function step(now) {
      if (!running || over) return;
      if (!lastT) lastT = now;
      const dt = Math.min(50, now - lastT);
      lastT = now;
      const k = dt / 16.7;
      cur.x += cur.vx * k;
      if (cur.x <= 0) { cur.x = 0; cur.vx *= -1; }
      if (cur.x + cur.w >= W) { cur.x = W - cur.w; cur.vx *= -1; }
      draw();
      raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("towerCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        const g = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, 0, H) : null;
        if (g) { g.addColorStop(0, "#1a1e3a"); g.addColorStop(1, "#12141c"); ctx.fillStyle = g; }
        else ctx.fillStyle = "#12141c";
        ctx.fillRect(0, 0, W, H);
        blocks.forEach((b, i) => {
          const hue = 210 - Math.min(60, i * 3);
          ctx.fillStyle = "hsl(" + hue + ",60%," + (45 + (i % 3) * 5) + "%)";
          ctx.fillRect(b.x, b.y, b.w, BH - 2);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(b.x, b.y, b.w, 4);
        });
        if (!over && cur) {
          ctx.fillStyle = "hsl(210,70%,55%)";
          ctx.fillRect(cur.x, cur.y, cur.w, BH - 2);
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.fillRect(cur.x, cur.y, cur.w, 4);
        }
        if (over) {
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("🏗️ 塔倒了！", W / 2, H / 2 - 10);
          ctx.font = "18px sans-serif";
          ctx.fillText("高度 " + height + " · 最好 " + best, W / 2, H / 2 + 24);
        }
      } catch (e) {}
    }
    function render() {
      $("towerScore").textContent = "高度 " + height + " · 最好 " + best + (over ? " · 结束" : "");
    }
    const cv = $("towerCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => { e.preventDefault(); drop(); });
    $("towerResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); });
    toyLeaveCleanup.tower = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); running = false; draw(); render();
    // 自动开始移动（展示用）
    raf = requestAnimationFrame(step); running = true;
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get tower() { return { height, best, over }; },
      towerDrop() { drop(); },
    }));
  };

  /* ---- 13. dodge 弹幕躲避 ---- */
  toyInitFns["dodge"] = function () {
    const KEY = "dorm-toybox-dodge-best-v1";
    const W = 320, H = 420;
    let best = loadBest(KEY);
    let px = W / 2, py = H - 60, bullets = [], score = 0, lives = 3, running = false, raf = null, frame = 0, grazed = new Set(), invuln = 0, started = false;
    let lastT = 0, spawnAcc = 0, fanAcc = 0;
    function reset() {
      px = W / 2; py = H - 60; bullets = []; score = 0; lives = 3; running = true; frame = 0; invuln = 0; grazed = new Set(); lastT = 0; spawnAcc = 0; fanAcc = 0; elapsedMs = 0;
      render();
    }
    let elapsedMs = 0;
    function spawn(dt) {
      // 弹幕模式：随机 + 扇形（按真实时间，与刷新率无关）
      elapsedMs += dt;
      spawnAcc += dt;
      fanAcc += dt;
      if (spawnAcc >= 24 * 16.7) {
        spawnAcc = 0;
        const n = 3 + Math.floor(elapsedMs / (600 * 16.7));
        for (let i = 0; i < Math.min(n, 8); i++) {
          bullets.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 1.2, vy: 2 + Math.random() * 1.5 + elapsedMs / (3000 * 16.7), r: 5, id: Math.floor(elapsedMs) * 100 + i });
        }
      }
      if (fanAcc >= 180 * 16.7) {
        fanAcc = 0;
        // 扇形弹
        const cx = W / 2;
        for (let i = -3; i <= 3; i++) {
          bullets.push({ x: cx, y: -10, vx: i * 0.7, vy: 2.5, r: 5, id: Math.floor(elapsedMs) * 100 + 50 + i });
        }
      }
    }
    function step(now) {
      if (!running) return;
      if (!lastT) lastT = now;
      const dt = Math.min(50, now - lastT);
      lastT = now;
      const k = dt / 16.7;
      frame++;
      spawn(dt);
      score += k;
      if (invuln > 0) invuln -= k;
      for (const b of bullets) { b.x += b.vx * k; b.y += b.vy * k; }
      bullets = bullets.filter((b) => b.y < H + 20 && b.x > -20 && b.x < W + 20);
      // 碰撞 + 擦弹
      for (const b of bullets) {
        const d = Math.hypot(b.x - px, b.y - py);
        if (d < b.r + 8) {
          if (invuln <= 0) {
            lives--;
            invuln = 1500;
            if (SFX.enabled) SFX.hit();
            if (lives <= 0) {
              running = false;
              if (score > best) { best = score; saveBest(KEY, best); }
              if (SFX.enabled) SFX.lose();
              draw(); render(); return;
            }
          }
        } else if (d < b.r + 22 && !grazed.has(b.id)) {
          grazed.add(b.id);
          score += 10;
          if (SFX.enabled) SFX.pop(0.8);
        }
      }
      draw(); render();
      raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("dodgeCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        ctx.fillStyle = "#0a0c14"; ctx.fillRect(0, 0, W, H);
        // 星空
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let i = 0; i < 30; i++) {
          const sx = (i * 97) % W, sy = (i * 61 + frame * 2) % H;
          ctx.fillRect(sx, sy, 2, 2);
        }
        for (const b of bullets) {
          ctx.fillStyle = "#ff5252";
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
          ctx.fillStyle = "#ffb3b3";
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r / 2, 0, 7); ctx.fill();
        }
        // 飞机
        if (invuln <= 0 || Math.floor(frame / 6) % 2 === 0) {
          ctx.fillStyle = "#4f7cff";
          ctx.beginPath();
          ctx.moveTo(px, py - 12); ctx.lineTo(px - 9, py + 8); ctx.lineTo(px, py + 4); ctx.lineTo(px + 9, py + 8);
          ctx.closePath(); ctx.fill();
          // 判定点
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
        }
        if (!running && started) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("💥 坠毁！", W / 2, H / 2 - 10);
          ctx.font = "18px sans-serif";
          ctx.fillText("得分 " + score + " · 最好 " + best, W / 2, H / 2 + 24);
        } else if (!running && !started) {
          ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("👆 拖动开始躲", W / 2, H / 2);
        }
      } catch (e) {}
    }
    function render() {
      $("dodgeScore").textContent = "分 " + Math.floor(score) + " · 命 " + "❤️".repeat(Math.max(0, lives)) + " · 最好 " + best + (running ? "" : " · 结束");
    }
    const cv = $("dodgeCanvas");
    if (cv) {
      const move = (e) => {
        const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 420 };
        px = (e.clientX - rect.left) * 320 / (rect.width || 320);
        py = (e.clientY - rect.top) * 420 / (rect.height || 420);
        px = Math.max(12, Math.min(W - 12, px));
        py = Math.max(12, Math.min(H - 12, py));
      };
      cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerdown", (e) => { SFX.unlock(); move(e); });
      // iOS 双保险
      cv.addEventListener("touchstart", (e) => { e.preventDefault(); SFX.unlock(); const t = e.touches[0]; move({ clientX: t.clientX, clientY: t.clientY }); }, { passive: false });
      cv.addEventListener("touchmove", (e) => { e.preventDefault(); const t = e.touches[0]; move({ clientX: t.clientX, clientY: t.clientY }); }, { passive: false });
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function dodgeKeys(e) {
      if ($("toy-dodge") && $("toy-dodge").classList.contains("hidden")) return;
      const sp = 10;
      if (e.key === "ArrowLeft") px = Math.max(12, px - sp);
      if (e.key === "ArrowRight") px = Math.min(W - 12, px + sp);
      if (e.key === "ArrowUp") py = Math.max(12, py - sp);
      if (e.key === "ArrowDown") py = Math.min(H - 12, py + sp);
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
    });
    $("dodgeResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); started = true; raf = requestAnimationFrame(step); });
    toyLeaveCleanup.dodge = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    reset(); running = false; draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get dodge() { return { score, lives, best, running }; },
      dodgeStart() { if (!running && lives > 0) { running = true; started = true; raf = requestAnimationFrame(step); } },
      dodgeMove(x, y) { px = x; py = y; },
    }));
  };

  /* ---- 14. maze3d 伪3D迷宫 ---- */
  toyInitFns["maze3d"] = function () {
    const W = 320, H = 240, FOV = Math.PI / 3;
    const MKEY = "dorm-toybox-maze3d-best-v1";
    let mBest = loadBest(MKEY);
    // 15x15 迷宫，1=墙 0=路
    let maze = [], px = 1.5, py = 1.5, pa = 0, over = false, steps = 0;
    function genMaze() {
      const N = 15;
      maze = Array.from({ length: N }, () => Array(N).fill(1));
      const stack = [[1, 1]];
      maze[1][1] = 0;
      while (stack.length) {
        const [cx, cy] = stack[stack.length - 1];
        const dirs = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]);
        let moved = false;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx > 0 && nx < N - 1 && ny > 0 && ny < N - 1 && maze[ny][nx] === 1) {
            maze[ny][nx] = 0;
            maze[cy + dy / 2][cx + dx / 2] = 0;
            stack.push([nx, ny]);
            moved = true;
            break;
          }
        }
        if (!moved) stack.pop();
      }
      maze[N - 2][N - 2] = 2; // 出口
    }
    function reset() {
      genMaze();
      px = 1.5; py = 1.5; over = false; steps = 0;
      // 出生朝向：选四个方向里视野最开阔的，避免开局糊墙
      pa = 0; let bestD = -1;
      for (let d = 0; d < 4; d++) {
        const a = d * Math.PI / 2;
        let dist = 0;
        const dx = Math.cos(a), dy = Math.sin(a);
        for (let t = 0.1; t < 10; t += 0.1) {
          const cx = Math.floor(px + dx * t), cy = Math.floor(py + dy * t);
          if (!maze[cy] || maze[cy][cx] === undefined || maze[cy][cx] === 1) break;
          dist = t;
        }
        if (dist > bestD) { bestD = dist; pa = a; }
      }
      draw(); render("找绿色出口！");
    }
    function castRay(angle) {
      // DDA
      const dx = Math.cos(angle), dy = Math.sin(angle);
      let mx = Math.floor(px), my = Math.floor(py);
      const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
      let sx, sy, sdx, sdy;
      if (dx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
      if (dy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
      let dist = 0, hit = 0, side = 0;
      for (let i = 0; i < 64; i++) {
        if (sdx < sdy) { dist = sdx; sdx += ddx; mx += sx; side = 0; }
        else { dist = sdy; sdy += ddy; my += sy; side = 1; }
        if (mx < 0 || mx >= 15 || my < 0 || my >= 15) break;
        if (maze[my][mx] > 0) { hit = maze[my][mx]; break; }
      }
      // 鱼眼校正
      dist *= Math.cos(angle - pa);
      return { dist: Math.max(0.05, dist), hit, side };
    }
    function move(fwd, strafe) {
      if (over) return;
      const sp = 0.12;
      let moved = false; // r18：撞墙不移动时不响脚步声
      const nx = px + Math.cos(pa) * fwd * sp + Math.cos(pa + Math.PI / 2) * strafe * sp;
      const ny = py + Math.sin(pa) * fwd * sp + Math.sin(pa + Math.PI / 2) * strafe * sp;
      if (maze[Math.floor(ny)] && maze[Math.floor(ny)][Math.floor(nx)] !== 1) { px = nx; py = ny; steps++; moved = true; } // r18：撞墙不算走，moved 供脚步声判断
      // 到出口？
      if (maze[Math.floor(py)][Math.floor(px)] === 2) {
        over = true;
        if (SFX.enabled) SFX.win();
        let nb = "";
        if (!mBest || steps < mBest) { mBest = steps; saveBest(MKEY, mBest); nb = " 🎉新纪录！"; }
        render("🎉 走出来了！用了 " + steps + " 步" + nb + " · 最好 " + mBest + " 步");
      } else {
        render("找绿色出口！已走 " + steps + " 步");
      }
      draw();
      if (moved && SFX.enabled && steps % 4 === 0) SFX.click(); // r18：只在真走动时响，撞墙（steps 不变）不再每按一次响一次
    }
    function turn(d) { pa += d; draw(); }
    function draw() {
      const cv = $("maze3dCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        // 天空/地面
        ctx.fillStyle = "#1a2340"; ctx.fillRect(0, 0, W, H / 2);
        ctx.fillStyle = "#2a2418"; ctx.fillRect(0, H / 2, W, H / 2);
        const rays = 80;
        for (let i = 0; i < rays; i++) {
          const a = pa - FOV / 2 + (i / rays) * FOV;
          const { dist, hit, side } = castRay(a);
          const wh = Math.min(H, (H / dist) * 0.9);
          const x = (i / rays) * W;
          let color;
          if (hit === 2) color = "#4caf50"; // 出口绿
          else {
            const shade = Math.max(30, 200 - dist * 45) | 0;
            color = side ? "rgb(" + shade + "," + (shade - 20) + "," + (shade - 60) + ")" : "rgb(" + (shade - 20) + "," + (shade - 40) + "," + (shade - 80) + ")";
          }
          ctx.fillStyle = color;
          ctx.fillRect(x, (H - wh) / 2, W / rays + 1, wh);
        }
        // 准星
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(W / 2 - 1, H / 2 - 6, 2, 12);
        // 小地图
        const ms = 4;
        for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
          if (maze[y][x] === 1) { ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(W - 15 * ms - 6 + x * ms, 6 + y * ms, ms, ms); }
          else if (maze[y][x] === 2) { ctx.fillStyle = "#4caf50"; ctx.fillRect(W - 15 * ms - 6 + x * ms, 6 + y * ms, ms, ms); }
        }
        ctx.fillStyle = "#ff5252";
        ctx.beginPath(); ctx.arc(W - 15 * ms - 6 + px * ms, 6 + py * ms, 3, 0, 7); ctx.fill();
      } catch (e) {}
    }
    function render(m) { $("maze3dMsg").textContent = m; }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function maze3dKeys(e) {
      if ($("toy-maze3d") && $("toy-maze3d").classList.contains("hidden")) return;
      const k = e.key.toLowerCase();
      if (k === "w" || e.key === "ArrowUp") { move(1, 0); e.preventDefault(); }
      else if (k === "s" || e.key === "ArrowDown") { move(-1, 0); e.preventDefault(); }
      else if (k === "a" || e.key === "ArrowLeft") { turn(-0.12); e.preventDefault(); }
      else if (k === "d" || e.key === "ArrowRight") { turn(0.12); e.preventDefault(); }
    });
    const cv = $("maze3dCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      SFX.unlock();
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 240 };
      const x = (e.clientX - rect.left) / (rect.width || 320);
      const y = (e.clientY - rect.top) / (rect.height || 240);
      if (y < 0.4) move(1, 0);
      else if (y > 0.6) move(-1, 0);
      else if (x < 0.5) turn(-0.15);
      else turn(0.15);
    });
    $("maze3dResetBtn").addEventListener("click", reset);
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get maze3d() { return { over, steps, px: Math.round(px * 10) / 10, py: Math.round(py * 10) / 10 }; },
      maze3dMove(f, s) { move(f, s); },
      maze3dTurn(d) { turn(d); },
    }));
  };

  /* ---- v3.1：剧本杀主持人 ---- */
  toyInitFns["scriptkill"] = function () {
    const ROLE_DEFS = {
      killer: { name: "🔪 凶手", desc: "夜晚睁眼刀人" },
      detective: { name: "🔍 侦探", desc: "夜晚查验一人" },
      doctor: { name: "💊 医生", desc: "夜晚救一人" },
      civilian: { name: "🧑 平民", desc: "白天投票" },
    };
    const PHASES = ["🌙 夜晚降临，所有人闭眼", "🔪 凶手请睁眼，刀一个人", "🔍 侦探请睁眼，查验一人身份", "💊 医生请睁眼，救一个人", "☀️ 天亮了，公布昨晚结果", "🗣️ 轮流发言", "🗳️ 投票放逐一人", "📢 公布出局者身份"];
    let players = [], phase = -1, timerId = null, secs = 0;
    let skDeadMode = false; // r18：标记出局模式——手机没有双击，靠开关+点牌标记出局
    function comp(n) {
      const roles = ["killer", "detective"];
      if (n >= 6) roles.push("doctor");
      if (n >= 9) roles.push("killer");
      while (roles.length < n) roles.push("civilian");
      return roles;
    }
    function renderRoles() {
      const box = $("skRoles"); box.innerHTML = "";
      players.forEach((p) => {
        const b = document.createElement("button");
        b.className = "sk-card" + (p.open ? " open" : "") + (p.alive ? "" : " dead");
        b.textContent = p.open ? p.no + "号 " + ROLE_DEFS[p.role].name : p.no + "号 ❓";
        b.setAttribute("aria-label", "玩家" + p.no + (p.open ? ROLE_DEFS[p.role].name : "未翻开"));
        b.addEventListener("click", () => { if (skDeadMode) p.alive = !p.alive; else p.open = !p.open; if (SFX.enabled) SFX.click(); renderRoles(); }); // r18：标记出局模式下点牌切生死、不翻牌
        b.addEventListener("dblclick", () => { p.alive = !p.alive; renderRoles(); });
        box.appendChild(b);
      });
    }
    function deal() {
      const n = Math.max(4, Math.min(12, parseInt($("skCount").value, 10) || 6));
      const roles = comp(n);
      for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = roles[i]; roles[i] = roles[j]; roles[j] = t;
      }
      players = roles.map((r, i) => ({ no: i + 1, role: r, open: false, alive: true }));
      phase = -1;
      renderRoles();
      $("skFlow").classList.remove("hidden");
      $("skPhase").textContent = "身份已发：依次传手机，每人点自己的牌看身份（双击牌标记出局）";
      $("skClueList").innerHTML = "";
      stopTimer();
      if (SFX.enabled) SFX.pop();
    }
    function next() {
      if (!players.length) return;
      phase = (phase + 1) % PHASES.length;
      $("skPhase").textContent = PHASES[phase];
      stopTimer();
      if (SFX.enabled) SFX.click();
    }
    function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } const l = $("skTimerLine"); if (l) l.textContent = ""; }
    function startTimer() {
      stopTimer(); secs = 60;
      $("skTimerLine").textContent = "⏱ " + secs + "s";
      timerId = setInterval(() => {
        secs--;
        if (secs <= 0) { stopTimer(); $("skTimerLine").textContent = "⏱ 时间到！"; if (SFX.enabled) SFX.lose(); return; }
        $("skTimerLine").textContent = "⏱ " + secs + "s";
      }, 1000);
    }
    function clue() {
      const who = $("skClueWho").value.trim(), text = $("skClueText").value.trim();
      if (!who || !text) return;
      const li = document.createElement("li");
      li.textContent = "→ " + who + "号玩家：" + text;
      $("skClueList").appendChild(li);
      $("skClueText").value = "";
      if (SFX.enabled) SFX.pop();
    }
    function renderSkModeBtn() { const b = $("skModeBtn"); if (b) b.textContent = skDeadMode ? "💀 点牌标记出局：开" : "💀 点牌标记出局：关"; } // r18
    const skModeBtn = $("skModeBtn");
    if (skModeBtn) skModeBtn.addEventListener("click", () => { skDeadMode = !skDeadMode; renderSkModeBtn(); if (SFX.enabled) SFX.click(); });
    renderSkModeBtn();
    $("skDealBtn").addEventListener("click", deal);
    $("skNextBtn").addEventListener("click", next);
    $("skTimerBtn").addEventListener("click", startTimer);
    $("skClueBtn").addEventListener("click", clue);
    $("skResetBtn").addEventListener("click", () => { stopTimer(); players = []; phase = -1; skDeadMode = false; renderSkModeBtn(); $("skRoles").innerHTML = ""; $("skFlow").classList.add("hidden"); $("skClueList").innerHTML = ""; }); // r18：重开时标记出局模式也复位
    toyLeaveCleanup.scriptkill = stopTimer;
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get scriptkill() { return { phase: phase, count: players.length }; },
      scriptkillDeal(n) { if (n) $("skCount").value = n; deal(); },
      scriptkillNext() { next(); },
    }));
  };

  /* ---- v3.1：表情包制作 ---- */
  toyInitFns["memegen"] = function () {
    const cv = $("memegenCanvas");
    let img = null, tpl = 0, top = "", bottom = "", size = 40;
    function drawTemplate(ctx, i) {
      try {
        if (i === 0) {
          ctx.fillStyle = "#ffd93b"; ctx.fillRect(0, 0, 320, 320);
          ctx.fillStyle = "#1a1d29";
          ctx.beginPath(); ctx.arc(120, 130, 14, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(200, 130, 14, 0, 7); ctx.fill();
          ctx.strokeStyle = "#1a1d29"; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(160, 170, 60, 0.3, Math.PI - 0.3); ctx.stroke();
        } else if (i === 1) {
          ctx.fillStyle = "#e8e8e8"; ctx.fillRect(0, 0, 320, 320);
          ctx.fillStyle = "#1a1d29"; ctx.font = "bold 200px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("?", 160, 250);
        } else {
          ctx.fillStyle = "#c98f4e"; ctx.fillRect(0, 0, 320, 320);
          ctx.fillStyle = "#c98f4e";
          ctx.beginPath(); ctx.arc(160, 170, 95, 0, 7); ctx.fill();
          ctx.fillStyle = "#a06a2e";
          ctx.beginPath(); ctx.ellipse(85, 85, 28, 48, -0.4, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(235, 85, 28, 48, 0.4, 0, 7); ctx.fill();
          ctx.fillStyle = "#1a1d29";
          ctx.beginPath(); ctx.arc(128, 155, 12, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(192, 155, 12, 0, 7); ctx.fill();
          ctx.fillStyle = "#5b3a1a";
          ctx.beginPath(); ctx.arc(160, 200, 18, 0, 7); ctx.fill();
        }
      } catch (e) {}
    }
    function render() {
      if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d");
      if (!ctx || !ctx.fillRect) return;
      try {
        if (img) { try { ctx.drawImage(img, 0, 0, 320, 320); } catch (e) { drawTemplate(ctx, tpl); } }
        else drawTemplate(ctx, tpl);
        ctx.font = "bold " + size + "px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = Math.max(3, Math.floor(size / 8));
        ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
        if (top) { ctx.strokeText(top, 160, size + 14); ctx.fillText(top, 160, size + 14); }
        if (bottom) { ctx.strokeText(bottom, 160, 308); ctx.fillText(bottom, 160, 308); }
      } catch (e) {}
    }
    $("memegenTpl0").addEventListener("click", () => { tpl = 0; img = null; if (SFX.enabled) SFX.click(); render(); });
    $("memegenTpl1").addEventListener("click", () => { tpl = 1; img = null; if (SFX.enabled) SFX.click(); render(); });
    $("memegenTpl2").addEventListener("click", () => { tpl = 2; img = null; if (SFX.enabled) SFX.click(); render(); });
    const file = $("memegenFile");
    if (file) file.addEventListener("change", () => {
      try {
        const f = file.files && file.files[0];
        if (!f || typeof URL === "undefined" || !URL.createObjectURL) return;
        const url = URL.createObjectURL(f);
        const im = new Image();
        im.onload = () => { img = im; render(); try { URL.revokeObjectURL(url); } catch (e) {} };
        im.src = url;
      } catch (e) {}
    });
    $("memegenTop").addEventListener("input", (e) => { top = e.target.value; render(); });
    $("memegenBottom").addEventListener("input", (e) => { bottom = e.target.value; render(); });
    $("memegenSize").addEventListener("input", (e) => { size = parseInt(e.target.value, 10) || 40; render(); });
    $("memegenDlBtn").addEventListener("click", () => {
      try {
        const a = document.createElement("a");
        a.download = "meme.png";
        a.href = cv.toDataURL("image/png");
        if (typeof a.click === "function") a.click();
        $("memegenMsg").textContent = "已开始下载 ✅";
        if (SFX.enabled) SFX.win();
      } catch (e) { $("memegenMsg").textContent = "下载失败，换个浏览器试试"; }
    });
    render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get memegen() { return { top: top, bottom: bottom, tpl: tpl }; },
      memegenSetText(t, b) {
        top = t || ""; bottom = b || "";
        const te = $("memegenTop"); if (te) te.value = top;
        const be = $("memegenBottom"); if (be) be.value = bottom;
        render();
      },
      memegenTemplate(i) { tpl = i; img = null; render(); },
    }));
  };

  /* ---- v3.1：简历制作 ---- */
  toyInitFns["resume"] = function () {
    const KEY = "dorm-toybox-resume-v1";
    const FIELDS = ["rsName", "rsPhone", "rsMail", "rsTarget", "rsEdu", "rsIntern", "rsProj", "rsSkill"];
    let tpl = 0, saveT = null, lastHtml = "";
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function lines(id) { const el = $(id); const v = el ? el.value.trim() : ""; return v ? v.split("\n").map((x) => x.trim()).filter(Boolean) : []; }
    function render() {
      const p = $("resumePreview"); if (!p) return;
      const name = ($("rsName") && $("rsName").value.trim()) || "姓名";
      const contact = [($("rsPhone") || {}).value, ($("rsMail") || {}).value].map((x) => (x || "").trim()).filter(Boolean).join(" · ");
      const secs = [
        ["求职意向", [($("rsTarget") || {}).value].map((x) => (x || "").trim()).filter(Boolean)],
        ["教育经历", lines("rsEdu")],
        ["实习经历", lines("rsIntern")],
        ["项目经历", lines("rsProj")],
        ["技能", lines("rsSkill")],
      ];
      let h = '<div class="rs-head"><h3>' + esc(name) + "</h3><p>" + esc(contact) + "</p></div>";
      secs.forEach((s) => {
        if (!s[1].length) return;
        h += '<div class="rs-sec"><h4>' + s[0] + "</h4><ul>" + s[1].map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div>";
      });
      p.innerHTML = h;
      lastHtml = h;
      p.className = "resume-preview " + (tpl === 0 ? "tpl-blue" : "tpl-gray");
    }
    function save() {
      try {
        const d = { tpl: tpl };
        FIELDS.forEach((f) => { const el = $(f); d[f] = el ? el.value : ""; });
        localStorage.setItem(KEY, JSON.stringify(d));
      } catch (e) {}
    }
    function load() {
      try {
        const d = JSON.parse(localStorage.getItem(KEY) || "null");
        if (!d) return;
        FIELDS.forEach((f) => { const el = $(f); if (el && typeof d[f] === "string") el.value = d[f]; });
        if (typeof d.tpl === "number") tpl = d.tpl;
      } catch (e) {}
    }
    FIELDS.forEach((f) => {
      const el = $(f);
      if (el) el.addEventListener("input", () => {
        render();
        if (saveT) clearTimeout(saveT);
        saveT = setTimeout(save, 500);
      });
    });
    toyLeaveCleanup.resume = () => { if (saveT) { clearTimeout(saveT); saveT = null; } };
    $("resumeTpl0").addEventListener("click", () => { tpl = 0; render(); save(); if (SFX.enabled) SFX.click(); });
    $("resumeTpl1").addEventListener("click", () => { tpl = 1; render(); save(); if (SFX.enabled) SFX.click(); });
    $("resumePrintBtn").addEventListener("click", () => { try { if (typeof window.print === "function") window.print(); } catch (e) {} });
    $("resumeDlBtn").addEventListener("click", () => {
      try {
        if (typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return;
        const doc = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>简历-" + esc($("rsName").value.trim() || "未命名") + "</title></head><body>" + $("resumePreview").innerHTML + "</body></html>";
        const blob = new Blob([doc], { type: "text/html" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "resume.html";
        if (typeof a.click === "function") a.click();
        if (SFX.enabled) SFX.win();
      } catch (e) {}
    });
    $("resumeClearBtn").addEventListener("click", () => {
      FIELDS.forEach((f) => { const el = $(f); if (el) el.value = ""; });
      try { localStorage.removeItem(KEY); } catch (e) {}
      render();
      if (SFX.enabled) SFX.click();
    });
    load(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get resume() { const el = $("rsName"); return { name: el ? el.value : "", tpl: tpl }; },
      resumeHtml() { return lastHtml; },
      resumeSet(f, v) { const el = $(f); if (el) { el.value = v; render(); save(); } },
      resumeTemplate(i) { tpl = i; render(); },
    }));
  };

  /* ---------- 测试用把手（和宿舍人生一样，方便冒烟测试读内部状态） ---------- */
  /* 把手：懒初始化版——读到哪个键，就先把对应玩具初始化好（冒烟测试直调把手也能触发） */
  const __toyboxHandle = {};
  const __toyboxToyOfKey = {
    tetris: "tetris",
    tetrisSetCur: "tetris",
    g2048: "game2048",
    g2048Set: "game2048",
    g2048Move: "game2048",
    mines: "mines",
    schedule: "schedule",
    mole: "mole",
    moleStart: "mole",
    moleForce: "mole",
    gomoku: "gomoku",
    gomokuSet: "gomoku",
    gomokuAiMove: "gomoku",
    gomokuSetMode: "gomoku",
    piano: "piano",
    pianoPlay: "piano",
    gacha: "gacha",
    gachaSetPity: "gacha",
    gachaPull: "gacha",
    gachaSetRates: "gacha",
    sokoban: "sokoban",
    sokobanLoad: "sokoban",
    sokobanMove: "sokoban",
    breakout: "breakout",
    breakoutStart: "breakout",
    breakoutStep: "breakout",
    breakoutSet: "breakout",
    tictactoe: "tictactoe",
    tictactoeMove: "tictactoe",
    tictactoeSet: "tictactoe",
    linkup: "linkup",
    linkupSet: "linkup",
    linkupCanConnect: "linkup",
    linkupPick: "linkup",
    slide15: "slide15",
    slide15Move: "slide15",
    slide15Set: "slide15",
    jump: "jump",
    jumpSet: "jump",
    jumpCharge: "jump",
    jumpRelease: "jump",
    spotdiff: "spotdiff",
    spotdiffSet: "spotdiff",
    spotdiffPick: "spotdiff",
    catchGame: "catch",
    catchStart: "catch",
    catchStep: "catch",
    catchSet: "catch",
    idiom: "idiom",
    idiomSet: "idiom",
    idiomPick: "idiom",
    drums: "drums",
    drumsToggle: "drums",
    drumsTick: "drums",
    drumsSet: "drums",
    stroop: "stroop",
    stroopSet: "stroop",
    stroopPick: "stroop",
    riddle: "riddle",
    riddleSet: "riddle",
    riddlePick: "riddle",
    shooter: "shooter",
    shooterStart: "shooter",
    shooterStep: "shooter",
    shooterSet: "shooter",
    shooterMoveShip: "shooter",
    onestroke: "onestroke",
    onestrokePick: "onestroke",
    onestrokeSet: "onestroke",
    marble: "marble",
    marbleSetDirs: "marble",
    marbleDrop: "marble",
    marbleStep: "marble",
    make24: "make24",
    make24LoadSet: "make24",
    make24PickNum: "make24",
    make24Combine: "make24",
    fruit: "fruitslice",
    fruitStart: "fruitslice",
    fruitStep: "fruitslice",
    fruitSliceAt: "fruitslice",
    fruitSet: "fruitslice",
    maze: "maze",
    mazeMove: "maze",
    mazeSet: "maze",
    match3: "match3",
    matchSet: "match3",
    matchPick: "match3",
    archery: "archery",
    archeryShoot: "archery",
    flappy: "flappy",
    flappyFlap: "flappy",
    flappyForceDead: "flappy",
    snake2: "snake2",
    snake2SetDir: "snake2",
    snake2Step: "snake2",
    pong: "pong",
    pongSetDiff: "pong",
    pongStart: "pong",
    arkanoid: "arkanoid",
    arkanoidStart: "arkanoid",
    mines2: "mines2",
    mines2Open: "mines2",
    mines2Flag: "mines2",
    chess: "chess",
    chessMove: "chess",
    chessAi: "chess",
    go: "go",
    goPlay: "go",
    uno: "uno",
    unoPlay: "uno",
    mahjong: "mahjong",
    mahjongDiscard: "mahjong",
    poker: "poker",
    pokerCall: "poker",
    pokerEval: "poker",
    rhythm: "rhythm",
    rhythmHit: "rhythm",
    rhythmStart: "rhythm",
    tower: "tower",
    towerDrop: "tower",
    dodge: "dodge",
    dodgeStart: "dodge",
    dodgeMove: "dodge",
    maze3d: "maze3d",
    maze3dMove: "maze3d",
    maze3dTurn: "maze3d",
    scriptkill: "scriptkill",
    scriptkillDeal: "scriptkill",
    scriptkillNext: "scriptkill",
    memegen: "memegen",
    memegenSetText: "memegen",
    memegenTemplate: "memegen",
    resume: "resume",
    resumeHtml: "resume",
    resumeSet: "resume",
    resumeTemplate: "resume",
  };
  window.__toybox = new Proxy(__toyboxHandle, {
    get(t, k, r) {
      if (typeof k === "string" && __toyboxToyOfKey[k]) ensureToyInit(__toyboxToyOfKey[k]);
      const v = Reflect.get(t, k, r);
      return typeof v === "function" ? v.bind(t) : v;
    },
    has(t, k) {
      if (typeof k === "string" && __toyboxToyOfKey[k]) ensureToyInit(__toyboxToyOfKey[k]);
      return Reflect.has(t, k);
    },
  });

  // R14：深链移到最后执行。原来在 const __toyboxHandle 声明之前，46 个玩具的初始化会碰 TDZ
  // （Cannot access '__toyboxHandle' before initialization），整个脚本中断、深链失效、游戏点开是死的。
  // v1.30 要求不变：必须在所有 toyInitFns 注册之后。
  if (TOYS.some((t) => t.id === window.location.hash.slice(1))) showToy(window.location.hash.slice(1));
  else showHome();
})(); // IIFE 收尾（原 renderTimer() 调用已搬进 timer 段的初始化）
