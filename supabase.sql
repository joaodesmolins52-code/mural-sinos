create or replace function public.enter_main_campaign()
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
  u_id uuid := auth.uid();
begin

  if u_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;


  select
    id,
    name,
    code
  into
    c_id,
    c_name,
    c_code
  from public.campaigns
  where name = 'O Som que Não Deveria Existir'
  order by created_at asc
  limit 1;


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


  if c_id is null then

    c_name :=
      'O Som que Não Deveria Existir';

    c_code :=
      'PONTO03';


    insert into public.campaigns(
      name,
      code
    )
    values(
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


  insert into public.players(
    user_id,
    campaign_id,
    display_name,
    role
  )
  values(
    u_id,
    c_id,
    'Jogador',
    'player'
  )
  on conflict(
    user_id,
    campaign_id
  )
  do update set
    display_name = 'Jogador';


  if not exists(
    select 1
    from public.clues
    where campaign_id = c_id
  ) then

    perform public.seed_campaign(
      c_id,
      u_id
    );

  end if;


  return query
  select
    c_id,
    c_name,
    c_code;

end;
$$;

grant execute
on function public.enter_main_campaign()
to authenticated;
