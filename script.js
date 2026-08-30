const STORAGE_KEY = "levelup_goals";
const PLAYER_NAME_KEY = "levelup_player_name";
const DEVICE_ID_KEY = "levelup_device_id";
const USER_BEST_SCORE_KEY = "levelup_user_best_streak";
const DEFAULT_ACTIVE_DAYS = [0, 1, 2, 3, 4, 5, 6];

const SUPABASE_URL = "https://gkkdwwprhfsgtzjpnwaj.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_zgmgY6On7ttFUxsuXWrEKA_zTYwJmim";
const PUBLIC_VAPID_KEY = "BNhfN178NyuXgl92H2dc84zEmJy9AFERx6CmcAschHWrcLcCPLPsrahC0OI2fD4jDbLXSKyIuhmH1fg3yPEFJa0";

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
let autoScrollDirection = 0;
let lastAutoScrollStepTime = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let suppressClickUntil = 0;
const limitFlashTimes = new WeakMap();
const COUNTER_EMOJI_BAG_KEY = "levelup_counter_emoji_bag";
const COUNTER_EMOJI_INDEX_KEY = "levelup_counter_emoji_index";

const COUNTER_EMOJI_POOL = [
  "🔥", "✨", "⭐", "🌟", "💫", "⚡", "🚀", "🏆", "💎", "🎯",
  "🥇", "🎉", "☄️", "🌋", "👑", "🛡️", "🐉", "🦅", "🦁", "🐺",
  "🐯", "🦊", "🐻", "🐼", "🐵", "🦄", "🐲", "🦖", "🦕", "🦋",
  "🌈", "☀️", "🌙", "🌍", "🪐", "🌌", "🌠", "💥", "💨", "🌪️",
  "🌊", "❄️", "🍀", "🌿", "🌱", "🌴", "🌵", "🌸", "🌺", "🌻",
  "🍎", "🍊", "🍋", "🍉", "🍓", "🍒", "🥝", "🍍", "🥥", "🍇",
  "🍕", "🍔", "🍟", "🌮", "🍣", "🍪", "🍩", "🍫", "🍿", "🥤",
  "⚽", "🏀", "🏈", "🎾", "🏐", "🏓", "🥊", "🏋️", "🚴", "🏄",
  "🎮", "🎲", "🎸", "🎧", "🎬", "📚", "🧠", "💡", "🔋", "🧲",
  "🧨", "🔮", "🪄", "🪙", "💰", "🎁", "🔔", "📣", "🧡", "💜"
];
let isAdminUnlocked = false;
let lastChallengeActionElement = null;
let lastChallengeActionTime = 0;
let dayCompleteAnimationRunning = false;
let quickSwipeStartX = 0;
let quickSwipeStartY = 0;
let quickSwipeStartTime = 0;
let quickSwipeTracking = false;
let preloadedDayCompleteDragonVideo = null;
let dayCompleteDragonVideoReady = false;

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

function normalizeActiveDays(activeDays) {
  if (!Array.isArray(activeDays)) return [...DEFAULT_ACTIVE_DAYS];

  const cleanDays = activeDays
    .map(function(day) {
      return Number(day);
    })
    .filter(function(day) {
      return Number.isInteger(day) && day >= 0 && day <= 6;
    });

  const uniqueDays = Array.from(new Set(cleanDays)).sort(function(a, b) {
    return a - b;
  });

  return uniqueDays.length > 0 ? uniqueDays : [...DEFAULT_ACTIVE_DAYS];
}

function isGoalRequiredOnDate(goal, dateKey) {
  const activeDays = normalizeActiveDays(goal.activeDays);
  const date = parseDateKey(dateKey);

  return activeDays.includes(date.getDay());
}

function isGoalRequiredToday(goal) {
  return isGoalRequiredOnDate(goal, getTodayKey());
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

  if (!cleanText) return "";

  return escapeHtml(cleanText);
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
    activeDays: normalizeActiveDays(goal.activeDays),
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
      activeDays: [...DEFAULT_ACTIVE_DAYS],
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
      activeDays: [...DEFAULT_ACTIVE_DAYS],
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
      activeDays: [...DEFAULT_ACTIVE_DAYS],
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
  if (!isGoalRequiredToday(goal)) {
    return Number(goal.target);
  }

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
  if (compareDateKeys(dateKey, goal.createdAt || getTodayKey()) < 0) {
    return false;
  }

  if (!isGoalRequiredOnDate(goal, dateKey)) {
    return true;
  }

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

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function savePushSubscription(subscription) {
  const payload = {
    device_id: getDeviceId(),
    player_name: getPlayerName() || "משתמש",
    subscription_json: subscription.toJSON(),
    enabled: true,
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString()
  };

  const response = await fetch(`${SUPABASE_URL}/levelup_push_subscriptions?on_conflict=device_id`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase save failed: ${response.status} ${errorText}`);
  }
}

async function enablePushNotifications() {
  let step = "התחלה";

  try {
    closeMenu();

    step = "בדיקת Service Worker";
    if (!("serviceWorker" in navigator)) {
      alert("הדפדפן הזה לא תומך בהתראות דרך Service Worker");
      return;
    }

    step = "בדיקת Notification";
    if (!("Notification" in window)) {
      alert("הדפדפן הזה לא תומך בהתראות");
      return;
    }

    step = "בדיקת PushManager";
    if (!("PushManager" in window)) {
      alert("המכשיר או הדפדפן לא תומכים ב-Push notifications");
      return;
    }

    step = "בדיקת הרשאה";
    if (Notification.permission === "denied") {
      alert("ההתראות חסומות. צריך לאפשר אותן בהגדרות הדפדפן/האפליקציה.");
      return;
    }

    step = "בקשת הרשאה";
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") {
      alert("לא אושרו התראות");
      return;
    }

    step = "המתנה ל-Service Worker";
    const registration = await navigator.serviceWorker.ready;

    step = "בדיקת subscription קיים";
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      step = "יצירת subscription חדש";

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });
    }

    step = "שמירה ב-Supabase";
    await savePushSubscription(subscription);

    alert("ההתראות הופעלו בהצלחה");
  } catch (error) {
    console.log("שגיאה בהפעלת התראות:", {
      step: step,
      error: error
    });

    alert("לא הצלחנו להפעיל התראות כרגע. נסה שוב מאוחר יותר או בדוק שההתראות מאושרות בהגדרות.");
  }
}

async function syncPushPlayerName() {
  const name = getPlayerName();
  if (!name) return;

  try {
    await fetch(`${SUPABASE_URL}/levelup_push_subscriptions?device_id=eq.${encodeURIComponent(getDeviceId())}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        player_name: name,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.log("שגיאה בעדכון שם בטבלת Push:", error);
  }
}

function prepareRenameForm() {
  const renameInput = $("renameNameInput");
  if (!renameInput) return;

  renameInput.value = getPlayerName();
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
    "tone-100",
    "tone-not-required"
  );

  document.body.classList.add(getToneClass(progress));
}

function applyNotRequiredBackground() {
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

  document.body.classList.add("tone-not-required");
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

function shuffleArray(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    const temporary = shuffled[i];

    shuffled[i] = shuffled[randomIndex];
    shuffled[randomIndex] = temporary;
  }

  return shuffled;
}

function createNewCounterEmojiBag() {
  const newBag = shuffleArray(COUNTER_EMOJI_POOL);

  localStorage.setItem(COUNTER_EMOJI_BAG_KEY, JSON.stringify(newBag));
  localStorage.setItem(COUNTER_EMOJI_INDEX_KEY, "0");

  return newBag;
}

function getCounterEmojiBag() {
  try {
    const savedBag = JSON.parse(localStorage.getItem(COUNTER_EMOJI_BAG_KEY) || "[]");

    if (Array.isArray(savedBag) && savedBag.length === COUNTER_EMOJI_POOL.length) {
      return savedBag;
    }
  } catch (error) {}

  return createNewCounterEmojiBag();
}

function getNextCounterEmoji() {
  let bag = getCounterEmojiBag();
  let index = Number(localStorage.getItem(COUNTER_EMOJI_INDEX_KEY) || 0);

  if (!Number.isInteger(index) || index < 0) {
    index = 0;
  }

  if (index >= bag.length) {
    bag = createNewCounterEmojiBag();
    index = 0;
  }

  const emoji = bag[index];

  localStorage.setItem(COUNTER_EMOJI_INDEX_KEY, String(index + 1));

  return emoji;
}

function popCounterScore() {
  const score = document.querySelector(".goal-counter-score");
  if (!score) return;

  score.classList.remove("counter-score-pop");
  void score.offsetWidth;
  score.classList.add("counter-score-pop");
}

function launchCounterPlusEffect(sourceElement, newValue) {
  if (!sourceElement) return;

  const rect = sourceElement.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const emoji = getNextCounterEmoji();
  const emojiCount = Math.min(15, Math.max(1, Number(newValue) || 1));

  const burst = document.createElement("div");
  burst.className = "counter-plus-burst";
  burst.style.left = `${originX}px`;
  burst.style.top = `${originY}px`;

  const plusOne = document.createElement("span");
  plusOne.className = "counter-plus-one";
  plusOne.textContent = "+1";
  burst.appendChild(plusOne);

  for (let i = 0; i < emojiCount; i++) {
    const floatingEmoji = document.createElement("span");
    floatingEmoji.className = "counter-floating-emoji";
    floatingEmoji.textContent = emoji;

    const sideMovement = 60 + Math.random() * 340;
    const travelUp = Math.max(260, originY - 24) + Math.random() * 110;
    const rotation = Math.random() * 100 - 50;
    const delay = Math.random() * 0.22;
    const size = 34 + Math.random() * 22;

    floatingEmoji.style.setProperty("--emoji-x", `${sideMovement}px`);
    floatingEmoji.style.setProperty("--emoji-y", `${-travelUp}px`);
    floatingEmoji.style.setProperty("--emoji-rotate", `${rotation}deg`);
    floatingEmoji.style.setProperty("--emoji-delay", `${delay}s`);
    floatingEmoji.style.setProperty("--emoji-size", `${size}px`);

    burst.appendChild(floatingEmoji);
  }

  document.body.appendChild(burst);

  window.setTimeout(function() {
    burst.remove();
  }, 1900);
}

function rememberChallengeActionElement(event) {
  const button = event.target.closest("button");

  if (!button) return;

  lastChallengeActionElement = button;
  lastChallengeActionTime = Date.now();
}

function getRecentChallengeActionElement() {
  if (!lastChallengeActionElement) return null;

  if (Date.now() - lastChallengeActionTime > 1200) {
    return null;
  }

  return lastChallengeActionElement;
}

function isGoalCompletedByValue(goal, value) {
  if (!goal) return false;

  const numericValue = Number(value) || 0;

  if (goal.type === "counter") {
    return numericValue >= Number(goal.target || 1);
  }

  return numericValue >= 1;
}

function shouldPlayChallengeCompleteEffect(goal, oldValue, newValue) {
  if (!goal) return false;

  if (!isGoalRequiredToday(goal)) {
    return false;
  }

  return !isGoalCompletedByValue(goal, oldValue) && isGoalCompletedByValue(goal, newValue);
}

function launchChallengeCompleteEffect(sourceElement) {
  if (!sourceElement) return;

  const anchor =
    sourceElement.closest(".goal-card") ||
    sourceElement.closest(".goal-detail-card") ||
    sourceElement.closest(".detail-card") ||
    sourceElement.closest(".form-card") ||
    sourceElement;

  const rect = anchor.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  anchor.classList.remove("challenge-complete-card-flash");
  void anchor.offsetWidth;
  anchor.classList.add("challenge-complete-card-flash");

  window.setTimeout(function() {
    anchor.classList.remove("challenge-complete-card-flash");
  }, 1200);

  const burst = document.createElement("div");
  burst.className = "challenge-complete-burst";
  burst.style.left = `${centerX}px`;
  burst.style.top = `${centerY}px`;
  burst.style.width = `${Math.max(160, rect.width)}px`;
  burst.style.height = `${Math.max(120, rect.height)}px`;

  const aura = document.createElement("div");
  aura.className = "challenge-complete-aura";
  burst.appendChild(aura);

  const shockwave = document.createElement("div");
  shockwave.className = "challenge-complete-shockwave";
  burst.appendChild(shockwave);

  const check = document.createElement("div");
  check.className = "challenge-complete-check";
  check.textContent = "✓";
  burst.appendChild(check);

  for (let i = 0; i < 32; i++) {
    const particle = document.createElement("span");
    particle.className = "challenge-complete-particle";

    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 155;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const size = 5 + Math.random() * 10;
    const delay = Math.random() * 0.16;
    const rotation = Math.random() * 220 - 110;

    particle.style.setProperty("--particle-x", `${x}px`);
    particle.style.setProperty("--particle-y", `${y}px`);
    particle.style.setProperty("--particle-size", `${size}px`);
    particle.style.setProperty("--particle-delay", `${delay}s`);
    particle.style.setProperty("--particle-rotate", `${rotation}deg`);

    burst.appendChild(particle);
  }

  document.body.appendChild(burst);

  window.setTimeout(function() {
    burst.remove();
  }, 1700);
}

function flashElement(element) {
  if (!element) return;

  element.classList.remove("field-error-flash");
  void element.offsetWidth;
  element.classList.add("field-error-flash");
}

function ensureDayCompleteOverlay() {
  let overlay = $("dayCompleteOverlay");

  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "dayCompleteOverlay";
  overlay.className = "day-complete-overlay";

  document.body.appendChild(overlay);

  return overlay;
}

function scheduleDayCompleteAnimation(delay) {
  if (dayCompleteAnimationRunning) return;

  dayCompleteAnimationRunning = true;

  window.setTimeout(function() {
    launchDayCompleteAnimation();
  }, delay);
}

function getDayCompleteMeterData() {
  const currentScore = Math.max(0, getUserCurrentScore());
  const bestScore = Math.max(1, getUserBestScore(), currentScore);
  const previousScore = Math.max(0, currentScore - 1);

  return {
    previousScore: previousScore,
    currentScore: currentScore,
    bestScore: bestScore,
    previousPercent: Math.min(100, Math.round((previousScore / bestScore) * 100)),
    currentPercent: Math.min(100, Math.round((currentScore / bestScore) * 100))
  };
}

function showDayCompleteMeter(overlay, instant = false) {
  if (!overlay) return;

  const data = getDayCompleteMeterData();

  overlay.classList.remove("show-dragon-video");
  overlay.classList.add("active");
  overlay.classList.add("black");
  overlay.classList.add("show-meter");

  overlay.innerHTML = `
    <div class="day-streak-meter-stage">
      <div class="day-streak-best-label">שיא ${data.bestScore}</div>

      <div class="day-streak-meter-shell">
        <div class="day-streak-meter-fill" id="dayStreakMeterFill"></div>
      </div>

      <div class="day-streak-current-number">${data.currentScore}</div>
    </div>
  `;

  const fill = $("dayStreakMeterFill");
  if (!fill) return;

  if (instant) {
    fill.style.transition = "none";
    fill.style.height = `${data.currentPercent}%`;

    window.requestAnimationFrame(function() {
      fill.style.transition = "";
    });

    return;
  }

  fill.style.height = `${data.previousPercent}%`;

  window.requestAnimationFrame(function() {
    window.requestAnimationFrame(function() {
      fill.style.height = `${data.currentPercent}%`;
    });
  });
}

function preloadDayCompleteDragonVideo() {
  if (preloadedDayCompleteDragonVideo) {
    return preloadedDayCompleteDragonVideo;
  }

  const video = document.createElement("video");

  video.src = "day-complete-dragon.mp4";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  video.style.position = "fixed";
  video.style.left = "-9999px";
  video.style.top = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";

  video.addEventListener("loadeddata", function() {
    dayCompleteDragonVideoReady = true;
  }, { once: true });

  video.addEventListener("canplay", function() {
    dayCompleteDragonVideoReady = true;
  }, { once: true });

  document.body.appendChild(video);

  try {
    video.load();
  } catch (error) {}

  preloadedDayCompleteDragonVideo = video;

  return video;
}

function playDayCompleteDragonVideo(overlay, onFinished) {
  if (!overlay) {
    onFinished();
    return;
  }

  const video = preloadDayCompleteDragonVideo();

  overlay.classList.remove("show-meter", "black", "show-dragon-video");
  overlay.innerHTML = "";

  let finished = false;
  let started = false;

  function finishVideo() {
    if (finished) return;

    finished = true;

    try {
      video.pause();
    } catch (error) {}

    overlay.classList.remove("show-dragon-video");
    overlay.innerHTML = "";
    overlay.classList.add("active");
    overlay.classList.add("black");

    window.setTimeout(function() {
      onFinished();
    }, 180);
  }

  function startVideo() {
    if (started || finished) return;

    started = true;

    try {
      video.pause();
      video.currentTime = 0;
    } catch (error) {}

    video.className = "day-complete-dragon-video";
    video.removeAttribute("style");

    overlay.innerHTML = "";
    overlay.appendChild(video);

    overlay.classList.add("active");
    overlay.classList.add("show-dragon-video");

    video.addEventListener("ended", finishVideo, { once: true });
    video.addEventListener("error", finishVideo, { once: true });

    const playPromise = video.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(function() {
        finishVideo();
      });
    }

    window.setTimeout(function() {
      finishVideo();
    }, 8000);
  }

  if (dayCompleteDragonVideoReady || video.readyState >= 2) {
    startVideo();
    return;
  }

  video.addEventListener("loadeddata", startVideo, { once: true });
  video.addEventListener("canplay", startVideo, { once: true });

  window.setTimeout(function() {
    if (!started) {
      startVideo();
    }
  }, 900);
}

function launchDayCompleteAnimation() {
  showScreen("homeScreen", false);

  window.requestAnimationFrame(function() {
    const homeElements = Array.from(
      document.querySelectorAll("#homeScreen .home-header, #goalsGrid .goal-card, #openMenuButton")
    );

    const shuffledElements = shuffleArray(homeElements);
    const overlay = ensureDayCompleteOverlay();
    const timers = [];

    let skippedToFinalMeter = false;

    function addTimer(callback, delay) {
      const timerId = window.setTimeout(callback, delay);
      timers.push(timerId);
      return timerId;
    }

    function clearTimers() {
      timers.forEach(function(timerId) {
        clearTimeout(timerId);
      });

      timers.length = 0;
    }

    function cleanVanishedElements() {
      document.querySelectorAll(".day-complete-vanish").forEach(function(element) {
        element.classList.remove("day-complete-vanish");
        element.style.removeProperty("--day-complete-x");
        element.style.removeProperty("--day-complete-y");
        element.style.removeProperty("--day-complete-rotate");
      });
    }

    function finishDayCompleteAnimation() {
      clearTimers();

      overlay.removeEventListener("click", skipToFinalMeter);
      overlay.removeEventListener("click", finishDayCompleteAnimation);

      overlay.style.pointerEvents = "";
      overlay.classList.remove("active", "black", "flicker", "show-meter", "show-dragon-video");
      overlay.innerHTML = "";

      cleanVanishedElements();

      dayCompleteAnimationRunning = false;
      renderHome();
      applyGeneralBackground();
    }

    function switchClickToFinishMode() {
      overlay.removeEventListener("click", skipToFinalMeter);
      overlay.addEventListener("click", finishDayCompleteAnimation);
    }

    function showFinalMeterInstantly() {
      showDayCompleteMeter(overlay, true);
      switchClickToFinishMode();

      addTimer(function() {
        finishDayCompleteAnimation();
      }, 3000);
    }

    function skipToFinalMeter() {
      if (skippedToFinalMeter) return;

      skippedToFinalMeter = true;
      clearTimers();

      const video = $("dayCompleteDragonVideo");

      if (video) {
        try {
          video.pause();
        } catch (error) {}
      }

      cleanVanishedElements();
      showFinalMeterInstantly();
    }

    overlay.innerHTML = "";
    overlay.classList.remove("show-meter", "show-dragon-video", "black", "flicker");
    overlay.classList.add("active");
    overlay.style.pointerEvents = "auto";

    overlay.removeEventListener("click", finishDayCompleteAnimation);
    overlay.addEventListener("click", skipToFinalMeter);

    shuffledElements.forEach(function(element, index) {
      const x = Math.random() * 220 - 110;
      const y = Math.random() * 180 - 90;
      const rotate = Math.random() * 34 - 17;
      const delay = index * 95 + Math.random() * 130;

      element.style.setProperty("--day-complete-x", `${x}px`);
      element.style.setProperty("--day-complete-y", `${y}px`);
      element.style.setProperty("--day-complete-rotate", `${rotate}deg`);

      addTimer(function() {
        element.classList.add("day-complete-vanish");
      }, delay);
    });

    const vanishTime = 780 + shuffledElements.length * 95;

    addTimer(function() {
      if (skippedToFinalMeter) return;

      playDayCompleteDragonVideo(overlay, function() {
        if (skippedToFinalMeter) return;

        showDayCompleteMeter(overlay, false);
        switchClickToFinishMode();

        addTimer(function() {
          finishDayCompleteAnimation();
        }, 4300);
      });
    }, vanishTime);
  });
}

function flashLimitElement(input) {
  if (!input) return;

  const now = Date.now();
  const lastFlash = limitFlashTimes.get(input) || 0;

  if (now - lastFlash < 650) return;

  limitFlashTimes.set(input, now);
  flashElement(input);
}

function flashInputLimit(input) {
  if (!input) return;

  const maxLength = Number(input.getAttribute("maxlength") || 0);

  if (maxLength > 0 && input.value.length >= maxLength) {
    flashLimitElement(input);
  }
}

function handleTextLimitBeforeInput(event) {
  const input = event.target;
  if (!input) return;

  const maxLength = Number(input.getAttribute("maxlength") || 0);
  if (!maxLength || maxLength <= 0) return;

  const inputType = event.inputType || "";

  if (
    inputType.startsWith("delete") ||
    inputType === "historyUndo" ||
    inputType === "historyRedo"
  ) {
    return;
  }

  const insertedText = typeof event.data === "string" ? event.data : "";

  if (!insertedText) return;

  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? input.value.length;
  const selectedLength = Math.max(0, selectionEnd - selectionStart);

  const currentLengthAfterSelectionRemoval = input.value.length - selectedLength;

  if (currentLengthAfterSelectionRemoval + insertedText.length > maxLength) {
    event.preventDefault();
    flashLimitElement(input);
  }
}

function enforceTextInputLimit(input) {
  if (!input) return;

  const maxLength = Number(input.getAttribute("maxlength") || 0);
  if (!maxLength || maxLength <= 0) return;

  if (input.value.length > maxLength) {
    input.value = input.value.slice(0, maxLength);
    flashLimitElement(input);
    return;
  }

  if (input.value.length === maxLength) {
    flashLimitElement(input);
  }
}

function setupLimitedTextInput(id) {
  const input = $(id);
  if (!input) return;

  input.addEventListener("beforeinput", handleTextLimitBeforeInput);

  input.addEventListener("input", function(event) {
    enforceTextInputLimit(event.target);
  });

  input.addEventListener("paste", function() {
    setTimeout(function() {
      enforceTextInputLimit(input);
    }, 0);
  });
}

function initializeTextLimits() {
  [
    "goalNameInput",
    "goalDescriptionInput",
    "editGoalNameInput",
    "editGoalDescriptionInput",
    "playerNameInput",
    "renameNameInput",
    "adminPasswordInput",
    "newAdminPasswordInput"
  ].forEach(setupLimitedTextInput);
}

function animateIntroNumber(targetNumber) {
  const numberElement = $("introStreakNumber");
  if (!numberElement) return;

  const target = Math.max(0, Number(targetNumber) || 0);
  const duration = 850;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(target * easedProgress);

    numberElement.textContent = String(currentValue);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function initializeIntroSequence() {
  const overlay = $("introOverlay");
  const video = $("introVideo");

  if (!overlay || !video) return;
  if (!getPlayerName()) return;

  let resultShown = false;
  let introCloseTimer = null;
  let introIsSeekingToFinalFrame = false;
  const streak = getUserCurrentScore();

  function scheduleIntroClose() {
  if (introCloseTimer) {
    clearTimeout(introCloseTimer);
  }

  introCloseTimer = window.setTimeout(function() {
    closeIntro();
  }, 2300);
}

function showResult() {
  if (resultShown) return;

  resultShown = true;
  overlay.classList.add("show-result");
  animateIntroNumber(streak);
  scheduleIntroClose();
}

function skipIntroToFinalState() {
  try {
    if (video.duration && !Number.isNaN(video.duration)) {
      const finalFrameTime = Math.max(0, video.duration - 0.08);

      introIsSeekingToFinalFrame = true;

      if (introCloseTimer) {
        clearTimeout(introCloseTimer);
        introCloseTimer = null;
      }

      overlay.classList.remove("show-result");
      video.pause();

      function revealAfterFinalFramePainted() {
        window.requestAnimationFrame(function() {
          window.requestAnimationFrame(function() {
            introIsSeekingToFinalFrame = false;
            showResult();
          });
        });
      }

      video.addEventListener("seeked", revealAfterFinalFramePainted, { once: true });
      video.currentTime = finalFrameTime;

      window.setTimeout(function() {
        if (!resultShown && introIsSeekingToFinalFrame) {
          revealAfterFinalFramePainted();
        }
      }, 700);

      return;
    }
  } catch (error) {}

  introIsSeekingToFinalFrame = false;
  showResult();
}

function closeIntro() {
  if (introCloseTimer) {
    clearTimeout(introCloseTimer);
    introCloseTimer = null;
  }

  overlay.classList.add("hidden");

  try {
    video.pause();
    video.currentTime = 0;
  } catch (error) {}
}
  overlay.classList.remove("hidden");
  overlay.classList.remove("show-result");

  video.currentTime = 0;

  const playPromise = video.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(function() {
      showResult();
    });
  }

    video.addEventListener("timeupdate", function() {
    if (!video.duration || Number.isNaN(video.duration)) return;

    if (!introIsSeekingToFinalFrame && video.duration - video.currentTime <= 2) {
      showResult();
    }
  });

video.addEventListener("ended", showResult, { once: true });

setTimeout(showResult, 4500);

  overlay.addEventListener("click", function() {
    if (resultShown) {
      closeIntro();
      return;
    }

    skipIntroToFinalState();
  }, { once: false });
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

function getSafeDragY(y) {
  const goalsGrid = $("goalsGrid");

  if (!goalsGrid) {
    const topLimit = 96;
    const bottomLimit = Math.max(topLimit + 30, window.innerHeight - 96);
    return clampNumber(y, topLimit, bottomLimit);
  }

  const rect = goalsGrid.getBoundingClientRect();
  const topLimit = rect.top + 8;
  const bottomLimit = rect.bottom - 8;

  return clampNumber(y, topLimit, bottomLimit);
}

function updateDragGhostPosition() {
  if (!dragState || !dragState.ghost) return;

  const visualY = getSafeDragY(dragState.y);

  dragState.ghost.style.left = `${dragState.x - dragState.offsetX}px`;
  dragState.ghost.style.top = `${visualY - dragState.offsetY}px`;
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

function scrollDraggedCardIntoView(direction) {
  const goalsGrid = $("goalsGrid");
  if (!goalsGrid) return;

  const scrollStep = 118;

  goalsGrid.scrollTop += direction > 0 ? scrollStep : -scrollStep;
}

function moveDraggedGoalByStep(direction) {
  if (!isReorderMode || !draggedGoalId || direction === 0) return false;

  const currentIndex = goals.findIndex(function(goal) {
    return goal.id === draggedGoalId;
  });

  if (currentIndex === -1) return false;

  const nextIndex = clampNumber(currentIndex + direction, 0, goals.length - 1);

  if (nextIndex === currentIndex) return false;

  const newGoals = [...goals];
  const draggedGoal = newGoals.splice(currentIndex, 1)[0];

  newGoals.splice(nextIndex, 0, draggedGoal);

  goals = newGoals;
  saveGoals(goals);

  reorderHomeDomToMatchGoals();
  scrollDraggedCardIntoView(direction);
  updateDragGhostPosition();

  return true;
}

function moveDraggedGoalAtY(clientY) {
  if (!isReorderMode || !draggedGoalId) return;

  const safeY = getSafeDragY(clientY);

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

    if (safeY < middleY) {
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
  autoScrollDirection = 0;
  lastAutoScrollStepTime = 0;

  if (autoScrollAnimationId) {
    cancelAnimationFrame(autoScrollAnimationId);
    autoScrollAnimationId = null;
  }
}

function startReorderAutoScrollLoop() {
  if (autoScrollAnimationId) return;

  function loop(time) {
    if (!isReorderMode || !draggedGoalId || autoScrollDirection === 0) {
      autoScrollAnimationId = null;
      return;
    }

    if (!lastAutoScrollStepTime || time - lastAutoScrollStepTime > 230) {
      const moved = moveDraggedGoalByStep(autoScrollDirection);
      lastAutoScrollStepTime = time;

      if (!moved) {
        stopReorderAutoScroll();
        return;
      }
    }

    autoScrollAnimationId = requestAnimationFrame(loop);
  }

  autoScrollAnimationId = requestAnimationFrame(loop);
}

function updateReorderAutoScroll(clientY) {
  if (!isReorderMode || !draggedGoalId) {
    stopReorderAutoScroll();
    return;
  }

  const goalsGrid = $("goalsGrid");

  if (!goalsGrid) {
    stopReorderAutoScroll();
    return;
  }

  const rect = goalsGrid.getBoundingClientRect();
  const edgeSize = 115;

  if (clientY < rect.top + edgeSize) {
    autoScrollDirection = -1;
    startReorderAutoScrollLoop();
    return;
  }

  if (clientY > rect.bottom - edgeSize) {
    autoScrollDirection = 1;
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

function updateBottomTabs() {
  const bar = $("bottomTabBar");
  const goalsTab = $("bottomGoalsTab");
  const scoresTab = $("bottomScoresTab");

  if (!bar || !goalsTab || !scoresTab) return;

  const shouldShow = currentScreenId === "homeScreen" || currentScreenId === "rankingScreen";

  bar.classList.toggle("visible", shouldShow);
  goalsTab.classList.toggle("active", currentScreenId === "homeScreen");
  scoresTab.classList.toggle("active", currentScreenId === "rankingScreen");
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
  updateBottomTabs();
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

  if (screenId === "addScreen" || screenId === "nameScreen" || screenId === "renameScreen" || screenId === "adminScreen") {
    currentGoalId = null;
    applyGeneralBackground();
  }

  if (screenId === "renameScreen") {
    prepareRenameForm();
  }

  if (screenId === "adminScreen") {
    prepareAdminScreen();
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

function isQuickRankingSwipeAllowed(event) {
  if (isReorderMode) return false;
  if (dayCompleteAnimationRunning) return false;
  if (isMenuOpen()) return false;
  if (isGoalOptionsOpen()) return false;
  if (isDeleteConfirmOpen()) return false;
  if (isDayDetailOpen()) return false;

  if (currentScreenId !== "homeScreen" && currentScreenId !== "rankingScreen") {
    return false;
  }

  const target = event.target;

  if (
    target.closest("button") ||
    target.closest("input") ||
    target.closest("textarea") ||
    target.closest("select") ||
    target.closest(".side-menu")
  ) {
    return false;
  }

  return true;
}

function handleQuickSwipeStart(event) {
  if (!event.touches || event.touches.length !== 1) return;
  if (!isQuickRankingSwipeAllowed(event)) return;

  const touch = event.touches[0];

  quickSwipeStartX = touch.clientX;
  quickSwipeStartY = touch.clientY;
  quickSwipeStartTime = Date.now();
  quickSwipeTracking = true;
}

function handleQuickSwipeEnd(event) {
  if (!quickSwipeTracking) return;
  if (!event.changedTouches || event.changedTouches.length !== 1) return;

  quickSwipeTracking = false;

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - quickSwipeStartX;
  const deltaY = touch.clientY - quickSwipeStartY;
  const elapsedTime = Date.now() - quickSwipeStartTime;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  const isFastEnough = elapsedTime <= 900;
  const isLongEnough = absX >= 90;
  const isHorizontalEnough = absX > absY * 1.7;

  if (!isFastEnough || !isLongEnough || !isHorizontalEnough) {
    return;
  }

  if (currentScreenId === "homeScreen" && deltaX < 0) {
    showScreen("rankingScreen");
    return;
  }

  if (currentScreenId === "rankingScreen" && deltaX > 0) {
    showScreen("homeScreen");
  }
}

function initializeQuickRankingSwipe() {
  document.addEventListener("touchstart", handleQuickSwipeStart, { passive: true });
  document.addEventListener("touchend", handleQuickSwipeEnd, { passive: true });
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
    const requiredToday = isGoalRequiredToday(goal);
    const card = document.createElement("article");
    card.className = "goal-card";
    card.dataset.goalId = goal.id;
    
    if (!requiredToday) {
      card.classList.add("home-goal-not-required");
    }
    
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
        card.classList.add("home-goal-complete");
      }
    }

    const counterReachedTarget = goal.type === "counter" && requiredToday && value >= goal.target;

    const actionSymbol = goal.type === "yesno" || counterReachedTarget ? "✓" : "+";
    const actionClass = goal.type === "yesno" || counterReachedTarget ? "home-goal-check" : "home-goal-plus";
    
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
    
    if (!requiredToday) {
      actionButton.disabled = true;
    }
    
    actionButton.addEventListener("click", function(event) {
      event.stopPropagation();

      if (Date.now() < suppressClickUntil) return;
      if (isReorderMode) return;
      if (!requiredToday) return;
      
      if (goal.type === "yesno") {
        setTodayValue(goal.id, value >= 1 ? 0 : 1);
      } else {
        if (value >= goal.target) {
          setTodayValue(goal.id, Math.max(0, value - 1));
        } else {
          const newValue = Math.min(goal.target, value + 1);

          if (newValue > value) {
            launchCounterPlusEffect(actionButton, newValue);
          }

          setTodayValue(goal.id, newValue);
        }
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
  const requiredToday = isGoalRequiredToday(goal);

  const descriptionText = goal.description
    ? `<p class="goal-description">${formatDescription(goal.description)}</p>`
    : "";

  if (requiredToday) {
    applyBackground(progress);
  } else {
    applyNotRequiredBackground();
  }

  let actionHtml = "";

  if (!requiredToday) {
    if (goal.type === "yesno") {
      actionHtml = `
        <section class="yesno-action-area">
          <button class="yesno-main-button yesno-disabled-button" disabled>✕</button>
        </section>
      `;
    } else {
      actionHtml = `
        <section class="counter-action-area">
          <button class="big-add-button disabled-goal-button" disabled>+</button>
          <button class="small-minus-button disabled-goal-button" disabled>−</button>
        </section>
      `;
    }
  } else if (goal.type === "yesno") {
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
    <div class="detail-card modern-goal-card ${requiredToday ? "" : "detail-not-required-today"}">
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

  if (!requiredToday) return;

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
      const increaseButton = $("increaseButton");
      const newValue = Math.min(goal.target, value + 1);

      if (newValue > value) {
        launchCounterPlusEffect(increaseButton, newValue);
      }

      setTodayValue(goal.id, newValue);
      openGoal(goal.id, false);

      window.requestAnimationFrame(popCounterScore);
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
  setSelectedDaysInPicker("editGoalSchedulePicker", goal.activeDays);
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
    const requiredOnDate = isGoalRequiredOnDate(goal, dateKey);

    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    if (!future && !requiredOnDate) {
      cell.classList.add("not-required-day");
    }
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

const originalSetTodayValue = setTodayValue;

setTodayValue = function(goalId, value) {
  const todayKey = getTodayKey();
  const wasDayCompleteBefore = isFullSuccessOnDate(todayKey);

  const goal = goals.find(function(item) {
    return item.id === goalId;
  });

  const oldValue = goal ? getTodayValue(goal) : 0;

  originalSetTodayValue(goalId, value);

  const isDayCompleteNow = isFullSuccessOnDate(todayKey);
  const sourceElement = getRecentChallengeActionElement();

  const shouldPlaySingleChallengeEffect =
    sourceElement && shouldPlayChallengeCompleteEffect(goal, oldValue, value);

  if (shouldPlaySingleChallengeEffect) {
    launchChallengeCompleteEffect(sourceElement);
  }

  if (!wasDayCompleteBefore && isDayCompleteNow) {
    scheduleDayCompleteAnimation(shouldPlaySingleChallengeEffect ? 750 : 350);
  }
};

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
async function fetchAdminPassword() {
  try {
    const response = await fetch(`${SUPABASE_URL}/levelup_admin_settings?id=eq.1&select=admin_password`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) throw new Error("Admin password fetch failed");

    const rows = await response.json();
    return rows[0] && rows[0].admin_password ? String(rows[0].admin_password) : "1234";
  } catch (error) {
    console.log("שגיאה בקריאת סיסמת מנהל:", error);
    return "1234";
  }
}

async function updateAdminPassword(newPassword) {
  const response = await fetch(`${SUPABASE_URL}/levelup_admin_settings?id=eq.1`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      admin_password: newPassword,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error("Admin password update failed");
  }
}

async function fetchAdminPlayers() {
  const response = await fetch(`${SUPABASE_URL}/levelup_players?select=device_id,name,current_score,best_score,updated_at&order=updated_at.desc`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error("Admin players fetch failed");
  }

  return await response.json();
}

async function updateAdminPlayerName(deviceId, newName) {
  const response = await fetch(`${SUPABASE_URL}/levelup_players?device_id=eq.${encodeURIComponent(deviceId)}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      name: newName,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    throw new Error("Player rename failed");
  }

  try {
    await fetch(`${SUPABASE_URL}/levelup_push_subscriptions?device_id=eq.${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        player_name: newName,
        updated_at: new Date().toISOString()
      })
    });
  } catch (error) {
    console.log("שם עודכן בדירוג, אבל לא בטבלת Push:", error);
  }

  if (deviceId === getDeviceId()) {
    savePlayerName(newName);
  }
}

async function deleteAdminPlayer(deviceId) {
  const response = await fetch(`${SUPABASE_URL}/levelup_players?device_id=eq.${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal"
    }
  });

  if (!response.ok) {
    throw new Error("Player delete failed");
  }
}

function setAdminPanelState(unlocked) {
  const loginBox = $("adminLoginBox");
  const adminPanel = $("adminPanel");

  if (loginBox) {
    loginBox.style.display = unlocked ? "none" : "block";
  }

  if (adminPanel) {
    adminPanel.style.display = unlocked ? "block" : "none";
  }
}

function prepareAdminScreen() {
  const passwordInput = $("adminPasswordInput");
  const newPasswordInput = $("newAdminPasswordInput");

  if (passwordInput) passwordInput.value = "";
  if (newPasswordInput) newPasswordInput.value = "";

  setAdminPanelState(isAdminUnlocked);

  if (isAdminUnlocked) {
    renderAdminUsers();
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();

  const passwordInput = $("adminPasswordInput");
  if (!passwordInput) return;

  const enteredPassword = passwordInput.value.trim();

  if (!enteredPassword) {
    flashElement(passwordInput);
    return;
  }

  const savedPassword = await fetchAdminPassword();

  if (enteredPassword !== savedPassword) {
    flashElement(passwordInput);
    alert("סיסמה שגויה");
    return;
  }

  isAdminUnlocked = true;
  prepareAdminScreen();
}

async function saveNewAdminPassword(event) {
  event.preventDefault();

  const passwordInput = $("newAdminPasswordInput");
  if (!passwordInput) return;

  const newPassword = passwordInput.value.trim();

  if (!newPassword) {
    flashElement(passwordInput);
    return;
  }

  try {
    await updateAdminPassword(newPassword);
    passwordInput.value = "";
    alert("הסיסמה עודכנה");
  } catch (error) {
    console.log("שגיאה בעדכון סיסמת מנהל:", error);
    alert("לא הצלחנו לעדכן סיסמה");
  }
}

async function renderAdminUsers() {
  const list = $("adminUsersList");
  if (!list) return;

  list.innerHTML = `<p class="admin-empty-text">טוען משתמשים...</p>`;

  try {
    const players = await fetchAdminPlayers();

    if (!players.length) {
      list.innerHTML = `<p class="admin-empty-text">אין משתמשים להצגה</p>`;
      return;
    }

    list.innerHTML = "";

    players.forEach(function(player) {
      const row = document.createElement("article");
      row.className = "admin-user-row";

      const isThisDevice = player.device_id === getDeviceId();

      row.innerHTML = `
        <div class="admin-user-info">
          <strong>${escapeHtml(player.name)}${isThisDevice ? " · המכשיר הזה" : ""}</strong>
          <span>נוכחי: ${Number(player.current_score || 0)} · שיא: ${Number(player.best_score || 0)}</span>
        </div>

        <div class="admin-user-actions">
          <button type="button" class="admin-rename-button">שם</button>
          <button type="button" class="admin-delete-button">מחק</button>
        </div>
      `;

      row.querySelector(".admin-rename-button").addEventListener("click", function() {
        renameAdminPlayer(player.device_id, player.name);
      });

      row.querySelector(".admin-delete-button").addEventListener("click", function() {
        deleteAdminPlayerFromList(player.device_id, player.name);
      });

      list.appendChild(row);
    });
  } catch (error) {
    console.log("שגיאה בטעינת משתמשים לניהול:", error);
    list.innerHTML = `<p class="admin-empty-text">לא הצלחנו לטעון משתמשים</p>`;
  }
}

async function renameAdminPlayer(deviceId, currentName) {
  const newName = prompt("שם חדש:", currentName || "");

  if (newName === null) return;

  const cleanName = newName.trim();

  if (!cleanName) {
    alert("שם לא יכול להיות ריק");
    return;
  }

  try {
    await updateAdminPlayerName(deviceId, cleanName);
    await renderAdminUsers();
    syncPlayer();

    if (currentScreenId === "rankingScreen") {
      renderRanking();
    }
  } catch (error) {
    console.log("שגיאה בשינוי שם משתמש:", error);
    alert("לא הצלחנו לשנות שם");
  }
}

async function deleteAdminPlayerFromList(deviceId, playerName) {
  const approved = confirm(`למחוק את ${playerName}?`);

  if (!approved) return;

  try {
    await deleteAdminPlayer(deviceId);
    await renderAdminUsers();
    syncPlayer();
  } catch (error) {
    console.log("שגיאה במחיקת משתמש:", error);
    alert("לא הצלחנו למחוק משתמש");
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
  setSelectedDaysInPicker("goalSchedulePicker", DEFAULT_ACTIVE_DAYS);
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

function getSelectedDaysFromPicker(pickerId) {
  const picker = $(pickerId);
  if (!picker) return [...DEFAULT_ACTIVE_DAYS];

  const selectedDays = Array.from(picker.querySelectorAll("button.active")).map(function(button) {
    return Number(button.dataset.day);
  });

  return normalizeActiveDays(selectedDays);
}

function setSelectedDaysInPicker(pickerId, activeDays) {
  const picker = $(pickerId);
  if (!picker) return;

  const cleanDays = normalizeActiveDays(activeDays);

  picker.querySelectorAll("button").forEach(function(button) {
    const day = Number(button.dataset.day);

    if (cleanDays.includes(day)) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

function initializeSchedulePickers() {
  ["goalSchedulePicker", "editGoalSchedulePicker"].forEach(function(pickerId) {
    const picker = $(pickerId);
    if (!picker) return;

    picker.querySelectorAll("button").forEach(function(button) {
      button.addEventListener("click", function() {
        const activeButtons = picker.querySelectorAll("button.active");

        if (button.classList.contains("active") && activeButtons.length <= 1) {
          flashElement(button);
          return;
        }

        button.classList.toggle("active");
      });
    });
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
    activeDays: getSelectedDaysFromPicker("goalSchedulePicker"),
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

async function saveRenamedPlayerName(event) {
  event.preventDefault();

  const nameInput = $("renameNameInput");
  if (!nameInput) return;

  const name = nameInput.value.trim();

  if (!name) {
    flashElement(nameInput);
    return;
  }

  savePlayerName(name);

  await syncPlayer();
  await syncPushPlayerName();

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
      importance: currentGoal.importance || 3,
      activeDays: getSelectedDaysFromPicker("editGoalSchedulePicker")
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
  document.addEventListener("click", rememberChallengeActionElement, true);
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
  preloadDayCompleteDragonVideo();
  initializeQuickRankingSwipe();
  
  if (!getPlayerName()) {
    showScreen("nameScreen", false);
  } else {
    renderHome();
    syncPlayer();
    initializeIntroSequence();
  }

  initializeGoalTypePickers();
  initializeSchedulePickers();
  initializeTextLimits();

  on("bottomGoalsTab", "click", function() {
    showScreen("homeScreen");
  });

  on("bottomScoresTab", "click", function() {
    showScreen("rankingScreen");
  });

  updateBottomTabs();
  
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

  on("openRenameFromMenu", "click", function() {
    openScreenFromMenu("renameScreen");
  });

  on("openAdminFromMenu", "click", function() {
    openScreenFromMenu("adminScreen");
  });
  
  on("enableNotificationsFromMenu", "click", enablePushNotifications);
  
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

  on("renameNameInput", "input", function(event) {
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
  on("renameForm", "submit", saveRenamedPlayerName);
  on("adminLoginForm", "submit", handleAdminLogin);
  on("adminPasswordForm", "submit", saveNewAdminPassword);
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
