const STORAGE_KEY = "levelup_goals";
const PLAYER_NAME_KEY = "levelup_player_name";
const DEVICE_ID_KEY = "levelup_device_id";
const USER_BEST_SCORE_KEY = "levelup_user_best_score";

const SUPABASE_URL = "https://gkkdwwprhfsgtzjpnwaj.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_zgmgY6On7ttFUxsuXWrEKA_zTYwJmim";

let currentScreenId = "homeScreen";
let currentGoalId = null;
let rankingSortMode = "current";
let rankingRenderId = 0;
let calendarDate = new Date();

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getCurrentMonthStart() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getGoalFirstMonthStart(goal) {
  const recordDates = Object.keys(goal.records || {}).sort();

  if (recordDates.length === 0) {
    return getCurrentMonthStart();
  }

  const firstRecord = recordDates[0];
  const parts = firstRecord.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameMonth(firstDate, secondDate) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth()
  );
}

function isBeforeMonth(firstDate, secondDate) {
  if (firstDate.getFullYear() < secondDate.getFullYear()) return true;
  if (firstDate.getFullYear() > secondDate.getFullYear()) return false;
  return firstDate.getMonth() < secondDate.getMonth();
}

function isAfterMonth(firstDate, secondDate) {
  if (firstDate.getFullYear() > secondDate.getFullYear()) return true;
  if (firstDate.getFullYear() < secondDate.getFullYear()) return false;
  return firstDate.getMonth() > secondDate.getMonth();
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDescription(text) {
  const cleanText = String(text || "").trim();
  const maxLineLength = 26;

  if (!cleanText) return "";

  const words = cleanText.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach(function(word) {
    if (word.length > maxLineLength) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      for (let i = 0; i < word.length; i += maxLineLength) {
        lines.push(word.slice(i, i + maxLineLength));
      }

      return;
    }

    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLineLength) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.map(escapeHtml).join("<br>");
}

function isFutureDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkedDate = new Date(date);
  checkedDate.setHours(0, 0, 0, 0);

  return checkedDate > today;
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

function getPlayerName() {
  return localStorage.getItem(PLAYER_NAME_KEY) || "";
}

function savePlayerName(name) {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

function normalizeGoal(goal) {
  const type = goal.type === "yesno" ? "yesno" : "counter";
  const target = type === "yesno" ? 1 : Math.max(2, Math.min(999, Number(goal.target) || 2));

  return {
    id: goal.id,
    title: goal.title || "אתגר",
    type: type,
    target: target,
    description: goal.description || "",
    records: goal.records || {}
  };
}

function getDefaultGoals() {
  return [
    { id: "workout", title: "אימון", type: "yesno", target: 1, description: "", records: {} },
    { id: "water", title: "מים", type: "counter", target: 8, description: "", records: {} },
    { id: "sleep", title: "שינה", type: "counter", target: 8, description: "", records: {} }
  ];
}

function loadGoals() {
  const savedGoals = localStorage.getItem(STORAGE_KEY);

  if (!savedGoals) {
    const defaultGoals = getDefaultGoals();
    saveGoals(defaultGoals);
    return defaultGoals;
  }

  const parsedGoals = JSON.parse(savedGoals).map(normalizeGoal);
  saveGoals(parsedGoals);
  return parsedGoals;
}

function saveGoals(goalsToSave) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goalsToSave));
}

let goals = loadGoals();

function getTodayValue(goal) {
  return Number(goal.records[getTodayKey()] || 0);
}

function getProgress(goal) {
  const value = getTodayValue(goal);
  const progress = Math.round((value / goal.target) * 100);
  return Math.min(progress, 100);
}

function isGoalSuccessOnDate(goal, dateKey) {
  return Number(goal.records[dateKey] || 0) >= Number(goal.target);
}

function getUserCurrentScore() {
  if (goals.length === 0) return 0;

  return Math.round(
    goals.reduce(function(sum, goal) {
      return sum + getProgress(goal);
    }, 0) / goals.length
  );
}

function getUserBestScore() {
  const currentScore = getUserCurrentScore();
  const savedBestScore = Number(localStorage.getItem(USER_BEST_SCORE_KEY) || 0);
  const bestScore = Math.max(currentScore, savedBestScore);

  localStorage.setItem(USER_BEST_SCORE_KEY, String(bestScore));
  return bestScore;
}

function getToneClass(progress) {
  if (progress >= 100) return "tone-100";
  if (progress >= 90) return "tone-90";
  if (progress >= 75) return "tone-75";
  if (progress >= 60) return "tone-60";
  if (progress >= 45) return "tone-45";
  if (progress >= 30) return "tone-30";
  if (progress >= 15) return "tone-15";
  return "tone-0";
}

function getFlameClass(progress) {
  return getToneClass(progress).replace("tone", "flame");
}

function applyBackground(progress) {
  document.body.classList.remove("tone-0", "tone-15", "tone-30", "tone-45", "tone-60", "tone-75", "tone-90", "tone-100");
  document.body.classList.add(getToneClass(progress));
}

function applyGeneralBackground() {
  applyBackground(getUserCurrentScore());
}

function getCurrentGoal() {
  return goals.find(function(goal) {
    return goal.id === currentGoalId;
  });
}

function getGoalTypeName(type) {
  if (type === "yesno") return "כן / לא";
  if (type === "counter") return "ספירה";
  return "לא ידוע";
}

function flashElement(element) {
  if (!element) return;

  element.classList.remove("field-error-flash");
  void element.offsetWidth;
  element.classList.add("field-error-flash");
}

function flashInputLimit(input) {
  if (!input) return;

  const maxLength = Number(input.getAttribute("maxlength") || 0);

  if (maxLength > 0 && input.value.length >= maxLength) {
    flashElement(input);
  }
}

function isMenuOpen() {
  return document.getElementById("sideMenu").classList.contains("open");
}

function isGoalOptionsOpen() {
  return document.getElementById("goalOptionsMenu").classList.contains("open");
}

function isDeleteConfirmOpen() {
  return document.getElementById("deleteConfirmOverlay").classList.contains("open");
}

function isDayDetailOpen() {
  return document.getElementById("dayDetailOverlay").classList.contains("open");
}

function openMenu() {
  if (isMenuOpen()) return;

  document.getElementById("sideMenu").classList.add("open");
  document.getElementById("menuOverlay").classList.add("open");

  history.pushState({ screenId: currentScreenId, goalId: currentGoalId, menuOpen: true }, "", "");
}

function closeMenu() {
  document.getElementById("sideMenu").classList.remove("open");
  document.getElementById("menuOverlay").classList.remove("open");
}

function openGoalOptionsMenu() {
  if (!currentGoalId || isGoalOptionsOpen()) return;

  document.getElementById("goalOptionsMenu").classList.add("open");
  document.getElementById("goalOptionsOverlay").classList.add("open");

  history.pushState({ screenId: currentScreenId, goalId: currentGoalId, goalOptionsOpen: true }, "", "");
}

function closeGoalOptionsMenu() {
  document.getElementById("goalOptionsMenu").classList.remove("open");
  document.getElementById("goalOptionsOverlay").classList.remove("open");
}

function openDeleteConfirm() {
  if (!currentGoalId) return;
  document.getElementById("deleteConfirmOverlay").classList.add("open");
}

function closeDeleteConfirm() {
  document.getElementById("deleteConfirmOverlay").classList.remove("open");
}

function openDayDetail(dateKey) {
  const goal = getCurrentGoal();

  if (!goal || goal.type !== "counter") return;

  const value = Number(goal.records[dateKey] || 0);
  const isSuccess = value >= Number(goal.target);
  const overlay = document.getElementById("dayDetailOverlay");
  const box = document.getElementById("dayDetailBox");
  const score = document.getElementById("dayDetailScore");

  score.textContent = `${value}/${goal.target}`;

  box.classList.remove("success", "fail");
  box.classList.add(isSuccess ? "success" : "fail");

  overlay.classList.add("open");
}

function closeDayDetail() {
  document.getElementById("dayDetailOverlay").classList.remove("open");
}

function closeMenuFromOverlay() {
  if (isMenuOpen() && history.state && history.state.menuOpen) {
    history.back();
    return;
  }

  closeMenu();
}

function closeGoalOptionsFromOverlay() {
  if (isGoalOptionsOpen() && history.state && history.state.goalOptionsOpen) {
    history.back();
    return;
  }

  closeGoalOptionsMenu();
}

function openScreenFromMenu(screenId) {
  if (history.state && history.state.menuOpen) {
    history.replaceState({ screenId: currentScreenId, goalId: currentGoalId }, "", "");
  }

  showScreen(screenId);
}

function openGoalScreenFromOptions(screenName) {
  if (!currentGoalId) return;

  if (history.state && history.state.goalOptionsOpen) {
    history.replaceState({ screenId: "goalScreen", goalId: currentGoalId }, "", "");
  }

  closeGoalOptionsMenu();

  if (screenName === "edit") openGoalSettings(currentGoalId);
  if (screenName === "info") openGoalInfo(currentGoalId);
}

function showScreen(screenId, addToHistory = true) {
  closeMenu();
  closeGoalOptionsMenu();
  closeDeleteConfirm();
  closeDayDetail();

  currentScreenId = screenId;

  document.querySelectorAll(".screen").forEach(function(screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  if (screenId === "homeScreen") {
    currentGoalId = null;
    applyGeneralBackground();
    renderHome();
  }

  if (screenId === "rankingScreen") {
    currentGoalId = null;
    applyGeneralBackground();
    renderRanking();
  }

  if (screenId === "addScreen" || screenId === "nameScreen") {
    currentGoalId = null;
    applyGeneralBackground();
  }

  if (screenId === "goalSettingsScreen" || screenId === "goalInfoScreen") {
    const goal = getCurrentGoal();
    if (goal) applyBackground(getProgress(goal));
  }

  if (addToHistory) {
    history.pushState({ screenId: screenId, goalId: currentGoalId }, "", "");
  }
}

function goBack() {
  if (isDayDetailOpen()) {
    closeDayDetail();
    return;
  }

  if (isDeleteConfirmOpen()) {
    closeDeleteConfirm();
    return;
  }

  if (isMenuOpen()) {
    if (history.state && history.state.menuOpen) history.back();
    else closeMenu();
    return;
  }

  if (isGoalOptionsOpen()) {
    if (history.state && history.state.goalOptionsOpen) history.back();
    else closeGoalOptionsMenu();
    return;
  }

  if (currentScreenId === "homeScreen") return;

  history.back();
}

function renderHome() {
  const goalsGrid = document.getElementById("goalsGrid");
  goalsGrid.innerHTML = "";

  goals.forEach(function(goal) {
    const progress = getProgress(goal);
    const flameClass = getFlameClass(progress);

    const card = document.createElement("article");
    card.className = "goal-card";

    card.innerHTML = `
      <div class="goal-title">
        <h2>${escapeHtml(goal.title)}</h2>
      </div>

      <div class="goal-status">
        <div class="flame ${flameClass}">
          <span></span>
        </div>
        <strong>${progress}%</strong>
      </div>
    `;

    card.addEventListener("click", function() {
      openGoal(goal.id);
    });

    goalsGrid.appendChild(card);
  });
}

function openGoal(goalId, addToHistory = true) {
  const goal = goals.find(function(item) {
    return item.id === goalId;
  });

  if (!goal) return;

  currentGoalId = goalId;

  const value = getTodayValue(goal);
  const details = document.getElementById("goalDetails");
  const progress = getProgress(goal);

  const descriptionText = goal.description
    ? `<p class="goal-description">${formatDescription(goal.description)}</p>`
    : "";

  applyBackground(progress);

  let actionHtml = "";

  if (goal.type === "yesno") {
    actionHtml = `
      <section class="yesno-action-area">
        <button class="success-circle-button ${value >= 1 ? "done" : ""}" id="markYesNoButton">✓</button>
        ${value >= 1 ? `<button class="cancel-success-button" id="cancelYesNoButton">Cancel</button>` : ""}
      </section>
    `;
  } else {
    actionHtml = `
      <section class="counter-action-area">
        <button class="big-add-button" id="increaseButton">+</button>
        <button class="small-minus-button" id="decreaseButton">−</button>
      </section>
    `;
  }

  details.innerHTML = `
    <div class="detail-card modern-goal-card">
      <header class="simple-goal-header">
        <div class="goal-heading-text">
          <h1>${escapeHtml(goal.title)}</h1>
          <p class="goal-type-label">${getGoalTypeName(goal.type)}</p>
          ${descriptionText}
        </div>

        ${goal.type === "counter" ? `<strong class="goal-counter-score">${value}/${goal.target}</strong>` : ""}
      </header>

      ${actionHtml}
    </div>
  `;

  showScreen("goalScreen", addToHistory);

  if (goal.type === "yesno") {
    document.getElementById("markYesNoButton").addEventListener("click", function() {
      setTodayValue(goal.id, 1);
      openGoal(goal.id, false);
    });

    const cancelButton = document.getElementById("cancelYesNoButton");

    if (cancelButton) {
      cancelButton.addEventListener("click", function() {
        setTodayValue(goal.id, 0);
        openGoal(goal.id, false);
      });
    }
  } else {
    document.getElementById("increaseButton").addEventListener("click", function() {
      setTodayValue(goal.id, value + 1);
      openGoal(goal.id, false);
    });

    document.getElementById("decreaseButton").addEventListener("click", function() {
      setTodayValue(goal.id, Math.max(0, value - 1));
      openGoal(goal.id, false);
    });
  }
}

function openGoalSettings(goalId, addToHistory = true) {
  const goal = goals.find(function(item) {
    return item.id === goalId;
  });

  if (!goal) return;

  currentGoalId = goalId;

  applyBackground(getProgress(goal));

  document.getElementById("editGoalNameInput").value = goal.title;
  document.getElementById("editGoalDescriptionInput").value = goal.description || "";
  setEditGoalType(goal.type, getGoalTypeName(goal.type), false);

  if (goal.type === "counter") {
    document.getElementById("editGoalTargetInput").value = goal.target;
  } else {
    document.getElementById("editGoalTargetInput").value = "";
  }

  showScreen("goalSettingsScreen", addToHistory);
}

function openGoalInfo(goalId, addToHistory = true) {
  const goal = goals.find(function(item) {
    return item.id === goalId;
  });

  if (!goal) return;

  currentGoalId = goalId;
  calendarDate = getCurrentMonthStart();

  applyBackground(getProgress(goal));
  renderGoalInfo();

  showScreen("goalInfoScreen", addToHistory);
}

function renderGoalInfo() {
  const goal = getCurrentGoal();
  if (!goal) return;

  const title = document.getElementById("goalInfoTitle");
  const monthTitle = document.getElementById("calendarMonthTitle");
  const grid = document.getElementById("goalCalendarGrid");
  const prevButton = document.getElementById("prevMonthButton");
  const nextButton = document.getElementById("nextMonthButton");

  const firstAllowedMonth = getGoalFirstMonthStart(goal);
  const currentAllowedMonth = getCurrentMonthStart();

  if (isBeforeMonth(calendarDate, firstAllowedMonth)) {
    calendarDate = new Date(firstAllowedMonth);
  }

  if (isAfterMonth(calendarDate, currentAllowedMonth)) {
    calendarDate = new Date(currentAllowedMonth);
  }

  title.textContent = goal.title;

  const monthName = calendarDate.toLocaleDateString("he-IL", { month: "long" });
  const yearName = calendarDate.toLocaleDateString("he-IL", { year: "numeric" });
  monthTitle.textContent = `${monthName}  ${yearName}`;

  prevButton.disabled = isSameMonth(calendarDate, firstAllowedMonth);
  nextButton.disabled = isSameMonth(calendarDate, currentAllowedMonth);

  grid.innerHTML = "";

  const weekDays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

  weekDays.forEach(function(day) {
    const dayName = document.createElement("div");
    dayName.className = "calendar-day-name";
    dayName.textContent = day;
    grid.appendChild(dayName);
  });

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startOffset; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell empty";
    grid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = formatDateKey(date);
    const cell = document.createElement("div");
    const future = isFutureDate(date);
    const success = isGoalSuccessOnDate(goal, dateKey);

    cell.className = "calendar-cell";
    cell.innerHTML = `<span>${day}</span>`;

    if (future) {
      cell.classList.add("future");
    } else if (success) {
      cell.classList.add("success");
      cell.innerHTML += `<strong>✓</strong>`;
    } else {
      cell.classList.add("fail");
      cell.innerHTML += `<strong>✕</strong>`;
    }

    if (!future && goal.type === "counter") {
      cell.addEventListener("click", function() {
        openDayDetail(dateKey);
      });
    }

    grid.appendChild(cell);
  }
}

function setTodayValue(goalId, newValue) {
  const today = getTodayKey();

  goals = goals.map(function(goal) {
    if (goal.id !== goalId) return goal;

    return {
      ...goal,
      records: {
        ...goal.records,
        [today]: newValue
      }
    };
  });

  saveGoals(goals);
  syncPlayer();
}

async function syncPlayer() {
  const name = getPlayerName();

  if (!name) return;

  const playerData = {
    device_id: getDeviceId(),
    name: name,
    current_score: getUserCurrentScore(),
    best_score: getUserBestScore(),
    updated_at: new Date().toISOString()
  };

  try {
    await fetch(`${SUPABASE_URL}/levelup_players?on_conflict=device_id`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(playerData)
    });
  } catch (error) {
    console.log("שגיאה בסנכרון שחקן:", error);
  }
}

async function fetchPlayers() {
  try {
    const response = await fetch(`${SUPABASE_URL}/levelup_players?select=name,current_score,best_score,updated_at`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) throw new Error("Supabase fetch failed");

    return await response.json();
  } catch (error) {
    console.log("שגיאה בקריאת דירוג:", error);

    return [
      {
        name: getPlayerName() || "אתה",
        current_score: getUserCurrentScore(),
        best_score: getUserBestScore()
      }
    ];
  }
}

async function renderRanking() {
  const renderId = ++rankingRenderId;
  const rankingList = document.getElementById("rankingList");

  rankingList.innerHTML = "";

  await syncPlayer();

  if (renderId !== rankingRenderId) return;

  let players = await fetchPlayers();

  if (renderId !== rankingRenderId) return;

  rankingList.innerHTML = "";

  players.sort(function(a, b) {
    if (rankingSortMode === "best") {
      return Number(b.best_score) - Number(a.best_score);
    }

    return Number(b.current_score) - Number(a.current_score);
  });

  players.forEach(function(player, index) {
    const row = document.createElement("article");
    row.className = `ranking-row rank-${index + 1}`;

    const primaryLabel = rankingSortMode === "current" ? "נוכחי" : "שיא";
    const secondaryLabel = rankingSortMode === "current" ? "שיא" : "נוכחי";

    const primaryValue = rankingSortMode === "current"
      ? Number(player.current_score)
      : Number(player.best_score);

    const secondaryValue = rankingSortMode === "current"
      ? Number(player.best_score)
      : Number(player.current_score);

    row.innerHTML = `
      <div class="ranking-name">${escapeHtml(player.name)}</div>

      <div class="ranking-scores">
        <div class="score-box active-score">
          <span>${primaryLabel}</span>
          <strong>${primaryValue}</strong>
        </div>

        <div class="score-box muted-score">
          <span>${secondaryLabel}</span>
          <strong>${secondaryValue}</strong>
        </div>
      </div>
    `;

    rankingList.appendChild(row);
  });

  document.getElementById("toggleRankingSortButton").textContent =
    rankingSortMode === "current" ? "נוכחי" : "שיא";
}

function setGoalType(type, label) {
  const goalTypeInput = document.getElementById("goalTypeInput");
  const goalTypeButton = document.getElementById("goalTypeButton");
  const goalTypePicker = document.getElementById("goalTypePicker");
  const goalTargetWrapper = document.getElementById("goalTargetWrapper");
  const goalTargetInput = document.getElementById("goalTargetInput");

  goalTypeInput.value = type;
  goalTypeButton.textContent = label;
  goalTypePicker.classList.remove("open");

  if (type === "counter") {
    goalTargetWrapper.classList.remove("hidden");
    goalTargetInput.required = true;
    goalTargetInput.value = "";
  } else {
    goalTargetWrapper.classList.add("hidden");
    goalTargetInput.required = false;
    goalTargetInput.value = "";
  }
}

function setEditGoalType(type, label, clearFields = true) {
  const editGoalTypeInput = document.getElementById("editGoalTypeInput");
  const editGoalTypeButton = document.getElementById("editGoalTypeButton");
  const editGoalTypePicker = document.getElementById("editGoalTypePicker");
  const editGoalTargetWrapper = document.getElementById("editGoalTargetWrapper");
  const editGoalTargetInput = document.getElementById("editGoalTargetInput");

  editGoalTypeInput.value = type;
  editGoalTypeButton.textContent = label;
  editGoalTypePicker.classList.remove("open");

  if (type === "counter") {
    editGoalTargetWrapper.classList.remove("hidden");
    editGoalTargetInput.required = true;

    if (clearFields) {
      editGoalTargetInput.value = "";
    }
  } else {
    editGoalTargetWrapper.classList.add("hidden");
    editGoalTargetInput.required = false;
    editGoalTargetInput.value = "";
  }
}

function resetAddGoalForm() {
  document.getElementById("addGoalForm").reset();
  document.getElementById("goalTypeInput").value = "";
  document.getElementById("goalTypeButton").textContent = "";
  document.getElementById("goalTypePicker").classList.remove("open");
  document.getElementById("goalTargetWrapper").classList.add("hidden");
  document.getElementById("goalTargetInput").required = false;
  document.getElementById("goalDescriptionInput").value = "";
}

function initializeGoalTypePickers() {
  const goalTypePicker = document.getElementById("goalTypePicker");
  const goalTypeButton = document.getElementById("goalTypeButton");
  const goalTypeOptions = document.getElementById("goalTypeOptions");

  const editGoalTypePicker = document.getElementById("editGoalTypePicker");
  const editGoalTypeButton = document.getElementById("editGoalTypeButton");
  const editGoalTypeOptions = document.getElementById("editGoalTypeOptions");

  goalTypeButton.addEventListener("click", function(event) {
    event.stopPropagation();
    editGoalTypePicker.classList.remove("open");
    goalTypePicker.classList.toggle("open");
  });

  goalTypeOptions.querySelectorAll("button").forEach(function(optionButton) {
    optionButton.addEventListener("click", function(event) {
      event.stopPropagation();
      setGoalType(optionButton.dataset.value, optionButton.textContent.trim());
    });
  });

  editGoalTypeButton.addEventListener("click", function(event) {
    event.stopPropagation();
    goalTypePicker.classList.remove("open");
    editGoalTypePicker.classList.toggle("open");
  });

  editGoalTypeOptions.querySelectorAll("button").forEach(function(optionButton) {
    optionButton.addEventListener("click", function(event) {
      event.stopPropagation();
      setEditGoalType(optionButton.dataset.value, optionButton.textContent.trim(), true);
    });
  });

  document.addEventListener("click", function() {
    goalTypePicker.classList.remove("open");
    editGoalTypePicker.classList.remove("open");
  });
}

function addGoal(event) {
  event.preventDefault();

  const titleInput = document.getElementById("goalNameInput");
  const descriptionInput = document.getElementById("goalDescriptionInput");
  const typeInput = document.getElementById("goalTypeInput");
  const typeButton = document.getElementById("goalTypeButton");
  const targetInput = document.getElementById("goalTargetInput");

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const type = typeInput.value;

  let hasError = false;

  if (!title) {
    flashElement(titleInput);
    hasError = true;
  }

  if (!type) {
    flashElement(typeButton);
    hasError = true;
  }

  if (type === "counter" && !targetInput.value) {
    flashElement(targetInput);
    hasError = true;
  }

  if (hasError) return;

  let target = 1;

  if (type === "counter") {
    target = Number(targetInput.value);

    if (!Number.isInteger(target) || target < 2 || target > 999) {
      alert("Target must be between 2 and 999");
      return;
    }
  }

  const newGoal = {
    id: `goal-${Date.now()}`,
    title: title,
    type: type,
    target: target,
    description: description,
    records: {}
  };

  goals.push(newGoal);
  saveGoals(goals);
  syncPlayer();
  applyGeneralBackground();

  resetAddGoalForm();
  showScreen("homeScreen");
}

function saveName(event) {
  event.preventDefault();

  const name = document.getElementById("playerNameInput").value.trim();

  if (!name) return;

  savePlayerName(name);
  syncPlayer();
  showScreen("homeScreen");
}

function editGoal(event) {
  event.preventDefault();

  if (!currentGoalId) return;

  const titleInput = document.getElementById("editGoalNameInput");
  const descriptionInput = document.getElementById("editGoalDescriptionInput");
  const typeInput = document.getElementById("editGoalTypeInput");
  const typeButton = document.getElementById("editGoalTypeButton");
  const targetInput = document.getElementById("editGoalTargetInput");

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const type = typeInput.value;

  let hasError = false;

  if (!title) {
    flashElement(titleInput);
    hasError = true;
  }

  if (!type) {
    flashElement(typeButton);
    hasError = true;
  }

  if (type === "counter" && !targetInput.value) {
    flashElement(targetInput);
    hasError = true;
  }

  if (hasError) return;

  let target = 1;

  if (type === "counter") {
    target = Number(targetInput.value);

    if (!Number.isInteger(target) || target < 2 || target > 999) {
      alert("Target must be between 2 and 999");
      return;
    }
  }

  goals = goals.map(function(goal) {
    if (goal.id !== currentGoalId) return goal;

    return {
      ...goal,
      title: title,
      type: type,
      target: target,
      description: description
    };
  });

  saveGoals(goals);
  syncPlayer();
  openGoal(currentGoalId, false);
}

function deleteCurrentGoal() {
  if (!currentGoalId) return;

  goals = goals.filter(function(goal) {
    return goal.id !== currentGoalId;
  });

  closeDeleteConfirm();
  saveGoals(goals);
  syncPlayer();
  showScreen("homeScreen");
}

function toggleRankingSort() {
  rankingSortMode = rankingSortMode === "current" ? "best" : "current";
  renderRanking();
}

window.addEventListener("popstate", function(event) {
  const state = event.state;

  if (isDayDetailOpen()) {
    closeDayDetail();
    return;
  }

  if (isDeleteConfirmOpen()) {
    closeDeleteConfirm();
    return;
  }

  if (isMenuOpen()) {
    closeMenu();
    return;
  }

  if (isGoalOptionsOpen()) {
    closeGoalOptionsMenu();
    return;
  }

  if (!state || state.screenId === "homeScreen") {
    showScreen("homeScreen", false);
    return;
  }

  if (state.menuOpen || state.goalOptionsOpen) return;

  if (state.screenId === "goalScreen" && state.goalId) {
    openGoal(state.goalId, false);
    return;
  }

  if (state.screenId === "goalSettingsScreen" && state.goalId) {
    openGoalSettings(state.goalId, false);
    return;
  }

  if (state.screenId === "goalInfoScreen" && state.goalId) {
    openGoalInfo(state.goalId, false);
    return;
  }

  showScreen(state.screenId, false);
});

document.addEventListener("DOMContentLoaded", function() {
  history.replaceState({ screenId: "homeScreen", goalId: null }, "", "");

  applyGeneralBackground();

  if (!getPlayerName()) {
    showScreen("nameScreen", false);
  } else {
    renderHome();
    syncPlayer();
  }

  initializeGoalTypePickers();

  document.getElementById("openMenuButton").addEventListener("click", openMenu);
  document.getElementById("menuOverlay").addEventListener("click", closeMenuFromOverlay);

  document.getElementById("openGoalOptionsButton").addEventListener("click", function(event) {
    event.stopPropagation();
    openGoalOptionsMenu();
  });

  document.getElementById("goalOptionsOverlay").addEventListener("click", closeGoalOptionsFromOverlay);

  document.getElementById("openGoalEditFromMenu").addEventListener("click", function() {
    openGoalScreenFromOptions("edit");
  });

  document.getElementById("openGoalInfoFromMenu").addEventListener("click", function() {
    openGoalScreenFromOptions("info");
  });

  document.getElementById("openRankingFromMenu").addEventListener("click", function() {
    openScreenFromMenu("rankingScreen");
  });

  document.getElementById("openAddFromMenu").addEventListener("click", function() {
    openScreenFromMenu("addScreen");
  });

  document.getElementById("prevMonthButton").addEventListener("click", function() {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderGoalInfo();
  });

  document.getElementById("nextMonthButton").addEventListener("click", function() {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderGoalInfo();
  });

  document.getElementById("dayDetailOverlay").addEventListener("click", function(event) {
    if (event.target.id === "dayDetailOverlay") {
      closeDayDetail();
    }
  });

  document.getElementById("toggleRankingSortButton").addEventListener("click", toggleRankingSort);

  document.querySelectorAll(".back-button").forEach(function(button) {
    button.addEventListener("click", goBack);
  });

  document.getElementById("goalNameInput").addEventListener("input", function(event) {
    flashInputLimit(event.target);
  });

  document.getElementById("editGoalNameInput").addEventListener("input", function(event) {
    flashInputLimit(event.target);
  });

  document.getElementById("goalDescriptionInput").addEventListener("input", function(event) {
    flashInputLimit(event.target);
  });

  document.getElementById("editGoalDescriptionInput").addEventListener("input", function(event) {
    flashInputLimit(event.target);
  });

  document.getElementById("addGoalForm").addEventListener("submit", addGoal);
  document.getElementById("editGoalForm").addEventListener("submit", editGoal);

  document.getElementById("deleteGoalButton").addEventListener("click", openDeleteConfirm);
  document.getElementById("cancelDeleteButton").addEventListener("click", closeDeleteConfirm);
  document.getElementById("confirmDeleteButton").addEventListener("click", deleteCurrentGoal);

  document.getElementById("deleteConfirmOverlay").addEventListener("click", function(event) {
    if (event.target.id === "deleteConfirmOverlay") {
      closeDeleteConfirm();
    }
  });

  document.getElementById("nameForm").addEventListener("submit", saveName);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(function () {
        console.log("Service Worker נרשם בהצלחה");
      })
      .catch(function (error) {
        console.log("שגיאה ברישום Service Worker:", error);
      });
  });
}
