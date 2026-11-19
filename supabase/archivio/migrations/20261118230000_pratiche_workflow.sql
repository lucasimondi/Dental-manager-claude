-- PRATICHE-WORKFLOW (PO 2026-11-18: "dobbiamo strutturare un workflow per lettura analisi creazione filo
-- temporale azioni da intraprendere ecc e farlo su tutte").
-- Solo aggiunte a pratiche_schede:
--  * tipo        causa / decreto_ingiuntivo / atp / esecuzione / recupero_crediti / contratto_fornitura /
--                immobile_edilizia / fisco / polizza / famiglia / altro (testo libero, nessun vincolo)
--  * parti       [{nome, ruolo}]  (ruolo: ricorrente, resistente, creditore, debitore, avvocato, giudice, CTU…)
--  * filo        filo temporale [{data, evento, chi, importo, rif, doc}] in ordine di data; doc = id documento
--  * mancanti    documenti che servirebbero e non sono in archivio [{cosa, perche}]
--  * stato_analisi  da_fare / letta / analizzata / verificata
--  * verificata_il  quando Luca ha confermato la scheda dall'app (RPC conferma_scheda)
-- Una scheda scritta di nuovo (script o Claude Code) torna «analizzata» e perde la conferma.

alter table pratiche_schede add column if not exists tipo text;
alter table pratiche_schede add column if not exists parti jsonb not null default '[]'::jsonb;
alter table pratiche_schede add column if not exists filo jsonb not null default '[]'::jsonb;
alter table pratiche_schede add column if not exists mancanti jsonb not null default '[]'::jsonb;
alter table pratiche_schede add column if not exists stato_analisi text not null default 'analizzata';
alter table pratiche_schede add column if not exists verificata_il timestamptz;

-- Luca conferma (o toglie la conferma a) una scheda dall'app: è l'unica scrittura permessa all'utente.
create or replace function conferma_scheda(p_pratica uuid, p_conferma boolean default true)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare quando timestamptz;
begin
  if not e_proprietario() then
    raise exception 'non autorizzato';
  end if;
  update pratiche_schede
     set verificata_il = case when p_conferma then now() else null end,
         stato_analisi = case when p_conferma then 'verificata' else 'analizzata' end
   where pratica_id = p_pratica
   returning verificata_il into quando;
  return quando;
end $$;
revoke all on function conferma_scheda(uuid, boolean) from public, anon;
grant execute on function conferma_scheda(uuid, boolean) to authenticated;
