# SCHEDA-PAZIENTE-ODONTOGRAMMA — Fase 0 (analisi, 2026-11-08)

Stato: **PRODUCT_OWNER_DECISION_REQUIRED**. Nessun codice modificato. La specifica chiede di procedere senza conferma solo se la mappatura è additiva; qui non lo è del tutto (servono migrazioni e tocca la semantica finanziaria), quindi mi fermo.

## 1. Premesse della specifica che non corrispondono al repository

| Specifica | Repository reale |
|---|---|
| Un unico file HTML con React inline | App React + Vite (`src/`, ~100 componenti), build `npm run build` |
| Dati in locale sul dispositivo (localStorage) | Supabase multi-studio con RLS: tabelle `patients`, `plans`, `payments`, `pricelist`, `appointments`, `preventivi` (`src/lib/supabase.js`, `TABLE_MAP`). localStorage è solo fallback/bozze di modulo |
| Deploy Netlify | `vercel.json` (produzione Vercel); `netlify.toml` presente ma non è il deploy citato nel Master Context |
| Backup `dental-manager-backup-AAAAMMGG.html` | Non applicabile: il backup è git. Golden rollback `stable/2026-08-27-full-recovery`; il rollback del codice è il revert della PR |
| Migrazione al primo avvio con `schemaVersion` in locale | I dati sono condivisi tra dispositivi e utenti dello studio: una migrazione lato client scriverebbe sul database di tutti. Le migrazioni vanno in `supabase/migrations/` con RLS e test (AGENTS.md) |

## 2. Dove sta ogni funzione

- Scheda paziente (produzione): `src/components/SchedaPaz.jsx` tramite `PatientWorkspaceBoundary.jsx`. Variante `PatientWorkspaceV2.jsx` dietro il flag di studio `feature_overrides.patientWorkspaceV2` (docs/patient-workspace-v2-rollout.md: «Clinical status writes … remain disabled»).
- Odontogramma: `src/components/Odontogramma.jsx` (FDI 18…28 / 48…38, tre varianti: piena, `compact`, `touchFriendly`) + `PatientDentalOverview.jsx` / `src/lib/patientDentalOverview.js` (vista denti della scheda).
- Inserimento prestazioni/preventivo dalla scheda: `PatientPlanEntry.jsx` + `src/lib/appointmentEntry.js` (`preparePatientEntry`), `src/lib/patientToothEntry.js` (una riga per dente / riga unica).
- Listino: `Listino.jsx`, tabella `pricelist` (`id, cat, cod, nome, prezzo, richiamo_mesi, durata_minuti`, + costi/materiali).
- Piani: `Piani.jsx`, `PianoDrillDown.jsx`, tabella `plans`.
- Preventivi (documenti): `Preventivi.jsx`, `src/lib/preventivi.js`, tabella `preventivi` (snapshot immutabile + PDF, numero univoco per studio).
- Pagamenti: `Pagamenti.jsx`, `IncassoModal.jsx`, `FinancialWorkspace.jsx`, tabella `payments`; saldo da RPC server `get_saldo_piano` / `get_saldi_aperti_studio`.
- Appuntamenti: `Agenda.jsx`, `QuickBookingModal.jsx`, `AppointmentWorkspace.jsx`.
- PDF: jsPDF, `src/lib/documenti/preventivoPdf.js`, `src/lib/pdfDocs.js`, visualizzazione `ui/PdfViewerModal.jsx`, condivisione `src/lib/condivisionePdf.js`.
- WhatsApp: `QuoteDeliveryActions.jsx` (preventivo), `PatientQuickActions.jsx` (chiama/WhatsApp), `WhatsApp.jsx`.

## 3. Schema dati attuale (rilevante)

- `patients`: `nome, cognome, tel, email, data_nascita, …, anamnesi_compilata_il, anamnesi_nota, anamnesi_allarme (bool), anamnesi_allarme_dettagli (jsonb[])`.
- `plans`: `paziente_id, titolo, data, stato ('attivo' | 'accettato' | 'rifiutato'; 'concluso' solo calcolato), sconto, sconto_tipo, scadenza_pagamento, ortodonzia, voci jsonb`.
- Voce (elemento di `plans.voci`): `{ prestazione, dente (stringa, es. "16" o "14, 15"), prezzo, eseguita (bool), dataEsec, incassata, richiamoData?, richiamoTipo? }`.
- `pricelist`: `cat, cod, nome, prezzo, richiamo_mesi, durata_minuti`.
- `preventivi`: snapshot immutabile `plan_snapshot` + `pdf_base64`, `numero`.
- Trigger e RPC server leggono `plans.voci[].eseguita` (prodotto, `pol_003b_live_sync_triggers`) e `plans.stato='accettato'` (gate «Da incassare», `pol_fin_007_accettazione_gate`).

## 4. Mappatura proposta e conflitti

| Nuovo campo | Mappatura proposta | Additiva? |
|---|---|---|
| Voce `denti[]` | nuovo campo nel jsonb `voci`; `dente` resta e viene scritto come oggi | sì, nessuna migrazione |
| Voce `superfici` | nuovo campo nel jsonb `voci` | sì |
| Voce `voceUnica` | nuovo campo nel jsonb `voci` | sì |
| Voce `dataEsecuzione` | **riusare `dataEsec` esistente** (già letto da diario, richiami, Poliedron) | sì |
| Voce `stato` proposta/accettata/eseguita | **conflitto**: «eseguita» = `eseguita:true` (fonte del prodotto lato server); «accettata» oggi è dello **piano** (`plans.stato`) e governa il «Da incassare». Uno stato per voce sarebbe una seconda fonte di verità finanziaria | **no — decisione PO** |
| Paziente `avvisi` | riusare `anamnesi_allarme` + `anamnesi_allarme_dettagli` (già mostrati in scheda) oppure nuova colonna testo | riuso: sì; colonna: migrazione |
| Paziente `bozza[]` | nuova colonna jsonb su `patients` (migrazione + RLS invariata) **oppure** un piano `stato='attivo'` per paziente usato come bozza (nessuna migrazione) | da decidere |
| Listino `rapida`, `generica`, `superfici` | tre colonne boolean su `pricelist` (migrazione additiva, default false) | migrazione — gate schema |
| «Da incassare € X = eseguite − pagamenti» | **conflitto**: formula già canonica lato server (con gate accettazione). AGENTS.md vieta di duplicare formule finanziarie: va mostrato il valore delle RPC esistenti | **no — decisione PO** |

## 5. Decisioni richieste al Product Owner

1. **Stato per voce.** (a) Proposta = voce non eseguita in piano `attivo`, Accettata = voce non eseguita in piano `accettato`, Eseguita = `eseguita:true` — il tap sul badge accetta il piano intero; oppure (b) nuovo `stato` per voce, con modifica dei trigger/RPC finanziari (POL-003, POL-FIN-007) per rispettarlo.
2. **«Da incassare» in intestazione**: usare il saldo server esistente (consigliato) invece della formula della specifica.
3. **Bozza**: colonna `patients.bozza` (migrazione) oppure piano `attivo` come bozza.
4. **Avvisi clinici**: riusare l'allarme anamnesi esistente oppure nuova colonna `patients.avvisi`.
5. **Flag listino** `rapida`/`generica`/`superfici`: autorizzare la migrazione additiva su `pricelist`.
6. **Quale scheda**: ridisegnare `SchedaPaz.jsx` (produzione) o `PatientWorkspaceV2` (dietro flag, rollback immediato — consigliato per una sostituzione UI così ampia).
7. **Colori**: ambra/blu/verde/viola fissi della specifica in deroga alla direzione DOCK-PER-TE passo 4 («verde come accento, colori distintivi solo per appuntamenti e stati») — compatibili, ma il viola diventa riservato alla selezione.
8. **Vincoli impossibili come scritti**: «unico file HTML», backup HTML, migrazione locale con `schemaVersion`: sostituiti da PR reversibile + migrazioni Supabase.

## 6. Proposta di piano dopo le decisioni (PR separate)

1. Odontogramma: selezione viola, colori di stato derivati dalle voci, legenda, scorciatoie Q1–Q4/Sup/Inf, riga stato + Azzera (solo UI, nessun dato).
2. Pannello prestazioni in pagina (superfici, categorie, Frequenti, ricerca, griglia multipla, destinazione, voce unica, riepilogo, Aggiungi) che scrive con `preparePatientEntry` esistente.
3. Bozza + badge stato + PDF/WhatsApp aggiornati con denti, superfici, stato.
4. Intestazione compatta, barra azioni, schede Panoramica/Diario/Preventivi/Pagamenti/Anagrafica.
5. Migrazione `pricelist` + Impostazioni → Listino.
