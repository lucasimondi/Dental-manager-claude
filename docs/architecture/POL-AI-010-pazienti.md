# POL-AI-010 passo 2 — Pazienti e clinica da Poliedron

Stesso schema del passo 1 (`POL-AI-010-agenda.md`): il modello **prepara**, il server
costruisce dati canonici e riepilogo, l'utente conferma (pulsante o "sì"), una sola
transazione registra la conferma e scrive.

## Cosa si può fare scrivendo in chat

| Richiesta | Strumento | Scrittura (dopo conferma) |
|---|---|---|
| "Crea il paziente Anna Verdi, 333…" | `crea_paziente` | `patients` (id assegnato dal DB), avviso se il nome esiste già |
| "Il numero di Rossi è cambiato…", "Rossi ha dato il consenso WhatsApp" | `modifica_paziente` | solo i campi cambiati; controllo che la scheda non sia cambiata nel frattempo; data del consenso impostata/azzerata |
| "Annota sulla scheda di Rossi che…" | `aggiungi_nota_paziente` | nota aggiunta nel database (nessuna nota persa con scritture concorrenti), stesso formato dell'app |
| "Richiamo per l'igiene di Rossi a marzo" | `crea_richiamo` | `richiami` (origine `bot`, da fare), data futura |
| "Ricordami di chiamare il laboratorio" | `crea_promemoria` | `todos` (origine `poliedron`), facoltativamente legato al paziente |
| "Blocca l'agenda dal 1 al 15 agosto per ferie" | `crea_impegno_personale` | `impegni_personali` |
| "Com'è messo Rossi?" | `scheda_paziente` (lettura) | — |

Regole: ogni id deve venire da una lettura nella stessa richiesta (`cerca_pazienti`,
`appuntamenti`, `scheda_paziente`); il consenso WhatsApp solo se l'utente lo dice
esplicitamente; disponibili solo dove piano (`premium`) e autonomia permettono scritture.

## Migration `20261005120000_pol_ai_010_pazienti.sql`

- `poliedron_execute_pazienti_v1` (SECURITY INVOKER, RLS dell'utente, appartenenza
  attiva allo studio, anti-replay sulla stessa tabella del passo 1, validazioni ripetute
  nel database).
- **Correzione di un difetto in produzione**: `todos_origine_check` ammetteva solo
  `manuale`/`controllo_dati`; l'attività "Da WhatsApp" creata dall'assistente WhatsApp
  (POL-WA-003a, origine `whatsapp`) veniva rifiutata e il codice non lo segnalava. Ora
  ammessi anche `whatsapp` e `poliedron`.
- Contiene `DROP CONSTRAINT` (ricreato subito): in produzione va applicata a passi.

## Validazione

- Postgres 16 locale: catena passo 1 + fixture con colonne identity e vincoli di produzione
  + migration applicata due volte + `supabase/tests/pol_ai_010_pazienti.sql` PASS.
  Controllo negativo senza migration → FAIL (`todos_origine_check`).
- `tests/agentePazientiFlow.test.mjs` (handler reale, Supabase e Claude simulati): 5/5;
  controllo negativo senza il vincolo "paziente cercato prima" → FAIL.

## Rilascio (solo su "Mergia")

Dopo il passo 1: migration a passi → deploy `agente-assistente` (cartella con
`agenda.js`, `pazienti.js`, `confirmation.js`, `agendaSlots.js` + `_shared/agendaSlots.js`).
Rollback: ridistribuire la funzione del passo 1; `DROP FUNCTION poliedron_execute_pazienti_v1`.

## Passo 2b — esecuzione diretta (2026-10-05)

Su indicazione del Product Owner le scritture chiare e senza conflitti non chiedono più
conferma: il server valida, esegue con la stessa RPC atomica e risponde con il proprio
riepilogo ("Fatto. …"). Restano con riepilogo e conferma: possibile paziente doppione e
studi con autonomia "medio". Errori, ID non letti e orari occupati non scrivono nulla:
il modello chiede all'utente (con gli orari liberi reali, per l'agenda). Dettagli in
`supabase/functions/agente-assistente/README.md`.

## Passo 2c — annullati fuori dall'agenda, richiami "da rifissare", registro (2026-10-05)

Indicazioni del Product Owner: "Non rimane in agenda ma ci sarà traccia di attività
poliedron con elenco di tutto ciò che ha fatto", "quando non vengono rifissati vanno nei
richiami da fare", "Quando vengono rifissati va via dai non fissati quindi dai richiami".

- Agenda e liste del giorno della Dashboard non mostrano più gli appuntamenti annullati
  (qualunque origine). Restano nel database e nello storico.
- Migration `20261005170000_pol_ai_010_registro_annullati.sql`:
  - trigger `appointments_richiamo_annullato` (SECURITY INVOKER): annullamento di un
    appuntamento futuro senza altri appuntamenti futuri del paziente → richiamo
    `origine = 'annullamento'`, "Da rifissare: …", chiave `annullato:<id>`; nuovo
    appuntamento futuro (o annullamento revocato) → richiamo chiuso (`fatto`). Un errore del
    richiamo non blocca mai la scrittura in agenda. Recupero degli annullati futuri esistenti.
  - tabella `poliedron_attivita` (RLS: lettura membri attivi dello studio; inserimento solo
    dell'utente per un'azione da lui reclamata, FK su `poliedron_action_claims`; nessun
    update/delete).
  - `richiami` aggiunta alla pubblicazione realtime (l'app già la ascolta).
- Edge function: ogni azione eseguita (diretta o confermata) scrive la riga nel registro;
  le scritture di agenda restituiscono la riga scritta (`records`) così l'app la mostra
  subito, poi ricarica in background senza ritardare la risposta.
- Chat: pulsante "Attività di Poliedron" con l'elenco per giorno; Richiami e Attività
  mostrano l'etichetta "Da rifissare".
- **Ripristina** (PO: "Aggiungi ripristina"): `poliedron_ripristina_v1(p_attivita, p_studio)`,
  SECURITY INVOKER, una transazione, solo se il dato è ancora come l'ha lasciato Poliedron,
  senza mai cancellare: appuntamento creato → annullato (nessun richiamo "da rifissare");
  modificato/annullato → stato precedente (stessi controlli di disponibilità e data
  dell'agenda; il richiamo "da rifissare" si chiude); scheda paziente → valori precedenti;
  nota → tolta se è ancora l'ultima; richiamo creato → annullato; attività → fatta.
  Nuovo paziente e blocco agenda: si correggono nei loro moduli. Il ripristino è una
  nuova riga del registro (`ripristino_di`, indice unico: una sola volta).
- Validazione: SQL locale (catena completa + `supabase/tests/pol_ai_010_registro.sql`) PASS;
  `npm test` 902/902; build OK.
