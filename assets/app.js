/* EduSphere frontend — API-compatible archive, filters, samples and viewer */
(() => {
"use strict";
const API_BASE = "https://edusphere-backend-1-v78v.onrender.com";
const PAGE_SIZE = 500;
const INITIAL_DISPLAY = 12;
const DISPLAY_STEP = 12;
const $ = id => document.getElementById(id);
const state = { papers: [], indexed: [], archive: [], samples: [], filtered: [], sampleFiltered: [], visible: INITIAL_DISPLAY, sampleVisible: INITIAL_DISPLAY, loading: false, admin: false };
const el = {
  exam:$("examFilter"), subject:$("subjectFilter"), subjectSearch:$("subjectSearch"), year:$("yearFilter"), cls:$("classFilter"), session:$("sessionFilter"),
  search:$("searchInput"), grid:$("paperGrid"), count:$("resultCount"), load:$("loadMoreButton"),
  sampleGrid:$("samplePaperGrid"), sampleCount:$("sampleResultCount"), sampleClass:$("sampleClassFilter"), sampleSubject:$("sampleSubjectFilter"), sampleSubjectSearch:$("sampleSubjectSearch"), sampleYear:$("sampleYearFilter"),
  modal:$("pdfModal"), frame:$("pdfFrame"), pdfTitle:$("pdfTitle"), pdfDownload:$("pdfDownload"), pdfOpen:$("pdfOpenNew"), pdfLoading:$("pdfLoading")
};
const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
const clean = value => String(value ?? "").trim();
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const paperClass = p => clean(p.class_name ?? p.className ?? p.class ?? p.class_level ?? "");
const paperSubject = p => clean(p.subject || p.subject_name || "General");
const paperYear = p => clean(p.year || p.exam_year || "");
const paperExam = p => clean(p.exam || p.board || "");
const paperTitle = p => clean(p.title || `${paperExam(p)} ${paperSubject(p)} ${paperYear(p)}`);
const paperSession = p => clean(p.session || p.term || "");
const textOf = p => [p.title,p.exam,p.board,p.subject,p.year,p.session,p.description,p.class_name,p.className,p.class,p.subject_code,p.paper_type,p.type,p.category,p.id].map(clean).join(" ");
const isSample = p => {
  const s = norm([p.title,p.description,p.paper_type,p.type,p.category,p.session].map(clean).join(" "));
  return norm(paperExam(p)).includes("cbse") && /(sample paper|sample question|sq[p]?|specimen paper|specimen question)/.test(s);
};
const classNumber = p => {
  const s = norm(paperClass(p) + " " + textOf(p));
  const m = s.match(/\b(?:class|std|standard)\s*(10|12)\b/) || s.match(/\b(10|12)\s*(?:th|grade)\b/);
  return m ? m[1] : "";
};
const fileURL = p => `${API_BASE}/api/papers/${encodeURIComponent(p.id)}/file/`;
const sourceURL = p => clean(p.sourceUrl || p.source_url || p.pdf_url || p.url || "");
const viewURL = p => p.hasFile === false && sourceURL(p) ? sourceURL(p) : fileURL(p);
const downloadURL = p => p.hasFile === false && sourceURL(p) ? sourceURL(p) : `${fileURL(p)}?download=1`;
function toast(message){const t=$("toast");if(!t)return;t.textContent=message;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2600)}
async function request(url,options={}) {
  const response = await fetch(url,{cache:"no-store",...options});
  if(!response.ok){let detail=`HTTP ${response.status}`;try{const d=await response.json();detail=d.detail||d.message||detail}catch{}throw new Error(detail)}
  return response;
}
async function fetchBatch(offset){
  const r=await request(`${API_BASE}/api/papers?limit=${PAGE_SIZE}&offset=${offset}`,{headers:{Accept:"application/json"},credentials:"include"});
  const d=await r.json();
  if(Array.isArray(d))return d;
  if(Array.isArray(d.items))return d.items;
  if(Array.isArray(d.results))return d.results;
  if(Array.isArray(d.papers))return d.papers;
  throw new Error("The papers endpoint returned an unexpected format.");
}
async function loadArchive(){
  if(state.loading)return;state.loading=true;
  if(el.grid)el.grid.innerHTML='<div class="loading-state"><span class="loader"></span><p>Preparing your study collection…</p></div>';
  if(el.sampleGrid)el.sampleGrid.innerHTML='<div class="loading-state"><span class="loader"></span><p>Finding sample papers…</p></div>';
  try{
    const records=new Map();let offset=0;let pages=0;const maxPages=100;
    while(pages<maxPages){
      const batch=await fetchBatch(offset);if(!batch.length)break;
      let added=0;
      for(const p of batch){if(p&&p.id!==undefined&&p.id!==null){const id=String(p.id);if(!records.has(id)){records.set(id,p);added++}}}
      pages++;offset+=batch.length;if(added===0||batch.length<PAGE_SIZE)break;
    }
    state.papers=[...records.values()];
    state.papers.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0)||(Number(b.id)||0)-(Number(a.id)||0));
    // Build each searchable string once. Typing never causes another API request.
    state.indexed=state.papers.map(p=>({paper:p,search:norm(textOf(p)),exam:norm(paperExam(p)),subject:paperSubject(p),subjectNorm:norm(paperSubject(p)),year:paperYear(p),cls:paperClass(p),session:paperSession(p),sample:isSample(p)}));
    state.samples=state.indexed.filter(x=>x.sample && (!classNumber(x.paper)||["10","12"].includes(classNumber(x.paper)))).map(x=>x.paper);
    state.archive=state.indexed.filter(x=>!x.sample).map(x=>x.paper);
    populateMainOptions();populateSampleOptions();applyMainFilters();applySampleFilters();
    console.info(`EduSphere loaded ${state.papers.length} papers in ${pages} request(s); ${state.samples.length} CBSE sample papers detected.`);
  }catch(err){
    console.error("EduSphere archive load failed:",err);
    const msg=`Unable to load the archive: ${esc(err.message)}. Please check the connection and try again.`;
    if(el.grid)el.grid.innerHTML=`<div class="empty-state"><b>We couldn't load the archive.</b><span>${msg}</span><button class="clear-button" id="retryArchive" type="button">Try again ↻</button></div>`;
    if(el.sampleGrid)el.sampleGrid.innerHTML='<div class="empty-state">Sample papers will appear here when the archive is available.</div>';
    $("retryArchive")?.addEventListener("click",loadArchive);
    if(el.count)el.count.textContent="Archive unavailable";
    if(el.sampleCount)el.sampleCount.textContent="Sample-paper archive unavailable";
  }finally{state.loading=false}
}
function fillSelect(select,values,firstLabel){
  if(!select)return;const previous=select.value;
  select.innerHTML=`<option value="">${esc(firstLabel)}</option>`;
  [...new Set(values.map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;select.appendChild(o)});
  if([...select.options].some(o=>o.value===previous))select.value=previous;
}
function populateMainOptions(){
  fillSelect(el.year,state.archive.map(paperYear),"All years");
  fillSelect(el.cls,state.archive.map(paperClass),"All classes");
  fillSelect(el.session,state.archive.map(paperSession),"All sessions");
  populateSubjects();
}
function populateSubjects(){
  const exam=norm(el.exam?.value);const subjectSearch=norm(el.subjectSearch?.value);
  const subjects=state.indexed.filter(x=>!x.sample&&(!exam||x.exam===exam)&&(!subjectSearch||x.subjectNorm.includes(subjectSearch))).map(x=>x.subject);
  fillSelect(el.subject,subjects,"All subjects");
}
function populateSampleOptions(){
  fillSelect(el.sampleYear,state.samples.map(paperYear),"All years");
  populateSampleSubjects();
}
function populateSampleSubjects(){
  const q=norm(el.sampleSubjectSearch?.value);
  fillSelect(el.sampleSubject,state.samples.filter(p=>!q||norm(paperSubject(p)).includes(q)).map(paperSubject),"All subjects");
}
function matchesFilters(x){
  const exam=norm(el.exam?.value),subject=el.subject?.value||"",year=el.year?.value||"",cls=el.cls?.value||"",session=el.session?.value||"",q=norm(el.search?.value);
  if(exam&&!x.exam.includes(exam))return false;
  if(subject&&x.subject!==subject)return false;
  if(year&&x.year!==year)return false;
  if(cls&&norm(x.cls)!==norm(cls))return false;
  if(session&&norm(x.session)!==norm(session))return false;
  if(q&&!q.split(/\s+/).every(word=>x.search.includes(word)))return false;
  return true;
}
function applyMainFilters(){
  state.filtered=state.indexed.filter(x=>!x.sample&&matchesFilters(x)).map(x=>x.paper);
  state.visible=INITIAL_DISPLAY;renderMain();
  const active=[el.exam?.value,el.subject?.value,el.year?.value,el.cls?.value,el.session?.value,el.search?.value].filter(Boolean);
  $("activeFilterText").textContent=active.length?`${active.length} filter${active.length>1?"s":""} applied`:"No filters applied";
}
function matchesSample(p){
  const cls=el.sampleClass?.value||"",subject=el.sampleSubject?.value||"",year=el.sampleYear?.value||"",q=norm(el.sampleSubjectSearch?.value);
  if(cls&&classNumber(p)!==cls)return false;
  if(subject&&paperSubject(p)!==subject)return false;
  if(year&&paperYear(p)!==year)return false;
  if(q&&!norm(paperSubject(p)).includes(q))return false;
  return true;
}
function applySampleFilters(){state.sampleFiltered=state.samples.filter(matchesSample);state.sampleVisible=INITIAL_DISPLAY;renderSamples()}
function cardHTML(p){
  const exam=paperExam(p)||"Exam",year=paperYear(p)||"Year",subject=paperSubject(p),cls=paperClass(p),session=paperSession(p);
  const desc=clean(p.description||"Question paper for practice and revision.");
  const id=esc(p.id);
  const classText=cls?(/^class/i.test(cls)?cls:`Class ${cls}`):"";
  const typeLabel=isSample(p)?"Sample paper":"Previous-year paper";
  const canDownload=p.hasFile!==false||!!sourceURL(p);
  return `<article class="paper-card"><div class="card-accent"></div><div class="paper-card-body"><div class="paper-meta"><span class="exam-tag">${esc(exam)}</span><span class="year-tag">${esc(year)}</span></div><h3>${esc(paperTitle(p))}</h3><p class="paper-subject">${esc(subject)}</p><p class="paper-description">${esc(desc)}</p><div class="paper-details">${classText?`<span>${esc(classText)}</span>`:""}${session?`<span>${esc(session)}</span>`:""}<span>${typeLabel}</span></div><div class="paper-actions"><button type="button" class="preview-button" data-preview="${id}">Preview ↗</button>${canDownload?`<a class="download-button" href="${esc(downloadURL(p))}" target="_blank" rel="noopener noreferrer">Download ↓</a>`:`<button type="button" class="preview-button" data-preview="${id}">Open source ↗</button>`}</div></div></article>`;
}
function renderGrid(grid,items,visible,count,loadButton,isSample=false){
  const shown=items.slice(0,visible);
  if(count)count.textContent=`${items.length.toLocaleString()} ${isSample?"sample papers":"papers"} found · showing ${shown.length}`;
  if(!items.length){grid.innerHTML=`<div class="empty-state"><b>No papers match these filters.</b><span>Try a different subject, year or exam, or reset your filters.</span></div>`;if(loadButton)loadButton.hidden=true;return}
  grid.innerHTML=shown.map(cardHTML).join("");
  if(loadButton)loadButton.hidden=visible>=items.length;
}
function renderMain(){renderGrid(el.grid,state.filtered,state.visible,el.count,el.load)}
function renderSamples(){renderGrid(el.sampleGrid,state.sampleFiltered,state.sampleVisible,el.sampleCount,null,true);if($("sampleEmptyNote"))$("sampleEmptyNote").hidden=state.samples.length>0}
function resetMain(){[el.exam,el.subject,el.year,el.cls,el.session].forEach(s=>{if(s)s.value=""});if(el.search)el.search.value="";if(el.subjectSearch)el.subjectSearch.value="";populateSubjects();applyMainFilters()}
function openPreview(p){
  const url=viewURL(p);if(!url){toast("No PDF or source link is available for this paper.");return}
  if(!el.modal||!el.frame){window.open(url,"_blank","noopener");return}
  el.pdfTitle.textContent=paperTitle(p);el.pdfDownload.href=downloadURL(p);el.pdfOpen.href=url;
  el.pdfLoading?.classList.add("visible");el.frame.src=url;el.modal.classList.add("active");el.modal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
  el.frame.onload=()=>el.pdfLoading?.classList.remove("visible");
  el.frame.onerror=()=>{el.pdfLoading?.classList.remove("visible");toast("This source may not allow an embedded preview. Use Open in new tab.")};
}
function closePreview(){if(!el.modal)return;el.modal.classList.remove("active");el.modal.setAttribute("aria-hidden","true");if(el.frame)el.frame.src="about:blank";document.body.style.overflow=""}
function findPaper(id){return state.papers.find(p=>String(p.id)===String(id))}
function setupEvents(){
  $("heroSearch")?.addEventListener("submit",e=>{e.preventDefault();applyMainFilters();$("papers")?.scrollIntoView({behavior:"smooth"})});
  el.search?.addEventListener("input",applyMainFilters);
  el.exam?.addEventListener("change",()=>{populateSubjects();applyMainFilters()});
  el.subjectSearch?.addEventListener("input",()=>{populateSubjects();applyMainFilters()});
  [el.subject,el.year,el.cls,el.session].forEach(s=>s?.addEventListener("change",applyMainFilters));
  $("clearFilters")?.addEventListener("click",resetMain);
  el.load?.addEventListener("click",()=>{state.visible+=DISPLAY_STEP;renderMain()});
  el.sampleClass?.addEventListener("change",applySampleFilters);
  el.sampleYear?.addEventListener("change",applySampleFilters);
  el.sampleSubject?.addEventListener("change",applySampleFilters);
  el.sampleSubjectSearch?.addEventListener("input",()=>{populateSampleSubjects();applySampleFilters()});
  $("clearSampleFilters")?.addEventListener("click",()=>{[el.sampleClass,el.sampleSubject,el.sampleYear].forEach(s=>{if(s)s.value=""});if(el.sampleSubjectSearch)el.sampleSubjectSearch.value="";populateSampleSubjects();applySampleFilters()});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-preview]");if(b){const p=findPaper(b.dataset.preview);if(p)openPreview(p)}});
  $("closePdf")?.addEventListener("click",closePreview);
  el.modal?.addEventListener("click",e=>{if(e.target===el.modal)closePreview()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closePreview()});
  $("mobileMenu")?.addEventListener("click",()=>{const nav=$("mainNav"),btn=$("mobileMenu");const open=nav.classList.toggle("open");btn.setAttribute("aria-expanded",String(open))});
  $("mainNav")?.addEventListener("click",e=>{if(e.target.closest("a")){$("mainNav").classList.remove("open");$("mobileMenu")?.setAttribute("aria-expanded","false")}});
  $("loginForm")?.addEventListener("submit",handleLogin);
  $("logoutButton")?.addEventListener("click",handleLogout);
}
async function checkSession(){
  try{
    const r=await request(`${API_BASE}/api/session`,{credentials:"include"});
    const data=await r.json();
    const logged=Boolean(data.authenticated||data.logged_in||data.loggedIn||data.admin||data.session);
    setAdminVisible(logged);
    if(logged)loadAdminDashboard(data);
  }catch(err){console.warn("Session check:",err.message);setAdminVisible(false)}
}
function setAdminVisible(logged){
  state.admin=logged;
  const root=$("adminRoot"),dash=$("adminDashboard");
  if(root)root.hidden=logged;if(dash)dash.hidden=!logged;
}
async function handleLogin(e){
  e.preventDefault();const form=$("loginForm"),message=$("loginMessage");const fd=new FormData(form);
  if(message)message.textContent="Signing in…";
  try{
    const r=await request(`${API_BASE}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},credentials:"include",body:JSON.stringify({email:fd.get("email"),password:fd.get("password")})});
    const data=await r.json().catch(()=>({}));
    if(message)message.textContent="Signed in successfully.";
    form.reset();setAdminVisible(true);await loadAdminDashboard(data);
  }catch(err){if(message)message.textContent=err.message||"Unable to sign in."}
}
async function loadAdminDashboard(sessionData={}){
  $("adminWelcomeText").textContent=sessionData?.session?.email?`Signed in as ${sessionData.session.email}`:"Your archive overview.";
  // Dashboard routes vary across deployed revisions. Try the known admin routes safely.
  for(const path of ["/api/admin/dashboard","/api/admin/stats","/api/dashboard","/api/stats"]){
    try{
      const r=await request(`${API_BASE}${path}`,{credentials:"include"});const d=await r.json();
      const data=d.stats||d.dashboard||d;
      const total=data.total??data.totalPapers??data.total_papers;
      const files=data.withFile??data.with_file??data.pdfCount??data.pdf_count;
      const downloads=data.downloads??data.totalDownloads??data.total_downloads;
      if(total!==undefined)$("statTotal").textContent=Number(total).toLocaleString();
      if(files!==undefined)$("statFiles").textContent=Number(files).toLocaleString();
      if(downloads!==undefined)$("statDownloads").textContent=Number(downloads).toLocaleString();
      if(total!==undefined||files!==undefined||downloads!==undefined)break;
    }catch(err){console.info(`Admin overview route ${path} unavailable:`,err.message)}
  }
}
async function handleLogout(){
  try{await fetch(`${API_BASE}/api/auth/logout`,{method:"POST",credentials:"include"})}catch(err){console.warn(err)}
  setAdminVisible(false);toast("You have been signed out.");
}
document.addEventListener("DOMContentLoaded",()=>{setupEvents();loadArchive();checkSession()});
})();
