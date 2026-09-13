(() => {
  "use strict";

  /* ============================================================
     UTILIDADES
     ============================================================ */

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  function on(selector, event, handler) {
    const element = $(selector);

    if (element) {
      element.addEventListener(event, handler);
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>'"]/g,
      char =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;"
        })[char]
    );
  }

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function safeJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }


  /* ============================================================
     CONFIGURAÇÃO
     ============================================================ */

  const config =
    window.SUPABASE_CONFIG || {};

  const storageKeys = {
    cards: "sinosLocalCards",
    objects: "sinosLocalObjects",
    connections: "sinosLocalConnections",
    notes: "sinosLocalNotes",
    uiSounds: "sinosUISounds",
    musicVolume: "sinosMusicVolume"
  };


  /* ============================================================
     ESTADO
     ============================================================ */

  let supabase = null;
  let supabaseReady = false;
  let realtimeChannel = null;

  let appMode = "local";

  let campaignId = "local";
  let campaignCode = "LOCAL";

  let currentUser = null;

  let cards = [];
  let objects = [];
  let connections = [];

  let selectedCard = null;
  let draggingCard = null;
  let dragMoved = false;

  let connectingMode = false;

  let zoom = 1;

  let editingNote = null;

  let toastTimer = null;
  let noteTimer = null;

  let audioContext = null;

  let uiSoundsEnabled =
    localStorage.getItem(
      storageKeys.uiSounds
    ) !== "false";


  /* ============================================================
     ESTADO DA MÚSICA
     ============================================================ */

  let youtubePlayer = null;
  let youtubeReady = false;

  let musicVolume =
    Number(
      localStorage.getItem(
        storageKeys.musicVolume
      ) || 10
    );

  let voiceDucking = false;

  let microphoneStream = null;
  let microphoneContext = null;
  let microphoneAnalyser = null;
  let microphoneData = null;
  let duckingTimer = null;

  const HEXATOMBE_VIDEO_ID =
    "eVV1S_zal4o";


  /* ============================================================
     PISTAS INICIAIS
     ============================================================ */

  const seedCards = [

    {
      id: "sangue",
      title: "SANGUE",
      clue_type: "PISTA",
      context: "Praça / condição do ritual",
      notes: "",
      x: 6,
      y: 13,
      rotation: -3
    },

    {
      id: "medo",
      title: "MEDO",
      clue_type: "PISTA",
      context: "Atenção / amplificação",
      notes: "",
      x: 39,
      y: 8,
      rotation: 2
    },

    {
      id: "grupo",
      title: "GRUPO",
      clue_type: "PISTA",
      context: "Pessoas coordenadas",
      notes: "",
      x: 70,
      y: 16,
      rotation: -1
    },

    {
      id: "fragmentos",
      title: "FRAGMENTOS",
      clue_type: "PISTA",
      context: "Metal / ressonância",
      notes: "",
      x: 13,
      y: 59,
      rotation: 3
    },

    {
      id: "sino",
      title: "SINO ANTECIPADO",
      clue_type: "ANOMALIA",
      context: "Registro acústico",
      notes: "",
      x: 45,
      y: 49,
      rotation: -2
    },

    {
      id: "quinto",
      title: "QUINTO CÍRCULO",
      clue_type: "PISTA",
      context: "Símbolos / ritual",
      notes: "",
      x: 72,
      y: 58,
      rotation: 2
    },

    {
      id: "sombra",
      title: "SOMBRA SEM OBJETO",
      clue_type: "MANIFESTAÇÃO",
      context: "Presença visual",
      notes: "",
      x: 37,
      y: 78,
      rotation: 1
    }

  ];


  /* ============================================================
     OBJETOS
     ============================================================ */

  const seedObjects = [

    {
      id: "radio",
      name: "RÁDIO",
      object_type: "ÁUDIO",
      description:
        "Um rádio que perdeu sinal por um segundo.",
      content:
        "O aparelho registra um ruído impossível de localizar.",
      x: 8,
      y: 7
    },

    {
      id: "fragmento-obj",
      name: "FRAGMENTO",
      object_type: "EVIDÊNCIA",
      description:
        "Peça de metal escuro sem ferrugem.",
      content:
        "Reage ao sangue e vibra perto de outro fragmento.",
      x: 91,
      y: 15
    },

    {
      id: "chave",
      name: "CHAVE",
      object_type: "OBJETO",
      description:
        "Chave de ferro escuro.",
      content:
        "Há indícios de que abre uma porta associada à escola municipal.",
      x: 87,
      y: 80
    }

  ];


  /* ============================================================
     SOM DE INTERFACE
     ============================================================ */

  const frequencies = {
    D3: 146.83,
    F3: 174.61,
    A3: 220,
    C4: 261.63,
    D4: 293.66,
    F4: 349.23,
    A4: 440,
    C5: 523.25,
    D5: 587.33
  };

  function getAudioContext() {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!audioContext) {
      audioContext =
        new AudioContextClass();
    }

    if (
      audioContext.state ===
      "suspended"
    ) {
      audioContext
        .resume()
        .catch(() => {});
    }

    return audioContext;
  }

  function playTone(
    note,
    duration = 0.06,
    delay = 0,
    type = "sine",
    volume = 0.02
  ) {

    if (!uiSoundsEnabled) {
      return;
    }

    const context =
      getAudioContext();

    if (!context) {
      return;
    }

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    const start =
      context.currentTime +
      delay;

    oscillator.type =
      type;

    oscillator.frequency.value =
      frequencies[note] || note;

    gain.gain.setValueAtTime(
      0.0001,
      start
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

    oscillator
      .connect(gain)
      .connect(context.destination);

    oscillator.start(start);

    oscillator.stop(
      start +
      duration +
      0.02
    );
  }

  function playSound(
    type = "click"
  ) {

    if (!uiSoundsEnabled) {
      return;
    }

    switch (type) {

      case "nav":

        playTone(
          "D4",
          0.05,
          0,
          "triangle",
          0.022
        );

        playTone(
          "A4",
          0.09,
          0.035,
          "sine",
          0.014
        );

        break;


      case "panel":

        playTone(
          "F4",
          0.06,
          0,
          "triangle",
          0.022
        );

        playTone(
          "A4",
          0.08,
          0.04,
          "sine",
          0.014
        );

        break;


      case "document":

        playTone(
          "A3",
          0.08,
          0,
          "triangle",
          0.022
        );

        playTone(
          "D4",
          0.11,
          0.05,
          "sine",
          0.014
        );

        break;


      case "edit":

        playTone(
          "A4",
          0.05,
          0,
          "triangle",
          0.022
        );

        playTone(
          "C5",
          0.08,
          0.035,
          "sine",
          0.014
        );

        break;


      case "save":

        playTone(
          "D4",
          0.06,
          0,
          "triangle",
          0.022
        );

        playTone(
          "F4",
          0.06,
          0.05,
          "triangle",
          0.018
        );

        playTone(
          "A4",
          0.1,
          0.1,
          "sine",
          0.013
        );

        break;


      case "enter":

        playTone(
          "D3",
          0.11,
          0,
          "sine",
          0.025
        );

        playTone(
          "A3",
          0.14,
          0.08,
          "sine",
          0.02
        );

        playTone(
          "D4",
          0.18,
          0.18,
          "triangle",
          0.012
        );

        break;


      case "connect":

        playTone(
          "D4",
          0.07,
          0,
          "triangle",
          0.025
        );

        playTone(
          "A4",
          0.09,
          0.07,
          "triangle",
          0.02
        );

        playTone(
          "D5",
          0.12,
          0.14,
          "sine",
          0.014
        );

        break;


      case "danger":

        playTone(
          "F4",
          0.05,
          0,
          "triangle",
          0.02
        );

        playTone(
          "D4",
          0.09,
          0.05,
          "sine",
          0.014
        );

        break;


      default:

        playTone(
          "D4",
          0.05,
          0,
          "triangle",
          0.02
        );

    }
  }


  /* ============================================================
     TOAST
     ============================================================ */

  function toast(
    message
  ) {

    const element =
      $("#toast");

    if (!element) {
      return;
    }

    element.textContent =
      message;

    element.classList.add(
      "show"
    );

    clearTimeout(
      toastTimer
    );

    toastTimer =
      setTimeout(
        () =>
          element.classList.remove(
            "show"
          ),
        2400
      );
  }


  /* ============================================================
     SUPABASE
     ============================================================ */

  function getSupabaseUrl() {

    const raw =
      String(
        config.url || ""
      ).trim();

    if (!raw) {
      return "";
    }

    if (
      raw.startsWith("//")
    ) {

      return (
        window.location.protocol +
        raw
      );
    }

    return raw;
  }

  function hasSupabaseConfig() {

    const url =
      getSupabaseUrl();

    const key =
      String(
        config.anonKey || ""
      ).trim();

    return Boolean(
      url &&
      key &&
      /^https?:\/\//i.test(url)
    );
  }

  function setSync(
    text,
    connected = false
  ) {

    const sync =
      $("#syncStatus");

    const footer =
      $("#footerState");

    if (sync) {
      sync.textContent =
        text;
    }

    if (footer) {
      footer.textContent =
        connected
          ? "MESA COMPARTILHADA"
          : "MODO LOCAL";
    }
  }

  async function initSupabase() {

    if (
      !hasSupabaseConfig() ||
      !window.supabase?.createClient
    ) {

      appMode =
        "local";

      setSync(
        "modo local",
        false
      );

      return false;
    }

    try {

      supabase =
        window.supabase.createClient(
          getSupabaseUrl(),
          config.anonKey
        );

      const sessionResult =
        await supabase.auth.getSession();

      if (
        sessionResult.error
      ) {

        throw sessionResult.error;
      }

      currentUser =
        sessionResult
          .data
          ?.session
          ?.user ||
        null;

      if (!currentUser) {

        const authResult =
          await supabase.auth
            .signInAnonymously();

        if (
          authResult.error
        ) {

          throw authResult.error;
        }

        currentUser =
          authResult.data
            ?.user ||
          null;
      }

      if (!currentUser) {

        throw new Error(
          "USUARIO_ANONIMO_NAO_CRIADO"
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

    } catch (error) {

      console.error(
        "Erro Supabase:",
        error
      );

      supabase =
        null;

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

  async function enterMainCampaign() {

    if (
      !supabaseReady ||
      !supabase
    ) {

      return false;
    }

    const result =
      await supabase.rpc(
        "enter_main_campaign"
      );

    if (
      result.error
    ) {

      throw result.error;
    }

    const row =
      result.data?.[0];

    if (!row) {

      throw new Error(
        "MESA_PRINCIPAL_NAO_ENCONTRADA"
      );
    }

    campaignId =
      row.campaign_id;

    campaignCode =
      row.campaign_code ||
      "PONTO03";

    return true;
  }


  /* ============================================================
     DADOS LOCAIS
     ============================================================ */

  function loadLocalData() {

    const savedCards =
      localStorage.getItem(
        storageKeys.cards
      );

    const savedObjects =
      localStorage.getItem(
        storageKeys.objects
      );

    const savedConnections =
      localStorage.getItem(
        storageKeys.connections
      );

    cards =
      savedCards
        ? safeJSON(
            savedCards,
            clone(seedCards)
          )
        : clone(seedCards);

    objects =
      savedObjects
        ? safeJSON(
            savedObjects,
            clone(seedObjects)
          )
        : clone(seedObjects);

    connections =
      savedConnections
        ? safeJSON(
            savedConnections,
            []
          )
        : [];

    applyLocalNotes();

    renderAll();

    setSync(
      "modo local",
      false
    );
  }

  function saveLocal() {

    localStorage.setItem(
      storageKeys.cards,
      JSON.stringify(cards)
    );

    localStorage.setItem(
      storageKeys.objects,
      JSON.stringify(objects)
    );

    localStorage.setItem(
      storageKeys.connections,
      JSON.stringify(connections)
    );
  }

  function applyLocalNotes() {

    const saved =
      safeJSON(
        localStorage.getItem(
          storageKeys.notes
        ) ||
        "{}",
        {}
      );

    window._entityNotes =
      Object.entries(
        saved
      ).map(
        ([compoundKey, text]) => {

          const index =
            compoundKey.indexOf(
              ":"
            );

          return {

            entity_kind:
              index >= 0
                ? compoundKey.slice(
                    0,
                    index
                  )
                : "",

            entity_key:
              index >= 0
                ? compoundKey.slice(
                    index + 1
                  )
                : compoundKey,

            author_name:
              "Jogador",

            text
          };
        }
      );
  }


  /* ============================================================
     DADOS SUPABASE
     ============================================================ */

  async function loadCampaignData() {

    if (
      appMode !==
      "supabase"
    ) {

      loadLocalData();
      return;
    }

    const [
      cluesResult,
      objectsResult,
      connectionsResult
    ] =
      await Promise.all([

        supabase
          .from("clues")
          .select("*")
          .eq(
            "campaign_id",
            campaignId
          )
          .order(
            "created_at",
            {
              ascending:
                true
            }
          ),

        supabase
          .from("objects")
          .select("*")
          .eq(
            "campaign_id",
            campaignId
          )
          .order(
            "created_at",
            {
              ascending:
                true
            }
          ),

        supabase
          .from("connections")
          .select("*")
          .eq(
            "campaign_id",
            campaignId
          )

      ]);

    if (
      cluesResult.error
    ) {

      throw cluesResult.error;
    }

    if (
      objectsResult.error
    ) {

      throw objectsResult.error;
    }

    if (
      connectionsResult.error
    ) {

      throw connectionsResult.error;
    }

    cards =
      cluesResult.data?.length
        ? cluesResult.data
        : clone(seedCards);

    objects =
      objectsResult.data?.length
        ? objectsResult.data
        : clone(seedObjects);

    connections =
      connectionsResult.data ||
      [];

    await loadEntityNotes();

    renderAll();

    setSync(
      "sincronizado",
      true
    );
  }

  async function loadEntityNotes() {

    if (
      appMode !==
      "supabase"
    ) {

      applyLocalNotes();
      return;
    }

    const result =
      await supabase
        .from("entity_notes")
        .select("*")
        .eq(
          "campaign_id",
          campaignId
        );

    if (
      result.error
    ) {

      throw result.error;
    }

    window._entityNotes =
      result.data ||
      [];
  }


  /* ============================================================
     RENDERIZAÇÃO
     ============================================================ */

  function renderAll() {

    renderCards();

    renderObjects();

    renderConnections();

    renderEntityNotes();

    filterCards();
  }


  /* ============================================================
     MURAL
     ============================================================ */

  function isSeedCard(id) {

    return seedCards.some(
      card =>
        String(
          card.id
        ) ===
        String(
          id
        )
    );
  }

  function renderCards() {

    const canvas =
      $("#boardCanvas");

    if (!canvas) {
      return;
    }

    canvas
      .querySelectorAll(
        ".evidence-card"
      )
      .forEach(
        card =>
          card.remove()
      );

    cards.forEach(
      (
        card,
        index
      ) => {

        const element =
          document.createElement(
            "article"
          );

        element.className =
          "evidence-card";

        element.dataset.id =
          String(
            card.id
          );

        element.style.left =
          `${Number(
            card.x ??
            10
          )}%`;

        element.style.top =
          `${Number(
            card.y ??
            10
          )}%`;

        element.style.setProperty(
          "--rotation",
          `${Number(
            card.rotation ??
            0
          )}deg`
        );

        element.innerHTML = `

          <div class="card-pin"></div>

          <span class="card-number">
            ${String(
              index + 1
            ).padStart(
              2,
              "0"
            )}
          </span>

          <span class="card-type">
            ${escapeHtml(
              card.clue_type ||
              "PISTA"
            )}
          </span>

          <h3>
            ${escapeHtml(
              card.title ||
              "SEM TÍTULO"
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
              placeholder="Escreva aqui..."
            ></textarea>

          </div>

          <button
            class="mini-edit"
            type="button"
          >
            EDITAR
          </button>

          ${
            isSeedCard(
              card.id
            )
              ? ""
              : `
                <button
                  class="mini-delete"
                  type="button"
                >
                  ×
                </button>
              `
          }

        `;

        const textarea =
          $(".card-notes", element);

        if (textarea) {

          textarea.value =
            card.notes ||
            "";

          [
            "pointerdown",
            "click",
            "dblclick"
          ].forEach(
            eventName => {

              textarea.addEventListener(
                eventName,
                event =>
                  event.stopPropagation()
              );

            }
          );

          textarea.addEventListener(
            "input",
            () =>
              saveCardNotes(
                card.id,
                textarea.value
              )
          );
        }

        canvas.appendChild(
          element
        );

        wireCard(
          element
        );
      }
    );
  }


  /* ============================================================
     INTERAÇÃO COM CARDS
     ============================================================ */

  function wireCard(
    card
  ) {

    card.addEventListener(
      "pointerdown",
      event =>
        beginDrag(
          card,
          event
        )
    );

    card.addEventListener(
      "pointermove",
      event =>
        moveDrag(
          card,
          event
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
      event => {

        if (
          dragMoved
        ) {

          dragMoved =
            false;

          return;
        }

        if (
          event.target.closest(
            "textarea,button"
          )
        ) {

          return;
        }

        if (
          connectingMode
        ) {

          if (
            !selectedCard
          ) {

            selectCard(
              card
            );

          } else if (
            selectedCard !==
            card
          ) {

            toggleConnection(
              selectedCard.dataset.id,
              card.dataset.id
            );

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

    const editButton =
      $(".mini-edit", card);

    if (
      editButton
    ) {

      editButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          playSound(
            "edit"
          );

          openCardEditor(
            card.dataset.id
          );
        }
      );
    }

    const deleteButton =
      $(".mini-delete", card);

    if (
      deleteButton
    ) {

      deleteButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          playSound(
            "danger"
          );

          deleteCard(
            card.dataset.id
          );
        }
      );
    }
  }

  function beginDrag(
    card,
    event
  ) {

    if (
      event.target.closest(
        "textarea,button"
      )
    ) {

      return;
    }

    draggingCard =
      card;

    dragMoved =
      false;

    card.classList.add(
      "dragging"
    );

    try {

      card.setPointerCapture(
        event.pointerId
      );

    } catch {}

    const rect =
      card.getBoundingClientRect();

    card.dataset.offsetX =
      String(
        (
          event.clientX -
          rect.left
        ) /
        zoom
      );

    card.dataset.offsetY =
      String(
        (
          event.clientY -
          rect.top
        ) /
        zoom
      );
  }

  function moveDrag(
    card,
    event
  ) {

    if (
      draggingCard !==
      card
    ) {

      return;
    }

    dragMoved =
      true;

    const board =
      $("#evidenceBoard");

    const canvas =
      $("#boardCanvas");

    if (
      !board ||
      !canvas
    ) {

      return;
    }

    const rect =
      board.getBoundingClientRect();

    const offsetX =
      Number(
        card.dataset.offsetX ||
        0
      );

    const offsetY =
      Number(
        card.dataset.offsetY ||
        0
      );

    const x =
      (
        event.clientX -
        rect.left +
        board.scrollLeft
      ) /
      zoom -
      offsetX;

    const y =
      (
        event.clientY -
        rect.top +
        board.scrollTop
      ) /
      zoom -
      offsetY;

    const maxX =
      Math.max(
        0,
        canvas.clientWidth -
        card.offsetWidth
      );

    const maxY =
      Math.max(
        0,
        canvas.clientHeight -
        card.offsetHeight
      );

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
      `${
        canvas.clientWidth
          ? (
              finalX /
              canvas.clientWidth
            ) *
            100
          : 0
      }%`;

    card.style.top =
      `${
        canvas.clientHeight
          ? (
              finalY /
              canvas.clientHeight
            ) *
            100
          : 0
      }%`;

    const model =
      cards.find(
        item =>
          String(
            item.id
          ) ===
          String(
            card.dataset.id
          )
      );

    if (
      model
    ) {

      model.x =
        parseFloat(
          card.style.left
        );

      model.y =
        parseFloat(
          card.style.top
        );
    }

    renderConnections();
  }

  async function endDrag(
    card
  ) {

    if (
      draggingCard !==
      card
    ) {

      return;
    }

    draggingCard =
      null;

    card.classList.remove(
      "dragging"
    );

    if (
      !dragMoved
    ) {

      return;
    }

    const model =
      cards.find(
        item =>
          String(
            item.id
          ) ===
          String(
            card.dataset.id
          )
      );

    if (
      model
    ) {

      await saveCardPosition(
        model
      );
    }
  }

  function selectCard(
    card
  ) {

    if (
      selectedCard
    ) {

      selectedCard.classList.remove(
        "selected"
      );
    }

    selectedCard =
      card;

    if (
      selectedCard
    ) {

      selectedCard.classList.add(
        "selected"
      );
    }

    renderConnections();
  }


  /* ============================================================
     CONEXÕES
     ============================================================ */

  function connectionPair(
    connection
  ) {

    const a =
      connection?.clue_a ??
      connection?.[0];

    const b =
      connection?.clue_b ??
      connection?.[1];

    if (
      a == null ||
      b == null
    ) {

      return null;
    }

    return [
      String(a),
      String(b)
    ].sort();
  }

  async function toggleConnection(
    firstId,
    secondId
  ) {

    const pair =
      [
        String(firstId),
        String(secondId)
      ].sort();

    const index =
      connections.findIndex(
        connection => {

          const existing =
            connectionPair(
              connection
            );

          return (
            existing &&
            existing[0] ===
              pair[0] &&
            existing[1] ===
              pair[1]
          );
        }
      );

    if (
      appMode ===
      "supabase"
    ) {

      try {

        if (
          index >=
          0
        ) {

          const existing =
            connections[index];

          if (
            existing.id
          ) {

            const result =
              await supabase
                .from(
                  "connections"
                )
                .delete()
                .eq(
                  "id",
                  existing.id
                );

            if (
              result.error
            ) {

              throw result.error;
            }
          }

        } else {

          const result =
            await supabase
              .from(
                "connections"
              )
              .insert({

                campaign_id:
                  campaignId,

                clue_a:
                  pair[0],

                clue_b:
                  pair[1],

                created_by:
                  currentUser?.id ||
                  null

              });

          if (
            result.error
          ) {

            throw result.error;
          }
        }

        await loadCampaignData();

      } catch (
        error
      ) {

        console.error(
          "Conexão:",
          error
        );

        toast(
          "Não foi possível sincronizar a conexão."
        );
      }

      playSound(
        "connect"
      );

      return;
    }

    if (
      index >=
      0
    ) {

      connections.splice(
        index,
        1
      );

    } else {

      connections.push(
        pair
      );
    }

    saveLocal();

    renderConnections();

    playSound(
      "connect"
    );
  }

  function renderConnections() {

    const svg =
      $("#connections");

    const canvas =
      $("#boardCanvas");

    if (
      !svg ||
      !canvas
    ) {

      return;
    }

    svg.innerHTML =
      "";

    connections.forEach(
      connection => {

        const pair =
          connectionPair(
            connection
          );

        if (
          !pair
        ) {

          return;
        }

        const a =
          canvas.querySelector(
            `[data-id="${CSS.escape(
              pair[0]
            )}"]`
          );

        const b =
          canvas.querySelector(
            `[data-id="${CSS.escape(
              pair[1]
            )}"]`
          );

        if (
          !a ||
          !b
        ) {

          return;
        }

        const line =
          document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );

        line.setAttribute(
          "x1",
          a.offsetLeft +
          a.offsetWidth /
          2
        );

        line.setAttribute(
          "y1",
          a.offsetTop +
          a.offsetHeight /
          2
        );

        line.setAttribute(
          "x2",
          b.offsetLeft +
          b.offsetWidth /
          2
        );

        line.setAttribute(
          "y2",
          b.offsetTop +
          b.offsetHeight /
          2
        );

        line.classList.add(
          "connection-line"
        );

        if (
          selectedCard &&
          (
            selectedCard === a ||
            selectedCard === b
          )
        ) {

          line.classList.add(
            "highlight"
          );
        }

        svg.appendChild(
          line
        );
      }
    );

    const cardCount =
      $("#cardCount");

    const connectionCount =
      $("#connectionCount");

    if (
      cardCount
    ) {

      cardCount.textContent =
        cards.length;
    }

    if (
      connectionCount
    ) {

      connectionCount.textContent =
        connections.length;
    }
  }

  async function saveCardPosition(
    card
  ) {

    if (
      appMode !==
      "supabase"
    ) {

      saveLocal();
      return;
    }

    try {

      const result =
        await supabase
          .from("clues")
          .update({

            x:
              Number(
                card.x
              ),

            y:
              Number(
                card.y
              )

          })
          .eq(
            "id",
            card.id
          );

      if (
        result.error
      ) {

        throw result.error;
      }

    } catch (
      error
    ) {

      console.error(
        "Posição:",
        error
      );
    }
  }

  function saveCardNotes(
    id,
    text
  ) {

    const card =
      cards.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (
      card
    ) {

      card.notes =
        text;
    }

    clearTimeout(
      noteTimer
    );

    noteTimer =
      setTimeout(
        async () => {

          if (
            appMode ===
            "supabase"
          ) {

            try {

              const result =
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

                if (
                  result.error
                ) {

                  throw result.error;
                }

            } catch (
              error
            ) {

              console.error(
                "Anotação:",
                error
              );
            }

          } else {

            saveLocal();

          }

        },
        250
      );
  }


  /* ============================================================
     NOVA PISTA
     ============================================================ */

  function openNewCard() {

    const modal =
      $("#newCardModal");

    if (
      !modal
    ) {

      return;
    }

    modal.classList.add(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    $("#newCardTitle")
      ?.focus();
  }

  function closeNewCard() {

    const modal =
      $("#newCardModal");

    if (
      !modal
    ) {

      return;
    }

    modal.classList.remove(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }

async function createCard() {

  const titleInput =
    $("#newCardTitle");

  const typeInput =
    $("#newCardType");

  const contextInput =
    $("#newCardContext");

  const title =
    titleInput?.value.trim() || "";

  const type =
    typeInput?.value.trim() ||
    "PISTA";

  const context =
    contextInput?.value.trim() ||
    "";

  if (!title) {

    toast(
      "Dê um título à pista."
    );

    titleInput?.focus();

    return;
  }

  const newCard = {

    title,

    clue_type:
      type,

    context,

    notes:
      "",

    x:
      25 +
      Math.random() * 50,

    y:
      20 +
      Math.random() * 55,

    rotation:
      Math.random() * 4 - 2

  };

  if (
    appMode ===
    "supabase"
  ) {

    try {

      const result =
        await supabase
          .from("clues")
          .insert({

            ...newCard,

            campaign_id:
              campaignId,

            created_by:
              currentUser?.id ||
              null

          })
          .select()
          .single();

      if (
        result.error
      ) {

        throw result.error;
      }

      cards.push(
        result.data
      );

    } catch (
      error
    ) {

      console.error(
        "Criar pista:",
        error
      );

      toast(
        "Não foi possível criar a pista."
      );

      return;
    }

  } else {

    newCard.id =
      crypto.randomUUID();

    cards.push(
      newCard
    );

    saveLocal();
  }

  renderCards();

  renderConnections();

  filterCards();

  closeNewCard();

  if (titleInput) {
    titleInput.value = "";
  }

  if (typeInput) {
    typeInput.value = "";
  }

  if (contextInput) {
    contextInput.value = "";
  }

  toast(
    "Nova pista adicionada."
  );

  playSound(
    "save"
  );
}

  /* ============================================================
     EDITOR
     ============================================================ */

  function openCardEditor(
    id
  ) {

    const card =
      cards.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (
      !card
    ) {

      return;
    }

    editingNote = {

      kind:
        "clue",

      key:
        id

    };

    const title =
      $("#editorTitle");

    const text =
      $("#editorText");

    if (
      title
    ) {

      title.textContent =
        card.title ||
        "ANOTAÇÃO";
    }

    if (
      text
    ) {

      text.value =
        card.notes ||
        "";
    }

    const modal =
      $("#editorModal");

    if (
      modal
    ) {

      modal.classList.add(
        "open"
      );

      modal.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  }

  function closeEditor() {

    const modal =
      $("#editorModal");

    if (
      !modal
    ) {

      return;
    }

    modal.classList.remove(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    editingNote =
      null;
  }

  async function saveEditor() {

    if (
      !editingNote
    ) {

      return;
    }

    const text =
      $("#editorText")
        ?.value
        .trim() ||
      "";

    if (
      editingNote.kind ===
      "clue"
    ) {

      await saveCardNotes(
        editingNote.key,
        text
      );

    } else {

      await saveEntityNote(
        editingNote.kind,
        editingNote.key,
        text
      );
    }

    closeEditor();

    renderCards();

    renderEntityNotes();

    playSound(
      "save"
    );
  }

  async function deleteCard(
    id
  ) {

    if (
      !confirm(
        "Excluir esta pista do quadro?"
      )
    ) {

      return;
    }

    if (
      appMode ===
      "supabase"
    ) {

      try {

        const result =
          await supabase
            .from("clues")
            .delete()
            .eq(
              "id",
              id
            );

        if (
          result.error
        ) {

          throw result.error;
        }

      } catch (
        error
      ) {

        console.error(
          "Excluir pista:",
          error
        );

        toast(
          "Não foi possível excluir a pista."
        );

        return;
      }
    }

    cards =
      cards.filter(
        card =>
          String(
            card.id
          ) !==
          String(
            id
          )
      );

    connections =
      connections.filter(
        connection => {

          const pair =
            connectionPair(
              connection
            );

          return (
            !pair ||
            (
              pair[0] !==
                String(id) &&
              pair[1] !==
                String(id)
            )
          );
        }
      );

    if (
      appMode !==
      "supabase"
    ) {

      saveLocal();
    }

    renderAll();

    toast(
      "Pista excluída."
    );
  }


  /* ============================================================
     ANOTAÇÕES DAS ENTIDADES
     ============================================================ */

  function openEntityEditor(
    button
  ) {

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
      ).find(
        note =>

          note.entity_kind ===
            editingNote.kind &&

          note.entity_key ===
            editingNote.key &&

          (
            !currentUser ||
            note.user_id ===
              currentUser.id
          )
      );

    const title =
      $("#editorTitle");

    const text =
      $("#editorText");

    if (
      title
    ) {

      title.textContent =
        "ANOTAÇÃO";
    }

    if (
      text
    ) {

      text.value =
        existing?.text ||
        "";
    }

    const modal =
      $("#editorModal");

    if (
      modal
    ) {

      modal.classList.add(
        "open"
      );

      modal.setAttribute(
        "aria-hidden",
        "false"
      );
    }
  }

  async function saveEntityNote(
    kind,
    key,
    text
  ) {

    if (
      appMode ===
      "supabase"
    ) {

      try {

        const result =
          await supabase
            .from(
              "entity_notes"
            )
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

        if (
          result.error
        ) {

          throw result.error;
        }

        const remaining =
          (
            window._entityNotes ||
            []
          ).filter(
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
          ...remaining,
          result.data
        ];

      } catch (
        error
      ) {

        console.error(
          "Salvar anotação:",
          error
        );

        toast(
          "Não foi possível salvar a anotação."
        );

        return;
      }

    } else {

      const saved =
        safeJSON(
          localStorage.getItem(
            storageKeys.notes
          ) ||
          "{}",
          {}
        );

      saved[
        `${kind}:${key}`
      ] =
        text;

      localStorage.setItem(
        storageKeys.notes,
        JSON.stringify(
          saved
        )
      );

      applyLocalNotes();
    }

    renderEntityNotes();
  }

  function renderEntityNotes() {

    const notes =
      window._entityNotes ||
      [];

    $$(".shared-notes")
      .forEach(
        box => {

          const kind =
            box.dataset.noteKind;

          const key =
            box.dataset.noteKey;

          box.innerHTML =
            "";

          notes
            .filter(
              note =>

                note.entity_kind ===
                  kind &&

                note.entity_key ===
                  key &&

                note.text?.trim()
            )
            .slice(
              -4
            )
            .forEach(
              note => {

                const line =
                  document.createElement(
                    "div"
                  );

                line.className =
                  "note-line";

                line.innerHTML =
                  `<strong>${escapeHtml(
                    note.author_name ||
                    "Jogador"
                  )}</strong> ${escapeHtml(
                    note.text
                  )}`;

                box.appendChild(
                  line
                );
              }
            );
        }
      );
  }


  /* ============================================================
     OBJETOS
     ============================================================ */

  function renderObjects() {

    const grid =
      $("#objectGrid");

    const layer =
      $("#boardObjectLayer");

    if (
      grid
    ) {

      grid.innerHTML =
        "";
    }

    if (
      layer
    ) {

      layer.innerHTML =
        "";
    }

    objects.forEach(
      object => {

        if (
          grid
        ) {

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
                object.object_type ||
                "OBJETO"
              )}
            </span>

            <strong>
              ${escapeHtml(
                object.name
              )}
            </strong>

            <small>
              ABRIR ↗
            </small>

          `;

          tile.addEventListener(
            "click",
            () => {

              playSound(
                "document"
              );

              openObject(
                object
              );
            }
          );

          grid.appendChild(
            tile
          );
        }

        if (
          layer
        ) {

          const item =
            document.createElement(
              "button"
            );

          item.type =
            "button";

          item.className =
            "board-object";

          item.style.left =
            `${Number(
              object.x ??
              50
            )}%`;

          item.style.top =
            `${Number(
              object.y ??
              50
            )}%`;

          item.innerHTML = `

            <span>

              ${escapeHtml(
                object.name
              )}

              <small>
                ${escapeHtml(
                  object.object_type ||
                  "OBJETO"
                )}
              </small>

            </span>

          `;

          item.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              playSound(
                "document"
              );

              openObject(
                object
              );
            }
          );

          layer.appendChild(
            item
          );
        }
      }
    );
  }

  function openObject(
    object
  ) {

    const modal =
      $("#documentModal");

    if (
      !modal
    ) {

      return;
    }

    $("#modalType").textContent =
      object.object_type ||
      "OBJETO";

    $("#modalTitle").textContent =
      object.name ||
      "OBJETO";

    $("#modalContent").innerHTML = `

      <div class="paper">

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

      </div>

    `;

    modal.classList.add(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }


  /* ============================================================
     DOCUMENTOS
     ============================================================ */

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

            o som foi registrado antes da
            preparação do estímulo.

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

            02:12 • 02:40 • 03:05 •
            03:30 • 03:55

          </p>

          <p>

            <strong>OBJETOS:</strong>

            recibos de metal e velas,
            lista de horários e uma
            chave de ferro escuro.

          </p>

          <p class="hand">

            O quinto não é convocado.<br>
            O quinto convoca.

          </p>

        </div>

      `
    }

  };

  /* ============================================================
   LOCAIS DA INVESTIGAÇÃO
   ============================================================ */

const locations = {

  praca: {

    type:
      "LOCAL 01 — SANTA CECÍLIA",

    title:
      "Praça Santa Cecília",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          02:12
        </p>

        <p>
          <strong>ESTADO:</strong>
          Concluído
        </p>

        <hr>

        <p>
          Praça residencial cercada por árvores,
          postes de luz e prédios antigos.
        </p>

        <p>
          Foi aqui que o primeiro sangue foi
          encontrado sem qualquer corpo associado.
        </p>

        <p>
          Cinco marcas circulares cercavam a mancha.
          Uma pequena lasca metálica foi encontrada
          presa ao solo.
        </p>

        <p class="hand">
          “O sino tocou antes de encontrarmos
          qualquer explicação.”
        </p>

      </div>

    `
  },


  apartamento: {

    type:
      "LOCAL 02 — APARTAMENTO 18",

    title:
      "Apartamento 18",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          02:40
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          Medo
        </p>

        <p>
          <strong>ESTADO:</strong>
          Concluído
        </p>

        <hr>

        <p>
          O apartamento está associado a uma
          das manifestações registradas durante
          a sequência de ocorrências.
        </p>

        <p>
          Testemunhas descrevem sensação de
          presença, alterações na percepção e
          a repetição do sino antes dos eventos.
        </p>

        <p class="hand">
          “Tocou antes de acontecer.”
        </p>

      </div>

    `
  },


  tunel: {

    type:
      "LOCAL 03 — TÚNEL FERROVIÁRIO",

    title:
      "Túnel ferroviário",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          03:05
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          Violência
        </p>

        <p>
          <strong>ESTADO:</strong>
          Interrompido
        </p>

        <hr>

        <p>
          O terceiro ponto da sequência apresenta
          sinais de violência e de preparação
          interrompida.
        </p>

        <p>
          A ocorrência sugere que o ciclo estava
          avançando antes que os investigadores
          compreendessem sua ordem.
        </p>

        <p class="hand">
          “Ainda não era para tocar.”
        </p>

      </div>

    `
  },


  escola: {

    type:
      "LOCAL 04 — ESCOLA MUNICIPAL",

    title:
      "Escola municipal",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          03:30
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          Silêncio
        </p>

        <p>
          <strong>ESTADO:</strong>
          Preparação
        </p>

        <hr>

        <p>
          A escola guarda uma das pistas mais
          importantes da investigação.
        </p>

        <p>
          Crianças desenharam repetidamente
          um mesmo círculo em diferentes
          contextos: sol, relógio, roda, lua
          e sino.
        </p>

        <p>
          Alguns desenhos são anteriores às
          manifestações conhecidas pelo
          Círculo da Vigília.
        </p>

        <p class="hand">
          “Eles descobriram o padrão.
          Não criaram o padrão.”
        </p>

      </div>

    `
  },


  torre: {

    type:
      "LOCAL 05 — TORRE SEM NOME",

    title:
      "Torre sem nome",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          03:55
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          Sino
        </p>

        <p>
          <strong>ESTADO:</strong>
          Desconhecido
        </p>

        <hr>

        <p>
          Uma torre esquecida, sem placa,
          sem identificação e sem um sino
          visível.
        </p>

        <p>
          Quanto mais os investigadores sobem,
          mais definido fica o som.
        </p>

        <p>
          No topo existe uma sala circular
          vazia com um espaço que parece ter
          sido reservado para algo muito maior.
        </p>

        <p class="hand">
          “O quinto não é convocado.
          O quinto convoca.”
        </p>

      </div>

    `
  }

};


function openLocation(
  key
) {

  const location =
    locations[key];

  const modal =
    $("#documentModal");

  if (
    !location ||
    !modal
  ) {

    return;
  }

  $("#modalType").textContent =
    location.type;

  $("#modalTitle").textContent =
    location.title;

  $("#modalContent").innerHTML =
    location.html;

  modal.classList.add(
    "open"
  );

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  playSound(
    "document"
  );
}

  function openDocument(
    key
  ) {

    const data =
      documents[key];

    const modal =
      $("#documentModal");

    if (
      !data ||
      !modal
    ) {

      return;
    }

    $("#modalType").textContent =
      data.type;

    $("#modalTitle").textContent =
      data.title;

    $("#modalContent").innerHTML =
      data.html;

    modal.classList.add(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function closeDocument() {

    const modal =
      $("#documentModal");

    if (
      !modal
    ) {

      return;
    }

    modal.classList.remove(
      "open"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  /* ============================================================
     MÚSICA — YOUTUBE
     ============================================================ */

  function updateMusicTrack(
    name
  ) {

    const element =
      $("#musicTrack");

    if (
      element
    ) {

      element.textContent =
        name;
    }
  }

  function setMusicVolume(
    value
  ) {

    musicVolume =
      Math.max(
        0,
        Math.min(
          30,
          Number(value) || 0
        )
      );

    localStorage.setItem(
      storageKeys.musicVolume,
      String(
        musicVolume
      )
    );

    const slider =
      $("#musicVolume");

    const label =
      $("#musicVolumeLabel");

    if (
      slider
    ) {

      slider.value =
        musicVolume;
    }

    if (
      label
    ) {

      label.textContent =
        `${musicVolume}%`;
    }

    if (
      youtubeReady &&
      youtubePlayer
    ) {

      youtubePlayer.setVolume(
        musicVolume
      );
    }
  }


  function createYoutubePlayer() {

    const container =
      $("#youtubePlayer");

    if (
      !container ||
      !window.YT ||
      !window.YT.Player ||
      youtubePlayer
    ) {

      return;
    }

    youtubePlayer =
      new YT.Player(
        "youtubePlayer",
        {

          videoId:
            HEXATOMBE_VIDEO_ID,

      playerVars: {

  autoplay: 0,
  controls: 1,
  rel: 0,
  playsinline: 1,
  modestbranding: 1,
  enablejsapi: 1,
  origin: window.location.origin

},

          events: {

            onReady:
              event => {

                youtubeReady =
                  true;

                event.target.setVolume(
                  musicVolume
                );

                updateMusicTrack(
                  "PARADO"
                );

              },

            onStateChange:
              event => {

                const button =
                  $("#musicPlayPause");

                if (
                  !button
                ) {

                  return;
                }

                if (
                  event.data ===
                  YT.PlayerState.PLAYING
                ) {

                  button.textContent =
                    "Ⅱ PAUSAR";

                } else if (
                  event.data ===
                    YT.PlayerState.PAUSED ||

                  event.data ===
                    YT.PlayerState.ENDED
                ) {

                  button.textContent =
                    "▶ TOCAR";

                }

              },

            onError:
              error => {

                console.error(
                  "YouTube Player:",
                  error
                );

                updateMusicTrack(
                  "ERRO NO PLAYER"
                );

                toast(
                  "A trilha não pôde ser reproduzida."
                );
              }

          }

        }
      );
  }


  window.onYouTubeIframeAPIReady =
    function () {

      createYoutubePlayer();

    };


  function toggleMusic() {

    if (
      !youtubeReady ||
      !youtubePlayer
    ) {

      toast(
        "A trilha ainda está carregando."
      );

      return;
    }

    const state =
      youtubePlayer.getPlayerState();

    if (
      state ===
      YT.PlayerState.PLAYING
    ) {

      youtubePlayer.pauseVideo();

    } else {

      youtubePlayer.setVolume(
        musicVolume
      );

      youtubePlayer.playVideo();

    }
  }


  function playMusicAt(
    seconds,
    trackName
  ) {

    if (
      !youtubeReady ||
      !youtubePlayer
    ) {

      toast(
        "A trilha ainda está carregando."
      );

      return;
    }

    const position =
      Number(seconds);

    if (
      !Number.isFinite(
        position
      )
    ) {

      return;
    }

    youtubePlayer.seekTo(
      position,
      true
    );

    youtubePlayer.setVolume(
      musicVolume
    );

    youtubePlayer.playVideo();

    updateMusicTrack(
      trackName ||
      "TRILHA"
    );
  }


  /* ============================================================
     DUCKING
     ============================================================ */

  async function toggleVoiceDucking() {

    if (
      voiceDucking
    ) {

      disableVoiceDucking();

      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia
    ) {

      toast(
        "Seu navegador não permite detectar o microfone."
      );

      return;
    }

    try {

      microphoneStream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio:
              true
          }
        );

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (
        !AudioContextClass
      ) {

        throw new Error(
          "AudioContext não suportado."
        );
      }

      microphoneContext =
        new AudioContextClass();

      if (
        microphoneContext.state ===
        "suspended"
      ) {

        await microphoneContext.resume();
      }

      microphoneAnalyser =
        microphoneContext.createAnalyser();

      microphoneAnalyser.fftSize =
        512;

      microphoneAnalyser.smoothingTimeConstant =
        0.65;

      microphoneData =
        new Uint8Array(
          microphoneAnalyser.fftSize
        );

      const source =
        microphoneContext
          .createMediaStreamSource(
            microphoneStream
          );

      source.connect(
        microphoneAnalyser
      );

      voiceDucking =
        true;

      const button =
        $("#voiceDuckToggle");

      if (
        button
      ) {

        button.textContent =
          "🎙 ABAIXAR QUANDO EU FALO: ON";

        button.classList.add(
          "active"
        );
      }

      startVoiceDucking();

      toast(
        "Controle automático da voz ativado."
      );

    } catch (error) {

      console.error(
        "Microfone:",
        error
      );

      disableVoiceDucking();

      toast(
        "Não foi possível acessar o microfone."
      );
    }
  }


  function startVoiceDucking() {

    clearInterval(
      duckingTimer
    );

    duckingTimer =
      setInterval(
        () => {

          if (
            !voiceDucking ||
            !microphoneAnalyser ||
            !microphoneData ||
            !youtubeReady ||
            !youtubePlayer
          ) {

            return;
          }

          microphoneAnalyser
            .getByteTimeDomainData(
              microphoneData
            );

          let sum =
            0;

          for (
            let i = 0;
            i <
            microphoneData.length;
            i++
          ) {

            const normalized =
              (
                microphoneData[i] -
                128
              ) /
              128;

            sum +=
              normalized *
              normalized;
          }

          const rms =
            Math.sqrt(
              sum /
              microphoneData.length
            );

          youtubePlayer.setVolume(

            rms >
            0.045

              ? Math.min(
                  musicVolume,
                  3
                )

              : musicVolume

          );

        },
        100
      );
  }


  function disableVoiceDucking() {

    voiceDucking =
      false;

    clearInterval(
      duckingTimer
    );

    duckingTimer =
      null;

    if (
      microphoneStream
    ) {

      microphoneStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

      microphoneStream =
        null;
    }

    if (
      microphoneContext
    ) {

      microphoneContext
        .close()
        .catch(
          () => {}
        );

      microphoneContext =
        null;
    }

    microphoneAnalyser =
      null;

    microphoneData =
      null;

    if (
      youtubeReady &&
      youtubePlayer
    ) {

      youtubePlayer.setVolume(
        musicVolume
      );
    }

    const button =
      $("#voiceDuckToggle");

    if (
      button
    ) {

      button.textContent =
        "🎙 ABAIXAR QUANDO EU FALO: OFF";

      button.classList.remove(
        "active"
      );
    }
  }


  /* ============================================================
     PAINEL DE SOM
     ============================================================ */

  function toggleSoundPanel() {

    const panel =
      $("#soundPanel");

    if (
      !panel
    ) {

      return;
    }

    const willOpen =
      !panel.classList.contains(
        "open"
      );

    panel.classList.toggle(
      "open",
      willOpen
    );

    panel.setAttribute(
      "aria-hidden",
      String(
        !willOpen
      )
    );

    if (
      willOpen
    ) {

      if (
        window.YT?.Player
      ) {

        createYoutubePlayer();

      }

      panel.scrollTop =
        0;
    }

    playSound(
      "panel"
    );
  }


  /* ============================================================
     ZOOM
     ============================================================ */

  function setZoom(
    value
  ) {

    zoom =
      Math.max(
        0.75,
        Math.min(
          1.35,
          Number(
            value
          ) || 1
        )
      );

    const canvas =
      $("#boardCanvas");

    if (
      canvas
    ) {

      canvas.style.transform =
        `scale(${zoom})`;
    }

    const label =
      $("#zoomLabel");

    if (
      label
    ) {

      label.textContent =
        `${Math.round(
          zoom *
          100
        )}%`;
    }

    renderConnections();
  }


  /* ============================================================
     ABRIR QUADRO
     ============================================================ */

  function openBoard() {

    const board =
      $("#boardSection");

    if (
      !board
    ) {

      return;
    }

    board.scrollIntoView({
      behavior:
        "smooth",

      block:
        "start"
    });
  }


  /* ============================================================
     REALTIME
     ============================================================ */

  function subscribeRealtime() {

    if (
      appMode !==
      "supabase" ||
      !supabase
    ) {

      return;
    }

    if (
      realtimeChannel
    ) {

      supabase.removeChannel(
        realtimeChannel
      );
    }

    realtimeChannel =
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

            if (
              payload.eventType ===
              "INSERT"
            ) {

              if (
                !cards.some(
                  card =>
                    card.id ===
                    payload.new.id
                )
              ) {

                cards.push(
                  payload.new
                );
              }
            }

            if (
              payload.eventType ===
              "UPDATE"
            ) {

              const index =
                cards.findIndex(
                  card =>
                    card.id ===
                    payload.new.id
                );

              if (
                index >=
                0
              ) {

                cards[index] = {
                  ...cards[index],
                  ...payload.new
                };
              }
            }

            if (
              payload.eventType ===
              "DELETE"
            ) {

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

            if (
              payload.eventType ===
              "INSERT"
            ) {

              if (
                !connections.some(
                  connection =>
                    connection.id ===
                    payload.new.id
                )
              ) {

                connections.push(
                  payload.new
                );
              }
            }

            if (
              payload.eventType ===
              "UPDATE"
            ) {

              const index =
                connections.findIndex(
                  connection =>
                    connection.id ===
                    payload.new.id
                );

              if (
                index >=
                0
              ) {

                connections[index] =
                  payload.new;
              }
            }

            if (
              payload.eventType ===
              "DELETE"
            ) {

              connections =
                connections.filter(
                  connection =>
                    connection.id !==
                    payload.old.id
                );
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

            window._entityNotes =
              window._entityNotes ||
              [];

            if (
              payload.eventType ===
              "INSERT"
            ) {

              if (
                !window._entityNotes.some(
                  note =>
                    note.id ===
                    payload.new.id
                )
              ) {

                window._entityNotes.push(
                  payload.new
                );
              }
            }

            if (
              payload.eventType ===
              "UPDATE"
            ) {

              const index =
                window._entityNotes.findIndex(
                  note =>
                    note.id ===
                    payload.new.id
                );

              if (
                index >=
                0
              ) {

                window._entityNotes[index] =
                  payload.new;
              }
            }

            if (
              payload.eventType ===
              "DELETE"
            ) {

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

            if (
              status ===
              "SUBSCRIBED"
            ) {

              setSync(
                "tempo real",
                true
              );
            }
          }
        );
  }


  /* ============================================================
     NAVEGAÇÃO
     ============================================================ */

  function initNavigationObserver() {

    if (
      !(
        "IntersectionObserver"
        in
        window
      )
    ) {

      return;
    }

    const observer =
      new IntersectionObserver(

        entries => {

          entries.forEach(
            entry => {

              if (
                !entry.isIntersecting
              ) {

                return;
              }

              $$(".main-nav a")
                .forEach(
                  link => {

                    link.classList.toggle(

                      "active",

                      link.getAttribute(
                        "href"
                      ) ===
                      `#${entry.target.id}`

                    );
                  }
                );
            }
          );
        },

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
  }


  /* ============================================================
     EVENTOS
     ============================================================ */

  function bindEvents() {

    on(
      "#soundToggle",
      "click",
      () => {

        toggleSoundPanel();

      }
    );


    on(
      "#musicPlayPause",
      "click",
      () => {

        toggleMusic();

      }
    );


    on(
      "#musicVolume",
      "input",
      event => {

        setMusicVolume(
          event.target.value
        );

      }
    );


    on(
      "#voiceDuckToggle",
      "click",
      () => {

        toggleVoiceDucking();

      }
    );

$$(
  ".location-item"
)
.forEach(
  location => {

    location.addEventListener(
      "click",
      event => {

        if (
          event.target.closest(
            ".shared-notes"
          )
        ) {

          return;
        }

        const key =
          location.dataset.noteKey;

        if (!key) {
          return;
        }

        openLocation(
          key
        );
      }
    );

    location.style.cursor =
      "pointer";
  }
);
    on(
      "#enterBoard",
      "click",
      () => {

        playSound(
          "enter"
        );

        openBoard();

      }
    );


    on(
      "#addCardBtn",
      "click",
      () => {

        playSound(
          "document"
        );

        openNewCard();

      }
    );


    on(
      "#createCard",
      "click",
      () => {

        playSound(
          "save"
        );

        createCard();

      }
    );


    on(
      "#connectionMode",
      "click",
      () => {

        connectingMode =
          !connectingMode;

        const button =
          $("#connectionMode");

        const hint =
          $("#connectionHint");

        if (
          button
        ) {

          button.classList.toggle(
            "active",
            connectingMode
          );
        }

        if (
          hint
        ) {

          hint.textContent =

            connectingMode

              ? "modo conectar ativo • clique em duas pistas"

              : "arraste • escreva • conecte • todos veem as mudanças";

        }

        selectCard(
          null
        );

        playSound(
          "connect"
        );
      }
    );


    on(
      "#resetBoard",
      "click",
      () => {

        seedCards.forEach(
          original => {

            const card =
              cards.find(
                item =>

                  String(
                    item.id
                  ) ===
                  String(
                    original.id
                  ) ||

                  item.title ===
                  original.title
              );

            if (
              !card
            ) {

              return;
            }

            card.x =
              original.x;

            card.y =
              original.y;

            card.rotation =
              original.rotation;

            const element =
              $(
                `#boardCanvas [data-id="${CSS.escape(
                  String(
                    card.id
                  )
                )}"]`
              );

            if (
              element
            ) {

              element.style.left =
                `${original.x}%`;

              element.style.top =
                `${original.y}%`;

              element.style.setProperty(
                "--rotation",
                `${original.rotation}deg`
              );
            }

            saveCardPosition(
              card
            );
          }
        );

        renderConnections();

        toast(
          "Posições reposicionadas."
        );

        playSound(
          "save"
        );
      }
    );


    on(
      "#boardSearch",
      "input",
      () => {

        filterCards();

      }
    );


    on(
      "#zoomIn",
      "click",
      () => {

        setZoom(
          zoom +
          0.1
        );

        playSound(
          "document"
        );
      }
    );


    on(
      "#zoomOut",
      "click",
      () => {

        setZoom(
          zoom -
          0.1
        );

        playSound(
          "document"
        );
      }
    );


    on(
      "#cancelEditor",
      "click",
      () => {

        closeEditor();

      }
    );


    on(
      "#saveEditor",
      "click",
      () => {

        saveEditor();

      }
    );


    $$(
      "[data-close-editor]"
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () =>
            closeEditor()
        );

      }
    );


    $$(
      "[data-close-modal]"
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () =>
            closeDocument()
        );

      }
    );


    $$(
      "[data-close-new-card]"
    )
    .forEach(
      element => {

        element.addEventListener(
          "click",
          () =>
            closeNewCard()
        );

      }
    );


    $$(
      ".entity-note-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            playSound(
              "edit"
            );

            openEntityEditor(
              button
            );

          }
        );

      }
    );


    $$(
      ".document-card"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            playSound(
              "document"
            );

            openDocument(
              button.dataset.document
            );

          }
        );

      }
    );


    $$(
      ".main-nav a"
    )
    .forEach(
      link => {

        link.addEventListener(
          "click",
          () =>
            playSound(
              "nav"
            )
        );

      }
    );


    const brand =
      $(".brand");

    if (
      brand
    ) {

      brand.addEventListener(
        "click",
        () =>
          playSound(
            "nav"
          )
      );
    }


    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key !==
          "Escape"
        ) {

          return;
        }

        closeDocument();

        closeEditor();

        closeNewCard();

        const panel =
          $("#soundPanel");

        if (
          panel
        ) {

          panel.classList.remove(
            "open"
          );

          panel.setAttribute(
            "aria-hidden",
            "true"
          );
        }
      }
    );


    window.addEventListener(
      "resize",
      () =>
        renderConnections()
    );
  }


  /* ============================================================
     INICIALIZAÇÃO
     ============================================================ */
 const locations = {

  praca: {

    type:
      "LOCAL 01 — SANTA CECÍLIA",

    title:
      "Praça Santa Cecília",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          02:12
        </p>

        <p>
          <strong>ESTADO:</strong>
          Concluído
        </p>

        <hr>

        <p>
          Primeiro ponto registrado da investigação.
          O sangue foi encontrado antes de qualquer
          explicação para a origem do som.
        </p>

        <p>
          Cinco marcas circulares foram encontradas
          próximas ao local.
        </p>

        <p class="hand">
          O sino tocou antes de encontrarmos a origem.
        </p>

      </div>
    `
  },


  apartamento: {

    type:
      "LOCAL 02 — APARTAMENTO 18",

    title:
      "Apartamento 18",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          02:40
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          MEDO
        </p>

        <hr>

        <p>
          O segundo ponto apresenta relatos de
          presença e alterações na percepção.
        </p>

        <p>
          O sino voltou a ser ouvido antes que
          qualquer manifestação fosse identificada.
        </p>

        <p class="hand">
          Tocou antes de acontecer.
        </p>

      </div>
    `
  },


  tunel: {

    type:
      "LOCAL 03 — TÚNEL FERROVIÁRIO",

    title:
      "Túnel ferroviário",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          03:05
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          VIOLÊNCIA
        </p>

        <hr>

        <p>
          O terceiro ponto apresenta sinais de
          violência e preparação interrompida.
        </p>

        <p>
          A sequência parece estar avançando
          independentemente da investigação.
        </p>

        <p class="hand">
          Ainda não era para tocar.
        </p>

      </div>
    `
  },


  escola: {

    type:
      "LOCAL 04 — ESCOLA MUNICIPAL",

    title:
      "Escola municipal",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          03:30
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          SILÊNCIO
        </p>

        <hr>

        <p>
          A escola concentra uma das conexões
          mais importantes da investigação.
        </p>

        <p>
          Desenhos encontrados no local repetem
          formas circulares associadas à ocorrência.
        </p>

        <p class="hand">
          Eles descobriram o padrão.
        </p>

      </div>
    `
  },


  torre: {

    type:
      "LOCAL 05 — TORRE SEM NOME",

    title:
      "Torre sem nome",

    html: `

      <div class="paper">

        <p>
          <strong>HORÁRIO:</strong>
          03:55
        </p>

        <p>
          <strong>ELEMENTO:</strong>
          SINO
        </p>

        <hr>

        <p>
          Torre sem identificação conhecida.
          Nenhum sino é visível no local.
        </p>

        <p>
          Mesmo assim, quanto mais próximos os
          investigadores chegam, mais definido
          fica o som.
        </p>

        <p class="hand">
          O quinto não é convocado.<br>
          O quinto convoca.
        </p>

      </div>
    `
  }

};


function openLocation(
  key
) {

  const location =
    locations[key];

  const modal =
    $("#documentModal");

  if (
    !location ||
    !modal
  ) {

    return;
  }

  $("#modalType").textContent =
    location.type;

  $("#modalTitle").textContent =
    location.title;

  $("#modalContent").innerHTML =
    location.html;

  modal.classList.add(
    "open"
  );

  modal.setAttribute(
    "aria-hidden",
    "false"
  );

  playSound(
    "document"
  );
}
  
  async function start() {

    bindEvents();

    initNavigationObserver();

    setMusicVolume(
      musicVolume
    );

    loadLocalData();

    setMusicVolume(
  musicVolume
);

if (
  window.YT?.Player
) {
  createYoutubePlayer();
}
    
    const connected =
      await initSupabase();

    if (
      !connected
    ) {

      return;
    }

    try {

      await enterMainCampaign();

      await loadCampaignData();

      subscribeRealtime();

    } catch (
      error
    ) {

      console.error(
        "Mesa compartilhada:",
        error
      );

      appMode =
        "local";

      campaignId =
        "local";

      campaignCode =
        "LOCAL";

      loadLocalData();

      setSync(
        "modo local",
        false
      );

      toast(
        "Banco indisponível. O mural continua funcionando neste navegador."
      );
    }
  }


  /* ============================================================
     INICIAR
     ============================================================ */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once:
          true
      }
    );

  } else {

    start();

  }

})();
function filterCards() {

  const input =
    $("#boardSearch");

  const query =
    input?.value
      .trim()
      .toLowerCase() ||
    "";

  const canvas =
    $("#boardCanvas");

  if (!canvas) {
    return;
  }

  const cardsElements =
    $$(".evidence-card", canvas);

  cardsElements.forEach(
    element => {

      if (!query) {

        element.classList.remove(
          "dimmed"
        );

        return;
      }

      const id =
        String(
          element.dataset.id
        );

      const card =
        cards.find(
          item =>
            String(
              item.id
            ) ===
            id
        );

      if (!card) {
        return;
      }

      const content =
        [

          card.title,
          card.clue_type,
          card.context,
          card.notes

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      const match =
        content.includes(
          query
        );

      element.classList.toggle(
        "dimmed",
        !match
      );
    }
  );
}
