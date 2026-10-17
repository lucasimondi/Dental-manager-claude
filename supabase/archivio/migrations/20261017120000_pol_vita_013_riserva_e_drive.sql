-- POL-VITA-013 — importazione senza Claude (catalogo provvisorio) e cartelle di Drive per categoria e persona.
-- Solo aggiunte, idempotente.

alter table documenti add column if not exists da_analizzare boolean not null default false;
alter table documenti add column if not exists drive_cartella text;
create index if not exists documenti_da_analizzare_idx on documenti (email_data desc) where da_analizzare;

-- Completa il catalogo di un documento importato senza Claude, con la stessa logica di
-- registra_documento (pratica, soggetti, scadenze). Mai dentro o fuori dal clinico; i caricati da
-- Luca tengono il fascicolo scelto (mantieni_fascicolo); il tag "portafoglio" resta.
create or replace function completa_analisi(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attuale text; v_pratica uuid; v_fasc text; v_urg text; v_tipo text; v_sog uuid; v_tag text[];
  v_azione boolean := (p->>'azione_richiesta') = 'true';
  s jsonb;
begin
  select fascicolo, pratica_id, tag into v_attuale, v_pratica, v_tag from documenti where id = p_id;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  if v_attuale = 'clinico_pazienti' then
    update documenti set da_analizzare = false where id = p_id;
    return jsonb_build_object('ok', true, 'fascicolo', v_attuale);
  end if;

  if (p->>'mantieni_fascicolo') = 'true' then
    v_fasc := v_attuale;
  else
    select codice into v_fasc from fascicoli where codice = p->>'fascicolo' and codice <> 'clinico_pazienti';
  end if;
  v_fasc := coalesce(v_fasc, v_attuale, 'altro');
  v_urg  := case when p->>'urgenza' in ('bassa','media','alta') then p->>'urgenza' end;

  if v_pratica is null then
    if coalesce(p->'pratica'->>'id_esistente','') ~ '^[0-9a-f-]{36}$' then
      select id into v_pratica from pratiche where id = (p->'pratica'->>'id_esistente')::uuid;
    end if;
    if v_pratica is null and coalesce(trim(p->'pratica'->>'nuova_titolo'),'') <> '' then
      insert into pratiche (titolo, fascicolo, urgenza)
      values (trim(p->'pratica'->>'nuova_titolo'), v_fasc, coalesce(v_urg,'media'))
      returning id into v_pratica;
    elsif v_pratica is not null then
      update pratiche set
        aggiornata_il = now(),
        urgenza = case when v_urg = 'alta' then 'alta' else urgenza end,
        stato   = case when stato in ('risolta','archiviata') and v_azione then 'aperta' else stato end
      where id = v_pratica;
    end if;
  end if;

  update documenti set
    fascicolo = v_fasc,
    tipo_documento = coalesce(nullif(p->>'tipo_documento',''), tipo_documento),
    titolo = coalesce(nullif(trim(p->>'titolo'),''), titolo),
    riassunto = coalesce(nullif(p->>'riassunto',''), riassunto),
    data_documento = coalesce(_data(p->>'data_documento'), data_documento),
    importo = coalesce(_num(p->>'importo'), importo),
    tag = (case when 'portafoglio' = any(coalesce(v_tag, '{}')) then array['portafoglio'] else '{}'::text[] end)
          || (case when jsonb_typeof(p->'tag') = 'array'
                   then array(select t from jsonb_array_elements_text(p->'tag') t where t <> 'portafoglio') else '{}'::text[] end),
    azione_richiesta = v_azione,
    azione_descrizione = nullif(p->>'azione_descrizione',''),
    urgenza = v_urg,
    analisi_contenuto = coalesce((p->>'analisi_contenuto') <> 'false', true),
    dati_estratti = case when jsonb_typeof(p->'dati_estratti') = 'object' then p->'dati_estratti' else dati_estratti end,
    pratica_id = v_pratica,
    da_analizzare = false
  where id = p_id;

  if jsonb_typeof(p->'soggetti') = 'array' then
    for s in select * from jsonb_array_elements(p->'soggetti') loop
      continue when coalesce(trim(s->>'nome'),'') = '';
      v_tipo := case when s->>'tipo' in ('persona','azienda','ente','professionista','banca')
                     then s->>'tipo' else 'altro' end;
      insert into soggetti (nome, tipo) values (trim(s->>'nome'), v_tipo)
        on conflict (nome_norm) do update set nome = soggetti.nome
        returning id into v_sog;
      insert into documenti_soggetti (documento_id, soggetto_id, ruolo)
        values (p_id, v_sog, s->>'ruolo') on conflict do nothing;
    end loop;
  end if;

  if jsonb_typeof(p->'scadenze') = 'array' and not exists (select 1 from scadenze where documento_id = p_id) then
    for s in select * from jsonb_array_elements(p->'scadenze') loop
      continue when _data(s->>'data') is null;
      insert into scadenze (documento_id, pratica_id, data, descrizione, importo)
      values (p_id, v_pratica, _data(s->>'data'),
              coalesce(nullif(s->>'descrizione',''),'Scadenza'), _num(s->>'importo'));
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'fascicolo', v_fasc, 'pratica_id', v_pratica);
end $$;

revoke execute on function completa_analisi(uuid, jsonb) from public, anon, authenticated;
grant  execute on function completa_analisi(uuid, jsonb) to service_role;
