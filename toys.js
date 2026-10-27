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
  let currentToy = "wheel";
  function showToy(id) {
    if (!TOYS.some((t) => t.id === id)) id = "wheel";
    document.querySelectorAll(".toy").forEach((el) => el.classList.add("hidden"));
    $("toy-" + id).classList.remove("hidden");
    nav.querySelectorAll(".pill").forEach((b, i) => b.classList.toggle("active", TOYS[i].id === id));
    currentToy = id;
    if (window.location.hash !== "#" + id) window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  window.addEventListener("hashchange", () => {
    const id = window.location.hash.slice(1);
    if (TOYS.some((t) => t.id === id) && id !== currentToy) showToy(id);
  });
  // 深链：打开 #guess 就直接进猜数字，分享给宿舍不用再教怎么点
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

  /* ---------- 10. 猜数字 ---------- */
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
      let msg = "🎉 猜中了！就是 " + guessTarget + "，用了 " + tries + " 次。";
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

  renderTimer();
})();
