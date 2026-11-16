(() => {
  const $ = id => document.getElementById(id);
  const KEY = "neon-day-3";

  const assistant = $("assistant");
  const messages = $("assistantMessages");
  const input = $("assistantInput");

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function saveLocal(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  }

  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function formatDate(date) {
    if (!date) return "";
    return date.split("-").reverse().join("/");
  }

  function say(text, who = "bot") {
    const el = document.createElement("div");
    el.className = `assistant-msg ${who}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function openAssistant() {
    assistant.classList.add("open");
    if (!messages.children.length) {
      say("Sistema NEON//ASSIST online. Puedo ayudarte a organizar tareas, consultar pendientes y crear recordatorios.");
    }
    input.focus();
  }

  function closeAssistant() {
    assistant.classList.remove("open");
  }

  function refreshMainUI() {
    if (typeof window.render === "function") window.render();
    document.dispatchEvent(new CustomEvent("neon-assist-updated"));
  }

  function makeTask(title, date, time = "", priority = "Media", category = "Personal") {
    const items = load();
    const task = {
      id: crypto.randomUUID(),
      title,
      date,
      time,
      category,
      priority,
      repeat: "none",
      reminder: time ? "0" : "none",
      description: "Creada mediante NEON//ASSIST",
      status: "Pendiente",
      createdAt: new Date().toISOString(),
      parent: null
    };
    items.push(task);
    saveLocal(items);
    refreshMainUI();
    return task;
  }

  function findTasks(text) {
    const q = text.toLowerCase();
    return load().filter(t =>
      `${t.title} ${t.description || ""} ${t.category || ""}`.toLowerCase().includes(q)
    );
  }

  function pendingFor(date) {
    return load()
      .filter(t => t.date === date && t.status === "Pendiente")
      .sort((a,b) => (a.time || "").localeCompare(b.time || ""));
  }

  function listFor(date, label) {
    const tasks = pendingFor(date);
    if (!tasks.length) return `No tienes tareas pendientes para ${label}. ✦`;
    return `Tareas pendientes para ${label}:\n` +
      tasks.map((t, i) => `${i + 1}. ${t.title}${t.time ? ` · ${t.time}` : ""}${t.priority === "Alta" ? " · ALTA" : ""}`).join("\n");
  }

  function priorityList() {
    const tasks = load().filter(t => t.status === "Pendiente" && t.priority === "Alta");
    if (!tasks.length) return "No hay tareas pendientes de prioridad alta. Todo tranquilo por ahora. 🟢";
    return "Prioridad alta:\n" + tasks.map(t => `• ${t.title} · ${formatDate(t.date)}${t.time ? ` ${t.time}` : ""}`).join("\n");
  }

  function completeTask(query) {
    const items = load();
    const q = query.toLowerCase();
    const task = items.find(t => t.status === "Pendiente" &&
      t.title.toLowerCase().includes(q));
    if (!task) return `No encuentro una tarea pendiente que coincida con "${query}".`;
    task.status = "Completada";
    saveLocal(items);
    refreshMainUI();
    return `✓ He marcado como completada: ${task.title}`;
  }

  function deleteTask(query) {
    const items = load();
    const q = query.toLowerCase();
    const index = items.findIndex(t => t.title.toLowerCase().includes(q));
    if (index < 0) return `No encuentro una tarea que coincida con "${query}".`;
    const removed = items.splice(index, 1)[0];
    saveLocal(items);
    refreshMainUI();
    return `Eliminada: ${removed.title}`;
  }

  function parseCreate(text) {
    const lower = text.toLowerCase();

    if (!/(crea|crear|añade|añadir|agrega|agregar|apunta|apuntar|recuerda|recuérdame)/.test(lower)) {
      return null;
    }

    let title = text
      .replace(/^(crea|crear|añade|añadir|agrega|agregar|apunta|apuntar|recuérdame|recuerda)\s*/i, "")
      .replace(/\s+(para|el|la)\s+(hoy|mañana)\b.*$/i, "")
      .replace(/\s+a\s+las?\s+\d{1,2}(?::\d{2})?\s*$/i, "")
      .trim();

    if (!title) return null;

    let date = lower.includes("mañana") ? addDays(1) : todayISO();
    const dateMatch = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if (dateMatch) {
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : new Date().getFullYear();
      date = `${year}-${String(dateMatch[2]).padStart(2,"0")}-${String(dateMatch[1]).padStart(2,"0")}`;
    }

    const timeMatch = text.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\b/i);
    const time = timeMatch
      ? `${String(timeMatch[1]).padStart(2,"0")}:${timeMatch[2] || "00"}`
      : "";

    const priority = /\b(alta|urgente|urgencia)\b/i.test(text) ? "Alta"
      : /\b(baja)\b/i.test(text) ? "Baja" : "Media";

    return { title, date, time, priority };
  }

  function answer(raw) {
    const text = raw.trim();
    const lower = text.toLowerCase();

    const create = parseCreate(text);
    if (create) {
      const task = makeTask(create.title, create.date, create.time, create.priority);
      return `✓ Tarea creada: ${task.title}\n${formatDate(task.date)}${task.time ? ` · ${task.time}` : ""}${task.priority === "Alta" ? " · PRIORIDAD ALTA" : ""}`;
    }

    if (/(pendiente|tareas|tengo).*(hoy|día)/.test(lower) || /\bhoy\b/.test(lower)) {
      return listFor(todayISO(), "hoy");
    }

    if (/\bmañana\b/.test(lower)) {
      return listFor(addDays(1), "mañana");
    }

    if (/(prioridad|urgente|alta)/.test(lower)) {
      return priorityList();
    }

    if (/(completa|termina|hecha|marcar).*/.test(lower)) {
      const q = text.replace(/.*?(completa|termina|hecha|marcar)\s*/i, "").trim();
      return q ? completeTask(q) : "Dime qué tarea quieres marcar como completada.";
    }

    if (/(elimina|borrar|borra).*/.test(lower)) {
      const q = text.replace(/.*?(elimina|borrar|borra)\s*/i, "").trim();
      return q ? deleteTask(q) : "Dime qué tarea quieres eliminar.";
    }

    if (/(cuántas|cuantas|resumen|estado)/.test(lower)) {
      const items = load();
      const pending = items.filter(t => t.status === "Pendiente").length;
      const done = items.filter(t => t.status === "Completada").length;
      const high = items.filter(t => t.status === "Pendiente" && t.priority === "Alta").length;
      return `Resumen NEON//DAY:\n• Pendientes: ${pending}\n• Completadas: ${done}\n• Prioridad alta: ${high}\n• Total: ${items.length}`;
    }

    if (/(buscar|busca|encuentra)/.test(lower)) {
      const q = text.replace(/.*?(buscar|busca|encuentra)\s*/i, "").trim();
      const results = findTasks(q);
      return results.length
        ? results.slice(0, 8).map(t => `• ${t.title} · ${formatDate(t.date)} · ${t.status}`).join("\n")
        : `No encuentro tareas relacionadas con "${q}".`;
    }

    return "Puedo ayudarte con:\n• «¿Qué tengo pendiente hoy?»\n• «¿Qué tengo mañana?»\n• «Crea estudiar ASIR mañana a las 18:00»\n• «Crea entregar práctica, prioridad alta»\n• «Marca estudiar ASIR como completada»\n• «Elimina entregar práctica»\n• «Resumen»";
  }

  $("assistantFab").addEventListener("click", openAssistant);
  $("assistantClose").addEventListener("click", closeAssistant);

  $("assistantForm").addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    say(text, "user");
    input.value = "";
    setTimeout(() => say(answer(text)), 80);
  });

  document.querySelectorAll(".assistant-suggestions button").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      say(prompt, "user");
      setTimeout(() => say(answer(prompt)), 80);
    });
  });

  window.NEON_ASSIST = { answer, refreshMainUI };
})();
