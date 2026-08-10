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

let isReorderMode = false;
let draggedGoalId = null;
let longPressTimer = null;
let dragState = null;

let autoScrollAnimationId = null;
let autoScrollSpeed = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let suppressClickUntil = 0;

function $(id) {
  return document.getElementById(id);
}

function on(id, eventName, handler) {
  const element = $(id);
  if (element) element.addEventListener(eventName, handler);
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
  if (goal.createdAt) return parseDateKey(goal.createdAt);

  const recordDates = Object.keys(goal.records || {}).sort();
  if (recordDates.length > 0) return parseDateKey(recordDates[0]);

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

function isFutureDate(date) {
  return getDateStart(date) > getDateStart(new Date());
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

  if (currentLine) lines.push(currentLine);

  return lines.map(escapeHtml).join("<br>");
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
      importance: 3,
      createdAt: today,
      records: {}
    },
    {
      id: "water",
      title: "מים",
      type: "counter",
      target: 8,
      description: "",
      importance: 3,
      createdAt: today,
      records: {}
    },
    {
      id: "sleep",
      title: "שינה",
      type: "counter",
      target: 8,
      description: "",
      importance: 3,
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
    if (!Array.isArray(parsedGoals)) throw new Error("Invalid goals data");

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

function getTodayProgress(goal) {
  const value = getTodayValue(goal);

  if (goal.type === "yesno") {
    return value >= 1 ? 100 : 0;
  }

  return Math.min(Math.round((value / goal.target) * 100), 100);
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

  if (activeGoals.length === 0) return false;

  return activeGoals.every(function(goal) {
    return isGoalSuccessOnDate(goal, dateKey);
  });
}

function getPastCompletedStreak() {
  let streak = 0;
  let checkedDate = addDays(new Date(), -1);

  while (true) {
    const dateKey = formatDateKey(checkedDate);

    if (!isFullSuccessOnDate(dateKey)) break;

    streak++;
    checkedDate = addDays(checkedDate, -1);
  }

  return streak;
}

function getCurrentStreak() {
  const pastStreak = getPastCompletedStreak();
  const todayKey = getTodayKey();

  if (isFullSuccessOnDate(todayKey)) {
    return pastStreak + 1;
  }

  return pastStreak;
}

function getGoalPastCompletedStreak(goal) {
  let streak = 0;
  let checkedDate = addDays(new Date(), -1);

  while (true) {
    const dateKey = formatDateKey(checkedDate);

    if (compareDateKeys(dateKey, goal.createdAt || getTodayKey()) < 0) break;
    if (!isGoalSuccessOnDate(goal, dateKey)) break;

    streak++;
    checkedDate = addDays(checkedDate, -1);
  }

  return streak;
}

function getGoalCurrentStreak(goal) {
  const pastStreak = getGoalPastCompletedStreak(goal);
  const todayKey = getTodayKey();

  if (isGoalSuccessOnDate(goal, todayKey)) {
    return pastStreak + 1;
  }

  return pastStreak;
}

function getGoalBestStreak(goal) {
  const startDate = getGoalStartDate(goal);
  const today = getDateStart(new Date());

  let best = 0;
  let current = 0;

  for (let date = new Date(startDate); date <= today; date = addDays(date, 1)) {
    const dateKey = formatDateKey(date);

    if (isGoalSuccessOnDate(goal, dateKey)) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }

  return best;
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

function updateAppBadge() {
  const streak = getCurrentStreak();

  if (!("setAppBadge" in navigator)) return;

  if (streak > 0) {
    navigator.setAppBadge(streak).catch(function() {});
  } else if ("clearAppBadge" in navigator) {
    navigator.clearAppBadge().catch(function() {});
  }
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
  applyBackground(Math.min(getUserCurrentScore() * 10, 100));
  updateAppBadge();
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

function hideImportanceFields() {
  ["goalImportanceInput", "editGoalImportanceInput"].forEach(function(id) {
    const input = $(id);
    if (!input) return;

    const wrapper =
      input.closest(".form-group") ||
      input.closest(".field-group") ||
      input.closest(".input-group") ||
      input.closest(".form-row") ||
      input.closest(".setting-row") ||
      input.closest(".field-block") ||
      input.parentElement;

    if (wrapper) wrapper.style.display = "none";
  });
}

function renderGoalInfoStreaks(goal) {
  const calendarGrid = $("goalCalendarGrid");
  if (!calendarGrid) return;

  let streakBox = $("goalInfoStreaks");

  if (!streakBox) {
    streakBox = document.createElement("div");
    streakBox.id = "goalInfoStreaks";
    streakBox.className = "goal-info-streaks";

    const monthTitle = $("calendarMonthTitle");

    if (monthTitle && monthTitle.parentElement) {
      monthTitle.parentElement.insertAdjacentElement("beforebegin", streakBox);
    } else if (calendarGrid.parentElement) {
      calendarGrid.parentElement.insertBefore(streakBox, calendarGrid);
    }
  }

  streakBox.innerHTML = `
    <div class="goal-streak-chip">
      <span>רצף נוכחי</span>
      <strong>${getGoalCurrentStreak(goal)}</strong>
    </div>

    <div class="goal-streak-chip">
      <span>שיא</span>
      <strong>${getGoalBestStreak(goal)}</strong>
    </div>
  `;
}

function getGoalCardElement(goalId) {
  return Array.from(document.querySelectorAll("#goalsGrid .goal-card")).find(function(card) {
    return card.dataset.goalId === goalId;
  });
}

function reorderHomeDomToMatchGoals() {
  const goalsGrid = $("goalsGrid");
  if (!goalsGrid) return;

  goals.forEach(function(goal) {
    const card = getGoalCardElement(goal.id);
    if (card) goalsGrid.appendChild(card);
  });
}

function getReorderScrollContainer() {
  const candidates = [
    $("homeScreen"),
    document.querySelector(".screen.active"),
    document.scrollingElement
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (candidate.scrollHeight > candidate.clientHeight + 6) {
      return candidate;
    }
  }

  return document.scrollingElement || document.documentElement;
}

function updateDragGhostPosition() {
  if (!dragState || !dragState.ghost) return;

  dragState.ghost.style.left = `${dragState.x - dragState.offsetX}px`;
  dragState.ghost.style.top = `${dragState.y - dragState.offsetY}px`;
}

function createDragGhost(goalId) {
  if (!dragState) return;

  const sourceCard = getGoalCardElement(goalId);
  if (!sourceCard) return;

  const rect = sourceCard.getBoundingClientRect();
  const ghost = sourceCard.cloneNode(true);

  dragState.offsetX = dragState.x - rect.left;
  dragState.offsetY = dragState.y - rect.top;
  dragState.ghost = ghost;

  ghost.classList.add("drag-ghost");
  ghost.style.position = "fixed";
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.zIndex = "9999";
  ghost.style.pointerEvents = "none";
  ghost.style.transform = "scale(1.04)";
  ghost.style.opacity = "0.96";
  ghost.style.boxShadow = "0 26px 60px rgba(15, 23, 42, 0.34)";
  ghost.style.touchAction = "none";

  document.body.appendChild(ghost);
  updateDragGhostPosition();
}

function removeDragGhost() {
  if (dragState && dragState.ghost) {
    dragState.ghost.remove();
    dragState.ghost = null;
  }
}

function moveDraggedGoalAtY(clientY) {
  if (!isReorderMode || !draggedGoalId) return;

  const draggedGoal = goals.find(function(goal) {
    return goal.id === draggedGoalId;
  });

  if (!draggedGoal) return;

  const remainingGoals = goals.filter(function(goal) {
    return goal.id !== draggedGoalId;
  });

  const cards = Array.from(document.querySelectorAll("#goalsGrid .goal-card")).filter(function(card) {
    return card.dataset.goalId !== draggedGoalId;
  });

  let insertIndex = remainingGoals.length;

  for (const card of cards) {
    const targetGoalId = card.dataset.goalId;
    const targetIndex = remainingGoals.findIndex(function(goal) {
      return goal.id === targetGoalId;
    });

    if (targetIndex === -1) continue;

    const rect = card.getBoundingClientRect();
    const middleY = rect.top + rect.height / 2;

    if (clientY < middleY) {
      insertIndex = targetIndex;
      break;
    }
  }

  const newGoals = [...remainingGoals];
  newGoals.splice(insertIndex, 0, draggedGoal);

  const sameOrder = newGoals.every(function(goal, index) {
    return goals[index] && goals[index].id === goal.id;
  });

  if (sameOrder) return;

  goals = newGoals;
  saveGoals(goals);
  reorderHomeDomToMatchGoals();
  updateDragGhostPosition();
}

function stopReorderAutoScroll() {
  autoScrollSpeed = 0;

  if (autoScrollAnimationId) {
    cancelAnimationFrame(autoScrollAnimationId);
    autoScrollAnimationId = null;
  }
}

function startReorderAutoScrollLoop() {
  if (autoScrollAnimationId) return;

  function loop() {
    if (!isReorderMode || !draggedGoalId || autoScrollSpeed === 0) {
      autoScrollAnimationId = null;
      return;
    }

    const scrollContainer = getReorderScrollContainer();

    scrollContainer.scrollTop += autoScrollSpeed;
    moveDraggedGoalAtY(lastPointerY);
    updateDragGhostPosition();

    autoScrollAnimationId = requestAnimationFrame(loop);
  }

  autoScrollAnimationId = requestAnimationFrame(loop);
}

function updateReorderAutoScroll(clientY) {
  if (!isReorderMode || !draggedGoalId) {
    stopReorderAutoScroll();
    return;
  }

  const edgeSize = 95;
  const maxSpeed = 18;
  const viewportHeight = window.innerHeight;

  if (clientY < edgeSize) {
    autoScrollSpeed = -Math.ceil(((edgeSize - clientY) / edgeSize) * maxSpeed);
    startReorderAutoScrollLoop();
    return;
  }

  if (clientY > viewportHeight - edgeSize) {
    autoScrollSpeed = Math.ceil(((clientY - (viewportHeight - edgeSize)) / edgeSize) * maxSpeed);
    startReorderAutoScrollLoop();
    return;
  }

  stopReorderAutoScroll();
}

function forceEndDragOnRelease() {
  if (isReorderMode) {
    endSingleGoalDrag();
  }
}

function addForceReleaseListeners() {
  window.addEventListener("touchend", forceEndDragOnRelease, true);
  window.addEventListener("touchcancel", forceEndDragOnRelease, true);
  window.addEventListener("pointerup", forceEndDragOnRelease, true);
  window.addEventListener("pointercancel", forceEndDragOnRelease, true);
  window.addEventListener("mouseup", forceEndDragOnRelease, true);
}

function removeForceReleaseListeners() {
  window.removeEventListener("touchend", forceEndDragOnRelease, true);
  window.removeEventListener("touchcancel", forceEndDragOnRelease, true);
  window.removeEventListener("pointerup", forceEndDragOnRelease, true);
  window.removeEventListener("pointercancel", forceEndDragOnRelease, true);
  window.removeEventListener("mouseup", forceEndDragOnRelease, true);
}

function beginSingleGoalDrag(goalId) {
  if (!dragState || dragState.goalId !== goalId) return;

  const sourceCard = getGoalCardElement(goalId);
  if (!sourceCard) return;

  isReorderMode = true;
  draggedGoalId = goalId;
  dragState.isDragging = true;

  suppressClickUntil = Date.now() + 1000;

  document.body.classList.add("is-reordering");
  addForceReleaseListeners();

  createDragGhost(goalId);

  sourceCard.classList.add("reorder-card");
  sourceCard.classList.add("dragging-card");

  if (navigator.vibrate) {
    navigator.vibrate(18);
  }
}

function endSingleGoalDrag() {
  clearTimeout(longPressTimer);
  removeForceReleaseListeners();

  const wasDragging = isReorderMode;

  removeDragGhost();
  stopReorderAutoScroll();

  isReorderMode = false;
  draggedGoalId = null;
  dragState = null;

  document.body.classList.remove("is-reordering");

  document.removeEventListener("touchmove", handleTouchMove);
  document.removeEventListener("touchend", handleTouchEnd);
  document.removeEventListener("touchcancel", handleTouchCancel);

  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerEnd);
  document.removeEventListener("pointercancel", handlePointerCancel);

  if (wasDragging) {
    suppressClickUntil = Date.now() + 800;
    renderHome();
  }
}

function getActiveTouch(event) {
  if (!dragState) return null;

  for (const touch of event.touches) {
    if (touch.identifier === dragState.identifier) {
      return touch;
    }
  }

  return null;
}

function cancelPendingDragIfMoved(movedX, movedY) {
  if (!dragState || dragState.isDragging) return;

  if (movedX > 16 || movedY > 16) {
    clearTimeout(longPressTimer);
  }
}

function handleTouchMove(event) {
  if (!dragState) return;

  const touch = getActiveTouch(event);
  if (!touch) return;

  const movedX = Math.abs(touch.clientX - dragState.startX);
  const movedY = Math.abs(touch.clientY - dragState.startY);

  dragState.x = touch.clientX;
  dragState.y = touch.clientY;

  lastPointerX = touch.clientX;
  lastPointerY = touch.clientY;

  cancelPendingDragIfMoved(movedX, movedY);

  if (!dragState.isDragging) return;

  event.preventDefault();

  updateDragGhostPosition();
  moveDraggedGoalAtY(touch.clientY);
  updateReorderAutoScroll(touch.clientY);
}

function handleTouchEnd() {
  endSingleGoalDrag();
}

function handleTouchCancel() {
  if (isReorderMode) {
    endSingleGoalDrag();
    return;
  }

  clearTimeout(longPressTimer);
  dragState = null;

  document.removeEventListener("touchmove", handleTouchMove);
  document.removeEventListener("touchend", handleTouchEnd);
  document.removeEventListener("touchcancel", handleTouchCancel);
}

function handlePointerMove(event) {
  if (!dragState) return;

  const movedX = Math.abs(event.clientX - dragState.startX);
  const movedY = Math.abs(event.clientY - dragState.startY);

  dragState.x = event.clientX;
  dragState.y = event.clientY;

  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  cancelPendingDragIfMoved(movedX, movedY);

  if (!dragState.isDragging) return;

  event.preventDefault();

  updateDragGhostPosition();
  moveDraggedGoalAtY(event.clientY);
  updateReorderAutoScroll(event.clientY);
}

function handlePointerEnd() {
  endSingleGoalDrag();
}

function handlePointerCancel() {
  if (isReorderMode) {
    endSingleGoalDrag();
    return;
  }

  clearTimeout(longPressTimer);
  dragState = null;

  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerEnd);
  document.removeEventListener("pointercancel", handlePointerCancel);
}

function setupCardReorderHandlers(card, goal) {
  card.addEventListener("touchstart", function(event) {
    if (event.target.closest(".home-goal-action")) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];

    dragState = {
      goalId: goal.id,
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      x: touch.clientX,
      y: touch.clientY,
      offsetX: 0,
      offsetY: 0,
      ghost: null,
      isDragging: false
    };

    lastPointerX = touch.clientX;
    lastPointerY = touch.clientY;

    clearTimeout(longPressTimer);

    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("touchcancel", handleTouchCancel);

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchCancel);

    longPressTimer = setTimeout(function() {
      beginSingleGoalDrag(goal.id);
    }, 520);
  }, { passive: true });

  card.addEventListener("pointerdown", function(event) {
    if (event.target.closest(".home-goal-action")) return;
    if (event.pointerType === "touch") return;
    if (event.button && event.button !== 0) return;

    dragState = {
      goalId: goal.id,
      identifier: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      offsetX: 0,
      offsetY: 0,
      ghost: null,
      isDragging: false
    };

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    clearTimeout(longPressTimer);

    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerEnd);
    document.removeEventListener("pointercancel", handlePointerCancel);

    document.addEventListener("pointermove", handlePointerMove, { passive: false });
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerCancel);

    longPressTimer = setTimeout(function() {
      beginSingleGoalDrag(goal.id);
    }, 520);
  });
}

function openMenu() {
  if (isReorderMode) {
    endSingleGoalDrag();
    return;
  }

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
    if (goal) applyBackground(getTodayProgress(goal));
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
  if (isReorderMode) {
    endSingleGoalDrag();
    return;
  }

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
  goalsGrid.classList.remove("reorder-mode");

  goals.forEach(function(goal) {
    const value = getTodayValue(goal);
    const todayProgress = getTodayProgress(goal);

    const card = document.createElement("article");
    card.className = "goal-card";
    card.dataset.goalId = goal.id;

    if (isReorderMode && draggedGoalId === goal.id) {
      card.classList.add("reorder-card");
      card.classList.add("dragging-card");
    }

    if (goal.type === "yesno" && value >= 1) {
      card.classList.add("home-goal-complete");
    }

    if (goal.type === "counter") {
      card.classList.add("home-counter-card");
      card.style.setProperty("--water-level", `${todayProgress}%`);

      if (todayProgress >= 100) {
        card.classList.add("home-counter-complete");
      }
    }

    const actionSymbol = goal.type === "yesno" ? "✓" : "+";
    const actionClass = goal.type === "yesno" ? "home-goal-check" : "home-goal-plus";
    const waterHtml = goal.type === "counter" ? `<div class="home-water-fill"></div>` : "";

    card.innerHTML = `
      ${waterHtml}

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

      if (Date.now() < suppressClickUntil) return;
      if (isReorderMode) return;

      if (goal.type === "yesno") {
        setTodayValue(goal.id, value >= 1 ? 0 : 1);
      } else {
        setTodayValue(goal.id, Math.min(goal.target, value + 1));
      }

      renderHome();
      applyGeneralBackground();
    });

    card.addEventListener("click", function() {
      if (Date.now() < suppressClickUntil) return;
      if (isReorderMode) return;

      openGoal(goal.id);
    });

    setupCardReorderHandlers(card, goal);

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
  const progress = getTodayProgress(goal);

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
      setTodayValue(goal.id, Math.min(goal.target, value + 1));
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
  applyBackground(getTodayProgress(goal));

  if ($("editGoalNameInput")) $("editGoalNameInput").value = goal.title;
  if ($("editGoalDescriptionInput")) $("editGoalDescriptionInput").value = goal.description || "";

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

  applyBackground(getTodayProgress(goal));
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

  renderGoalInfoStreaks(goal);

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
  updateAppBadge();
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
  const typeInput = $("goalTypeInput");
  const typeButton = $("goalTypeButton");
  const targetInput = $("goalTargetInput");

  if (!titleInput || !descriptionInput || !typeInput || !targetInput) return;

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
    importance: 3,
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

  const currentGoal = getCurrentGoal();
  if (!currentGoal) return;

  const titleInput = $("editGoalNameInput");
  const descriptionInput = $("editGoalDescriptionInput");
  const typeInput = $("editGoalTypeInput");
  const typeButton = $("editGoalTypeButton");
  const targetInput = $("editGoalTargetInput");

  if (!titleInput || !descriptionInput || !typeInput || !targetInput) return;

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
      description: description,
      importance: currentGoal.importance || 3
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

  if (isReorderMode) {
    endSingleGoalDrag();
    return;
  }

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

  hideImportanceFields();
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
