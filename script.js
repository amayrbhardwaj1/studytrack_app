
let assignments = JSON.parse(localStorage.getItem("st_assignments")) || [];
let grades = JSON.parse(localStorage.getItem("st_grades")) || [];
let goals = JSON.parse(localStorage.getItem("st_goals")) || [];
let points = Number(localStorage.getItem("st_points")) || 0;

let currentTheme = localStorage.getItem("st_theme") || "ocean";
let darkMode = localStorage.getItem("st_dark") === "true";

let calendarDate = new Date();
let selectedCalendarDate = new Date();

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
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageName);
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  const titles = {
    dashboard: "Dashboard",
    assignments: "Assignments",
    calendar: "Calendar",
    timer: "Study Timer",
    grades: "Grades",
    goals: "Goals",
    settings: "Settings"
  };

  if (pageName === "calendar") renderCalendar();
  document.title = "StudyTrack - " + (titles[pageName] || "Dashboard");
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

function renderDashboard() {
  const completed = assignments.filter(a => a.completed).length;
  const total = assignments.length;
  const remaining = total - completed;
  const percentage = total ? Math.round(completed / total * 100) : 0;

  document.getElementById("total-count").textContent = total;
  document.getElementById("completed-count").textContent = completed;
  document.getElementById("remaining-count").textContent = remaining;
  document.getElementById("points-count").textContent = points;
  document.getElementById("progress-label").textContent = percentage + "% completed";
  document.getElementById("progress-bar").style.width = percentage + "%";
  document.getElementById("progress-text").textContent =
    completed + " out of " + total + " assignments completed.";

  const upcoming = assignments
    .filter(a => !a.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const list = document.getElementById("upcoming-list");
  list.innerHTML = "";

  if (!upcoming.length) {
    list.textContent = "No upcoming assignments!";
  }

  upcoming.forEach(a => {
    const item = document.createElement("div");
    item.className = "assignment-item";
    item.textContent = `${a.name} - ${a.subject || "No subject"} - Due ${a.date}`;
    list.appendChild(item);
  });
}

function renderAssignments() {
  const list = document.getElementById("assignment-list");
  const filter = document.getElementById("assignment-filter").value;

  list.innerHTML = "";

  let filtered = assignments;

  if (filter === "completed") {
    filtered = assignments.filter(a => a.completed);
  } else if (filter === "incomplete") {
    filtered = assignments.filter(a => !a.completed);
  }

  filtered.sort((a, b) => a.date.localeCompare(b.date));

  if (!filtered.length) {
    list.textContent = "No assignments found.";
  }

  filtered.forEach(assignment => {
    const item = document.createElement("div");
    item.className = "assignment-item";
    if (assignment.completed) item.classList.add("completed");

    const details = document.createElement("div");
    details.innerHTML = `
      <strong class="assignment-name">${escapeHTML(assignment.name)}</strong>
      <div>${escapeHTML(assignment.subject || "No subject")}</div>
      <small>Due: ${escapeHTML(assignment.date)} | Priority: ${escapeHTML(assignment.priority || "Medium")}</small>
    `;

    const actions = document.createElement("div");
    actions.className = "assignment-actions";

    const completeButton = document.createElement("button");
    completeButton.className = "small-button";
    completeButton.textContent = assignment.completed ? "Undo" : "Complete";

    completeButton.addEventListener("click", () => {
      assignment.completed = !assignment.completed;
      points += assignment.completed ? 10 : -10;
      points = Math.max(0, points);
      saveData();
      refreshAll();
    });

    const editButton = document.createElement("button");
    editButton.className = "small-button";
    editButton.textContent = "Edit";

    editButton.addEventListener("click", () => {
      const newName = prompt("Assignment name:", assignment.name);
      if (newName === null || !newName.trim()) return;

      const newSubject = prompt("Subject:", assignment.subject || "");
      if (newSubject === null) return;

      const newDate = prompt("Due date (YYYY-MM-DD):", assignment.date);
      if (newDate === null) return;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) ||
          Number.isNaN(new Date(newDate + "T00:00:00").getTime())) {
        alert("Please enter a valid date in YYYY-MM-DD format.");
        return;
      }

      assignment.name = newName.trim();
      assignment.subject = newSubject.trim();
      assignment.date = newDate;

      saveData();
      refreshAll();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-button delete-button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      if (!confirm("Delete this assignment?")) return;
      assignments = assignments.filter(a => a.id !== assignment.id);
      saveData();
      refreshAll();
    });

    actions.append(completeButton, editButton, deleteButton);
    item.append(details, actions);
    list.appendChild(item);
  });
}

document.getElementById("assignment-form").addEventListener("submit", event => {
  event.preventDefault();

  assignments.push({
    id: Date.now(),
    name: document.getElementById("assignment-name").value.trim(),
    subject: document.getElementById("assignment-subject").value.trim(),
    date: document.getElementById("assignment-date").value,
    priority: document.getElementById("assignment-priority").value,
    completed: false
  });

  saveData();
  event.target.reset();
  refreshAll();
});

document.getElementById("assignment-filter").addEventListener("change", renderAssignments);

// INTERACTIVE CALENDAR

function getCalendarDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  const container = document.getElementById("calendar-days");
  container.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    container.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = getCalendarDate(date);

    const button = document.createElement("button");
    button.className = "calendar-day";

    const number = document.createElement("span");
    number.textContent = day;
    button.appendChild(number);

    if (dateString === getCalendarDate(new Date())) {
      button.classList.add("today");
    }

    if (dateString === getCalendarDate(selectedCalendarDate)) {
      button.classList.add("selected");
    }

    const hasAssignments = assignments.some(a => a.date === dateString);

    if (hasAssignments) {
      const dot = document.createElement("span");
      dot.className = "calendar-dot";
      button.appendChild(dot);
    }

    button.addEventListener("click", () => {
      selectedCalendarDate = date;
      renderCalendar();
    });

    container.appendChild(button);
  }

  renderCalendarAssignments();
}

function renderCalendarAssignments() {
  const dateString = getCalendarDate(selectedCalendarDate);

  document.getElementById("selected-date").textContent =
    selectedCalendarDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

  const list = document.getElementById("calendar-assignment-list");
  list.innerHTML = "";

  const dayAssignments = assignments.filter(a => a.date === dateString);

  if (!dayAssignments.length) {
    list.textContent = "No assignments for this day.";
    return;
  }

  dayAssignments.forEach(assignment => {
    const item = document.createElement("div");
    item.className = "calendar-task";

    if (assignment.completed) item.classList.add("completed");

    const details = document.createElement("span");
    details.textContent =
      `${assignment.name} - ${assignment.subject || "No subject"} - ${assignment.priority || "Medium"}`;

    const actions = document.createElement("div");
    actions.className = "assignment-actions";

    const completeButton = document.createElement("button");
    completeButton.className = "small-button";
    completeButton.textContent = assignment.completed ? "Undo" : "Complete";

    completeButton.addEventListener("click", () => {
      assignment.completed = !assignment.completed;
      points = Math.max(0, points + (assignment.completed ? 10 : -10));
      saveData();
      refreshAll();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-button delete-button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      if (!confirm("Delete this assignment?")) return;
      assignments = assignments.filter(a => a.id !== assignment.id);
      saveData();
      refreshAll();
    });

    actions.append(completeButton, deleteButton);
    item.append(details, actions);
    list.appendChild(item);
  });
}

document.getElementById("prev-month").addEventListener("click", () => {
  calendarDate = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() - 1,
    1
  );
  renderCalendar();
});

document.getElementById("next-month").addEventListener("click", () => {
  calendarDate = new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth() + 1,
    1
  );
  renderCalendar();
});

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
    date: getCalendarDate(selectedCalendarDate),
    priority,
    completed: false
  });

  saveData();
  event.target.reset();
  refreshAll();
});

// STUDY TIMER

function updateTimer() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  document.getElementById("timer-display").textContent =
    String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0");
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

  audio.resume().then(() => {
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    oscillator.connect(volume);
    volume.connect(audio.destination);

    const now = audio.currentTime;

    volume.gain.setValueAtTime(0, now);

    for (let i = 0; i < 3; i++) {
      volume.gain.setValueAtTime(0, now + i * 0.35);
      volume.gain.linearRampToValueAtTime(0.25, now + i * 0.35 + 0.03);
      volume.gain.setValueAtTime(0, now + i * 0.35 + 0.2);
    }

    oscillator.start(now);
    oscillator.stop(now + 1);
    oscillator.onended = () => audio.close();
  }).catch(() => audio.close());
}

function finishTimer() {
  stopTimer();
  playTimerSound();

  if (currentMinutes === 25) {
    points += 5;
    saveData();
    renderDashboard();
    alert("Focus session finished! You earned 5 points.");
  } else {
    alert("Break finished! Ready to study again?");
  }
}

document.getElementById("timer-start").addEventListener("click", () => {
  if (timerInterval) {
    stopTimer();
    return;
  }

  document.getElementById("timer-start").textContent = "Pause";

  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimer();

      if (timerSeconds === 0) {
        finishTimer();
      }
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

// GRADES

function renderGrades() {
  const list = document.getElementById("grade-list");
  list.innerHTML = "";

  if (!grades.length) {
    list.textContent = "No grades added yet.";
  }

  grades.forEach(grade => {
    const item = document.createElement("div");
    item.className = "grade-item";

    const details = document.createElement("span");
    details.textContent = `${grade.subject}: ${grade.value}%`;

    const remove = document.createElement("button");
    remove.className = "small-button delete-button";
    remove.textContent = "Delete";

    remove.addEventListener("click", () => {
      grades = grades.filter(g => g.id !== grade.id);
      saveData();
      renderGrades();
    });

    item.append(details, remove);
    list.appendChild(item);
  });

  const average = grades.length
    ? grades.reduce((sum, grade) => sum + Number(grade.value), 0) / grades.length
    : 0;

  document.getElementById("grade-average").textContent =
    average.toFixed(1) + "%";
}

document.getElementById("grade-form").addEventListener("submit", event => {
  event.preventDefault();

  grades.push({
    id: Date.now(),
    subject: document.getElementById("grade-subject").value.trim(),
    value: Number(document.getElementById("grade-value").value)
  });

  saveData();
  event.target.reset();
  renderGrades();
});

// GOALS

function renderGoals() {
  const list = document.getElementById("goal-list");
  list.innerHTML = "";

  if (!goals.length) {
    list.textContent = "No goals added yet.";
  }

  goals.forEach(goal => {
    const item = document.createElement("div");
    item.className = "goal-item";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = goal.completed;

    const name = document.createElement("span");
    name.textContent = goal.name;

    if (goal.completed) name.style.textDecoration = "line-through";

    checkbox.addEventListener("change", () => {
      goal.completed = checkbox.checked;
      points = Math.max(0, points + (goal.completed ? 5 : -5));
      saveData();
      renderGoals();
      renderDashboard();
    });

    label.append(checkbox, name);

    const remove = document.createElement("button");
    remove.className = "small-button delete-button";
    remove.textContent = "Delete";

    remove.addEventListener("click", () => {
      goals = goals.filter(g => g.id !== goal.id);
      saveData();
      renderGoals();
    });

    item.append(label, remove);
    list.appendChild(item);
  });
}

document.getElementById("goal-form").addEventListener("submit", event => {
  event.preventDefault();

  goals.push({
    id: Date.now(),
    name: document.getElementById("goal-name").value.trim(),
    completed: false
  });

  saveData();
  event.target.reset();
  renderGoals();
});

// THEMES

function applyTheme() {
  document.body.dataset.theme = currentTheme;
  document.body.classList.toggle("dark", darkMode);

  document.querySelectorAll(".theme-choice").forEach(button => {
    button.style.outline =
      button.dataset.theme === currentTheme ? "3px solid var(--primary)" : "none";
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

// EXPORT AND CLEAR DATA

document.getElementById("export-data").addEventListener("click", () => {
  const data = {
    assignments,
    grades,
    goals,
    points
  };

  const file = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "StudyTrack-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("clear-data").addEventListener("click", () => {
  if (!confirm("Are you sure you want to delete all your StudyTrack data?")) return;

  assignments = [];
  grades = [];
  goals = [];
  points = 0;

  saveData();
  refreshAll();
});

// UPDATE EVERYTHING

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
    month: "long",
    day: "numeric",
    year: "numeric"
  });

applyTheme();
updateTimer();
refreshAll();
showPage("dashboard");
