const STORAGE_KEY = "levelup_goals";

let currentScreenId = "homeScreen";
let currentGoalId = null;

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function openMenu() {
  document.getElementById("sideMenu").classList.add("open");
  document.getElementById("menuOverlay").classList.add("open");
}

function closeMenu() {
  document.getElementById("sideMenu").classList.remove("open");
  document.getElementById("menuOverlay").classList.remove("open");
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

  if (screenId === "statsScreen") {
    currentGoalId = null;
    renderStats();
  }

  if (screenId === "podiumScreen") {
    currentGoalId = null;
    renderPodium();
  }

  if (screenId === "addScreen") {
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
  if (document.getElementById("sideMenu").classList.contains("open")) {
    closeMenu();
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
}

function renderStats() {
  const totalGoals = goals.length;

  const completedGoals = goals.filter(function(goal) {
    return getProgress(goal) >= 100;
  }).length;

  const averageProgress = totalGoals === 0
    ? 0
    : Math.round(
        goals.reduce(function(sum, goal) {
          return sum + getProgress(goal);
        }, 0) / totalGoals
      );

  document.getElementById("totalGoalsText").textContent = `מספר אתגרים: ${totalGoals}`;
  document.getElementById("completedGoalsText").textContent = `הושלמו היום: ${completedGoals}`;
  document.getElementById("averageProgressText").textContent = `ממוצע התקדמות: ${averageProgress}%`;
}

function renderPodium() {
  const totalGoals = goals.length;

  const averageProgress = totalGoals === 0
    ? 0
    : Math.round(
        goals.reduce(function(sum, goal) {
          return sum + getProgress(goal);
        }, 0) / totalGoals
      );

  document.getElementById("podiumList").innerHTML = `
    <li>אתה — ${averageProgress} נקודות</li>
    <li>משפחה — יתחבר בהמשך</li>
    <li>משפחה — יתחבר בהמשך</li>
  `;
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

  document.getElementById("addGoalForm").reset();
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
  showScreen("homeScreen");
}

window.addEventListener("popstate", function(event) {
  const state = event.state;

  if (document.getElementById("sideMenu").classList.contains("open")) {
    closeMenu();
    return;
  }

  if (!state || state.screenId === "homeScreen") {
    showScreen("homeScreen", false);
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

  renderHome();

  document.getElementById("openMenuButton").addEventListener("click", openMenu);
  document.getElementById("menuOverlay").addEventListener("click", closeMenu);

  document.getElementById("openStatsFromMenu").addEventListener("click", function() {
    showScreen("statsScreen");
  });

  document.getElementById("openPodiumFromMenu").addEventListener("click", function() {
    showScreen("podiumScreen");
  });

  document.getElementById("openAddFromMenu").addEventListener("click", function() {
    showScreen("addScreen");
  });

  document.querySelectorAll(".back-button").forEach(function(button) {
    button.addEventListener("click", goBack);
  });

  document.getElementById("addGoalForm").addEventListener("submit", addGoal);
  document.getElementById("editGoalForm").addEventListener("submit", editGoal);
  document.getElementById("deleteGoalButton").addEventListener("click", deleteCurrentGoal);
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
