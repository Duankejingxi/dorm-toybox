/* 宿舍玩具盒 · toys.js — 纯前端，无后端，无依赖 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- 玩具切换 ---------- */
  const nav = $("toyNav");
  TOYS.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "pill" + (t.id === "wheel" ? " active" : "");
    btn.textContent = t.label;
    btn.addEventListener("click", () => showToy(t.id));
    nav.appendChild(btn);
  });
  function showToy(id) {
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-" + id).classList.remove("hidden");
    nav.querySelectorAll(".pill").forEach((b, i) => b.classList.toggle("active", TOYS[i].id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
    ctx.restore();
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
    return $("nameList").value.split("\n").map((s) => s.trim()).filter(Boolean);
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
  const FOCUS_SECONDS = 25 * 60;
  const TOMATO_KEY = "dorm-toybox-tomatoes-v1";
  let remaining = FOCUS_SECONDS;
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
  $("timerStartBtn").addEventListener("click", () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      $("timerStartBtn").textContent = "继续专注 ▶";
      $("timerStatus").textContent = "暂停中。歇一会没关系，回来继续。";
      return;
    }
    if (remaining === 0) remaining = FOCUS_SECONDS;
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
    remaining = FOCUS_SECONDS;
    $("timerStartBtn").textContent = "开始专注 ▶";
    $("timerStatus").textContent = "已重置。先想好这 25 分钟要干什么。";
    renderTimer();
  });
  renderTimer();
})();
