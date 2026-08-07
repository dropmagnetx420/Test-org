-- =====================================================================
-- Ad banner dimensions.
--
-- Adsterra's invoke.js reads an `atOptions` global whose width/height must
-- match the dimensions of the unit created in their dashboard, otherwise
-- the slot is requested at the wrong size and never fills. There was
-- nowhere to record those numbers, so banners could not be served.
-- =====================================================================

alter table public.ad_placements
  add column if not exists width  smallint check (width between 1 and 2000),
  add column if not exists height smallint check (height between 1 and 2000);

-- Argument types are part of a function's identity, so adding parameters
-- would overload rather than replace, leaving PostgREST two candidates to
-- choose between. Drop the old signature first.
drop function if exists public.admin_set_ad_placement(
  ad_placement, ad_provider, ad_format, text, text, text, boolean
);

create or replace function public.admin_set_ad_placement(
  p_placement ad_placement,
  p_provider  ad_provider,
  p_format    ad_format,
  p_unit_id   text default null,
  p_script_url text default null,
  p_script_key text default null,
  p_is_active boolean default false,
  p_width     smallint default null,
  p_height    smallint default null
)
returns public.ad_placements
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.ad_placements%rowtype;
begin
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.ad_placements
    (placement, provider, format, unit_id, script_url, script_key, is_active, width, height)
  values
    (p_placement, p_provider, p_format, nullif(trim(p_unit_id), ''),
     nullif(trim(p_script_url), ''), nullif(trim(p_script_key), ''), p_is_active,
     p_width, p_height)
  on conflict (placement, provider, format) do update
     set unit_id    = excluded.unit_id,
         script_url = excluded.script_url,
         script_key = excluded.script_key,
         is_active  = excluded.is_active,
         width      = excluded.width,
         height     = excluded.height,
         updated_at = now()
  returning * into v_row;

  -- A placement renders one network at a time.
  if p_is_active then
    update public.ad_placements
       set is_active = false
     where placement = p_placement and id <> v_row.id;
  end if;

  insert into public.admin_logs (admin_id, action, entity_type, entity_id, after_data)
  values (v_uid, 'set_ad_placement', 'ad_placement', v_row.id,
          jsonb_build_object('placement', p_placement, 'provider', p_provider,
                             'active', p_is_active));

  return v_row;
end;
$$;
