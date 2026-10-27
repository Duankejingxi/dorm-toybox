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

  /* ---------- 28. 奶蛙表情包（真图表情墙，点一下下载；图片分批内嵌在 frog-data*.js） ---------- */
  const FROG_STICKERS = [
    ...(typeof FROG_PART1 !== "undefined" ? FROG_PART1 : []),
    ...(typeof FROG_PART2 !== "undefined" ? FROG_PART2 : []),
    ...(typeof FROG_PART3 !== "undefined" ? FROG_PART3 : []),
    ...(typeof FROG_PART4 !== "undefined" ? FROG_PART4 : []),
    ...(typeof FROG_PART5 !== "undefined" ? FROG_PART5 : []),
  ];
  $("frogHint").textContent = "共 " + FROG_STICKERS.length + " 张奶蛙表情包，点一下就能下载，发群里用。";
  const frogGrid = $("frogGrid");
  FROG_STICKERS.forEach((s, i) => {
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

  /* ---------- 33. 宿舍值日表 ---------- */
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
    const monday = dutyMonday();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tbody = $("dutyTable");
    tbody.innerHTML = "";
    const lines = [];
    for (let w = 0; w < weeks; w++) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + w * 7 + i);
        const person = names[(w * 7 + i) % names.length];
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
    lastDutyText = lines.join("\n");
    const end = new Date(monday); end.setDate(monday.getDate() + weeks * 7 - 1);
    $("dutyStartLabel").textContent = "值日表（" + dutyFmt(monday) + " – " + dutyFmt(end) + "），每天一人轮着来。";
    $("dutyResult").textContent = "已排好 " + (weeks * 7) + " 天，点复制发群里。";
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

  /* ---------- 34. AA 分摊 ---------- */
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

  /* ---------- 35. 涂鸦板 ---------- */
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

  /* ---------- 36. 奶蛙表情包制作 ---------- */
  let memeIndex = 0;
  let memeImg = null;
  const memeCanvas = $("memeCanvas");
  const memeCtx = memeCanvas.getContext ? memeCanvas.getContext("2d") : null;
  FROG_STICKERS.forEach((s, i) => {
    const thumb = document.createElement("img");
    thumb.src = s.src;
    thumb.alt = "奶蛙-" + String(i + 1).padStart(3, "0");
    thumb.className = "meme-thumb" + (i === 0 ? " active" : "");
    thumb.loading = "lazy";
    thumb.addEventListener("click", () => { memeSelect(i); });
    $("memeStrip").appendChild(thumb);
  });
  function memeSelect(i) {
    memeIndex = i;
    const thumbs = $("memeStrip").children;
    for (let k = 0; k < thumbs.length; k++) thumbs[k].classList.toggle("active", k === i);
    $("memeSelected").textContent = "已选 奶蛙-" + String(i + 1).padStart(3, "0");
    memeLoadAndDraw();
  }
  function memeLoadAndDraw() {
    const src = FROG_STICKERS[memeIndex].src;
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
    let next = Math.floor(Math.random() * FROG_STICKERS.length);
    if (FROG_STICKERS.length > 1 && next === memeIndex) next = (next + 1) % FROG_STICKERS.length;
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

  /* ---------- 37. 贪吃蛇 ---------- */
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

  /* ---------- 38. 刮刮乐 ---------- */
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
  const SCRATCH_W = 320, SCRATCH_H = 200, SCRATCH_COLS = 10, SCRATCH_ROWS = 6;
  const SCRATCH_CELL_W = SCRATCH_W / SCRATCH_COLS, SCRATCH_CELL_H = SCRATCH_H / SCRATCH_ROWS;
  let scratchGrid = [], scratchRevealed = false, scratchDrawing = false;
  const scratchCanvas = $("scratchCanvas");
  const scratchCtx = scratchCanvas.getContext ? scratchCanvas.getContext("2d") : null;
  function scratchPickPrize() {
    const bag = [];
    SCRATCH_PRIZES.forEach((p) => { for (let i = 0; i < p.weight; i++) bag.push(p.text); });
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

  /* ---------- 39. 倒计时 ---------- */
  const CD_KEY = "dorm-toybox-countdown-v1";
  let cdEvents = [];
  try { cdEvents = JSON.parse(localStorage.getItem(CD_KEY) || "[]") || []; } catch (e) { cdEvents = []; }
  function cdSave() { try { localStorage.setItem(CD_KEY, JSON.stringify(cdEvents)); } catch (e) { /* 忽略 */ } }
  function cdDays(dateStr) {
    const t = new Date(dateStr + "T00:00:00");
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((t.getTime() - now.getTime()) / 86400000);
  }
  function cdRender() {
    const list = $("cdList");
    list.innerHTML = "";
    const sorted = cdEvents.slice().sort((a, b) => cdDays(a.date) - cdDays(b.date));
    sorted.forEach((ev) => {
      const d = cdDays(ev.date);
      const row = document.createElement("div");
      row.className = "cd-row";
      const name = document.createElement("span");
      name.className = "cd-name";
      name.textContent = ev.name;
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

  /* ---------- 40. 待办清单 ---------- */
  const TODO_KEY = "dorm-toybox-todo-v1";
  let todoItems = [];
  try { todoItems = JSON.parse(localStorage.getItem(TODO_KEY) || "[]") || []; } catch (e) { todoItems = []; }
  function todoSave() { try { localStorage.setItem(TODO_KEY, JSON.stringify(todoItems)); } catch (e) { /* 忽略 */ } }
  function todoRender() {
    const list = $("todoList");
    list.innerHTML = "";
    todoItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "todo-row" + (item.done ? " done" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.done;
      cb.setAttribute("aria-label", "完成 " + item.text);
      cb.addEventListener("change", () => { item.done = cb.checked; todoSave(); todoRender(); });
      const span = document.createElement("span");
      span.className = "todo-text";
      span.textContent = item.text;
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
    todoItems.push({ text, done: false });
    todoSave(); todoRender();
    $("todoInput").value = "";
  }
  $("todoAddBtn").addEventListener("click", todoAdd);
  $("todoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") todoAdd(); });
  $("todoClearBtn").addEventListener("click", () => { todoItems = todoItems.filter((i) => !i.done); todoSave(); todoRender(); });
  todoRender();

  /* ---------- 41. 俄罗斯方块 ---------- */
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

  /* ---------- 42. 2048 ---------- */
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
    $("g2048Status").textContent = "滑动或者按方向键，开始合并。";
  }
  function g2048Render() {
    const grid = $("g2048Grid");
    grid.innerHTML = "";
    for (let i = 0; i < 16; i++) {
      const cell = document.createElement("div");
      const v = g2048[i];
      cell.className = "g2048-tile" + (v ? " filled" : "");
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
  $("g2048UpBtn").addEventListener("click", () => g2048Move("up"));
  $("g2048DownBtn").addEventListener("click", () => g2048Move("down"));
  $("g2048LeftBtn").addEventListener("click", () => g2048Move("left"));
  $("g2048RightBtn").addEventListener("click", () => g2048Move("right"));
  let g2048Swipe = null;
  $("g2048Grid").addEventListener("pointerdown", (e) => { g2048Swipe = { x: e.clientX, y: e.clientY }; });
  $("g2048Grid").addEventListener("pointerup", (e) => {
    if (!g2048Swipe) return;
    const dx = e.clientX - g2048Swipe.x, dy = e.clientY - g2048Swipe.y;
    g2048Swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) g2048Move(dx > 0 ? "right" : "left"); else g2048Move(dy > 0 ? "down" : "up");
  });
  if (document.addEventListener) {
    document.addEventListener("keydown", (e) => {
      if ($("toy-game2048").classList.contains("hidden")) return;
      const k = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
      if (k) { g2048Move(k); if (e.preventDefault) e.preventDefault(); }
    });
  }
  g2048New();

  /* ---------- 43. 扫雷 ---------- */
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

  /* ---------- 44. 课程表 ---------- */
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
    const day = parseInt($("schDay").value, 10);
    const period = parseInt($("schPeriod").value, 10);
    if (!name) { $("schResult").textContent = "先写课程名。"; return; }
    schCourses = schCourses.filter((c) => !(c.day === day && c.period === period));
    schCourses.push({ name, room, day, period });
    schSave(); schRender();
    $("schName").value = "";
    $("schRoom").value = "";
    $("schResult").textContent = "已加上「" + name + "」（" + SCH_DAYS[day] + " " + SCH_PERIODS[period].split("\n")[0] + "）。";
  });
  $("schClearBtn").addEventListener("click", () => { schCourses = []; schSave(); schRender(); $("schResult").textContent = "课程表已清空。"; });
  schRender();

  /* ---------- 测试用把手（和宿舍人生一样，方便冒烟测试读内部状态） ---------- */
  window.__toybox = {
    get tetris() { return { board: tBoard, cur: tCur, next: tNext, score: tScore, lines: tLines, level: tLevel, state: tState }; },
    tetrisSetCur(x, y) { if (tCur) { tCur.x = x; tCur.y = y; } },
    get g2048() { return { board: g2048.slice(), score: gScore, over: gOver, won: gWon }; },
    g2048Set(board) { g2048 = board.slice(); g2048Render(); },
    get mines() { return { cells: mCells, started: mStarted, over: mOver }; },
    get schedule() { return { courses: schCourses.slice() }; },
  };

  renderTimer();
})();
