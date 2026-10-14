/* =====================================
   EduFlow Ultra X - script.js
   ===================================== */

"use strict";

// ---------- Helper Functions ----------

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

function loadData(key, fallback = []) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error("Unable to load saved data:", error);
    return fallback;
  }
}

function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Unable to save data:", error);
    showToast("Unable to save data. Check browser storage.");
    return false;
  }
}

function createId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9)
  );
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function formatDate(dateString) {
  if (!dateString) return "No due date";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function showToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timeout);

  showToast.timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function showEmptyState(container, title, message, icon = "✦") {
  container.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

// ---------- Application Data ----------

let tasks = loadData("eduflow_tasks");
let notes = loadData("eduflow_notes");

if (!Array.isArray(tasks)) tasks = [];
if (!Array.isArray(notes)) notes = [];

let focusSessions = Number(
  localStorage.getItem("eduflow_focus_sessions") || 0
);

let focusMinutes = Number(
  localStorage.getItem("eduflow_focus_minutes") || 0
);

// ---------- Navigation ----------

const pageNames = {
  dashboard: "Dashboard",
  tasks: "My Tasks",
  notes: "Study Notes",
  focus: "Focus Timer"
};

function navigateTo(page) {
  const pageElement = $(`#${page}Page`);

  if (!pageElement) return;

  $$(".page").forEach((element) => {
    element.classList.remove("active");
  });

  pageElement.classList.add("active");

  $$(".nav-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  $("#pageTitle").textContent = pageNames[page] || "Dashboard";

  $("#sidebar").classList.remove("open");

  if (page === "dashboard") renderDashboard();
  if (page === "tasks") renderTasks();
  if (page === "notes") renderNotes();
  if (page === "focus") updateFocusStats();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.page);
  });
});

$$("[data-goto]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateTo(button.dataset.goto);
  });
});

$("#menuButton").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

// ---------- Dashboard ----------

function renderDashboard() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;

  $("#totalTasks").textContent = total;
  $("#completedTasks").textContent = completed;
  $("#pendingTasks").textContent = pending;
  $("#totalNotes").textContent = notes.length;

  $("#progressCompleted").textContent = completed;
  $("#progressPending").textContent = pending;

  const percentage = total
    ? Math.round((completed / total) * 100)
    : 0;

  $("#progressPercentage").textContent = `${percentage}%`;

  const circle = $("#progressCircle");

  circle.style.background = `
    conic-gradient(
      var(--primary) ${percentage * 3.6}deg,
      #eeedfa ${percentage * 3.6}deg
    )
  `;

  const dashboardList = $("#dashboardTaskList");

  if (!tasks.length) {
    showEmptyState(
      dashboardList,
      "No tasks yet",
      "Add your first task to get started.",
      "✓"
    );

    return;
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  dashboardList.innerHTML = sortedTasks
    .slice(0, 5)
    .map((task) => createTaskHTML(task, false))
    .join("");

  attachTaskEvents(dashboardList);
}

// ---------- Task Management ----------

const taskFormPanel = $("#taskFormPanel");
const taskForm = $("#taskForm");

function openTaskForm(task = null) {
  taskForm.reset();

  $("#taskId").value = task ? task.id : "";

  $("#taskTitle").value = task ? task.title : "";
  $("#taskCategory").value = task ? task.category || "" : "";
  $("#taskPriority").value = task ? task.priority || "medium" : "medium";
  $("#taskDueDate").value = task ? task.dueDate || "" : "";

  $("#taskFormHeading").textContent = task
    ? "Edit task"
    : "Create a new task";

  taskFormPanel.classList.remove("hidden");

  taskFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("#taskTitle").focus();
}

function closeTaskForm() {
  taskFormPanel.classList.add("hidden");
  taskForm.reset();
  $("#taskId").value = "";
}

$("#showTaskForm").addEventListener("click", () => {
  openTaskForm();
});

$("#quickAddTask").addEventListener("click", () => {
  navigateTo("tasks");
  openTaskForm();
});

$("#closeTaskForm").addEventListener("click", closeTaskForm);

$("#cancelTaskForm").addEventListener("click", closeTaskForm);

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("#taskId").value;
  const title = $("#taskTitle").value.trim();

  if (!title) {
    showToast("Please enter a task title.");
    return;
  }

  const existingTask = tasks.find((task) => task.id === id);

  const task = {
    id: id || createId(),
    title,
    category: $("#taskCategory").value.trim(),
    priority: $("#taskPriority").value,
    dueDate: $("#taskDueDate").value,
    completed: existingTask ? existingTask.completed : false,
    createdAt: existingTask
      ? existingTask.createdAt
      : Date.now()
  };

  if (id) {
    tasks = tasks.map((item) =>
      item.id === id ? task : item
    );
  } else {
    tasks.unshift(task);
  }

  if (!saveData("eduflow_tasks", tasks)) return;

  closeTaskForm();
  renderTasks();
  renderDashboard();

  showToast(id ? "Task updated successfully!" : "Task added successfully!");
});

function createTaskHTML(task, showActions = true) {
  const priority = ["high", "medium", "low"].includes(task.priority)
    ? task.priority
    : "medium";

  return `
    <div class="task-item ${task.completed ? "completed" : ""}">
      <input
        type="checkbox"
        class="task-checkbox"
        data-task-action="toggle"
        data-id="${escapeHTML(task.id)}"
        ${task.completed ? "checked" : ""}
        aria-label="Mark ${escapeHTML(task.title)} as completed"
      >

      <div class="task-details">
        <div class="task-title">${escapeHTML(task.title)}</div>

        <div class="task-meta">
          ${
            task.category
              ? `<span>${escapeHTML(task.category)}</span>`
              : ""
          }

          ${
            task.dueDate
              ? `<span>Due: ${escapeHTML(formatDate(task.dueDate))}</span>`
              : ""
          }

          <span class="priority-badge priority-${priority}">
            ${escapeHTML(priority.charAt(0).toUpperCase() + priority.slice(1))}
          </span>
        </div>
      </div>

      ${
        showActions
          ? `
            <div class="task-actions">
              <button
                class="small-action"
                data-task-action="edit"
                data-id="${escapeHTML(task.id)}"
                aria-label="Edit task"
                title="Edit task"
              >✎</button>

              <button
                class="small-action delete"
                data-task-action="delete"
                data-id="${escapeHTML(task.id)}"
                aria-label="Delete task"
                title="Delete task"
              >✕</button>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function getFilteredTasks() {
  const query = $("#taskSearch").value.trim().toLowerCase();
  const filter = $("#taskFilter").value;
  const sort = $("#taskSort").value;

  let result = tasks.filter((task) => {
    const matchesQuery =
      task.title.toLowerCase().includes(query) ||
      (task.category || "").toLowerCase().includes(query);

    const matchesFilter =
      filter === "all" ||
      (filter === "completed" && task.completed) ||
      (filter === "pending" && !task.completed);

    return matchesQuery && matchesFilter;
  });

  if (sort === "priority") {
    const rank = {
      high: 1,
      medium: 2,
      low: 3
    };

    result.sort(
      (a, b) =>
        (rank[a.priority] || 2) - (rank[b.priority] || 2)
    );
  } else if (sort === "dueDate") {
    result.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;

      return a.dueDate.localeCompare(b.dueDate);
    });
  } else {
    result.sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }

  return result;
}

function renderTasks() {
  const container = $("#taskList");
  const filteredTasks = getFilteredTasks();

  if (!filteredTasks.length) {
    showEmptyState(
      container,
      "No matching tasks",
      tasks.length
        ? "Try another search or filter."
        : "Create your first task to get started.",
      "✓"
    );
  } else {
    container.innerHTML = filteredTasks
      .map((task) => createTaskHTML(task, true))
      .join("");
  }

  attachTaskEvents(container);
}

function attachTaskEvents(container) {
  container.querySelectorAll("[data-task-action]").forEach((element) => {
    element.addEventListener("change", handleTaskAction);
    element.addEventListener("click", handleTaskAction);
  });
}

function handleTaskAction(event) {
  const action = event.currentTarget.dataset.taskAction;
  const id = event.currentTarget.dataset.id;

  if (!action || !id) return;

  if (action === "toggle") {
    const checkbox = event.currentTarget;

    tasks = tasks.map((task) =>
      task.id === id
        ? { ...task, completed: checkbox.checked }
        : task
    );

    if (!saveData("eduflow_tasks", tasks)) return;

    renderTasks();
    renderDashboard();

    showToast(
      checkbox.checked
        ? "Great work! Task completed."
        : "Task marked as pending."
    );
  }

  if (action === "edit") {
    const task = tasks.find((item) => item.id === id);

    if (task) openTaskForm(task);
  }

  if (action === "delete") {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) return;

    tasks = tasks.filter((task) => task.id !== id);

    if (!saveData("eduflow_tasks", tasks)) return;

    renderTasks();
    renderDashboard();

    showToast("Task deleted.");
  }
}

$("#taskSearch").addEventListener("input", renderTasks);
$("#taskFilter").addEventListener("change", renderTasks);
$("#taskSort").addEventListener("change", renderTasks);

// ---------- Study Notes ----------

const noteFormPanel = $("#noteFormPanel");
const noteForm = $("#noteForm");

function openNoteForm(note = null) {
  noteForm.reset();

  $("#noteId").value = note ? note.id : "";
  $("#noteTitle").value = note ? note.title : "";
  $("#noteCategory").value = note ? note.category || "" : "";
  $("#noteContent").value = note ? note.content : "";

  $("#noteFormHeading").textContent = note
    ? "Edit study note"
    : "Create a study note";

  noteFormPanel.classList.remove("hidden");

  noteFormPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  $("#noteTitle").focus();
}

function closeNoteForm() {
  noteFormPanel.classList.add("hidden");
  noteForm.reset();
  $("#noteId").value = "";
}

$("#showNoteForm").addEventListener("click", () => {
  openNoteForm();
});

$("#closeNoteForm").addEventListener("click", closeNoteForm);
$("#cancelNoteForm").addEventListener("click", closeNoteForm);

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("#noteId").value;
  const title = $("#noteTitle").value.trim();
  const content = $("#noteContent").value.trim();

  if (!title || !content) {
    showToast("Please enter a title and note content.");
    return;
  }

  const existingNote = notes.find((note) => note.id === id);

  const note = {
    id: id || createId(),
    title,
    category: $("#noteCategory").value.trim(),
    content,
    createdAt: existingNote ? existingNote.createdAt : Date.now(),
    updatedAt: Date.now()
  };

  if (id) {
    notes = notes.map((item) =>
      item.id === id ? note : item
    );
  } else {
    notes.unshift(note);
  }

  if (!saveData("eduflow_notes", notes)) return;

  closeNoteForm();
  renderNotes();
  renderDashboard();

  showToast(id ? "Note updated!" : "Note saved successfully!");
});

function renderNotes() {
  const container = $("#notesGrid");
  const query = $("#noteSearch").value.trim().toLowerCase();

  const filteredNotes = notes.filter((note) => {
    return (
      note.title.toLowerCase().includes(query) ||
      (note.category || "").toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  if (!filteredNotes.length) {
    showEmptyState(
      container,
      "No notes found",
      notes.length
        ? "Try a different search term."
        : "Create your first study note.",
      "▤"
    );

    return;
  }

  container.innerHTML = filteredNotes.map((note) => `
    <article class="note-card">
      <div class="note-card-top">
        <span class="note-icon">▤</span>

        <div class="note-actions">
          <button
            class="small-action"
            data-note-action="edit"
            data-id="${escapeHTML(note.id)}"
            aria-label="Edit note"
            title="Edit note"
          >✎</button>

          <button
            class="small-action delete"
            data-note-action="delete"
            data-id="${escapeHTML(note.id)}"
            aria-label="Delete note"
            title="Delete note"
          >✕</button>
        </div>
      </div>

      <h3>${escapeHTML(note.title)}</h3>

      ${
        note.category
          ? `<span class="note-category">${escapeHTML(note.category)}</span>`
          : ""
      }

      <p class="note-content-preview">${escapeHTML(note.content)}</p>

      <div class="note-card-footer">
        <small>
          ${escapeHTML(formatDate(
            new Date(note.updatedAt || note.createdAt).toISOString().slice(0, 10)
          ))}
        </small>

        <button
          class="text-button"
          data-note-action="edit"
          data-id="${escapeHTML(note.id)}"
        >Open note →</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-note-action]").forEach((button) => {
    button.addEventListener("click", handleNoteAction);
  });
}

function handleNoteAction(event) {
  const action = event.currentTarget.dataset.noteAction;
  const id = event.currentTarget.dataset.id;

  if (action === "edit") {
    const note = notes.find((item) => item.id === id);

    if (note) openNoteForm(note);
  }

  if (action === "delete") {
    const confirmed = window.confirm(
      "Are you sure you want to delete this note?"
    );

    if (!confirmed) return;

    notes = notes.filter((note) => note.id !== id);

    if (!saveData("eduflow_notes", notes)) return;

    renderNotes();
    renderDashboard();

    showToast("Note deleted.");
  }
}

$("#noteSearch").addEventListener("input", renderNotes);

// ---------- Focus Timer ----------

const timerDisplay = $("#timerDisplay");
const timerStatus = $("#timerStatus");
const timerModeLabel = $("#timerModeLabel");
const timerCircle = $("#timerCircle");
const startTimerButton = $("#startTimer");

let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerInterval = null;
let timerRunning = false;
let timerMode = "focus";
let timerEndTime = null;

function updateTimerDisplay() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const percentage = timerDuration
    ? ((timerDuration - timerRemaining) / timerDuration) * 360
    : 0;

  timerCircle.style.background = `
    conic-gradient(
      var(--primary) ${percentage}deg,
      #efeff8 ${percentage}deg
    )
  `;

  document.title = timerRunning
    ? `${timerDisplay.textContent} - EduFlow`
    : "EduFlow Ultra X | Student Dashboard";
}

function setTimerMode(mode, minutes) {
  pauseTimer();

  timerMode = mode;
  timerDuration = minutes * 60;
  timerRemaining = timerDuration;
  timerEndTime = null;

  $$(".timer-mode").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.mode === mode
    );
  });

  const labels = {
    focus: "FOCUS SESSION",
    short: "SHORT BREAK",
    long: "LONG BREAK"
  };

  timerModeLabel.textContent = labels[mode] || "FOCUS SESSION";
  timerStatus.textContent = "Ready to begin?";
  startTimerButton.textContent = "▶ Start";

  updateTimerDisplay();
}

$$(".timer-mode").forEach((button) => {
  button.addEventListener("click", () => {
    setTimerMode(
      button.dataset.mode,
      Number(button.dataset.minutes)
    );
  });
});

function startTimer() {
  if (timerRunning) {
    pauseTimer();
    return;
  }

  if (timerRemaining <= 0) {
    timerRemaining = timerDuration;
  }

  timerRunning = true;
  timerEndTime = Date.now() + timerRemaining * 1000;

  startTimerButton.textContent = "Ⅱ Pause";
  timerStatus.textContent = "Stay focused!";

  timerInterval = setInterval(() => {
    timerRemaining = Math.max(
      0,
      Math.ceil((timerEndTime - Date.now()) / 1000)
    );

    updateTimerDisplay();

    if (timerRemaining <= 0) {
      completeTimer();
    }
  }, 250);

  updateTimerDisplay();
}

function pauseTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
  timerEndTime = null;

  if (startTimerButton) {
    startTimerButton.textContent = "▶ Resume";
  }

  if (timerStatus) {
    timerStatus.textContent = "Timer paused.";
  }

  updateTimerDisplay();
}

function resetTimer() {
  pauseTimer();

  timerRemaining = timerDuration;

  startTimerButton.textContent = "▶ Start";
  timerStatus.textContent = "Ready to begin?";

  updateTimerDisplay();
}

function completeTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
  timerEndTime = null;
  timerRemaining = 0;

  if (timerMode === "focus") {
    focusSessions += 1;
    focusMinutes += timerDuration / 60;

    localStorage.setItem(
      "eduflow_focus_sessions",
      String(focusSessions)
    );

    localStorage.setItem(
      "eduflow_focus_minutes",
      String(focusMinutes)
    );

    timerStatus.textContent = "Focus session completed!";
    showToast("Excellent! You completed a focus session.");
  } else {
    timerStatus.textContent = "Break completed!";
    showToast("Break finished. Ready when you are!");
  }

  
