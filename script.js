let assignments = JSON.parse(localStorage.getItem("st_assignments")) || [];
let grades = JSON.parse(localStorage.getItem("st_grades")) || [];
let goals = JSON.parse(localStorage.getItem("st_goals")) || [];
let points = Number(localStorage.getItem("st_points")) || 0;

let currentTheme = localStorage.getItem("st_theme") || "ocean";
let darkMode = localStorage.getItem("st_dark") === "true";
let currentPattern = localStorage.getItem("st_pattern") || "dots";

let calendarDate = new Date();
let selectedCalendarDate = getDateString(new Date());

let timerSeconds = 25 * 60;
let currentMinutes = 25;
let timerInterval = null;

function saveData() {
  localStorage.setItem("st_assignments", JSON.stringify(assignments));
  localStorage.setItem("st_grades", JSON.stringify(grades));
  localStorage.setItem("st_goals", JSON.stringify(goals));
  localStorage.setItem("st_points", points);
  localStorage.setItem("st_theme", currentTheme);
  localStorage.setItem("st_dark", darkMode);
  localStorage.setItem("st_pattern", currentPattern);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function getDueInfo(assignment) {
  if (assignment.completed) {
    return {
      text: "Completed",
      overdue: false
    };
  }

  const today = new Date();
  const [year, month, day] = assignment.date.split("-").map(Number);

  const todayNumber = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const dueNumber = Date.UTC(year, month - 1, day);

  const daysLeft = Math.round(
    (dueNumber - todayNumber) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft < 0) {
    return {
      text: "Past Due",
      overdue: true
    };
  }

  if (daysLeft === 0) {
    return {
      text: "Due Today",
      overdue: false
    };
  }

  return {
    text: `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`,
    overdue: false
  };
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageName);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  document.title = `StudyTrack - ${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`;

  if (pageName === "calendar") {
    renderCalendar();
  }
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

function changePoints(amount) {
  points = Math.max(0, points + amount);
  saveData();
  renderDashboard();
}

function toggleAssignment(id) {
  const assignment = assignments.find(item => item.id === id);
  if (!assignment) return;

  assignment.completed = !assignment.completed;

  if (assignment.completed) {
    points += 10;
  } else {
    points = Math.max(0, points - 10);
  }

  saveData();
  refreshAll();
}

function deleteAssignment(id) {
  if (!confirm("Delete this assignment?")) return;

  assignments = assignments.filter(item => item.id !== id);
  saveData();
  refreshAll();
}

function editAssignment(id) {
  const assignment = assignments.find(item => item.id === id);
  if (!assignment) return;

  const newName = prompt("Assignment name:", assignment.name);
  if (newName === null || !newName.trim()) return;

  const newSubject = prompt("Subject:", assignment.subject || "");
  if (newSubject === null) return;

  const newDate = prompt("Due date (YYYY-MM-DD):", assignment.date);
  if (newDate === null) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    alert("Please enter a valid date.");
    return;
  }

  const [year, month, day] = newDate.split("-").map(Number);
  const checkDate = new Date(year, month - 1, day);

  if (
    checkDate.getFullYear() !== year ||
    checkDate.getMonth() !== month - 1 ||
    checkDate.getDate() !== day
  ) {
    alert("Please enter a real calendar date.");
    return;
  }

  assignment.name = newName.trim();
  assignment.subject = newSubject.trim();
  assignment.date = newDate;

  saveData();
  refreshAll();
}

function renderDashboard() {
  const total = assignments.length;
  const completed = assignments.filter(item => item.completed).length;
  const remaining = total - completed;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  document.getElementById("total-count").textContent = total;
  document.getElementById("completed-count").textContent = completed;
  document.getElementById("remaining-count").textContent = remaining;
  document.getElementById("points-count").textContent = points;
  document.getElementById("progress-label").textContent = `${percentage}% completed`;
  document.getElementById("progress-bar").style.width = `${percentage}%`;
  document.getElementById("progress-text").textContent =
    `${completed} out of ${total} assignments completed`;

  const upcomingList = document.getElementById("upcoming-list");

  const upcoming = assignments
    .filter(item => !item.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (upcoming.length === 0) {
    upcomingList.innerHTML = "<p>No upcoming assignments!</p>";
    return;
  }

  upcomingList.innerHTML = upcoming.map(item => {
    const dueInfo = getDueInfo(item);

    return `
      <div class="assignment-item ${dueInfo.overdue ? "overdue" : ""}">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <p>${escapeHTML(item.subject || "No subject")}</p>
          <small>Due: ${formatDate(item.date)}</small>
          <br>
          <small class="assignment-due-status ${dueInfo.overdue ? "overdue" : ""}">
            ${dueInfo.text}
          </small>
        </div>
      </div>
    `;
  }).join("");
}

function renderAssignments() {
  const list = document.getElementById("assignment-list");
  const filter = document.getElementById("assignment-filter").value;

  let filtered = [...assignments];

  if (filter === "incomplete") {
    filtered = filtered.filter(item => !item.completed);
  }

  if (filter === "completed") {
    filtered = filtered.filter(item => item.completed);
  }

  filtered.sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length === 0) {
    list.innerHTML = "<p>No assignments found.</p>";
    return;
  }

  list.innerHTML = filtered.map(item => {
    const dueInfo = getDueInfo(item);

    return `
      <div class="assignment-item ${item.completed ? "completed" : ""} ${dueInfo.overdue ? "overdue" : ""}">
        <div>
          <strong class="assignment-name">${escapeHTML(item.name)}</strong>
          <p>${escapeHTML(item.subject || "No subject")}</p>
          <small>Due: ${formatDate(item.date)}</small>
          <br>
          <small>Priority: ${escapeHTML(item.priority)}</small>
          <br>
          <small class="assignment-due-status ${dueInfo.overdue ? "overdue" : ""}">
            ${dueInfo.text}
          </small>
        </div>

        <div class="assignment-actions">
          <button class="small-button" data-action="toggle" data-id="${item.id}">
            ${item.completed ? "Undo" : "Complete"}
          </button>
          <button class="small-button" data-action="edit" data-id="${item.id}">
            Edit
          </button>
          <button class="small-button delete-button" data-action="delete" data-id="${item.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("button[data-action]").forEach(button => {
    const id = Number(button.dataset.id);

    button.addEventListener("click", () => {
      if (button.dataset.action === "toggle") toggleAssignment(id);
      if (button.dataset.action === "edit") editAssignment(id);
      if (button.dataset.action === "delete") deleteAssignment(id);
    });
  });
}

document.getElementById("assignment-form").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("assignment-name").value.trim();
  const subject = document.getElementById("assignment-subject").value.trim();
  const date = document.getElementById("assignment-date").value;
  const priority = document.getElementById("assignment-priority").value;

  if (!name || !date) return;

  assignments.push({
    id: Date.now(),
    name,
    subject,
    date,
    priority,
    completed: false
  });

  event.target.reset();
  saveData();
  refreshAll();
});

document.getElementById("assignment-filter").addEventListener("change", renderAssignments);

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  document.getElementById("calendar-month").textContent =
    calendarDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = document.getElementById("calendar-days");

  calendarDays.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarDays.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = getDateString(date);

    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";
    dayButton.textContent = day;

    if (dateString === getDateString(new Date())) {
      dayButton.classList.add("today");
    }

    if (dateString === selectedCalendarDate) {
      dayButton.classList.add("selected");
    }

    if (assignments.some(item => item.date === dateString)) {
      const dot = document.createElement("span");
      dot.className = "calendar-dot";
      dayButton.appendChild(dot);
    }

    dayButton.addEventListener("click", () => {
      selectedCalendarDate = dateString;
      renderCalendar();
    });

    calendarDays.appendChild(dayButton);
  }

  renderCalendarAssignments();
}

function renderCalendarAssignments() {
  document.getElementById("selected-date").textContent =
    `Assignments for ${formatDate(selectedCalendarDate)}`;

  const list = document.getElementById("calendar-assignment-list");

  const selectedAssignments = assignments.filter(
    item => item.date === selectedCalendarDate
  );

  if (selectedAssignments.length === 0) {
    list.innerHTML = "<p>No assignments for this date.</p>";
    return;
  }

  list.innerHTML = selectedAssignments.map(item => {
    const dueInfo = getDueInfo(item);

    return `
      <div class="calendar-task ${item.completed ? "completed" : ""} ${dueInfo.overdue ? "overdue" : ""}">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <p>${escapeHTML(item.subject || "No subject")}</p>
          <small>Priority: ${escapeHTML(item.priority)}</small>
          <br>
          <small class="assignment-due-status ${dueInfo.overdue ? "overdue" : ""}">
            ${dueInfo.text}
          </small>
        </div>

        <div class="assignment-actions">
          <button class="small-button" data-calendar-action="toggle" data-id="${item.id}">
            ${item.completed ? "Undo" : "Complete"}
          </button>
          <button class="small-button delete-button" data-calendar-action="delete" data-id="${item.id}">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("button[data-calendar-action]").forEach(button => {
    const id = Number(button.dataset.id);

    button.addEventListener("click", () => {
      if (button.dataset.calendarAction === "toggle") toggleAssignment(id);
      if (button.dataset.calendarAction === "delete") deleteAssignment(id);
    });
  });
}

document.getElementById("calendar-assignment-form").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("calendar-assignment-name").value.trim();
  const subject = document.getElementById("calendar-assignment-subject").value.trim();
  const priority = document.getElementById("calendar-assignment-priority").value;

  if (!name) return;

  assignments.push({
    id: Date.now(),
    name,
    subject,
    date: selectedCalendarDate,
    priority,
    completed: false
  });

  event.target.reset();
  saveData();
  refreshAll();
});

document.getElementById("prev-month").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("next-month").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

function updateTimer() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  document.getElementById("timer-display").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById("timer-start").textContent = "Start";
}

function playTimerSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = new AudioContext();

  [0, 0.4, 0.8].forEach(delay => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.frequency.value = 880;
    oscillator.type = "sine";

    gain.gain.setValueAtTime(0.3, audio.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + delay + 0.25
    );

    oscillator.start(audio.currentTime + delay);
    oscillator.stop(audio.currentTime + delay + 0.25);
  });

  setTimeout(() => audio.close(), 1800);
}

function finishTimer() {
  stopTimer();
  playTimerSound();

  if (currentMinutes === 25) {
    changePoints(5);
    alert("Study session finished! You earned 5 points. Great job!");
  } else {
    alert("Your break is over!");
  }
}

document.getElementById("timer-start").addEventListener("click", () => {
  if (timerInterval) {
    stopTimer();
    return;
  }

  if (timerSeconds <= 0) {
    timerSeconds = currentMinutes * 60;
  }

  document.getElementById("timer-start").textContent = "Pause";

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimer();

    if (timerSeconds <= 0) {
      finishTimer();
    }
  }, 1000);
});

document.getElementById("timer-reset").addEventListener("click", () => {
  stopTimer();
  timerSeconds = currentMinutes * 60;
  updateTimer();
});

document.getElementById("timer-mode").addEventListener("change", event => {
  stopTimer();
  currentMinutes = Number(event.target.value);
  timerSeconds = currentMinutes * 60;
  updateTimer();
});

function renderGrades() {
  const list = document.getElementById("grade-list");

  if (grades.length === 0) {
    list.innerHTML = "<p>No grades added yet.</p>";
  } else {
    list.innerHTML = grades.map(grade => `
      <div class="grade-item">
        <div>
          <strong>${escapeHTML(grade.subject)}</strong>
          <p>${grade.value}%</p>
        </div>
        <button class="small-button delete-button" data-grade-id="${grade.id}">
          Delete
        </button>
      </div>
    `).join("");
  }

  const average = grades.length
    ? grades.reduce((sum, grade) => sum + Number(grade.value), 0) / grades.length
    : 0;

  document.getElementById("grade-average").textContent =
    `${average.toFixed(1)}%`;

  list.querySelectorAll("[data-grade-id]").forEach(button => {
    button.addEventListener("click", () => {
      grades = grades.filter(
        grade => grade.id !== Number(button.dataset.gradeId)
      );

      saveData();
      renderGrades();
    });
  });
}

document.getElementById("grade-form").addEventListener("submit", event => {
  event.preventDefault();

  const subject = document.getElementById("grade-subject").value.trim();
  const value = Number(document.getElementById("grade-value").value);

  if (!subject || value < 0 || value > 100) {
    alert("Please enter a grade between 0 and 100.");
    return;
  }

  grades.push({
    id: Date.now(),
    subject,
    value
  });

  event.target.reset();
  saveData();
  renderGrades();
});

function renderGoals() {
  const list = document.getElementById("goal-list");

  if (goals.length === 0) {
    list.innerHTML = "<p>No goals added yet.</p>";
    return;
  }

  list.innerHTML = goals.map(goal => `
    <div class="goal-item">
      <label>
        <input type="checkbox" data-goal-check="${goal.id}"
          ${goal.completed ? "checked" : ""}>
        <span>${escapeHTML(goal.name)}</span>
      </label>

      <button class="small-button delete-button" data-goal-delete="${goal.id}">
        Delete
      </button>
    </div>
  `).join("");

  list.querySelectorAll("[data-goal-check]").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const goal = goals.find(
        item => item.id === Number(checkbox.dataset.goalCheck)
      );

      if (!goal) return;

      goal.completed = checkbox.checked;
      points = Math.max(0, points + (goal.completed ? 5 : -5));

      saveData();
      refreshAll();
    });
  });

  list.querySelectorAll("[data-goal-delete]").forEach(button => {
    button.addEventListener("click", () => {
      goals = goals.filter(
        item => item.id !== Number(button.dataset.goalDelete)
      );

      saveData();
      renderGoals();
    });
  });
}

document.getElementById("goal-form").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("goal-name").value.trim();
  if (!name) return;

  goals.push({
    id: Date.now(),
    name,
    completed: false
  });

  event.target.reset();
  saveData();
  renderGoals();
});

function applyTheme() {
  document.body.dataset.theme = currentTheme;
  document.body.classList.toggle("dark", darkMode);

  document.querySelectorAll(".theme-choice").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.theme === currentTheme
    );
  });
}

document.querySelectorAll(".theme-choice").forEach(button => {
  button.addEventListener("click", () => {
    currentTheme = button.dataset.theme;
    saveData();
    applyTheme();
  });
});

document.getElementById("light-mode").addEventListener("click", () => {
  darkMode = false;
  saveData();
  applyTheme();
});

document.getElementById("dark-mode").addEventListener("click", () => {
  darkMode = true;
  saveData();
  applyTheme();
});

/* Background patterns */
function applyPattern(pattern) {
  currentPattern = pattern;
  document.body.dataset.pattern = pattern;

  document.querySelectorAll(".pattern-choice").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.pattern === pattern
    );
  });

  localStorage.setItem("st_pattern", pattern);
}

document.querySelectorAll(".pattern-choice").forEach(button => {
  button.addEventListener("click", () => {
    applyPattern(button.dataset.pattern);
    saveData();
  });
});

/* Daily motivational quotes */
function showDailyQuote() {
  const quotes = [
    "Small steps every day lead to big results.",
    "You are capable of more than you think.",
    "Progress, not perfection.",
    "Your future is created by what you do today.",
    "Believe in yourself and keep going.",
    "One assignment at a time. You've got this!",
    "Don't stop until you're proud.",
    "A little progress each day adds up.",
    "You don't have to be perfect to make progress.",
    "Make today count.",
    "Your hard work will pay off.",
    "Dream big, work hard, stay focused."
  ];

  const today = new Date();
  const quoteIndex = Math.floor(
    (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) % quotes.length
  );

  document.getElementById("daily-quote").textContent = quotes[quoteIndex];
}

document.getElementById("export-data").addEventListener("click", () => {
  const data = {
    assignments,
    grades,
    goals,
    points,
    currentTheme,
    darkMode,
    currentPattern
  };

  const file = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "StudyTrack-data.json";
  link.click();

  URL.revokeObjectURL(url);
});

document.getElementById("clear-data").addEventListener("click", () => {
  if (!confirm("Are you sure you want to delete all your StudyTrack data?")) {
    return;
  }

  assignments = [];
  grades = [];
  goals = [];
  points = 0;
  currentTheme = "ocean";
  darkMode = false;
  currentPattern = "dots";

  stopTimer();

  localStorage.removeItem("st_assignments");
  localStorage.removeItem("st_grades");
  localStorage.removeItem("st_goals");
  localStorage.removeItem("st_points");
  localStorage.removeItem("st_theme");
  localStorage.removeItem("st_dark");
  localStorage.removeItem("st_pattern");

  saveData();
  applyTheme();
  applyPattern(currentPattern);
  refreshAll();
});

function refreshAll() {
  renderDashboard();
  renderAssignments();
  renderCalendar();
  renderGrades();
  renderGoals();
}

document.getElementById("today").textContent =
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

applyTheme();
applyPattern(currentPattern);
showDailyQuote();
updateTimer();
refreshAll();
showPage("dashboard");
