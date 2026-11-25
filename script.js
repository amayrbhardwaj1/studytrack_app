
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

const SUPABASE_READY = SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_") &&
  !SUPABASE_ANON_KEY.includes("PASTE_");

let supabaseClient = null;

if (SUPABASE_READY && window.supabase) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

const $ = id => document.getElementById(id);

const validThemes = [
  "ocean", "mocha", "summer", "voltage",
  "forest", "blush", "midnight", "sunset"
];

let assignments = [];
let grades = [];
let goals = [];
let points = 0;
let sessions = 0;
let currentUser = null;
let authMode = "login";
let syncTimer = null;
let tickHandle = null;

let timerState = {
  minutes: 25,
  label: "Focus time",
  remaining: 1500,
  endAt: null,
  running: false
};

function readLocal(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function localData() {
  return {
    assignments,
    grades,
    goals,
    points,
    sessions,
    theme: document.body.dataset.theme || "ocean",
    mode: document.body.dataset.mode || "light"
  };
}

function applyData(data = {}) {
  assignments = Array.isArray(data.assignments) ? data.assignments : [];
  grades = Array.isArray(data.grades) ? data.grades : [];
  goals = Array.isArray(data.goals) ? data.goals : [];
  points = Number(data.points) || 0;
  sessions = Number(data.sessions) || 0;

  if (validThemes.includes(data.theme)) changeTheme(data.theme, false);
  changeMode(data.mode === "dark" ? "dark" : "light", false);

  saveLocal();
  updateAll();
}

function saveLocal() {
  localStorage.setItem("studytrack_data", JSON.stringify(localData()));
}

function scheduleSync() {
  saveLocal();

  if (!currentUser || !supabaseClient) return;

  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToCloud, 700);
}

async function syncToCloud() {
  if (!currentUser || !supabaseClient) return;

  const payload = {
    user_id: currentUser.id,
    data: localData(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("studytrack_data")
    .upsert(payload, { onConflict: "user_id" });

  if (error) console.error("StudyTrack sync error:", error.message);
}

async function loadCloudData() {
  const { data, error } = await supabaseClient
    .from("studytrack_data")
    .select("data")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    applyData(readLocal("studytrack_data", {}));
    return;
  }

  if (data && data.data) {
    applyData(data.data);
  } else {
    applyData(readLocal("studytrack_data", {}));
    await syncToCloud();
  }
}

/* LOGIN AND SIGNUP */

function setAuthMode(mode) {
  authMode = mode;

  $("showLogin").classList.toggle("active", mode === "login");
  $("showSignup").classList.toggle("active", mode === "signup");

  $("authSubmit").textContent =
    mode === "login" ? "Log in" : "Create free account";

  $("authPassword").autocomplete =
    mode === "login" ? "current-password" : "new-password";

  $("authMessage").textContent =
    mode === "login"
      ? "Log in to continue to StudyTrack."
      : "Create your free StudyTrack account.";
}

$("showLogin").addEventListener("click", () => setAuthMode("login"));
$("showSignup").addEventListener("click", () => setAuthMode("signup"));

function showApp() {
  $("authScreen").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("userEmail").textContent = currentUser?.email || "";
}

function showAuth() {
  $("app").classList.add("hidden");
  $("authScreen").classList.remove("hidden");
}

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait…";

  try {
    if (!supabaseClient) {
      $("authMessage").textContent =
        "Connect Supabase first. Add your project URL and public key in script.js.";
      return;
    }

    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;

    if (authMode === "signup" && !result.data.session) {
      $("authMessage").textContent =
        "Account created! Check your email to confirm it, then log in.";
      setAuthMode("login");
      return;
    }

    currentUser = result.data.user;
    await loadCloudData();
    showApp();

  } catch (error) {
    $("authMessage").textContent =
      error.message || "Could not sign in. Please try again.";
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("logoutButton").addEventListener("click", async () => {
  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error(error);
  }

  currentUser = null;
  showAuth();
});

async function initializeAuth() {
  if (!supabaseClient) {
    applyData(readLocal("studytrack_data", {}));
    showAuth();
    $("authMessage").textContent =
      "Supabase setup is needed for accounts. Add your free project keys in script.js.";
    return;
  }

  const { data: { session } } =
    await supabaseClient.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    await loadCloudData();
    showApp();
  } else {
    showAuth();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, sessionNow) => {
    if (sessionNow?.user) {
      currentUser = sessionNow.user;
      await loadCloudData();
      showApp();
    } else {
      currentUser = null;
      showAuth();
    }
  });
}

/* NAVIGATION */

const pageInfo = {
  dashboard: ["Dashboard", "Welcome back! Let's get things done."],
  assignments: ["Assignments", "Organize your schoolwork."],
  timer: ["Study Timer", "Make time for focused studying."],
  grades: ["Grade Tracker", "Keep an eye on your grades."],
  goals: ["My Goals", "Keep working towards your goals."],
  settings: ["Settings", "Customize your StudyTrack experience."]
};

function showPage(page) {
  if (!pageInfo[page]) return;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === page);
  });

  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("pageTitle").textContent = pageInfo[page][0];
  $("pageSubtitle").textContent = pageInfo[page][1];
}

document.querySelectorAll(".nav-button").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

/* ASSIGNMENTS */

function make(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function empty(container, message) {
  container.replaceChildren(make("p", "empty-message", message));
}

function formatDate(date) {
  if (!date) return "No due date";

  const parsed = new Date(`${date}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString();
}

function updateAssignments() {
  const list = $("assignmentList");
  const dashboard = $("dashboardAssignments");

  list.replaceChildren();
  dashboard.replaceChildren();

  const sorted = [...assignments].sort((a, b) =>
    (a.date || "").localeCompare(b.date || "")
  );

  if (!sorted.length) {
    empty(list, "No assignments yet. Import a calendar or add one above!");
    empty(dashboard, "Your upcoming assignments will appear here.");
  }

  sorted.forEach(item => {
    const row = make("div", "item-row");
    const info = make("div", "item-info");

    info.append(
      make("strong", item.done ? "done-text" : "", item.name),
      make("span", "", `${item.subject || "School"} • Due ${formatDate(item.date)}`)
    );

    const actions = make("div", "item-actions");

    actions.append(
      make("span", `priority ${item.priority || "Medium"}`, item.priority || "Medium")
    );

    const complete = make(
      "button",
      "complete-button",
      item.done ? "Undo" : "Complete"
    );

    complete.addEventListener("click", () => {
      item.done = !item.done;
      points = Math.max(0, points + (item.done ? 10 : -10));
      scheduleSync();
      updateAll();
    });

    const remove = make("button", "delete-button", "Delete");

    remove.addEventListener("click", () => {
      assignments = assignments.filter(a => a.id !== item.id);
      scheduleSync();
      updateAll();
    });

    actions.append(complete, remove);
    row.append(info, actions);
    list.append(row);

    if (!item.done) {
      const dashRow = make("div", "item-row");
      const dashInfo = make("div", "item-info");

      dashInfo.append(
        make("strong", "", item.name),
        make("span", "", `${item.subject || "School"} • ${formatDate(item.date)}`)
      );

      dashRow.append(dashInfo);
      dashboard.append(dashRow);
    }
  });

  if (!dashboard.children.length && assignments.length) {
    empty(dashboard, "All caught up! No unfinished assignments.");
  }

  const done = assignments.filter(a => a.done).length;
  const total = assignments.length;
  const percent = total ? Math.round(done / total * 100) : 0;

  $("total").textContent = total;
  $("completed").textContent = done;
  $("remaining").textContent = total - done;
  $("points").textContent = points;
  $("progress").style.width = `${percent}%`;
  $("progressText").textContent = `${percent}%`;

  $("assignmentCount").textContent =
    `${total} assignment${total === 1 ? "" : "s"}`;
}

$("assignmentForm").addEventListener("submit", event => {
  event.preventDefault();

  assignments.push({
    id: crypto.randomUUID(),
    name: $("assignmentName").value.trim(),
    subject: $("subject").value,
    date: $("dueDate").value,
    priority: $("priority").value,
    done: false
  });

  event.target.reset();
  $("priority").value = "Medium";

  scheduleSync();
  updateAll();
});

/* CALENDAR IMPORT */

function parseICS(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const events = unfolded.split("BEGIN:VEVENT").slice(1);
  const result = [];

  for (const block of events) {
    const title = block.match(/^SUMMARY(?:;[^:]*)?:(.*)$/mi)?.[1]?.trim();

    const rawDate =
      block.match(/^DTSTART(?:;[^:]*)?:(\d{8})/mi)?.[1] ||
      block.match(/^DUE(?:;[^:]*)?:(\d{8})/mi)?.[1];

    if (!title || !rawDate) continue;

    const date =
      `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;

    result.push({
      name: title.replace(/\\n/g, " ").replace(/\\,/g, ","),
      date,
      subject: "Imported calendar",
      priority: "Medium",
      done: false
    });
  }

  return result;
}

function parseCSV(text) {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());

  if (rows.length < 2) return [];

  const split = line => {
    const cells = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"' && line[i + 1] === '"' && quoted) {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }

    cells.push(current.trim());
    return cells;
  };

  const headers = split(rows[0]).map(h => h.toLowerCase());

  const nameIndex = headers.findIndex(h =>
    /title|subject|assignment|event|summary|name/.test(h)
  );

  const dateIndex = headers.findIndex(h =>
    /due|date|start/.test(h)
  );

  if (nameIndex < 0 || dateIndex < 0) {
    throw new Error("CSV needs a title/assignment column and a date/due column.");
  }

  return rows.slice(1).map(line => {
    const cells = split(line);
    const raw = cells[dateIndex] || "";
    let date = raw;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      const [m, d, y] = raw.split("/");
      date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      date = raw.slice(0, 10);
    }

    return {
      name: cells[nameIndex],
      date,
      subject: "Imported calendar",
      priority: "Medium",
      done: false
    };
  }).filter(item =>
    item.name && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
  );
}

$("importCalendar").addEventListener("click", async () => {
  const file = $("calendarFile").files[0];
  const message = $("importMessage");

  if (!file) {
    message.textContent = "Choose an .ics or .csv file first.";
    return;
  }

  try {
    const text = await file.text();

    const imported = file.name.toLowerCase().endsWith(".ics")
      ? parseICS(text)
      : file.name.toLowerCase().endsWith(".csv")
        ? parseCSV(text)
        : null;

    if (!imported) {
      throw new Error("Please upload an .ics or .csv file.");
    }

    if (!imported.length) {
      throw new Error("I couldn't find calendar events with both a title and a date.");
    }

    const existing = new Set(
      assignments.map(a => `${a.name}|${a.date}`)
    );

    const unique = imported.filter(a =>
      !existing.has(`${a.name}|${a.date}`)
    );

    assignments.push(
      ...unique.map(a => ({ ...a, id: crypto.randomUUID() }))
    );

    scheduleSync();
    updateAll();

    message.textContent =
      `Imported ${unique.length} assignment(s). ${imported.length - unique.length} duplicate(s) skipped.`;

    $("calendarFile").value = "";

  } catch (error) {
    message.textContent = error.message;
  }
});

/* GRADES */

function updateGrades() {
  const list = $("gradeList");
  list.replaceChildren();

  if (!grades.length) {
    empty(list, "No grades yet. Add your first grade!");
  }

  grades.forEach(grade => {
    const row = make("div", "item-row");
    const info = make("div", "item-info");

    info.append(
      make("strong", "", grade.subject),
      make("span", "", `Grade: ${grade.value}%`)
    );

    const remove = make("button", "delete-button", "Delete");

    remove.addEventListener("click", () => {
      grades = grades.filter(g => g.id !== grade.id);
      scheduleSync();
      updateGrades();
    });

    row.append(info, remove);
    list.append(row);
  });

  const average = grades.length
    ? grades.reduce((sum, g) => sum + Number(g.value), 0) / grades.length
    : 0;

  $("average").textContent = `${average.toFixed(1)}%`;
}

$("gradeForm").addEventListener("submit", event => {
  event.preventDefault();

  const value = Number($("gradeValue").value);

  if (value < 0 || value > 100) {
    alert("Please enter a grade between 0 and 100.");
    return;
  }

  grades.push({
    id: crypto.randomUUID(),
    subject: $("gradeSubject").value.trim(),
    value
  });

  event.target.reset();
  scheduleSync();
  updateGrades();
});

/* GOALS */

function updateGoals() {
  const list = $("goalList");
  list.replaceChildren();

  if (!goals.length) {
    empty(list, "No goals yet. Create one to get started!");
  }

  goals.forEach(goal => {
    const row = make("div", "item-row");
    const info = make("div", "item-info");

    info.append(
      make("strong", goal.done ? "done-text" : "", goal.name),
      make("span", "", goal.done ? "Goal completed!" : "Keep working towards it!")
    );

    const actions = make("div", "item-actions");

    const complete = make(
      "button",
      "complete-button",
      goal.done ? "Undo" : "Complete"
    );

    complete.addEventListener("click", () => {
      goal.done = !goal.done;
      scheduleSync();
      updateGoals();
    });

    const remove = make("button", "delete-button", "Delete");

    remove.addEventListener("click", () => {
      goals = goals.filter(g => g.id !== goal.id);
      scheduleSync();
      updateGoals();
    });

    actions.append(complete, remove);
    row.append(info, actions);
    list.append(row);
  });
}

$("goalForm").addEventListener("submit", event => {
  event.preventDefault();

  goals.push({
    id: crypto.randomUUID(),
    name: $("goalName").value.trim(),
    done: false
  });

  event.target.reset();
  scheduleSync();
  updateGoals();
});

/* TIMER */

function saveTimer() {
  localStorage.setItem("studytrack_timer", JSON.stringify(timerState));
}

function renderTimer() {
  let seconds = timerState.remaining;

  if (timerState.running && timerState.endAt) {
    seconds = Math.max(
      0,
      Math.ceil((timerState.endAt - Date.now()) / 1000)
    );
  }

  timerState.remaining = seconds;

  $("time").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  $("timerLabel").textContent = timerState.label.toUpperCase();
  $("sessions").textContent = sessions;
}

function finishTimer() {
  timerState.running = false;
  timerState.endAt = null;
  timerState.remaining = 0;

  if (timerState.label === "Focus time") {
    sessions++;
    scheduleSync();
  }

  saveTimer();
  renderTimer();

  $("timerMessage").textContent =
    `${timerState.label} completed!`;

  if (document.visibilityState === "visible") {
    alert(`${timerState.label} is finished!`);
  }
}

function timerTick() {
  if (!timerState.running) return;

  if (Date.now() >= timerState.endAt) {
    finishTimer();
    return;
  }

  renderTimer();
  saveTimer();
}

function startTimer() {
  if (timerState.running) return;

  if (timerState.remaining <= 0) {
    timerState.remaining = timerState.minutes * 60;
  }

  timerState.endAt =
    Date.now() + timerState.remaining * 1000;

  timerState.running = true;

  $("timerMessage").textContent = "You've got this!";

  saveTimer();
  timerTick();

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(timerTick, 250);
}

function pauseTimer() {
  if (timerState.running) {
    timerState.remaining = Math.max(
      0,
      Math.ceil((timerState.endAt - Date.now()) / 1000)
    );
  }

  timerState.running = false;
  timerState.endAt = null;

  saveTimer();

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;

  $("timerMessage").textContent = "Timer paused.";
  renderTimer();
}

function resetTimer() {
  timerState.running = false;
  timerState.endAt = null;
  timerState.remaining = timerState.minutes * 60;

  saveTimer();

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;

  $("timerMessage").textContent = "Timer reset.";
  renderTimer();
}

function setTimer(minutes, label, button) {
  if (timerState.running) pauseTimer();

  timerState.minutes = minutes;
  timerState.label = label;
  timerState.remaining = minutes * 60;
  timerState.endAt = null;

  document.querySelectorAll(".mode-button").forEach(b => {
    b.classList.toggle("selected", b === button);
  });

  $("timerMessage").textContent = "Ready when you are.";

  saveTimer();
  renderTimer();
}

document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    setTimer(
      Number(button.dataset.minutes),
      button.dataset.label,
      button
    );
  });
});

$("startTimer").addEventListener("click", startTimer);
$("pauseTimer").addEventListener("click", pauseTimer);
$("resetTimer").addEventListener("click", resetTimer);

document.addEventListener("visibilitychange", () => {
  if (timerState.running) timerTick();
});

function restoreTimer() {
  const saved = readLocal("studytrack_timer", null);

  if (
    saved &&
    Number.isFinite(saved.minutes) &&
    Number.isFinite(saved.remaining)
  ) {
    timerState = saved;
  }

  if (
    timerState.running &&
    timerState.endAt &&
    Date.now() >= timerState.endAt
  ) {
    finishTimer();
  } else if (timerState.running) {
    tickHandle = setInterval(timerTick, 250);
  }

  renderTimer();
}

/* THEMES */

function changeTheme(theme, persist = true) {
  if (!validThemes.includes(theme)) theme = "ocean";

  document.body.dataset.theme = theme;

  document.querySelectorAll(".theme-option").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.choice === theme
    );
  });

  if (persist) scheduleSync();
}

function changeMode(mode, persist = true) {
  document.body.dataset.mode =
    mode === "dark" ? "dark" : "light";

  $("lightMode").classList.toggle("selected", mode !== "dark");
  $("darkMode").classList.toggle("selected", mode === "dark");

  if (persist) scheduleSync();
}

document.querySelectorAll(".theme-option").forEach(button => {
  button.addEventListener("click", () => {
    changeTheme(button.dataset.choice);
  });
});

$("lightMode").addEventListener("click", () => changeMode("light"));
$("darkMode").addEventListener("click", () => changeMode("dark"));

/* UPDATE WEBSITE */

function updateAll() {
  updateAssignments();
  updateGrades();
  updateGoals();
  $("sessions").textContent = sessions;
}

/* START */

async function boot() {
  applyData(readLocal("studytrack_data", {}));
  restoreTimer();
  await initializeAuth();
}

boot();
