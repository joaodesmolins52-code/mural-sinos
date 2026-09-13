(() => {
  "use strict";


  /* ============================================================
     UTILIDADES
     ============================================================ */

  const $ = (
    selector,
    root = document
  ) =>
    root.querySelector(
      selector
    );


  const $$ = (
    selector,
    root = document
  ) =>
    [
      ...root.querySelectorAll(
        selector
      )
    ];


  function on(
    selector,
    event,
    handler
  ) {

    const element =
      $(selector);


    if (element) {

      element.addEventListener(
        event,
        handler
      );

    }

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    ).replace(
      /[&<>'"]/g,
      character =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;"
        })[character]
    );

  }


  function safeJSON(
    value,
    fallback
  ) {

    try {

      return JSON.parse(
        value
      );

    } catch {

      return fallback;

    }

  }


  /* ============================================================
     CONFIGURAÇÃO
     ============================================================ */

  const config =
    window.SUPABASE_CONFIG ||
    {};


  const storageKeys = {

    cards:
      "sinosLocalCards",

    objects:
      "sinosLocalObjects",

    connections:
      "sinosLocalConnections",

    notes:
      "sinosLocalNotes",

    sounds:
      "sinosUISounds"

  };


  let supabase =
    null;


  let supabaseReady =
    false;


  let realtimeChannel =
    null;


  let appMode =
    "local";


  let campaignId =
    "local";


  let campaignCode =
    "LOCAL";


  let currentUser =
    null;


  let cards =
    [];


  let objects =
    [];


  let connections =
    [];


  let selectedCard =
    null;


  let draggingCard =
    null;


  let dragMoved =
    false;


  let connectingMode =
    false;


  let zoom =
    1;


  let editingNote =
    null;


  let toastTimer =
    null;


  let noteTimer =
    null;


  let audioObjectUrl =
    null;


  let audioContext =
    null;


  /* ============================================================
     PISTAS INICIAIS
     ============================================================ */

  const seedCards = [

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
        -3
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
        2
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
        -1
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
        3
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
        -2
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
        2
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
        1
    }

  ];


  /* ============================================================
     OBJETOS
     ============================================================ */

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
    }

  ];


  /* ============================================================
     SOM DE INTERFACE
     ============================================================ */

  const frequencies = {

    D3:
      146.83,

    F3:
      174.61,

    A3:
      220,

    C4:
      261.63,

    D4:
      293.66,

    F4:
      349.23,

    A4:
      440,

    C5:
      523.25,

    D5:
      587.33

  };


  let uiSoundsEnabled =
    localStorage.getItem(
      storageKeys.sounds
    ) !==
    "false";


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
        .catch(
          () => {}
        );

    }


    return audioContext;

  }


  function playTone(

    note,

    duration =
      0.06,

    delay =
      0,

    type =
      "sine",

    volume =
      0.02

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


    const now =
      context.currentTime +
      delay;


    oscillator.type =
      type;


    oscillator.frequency.value =
      frequencies[note] ||
      note;


    gain.gain.setValueAtTime(
      0.0001,
      now
    );


    gain.gain.exponentialRampToValueAtTime(
      volume,
      now +
      0.008
    );


    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now +
      duration
    );


    oscillator
      .connect(gain)
      .connect(
        context.destination
      );


    oscillator.start(
      now
    );


    oscillator.stop(
      now +
      duration +
      0.02
    );

  }


  function playSound(
    type =
      "click"
  ) {

    if (
      !uiSoundsEnabled
    ) {

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


      case "tool":

        playTone(
          "F4",
          0.06,
          0,
          "triangle",
          0.022
        );

        break;


      case "card":

        playTone(
          "D4",
          0.06,
          0,
          "triangle",
          0.025
        );

        playTone(
          "F4",
          0.08,
          0.04,
          "sine",
          0.015
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
        config.url ||
        ""
      ).trim();


    if (!raw) {

      return "";

    }


    if (
      raw.startsWith(
        "//"
      )
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
        config.anonKey ||
        ""
      ).trim();


    return Boolean(

      url &&

      key &&

      (
        url.startsWith(
          "http://"
        ) ||

        url.startsWith(
          "https://"
        )

      )

    );

  }


  function setSync(
    text,
    connected =
      false
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
        sessionResult.data
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


  /* ============================================================
     ENTRADA AUTOMÁTICA NA MESA
     ============================================================ */

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
            structuredClone(
              seedCards
            )
          )
        : structuredClone(
            seedCards
          );


    objects =
      savedObjects
        ? safeJSON(
            savedObjects,
            structuredClone(
              seedObjects
            )
          )
        : structuredClone(
            seedObjects
          );


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
      JSON.stringify(
        cards
      )
    );


    localStorage.setItem(
      storageKeys.objects,
      JSON.stringify(
        objects
      )
    );


    localStorage.setItem(
      storageKeys.connections,
      JSON.stringify(
        connections
      )
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

          const separator =
            compoundKey.indexOf(
              ":"
            );


          return {

            entity_kind:
              compoundKey.slice(
                0,
                separator
              ),

            entity_key:
              compoundKey.slice(
                separator +
                1
              ),

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


    const cluesResult =
      await supabase
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
        );


    if (
      cluesResult.error
    ) {

      throw cluesResult.error;

    }


    const objectsResult =
      await supabase
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
        );


    if (
      objectsResult.error
    ) {

      throw objectsResult.error;

    }


    const connectionsResult =
      await supabase
        .from("connections")
        .select("*")
        .eq(
          "campaign_id",
          campaignId
        );


    if (
      connectionsResult.error
    ) {

      throw connectionsResult.error;

    }


    cards =
      cluesResult.data ||
      [];


    objects =
      objectsResult.data ||
      [];


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
     RENDER GERAL
     ============================================================ */

  function renderAll() {

    renderCards();

    renderObjects();

    renderConnections();

    renderEntityNotes();

    applyImageAssets();

    filterCards();

  }


  /* ============================================================
     CARDS DO MURAL
     ============================================================ */

  function isSeedCard(
    id
  ) {

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
        element =>
          element.remove()
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

          <div
            class="card-pin"
          ></div>


          <span
            class="card-number"
          >
            ${String(
              index +
              1
            ).padStart(
              2,
              "0"
            )}
          </span>


          <span
            class="card-type"
          >
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


          <p
            class="card-context"
          >
            ${escapeHtml(
              card.context ||
              ""
            )}
          </p>


          <div
            class="card-notes-wrap"
          >

            <span
              class="card-notes-label"
            >
              ANOTAÇÕES DA EQUIPE
            </span>


            <textarea
              class="card-notes"
              data-card-notes
              placeholder="Escreva aqui..."
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
            isSeedCard(
              card.id
            )

              ? ""

              : `
                <button
                  class="mini-delete"
                  type="button"
                  data-sound="danger"
                >
                  ×
                </button>
              `
          }

        `;


        const textarea =
          $(
            "[data-card-notes]",
            element
          );


        if (textarea) {

          textarea.value =
            card.notes ||
            "";


          textarea.addEventListener(
            "pointerdown",
            event =>
              event.stopPropagation()
          );


          textarea.addEventListener(
            "click",
            event =>
              event.stopPropagation()
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
      $(".mini-edit",card);


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
      $(".mini-delete",card);


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


  /* ============================================================
     ARRASTAR CARD
     ============================================================ */

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
        card.dataset.offsetX
      );


    const offsetY =
      Number(
        card.dataset.offsetY
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
        (
          finalX /
          canvas.clientWidth
        ) *
        100
      }%`;


    card.style.top =
      `${
        (
          finalY /
          canvas.clientHeight
        ) *
        100
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


    if (model) {

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


  /* ============================================================
     SELEÇÃO
     ============================================================ */

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

  async function toggleConnection(
    firstId,
    secondId
  ) {

    const [
      a,
      b
    ] =
      [
        String(firstId),
        String(secondId)
      ]
      .sort();


    if (
      appMode ===
      "supabase"
    ) {

      try {

        const existing =
          connections.find(
            connection =>

              String(
                connection.clue_a ??
                connection[0]
              ) ===
              a &&

              String(
                connection.clue_b ??
                connection[1]
              ) ===
              b
          );


        if (
          existing
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
                  a,

                clue_b:
                  b,

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


    const index =
      connections.findIndex(
        connection =>
          String(
            connection.clue_a ??
            connection[0]
          ) ===
          a &&

          String(
            connection.clue_b ??
            connection[1]
          ) ===
          b
      );


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
        [
          a,
          b
        ]
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

        const aId =
          connection.clue_a ??
          connection[0];


        const bId =
          connection.clue_b ??
          connection[1];


        const a =
          canvas.querySelector(
            `[data-id="${CSS.escape(
              String(aId)
            )}"]`
          );


        const b =
          canvas.querySelector(
            `[data-id="${CSS.escape(
              String(bId)
            )}"]`
          );


        if (
          !a ||
          !b
        ) {

          return;

        }


        const p1 = {

          x:
            a.offsetLeft +
            a.offsetWidth /
            2,

          y:
            a.offsetTop +
            a.offsetHeight /
            2

        };


        const p2 = {

          x:
            b.offsetLeft +
            b.offsetWidth /
            2,

          y:
            b.offsetTop +
            b.offsetHeight /
            2

        };


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


        if (
          selectedCard === a ||
          selectedCard === b
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


  /* ============================================================
     SALVAR POSIÇÃO
     ============================================================ */

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
          .from(
            "clues"
          )
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
                  .from(
                    "clues"
                  )
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
                "Anotação da pista:",
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


    if (!modal) {

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


    if (!modal) {

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

    const title =
      $("#newCardTitle")
        ?.value
        .trim();


    const type =
      $("#newCardType")
        ?.value
        .trim() ||
      "PISTA";


    const context =
      $("#newCardContext")
        ?.value
        .trim() ||
      "";


    if (
      !title
    ) {

      toast(
        "Dê um título à pista."
      );

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
        Math.random() *
        50,

      y:
        20 +
        Math.random() *
        55,

      rotation:
        Math.random() *
        4 -
        2

    };


    if (
      appMode ===
      "supabase"
    ) {

      try {

        const result =
          await supabase
            .from(
              "clues"
            )
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


    closeNewCard();


    if (
      $("#newCardTitle")
    ) {

      $("#newCardTitle").value =
        "";

    }


    if (
      $("#newCardType")
    ) {

      $("#newCardType").value =
        "";

    }


    if (
      $("#newCardContext")
    ) {

      $("#newCardContext").value =
        "";

    }


    toast(
      "Nova pista adicionada."
    );

  }


  /* ============================================================
     EDITAR PISTA
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
            .from(
              "clues"
            )
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
        connection =>
          String(
            connection.clue_a ??
            connection[0]
          ) !==
          String(
            id
          ) &&

          String(
            connection.clue_b ??
            connection[1]
          ) !==
          String(
            id
          )
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


  function closeEditor() {

    const modal =
      $("#editorModal");


    if (!modal) {

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


  /* ============================================================
     ANOTAÇÕES DE ENTIDADES
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

          note.user_id ===
            currentUser?.id
      );


    $("#editorTitle").textContent =
      "ANOTAÇÃO";


    $("#editorText").value =
      existing?.text ||
      "";


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
          "Salvar entidade:",
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

    const allNotes =
      window._entityNotes ||
      [];


    $(
      ".shared-notes"
    )
    .forEach(
      box => {

        const kind =
          box.dataset.noteKind;


        const key =
          box.dataset.noteKey;


        box.innerHTML =
          "";


        allNotes
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


              line.innerHTML = `

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


          tile.dataset.sound =
            "document";


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
            () =>
              openObject(
                object
              )
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


    const type =
      $("#modalType");


    const title =
      $("#modalTitle");


    const content =
      $("#modalContent");


    if (
      type
    ) {

      type.textContent =
        object.object_type ||
        "OBJETO";

    }


    if (
      title
    ) {

      title.textContent =
        object.name ||
        "OBJETO";

    }


    if (
      content
    ) {

      content.innerHTML = `

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

    }


    modal.classList.add(
      "open"
    );


    modal.setAttribute(
      "aria-hidden",
      "false"
    );

  }


  /* ============================================================
     IMAGENS
     ============================================================ */

  async function applyImageAssets() {

    const slots =
      $(
        ".image-slot[data-asset]"
      );


    for (
      const element
      of slots
    ) {

      const requested =
        element.dataset.asset;


      if (
        !requested
      ) {

        continue;

      }


      const candidates =
        buildAssetCandidates(
          requested
        );


      const imageUrl =
        await findWorkingImage(
          candidates
        );


      if (
        !imageUrl
      ) {

        continue;

      }


      if (
        element.classList.contains(
          "character-bg"
        )
      ) {

        element.innerHTML =
          "";


        const image =
          document.createElement(
            "img"
          );


        image.src =
          imageUrl;


        image.alt =
          element
            .closest(
              "[data-entity]"
            )
            ?.dataset.entity ||
          "";


        image.loading =
          "lazy";


        image.decoding =
          "async";


        image.draggable =
          false;


        element.appendChild(
          image
        );


        element.classList.add(
          "asset-loaded"
        );

      } else {

        element.style.backgroundImage =
          `url("${imageUrl}")`;


        element.style.setProperty(
          "--location-image",
          `url("${imageUrl}")`
        );


        element.classList.add(
          "has-image"
        );

      }

    }

  }


  function buildAssetCandidates(
    path
  ) {

    const clean =
      path.replace(
        /\\/g,
        "/"
      );


    const base =
      clean.replace(
        /\.(webp|png|jpg|jpeg|gif)$/i,
        ""
      );


    return [

      clean,

      `${base}.webp`,

      `${base}.png`,

      `${base}.jpg`,

      `${base}.jpeg`

    ];

  }


  function findWorkingImage(
    candidates
  ) {

    return new Promise(
      resolve => {

        let index =
          0;


        function testNext() {

          if (
            index >=
            candidates.length
          ) {

            resolve(
              null
            );


            return;

          }


          const url =
            candidates[
              index
            ];


          index++;


          const image =
            new Image();


          image.onload =
            () =>
              resolve(
                url
              );


          image.onerror =
            () =>
              testNext();


          image.src =
            url;

        }


        testNext();

      }
    );

  }


  /* ============================================================
     PESQUISA
     ============================================================ */

  function filterCards() {

    const input =
      $("#boardSearch");


    if (
      !input
    ) {

      return;

    }


    const query =
      input.value
        .trim()
        .toLowerCase();


    cards.forEach(
      card => {

        const element =
          $(
            `#boardCanvas [data-id="${CSS.escape(
              String(card.id)
            )}"]`
          );


        if (
          !element
        ) {

          return;

        }


        const text =
          [

            card.title,

            card.context,

            card.clue_type,

            card.notes

          ]
            .join(
              " "
            )
            .toLowerCase();


        element.classList.toggle(
          "dimmed",
          Boolean(
            query &&
            !text.includes(
              query
            )
          )
        );

      }
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


  function openDocument(
    key
  ) {

    const documentData =
      documents[
        key
      ];


    const modal =
      $("#documentModal");


    if (
      !documentData ||
      !modal
    ) {

      return;

    }


    $("#modalType").textContent =
      documentData.type;


    $("#modalTitle").textContent =
      documentData.title;


    $("#modalContent").innerHTML =
      documentData.html;


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
     SOM
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


    playSound(
      "panel"
    );

  }


  function toggleInterfaceSounds() {

    uiSoundsEnabled =
      !uiSoundsEnabled;


    localStorage.setItem(
      storageKeys.sounds,
      String(
        uiSoundsEnabled
      )
    );


    const button =
      $("#interfaceSoundToggle");


    if (
      button
    ) {

      button.textContent =
        `SONS DE INTERFACE: ${
          uiSoundsEnabled
            ? "ON"
            : "OFF"
        }`;

    }


    if (
      uiSoundsEnabled
    ) {

      playSound(
        "save"
      );

    }

  }


  function handleAudioFile(
    event
  ) {

    const file =
      event.target.files?.[0];


    const audio =
      $("#ambientAudio");


    if (
      !file ||
      !audio
    ) {

      return;

    }


    if (
      audioObjectUrl
    ) {

      URL.revokeObjectURL(
        audioObjectUrl
      );

    }


    audioObjectUrl =
      URL.createObjectURL(
        file
      );


    audio.src =
      audioObjectUrl;


    audio.load();


    audio
      .play()
      .catch(
        () => {}
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
          )
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

                window._entityNotes[
                  index
                ] =
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
     NAVEGAÇÃO ATIVA
     ============================================================ */

  function initNavigationObserver() {

    if (
      !("IntersectionObserver" in window)
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


              $(
                ".main-nav a"
              )
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
      "#interfaceSoundToggle",
      "click",
      () => {

        toggleInterfaceSounds();

      }
    );


    on(
      "#audioFile",
      "change",
      event => {

        handleAudioFile(
          event
        );

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
          "tool"
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


        if (
          button
        ) {

          button.classList.toggle(
            "active",
            connectingMode
          );

        }


        const hint =
          $("#connectionHint");


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
          "tool"
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
          "tool"
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
      element =>
        element.addEventListener(
          "click",
          () =>
            closeEditor()
        )
    );


    $$(
      "[data-close-modal]"
    )
    .forEach(
      element =>
        element.addEventListener(
          "click",
          () =>
            closeDocument()
        )
    );


    $$(
      "[data-close-new-card]"
    )
    .forEach(
      element =>
        element.addEventListener(
          "click",
          () =>
            closeNewCard()
        )
    );


    $$(
      ".entity-note-btn"
    )
    .forEach(
      button =>
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
        )
    );


    $$(
      ".document-card"
    )
    .forEach(
      button =>
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
        )
    );


    $$(
      ".main-nav a"
    )
    .forEach(
      link =>
        link.addEventListener(
          "click",
          () =>
            playSound(
              "nav"
            )
        )
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

  async function start() {

    /*
      Primeiro a interface local é carregada.
      Assim o site nunca fica inutilizado
      porque o Supabase deu erro.
    */

    bindEvents();


    initNavigationObserver();


    loadLocalData();


    /*
      Depois tentamos entrar na mesa compartilhada.
    */

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
