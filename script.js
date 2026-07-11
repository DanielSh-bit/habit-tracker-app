const STORAGE_KEY = "levelup_goals";
const PLAYER_NAME_KEY = "levelup_player_name";
const DEVICE_ID_KEY = "levelup_device_id";
const USER_BEST_SCORE_KEY = "levelup_user_best_score";

const SUPABASE_URL = "https://gkkdwwprhfsgtzjpnwaj.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_zgmgY6On7ttFUxsuXWrEKA_zTYwJmim";

let currentScreenId = "homeScreen";
let currentGoalId = null;
let rankingSortMode = "current";

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function getDefaultGoals() {
  return [
    {
      id: "workout",
      title: "אימון",
      type: "yesno",
      target: 1,
      records: {}
    },
    {
      id: "water",
      title: "מים",
      type: "counter",
      target: 8,
      records: {}
    },
    {
      id: "sleep",
      title: "שינה",
      type: "number",
      target: 8,
      records: {}
    }
  ];
}

function loadGoals() {
  const savedGoals = localStorage.getItem(STORAGE_KEY);

  if (!savedGoals) {
    const defaultGoals = getDefaultGoals();
    saveGoals(defaultGoals);
    return defaultGoals;
  }

  return JSON.parse(savedGoals);
}

function saveGoals(goalsToSave) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goalsToSave));
}

let goals = loadGoals();

function getTodayValue(goal) {
  const today = getTodayKey();
  return Number(goal.records[today] || 0);
}

function getProgress(goal) {
  const value = getTodayValue(goal);
  const progress = Math.round((value / goal.target) * 100);
  return Math.min(progress, 100);
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

function getFlameClass(progress) {
  if (progress >= 100) return "flame-100";
  if (progress >= 90) return "flame-90";
  if (progress >= 75) return "flame-75";
  if (progress >= 60) return "flame-60";
  if (progress >= 45) return "flame-45";
  if (progress >= 30) return "flame-30";
  if (progress >= 15) return "flame-15";
  return "flame-0";
}

function getGoalTypeName(type) {
  if (type === "yesno") return "כן / לא";
  if (type === "counter") return "מונה";
  if (type === "number") return "מספר";
  return "לא ידוע";
}

function isMenuOpen() {
  return document.getElementById("sideMenu").classList.contains("open");
}

function openMenu() {
  if (isMenuOpen()) return;

  document.getElementById("sideMenu").classList.add("open");
  document.getElementById("menuOverlay").classList.add("open");

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
  document.getElementById("sideMenu").classList.remove("open");
  document.getElementById("menuOverlay").classList.remove("open");
}

function closeMenuFromOverlay() {
  if (isMenuOpen() && history.state && history.state.menuOpen) {
    history.back();
    return;
  }

  closeMenu();
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

function showScreen(screenId, addToHistory = true) {
  closeMenu();

  currentScreenId = screenId;

  document.querySelectorAll(".screen").forEach(function(screen) {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");

  if (screenId === "homeScreen") {
    currentGoalId = null;
    renderHome();
  }

  if (screenId === "rankingScreen") {
    currentGoalId = null;
    renderRanking();
  }

  if (screenId === "addScreen") {
    currentGoalId = null;
  }

  if (screenId === "nameScreen") {
    currentGoalId = null;
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
  if (isMenuOpen()) {
    if (history.state && history.state.menuOpen) {
      history.back();
    } else {
      closeMenu();
    }

    return;
  }

  if (currentScreenId === "homeScreen") {
    return;
  }

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
        <h2>${goal.title}</h2>
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
  const progress = getProgress(goal);
  const flameClass = getFlameClass(progress);
  const details = document.getElementById("goalDetails");

  let actionHtml = "";

  if (goal.type === "yesno") {
    actionHtml = `
      <button class="action-button" id="markYesNoButton">
        ${value >= 1 ? "בטל סימון היום" : "סמן שבוצע היום"}
      </button>
    `;
  } else {
    actionHtml = `
      <div class="detail-actions">
        <button id="decreaseButton">-</button>
        <button id="increaseButton">+</button>
      </div>
    `;
  }

  details.innerHTML = `
    <div class="detail-card">
      <button class="goal-options-button" id="openGoalSettingsButton">⋮</button>

      <h1 class="screen-title">${goal.title}</h1>

      <div class="goal-status">
        <div class="flame ${flameClass}">
          <span></span>
        </div>
        <strong>${progress}%</strong>
      </div>

      <p>היום: ${value} מתוך ${goal.target}</p>
      <p>סוג: ${getGoalTypeName(goal.type)}</p>

      ${actionHtml}
    </div>
  `;

  showScreen("goalScreen", addToHistory);

  document.getElementById("openGoalSettingsButton").addEventListener("click", function(event) {
    event.stopPropagation();
    openGoalSettings(goal.id);
  });

  if (goal.type === "yesno") {
    document.getElementById("markYesNoButton").addEventListener("click", function() {
      setTodayValue(goal.id, value >= 1 ? 0 : 1);
      openGoal(goal.id, false);
    });
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

  document.getElementById("editGoalNameInput").value = goal.title;
  document.getElementById("editGoalTypeInput").value = goal.type;
  document.getElementById("editGoalTargetInput").value = goal.target;

  showScreen("goalSettingsScreen", addToHistory);
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

    if (!response.ok) {
      throw new Error("Supabase fetch failed");
    }

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
  const rankingList = document.getElementById("rankingList");
  rankingList.innerHTML = "";

  await syncPlayer();

  let players = await fetchPlayers();

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
      <div class="ranking-name">${player.name}</div>

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

function addGoal(event) {
  event.preventDefault();

  const title = document.getElementById("goalNameInput").value.trim();
  const type = document.getElementById("goalTypeInput").value;
  const target = Number(document.getElementById("goalTargetInput").value);

  if (!title || target <= 0) return;

  const newGoal = {
    id: `goal-${Date.now()}`,
    title: title,
    type: type,
    target: target,
    records: {}
  };

  goals.push(newGoal);
  saveGoals(goals);
  syncPlayer();

  document.getElementById("addGoalForm").reset();
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

  const title = document.getElementById("editGoalNameInput").value.trim();
  const type = document.getElementById("editGoalTypeInput").value;
  const target = Number(document.getElementById("editGoalTargetInput").value);

  if (!title || target <= 0) return;

  goals = goals.map(function(goal) {
    if (goal.id !== currentGoalId) return goal;

    return {
      ...goal,
      title: title,
      type: type,
      target: target
    };
  });

  saveGoals(goals);
  syncPlayer();
  openGoal(currentGoalId, false);
}

function deleteCurrentGoal() {
  if (!currentGoalId) return;

  const shouldDelete = confirm("למחוק את האתגר הזה?");

  if (!shouldDelete) return;

  goals = goals.filter(function(goal) {
    return goal.id !== currentGoalId;
  });

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

  if (isMenuOpen()) {
    closeMenu();
    return;
  }

  if (!state || state.screenId === "homeScreen") {
    showScreen("homeScreen", false);
    return;
  }

  if (state.menuOpen) {
    return;
  }

  if (state.screenId === "goalScreen" && state.goalId) {
    openGoal(state.goalId, false);
    return;
  }

  if (state.screenId === "goalSettingsScreen" && state.goalId) {
    openGoalSettings(state.goalId, false);
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

  if (!getPlayerName()) {
    showScreen("nameScreen", false);
  } else {
    renderHome();
    syncPlayer();
  }

  document.getElementById("openMenuButton").addEventListener("click", openMenu);
  document.getElementById("menuOverlay").addEventListener("click", closeMenuFromOverlay);

  document.getElementById("openRankingFromMenu").addEventListener("click", function() {
    openScreenFromMenu("rankingScreen");
  });

  document.getElementById("openAddFromMenu").addEventListener("click", function() {
    openScreenFromMenu("addScreen");
  });

  document.getElementById("toggleRankingSortButton").addEventListener("click", toggleRankingSort);

  document.querySelectorAll(".back-button").forEach(function(button) {
    button.addEventListener("click", goBack);
  });

  document.getElementById("addGoalForm").addEventListener("submit", addGoal);
  document.getElementById("editGoalForm").addEventListener("submit", editGoal);
  document.getElementById("deleteGoalButton").addEventListener("click", deleteCurrentGoal);
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
