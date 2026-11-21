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
    btn.setAttribute("data-cat", t.cat || "other");
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
  /* ---------- v4.0：Canvas 高清屏适配 ----------
     原来所有画布都按 CSS 像素画，手机（2–3 倍屏）上全是糊的。
     这里把画布的真实像素放大 dpr 倍，但对游戏代码保持“逻辑尺寸”：
     cv.width / cv.height 读写的仍是原来的数值，2D 上下文自动带上 dpr 缩放，
     所以各游戏的绘制、碰撞、坐标换算代码一行都不用改。
     读写像素（getImageData）的画布（拼豆、涂鸦、表情包）不走这里。 */
  const HD_DPR = Math.min(3, Math.max(1, Math.round((window.devicePixelRatio || 1) * 4) / 4));
  function hidpi(cv) {
    if (!cv || cv._hd || HD_DPR === 1 || typeof cv.getContext !== "function") return cv;
    const proto = Object.getPrototypeOf(cv);
    const wd = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width");
    const hd = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");
    if (!wd || !hd || proto !== HTMLCanvasElement.prototype) return cv;
    let lw = wd.get.call(cv), lh = hd.get.call(cv);
    let ctx = null;
    const applyScale = () => { if (ctx) ctx.setTransform(HD_DPR, 0, 0, HD_DPR, 0, 0); };
    cv._hd = true;
    Object.defineProperty(cv, "width", { configurable: true, get: () => lw, set: (v) => { lw = Number(v) || 0; wd.set.call(cv, Math.round(lw * HD_DPR)); applyScale(); } });
    Object.defineProperty(cv, "height", { configurable: true, get: () => lh, set: (v) => { lh = Number(v) || 0; hd.set.call(cv, Math.round(lh * HD_DPR)); applyScale(); } });
    const rawGet = cv.getContext.bind(cv);
    cv.getContext = function (type, opts) {
      const c = rawGet(type, opts);
      if (type !== "2d" || !c) return c;
      if (!ctx) {
        ctx = c;
        const rawSet = c.setTransform.bind(c);
        c.setTransform = function (a, b, cc, d, e, f) {
          if (typeof a === "object" && a) { const m = a; return rawSet(m.a * HD_DPR, m.b * HD_DPR, m.c * HD_DPR, m.d * HD_DPR, m.e * HD_DPR, m.f * HD_DPR); }
          return rawSet(a * HD_DPR, b * HD_DPR, cc * HD_DPR, d * HD_DPR, e * HD_DPR, f * HD_DPR);
        };
        c.resetTransform = function () { rawSet(HD_DPR, 0, 0, HD_DPR, 0, 0); };
        rawSet(HD_DPR, 0, 0, HD_DPR, 0, 0);
      }
      return c;
    };
    // 没有任何 CSS 宽度时，显示尺寸按逻辑尺寸来（否则会按放大后的像素显示成 3 倍大）
    if (!cv.style.width && !/(shooter|fruitslice|archery)-canvas/.test(cv.className || "")) { cv.style.width = lw + "px"; cv.style.maxWidth = "100%"; }
    if (!cv.style.height) cv.style.height = "auto";
    if (cv.parentNode && cv.parentNode.classList && cv.parentNode.classList.contains("timer-ring-wrap")) { cv.style.width = lw + "px"; cv.style.height = lh + "px"; }
    wd.set.call(cv, Math.round(lw * HD_DPR)); hd.set.call(cv, Math.round(lh * HD_DPR));
    return cv;
  }
  ["wheelCanvas", "timerRing", "cuRing", "ledgerChart", "bmiGauge", "compassDialCanvas", "noiseGauge", "noiseHist",
   "snakeCanvas", "tetrisCanvas", "tetrisNext", "breakoutCanvas", "shooterCanvas", "fruitsliceCanvas",
   "archeryCanvas", "flappyCanvas", "snake2Canvas", "pongCanvas", "arkanoidCanvas", "chessCanvas", "goCanvas",
   "rhythmCanvas", "towerCanvas", "dodgeCanvas", "maze3dCanvas", "mazeCanvas"].forEach((id) => { try { hidpi($(id)); } catch (e) { /* 忽略 */ } });

  /* v4.1：FLIP 补间——整格重建的 DOM 也能“滑过去”：记下旧位置 → 重建 → 从旧位置动画回新位置（按文字内容配对） */
  function flipAnimate(container, rebuild, ms) {
    if (!container || FX.reduce || typeof Element === "undefined" || !Element.prototype.animate) { rebuild(); return; }
    const before = new Map();
    Array.from(container.children).forEach((el) => { const k = el.textContent; if (k && !before.has(k)) before.set(k, el.getBoundingClientRect()); });
    rebuild();
    Array.from(container.children).forEach((el) => {
      const k = el.textContent, a = k && before.get(k); if (!a) return;
      const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: ms || 130, easing: "cubic-bezier(.2,.8,.3,1)" });
    });
  }
  /* v4.1：画布坐标 → 屏幕坐标放火花（画布游戏的命中反馈） */
  function cvFX(canvasId, x, y, colors, n) {
    const cv = $(canvasId); if (!cv) return;
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    FX.sparkle(r.left + x * r.width / cv.width, r.top + y * r.height / cv.height, colors, n || 10);
  }
  /* v4.1：砖块类游戏共用的画法——圆角渐变砖、发光球+拖尾、渐变挡板 */
  const PAINT = {
    rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); },
    brick(ctx, x, y, w, h, color) {
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,.25)");
      ctx.fillStyle = color; PAINT.rr(ctx, x + 1, y + 1, w - 2, h - 2, 4); ctx.fill();
      ctx.fillStyle = g; PAINT.rr(ctx, x + 1, y + 1, w - 2, h - 2, 4); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.35)"; PAINT.rr(ctx, x + 3, y + 2, w - 6, 3, 2); ctx.fill();
    },
    ball(ctx, b, trail) {
      if (trail) { trail.push({ x: b.x, y: b.y }); if (trail.length > 8) trail.shift(); trail.forEach((p, i) => { ctx.globalAlpha = (i + 1) / trail.length * 0.25; ctx.fillStyle = "#9ab4ff"; ctx.beginPath(); ctx.arc(p.x, p.y, b.r * (0.5 + i / trail.length * 0.5), 0, 7); ctx.fill(); }); ctx.globalAlpha = 1; }
      ctx.shadowColor = "#9ab4ff"; ctx.shadowBlur = 12; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    },
    paddle(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, "#6366f1"); g.addColorStop(1, "#22d3ee");
      ctx.shadowColor = "#6366f1"; ctx.shadowBlur = 10; ctx.fillStyle = g; PAINT.rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.4)"; PAINT.rr(ctx, x + 6, y + 2, w - 12, 2, 1); ctx.fill();
    },
    bg(ctx, W, H) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#151833"); g.addColorStop(1, "#0b0d1a"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); },
  };
  /* v4.1：网格重绘后，内容从“空”变成“有”的格子播放弹入动画（落子、填数） */
  const popNewSnap = new WeakMap();
  function popNew(container, cls) {
    if (!container) return;
    const kids = Array.from(container.children), prev = popNewSnap.get(container);
    const now = kids.map((k) => k.innerHTML);
    if (prev && prev.length === now.length) kids.forEach((k, i) => { if (now[i] !== prev[i] && now[i] && !/^\s*$/.test(k.textContent + (k.querySelector("span,svg,img") ? "x" : ""))) k.classList.add(cls || "fx-in"); });
    popNewSnap.set(container, now);
  }
  /* v4.2：相对拖动——手指在画面任意处按下，物体不跳；手指移多少，物体跟着移多少（不会被手指挡住）。
     get() 返回物体当前逻辑坐标，set(x, y) 写回；lw/lh 是逻辑宽高（默认取画布尺寸）；
     鼠标在电脑上不按键移动时仍直接跟随（hoverAbs），因为鼠标不挡视线。 */
  function relDrag(el, get, set, opt) {
    if (!el) return;
    opt = opt || {};
    let s = null;
    const dims = () => { const r = el.getBoundingClientRect(); return { r, kx: (opt.lw || el.width || r.width) / (r.width || 1), ky: (opt.lh || el.height || r.height) / (r.height || 1) }; };
    el.addEventListener("pointerdown", (e) => {
      const p = get(); s = { cx: e.clientX, cy: e.clientY, x: p.x, y: p.y, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
    });
    el.addEventListener("pointermove", (e) => {
      const d = dims(), g = opt.gain || 1.15;
      if (s && e.pointerId === s.id) { set(s.x + (e.clientX - s.cx) * d.kx * g, s.y + (e.clientY - s.cy) * d.ky * g); return; }
      if (!s && e.pointerType === "mouse" && opt.hoverAbs) set((e.clientX - d.r.left) * d.kx, (e.clientY - d.r.top) * d.ky, true);
    });
    const end = (e) => { if (s && (!e || e.pointerId === s.id)) s = null; };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    // 阻止页面跟着手指滚动（画布本身已 touch-action:none，这里再兜底 iOS）
    el.addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  }
  /* v4.0：按住连发——按下立即触发一次，停顿 260ms 后按 interval 连发，松手/滑出即停 */
  function holdRepeat(btn, fn, interval) {
    if (!btn) return;
    let t1 = null, t2 = null, fired = false;
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    btn.addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); stop(); fired = true; fn(); t1 = setTimeout(() => { t2 = setInterval(fn, interval || 90); }, 260); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener("click", (e) => { if (fired) { fired = false; return; } fn(); }); // 键盘回车/读屏点击
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
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
  // v4.0：给人看的日期（历史记录里原来直接显示 "Mon Nov 16 2026"）
  function prettyDate(v) {
    const d = new Date(v);
    if (isNaN(d)) return String(v || "");
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return (/\d\d:\d\d/.test(String(v)) || typeof v === "number") ? "今天 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "今天";
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
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
    chime() { [784, 1047].forEach((f, i) => this._tone(f, 0.14, "triangle", 0.12, i * 0.07)); },
  };
  /* ========== v4.1：全局手感层 FX ==========
     胜负/得分的视觉+震动反馈统一放这里，SFX.win()/lose() 会自动带上，所以关了声音也有反馈。 */
  const FX = (function () {
    const reduce = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
    let cv = null, ctx = null, parts = [], raf = null, dpr = Math.min(2, window.devicePixelRatio || 1);
    const COLORS = ["#ffd43b", "#ff6b6b", "#4dabf7", "#69db7c", "#da77f2", "#ffa94d", "#ffffff"];
    function layer() {
      if (cv) return true;
      try {
        cv = document.createElement("canvas");
        cv.className = "fx-layer"; cv.setAttribute("aria-hidden", "true");
        document.body.appendChild(cv);
        ctx = cv.getContext("2d");
        const fit = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
        fit(); window.addEventListener("resize", fit);
        return !!ctx;
      } catch (e) { return false; }
    }
    function loop(t) {
      raf = null;
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const now = performance.now();
      parts = parts.filter((p) => now - p.born < p.life);
      for (const p of parts) {
        const k = (now - p.born) / 1000;
        const x = p.x + p.vx * k, y = p.y + p.vy * k + 0.5 * p.g * k * k;
        const a = 1 - (now - p.born) / p.life;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
        ctx.translate(x, y); ctx.rotate(p.rot + p.vr * k);
        ctx.fillStyle = p.c;
        if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, 6.3); ctx.fill(); }
        ctx.restore();
      }
      if (parts.length) raf = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
    function burst(x, y, n, opt) {
      if (reduce || !layer()) return;
      opt = opt || {};
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        const ang = opt.up ? -Math.PI / 2 + (Math.random() - 0.5) * (opt.spread || 1.6) : Math.random() * Math.PI * 2;
        const sp = (opt.speed || 520) * (0.45 + Math.random() * 0.75);
        parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: opt.g == null ? 900 : opt.g, born: now, life: (opt.life || 1500) * (0.7 + Math.random() * 0.5),
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, s: (opt.size || 9) * (0.6 + Math.random() * 0.8), c: (opt.colors || COLORS)[Math.floor(Math.random() * (opt.colors || COLORS).length)], shape: Math.random() < 0.6 ? 0 : 1 });
      }
      if (parts.length > 600) parts.splice(0, parts.length - 600);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function panel() { return document.querySelector(".toy:not(.hidden)"); }
    function center(el) { const r = (el || document.body).getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.max(80, r.top + Math.min(r.height, innerHeight) * 0.35) }; }
    let buzzOn = lsGet("dorm-toybox-buzz-v1", "1") === "1";
    const FX = {
      reduce,
      buzz(p) { if (!buzzOn) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} },
      setBuzz(on) { buzzOn = !!on; lsSet("dorm-toybox-buzz-v1", on ? "1" : "0"); },
      get buzzOn() { return buzzOn; },
      burst,
      // 从某个元素（默认当前玩具）往上喷彩带
      celebrate(el) {
        const c = center(el || panel());
        burst(c.x - 60, c.y + 40, 45, { up: true, spread: 1.3, speed: 760 });
        burst(c.x + 60, c.y + 40, 45, { up: true, spread: 1.3, speed: 760 });
        const p = el || panel(); if (p) { p.classList.remove("fx-win"); void p.offsetWidth; p.classList.add("fx-win"); setTimeout(() => p.classList.remove("fx-win"), 900); }
        FX.buzz([18, 40, 28]);
      },
      // 小火花：点中、消除、得分
      sparkle(x, y, colors, n) { burst(x, y, n || 14, { speed: 260, g: 500, life: 650, size: 6, colors }); },
      shake(el) {
        const p = el || panel(); if (!p || reduce) return;
        p.classList.remove("fx-shake"); void p.offsetWidth; p.classList.add("fx-shake");
        setTimeout(() => p.classList.remove("fx-shake"), 450);
      },
      fail(el) { FX.shake(el); FX.buzz([70, 50, 70]); },
      // 飘字：+10、Perfect 之类，坐标是屏幕坐标
      float(text, x, y, color) {
        try {
          const d = document.createElement("div");
          d.className = "fx-float"; d.textContent = text;
          d.style.left = x + "px"; d.style.top = y + "px"; if (color) d.style.color = color;
          document.body.appendChild(d);
          setTimeout(() => d.remove(), 900);
        } catch (e) {}
      },
      floatAt(el, text, color) { if (!el) return; const r = el.getBoundingClientRect(); FX.float(text, r.left + r.width / 2, r.top + r.height / 3, color); },
      // 元素弹一下
      pop(el) { if (!el || reduce) return; el.classList.remove("fx-pop"); void el.offsetWidth; el.classList.add("fx-pop"); },
    };
    return FX;
  })();
  // 胜负自动带上视觉和震动；声音仍只在开声音时响（_tone 里判断）
  (function () {
    const w = SFX.win.bind(SFX), l = SFX.lose.bind(SFX), h = SFX.hit.bind(SFX);
    SFX.win = function () { FX.celebrate(); w(); };
    SFX.lose = function () { FX.fail(); l(); };
    SFX.hit = function () { FX.buzz(30); h(); };
    const c = SFX.chime.bind(SFX);
    SFX.chime = function () { FX.buzz(12); c(); };
  })();
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
    { const pe = $("toy-" + id); pe.classList.remove("fx-enter"); void pe.offsetWidth; pe.classList.add("fx-enter"); setTimeout(() => pe.classList.remove("fx-enter"), 400); }
    allTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === clickedId));
    allHomeTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === clickedId));
    currentToy = id;
    currentClicked = clickedId;
    setToyChrome(clickedId);
    if (toyEnterResume[id]) toyEnterResume[id]();
    showHowtoBar(clickedId); // v1.33：新手引导（首次打开显示怎么玩）
    if (window.location.hash !== "#" + clickedId) window.location.hash = clickedId;
    window.scrollTo({ top: 0, behavior: "auto" }); // v4.2：切页直接到顶，不和入场动画叠在一起发飘
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
    // R20：工具箱重定向的入口（fx/bmi/stopwatch/aa）没有独立可见 panel，提示条要进重定向后的工具箱；
    // 旧写法取 $("toy-"+tid)，落到隐藏的旧 section，用户永远看不到提示条，"？"按钮也加在了看不见的地方。
    var panel = $("toy-" + (TOOLBOX_REDIRECT[tid] || tid));
    if (!panel) return;
    var old = panel.querySelector(".howto-bar");
    if (old) {
      try {
        if (typeof old.remove === "function") old.remove();
        else if (old.parentNode && typeof old.parentNode.removeChild === "function") old.parentNode.removeChild(old);
      } catch (e) { /* 桩环境忽略 */ }
    }
    if (!force && getHowtoSeen().indexOf(tid) !== -1) return;
    if (!force) markHowtoSeen(tid); // v4.2：自动弹出的提示只出现一次，下次进来不再挡在游戏上面（想再看点顶栏的“？”）
    var bar = document.createElement("div");
    bar.className = "howto-bar";
    var txt = document.createElement("span");
    txt.textContent = "💡 " + toy.howto;
    var intro = panel.querySelector(".toy-intro");
    if (intro && intro.textContent.trim()) {
      var more = document.createElement("small");
      more.className = "howto-more";
      more.textContent = intro.textContent.trim();
      txt.appendChild(document.createElement("br"));
      txt.appendChild(more);
    }
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
    if (!h2) return;
    // R20：工具箱标题是几个入口共用的（kin 归亲戚/fx/bmi），"？"要跟当前入口走；
    // 旧写法第一次加完就再也不换，点开 BMI 再点"？"看到的还是汇率的玩法。
    var b = h2.querySelector(".howto-help");
    if (!b) {
      b = document.createElement("button");
      b.className = "howto-help";
      b.setAttribute("aria-label", "怎么玩");
      b.textContent = "？";
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        showHowtoBar(b.getAttribute("data-tid") || tid, true);
      });
      h2.appendChild(b);
    }
    b.setAttribute("data-tid", tid);
  }
  /* v4.0：紧凑顶栏——进玩具后顶栏只剩 ← / 名字 / ？ / 🔊，开头说明收进“？” */
  let currentClicked = null;
  document.querySelectorAll(".toy").forEach((panel) => {
    const kids = Array.from(panel.children);
    const h = kids.findIndex((k) => k.tagName === "H2");
    for (let i = h + 1; h >= 0 && i < kids.length; i++) {
      const k = kids[i];
      if (k.classList.contains("howto-bar")) continue;
      if (k.tagName === "P" && k.classList.contains("hint") && !k.id) k.classList.add("toy-intro");
      break;
    }
  });
  function setToyChrome(tid) {
    try {
      document.body.classList.toggle("in-toy", !!tid);
      const t = tid && TOYS.find((x) => x.id === tid);
      const title = $("toyBarTitle");
      if (title) title.textContent = t ? t.label : "";
      const hb = $("homeBtn");
      if (hb) hb.setAttribute("aria-label", tid ? "返回全部玩具" : "主页");
      document.title = t ? splitLabel(t.label).name + " · 宿舍玩具盒" : "宿舍玩具盒 · 打开就能玩";
    } catch (e) { /* 忽略 */ }
  }
  if ($("toyHelpBtn")) $("toyHelpBtn").addEventListener("click", () => {
    if (!currentClicked) return;
    const panel = $("toy-" + (TOOLBOX_REDIRECT[currentClicked] || currentClicked));
    const open = panel && panel.querySelector(".howto-bar");
    if (open) { open.remove(); markHowtoSeen(currentClicked); return; }
    showHowtoBar(currentClicked, true);
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {}
  });
  /* v1.27：回主页——藏起所有玩具，露出置顶 + 全部游戏 */
  function showHome(toTop) {
    const fromToy = !!currentToy; // v3.0 第7轮：是否从玩具返回（决定滚动行为）
    if (currentToy) leaveToy(currentToy);
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-home").classList.remove("hidden");
    if (fromToy) { const hp = $("toy-home"); hp.classList.remove("fx-enter-home"); void hp.offsetWidth; hp.classList.add("fx-enter-home"); setTimeout(() => hp.classList.remove("fx-enter-home"), 450); }
    renderRecent();
    allTiles().forEach((b) => b.classList.remove("active"));
    allHomeTiles().forEach((b) => b.classList.remove("active"));
    currentToy = null;
    setToyChrome(null);
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
    $("sideDrawer").inert = false;
    $("menuBtn").setAttribute("aria-expanded", "true");
    $("drawerOverlay").classList.remove("hidden");
    // v3.0 第7轮：打开抽屉时清空抽屉搜索，恢复主过滤状态
    if ($("drawerSearch")) $("drawerSearch").value = "";
    refreshDrawerFilter();
  }
  function closeDrawer(restoreFocus) {
    const wasOpen = $("sideDrawer").classList.contains("open");
    $("sideDrawer").classList.remove("open");
    $("sideDrawer").inert = true;
    $("menuBtn").setAttribute("aria-expanded", "false");
    if (wasOpen && restoreFocus === true) { try { $("menuBtn").focus(); } catch (e) {} }
    $("drawerOverlay").classList.add("hidden");
    // v3.0 第7轮：关闭时清空抽屉搜索，下次打开是干净状态
    if ($("drawerSearch")) $("drawerSearch").value = "";
    refreshDrawerFilter();
  }
  $("sideDrawer").inert = true;
  $("menuBtn").setAttribute("aria-expanded", "false");
  $("menuBtn").setAttribute("aria-controls", "sideDrawer");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("sideDrawer").classList.contains("open")) closeDrawer(true); });
  $("menuBtn").addEventListener("click", openDrawer);
  $("homeBtn").addEventListener("click", () => {
    // v3.0 第7轮：在玩具里点主页→恢复滚动位置；在主页点→回顶部
    if (currentToy) showHome();
    else { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} }
  });
  $("drawerCloseBtn").addEventListener("click", () => closeDrawer(true));
  $("drawerOverlay").addEventListener("click", () => closeDrawer(true));
  // v4.1：震动开关（安卓手机有效；iPhone 浏览器本身不支持网页震动）
  (function () {
    const b = $("buzzBtn"); if (!b) return;
    const sync = () => { b.textContent = "📳 震动反馈：" + (FX.buzzOn ? "开" : "关"); b.setAttribute("aria-pressed", FX.buzzOn ? "true" : "false"); };
    b.addEventListener("click", () => { FX.setBuzz(!FX.buzzOn); FX.buzz(20); sync(); });
    sync();
  })();
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
        d.textContent = prettyDate(h.date);
        li.appendChild(a);
        li.appendChild(d);
        box.appendChild(li);
      });
    }
    function pushWheelHist(text) {
      const h = loadWheelHist();
      h.unshift({ text: text, date: Date.now() });
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

    // v4.1：直接点转盘也能转
    if ($("wheelCanvas")) $("wheelCanvas").addEventListener("click", () => { if (!wheelSpinning) $("spinWheelBtn").click(); });
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
      const targetMid = targetIndex * seg + seg / 2 + (Math.random() - 0.5) * seg * 0.72; // v4.1：别每次都停在正中间，更像真转盘
      const pointerAngle = -Math.PI / 2;
      let delta = pointerAngle - (wheelAngle + targetMid);
      while (delta <= 0) delta += Math.PI * 2;
      const totalRotation = Math.PI * 2 * (5 + Math.floor(Math.random() * 2)) + delta;
      const startAngle = wheelAngle;
      const startTime = performance.now();
      const duration = 4300;
      const ptr = document.querySelector("#toy-wheel .wheel-pointer");
      let lastSeg = Math.floor((pointerAngle - startAngle) / seg);
      function frame(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4); // v4.1：四次方减速，最后几格慢慢挪，更有悬念
        wheelAngle = startAngle + totalRotation * eased;
        drawWheel(wheelAngle);
        // 每划过一格：咔哒一声、指针抖一下、轻震
        const curSeg = Math.floor((pointerAngle - wheelAngle) / seg);
        if (curSeg !== lastSeg) {
          lastSeg = curSeg;
          SFX._tone(1400, 0.025, "square", 0.04);
          if (t > 0.55) FX.buzz(5);
          if (ptr) { ptr.classList.remove("tick"); void ptr.offsetWidth; ptr.classList.add("tick"); }
        }
        if (t < 1) { requestAnimationFrame(frame); }
        else {
          wheelSpinning = false;
          $("spinWheelBtn").disabled = false;
          $("wheelResult").textContent = "🎉 命运已定：" + wheelOptions[targetIndex] + "！";
          FX.pop($("wheelResult"));
          wheelConfetti();
          pushWheelHist(wheelOptions[targetIndex]);
          if (typeof SFX !== "undefined") SFX.chime();
        }
      }
      requestAnimationFrame(frame);
    });

  };
  /* ---------- 2. 真心话大冒险 ---------- */
  toyInitFns["cards"] = function () {
    let usedTruths = [], usedDares = [];
    let lastKind = "truth"; // R19：跳过重抽用的上次种类。原来在 if (cardsSec) 块里声明，块外的 eitherBtn 监听够不着。
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
        const names = nameInput.value.trim().split(/[\s,，、；;]+/).filter(Boolean); // R19：中文顿号/逗号/分号分隔也认，不然整串算一个人还悄悄回落到默认玩家
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
      const origDraw = drawCard;
      skipBtn.addEventListener("click", () => {
        // 重抽一张同类型的（不计入已抽，避免浪费）
        if (usedTruths.length > 0 && lastKind === "truth") usedTruths.pop();
        if (usedDares.length > 0 && lastKind === "dare") usedDares.pop();
        origDraw(lastKind);
      });
      // 记录上次类型（eitherBtn 在抽卡处记真实种类，这里只记两个明确按钮）
      ["truthBtn", "dareBtn"].forEach((id) => {
        const b = $(id);
        if (b) b.addEventListener("click", () => {
          if (id === "truthBtn") lastKind = "truth";
          else if (id === "dareBtn") lastKind = "dare";
        });
      });
    }
    $("truthBtn").addEventListener("click", () => drawCard("truth"));
    $("dareBtn").addEventListener("click", () => drawCard("dare"));
    $("eitherBtn").addEventListener("click", () => { const kind = Math.random() < 0.5 ? "truth" : "dare"; lastKind = kind; drawCard(kind); }); // R19：随便来要记真实种类，不然“跳过重抽”总按真心话重抽
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
      hidpi(diceCanvas);
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
          if (typeof SFX !== "undefined" && SFX.win) SFX.chime();
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
      hidpi(fortuneCanvas);
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
    let pickRolling = false; // R19：滚动中再点抽就丢弃，不然多条滚动计时器并跑，会抽出重名、一次点出多个结果
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
      if (pickRolling) return; // R19：上一轮还在滚就忽略这次点击
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
      pickRolling = true;
      const timer = setInterval(() => {
        result.textContent = pick(candidates); // R19：滚动只闪候选人（已抽过的不再闪，不然“不再重复”看着像假的）
        ticks++;
        if (ticks === 7) result.classList.add("slowing"); // 减速：名字越滚越慢的视觉
        if (ticks >= 10) {
          clearInterval(timer);
          pickRolling = false;
          const winner = pick(candidates);
          result.classList.remove("slowing");
          result.textContent = "🎉 " + winner;
          result.classList.add("pop");
          if (typeof SFX !== "undefined") SFX.chime();
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
    // R25：首次打开名单是空的，点一下填示例就能试
    $("pickSampleBtn").addEventListener("click", () => {
      $("nameList").value = "阿伟\n小明\n阿强\n老陈\n大刘\n小美";
      try { lsSet(PICKER_NAMES_KEY, $("nameList").value); } catch (e) { /* 忽略 */ }
      renderPickLeft();
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
      try { localStorage.setItem(TOMATO_KEY, JSON.stringify({ day: todayStr(), count: tomatoesToday })); } catch (e) { /* 存储不可用时只在内存里计数 */ }
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
      if (!swRunning && swElapsed === 0) return; // R20：还没开始（或已清零）时点计次不记 0 圈
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
    // R23：正计时也要像秒表一样离场停、回来续（原来只清秒表，正计时的 500ms 计时器切走后还在后台跑）
    const cuCleanup = () => { if (cuTimerId) { clearInterval(cuTimerId); cuTimerId = null; } };
    const cuResume = () => { if (cuRunning && !cuTimerId) cuTimerId = setInterval(cuRender, 500); };
    const _swLeave = toyLeaveCleanup.timer;
    const _swResume = toyEnterResume.timer;
    toyLeaveCleanup.timer = () => { if (_swLeave) _swLeave(); cuCleanup(); };
    toyEnterResume.timer = () => { if (_swResume) _swResume(); cuResume(); };
    toyLeaveCleanup.stopwatch = toyLeaveCleanup.timer;
    toyEnterResume.stopwatch = toyEnterResume.timer;
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
      // R23：别把一组最后一个人移走——移完那组变 0 人空组，复制文案里队长变 undefined
      if (lastGroups[from.gi] && lastGroups[from.gi].length <= 1) {
        groupSelected = null;
        renderGroups(lastGroups, false);
        $("groupResult").textContent = "「" + from.name + "」是第 " + (from.gi + 1) + " 组唯一的成员，移走这组就空了。";
        return false;
      }
      const moved = lastGroups[from.gi] && lastGroups[from.gi].splice(from.mi, 1)[0];
      if (moved === undefined) { groupSelected = null; return false; }
      lastGroups[toGi].push(moved);
      groupSelected = null;
      renderGroups(lastGroups, false);
      $("groupResult").textContent = "已把「" + moved + "」移到第 " + (toGi + 1) + " 组。"; // R21：renderGroups 会写“已随机分成”，手动移动后要改口
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
        // R23：同点选移动，拖走最后一人也要拦（不然拖出空组，队长变 undefined）
        if (lastGroups[dragData.gi] && lastGroups[dragData.gi].length <= 1) {
          const only = lastGroups[dragData.gi][dragData.mi];
          const fromGi = dragData.gi;
          dragData = null;
          $("groupResult").textContent = "「" + only + "」是第 " + (fromGi + 1) + " 组唯一的成员，移走这组就空了。";
          return;
        }
        const moved = lastGroups[dragData.gi].splice(dragData.mi, 1)[0];
        if (moved === undefined) return;
        lastGroups[toGi].push(moved);
        groupSelected = null; // R18：拖完清掉点选，避免旧选中标到错的人
        renderGroups(lastGroups, false);
        $("groupResult").textContent = "已把「" + moved + "」移到第 " + (toGi + 1) + " 组。"; // R21：同点选移动，别写“已随机分成”
        if (typeof SFX !== "undefined") SFX.click();
        dragData = null;
      });
    }
    $("doGroupBtn").addEventListener("click", () => {
      const names = groupNamePool();
      const count = parseInt($("groupCount").value, 10) || 2; // R20：兜底 2 组，值异常时不至于 groups 为空数组导致 push 报错
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
    // R25：首次打开名单是空的，点一下填示例就能试
    $("groupSampleBtn").addEventListener("click", () => {
      $("groupNames").value = "阿伟\n小明\n阿强\n老陈\n大刘\n小美\n阿珍\n小北";
      try { lsSet(GROUPS_NAMES_KEY, $("groupNames").value); } catch (e) { /* 忽略 */ }
    });
    $("copyGroupsBtn").addEventListener("click", async () => {
      const text = lastGroups.map((g, i) => "第 " + (i + 1) + " 组（队长 " + (g[0] || "（空组）") + "）：" + g.join("、")).join("\n"); // R23：空组兜底，队长永不写 undefined
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
        d.textContent = prettyDate(r.date);
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
      else if (RPS_BEATS[you] === cpu) { rpsScore.you++; msg = "🎉 你赢了这局！"; SFX.chime(); }
      else { rpsScore.cpu++; msg = "😤 电脑赢了这局。"; SFX.lose(); }
      if (predicted) msg += "（AI 觉得你要出" + RPS_HANDS[predicted] + "）";
      if (rpsScore.you >= RPS_TARGET) msg = "🏆 5 局 3 胜，你赢下了整场！AI 服了。";
      else if (rpsScore.cpu >= RPS_TARGET) msg = "💻 AI 5 局 3 胜拿下整场。它快把你看透了，换套路再来？";
      $("rpsResult").textContent = msg;
      renderRpsScore();
      saveRps();
      // R21：只有打完一场才露重置按钮（原来每出一招都露出来，整场都挂着“再来一场”）
      if (rpsScore.you >= RPS_TARGET || rpsScore.cpu >= RPS_TARGET) $("rpsResetBtn").classList.remove("hidden");
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
      $("rpsResetBtn").classList.add("hidden"); // R21：新一局开始就藏回去，不然整场都挂着个“再来一场”
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
      // R21：猜过的数不再计次数；区间外的数不计次数（按区间条提示换一个）
      if (guessTries.includes(n)) {
        $("guessResult").textContent = "「" + n + "」已经猜过了，换一个数。";
        return;
      }
      if (n < guessLow || n > guessHigh) {
        $("guessResult").textContent = "「" + n + "」不在区间 [" + guessLow + ", " + guessHigh + "] 里，换一个。";
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
          turnP.textContent = "本局结束，点「换个数重开」再来一局。"; // R21：终局后回合提示别还写着轮到谁猜
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
    let memoryGen = 0; // R22：对局世代——重开后旧的翻牌结算超时必须作废，不然会污染新局
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
      memoryGen++; // R22：重开局世代 +1，旧的翻牌结算超时作废
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
    let memoryPending = null; // v4.1：配错后等待翻回时，点下一张直接结算，不用干等
    function memoryFlip(card) {
      if (memoryLock && memoryPending && !card.classList.contains("flipped") && !card.classList.contains("matched")) { memoryPending(); }
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
        const gen = memoryGen; // R22：记下本局世代，结算时世代变了说明已重开，直接作废
        const isMatch = a.getAttribute("data-emoji") === b.getAttribute("data-emoji");
        if (!isMatch) setTimeout(() => { if (gen === memoryGen) { a.classList.add("nope"); b.classList.add("nope"); FX.buzz(30); } }, 260);
        let done = false;
        const settle = () => {
          if (done) return; done = true; memoryPending = null; clearTimeout(tid);
          if (gen !== memoryGen) return;
          a.classList.remove("nope"); b.classList.remove("nope"); // R22：旧局结算不碰新局（否则幽灵 +1 配对数，新局 7 对就提前通关）
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
            a.classList.remove("flipped", "unflipping");
            b.classList.remove("flipped", "unflipping");
            a.textContent = "❓";
            b.textContent = "❓";
            memoryFlipped = [];
            memoryLock = false;
            $("memoryResult").textContent = "没配上，再试一次。";
            return;
          }
          [a, b].forEach((c) => { FX.pop(c); const r = c.getBoundingClientRect(); FX.sparkle(r.left + r.width / 2, r.top + r.height / 2, null, 8); });
          memoryFlipped = [];
          memoryLock = false;
        };
        const tid = setTimeout(settle, isMatch ? 330 : 850);
        if (!isMatch) memoryPending = settle;
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
        const cpm = Math.round((correct / seconds) * 60); // R27：速度按打对的字算（原来按全文长度，错字也算速度；实时统计却是按打对的字算，两处不一致）
        const accuracy = Math.round((correct / typingTarget.length) * 100);
        let msg = "🎉 打完！速度 " + cpm + " 字/分 · 正确率 " + accuracy + "% · 用时 " + seconds.toFixed(1) + " 秒。";
        if (cpm > 0 && (typingBest === 0 || cpm > typingBest)) { // R27：0 字/分不存纪录（0 = 无纪录，存了会污染纪录位并谎报“新纪录”）
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
    function renderPuzzle() { flipAnimate($("puzzleGrid"), renderPuzzleNow); }
    function renderPuzzleNow() {
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
    // R19：方向键滑块（电脑键盘也能玩；与点击走同一入口 puzzleMove，顶到边不动）
    function puzzleSlide(dir) {
      const b = puzzleBlankAt();
      let target = -1;
      if (dir === "up" && b >= 3) target = b - 3;
      else if (dir === "down" && b <= 5) target = b + 3;
      else if (dir === "left" && b % 3 !== 0) target = b - 1;
      else if (dir === "right" && b % 3 !== 2) target = b + 1;
      if (target >= 0) puzzleMove(target);
    }
    if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function puzzleKeys(e) {
      if ($("toy-puzzle") && $("toy-puzzle").classList.contains("hidden")) return;
      const dir = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
      if (dir) { puzzleSlide(dir); e.preventDefault(); }
    });
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      puzzleKey(dir) { puzzleSlide(dir); },
    }));
    puzzleShuffle();

  };
  /* ---------- 14. 老虎机：左右两台独立机器，一人一台，轮流拉，回合制记分 ---------- */
  toyInitFns["slots"] = function () {
    const SLOTS_KEY = "dorm-toybox-slots-v2";
    const SLOTS_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]];
    let slotsSpinning = false;
    let slotsTimer = null; // R21：拉动进行中的计时器 id，重置要停掉它，不然重置后旧拉动跑完照样加分翻轮次
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
      slotsTimer = setInterval(() => {
        const roll = [];
        for (let i = 0; i < 9; i++) roll.push(pick(SLOTS_SYMBOLS));
        renderSlotsReels(who, roll);
        ticks++;
        if (ticks >= 12) {
          clearInterval(slotsTimer);
          slotsTimer = null;
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
            SFX.chime();
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
      // R21：先停掉进行中的拉动（不然旧拉动跑完照样加分翻轮次，重置白点了）
      if (slotsTimer) { clearInterval(slotsTimer); slotsTimer = null; }
      slotsSpinning = false;
      ["a", "b"].forEach((w) => { const r = slotsReelsEl(w); if (r) r.classList.remove("spinning"); });
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
      }      popNew(grid);
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
      if (n === sudokuSolution[i]) {
        // v4.1：凑满一整行/列/宫，那一组依次闪光
        const val = (k) => sudokuPuzzle[k] || sudokuEntries[k];
        const ok = (cells) => cells.every((k) => val(k) === sudokuSolution[k]);
        const r = Math.floor(i / 9), c = i % 9, br = r - r % 3, bc = c - c % 3;
        const units = [[...Array(9)].map((_, k) => r * 9 + k), [...Array(9)].map((_, k) => k * 9 + c), [...Array(9)].map((_, k) => (br + Math.floor(k / 3)) * 9 + bc + k % 3)];
        const kids = $("sudokuGrid").children; let any = false;
        units.filter(ok).forEach((u) => { any = true; u.forEach((k, j) => { const el = kids[k]; if (el) { el.style.animationDelay = j * 35 + "ms"; el.classList.add("unit-done"); } }); });
        if (any) { SFX.chime(); }
      }
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
        FX.buzz(25);
        if (typeof SFX !== "undefined") SFX.click();
        return;
      }
      if (schulteStartAt === null) {
        schulteStartAt = performance.now();
        schulteTimerId = setInterval(renderSchulteStats, 100);
      }
      cell.classList.add("done");
      FX.pop(cell);
      if (typeof SFX !== "undefined") SFX.pop(schulteNext / total);
      schulteNext++;
      if (schulteNext > total) {
        schulteDone = true;
        if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; }
        const seconds = Math.max(schulteElapsed(), 0.1); // R27：0.0 秒不存纪录（0 = 无纪录，存了 0 会把“已通关”显示回“还没人通关”，下次还谎报“新纪录”；与打字 0.1 秒下限同款）
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
      // R23：清零也要清 C–H 队（原来只清 A/B，C 队分数残留，结算时还会赢）
      scoreExtra.teams.forEach((t) => { t.score = 0; });
      saveExtra();
      renderExtraTeams();
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
      const pct = Math.min(100, Math.round((lived / LIFE_TOTAL_MONTHS) * 100)); // R24：1900 年生人 lived 超 960 格，百分比别写 159%
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
    function r2Ledger(n) { return Math.round(n * 100) / 100; } // R23：浮点求和取整到分再显示
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
        : "收入 " + r2Ledger(income) + " 元 · 支出 " + r2Ledger(expense) + " 元 · 结余 " + r2Ledger(income - expense) + " 元"; // R23：金额按分取整再显示，不然 0.1+0.2 会印出 0.30000000000000004
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
      // R23：重名只算一人（同分组去重；不然同一个人算两份，垫付结算也对不上）
      const seen = new Set();
      return $("aaNames").value.split("\n").map((s) => s.trim()).filter((s) => {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      });
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
    let beadsShowingPhoto = false; // 当前图纸是不是照片算出来的（R24 前示例爱心固定 16 格不跟格数走，现已跟格数重排）
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
      else if (!beadsShowingPhoto && beadsLastPixels) {
        // R24：示例爱心以前不跟格数走，换格数时控件静默没反应（页头 hint 却写着“换格数后图纸马上重算”）——按新格数就近取样重排示例图
        const size = parseInt($("beadsSize").value, 10) || 16;
        const charHex = { ".": "#E5ECF1", R: "#B4060E", P: "#EA8AA5" };
        const pixels = [];
        for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) pixels.push(charHex[BEADS_SAMPLE[Math.floor((r * 16) / size)][Math.floor((c * 16) / size)]] || "#E5ECF1");
        beadsRender(pixels, size, size);
      }
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
      if (amount <= 0) { $("fxResult").textContent = "金额要大于 0。"; return; } // R20：负数/0 之前照常换算出负数，毫无意义
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
    // R26：首次打开就按滑杆默认值（170cm/65kg）同步并出结果。
    // 原来 init 不调 bmiSyncFromSliders，隐藏输入框一直是空的，打开只见“先填身高体重”，
    // 点“算一下”也报“先填对身高”——滑杆明明显示着 170/65，像按钮坏了。
    bmiSyncFromSliders();

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
        if (kw && !(item.zh.includes(kw) || item.en.toLowerCase().includes(kw) || item.ja.includes(kw) || item.ko.includes(kw))) return; // R25：原来只搜中文/英文，搜日语/韩语永远“没搜到”，howto 却写中英日韩对照
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
      $("compassDeg").textContent = (Math.round(deg) % 360) + "° · " + compassDir(deg); // R25：359.9° 四舍五入是 360°，表盘没有 360 刻度，归 0°
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
      if (db < 85) return "很吵，注意听力 🙉"; // R25：满格信号也只有约 89.9dB，90 档永远到不了
      return "非常吵，离远点！🚨";
    }
    const noiseHist = [];
    let noiseLastHistAt = 0; // R25：曲线 1 秒记 1 个点（见 noiseRender）
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
      $("noiseMeter").style.width = Math.min(100, Math.max(0, db) / 120 * 100) + "%"; // R25：表条原来把分贝数直接当百分比，60dB 占 60%，和 0–120 的表盘刻度对不上
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
      // R25：原来每帧都记一个点，60 个点只盖约 1 秒，标签却写“最近 60 秒”；改成 1 秒记 1 个点，60 个点正好 60 秒
      const nowHist = Date.now();
      if (nowHist - noiseLastHistAt >= 1000) { noiseHist.push(db); if (noiseHist.length > 60) noiseHist.shift(); noiseLastHistAt = nowHist; }
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
        // R29：建 AudioContext/分析器失败（老机器没 AudioContext）不能静默——之前抛错直接走 .catch，
        // 提示错写成“麦克风权限”，麦克风流还一直开着漏录
        try {
          noiseStream = stream;
          const AC = window.AudioContext || window.webkitAudioContext;
          if (typeof AC !== "function") throw new Error("no AudioContext");
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
        } catch (e) {
          noiseRunning = false;
          try { if (noiseCtx) noiseCtx.close(); } catch (_) {}
          noiseCtx = null;
          try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
          noiseStream = null;
          $("noiseBtn").textContent = "开始检测 🎙";
          $("noiseResult").textContent = "当前设备不支持音频处理，在手机上打开试试。";
        }
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
    function wnVolFactor() { // R25：音量滑杆 0–100 转 0–1；只有 NaN 才回落 0.6，0 就是静音（原来 `x/100 || 0.6` 把 0 也当没填）
      const v = parseInt($("wnVolume").value, 10);
      return Number.isNaN(v) ? 0.6 : v / 100;
    }
    // 每种音色的合成链：返回 { nodes:[...], gain }；level 是该音色的基准响度，真正的主增益 = level × 音量滑杆（R25：原来 wnBuild 直接写死 master 增益，滑杆白调）
    function wnBuild(sid, ctx) {
      const builtCrackle = {};
      let level = 0.5;
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
        level = 0.5;
      } else if (sid === "sea") {
        // 海浪：低通 500Hz + 0.12Hz 慢起伏
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
        src.connect(lp); connect(lp);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
        const lg = ctx.createGain(); lg.gain.value = 0.45;
        lfo.connect(lg); lg.connect(out.gain); lfo.start(); nodes.push(lfo); // R29：删掉重复的第 2 次 connect/start/push——同一个振荡器 start 两次真机抛 InvalidStateError，整个海浪声播不了（之前只有雨/风扇/篝火/白噪音能播）
        level = 0.6;
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
        level = 0.5;
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
        level = 0.45;
      } else {
        // 白噪音：直出
        connect(src);
        level = 0.32;
      }
      return { nodes, out, crackle: builtCrackle.crackle || null, level };
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
          master.connect(wnCtx.destination);
          const built = wnBuild(s.id, wnCtx);
          master.gain.value = built.level * wnVolFactor(); // R25：主增益 = 音色系数 × 滑杆（原来先按滑杆算、再被 wnBuild 写死覆盖）
          built.nodes.forEach((n) => { try { if (n.start && n !== built.out) n.start(); } catch (e) {} });
          try { built.out.connect(master); } catch (e) {}
          wnNodes = { nodes: built.nodes.concat([master]), gain: master, crackle: built.crackle, level: built.level };
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
      if (wnNodes && wnNodes.gain) wnNodes.gain.gain.value = (wnNodes.level || 0.5) * wnVolFactor(); // R25：原来拉滑杆一律按 0.5 算，海浪 0.6/白噪音 0.32 的音色系数被抹掉
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
        // R25：快照只存了画面没存笔数——撤销后画面回去了笔数还在，空白画布也能“保存成功”；清空后撤销也丢了笔数
        doodleHistory.push({ img: doodleCtx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height), strokes: doodleStrokes });
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
          const snap = doodleHistory.pop();
          doodleCtx.putImageData(snap.img, 0, 0);
          doodleStrokes = snap.strokes; // R25：撤销连笔数一起还原
          $("doodleResult").textContent = doodleStrokes === 0 ? "↩ 撤销了一步，画布是空的。" : "↩ 撤销了一步。";
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
    // v4.1：平滑插值移动 + 圆润蛇身 + 蛇头眼睛 + 呼吸食物
    let snakePrev = [], snakeLastStep = 0, snakeStepMs = 220, snakeRaf = null, snakeTurnQ = [];
    function snakeLoop() { snakeRaf = null; snakeDraw(); if (snakeState === "running") snakeRaf = requestAnimationFrame(snakeLoop); }
    function snakeKick() { if (!snakeRaf) snakeRaf = requestAnimationFrame(snakeLoop); }
    function snakeDraw() {
      if (!snakeCtx) return;
      const C = SNAKE_CELL, ctx = snakeCtx, now = performance.now();
      for (let y = 0; y < SNAKE_GRID; y++) for (let x = 0; x < SNAKE_GRID; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#12142a" : "#151833"; ctx.fillRect(x * C, y * C, C, C);
      }
      if (snakeFood) {
        const pulse = 1 + Math.sin(now / 180) * 0.08, fx = snakeFood.x * C + C / 2, fy = snakeFood.y * C + C / 2;
        ctx.shadowColor = "#ff6b6b"; ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff5c5c"; ctx.beginPath(); ctx.arc(fx, fy, C * 0.36 * pulse, 0, 7); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(fx - 3, fy - 3, 2.4, 0, 7); ctx.fill();
        ctx.strokeStyle = "#6bcf63"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy - C * 0.3); ctx.lineTo(fx + 3, fy - C * 0.48); ctx.stroke();
      }
      if (!snakeBody.length) return;
      const k = snakeState === "running" ? Math.max(0, Math.min(1, (now - snakeLastStep) / snakeStepMs)) : 1;
      const pts = snakeBody.map((s, i) => {
        const p = snakePrev[i] || snakePrev[snakePrev.length - 1] || s;
        // 穿墙不会发生（撞墙即死），直接线性插值
        return { x: (p.x + (s.x - p.x) * k) * C + C / 2, y: (p.y + (s.y - p.y) * k) * C + C / 2 };
      });
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = pts.length - 1; i > 0; i--) {
        const t = i / Math.max(1, pts.length - 1);
        ctx.strokeStyle = "hsl(" + (145 - t * 25) + ",62%," + (52 - t * 16) + "%)";
        ctx.lineWidth = C * (0.78 - t * 0.18);
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i - 1].x, pts[i - 1].y); ctx.stroke();
      }
      const h = pts[0], d = snakeDir;
      ctx.fillStyle = "#8cf5a8"; ctx.beginPath(); ctx.arc(h.x, h.y, C * 0.46, 0, 7); ctx.fill();
      const ex = -d.y, ey = d.x; // 眼睛分在前进方向两侧
      for (const sgn of [-1, 1]) {
        const cx = h.x + d.x * C * 0.14 + ex * sgn * C * 0.2, cy = h.y + d.y * C * 0.14 + ey * sgn * C * 0.2;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, C * 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(cx + d.x * 1.5, cy + d.y * 1.5, C * 0.07, 0, 7); ctx.fill();
      }
      if (snakeState === "over") { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 0, 320, 320); }
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
      snakePrev = []; snakeTurnQ = []; snakeStepMs = 220;
      snakeBody = [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }]; // R14：出生点左移，零操作撞墙从 1.2 秒放宽到 2.4 秒，新手有时间反应
      snakeDir = { x: 1, y: 0 }; snakeNextDir = null; snakeScore = 0; snakeFoodCount = 0;
      snakePlaceFood();
      snakeUpdateScore();
      snakeDraw();
    }
    function snakeUpdateScore() { $("snakeScore").textContent = "得分 " + snakeScore + " · 最高 " + Math.max(snakeBest(), snakeScore); }
    function snakeStep() {
      if (snakeTurnQ.length) snakeDir = snakeTurnQ.shift();
      snakePrev = snakeBody.map((p) => ({ x: p.x, y: p.y }));
      snakeLastStep = performance.now();
      const head = { x: snakeBody[0].x + snakeDir.x, y: snakeBody[0].y + snakeDir.y };
      // R26：头撞进尾巴当前格不算撞自己——尾巴本步会挪走；只有吃豆那步尾巴不动，才算撞
      const snakeWillEat = snakeFood && head.x === snakeFood.x && head.y === snakeFood.y;
      const snakeBodyToCheck = snakeWillEat ? snakeBody : snakeBody.slice(0, -1);
      if (head.x < 0 || head.y < 0 || head.x >= SNAKE_GRID || head.y >= SNAKE_GRID || snakeBodyToCheck.some((s) => s.x === head.x && s.y === head.y)) { snakeGameOver(); return; }
      snakeBody.unshift(head);
      if (snakeFood && head.x === snakeFood.x && head.y === snakeFood.y) {
        snakeScore++;
        SFX.pop(Math.min(1, snakeScore / 30));
        { const r = snakeCanvas.getBoundingClientRect(), sc = r.width / 320; const px = r.left + (head.x + 0.5) * SNAKE_CELL * sc, py = r.top + (head.y + 0.5) * SNAKE_CELL * sc;
          FX.sparkle(px, py, ["#ff6b6b", "#ffd43b", "#fff"], 12); FX.float("+1", px, py - 10, "#ffd43b"); FX.buzz(8); }
        snakeUpdateScore();
        snakePlaceFood();
        // R14：吃得越多越快，最快 80ms 一步；起步 220ms（原来 150ms，上手就死太快）
        if (snakeTimer) { clearInterval(snakeTimer); snakeStepMs = Math.max(80, 220 - snakeScore * 8); snakeTimer = setInterval(snakeStep, snakeStepMs); }
      } else {
        snakeBody.pop();
      }
      snakeDraw();
    }
    function snakeGameOver() {
      if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; }
      snakeState = "over";
      snakeDraw();
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
      snakeStepMs = Math.max(80, 220 - snakeScore * 8); snakeLastStep = performance.now();
      snakeTimer = setInterval(snakeStep, snakeStepMs); // R14：起步 220ms
      snakeKick();
      $("snakeStatus").textContent = "游戏中，吃红点长一节，别撞墙。";
      $("snakeStartBtn").textContent = "暂停 ⏸";
    }
    function snakePause() {
      if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; }
      if (snakeState === "running") { snakeState = "paused"; $("snakeStatus").textContent = "已暂停，点开始继续。"; $("snakeStartBtn").textContent = "继续 ▶"; }
    }
    $("snakeStartBtn").addEventListener("click", () => { if (snakeState === "running") snakePause(); else snakeStart(); });
    $("snakeRestartBtn").addEventListener("click", () => { if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = null; } snakeState = "idle"; snakeReset(); $("snakeStatus").textContent = "点开始，蛇就动起来。"; $("snakeStartBtn").textContent = "开始 ▶"; });
    // v4.1：转向排队（最多 2 步），快速连按“上、左”这种掉头操作不会丢
    function snakeTurn(dx, dy) {
      const last = snakeTurnQ.length ? snakeTurnQ[snakeTurnQ.length - 1] : snakeDir;
      if ((last.x === -dx && last.y === -dy) || (last.x === dx && last.y === dy)) return; // 不能直接掉头，同方向不重复排
      if (snakeTurnQ.length < 2) snakeTurnQ.push({ x: dx, y: dy });
    }
    $("snakeDirUp").addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); snakeTurn(0, -1); });
    $("snakeDirDown").addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); snakeTurn(0, 1); });
    $("snakeDirLeft").addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); snakeTurn(-1, 0); });
    $("snakeDirRight").addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); snakeTurn(1, 0); });
    if (document.addEventListener) {
      document.addEventListener("keydown", (e) => {
        if ($("toy-snake").classList.contains("hidden")) return;
        const k = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
        if (k) { snakeTurn(k[0], k[1]); if (e.preventDefault) e.preventDefault(); }
      });
    }
    // 手指在画布上滑动换方向
    let snakeSwipe = null;
    // v4.1：手指一动就转向（不用等抬手），一次按住可以连续拐弯
    snakeCanvas.addEventListener("pointerdown", (e) => { snakeSwipe = { x: e.clientX, y: e.clientY }; try { snakeCanvas.setPointerCapture(e.pointerId); } catch (er) {} });
    snakeCanvas.addEventListener("pointermove", (e) => {
      if (!snakeSwipe) return;
      const dx = e.clientX - snakeSwipe.x, dy = e.clientY - snakeSwipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) snakeTurn(dx > 0 ? 1 : -1, 0); else snakeTurn(0, dy > 0 ? 1 : -1);
      snakeSwipe = { x: e.clientX, y: e.clientY };
    });
    snakeCanvas.addEventListener("pointerup", () => { snakeSwipe = null; });
    snakeCanvas.addEventListener("pointercancel", () => { snakeSwipe = null; });
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
    // v4.1：方块带立体高光、落点预览（幽灵块）、消行闪白
    let tClearing = null; // { rows, t }
    function tCell(ctx, x, y, size, color, alpha) {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x + 1, y + 1, size - 2, 3); ctx.fillRect(x + 1, y + 1, 3, size - 2);
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(x + 1, y + size - 4, size - 2, 3); ctx.fillRect(x + size - 4, y + 1, 3, size - 2);
      ctx.globalAlpha = 1;
    }
    function tGhostY() { if (!tCur) return 0; let y = tCur.y; while (!tCollide(tCur.m, tCur.x, y + 1)) y++; return y; }
    function tDraw() {
      if (!tCtx) return;
      const W = T_COLS * T_CELL, H = T_ROWS * T_CELL;
      tCtx.fillStyle = "#0e0f1d"; tCtx.fillRect(0, 0, W, H);
      tCtx.strokeStyle = "rgba(255,255,255,.04)"; tCtx.lineWidth = 1;
      tCtx.beginPath();
      for (let c = 1; c < T_COLS; c++) { tCtx.moveTo(c * T_CELL + .5, 0); tCtx.lineTo(c * T_CELL + .5, H); }
      for (let r = 1; r < T_ROWS; r++) { tCtx.moveTo(0, r * T_CELL + .5); tCtx.lineTo(W, r * T_CELL + .5); }
      tCtx.stroke();
      for (let r = 0; r < T_ROWS; r++) for (let c = 0; c < T_COLS; c++) {
        if (tBoard[r][c]) tCell(tCtx, c * T_CELL, r * T_CELL, T_CELL, tBoard[r][c]);
      }
      if (tClearing) {
        const k = Math.min(1, (performance.now() - tClearing.t) / 200);
        for (const r of tClearing.rows) {
          tCtx.fillStyle = "rgba(255,255,255," + (0.9 * (1 - k)) + ")"; tCtx.fillRect(0, r * T_CELL, W, T_CELL);
          tCtx.fillStyle = "rgba(255,255,255,.95)"; tCtx.fillRect(W / 2 * k, r * T_CELL + T_CELL / 2 - 2, W * (1 - k), 4);
        }
      }
      if (tCur) {
        const gy = tGhostY();
        if (gy !== tCur.y) for (let r = 0; r < tCur.m.length; r++) for (let c = 0; c < tCur.m[r].length; c++) {
          if (!tCur.m[r][c]) continue;
          const x = (tCur.x + c) * T_CELL, y = (gy + r) * T_CELL;
          tCtx.strokeStyle = tCur.c; tCtx.globalAlpha = 0.55; tCtx.lineWidth = 2; tCtx.strokeRect(x + 2, y + 2, T_CELL - 4, T_CELL - 4);
          tCtx.globalAlpha = 0.12; tCtx.fillStyle = tCur.c; tCtx.fillRect(x + 2, y + 2, T_CELL - 4, T_CELL - 4); tCtx.globalAlpha = 1;
        }
        for (let r = 0; r < tCur.m.length; r++) for (let c = 0; c < tCur.m[r].length; c++) {
          if (tCur.m[r][c]) tCell(tCtx, (tCur.x + c) * T_CELL, (tCur.y + r) * T_CELL, T_CELL, tCur.c);
        }
      }
      if (tNextCtx && tNext) {
        tNextCtx.fillStyle = "#0e0f1d";
        tNextCtx.fillRect(0, 0, 96, 96);
        const w = tNext.m[0].length, h = tNext.m.length;
        const ox = Math.floor((96 - w * 20) / 2), oy = Math.floor((96 - h * 20) / 2);
        for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
          if (tNext.m[r][c]) tCell(tNextCtx, ox + c * 20, oy + r * 20, 20, tNext.c);
        }
      }
    }
    function tUpdateHud() {
      $("tetrisScore").textContent = "得分 " + tScore;
      $("tetrisLevel").textContent = "第 " + tLevel + " 关 · 已消 " + tLines + " 行";
      $("tetrisBest").textContent = "最高 " + Math.max(tBest(), tScore);
    }
    const T_NAMES = { 2: "双消！", 3: "三消！", 4: "四消 TETRIS！" };
    function tLock() {
      for (let r = 0; r < tCur.m.length; r++) for (let c = 0; c < tCur.m[r].length; c++) {
        if (tCur.m[r][c] && tCur.y + r >= 0) tBoard[tCur.y + r][tCur.x + c] = tCur.c;
      }
      const full = [];
      for (let r = 0; r < T_ROWS; r++) if (tBoard[r].every(Boolean)) full.push(r);
      tCur = null;
      if (!full.length) { SFX.click(); tSpawnNext(); return; }
      // 消行：先闪白 200ms，再落下
      tClearing = { rows: full, t: performance.now() };
      const rect = tCanvas.getBoundingClientRect(), sy = rect.height / T_ROWS;
      for (const r of full) FX.sparkle(rect.left + rect.width / 2, rect.top + (r + 0.5) * sy, null, 10);
      if (T_NAMES[full.length]) FX.float(T_NAMES[full.length], rect.left + rect.width / 2, rect.top + full[0] * sy, full.length >= 4 ? "#22d3ee" : "#ffe066");
      FX.buzz(full.length >= 4 ? [30, 30, 50] : 18);
      SFX.chime();
      const anim = () => { tDraw(); if (tClearing && performance.now() - tClearing.t < 200) requestAnimationFrame(anim); };
      requestAnimationFrame(anim);
      setTimeout(() => {
        for (const r of full.slice().reverse()) tBoard.splice(r, 1);
        for (let i = 0; i < full.length; i++) tBoard.unshift(new Array(T_COLS).fill(null));
        tClearing = null;
        tLines += full.length;
        tScore += (T_POINTS[full.length] || 100) * tLevel;
        const lv = Math.floor(tLines / 10) + 1;
        if (lv > tLevel) FX.floatAt($("tetrisLevel"), "升级 第 " + lv + " 关", "#69db7c");
        tLevel = lv;
        FX.pop($("tetrisScore"));
        if (tTimer) { clearInterval(tTimer); tTimer = setInterval(tTick, Math.max(100, 800 - (tLevel - 1) * 70)); }
        if (tState === "over" || tState === "idle") return;
        tSpawnNext();
      }, 200);
    }
    function tSpawnNext() {
      tCur = tNext; tNext = tNewPiece();
      if (tCollide(tCur.m, tCur.x, tCur.y)) { tGameOver(); return; }
      tUpdateHud(); tDraw();
    }
    // 落地后给 0.45 秒“锁定缓冲”，可以再左右挪一下或转一下（最多重置 8 次）
    function tTick() {
      if (!tCur) return;
      if (!tCollide(tCur.m, tCur.x, tCur.y + 1)) { tCur.y++; tCur.ground = 0; }
      else if (!tCur.ground) tCur.ground = performance.now();
      else if (performance.now() - tCur.ground >= 450) tLock();
      tDraw();
    }
    function tTouched() { if (tCur && tCur.ground && (tCur.resets = (tCur.resets || 0) + 1) <= 8) tCur.ground = performance.now(); }
    function tGameOver() {
      if (tTimer) { clearInterval(tTimer); tTimer = null; }
      tState = "over";
      tSaveBest(); tUpdateHud();
      SFX.lose();
      $("tetrisStatus").textContent = "💥 堆到顶了！得分 " + tScore + "，最高 " + Math.max(tBest(), tScore) + "。点开始再来一局。";
      $("tetrisStartBtn").textContent = "开始 ▶";
    }
    function tReset() {
      tClearing = null;
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
    function tMove(dx) { if (tCur && tState === "running" && !tCollide(tCur.m, tCur.x + dx, tCur.y)) { tCur.x += dx; tTouched(); tDraw(); } }
    function tRotate() {
      if (!tCur || tState !== "running") return;
      const m = tCur.m;
      const rot = [];
      for (let c = 0; c < m[0].length; c++) { const row = []; for (let r = m.length - 1; r >= 0; r--) row.push(m[r][c]); rot.push(row); }
      const kicks = [0, -1, 1, -2, 2];
      for (let i = 0; i < kicks.length; i++) {
        if (!tCollide(rot, tCur.x + kicks[i], tCur.y)) { tCur.m = rot; tCur.x += kicks[i]; tTouched(); tDraw(); return; }
      }
    }
    function tSoftDrop() { if (tCur && tState === "running") { if (!tCollide(tCur.m, tCur.x, tCur.y + 1)) { tCur.y++; tDraw(); } else tLock(); } }
    function tHardDrop() {
      if (!tCur || tState !== "running") return;
      const y0 = tCur.y;
      while (!tCollide(tCur.m, tCur.x, tCur.y + 1)) tCur.y++;
      tScore += (tCur.y - y0) * 2; // 硬降按格数给点小分
      if (tCur.y - y0 > 2) { const w = tCanvas.parentNode; w.classList.remove("t-thud"); void w.offsetWidth; w.classList.add("t-thud"); FX.buzz(12); }
      tLock(); tDraw();
    }
    $("tetrisStartBtn").addEventListener("click", () => { if (tState === "running") tPause(); else tStart(); });
    $("tetrisPauseBtn").addEventListener("click", tPause);
    // v4.0：◀ ▶ ▼ 按住连发（原来只能一下一下点）
    holdRepeat($("tetrisLeftBtn"), () => tMove(-1));
    holdRepeat($("tetrisRightBtn"), () => tMove(1));
    holdRepeat($("tetrisDownBtn"), tSoftDrop, 60);
    // v4.0：画布手势——左右拖动跟手移动，轻点旋转，快速下滑直接落底
    (function () {
      const cv = $("tetrisCanvas"); if (!cv) return;
      let sx = 0, sy = 0, lastCol = 0, t0 = 0, moved = false, active = false;
      cv.addEventListener("pointerdown", (e) => { e.preventDefault(); SFX.unlock(); active = true; sx = e.clientX; sy = e.clientY; lastCol = 0; t0 = Date.now(); moved = false; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
      cv.addEventListener("pointermove", (e) => {
        if (!active || tState !== "running") return;
        const cell = cv.getBoundingClientRect().width / 10;
        const col = Math.round((e.clientX - sx) / cell);
        while (col > lastCol) { tMove(1); lastCol++; moved = true; }
        while (col < lastCol) { tMove(-1); lastCol--; moved = true; }
      });
      cv.addEventListener("pointerup", (e) => {
        if (!active) return; active = false;
        const dy = e.clientY - sy, dx = e.clientX - sx, dt = Date.now() - t0;
        if (tState !== "running") { if (Math.hypot(dx, dy) < 10) $("tetrisStartBtn").click(); return; }
        if (dy > 60 && dy > Math.abs(dx) * 1.5 && dt < 400) { tHardDrop(); return; }
        if (!moved && Math.hypot(dx, dy) < 12) tRotate();
      });
      cv.addEventListener("pointercancel", () => { active = false; });
    })();
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
    // v4.1：方块有身份——移动时滑过去、合并时弹一下、新块缩放出现（原来每步整盘重建，方块是瞬移的）
    let tileEls = new Array(16).fill(null), animTimer = null, pendingCommit = null;
    function g2048Grid() {
      const grid = $("g2048Grid");
      if (!grid.querySelector(".g2048-bg")) {
        grid.innerHTML = "";
        for (let i = 0; i < 16; i++) { const b = document.createElement("div"); b.className = "g2048-bg"; grid.appendChild(b); }
      }
      return grid;
    }
    function styleTile(el, v) {
      el.textContent = v;
      el.className = "g2048-tile" + (v >= 1024 ? " huge" : v >= 128 ? " big" : "") + (v >= 128 ? " glow" : "");
      el.style.background = G2048_COLORS[v] || "#3c3a32";
      el.style.color = v <= 4 ? "#776e65" : "#f9f6f2";
    }
    function place(el, i) { el.style.setProperty("--r", Math.floor(i / 4)); el.style.setProperty("--c", i % 4); }
    function makeTile(i, v, cls) {
      const el = document.createElement("div");
      styleTile(el, v); place(el, i);
      if (cls) el.classList.add(cls);
      g2048Grid().appendChild(el);
      return el;
    }
    function g2048Spawn() {
      const empty = [];
      for (let i = 0; i < 16; i++) if (!g2048[i]) empty.push(i);
      if (empty.length === 0) return -1;
      const i = empty[Math.floor(Math.random() * empty.length)];
      g2048[i] = Math.random() < 0.9 ? 2 : 4;
      return i;
    }
    function g2048New() {
      finishAnim();
      g2048 = new Array(16).fill(0); gScore = 0; gOver = false; gWon = false;
      g2048Spawn(); g2048Spawn();
      g2048Render(true);
      $("g2048Status").textContent = "滑动开始合并。";
    }
    // 整盘重建（开局/外部摆盘用）
    function g2048Render(spawnAnim) {
      const grid = g2048Grid();
      grid.querySelectorAll(".g2048-tile").forEach((el) => el.remove());
      tileEls = new Array(16).fill(null);
      for (let i = 0; i < 16; i++) if (g2048[i]) tileEls[i] = makeTile(i, g2048[i], spawnAnim ? "spawn" : "");
      renderScore();
    }
    function renderScore() { $("g2048Score").textContent = "得分 " + gScore + " · 最高 " + Math.max(g2048Best(), gScore); }
    function finishAnim() { if (animTimer) { clearTimeout(animTimer); animTimer = null; } if (pendingCommit) { const f = pendingCommit; pendingCommit = null; f(); } }
    function g2048SlideLine(line) {
      // 返回新行、得分，以及每个原位置去了哪里、是否被合并掉
      const out = [0, 0, 0, 0], moves = [], merged = [];
      let w = 0, lastIdx = -1, gained = 0;
      for (let k = 0; k < 4; k++) {
        if (!line[k]) continue;
        if (lastIdx >= 0 && out[w - 1] === line[k] && !merged[w - 1]) {
          out[w - 1] *= 2; gained += out[w - 1]; merged[w - 1] = true;
          moves.push({ from: k, to: w - 1, die: true });
        } else {
          out[w] = line[k]; moves.push({ from: k, to: w, die: false }); lastIdx = k; w++;
        }
      }
      return { line: out, gained, moves, merged };
    }
    function g2048Move(dir) {
      if (gOver) return;
      finishAnim();
      const before = g2048.join(",");
      let gained = 0;
      const lines = [];
      for (let a = 0; a < 4; a++) {
        const cells = [0, 1, 2, 3].map((k) => {
          if (dir === "left") return a * 4 + k;
          if (dir === "right") return a * 4 + (3 - k);
          if (dir === "up") return k * 4 + a;
          return (3 - k) * 4 + a;
        });
        lines.push(cells);
      }
      const next = new Array(16).fill(0), newEls = new Array(16).fill(null), dying = [], bumped = [];
      for (const cells of lines) {
        const res = g2048SlideLine(cells.map((i) => g2048[i]));
        gained += res.gained;
        res.line.forEach((v, k) => { next[cells[k]] = v; });
        for (const m of res.moves) {
          const el = tileEls[cells[m.from]], to = cells[m.to];
          if (!el) continue;
          place(el, to);
          if (m.die) { dying.push(el); el.style.zIndex = 1; }
          else newEls[to] = el;
        }
        res.merged.forEach((mm, k) => { if (mm) bumped.push(cells[k]); });
      }
      if (next.join(",") === before) { FX.shake($("g2048Grid")); return; } // 这个方向走不动：轻轻抖一下
      g2048 = next; tileEls = newEls;
      gScore += gained;
      const spawnAt = g2048Spawn();
      SFX.click && gained === 0 && SFX._tone(320, 0.05, "sine", 0.05);
      pendingCommit = () => {
        dying.forEach((el) => el.remove());
        for (const i of bumped) { const el = tileEls[i]; if (el) { styleTile(el, g2048[i]); place(el, i); el.classList.add("merged"); } }
        if (spawnAt >= 0) tileEls[spawnAt] = makeTile(spawnAt, g2048[spawnAt], "spawn");
        renderScore();
      };
      animTimer = setTimeout(() => { animTimer = null; finishAnim(); }, 110);
      if (gained > 0) {
        const mx = Math.max.apply(null, g2048); SFX.pop(Math.min(1, Math.log2(mx) / 11));
        FX.floatAt($("g2048Score"), "+" + gained, mx >= 128 ? "#ffd43b" : "#fff");
        if (mx >= 256 && bumped.some((i) => g2048[i] === mx)) FX.buzz(20);
      }
      g2048SaveBest();
      if (!gWon && g2048.some((v) => v >= 2048)) { gWon = true; SFX.win(); $("g2048Status").textContent = "🎉 拼出 2048 了！太强了，还能继续往上拼。"; }
      else if (g2048CanMove()) { if (!gWon) $("g2048Status").textContent = "继续，拼出更大的数。"; }
      else { gOver = true; setTimeout(() => SFX.lose(), 200); $("g2048Status").textContent = "💥 拼不动了！得分 " + gScore + "，最高 " + Math.max(g2048Best(), gScore) + "。点重开再来。"; }
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
        get g2048() { finishAnim(); return { board: g2048.slice(), score: gScore, over: gOver, won: gWon }; },
        g2048Set(board) { finishAnim(); g2048 = board.slice(); gOver = false; gWon = false; g2048Render(); }, // R22：摆新盘要清终局/获胜旗，不然终局后摆盘再动会被拦住
        g2048Move(dir) { g2048Move(dir); },
    }));

  };
  /* ---------- 43. 扫雷 ---------- */
  toyInitFns["mines"] = function () {
    const M_ROWS = 9, M_COLS = 9, M_MINES = 10;
    let mCells = [], mStarted = false, mOver = false, mFlagMode = false, mTimer = null, mSeconds = 0;
    let mSuppressCtx = false, mSuppressClick = false; // R21：同大扫雷 R19——安卓长按会同时触发 450ms 计时插旗 + contextmenu；计时插旗后要压住一次 contextmenu，抬指后的 click 也要压一次，不然旗刚插上就被拔掉、格子还被点开
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
    // v4.1：新翻开的格子按离点击处的距离依次弹出（波纹扩散）；插旗弹一下
    let mWasOpen = [], mWasFlag = [], mOrigin = -1;
    function mRender() {
      const grid = $("minesGrid");
      grid.innerHTML = "";
      let flags = 0;
      const or = mOrigin >= 0 ? Math.floor(mOrigin / M_COLS) : 0, oc = mOrigin >= 0 ? mOrigin % M_COLS : 0;
      mCells.forEach((cell, i) => {
        if (cell.flagged) flags++;
        const btn = document.createElement("button");
        btn.className = "mines-cell" + (cell.revealed ? " open" : "") + (cell.flagged ? " flagged" : "");
        if (cell.revealed && !mWasOpen[i] && mOrigin >= 0) {
          const d = Math.max(Math.abs(Math.floor(i / M_COLS) - or), Math.abs(i % M_COLS - oc));
          btn.classList.add(cell.mine ? "boom" : "reveal"); btn.style.animationDelay = Math.min(d * 28, 400) + "ms";
        }
        if (cell.flagged && !mWasFlag[i]) btn.classList.add("flag-in");
        btn.setAttribute("aria-label", "扫雷格子 " + (Math.floor(i / M_COLS) + 1) + " 行 " + (i % M_COLS + 1) + " 列");
        if (cell.revealed) {
          if (cell.mine) btn.textContent = "💣";
          else if (cell.count > 0) { btn.textContent = cell.count; btn.classList.add("n" + cell.count); }
        } else if (cell.flagged) btn.textContent = "🚩";
        btn.addEventListener("click", () => { if (mSuppressClick) { mSuppressClick = false; return; } mClick(i, false); }); // R21：长按刚结束的这次 click 是同一按压的尾巴，吞掉（格子重建后 click 落到新格子上，per-cell 标记拦不住，必须用共享标记，同大扫雷 R19）
        btn.addEventListener("contextmenu", (e) => { if (e.preventDefault) e.preventDefault(); if (mSuppressCtx) return; mClick(i, true); }); // R21：长按计时刚插过旗时，这次 contextmenu 是同一按压的重复触发，吞掉，不然旗刚插上立刻又被拔掉
        let pressTimer = null;
        btn.addEventListener("pointerdown", (e) => { mSuppressClick = false; mSuppressCtx = false; if (e && e.button !== undefined && e.button !== 0) return; pressTimer = setTimeout(() => { mClick(i, true); mSuppressCtx = true; mSuppressClick = true; pressTimer = null; }, 450); }); // R21：右键不进长按计时，不然按住右键 450ms 会多插一次旗再取消；新一按先清掉上一按残留的压制（浏览器没发 click 时它会一直留着）
        btn.addEventListener("pointerup", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } mSuppressCtx = false; }); // R21：contextmenu 的压制抬指即清；click 压制留到 click 消费或下一按清掉（timer 里已置位，不依赖 pointerup 落在哪个格子上）
        btn.addEventListener("pointerleave", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }); // R21：手指滑出格子只清计时，不清 contextmenu 压制——contextmenu 在长按后才发，滑出时清掉会让它漏进来
        btn.addEventListener("pointercancel", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }); // 系统手势打断长按也要清计时，不然手指都走了还会插旗
        grid.appendChild(btn);
      });
      mWasOpen = mCells.map((c) => c.revealed); mWasFlag = mCells.map((c) => c.flagged);
      $("minesLeft").textContent = "💣 剩 " + (M_MINES - flags) + " 颗雷";
    }
    function mStartTimer() {
      if (mTimer) return;
      mTimer = setInterval(() => { mSeconds++; $("minesTime").textContent = "⏱ " + mSeconds + " 秒"; }, 1000);
    }
    function mStopTimer() { if (mTimer) { clearInterval(mTimer); mTimer = null; } }
    function mFlagCount() { return mCells.filter((c) => c.flagged).length; }
    // R26：旗只有 10 面（等于雷数），插满就不再插，不然“剩 -1 颗雷”；两处插旗入口（右键/长按、插旗模式）共用
    function mToggleFlag(i) {
      const cell = mCells[i];
      if (cell.revealed) return false;
      if (!cell.flagged && mFlagCount() >= M_MINES) { $("minesStatus").textContent = "🚩 旗插满了（共 " + M_MINES + " 面），先拔掉一面再插。"; return false; }
      cell.flagged = !cell.flagged;
      if ($("minesStatus").textContent.includes("旗插满了")) $("minesStatus").textContent = "🚩 剩 " + (M_MINES - mFlagCount()) + " 颗雷没找到。";
      return true;
    }
    function mClick(i, flag) {
      mOrigin = i;
      if (mOver) return;
      const cell = mCells[i];
      if (flag) {
        if (mToggleFlag(i)) mRender();
        return;
      }
      if (mFlagMode) { if (mToggleFlag(i)) mRender(); return; }
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
    let schClearArmed = false; // R23：清空全部也要两点确认（同删单门课；原来一点就清空整张表）
    try { schCourses = JSON.parse(localStorage.getItem(SCH_KEY) || "[]") || []; } catch (e) { schCourses = []; }
    function schSave() { try { localStorage.setItem(SCH_KEY, JSON.stringify(schCourses)); } catch (e) { /* 忽略 */ } }
    function schRender() {
      schPendingDelete = null; schPendingCell = null; schClearArmed = false;
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
            schClearArmed = false; // 点格子取消清空武装
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
    $("schClearBtn").addEventListener("click", () => {
      if (!schClearArmed) {
        schClearArmed = true;
        $("schResult").textContent = "再点一次清空全部 " + schCourses.length + " 门课，点别处取消。";
        return;
      }
      schClearArmed = false;
      schCourses = []; schSave(); schRender(); $("schResult").textContent = "课程表已清空。";
    });
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
      // v4.0：触屏格子只有 22px，先点出预览、再点同一格才落子；鼠标直接落子
      b.addEventListener("pointerup", (e) => { gLastPointer = e.pointerType || "mouse"; });
      b.addEventListener("click", () => {
        if (gLastPointer === "touch" || gLastPointer === "pen") {
          if (gPending !== i) { if (gWinner === 0 && gBoard[i] === 0 && !(gMode === "solo" && gTurn !== 1)) { gPending = i; gomokuRender(); } return; }
        }
        gPending = -1; gomokuPlace(i);
      });
      gomokuBoardEl.appendChild(b);
      gomokuCells.push(b);
    }
    let gPending = -1, gLastPointer = "mouse", gDropShown = -1;
    function gomokuRender() {
      gomokuCells.forEach((cell, i) => {
        cell.innerHTML = "";
        if (i === gPending && gBoard[i] === 0 && gWinner === 0) {
          const g = document.createElement("span");
          g.className = "gomoku-stone ghost " + (gTurn === 1 ? "black" : "white");
          cell.appendChild(g);
        }
        if (gBoard[i] !== 0) {
          const s = document.createElement("span");
          s.className = "gomoku-stone " + (gBoard[i] === 1 ? "black" : "white") + (i === gLast ? " last" : "") + (i === gLast && gLast !== gDropShown ? " drop" : "");
          cell.appendChild(s);
        }
      });
      gDropShown = gLast;
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
        $("gomokuResult").textContent = gTurn === 1 ? (gPending >= 0 ? "再点一次虚影确认落子。" : "轮到你落子（黑）。") : "电脑思考中……";
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
    // v4.0：五元组窗口评分——每个经过该点的 5 格窗口里只有一种颜色时按子数计分，攻防相加
    const G_WIN = [0, 2, 25, 400, 9000, 2000000];
    function gWindowScore(idx, color) {
      const N = GOMOKU_SIZE, r0 = Math.floor(idx / N), c0 = idx % N, opp = color === 1 ? 2 : 1;
      let total = 0, fours = 0, threes = 0;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let dirBest = 0;
        for (let off = -4; off <= 0; off++) {
          let mine = 0, ok = true;
          for (let k = 0; k < 5; k++) {
            const r = r0 + dr * (off + k), c = c0 + dc * (off + k);
            if (r < 0 || r >= N || c < 0 || c >= N) { ok = false; break; }
            const v = r === r0 && c === c0 ? color : gBoard[r * N + c];
            if (v === opp) { ok = false; break; }
            if (v === color) mine++;
          }
          if (ok) { total += G_WIN[mine]; if (mine > dirBest) dirBest = mine; }
        }
        if (dirBest >= 4) fours++; else if (dirBest === 3) threes++;
      }
      // 双四、四三、双三这种组合棋额外加权
      if (fours >= 2 || (fours && threes)) total += 60000;
      else if (threes >= 2) total += 6000;
      return total;
    }
    function gomokuScoreCell(idx) {
      const atk = gWindowScore(idx, 2), def = gWindowScore(idx, 1);
      return atk + def * 0.9 + Math.random() * 3;
    }
    function gomokuAiMove() {
      if (gWinner !== 0 || gTurn !== 2) return;
      const N = GOMOKU_SIZE;
      let bestIdx = -1, bestScore = -1;
      const any = gBoard.some((v) => v !== 0);
      for (let i = 0; i < gBoard.length; i++) {
        if (gBoard[i] !== 0) continue;
        if (any) {
          // 只看已有棋子两格以内的点
          const r = Math.floor(i / N), c = i % N; let near = false;
          for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < N && cc >= 0 && cc < N && gBoard[rr * N + cc] !== 0) { near = true; break; }
          }
          if (!near) continue;
        } else if (i !== Math.floor(N / 2) * N + Math.floor(N / 2)) continue;
        const s = gomokuScoreCell(i);
        if (s > bestScore) { bestScore = s; bestIdx = i; }
      }
      if (bestIdx === -1) { gWinner = 3; gomokuRender(); return; }
      gBoard[bestIdx] = 2;
      gLast = bestIdx;
      gMoves++;
      SFX.click();
      if (gomokuLineLen(bestIdx, 2) >= 5) { gWinner = 2; if (gMode === "duo") SFX.win(); else SFX.lose(); }
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
      gPending = -1;
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
          pianoPlay(note, true); // R24：示范曲不录进用户录音（原来录音开着时点小星星，14 个音全录进去，回放就串了）
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
    toyLeaveCleanup.piano = () => { pianoStopSong(); pianoRecording = false; if (recBtn) { recBtn.textContent = "⏺ 录音"; recBtn.classList.remove("active"); } }; // R24：切走只停录音不复位按钮，回来按钮还写着“停止录音”却已不在录（点它反而是开始新录音）
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
      ["######", "#. #.#", "#  # #", "# $$ #", "# @  #", "######"],
      ["#######", "# #   #", "#@$  .#", "# $#  #", "##   .#", "#######"],
      ["#######", "#   # #", "#   $@#", "#  #$ #", "#..  ##", "#######"],
      ["#######", "#     #", "#   $ #", "#  ## #", "##**  #", "#.@ # #", "#######"],
      ["#######", "##    #", "#@$   #", "#  #  #", "# $#  #", "## .. #", "#######"],
      ["########", "# .   .#", "# ## $ #", "### #  #", "#@$   ##", "# $  . #", "########"],
      ["########", "#  # . #", "# .    #", "#   #$ #", "# # #  #", "#$## $ #", "#+#    #", "########"],
      ["########", "#  .. ##", "#  # $ #", "#  ##  #", "## $+$ #", "#      #", "########"],
      ["#########", "#   #   #", "# $  $  #", "# .$ # ##", "#    #. #", "# ## # ##", "#. #  $+#", "#########"],
      ["########", "#   ## #", "#  $@$ #", "#   $  #", "#  # # #", "#    . #", "#.#  . #", "########"],
      ["########", "###    #", "#@$ .  #", "# $ # .#", "# $ #$ #", "# #  ..#", "# #    #", "########"],
      ["#########", "#   #  .#", "##  $ # #", "# $ #   #", "#+$     #", "#.# $  ##", "#. ##   #", "#########"],
    ];
    let sokobanLevel = 0, sokobanW = 0, sokobanH = 0;
    let sokobanWalls = null, sokobanTargets = null, sokobanBoxes = [], sokobanPlayer = null;
    let sokobanMoves = 0, sokobanWon = false;
    let sokobanHistory = []; // v3.0-r15：悔棋栈。箱子推到墙角会卡死，以前只能重开本关
    const SOKO_KEY = "dorm-toybox-sokoban-unlock-v1";
    let sokobanUnlocked = Math.max(2, parseInt(lsGet(SOKO_KEY, "2"), 10) || 2);
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
      // v4.0：15 关，上一关/下一关导航，记住解锁进度
      if ($("sokobanLevelLabel")) $("sokobanLevelLabel").textContent = "第 " + (level + 1) + " / " + SOKOBAN_LEVELS.length + " 关";
      if ($("sokobanPrevBtn")) $("sokobanPrevBtn").disabled = level <= 0;
      if ($("sokobanNextBtn")) $("sokobanNextBtn").disabled = level >= SOKOBAN_LEVELS.length - 1 || level >= sokobanUnlocked;
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
        if (sokobanLevel + 1 > sokobanUnlocked) { sokobanUnlocked = sokobanLevel + 1; lsSet(SOKO_KEY, String(sokobanUnlocked)); }
        $("sokobanStatus").textContent = "🎉 第 " + (sokobanLevel + 1) + " 关通过！用了 " + sokobanMoves + " 步。"
          + (sokobanLevel < SOKOBAN_LEVELS.length - 1 ? " 点「下一关」继续。" : " 全部通关，你是推箱子大师！");
        if ($("sokobanNextBtn")) $("sokobanNextBtn").disabled = sokobanLevel >= SOKOBAN_LEVELS.length - 1;
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
    $("sokobanPrevBtn").addEventListener("click", () => { if (sokobanLevel > 0) sokobanLoad(sokobanLevel - 1); });
    $("sokobanNextBtn").addEventListener("click", () => { if (sokobanLevel < SOKOBAN_LEVELS.length - 1) sokobanLoad(sokobanLevel + 1); });
    document.querySelectorAll("#sokobanPad [data-dir]").forEach((b) => b.addEventListener("click", () => sokobanMove(b.getAttribute("data-dir"))));
    $("sokobanResetBtn").addEventListener("click", () => sokobanLoad(sokobanLevel));
    $("sokobanUndoBtn").addEventListener("click", sokobanUndo);
    sokobanLoad(lsGet(SOKO_KEY, null) === null ? 0 : Math.min(sokobanUnlocked, SOKOBAN_LEVELS.length - 1));
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
    let breakoutBricks = [], breakoutBall = null, breakoutPaddleX = 140, breakoutTrail = null;
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
      breakoutBall = { x: 170, y: 260, dx: 2.2, dy: -2.6, r: 6 }; breakoutTrail = [];
      breakoutPaddleX = 140;
      breakoutScore = 0; breakoutLives = 3; breakoutRunning = false;
      if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
      breakoutRender();
      $("breakoutScore").textContent = "得分 0 · 砖块 18 · 命 3";
      $("breakoutStatus").textContent = "点开始，小球就出发。";
    }
    function breakoutRender() {
      if (!breakoutCtx) return;
      const ctx = breakoutCtx, ROWC = ["#f472b6", "#a78bfa", "#60a5fa", "#34d399"];
      PAINT.bg(ctx, BREAKOUT_W, BREAKOUT_H);
      breakoutBricks.forEach((b, i) => { if (b.alive) PAINT.brick(ctx, b.x, b.y, b.w, b.h, ROWC[Math.floor(i / BREAKOUT_COLS) % ROWC.length]); });
      PAINT.paddle(ctx, breakoutPaddleX, BREAKOUT_H - 14, 60, 10);
      PAINT.ball(ctx, breakoutBall, breakoutRunning ? (breakoutTrail = breakoutTrail || []) : null);
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
        b.dx = Math.max(-4, Math.min(4, b.dx)); // R21：边缘连打会把横向速度越刷越快（30 次到 11+，球横着飞没法接）；夹到 ±4
        b.y = BREAKOUT_H - 14 - b.r;
      }
      // 砖块
      for (const br of breakoutBricks) {
        if (!br.alive) continue;
        if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
          br.alive = false;
          breakoutScore += 10;
          cvFX("breakoutCanvas", br.x + br.w / 2, br.y + br.h / 2, ["#4f7cff", "#9ab4ff", "#fff"], 10);
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
        FX.fail($("breakoutCanvas"));
        if (breakoutLives <= 0) {
          breakoutRunning = false;
          if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
          SFX.lose();
          $("breakoutStatus").textContent = "💔 没命了。得分 " + breakoutScore + "，点重开再来。";
        } else {
          breakoutBall = { x: 170, y: 260, dx: 2.2, dy: -2.6, r: 6 }; breakoutTrail = [];
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
    // v4.2：相对拖动，挡板不跳到手指下
    relDrag(breakoutCanvas, () => ({ x: breakoutPaddleX, y: 0 }), (x, y, abs) => { breakoutPaddleX = Math.max(0, Math.min(BREAKOUT_W - 60, abs ? x - 30 : x)); breakoutRender(); }, { lw: BREAKOUT_W, lh: BREAKOUT_H, hoverAbs: true });
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
      popNew(grid);
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
    // v4.0：同时记下路径，消除时把连线画出来（原来连线画布从没用上，消得莫名其妙）
    function linkupPath(a, b) {
      if (a === b || !linkupBoard[a] || !linkupBoard[b] || linkupBoard[a] !== linkupBoard[b]) return null;
      const pa = linkupPos(a), pb = linkupPos(b);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const seen = new Map();
      const q = [{ x: pa.x, y: pa.y, dir: -1, turns: 0, prev: null }];
      while (q.length) {
        const node = q.shift();
        for (let d = 0; d < 4; d++) {
          const nt = node.dir === -1 || node.dir === d ? node.turns : node.turns + 1;
          if (nt > 2) continue;
          const nx = node.x + dirs[d][0], ny = node.y + dirs[d][1];
          if (nx === pb.x && ny === pb.y) {
            const pts = [[nx, ny]]; let n = node; while (n) { pts.unshift([n.x, n.y]); n = n.prev; }
            return pts;
          }
          if (linkupCellAt(nx, ny) !== "") continue;
          const key = nx + "," + ny + "," + d;
          if ((seen.get(key) || 99) <= nt) continue;
          seen.set(key, nt);
          q.push({ x: nx, y: ny, dir: d, turns: nt, prev: node });
        }
      }
      return null;
    }
    function linkupCanConnect(a, b) { return !!linkupPath(a, b); }
    function linkupDrawPath(pts) {
      const wrap = $("linkupWrap"), grid = $("linkupGrid"); if (!wrap || !grid || !pts) return;
      const c0 = grid.children[0], c1 = grid.children[1], cR = grid.children[LINKUP_COLS];
      if (!c0 || !c1 || !cR) return;
      const wr = wrap.getBoundingClientRect(), r0 = c0.getBoundingClientRect();
      const px = c1.getBoundingClientRect().left - r0.left, py = cR.getBoundingClientRect().top - r0.top;
      const X = (x) => r0.left - wr.left + r0.width / 2 + (x - 1) * px, Y = (y) => r0.top - wr.top + r0.height / 2 + (y - 1) * py;
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "linkup-svg"); svg.setAttribute("width", wr.width); svg.setAttribute("height", wr.height);
      const pl = document.createElementNS(ns, "polyline");
      pl.setAttribute("points", pts.map(([x, y]) => X(x) + "," + Y(y)).join(" "));
      svg.appendChild(pl); wrap.appendChild(svg);
      setTimeout(() => svg.remove(), 380);
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
      const path = linkupPath(linkupPicked, i);
      if (path) {
        linkupDrawPath(path);
        if (SFX.enabled) SFX.pop(0.6);
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
        if (linkupBoard[linkupPicked] === linkupBoard[i]) $("linkupStatus").textContent = "这两个连不上：中间的路要拐超过 2 个弯。";
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
    function slide15Render() { flipAnimate($("slide15Grid"), slide15RenderNow); }
    function slide15RenderNow() {
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
    let jumpScore = 0, jumpPower = 0, jumpOver = false, jumpCharging = false, jumpChargeId = null, jumpBusy = false, jumpShiftId = null; // R26：jumpShiftId——落地 350ms 位移定时器，重开要清掉（见 jumpReset）
    let jumpPlatA = { x: 20, w: 60 }, jumpPlatB = { x: 180, w: 56 }, jumpCharX = 34;
    function jumpNewPlatB() {
      // v4.0：按舞台实际宽度出台子（手机上舞台只有 ~330px，原来按 340 算，最右边的台子会被切掉一截）
      const st = $("jumpStage"), W = Math.min(JUMP_W, (st && st.clientWidth) || JUMP_W);
      const w = 40 + Math.floor(Math.random() * 31);
      const x = 120 + Math.floor(Math.random() * Math.max(1, W - 16 - w - 120));
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
      if (jumpShiftId) { clearTimeout(jumpShiftId); jumpShiftId = null; } // R26：落地后立刻重开，陈旧的 350ms 位移不能再改写新局
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
          SFX.chime();
          jumpPerfect(ch); // v1.32：Perfect! 飘字
        } else { SFX.pop(0.4); }
        $("jumpStatus").textContent = isCenter ? "🎯 正中心！+2 分！" : "稳稳落下，+1 分。";
        // 场景左移：落脚的台子变成起点，再生成下一个；左移完成前不接受新的蓄力，
        // 不然能在 350ms 的窗口里对着同一个台子再跳一次刷分
        jumpBusy = true;
        jumpShiftId = setTimeout(() => { // R26：记下 id，重开时清掉
          jumpShiftId = null;
          if (jumpOver) return;
          jumpPlatA = { x: 20, w: jumpPlatB.w };
          jumpCharX = 20 + Math.floor((jumpPlatA.w - 32) / 2);
          jumpPlatB = jumpNewPlatB();
          jumpRender();
          jumpBusy = false;
        }, 350);
      } else {
        jumpOver = true; jumpOverAt = Date.now();
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
    let jumpOverAt = 0;
    jumpStageEl.addEventListener("pointerdown", (e) => {
      if (jumpOver) { if (Date.now() - jumpOverAt > 500) jumpReset(); return; } // v4.0：提示写着“点再来一局”，原来点了没反应
      if (jumpBusy) return;
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
        setTimeout(() => { spotdiffLock = false; if (spotdiffRunning) spotdiffNewRound(); }, 450); // R28a：时间到后别进新关（会冲掉"时间到"文案，棋盘看着能点实际已停）
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
    // v4.2：相对拖动
    relDrag($("catchStage"), () => ({ x: catchBasketX, y: 0 }), (x, y, abs) => { catchBasketX = Math.max(0, Math.min(CATCH_W - 48, abs ? x - 24 : x)); $("catchBasket").style.left = catchBasketX + "px"; }, { lw: CATCH_W, lh: 300, hoverAbs: true });
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
      // 干扰项：链 + 扩展库里不以 need 开头的成语（R22：扩展库原来定义了却没人用，选项更多样）
      const distract = IDIOM_CHAIN.concat(IDIOM_EXTRA).filter((w) => w !== correct && w.charAt(0) !== need);
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
    $("idiomStartBtn").addEventListener("click", () => idiomStart(idiomMode)); // R20：开始按已选模式开局，之前写死 solo，点了 AI 对战再点开始又变回单人
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
    // R19：只建一次格子、之后原地改 class。原来每走一拍就 innerHTML 重建 36 个格子，
    // 播放中点格子可能正好点在被换掉的旧节点上（点按丢）、焦点也丢。
    let drumsBuilt = false;
    function drumsRender() {
      const grid = $("drumsGrid");
      if (!drumsBuilt) {
        grid.innerHTML = "";
        // R28：行标签（🥁/👏/🎩/🪘）移到图例，网格只剩 8 列格子，才能放大到 41×44px；
        // 原来 52px 标签列 + 340px 上限，格子只有 31px，手机上总点错
        DRUM_TRACKS.forEach((tr, t) => {
          for (let s = 0; s < 8; s++) {
            const cell = document.createElement("button");
            cell.className = "drums-cell";
            cell.setAttribute("aria-label", tr.name + " 第 " + (s + 1) + " 拍");
            cell.addEventListener("click", () => { drumsGrid[t][s] = !drumsGrid[t][s]; drumsRender(); });
            drumsCellBtns[t + "-" + s] = cell;
            grid.appendChild(cell);
          }
        });
        drumsBuilt = true;
      }
      DRUM_TRACKS.forEach((tr, t) => {
        for (let s = 0; s < 8; s++) {
          drumsCellBtns[t + "-" + s].className = "drums-cell" + (drumsGrid[t][s] ? " on" : "") + (drumsPlaying && s === drumsStep ? " now" : "");
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
    toyLeaveCleanup.drums = () => { drumsStop(); }; // R19：原来没有离场清理，切走玩具后鼓点还一直响、计时器一直跑
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
    function stroopTick() { // R23：抽出来复用（离场停表、回场续上）；原来是 stroopStart 里的匿名回调
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
    }
    function stroopStart() {
      if (stroopRunning) return;
      // R18：上一局时间到了之后点开始要重开新局（原来时间还是 0，第一次 tick 就立刻结束，开始按钮点了等于没点）
      if (stroopTime <= 0) { stroopScore = 0; stroopCombo = 0; stroopTime = STROOP_TIME; stroopNewRound(); }
      stroopRunning = true;
      if (stroopTimerId) clearInterval(stroopTimerId);
      stroopTimerId = setInterval(stroopTick, 1000);
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
    // R23：切走停表、回来续上；原来没有离场清理，切走后 60 秒在后台偷跑，回来可能已结束
    toyLeaveCleanup.stroop = () => { if (stroopTimerId) { clearInterval(stroopTimerId); stroopTimerId = null; } };
    toyEnterResume.stroop = () => { if (stroopRunning && stroopTime > 0 && !stroopTimerId) stroopTimerId = setInterval(stroopTick, 1000); };
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
      { q: "什么东西越洗越脏？", options: ["手", "水", "衣服"], answer: 1, cat: "经典", hint: "洗东西离不开它" },
      { q: "什么东西能装下全世界，却装不下一粒沙？", options: ["箱子", "眼睛", "袋子"], answer: 1, cat: "经典", hint: "它长在你脸上" },
      { q: "什么东西越长越短？", options: ["头发", "绳子", "蜡烛"], answer: 2, cat: "经典", hint: "点燃了就会变短" },
      { q: "什么东西不用时朝下，用时朝上？", options: ["帽子", "伞", "碗"], answer: 1, cat: "经典", hint: "下雨天用的" },
      { q: "什么东西有口无牙？", options: ["河", "井", "狗"], answer: 1, cat: "经典", hint: "可以打水" },
      { q: "什么东西天黑出现，天亮就不见？", options: ["月饼", "路灯坏了", "星星"], answer: 2, cat: "经典", hint: "一闪一闪亮晶晶" },
      { q: "你越是想留住它，它走得越快，它是什么？", options: ["时间", "风", "水"], answer: 0, cat: "逻辑", hint: "一去不复返" },
      { q: "什么东西别人用得比你自己多？", options: ["你的筷子", "你的手机", "你的名字"], answer: 2, cat: "逻辑", hint: "大家都这么叫你" },
      { q: "什么东西有头无脚？", options: ["板凳", "蛇", "砖头"], answer: 2, cat: "经典", hint: "盖房子用的" },
      { q: "什么门永远关不上？", options: ["防盗门", "铁门", "球门"], answer: 2, cat: "经典", hint: "踢足球时守的" },
      { q: "什么东西越生气越大？", options: ["气球", "肚子", "脾气"], answer: 2, cat: "冷笑话", hint: "人人都有" },
      { q: "什么书在书店买不到？", options: ["秘书", "漫画书", "教科书"], answer: 0, cat: "谐音", hint: "是个职位" },
      { q: "什么车寸步难行？", options: ["自行车", "火车", "风车"], answer: 2, cat: "经典", hint: "在原地转圈" },
      { q: "什么帽子不能戴？", options: ["草帽", "棒球帽", "螺丝帽"], answer: 2, cat: "谐音", hint: "机械零件" },
      { q: "什么鸡没有翅膀？", options: ["田鸡", "乌骨鸡", "火鸡"], answer: 0, cat: "谐音", hint: "其实是青蛙" },
      { q: "什么鼠最爱干净？", options: ["米老鼠", "松鼠", "环保署"], answer: 2, cat: "谐音", hint: "是个政府部门" },
      { q: "什么瓜不能吃？", options: ["傻瓜", "西瓜", "黄瓜"], answer: 0, cat: "谐音", hint: "骂人的话" },
      { q: "什么花不能浇水？", options: ["玫瑰花", "雪花", "向日葵"], answer: 1, cat: "经典", hint: "冬天才有" },
      { q: "什么蛋不能吃？", options: ["鸡蛋", "鸭蛋", "笨蛋"], answer: 2, cat: "谐音", hint: "骂人的话" },
      { q: "什么球离你最近？", options: ["地球", "眼球", "足球"], answer: 1, cat: "逻辑", hint: "长在脸上" },
      { q: "什么人一年只工作一天？", options: ["老师", "圣诞老人", "快递员"], answer: 1, cat: "冷笑话", hint: "12 月 25 日" },
      { q: "什么东西有脚却不会走路？", options: ["鸭子", "桌子", "螃蟹"], answer: 1, cat: "经典", hint: "吃饭写字都用它" },
      { q: "什么动物最怕水？", options: ["猫", "没有一个（都会喝水）", "鸡"], answer: 1, cat: "冷笑话", hint: "陷阱题" },
      { q: "一个人从飞机上跳下来没用降落伞却没事，为什么？", options: ["飞机停在地上", "下面是海", "他会飞"], answer: 0, cat: "逻辑", hint: "没说飞机在天上" },
      { q: "小明的妈妈有三个儿子，大毛二毛，老三叫什么？", options: ["小明", "四毛", "三毛"], answer: 0, cat: "逻辑", hint: "看清题目第一个词" },
      { q: "什么东西打破了才能用？", options: ["鸡蛋", "杯子", "镜子"], answer: 0, cat: "经典", hint: "做饭第一步" },
      { q: "什么路最窄？", options: ["冤家路窄", "山路", "小路"], answer: 0, cat: "谐音", hint: "成语" },
      { q: "什么床不能睡？", options: ["上下铺", "沙发床", "河床"], answer: 2, cat: "谐音", hint: "在水底" },
      { q: "什么海没有水？", options: ["东海", "辞海", "死海"], answer: 1, cat: "谐音", hint: "一本工具书" },
      { q: "什么牛不吃草？", options: ["牦牛", "奶牛", "蜗牛"], answer: 2, cat: "谐音", hint: "背着壳爬" },
      { q: "什么马不能骑？", options: ["河马", "斑马", "小马"], answer: 0, cat: "谐音", hint: "在水里泡着" },
      { q: "什么布剪不断？", options: ["瀑布", "纱布", "棉布"], answer: 0, cat: "谐音", hint: "从山上流下来" },
      { q: "什么人生病从来不看医生？", options: ["小孩", "盲人", "医生"], answer: 1, cat: "冷笑话", hint: "“看”不了" },
      { q: "什么东西放进冰箱会变热？", options: ["冰块", "热水", "冰箱外壳"], answer: 2, cat: "冷笑话", hint: "冰箱后面摸摸看" },
      { q: "一年四季都盛开的花是什么？", options: ["桂花", "梅花", "塑料花"], answer: 2, cat: "冷笑话", hint: "不是真花" },
      { q: "什么东西你明明有，却总说“没有”？", options: ["时间", "钱", "没有（这个词）"], answer: 2, cat: "逻辑", hint: "文字游戏" },
      { q: "铅笔姓什么？", options: ["王", "萧（削）", "李"], answer: 1, cat: "谐音", hint: "用前要先……" },
      { q: "什么东西越挤越多？", options: ["牙膏", "人", "奶茶"], answer: 1, cat: "冷笑话", hint: "早高峰地铁" },
      { q: "什么东西晚上才生出尾巴？", options: ["流星", "小猫", "彗星图"], answer: 0, cat: "经典", hint: "许愿的时候" },
      { q: "什么竹子不长在土里？", options: ["爆竹", "斑竹", "毛竹"], answer: 0, cat: "谐音", hint: "过年点的" },
      { q: "黑人和白人生下的婴儿，牙齿是什么颜色？", options: ["婴儿没有牙", "黑色", "白色"], answer: 0, cat: "逻辑", hint: "刚出生" },
      { q: "什么东西有面无口，有脚无手，却能吃饭？", options: ["桌子", "锅", "碗"], answer: 0, cat: "经典", hint: "饭放在它上面" },
      { q: "什么袋子每个人都有，却很少借给别人？", options: ["口袋", "塑料袋", "脑袋"], answer: 2, cat: "谐音", hint: "长在脖子上" },
      { q: "天上有多少颗星星？", options: ["数不清", "八颗", "一万颗"], answer: 0, cat: "冷笑话", hint: "你数数看" },
      { q: "哪种动物最没方向感？", options: ["鸽子", "麋鹿（迷路）", "蜜蜂"], answer: 1, cat: "谐音", hint: "谐音梗" },
      { q: "什么水永远用不完？", options: ["海水", "自来水", "薪水"], answer: 2, cat: "谐音", hint: "每个月都发" },
      { q: "什么东西长得像熊猫，颜色像熊猫，却不是熊猫？", options: ["熊猫的照片", "斑马", "奶牛"], answer: 0, cat: "逻辑", hint: "手机里存着" },
      { q: "什么数字最勤劳？", options: ["一（一不做二不休）", "八", "零"], answer: 0, cat: "冷笑话", hint: "成语里找" },
      { q: "什么东西有时有，有时无，越是需要越难找？", options: ["灵感", "钥匙", "作业"], answer: 0, cat: "冷笑话", hint: "写作文时" },
      { q: "太平洋的中间是什么？", options: ["岛", "水", "平（字）"], answer: 2, cat: "逻辑", hint: "看字" },
      { q: "什么字全世界通用？", options: ["英文", "阿拉伯数字", "汉字"], answer: 1, cat: "逻辑", hint: "1 2 3" },
      { q: "什么动物天天熬夜？", options: ["猫头鹰", "熊猫（黑眼圈）", "蝙蝠"], answer: 1, cat: "冷笑话", hint: "看眼睛" },
      { q: "什么东西洗好了却不能吃？", options: ["青菜", "扑克牌", "水果"], answer: 1, cat: "冷笑话", hint: "打牌前要做的" },
      { q: "哪个月有 28 天？", options: ["没有", "二月", "每个月都有"], answer: 2, cat: "逻辑", hint: "至少 28 天" },
      { q: "什么照片看不出照的是谁？", options: ["证件照", "合照", "X 光片"], answer: 2, cat: "冷笑话", hint: "医院拍的" },
      { q: "什么人最喜欢别人给他“添麻烦”？", options: ["卖麻糖的人", "宿管", "老师"], answer: 0, cat: "谐音", hint: "麻……" },
      { q: "左手永远抓不到什么？", options: ["杯子", "左手", "右手"], answer: 1, cat: "逻辑", hint: "自己抓自己" },
      { q: "什么东西经常从天上掉下来，却从不摔坏？", options: ["鸟", "飞机", "雨"], answer: 2, cat: "经典", hint: "下雨天" },
      { q: "宿舍里什么东西最容易“失踪”？", options: ["充电线", "门", "床"], answer: 0, cat: "冷笑话", hint: "每个宿舍都在找" },
      { q: "什么帽子大家都不想戴，却人人都戴过？", options: ["绿帽子", "安全帽", "高帽子（被夸）"], answer: 2, cat: "冷笑话", hint: "被人捧的时候" },
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
      riddleOrder = shuffle(riddleFiltered()).slice(0, 10); // v4.0：题库 60 道，每局随机抽 10 道
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
      ["全部", "经典", "谐音", "冷笑话", "逻辑"].forEach((c) => {
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
    riddleOrder = shuffle(RIDDLES.map((_, i) => i)).slice(0, 10); riddleRender();
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
          cvFX("shooterCanvas", shooterEnemies[hit].x, shooterEnemies[hit].y, ["#ff6b6b", "#ffd43b", "#fff"], 14);
          shooterEnemies.splice(hit, 1);
          shooterScore += 10;
          SFX.hit();
          return false;
        }
        return true;
      });
      // 怪兽撞飞船 / 掉出底边
      shooterEnemies = shooterEnemies.filter((e) => {
        if (shooterOver) return false; // R24：同一帧两怪同撞，第一只已撞毁终局，第二只别再扣命——原来命掉到 -1
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
    // v4.2：相对拖动，飞船不会被手指挡住
    relDrag($("shooterCanvas"), () => ({ x: shooterShipX, y: 0 }), (x) => { shooterShipX = Math.max(16, Math.min(SHOOT_W - 16, x)); shooterDraw(); }, { lw: SHOOT_W, lh: 300, hoverAbs: true });
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
    // v4.0：第 4 关起随机生成——在 4×4 点阵上随机走一条不重复的路，走过的边就是题目，保证能一笔画完
    function onestrokeGen(level) {
      const want = Math.min(22, 5 + level * 1.3 | 0);
      const COLS = 4, ROWS = 4, X0 = 45, Y0 = 35, DX = 70, DY = 63;
      for (let tries = 0; tries < 200; tries++) {
        const used = new Set(), diagCells = new Set(), path = [];
        let cur = [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
        path.push(cur);
        for (let k = 0; k < want; k++) {
          const opts = [];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const nx = cur[0] + dx, ny = cur[1] + dy;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
            const key = Math.min(cur[1] * COLS + cur[0], ny * COLS + nx) + "-" + Math.max(cur[1] * COLS + cur[0], ny * COLS + nx);
            if (used.has(key)) continue;
            if (dx && dy) { const cell = Math.min(cur[0], nx) + "," + Math.min(cur[1], ny); if (diagCells.has(cell)) continue; }
            opts.push([nx, ny, key, dx && dy ? Math.min(cur[0], nx) + "," + Math.min(cur[1], ny) : null]);
          }
          if (!opts.length) break;
          const [nx, ny, key, cell] = opts[Math.floor(Math.random() * opts.length)];
          used.add(key); if (cell) diagCells.add(cell);
          cur = [nx, ny]; path.push(cur);
        }
        if (used.size < want - 1) continue;
        const ids = {}, nodes = [];
        path.forEach(([x, y]) => { const k = y * COLS + x; if (!(k in ids)) { ids[k] = nodes.length; nodes.push([X0 + x * DX, Y0 + y * DY]); } });
        const edges = [...used].map((k) => k.split("-").map((v) => ids[+v]));
        return { name: edges.length + " 条线", nodes, edges };
      }
      return ONESTROKE_LEVELS[2];
    }
    function onestrokeLv(i) { while (ONESTROKE_LEVELS.length <= i) ONESTROKE_LEVELS.push(onestrokeGen(ONESTROKE_LEVELS.length)); return ONESTROKE_LEVELS[i]; }
    let onestrokeLevel = 0, onestrokePath = [], onestrokeUsed = new Set(), onestrokeDone = false;
    function onestrokeEdgeKey(a, b) { return Math.min(a, b) + "-" + Math.max(a, b); }
    // R29：起笔陷阱——欧拉轨迹必须从奇点出发；第 2 关奇点是 0、2 号点，第 3 关是 1、2 号点，
    // 从别的点起笔注定走进死胡同。起笔前把能画完的起笔点圈出来（0 个奇点 = 欧拉回路，任意起笔都行，不用提示）。
    function onestrokeStartNodes() {
      const lv = onestrokeLv(onestrokeLevel);
      const deg = lv.nodes.map(() => 0);
      lv.edges.forEach((e) => { deg[e[0]]++; deg[e[1]]++; });
      const odd = deg.map((d, i) => (d % 2 === 1 ? i : -1)).filter((i) => i >= 0);
      return odd.length === 2 ? odd : [];
    }
    function onestrokeRender() {
      const lv = onestrokeLv(onestrokeLevel);
      const board = $("onestrokeBoard");
      board.innerHTML = "";
      const starts = onestrokePath.length === 0 ? onestrokeStartNodes() : [];
      // 所有线：没画的是虚的，画过的是亮的（原来只画已画的线，玩家根本看不到题目）
      lv.edges.forEach((e) => {
        const key = onestrokeEdgeKey(e[0], e[1]);
        const [x1, y1] = lv.nodes[e[0]], [x2, y2] = lv.nodes[e[1]];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const line = document.createElement("div");
        line.className = "onestroke-line" + (onestrokeUsed.has(key) ? " done" : " todo");
        line.style.left = x1 + "px"; line.style.top = y1 + "px";
        line.style.width = len + "px"; line.style.transform = "rotate(" + ang + "deg)";
        board.appendChild(line);
      });
      // 点
      lv.nodes.forEach((pt, i) => {
        const d = document.createElement("button");
        d.className = "onestroke-dot" + (starts.includes(i) ? " onestroke-start" : "") + (onestrokePath.length && onestrokePath[onestrokePath.length - 1] === i ? " cur" : "");
        d.style.left = pt[0] + "px"; d.style.top = pt[1] + "px";
        d.setAttribute("aria-label", "点 " + (i + 1));
        d.addEventListener("click", () => onestrokePick(i));
        board.appendChild(d);
      });
      if ($("onestrokeNextBtn")) $("onestrokeNextBtn").classList.toggle("hidden", !onestrokeDone);
      $("onestrokeStatus").textContent = onestrokeDone
        ? "🎉 第 " + (onestrokeLevel + 1) + " 关画完了！点「下一关」继续。"
        : "第 " + (onestrokeLevel + 1) + " 关（" + lv.name + "）· 已画 " + onestrokeUsed.size + " / " + lv.edges.length + " 条线"
          + (onestrokeDeadEnd()
            ? (onestrokeUndoHelps() ? " · 😵 走进死胡同了，点撤销退一步。" : " · 😵 走进死胡同了——起笔点错了，点「重画」换个金色圈的点起笔。")
            : (!onestrokeSolvable() ? " · ⚠️ 再画下去也画不完了，点「重画」换个金色圈的点起笔。" : ""))
          + (starts.length ? " · 💡 金色圈的点才能一笔画完" : "");
    }
    // v3.0-r17：当前点没有未画的相邻边、但关卡还没画完 = 死胡同（以前只静默卡住）
    function onestrokeDeadEnd() {
      if (onestrokeDone || onestrokePath.length === 0) return false;
      const lv = onestrokeLv(onestrokeLevel);
      const cur = onestrokePath[onestrokePath.length - 1];
      return !lv.edges.some((e) => !onestrokeUsed.has(onestrokeEdgeKey(e[0], e[1])) && (e[0] === cur || e[1] === cur));
    }
    // R29：从当前点出发、剩下的边还能不能一笔画完（欧拉轨迹判定：剩余边连通，且奇点 0 个，
    // 或 2 个且当前点是其中之一）。错起笔时全程都不满足——死胡同里撤销也救不回，文案不能只说“点撤销”。
    function onestrokeSolvable() {
      if (onestrokeDone || onestrokePath.length === 0) return true;
      const lv = onestrokeLv(onestrokeLevel);
      const cur = onestrokePath[onestrokePath.length - 1];
      const rem = lv.edges.filter((e) => !onestrokeUsed.has(onestrokeEdgeKey(e[0], e[1])));
      if (rem.length === 0) return true;
      const adj = {};
      rem.forEach((e) => { (adj[e[0]] = adj[e[0]] || []).push(e[1]); (adj[e[1]] = adj[e[1]] || []).push(e[0]); });
      const seen = new Set([cur]);
      const stack = [cur];
      while (stack.length) { const n = stack.pop(); (adj[n] || []).forEach((m) => { if (!seen.has(m)) { seen.add(m); stack.push(m); } }); }
      if (!rem.every((e) => seen.has(e[0]) && seen.has(e[1]))) return false;
      const deg = lv.nodes.map(() => 0);
      rem.forEach((e) => { deg[e[0]]++; deg[e[1]]++; });
      const odd = deg.map((d, i) => (d % 2 === 1 ? i : -1)).filter((i) => i >= 0);
      return odd.length === 0 || (odd.length === 2 && odd.includes(cur));
    }
    // R29：死胡同里撤销一步能不能救回来——把最后一条边放回未画再判一次（同步改完马上还原）
    function onestrokeUndoHelps() {
      if (onestrokePath.length <= 1) return false;
      const last = onestrokePath[onestrokePath.length - 1];
      const prev = onestrokePath[onestrokePath.length - 2];
      onestrokeUsed.delete(onestrokeEdgeKey(prev, last));
      onestrokePath.pop();
      const ok = onestrokeSolvable();
      onestrokePath.push(last);
      onestrokeUsed.add(onestrokeEdgeKey(prev, last));
      return ok;
    }
    function onestrokePick(i) {
      if (onestrokeDone) return;
      const lv = onestrokeLv(onestrokeLevel);
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
      if (onestrokeUsed.size === lv.edges.length) { onestrokeDone = true; SFX.win(); }
      else if (SFX.enabled) SFX.click();
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
    $("onestrokeResetBtn").addEventListener("click", () => onestrokeReset(onestrokeLevel));
    if ($("onestrokeNextBtn")) $("onestrokeNextBtn").addEventListener("click", () => { if (onestrokeDone) { SFX.click(); onestrokeReset(onestrokeLevel + 1); } });
    onestrokeReset(0);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get onestroke() { return { level: onestrokeLevel, path: onestrokePath.slice(), used: [...onestrokeUsed], totalEdges: onestrokeLv(onestrokeLevel).edges.length, done: onestrokeDone }; },
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
    let marbleStepId = null; // R28a：掉落定时器 id，重开要清掉，否则孤儿定时器让重开后的球走双倍步
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
      if (marbleStepId) { clearTimeout(marbleStepId); marbleStepId = null; }
      marbleStepId = setTimeout(marbleStep, 150); // 第一步靠定时器走，测试可先 marbleSetDirs 再手动 marbleStep
    }
    function marbleStep() {
      if (!marbleBall) return;
      if (marbleBall.row < MARBLE_ROWS) {
        marbleBall.x = Math.max(15, Math.min(285, marbleBall.x + marbleDirs[marbleBall.row] * 25));
        marbleBall.y = 40 + (marbleBall.row + 1) * 40;
        marbleBall.row++;
        marbleRender();
        if (marbleBall.row < MARBLE_ROWS) {
          marbleStepId = setTimeout(marbleStep, 150);
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
      if (marbleStepId) { clearTimeout(marbleStepId); marbleStepId = null; } // R28a：清掉落定时器
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
    // v4.0：每次随机出 12 组有解的题（扑克牌 1–13），求解器同时给出参考答案
    function make24Solve(nums) {
      const go = (items) => {
        if (items.length === 1) return Math.abs(items[0].v - 24) < 1e-6 ? items[0].e : null;
        for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
          if (i === j) continue;
          const a = items[i], b = items[j], rest = items.filter((_, k) => k !== i && k !== j);
          const P = (x, op, y) => "(" + x.e + op + y.e + ")";
          const cands = [{ v: a.v + b.v, e: P(a, "+", b) }, { v: a.v - b.v, e: P(a, "-", b) }, { v: a.v * b.v, e: P(a, "×", b) }];
          if (Math.abs(b.v) > 1e-9) cands.push({ v: a.v / b.v, e: P(a, "÷", b) });
          for (const c of cands) { const r = go(rest.concat([c])); if (r) return r; }
        }
        return null;
      };
      const r = go(nums.map((n) => ({ v: n, e: String(n) })));
      return r ? r.slice(1, -1) : null; // 最外层括号一定是一对
    }
    function make24Gen() {
      const out = [], seen = new Set();
      let guard = 0;
      while (out.length < 12 && guard++ < 2000) {
        const max = out.length < 4 ? 10 : 13; // 前几组数字小一点
        const s = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * max)).sort((a, b) => a - b);
        const k = s.join(",");
        if (seen.has(k) || !make24Solve(s)) continue;
        seen.add(k); out.push(s);
      }
      return out;
    }
    let MAKE24_SETS = make24Gen();
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
      if ($("make24Answer")) $("make24Answer").textContent = "";
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
          make24Render(); // R23：先渲染（数字区变成 24），再盖状态文案；原来直接 return，按钮还停在旧数字上
          $("make24Status").textContent = "🎉 等于 24！第 " + (make24SetIdx + 1) + " 组解出来了，已解 " + make24Solved + " 组。" + (firstSolve ? "点换一组继续。" : "（这组已经解过，不重复计。）");
          return;
        }
        make24Render(); // R23：先渲染，再盖失败文案；原来 render 在后，把“不是 24”盖掉了
        $("make24Status").textContent = "❌ 最后剩 " + make24Fmt(make24Nums[0]) + "，不是 24。点撤销回去重算。";
        return;
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
    $("make24ResetBtn").addEventListener("click", () => {
      if (make24SetIdx + 1 >= MAKE24_SETS.length) { MAKE24_SETS = make24Gen(); make24SolvedSets = new Set(); make24Solved = 0; make24LoadSet(0); return; }
      make24LoadSet(make24SetIdx + 1);
    });
    if ($("make24AnswerBtn")) $("make24AnswerBtn").addEventListener("click", () => {
      const a = make24Solve(MAKE24_SETS[make24SetIdx]);
      $("make24Answer").textContent = a ? "参考答案：" + a + " = 24" : "";
    });
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
        if (fruitOver) return; // R24：终局那一刀里，炸弹已引爆就别再切后面的——原来同刀的水果还加分、同刀的第二颗炸弹还扣命，命能掉到 -1
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
            cvFX("fruitsliceCanvas", f.x, f.y, ["#ff8787", "#ffe066", "#69db7c"], 12); FX.buzz(8);
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

    toyLeaveCleanup.fruitslice = () => { if (fruitStepId) { clearInterval(fruitStepId); fruitStepId = null; } if (fruitSpawnId) { clearInterval(fruitSpawnId); fruitSpawnId = null; } fruitRunning = false; }; // R24：切走只停表不改 running，回来点开始直接 return、游戏冻住（同射击的 cleanup 会置 false）
  };
  /* ---------- 64. 走迷宫 ---------- */
  toyInitFns["maze"] = function () {
    // v4.0 重写：随机生成完美迷宫（递归回溯），关卡越往后越大；滑一下会沿走廊一直走到岔路口
    const BEST_KEY = "dorm-toybox-maze-v2";
    let save = (() => { try { const v = JSON.parse(lsGet(BEST_KEY, "{}")); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
    let level = Math.max(1, Math.min(99, save.level | 0 || 1));
    let N = 5, walls = null, pr = 0, pc = 0, steps = 0, done = false, trail = [], startT = 0, endT = 0, tick = null, anim = null;
    const sizeFor = (lv) => Math.min(21, 5 + Math.floor((lv - 1) * 1.5));
    // walls[r][c] = [上, 右, 下, 左]
    function gen(n) {
      const w = Array.from({ length: n }, () => Array.from({ length: n }, () => [1, 1, 1, 1]));
      const seen = Array.from({ length: n }, () => Array(n).fill(false));
      const st = [[0, 0]]; seen[0][0] = true;
      const D = [[-1, 0, 0, 2], [0, 1, 1, 3], [1, 0, 2, 0], [0, -1, 3, 1]];
      while (st.length) {
        const [r, c] = st[st.length - 1];
        const opts = D.filter(([dr, dc]) => { const nr = r + dr, nc = c + dc; return nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr][nc]; });
        if (!opts.length) { st.pop(); continue; }
        const [dr, dc, a, b] = opts[Math.floor(Math.random() * opts.length)];
        w[r][c][a] = 0; w[r + dr][c + dc][b] = 0; seen[r + dr][c + dc] = true;
        st.push([r + dr, c + dc]);
      }
      return w;
    }
    function newMaze(lv) {
      if (lv !== undefined) level = lv;
      N = sizeFor(level);
      walls = gen(N);
      pr = 0; pc = 0; steps = 0; done = false; trail = [[0, 0]]; startT = 0; endT = 0;
      stopTick();
      draw(); render();
    }
    const DIRS = { up: [-1, 0, 0], right: [0, 1, 1], down: [1, 0, 2], left: [0, -1, 3] };
    function openCount(r, c) { return walls[r][c].reduce((a, v) => a + (v ? 0 : 1), 0); }
    function move(dir, slide) {
      if (done || anim) return false;
      const d = DIRS[dir]; if (!d) return false;
      if (walls[pr][pc][d[2]]) { if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {} return false; }
      if (!startT) { startT = Date.now(); startTick(); }
      const path = [];
      let r = pr, c = pc;
      do {
        r += d[0]; c += d[1]; path.push([r, c]);
        if (r === N - 1 && c === N - 1) break;
      } while (slide && !walls[r][c][d[2]] && openCount(r, c) === 2);
      // 一格一格动画走过去
      let i = 0;
      const stepOnce = () => {
        const [nr, nc] = path[i++];
        pr = nr; pc = nc; steps++;
        const prev = trail[trail.length - 2];
        if (prev && prev[0] === nr && prev[1] === nc) trail.pop(); else trail.push([nr, nc]); // 走回头路就擦掉轨迹
        if (pr === N - 1 && pc === N - 1) { win(); anim = null; draw(); render(); return; }
        draw(); render();
        if (i < path.length) anim = setTimeout(stepOnce, 35); else anim = null;
      };
      if (SFX.enabled) SFX.click();
      stepOnce();
      return true;
    }
    function win() {
      done = true; endT = Date.now(); stopTick();
      const secs = (endT - startT) / 1000;
      const key = "L" + level;
      if (!save[key] || secs < save[key]) save[key] = Math.round(secs * 10) / 10;
      save.level = Math.max(save.level | 0, level + 1);
      lsSet(BEST_KEY, JSON.stringify(save));
      SFX.win();
    }
    function startTick() { stopTick(); tick = setInterval(render, 200); }
    function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
    function draw() {
      const cv = $("mazeCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      const S = cv.width, pad = 8, cell = (S - pad * 2) / N;
      ctx.fillStyle = "#0f1424"; ctx.fillRect(0, 0, S, S);
      // 终点
      const X = (c) => pad + c * cell, Y = (r) => pad + r * cell;
      ctx.fillStyle = "rgba(61, 214, 140, .25)"; ctx.fillRect(X(N - 1), Y(N - 1), cell, cell);
      ctx.font = Math.floor(cell * 0.62) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🏁", X(N - 1) + cell / 2, Y(N - 1) + cell / 2 + 1);
      // 轨迹
      if (trail.length > 1) {
        ctx.strokeStyle = "rgba(245, 197, 66, .55)"; ctx.lineWidth = Math.max(2, cell * 0.22); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        trail.forEach(([r, c], i) => { const x = X(c) + cell / 2, y = Y(r) + cell / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      }
      // 墙
      ctx.strokeStyle = "#8fa6ff"; ctx.lineWidth = Math.max(2, Math.min(4, cell * 0.12)); ctx.lineCap = "round";
      ctx.beginPath();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const w = walls[r][c], x = X(c), y = Y(r);
        if (w[0]) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (w[3]) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
        if (r === N - 1 && w[2]) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (c === N - 1 && w[1]) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      }
      ctx.stroke();
      // 玩家
      const px = X(pc) + cell / 2, py = Y(pr) + cell / 2;
      ctx.fillStyle = "#3dd68c"; ctx.shadowColor = "#3dd68c"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(px, py, cell * 0.3, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.textBaseline = "alphabetic";
    }
    function render() {
      const secs = startT ? ((done ? endT : Date.now()) - startT) / 1000 : 0;
      const bestL = save["L" + level];
      $("mazeStatus").textContent = done
        ? "🎉 第 " + level + " 关通过！" + secs.toFixed(1) + " 秒 · " + steps + " 步" + (bestL ? " · 最好 " + bestL + " 秒" : "")
        : "第 " + level + " 关 · " + N + "×" + N + " · " + secs.toFixed(1) + " 秒" + (bestL ? " · 最好 " + bestL + " 秒" : "");
      const nb = $("mazeNextBtn"); if (nb) nb.classList.toggle("hidden", !done);
      const pv = $("mazePrevBtn"); if (pv) pv.disabled = level <= 1;
    }
    // 滑动：长滑沿走廊走到岔路口；点格子方向键也行
    (function () {
      const cv = $("mazeCanvas"); if (!cv) return;
      let sx = 0, sy = 0, tracking = false;
      cv.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; tracking = true; SFX.unlock(); });
      cv.addEventListener("pointerup", (e) => {
        if (!tracking) return; tracking = false;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.hypot(dx, dy) < 14) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"), true);
      });
      cv.addEventListener("pointercancel", () => { tracking = false; });
    })();
    document.querySelectorAll("#mazePad [data-dir]").forEach((b) => b.addEventListener("click", () => { SFX.unlock(); move(b.getAttribute("data-dir"), true); }));
    document.addEventListener("keydown", (e) => {
      if ($("toy-maze").classList.contains("hidden")) return;
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
      if (map[e.key]) { move(map[e.key], !e.shiftKey); e.preventDefault(); }
    });
    $("mazeResetBtn").addEventListener("click", () => newMaze(level));
    if ($("mazeNextBtn")) $("mazeNextBtn").addEventListener("click", () => newMaze(level + 1));
    if ($("mazePrevBtn")) $("mazePrevBtn").addEventListener("click", () => newMaze(Math.max(1, level - 1)));
    toyLeaveCleanup["maze"] = () => stopTick();
    toyEnterResume["maze"] = () => { if (startT && !done) startTick(); };
    newMaze(level);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get maze() { return { level, n: N, pr, pc, steps, done }; },
      mazeMove(dir, slide) { return move(dir, slide); },
      mazeSet(lv) { newMaze(lv); },
      mazeWalls() { return walls; },
    }));
  };
  /* ---------- 65. 消消乐 ---------- */
  toyInitFns["match3"] = function () {
    // v4.1 重写：关卡制（限步数+目标分）、拖动交换、交换/消除/下落全过程动画、连锁倍率
    const MATCH3_KEY = "dorm-toybox-match3-best-v1";
    const LV_KEY = "dorm-toybox-match3-level-v1";
    const EMO = ["🍎", "🍊", "🍋", "🍇", "🫐", "🍓"];
    const N = 7, MOVES = 25;
    let best = loadBest(MATCH3_KEY);
    let grid = [], score = 0, level = 1, movesLeft = MOVES, target = 0, sel = null, busy = false, over = false;
    let uid = 0;
    const boardEl = () => $("match3Board");
    const targetFor = (lv) => 500 + (lv - 1) * 350;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    function place(t, r, c) { t.r = r; t.c = c; t.el.style.setProperty("--r", r); t.el.style.setProperty("--c", c); }
    function makeTile(v, r, c, fromRow) {
      const el = document.createElement("div");
      el.className = "m3-tile"; el.textContent = EMO[v];
      const t = { id: ++uid, v, r, c, el };
      place(t, fromRow == null ? r : fromRow, c);
      boardEl().appendChild(el);
      return t;
    }
    function findMatches(g) {
      const hit = new Set(), groups = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = g[r][c]; if (!t) continue;
        let n = 1; while (c + n < N && g[r][c + n] && g[r][c + n].v === t.v) n++;
        if (n >= 3) { const grp = []; for (let k = 0; k < n; k++) { hit.add(r * N + c + k); grp.push([r, c + k]); } groups.push(grp); }
        n = 1; while (r + n < N && g[r + n][c] && g[r + n][c].v === t.v) n++;
        if (n >= 3) { const grp = []; for (let k = 0; k < n; k++) { hit.add((r + k) * N + c); grp.push([r + k, c]); } groups.push(grp); }
      }
      return { hit, groups };
    }
    function vgrid() { return grid.map((row) => row.map((t) => t && { v: t.v })); }
    function hasMove() {
      const g = vgrid();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue;
        const t = g[r][c]; g[r][c] = g[r2][c2]; g[r2][c2] = t;
        const ok = findMatches(g).hit.size > 0;
        g[r2][c2] = g[r][c]; g[r][c] = t;
        if (ok) return [r, c, r2, c2];
      }
      return null;
    }
    function freshBoard(anim) {
      boardEl().querySelectorAll(".m3-tile").forEach((e) => e.remove());
      let guard = 0;
      do {
        const g = [];
        for (let r = 0; r < N; r++) { g[r] = []; for (let c = 0; c < N; c++) {
          let v; do { v = Math.floor(Math.random() * EMO.length); } while ((c >= 2 && g[r][c - 1] === v && g[r][c - 2] === v) || (r >= 2 && g[r - 1][c] === v && g[r - 2][c] === v));
          g[r][c] = v;
        } }
        grid = g.map((row) => row.map((v) => ({ v })));
      } while (!hasMove() && guard++ < 50);
      grid = grid.map((row, r) => row.map((x, c) => makeTile(x.v, r, c, anim ? r - N - 1 : null)));
      if (anim) requestAnimationFrame(() => requestAnimationFrame(() => grid.forEach((row, r) => row.forEach((t) => { t.el.style.transitionDelay = (c => c * 25)(t.c) + (N - r) * 12 + "ms"; place(t, r, t.c); setTimeout(() => { t.el.style.transitionDelay = ""; }, 600); }))));
    }
    function cellAt(clientX, clientY) {
      const rect = boardEl().getBoundingClientRect(), pad = 6, size = (rect.width - pad * 2) / N;
      const c = Math.floor((clientX - rect.left - pad) / size), r = Math.floor((clientY - rect.top - pad) / size);
      return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null;
    }
    function screenOf(r, c) { const rect = boardEl().getBoundingClientRect(), size = (rect.width - 12) / N; return { x: rect.left + 6 + (c + 0.5) * size, y: rect.top + 6 + (r + 0.5) * size }; }
    function setSel(rc) {
      if (sel) { const t = grid[sel[0]][sel[1]]; if (t) t.el.classList.remove("sel"); }
      sel = rc;
      if (sel) { const t = grid[sel[0]][sel[1]]; if (t) t.el.classList.add("sel"); }
    }
    async function trySwap(r1, c1, r2, c2) {
      if (busy || over) return;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
      busy = true; setSel(null); SFX.unlock();
      const a = grid[r1][c1], b = grid[r2][c2];
      grid[r1][c1] = b; grid[r2][c2] = a; place(a, r2, c2); place(b, r1, c1);
      await sleep(170);
      if (!findMatches(grid).hit.size) {
        grid[r1][c1] = a; grid[r2][c2] = b; place(a, r1, c1); place(b, r2, c2);
        SFX._tone(220, 0.08, "sine", 0.06);
        await sleep(170);
        FX.shake(boardEl()); FX.buzz(25);
        busy = false; return;
      }
      movesLeft--;
      await resolve();
      busy = false;
      afterTurn();
    }
    async function resolve() {
      let chain = 0;
      for (;;) {
        const { hit, groups } = findMatches(grid);
        if (!hit.size) break;
        chain++;
        const mult = chain;
        const bonus = groups.reduce((s, g) => s + (g.length >= 5 ? 60 : g.length === 4 ? 25 : 0), 0);
        const gained = (hit.size * 10 + bonus) * mult;
        score += gained;
        // 消除：缩小 + 火花
        let cx = 0, cy = 0;
        hit.forEach((k) => { const r = Math.floor(k / N), c = k % N, t = grid[r][c]; t.el.classList.add("clear"); const p = screenOf(r, c); cx += p.x; cy += p.y; FX.sparkle(p.x, p.y, null, 5); });
        cx /= hit.size; cy /= hit.size;
        FX.float((chain > 1 ? "连击 ×" + chain + "  " : "") + "+" + gained, cx, cy, chain > 1 ? "#ff8787" : "#ffe066");
        SFX.pop(Math.min(1, 0.3 + chain * 0.15));
        if (chain >= 2) FX.buzz(10 + chain * 6);
        renderHud();
        await sleep(200);
        hit.forEach((k) => { const r = Math.floor(k / N), c = k % N; grid[r][c].el.remove(); grid[r][c] = null; });
        // 重力下落 + 补新
        let maxFall = 0;
        for (let c = 0; c < N; c++) {
          let w = N - 1;
          for (let r = N - 1; r >= 0; r--) if (grid[r][c]) { const t = grid[r][c]; if (w !== r) { grid[w][c] = t; grid[r][c] = null; maxFall = Math.max(maxFall, w - r); place(t, w, c); } w--; }
          const need = w + 1;
          for (let k = 0; k < need; k++) {
            const r = w - k, t = makeTile(Math.floor(Math.random() * EMO.length), r, c, r - need - 1);
            grid[r][c] = t; maxFall = Math.max(maxFall, need + 1);
          }
        }
        // 下一帧再把新块落到位，过渡才会生效
        await sleep(20);
        for (let c = 0; c < N; c++) for (let r = 0; r < N; r++) { const t = grid[r][c]; if (t) place(t, r, c); }
        await sleep(160 + maxFall * 30);
      }
    }
    function afterTurn() {
      if (score > best) { best = score; saveBest(MATCH3_KEY, best); }
      if (score >= target) {
        // 过关：剩余步数换奖励分
        const bonus = movesLeft * 30;
        score += bonus;
        SFX.win();
        $("match3Status").textContent = "🎉 第 " + level + " 关通过！剩 " + movesLeft + " 步奖励 +" + bonus + "，进入下一关。";
        level++; lsSet(LV_KEY, String(level));
        movesLeft = MOVES; target = score + targetFor(level);
        renderHud();
        busy = true;
        setTimeout(() => { freshBoard(true); busy = false; }, 900);
        return;
      }
      if (movesLeft <= 0) {
        over = true;
        SFX.lose();
        $("match3Status").textContent = "😵 步数用完了，还差 " + (target - score) + " 分。点「重新开始」从第 1 关再来。";
        renderHud(); return;
      }
      if (!hasMove()) {
        $("match3Status").textContent = "这盘没得换了，帮你重新洗牌。";
        busy = true; setTimeout(() => { freshBoard(true); busy = false; }, 500);
      } else $("match3Status").textContent = movesLeft <= 5 ? "⚠️ 只剩 " + movesLeft + " 步了！" : "";
      renderHud();
    }
    function renderHud() {
      const need = Math.max(0, target - score), base = target - targetFor(level), prog = Math.max(0, Math.min(1, (score - base) / targetFor(level)));
      $("match3Score").textContent = "第 " + level + " 关 · 得分 " + score + " · 还差 " + need + " · 剩 " + movesLeft + " 步";
      const bar = $("match3Bar"); if (bar) bar.style.width = (prog * 100).toFixed(1) + "%";
      const mv = $("match3Moves"); if (mv) { mv.textContent = movesLeft; mv.classList.toggle("low", movesLeft <= 5); }
    }
    function reset() {
      score = 0; level = 1; movesLeft = MOVES; target = targetFor(1); sel = null; over = false; busy = false;
      $("match3Status").textContent = "拖动或先后点两个相邻水果交换，三个连成一排就消掉。";
      freshBoard(true); renderHud();
    }
    // 输入：拖动交换 或 点两下交换
    (function () {
      const el = boardEl(); let start = null, moved = false;
      el.addEventListener("pointerdown", (e) => { e.preventDefault(); if (busy || over) return; start = { rc: cellAt(e.clientX, e.clientY), x: e.clientX, y: e.clientY }; moved = false; try { el.setPointerCapture(e.pointerId); } catch (er) {} });
      el.addEventListener("pointermove", (e) => {
        if (!start || !start.rc || moved) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return;
        moved = true;
        const [r, c] = start.rc;
        const [r2, c2] = Math.abs(dx) > Math.abs(dy) ? [r, c + (dx > 0 ? 1 : -1)] : [r + (dy > 0 ? 1 : -1), c];
        if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) trySwap(r, c, r2, c2);
      });
      el.addEventListener("pointerup", () => {
        if (!start) return; const rc = start.rc; start = null;
        if (moved || !rc || busy || over) return;
        if (!sel) { setSel(rc); SFX.click(); return; }
        if (sel[0] === rc[0] && sel[1] === rc[1]) { setSel(null); return; }
        if (Math.abs(sel[0] - rc[0]) + Math.abs(sel[1] - rc[1]) === 1) { const s0 = sel; trySwap(s0[0], s0[1], rc[0], rc[1]); }
        else { setSel(rc); SFX.click(); }
      });
      el.addEventListener("pointercancel", () => { start = null; });
    })();
    $("match3ResetBtn").addEventListener("click", reset);
    if ($("match3HintBtn")) $("match3HintBtn").addEventListener("click", () => {
      const m = hasMove(); if (!m || busy) return;
      [grid[m[0]][m[1]], grid[m[2]][m[3]]].forEach((t) => { t.el.classList.remove("hint"); void t.el.offsetWidth; t.el.classList.add("hint"); setTimeout(() => t.el.classList.remove("hint"), 1300); });
    });
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get match3() { return { board: grid.map((r) => r.map((t) => t ? EMO[t.v] : null)), score, moves: MOVES - movesLeft, movesLeft, level, target, best, busy, over }; },
      matchSet(board) {
        boardEl().querySelectorAll(".m3-tile").forEach((e) => e.remove());
        grid = board.map((row, r) => row.map((v, c) => makeTile(Math.max(0, EMO.indexOf(v)), r, c)));
        score = 0; movesLeft = MOVES; target = targetFor(level); sel = null; busy = false; over = false; renderHud();
      },
      matchPick(r, c) { if (!sel) { setSel([r, c]); return; } const s0 = sel; setSel(null); trySwap(s0[0], s0[1], r, c); },
      matchSwap(r1, c1, r2, c2) { return trySwap(r1, c1, r2, c2); },
      matchHasMove() { return !!hasMove(); },
      matchEnsure() { if (hasMove()) return false; freshBoard(false); return true; },
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
      if (!isFinite(x) || !isFinite(y)) return; // R28：NaN 落点原来静默记 0 分还扣一支箭
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
    let deadAt = 0;
    function flap() {
      if (!running) {
        if (Date.now() - deadAt < 600) return; // v4.0：刚撞死时手还在狂点，别立刻误开下一局
        reset(); // v4.0：开局这一下也要起飞，原来只重置不起飞，鸟直接往下掉
      }
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
      // R21：顶上不死，夹住回落——原来连点几下鸟就飞出顶死，howto 只说“别撞上”（水管/地面），顶上不该是陷阱
      if (bird.y < 0) { bird.y = 0; bird.vy = 0; }
      // 碰撞
      let dead = bird.y + BH > H;
      for (const p of pipes) {
        if (bird.x + BW > p.x && bird.x < p.x + PW) {
          if (bird.y < p.gapY || bird.y + BH > p.gapY + GAP) dead = true;
        }
      }
      if (dead) {
        running = false; deadAt = Date.now();
        raf = null; // R21：死后把 raf 置空——原来残留已跑完的旧 id，点屏/空格重开时 !raf 为假、新的 requestAnimationFrame 排不上，鸟定在开局位置不动（画布还写着“点屏幕再来”）
        if (score > best) { best = score; saveBest(KEY, best); isNewBest = score > 0; }
        { if (isNewBest) SFX.win(); else SFX.lose(); }
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
        SFX.win();
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
      if (waiting && "wasd".indexOf(k) >= 0 && k) startNow();
      if (k === "w") setDir(s1, 0, -1);
      else if (k === "s") setDir(s1, 0, 1);
      else if (k === "a") setDir(s1, -1, 0);
      else if (k === "d") setDir(s1, 1, 0);
      // v3.0-r17：方向键只在双人模式管 P2；单人时 P2 是 AI，方向键再去拨它就是作弊
      else if (e.key === "ArrowUp") { setDir(aiMode ? s1 : s2, 0, -1); e.preventDefault(); }
      else if (e.key === "ArrowDown") { setDir(aiMode ? s1 : s2, 0, 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { setDir(aiMode ? s1 : s2, -1, 0); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setDir(aiMode ? s1 : s2, 1, 0); e.preventDefault(); }
      else return;
      if (waiting) startNow();
    });
    const cv = $("snake2Canvas");
    // v4.0：滑动直接定方向；轻点左半屏左转、右半屏右转（双人时左半屏归 P1、右半屏归 P2，都是右转）；开局前点一下才开始
    let waiting = true, ps = null;
    function startNow() { waiting = false; if (!running && !winner) running = true; lastT = 0; moveAcc = 0; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(step); render(); }
    function drawWaiting() {
      const c = cv && cv.getContext && cv.getContext("2d"); if (!c) return;
      c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "bold 22px sans-serif"; c.fillText("👆 点一下开始", W / 2, H / 2 - 20);
      c.font = "14px sans-serif"; c.fillStyle = "rgba(255,255,255,.8)";
      c.fillText(aiMode ? "滑动换方向，或点左/右半屏左转/右转" : "左半屏归 P1（WASD），右半屏归 P2（方向键）", W / 2, H / 2 + 12);
    }
    if (cv) {
      cv.addEventListener("pointerdown", (e) => { SFX.unlock(); e.preventDefault(); ps = { x: e.clientX, y: e.clientY }; });
      cv.addEventListener("pointerup", (e) => {
        if (!ps) return;
        const rect = cv.getBoundingClientRect();
        const dx = e.clientX - ps.x, dy = e.clientY - ps.y, sx = ps.x - rect.left; ps = null;
        if (waiting) { startNow(); return; }
        if (winner) return;
        const s = (aiMode || sx < rect.width / 2) ? s1 : s2;
        if (Math.hypot(dx, dy) > 18) {
          if (Math.abs(dx) > Math.abs(dy)) setDir(s, dx > 0 ? 1 : -1, 0); else setDir(s, 0, dy > 0 ? 1 : -1);
          return;
        }
        const d = s.dir;
        if (aiMode && sx < rect.width / 2) setDir(s, d.y, -d.x); // 左转
        else setDir(s, -d.y, d.x); // 右转
      });
      cv.addEventListener("pointercancel", () => { ps = null; });
    }
    $("snake2ResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); waiting = false; raf = requestAnimationFrame(step); });
    const modeBtn = $("snake2ModeBtn");
    if (modeBtn) modeBtn.addEventListener("click", () => { aiMode = !aiMode; if (raf) cancelAnimationFrame(raf); raf = null; reset(); running = false; waiting = true; draw(); drawWaiting(); });
    toyLeaveCleanup.snake2 = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    toyEnterResume.snake2 = () => { if (waiting) { draw(); drawWaiting(); return; } if (!winner && !running) { running = true; lastT = 0; moveAcc = 0; raf = requestAnimationFrame(step); } }; // R19：同叠塔，切走再回来蛇冻住（实测 running 从 true 变 false，且点画布只转向不续跑）
    reset(); running = false; draw(); drawWaiting(); render(); // v4.0：不再一打开就开跑，等玩家点一下
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
    function serve(dir) { pongTrail = [];
      const ang = (Math.random() - 0.5) * 0.9;
      ball = { x: W / 2, y: H / 2, vx: dir * 3.4 * Math.cos(ang), vy: 3.4 * Math.sin(ang) };
    }
    function step(now) {
      if (!running || over) return;
      if (!lastT) lastT = now;
      const dt = Math.min(33, now - lastT); // R21：上限 50ms 时 k≈3，满速球一步 21px 会越过 16px 宽的挡板判定区直接穿过去丢分；33ms 时 k≤2、一步 ≤14px，必落在判定区内
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
      if (ball.x < 0) { cs++; SFX.lose(); checkOver(); if (!over) serve(1); }
      if (ball.x > W) { ps++; if (SFX.enabled) SFX.pop(0.7); checkOver(); if (!over) serve(-1); }
      draw(); render();
      if (!over) raf = requestAnimationFrame(step);
    }
    function checkOver() {
      if (ps >= 5 || cs >= 5) {
        over = true; running = false;
        { if (ps >= 5) SFX.win(); else SFX.lose(); }
      }
    }
    let pongTrail = null;
    function draw() {
      const cv = $("pongCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        PAINT.bg(ctx, W, H);
        ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.font = "900 64px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ps, W / 4, H / 2); ctx.fillText(cs, W * 3 / 4, H / 2); ctx.textBaseline = "alphabetic";
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.setLineDash([]);
        const pad = (x, y, c1, c2) => { const g = ctx.createLinearGradient(0, y - PH / 2, 0, y + PH / 2); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.shadowColor = c1; ctx.shadowBlur = 12; ctx.fillStyle = g; PAINT.rr(ctx, x, y - PH / 2, PW, PH, PW / 2); ctx.fill(); ctx.shadowBlur = 0; };
        pad(16, py, "#818cf8", "#22d3ee");
        pad(W - 16 - PW, cy, "#fb7185", "#f97316");
        PAINT.ball(ctx, { x: ball.x, y: ball.y, r: 6 }, running && !over ? (pongTrail = pongTrail || []) : null);
        if (over) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(ps >= 5 ? "🎉 你赢了！" : "😅 电脑赢了", W / 2, H / 2);
        } else if (!running) {
          // R23：开局画布空白，新人不知道要点一下开始（打砖块2 同款提示）
          ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("👆 点一下开始", W / 2, H / 2);
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
      // v4.2：相对拖动（手指在画面哪里都能推球拍，不会挡住球）
      relDrag(cv, () => ({ x: 0, y: py }), (x, y) => { py = Math.max(PH / 2, Math.min(H - PH / 2, y)); }, { lw: 320, lh: 220, hoverAbs: true, gain: 1.3 });
      cv.addEventListener("pointerdown", () => { SFX.unlock(); if (!running && !over) { running = true; raf = requestAnimationFrame(step); } });
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
      get pong() { return { ps, cs, diff, over, ball: ball ? { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy } : null, py }; },
      pongSetDiff(d) { diff = d; render(); },
      pongStart() { if (!running && !over) { running = true; raf = requestAnimationFrame(step); } },
      pongSet(b, py2) { if (b) ball = { x: b.x, y: b.y, vx: b.vx, vy: b.vy }; if (py2 !== undefined) py = py2; }, // R21：探针用
    }));
  };

  /* ---- 4. arkanoid 打砖块2 ---- */
  toyInitFns["arkanoid"] = function () {
    const W = 320, H = 400;
    let paddle = null, balls = [], bricks = [], items = [], lasers = [], level = 1, score = 0, lives = 3, running = false, raf = null, longT = 0, started = false;
    let lastT = 0, laserLast = 0; // R21：激光冷却计时
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
              cvFX("arkanoidCanvas", br.x + br.w / 2, br.y + br.h / 2, null, 10);
              SFX.pop(0.5);
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
        SFX.lose();
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
      if (lasers.length && now - laserLast >= 700) { // R21：原来每帧 10% 概率打一砖，6 秒约 36 砖、一把激光单刷一整关；改 700ms 一发，6 秒最多 8 砖
        laserLast = now;
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
        if (level > 3) { running = false; SFX.win(); draw(); render(); return; }
        buildLevel(level);
        balls = [{ x: W / 2, y: H - 40, vx: 2.6, vy: -3.4, r: 6 }];
        SFX.win();
      }
      draw(); render();
      raf = requestAnimationFrame(step);
    }
    function draw() {
      const cv = $("arkanoidCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        PAINT.bg(ctx, W, H);
        for (const br of bricks) {
          if (br.hp <= 0) continue;
          PAINT.brick(ctx, br.x, br.y, br.w, br.h, br.color);
          if (br.hp > 1) { ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2; PAINT.rr(ctx, br.x + 2, br.y + 2, br.w - 4, br.h - 4, 3); ctx.stroke(); }
        }
        const pw = longT > 0 ? 120 : 80;
        PAINT.paddle(ctx, paddle.x, H - 24, pw, 12);
        for (const b of balls) PAINT.ball(ctx, b, running ? (b.trail = b.trail || []) : null);
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
    function canvasStart() { // R21：画布一直写着“👆 点一下开始”，但点画布只移挡板不开局，只能点重开按钮
      if (running) return;
      if (raf) cancelAnimationFrame(raf);
      if (lives <= 0 || level > 3) reset(); else running = true;
      started = true;
      raf = requestAnimationFrame(step);
    }
    const cv = $("arkanoidCanvas");
    if (cv) {
      const move = (e) => {
        const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, width: 320 };
        const x = (e.clientX - rect.left) * 320 / (rect.width || 320);
        const pw = longT > 0 ? 120 : 80;
        paddle.x = Math.max(0, Math.min(W - pw, x - pw / 2));
      };
      // v4.2：相对拖动
      relDrag(cv, () => ({ x: paddle.x, y: 0 }), (x, y, abs) => { const pw = longT > 0 ? 120 : 80; paddle.x = Math.max(0, Math.min(W - pw, abs ? x - pw / 2 : x)); }, { lw: 320, lh: 400, hoverAbs: true });
      cv.addEventListener("pointerdown", () => { SFX.unlock(); canvasStart(); });
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
      get arkanoid() { return { level, score, lives, bricks: bricks.filter((b) => b.hp > 0).length, running, ball: balls[0] ? { x: balls[0].x, y: balls[0].y } : null, balls: balls.length, lasers: lasers.length }; },
      arkanoidStart() { if (!running && lives > 0 && level <= 3) { running = true; started = true; raf = requestAnimationFrame(step); } },
      arkanoidSet(balls2, lasers2) { if (balls2) balls = balls2.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: 6 })); if (lasers2) lasers = lasers2.map((l) => ({ x: l.x })); }, // R21：探针用
    }));
  };

  /* ---- 5. mines2 大扫雷 ---- */
  toyInitFns["mines2"] = function () {
    const N = 16, MINES = 40;
    const KEY = "dorm-toybox-mines2-best-v1";
    let board = [], revealed = 0, flags = 0, over = false, win = false, flagMode = false, startTime = 0;
    let mines2SuppressCtx = false; // R19：安卓长按会同时触发 450ms 计时插旗 + contextmenu；计时插旗后压住一次 contextmenu，手指抬起即清（不用时间窗口，免得 1 秒内右键点别的格被误吞）
    let mines2SuppressClick = false; // R19：长按拔旗后随之而来的 click（点在新格子上）也要压一次，不然刚拔掉旗就把格子点开了，雷区直接炸
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
        SFX.lose();
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
        SFX.win();
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
        const NUMC = ["", "#6ea8ff", "#5fd38d", "#ff7b72", "#c792ea", "#ffb86b", "#56d4dd", "#e6e6e6", "#a0a0a0"];
        d.style.cssText = "aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;cursor:pointer;border-radius:3px;line-height:1;" +
          (c.open ? (c.mine ? "background:#e5484d;color:#fff;" : "background:#151925;color:" + (NUMC[c.num] || "#fff") + ";")
            : "background:linear-gradient(180deg,#4a5578,#363f5c);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);");
        if (c.open) d.textContent = c.mine ? "💣" : (c.num > 0 ? c.num : "");
        else if (c.flag) d.textContent = "🚩";
        d.addEventListener("click", () => { if (mines2SuppressClick) { mines2SuppressClick = false; return; } SFX.unlock(); flagMode ? toggleFlag(x, y) : open(x, y); }); // R19：长按刚结束的这次 click 是同一按压的尾巴，吞掉（格子重建后 click 会落到新格子上，per-cell 标记拦不住，必须用共享标记）
        d.addEventListener("contextmenu", (e) => { e.preventDefault(); if (mines2SuppressCtx) return; toggleFlag(x, y); }); // R19：长按计时刚插过旗时，这次 contextmenu 是同一按压的重复触发，吞掉（标记由 pointerup 统一转成 click 压制，不在这里清，不然抬指后的 click 拦不住）
        let pressT = null;
        d.addEventListener("pointerdown", (e) => { mines2SuppressClick = false; mines2SuppressCtx = false; if (e && e.button !== undefined && e.button !== 0) return; pressT = setTimeout(() => { toggleFlag(x, y); mines2SuppressCtx = true; pressT = null; }, 450); }); // R19：右键不进长按计时（同小扫雷）；新一按先清掉上一按残留的压制（浏览器没发 click 时它会一直留着）
        d.addEventListener("pointerup", () => { if (pressT) { clearTimeout(pressT); pressT = null; } if (mines2SuppressCtx) { mines2SuppressCtx = false; mines2SuppressClick = true; } }); // R19：长按过才转一次 click 压制；普通点按（计时没到）不压，下次 click 正常开格
        d.addEventListener("pointercancel", () => { if (pressT) { clearTimeout(pressT); pressT = null; } mines2SuppressCtx = false; }); // R19：系统手势打断长按也要清计时，不然手指都走了还会插旗
        d.addEventListener("pointerleave", () => { if (pressT) { clearTimeout(pressT); pressT = null; } mines2SuppressCtx = false; }); // R19：手指滑出格子也要清计时
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
    // v4.0 重写：完整规则（将军、不能送将、将帅照面、将死/困毙判负）+ α-β 搜索 AI + 悔棋
    const W = 320, H = 352, CW = W / 9, CH = H / 10;
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
    const NAME_R = { K: "帅", A: "仕", B: "相", R: "车", N: "马", C: "炮", P: "兵" };
    const NAME_B = { K: "将", A: "士", B: "象", R: "车", N: "马", C: "炮", P: "卒" };
    const VAL = { K: 10000, R: 600, N: 270, C: 285, B: 120, A: 120, P: 30 };
    const LEVELS = { easy: { depth: 1, noise: 120, name: "简单" }, normal: { depth: 2, noise: 25, name: "中等" }, hard: { depth: 4, noise: 4, name: "困难" } };
    const LV_KEY = "dorm-toybox-chess-level-v1";
    let level = lsGet(LV_KEY, "normal"); if (!LEVELS[level]) level = "normal";
    let board = [], sel = null, turn = "r", over = false, msg = "", last = null, history = [], thinking = false, checkFlash = 0;
    function reset() {
      board = INIT.map((r) => r.slice());
      sel = null; turn = "r"; over = false; last = null; history = []; thinking = false;
      msg = "你执红先走 · AI " + LEVELS[level].name;
      draw(); render();
    }
    const inB = (x, y) => x >= 0 && x <= 8 && y >= 0 && y <= 9;
    const inPalace = (x, y, red) => x >= 3 && x <= 5 && (red ? y >= 7 : y <= 2);
    // 伪合法着法（不检查送将）
    function pseudo(b, x, y) {
      const p = b[y][x];
      if (!p) return [];
      const red = p[0] === "r", t = p[1], out = [];
      const add = (nx, ny) => { if (!inB(nx, ny)) return; const q = b[ny][nx]; if (!q || (q[0] === "r") !== red) out.push([nx, ny]); };
      if (t === "R" || t === "C") {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy, jumped = false;
          while (inB(nx, ny)) {
            const q = b[ny][nx];
            if (t === "R") { if (!q) out.push([nx, ny]); else { if ((q[0] === "r") !== red) out.push([nx, ny]); break; } }
            else if (!jumped) { if (!q) out.push([nx, ny]); else jumped = true; }
            else if (q) { if ((q[0] === "r") !== red) out.push([nx, ny]); break; }
            nx += dx; ny += dy;
          }
        }
      } else if (t === "N") {
        for (const [dx, dy, lx, ly] of [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]]) {
          if (!inB(x + dx, y + dy) || b[y + ly][x + lx]) continue;
          add(x + dx, y + dy);
        }
      } else if (t === "B") {
        for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) {
          const nx = x + dx, ny = y + dy;
          if (!inB(nx, ny) || b[y + dy / 2][x + dx / 2]) continue;
          if (red ? ny < 5 : ny > 4) continue;
          add(nx, ny);
        }
      } else if (t === "A") {
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (inPalace(x + dx, y + dy, red)) add(x + dx, y + dy);
      } else if (t === "K") {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inPalace(x + dx, y + dy, red)) add(x + dx, y + dy);
      } else if (t === "P") {
        const fwd = red ? -1 : 1, crossed = red ? y <= 4 : y >= 5;
        add(x, y + fwd);
        if (crossed) { add(x + 1, y); add(x - 1, y); }
      }
      return out;
    }
    function findK(b, c) { for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) if (b[y][x] === c + "K") return [x, y]; return null; }
    function attacked(b, tx, ty, byColor) {
      for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = b[y][x];
        if (!p || p[0] !== byColor) continue;
        if (pseudo(b, x, y).some(([mx, my]) => mx === tx && my === ty)) return true;
      }
      return false;
    }
    function kingsFace(b) {
      const rk = findK(b, "r"), bk = findK(b, "b");
      if (!rk || !bk || rk[0] !== bk[0]) return false;
      for (let y = bk[1] + 1; y < rk[1]; y++) if (b[y][rk[0]]) return false;
      return true;
    }
    function inCheck(b, c) {
      const k = findK(b, c);
      if (!k) return true;
      return kingsFace(b) || attacked(b, k[0], k[1], c === "r" ? "b" : "r");
    }
    function legalFrom(b, x, y) {
      const p = b[y][x];
      if (!p) return [];
      return pseudo(b, x, y).filter(([tx, ty]) => {
        const cap = b[ty][tx];
        b[ty][tx] = p; b[y][x] = null;
        const bad = inCheck(b, p[0]);
        b[y][x] = p; b[ty][tx] = cap;
        return !bad;
      });
    }
    function allLegal(b, c) {
      const out = [];
      for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = b[y][x];
        if (p && p[0] === c) for (const [tx, ty] of legalFrom(b, x, y)) out.push([x, y, tx, ty]);
      }
      return out;
    }
    // ---- AI：负极大值 + α-β，伪合法着法里吃将即胜 ----
    function posBonus(t, red, x, y) {
      const fy = red ? 9 - y : y; // 前进步数（0=己方底线）
      if (t === "P") return fy >= 5 ? 40 + (x >= 2 && x <= 6 ? 20 : 0) + (fy >= 7 ? 10 : 0) : fy * 4;
      if (t === "N" || t === "C") return (x >= 2 && x <= 6 ? 12 : 0) + Math.min(fy, 6) * 3;
      if (t === "R") return Math.min(fy, 6) * 4;
      return 0;
    }
    function evaluate(b) { // 黑方视角
      let s = 0;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = b[y][x]; if (!p) continue;
        const v = VAL[p[1]] + posBonus(p[1], p[0] === "r", x, y);
        s += p[0] === "b" ? v : -v;
      }
      return s;
    }
    function genOrdered(b, c) {
      const ms = [];
      for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = b[y][x];
        if (!p || p[0] !== c) continue;
        for (const [tx, ty] of pseudo(b, x, y)) {
          const cap = b[ty][tx];
          ms.push([x, y, tx, ty, cap ? VAL[cap[1]] * 10 - VAL[p[1]] / 10 : 0]);
        }
      }
      ms.sort((a, z) => z[4] - a[4]);
      return ms;
    }
    let nodes = 0;
    function search(b, c, depth, alpha, beta) {
      nodes++;
      if (!findK(b, c)) return -100000 - depth;
      if (depth === 0) return (c === "b" ? 1 : -1) * evaluate(b);
      const opp = c === "r" ? "b" : "r";
      let best = -Infinity, any = false;
      for (const [x, y, tx, ty] of genOrdered(b, c)) {
        const p = b[y][x], cap = b[ty][tx];
        if (cap && cap[1] === "K") return 100000 + depth;
        b[ty][tx] = p; b[y][x] = null;
        if (kingsFace(b)) { b[y][x] = p; b[ty][tx] = cap; continue; }
        any = true;
        const v = -search(b, opp, depth - 1, -beta, -alpha);
        b[y][x] = p; b[ty][tx] = cap;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return any ? best : -100000;
    }
    function aiPick() {
      const b = board.map((r) => r.slice());
      const lv = LEVELS[level];
      const moves = allLegal(b, "b");
      if (!moves.length) return null;
      nodes = 0;
      // 吃子着法排前面，根节点也用 α 剪枝（留出随机扰动的余量）
      moves.sort((a, z) => (b[z[3]][z[2]] ? VAL[b[z[3]][z[2]][1]] : 0) - (b[a[3]][a[2]] ? VAL[b[a[3]][a[2]][1]] : 0));
      let bestV = -Infinity;
      let scored = moves.map(([x, y, tx, ty]) => {
        const p = b[y][x], cap = b[ty][tx];
        b[ty][tx] = p; b[y][x] = null;
        const v = -search(b, "r", lv.depth - 1, -Infinity, -(bestV - lv.noise - 1));
        b[y][x] = p; b[ty][tx] = cap;
        if (v > bestV) bestV = v;
        return { m: [x, y, tx, ty], v: v + Math.random() * lv.noise };
      });
      scored.sort((a, z) => z.v - a.v);
      return scored[0].m;
    }
    let mv = null;
    function animateMove() { draw(); if (mv && performance.now() - mv.t0 < 240) requestAnimationFrame(animateMove); else { mv = null; draw(); } }
    function applyMove(fx, fy, tx, ty) {
      mv = { fx, fy, tx, ty, cap: board[ty][tx], t0: performance.now() };
      requestAnimationFrame(animateMove);
      if (board[ty][tx]) setTimeout(() => { const cv = $("chessCanvas"); if (cv) { const r = cv.getBoundingClientRect(); FX.sparkle(r.left + (tx + 0.5) * r.width / 9, r.top + (ty + 0.5) * r.height / 10, ["#ffd43b", "#ff6b6b", "#fff"], 12); } }, 220);
      history.push({ board: board.map((r) => r.slice()), last, turn });
      const cap = board[ty][tx];
      board[ty][tx] = board[fy][fx]; board[fy][fx] = null;
      last = { fx, fy, tx, ty };
      turn = turn === "r" ? "b" : "r";
      if (SFX.enabled) { if (cap) SFX.pop ? SFX.pop() : SFX.click(); else SFX.click(); }
      // 终局与将军
      const moves = allLegal(board, turn);
      const chk = inCheck(board, turn);
      if (!moves.length) {
        over = true;
        const redWins = turn === "b";
        msg = redWins ? (chk ? "🎉 将死！你赢了" : "🎉 黑方困毙，你赢了") : (chk ? "😵 被将死了，AI 赢" : "😵 你无子可动（困毙），AI 赢");
        { if (redWins) SFX.win(); else SFX.lose(); }
      } else if (chk) {
        msg = turn === "r" ? "⚠️ 将军！快应将" : "将军！";
        checkFlash = Date.now();
      } else {
        msg = turn === "r" ? "轮到你走（红）" : "AI 思考中…";
      }
    }
    function aiTurn() {
      if (over || turn !== "b") return;
      thinking = true; render();
      setTimeout(() => {
        const m = aiPick();
        thinking = false;
        if (!m) { over = true; msg = "🎉 你赢了！"; draw(); render(); return; }
        applyMove(m[0], m[1], m[2], m[3]);
        draw(); render();
      }, 60);
    }
    function onTap(x, y) {
      if (over || turn !== "r" || thinking) return;
      SFX.unlock();
      if (sel) {
        const ms = legalFrom(board, sel.x, sel.y);
        if (ms.some(([mx, my]) => mx === x && my === y)) {
          sel = null;
          applyMove(sel0.x, sel0.y, x, y);
          draw(); render();
          if (!over) setTimeout(aiTurn, 250);
          return;
        }
        // 点了不能走的地方：要是送将的走法给个提示
        if (pseudo(board, sel.x, sel.y).some(([mx, my]) => mx === x && my === y)) {
          msg = inCheck(board, "r") ? "⚠️ 正被将军，这步解不了将" : "⚠️ 这步会送将，不能走";
          draw(); render(); return;
        }
      }
      const p = board[y] && board[y][x];
      if (p && p[0] === "r") { sel = { x, y }; sel0 = sel; if (SFX.enabled) SFX.click(); msg = inCheck(board, "r") ? "⚠️ 将军！快应将" : "轮到你走（红）"; }
      else sel = null;
      draw(); render();
    }
    let sel0 = null;
    function undo() {
      if (thinking || !history.length) return;
      let h = history.pop();
      while (h.turn !== "r" && history.length) h = history.pop();
      if (h.turn !== "r") return;
      board = h.board; last = h.last; turn = "r"; over = false; sel = null;
      msg = "已悔棋，轮到你走";
      draw(); render();
    }
    function draw() {
      const cv = $("chessCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        const g = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, W, H) : null;
        if (g) { g.addColorStop(0, "#f1d49c"); g.addColorStop(1, "#dcb26e"); ctx.fillStyle = g; } else ctx.fillStyle = "#e8c98a";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#7a4a1e"; ctx.lineWidth = 1;
        const X = (i) => i * CW + CW / 2, Y = (i) => i * CH + CH / 2;
        ctx.strokeRect(X(0) - 4, Y(0) - 4, X(8) - X(0) + 8, Y(9) - Y(0) + 8);
        for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(X(0), Y(i)); ctx.lineTo(X(8), Y(i)); ctx.stroke(); }
        for (let i = 0; i < 9; i++) {
          ctx.beginPath(); ctx.moveTo(X(i), Y(0)); ctx.lineTo(X(i), Y(i === 0 || i === 8 ? 9 : 4)); ctx.stroke();
          if (i > 0 && i < 8) { ctx.beginPath(); ctx.moveTo(X(i), Y(5)); ctx.lineTo(X(i), Y(9)); ctx.stroke(); }
        }
        for (const [y0, y1] of [[0, 2], [7, 9]]) {
          ctx.beginPath(); ctx.moveTo(X(3), Y(y0)); ctx.lineTo(X(5), Y(y1)); ctx.moveTo(X(5), Y(y0)); ctx.lineTo(X(3), Y(y1)); ctx.stroke();
        }
        ctx.fillStyle = "#7a4a1e"; ctx.font = "bold 16px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("楚 河", X(2), (Y(4) + Y(5)) / 2); ctx.fillText("汉 界", X(6), (Y(4) + Y(5)) / 2);
        if (last) {
          ctx.strokeStyle = "rgba(30,110,255,.85)"; ctx.lineWidth = 2;
          for (const [lx, ly] of [[last.fx, last.fy], [last.tx, last.ty]]) {
            const cx = X(lx), cy = Y(ly), r = 16, k = 5;
            ctx.beginPath();
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              ctx.moveTo(cx + sx * r, cy + sy * (r - k)); ctx.lineTo(cx + sx * r, cy + sy * r); ctx.lineTo(cx + sx * (r - k), cy + sy * r);
            }
            ctx.stroke();
          }
        }
        const ms = sel ? legalFrom(board, sel.x, sel.y) : [];
        const chk = !over && inCheck(board, turn) ? findK(board, turn) : null;
        // v4.1：走子滑动动画——移动中的棋子最后画、带一点抬起；被吃的子在落点淡出
        const k = mv ? Math.min(1, (performance.now() - mv.t0) / 240) : 1, ek = 1 - Math.pow(1 - k, 3);
        const piece = (p, cx, cy, lift, alpha) => {
          const red = p[0] === "r";
          ctx.globalAlpha = alpha == null ? 1 : alpha;
          ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.arc(cx + 1.5 + lift / 2, cy + 2.5 + lift, 15, 0, 7); ctx.fill();
          ctx.fillStyle = lift ? "#fff3c4" : "#f7e7c6";
          ctx.beginPath(); ctx.arc(cx, cy - lift, 15, 0, 7); ctx.fill();
          ctx.strokeStyle = red ? "#b8261b" : "#1d1d1d"; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(cx, cy - lift, 12.5, 0, 7); ctx.stroke();
          ctx.fillStyle = red ? "#b8261b" : "#1d1d1d";
          ctx.font = "bold 16px 'KaiTi','STKaiti',serif";
          ctx.fillText((red ? NAME_R : NAME_B)[p[1]], cx, cy + 1 - lift);
          ctx.globalAlpha = 1;
        };
        for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
          const p = board[y][x];
          const cx = X(x), cy = Y(y);
          if (mv && k < 1 && x === mv.tx && y === mv.ty) { if (mv.cap) piece(mv.cap, cx, cy, 0, 1 - ek); continue; }
          if (!p) continue;
          const isSel = sel && sel.x === x && sel.y === y;
          piece(p, cx, cy, isSel ? 2 : 0);
          if (chk && chk[0] === x && chk[1] === y) { ctx.strokeStyle = "#ff2d2d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, 7); ctx.stroke(); }
        }
        if (mv && k < 1 && board[mv.ty][mv.tx]) {
          const cx = X(mv.fx) + (X(mv.tx) - X(mv.fx)) * ek, cy = Y(mv.fy) + (Y(mv.ty) - Y(mv.fy)) * ek;
          piece(board[mv.ty][mv.tx], cx, cy, Math.sin(k * Math.PI) * 6);
        }
        for (const [mx, my] of ms) {
          const cx = X(mx), cy = Y(my);
          if (board[my][mx]) { ctx.strokeStyle = "rgba(220,40,40,.9)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.stroke(); }
          else { ctx.fillStyle = "rgba(30,110,255,.55)"; ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, 7); ctx.fill(); }
        }
        ctx.textBaseline = "alphabetic";
      } catch (e) {}
    }
    function render() {
      $("chessMsg").textContent = thinking ? "AI 思考中…" : msg;
      document.querySelectorAll("#chessLevels [data-lv]").forEach((b) => b.classList.toggle("active", b.getAttribute("data-lv") === level));
    }
    const cv = $("chessCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
      const x = Math.floor((e.clientX - rect.left) * 9 / (rect.width || W));
      const y = Math.floor((e.clientY - rect.top) * 10 / (rect.height || H));
      if (inB(x, y)) onTap(x, y);
    });
    $("chessResetBtn").addEventListener("click", reset);
    if ($("chessUndoBtn")) $("chessUndoBtn").addEventListener("click", undo);
    document.querySelectorAll("#chessLevels [data-lv]").forEach((b) => b.addEventListener("click", () => {
      level = b.getAttribute("data-lv"); lsSet(LV_KEY, level); reset();
    }));
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get chess() { return { turn: turn === "r" ? "red" : "black", over, msg, level, nodes }; },
      chessMove(fx, fy, tx, ty) {
        if (over || turn !== "r") return false;
        if (!legalFrom(board, fx, fy).some(([mx, my]) => mx === tx && my === ty)) return false;
        applyMove(fx, fy, tx, ty); draw(); render(); return true;
      },
      chessAi() { if (turn === "b" && !over) { const m = aiPick(); if (m) applyMove(m[0], m[1], m[2], m[3]); draw(); render(); } },
      chessSet(rows, t) { board = rows.map((r) => r.slice()); turn = t || "r"; over = false; history = []; last = null; draw(); render(); },
      chessLegal(c) { return allLegal(board, c || turn).length; },
      chessInCheck(c) { return inCheck(board, c || turn); },
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
      turn = "black"; over = false; passes = 0; capB = 0; capW = 0; lastAi = null;
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
      goDrop = { x, y, t0: performance.now() };
      for (const [sx, sy] of capturedStones) goFading.push({ x: sx, y: sy, s: opp, t0: performance.now() });
      if (captured) { FX.buzz(captured > 2 ? [20, 30, 20] : 15); setTimeout(() => { const cv = $("goCanvas"); if (cv) { const r = cv.getBoundingClientRect(); capturedStones.forEach(([sx, sy]) => FX.sparkle(r.left + (sx + 0.5) * r.width / N, r.top + (sy + 0.5) * r.height / N, opp === "black" ? ["#333", "#888"] : ["#fff", "#ddd"], 6)); } }, 60); }
      if (SFX.enabled) SFX.click();
      return true;
    }
    function aiMove() {
      // v4.0：启发式 AI——提子 > 救自己被打吃的子 > 打吃对方 > 占要点；不填自己的眼、不自紧气；没有好棋就停一手
      if (over || turn !== "white") return;
      const best = aiPick();
      if (best && play(best.x, best.y, "white")) { passes = 0; turn = "black"; lastAi = [best.x, best.y]; draw(); render(); return; }
      doPass();
    }
    let lastAi = null;
    function regionOwner(x, y) {
      // 空点所在的空域只被一种颜色包围时返回那个颜色
      const seen = new Set([x + "," + y]), stack = [[x, y]], borders = new Set();
      let size = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop(); size++;
        for (const [nx, ny] of neighbors(cx, cy)) {
          const v = board[ny][nx];
          if (v === null) { const k = nx + "," + ny; if (!seen.has(k)) { seen.add(k); stack.push([nx, ny]); } }
          else borders.add(v);
        }
      }
      return borders.size === 1 ? { owner: [...borders][0], size } : { owner: null, size };
    }
    function isEyeOf(x, y, color) {
      if (!neighbors(x, y).every(([nx, ny]) => board[ny][nx] === color)) return false;
      let bad = 0, edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (board[ny][nx] && board[ny][nx] !== color) bad++;
      }
      return edge ? bad === 0 : bad <= 1;
    }
    function aiPick() {
      const me = "white", opp = "black";
      const stones = board.flat().filter(Boolean).length;
      // 先记下双方处于危险（1-2 气）的棋块
      const atari = { white: [], black: [] }, seenG = new Set();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const v = board[y][x]; if (!v || seenG.has(x + "," + y)) continue;
        const g = group(x, y, v); g.stones.forEach(([sx, sy]) => seenG.add(sx + "," + sy));
        if (g.libs <= 2) atari[v].push(g);
      }
      let bestM = null;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (board[y][x]) continue;
        if (isEyeOf(x, y, me)) continue; // 不填自己的眼
        const reg = regionOwner(x, y);
        // 试下
        board[y][x] = me;
        let cap = 0, ataris = 0;
        for (const [nx, ny] of neighbors(x, y)) {
          if (board[ny][nx] === opp) { const g = group(nx, ny, opp); if (g.libs === 0) cap += g.stones.length; else if (g.libs === 1) ataris += g.stones.length; }
        }
        const self = group(x, y, me);
        board[y][x] = null;
        if (self.libs === 0 && cap === 0) continue; // 自杀
        let sc = cap * 30 + ataris * 7;
        // 救被打吃的己方棋块
        for (const g of atari.white) if (g.libs === 1 && g.stones.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) === 1)) sc += self.libs >= 3 ? 26 * g.stones.length : self.libs === 2 ? 8 : 0;
        if (self.libs === 1 && cap === 0) sc -= 45; // 自己往打吃里送
        else if (self.libs === 2 && self.stones.length > 2 && cap === 0) sc -= 6;
        // 己方领地里落子没意义；对方领地里（小空域）也多半是送死
        if (reg.owner === me && reg.size <= 12) sc -= 40;
        if (reg.owner === opp && reg.size <= 4 && cap === 0) sc -= 25;
        // 位置：开局重视三、四线，中盘看接触
        const line = Math.min(x, y, N - 1 - x, N - 1 - y);
        if (stones < 12) sc += [-6, 1, 6, 5, 4][line] || 0;
        let nearMe = 0, nearOpp = 0;
        for (const [nx, ny] of neighbors(x, y)) { if (board[ny][nx] === me) nearMe++; else if (board[ny][nx] === opp) nearOpp++; }
        sc += nearOpp * 2 + Math.min(nearMe, 1) * 1.5 - (nearMe >= 3 ? 4 : 0);
        sc += Math.random() * 2.5;
        if (!bestM || sc > bestM.sc) bestM = { x, y, sc };
      }
      // 没有正分的棋：停一手（中盘以后）
      if (!bestM || (bestM.sc < 2.5 && stones > 20)) return null;
      return bestM;
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
      { if (b > w) SFX.win(); else SFX.lose(); }
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
    let goDrop = null, goFading = [];
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
        // v4.1：新落的子从大到小“啪”地落下，被提的子淡出缩小
        const now = performance.now();
        const stone = (cx, cy, s, sc, alpha) => {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2, 13 * sc, 0, 7); ctx.fill();
          const g = ctx.createRadialGradient(cx - 4 * sc, cy - 4 * sc, 2, cx, cy, 13 * sc);
          if (s === "black") { g.addColorStop(0, "#6b6b6b"); g.addColorStop(1, "#0d0d0d"); } else { g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#c9c9c9"); }
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 13 * sc, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
        };
        for (const f of goFading) { const k = (now - f.t0) / 320; if (k < 1) stone(CELL / 2 + f.x * CELL, CELL / 2 + f.y * CELL, f.s, 1 - k * 0.4, 1 - k); }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const s = board[y][x];
          if (!s) continue;
          const cx = CELL / 2 + x * CELL, cy = CELL / 2 + y * CELL;
          let sc = 1;
          if (goDrop && goDrop.x === x && goDrop.y === y) { const k = Math.min(1, (now - goDrop.t0) / 200); sc = k < 0.7 ? 1.5 - k / 0.7 * 0.6 : 0.9 + (k - 0.7) / 0.3 * 0.1; }
          stone(cx, cy, s, sc, 1);
          if (lastAi && lastAi[0] === x && lastAi[1] === y) { ctx.fillStyle = "#e5484d"; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill(); }
        }
        goFading = goFading.filter((f) => now - f.t0 < 320);
        if ((goDrop && now - goDrop.t0 < 200) || goFading.length) requestAnimationFrame(draw); else goDrop = null;
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
    let pile = [], pendingWild = null, aiTimer = null; // R20：aiTimer 记待定的 AI 回应，重开要取消
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
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } // R20：重开取消待定的 AI 回应，不然旧回应会在新局里替 AI 出牌
      deck = buildDeck(); pile = []; pendingWild = null;
      pHand = []; aiHand = [];
      for (let i = 0; i < 7; i++) { pHand.push(drawCard()); aiHand.push(drawCard()); }
      let guard = 0;
      do { top = drawCard(); if (top.c === "wild") deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, top); guard++; } while (top.c === "wild" && guard < 50); // R20：万能顶牌按规则放回牌堆重抽，之前直接丢了，牌堆少一张
      turn = "p"; over = false; drawCount = 0; drewThisTurn = false;
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
      drewThisTurn = false;
      pendingWild = null; // R20：选色中改出别的牌时，旧的待选状态不能残留
      pHand.splice(i, 1);
      recycleTop();
      top = card;
      if (SFX.enabled) SFX.pop(0.6);
      if (pHand.length === 0) { gameOver("p"); return; }
      const skip = applyEffect(card, false, color);
      draw(); render(skip ? "AI 被跳过，继续你出！" : "AI 出牌中…");
      if (!skip) { turn = "ai"; aiTimer = setTimeout(aiPlay, 700); } // R20：记下计时器，重开可取消
      else draw();
    }
    function aiPlay() {
      aiTimer = null; // R20：回应已到点，计时器不再待定
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
      if (skip) { render("你被跳过了，AI 继续！"); aiTimer = setTimeout(aiPlay, 700); } // R20：记下计时器，重开可取消
      else { turn = "p"; draw(); render("轮到你出牌"); }
    }
    function gameOver(winner) {
      over = true;
      { if (winner === "p") SFX.win(); else SFX.lose(); }
      draw(); render(winner === "p" ? "🎉 你赢了！" : "😅 AI 赢了");
    }
    const UNO_BG = { red: "#e5484d", yellow: "#f2b51d", green: "#3fa34d", blue: "#3d6fe0" };
    const UNO_ORDER = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
    const unoLabel = (c) => c.n === "wild" ? "🌈" : c.n === "skip" ? "⊘" : c.n === "rev" ? "⇄" : c.n;
    function unoCardEl(c, cls) {
      const el = document.createElement("div");
      el.className = "uno-card " + (c.c === "wild" ? "wild" : "") + (cls ? " " + cls : "");
      if (c.c !== "wild") el.style.background = UNO_BG[c.c];
      const corner = document.createElement("small"); corner.textContent = unoLabel(c);
      const mid = document.createElement("b"); mid.textContent = unoLabel(c);
      el.appendChild(corner); el.appendChild(mid);
      return el;
    }
    let drewThisTurn = false, unoSeenTop = null, unoSeenCards = null;
    function draw() {
      const t = $("unoTop");
      if (t && !pendingWild) {
        t.innerHTML = "";
        const ai = document.createElement("div"); ai.className = "uno-ai";
        const lbl = document.createElement("span"); lbl.textContent = "🤖 AI " + aiHand.length + " 张" + (aiHand.length === 1 ? " · UNO!" : "");
        ai.appendChild(lbl);
        const backs = document.createElement("div"); backs.className = "uno-backs";
        for (let k = 0; k < Math.min(aiHand.length, 12); k++) { const bk = document.createElement("span"); bk.className = "uno-back"; backs.appendChild(bk); }
        ai.appendChild(backs);
        t.appendChild(ai);
        const center = document.createElement("div"); center.className = "uno-center";
        const deckEl = document.createElement("div"); deckEl.className = "uno-card uno-deck"; { const n = document.createElement("b"); n.textContent = deck.length; n.style.color = "#fff"; deckEl.appendChild(n); deckEl.title = "牌堆剩 " + deck.length + " 张"; }
        center.appendChild(deckEl);
        if (top) { const tEl = unoCardEl(top, "top" + (top !== unoSeenTop ? " played" : "")); center.appendChild(tEl); unoSeenTop = top; }
        if (top && top.c !== "wild") { const cc = document.createElement("span"); cc.className = "uno-curcolor"; cc.style.background = UNO_BG[top.c]; cc.textContent = "当前 " + CNAMES[top.c]; center.appendChild(cc); }
        t.appendChild(center);
      }
      const h = $("unoHand");
      if (h) {
        h.innerHTML = "";
        // 手牌按颜色、数字排好
        const order = pHand.map((c, i) => i).sort((x, y) => (UNO_ORDER[pHand[x].c] - UNO_ORDER[pHand[y].c]) || String(pHand[x].n).localeCompare(String(pHand[y].n)));
        const myTurn = turn === "p" && !over;
        order.forEach((i) => {
          const c = pHand[i];
          const ok = myTurn && canPlay(c) && (!drewThisTurn || i === pHand.length - 1);
          const el = unoCardEl(c, (myTurn ? (ok ? "playable" : "dim") : "") + (unoSeenCards && !unoSeenCards.has(c) ? " deal" : ""));
          if (myTurn) el.addEventListener("click", () => { if (drewThisTurn && i !== pHand.length - 1) { render("摸到的那张才能出，或者点「不出」"); return; } pPlay(i); });
          h.appendChild(el);
        });
      }
      unoSeenCards = new Set(pHand);
      const db = $("unoDrawBtn");
      if (db) { db.textContent = drewThisTurn ? "不出，结束回合 ▶" : "摸牌"; db.disabled = over || turn !== "p"; }
    }
    function render(m) { $("unoMsg").textContent = m + "（你 " + pHand.length + " 张）"; }
    $("unoDrawBtn").addEventListener("click", () => {
      if (over || turn !== "p") return;
      SFX.unlock();
      pendingWild = null;
      if (drewThisTurn) { drewThisTurn = false; turn = "ai"; draw(); render("AI 出牌中…"); aiTimer = setTimeout(aiPlay, 700); return; }
      const c = drawCard();
      pHand.push(c);
      if (SFX.enabled) SFX.click();
      if (canPlay(c)) { drewThisTurn = true; draw(); render("摸到一张能出的牌，可以直接出，或者点「不出」"); return; }
      draw(); render("摸了一张出不了，轮到 AI");
      turn = "ai"; aiTimer = setTimeout(aiPlay, 700); // R20：记下计时器，重开可取消
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
    // v4.0 重写：你 + 3 家 AI 的四人麻将（万条筒 108 张，可碰、点炮胡、自摸、七对，带听牌提示）
    const SUIT = ["万", "条", "筒"], SUIT_CLS = ["mj-wan", "mj-tiao", "mj-tong"];
    const NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const SEAT = ["你", "下家", "对家", "上家"];
    const STAT_KEY = "dorm-toybox-mj-stats-v1";
    let stats = (() => { try { const v = JSON.parse(lsGet(STAT_KEY, "{}")); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
    stats = { games: stats.games | 0, wins: stats.wins | 0, deals: stats.deals | 0 };
    let wall = [], P = [], cur = 0, phase = "over", last = null, drawn = -1, msg = "", claim = null, timer = null, result = null;
    const tName = (t) => NUM[t % 9] + SUIT[Math.floor(t / 9)];
    const counts = (arr) => { const c = new Array(27).fill(0); for (const t of arr) c[t]++; return c; };
    function canMeld(c, i) {
      while (i < 27 && !c[i]) i++;
      if (i >= 27) return true;
      if (c[i] >= 3) { c[i] -= 3; const ok = canMeld(c, i); c[i] += 3; if (ok) return true; }
      if (i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; const ok = canMeld(c, i); c[i]++; c[i + 1]++; c[i + 2]++; if (ok) return true; }
      return false;
    }
    function isWin(hand) {
      if (hand.length % 3 !== 2) return false;
      const c = counts(hand);
      if (hand.length === 14 && c.every((n) => n === 0 || n === 2 || n === 4)) return true; // 七对
      for (let t = 0; t < 27; t++) if (c[t] >= 2) { c[t] -= 2; const ok = canMeld(c, 0); c[t] += 2; if (ok) return true; }
      return false;
    }
    function waits(hand) { const out = []; for (let t = 0; t < 27; t++) if (isWin(hand.concat([t]))) out.push(t); return out; }
    // 向听数（普通型），AI 用来挑打哪张
    function shanten(hand, melds) {
      const c = counts(hand); let best = 8;
      (function rec(i, m, t, p) {
        while (i < 27 && !c[i]) i++;
        if (i >= 27) { const mm = m + melds; const s = 8 - 2 * mm - Math.min(t, 4 - mm) - p; if (s < best) best = s; return; }
        if (c[i] >= 3) { c[i] -= 3; rec(i, m + 1, t, p); c[i] += 3; }
        if (i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; rec(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
        if (c[i] >= 2) { c[i] -= 2; if (!p) rec(i, m, t, 1); rec(i, m, t + 1, p); c[i] += 2; }
        if (i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; rec(i, m, t + 1, p); c[i]++; c[i + 1]++; }
        if (i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; rec(i, m, t + 1, p); c[i]++; c[i + 2]++; }
        c[i]--; rec(i + 1, m, t, p); c[i]++;
      })(0, 0, 0, 0);
      return best;
    }
    function isolation(hand, t) {
      const c = counts(hand); let s = 0;
      if (c[t] >= 2) s += 3;
      const r = t % 9;
      for (const d of [-2, -1, 1, 2]) { const u = t + d; if (r + d >= 0 && r + d <= 8 && c[u]) s += Math.abs(d) === 1 ? 2 : 1; }
      if (r === 0 || r === 8) s -= 1;
      return s;
    }
    function aiChooseDiscard(p) {
      let best = null;
      const seen = new Set();
      p.hand.forEach((t, i) => {
        if (seen.has(t)) return; seen.add(t);
        const rest = p.hand.slice(); rest.splice(i, 1);
        const sh = shanten(rest, p.melds.length);
        const score = sh * 100 + isolation(rest, t) + Math.random();
        if (!best || score < best.score) best = { i, score };
      });
      return best.i;
    }
    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    function later(fn, ms) { clearTimer(); timer = setTimeout(() => { timer = null; fn(); }, ms); }
    function reset() {
      clearTimer();
      wall = [];
      for (let t = 0; t < 27; t++) for (let k = 0; k < 4; k++) wall.push(t);
      shuffle(wall);
      P = [0, 1, 2, 3].map(() => ({ hand: [], melds: [], river: [] }));
      for (let r = 0; r < 13; r++) for (const p of P) p.hand.push(wall.pop());
      P.forEach((p) => p.hand.sort((a, b) => a - b));
      last = null; claim = null; result = null; drawn = -1;
      stats.deals++; saveStats();
      drawFor(0);
    }
    function saveStats() { lsSet(STAT_KEY, JSON.stringify(stats)); }
    function endGame(winner, how, from) {
      clearTimer(); phase = "over"; claim = null;
      result = { winner, how, from };
      if (winner === 0) { stats.wins++; SFX.win(); }
      else if (SFX.enabled && winner >= 0) SFX.lose();
      stats.games++; saveStats();
      if (winner < 0) msg = "😅 牌摸完了，流局";
      else if (winner === 0) msg = how === "tsumo" ? "🎉 自摸！你胡了" : "🎉 胡了！" + SEAT[from] + "点炮";
      else msg = how === "tsumo" ? "😵 " + SEAT[winner] + "自摸胡了" : (from === 0 ? "😵 你点炮了，" + SEAT[winner] + "胡" : "😐 " + SEAT[winner] + "胡了（" + SEAT[from] + "点炮）");
      draw();
    }
    function drawFor(i) {
      if (!wall.length) { endGame(-1); return; }
      cur = i;
      const t = wall.pop();
      const p = P[i];
      if (i === 0) {
        p.hand.sort((a, b) => a - b);
        p.hand.push(t); drawn = p.hand.length - 1;
        phase = "discard";
        msg = isWin(p.hand) ? "可以自摸！点「胡」，或者继续打一张" : "摸到 " + tName(t) + "，打一张";
        draw();
      } else {
        p.hand.push(t);
        phase = "ai";
        draw();
        later(() => {
          if (isWin(p.hand)) { endGame(i, "tsumo"); return; }
          aiDiscard(i);
        }, 520);
      }
    }
    function aiDiscard(i) {
      const p = P[i];
      const k = aiChooseDiscard(p);
      const t = p.hand.splice(k, 1)[0];
      p.hand.sort((a, b) => a - b);
      afterDiscard(i, t);
    }
    function afterDiscard(i, t) {
      P[i].river.push(t);
      last = { tile: t, from: i };
      if (SFX.enabled) SFX.click();
      resolveClaims(i, t, false);
    }
    function resolveClaims(i, t, skipUser) {
      // 1) 胡（按出牌后的座次优先）
      for (let k = 1; k <= 3; k++) {
        const j = (i + k) % 4;
        if (!isWin(P[j].hand.concat([t]))) continue;
        if (j === 0) { if (skipUser) continue; offer(i, t, true, P[0].hand.filter((x) => x === t).length >= 2); return; }
        P[j].hand.push(t); P[i].river.pop(); endGame(j, "ron", i); return;
      }
      // 2) 碰
      for (let k = 1; k <= 3; k++) {
        const j = (i + k) % 4;
        if (P[j].hand.filter((x) => x === t).length < 2) continue;
        if (j === 0) { if (skipUser) continue; offer(i, t, false, true); return; }
        // AI：碰了能降向听才碰
        const p = P[j], rest = p.hand.slice();
        rest.splice(rest.indexOf(t), 1); rest.splice(rest.indexOf(t), 1);
        const before = shanten(p.hand, p.melds.length);
        let after = 9;
        for (let q = 0; q < rest.length; q++) { const r2 = rest.slice(); r2.splice(q, 1); after = Math.min(after, shanten(r2, p.melds.length + 1)); }
        if (after < before || Math.random() < 0.25) { doPung(j, i, t); return; }
      }
      // 3) 没人要，下家摸牌
      phase = "ai"; draw();
      later(() => drawFor((i + 1) % 4), i === 0 ? 260 : 380);
    }
    function offer(from, t, canRon, canPung) {
      claim = { from, tile: t, canRon, canPung };
      phase = "claim";
      msg = SEAT[from] + "打出 " + tName(t) + (canRon ? "，你能胡！" : "，要碰吗？");
      draw();
    }
    function doPung(j, from, t) {
      const p = P[j];
      p.hand.splice(p.hand.indexOf(t), 1); p.hand.splice(p.hand.indexOf(t), 1);
      p.melds.push([t, t, t]);
      P[from].river.pop();
      last = null; cur = j; claim = null;
      if (SFX.enabled) SFX.pop ? SFX.pop() : SFX.click();
      if (j === 0) { phase = "discard"; drawn = -1; msg = "碰！打一张"; draw(); }
      else { phase = "ai"; msg = SEAT[j] + "碰了 " + tName(t); draw(); later(() => aiDiscard(j), 650); }
    }
    function userDiscard(k) {
      if (phase !== "discard" || cur !== 0) return;
      SFX.unlock();
      const p = P[0];
      const t = p.hand.splice(k, 1)[0];
      p.hand.sort((a, b) => a - b); drawn = -1;
      phase = "ai";
      msg = "你打出 " + tName(t);
      afterDiscard(0, t);
    }
    function userTsumo() { if (phase === "discard" && cur === 0 && isWin(P[0].hand)) endGame(0, "tsumo"); }
    function userClaim(kind) {
      if (phase !== "claim" || !claim) return;
      SFX.unlock();
      const c = claim; claim = null;
      if (kind === "ron") { P[0].hand.push(c.tile); P[c.from].river.pop(); endGame(0, "ron", c.from); return; }
      if (kind === "pung") { doPung(0, c.from, c.tile); return; }
      phase = "ai"; resolveClaims(c.from, c.tile, true);
    }
    // ---- 画面 ----
    function tileEl(t, cls) {
      const d = document.createElement("span");
      d.className = "mj-tile " + SUIT_CLS[Math.floor(t / 9)] + (cls ? " " + cls : "");
      const n = document.createElement("b"); n.textContent = NUM[t % 9];
      const u = document.createElement("i"); u.textContent = SUIT[Math.floor(t / 9)];
      d.appendChild(n); d.appendChild(u);
      d.setAttribute("aria-label", tName(t));
      return d;
    }
    function backEl() { const d = document.createElement("span"); d.className = "mj-tile mj-back"; return d; }
    function draw() {
      const root = $("mjTable"); if (!root) return;
      root.innerHTML = "";
      const showAll = phase === "over";
      // 三家对手
      const opps = document.createElement("div"); opps.className = "mj-opps";
      for (const i of [3, 2, 1]) {
        const p = P[i]; if (!p) continue;
        const box = document.createElement("div");
        box.className = "mj-opp" + (cur === i && phase !== "over" ? " on" : "") + (result && result.winner === i ? " win" : "");
        const h = document.createElement("div"); h.className = "mj-opp-h";
        h.textContent = SEAT[i] + " · " + p.hand.length + "张" + (p.melds.length ? " · 碰" + p.melds.length : "");
        box.appendChild(h);
        if (showAll) { const hh = document.createElement("div"); hh.className = "mj-mini"; p.hand.slice().sort((a, b) => a - b).forEach((t) => hh.appendChild(tileEl(t))); box.appendChild(hh); }
        if (p.melds.length) { const m = document.createElement("div"); m.className = "mj-mini"; p.melds.forEach((ml) => ml.forEach((t) => m.appendChild(tileEl(t)))); box.appendChild(m); }
        const rv = document.createElement("div"); rv.className = "mj-mini mj-river";
        p.river.forEach((t, k) => rv.appendChild(tileEl(t, last && last.from === i && k === p.river.length - 1 ? "last" : "")));
        box.appendChild(rv);
        opps.appendChild(box);
      }
      root.appendChild(opps);
      // 中间信息
      const mid = document.createElement("div"); mid.className = "mj-mid";
      const info = document.createElement("span"); info.textContent = "牌墙 " + wall.length + " · " + (phase === "over" ? "本局结束" : "轮到" + SEAT[cur]);
      mid.appendChild(info);
      if (last && phase !== "over") { const lt = document.createElement("span"); lt.className = "mj-lastwrap"; lt.textContent = SEAT[last.from] + "打 "; lt.appendChild(tileEl(last.tile, "big")); mid.appendChild(lt); }
      root.appendChild(mid);
      // 自己的牌河
      const myRiver = document.createElement("div"); myRiver.className = "mj-mini mj-river mine";
      P[0].river.forEach((t, k) => myRiver.appendChild(tileEl(t, last && last.from === 0 && k === P[0].river.length - 1 ? "last" : "")));
      if (P[0].river.length) root.appendChild(myRiver);
      // 自己的副露 + 手牌
      const me = document.createElement("div"); me.className = "mj-me";
      if (P[0].melds.length) { const m = document.createElement("div"); m.className = "mj-melds"; P[0].melds.forEach((ml) => { const g = document.createElement("span"); g.className = "mj-meld"; ml.forEach((t) => g.appendChild(tileEl(t))); m.appendChild(g); }); me.appendChild(m); }
      const hand = document.createElement("div"); hand.className = "mj-hand";
      const myTurn = phase === "discard" && cur === 0;
      // 打哪张能听牌：标个小点
      const tingIdx = new Set();
      let tingText = "";
      if (myTurn) {
        P[0].hand.forEach((t, k) => { const rest = P[0].hand.slice(); rest.splice(k, 1); if (waits(rest).length) tingIdx.add(k); });
      } else if (phase !== "over") {
        const w = waits(P[0].hand); if (w.length) tingText = "听：" + w.map(tName).join(" ");
      }
      P[0].hand.forEach((t, k) => {
        const el = tileEl(t, (k === drawn ? "drawn" : "") + (tingIdx.has(k) ? " ting" : "") + (myTurn ? " can" : ""));
        if (myTurn) { el.setAttribute("role", "button"); el.addEventListener("click", () => userDiscard(k)); }
        hand.appendChild(el);
      });
      me.appendChild(hand);
      root.appendChild(me);
      // 操作
      const act = $("mjActions");
      if (act) {
        act.innerHTML = "";
        const mk = (txt, cls, fn) => { const b = document.createElement("button"); b.className = "btn small " + cls; b.textContent = txt; b.addEventListener("click", fn); act.appendChild(b); };
        if (phase === "claim" && claim) {
          if (claim.canRon) mk("胡 🎉", "gold-btn", () => userClaim("ron"));
          if (claim.canPung) mk("碰", "gold-btn", () => userClaim("pung"));
          mk("过", "ghost-btn", () => userClaim("pass"));
        } else if (myTurn && isWin(P[0].hand)) mk("自摸 胡 🎉", "gold-btn", userTsumo);
        act.classList.toggle("hidden", !act.children.length);
      }
      $("mjMsg").textContent = msg + (tingText ? " · " + tingText : "") + (myTurn && tingIdx.size && !isWin(P[0].hand) ? " · 带点的牌打出去就听牌" : "");
      $("mjStats").textContent = "胡牌 " + stats.wins + " / " + stats.games + " 局";
    }
    $("mjResetBtn").addEventListener("click", reset);
    toyLeaveCleanup["mahjong"] = () => { /* 离开时暂停 AI 计时，回来续上 */ if (timer) { clearTimer(); pendingResume = true; } };
    let pendingResume = false;
    toyEnterResume["mahjong"] = () => {
      if (!pendingResume) return; pendingResume = false;
      if (phase === "ai") {
        if (P[cur] && P[cur].hand.length % 3 === 2 && cur !== 0) later(() => { if (isWin(P[cur].hand)) endGame(cur, "tsumo"); else aiDiscard(cur); }, 400);
        else if (last) later(() => drawFor((last.from + 1) % 4), 300);
      }
    };
    reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get mahjong() { return { count: P[0].hand.length, over: phase === "over", win: isWin(P[0].hand), hand: P[0].hand.slice(), phase, cur, wall: wall.length, result }; },
      mahjongDiscard(i) { userDiscard(i); },
      mahjongSet(h) { P[0].hand = h.slice().sort((a, b) => a - b); cur = 0; phase = "discard"; drawn = -1; draw(); },
      mahjongWin(h) { return isWin(h); },
      mahjongShanten(h, m) { return shanten(h, m || 0); },
    }));
  };

  /* ---- 10. poker 德州扑克 ---- */
  toyInitFns["poker"] = function () {
    // v4.0 重写：单挑无限注德州。盲注 5/10 轮换，过牌/跟注/加注/全下，四条街，AI 用蒙特卡洛胜率决策。
    const SUITS = ["♠", "♥", "♦", "♣"];
    const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    const HNAMES = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"];
    const SB = 5, BB = 10, START = 1000;
    const BEST_KEY = "dorm-toybox-poker-best-v1";
    let best = parseInt(lsGet(BEST_KEY, "0"), 10) || 0;
    let deck = [], hole = [[], []], comm = [], chips = [START, START], bets = [0, 0], pot = 0;
    let button = 1, street = 0, toAct = 0, acted = [false, false], folded = -1, over = true, raises = 0, lastRaise = BB;
    let msg = "", reveal = false, handNo = 0, aiTimer = null, lastAi = "", winInfo = null;
    function newDeck() { const d = []; for (const s of SUITS) for (let r = 0; r < 13; r++) d.push({ s, r }); return shuffle(d); }
    function eval5(h) {
      const rs = h.map((c) => c.r).sort((a, b) => b - a);
      const flush = h.every((c) => c.s === h[0].s);
      const uniq = [...new Set(rs)];
      let straightHi = -1;
      if (uniq.length === 5) {
        if (rs[0] - rs[4] === 4) straightHi = rs[0];
        else if (rs[0] === 12 && rs[1] === 3) straightHi = 3; // A2345
      }
      const cnt = {}; rs.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
      const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
      const shape = groups.map((g) => cnt[g]).join("");
      if (straightHi >= 0 && flush) return [8, straightHi];
      if (shape === "41") return [7].concat(groups);
      if (shape === "32") return [6].concat(groups);
      if (flush) return [5].concat(rs);
      if (straightHi >= 0) return [4, straightHi];
      if (shape === "311") return [3].concat(groups);
      if (shape === "221") return [2].concat(groups);
      if (shape === "2111") return [1].concat(groups);
      return [0].concat(rs);
    }
    function cmpHands(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; } return 0; }
    function eval7(cards) {
      // 任意 5–7 张里挑最大的 5 张
      const n = cards.length;
      if (n <= 5) return eval5(cards);
      let bestV = null;
      const skip = n - 5;
      for (let a = 0; a < n; a++) for (let b = skip === 2 ? a + 1 : n; b <= (skip === 2 ? n - 1 : n); b++) {
        const h = cards.filter((_, i) => i !== a && i !== b);
        const v = eval5(h);
        if (!bestV || cmpHands(v, bestV) > 0) bestV = v;
      }
      return bestV;
    }
    // AI 胜率：蒙特卡洛模拟，对手随机两张
    function equity(my, board, iters) {
      const used = new Set(my.concat(board).map((c) => c.s + c.r));
      const rest = []; for (const s of SUITS) for (let r = 0; r < 13; r++) if (!used.has(s + r)) rest.push({ s, r });
      let win = 0;
      for (let k = 0; k < iters; k++) {
        for (let i = 0; i < 2 + 5 - board.length; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
        const opp = [rest[0], rest[1]];
        const full = board.concat(rest.slice(2, 2 + 5 - board.length));
        const c = cmpHands(eval7(my.concat(full)), eval7(opp.concat(full)));
        win += c > 0 ? 1 : c === 0 ? 0.5 : 0;
      }
      return win / iters;
    }
    const other = (i) => 1 - i;
    const toCall = (i) => Math.max(0, bets[other(i)] - bets[i]);
    const potTotal = () => pot + bets[0] + bets[1];
    let contrib = [0, 0];
    function put(i, amt) { amt = Math.max(0, Math.min(amt, chips[i])); chips[i] -= amt; bets[i] += amt; contrib[i] += amt; return amt; }
    function newHand() {
      clearAi();
      if (chips[0] <= 0 || chips[1] <= 0) {
        const youBust = chips[0] <= 0;
        chips = [START, START];
        msg = youBust ? "你输光了，重新买入 1000。" : "🏆 你把 AI 赢光了！双方重新买入。";
      } else msg = "";
      handNo++;
      button = other(button);
      deck = newDeck();
      hole = [[deck.pop(), deck.pop()], [deck.pop(), deck.pop()]];
      comm = []; pot = 0; bets = [0, 0]; contrib = [0, 0]; street = 0; folded = -1; over = false; reveal = false; raises = 0; lastRaise = BB; lastAi = ""; winInfo = null;
      // 单挑：庄家下小盲，翻牌前先行动
      put(button, SB); put(other(button), BB);
      acted = [false, false];
      toAct = button;
      if (SFX.enabled) SFX.click();
      step();
    }
    function clearAi() { if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; } }
    function act(i, kind, amount) {
      if (over || i !== toAct) return;
      const opp = other(i);
      const need = toCall(i);
      if (kind === "fold") { folded = i; finish(); return; }
      if (kind === "check" && need > 0) kind = "call";
      if (kind === "call") { put(i, need); if (SFX.enabled && need > 0) SFX.coin(); }
      if (kind === "raise") {
        // amount = 加注到的总额（本街）
        const minTo = bets[opp] + Math.max(lastRaise, BB);
        let to = Math.max(minTo, amount);
        to = Math.min(to, bets[i] + chips[i]); // 不够就全下
        const raiseBy = to - bets[opp];
        if (raiseBy > 0 && to - bets[opp] >= lastRaise) lastRaise = raiseBy;
        put(i, to - bets[i]);
        raises++;
        acted[opp] = false;
        if (SFX.enabled) SFX.coin();
      }
      acted[i] = true;
      if (i === 1) lastAi = kind === "fold" ? "弃牌" : kind === "check" ? "过牌" : kind === "call" ? (need > 0 ? "跟注 " + need : "过牌") : (chips[1] === 0 ? "全下！" : "加注到 " + bets[1]);
      // 本街结束？
      const allInSomeone = chips[0] === 0 || chips[1] === 0;
      if (acted[0] && acted[1] && bets[0] === bets[1]) { nextStreet(); return; }
      if (allInSomeone && bets[0] === bets[1]) { nextStreet(); return; }
      if (allInSomeone && toCall(opp) === 0 && acted[opp]) { nextStreet(); return; }
      toAct = opp;
      step();
    }
    function nextStreet() {
      pot += bets[0] + bets[1]; bets = [0, 0];
      // 退还超额（一方全下不够跟时）在 put 时已限制，这里不需要
      if (street === 3) { finish(); return; }
      street++;
      if (street === 1) comm.push(deck.pop(), deck.pop(), deck.pop());
      else comm.push(deck.pop());
      acted = [false, false]; raises = 0; lastRaise = BB;
      toAct = other(button); // 翻牌后大盲先行动
      if (chips[0] === 0 || chips[1] === 0) { reveal = true; draw(); aiTimer = setTimeout(nextStreet, 700); return; }
      step();
    }
    function finish() {
      clearAi();
      over = true;
      pot += bets[0] + bets[1]; bets = [0, 0];
      let won = 0;
      if (folded >= 0) {
        const w = other(folded); chips[w] += pot; won = w === 0 ? pot : -pot;
        msg = folded === 0 ? "你弃牌，输掉 " + contrib[0] : "🎉 AI 弃牌，你赢 +" + contrib[1];
        { if (w === 0) SFX.win(); else SFX.lose(); }
      } else {
        while (comm.length < 5) comm.push(deck.pop());
        reveal = true;
        const pv = eval7(hole[0].concat(comm)), av = eval7(hole[1].concat(comm));
        const c = cmpHands(pv, av);
        winInfo = { you: HNAMES[pv[0]], ai: HNAMES[av[0]] };
        if (c > 0) { chips[0] += pot; msg = "🎉 你赢 +" + (pot - contrib[0]) + "！" + HNAMES[pv[0]] + " 胜 " + HNAMES[av[0]]; if (SFX.enabled) SFX.chime(); }
        else if (c < 0) { chips[1] += pot; msg = "😅 你输 " + contrib[0] + "，" + HNAMES[av[0]] + " 胜 " + HNAMES[pv[0]]; SFX.lose(); }
        else { const h = Math.floor(pot / 2); chips[0] += h; chips[1] += pot - h; msg = "🤝 平分底池，都是" + HNAMES[pv[0]]; }
      }
      pot = 0;
      if (chips[0] > best) { best = chips[0]; lsSet(BEST_KEY, String(best)); }
      draw();
    }
    function aiDecide() {
      const need = toCall(1);
      const P = potTotal();
      const e = equity(hole[1], comm, comm.length === 0 ? 260 : 360);
      const odds = need / (P + need || 1);
      const r = Math.random();
      const canRaise = raises < 3 && chips[1] > need && chips[0] > 0;
      const sizeTo = (frac) => bets[0] + Math.max(BB, Math.round((P + need) * frac / 5) * 5);
      if (need > 0) {
        if (e < odds - 0.04 && !(r < 0.08 && need <= BB * 2)) return ["fold"];
        if (canRaise && (e > 0.72 || (e > 0.6 && r < 0.3) || (r < 0.05))) return ["raise", e > 0.85 && r < 0.4 ? bets[1] + chips[1] : sizeTo(0.75)];
        return ["call"];
      }
      if (canRaise && (e > 0.62 || (e > 0.5 && r < 0.4) || (e < 0.35 && r < 0.12))) return ["raise", sizeTo(e > 0.8 ? 0.8 : 0.55)];
      return ["check"];
    }
    function step() {
      draw();
      if (over) return;
      if (toAct === 1) {
        clearAi();
        aiTimer = setTimeout(() => { aiTimer = null; const d = aiDecide(); act(1, d[0], d[1]); }, 650);
      }
    }
    // ---- 画面 ----
    function cardEl(c, hidden, small) {
      const d = document.createElement("span");
      if (hidden) { d.className = "pk-card back" + (small ? " sm" : ""); return d; }
      const red = c.s === "♥" || c.s === "♦";
      d.className = "pk-card" + (red ? " red" : "") + (small ? " sm" : "");
      const r = document.createElement("b"); r.textContent = RANKS[c.r];
      const s = document.createElement("i"); s.textContent = c.s;
      d.appendChild(r); d.appendChild(s);
      return d;
    }
    let pkSeenHand = -1, pkSeenComm = 0, pkSeenReveal = false;
    function draw() {
      const t = $("pokerTable"); if (!t) return;
      t.innerHTML = "";
      const row = (cls) => { const d = document.createElement("div"); d.className = cls; t.appendChild(d); return d; };
      const aiRow = row("pk-seat");
      aiRow.innerHTML = '<span class="pk-name">🤖 AI' + (button === 1 ? ' <em class="pk-btn">D</em>' : "") + '</span><span class="pk-chips">' + chips[1] + "</span>";
      const aiCards = row("pk-cards");
      const isNewHand = pkSeenHand !== handNo, flip = reveal && !pkSeenReveal;
      hole[1].forEach((c, i) => { const el = cardEl(c, !reveal); if (isNewHand) { el.classList.add("deal"); el.style.animationDelay = (i * 2 + 1) * 90 + "ms"; } else if (flip) { el.classList.add("flip"); el.style.animationDelay = i * 90 + "ms"; } aiCards.appendChild(el); });
      const aiBet = row("pk-bet"); aiBet.textContent = bets[1] ? "下注 " + bets[1] : (lastAi && !over ? lastAi : "");
      const board = row("pk-board");
      for (let i = 0; i < 5; i++) {
        if (comm[i]) { const el = cardEl(comm[i]); if (i >= pkSeenComm) { el.classList.add("flip"); el.style.animationDelay = (i - pkSeenComm) * 110 + "ms"; } board.appendChild(el); }
        else { const e = document.createElement("span"); e.className = "pk-card slot"; board.appendChild(e); }
      }
      const potEl = row("pk-pot"); potEl.textContent = "底池 " + potTotal();
      const meBet = row("pk-bet"); meBet.textContent = bets[0] ? "下注 " + bets[0] : "";
      const myCards = row("pk-cards");
      hole[0].forEach((c, i) => { const el = cardEl(c); if (isNewHand) { el.classList.add("deal"); el.style.animationDelay = i * 2 * 90 + "ms"; } myCards.appendChild(el); });
      pkSeenHand = handNo; pkSeenComm = comm.length; pkSeenReveal = reveal;
      const meRow = row("pk-seat");
      let hn = "";
      if (hole[0].length && comm.length >= 3) hn = " · " + HNAMES[eval7(hole[0].concat(comm))[0]];
      meRow.innerHTML = '<span class="pk-name">🙂 你' + (button === 0 ? ' <em class="pk-btn">D</em>' : "") + hn + '</span><span class="pk-chips">' + chips[0] + "</span>";
      // 操作按钮
      const a = $("pokerActions"); if (!a) return;
      a.innerHTML = "";
      const mk = (txt, cls, fn, dis) => { const b = document.createElement("button"); b.className = "btn small " + cls; b.textContent = txt; b.disabled = !!dis; b.addEventListener("click", () => { SFX.unlock(); fn(); }); a.appendChild(b); };
      if (over) { mk(handNo ? "下一手 ▶" : "开始发牌 ▶", "gold-btn", newHand); }
      else {
        const mine = toAct === 0;
        const need = toCall(0), P = potTotal();
        mk("弃牌", "ghost-btn", () => act(0, "fold"), !mine || need === 0);
        mk(need > 0 ? "跟注 " + Math.min(need, chips[0]) : "过牌", "ghost-btn", () => act(0, need > 0 ? "call" : "check"), !mine);
        const canRaise = mine && chips[0] > need && chips[1] > 0;
        const half = bets[1] + Math.max(Math.max(lastRaise, BB), Math.round((P + need) * 0.5 / 5) * 5);
        const full = bets[1] + Math.max(Math.max(lastRaise, BB), Math.round((P + need) / 5) * 5);
        mk((need > 0 ? "加注" : "下注") + " ½池", "ghost-btn", () => act(0, "raise", half), !canRaise || half >= bets[0] + chips[0]);
        mk((need > 0 ? "加注" : "下注") + " 1池", "ghost-btn", () => act(0, "raise", full), !canRaise || full >= bets[0] + chips[0]);
        mk("全下 " + (bets[0] + chips[0]), "gold-btn", () => act(0, "raise", bets[0] + chips[0]), !canRaise);
      }
      const STREETS = ["翻牌前", "翻牌", "转牌", "河牌"];
      $("pokerMsg").textContent = over ? (msg || "点「开始发牌」，盲注 5/10，各 1000 筹码") : (toAct === 0 ? STREETS[street] + " · 轮到你" + (toCall(0) ? "，要跟 " + toCall(0) : "") : STREETS[street] + " · AI 思考中…");
      $("pokerBest").textContent = "第 " + handNo + " 手 · 本机最高筹码 " + Math.max(best, START);
    }
    $("pokerResetBtn").addEventListener("click", () => { clearAi(); chips = [START, START]; handNo = 0; button = 1; over = true; hole = [[], []]; comm = []; bets = [0, 0]; pot = 0; msg = "重新开始，各 1000 筹码"; draw(); });
    toyLeaveCleanup["poker"] = () => { if (aiTimer) { clearAi(); pokerPaused = true; } };
    let pokerPaused = false;
    toyEnterResume["poker"] = () => { if (pokerPaused) { pokerPaused = false; if (!over && toAct === 1) step(); else if (!over && (chips[0] === 0 || chips[1] === 0)) nextStreet(); } };
    draw();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get poker() { return { chips: chips.slice(), pot: potTotal(), over, street, toAct, comm: comm.length, bets: bets.slice() }; },
      pokerNew() { newHand(); },
      pokerAct(kind, amt) { act(0, kind, amt); },
      pokerEval(cards) { return eval5(cards); },
      pokerEquity(my, board, n) { return equity(my, board || [], n || 500); },
    }));
  };
  /* ---- 11. rhythm 音游 ---- */
  toyInitFns["rhythm"] = function () {
    // v4.0 重写：WebAudio 现场合成一首歌（鼓 + 贝斯 + 旋律），谱面就是旋律音符，按音频时钟同步、按毫秒判定。
    const KEY = "dorm-toybox-rhythm-v2";
    const W = 320, H = 420, LANES = 4, LW = W / LANES, JUDGE_Y = H - 70;
    const KEYS = ["d", "f", "j", "k"];
    const LANE_COL = ["#ff6b8b", "#ffb84d", "#4dd0a5", "#5aa8ff"];
    const DIFF = {
      easy: { name: "简单", bpm: 96, dens: 0.42, travel: 1.9 },
      normal: { name: "普通", bpm: 112, dens: 0.6, travel: 1.55 },
      hard: { name: "困难", bpm: 128, dens: 0.8, travel: 1.25 },
    };
    const BARS = 16, LEAD = 2.2;
    let save = (() => { try { const v = JSON.parse(lsGet(KEY, "{}")); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } })();
    let diff = DIFF[save.diff] ? save.diff : "normal";
    let notes = [], state = "idle", t0 = 0, useAudio = false, master = null, raf = null, songLen = 0;
    let score = 0, combo = 0, maxCombo = 0, cnt = { p: 0, g: 0, m: 0 }, judge = null, laneFlash = [0, 0, 0, 0], sparks = [];
    const SCALE = [0, 2, 4, 7, 9]; // 五声音阶
    const PROG = [0, 7, 9, 5]; // I V vi IV（半音）
    const BASE = 261.63; // C4
    const freq = (semi) => BASE * Math.pow(2, semi / 12);
    function now() {
      if (useAudio) { const c = SFX.ctx(); return c ? c.currentTime - t0 : 0; }
      return performance.now() / 1000 - t0;
    }
    function buildSong() {
      const d = DIFF[diff], beat = 60 / d.bpm, step = beat / 2; // 八分音符
      const out = [];
      let deg = 2, lastLane = -1;
      for (let bar = 0; bar < BARS; bar++) {
        for (let k = 0; k < 8; k++) {
          const t = LEAD + (bar * 8 + k) * step;
          const strong = k % 2 === 0, down = k === 0 || k === 4;
          const p = d.dens * (down ? 1.35 : strong ? 0.95 : 0.55) * (bar < 2 ? 0.6 : 1);
          if (Math.random() < p) {
            deg = Math.max(0, Math.min(9, deg + Math.floor(Math.random() * 5) - 2));
            let lane = Math.min(3, Math.floor(deg / 2.5));
            if (lane === lastLane && Math.random() < 0.5) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
            lastLane = lane;
            const semi = PROG[bar % 4] % 12 === 0 ? 0 : 0; // 旋律走五声音阶，和弦只给贝斯
            out.push({ t, lane, semi: 12 + SCALE[deg % 5] + 12 * Math.floor(deg / 5) + semi, hit: false, res: null });
            // 困难：偶尔加双押
            if (diff === "hard" && down && Math.random() < 0.18) out.push({ t, lane: (lane + 2) % 4, semi: 12 + SCALE[(deg + 2) % 5], hit: false, res: null });
          }
        }
      }
      songLen = LEAD + BARS * 8 * step + 1.2;
      return out;
    }
    function scheduleAudio() {
      const c = SFX.ctx(); if (!c) return false;
      const d = DIFF[diff], beat = 60 / d.bpm, step = beat / 2;
      master = c.createGain(); master.gain.value = 0.55; master.connect(c.destination);
      const base0 = c.currentTime + 0.12; t0 = base0;
      const tone = (f, at, dur, type, vol) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, base0 + at); g.gain.exponentialRampToValueAtTime(vol, base0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, base0 + at + dur);
        o.connect(g); g.connect(master); o.start(base0 + at); o.stop(base0 + at + dur + 0.05);
      };
      const nb = (() => { const len = Math.floor(c.sampleRate * 0.2), b = c.createBuffer(1, len, c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < len; i++) x[i] = Math.random() * 2 - 1; return b; })();
      const noise = (at, dur, vol, hp) => {
        const src = c.createBufferSource(); src.buffer = nb;
        const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
        const g = c.createGain(); g.gain.setValueAtTime(vol, base0 + at); g.gain.exponentialRampToValueAtTime(0.0001, base0 + at + dur);
        src.connect(f); f.connect(g); g.connect(master); src.start(base0 + at); src.stop(base0 + at + dur + 0.02);
      };
      const kick = (at) => {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(140, base0 + at); o.frequency.exponentialRampToValueAtTime(45, base0 + at + 0.12);
        g.gain.setValueAtTime(0.9, base0 + at); g.gain.exponentialRampToValueAtTime(0.0001, base0 + at + 0.18);
        o.connect(g); g.connect(master); o.start(base0 + at); o.stop(base0 + at + 0.2);
      };
      // 预备拍：4 下嗒嗒
      for (let i = 0; i < 4; i++) tone(i === 0 ? 1320 : 990, LEAD - 4 * beat + i * beat, 0.05, "square", 0.08);
      for (let bar = 0; bar < BARS; bar++) {
        const root = PROG[bar % 4];
        for (let k = 0; k < 8; k++) {
          const at = LEAD + (bar * 8 + k) * step;
          if (k === 0 || k === 4) kick(at);
          if (k === 2 || k === 6) noise(at, 0.12, 0.35, 1500);
          noise(at, 0.03, 0.08, 7000);
          if (k % 2 === 0) tone(freq(root - 24 + (k === 6 ? 7 : 0)), at, step * 1.6, "triangle", 0.22);
        }
        // 和弦垫底
        [0, 4, 7].forEach((iv) => tone(freq(root - 12 + iv + (iv === 4 && (root === 9) ? -1 : 0)), LEAD + bar * 8 * step, step * 7.5, "sine", 0.035));
      }
      for (const n of notes) tone(freq(n.semi), n.t, 0.22, "square", 0.05);
      return true;
    }
    function stopAudio() { if (master) { try { master.disconnect(); } catch (e) {} master = null; } }
    function start() {
      SFX.unlock();
      stopAudio();
      notes = buildSong();
      score = 0; combo = 0; maxCombo = 0; cnt = { p: 0, g: 0, m: 0 }; judge = null; sparks = []; laneFlash = [0, 0, 0, 0];
      useAudio = SFX.enabled && !!SFX.ctx() && scheduleAudio();
      if (!useAudio) t0 = performance.now() / 1000;
      state = "play";
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      render();
    }
    function finish() {
      state = "result";
      const total = notes.length || 1;
      const acc = (cnt.p + cnt.g * 0.6) / total;
      const rank = acc >= 0.95 ? "S" : acc >= 0.85 ? "A" : acc >= 0.7 ? "B" : acc >= 0.5 ? "C" : "D";
      const k = "best_" + diff;
      const isNew = score > (save[k] || 0);
      if (isNew) save[k] = score;
      lsSet(KEY, JSON.stringify(save));
      judge = { rank, acc, isNew };
      SFX.win();
      render();
    }
    function hit(lane) {
      if (state !== "play" || lane < 0 || lane > 3) return;
      laneFlash[lane] = 1;
      const t = now();
      let bestN = null, bd = 1e9;
      for (const n of notes) { if (n.lane !== lane || n.hit) continue; const d = Math.abs(n.t - t); if (d < bd) { bd = d; bestN = n; } }
      if (!bestN || bd > 0.16) return; // 空按不扣分
      bestN.hit = true;
      if (bd <= 0.055) { bestN.res = "p"; cnt.p++; combo++; score += 300 + Math.min(combo, 50) * 4; judge = { txt: "PERFECT", col: "#ffe066", at: t }; }
      else if (bd <= 0.11) { bestN.res = "g"; cnt.g++; combo++; score += 120 + Math.min(combo, 50) * 2; judge = { txt: "GREAT", col: "#7fd4ff", at: t }; }
      else { bestN.res = "m"; cnt.m++; combo = 0; judge = { txt: "BAD", col: "#ff7a7a", at: t }; }
      maxCombo = Math.max(maxCombo, combo);
      if (bestN.res !== "m") for (let i = 0; i < 8; i++) sparks.push({ x: lane * LW + LW / 2, y: JUDGE_Y, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 260, life: 0.45, col: LANE_COL[lane] });
      render();
    }
    let lastFrame = 0;
    function loop(ts) {
      const dt = Math.min(0.05, (ts - (lastFrame || ts)) / 1000); lastFrame = ts;
      if (state === "play") {
        const t = now();
        for (const n of notes) if (!n.hit && t - n.t > 0.16) { n.hit = true; n.res = "x"; cnt.m++; combo = 0; judge = { txt: "MISS", col: "#888", at: t }; render(); }
        if (t > songLen) finish();
      }
      for (let i = 0; i < 4; i++) laneFlash[i] = Math.max(0, laneFlash[i] - dt * 5);
      sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.life -= dt; });
      sparks = sparks.filter((p) => p.life > 0);
      draw();
      if (state === "play" || sparks.length || laneFlash.some((v) => v > 0)) raf = requestAnimationFrame(loop); else raf = null;
    }
    function draw() {
      const cv = $("rhythmCanvas"); if (!cv || !cv.getContext) return;
      const ctx = cv.getContext("2d"); if (!ctx || !ctx.fillRect) return;
      try {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0b0d1a"); g.addColorStop(1, "#1a1036");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < LANES; i++) {
          if (laneFlash[i] > 0) { const lg = ctx.createLinearGradient(0, JUDGE_Y, 0, 0); lg.addColorStop(0, LANE_COL[i] + "88"); lg.addColorStop(1, LANE_COL[i] + "00"); ctx.globalAlpha = laneFlash[i]; ctx.fillStyle = lg; ctx.fillRect(i * LW, 0, LW, JUDGE_Y); ctx.globalAlpha = 1; }
          ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.beginPath(); ctx.moveTo(i * LW, 0); ctx.lineTo(i * LW, H); ctx.stroke();
          // 底部按键垫
          ctx.fillStyle = laneFlash[i] > 0.3 ? LANE_COL[i] : "rgba(255,255,255,0.06)";
          ctx.beginPath(); ctx.arc(i * LW + LW / 2, JUDGE_Y, 22, 0, 7); ctx.fill();
          ctx.strokeStyle = LANE_COL[i]; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(KEYS[i].toUpperCase(), i * LW + LW / 2, H - 22);
        }
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(0, JUDGE_Y - 1, W, 2);
        const tt = state === "play" ? now() : 0, travel = DIFF[diff].travel;
        if (state === "play") {
          for (const n of notes) {
            if (n.hit && n.res !== "x") continue;
            const y = JUDGE_Y - (n.t - tt) / travel * JUDGE_Y;
            if (y < -30 || y > H + 30) continue;
            const x = n.lane * LW + LW / 2;
            ctx.fillStyle = n.res === "x" ? "#444" : LANE_COL[n.lane];
            ctx.shadowColor = LANE_COL[n.lane]; ctx.shadowBlur = n.res === "x" ? 0 : 12;
            const w = LW - 18, h = 16;
            ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 8); else ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(x - w / 2 + 8, y - 4, w - 16, 3);
          }
          // 进度条
          ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(0, 0, W, 4);
          ctx.fillStyle = "#7c5cff"; ctx.fillRect(0, 0, W * Math.max(0, Math.min(1, tt / songLen)), 4);
          if (tt < LEAD - 0.1) { ctx.fillStyle = "#fff"; ctx.font = "bold 44px sans-serif"; ctx.fillText(String(Math.ceil((LEAD - tt) / (60 / DIFF[diff].bpm))), W / 2, H / 2 - 40); }
        }
        sparks.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life / 0.45); ctx.fillStyle = p.col; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
        ctx.globalAlpha = 1;
        if (state === "play" && judge && judge.txt && tt - judge.at < 0.5) {
          ctx.fillStyle = judge.col; ctx.font = "900 28px sans-serif"; ctx.fillText(judge.txt, W / 2, JUDGE_Y - 120);
        }
        if (state === "play" && combo >= 3) { ctx.fillStyle = "#fff"; ctx.font = "900 34px sans-serif"; ctx.fillText(String(combo), W / 2, 70); ctx.font = "12px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillText("COMBO", W / 2, 96); }
        if (state === "idle") {
          ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.fillText("👆 点这里开始", W / 2, H / 2 - 30);
          ctx.font = "14px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.75)";
          ctx.fillText("音符落到圆圈时点对应的轨道", W / 2, H / 2 + 6);
          ctx.fillText("电脑：D F J K · 建议开声音", W / 2, H / 2 + 30);
        }
        if (state === "result" && judge) {
          ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = { S: "#ffe066", A: "#7fffb0", B: "#7fd4ff", C: "#ffb37f", D: "#ff7a7a" }[judge.rank];
          ctx.font = "900 86px sans-serif"; ctx.fillText(judge.rank, W / 2, H / 2 - 70);
          ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.fillText(score + " 分" + (judge.isNew ? "  🎉新纪录" : ""), W / 2, H / 2);
          ctx.font = "14px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.8)";
          ctx.fillText("准确率 " + Math.round(judge.acc * 100) + "% · 最大连击 " + maxCombo, W / 2, H / 2 + 30);
          ctx.fillText("Perfect " + cnt.p + " · Great " + cnt.g + " · Miss " + cnt.m, W / 2, H / 2 + 52);
          ctx.fillText("点一下再来一首", W / 2, H / 2 + 92);
        }
        ctx.textBaseline = "alphabetic";
      } catch (e) {}
    }
    function render() {
      $("rhythmScore").textContent = state === "play"
        ? "分 " + score + " · 连击 " + combo + " · P" + cnt.p + " / G" + cnt.g + " / M" + cnt.m
        : DIFF[diff].name + " · 最好 " + (save["best_" + diff] || 0) + " 分";
      document.querySelectorAll("#rhythmDiff [data-d]").forEach((b) => { b.classList.toggle("active", b.getAttribute("data-d") === diff); b.disabled = state === "play"; });
    }
    document.addEventListener("keydown", (e) => {
      if ($("toy-rhythm").classList.contains("hidden") || e.repeat) return;
      const i = KEYS.indexOf((e.key || "").toLowerCase());
      if (i >= 0) { e.preventDefault(); if (state !== "play") start(); else hit(i); }
      else if (e.key === " " && state !== "play") { e.preventDefault(); start(); }
    });
    const cv = $("rhythmCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state !== "play") { start(); return; }
      const rect = cv.getBoundingClientRect();
      hit(Math.floor((e.clientX - rect.left) / (rect.width || W) * LANES));
      if (!raf) raf = requestAnimationFrame(loop);
    });
    document.querySelectorAll("#rhythmDiff [data-d]").forEach((b) => b.addEventListener("click", () => {
      if (state === "play") return;
      diff = b.getAttribute("data-d"); save.diff = diff; lsSet(KEY, JSON.stringify(save)); state = "idle"; draw(); render();
    }));
    $("rhythmResetBtn").addEventListener("click", () => start());
    toyLeaveCleanup.rhythm = () => { if (raf) cancelAnimationFrame(raf); raf = null; stopAudio(); if (state === "play") { state = "idle"; } draw(); render(); };
    draw(); render();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get rhythm() { return { score, combo, maxCombo, running: state === "play", state, counts: cnt, notes: notes.length }; },
      rhythmHit(lane) { hit(lane); },
      rhythmStart() { start(); },
      rhythmNotes() { const t = now(); const n = notes.find((x) => !x.hit); return n ? { dt: n.t - t, lane: n.lane, count: notes.length } : null; },
    }));
  };

  /* ---- 12. tower 叠塔 ---- */
  toyInitFns["tower"] = function () {
    const KEY = "dorm-toybox-tower-best-v1";
    const W = 320, H = 420, BH = 22;
    let best = loadBest(KEY);
    let blocks = [], cur = null, dir = 1, height = 0, running = false, raf = null, over = false;
    let lastT = 0, combo = 0, debris = [], flash = null, overAt = 0;
    function reset() {
      combo = 0; debris = []; flash = null;
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
        over = true; running = false; overAt = Date.now();
        debris.push({ x: cur.x, y: cur.y, w: cur.w, vy: 0, vr: (Math.random() - 0.5) * 0.1, r: 0 });
        SFX.lose();
        if (!raf) raf = requestAnimationFrame(step);
        draw(); render(); return;
      }
      // v4.0：误差 5px 内算“完美”，不切、连击；连击 3 次起每次加宽一点
      let nx = left, nwid = overlap;
      if (Math.abs(cur.x - prev.x) <= 5) {
        nx = prev.x; nwid = prev.w; combo++;
        if (combo >= 3) { const grow = Math.min(10, 200 - nwid); nwid += grow; nx = Math.max(0, nx - grow / 2); }
        flash = { t: Date.now(), txt: combo >= 2 ? "完美 ×" + combo : "完美！" };
      } else {
        combo = 0;
        // 切掉的那截掉下去
        if (cur.x < prev.x) debris.push({ x: cur.x, y: cur.y, w: prev.x - cur.x, vy: 0, vr: -0.04, r: 0 });
        if (cur.x + cur.w > prev.x + prev.w) debris.push({ x: prev.x + prev.w, y: cur.y, w: cur.x + cur.w - prev.x - prev.w, vy: 0, vr: 0.04, r: 0 });
      }
      blocks.push({ x: nx, w: nwid, y: cur.y });
      height++;
      if (SFX.enabled) SFX.pop(combo ? Math.min(1, 0.6 + combo * 0.1) : 0.4 + Math.min(0.4, height * 0.02));
      if (height > best) { best = height; saveBest(KEY, best); }
      const overlapW = nwid;
      // 下一块：宽度继承，速度加快
      const nw = overlapW;
      cur = { x: Math.random() < 0.5 ? 0 : W - nw, w: nw, y: cur.y - BH, vx: Math.min(6, 2.4 + height * 0.08) * (Math.random() < 0.5 ? 1 : -1) };
      // 视角跟随
      if (blocks.length * BH > H - 100) {
        const dy = BH;
        blocks.forEach((b) => b.y += dy);
        debris.forEach((d) => d.y += dy);
        cur.y += dy;
      }
      draw(); render();
    }
    function step(now) {
      raf = null;
      if (!lastT) lastT = now;
      const dt = Math.min(50, now - lastT);
      lastT = now;
      const k = dt / 16.7;
      debris.forEach((d) => { d.vy += 0.5 * k; d.y += d.vy * k; d.r += d.vr * k; });
      debris = debris.filter((d) => d.y < H + 60);
      if (!running || over) { draw(); if (debris.length) raf = requestAnimationFrame(step); return; }
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
        debris.forEach((d) => {
          ctx.save(); ctx.translate(d.x + d.w / 2, d.y + BH / 2); ctx.rotate(d.r);
          ctx.fillStyle = "rgba(120,150,220,.75)"; ctx.fillRect(-d.w / 2, -BH / 2, d.w, BH - 2); ctx.restore();
        });
        if (flash && Date.now() - flash.t < 700 && !over) {
          ctx.globalAlpha = 1 - (Date.now() - flash.t) / 700;
          ctx.fillStyle = "#ffe066"; ctx.font = "900 26px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(flash.txt, W / 2, 60); ctx.globalAlpha = 1;
        }
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
          ctx.font = "14px sans-serif"; ctx.fillStyle = "rgba(255,255,255,.75)";
          ctx.fillText("点一下再来", W / 2, H / 2 + 54);
        }
      } catch (e) {}
    }
    function render() {
      $("towerScore").textContent = "高度 " + height + " · 最好 " + best + (over ? " · 结束" : "");
    }
    const cv = $("towerCanvas");
    if (cv) cv.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (over) { if (Date.now() - overAt > 500) { if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); } return; } // v4.0：塔倒了点画面直接再来
      drop();
    });
    $("towerResetBtn").addEventListener("click", () => { if (raf) cancelAnimationFrame(raf); reset(); raf = requestAnimationFrame(step); });
    toyLeaveCleanup.tower = () => { if (raf) cancelAnimationFrame(raf); raf = null; running = false; };
    toyEnterResume.tower = () => { if (!over && !running) { running = true; lastT = 0; raf = requestAnimationFrame(step); } }; // R19：切走再回来方块冻住（cleanup 停了 raf 但没续上），只有重开能救
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
      if (invuln > 0) invuln -= dt; // R21：invuln 是毫秒（1500），之前按帧减（k≈1/帧），中弹后无敌 1500 帧≈25 秒，3 条命等于死不了
      for (const b of bullets) { b.x += b.vx * k; b.y += b.vy * k; }
      bullets = bullets.filter((b) => b.y < H + 20 && b.x > -20 && b.x < W + 20);
      // 碰撞 + 擦弹
      for (const b of bullets) {
        const d = Math.hypot(b.x - px, b.y - py);
        if (d < b.r + 8) {
          if (invuln <= 0) {
            lives--;
            invuln = 1500;
            SFX.hit(); FX.shake($("dodgeCanvas"));
            if (lives <= 0) {
              running = false;
              if (score > best) { best = score; saveBest(KEY, best); }
              SFX.lose();
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
          ctx.fillText("得分 " + Math.floor(score) + " · 最好 " + Math.floor(best), W / 2, H / 2 + 24); // R21：score 是每帧累加的浮点，原来直接拼出 4000.7185628744755 这种长小数
        } else if (!running && !started) {
          ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("👆 拖动开始躲", W / 2, H / 2);
        }
      } catch (e) {}
    }
    function render() {
      $("dodgeScore").textContent = "分 " + Math.floor(score) + " · 命 " + "❤️".repeat(Math.max(0, lives)) + " · 最好 " + Math.floor(best) + (running ? "" : " · 结束"); // R21：best 存的是浮点分数，原来直接拼出长小数
    }
    function canvasStart() { // R21：画布写着“👆 拖动开始躲”，但拖动只移飞机不开局，只能点重开按钮
      if (running) return;
      if (raf) cancelAnimationFrame(raf);
      if (lives <= 0) reset(); else running = true;
      started = true;
      raf = requestAnimationFrame(step);
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
      // v4.2：相对拖动——手指在飞机下方任意处滑，飞机跟着走，不会被手指盖住
      relDrag(cv, () => ({ x: px, y: py }), (x, y) => { px = Math.max(12, Math.min(W - 12, x)); py = Math.max(12, Math.min(H - 12, y)); }, { lw: 320, lh: 420, hoverAbs: true, gain: 1.25 });
      cv.addEventListener("pointerdown", () => { SFX.unlock(); canvasStart(); });
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
      get dodge() { return { score, lives, best, running, invuln }; },
      dodgeStart() { if (!running && lives > 0) { running = true; started = true; raf = requestAnimationFrame(step); } },
      dodgeMove(x, y) { px = x; py = y; },
      dodgeSet(bs) { bullets = bs.map((b) => ({ x: b.x, y: b.y, vx: b.vx || 0, vy: b.vy || 0, r: b.r || 5, id: b.id })); }, // R21：探针用
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
        SFX.win();
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
      maze3dMove(f = 1, s = 0) { move(f, s); }, // R28：无参调用原来传 undefined，NaN 导致一步不动还静默
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
      $("skPhase").textContent = "身份已发：依次传手机，每人点自己的牌看身份（标记出局：先开「💀 点牌标记出局」再点牌）"; // R19：原来写“双击牌标记出局”，手机没双击
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
        if (secs <= 0) { stopTimer(); $("skTimerLine").textContent = "⏱ 时间到！"; SFX.lose(); return; }
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
        if (img) { try { // R25：原来不管横竖都拉成 320×320 正方形，上传的照片被压扁；改按比例裁切铺满
            const s = Math.max(320 / img.naturalWidth, 320 / img.naturalHeight);
            const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
            ctx.drawImage(img, (320 - dw) / 2, (320 - dh) / 2, dw, dh);
          } catch (e) { drawTemplate(ctx, tpl); } }
        else drawTemplate(ctx, tpl);
        ctx.font = "bold " + size + "px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = Math.max(3, Math.floor(size / 8));
        ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
        if (top) { ctx.strokeText(top, 160, size + 14); ctx.fillText(top, 160, size + 14); }
        if (bottom) { ctx.strokeText(bottom, 160, 308); ctx.fillText(bottom, 160, 308); }
      } catch (e) {}
    }
    function memegenMarkTpl() { // R25：三个模板按钮原来点完没任何选中态，用户不知道当前是哪个
      [0, 1, 2].forEach((i) => { const b = $("memegenTpl" + i); if (b) b.classList.toggle("active", i === tpl); });
    }
    $("memegenTpl0").addEventListener("click", () => { tpl = 0; img = null; if (SFX.enabled) SFX.click(); memegenMarkTpl(); render(); });
    $("memegenTpl1").addEventListener("click", () => { tpl = 1; img = null; if (SFX.enabled) SFX.click(); memegenMarkTpl(); render(); });
    $("memegenTpl2").addEventListener("click", () => { tpl = 2; img = null; if (SFX.enabled) SFX.click(); memegenMarkTpl(); render(); });
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
        if (SFX.enabled) SFX.chime();
      } catch (e) { $("memegenMsg").textContent = "下载失败，换个浏览器试试"; }
    });
    render();
    memegenMarkTpl();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get memegen() { return { top: top, bottom: bottom, tpl: tpl }; },
      memegenSetText(t, b) {
        top = t || ""; bottom = b || "";
        const te = $("memegenTop"); if (te) te.value = top;
        const be = $("memegenBottom"); if (be) be.value = bottom;
        render();
      },
      memegenTemplate(i) { tpl = i; img = null; memegenMarkTpl(); render(); },
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
        resumeMarkTpl();
      } catch (e) {}
    }
    function resumeMarkTpl() { // R29：两个模板按钮原来点完没有任何选中态（表情包制作 R25 修过同款），用户不知道当前是哪个模板
      [0, 1].forEach((i) => { const b = $("resumeTpl" + i); if (b) b.classList.toggle("active", i === tpl); });
    }
    FIELDS.forEach((f) => {
      const el = $(f);
      if (el) el.addEventListener("input", () => {
        render();
        if (saveT) clearTimeout(saveT);
        saveT = setTimeout(save, 500);
      });
    });
    // R25：原来切走只清掉待保存的防抖计时器——打完字 500ms 内切走，最后一截就丢了；改成切走时立刻刷盘
    toyLeaveCleanup.resume = () => { if (saveT) { clearTimeout(saveT); saveT = null; save(); } };
    $("resumeTpl0").addEventListener("click", () => { tpl = 0; resumeMarkTpl(); render(); save(); if (SFX.enabled) SFX.click(); });
    $("resumeTpl1").addEventListener("click", () => { tpl = 1; resumeMarkTpl(); render(); save(); if (SFX.enabled) SFX.click(); });
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
        if (SFX.enabled) SFX.chime();
      } catch (e) {}
    });
    $("resumeClearBtn").addEventListener("click", () => {
      FIELDS.forEach((f) => { const el = $(f); if (el) el.value = ""; });
      try { localStorage.removeItem(KEY); } catch (e) {}
      tpl = 0; // R25：清空回到默认蓝模板，不然清空后预览还挂着商务灰
      resumeMarkTpl(); // R29：清空后高亮也要回蓝模板
      render();
      if (SFX.enabled) SFX.click();
    });
    load(); render(); resumeMarkTpl(); // R29：首次打开（无存档）也要标出默认蓝模板
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
      get resume() { const el = $("rsName"); return { name: el ? el.value : "", tpl: tpl }; },
      resumeHtml() { return lastHtml; },
      resumeSet(f, v) { const el = $(f); if (el) { el.value = v; render(); save(); } },
      resumeTemplate(i) { tpl = i; resumeMarkTpl(); render(); },
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
    pongSet: "pong",
    arkanoid: "arkanoid",
    arkanoidStart: "arkanoid",
    arkanoidSet: "arkanoid",
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
    mahjongSet: "mahjong",
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
    dodgeSet: "dodge",
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

  // v4.0：点游戏画面就能开始——原来这几个游戏只能去找画面下方的「开始」按钮，点画面没反应
  [["snakeCanvas", "snakeStartBtn", null], ["breakoutCanvas", "breakoutStartBtn", "breakout"], ["shooterCanvas", "shooterStartBtn", "shooter"],
   ["catchStage", "catchStartBtn", "catchGame"], ["fruitsliceCanvas", "fruitsliceStartBtn", "fruit"], ["spotdiffGrid", "spotdiffStartBtn", "spotdiff"]].forEach(([area, btn, key]) => {
    const el = $(area), b = $(btn);
    if (!el || !b) return;
    el.addEventListener("pointerdown", () => {
      let running;
      if (key) { try { const st = __toyboxHandle[key]; running = !!(st && st.running); } catch (e) { running = true; } }
      else running = /暂停/.test(b.textContent || "");
      if (!running) setTimeout(() => { b.click(); }, 0);
    }, true);
  });

  // v4.0：结束后点画面直接再来一局（原来只能去找下面的「重开」按钮）。距上一次点击不到 0.45 秒的不算，防止手还在狂点时误开新局
  [["pongCanvas", "pongResetBtn", (st) => st.over], ["snake2Canvas", "snake2ResetBtn", (st) => !!st.winner], ["archeryCanvas", "archeryResetBtn", (st) => st.left <= 0 && !st.charging]].forEach(([area, btn, isOver]) => {
    const el = $(area), b = $(btn); if (!el || !b) return;
    const key = area.replace("Canvas", "");
    let lastDown = 0;
    el.addEventListener("pointerdown", () => {
      const now = Date.now(), gap = now - lastDown; lastDown = now;
      let over = false; try { over = isOver(__toyboxHandle[key]); } catch (e) {}
      if (over && gap > 450) setTimeout(() => b.click(), 0);
    }, true);
  });

  // v4.0：转盘选项改完自动更新（停手 0.6 秒后），不用再找「更新转盘」按钮
  (function () {
    const ta = $("wheelOptions"), btn = $("updateWheelBtn"); if (!ta || !btn) return;
    let t = null;
    ta.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => btn.click(), 600); });
  })();

  // v4.1：状态栏文案变化时轻轻淡入（纯数字跳动不触发，免得计时器一直闪）
  try {
    if (!FX.reduce && typeof MutationObserver !== "undefined") {
      const strip = (t) => (t || "").replace(/[\d.:,，·\s]+/g, "");
      const seen = new WeakMap();
      const mo = new MutationObserver((list) => {
        const touched = new Set();
        list.forEach((m) => { const el = m.target.nodeType === 3 ? m.target.parentElement : m.target; const rl = el && el.closest && el.closest(".result-line"); if (rl) touched.add(rl); });
        touched.forEach((el) => {
          const k = strip(el.textContent);
          if (seen.get(el) === k) return;
          const had = seen.has(el); seen.set(el, k);
          if (!had) return;
          el.classList.remove("fx-text"); void el.offsetWidth; el.classList.add("fx-text");
        });
      });
      document.querySelectorAll(".toy").forEach((p) => mo.observe(p, { subtree: true, childList: true, characterData: true }));
    }
  } catch (e) { /* 忽略 */ }

  // R14：深链移到最后执行。原来在 const __toyboxHandle 声明之前，46 个玩具的初始化会碰 TDZ
  // （Cannot access '__toyboxHandle' before initialization），整个脚本中断、深链失效、游戏点开是死的。
  // v1.30 要求不变：必须在所有 toyInitFns 注册之后。
  if (TOYS.some((t) => t.id === window.location.hash.slice(1))) showToy(window.location.hash.slice(1));
  else showHome();
})(); // IIFE 收尾（原 renderTimer() 调用已搬进 timer 段的初始化）
