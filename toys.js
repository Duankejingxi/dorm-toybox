/* 宿舍玩具盒 · toys.js — 纯前端，无后端，无依赖 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 侧边栏：置顶 7 个在最前面，其余按顺序，一行两个方块 ---------- */
  const PINNED_IDS = ["wheel", "dice", "reaction", "guess", "score", "beads", "frog"];
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
  TOYS.filter((t) => PINNED_IDS.includes(t.id)).forEach((t) => drawerNav.appendChild(makeTile(t)));
  drawerNav.appendChild(drawerLabel("全部玩具"));
  TOYS.filter((t) => !PINNED_IDS.includes(t.id)).forEach((t) => drawerNav.appendChild(makeTile(t)));
  function allTiles() {
    return [...drawerNav.querySelectorAll(".tile")];
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
  function showToy(id) {
    if (!TOYS.some((t) => t.id === id)) id = "wheel";
    if (currentToy && currentToy !== id) leaveToy(currentToy);
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-" + id).classList.remove("hidden");
    allTiles().forEach((b) => b.classList.toggle("active", b.getAttribute("data-toy") === id));
    currentToy = id;
    if (toyEnterResume[id]) toyEnterResume[id]();
    if (window.location.hash !== "#" + id) window.location.hash = id;
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
  $("drawerCloseBtn").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);
  window.addEventListener("hashchange", () => {
    const id = window.location.hash.slice(1);
    if (TOYS.some((t) => t.id === id) && id !== currentToy) showToy(id);
  });
  // 深链：打开 #guess 就直接进数字炸弹，分享给宿舍不用再教怎么点；没 hash 就进转盘
  showToy(TOYS.some((t) => t.id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : "wheel");

  /* ---------- 1. 命运大转盘 ---------- */
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

  /* ---------- 2. 真心话大冒险 ---------- */
  let usedTruths = [], usedDares = [];
  function drawCard(kind) {
    let pool, used, label;
    if (kind === "truth") { pool = TRUTHS; used = usedTruths; label = "💬 真心话"; }
    else { pool = DARES; used = usedDares; label = "🔥 大冒险"; }
    if (used.length >= pool.length) used.length = 0; // 一轮抽完，洗牌重来
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); } while (used.includes(idx));
    used.push(idx);
    const card = $("playCard");
    card.classList.remove("truth", "dare");
    card.classList.add(kind === "truth" ? "truth" : "dare");
    $("cardType").textContent = label + " · 第 " + used.length + " 张";
    $("cardText").textContent = pool[idx];
    $("cardCount").textContent =
      "真心话已抽 " + usedTruths.length + " / " + TRUTHS.length +
      " · 大冒险已抽 " + usedDares.length + " / " + DARES.length + "（抽完自动洗牌）";
  }
  $("truthBtn").addEventListener("click", () => drawCard("truth"));
  $("dareBtn").addEventListener("click", () => drawCard("dare"));
  $("eitherBtn").addEventListener("click", () => drawCard(Math.random() < 0.5 ? "truth" : "dare"));
  $("cardCount").textContent = "真心话 " + TRUTHS.length + " 张 · 大冒险 " + DARES.length + " 张，抽完自动洗牌。";

  /* ---------- 3. 骰子硬币 ---------- */
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

  /* ---------- 4. 今日运势 ---------- */
  const FORTUNE_KEY = "dorm-toybox-fortune-v1";
  function todayStr() { return new Date().toDateString(); }
  function loadFortune() {
    try {
      const saved = JSON.parse(localStorage.getItem(FORTUNE_KEY) || "null");
      return saved && saved.day === todayStr() ? saved : null;
    } catch (e) { return null; }
  }
  function renderFortune(saved) {
    if (!saved) {
      $("fortuneTier").textContent = "？";
      $("fortuneText").textContent = "点下面，抽今日一签。";
      $("fortuneNote").textContent = "一天只能抽一次，抽完就认——好签别骄傲，坏签别当真。";
      $("drawFortuneBtn").disabled = false;
      return;
    }
    $("fortuneTier").textContent = saved.tier;
    $("fortuneText").textContent = saved.text;
    $("fortuneNote").textContent = "今日已抽（" + saved.day + "）。明天再来，签会变的。";
    $("drawFortuneBtn").disabled = true;
  }
  $("drawFortuneBtn").addEventListener("click", () => {
    const f = pick(FORTUNES);
    const saved = { day: todayStr(), tier: f.tier, text: f.text };
    localStorage.setItem(FORTUNE_KEY, JSON.stringify(saved));
    renderFortune(saved);
  });
  renderFortune(loadFortune());

  /* ---------- 5. 随机点名 ---------- */
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

  /* ---------- 6. 番茄钟 ---------- */
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
  function renderTimer() {
    const disp = $("timerDisplay");
    disp.textContent = fmt(remaining);
    disp.classList.toggle("done", remaining === 0);
    $("tomatoCount").textContent = "今天已完成 " + tomatoesToday + " 个番茄";
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
    $("timerStatus").textContent = "专注中……手机翻过去，这 25 分钟只干一件事。";
    timerId = setInterval(() => {
      remaining--;
      renderTimer();
      if (remaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        tomatoesToday++;
        saveTomatoes();
        renderTimer();
        $("timerStartBtn").textContent = "再来一个 🍅";
        $("timerStatus").textContent = "🎉 到点了！起来走走、喝口水，完成了第 " + tomatoesToday + " 个番茄。";
      }
    }, 1000);
  });
  $("timerResetBtn").addEventListener("click", () => {
    if (timerId) { clearInterval(timerId); timerId = null; }
    remaining = focusSeconds;
    $("timerStartBtn").textContent = "开始专注 ▶";
    $("timerStatus").textContent = "已重置。先想好这 25 分钟要干什么。";
    renderTimer();
  });
  /* ---------- 7. 随机分组 ---------- */
  function groupNamePool() {
    const seen = new Set();
    return $("groupNames").value.split("\n").map((s) => s.trim()).filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
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

  /* ---------- 8. 反应速度测试 ---------- */
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
        try { localStorage.setItem(REACTION_BEST_KEY, String(ms)); } catch (e) { /* 忽略 */ }
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

  /* ---------- 9. 石头剪刀布 ---------- */
  const RPS_KEY = "dorm-toybox-rps-v1";
  const RPS_HANDS = { rock: "✊ 石头", scissors: "✌️ 剪刀", paper: "✋ 布" };
  const RPS_BEATS = { rock: "scissors", scissors: "paper", paper: "rock" };
  const RPS_TARGET = 5;
  let rpsScore = { you: 0, cpu: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(RPS_KEY) || "null");
    if (saved && typeof saved.you === "number" && typeof saved.cpu === "number") rpsScore = saved;
  } catch (e) { /* 忽略 */ }
  function renderRpsScore() {
    $("rpsScore").textContent = "你 " + rpsScore.you + " : " + rpsScore.cpu + " 电脑 · 先赢 " + RPS_TARGET + " 局获胜";
  }
  function saveRps() {
    try { localStorage.setItem(RPS_KEY, JSON.stringify(rpsScore)); } catch (e) { /* 忽略 */ }
  }
  function rpsPlay(you) {
    if (rpsScore.you >= RPS_TARGET || rpsScore.cpu >= RPS_TARGET) return;
    const cpu = pick(["rock", "scissors", "paper"]);
    $("rpsYou").textContent = RPS_HANDS[you];
    $("rpsCpu").textContent = RPS_HANDS[cpu];
    let msg;
    if (you === cpu) { msg = "平局！再来。"; }
    else if (RPS_BEATS[you] === cpu) { rpsScore.you++; msg = "🎉 你赢了这局！"; }
    else { rpsScore.cpu++; msg = "😤 电脑赢了这局。"; }
    if (rpsScore.you >= RPS_TARGET) msg = "🏆 你赢下了整场！电脑甘拜下风。";
    else if (rpsScore.cpu >= RPS_TARGET) msg = "💻 电脑赢下了整场。再来一局雪耻？";
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
    $("rpsResult").textContent = "出一个，看看谁赢。";
  });
  renderRpsScore();

  /* ---------- 10. 数字炸弹 ---------- */
  const GUESS_BEST_KEY = "dorm-toybox-guess-best-v1";
  let guessTarget = 1 + Math.floor(Math.random() * 100);
  let guessTries = [];
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
    if (n === guessTarget) {
      const tries = guessTries.length;
      let msg = "💣 拆弹成功！就是 " + guessTarget + "，用了 " + tries + " 次。";
      if (guessBest === 0 || tries < guessBest) {
        guessBest = tries;
        try { localStorage.setItem(GUESS_BEST_KEY, String(tries)); } catch (e) { /* 忽略 */ }
        msg += "新纪录！";
      }
      $("guessResult").textContent = msg;
    } else if (n < guessTarget) {
      $("guessResult").textContent = "小了，再大点 ↑（已猜 " + guessTries.length + " 次）";
    } else {
      $("guessResult").textContent = "大了，再小点 ↓（已猜 " + guessTries.length + " 次）";
    }
    renderGuessCount();
    $("guessInput").value = "";
    $("guessInput").focus();
  }
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

  /* ---------- 11. 记忆翻牌 ---------- */
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

  /* ---------- 12. 打字测试 ---------- */
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
        try { localStorage.setItem(TYPING_BEST_KEY, String(cpm)); } catch (e) { /* 忽略 */ }
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

  /* ---------- 13. 华容道 ---------- */
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
        try { localStorage.setItem(PUZZLE_BEST_KEY, String(puzzleMoves)); } catch (e) { /* 忽略 */ }
        msg += "新纪录！";
      }
      $("puzzleResult").textContent = msg;
      renderPuzzleBest();
    }
  }
  $("puzzleResetBtn").addEventListener("click", puzzleShuffle);
  puzzleShuffle();

  /* ---------- 14. 老虎机：左右两台独立机器，一人一台，轮流拉，回合制记分 ---------- */
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
        const { points, lines } = slotsScoreLines(final);
        slotsStats[who] += points;
        slotsResultEl(who).textContent = "本局 +" + points + " 分" + (lines > 0 ? "（" + lines + " 条线中奖）" : "（没中奖）") + "。";
        if (who === "a") { slotsStats.turn = "b"; }
        else { slotsStats.turn = "a"; slotsStats.round++; }
        renderSlotsStats();
        saveSlotsStats();
      }
    }, 80);
  }
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

  /* ---------- 玩具搜索：搜名字，抽屉自动打开露出结果 ---------- */
  $("toySearch").addEventListener("input", () => {
    const q = $("toySearch").value.trim();
    allTiles().forEach((b) => {
      b.classList.toggle("hidden", q !== "" && !b.textContent.includes(q));
    });
    if (q !== "") openDrawer();
  });

  /* ---------- 15. 数独 ---------- */
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
      try { localStorage.setItem(SUDOKU_BEST_KEY, String(seconds)); } catch (e) { /* 忽略 */ }
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

  /* ---------- 16. 舒尔特方格 ---------- */
  // 退出就停：舒尔特计时只刷显示，回来再续上（用时按时间戳算，不会丢）
  toyLeaveCleanup.sudoku = () => { if (sudokuTimerId) { clearInterval(sudokuTimerId); sudokuTimerId = null; } };
  toyEnterResume.sudoku = () => { if (sudokuStartAt && !sudokuWon && !sudokuTimerId) sudokuTimerId = setInterval(renderSudokuStats, 1000); };
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
        try { localStorage.setItem(SCHULTE_BEST_KEY, String(seconds)); } catch (e) { /* 忽略 */ }
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

  /* ---------- 17. 记分牌 ---------- */
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

  /* ---------- 18. 手持弹幕 ---------- */
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

  /* ---------- 19. 人生小格 ---------- */
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

  /* ---------- 21. 极简记账 ---------- */
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

  /* ---------- 22. 拼豆图纸生成 ---------- */
  let beadsCols = 0, beadsRows = 0, beadsCells = [];
  let beadsCellPx = 22;
  function beadRingBg(hex) {
    // 孔是白色的（像穿在白色拼板上），不是透出黑底：颜色才看得清
    return "radial-gradient(circle, #ffffff 0 30%, " + hex + " 31% 100%)";
  }
  function beadsApplyCellSize() {
    const grid = $("beadsGrid");
    if (beadsCols > 0) grid.style.gridTemplateColumns = "repeat(" + beadsCols + ", " + beadsCellPx + "px)";
    $("beadsZoomLabel").textContent = "每颗 " + beadsCellPx + "px，左右滑着看";
  }
  function beadNearest(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    let best = BEAD_COLORS[0], bestD = Infinity;
    BEAD_COLORS.forEach((c) => {
      const cr = parseInt(c.hex.slice(1, 3), 16), cg = parseInt(c.hex.slice(3, 5), 16), cb = parseInt(c.hex.slice(5, 7), 16);
      const d = (r - cr) * (r - cr) * 0.3 + (g - cg) * (g - cg) * 0.59 + (b - cb) * (b - cb) * 0.11;
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }
  function beadsRender(pixels, cols, rows) {
    beadsCols = cols; beadsRows = rows;
    beadsCells = pixels.map((hex) => beadNearest(hex));
    const grid = $("beadsGrid");
    grid.innerHTML = "";
    beadsApplyCellSize();
    const counts = {};
    const order = [];
    beadsCells.forEach((bead) => {
      if (!counts[bead.n]) { counts[bead.n] = { bead, count: 0 }; order.push(bead.n); }
      counts[bead.n].count++;
      const cell = document.createElement("div");
      cell.className = "beads-cell";
      cell.style.background = beadRingBg(bead.hex);
      cell.title = bead.n + " " + bead.name;
      grid.appendChild(cell);
    });
    const legend = $("beadsLegend");
    legend.innerHTML = "";
    const used = order.map((n) => counts[n]).sort((a, b) => b.count - a.count);
    used.forEach(({ bead, count }) => {
      const item = document.createElement("div");
      item.className = "beads-legend-item";
      const sw = document.createElement("span");
      sw.className = "beads-swatch";
      sw.style.background = beadRingBg(bead.hex);
      const label = document.createElement("span");
      label.textContent = bead.n + " " + bead.name + " × " + count + " 颗";
      item.appendChild(sw);
      item.appendChild(label);
      legend.appendChild(item);
    });
    $("beadsStats").textContent = "共 " + pixels.length + " 颗 · 用了 " + used.length + " 种颜色 · 按 Hama Midi 5mm 色号匹配";
    $("beadsResult").textContent = "照着图纸拼就行，颜色按色号去买豆。";
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
    beadsRender(pixels, 16, 16);
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
      const cell = 24;
      const canvas = document.createElement("canvas");
      if (typeof canvas.getContext !== "function" || typeof canvas.toDataURL !== "function") { $("beadsResult").textContent = "当前环境不支持导出。"; return; }
      canvas.width = beadsCols * cell;
      canvas.height = beadsRows * cell;
      const ctx = canvas.getContext("2d");
      if (!ctx) { $("beadsResult").textContent = "当前环境不支持导出。"; return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      beadsCells.forEach((bead, i) => {
        const x = (i % beadsCols) * cell, y = Math.floor(i / beadsCols) * cell;
        const cx = x + cell / 2, cy = y + cell / 2, r = cell / 2 - 2;
        ctx.fillStyle = bead.hex;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff"; // 豆子中间的孔（和屏幕上一样大）
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "拼豆图纸.png";
      a.click();
      $("beadsResult").textContent = "图纸已导出为图片，照着拼就行。";
    } catch (e) { $("beadsResult").textContent = "导出失败，换个浏览器试试。"; }
  });

  /* ---------- 23. 亲戚计算器 ---------- */
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

  /* ---------- 24. 汇率计算器（联网每天更新一次，存本机；离线用备用汇率） ---------- */
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

  /* ---------- 25. 中英日韩翻译器 ---------- */
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

  /* ---------- 26. 指南针 ---------- */
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

  /* ---------- 27. 噪音检测 ---------- */
  // 退出就关传感器，不然一直在后台耗电
  toyLeaveCleanup.compass = () => {
    if (compassWatching) {
      window.removeEventListener("deviceorientation", compassHandler);
      compassWatching = false;
      $("compassBtn").textContent = "开启指南针 🧭";
      $("compassResult").textContent = "已关闭。";
    }
  };
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

  /* ---------- 28. 奶蛙表情包（网上找的真贴纸裁出来的，点一下下载 PNG） ---------- */
  const FROG_MOODS = [
    { id: "happy", name: "开心大笑", file: "奶蛙-开心大笑.jpg", src: FROG_IMAGES["frog-01"] },
    { id: "wronged", name: "委屈巴巴", file: "奶蛙-委屈巴巴.png", src: FROG_IMAGES["frog-02"] },
    { id: "melon", name: "吃瓜追剧", file: "奶蛙-吃瓜追剧.png", src: FROG_IMAGES["frog-03"] },
    { id: "speechless", name: "一脸无语", file: "奶蛙-一脸无语.png", src: FROG_IMAGES["frog-04"] },
    { id: "cheer", name: "加油打气", file: "奶蛙-加油打气.png", src: FROG_IMAGES["frog-05"] },
    { id: "night", name: "晚安睡觉", file: "奶蛙-晚安睡觉.png", src: FROG_IMAGES["frog-06"] },
    { id: "angry", name: "生气鼓腮", file: "奶蛙-生气鼓腮.png", src: FROG_IMAGES["frog-07"] },
    { id: "daze", name: "发呆", file: "奶蛙-发呆.jpg", src: FROG_IMAGES["frog-08"] },
  ];
  const frogGrid = $("frogGrid");
  FROG_MOODS.forEach((mood) => {
    const card = document.createElement("div");
    card.className = "frog-card";
    const img = document.createElement("img");
    img.src = mood.src;
    img.alt = mood.name;
    img.setAttribute("data-mood", mood.id);
    card.appendChild(img);
    const label = document.createElement("p");
    label.className = "frog-name";
    label.textContent = mood.name;
    card.appendChild(label);
    const btn = document.createElement("button");
    btn.className = "btn small gold-btn";
    btn.textContent = "下载 ⬇";
    btn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = mood.src;
      a.download = mood.file;
      a.click();
      $("frogResult").textContent = "已下载「" + mood.name + "」。";
    });
    card.appendChild(btn);
    frogGrid.appendChild(card);
  });

  /* ---------- 29. 计时器（秒表） ---------- */
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
  toyLeaveCleanup.stopwatch = () => { if (swTimerId) { clearInterval(swTimerId); swTimerId = null; } };
  toyEnterResume.stopwatch = () => { if (swRunning && !swTimerId) swTimerId = setInterval(swRender, 100); };

  /* ---------- 30. BMI 体重管理 ---------- */
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

  /* ---------- 31. 白噪音 ---------- */
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

  renderTimer();
})();
