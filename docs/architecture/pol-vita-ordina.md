# POL-VITA-ORDINA — archivio su Drive diviso in cartelle e sottocartelle, nomi chiari, categorie precise

Richiesta del PO del 2026-11-22 (testo completo nel messaggio di avvio del task). Una PR per fase, merge solo su «Mergia».

**Eccezione esplicita del PO:** in questo task si possono spostare e rinominare file su Drive, ma **solo** eseguendo un piano approvato da Luca. Mai cancellazioni, mai svuotare il cestino. `clinico_pazienti` resta fuori: niente spostamenti, rinomine o AI.

**Prerequisito POL-VITA-RICERCA fase 1 (indice + testo estratto):** nel repository non esiste un task con questo nome. Il contenuto c'è già in master:
- testo completo di ogni file in `documenti_testo` (POL-VITA-034);
- ricerca anche per significato (POL-VITA-035);
- ricerca nel contenuto con Drive.

Copertura misurata al 2026-11-22: testo letto per il 95% dei file non clinici (sotto). Si considera soddisfatto. I 386 file senza testo si classificano dai metadati (oggetto email, mittente, nome) e finiscono più spesso in «99 Da verificare».

## Fase 1 — Diagnosi (2026-11-22, sola lettura)

### Fonti
- **Drive:** elenco completo di «Archivio personale» (id `1wKX…SfO2`) con la Drive API v3, solo metadati (`drive.metadata.readonly`, autorizzazione clasp data da Luca in sessione). 403 chiamate, 7.795 elementi.
- **Archivio Supabase `archivio-documenti`:** query di sola lettura su `documenti`, `documenti_testo` e `v_testo_avanzamento`.
- Nessuna modifica.

### Numeri

| | |
|---|---|
| Cartelle sotto «Archivio personale» | 397: 41 di primo livello, 356 di secondo; profondità massima 2 |
| File su Drive | 7.398, di cui 328 clinici (cartella «Clinico pazienti», fuori dal task) → **7.070 non clinici** |
| Scorciatoie | 0 |
| Documenti in archivio (non clinici) | 7.434: 7.217 con file e 217 schede email senza file |
| File registrati in archivio ma **fuori** da «Archivio personale» | 229 (soprattutto i file di Drive di Luca indicizzati come `drivefile:`), 6 clinici |
| File su Drive **non** registrati in archivio | 48: 47 in `_In elaborazione`, 1 in `Altro` |
| Testo estratto (non clinici) | letto 7.048 (95%; 6.797 con ≥ 200 caratteri), vuoto 78, errore 72, non leggibile 48, in coda 188 → **386 senza testo** |
| Catalogati solo a regole («da analizzare», nessun modello) | **3.861**, di cui 2.964 in `altro` |
| Duplicati certi (stesso `md5Checksum`, non clinici) | 10 gruppi, **60 copie in eccesso**: 46 copie dello stesso estratto conto in `_In elaborazione`, 6 della stessa carta d'identità in `Identità/2010` |
| Duplicati probabili (stesso testo, normalizzato, ≥ 300 caratteri) | 123 gruppi, 464 file, **341 copie in eccesso**, 312 con nome diverso |
| Cartelle vuote | 79: vecchie anno/mese `2008/…`–`2017/…`, `Caricati`, `Caricati/2026`, `Tua`, `Foto e video/2017, 2021, 2022, 2024`, `Identità/2013` |
| Nomi già nel formato `AAAA-MM-GG_Tipo_Soggetto_Dettaglio` | 17 (0,2%) |
| Nomi oltre 90 caratteri | 518 (il più lungo 136) |
| Nomi generici o copie numerate (`(2)`, `scan…`, `IMG_…`) | 127 |

### Albero attuale (file per cartella di primo livello, totale con le sottocartelle)

| File | Cartella | Note |
|---:|---|---|
| 3.494 | Altro | 19 sottocartelle anno; **il 49% di tutto**. Le più piene: `Altro/2022` 588, `Altro/2020` 588, `Altro/2018` 538, `Altro/2021` 481, `Altro/2019` 464, `Altro/2023` 433 |
| 431 | Studio - fornitori | `2013` 150 |
| 398 | Immobili e catasto | |
| 336 | Legale e contenziosi | `2025` 105, `2023` 86 |
| 328 | Clinico pazienti | fuori dal task |
| 315 | Pubblicità e offerte | |
| 279 | Foto e video | |
| 233 | Formazione e congressi | |
| 196 | Assicurazioni | |
| 184 | Fiscale e tasse | |
| 135 | Conti e banche | |
| 134 | Famiglia e scuola | |
| 121 | Utenze | |
| 115 | Studio - personale e candidature | |
| 111 | Acquisti | |
| 109 | Identità | |
| 99 | Abbonamenti e servizi | |
| 66 | Sanitario famiglia | |
| 59 | Veicoli | |
| 56 | _In elaborazione | 47 non registrati, 46 copie dello stesso PDF |
| 53 | Corrispondenza personale | |
| 32 | Studio - fatture emesse | |
| 28 | Previdenza ed ENPAM | |
| 28 | Persone | |
| 15 | Concordato e crisi – documenti ufficiali | |
| 15 | Successione | |
| 14 | Riscaldamento | |
| 11 | Sovraindebitamento – fascicolo OCC Cuneo | |
| 1+1 | Documenti firmati, file in radice | |
| 0–1 | 2008 … 2017, Caricati, Tua | vecchia struttura anno/mese, quasi tutta vuota |

### I 20 nomi peggiori (esempi)
Copie numerate e nomi senza contenuto:
- `2018-03-14_alice.it – barca (2).jpg`
- `2021-12-16_Redditi SC – Cledent Srl (3).pdf`
- `Pregnana-Milanese_modello-istanza-1 (1).docx`
- `2025-11-13_Foto sinistro 12-11-2025 (2).jpeg`
- `2022-03-18_Certificazione Unica 2022 (2).pdf`
- `2021-12-19_Rubrica contatti LL Medical (2).xlsx`
- `2021-04-21_Fattura FPR 288-21 – LL Medical (3).pdf`
- `2019-12-10_Messaggio Avv. Voltan – allegato (2).htm`
- `2017-12-29_Prestazioni medico – dicembre 2017 (2).xls`
- `account-statement_2023-06-01_2024-12-31_it_9fbe1d.pdf` (46 copie)
- `DICHIARAZIONE DA FIRMARE SU OGNI FOGLIO.pdf` (4 copie)
- `741.jpg`
- `Chi siamo 2.0.pdf`

In più ci sono 518 nomi oltre i 90 caratteri. Quasi tutti i nomi hanno già una data in testa (`AAAA-MM-GG_Titolo – Ente`), ma con spazi e trattini lunghi, non nel formato `Tipo_Soggetto_Dettaglio`.

### Cosa dice la diagnosi
1. Il problema principale è **«Altro» con 3.494 file (49%)**: sono documenti catalogati a regole quando i modelli erano in pausa e mai riletti.
2. Il testo per classificarli c'è già (95%).
3. I nomi vanno rifatti quasi tutti: 17 su 7.070 sono già conformi.
4. Duplicati certi pochi (60 copie); probabili 341, da far confermare a Luca.

## Stima dei costi per la fase 2 (classificazione)

Prezzi Claude Haiku 5.5 (listino Anthropic al 2026-11-03): $0,10 per milione di token in ingresso, $0,50 in uscita, Batch API −50%. Cambio considerato 1 $ ≈ 0,93 €.

| Scenario | Token | Costo |
|---|---|---|
| Una tantum, 7.070 file, estratto di ~6.000 caratteri + tassonomia (≈ 2.500 token in ingresso, ≈ 200 in uscita a file) | 17,7 M in ingresso, 1,4 M in uscita | standard ≈ $2,50; **con Batch API ≈ $1,25 ≈ 1,2 €** |
| Una tantum con il testo intero (media 9.500 caratteri) | ≈ 3.500 token a file | con Batch API ≈ 1,8 € |
| Mensile (fase 4), ~400 documenti nuovi al mese (ultimi 30 giorni: 418) | | **≈ 0,10 € al mese** |

**Avvertenza:** il credito Anthropic dello script risultava esaurito («credit balance is too low», nota DOCUMENTI-DRIVE). Per la Batch API va ricaricato. In alternativa, su richiesta di Luca («Fallo tu leggi e cataloga bene tutto»), la classificazione la fa Claude Code in sessione leggendo il testo già estratto: nessun costo API aggiuntivo, a lotti, scrivendo `piano_riordino`. I clinici restano esclusi in entrambi i casi.

## Fasi successive (dal messaggio del PO)
- **Fase 2:** tassonomia (`TASSONOMIA.md` + tabella `categorie`), elenco di persone, immobili, veicoli, banche e pratiche estratti dai documenti, da confermare. Poi classificazione in `piano_riordino` e schermata «Piano di riordino» su telefono. Stop per l'approvazione.
- **Fase 3:** esecuzione delle sole righe approvate, a lotti di 100, con `log_spostamenti` e «Annulla lotto».
- **Fase 4:** ordine automatico dei nuovi arrivi, `correzioni_classificazione`, controllo settimanale.

## Fase 2 — tassonomia, piano e schermata (2026-11-22)

Su indicazione di Luca («Fallo tu senza api») la classificazione l'ha fatta Claude Code in sessione: regole scritte leggendo titoli, enti e testo già estratto (500 caratteri a file), più una tabella di assegnazioni fatte a mano per gli enti ricorrenti. Nessuna chiamata a modelli, **costo 0 €**. I clinici (`clinico_pazienti`) sono esclusi.

- **Classificatore:** `poliedron/archivio/riordino/classifica.py`. Riproducibile, legge gli export in sola lettura e scrive il piano.
- **Tassonomia:** `poliedron/archivio/TASSONOMIA.md`, con gli elenchi di persone, immobili, banche, veicoli e pratiche da confermare. Tabella `categorie`: 520 cartelle, comprese quelle intermedie.
- **Piano:** tabella `piano_riordino` (migrazione `20261122150000_pol_vita_ordina_piano.sql`, già applicata). Contiene 7.070 righe con stato `proposto`. Il piano preparato sta su Drive di Luca come `poliedra-piano-riordino.json`, file privato nel Drive principale, fuori dall'Archivio. Lo copia in tabella l'azione `importa_piano` dello script, che scrive solo dati, non sposta niente e non sovrascrive mai le righe già decise.
- **Schermata:** Personale → «Riordino», oppure `?sezione=riordino`.
  - Le righe sono raggruppate per cartella di destinazione.
  - Toccando una riga si vedono il motivo e l'anteprima, con i tasti Approva / Cambia cartella (solo cartelle della tassonomia) / Rinomina (1–90 caratteri, senza caratteri vietati) / Rifiuta.
  - In blocco: «Approva tutto il gruppo» e «Approva tutto ≥ 0,85».
  - In giallo le righe con confidenza fra 0,60 e 0,85.
  - Ogni decisione ha «Annulla». **Approvare non sposta nulla.**

### Risultato del piano

| Cartella | File |
|---|---|
| 01 Identità e documenti | 69 |
| 02 Casa e catasto | 286 |
| 03 Successione | 11 |
| 04 Banche e conti | 121 |
| 05 Fisco e tasse | 583 |
| 06 Auto e veicoli | 192 |
| 07 Salute | 90 |
| 08 Famiglia e scuola | 437 |
| 09 Assicurazioni | 124 |
| 10 Utenze | 152 |
| 11 Legale e pratiche | 574 |
| 12 Lavoro e professione | 3.196 |
| 13 Acquisti e garanzie | 552 |
| 99 Da verificare | 683 (623 dubbi + 60 copie identiche) |

- **Confidenza:** 1.560 file a 0,85 o più; 4.887 fra 0,60 e 0,85; 623 sotto 0,60, che vanno in «99 Da verificare/Dubbi».
- **Cartelle di destinazione:** 358, con profondità massima di 4 livelli.
- **Scorciatoie:** 28, per esempio una polizza auto che compare anche nella cartella del veicolo.

### Criteri di accettazione (stato in fase 2)

| Criterio | Obiettivo | Stato |
|---|---|---|
| File non clinici nella tassonomia | 100% | 100% (7.070 su 7.070) |
| File in «99 Da verificare» | ≤ 5% | **9,7%, NON raggiunto** (8,8% dubbi + 0,8% copie). Scende con le decisioni di Luca e con le correzioni della fase 4 |
| Nomi conformi | ≥ 95% | 98,9% (i file Google senza estensione contano come conformi) |
| Corretti su un campione di 50 | ≥ 90% | da misurare: lo decide Luca dalla schermata. Dai campioni letti in sessione la stima è di circa l'80–85%, perché «12 Studio Cuneo» raccoglie ancora file di altre materie |
| Cancellazioni | 0; ogni lotto annullabile | 0 cancellazioni; nessuno spostamento in fase 2 |
| Albero Drive = albero app | 0 differenze | non applicabile finché non si esegue (fase 3) |
| Costo | — | 0 € (nessuna API) |

### Decisioni per Luca
1. **Cartelle nuove proposte**, non previste nell'elenco iniziale:
   - «12 Lavoro e professione/Società e progetti/…»: One Apple, Mall-e, Immobiliare La – L'Arabi, Centraline idroelettriche, Ridentemente, LL Medical, Tamponi e screening COVID, Storie per tessere, Fit and Go, Investimenti e cripto;
   - «06/Noleggi e car sharing», «06/Barca Sealine F37» e «06/Telepass»;
   - case non di proprietà in «02»: Milano via Boccaccio 14, Finale via Santuario 41, Cervasca San Defendente, Golfo Aranci, «Ricerca e progetti di case»;
   - sottocartelle per anno sotto «12/Studio Cuneo».
2. **Elenchi da confermare** in `TASSONOMIA.md`: persone dubbie, immobili dubbi e centraline.
3. **229 file dell'archivio fuori da «Archivio personale»:** non sono nel piano. Decidere se includerli.
4. **Documenti «Storie per tessere»:** sono documenti d'identità di persone accolte e restano in una cartella a sé.

### Revisione fatta da Claude Code (2026-11-22, Luca: «É un lavoro troppo lungo da fare, ho chiesto a te di farlo apposta»)
- Rilette a mano le cartelle grandi («12/Studio Cuneo», «05/…/Dichiarazioni», «08/Famiglia/Attività», «13 Acquisti», «11/Altre questioni legali», «12/Seminari e Docenza») e i 606 dubbi. Le correzioni ricorrenti sono regole nel classificatore (`CORREZIONI`, `DA_DUBBI`).
  - Cosa è stato spostato: assicurazioni, pignoramenti, causa Primo, multe, barca, studi universitari, passatempi, acquisti, One Apple, MOBE-E.
  - Le cartelle delle polizze sono una per compagnia, non una per polizza.
- 1.138 righe del piano sono state aggiornate nel database: 38 cartelle nuove e 1.078 destinazioni corrette. Dopo l'aggiornamento il conteggio per cartella coincide con il classificatore.
- **Approvate da Claude Code su delega di Luca:** 6.610 righe, cioè tutte quelle fuori da «99».
- **Restano da decidere:** 460 righe in «99 Da verificare».
  - 380 dubbi veri: titoli vuoti, allegati illeggibili e alcuni messaggi spam.
  - 60 copie identiche.
  - 20 «Possibili documenti clinici» (panoramiche, file STL, elenchi di pazienti): non si spostano, vanno nel fascicolo clinico per decisione di Luca.
- **Indicatori dopo la revisione:**
  - «99» = 6,5%, di cui 5,7% senza contare le copie identiche;
  - nomi conformi: 98,9%;
  - 347 cartelle di destinazione, al massimo 4 livelli;
  - confidenza: 1.789 righe a 0,85 o più, 4.881 fra 0,60 e 0,85.

### Revisione dei 380 dubbi (2026-11-25, Claude Code; Luca: «Sì, rivedi tu i 380 dubbi»)
- Letti uno per uno (titolo, mittente, oggetto, inizio del testo; mai file clinici aperti). Righe aggiornate in `piano_riordino` con `motivo = 'revisione dei dubbi (Claude Code, 2026-11-25)'`.
- Cartelle nuove in `categorie`: 01/Anna Simondi, 06/Multe, 06/Officine e riparazioni, 08/Famiglia/Assistenza anziani, 12/Letture e articoli, 12/Società e progetti/Proposte e opportunità, 99/Senza contenuto.
- Esito: 324 righe hanno una cartella vera; **233 approvate** (confidenza ≥ 0,70, su delega di Luca come nella revisione del 22/11), **91 proposte** (0,60–0,69, gialle in «Riordino», da confermare).
- Restano in «99», non si spostano: 30 «Senza contenuto» (scansioni vuote, file illeggibili, spam, file di collaudo), 20 nuovi «Possibili documenti clinici» (prescrizioni di laboratorio, referti, ricette e certificati di terzi; totale 40), 6 «Dubbi» (foto e deleghe di terzi senza contesto).
- Nessun file spostato o rinominato su Drive: lo spostamento parte da «Sposta i prossimi 100» nell'app (anche i 60 duplicati approvati).

## Fase 3 — esecuzione su Drive (2026-11-22)
- **Migrazione** `20261122200000_pol_vita_ordina_esecuzione.sql`, già applicata, additiva:
  - `cartelle_mie.categoria_id`: le cartelle della tassonomia sono cartelle dell'app con la loro gemella su Drive, quindi lo stesso albero 1:1;
  - `log_spostamenti`, una riga per file: cartella e nome di prima, cartelle dell'app di prima, scorciatoie create, esito;
  - vista `v_lotti_riordino`.
  - Sicurezza: RLS in sola lettura per il proprietario e REVOKE ad anon e PUBLIC; `get_advisors` non mostra problemi nuovi.
- **Script** (web app @31, pubblicata su «Pubblica» di Luca; si torna indietro ripubblicando la 30):
  - **`esegui_lotto`**: prende al massimo 100 righe `approvato` fuori da «99», in meno di 4,5 minuti.
    1. Scrive il registro prima di toccare il file.
    2. Sposta il file con `moveTo` nella cartella della tassonomia, che crea con i padri se manca.
    3. Gli dà il nome nuovo.
    4. Crea le scorciatoie Drive, mai copie.
    5. Fissa il documento (`drive_fissa`, `drive_rinomina = false`) e lo mette nella cartella dell'app, togliendolo dalle cartelle dell'app di prima.
    6. Segna la riga del piano `eseguito`.

    Se qualcosa si interrompe a metà, il file torna dov'era. Il fascicolo `clinico_pazienti` non si tocca mai.
  - **`annulla_lotto`**: rimette ogni file nella cartella e con il nome di prima, sposta nel Cestino solo le scorciatoie create dal lotto, ripristina documento e cartelle dell'app, e riporta la riga ad `approvato`.
- **App:** nella schermata «Riordino», il riquadro «Spostamento su Drive» ha il tasto «Sposta i prossimi 100» e l'elenco dei lotti, ciascuno con «Annulla lotto».
