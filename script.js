/* ============================================================
   O SOM QUE NÃO DEVERIA EXISTIR — MURAL V2
   - Supabase: auth anônima + mesa + realtime
   - fallback localStorage quando não configurado
   ============================================================ */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const localKeys = { session:"sinosSession", positions:"sinosPositions", connections:"sinosConnections", notes:"sinosNotes", objects:"sinosObjects", uiSounds:"sinosUISounds" };
const config = window.SUPABASE_CONFIG || {};
let supabase = null, supabaseReady = false, realtimeChannels = [];
let appMode = "local", campaignId = null, campaignCode = null, playerName = "", playerRole = "player", currentUser = null;
let cards = [], objects = [], connections = [];
let selectedCard = null, dragging = null, dragMoved = false, connectingMode = false, zoom = 1;
let editingNote = null;

/* ---------- feedback / audio ---------- */
let audioContext = null;
let uiSoundsEnabled = localStorage.getItem(localKeys.uiSounds) !== "false";
const noteHz = { D3:146.83,F3:174.61,A3:220,C4:261.63,D4:293.66,F4:349.23,A4:440,C5:523.25,D5:587.33,F5:698.46,A5:880 };
function getAudio(){ if(!audioContext){ audioContext = new (window.AudioContext||window.webkitAudioContext)(); } if(audioContext.state === "suspended") audioContext.resume(); return audioContext; }
function tone(note,duration=.07,delay=0,type="sine",volume=.035){ if(!uiSoundsEnabled) return; const ctx=getAudio(), now=ctx.currentTime+delay, osc=ctx.createOscillator(), gain=ctx.createGain(); osc.type=type; osc.frequency.value=noteHz[note]||note; gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(volume,now+.008); gain.gain.exponentialRampToValueAtTime(.0001,now+duration); osc.connect(gain).connect(ctx.destination); osc.start(now); osc.stop(now+duration+.02); }
function playUISound(kind="click"){ if(!uiSoundsEnabled) return; const m={click:()=>tone("D4",.06,0,"triangle",.028),nav:()=>{tone("D4",.05,0,"triangle",.025);tone("A4",.09,.035,"sine",.018)},panel:()=>{tone("F4",.06,0,"triangle",.026);tone("A4",.09,.045,"sine",.018)},card:()=>{tone("D4",.07,0,"triangle",.03);tone("F4",.09,.04,"sine",.02)},connect:()=>{tone("D4",.08,0,"triangle",.03);tone("A4",.09,.07,"triangle",.024);tone("D5",.12,.14,"sine",.015)},tool:()=>tone("F4",.06,0,"triangle",.026),edit:()=>{tone("A4",.05,0,"triangle",.024);tone("C5",.09,.035,"sine",.017)},save:()=>{tone("D4",.06,0,"triangle",.023);tone("F4",.06,.05,"triangle",.019);tone("A4",.11,.1,"sine",.016)},enter:()=>{tone("D3",.12,0,"sine",.03);tone("A3",.15,.08,"sine",.024);tone("D4",.2,.18,"triangle",.013)},document:()=>{tone("A3",.08,0,"triangle",.024);tone("D4",.11,.05,"sine",.016)},danger:()=>{tone("F4",.06,0,"triangle",.024);tone("D4",.11,.06,"sine",.017)}}; (m[kind]||m.click)(); }
function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2400); }
document.addEventListener("click",e=>{ const t=e.target.closest("button,a,.object-tile,.board-object,.location-item,.document-card"); if(!t)return; if(t.closest("textarea,input"))return; playUISound(t.dataset.sound||"click"); });

/* ---------- config / startup ---------- */
function hasSupabaseConfig(){ return Boolean(config.url && config.anonKey && !String(config.url).startsWith("COLE_AQUI") && !String(config.anonKey).startsWith("COLE_AQUI")); }
function setSync(label, connected){ $("#syncStatus").textContent=label; $("#sessionLabel").textContent=connected?`${playerName.toUpperCase()} • ${campaignCode}`:"SEM MESA"; $("#sessionButton").classList.toggle("connected",connected); $("#footerState").textContent=connected?`MESA ${campaignCode}`:"MODO LOCAL"; }
async function initSupabase(){
  if(!hasSupabaseConfig() || !window.supabase?.createClient){ appMode="local"; setSync("modo local",false); return false; }
  try{
    supabase=window.supabase.createClient(config.url,config.anonKey);
    const {data,error}=await supabase.auth.getSession();
    if(error) throw error;
    currentUser=data.session?.user||null;
    if(!currentUser){ const res=await supabase.auth.signInAnonymously(); if(res.error) throw res.error; currentUser=res.data.user; }
    supabaseReady=true; appMode="supabase"; setSync("Supabase pronto",false); return true;
  }catch(err){ console.error(err); appMode="local"; setSync("falha no Supabase — modo local",false); toast("Não foi possível conectar ao Supabase. O site continua em modo local."); return false; }
}
async function restoreSession(){
  const saved=JSON.parse(localStorage.getItem(localKeys.session)||"null");
  if(saved?.campaignId && saved?.campaignCode && saved?.playerName){ campaignId=saved.campaignId; campaignCode=saved.campaignCode; playerName=saved.playerName; playerRole=saved.playerRole||"player"; return true; }
  return false;
}
async function bootstrap(){
  const ok=await initSupabase();
  if(ok && await restoreSession()){
    await loadCampaignData(); closeSetup(); subscribeRealtime();
  }else if(!ok && await restoreSession()){
    loadLocalData(); closeSetup();
  }else{
    if(!hasSupabaseConfig()) $("#setupMessage").innerHTML=`Configure <code>config.js</code> com a URL e a chave anon pública do Supabase para habilitar o mural compartilhado. Você também pode testar tudo em <strong>modo local</strong>.`;
    else $("#setupMessage").textContent="Entre em uma mesa existente ou crie uma nova mesa.";
  }
}

/* ---------- setup modal ---------- */
/* ---------- setup modal ---------- */

const setupModal = $("#setupModal");
const joinForm = $("#joinForm");

function closeSetup(){
  setupModal.classList.remove("open");
  setupModal.setAttribute("aria-hidden","true");
}

function openSetup(){
  setupModal.classList.add("open");
  setupModal.setAttribute("aria-hidden","false");

  $("#joinName").value = playerName || "";

  setTimeout(() => {
    $("#joinName").focus();
  }, 50);
}

$("#localModeBtn").addEventListener("click", () => {

  appMode = "local";
  campaignId = "local";
  campaignCode = "LOCAL";

  playerName =
    $("#joinName").value.trim() || "Jogador";

  playerRole = "player";

  localStorage.setItem(
    localKeys.session,
    JSON.stringify({
      campaignId,
      campaignCode,
      playerName,
      playerRole
    })
  );

  loadLocalData();
  closeSetup();

  toast(
    "Modo local ativo — o quadro ficará neste navegador."
  );
});

joinForm.addEventListener("submit", async e => {

  e.preventDefault();

  const name =
    $("#joinName").value.trim() || "Jogador";

  if(!supabaseReady){
    toast(
      "Configure o Supabase primeiro ou use o modo local."
    );
    return;
  }

  try{

    const {
      data,
      error
    } = await supabase.rpc(
      "enter_main_campaign",
      {
        p_display_name: name
      }
    );

    if(error){
      throw error;
    }

    const row = data?.[0];

    if(!row){
      throw new Error(
        "MAIN_CAMPAIGN_NOT_FOUND"
      );
    }

    campaignId =
      row.campaign_id;

    campaignCode =
      row.campaign_code;

    playerName =
      name;

    playerRole =
      "player";

    localStorage.setItem(
      localKeys.session,
      JSON.stringify({
        campaignId,
        campaignCode,
        playerName,
        playerRole
      })
    );

    await loadCampaignData();

    closeSetup();

    subscribeRealtime();

    toast(
      "Você entrou na investigação."
    );

  }catch(err){

    console.error(err);

    toast(
      `Não foi possível entrar: ${
        err.message || "erro desconhecido"
      }`
    );
  }
});

$("#sessionButton").addEventListener(
  "click",
  () => openSetup()
);
/* ---------- local dataset ---------- */
const seedLocal=[
 {id:"sangue",title:"SANGUE",clue_type:"PISTA",context:"Praça / condição do ritual",notes:"",x:6,y:13,rotation:0},
 {id:"medo",title:"MEDO",clue_type:"PISTA",context:"Atenção / amplificação",notes:"",x:39,y:8,rotation:0},
 {id:"grupo",title:"GRUPO",clue_type:"PISTA",context:"Pessoas coordenadas",notes:"",x:70,y:16,rotation:0},
 {id:"fragmentos",title:"FRAGMENTOS",clue_type:"PISTA",context:"Metal / ressonância",notes:"",x:13,y:59,rotation:0},
 {id:"sino",title:"SINO ANTECIPADO",clue_type:"ANOMALIA",context:"Registro acústico",notes:"",x:45,y:49,rotation:0},
 {id:"quinto",title:"QUINTO CÍRCULO",clue_type:"PISTA",context:"Símbolos / ritual",notes:"",x:72,y:58,rotation:0},
 {id:"sombra",title:"SOMBRA SEM OBJETO",clue_type:"MANIFESTAÇÃO",context:"Presença visual",notes:"",x:37,y:78,rotation:0}
];
const seedObjects=[
 {id:"radio",name:"RÁDIO",object_type:"ÁUDIO",description:"Um rádio que perdeu sinal por um segundo.",content:"O aparelho registra um ruído impossível de localizar.",x:8,y:7},
 {id:"fragmento-obj",name:"FRAGMENTO",object_type:"EVIDÊNCIA",description:"Peça de metal escuro sem ferrugem.",content:"Reage ao sangue e vibra perto de outro fragmento.",x:91,y:15},
 {id:"chave",name:"CHAVE",object_type:"OBJETO",description:"Chave de ferro escuro.",content:"Há indícios de que abre uma porta associada à escola municipal.",x:87,y:80},
 {id:"foto",name:"FOTOGRAFIA",object_type:"DOCUMENTO",description:"Fotografia de uma praça vazia.",content:"Três fotografias mostram círculos de sangue em locais diferentes.",x:7,y:82},
 {id:"mapa",name:"MAPA",object_type:"DOCUMENTO",description:"Mapa com cinco locais marcados.",content:"Praça Santa Cecília, Apartamento 18, Túnel ferroviário, Escola municipal e Torre sem nome.",x:91,y:57}
];
function loadLocalData(){ cards=JSON.parse(localStorage.getItem("sinosLocalCards")||"null")||structuredClone(seedLocal); connections=JSON.parse(localStorage.getItem(localKeys.connections)||"[]"); objects=JSON.parse(localStorage.getItem(localKeys.objects)||"null")||structuredClone(seedObjects); renderAll(); setSync("modo local",false); }
function saveLocal(){ localStorage.setItem("sinosLocalCards",JSON.stringify(cards)); localStorage.setItem(localKeys.connections,JSON.stringify(connections)); localStorage.setItem(localKeys.objects,JSON.stringify(objects)); }

/* ---------- Supabase data ---------- */
async function loadCampaignData(){
  if(appMode!=="supabase")return loadLocalData();
  const [cr,or]=await Promise.all([supabase.from("clues").select("*").eq("campaign_id",campaignId).order("created_at"),supabase.from("objects").select("*").eq("campaign_id",campaignId).order("created_at")]);
  if(cr.error) throw cr.error; if(or.error) throw or.error;
  cards=cr.data||[]; objects=or.data||[];
  const cn=await supabase.from("connections").select("id,campaign_id,clue_a,clue_b").eq("campaign_id",campaignId); if(cn.error)throw cn.error; connections=cn.data||[];
  await loadEntityNotes(); renderAll(); setSync("sincronizado",true);
}
async function loadEntityNotes(){
  if(appMode!=="supabase"){ applyLocalEntityNotes(); return; }
  const res=await supabase.from("entity_notes").select("*").eq("campaign_id",campaignId); if(res.error)throw res.error;
  window._entityNotes=res.data||[]; renderEntityNotes();
}
function applyLocalEntityNotes(){ const n=JSON.parse(localStorage.getItem(localKeys.notes)||"{}"); window._entityNotes=Object.entries(n).map(([key,text])=>({entity_kind:key.split(":")[0],entity_key:key.split(":")[1],author_name:playerName||"Mesa",text})); renderEntityNotes(); }

/* ---------- render board ---------- */
function cardNumber(index){ return String(index+1).padStart(2,"0"); }
function renderAll(){ renderCards(); renderObjects(); renderConnections(); renderEntityNotes(); applyImageAssets(); filterCards(); }
function renderCards(){ const canvas=$("#boardCanvas"); canvas.querySelectorAll(".evidence-card").forEach(c=>c.remove()); if(!cards.length){const e=document.createElement("div");e.className="evidence-card empty-card";e.style.left="40%";e.style.top="35%";e.textContent="NENHUMA PISTA";canvas.appendChild(e);return;} cards.forEach((card,i)=>{ const el=document.createElement("article"); el.className="evidence-card"; el.dataset.id=card.id; el.dataset.title=card.title; el.dataset.type=card.clue_type; el.dataset.context=card.context||""; el.style.left=`${Number(card.x)}%`; el.style.top=`${Number(card.y)}%`; el.style.setProperty("--rotation",`${Number(card.rotation||0)}deg`); el.innerHTML=`<div class="card-pin"></div><span class="card-number">${cardNumber(i)}</span><span class="card-type">${escapeHtml(card.clue_type||"PISTA")}</span><h3>${escapeHtml(card.title)}</h3><p class="card-context">${escapeHtml(card.context||"")}</p><div class="card-notes-wrap"><span class="card-notes-label">ANOTAÇÕES DA EQUIPE</span><textarea class="card-notes" data-card-notes placeholder="Escreva aqui a sua leitura..."></textarea></div><button class="mini-edit" type="button" data-sound="edit">EDITAR</button>${!String(card.id).match(/^(sangue|medo|grupo|fragmentos|sino|quinto|sombra)$/)?'<button class="mini-delete" type="button" data-sound="danger" title="Excluir">×</button>':''}`; canvas.appendChild(el); wireCard(el); const ta=$("[data-card-notes]",el); ta.value=card.notes||""; ta.addEventListener("pointerdown",e=>e.stopPropagation()); ta.addEventListener("click",e=>e.stopPropagation()); ta.addEventListener("input",()=>debouncedSaveCardNotes(card.id,ta.value)); }); }
function renderObjects(){ const layer=$("#boardObjectLayer"), grid=$("#objectGrid"); layer.innerHTML=""; grid.innerHTML=""; objects.forEach(obj=>{ const o=document.createElement("button");o.className="board-object";o.style.left=`${obj.x}%`;o.style.top=`${obj.y}%`;o.innerHTML=`<span>${escapeHtml(obj.name)}<small>${escapeHtml(obj.object_type||"OBJETO")}</small></span>`;o.addEventListener("click",()=>openObject(obj));layer.appendChild(o); const tile=document.createElement("button");tile.className="object-tile";tile.type="button";tile.innerHTML=`<span>${escapeHtml(obj.object_type||"OBJETO")}</span><strong>${escapeHtml(obj.name)}</strong><small>ABRIR ↗</small>`;tile.addEventListener("click",()=>openObject(obj));grid.appendChild(tile); }); }
function renderConnections(){ const svg=$("#connections"), canvas=$("#boardCanvas");svg.innerHTML="";svg.setAttribute("viewBox",`0 0 ${canvas.clientWidth} ${canvas.clientHeight}`); connections.forEach(c=>{ const aId=c.clue_a||c[0],bId=c.clue_b||c[1]; const a=canvas.querySelector(`[data-id="${CSS.escape(aId)}"]`),b=canvas.querySelector(`[data-id="${CSS.escape(bId)}"]`);if(!a||!b)return;const p1=cardCenter(a),p2=cardCenter(b),line=document.createElementNS("http://www.w3.org/2000/svg","line");line.setAttribute("x1",p1.x);line.setAttribute("y1",p1.y);line.setAttribute("x2",p2.x);line.setAttribute("y2",p2.y);line.classList.add("connection-line");if(selectedCard&&(selectedCard===a||selectedCard===b))line.classList.add("highlight");svg.appendChild(line);}); $("#cardCount").textContent=cards.length;$("#connectionCount").textContent=connections.length; }
function renderEntityNotes(){ $$(".shared-notes").forEach(box=>{ const kind=box.dataset.noteKind,key=box.dataset.noteKey;box.innerHTML="";const notes=(window._entityNotes||[]).filter(n=>n.entity_kind===kind&&n.entity_key===key&&n.text?.trim());notes.slice(-4).forEach(n=>{const row=document.createElement("div");row.className="note-line";row.innerHTML=`<strong>${escapeHtml(n.author_name||"Mesa")}</strong> ${escapeHtml(n.text)}`;box.appendChild(row);}); }); }
function applyImageAssets(){ $$(".image-slot[data-asset]").forEach(el=>{ const path=el.dataset.asset; const img=new Image();img.onload=()=>{el.style.setProperty("--location-image",`url("${path}")`);el.classList.add("has-image"); if(el.classList.contains("character-bg"))el.style.backgroundImage=`url("${path}")`; };img.src=path; }); }
function filterCards(){ const q=$("#boardSearch").value.trim().toLowerCase(); cards.forEach(card=>{const el=$("#boardCanvas [data-id=\""+CSS.escape(card.id)+"\"]");if(!el)return;const hay=[card.title,card.context,card.clue_type,card.notes].join(" ").toLowerCase();el.classList.toggle("dimmed",Boolean(q&&!hay.includes(q)));}); }
function cardCenter(card){return{x:card.offsetLeft+card.offsetWidth/2,y:card.offsetTop+card.offsetHeight/2};}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[m]));}

/* ---------- board interaction ---------- */
function wireCard(card){ card.addEventListener("pointerdown",e=>beginDrag(card,e));card.addEventListener("pointermove",e=>moveDrag(card,e));card.addEventListener("pointerup",()=>endDrag(card));card.addEventListener("pointercancel",()=>endDrag(card));card.addEventListener("click",e=>{if(dragMoved){dragMoved=false;return;}if(e.target.closest("textarea,button"))return;if(connectingMode||selectedCard){if(!selectedCard){selectCard(card);}else if(selectedCard!==card){toggleConnection(selectedCard.dataset.id,card.dataset.id);selectCard(null);}else{selectCard(null);}return;}playUISound("card");selectCard(card);});$(".mini-edit",card)?.addEventListener("click",e=>{e.stopPropagation();openCardEditor(card.dataset.id)});$(".mini-delete",card)?.addEventListener("click",e=>{e.stopPropagation();deleteCard(card.dataset.id)}); }
function beginDrag(card,e){if(e.target.closest("textarea,button"))return;dragging=card;dragMoved=false;card.classList.add("dragging");card.setPointerCapture(e.pointerId);const r=card.getBoundingClientRect(),br=$("#evidenceBoard").getBoundingClientRect();card.dataset.offsetX=(e.clientX-r.left)/zoom;card.dataset.offsetY=(e.clientY-r.top)/zoom;card.dataset.boardLeft=br.left;card.dataset.boardTop=br.top;}
function moveDrag(card,e){if(dragging!==card)return;dragMoved=true;const br=$("#evidenceBoard").getBoundingClientRect(),canvas=$("#boardCanvas");const x=(e.clientX-br.left+$("#evidenceBoard").scrollLeft)/zoom-Number(card.dataset.offsetX),y=(e.clientY-br.top+$("#evidenceBoard").scrollTop)/zoom-Number(card.dataset.offsetY);const maxX=canvas.clientWidth-card.offsetWidth,maxY=canvas.clientHeight-card.offsetHeight;card.style.left=`${Math.max(0,Math.min(x,maxX))/canvas.clientWidth*100}%`;card.style.top=`${Math.max(0,Math.min(y,maxY))/canvas.clientHeight*100}%`;const item=cards.find(c=>String(c.id)===String(card.dataset.id));if(item){item.x=parseFloat(card.style.left);item.y=parseFloat(card.style.top);}renderConnections();}
async function endDrag(card){if(dragging!==card)return;dragging=null;card.classList.remove("dragging");if(dragMoved){const item=cards.find(c=>String(c.id)===String(card.dataset.id));if(item)await saveCardPosition(item);}}
function selectCard(card){if(selectedCard)selectedCard.classList.remove("selected");selectedCard=card;if(card)card.classList.add("selected");renderConnections();}
function toggleConnection(aId,bId){ if(appMode==="supabase")saveConnectionRemote(aId,bId);else{const [a,b]=[aId,bId].sort();const i=connections.findIndex(c=>{const x=c.clue_a||c[0],y=c.clue_b||c[1];return x===a&&y===b});if(i>=0)connections.splice(i,1);else connections.push([a,b]);saveLocal();renderConnections();} playUISound("connect"); }
async function saveConnectionRemote(aId,bId){const [a,b]=[aId,bId].sort();const existing=connections.find(c=>(c.clue_a||c[0])===a&&(c.clue_b||c[1])===b);if(existing){await supabase.from("connections").delete().eq("id",existing.id);}else{const {error}=await supabase.from("connections").insert({campaign_id:campaignId,clue_a:a,clue_b:b,created_by:currentUser.id});if(error)toast("Não foi possível criar a conexão.");}}
async function saveCardPosition(item){if(appMode==="supabase"){await supabase.from("clues").update({x:item.x,y:item.y}).eq("id",item.id);}else saveLocal();}
let noteTimer=null;function debouncedSaveCardNotes(id,text){const item=cards.find(c=>String(c.id)===String(id));if(item)item.notes=text;clearTimeout(noteTimer);noteTimer=setTimeout(async()=>{if(appMode==="supabase")await supabase.from("clues").update({notes:text}).eq("id",id);else saveLocal();},250);filterCards();}

/* ---------- add/edit clues ---------- */
$("#addCardBtn").addEventListener("click",()=>openNewCard());
$("#connectionMode").addEventListener("click",()=>{connectingMode=!connectingMode;$("#connectionMode").classList.toggle("active",connectingMode);$("#connectionHint").textContent=connectingMode?"modo conectar ativo • clique em duas pistas":"arraste • escreva • conecte • todos veem as mudanças";selectCard(null);});
$("#resetBoard").addEventListener("click",()=>{cards.forEach((c,i)=>{const s=seedLocal.find(x=>x.title===c.title);if(s){c.x=s.x;c.y=s.y;const el=$("#boardCanvas [data-id=\""+CSS.escape(c.id)+"\"]");if(el){el.style.left=`${s.x}%`;el.style.top=`${s.y}%`;}}});cards.forEach(c=>saveCardPosition(c));renderConnections();toast("Posições reposicionadas.");});
$("#boardSearch").addEventListener("input",filterCards);
$("#zoomIn").addEventListener("click",()=>setZoom(Math.min(1.35,zoom+.1)));$("#zoomOut").addEventListener("click",()=>setZoom(Math.max(.75,zoom-.1)));
function setZoom(v){zoom=Number(v.toFixed(2));$("#boardCanvas").style.transform=`scale(${zoom})`;$("#zoomLabel").textContent=`${Math.round(zoom*100)}%`;renderConnections();}
function openNewCard(){$("#newCardModal").classList.add("open");$("#newCardTitle").focus();}
$("[data-close-new-card]")?.addEventListener("click",closeNewCard);function closeNewCard(){$("#newCardModal").classList.remove("open");}
$("#createCard").addEventListener("click",async()=>{const title=$("#newCardTitle").value.trim();if(!title){toast("Dê um título à pista.");return;}const obj={title,clue_type:$("#newCardType").value.trim()||"PISTA",context:$("#newCardContext").value.trim()||"",notes:"",x:25+Math.random()*50,y:20+Math.random()*55,rotation:(Math.random()*2-1)};if(appMode==="supabase"){const {data,error}=await supabase.from("clues").insert({...obj,campaign_id:campaignId,created_by:currentUser.id}).select().single();if(error){toast("Não foi possível criar a pista.");return;}cards.push(data);}else{obj.id=crypto.randomUUID();cards.push(obj);saveLocal();}renderCards();renderConnections();closeNewCard();toast("Nova pista adicionada.");});
function openCardEditor(id){const card=cards.find(c=>String(c.id)===String(id));if(!card)return;editingNote={kind:"clue",key:id,card};$("#editorTitle").textContent=card.title;$("#editorText").value=card.notes||"";$("#editorModal").classList.add("open");$("#editorText").focus();}
async function deleteCard(id){if(!confirm("Excluir esta pista do quadro?"))return;if(appMode==="supabase")await supabase.from("clues").delete().eq("id",id);cards=cards.filter(c=>String(c.id)!==String(id));connections=connections.filter(c=>(c.clue_a||c[0])!==id&&(c.clue_b||c[1])!==id);if(appMode!=="supabase")saveLocal();renderAll();toast("Pista excluída.");}

/* ---------- entity note editor ---------- */
$$('.entity-note-btn').forEach(btn=>btn.addEventListener('click',()=>{editingNote={kind:btn.dataset.noteKind,key:btn.dataset.noteKey};const existing=(window._entityNotes||[]).find(n=>n.entity_kind===editingNote.kind&&n.entity_key===editingNote.key&&n.user_id===currentUser?.id);$("#editorTitle").textContent="ANOTAÇÃO";$("#editorText").value=existing?.text||"";$("#editorModal").classList.add("open");}));
$("#cancelEditor").addEventListener("click",()=>$("#editorModal").classList.remove("open"));$$('[data-close-editor]').forEach(x=>x.addEventListener('click',()=>$("#editorModal").classList.remove("open")));
$("#saveEditor").addEventListener("click",async()=>{const text=$("#editorText").value.trim();if(!editingNote)return;if(editingNote.kind==="clue"){const item=cards.find(c=>String(c.id)===String(editingNote.key));if(item)item.notes=text;await debouncedSaveCardNotes(editingNote.key,text);}else await saveEntityNote(editingNote.kind,editingNote.key,text);$("#editorModal").classList.remove("open");playUISound("save");});
async function saveEntityNote(kind,key,text){if(appMode==="supabase"){const {data,error}=await supabase.from("entity_notes").upsert({campaign_id:campaignId,entity_kind:kind,entity_key:key,user_id:currentUser.id,author_name:playerName,text},{onConflict:"campaign_id,entity_kind,entity_key,user_id"}).select().single();if(error){toast("Não foi possível salvar a anotação.");return;}const others=(window._entityNotes||[]).filter(n=>!(n.entity_kind===kind&&n.entity_key===key&&n.user_id===currentUser.id));window._entityNotes=[...others,data];}else{const notes=JSON.parse(localStorage.getItem(localKeys.notes)||"{}");notes[`${kind}:${key}`]=text;localStorage.setItem(localKeys.notes,JSON.stringify(notes));applyLocalEntityNotes();}renderEntityNotes();}

/* ---------- objects ---------- */
function openObject(obj){$("#modalType").textContent=obj.object_type||"OBJETO";$("#modalTitle").textContent=obj.name;$("#modalContent").innerHTML=`<p><strong>${escapeHtml(obj.description||"")}</strong></p><p>${escapeHtml(obj.content||"")}</p>`;$("#documentModal").classList.add("open");}
$$('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>$("#documentModal").classList.remove("open")));
const documents={report:{type:"DOCUMENTO 17 — EXTRATO",title:"Relatório encontrado",html:`<div class="paper"><p><strong>02:12</strong> — registro acústico identificado.</p><p><strong>02:16</strong> — preparação do estímulo.</p><p><strong>02:17</strong> — presença de sangue.</p><p><strong>02:20</strong> — manifestação.</p><hr><p><strong>OBSERVAÇÃO:</strong> o som foi registrado antes da preparação do estímulo.</p><p><strong>OBSERVAÇÃO COMPLEMENTAR:</strong> não repetir o procedimento sem autorização.</p><p class="hand">Quem autorizou?</p></div>`},fifth:{type:"ANOTAÇÃO MANUSCRITA",title:"A frase do quinto",html:`<div class="paper"><p class="hand">“Não é o quinto que abre.<br>É o quinto que chama.<br>Não faça o quinto tocar.”</p></div>`},box:{type:"CAIXA DE PROVAS",title:"Mapa + recibos",html:`<div class="paper"><p><strong>LOCAIS:</strong> Praça Santa Cecília, Apartamento 18, Túnel ferroviário, Escola municipal, Torre sem nome.</p><p><strong>HORÁRIOS:</strong> 02:12 • 02:40 • 03:05 • 03:30 • 03:55</p><p><strong>OBJETOS:</strong> fotografias, recibos de metal e velas, lista de horários e uma chave de ferro escuro.</p><p class="hand">O quinto não é convocado. O quinto convoca.</p></div>`}};
$$('.document-card').forEach(btn=>btn.addEventListener('click',()=>{const d=documents[btn.dataset.document];$("#modalType").textContent=d.type;$("#modalTitle").textContent=d.title;$("#modalContent").innerHTML=d.html;$("#documentModal").classList.add("open");}));

/* ---------- realtime ---------- */
function subscribeRealtime(){ if(appMode!=="supabase")return; realtimeChannels.forEach(c=>supabase.removeChannel(c));realtimeChannels=[]; const ch= supabase.channel(`campaign-${campaignId}`).on("postgres_changes",{event:"*",schema:"public",table:"clues",filter:`campaign_id=eq.${campaignId}`},async payload=>{if(payload.eventType==="INSERT"&&!cards.some(c=>c.id===payload.new.id))cards.push(payload.new);if(payload.eventType==="UPDATE"){const i=cards.findIndex(c=>c.id===payload.new.id);if(i>=0)cards[i]={...cards[i],...payload.new};}if(payload.eventType==="DELETE")cards=cards.filter(c=>c.id!==payload.old.id);renderCards();renderConnections();filterCards();}).on("postgres_changes",{event:"*",schema:"public",table:"connections",filter:`campaign_id=eq.${campaignId}`},payload=>{if(payload.eventType==="INSERT"&&!connections.some(c=>c.id===payload.new.id))connections.push(payload.new);if(payload.eventType==="DELETE")connections=connections.filter(c=>c.id!==payload.old.id);if(payload.eventType==="UPDATE"){const i=connections.findIndex(c=>c.id===payload.new.id);if(i>=0)connections[i]=payload.new;}renderConnections();}).on("postgres_changes",{event:"*",schema:"public",table:"entity_notes",filter:`campaign_id=eq.${campaignId}`},payload=>{if(payload.eventType==="INSERT"&&!window._entityNotes.some(n=>n.id===payload.new.id))window._entityNotes.push(payload.new);if(payload.eventType==="UPDATE"){const i=window._entityNotes.findIndex(n=>n.id===payload.new.id);if(i>=0)window._entityNotes[i]=payload.new;}if(payload.eventType==="DELETE")window._entityNotes=window._entityNotes.filter(n=>n.id!==payload.old.id);renderEntityNotes();}).subscribe(status=>{if(status==="SUBSCRIBED")setSync("tempo real",true);});realtimeChannels.push(ch); }

/* ---------- ambient ---------- */
$("#soundToggle").addEventListener("click",()=>{const p=$("#soundPanel");p.classList.toggle("open");p.setAttribute("aria-hidden",String(!p.classList.contains("open")));});
$("#audioFile").addEventListener("change",()=>{const file=$("#audioFile").files[0];if(!file)return;const a=$("#ambientAudio");a.src=URL.createObjectURL(file);a.play().catch(()=>{});});
$("#enterBoard").addEventListener("click",()=>$("#boardSection").scrollIntoView({behavior:"smooth"}));
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;$$('.main-nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${entry.target.id}`));}),{rootMargin:"-35% 0px -55% 0px"});$$('main section[id]').forEach(s=>observer.observe(s));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){ $("#documentModal").classList.remove("open");$("#editorModal").classList.remove("open");$("#newCardModal").classList.remove("open");$("#soundPanel").classList.remove("open");}});
window.addEventListener("resize",()=>renderConnections());

/* ---------- init ---------- */
(async()=>{ await bootstrap(); })();
