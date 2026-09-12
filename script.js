/* ---------- config / startup ---------- */

function hasSupabaseConfig(){

  return Boolean(
    config.url &&
    config.anonKey &&
    !String(config.url).startsWith("COLE_AQUI") &&
    !String(config.anonKey).startsWith("COLE_AQUI")
  );
}


function setSync(label, connected){

  const syncStatus =
    $("#syncStatus");

  if(syncStatus){
    syncStatus.textContent = label;
  }


  const footerState =
    $("#footerState");

  if(footerState){

    footerState.textContent =
      connected
        ? "MESA COMPARTILHADA"
        : "MODO LOCAL";

  }
}


/* ---------- Supabase ---------- */

async function initSupabase(){

  if(
    !hasSupabaseConfig() ||
    !window.supabase?.createClient
  ){

    appMode = "local";

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
      data.session?.user || null;


    if(!currentUser){

      const result =
        await supabase.auth.signInAnonymously();


      if(result.error){
        throw result.error;
      }


      currentUser =
        result.data.user;
    }


    if(!currentUser){
      throw new Error(
        "USUARIO_ANONIMO_NAO_CRIADO"
      );
    }


    supabaseReady = true;
    appMode = "supabase";


    setSync(
      "Supabase conectado",
      false
    );


    return true;

  }catch(error){

    console.error(
      "Erro de conexão com Supabase:",
      error
    );


    supabaseReady = false;
    appMode = "local";


    setSync(
      "modo local",
      false
    );


    return false;
  }
}


/* ---------- entrada automática na única mesa ---------- */

async function enterMainCampaign(){

  if(!supabaseReady){

    throw new Error(
      "SUPABASE_NAO_PRONTO"
    );

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
      "MESA_PRINCIPAL_NAO_ENCONTRADA"
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


  return row;
}


/* ---------- inicialização ---------- */

async function bootstrap(){

  const connected =
    await initSupabase();


  /*
    Supabase funcionando:
    entra automaticamente na única mesa.
  */

  if(connected){

    try{

      await enterMainCampaign();

      await loadCampaignData();

      subscribeRealtime();

      setSync(
        "tempo real",
        true
      );

      return;

    }catch(error){

      console.error(
        "Erro ao carregar a mesa:",
        error
      );


      /*
        Caso o banco ainda não esteja pronto,
        o site não fica inutilizado.
      */

      appMode =
        "local";

      campaignId =
        "local";

      campaignCode =
        "LOCAL";

      loadLocalData();


      toast(
        "A mesa compartilhada não pôde ser carregada. Modo local ativado."
      );


      return;
    }
  }


  /*
    Sem Supabase:
    o site funciona localmente.
  */

  campaignId =
    "local";

  campaignCode =
    "LOCAL";

  playerName =
    "Jogador";

  playerRole =
    "player";


  loadLocalData();

}


/* ---------- local dataset ---------- */
