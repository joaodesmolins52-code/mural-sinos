-- ============================================================
-- O SOM QUE NÃO DEVERIA EXISTIR
-- MURAL COMPARTILHADO — UMA ÚNICA MESA
-- ============================================================


-- ============================================================
-- EXTENSÃO
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- CAMPANHAS
-- ============================================================

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);


-- ============================================================
-- JOGADORES
-- ============================================================

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  campaign_id uuid not null
    references public.campaigns(id)
    on delete cascade,

  display_name text not null,

  role text not null
    default 'player'
    check (role in ('player', 'master')),

  created_at timestamptz not null
    default now(),

  unique(user_id, campaign_id)
);


-- ============================================================
-- PISTAS DO MURAL
-- ============================================================

create table if not exists public.clues (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.campaigns(id)
    on delete cascade,

  title text not null,

  clue_type text not null
    default 'PISTA',

  context text not null
    default '',

  notes text not null
    default '',

  image_url text,

  x numeric not null
    default 10,

  y numeric not null
    default 10,

  rotation numeric not null
    default 0,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- CONEXÕES
-- ============================================================

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.campaigns(id)
    on delete cascade,

  clue_a uuid not null
    references public.clues(id)
    on delete cascade,

  clue_b uuid not null
    references public.clues(id)
    on delete cascade,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  check (clue_a <> clue_b)
);


create unique index if not exists connections_pair_unique
on public.connections (
  campaign_id,
  clue_a,
  clue_b
);


-- ============================================================
-- OBJETOS
-- ============================================================

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.campaigns(id)
    on delete cascade,

  name text not null,

  object_type text not null
    default 'OBJETO',

  description text not null
    default '',

  content text not null
    default '',

  image_url text,

  x numeric not null
    default 50,

  y numeric not null
    default 50,

  created_at timestamptz not null
    default now()
);


-- ============================================================
-- ANOTAÇÕES COLABORATIVAS
-- ============================================================

create table if not exists public.entity_notes (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.campaigns(id)
    on delete cascade,

  entity_kind text not null
    check (
      entity_kind in (
        'clue',
        'character',
        'location',
        'event',
        'free'
      )
    ),

  entity_key text not null,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  author_name text not null,

  text text not null
    default '',

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique(
    campaign_id,
    entity_kind,
    entity_key,
    user_id
  )
);


-- ============================================================
-- UPDATED_AT
-- ============================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin

  new.updated_at =
    now();

  return new;

end;
$$;


drop trigger if exists
clues_touch_updated_at
on public.clues;


create trigger
clues_touch_updated_at

before update
on public.clues

for each row
execute function
public.touch_updated_at();


drop trigger if exists
notes_touch_updated_at
on public.entity_notes;


create trigger
notes_touch_updated_at

before update
on public.entity_notes

for each row
execute function
public.touch_updated_at();


-- ============================================================
-- VERIFICAÇÃO DE MEMBRO
-- ============================================================

create or replace function public.is_campaign_member(
  target_campaign uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$

  select exists (

    select 1

    from public.players

    where players.campaign_id =
      target_campaign

      and players.user_id =
        auth.uid()

  );

$$;


-- ============================================================
-- DADOS INICIAIS
-- ============================================================

create or replace function public.seed_campaign(
  target_campaign uuid,
  creator uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin


  insert into public.clues (
    campaign_id,
    title,
    clue_type,
    context,
    x,
    y,
    created_by
  )

  values

    (
      target_campaign,
      'SANGUE',
      'PISTA',
      'Praça / condição do ritual',
      6,
      13,
      creator
    ),

    (
      target_campaign,
      'MEDO',
      'PISTA',
      'Atenção / amplificação',
      39,
      8,
      creator
    ),

    (
      target_campaign,
      'GRUPO',
      'PISTA',
      'Pessoas coordenadas',
      70,
      16,
      creator
    ),

    (
      target_campaign,
      'FRAGMENTOS',
      'PISTA',
      'Metal / ressonância',
      13,
      59,
      creator
    ),

    (
      target_campaign,
      'SINO ANTECIPADO',
      'ANOMALIA',
      'Registro acústico',
      45,
      49,
      creator
    ),

    (
      target_campaign,
      'QUINTO CÍRCULO',
      'PISTA',
      'Símbolos / ritual',
      72,
      58,
      creator
    ),

    (
      target_campaign,
      'SOMBRA SEM OBJETO',
      'MANIFESTAÇÃO',
      'Presença visual',
      37,
      78,
      creator
    );


  insert into public.objects (
    campaign_id,
    name,
    object_type,
    description,
    content,
    x,
    y
  )

  values

    (
      target_campaign,
      'RÁDIO',
      'ÁUDIO',
      'Um rádio que perdeu sinal por um segundo.',
      'O aparelho registra um ruído impossível de localizar.',
      8,
      7
    ),

    (
      target_campaign,
      'FRAGMENTO',
      'EVIDÊNCIA',
      'Peça de metal escuro sem ferrugem.',
      'Reage ao sangue e vibra perto de outro fragmento.',
      91,
      15
    ),

    (
      target_campaign,
      'CHAVE',
      'OBJETO',
      'Chave de ferro escuro.',
      'Há indícios de que abre uma porta associada à escola municipal.',
      87,
      80
    ),

    (
      target_campaign,
      'FOTOGRAFIA',
      'DOCUMENTO',
      'Fotografia de uma praça vazia.',
      'Três fotografias mostram círculos de sangue em locais diferentes.',
      7,
      82
    ),

    (
      target_campaign,
      'MAPA',
      'DOCUMENTO',
      'Mapa com cinco locais marcados.',
      'Praça Santa Cecília, Apartamento 18, Túnel ferroviário, Escola municipal e Torre sem nome.',
      91,
      57
    );

end;
$$;


-- ============================================================
-- UMA ÚNICA MESA
-- ============================================================

create or replace function public.enter_main_campaign(
  p_display_name text
)
returns table(
  campaign_id uuid,
  campaign_name text,
  campaign_code text
)
language plpgsql
security definer
set search_path = public
as $$

declare

  c_id uuid;
  c_name text;
  c_code text;

  u_id uuid :=
    auth.uid();

  clue_count integer;

begin


  if u_id is null then

    raise exception
      'AUTH_REQUIRED';

  end if;


  /*
    Primeiro procura a campanha oficial.
  */

  select

    id,
    name,
    code

  into

    c_id,
    c_name,
    c_code

  from public.campaigns

  where name =
    'O Som que Não Deveria Existir'

  order by created_at asc

  limit 1;


  /*
    Se ela não existir,
    usamos a primeira campanha existente.

    Isso evita perder uma mesa já criada
    anteriormente pelo sistema.
  */

  if c_id is null then

    select

      id,
      name,
      code

    into

      c_id,
      c_name,
      c_code

    from public.campaigns

    order by created_at asc

    limit 1;

  end if;


  /*
    Se não existir absolutamente nenhuma,
    cria a mesa única.
  */

  if c_id is null then

    c_name =
      'O Som que Não Deveria Existir';

    c_code =
      'PONTO03';


    insert into public.campaigns (
      name,
      code
    )

    values (
      c_name,
      c_code
    )

    returning

      id,
      name,
      code

    into

      c_id,
      c_name,
      c_code;

  end if;


  /*
    Coloca o usuário na mesa.
  */

  insert into public.players (
    user_id,
    campaign_id,
    display_name,
    role
  )

  values (

    u_id,

    c_id,

    coalesce(
      nullif(
        trim(
          p_display_name
        ),
        ''
      ),
      'Jogador'
    ),

    'player'

  )


  on conflict (
    user_id,
    campaign_id
  )

  do update set

    display_name =
      excluded.display_name;


  /*
    Confere se as pistas já existem.
  */

  select
    count(*)

  into
    clue_count

  from public.clues

  where campaign_id =
    c_id;


  /*
    Se a mesa estiver vazia,
    cria as informações iniciais.
  */

  if clue_count = 0 then

    perform public.seed_campaign(
      c_id,
      u_id
    );

  end if;


  /*
    Entrega ao navegador somente
    a identificação interna da mesa.
  */

  return query

  select

    c_id,
    c_name,
    c_code;

end;
$$;


-- ============================================================
-- PERMISSÕES
-- ============================================================

grant usage
on schema public
to anon, authenticated;


grant execute
on function public.enter_main_campaign(text)
to authenticated;


grant execute
on function public.is_campaign_member(uuid)
to authenticated;


grant select
on public.campaigns
to authenticated;


grant select,
      insert,
      update,
      delete
on public.players
to authenticated;


grant select,
      insert,
      update,
      delete
on public.clues
to authenticated;


grant select,
      insert,
      update,
      delete
on public.connections
to authenticated;


grant select,
      insert,
      update,
      delete
on public.objects
to authenticated;


grant select,
      insert,
      update,
      delete
on public.entity_notes
to authenticated;


-- ============================================================
-- REMOVE AS FUNÇÕES ANTIGAS DE MÚLTIPLAS MESAS
-- ============================================================

revoke execute
on function public.create_campaign(text, text)
from authenticated;


revoke execute
on function public.join_campaign(text, text)
from authenticated;


drop function if exists
public.create_campaign(text, text);


drop function if exists
public.join_campaign(text, text);


drop function if exists
public.make_campaign_code();


-- ============================================================
-- RLS
-- ============================================================

alter table public.campaigns
enable row level security;

alter table public.players
enable row level security;

alter table public.clues
enable row level security;

alter table public.connections
enable row level security;

alter table public.objects
enable row level security;

alter table public.entity_notes
enable row level security;


-- ============================================================
-- CAMPAIGNS
-- ============================================================

drop policy if exists
campaigns_member_select
on public.campaigns;


create policy
campaigns_member_select

on public.campaigns

for select
to authenticated

using (
  public.is_campaign_member(id)
);


-- ============================================================
-- PLAYERS
-- ============================================================

drop policy if exists
players_self_or_member
on public.players;


create policy
players_self_or_member

on public.players

for select
to authenticated

using (
  user_id = auth.uid()
  or
  public.is_campaign_member(campaign_id)
);


drop policy if exists
players_self_insert
on public.players;


create policy
players_self_insert

on public.players

for insert
to authenticated

with check (
  user_id = auth.uid()
);


drop policy if exists
players_self_update
on public.players;


create policy
players_self_update

on public.players

for update
to authenticated

using (
  user_id = auth.uid()
)

with check (
  user_id = auth.uid()
);


-- ============================================================
-- CLUES
-- ============================================================

drop policy if exists
clues_member_all
on public.clues;


create policy
clues_member_all

on public.clues

for all
to authenticated

using (
  public.is_campaign_member(
    campaign_id
  )
)

with check (
  public.is_campaign_member(
    campaign_id
  )
);


-- ============================================================
-- CONNECTIONS
-- ============================================================

drop policy if exists
connections_member_all
on public.connections;


create policy
connections_member_all

on public.connections

for all
to authenticated

using (
  public.is_campaign_member(
    campaign_id
  )
)

with check (
  public.is_campaign_member(
    campaign_id
  )
);


-- ============================================================
-- OBJECTS
-- ============================================================

drop policy if exists
objects_member_all
on public.objects;


create policy
objects_member_all

on public.objects

for all
to authenticated

using (
  public.is_campaign_member(
    campaign_id
  )
)

with check (
  public.is_campaign_member(
    campaign_id
  )
);


-- ============================================================
-- ENTITY NOTES
-- ============================================================

drop policy if exists
notes_member_all
on public.entity_notes;


create policy
notes_member_all

on public.entity_notes

for all
to authenticated

using (
  public.is_campaign_member(
    campaign_id
  )
)

with check (
  public.is_campaign_member(
    campaign_id
  )
  and
  user_id = auth.uid()
);


-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public
)

values (
  'campaign-assets',
  'campaign-assets',
  true
)

on conflict (id)
do nothing;


drop policy if exists
campaign_assets_read
on storage.objects;


create policy
campaign_assets_read

on storage.objects
for select

to authenticated

using (
  bucket_id =
    'campaign-assets'
);


drop policy if exists
campaign_assets_insert
on storage.objects;


create policy
campaign_assets_insert

on storage.objects
for insert

to authenticated

with check (
  bucket_id =
    'campaign-assets'
);


drop policy if exists
campaign_assets_update
on storage.objects;


create policy
campaign_assets_update

on storage.objects
for update

to authenticated

using (
  bucket_id =
    'campaign-assets'
)

with check (
  bucket_id =
    'campaign-assets'
);


drop policy if exists
campaign_assets_delete
on storage.objects;


create policy
campaign_assets_delete

on storage.objects
for delete

to authenticated

using (
  bucket_id =
    'campaign-assets'
);


-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin

  begin

    alter publication
      supabase_realtime
    add table
      public.clues;

  exception
    when duplicate_object
    then null;

  end;


  begin

    alter publication
      supabase_realtime
    add table
      public.connections;

  exception
    when duplicate_object
    then null;

  end;


  begin

    alter publication
      supabase_realtime
    add table
      public.objects;

  exception
    when duplicate_object
    then null;

  end;


  begin

    alter publication
      supabase_realtime
    add table
      public.entity_notes;

  exception
    when duplicate_object
    then null;

  end;

end;
$$;
