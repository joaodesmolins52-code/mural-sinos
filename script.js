/* ============================================================
   O SOM QUE NÃO DEVERIA EXISTIR — MURAL V2
   MESA ÚNICA / ENTRADA AUTOMÁTICA
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const localKeys = {
  positions: "sinosPositions",
  connections: "sinosConnections",
  notes: "sinosNotes",
  objects: "sinosObjects",
  uiSounds: "sinosUISounds"
};

const config =
  window.SUPABASE_CONFIG || {};

let supabase = null;
let supabaseReady = false;
let realtimeChannels = [];

let appMode = "local";

let campaignId = null;
let campaignCode = "PONTO03";

let playerName = "Jogador";
let playerRole = "player";
let currentUser = null;

let cards = [];
let objects = [];
let connections = [];

let selectedCard = null;
let dragging = null;
let dragMoved = false;

let connectingMode = false;
let zoom = 1;

let editingNote = null;


/* ============================================================
   SOM
   ============================================================ */

let audioContext = null;

let uiSoundsEnabled =
  localStorage.getItem(
    localKeys.uiSounds
  ) !== "false";


const noteHz = {
  D3: 146.83,
  F3: 174.61,
  A3: 220,
  C4: 261.63,
  D4: 293.66,
  F4: 349.23,
  A4: 440,
  C5: 523.25,
  D5: 587.33,
  F5: 698.46,
  A5: 880
};


function getAudio(){

  if(!audioContext){

    audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

  }

  if(
    audioContext.state ===
    "suspended"
  ){

    audioContext.resume();

  }

  return audioContext;
}


function tone(
  note,
  duration = .07,
  delay = 0,
  type = "sine",
  volume = .035
){

  if(!uiSoundsEnabled){
    return;
  }

  const ctx =
    getAudio();

  const now =
    ctx.currentTime +
    delay;

  const osc =
    ctx.createOscillator();

  const gain =
    ctx.createGain();

  osc.type =
    type;

  osc.frequency.value =
    noteHz[note] || note;

  gain.gain.setValueAtTime(
    .0001,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    volume,
    now + .008
  );

  gain.gain.exponentialRampToValueAtTime(
    .0001,
    now + duration
  );

  osc
    .connect(gain)
    .connect(ctx.destination);

  osc.start(now);

  osc.stop(
    now +
    duration +
    .02
  );
}


function playUISound(
  kind = "click"
){

  if(!uiSoundsEnabled){
    return;
  }

  const sounds = {

    click: () =>
      tone(
        "D4",
        .06,
        0,
        "triangle",
        .028
      ),

    nav: () => {

      tone(
        "D4",
        .05,
        0,
        "triangle",
        .025
      );

      tone(
        "A4",
        .09,
        .035,
        "sine",
        .018
      );

    },

    panel: () => {

      tone(
        "F4",
        .06,
        0,
        "triangle",
        .026
      );

      tone(
        "A4",
        .09,
        .045,
        "sine",
        .018
      );

    },

    card: () => {

      tone(
        "D4",
        .07,
        0,
        "triangle",
        .03
      );

      tone(
        "F4",
        .09,
        .04,
        "sine",
        .02
      );

    },

    connect: () => {

      tone(
        "D4",
        .08,
        0,
        "triangle",
        .03
      );

      tone(
        "A4",
        .09,
        .07,
        "triangle",
        .024
      );

      tone(
        "D5",
        .12,
        .14,
        "sine",
        .015
      );

    },

    tool: () =>
      tone(
        "F4",
        .06,
        0,
        "triangle",
        .026
      ),

    edit: () => {

      tone(
        "A4",
        .05,
        0,
        "triangle",
        .024
      );

      tone(
        "C5",
        .09,
        .035,
        "sine",
        .017
      );

    },

    save: () => {

      tone(
        "D4",
        .06,
        0,
        "triangle",
        .023
      );

      tone(
        "F4",
        .06,
        .05,
        "triangle",
        .019
      );

      tone(
        "A4",
        .11,
        .1,
        "sine",
        .016
      );

    },

    enter: () => {

      tone(
        "D3",
        .12,
        0,
        "sine",
        .03
      );

      tone(
        "A3",
        .15,
        .08,
        "sine",
        .024
      );

      tone(
        "D4",
        .2,
        .18,
        "triangle",
        .013
      );

    },

    document: () => {

      tone(
        "A3",
        .08,
        0,
        "triangle",
        .024
      );

      tone(
        "D4",
        .11,
        .05,
        "sine",
        .016
      );

    },

    danger: () => {

      tone(
        "F4",
        .06,
        0,
        "triangle",
        .024
      );

      tone(
        "D4",
        .11,
        .06,
        "sine",
        .017
      );

    }

  };

  (
    sounds[kind] ||
    sounds.click
  )();
}


function toast(msg){

  const el =
    $("#toast");

  el.textContent =
    msg;

  el.classList.add(
    "show"
  );

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(
      () =>
        el.classList.remove(
          "show"
        ),
      2400
    );
}


document.addEventListener(
  "click",
  e => {

    const t =
      e.target.closest(
        "button,a,.object-tile,.board-object,.location-item,.document-card"
      );

    if(!t){
      return;
    }

    if(
      t.closest(
        "textarea,input"
      )
    ){
      return;
    }

    playUISound(
      t.dataset.sound ||
      "click"
    );

  }
);


/* ============================================================
   SUPABASE
   ============================================================ */

function hasSupabaseConfig(){

  return Boolean(
    config.url &&
    config.anonKey &&
    !String(
      config.url
    ).startsWith(
      "COLE_AQUI"
    ) &&
    !String(
      config.anonKey
    ).startsWith(
      "COLE_AQUI"
    )
  );
}


function setSync(
  label,
  connected
){

  const sync =
    $("#syncStatus");

  if(sync){
    sync.textContent =
      label;
  }

  const footer =
    $("#footerState");

  if(footer){

    footer.textContent =
      connected
        ? "MESA COMPARTILHADA"
        : "MODO LOCAL";

  }
}


async function initSupabase(){

  if(
    !hasSupabaseConfig() ||
    !window.supabase?.createClient
  ){

    appMode =
      "local";

    setSync(
      "modo local",
      false
    );

    return false;
  }


  try{

    supabase =
      window.supabase.createClient(
        config.url,
        config.anonKey
      );


    const {
      data,
      error
    } =
      await supabase.auth.getSession();


    if(error){
      throw error;
    }


    currentUser =
      data.session?.user ||
      null;


    if(!currentUser){

      const response =
        await supabase.auth
          .signInAnonymously();


      if(response.error){
        throw response.error;
      }


      currentUser =
        response.data.user;
    }


    if(!currentUser){
      throw new Error(
        "ANONYMOUS_AUTH_FAILED"
      );
    }


    supabaseReady =
      true;

    appMode =
      "supabase";


    setSync(
      "Supabase conectado",
      false
    );


    return true;

  }catch(err){

    console.error(
      "Supabase:",
      err
    );


    supabaseReady =
      false;

    appMode =
      "local";


    setSync(
      "modo local",
      false
    );


    return false;
  }
}


/* ============================================================
   ENTRADA AUTOMÁTICA NA MESA ÚNICA
   ============================================================ */

async function enterMainCampaign(){

  if(!supabaseReady){
    return false;
  }


  const {
    data,
    error
  } =
    await supabase.rpc(
      "enter_main_campaign"
    );


  if(error){
    throw error;
  }


  const row =
    data?.[0];


  if(!row){
    throw new Error(
      "MAIN_CAMPAIGN_NOT_FOUND"
    );
  }


  campaignId =
    row.campaign_id;


  campaignCode =
    row.campaign_code ||
    "PONTO03";


  playerName =
    "Jogador";


  playerRole =
    "player";


  return true;
}


/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */

async function bootstrap(){

  const connected =
    await initSupabase();


  if(!connected){

    loadLocalData();

    return;
  }


  try{

    await enterMainCampaign();

    await loadCampaignData();

    subscribeRealtime();

  }catch(err){

    console.error(
      "Entrada automática:",
      err
    );


    toast(
      "Não foi possível carregar a mesa compartilhada. Modo local ativado."
    );


    appMode =
      "local";

    campaignId =
      "local";

    campaignCode =
      "LOCAL";

    loadLocalData();

  }

}


/* ============================================================
   DADOS LOCAIS
   ============================================================ */

const seedLocal = [

  {
    id:
      "sangue",

    title:
      "SANGUE",

    clue_type:
      "PISTA",

    context:
      "Praça / condição do ritual",

    notes:
      "",

    x:
      6,

    y:
      13,

    rotation:
      0
  },

  {
    id:
      "medo",

    title:
      "MEDO",

    clue_type:
      "PISTA",

    context:
      "Atenção / amplificação",

    notes:
      "",

    x:
      39,

    y:
      8,

    rotation:
      0
  },

  {
    id:
      "grupo",

    title:
      "GRUPO",

    clue_type:
      "PISTA",

    context:
      "Pessoas coordenadas",

    notes:
      "",

    x:
      70,

    y:
      16,

    rotation:
      0
  },

  {
    id:
      "fragmentos",

    title:
      "FRAGMENTOS",

    clue_type:
      "PISTA",

    context:
      "Metal / ressonância",

    notes:
      "",

    x:
      13,

    y:
      59,

    rotation:
      0
  },

  {
    id:
      "sino",

    title:
      "SINO ANTECIPADO",

    clue_type:
      "ANOMALIA",

    context:
      "Registro acústico",

    notes:
      "",

    x:
      45,

    y:
      49,

    rotation:
      0
  },

  {
    id:
      "quinto",

    title:
      "QUINTO CÍRCULO",

    clue_type:
      "PISTA",

    context:
      "Símbolos / ritual",

    notes:
      "",

    x:
      72,

    y:
      58,

    rotation:
      0
  },

  {
    id:
      "sombra",

    title:
      "SOMBRA SEM OBJETO",

    clue_type:
      "MANIFESTAÇÃO",

    context:
      "Presença visual",

    notes:
      "",

    x:
      37,

    y:
      78,

    rotation:
      0
  }

];


const seedObjects = [

  {
    id:
      "radio",

    name:
      "RÁDIO",

    object_type:
      "ÁUDIO",

    description:
      "Um rádio que perdeu sinal por um segundo.",

    content:
      "O aparelho registra um ruído impossível de localizar.",

    x:
      8,

    y:
      7
  },

  {
    id:
      "fragmento-obj",

    name:
      "FRAGMENTO",

    object_type:
      "EVIDÊNCIA",

    description:
      "Peça de metal escuro sem ferrugem.",

    content:
      "Reage ao sangue e vibra perto de outro fragmento.",

    x:
      91,

    y:
      15
  },

  {
    id:
      "chave",

    name:
      "CHAVE",

    object_type:
      "OBJETO",

    description:
      "Chave de ferro escuro.",

    content:
      "Há indícios de que abre uma porta associada à escola municipal.",

    x:
      87,

    y:
      80
  },

  {
    id:
      "foto",

    name:
      "FOTOGRAFIA",

    object_type:
      "DOCUMENTO",

    description:
      "Fotografia de uma praça vazia.",

    content:
      "Três fotografias mostram círculos de sangue em locais diferentes.",

    x:
      7,

    y:
      82
  },

  {
    id:
      "mapa",

    name:
      "MAPA",

    object_type:
      "DOCUMENTO",

    description:
      "Mapa com cinco locais marcados.",

    content:
      "Praça Santa Cecília, Apartamento 18, Túnel ferroviário, Escola municipal e Torre sem nome.",

    x:
      91,

    y:
      57
  }

];


function loadLocalData(){

  cards =
    JSON.parse(
      localStorage.getItem(
        "sinosLocalCards"
      ) ||
      "null"
    ) ||
    structuredClone(
      seedLocal
    );


  connections =
    JSON.parse(
      localStorage.getItem(
        localKeys.connections
      ) ||
      "[]"
    );


  objects =
    JSON.parse(
      localStorage.getItem(
        localKeys.objects
      ) ||
      "null"
    ) ||
    structuredClone(
      seedObjects
    );


  renderAll();

  setSync(
    "modo local",
    false
  );
}


function saveLocal(){

  localStorage.setItem(
    "sinosLocalCards",
    JSON.stringify(
      cards
    )
  );


  localStorage.setItem(
    localKeys.connections,
    JSON.stringify(
      connections
    )
  );


  localStorage.setItem(
    localKeys.objects,
    JSON.stringify(
      objects
    )
  );
}


/* ============================================================
   SUPABASE DATA
   ============================================================ */

async function loadCampaignData(){

  if(
    appMode !==
    "supabase"
  ){

    loadLocalData();

    return;
  }


  const [
    cr,
    or
  ] =
    await Promise.all([

      supabase
        .from("clues")
        .select("*")
        .eq(
          "campaign_id",
          campaignId
        )
        .order("created_at"),

      supabase
        .from("objects")
        .select("*")
        .eq(
          "campaign_id",
          campaignId
        )
        .order("created_at")

    ]);


  if(cr.error){
    throw cr.error;
  }


  if(or.error){
    throw or.error;
  }


  cards =
    cr.data || [];

  objects =
    or.data || [];


  const cn =
    await supabase
      .from("connections")
      .select(
        "id,campaign_id,clue_a,clue_b"
      )
      .eq(
        "campaign_id",
        campaignId
      );


  if(cn.error){
    throw cn.error;
  }


  connections =
    cn.data || [];


  await loadEntityNotes();


  renderAll();


  setSync(
    "sincronizado",
    true
  );
}


async function loadEntityNotes(){

  if(
    appMode !==
    "supabase"
  ){

    applyLocalEntityNotes();

    return;
  }


  const res =
    await supabase
      .from("entity_notes")
      .select("*")
      .eq(
        "campaign_id",
        campaignId
      );


  if(res.error){
    throw res.error;
  }


  window._entityNotes =
    res.data || [];


  renderEntityNotes();
}


function applyLocalEntityNotes(){

  const notes =
    JSON.parse(
      localStorage.getItem(
        localKeys.notes
      ) ||
      "{}"
    );


  window._entityNotes =
    Object.entries(
      notes
    ).map(
      ([key,text]) => {

        const [
          entity_kind,
          entity_key
        ] =
          key.split(":");


        return {
          entity_kind,
          entity_key,
          author_name:
            "Jogador",
          text
        };

      }
    );


  renderEntityNotes();
}


/* ============================================================
   RENDER
   ============================================================ */

function cardNumber(index){

  return String(
    index + 1
  ).padStart(
    2,
    "0"
  );
}


function renderAll(){

  renderCards();
  renderObjects();
  renderConnections();
  renderEntityNotes();
  applyImageAssets();
  filterCards();

}


function renderCards(){

  const canvas =
    $("#boardCanvas");


  canvas
    .querySelectorAll(
      ".evidence-card"
    )
    .forEach(
      card =>
        card.remove()
    );


  if(!cards.length){

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "evidence-card empty-card";

    empty.style.left =
      "40%";

    empty.style.top =
      "35%";

    empty.textContent =
      "NENHUMA PISTA";

    canvas.appendChild(
      empty
    );

    return;
  }


  cards.forEach(
    (card,index) => {

      const el =
        document.createElement(
          "article"
        );


      el.className =
        "evidence-card";


      el.dataset.id =
        card.id;


      el.style.left =
        `${Number(card.x)}%`;


      el.style.top =
        `${Number(card.y)}%`;


      el.style.setProperty(
        "--rotation",
        `${Number(
          card.rotation ||
          0
        )}deg`
      );


      el.innerHTML = `

        <div class="card-pin"></div>

        <span class="card-number">
          ${cardNumber(index)}
        </span>

        <span class="card-type">
          ${escapeHtml(
            card.clue_type ||
            "PISTA"
          )}
        </span>

        <h3>
          ${escapeHtml(
            card.title
          )}
        </h3>

        <p class="card-context">
          ${escapeHtml(
            card.context ||
            ""
          )}
        </p>

        <div class="card-notes-wrap">

          <span class="card-notes-label">
            ANOTAÇÕES DA EQUIPE
          </span>

          <textarea
            class="card-notes"
            data-card-notes
            placeholder="Escreva aqui a sua leitura..."
          ></textarea>

        </div>

        <button
          class="mini-edit"
          type="button"
          data-sound="edit"
        >
          EDITAR
        </button>

        ${
          ![
            "sangue",
            "medo",
            "grupo",
            "fragmentos",
            "sino",
            "quinto",
            "sombra"
          ].includes(
            String(card.id)
          )

            ? `
              <button
                class="mini-delete"
                type="button"
                data-sound="danger"
              >
                ×
              </button>
            `

            : ""
        }

      `;


      canvas.appendChild(
        el
      );


      wireCard(
        el
      );


      const textarea =
        $(
          "[data-card-notes]",
          el
        );


      textarea.value =
        card.notes ||
        "";


      textarea.addEventListener(
        "pointerdown",
        e =>
          e.stopPropagation()
      );


      textarea.addEventListener(
        "click",
        e =>
          e.stopPropagation()
      );


      textarea.addEventListener(
        "input",
        () =>
          debouncedSaveCardNotes(
            card.id,
            textarea.value
          )
      );

    }
  );
}


function renderObjects(){

  const layer =
    $("#boardObjectLayer");

  const grid =
    $("#objectGrid");


  layer.innerHTML =
    "";

  grid.innerHTML =
    "";


  objects.forEach(
    obj => {

      const boardObject =
        document.createElement(
          "button"
        );


      boardObject.type =
        "button";

      boardObject.className =
        "board-object";


      boardObject.style.left =
        `${obj.x}%`;


      boardObject.style.top =
        `${obj.y}%`;


      boardObject.innerHTML = `

        <span>

          ${escapeHtml(
            obj.name
          )}

          <small>
            ${escapeHtml(
              obj.object_type ||
              "OBJETO"
            )}
          </small>

        </span>

      `;


      boardObject.addEventListener(
        "click",
        () =>
          openObject(
            obj
          )
      );


      layer.appendChild(
        boardObject
      );


      const tile =
        document.createElement(
          "button"
        );


      tile.type =
        "button";

      tile.className =
        "object-tile";


      tile.innerHTML = `

        <span>
          ${escapeHtml(
            obj.object_type ||
            "OBJETO"
          )}
        </span>

        <strong>
          ${escapeHtml(
            obj.name
          )}
        </strong>

        <small>
          ABRIR ↗
        </small>

      `;


      tile.addEventListener(
        "click",
        () =>
          openObject(
            obj
          )
      );


      grid.appendChild(
        tile
      );

    }
  );
}


function renderConnections(){

  const svg =
    $("#connections");

  const canvas =
    $("#boardCanvas");


  svg.innerHTML =
    "";


  connections.forEach(
    connection => {

      const aId =
        connection.clue_a ||
        connection[0];

      const bId =
        connection.clue_b ||
        connection[1];


      const a =
        canvas.querySelector(
          `[data-id="${CSS.escape(aId)}"]`
        );


      const b =
        canvas.querySelector(
          `[data-id="${CSS.escape(bId)}"]`
        );


      if(!a || !b){
        return;
      }


      const p1 =
        cardCenter(a);


      const p2 =
        cardCenter(b);


      const line =
        document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );


      line.setAttribute(
        "x1",
        p1.x
      );

      line.setAttribute(
        "y1",
        p1.y
      );

      line.setAttribute(
        "x2",
        p2.x
      );

      line.setAttribute(
        "y2",
        p2.y
      );


      line.classList.add(
        "connection-line"
      );


      if(
        selectedCard &&
        (
          selectedCard === a ||
          selectedCard === b
        )
      ){

        line.classList.add(
          "highlight"
        );

      }


      svg.appendChild(
        line
      );

    }
  );


  $("#cardCount")
    .textContent =
      cards.length;


  $("#connectionCount")
    .textContent =
      connections.length;
}


function renderEntityNotes(){

  $$(".shared-notes")
    .forEach(
      box => {

        const kind =
          box.dataset.noteKind;

        const key =
          box.dataset.noteKey;


        box.innerHTML =
          "";


        const notes =
          (
            window._entityNotes ||
            []
          )
          .filter(
            note =>
              note.entity_kind ===
                kind &&
              note.entity_key ===
                key &&
              note.text?.trim()
          );


        notes
          .slice(-4)
          .forEach(
            note => {

              const row =
                document.createElement(
                  "div"
                );


              row.className =
                "note-line";


              row.innerHTML = `

                <strong>
                  ${escapeHtml(
                    note.author_name ||
                    "Jogador"
                  )}
                </strong>

                ${escapeHtml(
                  note.text
                )}

              `;


              box.appendChild(
                row
              );

            }
          );

      }
    );
}


function applyImageAssets(){

  $$(".image-slot[data-asset]")
    .forEach(
      el => {

        const path =
          el.dataset.asset;


        const img =
          new Image();


        img.onload =
          () => {

            el.style.setProperty(
              "--location-image",
              `url("${path}")`
            );


            el.classList.add(
              "has-image"
            );


            if(
              el.classList.contains(
                "character-bg"
              )
            ){

              el.style.backgroundImage =
                `url("${path}")`;

            }

          };


        img.src =
          path;

      }
    );
}


function filterCards(){

  const q =
    $("#boardSearch")
      .value
      .trim()
      .toLowerCase();


  cards.forEach(
    card => {

      const el =
        $(
          "#boardCanvas [data-id=\"" +
          CSS.escape(
            card.id
          ) +
          "\"]"
        );


      if(!el){
        return;
      }


      const text =
        [
          card.title,
          card.context,
          card.clue_type,
          card.notes
        ]
        .join(" ")
        .toLowerCase();


      el.classList.toggle(
        "dimmed",
        Boolean(
          q &&
          !text.includes(q)
        )
      );

    }
  );
}


function cardCenter(card){

  return {

    x:
      card.offsetLeft +
      card.offsetWidth / 2,

    y:
      card.offsetTop +
      card.offsetHeight / 2

  };
}


function escapeHtml(
  value
){

  return String(
    value ?? ""
  ).replace(
    /[&<>'"]/g,
    char =>
      ({
        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        "'":
          "&#39;",

        '"':
          "&quot;"

      }[char])
  );
}


/* ============================================================
   BOARD
   ============================================================ */

function wireCard(
  card
){

  card.addEventListener(
    "pointerdown",
    e =>
      beginDrag(
        card,
        e
      )
  );


  card.addEventListener(
    "pointermove",
    e =>
      moveDrag(
        card,
        e
      )
  );


  card.addEventListener(
    "pointerup",
    () =>
      endDrag(
        card
      )
  );


  card.addEventListener(
    "pointercancel",
    () =>
      endDrag(
        card
      )
  );


  card.addEventListener(
    "click",
    e => {

      if(dragMoved){

        dragMoved =
          false;

        return;
      }


      if(
        e.target.closest(
          "textarea,button"
        )
      ){

        return;
      }


      if(
        connectingMode ||
        selectedCard
      ){

        if(!selectedCard){

          selectCard(
            card
          );

        }else if(
          selectedCard !==
          card
        ){

          toggleConnection(
            selectedCard.dataset.id,
            card.dataset.id
          );

          selectCard(
            null
          );

        }else{

          selectCard(
            null
          );

        }


        return;
      }


      selectCard(
        card
      );

    }
  );


  $(".mini-edit",card)
    ?.addEventListener(
      "click",
      e => {

        e.stopPropagation();

        openCardEditor(
          card.dataset.id
        );

      }
    );


  $(".mini-delete",card)
    ?.addEventListener(
      "click",
      e => {

        e.stopPropagation();

        deleteCard(
          card.dataset.id
        );

      }
    );
}


function beginDrag(
  card,
  e
){

  if(
    e.target.closest(
      "textarea,button"
    )
  ){

    return;
  }


  dragging =
    card;

  dragMoved =
    false;


  card.classList.add(
    "dragging"
  );


  card.setPointerCapture(
    e.pointerId
  );


  const rect =
    card.getBoundingClientRect();


  const board =
    $("#evidenceBoard")
      .getBoundingClientRect();


  card.dataset.offsetX =
    (
      e.clientX -
      rect.left
    ) /
    zoom;


  card.dataset.offsetY =
    (
      e.clientY -
      rect.top
    ) /
    zoom;


  card.dataset.boardLeft =
    board.left;


  card.dataset.boardTop =
    board.top;
}


function moveDrag(
  card,
  e
){

  if(
    dragging !==
    card
  ){

    return;
  }


  dragMoved =
    true;


  const board =
    $("#evidenceBoard")
      .getBoundingClientRect();


  const canvas =
    $("#boardCanvas");


  const x =
    (
      e.clientX -
      board.left +
      $("#evidenceBoard")
        .scrollLeft
    ) /
    zoom -
    Number(
      card.dataset.offsetX
    );


  const y =
    (
      e.clientY -
      board.top +
      $("#evidenceBoard")
        .scrollTop
    ) /
    zoom -
    Number(
      card.dataset.offsetY
    );


  const maxX =
    canvas.clientWidth -
    card.offsetWidth;


  const maxY =
    canvas.clientHeight -
    card.offsetHeight;


  const finalX =
    Math.max(
      0,
      Math.min(
        x,
        maxX
      )
    );


  const finalY =
    Math.max(
      0,
      Math.min(
        y,
        maxY
      )
    );


  card.style.left =
    `${finalX /
      canvas.clientWidth *
      100}%`;


  card.style.top =
    `${finalY /
      canvas.clientHeight *
      100}%`;


  const item =
    cards.find(
      c =>
        String(c.id) ===
        String(
          card.dataset.id
        )
    );


  if(item){

    item.x =
      parseFloat(
        card.style.left
      );

    item.y =
      parseFloat(
        card.style.top
      );

  }


  renderConnections();
}


async function endDrag(
  card
){

  if(
    dragging !==
    card
  ){

    return;
  }


  dragging =
    null;


  card.classList.remove(
    "dragging"
  );


  if(!dragMoved){
    return;
  }


  const item =
    cards.find(
      c =>
        String(c.id) ===
        String(
          card.dataset.id
        )
    );


  if(item){

    await saveCardPosition(
      item
    );

  }
}


function selectCard(
  card
){

  if(selectedCard){

    selectedCard.classList.remove(
      "selected"
    );

  }


  selectedCard =
    card;


  if(card){

    card.classList.add(
      "selected"
    );

  }


  renderConnections();
}


function toggleConnection(
  aId,
  bId
){

  if(
    appMode ===
    "supabase"
  ){

    saveConnectionRemote(
      aId,
      bId
    );

  }else{

    const [
      a,
      b
    ] =
      [aId,bId]
        .sort();


    const index =
      connections.findIndex(
        connection => {

          const x =
            connection.clue_a ||
            connection[0];

          const y =
            connection.clue_b ||
            connection[1];


          return (
            x === a &&
            y === b
          );

        }
      );


    if(index >= 0){

      connections.splice(
        index,
        1
      );

    }else{

      connections.push([
        a,
        b
      ]);

    }


    saveLocal();

    renderConnections();

  }


  playUISound(
    "connect"
  );
}


async function saveConnectionRemote(
  aId,
  bId
){

  const [
    a,
    b
  ] =
    [aId,bId]
      .sort();


  const existing =
    connections.find(
      connection =>
        (
          connection.clue_a ||
          connection[0]
        ) === a &&
        (
          connection.clue_b ||
          connection[1]
        ) === b
    );


  if(existing){

    const {
      error
    } =
      await supabase
        .from("connections")
        .delete()
        .eq(
          "id",
          existing.id
        );


    if(error){

      toast(
        "Não foi possível remover a conexão."
      );

      return;
    }

  }else{

    const {
      error
    } =
      await supabase
        .from("connections")
        .insert({

          campaign_id:
            campaignId,

          clue_a:
            a,

          clue_b:
            b,

          created_by:
            currentUser.id

        });


    if(error){

      toast(
        "Não foi possível criar a conexão."
      );

      return;
    }

  }
}


async function saveCardPosition(
  item
){

  if(
    appMode ===
    "supabase"
  ){

    const {
      error
    } =
      await supabase
        .from("clues")
        .update({

          x:
            item.x,

          y:
            item.y

        })
        .eq(
          "id",
          item.id
        );


    if(error){

      console.error(
        error
      );

    }

  }else{

    saveLocal();

  }
}


let noteTimer =
  null;


function debouncedSaveCardNotes(
  id,
  text
){

  const item =
    cards.find(
      card =>
        String(card.id) ===
        String(id)
    );


  if(item){

    item.notes =
      text;

  }


  clearTimeout(
    noteTimer
  );


  noteTimer =
    setTimeout(
      async () => {

        if(
          appMode ===
          "supabase"
        ){

          const {
            error
          } =
            await supabase
              .from("clues")
              .update({
                notes:
                  text
              })
              .eq(
                "id",
                id
              );


          if(error){

            console.error(
              error
            );

          }

        }else{

          saveLocal();

        }

      },
      250
    );


  filterCards();
}


/* ============================================================
   NOVA PISTA
   ============================================================ */

$("#addCardBtn")
  .addEventListener(
    "click",
    openNewCard
  );


$("#connectionMode")
  .addEventListener(
    "click",
    () => {

      connectingMode =
        !connectingMode;


      $("#connectionMode")
        .classList
        .toggle(
          "active",
          connectingMode
        );


      $("#connectionHint")
        .textContent =
        connectingMode
          ? "modo conectar ativo • clique em duas pistas"
          : "arraste • escreva • conecte • todos veem as mudanças";


      selectCard(
        null
      );

    }
  );


$("#resetBoard")
  .addEventListener(
    "click",
    () => {

      cards.forEach(
        card => {

          const original =
            seedLocal.find(
              seed =>
                seed.title ===
                card.title
            );


          if(!original){
            return;
          }


          card.x =
            original.x;


          card.y =
            original.y;


          const element =
            $(
              "#boardCanvas [data-id=\"" +
              CSS.escape(
                card.id
              ) +
              "\"]"
            );


          if(element){

            element.style.left =
              `${original.x}%`;

            element.style.top =
              `${original.y}%`;

          }

        }
      );


      cards.forEach(
        card =>
          saveCardPosition(
            card
          )
      );


      renderConnections();


      toast(
        "Posições reposicionadas."
      );

    }
  );


$("#boardSearch")
  .addEventListener(
    "input",
    filterCards
  );


$("#zoomIn")
  .addEventListener(
    "click",
    () =>
      setZoom(
        Math.min(
          1.35,
          zoom + .1
        )
      )
  );


$("#zoomOut")
  .addEventListener(
    "click",
    () =>
      setZoom(
        Math.max(
          .75,
          zoom - .1
        )
      )
  );


function setZoom(
  value
){

  zoom =
    Number(
      value.toFixed(
        2
      )
    );


  $("#boardCanvas")
    .style
    .transform =
      `scale(${zoom})`;


  $("#zoomLabel")
    .textContent =
      `${Math.round(
        zoom * 100
      )}%`;


  renderConnections();
}


function openNewCard(){

  $("#newCardModal")
    .classList
    .add(
      "open"
    );


  $("#newCardTitle")
    .focus();
}


function closeNewCard(){

  $("#newCardModal")
    .classList
    .remove(
      "open"
    );
}


$$(
  "[data-close-new-card]"
)
.forEach(
  button =>
    button.addEventListener(
      "click",
      closeNewCard
    )
);


$("#createCard")
  .addEventListener(
    "click",
    async () => {

      const title =
        $("#newCardTitle")
          .value
          .trim();


      if(!title){

        toast(
          "Dê um título à pista."
        );

        return;
      }


      const newCard = {

        title,

        clue_type:
          $("#newCardType")
            .value
            .trim() ||
          "PISTA",

        context:
          $("#newCardContext")
            .value
            .trim() ||
          "",

        notes:
          "",

        x:
          25 +
          Math.random() *
          50,

        y:
          20 +
          Math.random() *
          55,

        rotation:
          Math.random() * 2 -
          1

      };


      if(
        appMode ===
        "supabase"
      ){

        const {
          data,
          error
        } =
          await supabase
            .from("clues")
            .insert({
              ...newCard,

              campaign_id:
                campaignId,

              created_by:
                currentUser.id
            })
            .select()
            .single();


        if(error){

          toast(
            "Não foi possível criar a pista."
          );

          return;
        }


        cards.push(
          data
        );

      }else{

        newCard.id =
          crypto.randomUUID();

        cards.push(
          newCard
        );

        saveLocal();

      }


      renderCards();
      renderConnections();
      closeNewCard();


      toast(
        "Nova pista adicionada."
      );

    }
  );


/* ============================================================
   EDIÇÃO
   ============================================================ */

function openCardEditor(
  id
){

  const card =
    cards.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if(!card){
    return;
  }


  editingNote = {

    kind:
      "clue",

    key:
      id

  };


  $("#editorTitle")
    .textContent =
      card.title;


  $("#editorText")
    .value =
      card.notes ||
      "";


  $("#editorModal")
    .classList
    .add(
      "open"
    );


  $("#editorText")
    .focus();
}


async function deleteCard(
  id
){

  if(
    !confirm(
      "Excluir esta pista do quadro?"
    )
  ){

    return;
  }


  if(
    appMode ===
    "supabase"
  ){

    const {
      error
    } =
      await supabase
        .from("clues")
        .delete()
        .eq(
          "id",
          id
        );


    if(error){

      toast(
        "Não foi possível excluir a pista."
      );

      return;
    }

  }


  cards =
    cards.filter(
      card =>
        String(card.id) !==
        String(id)
    );


  connections =
    connections.filter(
      connection =>
        (
          connection.clue_a ||
          connection[0]
        ) !== id &&
        (
          connection.clue_b ||
          connection[1]
        ) !== id
    );


  if(
    appMode !==
    "supabase"
  ){

    saveLocal();

  }


  renderAll();


  toast(
    "Pista excluída."
  );
}


$$(
  ".entity-note-btn"
)
.forEach(
  button =>
    button.addEventListener(
      "click",
      () => {

        editingNote = {

          kind:
            button.dataset.noteKind,

          key:
            button.dataset.noteKey

        };


        const existing =
          (
            window._entityNotes ||
            []
          )
          .find(
            note =>
              note.entity_kind ===
                editingNote.kind &&
              note.entity_key ===
                editingNote.key &&
              note.user_id ===
                currentUser?.id
          );


        $("#editorTitle")
          .textContent =
            "ANOTAÇÃO";


        $("#editorText")
          .value =
            existing?.text ||
            "";


        $("#editorModal")
          .classList
          .add(
            "open"
          );

      }
    )
);


$("#cancelEditor")
  .addEventListener(
    "click",
    () =>
      $("#editorModal")
        .classList
        .remove(
          "open"
        )
  );


$$(
  "[data-close-editor]"
)
.forEach(
  button =>
    button.addEventListener(
      "click",
      () =>
        $("#editorModal")
          .classList
          .remove(
            "open"
          )
    )
);


$("#saveEditor")
  .addEventListener(
    "click",
    async () => {

      const text =
        $("#editorText")
          .value
          .trim();


      if(!editingNote){
        return;
      }


      if(
        editingNote.kind ===
        "clue"
      ){

        const card =
          cards.find(
            item =>
              String(item.id) ===
              String(
                editingNote.key
              )
          );


        if(card){

          card.notes =
            text;

        }


        await debouncedSaveCardNotes(
          editingNote.key,
          text
        );

      }else{

        await saveEntityNote(
          editingNote.kind,
          editingNote.key,
          text
        );

      }


      $("#editorModal")
        .classList
        .remove(
          "open"
        );


      playUISound(
        "save"
      );

    }
  );


async function saveEntityNote(
  kind,
  key,
  text
){

  if(
    appMode ===
    "supabase"
  ){

    const {
      data,
      error
    } =
      await supabase
        .from("entity_notes")
        .upsert(

          {

            campaign_id:
              campaignId,

            entity_kind:
              kind,

            entity_key:
              key,

            user_id:
              currentUser.id,

            author_name:
              "Jogador",

            text

          },

          {
            onConflict:
              "campaign_id,entity_kind,entity_key,user_id"
          }

        )
        .select()
        .single();


    if(error){

      toast(
        "Não foi possível salvar a anotação."
      );

      return;
    }


    const otherNotes =
      (
        window._entityNotes ||
        []
      )
      .filter(
        note =>
          !(
            note.entity_kind ===
              kind &&
            note.entity_key ===
              key &&
            note.user_id ===
              currentUser.id
          )
      );


    window._entityNotes = [

      ...otherNotes,

      data

    ];

  }else{

    const notes =
      JSON.parse(
        localStorage.getItem(
          localKeys.notes
        ) ||
        "{}"
      );


    notes[
      `${kind}:${key}`
    ] =
      text;


    localStorage.setItem(
      localKeys.notes,
      JSON.stringify(
        notes
      )
    );


    applyLocalEntityNotes();

  }


  renderEntityNotes();

}


/* ============================================================
   OBJETOS / DOCUMENTOS
   ============================================================ */

function openObject(
  object
){

  $("#modalType")
    .textContent =
      object.object_type ||
      "OBJETO";


  $("#modalTitle")
    .textContent =
      object.name;


  $("#modalContent")
    .innerHTML = `

      <p>

        <strong>
          ${escapeHtml(
            object.description ||
            ""
          )}
        </strong>

      </p>

      <p>
        ${escapeHtml(
          object.content ||
          ""
        )}
      </p>

    `;


  $("#documentModal")
    .classList
    .add(
      "open"
    );
}


$$(
  "[data-close-modal]"
)
.forEach(
  button =>
    button.addEventListener(
      "click",
      () =>
        $("#documentModal")
          .classList
          .remove(
            "open"
          )
    )
);


const documents = {

  report: {

    type:
      "DOCUMENTO 17 — EXTRATO",

    title:
      "Relatório encontrado",

    html: `

      <div class="paper">

        <p>
          <strong>02:12</strong>
          — registro acústico identificado.
        </p>

        <p>
          <strong>02:16</strong>
          — preparação do estímulo.
        </p>

        <p>
          <strong>02:17</strong>
          — presença de sangue.
        </p>

        <p>
          <strong>02:20</strong>
          — manifestação.
        </p>

        <hr>

        <p>
          <strong>OBSERVAÇÃO:</strong>
          o som foi registrado antes da preparação do estímulo.
        </p>

        <p>
          <strong>OBSERVAÇÃO COMPLEMENTAR:</strong>
          não repetir o procedimento sem autorização.
        </p>

        <p class="hand">
          Quem autorizou?
        </p>

      </div>

    `

  },


  fifth: {

    type:
      "ANOTAÇÃO MANUSCRITA",

    title:
      "A frase do quinto",

    html: `

      <div class="paper">

        <p class="hand">
          “Não é o quinto que abre.<br>
          É o quinto que chama.<br>
          Não faça o quinto tocar.”
        </p>

      </div>

    `

  },


  box: {

    type:
      "CAIXA DE PROVAS",

    title:
      "Mapa + recibos",

    html: `

      <div class="paper">

        <p>
          <strong>LOCAIS:</strong>
          Praça Santa Cecília,
          Apartamento 18,
          Túnel ferroviário,
          Escola municipal,
          Torre sem nome.
        </p>

        <p>
          <strong>HORÁRIOS:</strong>
          02:12 • 02:40 • 03:05 • 03:30 • 03:55
        </p>

        <p>
          <strong>OBJETOS:</strong>
          fotografias,
          recibos de metal e velas,
          lista de horários
          e uma chave de ferro escuro.
        </p>

        <p class="hand">
          O quinto não é convocado.<br>
          O quinto convoca.
        </p>

      </div>

    `

  }

};


$$(
  ".document-card"
)
.forEach(
  button =>
    button.addEventListener(
      "click",
      () => {

        const document =
          documents[
            button.dataset.document
          ];


        if(!document){
          return;
        }


        $("#modalType")
          .textContent =
            document.type;


        $("#modalTitle")
          .textContent =
            document.title;


        $("#modalContent")
          .innerHTML =
            document.html;


        $("#documentModal")
          .classList
          .add(
            "open"
          );

      }
    )
);


/* ============================================================
   REALTIME
   ============================================================ */

function subscribeRealtime(){

  if(
    appMode !==
    "supabase"
  ){

    return;
  }


  realtimeChannels
    .forEach(
      channel =>
        supabase
          .removeChannel(
            channel
          )
    );


  realtimeChannels =
    [];


  const channel =
    supabase
      .channel(
        `campaign-${campaignId}`
      )


      .on(
        "postgres_changes",

        {
          event:
            "*",

          schema:
            "public",

          table:
            "clues",

          filter:
            `campaign_id=eq.${campaignId}`

        },

        payload => {

          if(
            payload.eventType ===
            "INSERT"
          ){

            if(
              !cards.some(
                card =>
                  card.id ===
                  payload.new.id
              )
            ){

              cards.push(
                payload.new
              );

            }

          }


          if(
            payload.eventType ===
            "UPDATE"
          ){

            const index =
              cards.findIndex(
                card =>
                  card.id ===
                  payload.new.id
              );


            if(index >= 0){

              cards[index] = {

                ...cards[index],

                ...payload.new

              };

            }

          }


          if(
            payload.eventType ===
            "DELETE"
          ){

            cards =
              cards.filter(
                card =>
                  card.id !==
                  payload.old.id
              );

          }


          renderCards();

          renderConnections();

          filterCards();

        }
      )


      .on(
        "postgres_changes",

        {
          event:
            "*",

          schema:
            "public",

          table:
            "connections",

          filter:
            `campaign_id=eq.${campaignId}`

        },

        payload => {

          if(
            payload.eventType ===
            "INSERT"
          ){

            if(
              !connections.some(
                connection =>
                  connection.id ===
                  payload.new.id
              )
            ){

              connections.push(
                payload.new
              );

            }

          }


          if(
            payload.eventType ===
            "DELETE"
          ){

            connections =
              connections.filter(
                connection =>
                  connection.id !==
                  payload.old.id
              );

          }


          if(
            payload.eventType ===
            "UPDATE"
          ){

            const index =
              connections.findIndex(
                connection =>
                  connection.id ===
                  payload.new.id
              );


            if(index >= 0){

              connections[index] =
                payload.new;

            }

          }


          renderConnections();

        }
      )


      .on(
        "postgres_changes",

        {
          event:
            "*",

          schema:
            "public",

          table:
            "entity_notes",

          filter:
            `campaign_id=eq.${campaignId}`

        },

        payload => {

          if(
            !window._entityNotes
          ){

            window._entityNotes =
              [];

          }


          if(
            payload.eventType ===
            "INSERT"
          ){

            if(
              !window._entityNotes.some(
                note =>
                  note.id ===
                  payload.new.id
              )
            ){

              window._entityNotes.push(
                payload.new
              );

            }

          }


          if(
            payload.eventType ===
            "UPDATE"
          ){

            const index =
              window._entityNotes
                .findIndex(
                  note =>
                    note.id ===
                    payload.new.id
                );


            if(index >= 0){

              window._entityNotes[index] =
                payload.new;

            }

          }


          if(
            payload.eventType ===
            "DELETE"
          ){

            window._entityNotes =
              window._entityNotes.filter(
                note =>
                  note.id !==
                  payload.old.id
              );

          }


          renderEntityNotes();

        }
      )


      .subscribe(
        status => {

          if(
            status ===
            "SUBSCRIBED"
          ){

            setSync(
              "tempo real",
              true
            );

          }

        }
      );


  realtimeChannels.push(
    channel
  );
}


/* ============================================================
   SOM AMBIENTE
   ============================================================ */

$("#soundToggle")
  .addEventListener(
    "click",
    () => {

      const panel =
        $("#soundPanel");


      panel.classList.toggle(
        "open"
      );


      panel.setAttribute(
        "aria-hidden",
        String(
          !panel.classList.contains(
            "open"
          )
        )
      );

    }
  );


$("#audioFile")
  .addEventListener(
    "change",
    () => {

      const file =
        $("#audioFile")
          .files[0];


      if(!file){
        return;
      }


      const audio =
        $("#ambientAudio");


      audio.src =
        URL.createObjectURL(
          file
        );


      audio
        .play()
        .catch(
          () => {}
        );

    }
  );


/* ============================================================
   NAVEGAÇÃO
   ============================================================ */

$("#enterBoard")
  .addEventListener(
    "click",
    () =>
      $("#boardSection")
        .scrollIntoView({
          behavior:
            "smooth"
        })
  );


const observer =
  new IntersectionObserver(

    entries =>
      entries.forEach(
        entry => {

          if(
            !entry.isIntersecting
          ){

            return;
          }


          $$(".main-nav a")
            .forEach(
              link =>
                link.classList.toggle(
                  "active",
                  link.getAttribute(
                    "href"
                  ) ===
                  `#${entry.target.id}`
                )
            );

        }
      ),

    {
      rootMargin:
        "-35% 0px -55% 0px"
    }

  );


$$(
  "main section[id]"
)
.forEach(
  section =>
    observer.observe(
      section
    )
);


/* ============================================================
   ESC
   ============================================================ */

document.addEventListener(
  "keydown",
  e => {

    if(
      e.key !==
      "Escape"
    ){

      return;
    }


    $("#documentModal")
      .classList
      .remove(
        "open"
      );


    $("#editorModal")
      .classList
      .remove(
        "open"
      );


    $("#newCardModal")
      .classList
      .remove(
        "open"
      );


    $("#soundPanel")
      .classList
      .remove(
        "open"
      );

  }
);


window.addEventListener(
  "resize",
  () =>
    renderConnections()
);


/* ============================================================
   INICIAR
   ============================================================ */

(async () => {

  await bootstrap();

})();
