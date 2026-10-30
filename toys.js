/* 宿舍玩具盒 · toys.js — 纯前端，无后端，无依赖 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 侧边栏：置顶 7 个在最前面，其余按顺序，一行两个方块 ---------- */
  const PINNED_IDS = ["wheel", "dice", "reaction", "guess", "score", "beads", "frog", "fortune"];
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
    const em = document.createElement("span");
    em.className = "tile-emoji";
    em.textContent = parts.emoji;
    const nm = document.createElement("span");
    nm.className = "tile-name";
    nm.textContent = parts.name;
    btn.appendChild(em);
    btn.appendChild(nm);
    btn._q = parts.emoji + parts.name; // v1.30：搜索缓存，避免每敲一个字重算 textContent
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
  drawerNav.appendChild(drawerLabel("全部玩具"));
  TOYS.filter((t) => !PINNED_IDS.includes(t.id)).forEach((t) => drawerNav.appendChild(makeTile(t)));
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
    toyInited[id] = true;
    const fn = toyInitFns[id];
    if (typeof fn === "function") fn();
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
    try {
      const arr = JSON.parse(lsGet(RECENT_KEY, "[]"));
      if (!Array.isArray(arr)) return [];
      return arr.filter((id) => TOYS.some((t) => t.id === id)).slice(0, RECENT_MAX);
    } catch (e) { return []; }
  }
  function recordRecent(id) {
    if (!TOYS.some((t) => t.id === id)) return;
    lsSet(RECENT_KEY, JSON.stringify([id, ...getRecent().filter((x) => x !== id)].slice(0, RECENT_MAX)));
  }
  function renderRecent() {
    const wrap = $("recentWrap");
    const strip = $("recentStrip");
    if (!wrap || !strip) return;
    const ids = getRecent();
    strip.innerHTML = "";
    if (ids.length === 0) { wrap.classList.add("hidden"); return; }
    wrap.classList.remove("hidden");
    ids.forEach((id) => {
      const t = TOYS.find((x) => x.id === id);
      if (!t) return;
      const parts = splitLabel(t.label);
      const btn = document.createElement("button");
      btn.className = "recent-chip";
      btn.setAttribute("data-toy", id);
      btn.setAttribute("aria-label", "最近玩过：" + parts.name);
      const em = document.createElement("span");
      em.className = "recent-emoji";
      em.textContent = parts.emoji;
      const nm = document.createElement("span");
      nm.className = "recent-name";
      nm.textContent = parts.name;
      btn.appendChild(em);
      btn.appendChild(nm);
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
  /* v1.31：工具箱合并——多个入口共享同一个工具箱界面（不同默认 tab）。
     TOYS 列表 66 个 id 不变；点 stopwatch/aa/fx/bmi 会重定向到对应工具箱。 */
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
    // 工具箱重定向：共享界面，默认 tab 不同
    if (TOOLBOX_REDIRECT[id]) {
      window._toolboxDefaultTab = TOOLBOX_DEFAULT_TAB[id];
      id = TOOLBOX_REDIRECT[id];
    }
    ensureToyInit(id);
    recordRecent(clickedId);
    if (currentToy && currentToy !== id) leaveToy(currentToy);
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-home").classList.add("hidden");
    $("toy-" + id).classList.remove("hidden");
    allTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === clickedId));
    allHomeTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === clickedId));
    currentToy = id;
    if (toyEnterResume[id]) toyEnterResume[id]();
    if (window.location.hash !== "#" + clickedId) window.location.hash = clickedId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /* v1.27：回主页——藏起所有玩具，露出置顶 + 全部游戏 */
  function showHome() {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openDrawer() {
    $("sideDrawer").classList.add("open");
    $("drawerOverlay").classList.remove("hidden");
  }
  function closeDrawer() {
    $("sideDrawer").classList.remove("open");
    $("drawerOverlay").classList.add("hidden");
  }
  $("menuBtn").addEventListener("click", openDrawer);
  $("homeBtn").addEventListener("click", showHome);
  $("drawerCloseBtn").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);
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
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, a0, a1);
        ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        ctx.fill();
        // 文字
        ctx.save();
        ctx.rotate((a0 + a1) / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#241300";
        ctx.font = "bold 17px sans-serif";
        ctx.fillText(wheelOptions[i], r - 14, 6);
        ctx.restore();
      }
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
    drawWheel(0);

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
      const duration = 2600;
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
    function rollDice(count) {
      const stage = $("diceStage");
      stage.classList.add("rolling");
      let ticks = 0;
      const timer = setInterval(() => {
        const faces = [];
        for (let i = 0; i < count; i++) faces.push(pick(DICE_FACES));
        stage.textContent = faces.join(" ");
        ticks++;
        if (ticks >= 8) {
          clearInterval(timer);
          stage.classList.remove("rolling");
          const values = [];
          for (let i = 0; i < count; i++) values.push(1 + Math.floor(Math.random() * 6));
          stage.textContent = values.map((v) => DICE_FACES[v - 1]).join(" ");
          const sum = values.reduce((a, b) => a + b, 0);
          $("diceResult").textContent = count === 1
            ? "🎲 扔出了 " + values[0] + " 点"
            : "🎲 扔出了 " + values.join(" + ") + " = " + sum + " 点";
        }
      }, 80);
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
        const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
        for (let i = 0; i < 6; i++) {
          const f = document.createElement("div");
          f.className = "dice-face f" + (i + 1);
          f.textContent = faces[i];
          d.appendChild(f);
        }
        const orientations = ["rotateX(0) rotateY(0)", "rotateX(0) rotateY(180deg)", "rotateX(0) rotateY(-90deg)", "rotateX(0) rotateY(90deg)", "rotateX(-90deg) rotateY(0)", "rotateX(90deg) rotateY(0)"];
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
        ctx.fillStyle = "rgba(255, 215, 0, 0.3)";
        ctx.fill();
        ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 2; ctx.stroke();
        // 数据点
        ctx.fillStyle = "#ffd700";
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
    let picked = [];
    function namePool() {
      // 去重（保序）：重名会让“抽过的不再重复”误判，两个同名算一个人
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
      const noRepeat = $("noRepeatCheck").checked;
      let candidates = noRepeat ? pool.filter((n) => !picked.includes(n)) : pool;
      if (candidates.length === 0) {
        picked = [];
        candidates = pool;
        $("pickResult").textContent = "上一轮抽完了，自动重置，继续抽！";
      }
      let ticks = 0;
      const result = $("pickResult");
      const timer = setInterval(() => {
        result.textContent = pick(pool);
        ticks++;
        if (ticks >= 10) {
          clearInterval(timer);
          const winner = pick(candidates);
          result.textContent = "🎉 " + winner;
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
    $("nameList").addEventListener("change", renderPickLeft);
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
        clearInterval(timerId);
        timerId = null;
        $("timerStartBtn").textContent = "继续专注 ▶";
        $("timerStatus").textContent = "暂停中。歇一会没关系，回来继续。";
        return;
      }
      if (remaining === 0) remaining = focusSeconds;
      $("timerStartBtn").textContent = "暂停 ⏸";
      $("timerStatus").textContent = "专注中……手机翻过去，这段时间只干一件事。";
      timerId = setInterval(() => {
        remaining--;
        renderTimer();
        if (remaining <= 0) {
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
    function groupNamePool() {
      const seen = new Set();
      return $("groupNames").value.split("\n").map((s) => s.trim()).filter((s) => {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      });
    }
    let lastGroups = [];
    $("doGroupBtn").addEventListener("click", () => {
      const names = groupNamePool();
      const count = parseInt($("groupCount").value, 10);
      if (names.length < count) {
        $("groupResult").textContent = "人太少了，至少要 " + count + " 个人才能分 " + count + " 组。";
        return;
      }
      const shuffled = shuffle(names.slice());
      const groups = Array.from({ length: count }, () => []);
      shuffled.forEach((name, i) => groups[i % count].push(name));
      lastGroups = groups;
      const grid = $("groupGrid");
      grid.innerHTML = "";
      groups.forEach((members, gi) => {
        const card = document.createElement("div");
        card.className = "group-card";
        const title = document.createElement("h3");
        title.textContent = "第 " + (gi + 1) + " 组 · " + members.length + " 人";
        const ul = document.createElement("ul");
        members.forEach((m, mi) => {
          const li = document.createElement("li");
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
      $("groupResult").textContent = "🎉 已随机分成 " + count + " 组，每组第一个是队长。";
      $("copyGroupsBtn").classList.remove("hidden");
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
        setReactionStage("等绿色……", "别点！等它变绿", "waiting");
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
        setReactionStage("抢跑了！", "变绿之前别点，重新来", "");
        $("reactionResult").textContent = "❌ 犯规：抢跑。再点一次重新开始。";
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
        setReactionStage("点我再测一次", "最好成绩 " + reactionBest + " ms", "");
        renderReaction();
      }
    }
    $("reactionStage").addEventListener("click", reactionClick);
    $("reactionStage").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reactionClick(); }
    });
    renderReaction();

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
      if (you === cpu) { msg = "平局！再来。"; }
      else if (RPS_BEATS[you] === cpu) { rpsScore.you++; msg = "🎉 你赢了这局！"; }
      else { rpsScore.cpu++; msg = "😤 电脑赢了这局。"; }
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
      // 插到 guessBtn 后面
      const gb = $("guessBtn");
      if (gb && gb.parentNode) {
        // stub 兼容：直接 append
        guessSec.appendChild(modeRow);
        guessSec.appendChild(turnP);
        guessSec.appendChild(rangeWrap);
      }
    }
    function renderGuessRange() {
      const pctLow = ((guessLow - 1) / 99) * 100;
      const pctHigh = ((guessHigh - 1) / 99) * 100;
      rangeFill.style.left = pctLow + "%";
      rangeFill.style.width = (pctHigh - pctLow) + "%";
      rangeLabel.textContent = "🎯 区间：[" + guessLow + ", " + guessHigh + "] · 已猜 " + guessTries.length + " 次";
    }
    function resetGuessRange() { guessLow = 1; guessHigh = 100; guessTurn = 0; renderGuessRange(); }
    soloBtn.addEventListener("click", () => {
      guessMode = "solo";
      soloBtn.classList.add("picked"); duoBtn.classList.remove("picked");
      turnP.style.display = "none";
      $("guessResult").textContent = "单人模式：猜中炸弹即拆弹成功！";
    });
    duoBtn.addEventListener("click", () => {
      guessMode = "duo";
      duoBtn.classList.add("picked"); soloBtn.classList.remove("picked");
      turnP.style.display = "";
      turnP.textContent = "👤 轮到玩家一猜（猜中者输！）";
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
        if (guessMode === "duo") {
          const loser = guessTurn === 0 ? "玩家一" : "玩家二";
          const winner = guessTurn === 0 ? "玩家二" : "玩家一";
          $("guessResult").textContent = "💥 " + loser + " 猜中炸弹，输了！" + winner + " 获胜！";
        } else {
          const tries = guessTries.length;
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
      guessTarget = 1 + Math.floor(Math.random() * 100);
      guessTries = [];
      renderGuessChips();
      renderGuessCount();
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
    let memoryStartAt = 0;
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
      return memoryStartAt ? Math.floor((performance.now() - memoryStartAt) / 1000) : 0;
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
      memoryStartAt = 0;
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
      if (memoryLock || card.classList.contains("flipped") || card.classList.contains("matched")) return;
      if (!memoryStartAt) {
        memoryStartAt = performance.now();
        memoryTimerId = setInterval(renderMemoryStats, 500);
      }
      card.classList.add("flipped");
      card.textContent = card.getAttribute("data-emoji");
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
              $("memoryResult").textContent = msg;
              renderMemoryBest();
            } else {
              $("memoryResult").textContent = "配对成功！还剩 " + (MEMORY_EMOJIS.length - memoryMatched) + " 对。";
            }
          } else {
            a.classList.remove("flipped");
            b.classList.remove("flipped");
            a.textContent = "❓";
            b.textContent = "❓";
            $("memoryResult").textContent = "没配上，再试一次。";
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
    toyEnterResume.memory = () => { if (memoryStartAt && memoryMatched < MEMORY_EMOJIS.length && !memoryTimerId) memoryTimerId = setInterval(renderMemoryStats, 500); };

  };
  /* ---------- 12. 打字测试 ---------- */
  toyInitFns["typing"] = function () {
    const TYPING_BEST_KEY = "dorm-toybox-typing-best-v1";
    let typingTarget = "";
    let typingStartAt = 0;
    let typingTimerId = null;
    let typingDone = false;
    let typingComposing = false; // 输入法正在拼字（composition）时不比对
    function loadTypingBest() {
      try { return parseInt(localStorage.getItem(TYPING_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    let typingBest = loadTypingBest();
    function renderTypingBest() {
      $("typingBest").textContent = typingBest > 0
        ? "宿舍纪录：" + typingBest + " 字/分"
        : "还没人留下纪录。第一个打完的就是纪录。";
    }
    function typingElapsedSec() {
      return typingStartAt ? (performance.now() - typingStartAt) / 1000 : 0;
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
      typingTarget = pick(TYPING_SENTENCES);
      typingStartAt = 0;
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
        else { span.classList.add("bad"); }
      }
      const elapsed = typingElapsedSec();
      $("typingStats").textContent = "用时 " + Math.floor(elapsed) + " 秒 · 已打 " + input.length + " 字 · 正确 " + correct + " 字";
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
        $("typingResult").textContent = msg;
        renderTypingBest();
      }
    }
    function typingOnInput() {
      if (typingComposing) return;
      if (!typingStartAt && !typingDone) {
        typingStartAt = performance.now();
        typingTimerId = setInterval(typingTick, 200);
      }
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
    typingNewSentence();

    // 退出就停：打字计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    toyLeaveCleanup.typing = () => { if (typingTimerId) { clearInterval(typingTimerId); typingTimerId = null; } };
    toyEnterResume.typing = () => { if (typingStartAt && !typingDone && !typingTimerId) typingTimerId = setInterval(typingTick, 200); };

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
      '<p>三个 🍒/🍋/🔔/⭐ 一样：+10 分</p>' +
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
      slotsStats = { a: 0, b: 0, round: 1, turn: "a" };
      saveSlotsStats();
      renderSlotsReels("a", Array(9).fill("🍒"));
      renderSlotsReels("b", Array(9).fill("🍒"));
      slotsResultEl("a").textContent = "等你拉。";
      slotsResultEl("b").textContent = "等你拉。";
      renderSlotsStats();
    });
    slotsResultEl("a").textContent = "等你拉。";
    slotsResultEl("b").textContent = "等你拉。";
    renderSlotsStats();

  };
  /* ---------- 玩具搜索：搜名字，主页方块和抽屉方块一起过滤，露出主页结果 ---------- */
  $("toySearch").addEventListener("input", () => {
    const q = $("toySearch").value.trim();
    allTiles().forEach((b) => {
      b.classList.toggle("hidden", q !== "" && !(b._q || b.textContent).includes(q));
    });
    allHomeTiles().forEach((b) => {
      b.classList.toggle("hidden", q !== "" && !(b._q || b.textContent).includes(q));
    });
    if (q !== "") { closeDrawer(); showHome(); }
  });

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
    let sudokuStartAt = 0;
    let sudokuTimerId = null;
    let sudokuWon = false;
    function loadSudokuBest() {
      try { return parseInt(localStorage.getItem(SUDOKU_BEST_KEY) || "0", 10) || 0; }
      catch (e) { return 0; }
    }
    let sudokuBest = loadSudokuBest();
    function sudokuElapsedSec() { return sudokuStartAt ? (performance.now() - sudokuStartAt) / 1000 : 0; }
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
      if (!sudokuStartAt) {
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
      sudokuStartAt = 0;
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
    toyEnterResume.sudoku = () => { if (sudokuStartAt && !sudokuWon && !sudokuTimerId) sudokuTimerId = setInterval(renderSudokuStats, 1000); };

  };
  /* ---------- 16. 舒尔特方格 ---------- */
  toyInitFns["schulte"] = function () {
    // 退出就停：舒尔特计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    const SCHULTE_BEST_KEY = "dorm-toybox-schulte-best-v1";
    let schulteNext = 1;
    let schulteStartAt = 0;
    let schulteTimerId = null;
    let schulteDone = false;
    function loadSchulteBest() {
      try { return parseFloat(localStorage.getItem(SCHULTE_BEST_KEY) || "0") || 0; }
      catch (e) { return 0; }
    }
    let schulteBest = loadSchulteBest();
    function renderSchulteBest() {
      $("schulteBest").textContent = schulteBest > 0
        ? "宿舍纪录：" + schulteBest.toFixed(1) + " 秒"
        : "还没人通关。第一个通关的就是纪录。";
    }
    function schulteElapsed() { return schulteStartAt ? (performance.now() - schulteStartAt) / 1000 : 0; }
    function renderSchulteStats() { $("schulteStats").textContent = "用时 " + schulteElapsed().toFixed(1) + " 秒"; }
    function schulteNewGame() {
      const numbers = shuffle(Array.from({ length: 25 }, (_, i) => i + 1));
      schulteNext = 1;
      schulteStartAt = 0;
      schulteDone = false;
      if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; }
      const grid = $("schulteGrid");
      grid.innerHTML = "";
      numbers.forEach((n) => {
        const cell = document.createElement("button");
        cell.className = "schulte-cell";
        cell.textContent = String(n);
        cell.setAttribute("data-num", String(n));
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
      if (n !== schulteNext) {
        $("schulteResult").textContent = "点错了，要点的是 " + schulteNext + "。";
        return;
      }
      if (!schulteStartAt) {
        schulteStartAt = performance.now();
        schulteTimerId = setInterval(renderSchulteStats, 100);
      }
      cell.classList.add("done");
      schulteNext++;
      if (schulteNext > 25) {
        schulteDone = true;
        if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; }
        const seconds = schulteElapsed();
        let msg = "🎉 完成！用时 " + seconds.toFixed(1) + " 秒。";
        if (schulteBest === 0 || seconds < schulteBest) {
          schulteBest = seconds;
          saveBest(SCHULTE_BEST_KEY, seconds);
          msg += "新纪录！";
        }
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
    schulteNewGame();

    // 退出就停：舒尔特计时只刷显示，回来再续上（用时按时间戳算，不会丢）
    toyLeaveCleanup.schulte = () => { if (schulteTimerId) { clearInterval(schulteTimerId); schulteTimerId = null; } };
    toyEnterResume.schulte = () => { if (schulteStartAt && !schulteDone && !schulteTimerId) schulteTimerId = setInterval(renderSchulteStats, 100); };

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
    $("ledText").style.color = LED_COLORS[0];
    $("ledText").style.animationDuration = ledDuration;
    $("ledInput").addEventListener("input", () => {
      $("ledText").textContent = $("ledInput").value.trim() || "我在这里！";
      ledSyncFull();
    });
    $("ledStartBtn").addEventListener("click", () => {
      ledRunning = !ledRunning;
      $("ledText").classList.toggle("scrolling", ledRunning);
      $("ledStartBtn").textContent = ledRunning ? "停下来 ⏸" : "开始滚动 ▶";
      $("ledResult").textContent = ledRunning ? "滚动中，举起手机给大家看。" : "已暂停。";
    });

    /* 全屏展示：横屏全黑背景，双击屏幕退出；进全屏前规则已经写在玩法介绍了 */
    function ledSyncFull() {
      $("ledFullText").textContent = $("ledText").textContent;
      $("ledFullText").style.color = $("ledText").style.color || LED_COLORS[0];
      $("ledFullText").style.animationDuration = ledDuration;
    }
    function ledOpenFull() {
      ledSyncFull();
      $("ledOverlay").classList.remove("hidden");
      $("ledFullText").classList.add("scrolling");
      try {
        const p = screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape");
        if (p && p.catch) p.catch(() => { /* 不支持自动转横屏，用户手动横过来也一样 */ });
      } catch (e) { /* 忽略 */ }
    }
    function ledCloseFull() {
      $("ledOverlay").classList.add("hidden");
      $("ledFullText").classList.remove("scrolling");
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
        grid.appendChild(cell);
      }
      const pct = Math.round((lived / LIFE_TOTAL_MONTHS) * 100);
      $("lifeStats").textContent = "你已经过了 " + lived + " 个月（" + pct + "%），还剩 " + remaining + " 个月。金色的是已经过的。";
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
        // 导出图放大一倍（每颗 48px）：64 格的图在手机上看，字母才够大；孔也放大，字母全落在白底上
        const cell = 48, margin = 40;
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
        $("beadsResult").textContent = "图纸已导出为图片，照着拼就行。";
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
    function noiseRender(db) {
      $("noiseDb").textContent = Math.round(db) + " dB";
      $("noiseMeter").style.width = Math.min(100, Math.max(0, db)) + "%";
      $("noiseLevel").textContent = noiseLevel(db);
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
      { id: "rain", name: "🌧 雨声", freq: 1200, q: 0.5, gain: 0.5 },
      { id: "white", name: "📻 白噪音", freq: 8000, q: 0.2, gain: 0.35 },
      { id: "pink", name: "🌸 粉红噪音", freq: 800, q: 0.5, gain: 0.5 },
      { id: "fan", name: "🌀 风扇声", freq: 400, q: 1, gain: 0.6 },
      { id: "sea", name: "🌊 海浪声", freq: 600, q: 0.8, gain: 0.55 },
    ];
    let wnCtx = null, wnNodes = null, wnCurrent = null;
    function wnStopAll(silent) {
      if (wnNodes) {
        try { wnNodes.src.stop(); } catch (e) { /* 忽略 */ }
        try { wnNodes.src.disconnect(); } catch (e) { /* 忽略 */ }
        wnNodes = null;
      }
      wnCurrent = null;
      if (!silent) $("wnResult").textContent = "已停止。";
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
          const len = wnCtx.sampleRate * 2;
          const buffer = wnCtx.createBuffer(1, len, wnCtx.sampleRate);
          const data = buffer.getChannelData(0);
          let last = 0;
          for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            if (s.id === "pink" || s.id === "fan" || s.id === "sea") { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
            else data[i] = white;
          }
          const src = wnCtx.createBufferSource();
          src.buffer = buffer;
          src.loop = true;
          const filter = wnCtx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = s.freq;
          filter.Q.value = s.q;
          const gain = wnCtx.createGain();
          gain.gain.value = s.gain * (parseInt($("wnVolume").value, 10) / 100 || 0.6);
          src.connect(filter);
          filter.connect(gain);
          gain.connect(wnCtx.destination);
          src.start();
          wnNodes = { src, gain };
          wnCurrent = s.id;
          $("wnResult").textContent = "正在播放：" + s.name + "。";
        } catch (e) { $("wnResult").textContent = "播放失败，换个浏览器试试。"; }
      });
      $("wnSounds").appendChild(b);
    });
    $("wnVolume").addEventListener("input", () => {
      if (wnNodes) wnNodes.gain.gain.value = (parseInt($("wnVolume").value, 10) / 100 || 0) * 0.5;
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
    doodleCanvas.addEventListener("pointerdown", (e) => {
      if (!doodleCtx) return;
      if (e.preventDefault) e.preventDefault();
      doodleDrawing = true;
      const s = doodleScale();
      doodleLast = { x: e.offsetX * s, y: e.offsetY * s };
      doodleStrokes++;
      $("doodleResult").textContent = "已画 " + doodleStrokes + " 笔，点保存存成图片。";
    });
    doodleCanvas.addEventListener("pointermove", (e) => {
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
      if (doodleCtx) { doodleCtx.fillStyle = "#ffffff"; doodleCtx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height); }
      doodleStrokes = 0;
      $("doodleResult").textContent = "已清空，重新画吧。";
    });
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
      if (snakeFoodCount === 1) { snakeFood = { x: 11, y: 8 }; return; } // 第一颗固定在正前方，上手先吃一口
      if (snakeFoodCount === 2) { snakeFood = { x: 8, y: 11 }; return; } // 第二颗固定在正下方，转向后能吃到
      let p;
      do { p = { x: Math.floor(Math.random() * SNAKE_GRID), y: Math.floor(Math.random() * SNAKE_GRID) }; }
      while (snakeBody.some((s) => s.x === p.x && s.y === p.y));
      snakeFood = p;
    }
    function snakeReset() {
      snakeBody = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
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
        snakeUpdateScore();
        snakePlaceFood();
        // 吃得越多越快，最快 80ms 一步
        if (snakeTimer) { clearInterval(snakeTimer); snakeTimer = setInterval(snakeStep, Math.max(80, 150 - snakeScore * 5)); }
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
      $("snakeStatus").textContent = "💥 游戏结束！得分 " + snakeScore + "，最高 " + Math.max(snakeBest(), snakeScore) + "。点重新开始再来一局。";
      $("snakeStartBtn").textContent = "开始 ▶";
    }
    function snakeStart() {
      if (snakeState === "over" || snakeState === "idle") snakeReset();
      if (snakeTimer) return;
      snakeState = "running";
      snakeTimer = setInterval(snakeStep, Math.max(80, 150 - snakeScore * 5));
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
      { text: "再来一次 🎰", weight: 2 },
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
        const del = document.createElement("button");
        del.className = "btn ghost-btn small";
        del.textContent = "删掉";
        del.addEventListener("click", () => { todoItems = todoItems.filter((x) => x !== item); todoSave(); todoRender(); });
        row.appendChild(cb); row.appendChild(span); row.appendChild(del);
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
        if (tTimer) { clearInterval(tTimer); tTimer = setInterval(tTick, Math.max(100, 800 - (tLevel - 1) * 70)); }
      }
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
      g2048Spawn();
      g2048SaveBest();
      g2048Render();
      if (!gWon && g2048.some((v) => v >= 2048)) { gWon = true; $("g2048Status").textContent = "🎉 拼出 2048 了！太强了，还能继续往上拼。"; }
      else if (g2048CanMove()) { if (!gWon) $("g2048Status").textContent = "继续，拼出更大的数。"; }
      else { gOver = true; $("g2048Status").textContent = "💥 拼不动了！得分 " + gScore + "，最高 " + Math.max(g2048Best(), gScore) + "。点新一局再来。"; }
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
        btn.addEventListener("pointerdown", () => { pressTimer = setTimeout(() => { mClick(i, true); pressTimer = null; }, 450); });
        btn.addEventListener("pointerup", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
        btn.addEventListener("pointerleave", () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
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
        $("minesStatus").textContent = "💥 踩到雷了！用时 " + mSeconds + " 秒。点新一局再来。";
        mRender();
        return;
      }
      mFlood(i);
      mRender();
      if (mCells.every((c) => c.mine || c.revealed)) {
        mOver = true; mStopTimer();
        $("minesFaceBtn").textContent = "😎";
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
    try { schCourses = JSON.parse(localStorage.getItem(SCH_KEY) || "[]") || []; } catch (e) { schCourses = []; }
    function schSave() { try { localStorage.setItem(SCH_KEY, JSON.stringify(schCourses)); } catch (e) { /* 忽略 */ } }
    function schRender() {
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
              schCourses = schCourses.filter((c) => c !== course);
              schSave(); schRender();
              $("schResult").textContent = "已删掉「" + course.name + "」。";
            } else {
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
    function moleWhack(i) {
      if (!moleRunning) return;
      if (moleActive.has(i)) {
        moleActive.delete(i);
        moleHoles[i].classList.remove("up");
        moleHoles[i].textContent = "🕳️";
        moleScore++;
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
      $("moleStartBtn").textContent = "再来一局 ↺";
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
      if (gomokuLineLen(bestIdx, 2) >= 5) gWinner = 2;
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
      if (gomokuLineLen(idx, gTurn) >= 5) { gWinner = gTurn; gomokuRender(); return; }
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
    function pianoPlay(noteName) {
      const note = PIANO_NOTES.find((n) => n.name === noteName);
      if (!note) return;
      pianoLastNote = note.name + " " + note.label;
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
    (function buildPiano() {
      const wrap = $("pianoKeys");
      const whites = PIANO_NOTES.filter((n) => !n.black);
      whites.forEach((note) => {
        const b = document.createElement("button");
        b.className = "piano-white";
        b.setAttribute("data-note", note.name);
        b.textContent = note.label + " " + note.key.toUpperCase();
        b.addEventListener("click", () => pianoPlay(note.name));
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
        b.addEventListener("click", () => pianoPlay(note.name));
        pianoKeyBtns[note.name] = b;
        wrap.appendChild(b);
      });
    })();
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
    toyLeaveCleanup.piano = () => pianoStopSong();
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
      if (saved && typeof saved.total === "number") gachaState = saved;
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
        sokobanBoxes[bi] = { x: bx, y: by };
      }
      sokobanPlayer = { x: nx, y: ny };
      sokobanMoves++;
      if (sokobanBoxes.every((b) => sokobanTargets.has(b.x + "," + b.y))) {
        sokobanWon = true;
        $("sokobanStatus").textContent = "🎉 第 " + (sokobanLevel + 1) + " 关通过！用了 " + sokobanMoves + " 步。"
          + (sokobanLevel < 2 ? " 点第 " + (sokobanLevel + 2) + " 关继续。" : " 三关全通，你是推箱子大师！");
      }
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
    sokobanLoad(0);
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get sokoban() { return { level: sokobanLevel, player: { x: sokobanPlayer.x, y: sokobanPlayer.y }, boxes: sokobanBoxes.map((b) => ({ x: b.x, y: b.y })), moves: sokobanMoves, won: sokobanWon }; },
        sokobanLoad(level) { sokobanLoad(level); },
        sokobanMove(dir) { sokobanMove(dir); },
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
      breakoutCtx.fillStyle = "#f5c542";
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
          b.dy = -b.dy;
          break;
        }
      }
      const left = breakoutBricks.filter((br) => br.alive).length;
      $("breakoutScore").textContent = "得分 " + breakoutScore + " · 砖块 " + left + " · 命 " + breakoutLives;
      if (left === 0) {
        breakoutRunning = false;
        if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
        $("breakoutStatus").textContent = "🎉 通关！得分 " + breakoutScore + "，砖块全碎了。";
        breakoutRender();
        return;
      }
      if (b.y - b.r > BREAKOUT_H) {
        breakoutLives--;
        if (breakoutLives <= 0) {
          breakoutRunning = false;
          if (breakoutTimerId) { clearInterval(breakoutTimerId); breakoutTimerId = null; }
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

  };
  /* ---------- 49. 井字棋 ---------- */
  toyInitFns["tictactoe"] = function () {
    const TICTACTOE_KEY = "dorm-toybox-tictactoe-v1";
    let tttBoard = new Array(9).fill("");
    let tttOver = false;
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
      let bestScore = -Infinity, bestIdx = -1;
      for (let i = 0; i < 9; i++) {
        if (tttBoard[i]) continue;
        tttBoard[i] = "O";
        const s = tttMinimax(tttBoard, false, 0);
        tttBoard[i] = "";
        if (s > bestScore) { bestScore = s; bestIdx = i; }
      }
      if (bestIdx >= 0) tttBoard[bestIdx] = "O";
      return bestIdx;
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
      let w = tttWinner(tttBoard);
      if (w) { tttFinish(w); return; }
      tttAiMove();
      w = tttWinner(tttBoard);
      if (w) tttFinish(w);
      else $("tictactoeStatus").textContent = "轮到你（❌）落子。";
      tttRender();
    }
    function tttFinish(w) {
      tttOver = true;
      if (w === "X") { tttRecord.win++; $("tictactoeStatus").textContent = "🎉 你赢了！电脑也有失手的时候。"; }
      else if (w === "O") { tttRecord.lose++; $("tictactoeStatus").textContent = "😢 电脑赢了。再来一局报仇？"; }
      else { tttRecord.draw++; $("tictactoeStatus").textContent = "🤝 平局！能逼平满算的电脑，你很强。"; }
      tttSave();
      tttRender();
    }
    function tttReset() { tttBoard = new Array(9).fill(""); tttOver = false; $("tictactoeStatus").textContent = "轮到你（❌）落子。"; tttRender(); }
    $("tictactoeResetBtn").addEventListener("click", tttReset);
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
    let linkupBoard = [], linkupPicked = -1, linkupLeft = 0, linkupSeconds = 0, linkupTimerId = null, linkupOver = false;
    function linkupNewBoard() {
      const tiles = [];
      LINKUP_EMOJIS.forEach((em) => { tiles.push(em, em); });
      for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
      linkupBoard = tiles;
      linkupLeft = LINKUP_EMOJIS.length;
      linkupPicked = -1; linkupOver = false;
    }
    function linkupReset() {
      linkupNewBoard();
      linkupSeconds = 0;
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
      const pair = linkupFindPair();
      if (!pair) { $("linkupStatus").textContent = "没有能连的对子了，点洗牌。"; return; }
      linkupRender();
      const cells = $("linkupGrid").children;
      if (cells[pair[0]]) cells[pair[0]].classList.add("hint");
      if (cells[pair[1]]) cells[pair[1]].classList.add("hint");
    });
    $("linkupShuffleBtn").addEventListener("click", () => {
      if (linkupOver) return;
      const rest = linkupBoard.filter(Boolean);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      let k = 0;
      linkupBoard = linkupBoard.map((v) => (v ? rest[k++] : ""));
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
    let slide15Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    let slide15Moves = 0, slide15Best = null;
    try { const b = parseInt(localStorage.getItem(SLIDE15_KEY) || "", 10); if (b > 0) slide15Best = b; } catch (e) { /* 忽略 */ }
    function slide15Render() {
      const grid = $("slide15Grid");
      grid.innerHTML = "";
      slide15Board.forEach((v, i) => {
        const cell = document.createElement("button");
        cell.className = "slide15-cell" + (v === 0 ? " empty" : "");
        cell.textContent = v === 0 ? "" : String(v);
        cell.setAttribute("aria-label", v === 0 ? "空格" : "数字 " + v);
        cell.addEventListener("click", () => slide15Move(i));
        grid.appendChild(cell);
      });
      $("slide15Status").textContent = "已走 " + slide15Moves + " 步 · 最好 " + (slide15Best === null ? "—" : slide15Best + " 步");
    }
    function slide15Move(i) {
      const empty = slide15Board.indexOf(0);
      const ex = empty % 4, ey = Math.floor(empty / 4);
      const ix = i % 4, iy = Math.floor(i / 4);
      if (Math.abs(ex - ix) + Math.abs(ey - iy) !== 1) return; // 只能滑空格旁边的
      [slide15Board[i], slide15Board[empty]] = [slide15Board[empty], slide15Board[i]];
      slide15Moves++;
      if (slide15Board.every((v, j) => v === (j === 15 ? 0 : j + 1))) {
        if (slide15Best === null || slide15Moves < slide15Best) {
          slide15Best = slide15Moves;
          saveBest(SLIDE15_KEY, slide15Best);
        }
        $("slide15Status").textContent = "🎉 拼好了！用了 " + slide15Moves + " 步，最好 " + slide15Best + " 步。";
      }
      slide15Render();
    }
    function slide15Shuffle() {
      // 从已解状态随机走 100 步（保证可解）
      slide15Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
      slide15Moves = 0;
      for (let n = 0; n < 100; n++) {
        const empty = slide15Board.indexOf(0);
        const ex = empty % 4, ey = Math.floor(empty / 4);
        const opts = [];
        if (ex > 0) opts.push(empty - 1);
        if (ex < 3) opts.push(empty + 1);
        if (ey > 0) opts.push(empty - 4);
        if (ey < 3) opts.push(empty + 4);
        const pick = opts[Math.floor(Math.random() * opts.length)];
        [slide15Board[pick], slide15Board[empty]] = [slide15Board[empty], slide15Board[pick]];
      }
      slide15Render();
    }
    $("slide15ShuffleBtn").addEventListener("click", slide15Shuffle);
    $("slide15ResetBtn").addEventListener("click", () => { slide15Board = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]; slide15Moves = 0; slide15Render(); });
    slide15Shuffle();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get slide15() { return { board: slide15Board.slice(), moves: slide15Moves, best: slide15Best }; },
        slide15Move(i) { slide15Move(i); },
        slide15Set(board) { slide15Board = board.slice(); slide15Moves = 0; slide15Render(); },
    }));

  };
  /* ---------- 52. 跳一跳 ---------- */
  toyInitFns["jump"] = function () {
    const JUMP_KEY = "dorm-toybox-jump-best-v1";
    const JUMP_W = 340, JUMP_MAX = 280;
    let jumpBest = loadBest(JUMP_KEY);
    let jumpScore = 0, jumpPower = 0, jumpOver = false, jumpCharging = false, jumpChargeId = null;
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
      jumpScore = 0; jumpPower = 0; jumpOver = false; jumpCharging = false;
      jumpPlatA = { x: 20, w: 60 }; jumpPlatB = jumpNewPlatB(); jumpCharX = 34;
      $("jumpStatus").textContent = "按住蓄力，松手起跳。";
      jumpRender();
    }
    function jumpRelease() {
      if (jumpOver || !jumpCharging && jumpPower === 0) return;
      if (jumpChargeId) { clearInterval(jumpChargeId); jumpChargeId = null; }
      jumpCharging = false;
      const dist = (jumpPower / 100) * JUMP_MAX;
      const newX = jumpCharX + dist;
      const center = newX + 16;
      jumpCharX = newX;
      const ch = $("jumpChar");
      ch.style.left = newX + "px";
      ch.style.bottom = "120px";
      setTimeout(() => { ch.style.bottom = "56px"; }, 160);
      jumpPower = 0;
      if (center >= jumpPlatB.x && center <= jumpPlatB.x + jumpPlatB.w) {
        const isCenter = Math.abs(center - (jumpPlatB.x + jumpPlatB.w / 2)) <= 8;
        jumpScore += isCenter ? 2 : 1;
        if (jumpScore > jumpBest) {
          jumpBest = jumpScore;
          saveBest(JUMP_KEY, jumpBest);
        }
        $("jumpStatus").textContent = isCenter ? "🎯 正中心！+2 分！" : "稳稳落下，+1 分。";
        // 场景左移：落脚的台子变成起点，再生成下一个
        setTimeout(() => {
          if (jumpOver) return;
          jumpPlatA = { x: 20, w: jumpPlatB.w };
          jumpCharX = 20 + Math.floor((jumpPlatA.w - 32) / 2);
          jumpPlatB = jumpNewPlatB();
          jumpRender();
        }, 350);
      } else {
        jumpOver = true;
        ch.style.bottom = "-40px";
        $("jumpStatus").textContent = "💔 掉下去了！得分 " + jumpScore + "，点再来一局。";
      }
      jumpRender();
    }
    const jumpStageEl = $("jumpStage");
    jumpStageEl.addEventListener("pointerdown", (e) => {
      if (jumpOver) return;
      if (e.preventDefault) e.preventDefault();
      jumpCharging = true; jumpPower = 0;
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
    function spotdiffPick(i) {
      if (!spotdiffRunning) return;
      if (i === spotdiffOdd) {
        spotdiffScore += 10;
        spotdiffLevel++;
        spotdiffNewRound();
      } else {
        spotdiffScore = Math.max(0, spotdiffScore - 5);
        const cells = $("spotdiffGrid").children;
        if (cells[i]) { cells[i].classList.add("wrong"); setTimeout(() => cells[i].classList.remove("wrong"), 300); }
        $("spotdiffStatus").textContent = "第 " + spotdiffLevel + " 关 · 得分 " + spotdiffScore + " · 剩 " + spotdiffTime + " 秒";
      }
    }
    function spotdiffStart() {
      if (spotdiffRunning) return;
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
      spotdiffLevel = 1; spotdiffScore = 0; spotdiffTime = 60; spotdiffRunning = false;
      spotdiffNewRound();
      $("spotdiffStatus").textContent = "第 1 关 · 得分 0 · 剩 60 秒 · 最好 " + spotdiffBest;
    }
    $("spotdiffStartBtn").addEventListener("click", spotdiffStart);
    $("spotdiffResetBtn").addEventListener("click", spotdiffReset);
    spotdiffReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get spotdiff() { return { level: spotdiffLevel, score: spotdiffScore, time: spotdiffTime, gridSize: spotdiffGridSize, odd: spotdiffOdd, base: spotdiffBase, oddEmoji: spotdiffOddEmoji, running: spotdiffRunning, best: spotdiffBest }; },
        spotdiffSet(base, oddEmoji, odd, gridSize) { spotdiffBase = base; spotdiffOddEmoji = oddEmoji; spotdiffOdd = odd; spotdiffGridSize = gridSize; spotdiffRunning = true; spotdiffRender(); },
        spotdiffPick(i) { spotdiffPick(i); },
    }));

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
            if (it.kind === "coin") catchScore += 10;
            else {
              catchLives--;
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

  };
  /* ---------- 55. 成语接龙 ---------- */
  toyInitFns["idiom"] = function () {
    const IDIOM_KEY = "dorm-toybox-idiom-best-v1";
    // 接龙链：下一个成语的首字 = 上一个成语的尾字（已逐个核对）
    const IDIOM_CHAIN = ["一马当先", "先见之明", "明明白白", "白手起家", "家喻户晓", "晓以大义", "义无反顾", "顾全大局", "局外之人", "人山人海", "海阔天空", "空前绝后", "后来居上", "上下其手", "手到擒来", "来龙去脉", "脉脉含情", "情投意合", "合家欢乐", "乐在其中", "中流砥柱", "柱石之坚", "坚不可摧", "摧枯拉朽", "朽木难雕", "雕虫小技", "技高一筹"];
    let idiomBest = loadBest(IDIOM_KEY);
    let idiomRound = 1, idiomScore = 0, idiomIdx = 0, idiomOptions = [], idiomOver = false, idiomStarted = false;
    function idiomRender() {
      $("idiomCurrent").textContent = IDIOM_CHAIN[idiomIdx];
      const wrap = $("idiomOptions");
      wrap.innerHTML = "";
      idiomOptions.forEach((opt, i) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn";
        b.textContent = opt;
        b.addEventListener("click", () => idiomPick(i));
        wrap.appendChild(b);
      });
      $("idiomStatus").textContent = idiomOver
        ? "🏁 10 轮结束！得分 " + idiomScore + "，最好 " + idiomBest + "。"
        : "第 " + idiomRound + " / 10 轮 · 得分 " + idiomScore + " · 最好 " + idiomBest;
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
      idiomOptions = [correct, d1, d2].sort(() => Math.random() - 0.5);
      idiomRender();
    }
    function idiomPick(i) {
      if (idiomOver || !idiomStarted) return;
      const cur = IDIOM_CHAIN[idiomIdx];
      const correct = IDIOM_CHAIN[idiomIdx + 1];
      if (idiomOptions[i] === correct) idiomScore += 10;
      idiomIdx++;
      idiomRound++;
      if (idiomRound > 10 || idiomIdx >= IDIOM_CHAIN.length - 1) {
        idiomOver = true;
        if (idiomScore > idiomBest) {
          idiomBest = idiomScore;
          saveBest(IDIOM_KEY, idiomBest);
        }
        idiomRender();
        return;
      }
      idiomNewRound();
    }
    function idiomStart() {
      idiomStarted = true; idiomOver = false; idiomRound = 1; idiomScore = 0;
      idiomIdx = Math.floor(Math.random() * (IDIOM_CHAIN.length - 11));
      idiomNewRound();
    }
    $("idiomStartBtn").addEventListener("click", idiomStart);
    $("idiomResetBtn").addEventListener("click", idiomStart);
    idiomIdx = 0; idiomOptions = []; idiomRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get idiom() { return { round: idiomRound, score: idiomScore, current: IDIOM_CHAIN[idiomIdx], options: idiomOptions.slice(), over: idiomOver, best: idiomBest, chain: IDIOM_CHAIN.slice() }; },
        idiomSet(idx) { idiomStarted = true; idiomOver = false; idiomRound = 1; idiomScore = 0; idiomIdx = idx; idiomNewRound(); },
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
    function drumsPlaySound(track) {
      const ctx = drumsAudio();
      if (!ctx) return;
      try {
        if (ctx.state === "suspended") ctx.resume();
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
    function drumsPlay() {
      if (drumsPlaying) return;
      drumsPlaying = true; drumsStep = 0;
      if (drumsTimerId) clearInterval(drumsTimerId);
      drumsTimerId = setInterval(drumsTick, 250);
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
    drumsRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get drums() { return { grid: drumsGrid.map((row) => row.slice()), step: drumsStep, playing: drumsPlaying }; },
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
    let stroopBest = loadBest(STROOP_KEY);
    let stroopScore = 0, stroopTime = 30, stroopWord = "红", stroopInk = "蓝", stroopRunning = false, stroopTimerId = null;
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
      const wrap = $("stroopOptions");
      wrap.innerHTML = "";
      STROOP_COLORS.forEach((c) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn";
        b.textContent = c.name;
        b.addEventListener("click", () => stroopPick(c.name));
        wrap.appendChild(b);
      });
      $("stroopStatus").textContent = "得分 " + stroopScore + " · 剩 " + stroopTime + " 秒 · 最好 " + stroopBest;
    }
    function stroopPick(name) {
      if (!stroopRunning) return;
      if (name === stroopInk) stroopScore += 10;
      else stroopScore = Math.max(0, stroopScore - 5);
      stroopNewRound();
    }
    function stroopStart() {
      if (stroopRunning) return;
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
      stroopScore = 0; stroopTime = 30; stroopRunning = false;
      stroopNewRound();
      $("stroopStatus").textContent = "得分 0 · 剩 30 秒 · 最好 " + stroopBest;
    }
    $("stroopStartBtn").addEventListener("click", stroopStart);
    $("stroopResetBtn").addEventListener("click", stroopReset);
    stroopReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get stroop() { return { score: stroopScore, time: stroopTime, word: stroopWord, ink: stroopInk, running: stroopRunning, best: stroopBest }; },
        stroopSet(word, ink) { stroopWord = word; stroopInk = ink; stroopRunning = true; stroopRender(); },
        stroopPick(name) { stroopPick(name); },
    }));

  };
  /* ---------- 58. 脑筋急转弯 ---------- */
  toyInitFns["riddle"] = function () {
    const RIDDLE_KEY = "dorm-toybox-riddle-best-v1";
    const RIDDLES = [
      { q: "什么东西越洗越脏？", options: ["衣服", "水", "手"], answer: 1 },
      { q: "什么东西早上四条腿，中午两条腿，晚上三条腿？", options: ["狗", "人", "椅子"], answer: 1 },
      { q: "什么东西能装下全世界，却装不下一粒沙？", options: ["袋子", "箱子", "眼睛"], answer: 2 },
      { q: "什么东西越长越短？", options: ["蜡烛", "头发", "绳子"], answer: 0 },
      { q: "什么东西不用的时候朝下，用的时候朝上？", options: ["碗", "帽子", "伞"], answer: 2 },
      { q: "什么东西有口无牙？", options: ["井", "河", "杯子"], answer: 0 },
      { q: "什么东西天一黑就出来，天一亮就消失？", options: ["月亮", "星星", "萤火虫"], answer: 1 },
      { q: "什么东西越热越爱出来，越冷越躲起来？", options: ["冰", "汗", "火"], answer: 1 },
      { q: "什么东西前面是平的，后面是尖的？", options: ["刀", "笔", "针"], answer: 2 },
      { q: "什么东西你天天见，却从来没见过它的真面目？", options: ["天空", "自己的脸", "影子"], answer: 1 },
      { q: "什么东西一到手就变小？", options: ["肥皂", "糖", "冰块"], answer: 2 },
      { q: "什么东西你越是想留住它，它走得越快？", options: ["时间", "水", "风"], answer: 0 },
    ];
    let riddleBest = loadBest(RIDDLE_KEY);
    let riddleOrder = [], riddleIdx = 0, riddleScore = 0, riddleOver = false, riddleStarted = false;
    function riddleRender() {
      if (riddleOver || riddleIdx >= riddleOrder.length) {
        $("riddleQ").textContent = "🏁 12 题答完了！";
        $("riddleOptions").innerHTML = "";
        $("riddleStatus").textContent = "得分 " + riddleScore + " · 最好 " + riddleBest + "。";
        return;
      }
      const r = RIDDLES[riddleOrder[riddleIdx]];
      $("riddleQ").textContent = r.q;
      const wrap = $("riddleOptions");
      wrap.innerHTML = "";
      r.options.forEach((opt, i) => {
        const b = document.createElement("button");
        b.className = "btn ghost-btn";
        b.textContent = opt;
        b.addEventListener("click", () => riddlePick(i));
        wrap.appendChild(b);
      });
      $("riddleStatus").textContent = "第 " + (riddleIdx + 1) + " / 12 题 · 得分 " + riddleScore + " · 最好 " + riddleBest;
    }
    function riddlePick(i) {
      if (riddleOver || !riddleStarted || riddleIdx >= riddleOrder.length) return;
      const r = RIDDLES[riddleOrder[riddleIdx]];
      const wrap = $("riddleOptions");
      const btns = wrap.children;
      if (btns[r.answer]) btns[r.answer].classList.add("correct");
      if (i !== r.answer && btns[i]) btns[i].classList.add("wrong");
      if (i === r.answer) riddleScore += 10;
      riddleIdx++;
      setTimeout(() => {
        if (riddleIdx >= riddleOrder.length) {
          riddleOver = true;
          if (riddleScore > riddleBest) {
            riddleBest = riddleScore;
            saveBest(RIDDLE_KEY, riddleBest);
          }
        }
        riddleRender();
      }, 600);
    }
    function riddleStart() {
      riddleStarted = true; riddleOver = false; riddleIdx = 0; riddleScore = 0;
      riddleOrder = RIDDLES.map((_, i) => i).sort(() => Math.random() - 0.5);
      riddleRender();
    }
    $("riddleStartBtn").addEventListener("click", riddleStart);
    $("riddleResetBtn").addEventListener("click", riddleStart);
    riddleOrder = RIDDLES.map((_, i) => i); riddleRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get riddle() { return { index: riddleIdx, score: riddleScore, total: riddleOrder.length, over: riddleOver, best: riddleBest, current: riddleOrder.length > 0 ? RIDDLES[riddleOrder[riddleIdx]] : null }; },
        riddleSet(order) { riddleStarted = true; riddleOver = false; riddleIdx = 0; riddleScore = 0; riddleOrder = order.slice(); riddleRender(); },
        riddlePick(i) { riddlePick(i); },
    }));

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
          return false;
        }
        return true;
      });
      // 怪兽撞飞船 / 掉出底边
      shooterEnemies = shooterEnemies.filter((e) => {
        if (Math.abs(e.x - shooterShipX) < 24 && Math.abs(e.y - 270) < 24) {
          shooterLives--;
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
        : "第 " + (onestrokeLevel + 1) + " / 3 关（" + lv.name + "）· 已画 " + onestrokeUsed.size + " / " + lv.edges.length + " 条线";
    }
    function onestrokePick(i) {
      if (onestrokeDone) return;
      const lv = ONESTROKE_LEVELS[onestrokeLevel];
      if (onestrokePath.length === 0) { onestrokePath = [i]; onestrokeRender(); return; }
      const cur = onestrokePath[onestrokePath.length - 1];
      const key = onestrokeEdgeKey(cur, i);
      const edgeExists = lv.edges.some((e) => onestrokeEdgeKey(e[0], e[1]) === key);
      if (!edgeExists || onestrokeUsed.has(key)) return; // 不是相邻的点，或这条线已经画过
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
    const MARBLE_SLOTS = [10, 50, 100, 500, 100, 50]; // 6 个格子，中间 500 分最难进
    const MARBLE_ROWS = 5;
    let marbleBest = loadBest(MARBLE_KEY);
    let marbleScore = 0, marbleLeft = 10, marbleBall = null, marbleDirs = [], marbleOver = false;
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
      $("marbleScore").textContent = marbleOver
        ? "🏁 10 颗放完了！得分 " + marbleScore + "，最好 " + marbleBest + "。"
        : "得分 " + marbleScore + " · 剩 " + marbleLeft + " 颗 · 最好 " + marbleBest;
    }
    function marbleDrop() {
      if (marbleOver || marbleBall || marbleLeft <= 0) return;
      marbleBall = { x: 150, y: 10, row: 0 };
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
      marbleRender();
    }
    $("marbleDropBtn").addEventListener("click", marbleDrop);
    $("marbleResetBtn").addEventListener("click", marbleReset);
    marbleRender();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get marble() { return { score: marbleScore, left: marbleLeft, ball: marbleBall ? { x: marbleBall.x, y: marbleBall.y, row: marbleBall.row } : null, dirs: marbleDirs.slice(), over: marbleOver, best: marbleBest }; },
        marbleSetDirs(dirs) { marbleDirs = dirs.slice(); },
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
          make24Solved++;
          if (make24Solved > make24Best) {
            make24Best = make24Solved;
            saveBest(MAKE24_KEY, make24Best);
          }
          $("make24Status").textContent = "🎉 等于 24！第 " + (make24SetIdx + 1) + " 组解出来了，已解 " + make24Solved + " 组。点换一组继续。";
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
            $("fruitsliceStatus").textContent = "💥 切到炸弹了！还剩 " + fruitLives + " 条命。";
            if (fruitLives <= 0) fruitEnd("💔 三条命都炸没了。");
          } else {
            fruitScore += 10;
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
      if (Math.abs(pr - r) + Math.abs(pc - c) !== 1) { match3Render(); return; } // 不相邻
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
        if (match3Score > match3Best) {
          match3Best = match3Score;
          saveBest(MATCH3_KEY, match3Best);
        }
      }
      match3Render();
    }
    function match3Reset() {
      match3Score = 0; match3Moves = 0; match3Sel = null;
      match3NewBoard();
      match3Render();
    }
    $("match3ResetBtn").addEventListener("click", match3Reset);
    match3Reset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get match3() { return { board: match3Board.map((r) => r.slice()), score: match3Score, moves: match3Moves, best: match3Best }; },
        matchSet(board) { match3Board = board.map((r) => r.slice()); match3Score = 0; match3Moves = 0; match3Sel = null; match3Render(); },
        matchPick(r, c) { match3Pick(r, c); },
    }));

  };
  /* ---------- 66. 射箭 ---------- */
  toyInitFns["archery"] = function () {
    const ARCHERY_KEY = "dorm-toybox-archery-best-v1";
    const ARCHERY_C = 150; // 靶心
    let archeryBest = loadBest(ARCHERY_KEY);
    let archeryScore = 0, archeryLeft = 10, archeryShots = [];
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
      $("archeryScore").textContent = archeryLeft <= 0
        ? "🏁 10 支射完了！得分 " + archeryScore + "，最好 " + archeryBest + "。"
        : "得分 " + archeryScore + " · 剩 " + archeryLeft + " 支 · 最好 " + archeryBest;
      archeryDraw();
    }
    function archeryReset() {
      archeryScore = 0; archeryLeft = 10; archeryShots = [];
      archeryRender();
    }
    $("archeryCanvas").addEventListener("pointerdown", (e) => {
      const cv = $("archeryCanvas");
      const rect = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 300, height: 300 };
      const x = (e.clientX - rect.left) * 300 / (rect.width || 300);
      const y = (e.clientY - rect.top) * 300 / (rect.height || 300);
      archeryShoot(x, y);
    });
    $("archeryResetBtn").addEventListener("click", archeryReset);
    archeryReset();
    Object.defineProperties(__toyboxHandle, Object.getOwnPropertyDescriptors({
        get archery() { return { score: archeryScore, left: archeryLeft, shots: archeryShots.slice(), best: archeryBest }; },
        archeryShoot(x, y) { archeryShoot(x, y); },
    }));

  };
  // v1.30：深链调用必须在所有 toyInitFns 注册之后，否则 ensureToyInit 会空跑
  // 深链：打开 #guess 就直接进数字炸弹，分享给宿舍不用再教怎么点；没 hash 就进主页（置顶 + 全部游戏）
  if (TOYS.some((t) => t.id === window.location.hash.slice(1))) showToy(window.location.hash.slice(1));
  else showHome();

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
})(); // IIFE 收尾（原 renderTimer() 调用已搬进 timer 段的初始化）
