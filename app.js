const $=id=>document.getElementById(id);
const KEY="neon-day-3";
let items=load(), month=new Date(), picked=null, notified=new Set();
let supabaseClient = null, cloudEnabled = false, cloudUser = null, syncBusy = false;

function load(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}}
function localSave(){localStorage.setItem(KEY,JSON.stringify(items))}
function iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function today(){return iso(new Date())}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(s){let o=$("toast");o.textContent=s;o.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>o.classList.remove("show"),2200)}
function setSync(text,ok=true){$("syncStatus").textContent=(ok?"● ":"● ")+text;$("syncStatus").style.opacity=ok?"1":".65"}

function dlabel(s){return s?s.split("-").reverse().join("/"):""}

function normalize(a){
  return {
    id:a.id||crypto.randomUUID(), title:a.title||"", date:a.date||today(), time:a.time||"",
    category:a.category||"Personal", priority:a.priority||"Media", repeat:a.repeat||"none",
    reminder:a.reminder??"none", description:a.description||"", status:a.status||"Pendiente",
    createdAt:a.createdAt||a.created_at||new Date().toISOString(), parent:a.parent||null
  }
}

function expand(a){
  if(a.repeat==="none")return;
  let start=new Date(a.date+"T12:00:00");
  for(let i=1;i<=60;i++){
    let d=new Date(start);
    if(a.repeat==="daily")d.setDate(d.getDate()+i);
    if(a.repeat==="weekly")d.setDate(d.getDate()+7*i);
    if(a.repeat==="monthly"){d.setMonth(d.getMonth()+i);if(d.getDate()!==start.getDate())d.setDate(0)}
    if(d>Date.now()+90*86400000)break;
    let date=iso(d),id=a.id+"_"+date;
    if(!items.some(x=>x.id===id))items.push({...a,id,date,repeat:"none",parent:a.id,status:"Pendiente"});
  }
}

async function initCloud(){
  const cfg=window.NEON_SUPABASE||{};
  if(!window.supabase || !cfg.url || !cfg.anonKey || cfg.url.includes("TU-PROYECTO") || cfg.anonKey.includes("TU_SUPABASE")){
    setSync("LOCAL",false); render(); return;
  }
  try{
    supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    let {data,error}=await supabaseClient.auth.getSession();

if(error) throw error;

if(!data.session){
  let r=await supabaseClient.auth.signInAnonymously();
  if(r.error) throw r.error;
  data={session:r.data.session};
}
    cloudUser=data.session.user;
    cloudEnabled=true;
    updateAccountUI();
    setSync("SUPABASE");
    await pullCloud();
    startCloudRefresh();
  }catch(e){
    console.error(e);
    cloudEnabled=false;
    setSync("LOCAL · SIN CONEXIÓN",false);
    toast("Supabase no disponible: modo local");
    render();
  }
}

function updateAccountUI(){
  const email=cloudUser?.email;
  const anonymous=cloudUser?.is_anonymous;
  $("accountStatus").textContent=anonymous
    ? "Sesión temporal de este dispositivo. Crea una cuenta para compartir tus actividades."
    : "Cuenta conectada: "+(email||"usuario");
  $("accountCreate").classList.toggle("hide",!anonymous);
  $("accountLogin").classList.toggle("hide",!anonymous);
  $("accountEmail").value=email||"";
  $("accountPassword").value="";
}
async function startCloudRefresh(){
  if(window.neonCloudRefreshStarted)return;
  window.neonCloudRefreshStarted=true;
  setInterval(async()=>{
    if(!cloudEnabled||syncBusy||document.hidden)return;
    try{await pullCloud()}catch(e){console.warn("Actualización multidispositivo:",e)}
  },20000);
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden&&cloudEnabled&&!syncBusy)pullCloud().catch(console.warn);
  });
}
async function createSharedAccount(){
  if(!supabaseClient||!cloudUser)return;
  const email=$("accountEmail").value.trim();
  const password=$("accountPassword").value;
  if(!email||password.length<8){toast("Introduce un correo y una contraseña de al menos 8 caracteres.");return}
  if(!cloudUser.is_anonymous){toast("Ya estás usando una cuenta.");return}
  $("accountCreate").disabled=true;
  try{
    const {data,error}=await supabaseClient.auth.updateUser({email,password});
    if(error)throw error;
    cloudUser=data.user||cloudUser;
    updateAccountUI();
    toast("Cuenta vinculada. Si Supabase pide verificar el correo, revisa tu bandeja.");
    $("accountStatus").textContent="Cuenta vinculada a "+email+". Usa ese correo y contraseña en tus otros dispositivos.";
  }catch(e){console.error(e);toast("No se pudo crear la cuenta: "+(e.message||"comprueba el correo y la configuración de Auth."))}
  finally{$("accountCreate").disabled=false}
}
async function loginSharedAccount(){
  if(!supabaseClient)return;
  const email=$("accountEmail").value.trim(),password=$("accountPassword").value;
  if(!email||!password){toast("Introduce tu correo y contraseña.");return}
  $("accountLogin").disabled=true;
  try{
    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)throw error;
    cloudUser=data.user;cloudEnabled=true;
    updateAccountUI();
    await pullCloud();
    toast("Sesión iniciada. Actividades sincronizadas.");
  }catch(e){console.error(e);toast("No se pudo iniciar sesión: "+(e.message||"revisa tus datos."))}
  finally{$("accountLogin").disabled=false}
}

async function pullCloud(){
  if(!cloudEnabled)return;
  setSync("SINCRONIZANDO…");
  let {data,error}=await supabaseClient.from("activities").select("*").order("date",{ascending:true}).order("time",{ascending:true});
  if(error)throw error;
  const cloud=(data||[]).map(normalize);
  if(cloud.length===0 && items.length>0){
    await migrateLocal();
    return;
  }
  items=cloud;
  localSave();
  setSync("SUPABASE");
  render();
}

function toRow(a){
  return {
    id:a.id,title:a.title,date:a.date,time:a.time||null,category:a.category,priority:a.priority,
    repeat:a.repeat,reminder:a.reminder,description:a.description||"",status:a.status,
    parent:a.parent||null,created_at:a.createdAt||new Date().toISOString(),user_id:cloudUser?.id
  };
}

async function migrateLocal(){
  setSync("SUBIENDO DATOS…");
  const rows=items.map(toRow);
  const {data,error}=await supabaseClient.from("activities").upsert(rows,{onConflict:"id"}).select();
  if(error)throw error;
  items=(data||rows).map(normalize);
  localSave();
  setSync("SUPABASE");
  toast("Datos locales migrados a Supabase");
  render();
}

async function save(){
  localSave();
  render();
  if(!cloudEnabled || syncBusy)return;
  syncBusy=true;
  try{
    setSync("GUARDANDO…");
    const rows=items.map(toRow);
    const {error}=await supabaseClient.from("activities").upsert(rows,{onConflict:"id"});
    if(error)throw error;
    setSync("SUPABASE");
  }catch(e){
    console.error(e);setSync("LOCAL · ERROR CLOUD",false);toast("Guardado local. Error al sincronizar.");
  }finally{syncBusy=false}
}

async function deleteCloud(ids){
  if(!cloudEnabled||!ids.length)return;
  const {error}=await supabaseClient.from("activities").delete().in("id",ids);
  if(error)throw error;
}

function calendar(){
  let y=month.getFullYear(),m=month.getMonth(),start=(new Date(y,m,1).getDay()+6)%7,n=new Date(y,m+1,0).getDate(),out=[];
  $("month").textContent=month.toLocaleDateString("es-ES",{month:"long",year:"numeric"}).toUpperCase();
  for(let i=0;i<42;i++){
    let day=i-start+1,d=new Date(y,m,day),key=iso(d),arr=items.filter(a=>a.date===key),done=arr.length&&arr.every(a=>a.status==="Completada");
    out.push(`<button data-date="${key}" class="${day<1||day>n?"muted":""} ${key===today()?"today":""} ${key===picked?"selected":""}">${d.getDate()}${arr.length?`<i class="${done?"done":""}"></i>`:""}</button>`);
  }
  $("calendar").innerHTML=out.join("");
}

function chart(){
  let cats=["Personal","Estudios","Trabajo","Salud","Hogar","Ocio","Otro"],max=Math.max(1,...cats.map(c=>items.filter(a=>a.category===c).length));
  $("chart").innerHTML=cats.map(c=>{let n=items.filter(a=>a.category===c).length;return `<div class="chartrow"><span>${c}</span><div class="charttrack"><div class="chartfill" style="width:${n/max*100}%"></div></div><b>${n}</b></div>`}).join("");
}

function render(){
  let done=items.filter(a=>a.status==="Completada").length,pending=items.length-done,high=items.filter(a=>a.priority==="Alta"&&a.status!=="Completada").length;
  $("total").textContent=items.length;$("pending").textContent=pending;$("done").textContent=done;$("high").textContent=high;
  $("ratio").textContent=`${done} / ${items.length}`;$("bar").style.width=items.length?done/items.length*100+"%":"0%";
  $("percent").textContent=items.length?Math.round(done/items.length*100)+"% COMPLETADO":"ESPERANDO DATOS";
  let q=$("search").value.toLowerCase(),st=$("status").value,cat=$("catFilter").value;
  let shown=items.filter(a=>(!picked||a.date===picked)&&(!q||`${a.title} ${a.description} ${a.category}`.toLowerCase().includes(q))&&(st==="Todas"||a.status===st)&&(cat==="Todas"||a.category===cat))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.time||"").localeCompare(b.time||""));
  $("shown").textContent=shown.length;$("summary").textContent=`${shown.length} de ${items.length} registros`;
  $("dayLabel").textContent=picked?"VISTA DEL "+dlabel(picked):"VISTA GENERAL";$("empty").style.display=shown.length?"none":"block";
  $("list").innerHTML=shown.map(a=>`<div class="activity ${a.status==="Completada"?"done":""} ${a.priority==="Alta"?"high":""}">
    <button class="check" data-act="toggle" data-id="${a.id}">${a.status==="Completada"?"✓":""}</button>
    <div><b>${esc(a.title)}</b><div class="meta">${dlabel(a.date)} ${a.time||""} · <span class="tag">${esc(a.category)}</span> · ${a.priority} · ${a.status} ${a.parent?"· ↻ REPETIDA":a.repeat!=="none"?"· ↻ "+a.repeat:""}</div>
    ${a.description?`<div class="meta">${esc(a.description)}</div>`:""}</div>
    <div class="ops"><button data-act="edit" data-id="${a.id}">Editar</button><button data-act="delete" data-id="${a.id}">×</button></div>
  </div>`).join("");
  calendar();chart();
}

function reset(){
  $("form").reset();$("editId").value="";$("date").value=today();$("formTitle").textContent="Crear actividad";
  $("cancel").classList.add("hide");$("form").querySelector(".primary").textContent="＋ Añadir actividad";
}

$("form").onsubmit=async e=>{
  e.preventDefault();
  let id=$("editId").value,old=items.find(a=>a.id===id);
  let a=normalize({id:id||crypto.randomUUID(),title:$("title").value.trim(),date:$("date").value,time:$("time").value,
    category:$("category").value,priority:$("priority").value,repeat:$("repeat").value,reminder:$("reminder").value,
    description:$("description").value.trim(),status:old?.status||"Pendiente",createdAt:old?.createdAt||new Date().toISOString()});
  if(id){
    let descendants=items.filter(x=>x.parent===id).map(x=>x.id);
    items=items.filter(x=>x.id!==id&&x.parent!==id);items.push(a);
    try{await deleteCloud(descendants);toast("Actividad actualizada")}catch(e){console.error(e);toast("Actualizada localmente; error cloud")}
  }else{items.push(a);expand(a);toast("Actividad creada")}
  localSave();render();reset();
  if(cloudEnabled){
    try{setSync("GUARDANDO…");let {error}=await supabaseClient.from("activities").upsert(items.map(toRow),{onConflict:"id"});if(error)throw error;setSync("SUPABASE")}
    catch(e){console.error(e);setSync("LOCAL · ERROR CLOUD",false);toast("Guardado local. Error al sincronizar.")}
  }
};

$("cancel").onclick=reset;

$("list").onclick=async e=>{
  let b=e.target.closest("[data-act]");if(!b)return;let a=items.find(x=>x.id===b.dataset.id);if(!a)return;
  if(b.dataset.act==="toggle"){
    a.status=a.status==="Completada"?"Pendiente":"Completada";await save();
  }
  if(b.dataset.act==="delete"&&confirm("¿Eliminar actividad?")){
    let ids=[a.id,...items.filter(x=>x.parent===a.id).map(x=>x.id)];
    items=items.filter(x=>!ids.includes(x.id));localSave();render();
    try{await deleteCloud(ids);toast("Actividad eliminada");setSync("SUPABASE")}
    catch(e){console.error(e);toast("Eliminada localmente; error cloud");setSync("LOCAL · ERROR CLOUD",false)}
  }
  if(b.dataset.act==="edit"){
    $("editId").value=a.id;
    ["title","date","time","category","priority","repeat","reminder","description"].forEach(k=>$(k).value=a[k]||(["repeat","reminder"].includes(k)?"none":""));
    $("formTitle").textContent="Editar actividad";$("form").querySelector(".primary").textContent="Guardar cambios";
    $("cancel").classList.remove("hide");scrollTo({top:0,behavior:"smooth"});
  }
};

["search","status","catFilter"].forEach(k=>$(`${k}`).addEventListener(k==="search"?"input":"change",render));
$("prev").onclick=()=>{month.setMonth(month.getMonth()-1);calendar()};
$("next").onclick=()=>{month.setMonth(month.getMonth()+1);calendar()};
$("calendar").onclick=e=>{let b=e.target.closest("[data-date]");if(b){picked=picked===b.dataset.date?null:b.dataset.date;render()}};
$("all").onclick=()=>{picked=null;render()};

$("clear").onclick=async()=>{
  let ids=items.filter(a=>a.status==="Completada").map(a=>a.id);
  if(ids.length&&confirm(`¿Eliminar ${ids.length} completadas?`)){
    items=items.filter(a=>a.status!=="Completada");localSave();render();
    try{await deleteCloud(ids);toast("Completadas eliminadas");setSync("SUPABASE")}
    catch(e){console.error(e);toast("Eliminadas localmente; error cloud");setSync("LOCAL · ERROR CLOUD",false)}
  }
};

let cols=["Actividad","Fecha","Hora","Categoría","Prioridad","Estado","Repetición","Aviso","Descripción","Creada"],
keys=["title","date","time","category","priority","status","repeat","reminder","description","createdAt"];
function rows(){return items.map(a=>Object.fromEntries(cols.map((c,i)=>[c,a[keys[i]]||""])))}
function dl(blob,name){let u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function csv(){let data=[cols,...items.map(a=>keys.map(k=>a[k]||""))].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\r\n");dl(new Blob(["\ufeff",data],{type:"text/csv;charset=utf-8"}),`neon-day-${today()}.csv`)}

$("csv").onclick=()=>items.length?(csv(),toast("CSV exportado")):toast("No hay datos");
$("xlsx").onclick=()=>{if(!items.length)return toast("No hay datos");if(window.XLSX){let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows()),"Actividades");XLSX.writeFile(wb,`neon-day-${today()}.xlsx`);toast("Excel exportado")}else{csv();toast("Sin conexión a SheetJS: CSV exportado")}};
$("json").onclick=()=>items.length?dl(new Blob([JSON.stringify(items,null,2)],{type:"application/json"}),`neon-day-backup-${today()}.json`):toast("No hay datos");

$("today").textContent=new Date().toLocaleDateString("es-ES",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).toUpperCase();
$("date").value=today();

function reminders(){
  if(!("Notification"in window)||Notification.permission!=="granted")return;
  let now=Date.now();
  items.filter(a=>a.status==="Pendiente"&&a.time&&a.reminder!=="none").forEach(a=>{
    let t=new Date(a.date+"T"+a.time).getTime()-Number(a.reminder)*60000,k=a.id+a.date+a.time;
    if(t<=now&&t>now-30000&&!notified.has(k)){new Notification("NEON//DAY · Recordatorio",{body:a.title+" · "+a.time});notified.add(k)}
  });
}
$("reminder").onchange=()=>{if($("reminder").value!=="none"&&"Notification"in window&&Notification.permission==="default")Notification.requestPermission().then(p=>toast(p==="granted"?"Avisos activados":"Permiso de avisos no concedido"))};
if("Notification"in window&&Notification.permission==="granted")setInterval(reminders,15000);

render();
initCloud();


// ─────────────────────────────────────────────────────────────────────────────
// NEON//ASSIST V2 · integrado con el estado y la sincronización de NEON//DAY
// ─────────────────────────────────────────────────────────────────────────────
(()=>{
  const panel=$("assistant"), feed=$("assistantMessages"), field=$("assistantInput");
  if(!panel||!feed||!field)return;
  const say=(message,who="bot")=>{
    const node=document.createElement("div");
    node.className="assistant-msg "+who;
    node.textContent=message;
    feed.appendChild(node);
    feed.scrollTop=feed.scrollHeight;
  };
  const open=()=>{panel.classList.add("open");if(!feed.children.length)say("NEON//ASSIST V2 conectado. Puedo consultar y gestionar tus actividades, sincronizadas con NEON//DAY.");field.focus()};
  const close=()=>panel.classList.remove("open");
  const datePlus=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)};
  const dateText=d=>d?d.split("-").reverse().join("/"):"";
  const pending=d=>items.filter(a=>a.date===d&&a.status==="Pendiente").sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const list=d=>{const a=pending(d);return a.length?"Actividades pendientes · "+dateText(d)+"\n"+a.map((x,i)=>(i+1)+". "+x.title+(x.time?" · "+x.time:"")+" · "+x.priority).join("\n"):"No tienes actividades pendientes para "+dateText(d)+"."};
  const summary=()=>{const p=items.filter(x=>x.status==="Pendiente").length,d=items.length-p,h=items.filter(x=>x.status==="Pendiente"&&x.priority==="Alta").length;return "RESUMEN NEON//DAY\n• Pendientes: "+p+"\n• Completadas: "+d+"\n• Prioridad alta: "+h+"\n• Total: "+items.length};
  const create=text=>{
    let title=text.replace(/^(?:crea(?:r)?|añade?|agrega?|apunta|recuérdame|recuerda)\s*/i,"").trim();
    const tm=text.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?/i);
    const dm=text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    let date=/\bmañana\b/i.test(text)?datePlus(1):today();
    if(dm){let y=dm[3]?(dm[3].length===2?"20"+dm[3]:dm[3]):String(new Date().getFullYear());date=y+"-"+String(dm[2]).padStart(2,"0")+"-"+String(dm[1]).padStart(2,"0")}
    title=title.replace(/\b(?:para\s+)?(?:hoy|mañana)\b/ig,"").replace(/\ba\s+las?\s+\d{1,2}(?::\d{2})?/ig,"").replace(/\bprioridad\s+(?:alta|media|baja)\b/ig,"").replace(/[,. ]+$/,"").trim();
    if(!title)return null;
    const category=/asir|estudi|examen|práctica|practica|clase|trabajo/i.test(title)?"Estudios":/reunión|reunion|cliente|oficina/i.test(title)?"Trabajo":"Personal";
    const priority=/urgente|prioridad alta/i.test(text)?"Alta":/prioridad baja/i.test(text)?"Baja":"Media";
    const a=normalize({title,date,time:tm?String(tm[1]).padStart(2,"0")+":"+(tm[2]||"00"):"",category,priority,repeat:"none",reminder:tm?"0":"none",status:"Pendiente",description:"Creada con NEON//ASSIST"});
    items.push(a);expand(a);return a;
  };
  const respond=async raw=>{
    const t=raw.trim(),l=t.toLowerCase();
    if(/^(?:hola|buenas|ayuda|help)\b/.test(l))return "¡Hola! Puedo ayudarte a organizar tus actividades. Prueba «crea estudiar ASIR mañana a las 18:00», «qué tengo hoy», «marca estudiar como completada» o «resumen».";
    if(/\bmañana\b/.test(l)&&/(qué|que|tengo|pendiente|actividad|tarea)/.test(l))return list(datePlus(1));
    if(/\bhoy\b/.test(l)&&/(qué|que|tengo|pendiente|actividad|tarea)/.test(l))return list(today());
    if(/\b(resumen|estado|cuántas|cuantas)\b/.test(l))return summary();
    if(/\b(prioridad|urgente)\b/.test(l)&&/(qué|que|tengo|lista|alta)/.test(l)){const a=items.filter(x=>x.status==="Pendiente"&&x.priority==="Alta");return a.length?"PRIORIDAD ALTA\n"+a.map(x=>"• "+x.title+" · "+dateText(x.date)).join("\n"):"No hay actividades pendientes de prioridad alta."}
    if(/\b(busca|buscar|encuentra)\b/.test(l)){const q=t.replace(/.*?\b(?:busca|buscar|encuentra)\b/i,"").trim().toLowerCase();const a=items.filter(x=>(x.title+" "+x.description+" "+x.category).toLowerCase().includes(q));return a.length?a.slice(0,10).map(x=>"• "+x.title+" · "+dateText(x.date)+" · "+x.status).join("\n"):"No encuentro actividades que coincidan."}
    if(/\b(?:marca|marcar|completa|completar|termina)\b/.test(l)){const q=t.replace(/.*?\b(?:marca|marcar|completa|completar|termina)\b/i,"").replace(/\bcomo\s+(?:completada|hecha)\b/i,"").trim().toLowerCase();const a=items.find(x=>x.status!=="Completada"&&x.title.toLowerCase().includes(q));if(!a)return "No encuentro esa actividad pendiente. Dime parte de su título.";a.status="Completada";await save();return "✓ Actividad completada: "+a.title}
    if(/\b(?:elimina|eliminar|borra|borrar)\b/.test(l)){const q=t.replace(/.*?\b(?:elimina|eliminar|borra|borrar)\b/i,"").trim().toLowerCase();const a=items.find(x=>x.title.toLowerCase().includes(q));if(!a)return "No encuentro esa actividad.";const ids=[a.id,...items.filter(x=>x.parent===a.id).map(x=>x.id)];for(let i=items.length-1;i>=0;i--)if(ids.includes(items[i].id))items.splice(i,1);localSave();render();try{await deleteCloud(ids);setSync("SUPABASE")}catch(e){console.error(e);setSync("LOCAL · ERROR CLOUD",false)}return "Actividad eliminada: "+a.title}
    if(/^(?:crea|crear|añade|anade|agrega|apunta|recuérdame|recuerdame|recuerda)\b/i.test(t)){const a=create(t);if(!a)return "No he podido interpretar el nombre de la actividad. Prueba «Crea estudiar ASIR mañana a las 18:00».";await save();return "✓ Actividad creada y guardada: "+a.title+"\n"+dateText(a.date)+(a.time?" · "+a.time:"")+" · "+a.category+" · "+a.priority}
    return "Puedo hacer estas acciones:\n• Consultar tus actividades de hoy o mañana\n• Crear actividades con fecha y hora\n• Marcar una actividad como completada\n• Eliminar actividades\n• Buscar actividades y mostrar un resumen\n\nEjemplo: «Crea estudiar ASIR mañana a las 18:00».";
  };
  $("assistantFab").addEventListener("click",open);
  $("assistantClose").addEventListener("click",close);
  $("assistantForm").addEventListener("submit",async e=>{e.preventDefault();const t=field.value.trim();if(!t)return;field.value="";say(t,"user");const b=document.querySelector("#assistantForm button");b.disabled=true;try{say(await respond(t))}catch(err){console.error(err);say("No he podido completar la acción. Tus datos locales siguen disponibles.")}finally{b.disabled=false}});
  document.querySelectorAll(".assistant-suggestions [data-prompt]").forEach(b=>b.addEventListener("click",async()=>{say(b.dataset.prompt,"user");try{say(await respond(b.dataset.prompt))}catch(e){say("No se pudo completar la consulta.")}}));
})();

$("accountCreate").addEventListener("click",createSharedAccount);
$("accountLogin").addEventListener("click",loginSharedAccount);
