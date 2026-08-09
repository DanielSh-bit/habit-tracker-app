const STORAGE_KEY = "levelup_goals";
const PLAYER_NAME_KEY = "levelup_player_name";
const DEVICE_ID_KEY = "levelup_device_id";
const USER_BEST_SCORE_KEY = "levelup_user_best_streak";

const SUPABASE_URL = "https://gkkdwwprhfsgtzjpnwaj.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_zgmgY6On7ttFUxsuXWrEKA_zTYwJmim";

let currentScreenId = "homeScreen";
let currentGoalId = null;
let rankingSortMode = "current";
let rankingRenderId = 0;
let calendarDate = new Date();

function $(id) {
  return document.getElementById(id);
}

function on(id, eventName, handler) {
  const element = $(id);

  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getCurrentMonthStart() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseDateKey(dateKey) {
  const parts = String(dateKey).split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  date.setHours(0, 0, 0, 0);
  return date;
}

function compareDateKeys(firstKey, secondKey) {
  if (firstKey < secondKey) return -1;
  if (firstKey > secondKey) return 1;
  return 0;
}

function getGoalStartDate(goal) {
  if (goal.createdAt) {
    return parseDateKey(goal.createdAt);
  }

  const recordDates = Object.keys(goal.records || {}).sort();

  if (recordDates.length > 0) {
    return parseDateKey(recordDates[0]);
  }

  return getDateStart(new Date());
}

function getGoalFirstMonthStart(goal) {
  const startDate = getGoalStartDate(goal);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
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

function isAfterDay(firstDate, secondDate) {
  return getDateStart(firstDate).getTime() > getDateStart(secondDate).getTime();
}

function maxDate(firstDate, secondDate) {
  return isAfterDay(firstDate, secondDate) ? firstDate : secondDate;
}

function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((getDateStart(endDate) - getDateStart(startDate)) / oneDay) + 1;
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
  const today = getDateStart(new Date());
  const checkedDate = getDateStart(date);

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

function getGoalImportance(goal) {
  const importance = Number(goal.importance || 3);

  if (!Number.isInteger(importance)) return 3;

  return clampNumber(importance, 1, 5);
}

function normalizeGoal(goal) {
  const type = goal.type === "yesno" ? "yesno" : "counter";
  const target = type === "yesno" ? 1 : Math.max(2, Math.min(999, Number(goal.target) || 2));
  const recordDates = Object.keys(goal.records || {}).sort();
  const fallbackCreatedAt = recordDates.length > 0 ? recordDates[0] : getTodayKey();

  return {
    id: goal.id || `goal-${Date.now()}`,
    title: goal.title || "אתגר",
    type: type,
    target: target,
    description: goal.description || "",
    importance: getGoalImportance(goal),
    createdAt: goal.createdAt || fallbackCreatedAt,
    records: goal.records || {}
  };
}

function getDefaultGoals() {
  const today = getTodayKey();

  return [
    {
      id: "workout",
      title: "אימון",
      type: "yesno",
      target: 1,
      description: "",
      importance: 4,
      createdAt: today,
      records: {}
    },
    {
      id: "water",
      title: "מים",
      type: "counter",
      target: 8,
      description: "",
      importance: 2,
      createdAt: today,
      records: {}
    },
    {
      id: "sleep",
      title: "שינה",
      type: "counter",
      target: 8,
      description: "",
      importance: 5,
      createdAt: today,
      records: {}
    }
  ];
}

function loadGoals() {
  try {
    const savedGoals = localStorage.getItem(STORAGE_KEY);

    if (!savedGoals) {
      const defaultGoals = getDefaultGoals();
      saveGoals(defaultGoals);
      return defaultGoals;
    }

    const parsedGoals = JSON.parse(savedGoals);

    if (!Array.isArray(parsedGoals)) {
      throw new Error("Invalid goals data");
    }

    const normalizedGoals = parsedGoals.map(normalizeGoal);
    saveGoals(normalizedGoals);
    return normalizedGoals;
  } catch (error) {
    console.log("שגיאה בטעינת אתגרים:", error);

    const defaultGoals = getDefaultGoals();
    saveGoals(defaultGoals);
    return defaultGoals;
  }
}

function saveGoals(goalsToSave) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goalsToSave));
}

let goals = loadGoals();

function getTodayValue(goal) {
  return Number(goal.records[getTodayKey()] || 0);
}

function getDayCompletion(goal, dateKey) {
  const value = Number(goal.records[dateKey] || 0);

  if (goal.type === "yesno") {
    return value >= 1 ? 100 : 0;
  }

  return Math.min(Math.round((value / goal.target) * 100), 100);
}

function getScoreEndDate(goal) {
  const today = getDateStart(new Date());
  const todayValue = getTodayValue(goal);

  if (todayValue > 0) {
    return today;
  }

  return addDays(today, -1);
}

function getAverageCompletion(goal, startDate, endDate) {
  if (isAfterDay(startDate, endDate)) return 0;

  let sum = 0;
  let count = 0;

  for (let date = new Date(startDate); !isAfterDay(date, endDate); date = addDays(date, 1)) {
    sum += getDayCompletion(goal, formatDateKey(date));
    count++;
  }

  if (count === 0) return 0;

  return sum / count;
}

function getGoalScore(goal) {
  const startDate = getGoalStartDate(goal);
  const endDate = getScoreEndDate(goal);

  if (isAfterDay(startDate, endDate)) {
    return 0;
  }

  const activeDays = daysBetween(startDate, endDate);

  const last30Start = maxDate(startDate, addDays(endDate, -29));
  const last90Start = maxDate(startDate, addDays(endDate, -89));

  const last7Start = maxDate(startDate, addDays(endDate, -6));
  const previous7End = addDays(last7Start, -1);
  const previous7Start = maxDate(startDate, addDays(previous7End, -6));

  const average30 = getAverageCompletion(goal, last30Start, endDate);
  const average90 = getAverageCompletion(goal, last90Start, endDate);

  const last7Average = getAverageCompletion(goal, last7Start, endDate);
  const previous7Average = isAfterDay(startDate, previous7End)
    ? last7Average
    : getAverageCompletion(goal, previous7Start, previous7End);

  const trendScore = clampNumber(50 + (last7Average - previous7Average) * 0.5, 0, 100);
  const rawScore = average30 * 0.6 + average90 * 0.3 + trendScore * 0.1;

  const maturityCap = Math.min(99, 70 + activeDays * 0.3);
  const finalScore = Math.min(rawScore, maturityCap);

  return Math.round(finalScore);
}

function getProgress(goal) {
  return getGoalScore(goal);
}

function isGoalSuccessOnDate(goal, dateKey) {
  return Number(goal.records[dateKey] || 0) >= Number(goal.target);
}

function getGoalsActiveOnDate(dateKey) {
  return goals.filter(function(goal) {
    return compareDateKeys(goal.createdAt || getTodayKey(), dateKey) <= 0;
  });
}

function isFullSuccessOnDate(dateKey) {
  const activeGoals = getGoalsActiveOnDate(dateKey);

  if (activeGoals.length === 0) {
    return false;
  }

  return activeGoals.every(function(goal) {
    return isGoalSuccessOnDate(goal, dateKey);
  });
}

function getCurrentStreak() {
  let streak = 0;
  let checkedDate = addDays(new Date(), -1);

  while (true) {
    const dateKey = formatDateKey(checkedDate);

    if (!isFullSuccessOnDate(dateKey)) {
      break;
    }

    streak++;
    checkedDate = addDays(checkedDate, -1);
  }

  return streak;
}

function getUserCurrentScore() {
  return getCurrentStreak();
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
  document.body.classList.remove(
    "tone-0",
    "tone-15",
    "tone-30",
    "tone-45",
    "tone-60",
    "tone-75",
    "tone-90",
    "tone-100"
  );

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
  if (type === "counter") return "מספר";
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

function limitNumberInput(input, min, max) {
  if (!input) return;

  const originalValue = input.value;
  const maxLength = String(max).length;

  input.value = input.value.replace(/[^\d]/g, "");

  if (input.value.length > maxLength) {
    input.value = input.value.slice(0, maxLength);
  }

  if (Number(input.value) > max) {
    input.value = String(max);
  }

  if (input.value !== originalValue) {
    flashElement(input);
  }
}

function readImportance(input) {
  const value = Number(input.value);

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return null;
  }

  return value;
}

function isMenuOpen() {
  return $("sideMenu") && $("sideMenu").classList.contains("open");
}

function isGoalOptionsOpen() {
  return $("goalOptionsMenu") && $("goalOptionsMenu").classList.contains("open");
}

function isDeleteConfirmOpen() {
  return $("deleteConfirmOverlay") && $("deleteConfirmOverlay").classList.contains("open");
}

function isDayDetailOpen() {
  return $("dayDetailOverlay") && $("dayDetailOverlay").classList.contains("open");
}

function openMenu() {
  if (isMenuOpen()) return;

  $("sideMenu").classList.add("open");
  $("menuOverlay").classList.add("open");

  history.pushState(
    {
      screenId: currentScreenId,
      goalId: currentGoalId,
      menuOpen: true
    },
    "",
    ""
  );
}

function closeMenu() {
  if ($("sideMenu")) $("sideMenu").classList.remove("open");
  if ($("menuOverlay")) $("menuOverlay").classList.remove("open");
}

function openGoalOptionsMenu() {
  if (!currentGoalId || isGoalOptionsOpen()) return;

  $("goalOptionsMenu").classList.add("open");
  $("goalOptionsOverlay").classList.add("open");

  history.pushState(
    {
      screenId: currentScreenId,
      goalId: currentGoalId,
      goalOptionsOpen: true
    },
    "",
    ""
  );
}

function closeGoalOptionsMenu() {
  if ($("goalOptionsMenu")) $("goalOptionsMenu").classList.remove("open");
  if ($("goalOptionsOverlay")) $("goalOptionsOverlay").classList.remove("open");
}

function openDeleteConfirm() {
  if (!currentGoalId || !$("deleteConfirmOverlay")) return;
  $("deleteConfirmOverlay").classList.add("open");
}

function closeDeleteConfirm() {
  if ($("deleteConfirmOverlay")) $("deleteConfirmOverlay").classList.remove("open");
}

function openDayDetail(dateKey) {
  const goal = getCurrentGoal();

  if (!goal || goal.type !== "counter") return;

  const value = Number(goal.records[dateKey] || 0);
  const isSuccess = value >= Number(goal.target);

  if (!$("dayDetailOverlay") || !$("dayDetailBox") || !$("dayDetailScore")) return;

  $("dayDetailScore").textContent = `${value}/${goal.target}`;

  $("dayDetailBox").classList.remove("success", "fail");
  $("dayDetailBox").classList.add(isSuccess ? "success" : "fail");

  $("dayDetailOverlay").classList.add("open");
}

function closeDayDetail() {
  if ($("dayDetailOverlay")) $("dayDetailOverlay").classList.remove("open");
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
    history.replaceState(
      {
        screenId: currentScreenId,
        goalId: currentGoalId
      },
      "",
      ""
    );
  }

  showScreen(screenId);
}

function openGoalScreenFromOptions(screenName) {
  if (!currentGoalId) return;

  if (history.state && history.state.goalOptionsOpen) {
    history.replaceState(
      {
        screenId: "goalScreen",
        goalId: currentGoalId
      },
      "",
      ""
    );
  }

  closeGoalOptionsMenu();

  if (screenName === "edit") {
    openGoalSettings(currentGoalId);
  }

  if (screenName === "info") {
    openGoalInfo(currentGoalId);
  }
}

function showScreen(screenId, addToHistory = true) {
  closeMenu();
  closeGoalOptionsMenu();
  closeDeleteConfirm();
  closeDayDetail();

  if (!$(screenId)) return;

  currentScreenId = screenId;

  document.querySelectorAll(".screen").forEach(function(screen) {
    screen.classList.remove("active");
  });

  $(screenId).classList.add("active");

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
    history.pushState(
      {
        screenId: screenId,
        goalId: currentGoalId
      },
      "",
      ""
    );
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
    if (history.state && history.state.menuOpen) {
      history.back();
    } else {
      closeMenu();
    }

    return;
  }

  if (isGoalOptionsOpen()) {
    if (history.state && history.state.goalOptionsOpen) {
      history.back();
    } else {
      closeGoalOptionsMenu();
    }

    return;
  }

  if (currentScreenId === "homeScreen") return;

  history.back();
}

function renderHome() {
  const goalsGrid = $("goalsGrid");
  if (!goalsGrid) return;

  goalsGrid.innerHTML = "";

  goals.forEach(function(goal) {
    const value = getTodayValue(goal);

    const card = document.createElement("article");
    card.className = "goal-card";

    const actionSymbol = goal.type === "yesno" ? "✓" : "+";
    const actionClass = goal.type === "yesno" ? "home-goal-check" : "home-goal-plus";

    card.innerHTML = `
      <div class="goal-title">
        <h2>${escapeHtml(goal.title)}</h2>
      </div>

      <button type="button" class="home-goal-action ${actionClass}">
        ${actionSymbol}
      </button>
    `;

    const actionButton = card.querySelector(".home-goal-action");

    actionButton.addEventListener("click", function(event) {
      event.stopPropagation();

      if (goal.type === "yesno") {
        setTodayValue(goal.id, 1);
      } else {
        setTodayValue(goal.id, value + 1);
      }

      renderHome();
      applyGeneralBackground();
    });

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

  if (!goal || !$("goalDetails")) return;

  currentGoalId = goalId;

  const value = getTodayValue(goal);
  const progress = getProgress(goal);

  const descriptionText = goal.description
    ? `<p class="goal-description">${formatDescription(goal.description)}</p>`
    : "";

  applyBackground(progress);

  let actionHtml = "";

  if (goal.type === "yesno") {
    if (value >= 1) {
      actionHtml = `
        <section class="yesno-action-area">
          <button class="yesno-main-button yesno-cancel-button" id="cancelYesNoButton">✕</button>
        </section>
      `;
    } else {
      actionHtml = `
        <section class="yesno-action-area">
          <button class="yesno-main-button yesno-complete-button" id="markYesNoButton">✓</button>
        </section>
      `;
    }
  } else {
    actionHtml = `
      <section class="counter-action-area">
        <button class="big-add-button" id="increaseButton">+</button>
        <button class="small-minus-button" id="decreaseButton">−</button>
      </section>
    `;
  }

  $("goalDetails").innerHTML = `
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
    on("markYesNoButton", "click", function() {
      setTodayValue(goal.id, 1);
      openGoal(goal.id, false);
    });

    on("cancelYesNoButton", "click", function() {
      setTodayValue(goal.id, 0);
      openGoal(goal.id, false);
    });
  } else {
    on("increaseButton", "click", function() {
      setTodayValue(goal.id, value + 1);
      openGoal(goal.id, false);
    });

    on("decreaseButton", "click", function() {
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

  if ($("editGoalNameInput")) $("editGoalNameInput").value = goal.title;
  if ($("editGoalDescriptionInput")) $("editGoalDescriptionInput").value = goal.description || "";
  if ($("editGoalImportanceInput")) $("editGoalImportanceInput").value = getGoalImportance(goal);

  setEditGoalType(goal.type, getGoalTypeName(goal.type), false);

  if ($("editGoalTargetInput")) {
    $("editGoalTargetInput").value = goal.type === "counter" ? goal.target : "";
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
  if (!goal || !$("goalCalendarGrid")) return;

  const firstAllowedMonth = getGoalFirstMonthStart(goal);
  const currentAllowedMonth = getCurrentMonthStart();
  const todayKey = getTodayKey();

  if (isBeforeMonth(calendarDate, firstAllowedMonth)) {
    calendarDate = new Date(firstAllowedMonth);
  }

  if (isAfterMonth(calendarDate, currentAllowedMonth)) {
    calendarDate = new Date(currentAllowedMonth);
  }

  if ($("goalInfoTitle")) {
    $("goalInfoTitle").textContent = goal.title;
  }

  const monthName = calendarDate.toLocaleDateString("he-IL", { month: "long" });
  const yearName = calendarDate.toLocaleDateString("he-IL", { year: "numeric" });

  if ($("calendarMonthTitle")) {
    $("calendarMonthTitle").textContent = `${monthName}  ${yearName}`;
  }

  if ($("prevMonthButton")) {
    $("prevMonthButton").disabled = isSameMonth(calendarDate, firstAllowedMonth);
  }

  if ($("nextMonthButton")) {
    $("nextMonthButton").disabled = isSameMonth(calendarDate, currentAllowedMonth);
  }

  const grid = $("goalCalendarGrid");
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
    const future = isFutureDate(date);
    const success = isGoalSuccessOnDate(goal, dateKey);

    const cell = document.createElement("div");
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

    if (dateKey === todayKey) {
      cell.classList.add("today");
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
  if (!$("rankingList")) return;

  const renderId = ++rankingRenderId;
  const rankingList = $("rankingList");

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

  if ($("toggleRankingSortButton")) {
    $("toggleRankingSortButton").textContent = rankingSortMode === "current" ? "נוכחי" : "שיא";
  }
}

function setGoalType(type, label) {
  if (!$("goalTypeInput") || !$("goalTypeButton") || !$("goalTargetWrapper") || !$("goalTargetInput")) return;

  $("goalTypeInput").value = type;
  $("goalTypeButton").textContent = label;

  if ($("goalTypePicker")) {
    $("goalTypePicker").classList.remove("open");
  }

  if (type === "counter") {
    $("goalTargetWrapper").classList.remove("hidden");
    $("goalTargetInput").required = true;
    $("goalTargetInput").value = "";
  } else {
    $("goalTargetWrapper").classList.add("hidden");
    $("goalTargetInput").required = false;
    $("goalTargetInput").value = "";
  }
}

function setEditGoalType(type, label, clearFields = true) {
  if (!$("editGoalTypeInput") || !$("editGoalTypeButton") || !$("editGoalTargetWrapper") || !$("editGoalTargetInput")) return;

  $("editGoalTypeInput").value = type;
  $("editGoalTypeButton").textContent = label;

  if ($("editGoalTypePicker")) {
    $("editGoalTypePicker").classList.remove("open");
  }

  if (type === "counter") {
    $("editGoalTargetWrapper").classList.remove("hidden");
    $("editGoalTargetInput").required = true;

    if (clearFields) {
      $("editGoalTargetInput").value = "";
    }
  } else {
    $("editGoalTargetWrapper").classList.add("hidden");
    $("editGoalTargetInput").required = false;
    $("editGoalTargetInput").value = "";
  }
}

function resetAddGoalForm() {
  if ($("addGoalForm")) $("addGoalForm").reset();
  if ($("goalTypeInput")) $("goalTypeInput").value = "";
  if ($("goalTypeButton")) $("goalTypeButton").textContent = "";
  if ($("goalTypePicker")) $("goalTypePicker").classList.remove("open");
  if ($("goalTargetWrapper")) $("goalTargetWrapper").classList.add("hidden");
  if ($("goalTargetInput")) $("goalTargetInput").required = false;
  if ($("goalDescriptionInput")) $("goalDescriptionInput").value = "";
  if ($("goalImportanceInput")) $("goalImportanceInput").value = "3";
}

function initializeGoalTypePickers() {
  const goalTypePicker = $("goalTypePicker");
  const goalTypeButton = $("goalTypeButton");
  const goalTypeOptions = $("goalTypeOptions");

  const editGoalTypePicker = $("editGoalTypePicker");
  const editGoalTypeButton = $("editGoalTypeButton");
  const editGoalTypeOptions = $("editGoalTypeOptions");

  if (goalTypeButton && goalTypePicker) {
    goalTypeButton.addEventListener("click", function(event) {
      event.stopPropagation();

      if (editGoalTypePicker) {
        editGoalTypePicker.classList.remove("open");
      }

      goalTypePicker.classList.toggle("open");
    });
  }

  if (goalTypeOptions) {
    goalTypeOptions.querySelectorAll("button").forEach(function(optionButton) {
      optionButton.addEventListener("click", function(event) {
        event.stopPropagation();
        setGoalType(optionButton.dataset.value, optionButton.textContent.trim());
      });
    });
  }

  if (editGoalTypeButton && editGoalTypePicker) {
    editGoalTypeButton.addEventListener("click", function(event) {
      event.stopPropagation();

      if (goalTypePicker) {
        goalTypePicker.classList.remove("open");
      }

      editGoalTypePicker.classList.toggle("open");
    });
  }

  if (editGoalTypeOptions) {
    editGoalTypeOptions.querySelectorAll("button").forEach(function(optionButton) {
      optionButton.addEventListener("click", function(event) {
        event.stopPropagation();
        setEditGoalType(optionButton.dataset.value, optionButton.textContent.trim(), true);
      });
    });
  }

  document.addEventListener("click", function() {
    if (goalTypePicker) goalTypePicker.classList.remove("open");
    if (editGoalTypePicker) editGoalTypePicker.classList.remove("open");
  });
}

function addGoal(event) {
  event.preventDefault();

  const titleInput = $("goalNameInput");
  const descriptionInput = $("goalDescriptionInput");
  const importanceInput = $("goalImportanceInput");
  const typeInput = $("goalTypeInput");
  const typeButton = $("goalTypeButton");
  const targetInput = $("goalTargetInput");

  if (!titleInput || !descriptionInput || !importanceInput || !typeInput || !targetInput) return;

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const importance = readImportance(importanceInput);
  const type = typeInput.value;

  let hasError = false;

  if (!title) {
    flashElement(titleInput);
    hasError = true;
  }

  if (importance === null) {
    flashElement(importanceInput);
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
    importance: importance,
    createdAt: getTodayKey(),
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

  const nameInput = $("playerNameInput");
  if (!nameInput) return;

  const name = nameInput.value.trim();

  if (!name) {
    flashElement(nameInput);
    return;
  }

  savePlayerName(name);
  syncPlayer();
  showScreen("homeScreen");
}

function editGoal(event) {
  event.preventDefault();

  if (!currentGoalId) return;

  const titleInput = $("editGoalNameInput");
  const descriptionInput = $("editGoalDescriptionInput");
  const importanceInput = $("editGoalImportanceInput");
  const typeInput = $("editGoalTypeInput");
  const typeButton = $("editGoalTypeButton");
  const targetInput = $("editGoalTargetInput");

  if (!titleInput || !descriptionInput || !importanceInput || !typeInput || !targetInput) return;

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const importance = readImportance(importanceInput);
  const type = typeInput.value;

  let hasError = false;

  if (!title) {
    flashElement(titleInput);
    hasError = true;
  }

  if (importance === null) {
    flashElement(importanceInput);
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
      description: description,
      importance: importance
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
  history.replaceState(
    {
      screenId: "homeScreen",
      goalId: null
    },
    "",
    ""
  );

  applyGeneralBackground();

  if (!getPlayerName()) {
    showScreen("nameScreen", false);
  } else {
    renderHome();
    syncPlayer();
  }

  initializeGoalTypePickers();

  on("openMenuButton", "click", openMenu);
  on("menuOverlay", "click", closeMenuFromOverlay);

  on("openGoalOptionsButton", "click", function(event) {
    event.stopPropagation();
    openGoalOptionsMenu();
  });

  on("goalOptionsOverlay", "click", closeGoalOptionsFromOverlay);

  on("openGoalEditFromMenu", "click", function() {
    openGoalScreenFromOptions("edit");
  });

  on("openGoalInfoFromMenu", "click", function() {
    openGoalScreenFromOptions("info");
  });

  on("openRankingFromMenu", "click", function() {
    openScreenFromMenu("rankingScreen");
  });

  on("openAddFromMenu", "click", function() {
    openScreenFromMenu("addScreen");
  });

  on("prevMonthButton", "click", function() {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderGoalInfo();
  });

  on("nextMonthButton", "click", function() {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderGoalInfo();
  });

  on("dayDetailOverlay", "click", function(event) {
    if (event.target.id === "dayDetailOverlay") {
      closeDayDetail();
    }
  });

  on("toggleRankingSortButton", "click", toggleRankingSort);

  document.querySelectorAll(".back-button").forEach(function(button) {
    button.addEventListener("click", goBack);
  });

  on("goalNameInput", "input", function(event) {
    flashInputLimit(event.target);
  });

  on("editGoalNameInput", "input", function(event) {
    flashInputLimit(event.target);
  });

  on("goalDescriptionInput", "input", function(event) {
    flashInputLimit(event.target);
  });

  on("editGoalDescriptionInput", "input", function(event) {
    flashInputLimit(event.target);
  });

  on("playerNameInput", "input", function(event) {
    flashInputLimit(event.target);
  });

  on("goalImportanceInput", "input", function(event) {
    limitNumberInput(event.target, 1, 5);
  });

  on("editGoalImportanceInput", "input", function(event) {
    limitNumberInput(event.target, 1, 5);
  });

  on("goalTargetInput", "input", function(event) {
    limitNumberInput(event.target, 2, 999);
  });

  on("editGoalTargetInput", "input", function(event) {
    limitNumberInput(event.target, 2, 999);
  });

  on("addGoalForm", "submit", addGoal);
  on("editGoalForm", "submit", editGoal);

  on("deleteGoalButton", "click", openDeleteConfirm);
  on("cancelDeleteButton", "click", closeDeleteConfirm);
  on("confirmDeleteButton", "click", deleteCurrentGoal);

  on("deleteConfirmOverlay", "click", function(event) {
    if (event.target.id === "deleteConfirmOverlay") {
      closeDeleteConfirm();
    }
  });

  on("nameForm", "submit", saveName);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(function() {
        console.log("Service Worker נרשם בהצלחה");
      })
      .catch(function(error) {
        console.log("שגיאה ברישום Service Worker:", error);
      });
  });
}
