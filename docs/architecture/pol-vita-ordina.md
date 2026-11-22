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
