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
    setSync("SUPABASE");
    await pullCloud();
  }catch(e){
    console.error(e);
    cloudEnabled=false;
    setSync("LOCAL · SIN CONEXIÓN",false);
    toast("Supabase no disponible: modo local");
    render();
  }
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
    try{setSync("GUARDANDO…");let {error}=await supabase.from("activities").upsert(items.map(toRow),{onConflict:"id"});if(error)throw error;setSync("SUPABASE")}
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
