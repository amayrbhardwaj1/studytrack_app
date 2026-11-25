
let assignments = JSON.parse(localStorage.getItem("assignments")) || [];
let grades = JSON.parse(localStorage.getItem("grades")) || [];
let goals = JSON.parse(localStorage.getItem("goals")) || [];
let points = Number(localStorage.getItem("points")) || 0;

function saveData() {
    localStorage.setItem("assignments", JSON.stringify(assignments));
    localStorage.setItem("grades", JSON.stringify(grades));
    localStorage.setItem("goals", JSON.stringify(goals));
    localStorage.setItem("points", points);
}

/* PAGE NAVIGATION */

const pageInfo = {
    dashboard: ["Dashboard", "Welcome back! Let's get things done."],
    assignments: ["Assignments", "Organize your schoolwork."],
    timer: ["Study Timer", "Make time for focused studying."],
    grades: ["Grade Tracker", "Keep an eye on your grades."],
    goals: ["My Goals", "Keep working towards your goals."],
    settings: ["Settings", "Customize your StudySmart experience."]
};

function showPage(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.remove("active");
    });

    document.getElementById(page).classList.add("active");

    document.querySelectorAll(".nav-button").forEach(button => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    document.getElementById("pageTitle").textContent = pageInfo[page][0];
    document.getElementById("pageSubtitle").textContent = pageInfo[page][1];
}

document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });
});

/* HELPER FUNCTIONS */

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}

function showEmpty(container, message) {
    container.replaceChildren(
        createElement("p", "empty-message", message)
    );
}

function formatDate(date) {
    if (!date) return "No due date";

    return new Date(date + "T00:00:00").toLocaleDateString();
}

/* ASSIGNMENTS */

function updateAssignments() {
    const list = document.getElementById("assignmentList");
    const dashboardList = document.getElementById("dashboardAssignments");

    list.replaceChildren();
    dashboardList.replaceChildren();

    const sortedAssignments = [...assignments].sort((a, b) => {
        return (a.date || "").localeCompare(b.date || "");
    });

    if (assignments.length === 0) {
        showEmpty(list, "No assignments yet. Add one above!");
        showEmpty(dashboardList, "Your upcoming assignments will appear here.");
    }

    sortedAssignments.forEach((assignment) => {
        const originalIndex = assignments.indexOf(assignment);

        const row = createElement("div", "item-row");
        const info = createElement("div", "item-info");

        const name = createElement(
            "strong",
            assignment.done ? "done-text" : "",
            assignment.name
        );

        const details = createElement(
            "span",
            "",
            assignment.subject + " • Due " + formatDate(assignment.date)
        );

        info.append(name, details);

        const actions = createElement("div", "item-actions");

        const priority = createElement(
            "span",
            "priority " + assignment.priority,
            assignment.priority
        );

        const complete = createElement(
            "button",
            "complete-button",
            assignment.done ? "Undo" : "Complete"
        );

        complete.addEventListener("click", () => {
            assignment.done = !assignment.done;

            if (assignment.done) {
                points += 10;
            } else {
                points = Math.max(0, points - 10);
            }

            saveData();
            updateAll();
        });

        const deleteButton = createElement(
            "button",
            "delete-button",
            "Delete"
        );

        deleteButton.addEventListener("click", () => {
            assignments.splice(originalIndex, 1);
            saveData();
            updateAll();
        });

        actions.append(priority, complete, deleteButton);
        row.append(info, actions);
        list.append(row);

        if (!assignment.done) {
            const dashboardRow = createElement("div", "item-row");
            const dashboardInfo = createElement("div", "item-info");

            dashboardInfo.append(
                createElement("strong", "", assignment.name),
                createElement(
                    "span",
                    "",
                    assignment.subject + " • " + formatDate(assignment.date)
                )
            );

            dashboardRow.append(dashboardInfo);
            dashboardList.append(dashboardRow);
        }
    });

    if (dashboardList.children.length === 0 && assignments.length > 0) {
        showEmpty(dashboardList, "All caught up! No unfinished assignments.");
    }

    const completedCount = assignments.filter(a => a.done).length;
    const totalCount = assignments.length;
    const remainingCount = totalCount - completedCount;

    const percentage = totalCount === 0
        ? 0
        : Math.round((completedCount / totalCount) * 100);

    document.getElementById("total").textContent = totalCount;
    document.getElementById("completed").textContent = completedCount;
    document.getElementById("remaining").textContent = remainingCount;
    document.getElementById("points").textContent = points;
    document.getElementById("progress").style.width = percentage + "%";
    document.getElementById("progressText").textContent = percentage + "%";
    document.getElementById("assignmentCount").textContent =
        totalCount + (totalCount === 1 ? " assignment" : " assignments");
}

document.getElementById("assignmentForm").addEventListener("submit", function(event) {
    event.preventDefault();

    assignments.push({
        name: document.getElementById("assignmentName").value.trim(),
        subject: document.getElementById("subject").value,
        date: document.getElementById("dueDate").value,
        priority: document.getElementById("priority").value,
        done: false
    });

    saveData();
    this.reset();
    document.getElementById("priority").value = "Medium";
    updateAll();
});

/* GRADES */

function updateGrades() {
    const list = document.getElementById("gradeList");
    list.replaceChildren();

    if (grades.length === 0) {
        showEmpty(list, "No grades yet. Add your first grade!");
    }

    grades.forEach((grade, index) => {
        const row = createElement("div", "item-row");
        const info = createElement("div", "item-info");

        info.append(
            createElement("strong", "", grade.subject),
            createElement("span", "", "Grade: " + grade.value + "%")
        );

        const deleteButton = createElement(
            "button",
            "delete-button",
            "Delete"
        );

        deleteButton.addEventListener("click", () => {
            grades.splice(index, 1);
            saveData();
            updateGrades();
        });

        row.append(info, deleteButton);
        list.append(row);
    });

    const average = grades.length === 0
        ? 0
        : grades.reduce((total, grade) => total + grade.value, 0) / grades.length;

    document.getElementById("average").textContent =
        average.toFixed(1) + "%";
}

document.getElementById("gradeForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const value = Number(document.getElementById("gradeValue").value);

    if (value < 0 || value > 100) {
        alert("Please enter a grade between 0 and 100.");
        return;
    }

    grades.push({
        subject: document.getElementById("gradeSubject").value.trim(),
        value: value
    });

    saveData();
    this.reset();
    updateGrades();
});

/* GOALS */

function updateGoals() {
    const list = document.getElementById("goalList");
    list.replaceChildren();

    if (goals.length === 0) {
        showEmpty(list, "No goals yet. Create one to get started!");
    }

    goals.forEach((goal, index) => {
        const row = createElement("div", "item-row");
        const info = createElement("div", "item-info");

        info.append(
            createElement(
                "strong",
                goal.done ? "done-text" : "",
                goal.name
            ),
            createElement(
                "span",
                "",
                goal.done ? "Goal completed!" : "Keep working towards it!"
            )
        );

        const actions = createElement("div", "item-actions");

        const complete = createElement(
            "button",
            "complete-button",
            goal.done ? "Undo" : "Complete"
        );

        complete.addEventListener("click", () => {
            goal.done = !goal.done;
            saveData();
            updateGoals();
        });

        const deleteButton = createElement(
            "button",
            "delete-button",
            "Delete"
        );

        deleteButton.addEventListener("click", () => {
            goals.splice(index, 1);
            saveData();
            updateGoals();
        });

        actions.append(complete, deleteButton);
        row.append(info, actions);
        list.append(row);
    });
}

document.getElementById("goalForm").addEventListener("submit", function(event) {
    event.preventDefault();

    goals.push({
        name: document.getElementById("goalName").value.trim(),
        done: false
    });

    saveData();
    this.reset();
    updateGoals();
});

/* STUDY TIMER */

let seconds = 25 * 60;
let timer = null;
let currentMinutes = 25;
let currentLabel = "Focus time";

let sessions = Number(localStorage.getItem("sessions")) || 0;

function displayTime() {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    document.getElementById("time").textContent =
        String(minutes).padStart(2, "0") + ":" +
        String(remainingSeconds).padStart(2, "0");
}

function setTimer(minutes, button, label) {
    clearInterval(timer);
    timer = null;

    currentMinutes = minutes;
    currentLabel = label;
    seconds = minutes * 60;

    document.getElementById("timerLabel").textContent = label.toUpperCase();
    document.getElementById("timerMessage").textContent = "Ready when you are.";

    document.querySelectorAll(".mode-button").forEach(button => {
        button.classList.remove("selected");
    });

    button.classList.add("selected");
    displayTime();
}

function startTimer() {
    if (timer !== null) return;

    if (seconds <= 0) {
        seconds = currentMinutes * 60;
    }

    document.getElementById("timerMessage").textContent = "You've got this!";

    timer = setInterval(() => {
        if (seconds > 0) {
            seconds--;
            displayTime();
        } else {
            clearInterval(timer);
            timer = null;

            if (currentLabel === "Focus time") {
                sessions++;
                localStorage.setItem("sessions", sessions);
                document.getElementById("sessions").textContent = sessions;
            }

            document.getElementById("timerMessage").textContent =
                currentLabel + " completed!";

            alert(currentLabel + " is finished!");
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timer);
    timer = null;
    document.getElementById("timerMessage").textContent = "Timer paused.";
}

function resetTimer() {
    clearInterval(timer);
    timer = null;
    seconds = currentMinutes * 60;
    document.getElementById("timerMessage").textContent = "Timer reset.";
    displayTime();
}

/* THEMES AND DARK MODE */

const themeButtons = document.querySelectorAll(".theme-option");

function changeTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem("theme", theme);

    themeButtons.forEach(button => {
        button.classList.toggle("selected", button.dataset.choice === theme);
    });
}

function changeMode(mode) {
    document.body.dataset.mode = mode;
    localStorage.setItem("mode", mode);

    document.getElementById("lightMode").classList.toggle(
        "selected",
        mode === "light"
    );

    document.getElementById("darkMode").classList.toggle(
        "selected",
        mode === "dark"
    );
}

themeButtons.forEach(button => {
    button.addEventListener("click", () => {
        changeTheme(button.dataset.choice);
    });
});

/* LOAD SAVED SETTINGS */

const savedTheme = localStorage.getItem("theme") || "ocean";
const savedMode = localStorage.getItem("mode") || "light";

changeTheme(savedTheme);
changeMode(savedMode);

/* UPDATE EVERYTHING */

function updateAll() {
    updateAssignments();
    updateGrades();
    updateGoals();

    document.getElementById("sessions").textContent = sessions;
}

updateAll();
displayTime();
