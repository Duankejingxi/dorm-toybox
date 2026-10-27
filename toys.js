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

  renderTimer();
})();
