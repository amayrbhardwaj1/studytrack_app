
const $ = id => document.getElementById(id);

function loadData(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

let assignments = loadData("st_assignments", []);
let grades = loadData("st_grades", []);
let goals = loadData("st_goals", []);
let points = loadData("st_points", 0);
let theme = loadData("st_theme", "ocean");
let darkMode = loadData("st_dark", false);

function saveData() {
  localStorage.setItem("st_assignments", JSON.stringify(assignments));
  localStorage.setItem("st_grades", JSON.stringify(grades));
  localStorage.setItem("st_goals", JSON.stringify(goals));
  localStorage.setItem("st_points", JSON.stringify(points));
  localStorage.setItem("st_theme", JSON.stringify(theme));
  localStorage.setItem("st_dark", JSON.stringify(darkMode));
}

function makeId() {
  return Date.now().toString() + Math.random().toString(16).slice(2);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatDate(date) {
  if (!date) return "No due date";
  const parsed = new Date(date + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  });
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

  $("page-title").textContent = titles[pageName] || "Dashboard";
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

$("quick-add").addEventListener("click", () => {
  showPage("assignments");
  $("assignment-name").focus();
});

function renderDashboard() {
  const total = assignments.length;
  const completed = assignments.filter(item => item.completed).length;
  const remaining = total - completed;
  const percentage = total ? Math.round(completed / total * 100) : 0;

  $("total-count").textContent = total;
  $("completed-count").textContent = completed;
  $("remaining-count").textContent = remaining;
  $("points-count").textContent = points;
  $("progress-label").textContent = percentage + "%";
  $("progress-bar").style.width = percentage + "%";
  $("progress-text").textContent = total
    ? `${completed} out of ${total} assignments completed.`
    : "Add an assignment to get started.";

  const upcoming = assignments
    .filter(item => !item.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  $("upcoming-list").innerHTML = upcoming.length
    ? upcoming.map(item => `
      <div class="simple-item">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <small>${escapeHTML(item.subject)} · ${formatDate(item.date)}</small>
        </div>
      </div>
    `).join("")
    : '<p class="muted">No upcoming assignments. You are all caught up!</p>';
}

function renderAssignments() {
  const filter = $("assignment-filter").value;
  let shown = [...assignments];

  if (filter === "active") shown = shown.filter(item => !item.completed);
  if (filter === "done") shown = shown.filter(item => item.completed);

  shown.sort((a, b) => a.date.localeCompare(b.date));

  $("assignment-list").innerHTML = shown.length
    ? shown.map(item => `
      <div class="task-card ${item.completed ? "completed" : ""}">
        <input type="checkbox" data-complete="${item.id}" ${item.completed ? "checked" : ""} aria-label="Mark completed">
        <div class="task-info">
          <strong>${escapeHTML(item.name)}</strong>
          <small>${escapeHTML(item.subject)} · Due ${formatDate(item.date)}</small>
        </div>
        <span class="priority ${item.priority === "High" ? "high" : ""}">${escapeHTML(item.priority)}</span>
        <button class="delete-btn" data-delete-assignment="${item.id}" aria-label="Delete assignment">×</button>
      </div>
    `).join("")
    : '<p class="muted">No assignments here yet.</p>';

  renderDashboard();
  renderCalendar();
}

$("assignment-form").addEventListener("submit", event => {
  event.preventDefault();

  assignments.push({
    id: makeId(),
    name: $("assignment-name").value.trim(),
    subject: $("assignment-subject").value.trim(),
    date: $("assignment-date").value,
    priority: $("assignment-priority").value,
    completed: false
  });

  saveData();
  event.target.reset();
  renderAssignments();
});

$("assignment-filter").addEventListener("change", renderAssignments);

$("assignment-list").addEventListener("change", event => {
  const id = event.target.dataset.complete;
  if (!id) return;

  const item = assignments.find(assignment => assignment.id === id);
  if (!item) return;

  if (!item.completed && event.target.checked) points += 10;
  if (item.completed && !event.target.checked) points = Math.max(0, points - 10);

  item.completed = event.target.checked;
  saveData();
  renderAssignments();
});

$("assignment-list").addEventListener("click", event => {
  const id = event.target.dataset.deleteAssignment;
  if (!id) return;

  assignments = assignments.filter(item => item.id !== id);
  saveData();
  renderAssignments();
});

function renderCalendar() {
  const sorted = [...assignments].sort((a, b) => a.date.localeCompare(b.date));

  $("calendar-list").innerHTML = sorted.length
    ? sorted.map(item => `
      <div class="simple-item">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <small>${escapeHTML(item.subject)} · ${formatDate(item.date)}</small>
        </div>
        <span>${item.completed ? "✓ Done" : "Upcoming"}</span>
      </div>
    `).join("")
    : '<p class="muted">Your calendar is empty.</p>';
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(value =>
    value.trim().toLowerCase().replace(/^"|"$/g, "")
  );

  const titleIndex = headers.findIndex(value =>
    ["title", "summary", "assignment", "event", "name"].includes(value)
  );

  const dateIndex = headers.findIndex(value =>
    ["date", "due date", "due_date", "start date"].includes(value)
  );

  const subjectIndex = headers.findIndex(value => value === "subject");

  if (titleIndex === -1 || dateIndex === -1) {
    throw new Error("Your CSV needs a title and date column.");
  }

  return lines.slice(1).map(line => {
    const columns = line.split(",").map(value =>
      value.trim().replace(/^"|"$/g, "")
    );

    return {
      name: columns[titleIndex],
      date: normalizeDate(columns[dateIndex]),
      subject: subjectIndex >= 0 ? columns[subjectIndex] : "Imported",
      priority: "Normal"
    };
  }).filter(item => item.name && item.date);
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseICS(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events = unfolded.split("BEGIN:VEVENT").slice(1);

  return events.map(event => {
    const summary = event.match(/^SUMMARY(?:;[^:]*)?:(.*)$/m);
    const date = event.match(/^DTSTART(?:;[^:]*)?:(.*)$/m);

    if (!summary || !date) return null;

    const rawDate = date[1].trim();
    const match = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);

    if (!match) return null;

    return {
      name: summary[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " "),
      date: `${match[1]}-${match[2]}-${match[3]}`,
      subject: "Imported calendar",
      priority: "Normal"
    };
  }).filter(Boolean);
}

$("calendar-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = file.name.toLowerCase().endsWith(".ics")
      ? parseICS(text)
      : parseCSV(text);

    let added = 0;

    imported.forEach(item => {
      const exists = assignments.some(existing =>
        existing.name === item.name && existing.date === item.date
      );

      if (!exists) {
        assignments.push({
          id: makeId(),
          ...item,
          completed: false
        });
        added++;
      }
    });

    saveData();
    renderAssignments();
    $("import-message").textContent = `${added} calendar event(s) imported.`;
  } catch (error) {
    $("import-message").textContent = error.message || "Could not read that file.";
  }

  event.target.value = "";
});

function renderGrades() {
  const average = grades.length
    ? grades.reduce((sum, grade) => sum + grade.value, 0) / grades.length
    : null;

  $("grade-average").textContent = average === null ? "—" : average.toFixed(1) + "%";

  $("grade-list").innerHTML = grades.length
    ? grades.map(grade => `
      <div class="task-card">
        <div class="task-info">
          <strong>${escapeHTML(grade.subject)}</strong>
          <small>${grade.value}%</small>
        </div>
        <button class="delete-btn" data-delete-grade="${grade.id}" aria-label="Delete grade">×</button>
      </div>
    `).join("")
    : '<p class="muted">No grades added yet.</p>';
}

$("grade-form").addEventListener("submit", event => {
  event.preventDefault();

  const value = Number($("grade-value").value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    alert("Enter a grade between 0 and 100.");
    return;
  }

  grades.push({
    id: makeId(),
    subject: $("grade-subject").value.trim(),
    value
  });

  saveData();
  event.target.reset();
  renderGrades();
});

$("grade-list").addEventListener("click", event => {
  const id = event.target.dataset.deleteGrade;
  if (!id) return;

  grades = grades.filter(grade => grade.id !== id);
  saveData();
  renderGrades();
});

function renderGoals() {
  $("goal-list").innerHTML = goals.length
    ? goals.map(goal => `
      <div class="task-card ${goal.completed ? "completed" : ""}">
        <input type="checkbox" data-complete-goal="${goal.id}" ${goal.completed ? "checked" : ""} aria-label="Complete goal">
        <div class="task-info"><strong>${escapeHTML(goal.name)}</strong></div>
        <button class="delete-btn" data-delete-goal="${goal.id}" aria-label="Delete goal">×</button>
      </div>
    `).join("")
    : '<p class="muted">Add a goal you want to work towards.</p>';
}

$("goal-form").addEventListener("submit", event => {
  event.preventDefault();

  goals.push({
    id: makeId(),
    name: $("goal-name").value.trim(),
    completed: false
  });

  saveData();
  event.target.reset();
  renderGoals();
});

$("goal-list").addEventListener("change", event => {
  const id = event.target.dataset.completeGoal;
  if (!id) return;

  const goal = goals.find(item => item.id === id);
  if (!goal) return;

  if (!goal.completed && event.target.checked) points += 5;
  if (goal.completed && !event.target.checked) points = Math.max(0, points - 5);

  goal.completed = event.target.checked;
  saveData();
  renderGoals();
  renderDashboard();
});

$("goal-list").addEventListener("click", event => {
  const id = event.target.dataset.deleteGoal;
  if (!id) return;

  goals = goals.filter(goal => goal.id !== id);
  saveData();
  renderGoals();
});

function applyAppearance() {
  document.body.dataset.theme = theme;
  document.body.classList.toggle("dark", darkMode);

  document.querySelectorAll(".theme-choice").forEach(button => {
    button.classList.toggle("selected", button.dataset.theme === theme);
  });

  $("light-mode").classList.toggle("selected", !darkMode);
  $("dark-mode").classList.toggle("selected", darkMode);
}

document.querySelectorAll(".theme-choice").forEach(button => {
  button.addEventListener("click", () => {
    theme = button.dataset.theme;
    saveData();
    applyAppearance();
  });
});

$("light-mode").addEventListener("click", () => {
  darkMode = false;
  saveData();
  applyAppearance();
});

$("dark-mode").addEventListener("click", () => {
  darkMode = true;
  saveData();
  applyAppearance();
});

let timerSeconds = 25 * 60;
let timerInterval = null;
let currentMinutes = 25;

function updateTimer() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;

  $("timer-display").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  $("timer-start").textContent = "Start";
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

document.querySelectorAll(".mode-btn").forEach(button => {
  button.addEventListener("click", () => {
    stopTimer();

    currentMinutes = Number(button.dataset.minutes);
    timerSeconds = currentMinutes * 60;
    $("timer-mode").textContent = button.dataset.mode;

    document.querySelectorAll(".mode-btn").forEach(item => {
      item.classList.toggle("selected", item === button);
    });

    updateTimer();
  });
});

$("timer-start").addEventListener("click", () => {
  if (timerInterval) {
    stopTimer();
    return;
  }

  $("timer-start").textContent = "Pause";

  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimer();
    } else {
      stopTimer();
      playTimerSound();

      if (currentMinutes === 25) {
        points += 5;
        saveData();
        renderDashboard();
      }

      alert(currentMinutes === 25
        ? "Focus session finished! You earned 5 points."
        : "Break finished! Ready to study again?");
    }
  }, 1000);
});

$("timer-reset").addEventListener("click", () => {
  stopTimer();
  timerSeconds = currentMinutes * 60;
  updateTimer();
});

$("export-data").addEventListener("click", () => {
  const data = { assignments, grades, goals, points, theme, darkMode };

  const file = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "studytrack-data.json";
  link.click();
  URL.revokeObjectURL(url);
});

$("clear-data").addEventListener("click", () => {
  if (!confirm("Are you sure? This will permanently delete your StudyTrack data from this browser.")) {
    return;
  }

  assignments = [];
  grades = [];
  goals = [];
  points = 0;

  saveData();
  renderAll();
});

function renderAll() {
  renderAssignments();
  renderGrades();
  renderGoals();
  renderCalendar();
  renderDashboard();
}

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric"
});

applyAppearance();
updateTimer();
renderAll();
