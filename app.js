const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "neon-day-activities-v1";
let activities = loadActivities();

function loadActivities() {
  try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(data) ? data : []; }
  catch { return []; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(activities)); render(); }
function todayISO() {
  const d = new Date(); const offset = d.getTimezoneOffset(); return new Date(d.getTime() - offset * 60000).toISOString().slice(0,10);
}
function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function prettyDate(date) {
  if (!date) return "Sin fecha";
  const [y,m,d] = date.split("-"); return `${d}/${m}/${y}`;
}
function toast(message) {
  $("toast").textContent = message; $("toast").classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}
function resetForm() {
  $("activityForm").reset(); $("editId").value = ""; $("date").value = todayISO();
  $("formTitle").textContent = "Crear actividad"; $("saveBtn").textContent = "＋ Añadir actividad";
  $("cancelEdit").classList.add("hidden");
}
function render() {
  const done = activities.filter(a => a.status === "Completada").length;
  const pending = activities.length - done;
  const high = activities.filter(a => a.priority === "Alta" && a.status !== "Completada").length;
  $("statTotal").textContent = activities.length; $("statPending").textContent = pending;
  $("statDone").textContent = done; $("statHigh").textContent = high;
  $("doneCount").textContent = done; $("totalCount").textContent = `/ ${activities.length}`;
  $("progressBar").style.width = activities.length ? `${done / activities.length * 100}%` : "0%";
  $("progressCaption").textContent = activities.length ? `${Math.round(done / activities.length * 100)}% DEL PLAN COMPLETADO` : "SIN ACTIVIDAD REGISTRADA";

  const q = $("search").value.trim().toLowerCase();
  const status = $("filterStatus").value, category = $("filterCategory").value;
  const visible = activities.filter(a =>
    (!q || `${a.title} ${a.description} ${a.category}`.toLowerCase().includes(q)) &&
    (status === "Todas" || a.status === status) &&
    (category === "Todas" || a.category === category)
  ).sort((a,b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
  $("visibleCount").textContent = visible.length;
  $("listSummary").textContent = `${visible.length} de ${activities.length} registros`;
  $("emptyState").style.display = visible.length ? "none" : "block";
  $("activityList").innerHTML = visible.map(a => `
    <article class="activity-item ${a.status === "Completada" ? "done" : ""} ${a.priority === "Alta" && a.status !== "Completada" ? "high" : ""}">
      <button class="check-btn" data-action="toggle" data-id="${a.id}" aria-label="Cambiar estado">${a.status === "Completada" ? "✓" : ""}</button>
      <div class="activity-main">
        <div class="activity-title">${escapeHTML(a.title)}</div>
        <div class="activity-meta"><span>${prettyDate(a.date)}${a.time ? " · " + escapeHTML(a.time) : ""}</span><span class="tag">${escapeHTML(a.category)}</span><span class="${a.priority === "Alta" ? "priority-high" : ""}">${escapeHTML(a.priority)}</span><span>${a.status}</span></div>
        ${a.description ? `<div class="activity-meta">${escapeHTML(a.description)}</div>` : ""}
      </div>
      <div class="item-actions"><button class="mini-btn" data-action="edit" data-id="${a.id}">Editar</button><button class="mini-btn" data-action="delete" data-id="${a.id}">×</button></div>
    </article>`).join("");
}
$("activityForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("editId").value;
  const record = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title: $("title").value.trim(), date: $("date").value, time: $("time").value,
    category: $("category").value, priority: $("priority").value,
    description: $("description").value.trim(),
    status: id ? (activities.find(a => a.id === id)?.status || "Pendiente") : "Pendiente",
    createdAt: id ? (activities.find(a => a.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };
  if (!record.title || !record.date) return;
  if (id) { activities = activities.map(a => a.id === id ? record : a); toast("Actividad actualizada"); }
  else { activities.push(record); toast("Actividad añadida"); }
  persist(); resetForm();
});
$("cancelEdit").addEventListener("click", resetForm);
$("activityList").addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]"); if (!btn) return;
  const {action,id} = btn.dataset; const item = activities.find(a => a.id === id); if (!item) return;
  if (action === "toggle") { item.status = item.status === "Completada" ? "Pendiente" : "Completada"; persist(); }
  if (action === "delete" && confirm(`¿Eliminar "${item.title}"?`)) { activities = activities.filter(a => a.id !== id); persist(); toast("Actividad eliminada"); }
  if (action === "edit") {
    $("editId").value = item.id; $("title").value = item.title; $("date").value = item.date;
    $("time").value = item.time || ""; $("category").value = item.category; $("priority").value = item.priority;
    $("description").value = item.description || ""; $("formTitle").textContent = "Editar actividad";
    $("saveBtn").textContent = "Guardar cambios"; $("cancelEdit").classList.remove("hidden");
    $("title").focus(); window.scrollTo({top:0,behavior:"smooth"});
  }
});
["search","filterStatus","filterCategory"].forEach(id => $(id).addEventListener(id === "search" ? "input" : "change", render));
$("clearDone").addEventListener("click", () => {
  const count = activities.filter(a => a.status === "Completada").length;
  if (!count) return toast("No hay actividades completadas");
  if (confirm(`¿Eliminar ${count} actividad(es) completada(s)?`)) { activities = activities.filter(a => a.status !== "Completada"); persist(); toast("Actividades completadas eliminadas"); }
});
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
$("exportCsv").addEventListener("click", () => {
  if (!activities.length) return toast("No hay datos para exportar");
  const headers = ["Actividad","Fecha","Hora","Categoría","Prioridad","Estado","Descripción","Creada"];
  const rows = activities.map(a => [a.title,a.date,a.time,a.category,a.priority,a.status,a.description,a.createdAt]);
  const csv = [headers,...rows].map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(";")).join("\r\n");
  downloadBlob(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8;"}),`neon-day-actividades-${todayISO()}.csv`);
  toast("Archivo CSV exportado");
});
$("exportJson").addEventListener("click", () => {
  if (!activities.length) return toast("No hay datos para exportar");
  downloadBlob(new Blob([JSON.stringify(activities,null,2)],{type:"application/json"}),`neon-day-backup-${todayISO()}.json`);
  toast("Copia JSON exportada");
});
$("todayLabel").textContent = new Date().toLocaleDateString("es-ES",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).toUpperCase();
$("date").value = todayISO();
render();
