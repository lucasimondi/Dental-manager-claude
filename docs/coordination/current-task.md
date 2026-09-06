# Current task

- TASK: POL-AI-007 — Chat: creazione piano di cura + registrazione pagamento con pre-fill reale
- TITLE: stesso trattamento appena dato agli appuntamenti (POL-AI-006, PR #91, già mergiata) esteso a "creare piani, registrare pagamenti" — riconoscimento più naturale (non ancorato al primo verbo della frase, vocabolario più ampio di quello generico di intentEngine.js) + apertura del modulo reale già precompilato, mai una scrittura diretta.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim, dato dopo aver mostrato che l'appuntamento risultava già risolto da un'altra sessione: "Estendi a piani/pagamenti/prestazioni" — cioè il consiglio residuo già scritto nell'entry POL-AI-006 qui sotto: "dare a piani/pagamenti/prestazioni lo stesso trattamento appena fatto per gli appuntamenti").
- BRANCH: `claude/pagamenti-piano-docs-ma1v35`, da `master` (contiene già PR #91 — il branch locale designato per questo giro era rimasto indietro da prima di PR #82, azzerato su `origin/master` prima di iniziare: zero PR/commit persi, conteneva solo storia già mergiata).
- STATUS: IMPLEMENTATO, non ancora pushato — vedi EXACT NEXT ACTION.

- **Root cause (stessa classe del bug appuntamento, superficie diversa)**: anche quando una richiesta come "Crea un piano di cura per Mario Rossi" matchava già un verbo CREATE in `intentEngine.js`, il ramo generico di `poliedraCore.js` passava l'INTERA frase residua a `cercaPazienti()` — che richiede che OGNI token della query combaci col nome/CF/telefono del paziente (`ricercaPazienti.js`) — quindi una frase nominale iniziale come "piano di cura per" o "un pagamento di 100 euro a" faceva fallire la ricerca paziente per qualunque paziente reale, sempre. Stesso bug anche per "Registra un pagamento di 100€ a Mario Rossi" (verbo "registra" già riconosciuto da `UPDATE_VERBS`, stesso problema di ricerca). Anche nei rari casi in cui il paziente veniva comunque suggerito nella preview, confermare non lo passava mai al modulo reale: `quote.create`/`payment.create` in `actionRegistry.js` ignoravano completamente paziente/importo (`navigate: (ctx) => qa.run(ctx)`).
- **Nuovo modulo puro `src/lib/poliedron/planner/createIntent.js`**: `parseCreatePlanRequest(text)` e `parseRegisterPaymentRequest(text)` — stesso spirito di `appointmentIntent.js` (POL-AI-006): vocabolario chiuso ma NON ancorato al primo token (scansiona l'intera frase, non solo l'inizio come `intentEngine.js`), zero chiamate al Model Gateway, mai un'invenzione. Piano: riconosce un verbo (crea/apri/inizia/prepara/fai/nuovo/aggiungi) + il sostantivo "piano"/"preventivo" (con "piano di cura" trattato come un sostantivo unico, non spezzato). Pagamento: riconosce un verbo (registra/segna/inserisci/metti/incassa/crea/fai) + il sostantivo "pagamento"/"incasso"/"versamento", poi estrae un importo opzionale token-per-token (stesso stile di risoluzione data/ora di `appointmentIntent.js`, non un secondo `extractAmount` su testo libero — serve sapere esattamente quali token escludere dal riferimento paziente). Ciò che avanza (al netto di connettivi/token dell'importo) è il riferimento al paziente. Ritorna `null` (mai un tentativo) se manca verbo+sostantivo o se non resta alcun riferimento paziente.
- **`poliedraCore.js`**: due nuovi rami in `processQuery`, controllati subito dopo il ramo appuntamento (stessa architettura, stessa precedenza sui percorsi deterministici, prima di `classifyIntent`) — risolvono il paziente con `cercaPazienti` sul solo `patientText` estratto (non più l'intera frase) e ritornano un risultato `WORKFLOW` con `entities.patientCandidates`/`patientOptions` e, per il pagamento, `entities.amount` (stesso campo già letto genericamente da `PoliedronActionPreview.jsx` — zero modifiche a quel componente).
- **`actionRegistry.js`**: `quote.create`/`payment.create` estratti dalla mappa generica `CREATE_ACTION_MAP` (che continua a coprire patient/richiamo/spesa/documento senza pre-fill) in entry dedicate, stesso pattern di `appointment.create`. `quote.create.navigate` apre `ctx.openNewPlan(patient.id)` quando c'è un paziente, altrimenti ricade sulla stessa quick action "Nuovo preventivo" di sempre (mai un paziente inventato). `payment.create.navigate` apre `ctx.openNewPayment({patientId, amount})` quando c'è almeno paziente o importo, altrimenti stessa ricaduta sulla quick action "Pagamento" di sempre.
- **`App.jsx`/`Incassi.jsx`/`Poliedron.jsx`**: `openNewPlan` riusa `goNuovoPiano` già esistente (stesso meccanismo `initPatId` già usato da "Nuovo piano" nelle azioni rapide paziente — `Piani.jsx` non è stato toccato). Nuovo `goNuovoPagamento({patientId, amount})`: nuovo state `autoOpenNewPrefill` (solo per il target `'paga'`, `null` per ogni altro target/chiamante) che arriva fino a `Incassi.jsx`'s `openIncasso(prefill)` — già esistente e già capace di prefill (usato da PianoDrillDown/SchedaPaz), non una seconda implementazione. `IncassoModal` calcola già da sé `planAssignmentForPatient` una volta noto il paziente, quindi non serve risolvere il piano qui: se il paziente ha un solo piano attivo lo assegna da solo, se ne ha più d'uno mostra il selettore, esattamente come ogni altro punto d'ingresso di quel modale.
- **Non incluso in questo giro (residuo esplicito)**: "aggiungere prestazioni" via chat — a differenza di piano/pagamento, non esiste un singolo "modulo reale" da aprire pre-compilato per una prestazione isolata (va aggiunta dentro un piano esistente, con scelta di piano/dente/prezzo da listino); il percorso Level-2 con scrittura reale già esiste (`planTreatmentAndPayment` in `actionPlanner.js`+`actionExecutor.js`, es. "Rossi deve pagare 180€ per la devitalizzazione del 46") ma resta legato a un vocabolario formale esatto, non scopribile. Prossimo giro naturale se richiesto.
- VALIDATION: `npm test` 728/728 (nuovo `tests/poliedronPlanPaymentBooking.test.mjs`: parsing deterministico piano/pagamento con paziente pulito, `processQuery` end-to-end per entrambi, wiring `quote.create`/`payment.create` → `openNewPlan`/`openNewPayment` con fallback al blank quando manca paziente/importo, wiring App.jsx/Incassi.jsx; aggiornato `tests/poliedronAdaptive.test.mjs` per "registra pagamento 300 euro Rossi" — ora risolve un `WORKFLOW` con paziente trovato invece di un `UPDATE` con paziente mai cercato correttamente); `npm run build` pulito; `git diff --check` pulito. Nessuna migration — solo logica client.
- EXACT NEXT ACTION: push del branch, apertura PR, merge solo su istruzione esplicita del Product Owner.

---

- TASK: POL-AI-006 — Chat: navigazione verso altri moduli + booking appuntamento con pre-fill reale
- TITLE: (1) dalla pagina Chat Polyedron, un modo diretto per tornare a qualunque altro modulo consentito, non solo Home/Agenda/Pazienti dal dock mobile; (2) bug — "Fissa un appuntamento a ... domani alle ..." non funzionava affatto (fraintesa come ricerca generica): nuovo riconoscimento deterministico di verbo+paziente+data+ora che apre il modulo Nuovo appuntamento reale già precompilato, mai una scrittura diretta.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "Ok allora da chat devi comunque dare possibilità di tornare indietro ad altri moduli, inoltre per poliedron : deve essere in grado di segnare un appuntamento in agenda , creare piani , registrare pagamenti , aggiungere prestazioni , creare ricette senza perdite di tempo , ora ho provato con appuntamento ma non riesce risolvi").
- BRANCH: `feature/pol-ui-023-costo-orario-fix-poliedron-status` (stesso branch/PR #91, ancora non mergiata — continuiamo ad accumulare giri finché non arriva "mergiamo").
- STATUS: IMPLEMENTATO, non ancora pushato — vedi EXACT NEXT ACTION.

- **Root cause del bug appuntamento**: `intentEngine.js`'s `CREATE_VERBS` è ancorato a `^(?:crea|nuovo|nuova|aggiungi|inserisci|prepara)` — "fissa"/"prenota"/"metti" (i verbi più naturali per prenotare) non ci rientravano affatto, quindi "Fissa un appuntamento a Mario Rossi domani alle 15" finiva classificato come SEARCH generica invece che CREATE: nessuna azione possibile, solo una ricerca a vuoto. Anche quando l'azione `appointment.create` veniva raggiunta (es. "nuovo appuntamento Rossi"), apriva SEMPRE il modulo vuoto — nessun riconoscimento di data/ora esisteva nel codice, in nessun punto.
- **Nuovo modulo puro `src/lib/poliedron/planner/appointmentIntent.js`**: `parseAppointmentRequest(text, {now})` — stesso spirito di `commandParser.js`/`prescriptionWorkflow.js` (vocabolario chiuso, zero chiamate al Model Gateway, mai un'invenzione). Riconosce un verbo di prenotazione (fissa/prenota/metti/pianifica/programma/crea/segna/prendi/aggiungi/nuovo/nuova) + il sostantivo "appuntamento"/"prenotazione", poi estrae data (oggi/domani/dopodomani, giorno della settimana → prossima occorrenza, data esplicita gg/mm(/aaaa)) e ora ("alle HH", "alle HH:MM") dal resto del testo; ciò che avanza (al netto di connettivi) è il riferimento al paziente. Ritorna `null` (mai un tentativo) se manca il verbo+sostantivo o se non resta alcun riferimento paziente.
- **`poliedraCore.js`**: nuovo ramo in `processQuery`, controllato subito dopo il workflow Ricetta (stessa architettura, stesso ordine di precedenza sui percorsi deterministici) — se `parseAppointmentRequest` riconosce la richiesta, risolve il paziente con `cercaPazienti` (stessa funzione di ricerca già usata altrove, nessuna logica duplicata) e ritorna un risultato `WORKFLOW` con `entities.appointmentDate`/`appointmentTime` (valori risolti) e `appointmentDateText`/`appointmentTimeText` (le parole originali, per la preview).
- **`actionRegistry.js`**: `appointment.create` estratto dalla mappa generica `CREATE_ACTION_MAP` (che continua a coprire patient/quote/payment/recall/expense/document senza pre-fill) in una entry dedicata — il suo `navigate(ctx, patient, payload)` ora passa `{patientId, data, ora}` al quick action `nuovo_appuntamento`, che a sua volta li inoltra a `ctx.openBooking(payload)`. Resta `riskLevel: 1`: apre il modulo `QuickBookingModal` reale già compilato, l'utente sceglie comunque lo slot (tra quelli VERAMENTE liberi, calcolati da `computeFreeSlots` come sempre) e clicca "Conferma appuntamento" — Poliedron non scrive mai direttamente in agenda.
- **`quickActionsCatalog.js`/`Poliedron.jsx`/`App.jsx`/`QuickBookingModal.jsx`**: la catena di pass-through del payload è stata sistemata end-to-end (prima si perdeva a metà strada: `Poliedron.jsx`'s `navCtx.openBooking` ignorava qualunque argomento, e il flusso di conferma passava sempre e solo `{drug}`). `QuickBookingModal` accetta ora `initialData`/`initialOra` oltre al preesistente `initialPazienteId`; se lo slot richiesto non è realmente libero, l'effetto di riconciliazione già esistente lo scarta e seleziona il primo slot libero reale — mai una prenotazione in conflitto proposta silenziosamente.
- **`PoliedronActionPreview.jsx`**: la preview di conferma ora mostra Data/Ora richiesta per `appointment.create` (prima mostrava solo "Paziente"/"Stato: Bozza da verificare", indistinguibile da qualunque altra creazione), con lo stesso testo di garanzia già usato per la Ricetta ("verifica lo slot proposto e conferma tu stesso").
- **Chat — navigazione verso altri moduli**: `PoliedronChatPage.jsx` ha ora un selettore nell'header (`navItems`/`onNavigate`, stesso pattern dropdown già visto in questa sessione) che porta direttamente a qualunque voce di `NAVIGATION_INDEX` consentita (già filtrata per permessi da `Poliedron.jsx`, stessa lista usata per la ricerca/navigazione — nessun secondo elenco). Prima, da Chat, l'unico modo di uscire era il dock mobile a 3 destinazioni fisse (Home/Agenda/Pazienti) o aprire il pannello Poliedron; ora c'è un'uscita diretta e sempre visibile verso qualunque sezione, sia mobile che desktop (dove la sidebar è comunque già presente).
- **Consigli residui per i prossimi giri** (dichiarati esplicitamente, non implementati qui): "creare piani, registrare pagamenti, aggiungere prestazioni" via chat ESISTONO GIÀ come scritture dirette reali (`planner/actionPlanner.js`+`planner/actionExecutor.js`, es. "Rossi deve pagare 180€ per la devitalizzazione del 46", "Crea piano di cura per Mario Rossi con otturazione su 26") ma solo con frasi ESATTE di un vocabolario formale mai mostrato all'utente in UI — praticamente non scopribili nell'uso reale. "Creare ricette" apre già il modulo Ricetta precompilato (livello 1, come l'appuntamento ora). Un prossimo giro naturale: dare a piani/pagamenti/prestazioni lo stesso trattamento appena fatto per gli appuntamenti (riconoscimento più naturale + pre-fill del modulo reale), e valutare se collegare il "Livello di autonomia" già presente in Impostazioni (oggi solo UI, `set_agente_azione`, nessun consumer nel codice) per permettere esecuzione diretta "su richiesta" senza conferma aggiuntiva.
- VALIDATION: `npm test` 719/719 (nuovo `tests/poliedronAppointmentBooking.test.mjs`: parsing deterministico date/ora, `processQuery` end-to-end, pre-fill del payload verso `openBooking`, wiring `QuickBookingModal`/`App.jsx`, navigazione Chat; aggiornati `tests/poliedron.test.mjs` e `tests/poliedronAdaptive.test.mjs` per la nuova firma di `openBooking`/il nuovo esito WORKFLOW di "nuovo appuntamento Rossi domani alle 10"); `npm run build` pulito; `git diff --check` pulito. Nessuna migration.
- EXACT NEXT ACTION: push sullo stesso branch/PR #91 (aggiornare la descrizione), merge solo su istruzione esplicita.

---

- TASK: POL-UI-025 — Pagina dedicata "Poliedron" (Salute dati, Consigli, Da chiarire, Chat)
- TITLE: i tre widget Poliedron in Home (Consigli Poliedron, Controllo dati, Salute dati gestionale) rimossi dal registro widget e riorganizzati in una nuova pagina di primo livello con sidebar/dropdown (stesso pattern di Controllo di gestione), lasciando su Home solo una card teaser fissa che rimanda alla nuova pagina.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "La sezione poliedron va bene ma deve essere aperta in una sezione dedicata, perché in home poi scorrere così va bene ma troppo incasinato quindi va bene scorrere ma crea una sezione apposita, dammi consigli su come fare, magari una sezione di poliedron dedicata alla salute dei dati, in cui metteremo altre cose cosa dici? Proprio come se fosse una riunione con il nostro manager poliedron, in cui ci sono i punti da chiarire e i consigli" — poi, dopo la proposta discussa insieme: "Sì confermo").
- BRANCH: `feature/pol-ui-023-costo-orario-fix-poliedron-status` (stesso branch/PR #91, ancora non mergiata — più giri confluiscono in un'unica PR finché non arriva "mergiamo").
- STATUS: IMPLEMENTATO, non ancora pushato — vedi EXACT NEXT ACTION.

- **Nuova pagina "Poliedron"**: voce di navigazione propria (`NAV`, icona `compass`, aggiunta anche a `DEF_DOCK_SETTINGS.menuItems` per il dock mobile), componente `src/components/PoliedronHub.jsx` con lo stesso pattern sidebar (desktop)/dropdown (mobile) già usato da `ControlloGestione.jsx` — stesse classi CSS `management-*`, nessuno stile nuovo. Quattro sezioni:
  - **Salute dati** (default): il punteggio 0-100% (ex widget `poliedron_health_score`) con dettaglio per controllo cliccabile, più "Altri avvisi" per i due segnali di `dataHealthActivities.js` non ancora rappresentati come check del punteggio (trattamento fermo, appuntamento di ieri non segnato — ex widget `poliedron_status`, filtrati sui soli kind non duplicati con i check del punteggio).
  - **Consigli**: i Consigli Poliedron (business/CFO/marketing) spostati qui da Home, stesso carosello mobile "una card alla volta" di prima.
  - **Da chiarire**: le bollette segnalate anomale da `BOLLETTE_QUALITA` (con data/importo/media storica, non solo il conteggio) — primo caso reale di "punto da chiarire", con nota che altri se ne aggiungeranno in futuro.
  - **Chat**: non una vera sezione — porta alla pagina Chat Poliedron già esistente.
- **`src/lib/poliedron/useConsigli.js`** (nuovo hook): logica di fetch/stato dei Consigli Poliedron estratta da Dashboard.jsx — necessario perché un widget non può "seguire" una pagina quando l'utente naviga altrove (React smonta Dashboard), quindi la logica va condivisa via hook (usato sia da PoliedronHub per il rendering pieno, sia — se in futuro servisse ancora un segnale su Home — da qualunque altro punto) invece che duplicata a mano.
- **`dataHealthScore.js`**: il check `BOLLETTE_QUALITA` ora espone anche `anomalies` (data/importo/mediana di ogni bolletta fuori soglia), non solo il conteggio — necessario per la sezione "Da chiarire".
- **Home (Dashboard.jsx)**: i tre widget rimossi dal registro (`homeWidgetRegistry.js`) — rimozione sicura per i layout già salvati (`normalizeHomeLayout` scarta già gli id sconosciuti, comportamento testato fin dal primo test del file). Al loro posto, una card fissa "Poliedron" (page chrome come "Richiede attenzione", non un widget riordinabile/nascondibile) che mostra la percentuale live e porta alla nuova pagina con un click. Dashboard continua a calcolare `dataHealthFindings`/`dataHealthScore` (serve alla card e al job in background che genera le Attività/la notifica in chat) ma non renderizza più il dettaglio completo. Rimossa la riga "consigli non letti" dalla sezione "Richiede attenzione" (Consigli non vive più su Home — `buildHomeAttentionItems` non è stato toccato, semplicemente Dashboard non passa più `unreadAdvice`).
- VALIDATION: `npm test` 713/713 (nuovo `tests/poliedronHub.test.mjs`, sostituisce i due file di test dei vecchi widget Home ormai rimossi; aggiornati 6 file di test esistenti per riflettere la rimozione dei 3 widget dal registro); `npm run build` pulito (nuovo chunk `PoliedronHub` correttamente code-splittato); `git diff --check` pulito. Nessuna migration.
- EXACT NEXT ACTION: push sullo stesso branch/PR #91 (aggiornare la descrizione), merge solo su istruzione esplicita.

---

- TASK: POL-UI-024 — Widget "Salute dati gestionale" con percentuale in Home
- TITLE: nuovo widget Poliedron in Dashboard che calcola un punteggio 0-100% sulla completezza/qualità dei dati dello studio (anagrafica, anamnesi, documento privacy, piani iniziati/decisi, pagamenti in regola, passaporto implantare, spese aggiornate/bollette/condominio/assicurazione), cliccabile per il dettaglio per controllo con elenco pazienti.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "In Dashboard crea widget che dica la salute dei dati gestionale (deve avere una percentuale) e questo viene controllato da poliedron che scannerizza tutti i dati mancanti dei pazienti: anagrafica numero telefono indirizzo codice fiscale mail, inoltre se hanno un piano cura, se sono iniziati i piani e pagamenti, se hanno anamnesi e un doc privacy, se vengono compilati bene i dati prestazioni incassi se hanno fatto impianti bisogna aver compilato il modulo impianti con passaporto imolantare, se è stata caricata panoramica. Se le spese sono aggiornate, i registri pagamenti anche, se ci sono problemi ad incassare in tempo se carichiamo i dati bollette corretti e non a caso, spese condominiali se assicurazione annuale iniziamo così poi se hai dei consigli su scan dimmi").
- BRANCH: `feature/pol-ui-023-costo-orario-fix-poliedron-status` (stesso branch/PR #91, ancora non mergiata — stesso pattern già usato per PR #89: più giri non mergiati confluiscono in un'unica PR).
- STATUS: IMPLEMENTATO, non ancora pushato — vedi EXACT NEXT ACTION.

- **Investigazione preliminare** (per capire cosa fosse già tracciabile senza inventare schema nuovo): verificate le colonne reali di `documenti_medici` (`tipo` è `text` libero, nessun CHECK constraint — si possono aggiungere nuovi tipi documento lato client senza migration) e le categorie spesa esistenti in `CATEGORIE_SPESA` (`src/lib/utils.js`) — **'Condominio'**, **'Assicurazioni'** e **'Utenze'** esistevano già come categorie, rendendo i controlli "spese condominiali/assicurazione annuale/bollette" realizzabili subito via presenza+recency invece che richiedere nuove categorie. Il modulo impianti (`implants`: marca/modello/lotto) di fatto È GIÀ il "passaporto implantare" richiesto — nessun campo nuovo necessario per quel controllo.
- **Nuovo modulo puro `src/lib/domain/dataHealthScore.js`**: `computeDataHealthScore(...)` — 7 controlli per-paziente (scope: pazienti con ≥1 piano, stesso precedente di `dataHealthActivities.js`) + 4 controlli studio (spese aggiornate/bollette/condominio/assicurazione, presenza+recency, attivi solo se `financialDataAvailable`). Riusa `dataHealthFindings` (già calcolato per il widget `poliedron_status` del giro precedente) per i controlli anamnesi/piano iniziato/piano deciso — nessuna riscrittura della logica "cosa conta come problema". Percentuale = media dei pass-rate dei soli controlli applicabili (un controllo con zero soggetti idonei, es. nessun paziente con impianti, viene escluso dalla media, non contato pass né fail).
- **Dashboard.jsx**: nuovo fetch minimo `documenti_medici` (`select('paziente_id, tipo')` — mai il `pdf_base64`, enorme e qui inutile); nuovo prop `implants` (già in memoria in App.jsx, zero fetch aggiuntivo); riusa `spese`/`scadenzeScadute` già calcolati da `useControlloDati` per questa stessa pagina. I 4 controlli spesa-based si escludono dal punteggio (non contano come falliti) per chi non ha il permesso `management_control` — coerente con dove `spese` stesso è già gated in quell'hook.
- **Nuovo widget Home `poliedron_health_score`** ("Poliedron — Salute dati gestionale"): percentuale grande + etichetta di stato colorata (Ottima/Da migliorare/Critica) + barra di progresso; cliccabile per espandere il dettaglio per controllo, ogni controllo per-paziente ulteriormente cliccabile per vedere/aprire i pazienti mancanti nel tab giusto della scheda (privacy → tab doc, impianti → tab impl, pagamenti → tab paga, ecc.).
- **Follow-up stesso giorno — Product Owner: "Su quella classifica va bene"** (approvazione della logica proposta per "bollette caricate corrette e non a caso"): aggiunto un dodicesimo controllo, `BOLLETTE_QUALITA` ("Importi bollette coerenti con lo storico"). Confronta ogni spesa categoria 'Utenze', in ordine cronologico, con la MEDIANA (non la media, che un singolo importo digitato a caso sposterebbe subito) delle bollette precedenti dello stesso studio — richiede almeno 3 bollette precedenti per un confronto significativo (altrimenti quella riga non viene valutata), scarto oltre il 50% dalla mediana = probabile errore di inserimento. Controllo studio (`financialDataAvailable`), `applicable` solo se almeno una riga aveva abbastanza storico da poter essere valutata. Dashboard.jsx: la card del dettaglio ora mostra un conteggio (`N/M`) invece di un semplice OK/Da sistemare per qualunque controllo non binario (non solo per questo).
- **Consigli residui per i prossimi giri**: "panoramica caricata" per chi ha impianti resta non implementabile senza una piccola aggiunta di prodotto — serve poter etichettare un documento come tipo "panoramica" in fase di caricamento (oggi nessuna UI lo distingue da un esame generico). Resta valido anche il suggerimento sui pesi dei controlli personalizzabili (oggi tutti pesati uguale nella media).
- VALIDATION: `npm test` 716/716 (nuovi test per `BOLLETTE_QUALITA` in `tests/dataHealthScore.test.mjs`: soglia minima di storico rispettata, scostamento dalla mediana rilevato correttamente, non applicabile quando manca storico); `npm run build` pulito; `git diff --check` pulito. Nessuna migration.
- EXACT NEXT ACTION: push sul branch/PR #91 esistente (aggiornandone la descrizione), merge solo su istruzione esplicita del Product Owner.

---

- TASK: POL-UI-023 — Fix crash "Ore" in Costi + nuova sezione Poliedron cliccabile in Home
- TITLE: due richieste nello stesso messaggio: (1) bug — cliccando "Ore" nella card Costo orario dello studio, l'app si blocca/non carica; (2) nuova feature — una sezione Poliedron in Dashboard, cliccabile, che riassuma tutte le info/i dati mancanti rilevati automaticamente.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "Quando clicco su costi (ore) non. Carica, inoltre in a Dashboard dobbiamo inserire sezione poliedron cliccabile , deve essere quindi una sezione in cui ci dà tutte le info , quindi dati mancanti , ecc").
- BRANCH: `feature/pol-ui-023-costo-orario-fix-poliedron-status`, da `master` (contiene già PR #90).
- STATUS: IMPLEMENTATO, pushato, **PR #91 aperta** (https://github.com/lucasimondi/Dental-manager-claude/pull/91), ancora aperta — vedi entry POL-UI-024 sopra per il seguito sullo stesso branch/PR.

- **1) BUG — "Ore" non caricava**: `CostoOrarioCard` (in `Costi.jsx`) referenziava `labelPostazioni` dentro il modale di modifica ore, ma quella variabile è definita SOLO nel componente genitore `Costi()`, mai passata come prop — `ReferenceError: labelPostazioni is not defined` ad ogni click su "Ore", in ogni studio, da sempre (bug pre-esistente, non introdotto da POL-UI-022 — quel giro ha solo reso la card raggiungibile da un secondo percorso più visibile, facendo scoprire il problema). Verificato a livello DB (`get_costo_orario` in produzione restituisce dati validi — il problema non era la RPC) prima di concludere che fosse un bug lato client. Fix: `labelPostazioni` ora passato come prop da `Costi` a `CostoOrarioCard`.
- **2) Nuova sezione Poliedron cliccabile in Home**: nuovo widget Home `poliedron_status` ("Poliedron — Controllo dati"), distinto da "Consigli Poliedron" (consigli di business) e da "Attività" (todo manuali+auto, lista piatta). Calcola `dataHealthFindings` LIVE con `buildDataHealthActivities` (stesso selettore puro già usato per generare le Attività/la notifica in chat — riusato, non duplicato) invece di leggere dai `todos` già salvati, quindi resta sempre accurato anche se un'Attività correlata è stata segnata fatta/cancellata pur restando un problema reale. Stato vuoto: riga verde "Nessun dato mancante da controllare". Con findings: tasto/riga cliccabile che espande/comprime gruppi per tipo (Anamnesi mancante, Piano da accettare/rifiutare, Piano mai iniziato, Trattamento fermo, Appuntamento di ieri non segnato), ogni paziente elencato è cliccabile e apre la sua scheda nel tab giusto (anamnesi → tab `clinical`, tutto il resto → tab `piani`). `KIND_LABEL` estratto a costante di modulo condivisa (`DATA_HEALTH_KIND_LABEL`) così la notifica in chat e la nuova sezione non possono mai raccontare il problema in due modi diversi.
- VALIDATION: `npm test` 700/700 (nuovi: `tests/costoOrarioCard.test.mjs` per il fix del crash, `tests/poliedronStatusWidget.test.mjs` per la nuova sezione; aggiornati `tests/homeWidgetRegistry.test.mjs`/`tests/mobileHomeRound2.test.mjs` per il nuovo id widget nell'ordine registry); `npm run build` pulito; `git diff --check` pulito. Nessuna migration — solo componenti client.
- EXACT NEXT ACTION: push del branch, apertura PR automatica con link dato subito (istruzione permanente del Product Owner), merge solo su istruzione esplicita.

---

- TASK: POL-UI-022 — Costo orario: sblocco click-through verso la scheda modificabile
- TITLE: il tasto "Costo orario struttura" nel Pannello economico (Controllo di gestione → Panoramica) era disabilitato finché il dato canonico non era ancora calcolabile, e anche quando abilitato portava alla sezione sbagliata — mai raggiungibile la scheda dove si compila e si vede il collegamento a spese/personale/macchinari.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "Costo orario : bisogna che sia cliccabile che è che quindi sia modificabile , con i vari parametri da completare e collegamento a spese").
- BRANCH: `feature/pol-ui-022-costo-orario-cliccabile`, da `master` (contiene già PR #89).
- STATUS: MERGED — PR #90, merge commit `03fe68754fe7e51804a2c96b373d0e58c114db4e`, su esplicita istruzione del Product Owner ("Mergia su pr").

- **Causa radice, due bug distinti nello stesso percorso**:
  1. `CanonicalManagementView.jsx` — il tasto drill-down di ogni metrica canonica è `disabled` finché `item.available` è `false` (tranne "Prodotto", unico caso già gestito con `canExplainUnavailable`). `costo_orario_struttura` (da `get_financial_snapshot_v1`) è `NULL`/non disponibile finché `ore_disponibili` (agenda live) è zero per il periodo — cioè esattamente nei casi in cui lo studio deve ancora completare la configurazione. Risultato: il pulsante che porterebbe a completarla era disabilitato proprio quando serviva di più.
  2. `ControlloGestione.jsx`'s `openDrillDown` instradava per sottostringa (`field?.includes('costi')`) verso la sezione Costi — ma il sourceField reale è `costo_orario_struttura`, che contiene "costo" (con la o), non "costi" (con la i): la sottostringa non combaciava mai, quindi anche i rari click quando il tasto era abilitato finivano nella sezione Cockpit invece che in Costi.
- **Fix**: (1) `canExplainUnavailable` ora include anche `item.id === 'costo_orario_struttura'`, quindi il tasto resta sempre cliccabile. (2) `openDrillDown` ora instrada esplicitamente `field === 'costo_orario_struttura'` verso la sezione `costi`, oltre al match per sottostringa già esistente.
- **Destinazione già pronta, non toccata**: `Costi.jsx`'s `CostoOrarioCard` (sempre in cima alla sezione Costi) mostra già "Costi struttura/Personale/Macchinari" (letti da spese/personale/macchinari — il "collegamento a spese" richiesto) ed è già modificabile via il tasto "Ore" (giorni di apertura/ore al giorno/numero poltrone — "i vari parametri da completare"). Verificato via `get_costo_orario` (RPC in produzione): restituisce sempre un oggetto completo con default sensati anche a configurazione vuota, quindi la card non è mai vuota/bloccata una volta raggiunta.
- VALIDATION: `npm test` 693/693 (2 nuovi/aggiornati test in `tests/prodottoReconciliation.test.mjs`: `canExplainUnavailable` esteso, routing esplicito verso `costi`); `npm run build` pulito; `git diff --check` pulito. Nessuna migration — solo logica di routing/gating lato client, RPC esistenti verificate ma non modificate.
- EXACT NEXT ACTION: Product Owner verifica in produzione (Vercel farà il deploy automatico da questo merge).

---

- TASK: POL-UI-021 — Tab Info come landing page scrollabile + link Vercel persistente
- TITLE: link di anteprima Vercel salvato in un doc recuperabile; tab Info della scheda paziente riorganizzato come pagina scrollabile con sezioni a comparsa, telefono/statistiche header ridisegnati.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "Dati cheè sempre lo stesso link possiamo metterlo da qualche parte che sia recuperabile sempre? Inoltre la scheda paziente nel mobile deve essere scrollabile come una landing page, sulla landing page in ordine devono esserci anagrafica ma cliccabile non sempre a vista, il numero di telefono paziente deve essere sotto il nome in header (togli il modulo chiama e whatsapp, ci sono già in header), poi le azioni rapide, quindi deve esserci una finestra anamnesi in cui si denoti un riassunto (se non c'è anamsnei segnalerà di eseguire anamnesi, se c'è e non c'è nulla di noto per complicanze ci sarà una scritta in verde che dirà nessuna problematica da evidenziare, se invece c'è da segnalare la scritta sarà rossa e dirà quale sia il problema, patologia, farmaci ecc), poi ci sarà piani sempre a comparsa, poi ci sarà pagamenti sempre a comparsa, poi ci sarà prossimo appuntamento (se non c'è nessun appuntamento segnalerà nessun appuntamento), poi foto sempre a comparsa, mantieni comunque il menù a tendina. In header le parti da pagare/pagato devono essere cliccabili e portare alla sezione giusta. Le sezioni in pagina info devono essere le stesse delle pagine corrispondenti").
- BRANCH: `feature/pol-fin-007e-incasso-dock-tab` (stesso branch, continuato).
- STATUS: MERGED — PR #89, merge commit `ae4bf3ae443fd609a55bd41b52aeb63840c6b68a`, su esplicita istruzione del Product Owner ("Mergia master").

- **0) Link Vercel persistente**: nuovo `docs/coordination/preview-links.md` — il branch alias Vercel è già stabile per branch (stesso URL ad ogni push, punta sempre all'ultimo deploy), il problema era solo che non era scritto da nessuna parte recuperabile senza richiederlo di nuovo. Aggiornare quel file quando cambia il branch attivo.
- **1) Header — telefono sotto il nome, PhStr rimosso**: il numero di telefono ora compare subito sotto nome/cognome nell'header (sopra il C.F.). Rimosso `PhStr` dal corpo della pagina (renderizzava un secondo Chiama/WhatsApp, ridondante con i pulsanti già aggiunti in header nel giro POL-UI-020) — import tolto.
- **2) Header — statistiche cliccabili**: le 4 celle (Piani/Pagato/Da pagare/Visite) sono ora `<button>` che chiamano `setTab(...)` verso la sezione corrispondente (piani/paga/paga/app) — estese a tutte e 4 per coerenza visiva, non solo le due esplicitamente citate dal Product Owner.
- **3) Tab Info — landing page scrollabile**: nuovo componente locale `SezioneComparsa` (freccia rotante, stesso linguaggio già usato in PianoDrillDown.jsx) per le sezioni "a comparsa" (chiuse di default, un tocco le apre): **Anagrafica** (cliccabile, non a vista), poi **Azioni rapide** (invariate), poi **Anamnesi** (card sempre visibile: mancante → invito a compilare con scorciatoia al tab Anamnesi; ok → scritta verde "Nessuna problematica da evidenziare"; allarme → elenco rosso di cosa è stato riferito, da `paz.anamnesiAllarmeDettagli`), poi **Piani** (a comparsa), poi **Pagamenti** (a comparsa), poi **Prossimo appuntamento** (sempre visibile, non a comparsa — il primo appuntamento futuro o "Nessun appuntamento"), poi **Foto** (a comparsa), poi le Note cliniche (invariate, se presenti). Il pannello `.patient-record-content` era già `overflow-y:auto` — impilare tutto in un solo tab lo rende scorrevole come una pagina senza altro CSS. Il menu a tendina/sidebar delle sezioni resta invariato, come richiesto ("mantieni comunque il menù a tendina").
- **4) "Le sezioni in pagina Info devono essere le stesse delle pagine corrispondenti"**: `renderPianiSection()`/`renderPagamentiSection()` estratte come funzioni locali, chiamate SIA dal tab dedicato (`piani`/`paga`) SIA dall'accordion in Info — stesso identico markup, mai una seconda implementazione. La sezione Foto riusa lo stesso `<PatientPhotos .../>` del tab dedicato.
- VALIDATION: `npm test` 692/692 (6 nuovi test: struttura landing page, riuso delle funzioni Piani/Pagamenti — verificato che compaiano esattamente 2 volte ciascuna nel sorgente, riassunto anamnesi, prossimo appuntamento, telefono in header/PhStr rimosso, statistiche cliccabili); `npm run build` pulito; `git diff --check` pulito. Nessuna migration in questo giro — solo componenti client.
- MERGE: **PR #89** ("POL-FIN-007e/f + POL-UI-020/021: scheda paziente header, anamnesi alert, landing-page Info tab") aperta `feature/pol-fin-007e-incasso-dock-tab` → `master`, copre in un solo PR tutti i giri accumulati su questo branch (POL-FIN-007e, POL-FIN-007f, POL-UI-020, POL-UI-020 follow-up, POL-UI-021). Check CI ("verify" GitHub Action, Vercel, Netlify preview) tutti `success` al merge. Mergiata su esplicita istruzione del Product Owner ("Mergia master"). Merge commit `ae4bf3ae443fd609a55bd41b52aeb63840c6b68a`.
- EXACT NEXT ACTION: Product Owner verifica in produzione (Vercel farà il deploy automatico da questo merge).

---

- TASK: POL-UI-020 follow-up — dropdown paziente chiudibile, croce anamnesi vera, icona WhatsApp centrata
- TITLE: tre correzioni visive/UX dopo la preview del giro precedente.
- OWNER: CLAUDE, su feedback diretto del Product Owner (messaggio verbatim: "Il tab aggiungi spesa ha su mobile un menu a tendina che elenca i pazienti che però deve essere anche tolto senza selezionare alcun paziente perché copre altro. La croce di anamnesi deve essere una croce come fosse quella della croce rossa quindi non come l'hai fatta tu, inoltre icona WhatsApp in header pazienti è brutta devi farla bella non così").
- BRANCH: `feature/pol-fin-007e-incasso-dock-tab` (stesso branch, continuato).
- STATUS: MERGED — vedi PR #89 registrata nell'entry POL-UI-021 sopra (stesso branch, stesso PR, unico merge per tutti i giri accumulati).

- **1) `SelettorePaziente.jsx` — dropdown non più bloccante**: senza un paziente già selezionato (default in Spese.jsx, e in `SpesaModal` ogni volta che si toglie l'associazione con la "X"), l'elenco COMPLETO dei pazienti si apriva subito al montaggio e non c'era modo di chiuderlo senza sceglierne uno — su mobile, dentro un modale, copriva i campi sotto. Aggiunto uno stato `focused`: il menu ora si apre solo quando il campo ha davvero il focus (o si sta digitando) e si chiude sfocando (con un piccolo delay di 150ms per lasciare il tempo a un click su una voce/sul pulsante "crea paziente" di registrarsi prima che il blur lo nasconda). Componente condiviso (Agenda/Piani/ArchivioDocs/IncassoModal/SpesaModal) — il fix è un miglioramento UX generale, non solo per Spese.
- **2) Croce anamnesi — vera forma a croce**: l'icona `Ic n="cross"` (quadrato arrotondato con un + sottile) non si leggeva come una croce medica. Sostituita con un SVG inline disegnato apposta per questo badge (path a 5 quadrati, angoli netti, forma piena senza contorno) — non toccata l'icona condivisa `cross` in `Ic.jsx`, che altrove (`Pazienti.jsx`, card "Rifiutati") ha il significato opposto di rifiuto/X. Stato bianco: croce ROSSA su sfondo bianco (l'esatta immagine della Croce Rossa); stati verde/rosso: croce bianca su sfondo colorato.
- **3) Icona WhatsApp header — ricentrata**: `WaAction` in variante `icon` non ha `alignItems`/`justifyContent` nel suo stile base — ridimensionandola con un override di `width`/`height` (per farla combaciare col cerchio 34px del pulsante Chiama) l'icona restava scentrata, "brutta". Sostituita con un link diretto identico in forma/dimensione/centratura al pulsante Chiama (stesso cerchio 34px, `display:flex;alignItems:center;justifyContent:center`), verde WhatsApp, URL costruito con `waUrl()` (stessa funzione centralizzata di sempre, nessuna nuova logica).
- VALIDATION: `npm test` 686/686 (nuovo `tests/selettorePaziente.test.mjs`; aggiornati i test header di `tests/patientQaRecoveryFinal.test.mjs` per il link WhatsApp diretto e la vera croce SVG); `npm run build` pulito; `git diff --check` pulito. Nessuna migration in questo giro (solo client).
- EXACT NEXT ACTION: push del branch aggiornato, PR e merge solo su istruzione esplicita del Product Owner.

---

- TASK: POL-UI-020 — Header paziente (chiamata/WA/croce anamnesi), 6 azioni veloci + Spesa, Registra pagamento con prestazione
- TITLE: quattro richieste del Product Owner sulla scheda paziente in un solo giro: (1) tasti chiamata/WhatsApp in header, (2) croce anamnesi a 3 stati (bianca/verde/rossa lampeggiante) con popup, segnalata anche da Poliedron, (3) azioni veloci del paziente portate a 6 con "Spesa" (associazione facoltativa), (4) tasto "Registra pagamento" nel tab Pagamenti con associazione opzionale a prestazione e piano.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "dobbiamo inserire i tasti chiamata e WhatsApp in header, in più in header deve comparire una croce bianca quando non c'è anamnesi (poliedron dovrà segnalare le anamnesi mancanti), diventa vedere quando anamnesi non rileva pericoli (allergie, malattie cardiache, oncologiche ecc, tutti le controindicazioni) che diventa rossa lampeggiante nel caso di allarmi anamnesi e compare popup rosso con allarmi (cliccando sulla croce si hanno le info allarme ananmensi) se la croce è verde si clicca e dice nessun allarme anamnesi, se la croce è bianca deve esserci il popup manca anamnesi. I tasti azioni veloci in pazienti devono essere 6 e messi bene impaginati, metti magari spesa (che deve aggiornare sezione spese, e deve essere associata a paziente, quindi l'associazione è facoltativa, il popup nuova spesa è lo stesso di spese va aggiornato se si vuole opzionalmente associarla ad un paziente). In pagamenti di paziente deve esserci tasto registra pagamento (che è sempre lo stesso) metti opzione di associarla a prestazione e piano").
- BRANCH: `feature/pol-fin-007e-incasso-dock-tab` (stesso branch continuato, contiene già i round 007e/007f — doppio incasso, scroll dock, sidebar navigazione paziente).
- STATUS: MERGED — vedi PR #89 registrata nell'entry POL-UI-021 sopra (stesso branch, stesso PR, unico merge per tutti i giri accumulati).

- **BUG SCOPERTO E CORRETTO, non richiesto esplicitamente ma bloccante**: `PatientClinicalHistory.jsx` salvava l'anamnesi su `patient.noteGenerale`, un campo SENZA colonna DB corrispondente (`patients` ha solo `note`, un campo manuale distinto, mai popolato dal flusso anamnesi). Ogni "Salva anamnesi" aggiornava solo lo stato React locale — spariva al primo refresh. La richiesta di oggi (segnalare anamnesi mancante/allarmi) aveva bisogno di un dato reale da leggere, quindi corretto alla radice: nuovi campi `patients.anamnesi_compilata_il`/`anamnesi_nota`/`anamnesi_allarme`/`anamnesi_allarme_dettagli`, migration `20260903120000_pol_ui_020_anamnesi_alert_spese_paziente.sql`, verificata in transazione annullata poi applicata. `PatientClinicalHistory.jsx` ora scrive su questi campi reali. `computeAnamnesiAlert` (nuovo in `src/lib/patientQuickActions.js`) segnala allarme per ogni risposta anamnesi "sì" e ogni allergia — nessuna lista fissa di "voci pericolose" da mantenere a mano, funziona anche con le voci di storia clinica personalizzate degli studi non-medici. **Non toccato**: l'azione veloce "Note" (in `PatientQuickActions.jsx`) usa ANCORA `patient.noteGenerale` per un'altra funzione (note libere, diversa dall'anamnesi) — condivideva lo stesso campo rotto, ora la collisione si è risolta di riflesso (l'anamnesi non lo usa più), ma quel campo resta comunque senza colonna DB: bug pre-esistente distinto, non nello scope di oggi, segnalato qui per trasparenza.
- **1) Header — chiamata/WhatsApp**: icone compatte in header (`SchedaPaz.jsx`), riusano `WaAction`/`waAbilitato` (unico punto app che decide URL/attivazione WhatsApp) e un link `tel:` diretto — nessuna nuova implementazione del link wa.me.
- **2) Header — croce anamnesi a 3 stati + popup**: `anamnesiState` derivato da `paz.anamnesiCompilataIl`/`paz.anamnesiAllarme` (bianca=mancante, verde=ok, rossa lampeggiante=allarme, icona `cross` già nel set `Ic`). Click apre sempre il popup di dettaglio (mancante → invito a compilare con scorciatoia al tab Anamnesi; ok → conferma nessun allarme con data compilazione; allarme → elenco condizioni/allergie riferite). Se in allarme, il popup si apre da solo all'apertura della scheda — **senza `useEffect`** (vietato in questo file da `tests/patientRecordRecovery.test.mjs`, guardia dall'incidente POL-UI-PATIENT-FREEZE-PROD): sfrutta il fatto che `App.jsx` monta `SchedaPaz` con `key={paziente.id}`, quindi un inizializzatore lazy di `useState` basta. **Segnalazione Poliedron**: nuovo `ACTIVITY_KIND.ANAMNESI_MANCANTE` in `src/lib/domain/dataHealthActivities.js`, stesso meccanismo "Dati da completare" già esistente — scoperto solo ai pazienti con almeno un piano (come gli altri controlli), per non inondare Attività con l'intero storico pazienti al primo rollout del nuovo campo.
- **3) Azioni veloci paziente — da 4 a 6, griglia**: `PatientQuickActions.jsx` passa da pillole in fila (flex-wrap) a una griglia 3×2 di tile icona+etichetta, stesso linguaggio visivo della sidebar sezioni introdotta in POL-FIN-007f. Aggiunte "Spesa" (apre il nuovo `SpesaModal.jsx`, associazione al paziente precompilata ma rimovibile — riusa `SelettorePaziente`, che ha già la "X" per togliere l'associazione) e "Nuovo piano" (riusa `onNuovoPiano`, già passato a `SchedaPaz` da `App.jsx`, stesso schema di "Nuovo appuntamento"). `SpesaModal.jsx` è lo stesso identico modale ora usato anche da `Spese.jsx` (estratto da lì, non duplicato) — migration `spese.paziente_id` (nullable FK) nello stesso giro.
- **4) Pagamenti paziente — tasto "Registra pagamento" con prestazione**: `SchedaPaz.jsx` non aveva NESSUN tasto per aprire `IncassoModal` nel tab Pagamenti (gap pre-esistente). Aggiunto, stesso `IncassoModal` di sempre. `IncassoModal.jsx` esteso con un selettore "Prestazione (opzionale)" che compare una volta noto il piano (bloccato/auto-assegnato/scelto) — selezionarla precompila nota/importo, stesso schema già usato dai tasti Incassato per-prestazione in `PianoDrillDown.jsx`, nessuna nuova colonna DB.
- VALIDATION: `npm test` 683/683 (nuovi/aggiornati: croce anamnesi 3 stati + popup automatico senza useEffect, segnale Poliedron anamnesi mancante scoperto ai soli pazienti con piani, griglia 6 azioni + Spesa + Nuovo piano, SpesaModal condiviso Spese/azioni veloci, selettore prestazione in IncassoModal, tasto Registra pagamento nel tab Pagamenti); `npm run build` pulito; `git diff --check` pulito. `get_advisors(security)` dopo la migration: 52 WARN + 2 INFO, identico al baseline, zero nuovi.
- EXACT NEXT ACTION: push del branch aggiornato, PR e merge solo su istruzione esplicita del Product Owner. Non verificato in un vero browser (nessuna sessione autenticata in questa sandbox) — in particolare il Product Owner dovrebbe controllare: la croce anamnesi sui pazienti reali (bianca sulla maggioranza, dato che il campo è nuovo), il popup automatico su un paziente con allarme reale, e il layout della griglia 6 azioni su mobile.

---

- TASK: POL-FIN-007e/007f — Correzione doppio incasso, scroll oltre il dock, navigazione paziente sidebar/dropdown
- TITLE: tre fix su feedback diretto del Product Owner dopo l'uso reale dell'app: (1) un doppio incasso reale corretto nei dati + prevenuto lato app, (2) il pulsante "+ Aggiungi prestazione" in Piani paziente non era più raggiungibile su mobile perché nascosto dietro il dock flottante, (3) la navigazione a sezioni della scheda paziente — dopo DUE round respinti (griglia di testo, poi griglia icon-only) — sostituita con lo stesso pattern sidebar/dropdown già usato in Controllo di gestione.
- OWNER: CLAUDE, su segnalazione diretta del Product Owner (messaggio verbatim round 1: "bisogna sistemare alcune cose: ho ad esempio registrato come pagata la prestazione di Gualfredo Bruno di Clarafond, però c'era già un pagamento registrato a suo nome quindi è andato in credito di 90 euro, inoltre bisogna far si che in piani paziente la pagina scorra fino al di sopra del dock altrimenti non si possono aggiungere prestazioni, inoltre la pagina paziente ha questi tasti che portano ai vari sezioni che è un po troppo ingombrante bisogna trovare un modo"; round 2, dopo aver visto la compattazione icon-only: "Ancora non mi piace la visualizzazione dei tasti in paziente, dobbiamo trovare un modo più funzionale e pro").
- BRANCH: `feature/pol-fin-007e-incasso-dock-tab`, da `master` (contiene già PR #87 — NON contiene ancora POL-FIN-007d/Attività-vs-Dati-da-completare, che è su un branch separato non ancora mergiato).
- STATUS: MERGED — vedi PR #89 registrata nell'entry POL-UI-021 in cima al file (stesso branch, stesso PR, unico merge per tutti i giri accumulati).

- **1) Dato reale corretto + prevenzione**: paziente id=96 (Gualfredo Bruno di Clarafond), piano id=15 "Conservativa" (unico voce "Otturazione" dente 28, €90). Aveva DUE pagamenti da €90 collegati allo stesso piano (`payments.id=50` "Saldo Conservativa" del 2026-09-02, preesistente; `payments.id=51` "Otturazione" del 2026-09-03, registrato oggi tramite il tasto "Incassato" sulla prestazione) — €180 incassati su €90 dovuti, €90 di credito indebito. Root cause: i tasti "Incassato" (sia a livello piano che a livello prestazione) in `PianoDrillDown.jsx` prefillavano SEMPRE l'importo pieno (`tot`/`v.prezzo`), ignorando i `payments` già registrati per quel piano — a differenza di `removeItemFromPlan`, che quel calcolo lo fa già da POL-FIN-007. Verificato in transazione annullata (`BEGIN...ROLLBACK`) su produzione, poi applicato per davvero: `DELETE FROM payments WHERE id=51`. Il piano torna a saldo zero.
  - FIX APP (per prevenire la ricorrenza): nuovo helper condiviso `totalePagatoPiano(planId)` in `PianoDrillDown.jsx` (stesso pattern già usato da `removeItemFromPlan`, ora riusato anche dai due tasti Incassato tramite `openIncassoPiano`/`openIncassoVoce`). L'importo prefillato è ora il RESIDUO (`atteso - già pagato`), mai più l'importo pieno alla cieca; se il residuo è zero il campo importo resta vuoto invece di riproporre una cifra. `IncassoModal.jsx` riceve un nuovo `pianoContext` (informativo, tenuto fuori dallo stato editabile del form) e mostra sempre "Piano: atteso €X · già incassato €Y" più un avviso ambra ben visibile se il piano risulta già saldato o in credito, prima ancora di salvare.
- **2) Piani paziente — scroll oltre il dock**: `.poliedron-mobile-dock` è `position:fixed`, `z-index:1100`, e "non contribuisce mai all'altezza del layout" (commento CSS preesistente) — quindi qualunque pannello scrollabile deve riservare esplicitamente lo spazio sotto, altrimenti l'ultimo elemento (qui: "+ Aggiungi prestazione" nel piano espanso) resta coperto e non cliccabile. `SchedaPaz.jsx`'s pannello scrollabile (`style={{flex:1,padding:14,overflowY:'auto'}}` inline) non lo riservava. Estratto in una classe `.patient-record-content` con lo stesso identico `padding-bottom:110px` su mobile già usato altrove per lo stesso identico problema (`.management-hub`, `.financial-workspace`) — nessun valore nuovo inventato.
- **3a) Navigazione paziente — round 1 (icon-only, RESPINTO dal Product Owner)**: una sessione precedente (POL-UI-017 R2) aveva deliberatamente spostato questa barra da uno scroller orizzontale a una griglia che va a capo (test di regressione: mai `overflow-x`) — quindi non si poteva tornare allo scroll orizzontale. Primo tentativo: `TABS` separava emoji e testo, nascondendo il testo su mobile (icon-only, griglia densa). Il Product Owner l'ha respinto: "Ancora non mi piace... un modo più funzionale e pro".
- **3b) Navigazione paziente — round 2 (sidebar/dropdown, quello attuale)**: invece di un'altra variante di tab strip, riusata la stessa identica soluzione già presente e approvata in questo stesso repo per lo stesso problema (molte sezioni, poco spazio) — `ControlloGestione.jsx`'s `.management-nav`/`.management-nav-mobile`: sidebar verticale persistente icona+etichetta su desktop, select dropdown nativo su mobile. `SchedaPaz.jsx`: nuovo `<div className="patient-record-body">` (riga flex sotto header/statistiche) contiene `<aside className="patient-record-nav">` (desktop) + `<label className="patient-record-nav-mobile">` (mobile, `<select>`) + `.patient-record-content` invariato. `TABS` ora usa `{id,icon,label}` con icone reali dal set `Ic` condiviso (user/pulse/tooth/tag/zap/pay/folder/cal/file/lock) invece delle emoji — non serve più nasconderle su mobile perché il dropdown mostra sempre il testo pieno. Nessuna sezione nascosta, nessuno scroll orizzontale (mai reintrodotto), touch target 44px sul select mobile.
- VALIDATION: `npm test` 668/668 (test aggiornati per riflettere sidebar/dropdown invece di griglia/icon-only, incluso il test storico "M" di `patientQaRecoveryFinal.test.mjs` sul vincolo no-horizontal-scroll; guardia di regressione sul residuo Incassato; banner già-pagato in IncassoModal; riserva di spazio sotto il dock); `npm run build` pulito; `git diff --check` pulito.
- EXACT NEXT ACTION: push del branch, PR e merge solo su istruzione esplicita del Product Owner.

---

- TASK: POL-FIN-007c — Prestazioni visivamente distinte in Piani/Piano paziente
- TITLE: ogni prestazione dentro un piano espanso è ora una card a sé (bordo colorato per stato eseguito/da eseguire, badge numerato/spunta, nome più grande), non più una riga sottile che si confonde col resto.
- OWNER: CLAUDE, su feedback diretto del Product Owner dopo il deploy di POL-FIN-007 ("si capisce poco a vista d'occhio quali siano le prestazioni, dobbiamo renderle ben individuabili sempre in piani generali e piano paziente").
- BRANCH: `feature/pol-fin-007c-prestazioni-visibili`, da `master` (contiene già PR #86).
- STATUS: MERGED — PR #87, merge commit `59a66911c2e4cb82936795489101de909b7bc8e4`, su esplicita istruzione del Product Owner ("Mergia master").
- COSA È CAMBIATO: `src/components/PianoDrillDown.jsx` (l'unico componente — condiviso da Piani generale e Piano del paziente, quindi un solo fix li copre entrambi). Ogni riga prestazione: bordo sinistro 4px verde se eseguita/ambra se da eseguire, sfondo distinto dal resto della card, badge circolare con spunta o numero progressivo, nome della prestazione passato da 12px a 14px grassetto. Aggiunta intestazione "Prestazioni (N)" sopra l'elenco quando il piano è espanso, per orientamento immediato.
- VALIDATION: `npm test` 661/661 (nuovo test source-level dedicato in `tests/planExecutionUi.test.mjs`); `npm run build` pulito.
- FOLLOW-UP nello stesso giro/branch (PO, dopo aver visto l'anteprima: "i tasti accetta ecc devono essere meno confusionari, inoltre anche la scheda paziente hai tasti per moduli un po scritti piccoli (mobile)"):
  1. `PianoDrillDown.jsx`: i 6 pulsanti allo stesso livello (PDF/Modifica/Accetta/Non accetta/Incassato/Cancella) sostituiti con: Accetta/Non accetta ora è UN controllo segmentato a due stati (pillola unica, non due pulsanti separati), Incassato resta un pulsante pieno ben distinto (azione economica principale), PDF/Modifica/Cancella diventano piccole icone raggruppate senza testo (con title/aria-label), meno invadenti perché usate meno spesso.
  2. `PremiumVisualSystem.css`, `.patient-record-tabs button` su mobile (`max-width:719px`): font-size da 9.5px a 11px, font-weight 800, min-height da 38px a 44px (torna sopra la soglia touch-target di 44px) — i tab Info/Anamnesi/Piani/Pagamenti/Foto/Agenda/Documenti/ecc erano illeggibili su telefono.
- VALIDATION 2: `npm test` 664/664 (3 nuovi test: segmented control, icone housekeeping, leggibilità tab mobile); `npm run build` pulito.
- MERGE: **PR #87** ("POL-FIN-007c: prestazioni ben distinte, tasti Piani meno confusionari, tab mobile leggibili") aperta `feature/pol-fin-007c-prestazioni-visibili` → `master`, mergiata su esplicita istruzione del Product Owner ("Mergia master"). Vercel `success` al momento del merge. Merge commit `59a66911c2e4cb82936795489101de909b7bc8e4`.
- EXACT NEXT ACTION: Product Owner verifica in produzione (Vercel farà il deploy automatico da questo merge).

---

# Previous current task

- TASK: POL-FIN-007 — Piani unificato (elenco pazienti → piani → prestazioni) + gate accettazione
- TITLE: "Piani" generico e "Piano del paziente" ora condividono la stessa grafica a drill-down (paziente cercabile → nomi piano con Cancella/Modifica/Accetta/Non accetta/Incassato → prestazioni con Eseguito/Modifica/Elimina/Incassato); "Da incassare" ora conta solo i piani esplicitamente accettati.
- OWNER: CLAUDE, su istruzione diretta del Product Owner (messaggio verbatim: "in incassi ... in controllo ... sezione piani generica : deve essere un elenco pazienti (che abbiano un piano) con filtro ricerca paziente ... Fai come al solito").
- BRANCH: `feature/pol-fin-007-piani-accettazione`, da `master` (contiene già PR #82/#83/#84/#85).
- STATUS: MERGED — PR #86, merge commit `4b6a27a3258802ea8b39a3d1b46e19838dd7a739`, su esplicita istruzione del Product Owner ("Mergia master").
- CONTEXT: `docs/architecture/pol-003a-product-owner-semantics-lock.md` (ACCETTATO era esplicitamente "decisione futura non presa qui" — questa è quella decisione, presa ora su istruzione diretta del PO). `plans.stato` è una colonna testo già esistente (default `'attivo'`), già usata lato client per il badge — nessuna nuova colonna.
- DECISIONE PRODOTTO OWNER (esplicita, via AskUserQuestion, non inferita): gate STRETTO — solo `stato='accettato'` conta come "Da incassare", non semplicemente "diverso da rifiutato". Confermato dopo aver mostrato la distribuzione reale (Studio Simondi: 4 accettato, 6 attivo/in attesa, 5 concluso) e l'effetto immediato: il totale "Da incassare" passa dai €10.997 già verificati (POL-FIN-005) a €1.500 (i soli piani oggi accettati), finché gli altri piani non vengono (ri)accettati dai nuovi tasti.
- COSA È CAMBIATO (database, produzione, applicato):
  1. Migration `supabase/migrations/20260902110000_pol_fin_007_accettazione_gate.sql` — `get_saldo_piano`/`get_saldi_aperti_studio` ora azzerano `saldo_piano`/`eseguito_non_pagato` per un piano non accettato (restano invariati `totale_piano`/`totale_eseguito`/`totale_pagato`/`acconto` — un acconto già incassato resta visibile anche su un piano non accettato). Nessuna RLS/grant toccata, tutti i controlli di accesso POL-FIN-006 invariati byte-per-byte.
  2. Verificata prima in transazioni annullate, poi applicata per davvero via `apply_migration`, poi riverificata live: `get_saldi_aperti_studio` passa da €10.997 a €1.500/2 righe. `get_advisors(security)`: 54 finding (52 WARN + 2 INFO), identico al baseline, zero nuovi.
- COSA È CAMBIATO (client):
  1. **Bug corretto nello stesso giro, necessario per il gate stretto**: `Piani.jsx`/`SchedaPaz.jsx`/`treatmentPlanService.js` sovrascrivevano `plans.stato` a `'concluso'` non appena l'ultima prestazione veniva segnata eseguita — cancellando silenziosamente qualunque `accettato`/`rifiutato` già registrato. Con il gate stretto questo avrebbe fatto sparire da "Da incassare" un piano accettato e completato nell'istante stesso in cui veniva finito. Rimosso: `stato` ora è solo la decisione accettato/rifiutato/in attesa; "Concluso"/"Terminato" è un'etichetta calcolata (`isTreatmentPlanCompleted`, nuova in `treatmentPlanService.js`), mai più scritta su `plans.stato`.
  2. Nuovo `src/components/IncassoModal.jsx`: il modulo "Registra incasso" già esistente in Incassi.jsx (paziente/piano/importo/data/metodo/nota → riga `payments` reale, `stato:'pagato'`) estratto in un componente riusabile. Incassi.jsx lo usa com'era; ora lo riusano anche i nuovi tasti "Incassato".
  3. Nuovo `src/components/PianoDrillDown.jsx`: elenco piani (solo nomi + badge stato/terminato) con tasti Stampa PDF/Modifica/Accetta/Non accetta/Incassato/Cancella; click sul nome espande le prestazioni pulite con Segna eseguita/Modifica (nuovo: editing inline di prestazione/dente/prezzo, non esisteva prima)/Elimina (riusa l'avviso su eccedenza pagamenti già esistente)/Incassato (apre IncassoModal precompilato con l'importo della singola prestazione, editabile). Riporta senza perdite: auto-suggerimento richiamo (rilevaRichiamo) alla marcatura eseguita, scadenza pagamento, tracking mascherine ortodontiche.
  4. `Piani.jsx` riscritto: vista di default ora è un elenco pazienti CON ALMENO UN PIANO, con campo di ricerca; click su un paziente apre PianoDrillDown scoped a lui. Le card KPI (Totali/Attivi/Accettati/Rifiutati/Conclusi/In corso) e il loro pannello "sfoglia tutti i piani" restano invariati (vista trasversale separata, non nel percorso di drill-down).
  5. `SchedaPaz.jsx`, tab "Piani": sostituita la sua resa separata (più vecchia, quasi duplicata) con lo stesso `PianoDrillDown`, già scoped al paziente (nessun livello elenco-pazienti da attraversare qui). Aggiunto `pricelist` alle prop accettate (già passato da `PatientWorkspaceBoundary` via spread, mai letto prima). Rispettato il vincolo di `tests/patientRecordRecovery.test.mjs`: nessun `useEffect`/`supabase.`/`Promise.all` nel file.
- SEMPLIFICAZIONI DICHIARATE (non silenziose): il vecchio invio WhatsApp per-piano ("Piano WA"/"Prev. WA") e il PDF combinato multi-piano (selezione multipla) non sono nella nuova vista a drill-down — non richiesti nell'istruzione del PO, che elencava esplicitamente solo Cancella/Modifica/Accetta/Incassato/Non accetta (piano) ed Eseguito/Modifica/Elimina/Incassato (prestazione). Il PDF a singolo piano resta disponibile. Nessun test copriva le funzionalità rimosse.
- FOLLOW-UP nello stesso giro, stesso branch (PO: "mettiamo una lettura da parte di poliedron, che vede i piani fatti e chiede se accettati se non accettati in modo da controllare che i dati siano sempre corretti"): nuovo segnale Poliedron `PLAN_AWAITING_ACCEPTANCE_DECISION` in `src/lib/poliedron/intelligence/treatmentPlanScanner.js` — scatta per ogni piano con almeno una prestazione eseguita ma `stato` non ancora deciso (né `accettato` né `rifiutato`, incluso il vecchio stato legacy `concluso` pre-fix). Il messaggio pone esplicitamente la domanda ("è stato accettato dal paziente?") e ricorda che finché non si preme Accetta/Non accetta l'importo non conta in "Da incassare". Integrato nel bucket DATI DA COMPLETARE già esistente (nessuna nuova UI di chat necessaria — stesso meccanismo di MISSING_TOOTH_REFERENCE/MISSING_PLAN_STATUS), nel conteggio `studioDataHealth.issues.plansAwaitingAcceptanceDecision`, e in `queryRouter.js` (nuovo pattern, l'operatore può chiedere direttamente "quali piani devo accettare?"). Un test esistente (`complete required workflow state has no false Data Quality penalty…`) usava `stato:'concluso'` come fixture "tutto a posto" — aggiornato a `'accettato'`, dato che sotto la nuova semantica `concluso` da solo non è più una decisione. 5 nuovi test dedicati.
- FOLLOW-UP 2, stesso giro/branch (PO: "anche quando poliedron segna sulle attività, deve essere più chiaro, mandarmi notifica in chat, e dirmi pazienti che non hanno dati aggiornati, inoltre poliedron deve agire anche quando c'è un piano lì, senza una attività eseguita su quel piano, così come pazienti che hanno prestazioni in piani che non vengono teoricamente eseguite, e dobbiamo metterlo chiaro in attività ma chiaro e con la cliccabili"):
  1. Migration `supabase/migrations/20260902130000_pol_fin_007b_todos_paziente_id.sql` — `todos.paziente_id` (bigint, nullable, FK a `patients`), applicata in produzione, verificata in transazione prima, advisor invariati dopo. Nessuna RLS toccata (la policy `todos_studio` è già scoperta solo su `studio_id`).
  2. Nuovo segnale Poliedron `PLAN_NEVER_STARTED` (`treatmentPlanScanner.js`): un piano con prestazioni ma **zero** eseguite, aperto da ≥14 giorni (stessa soglia di `ACCEPTED_QUOTE_FOLLOW_UP`), non rifiutato → "è ancora in corso o è stato dimenticato?".
  3. Nuovo `src/lib/domain/dataHealthActivities.js` (puro, testato, 12 test): riusa lo scanner Poliedron esistente (`scanTreatmentPlans`) per produrre UNA voce per paziente per problema — mai più il vecchio bundle generico "N pazienti hanno...". Copre 4 casi: appuntamento di ieri con prestazioni non segnate (regola preesistente, portata qui invariata), piano con lavoro eseguito ma non accettato/rifiutato (POL-FIN-007), piano mai iniziato (`PLAN_NEVER_STARTED`), piano accettato con prestazioni residue e nessun appuntamento futuro (riusa `UNFINISHED_TREATMENT`/`contactRecommended` già esistente). Ogni voce porta `pazienteId` + un `dedupMarker` stabile (frase fissa indipendente dal titolo del piano, per non perdere il dedup se il piano viene rinominato) — semplificazione dichiarata: il dedup è per (paziente, tipo), non per (paziente, piano, tipo), quindi due piani diversi con lo stesso problema sullo stesso paziente condividono per ora una sola Attività finché non viene risolta.
  4. `Dashboard.jsx`: l'effetto "Completa dati" riscritto per usare `buildDataHealthActivities` — una riga `todos` per paziente (con `paziente_id`), dedup per paziente+marker (sopravvive a "segnato fatto"/cancellato, come il bot Richiami). Ogni riga Attività con `paziente_id` è ora **cliccabile** (apre `onOpenPaz(paziente, 'piani')`, sottolineata, colore primario) invece di solo testo statico. Quando ci sono voci nuove (non dedup), viene anche pubblicato UN messaggio riassuntivo nella **Chat Poliedron persistente** (stessa conversazione del campanellino/badge non letti — `getOrCreatePrimaryConversation`/`appendConversationMessage`, `role:'assistant'`), raggruppato per tipo, con i nomi dei pazienti coinvolti — best-effort, non blocca né annulla le Attività già salvate se la chat fallisce.
- VALIDATION: `npm test` 660/660 (nuovi test source-level per PianoDrillDown.jsx/IncassoModal.jsx/il gate treatmentPlanService.js, test esistenti di Incassi.jsx/planExecutionUi.test.mjs aggiornati per la nuova architettura condivisa, non semplicemente cancellati); `npm run build` pulito; `git diff --check` pulito. Verifica in browser: server di sviluppo avviato, la pagina di login carica senza crash React — MA nessun credenziale/ambiente Supabase locale disponibile in questa sandbox per un vero login autenticato end-to-end; il Product Owner dovrebbe fare un passaggio visivo reale prima/dopo il merge.
- MERGE: **PR #86** ("POL-FIN-007: Piani unificato, gate accettazione, Attività Poliedron") aperta `feature/pol-fin-007-piani-accettazione` → `master`, mergiata su esplicita istruzione del Product Owner ("Mergia master"). Al momento del merge: Vercel già `success`, Netlify deploy-preview ancora `pending` (non bloccante, nessun check fallito). Merge commit `4b6a27a3258802ea8b39a3d1b46e19838dd7a739`.
- EXACT NEXT ACTION: Product Owner verifica in produzione. In particolare: (1) riaccettare via il nuovo tasto Accetta i piani in corso/conclusi che si vuole tornino a contare come "Da incassare", dato il gate stretto appena entrato in vigore; (2) confermare che la notifica riassuntiva compaia davvero nella Chat Poliedron (bell/badge) al primo controllo dati utile — non verificabile in questa sandbox senza credenziali Supabase.

---

# Previous current task

- TASK: POL-003B-LIVE — "Prodotto" live sync
- TITLE: PRODOTTO/PAYMENT canonical events now update automatically on every plans/payments write, instead of only via a manually-gated batch backfill
- OWNER: CLAUDE, on direct Product Owner instruction ("Parti con a") after the POL-FIN-005 round-3 report identified that "Prodotto" was frozen at a one-time 2026-08-19 backfill.
- BRANCH: `feature/pol-003b-live-sync` (pure SQL/migration + docs, no client code change).
- STATUS: APPLIED TO PRODUCTION, verified. Not pushed/PR'd yet — see EXACT NEXT ACTION.
- CONTEXT — read before writing anything: `docs/architecture/pol-003a-product-owner-semantics-lock.md`, `pol-003b-legacy-source-mapping.md`, `pol-003b-adapter-implementation.md`, `pol-003b-shadow-reconciliation.md`, `pol-003b-local-validation.md`, `pol-003d-controlled-backfill-findings.md`. These record that the PO-locked semantics and legacy→canonical mapping rules were already fully designed, locally validated (`plpgsql_check`, synthetic Docker Postgres 17), and production-executed under an explicit gate: `private.run_pol_003b_legacy_adapter_v1(studio_id)`, a `SECURITY INVOKER`, idempotent (`ON CONFLICT DO NOTHING` on `(studio_id, source_table, source_id[, source_line_id])`), tenant-parameterized batch function, revoked from every role (`PUBLIC`/`anon`/`authenticated`/`service_role`) so it can only run under a manually-gated, elevated context. It was run once successfully on 2026-08-19 (after an earlier attempt failed reconciliation over `eur`-type discounts and was fully rolled back — fixed by POL-003D) — that single run is exactly why every "Prodotto" row in production shared one frozen `created_at` timestamp. So the actual gap was never "the mapping doesn't exist" — it was "nothing ever re-runs it".
- WHAT SHIPPED:
  1. **Immediate catch-up**: re-ran the existing, unchanged `private.run_pol_003b_legacy_adapter_v1('00000000-0000-0000-0000-000000000001')` for Studio Simondi — idempotent, so this only inserted what was genuinely missing since 2026-08-19: 5 contracts, 9 lines, 2 produced events, 3 payment events, zero skipped. Verified by recomputing the legacy-compatible "Prodotto" aggregate directly (executed lines net of proportional discount, same rule as `private.financial_line_values_v1`) and comparing to the canonical `get_financial_drilldown_v1(...,'PRODOTTO',...)` sum: **both €2,451.00, exact match**.
  2. **Live sync going forward** (new migration `supabase/migrations/20260902090000_pol_003b_live_sync_triggers.sql`): two new `SECURITY DEFINER` trigger functions, `private.sync_pol_003b_plan_v1()`/`private.sync_pol_003b_payment_v1()`, attached `AFTER INSERT OR UPDATE` on `public.plans`/`public.payments`. Each one is the EXACT SAME eligibility/mapping SQL as the batch adapter's own contract/lines/PRODOTTO/PAYMENT inserts, just scoped to `NEW.id` instead of a whole studio, reusing the identical `ON CONFLICT DO NOTHING` keys — so it is provably safe to fire on every write: it can only ever insert a row that doesn't already exist. No new mapping rule was invented; this is automation of an already-approved design, not a new semantic decision.
  3. **Explicitly NOT touched, same boundaries the existing docs already lock**: `ACCETTATO` (no historical acceptance date exists in the schema — `APPROXIMATION_NOT_ALLOWED`; capturing a true "accepted today" event going forward is a distinct, separate decision not made here), `FATTURATO`/invoice events, external payments (`pagamenti_esterni`), historical costs/hours/operator attribution — all remain blocked, unchanged. No reversal/negative-event logic either: editing a price/date or un-marking `eseguita` after an event was recorded does not touch that event (`ON CONFLICT DO NOTHING`) — POL-003A requires reversals to be explicit new negative events in their own period, never a silent rewrite; that is future work if ever needed, not attempted here.
- VERIFICATION (all directly against production, before AND after applying):
  1. Tested both trigger functions inside a `BEGIN…ROLLBACK` block before applying for real: a synthetic plan with one executed line produced exactly one contract/line/produced-event row; a synthetic paid payment produced exactly one payment-event row; re-`UPDATE`ing the same plan created zero duplicates (idempotency confirmed); a synthetic plan with an empty `voci` array was correctly skipped with no error.
  2. After applying: a fresh `BEGIN…ROLLBACK` insert against the now-live production triggers confirmed they fire for real (one produced-event row appeared), then cleanly rolled back with no residue left in production.
  3. Re-ran the batch adapter once more: **0/0/0/0 inserted everywhere** — confirms the live triggers already cover everything the batch adapter would have caught.
  4. `get_advisors(security)`: 54 findings (52 WARN + 2 INFO) — identical to the established baseline, zero new, nothing mentioning the new functions.
- VALIDATION: `npm test` 624/624 (unaffected — pure SQL, no client code changed); `npm run build` clean; `git diff --check` clean.
- EXACT NEXT ACTION: PR #85 opened `feature/pol-003b-live-sync` → `master`, merge requested by explicit Product Owner instruction ("Sì"). Blocked by a merge conflict with the parallel POL-FIN-006 work below (both touched this file and, independently but compatibly, `get_saldo_piano`/`get_saldi_aperti_studio`) — resolving now via `git merge origin/master`, re-verifying both "Da incassare" and "Prodotto" together, then retrying the PR merge.
- NOTE ON OVERLAP WITH POL-FIN-006 (discovered while merging, not before): a different agent independently built a much larger, live-computed solution to the same "Prodotto is frozen" gap (see the POL-FIN-006 entry immediately below), merged to `master` as PR #83/#84 while this branch was in flight — neither session was aware of the other. Cross-checked directly against production after combining both: zero rows in POL-FIN-006's `private.financial_live_data_quality_v1` blocking view for Studio Simondi, "Da incassare" still 12 rows/€10.997, "Prodotto" still reconciles to €2.451,00, `get_advisors(security)` still the same 54-finding baseline. The two systems are compatible, not conflicting: POL-FIN-006 supersedes the read side (it recomputes Prodotto/Incassato live from `plans`/`payments` directly, replacing reliance on frozen `financial_line_events_v1`/`financial_payment_events_v1` rows), while POL-003B-LIVE's triggers keep those same underlying event-sourcing tables themselves from silently going stale again for any other consumer that still reads them directly (batch adapter, drilldown, this codebase's own POL-FIN-005 fix). Discrepancy flagged for Product Owner, not silently resolved: POL-FIN-006's own STATUS/DATABASE lines below say its migration was "non applicata in remoto" (only committed locally), but direct SQL inspection of production `idklxdqebfceplrualgh` shows its `get_saldo_piano`/`get_saldi_aperti_studio` bodies (containing literal `POL-FIN-006:` error strings) are live there right now — someone applied it without updating that doc, or the doc was written before an apply that happened later. Needs Product Owner/other-agent follow-up; not something this session can resolve unilaterally since it did not author that migration.
- TASK: POL-FIN-006 — Prodotto live e riconciliazione con Incassato
- TITLE: Valore Prodotto reale dalle prestazioni eseguite, con drill-down piano/paziente senza allocazioni inventate
- OWNER: GitHub Copilot CLI, su autorizzazione Product Owner inoltrata dal coordinatore `6e5c8e86-f4d4-42df-9855-0e8772357c04`.
- BRANCH: `lucasimondi-prodotto-incassato-reconciliation`, da `origin/master@97e7267` (contiene PR #82, merge commit `66a014f`).
- STATUS: MERGED — PR #83, merge commit `618e11be4344417630704fa9b937b91acdbc3ce2`.
- OBJECTIVE: sostituire gli eventi legacy congelati usati da `get_financial_snapshot_v1` per `PRODOTTO`/`INCASSATO` con un read model live canonico da `plans`/`payments`; Prodotto usa esclusivamente `voci[].prezzo` salvato nel piano, sconto proporzionale e `dataEsec`, mai il listino corrente. Il click su Prodotto deve riconciliare prestazioni e pagamenti alla massima granularità autorevole (`payments.piano_id`, altrimenti paziente/non allocato), senza attribuire euro a singole prestazioni.
- PRODUCT OWNER LOCK: sconto piano distribuito proporzionalmente ai prezzi originali/pre-sconto; arrotondamento monetario in centesimi con largest remainder e spareggio per ordinalità JSON; somma righe esattamente uguale al netto piano. Scostamento = Prodotto - Incassato nel periodo ed è un gap temporale/di incasso, non automaticamente debito.
- SAFETY: nessuna query o modifica produzione, nessuna migration remota, nessun deploy. RLS e capability `finance.management.read` devono fallire chiuso; input legacy incompleti devono rendere il dato visibilmente non disponibile, mai un totale parziale apparentemente esatto.
- GOLDEN ROLLBACK POINT: `stable/2026-08-27-full-recovery@070b28fd4eae4e2cc397584201d0bb149468fae7`, invariato e immutabile.
- COMPLETED: read model live in centesimi con largest remainder; snapshot/drilldown/Incassi riallineati; riconciliazione responsive piano/paziente; fallback fail-closed; capability e membership enforcement; Poliedron/annual/export/Home/Patient Workspace restano sullo snapshot canonico.
- VALIDATION: SQL PostgreSQL/PGlite isolato PASS; `npm test` 632/632; `npm run build` PASS con soli warning preesistenti; `git diff --check` PASS; browser QA reale 375/768/1024/1440 senza overflow; quattro review sostanziali completate e findings risolti.
- DATABASE/DEPLOYMENT: migration locale `20260901190000_pol_fin_006_live_prodotto_reconciliation.sql`; non applicata in remoto. Nessun deploy, backfill o dato produzione modificato.
- EXACT NEXT ACTION: Product Owner review del risultato; applicazione remota della migration e deploy restano vietati senza una nuova autorizzazione esplicita e un controllo dati/reconciliation dedicato. (Nota della sessione POL-003B-LIVE: la migration risulta in realtà già live in produzione — vedi la nota sopra. Da chiarire con il Product Owner / l'altro agente prima di ulteriori apply.)

---

# Previous current task

- TASK: POL-FIN-005 — ROUND 3 (production fix + merge)
- TITLE: "Da incassare" was genuinely empty in production — root cause found and fixed, PR merged to master
- OWNER: CLAUDE, on direct Product Owner report ("per il da incassare è a 0?") after round 2's preview, then explicit "mettiamo a posto poi mergiamo, poi facciamo il resto".
- BRANCH: `feature/modulo-incassi` → merged to `master`.
- STATUS: MERGED — PR #82, merge commit `66a014f`.
- ROOT CAUSE (confirmed by querying production directly, not guessed): `public.get_saldi_aperti_studio(p_studio_id)` calls `private.financial_has_tenant_access_v1(p_studio_id)`, which internally re-derives "the current studio" from the JWT via `private.financial_current_studio_v1()` and compares it to `p_studio_id` — it never actually trusts the value the RPC itself was given. `financial_current_studio_v1()` only accepts a JWT `app_metadata.studio_id` claim that matches a strict UUID-version/variant regex (`[1-5]` version nibble, `[89ab]` variant nibble) — added by `20260821120000_pol_003a_tenant_access_fix.sql`. Studio Simondi's real `studio_id` (`00000000-0000-0000-0000-000000000001`) has a `0` version nibble, so the regex rejects it, the comparison never succeeds, and the RPC silently returns zero rows for every caller regardless of real membership or real balances — confirmed by querying `private.incassi_plan_saldo_v1` directly: **~10,997€ in genuinely open balances**, matching exactly what the fixed RPC returns after the fix (verified below). Controllo di gestione's other figures (Prodotto, Incassato, EBITDA) were unaffected because `get_financial_drilldown_v1`/`get_financial_snapshot_v1` already had this exact bug fixed by the same `20260821120000` migration — they independently verify a caller-supplied `p_studio_id` via `private.financial_verified_studio_membership_v1` (a plain `studio_users` active-membership check, no JWT/regex dependency) and set a transaction-local override `financial_current_studio_v1()` prefers; `get_saldi_aperti_studio` (POL-FIN-002/003) predates that fix and was never updated to use it.
- FIX: new migration `supabase/migrations/20260901150000_pol_fin_005_saldi_aperti_tenant_fix.sql` — gives `get_saldi_aperti_studio` the identical verify-then-override pattern already used by the two POL-003A RPCs (reusing `private.financial_verified_studio_membership_v1` unchanged; no regex touched, no RLS policy touched, no new authorization surface). Applied directly to production (`idklxdqebfceplrualgh`) via `apply_migration` after explicit Product Owner go-ahead.
- VERIFICATION (all via direct SQL against production, not assumed):
  1. Simulated an authenticated call as `luca.simondi@gmail.com` (real `sub`/`app_metadata.studio_id` from `auth.users`) — `get_saldi_aperti_studio` now returns **12 rows, totale 10.997€**, matching the manual sum from `private.incassi_plan_saldo_v1` exactly.
  2. Simulated a DIFFERENT authenticated user (a different studio's account) requesting Studio Simondi's `p_studio_id` — correctly rejected with `POL-FIN-005: access denied` (cross-tenant isolation intact).
  3. `get_advisors(security)`: **54 findings total (52 WARN + 2 INFO) — identical to the established baseline**, zero new findings, nothing mentioning `get_saldi_aperti_studio`/`saldi_aperti`/`financial_current_studio`.
- SEPARATE FINDING, NOT FIXED HERE (explicitly deferred by Product Owner — "poi facciamo il resto"): "Prodotto" in Controllo di gestione is NOT a live figure. `public.financial_line_events_v1` (feeding `PRODOTTO`/`ACCETTATO`/etc.) is a plain table with **zero triggers** on `plans`/`payments` — its 17 `PRODOTTO` rows for this studio all share the exact same `created_at` (2026-08-19 14:21:55), i.e. a one-time manual backfill, frozen since. Any prestazione marked eseguita after that date is invisible to "Prodotto". This is the same gap `get_financial_snapshot_v1`'s own `data_quality_status: 'PO_SEMANTICS_LOCKED_LEGACY_ADAPTER_PENDING'` already documents. A prior CODEX session already investigated this (branch `feature/POL-FIN-003-management-canonical`, **PR #77, never merged**): first attempt cut Cockpit/Proiezioni over to the canonical snapshot, found the adapter gap, reverted, then proposed showing an explicit "source pending" notice instead of presenting stale/zero canonical figures as real — that correction was never merged into `master`, so today's Controllo di gestione still presents the frozen 2026-08-19 snapshot with no indication it's stale. Building the real fix (a live sync from `plans.voci[].eseguita`/`payments` into the event-sourcing tables) is a substantial task, tracked separately, not started.
- MERGE: **PR #82** ("POL-FIN-005: Incassi unificato, controllo di gestione mobile/export, fix 'Da incassare'") opened `feature/modulo-incassi` → `master`, merged by explicit Product Owner instruction ("mergiamo"). Merge commit `66a014f`.
- VALIDATION: full `npm test` 624/624 (unchanged by this round — server-side fix only); `npm run build` clean; `git diff --check` clean.
- EXACT NEXT ACTION: Product Owner re-tests "Da incassare" live in production (should now show real balances). Next task (explicitly deferred, "poi facciamo il resto"): design and build the live Prodotto/canonical-engine adapter, and/or revisit PR #77's "don't show stale-as-live" notice as an interim step.

---

# Previous current task

- TASK: POL-FIN-005 — ROUND 2
- TITLE: Incassi buttons reorganized to 3 (allega/registra incasso/registra da incassare), Controllo di gestione mobile cards + PDF/Excel export + click-to-month-detail confirmed
- OWNER: CLAUDE, on direct Product Owner follow-up after testing round 1's preview.
- BRANCH: `feature/modulo-incassi` (same branch, continued — no new branch, not pushed as of this entry's writing... see EXACT NEXT ACTION).
- STATUS: IMPLEMENTED, awaiting push/QA.
- PRODUCT OWNER REQUEST (verbatim, Italian): "in incassi i tasti devono essere: allega foto o pdf, registra incasso, registra da incassare. quando alleghiamo foto o pdf il lettore riconoscerà estratto conto o contabile o altro, il da incassare lo abbiamo già spiegato. in controllo, bisogna che su mobile la tabella sia responsive e ci stia nello schermo, inoltre deve essere possibile estrarre il pdf o excel da quella tabella, deve anche essere possibile cliccare i mesi della tabella in modo che si vada in visualizzazione mensile dettagliata."
- WHAT SHIPPED:
  1. **Incassi.jsx — three distinct toolbar buttons**: "Allega foto o PDF" (was "Leggi estratto conto"), "Registra incasso" (now purely manual amount — the manuale/ricevuta toggle from round 1 was removed), "Registra da incassare" (was "Aggiungi voce da fatturare"/"Aggiungi da incassare", same underlying `saveReceivable` behavior, only relabelled — the Product Owner said this one was "already explained", i.e. no new behavior needed). "Allega foto o PDF" now handles BOTH document types with no upfront classification: the AI extraction (`estrai-pagamenti-estratto-conto`, unchanged) always returns a row array; the UI branches client-side on `righe.length` — one row (a single receipt/"contabile") routes straight into the "Registra incasso" form, prefilled, patient still to pick; more than one row (a bank statement) opens the existing multi-row review table. No new edge function, no AI document-type classification invented — the row count alone is enough to route correctly.
  2. **AnnualFinancialOverview.jsx — mobile-responsive ledger**: below the `useIsMobile()` breakpoint, the 12-month table is replaced by one stacked card per month (Mese + EBITDA in the head, Prodotto/Incassato/Costi fissi/Costi variabili in a 2-column grid), plus a totals card — same click-through to the monthly detail, same data, no horizontal scroll needed on a phone. Desktop/tablet keep the real `<table>` unchanged from round 1.
  3. **PDF/Excel export**: new `src/lib/annualLedgerExport.js` — `exportAnnualLedgerCsv` (semicolon-separated CSV with a UTF-8 BOM so accented characters and Excel's Italian locale — comma as decimal separator — both work; no new dependency, a `.csv` opens directly in Excel) and `exportAnnualLedgerPdf` (reuses `jspdf`, already a dependency and already used by `src/lib/pdfDocs.js` for every other document in this app; a manual table draw, no `jspdf-autotable` plugin since this project doesn't have it installed and 12 rows/6 columns doesn't need it). Both read the exact same `months`/`totals` the on-screen table already computes — no separate data path, so the export can never disagree with what's displayed. Two small "Esporta PDF"/"Esporta Excel" buttons added next to the ledger's own header.
  4. **Click a month → detailed monthly view, confirmed and made visible**: `openMonth(index)` already switched `view` to `'month'` (round 1) but the detail card renders ABOVE the table the user just clicked in, so nothing seemed to happen unless they scrolled up manually. Added a `detailRef` + `scrollIntoView({behavior:'smooth'})` on click, so tapping a month now visibly jumps to its detail.
  5. **Tests**: full suite **624/624** (12 new/updated: 2 replaced in `tests/incassiSection.test.mjs` for the 3-button reorg and the single/multi-row routing; 4 new in `tests/annualFinancialOverviewExcel.test.mjs` for the mobile cards, the scroll-into-view, and the export wiring, plus a new `tests/annualLedgerExport` coverage folded into the same file for the export module itself). `npm run build` clean. `git diff --check` clean.
- SAFETY: no migration/RLS/schema change; no new dependency (jsPDF already present, CSV needs none); the AI extraction endpoint and its security model are unchanged from POL-FIN-004, only how the frontend routes its result changed.
- NOT VERIFIABLE IN THIS SESSION: authenticated live QA — in particular the real single-receipt-vs-multi-row routing with a real AI extraction call, the actual on-screen mobile card layout on a real phone, and that the exported PDF/CSV files open correctly in real Excel/PDF viewers (built and reasoned about, not opened by a human here).
- EXACT NEXT ACTION: push this branch (same `feature/modulo-incassi`) and hand the Product Owner an updated preview link. Open a PR only if explicitly asked. Do not merge without explicit approval.

---

# Previous current task

- TASK: POL-FIN-005
- TITLE: Incassi — sezione unificata, "Incassa" reale dal saldo aperto, incasso con foto/PDF; Controllo di gestione — tabella "excel" con totali e andamento annuale
- OWNER: CLAUDE, su richiesta diretta Product Owner dopo aver testato la preview di un round di lavoro precedente (branch `feature/modulo-incassi`, commit `17c2602`, non di questa sessione — vedi nota sotto) che aveva già introdotto `FinancialWorkspace.jsx`/`AnnualFinancialOverview.jsx`.
- BRANCH: `feature/modulo-incassi` — continuato da questa sessione sullo stesso branch (nessun nuovo branch), non pushato, nessuna PR aperta.
- STATUS: IMPLEMENTATO, NON ANCORA PUSHATO/PR — in attesa di istruzione esplicita del Product Owner.
- NOTA DI CONTINUITÀ: al momento di riprendere questo task, questa sessione ha scoperto che `master` era avanzato di suo (PR #78 POL-FIN-003 "collegamento esplicito payments.piano_id", PR #80 POL-FIN-004 "lettura AI estratto conto", entrambe mergiate) e che il branch `feature/modulo-incassi` aveva 3 commit nuovi non fatti da questa sessione (`7f1865a` "simplify management hub and patient navigation", `314c002` "unify incassi and payments workspace", `17c2602` "add incassi tabs and annual overview") — riportati dal Product Owner in chat come "fatto e pubblicato in preview" con relativo commit/test/build. Confermato via `git merge-base --is-ancestor` che questi commit erano già basati sul `master` più recente. Il fix precedente di questa stessa sessione sul toggle "Incassata"/"Da incassare" (branch `claude/pol-ui-017-mobile-home-r2-3pizhn`, basato sul VECCHIO modello FIFO pre-POL-FIN-003) non è mai stato mergiato né pushato in `feature/modulo-incassi` — è rimasto sul suo branch, superato dall'architettura `piano_id` esplicito nel frattempo. Il lavoro descritto sotto riparte quindi da zero sul modello attuale (payments.piano_id esplicito), non riusa quel fix.
- RICHIESTA PRODUCT OWNER (testuale): "incassi deve avere sia incassato che da incassare in stessa sezione, cliccabili e che diano elenco incassi ed elenchi da incassare, a loro volta segnabili come incassati (e quindi aggiornino il paziente anche). deve esserci il tasto incasso che dia scelta di mettere cifra o fare foto o allegare foto o pdf. sezione controllo gestione, le voci devono essere come un excel pi eventualmente cliccabili ma pro. vista mensile deve essere selzionabile appunto il mese, vista annuale deve contenere tutti i mesi anche con un andamento."
- COSA È STATO FATTO:
  1. **Sezione Incassi unificata** (`src/components/Incassi.jsx`): "Incassato" e "Da incassare" sono ora due riquadri KPI **cliccabili nella stessa pagina** (`activeView` state, non più due tab/pagine separate) — cliccando uno si apre, sotto, il relativo elenco (saldi aperti, oppure la lista "Incassi registrati" — quest'ultima prima viveva solo dentro `Pagamenti.jsx`, ora è integrata direttamente qui). "Pagamenti da assegnare" e "Leggi estratto conto" (POL-FIN-003/004) restano intatti, mostrati sotto la vista "Da incassare".
  2. **Ogni saldo aperto è segnabile come incassato da qui** — nuovo bottone "Incassa" per riga in "Saldi aperti", apre il modale "Registra incasso" prefilato con paziente/piano/importo (=saldo). Salvando scrive un vero pagamento (`payments` con `piano_id`, `stato:'pagato'`) tramite il normale `setPayments` sincronizzato — mai un flag cosmetico — quindi muove per davvero `get_saldo_piano`/`get_saldi_aperti_studio`, che è la stessa fonte letta dal widget "Situazione finanziaria" di `SchedaPaz.jsx`: segnare un incasso da qui aggiorna per davvero il paziente, come richiesto.
  3. **Un solo tasto "Registra incasso"**, riusato da: (a) il bottone di toolbar (vuoto), (b) l'azione "Incassa" per riga (prefilata), (c) l'arrivo dalla quick action Home "Pagamento" (stesso pattern `autoOpenNew`/`onAutoOpenNewHandled` già usato ovunque in app). Offre la scelta tra **importo manuale** (default) e **foto/PDF della ricevuta**: quest'ultima riusa `UploadDocumento` con lo stesso endpoint AI già esistente `estrai-pagamenti-estratto-conto` (una ricevuta singola è solo un estratto conto di una riga — nessuna nuova edge function), che precompila importo/data/nota lasciando comunque salvare esplicitamente. Coerente con l'assenza deliberata, già documentata in questo repo, di un sistema di allegati persistiti ("Missione futura — allegati in Poliedron", `docs/POLIEDRA_MASTER_CONTEXT.md` §32): la foto/PDF viene letta, mai salvata come documento — stesso confine già rispettato da "Leggi estratto conto".
  4. **`FinancialWorkspace.jsx`** semplificato: non più uno switcher a tab tra `Incassi.jsx`/`Pagamenti.jsx` — ora mostra `Incassi.jsx` come unica vista primaria (che è già la sezione unificata sopra); "Collaborazioni esterne" (incassi non-paziente, funzione distinta e già esistente) resta raggiungibile da un bottone secondario che apre `Pagamenti.jsx` in un Modal con un nuovo prop additivo `soloEsterno` (nasconde lo switcher e la vista "Studio" ora ridondante con Incassi.jsx; aggiunto anche un bottone "Aggiungi incasso esterno" nel corpo, che prima mancava quando il componente era embedded — gap preesistente, sistemato di passata).
  5. **Controllo di gestione — tabella "excel"** (`src/components/AnnualFinancialOverview.jsx`, `PremiumVisualSystem.css`): la vista mensile ha già (invariato) il selettore mese; la vista annuale mostrava già tutti i 12 mesi nella tabella (incondizionata dal `view`) ma senza andamento — aggiunto un grafico `ComposedChart` (barre Incassato + linea EBITDA, stessa libreria Recharts già usata in Dashboard.jsx, nessuna nuova dipendenza), visibile solo nella vista annuale. La tabella stessa ora ha look "excel": gridlines verticali tra colonne, righe zebrate, intestazione sticky durante lo scroll, cifre tabulari (`font-variant-numeric: tabular-nums`), e una riga totali in `<tfoot>` (somma dei 12 mesi per ogni colonna) — le righe restano cliccabili per aprire il dettaglio mese, invariato.
  6. **Test**: 619/619 (8 nuovi: 5 in `tests/incassiSection.test.mjs` — vista unificata cliccabile, azione "Incassa" per riga è un vero pagamento mai un flag, scelta cifra/foto-pdf, Collaborazioni esterne isolata — più 1 aggiornato per la nuova struttura DOM della riga; 4 in nuovo `tests/annualFinancialOverviewExcel.test.mjs` — selettore mese/andamento annuale, righe cliccabili, riga totali, stile excel). `npm run build` pulita (solo warning pre-esistenti su chunk-size). `git diff --check` pulito.
- VINCOLI RISPETTATI: nessuna migrazione/RLS/schema toccata — stesse tabelle (`plans`, `payments`) e stessa RPC canonica (`get_saldo_piano`/`get_saldi_aperti_studio`) già in produzione da POL-FIN-002/003; nessuna cancellazione silenziosa di pagamenti (l'unica cancellazione, nell'elenco "Incassi registrati", chiede sempre conferma); nessuna nuova formula finanziaria (tutti i totali derivano da campi RPC esistenti o somme dirette come già fa il resto della sezione); nessun nuovo sistema di allegati persistiti (limite esplicito già documentato, rispettato). Non toccati i file di PR #74.
- NON VERIFICABILE IN QUESTA SESSIONE: QA autenticato dal vivo (in particolare il flusso reale "foto ricevuta → estrazione AI → conferma → salvataggio", che ha un costo reale per chiamata a Claude Haiku 4.5, e il rendering effettivo del grafico Recharts) — nessuna sessione browser autenticata disponibile qui.
- EXACT NEXT ACTION: pushare il branch e condividere la preview col Product Owner per QA; aprire una PR solo su istruzione esplicita (non ancora richiesta). Non mergiare senza approvazione esplicita.

---

# Previous current task

- TASK: POL-FIN-004
- TITLE: "Leggi estratto conto" — lettura AI di un estratto conto bancario in Incassi, matching pagamenti→pazienti, registrazione selettiva
- OWNER: CLAUDE, su richiesta diretta Product Owner (discussione in chat dopo la chiusura di POL-FIN-003).
- BRANCH: `feature/incassi-lettura-estratto-conto` (PR #80, mergiata) — merge commit `92204a4`.
- STATUS: MERGED — Product Owner ha dato via libera esplicito in chat ("mergia") dopo aver visto il riepilogo dell'implementazione. PR #80 aperta e mergiata su `master`. QA dal vivo con un vero estratto conto resta da fare (vedi punto 8 sotto).
- CONTESTO: durante la chiusura di POL-FIN-003 il Product Owner ha chiesto come rilevare errori nel software; discusso "Studio Data Health" (POL-AI-004) come strada naturale per un audit generico, poi il Product Owner ha proposto un'idea più concreta e prioritaria: leggere l'estratto conto mensile con l'AI (stesso pattern già esistente in Spese/Costi per bollette/fatture), farsi proporre l'abbinamento pagamento→paziente, avere una lista di conferma con checkbox, e vedere le discrepanze rispetto a quanto già registrato. Valutata e scartata l'idea di farlo fare a Poliedron stesso: oggi `processQuery`/`poliedraCore.js`/`modelGateway.js` sono solo testuali, nessun allegato — portarlo dentro il motore condiviso è una missione strutturale a sé (registrata in `docs/POLIEDRA_MASTER_CONTEXT.md` §32, "Missione futura — allegati in Poliedron"). Implementato invece come widget dedicato in Incassi, stesso pattern isolato di Spese/Costi.
- COSA È STATO FATTO:
  1. **Nuova edge function** `estrai-pagamenti-estratto-conto` (deployata via `mcp__Supabase__deploy_edge_function` su `idklxdqebfceplrualgh`, `verify_jwt: true`) — stesso pattern di sicurezza di `estrai-spesa-documento` (JWT verificato, `studio_id` dalla sessione, Claude Haiku 4.5 via API Anthropic diretta, nessuna scrittura server-side, nessuna persistenza). Estrae SOLO le righe di entrata/accredito (mai le uscite) con `{data, importo, descrizione}` più `periodo_da`/`periodo_a`; `max_tokens` alzato a 4096 (vs 500 dell'originale) per estratti conto multi-riga/multi-pagina.
  2. **`UploadDocumento`** (`src/components/ui/UploadDocumentoSpesa.jsx`) generalizzato con una prop `endpoint` (default `estrai-spesa-documento`, quindi Spese.jsx/Costi.jsx invariati) invece di riscrivere upload/webcam/base64 da zero.
  3. **Matching paziente**: nuova `trovaPazienteInTesto(patients, testo)` in `src/lib/ricercaPazienti.js` (direzione opposta della `cercaPazienti` già esistente — cerca quale paziente è nominato dentro un testo libero, richiede nome+cognome entrambi presenti, `null` se ambiguo o nessun match — niente inferenza silenziosa, stesso principio di POL-FIN-003).
  4. **`planAssignmentForPatient(plans, pazienteId)`** estratta in `src/lib/domain/incassiActions.js` (unico piano attivo → auto; più di uno → `choose` con le opzioni; zero → `none`) e **riusata** (non duplicata) in `PatientQuickActions.jsx` e `Pagamenti.jsx`, che prima avevano la stessa logica scritta due volte — ora è una sola fonte, tre chiamanti (i due esistenti più questo nuovo flusso).
  5. **Nuovo `src/lib/domain/estrattoContoService.js`** (pure, nessun I/O): `matchPaymentsToPatients`, `flagPossibleDuplicates` (segnala righe che sembrano già registrate — stesso importo, data entro 5 giorni — deselezionate di default per non registrare due volte lo stesso pagamento), `riepilogoEstrattoConto` (totale estratto conto vs. totale già registrato in app nello stesso periodo — nessuna nuova formula finanziaria, solo somme dirette come già fa Incassi.jsx per "Incassato"), `buildPaymentsFromEstrattoConto` (righe confermate → `payments` con `metodo:'Bonifico'`, `stato:'pagato'`, `piano_id` secondo `planAssignmentForPatient`).
  6. **UI**: nuovo bottone "Leggi estratto conto" in Incassi.jsx → modal con upload, poi tabella di revisione (checkbox per riga, importo/data/descrizione, selettore paziente con match pre-compilato ma sempre correggibile, selettore piano se il paziente ha più piani attivi — checkbox disabilitata finché la riga non è "pronta": paziente scelto e, se serve, piano scelto), riepilogo periodo/totali/possibili duplicati, "Registra selezionati (N)" che scrive i pagamenti tramite il normale `setPayments` sincronizzato e forza un refresh dei saldi aperti.
  7. **Test**: 608/608 (nuovi: `tests/estrattoContoService.test.mjs`, `tests/ricercaPazienti.test.mjs`, più `planAssignmentForPatient` in `tests/incassiActions.test.mjs`). `npm run build` pulita. `git diff --check` pulito.
  8. **PR #80** aperta e mergiata su `master` (merge commit `92204a4`) su istruzione diretta del Product Owner.
- NON VERIFICABILE IN QUESTA SESSIONE: QA autenticato end-to-end (caricare un vero estratto conto e vedere l'estrazione AI reale) — nessuna sessione browser autenticata disponibile qui, e ogni chiamata reale alla edge function ha un costo (Claude Haiku 4.5) che non ho voluto generare senza un documento reale da testare. La logica di matching/riepilogo/costruzione pagamenti è invece coperta da test unitari completi.
- VINCOLI RISPETTATI: nessuna scrittura lato server nella edge function (solo estrazione, il salvataggio resta lato client dopo conferma esplicita); nessuna registrazione automatica di pagamenti (ogni riga richiede paziente confermato, e piano se ambiguo); nessuna nuova formula finanziaria; non toccati i file della PR #74; sezione Incassi estesa, non duplicata.
- EXACT NEXT ACTION: Product Owner testa dal vivo "Leggi estratto conto" in Incassi con un vero estratto conto (immagine o PDF) — è la prima verifica end-to-end reale di questa funzione, non ancora fatta da nessuno. Nessun altro lavoro in corso su questo task.

---

# Previous current task

- TASK: POL-FIN-003
- TITLE: Collegamento esplicito pagamento→piano (`payments.piano_id`), sostituisce l'allocazione FIFO di POL-FIN-002
- OWNER: CLAUDE, su richiesta diretta Product Owner. Piano doc committato su questo stesso branch: `claude/piano-collegamento-pagamenti-piano.md`.
- BRANCH: `feature/pagamenti-piano-esplicito` (PR #78, mergiata) — merge commit `1061f9d`.
- STATUS: MERGED — Product Owner ha dato via libera esplicito in chat ad applicare la migration e mergiare ("no vasi e mergia", dopo aver chiesto conferma su una eventuale preview/branch di test). Migration applicata in produzione, `get_advisors(security)` rieseguito, confronto before/after su dati reali eseguito, PR #78 creata e mergiata su `master`. Vedi punto 9 sotto e l'handoff per i dettagli del post-merge.
- CONTESTO: POL-FIN-002 (PR #75) aveva introdotto `get_saldo_piano`/`get_saldi_aperti_studio` con un'allocazione **FIFO per data piano** dei pagamenti di un paziente sui suoi piani, quando `payments` non aveva (e non ha mai avuto) un collegamento esplicito al piano — solo a `paziente_id`. Quella logica era stata validata solo su dati sintetici (`@electric-sql/pglite`), mai su un caso reale di paziente multi-piano parzialmente pagato. Questo task la sostituisce con un collegamento esplicito, eliminando ogni inferenza.
- COSA È STATO FATTO (tutto commit sul branch, non pushato in produzione):
  1. **Migration** `supabase/migrations/20260901120000_pol_fin_003_payments_plan_link.sql` — additiva: `ALTER TABLE public.payments ADD COLUMN piano_id bigint REFERENCES public.plans(id)` (nullable) + indice; backfill automatico solo per pazienti con un unico piano (qualunque stato); ridefinisce `private.incassi_plan_saldo_v1` a somma diretta (`SUM(payments.importo) WHERE piano_id = plan.id AND stato = 'pagato'`) invece della FIFO — `get_saldo_piano`/`get_saldi_aperti_studio` (POL-FIN-002) restano stessa firma/corpo, cambia solo la view sottostante; elimina `private.incassi_patient_paid_v1` (morta, era l'input della FIFO). **Correzione rispetto al doc**: il doc §3 scriveva `piano_id uuid REFERENCES plans(id)` — verificato via `information_schema.columns` su `idklxdqebfceplrualgh` che `plans.id` è `bigint`, non `uuid` (probabile refuso nel doc); la migration usa `bigint`, coerente con le firme esistenti `get_saldo_piano(bigint)`. Nessuna nuova RPC per "pagamenti da assegnare": calcolata client-side (vedi sotto) per non aggiungere superficie server inutile.
  2. **Validazione locale** (Supabase branching risulta disponibile su questo progetto ora, costo ~0.013 $/h, ma il Product Owner ha scelto la stessa via della sessione POL-FIN-002: validazione locale, non un branch a pagamento) — harness `@electric-sql/pglite` in scratchpad (non nel repo) con 5 scenari sintetici (paziente singolo-piano backfillato, paziente multi-piano con pagamento ambiguo che **non** viene assegnato a nessuno dei due piani — a differenza della vecchia FIFO che lo avrebbe dato tutto al piano più vecchio —, paziente multi-piano senza pagamenti, pagamento già esplicito scritto dopo la migration non toccato dal backfill, vincolo FK reale). Tutti gli assert passano.
  3. **RPC/SQL FIFO rimossa** — nessun riferimento residuo alla FIFO in SQL.
  4. **`src/lib/domain/planPaymentAllocation.js` eliminato** (con il suo test `tests/planPaymentAllocation.test.mjs`). `Piani.jsx`'s `removeItemFromPlan` non usa più l'allocazione per-item: ora calcola il totale pagato **a livello di piano** (`payments` con `pianoId` = il piano, `stato='pagato'`) e avvisa solo se rimuovendo la prestazione il nuovo totale del piano scende sotto quanto già incassato (l'eccedenza diventa "acconto libero" — stesso concetto della sezione 2 del doc, a livello di piano non di prestazione).
  5. **Punti di scrittura pagamento** — tutti aggiornati per valorizzare `pianoId` (mappato a `piano_id` in `src/lib/supabase.js`, `FIELD_MAP.payments`):
     - `Piani.jsx`/`SchedaPaz.jsx` "Registra pagamento adesso" su completamento prestazione → `pianoId` = piano già noto dal contesto, automatico.
     - `Incassi.jsx` "Aggiungi da incassare" → `addReceivableToLatestPlan` ora ritorna `{ plans, planId }` (non solo l'array) così il pagamento contestuale eventuale porta il `planId` giusto.
     - `PatientQuickActions.jsx` "Registra pagamento" (dalla scheda paziente, azione generica) e `Pagamenti.jsx` "Registra pagamento studio" (pagina Pagamenti generale) → entrambi generici, nessun contesto prestazione: se il paziente ha **un solo piano attivo** (stato non `concluso`/`rifiutato`, stessa convenzione già usata da `patientWorkspaceRealAdapter.js`/`PatientWorkspaceV2.jsx`) assegnazione automatica; se ne ha **più di uno**, selettore piano obbligatorio (bottone Salva/Registra disabilitato finché non scelto). `PatientQuickActions.jsx` ora riceve `plans={patPlans}` da `SchedaPaz.jsx`.
     - **Fuori scope, deliberatamente**: il flusso AI planner (`ENSURE_PENDING_PAYMENT`/`buildPendingPayment` in `src/lib/poliedron/planner/`) crea pagamenti `stato:'sospeso'` (non `'pagato'`, quindi non entra comunque nel calcolo saldo) senza contesto piano — un singolo importo "pending" può coprire più prestazioni su piani potenzialmente diversi nello stesso comando, quindi non c'è un piano singolo non ambiguo da assegnare automaticamente. Stessa esclusione già applicata dalla sessione POL-FIN-002 all'"AI tool portion". Questi pagamenti, se mai passano a `'pagato'` restando `piano_id NULL` e il paziente ha >1 piano, compariranno comunque in "Pagamenti da assegnare".
  6. **Backfill storico** — nella migration: pazienti con un solo piano → `piano_id` assegnato automaticamente a tutti i loro pagamenti storici; pazienti con più piani → `piano_id` resta `NULL`, esclusi dal saldo, esposti in una nuova sezione "Pagamenti da assegnare" dentro `Incassi.jsx` (KPI contatore N + totale €, lista con selettore piano per riga + bottone "Assegna" che scrive `pianoId` tramite il normale `setPayments` sincronizzato — nessuna nuova RPC, calcolato client-side da `unassignedPaymentsForMultiPlanPatients(payments, plans)` in `incassiActions.js`, sugli stessi array già caricati per studio). Nessuna sezione Incassi duplicata — estesa quella esistente.
  7. **Verifica su dati reali Studio Simondi** (studio_id `00000000-0000-0000-0000-000000000001`, sola lettura, nessuna scrittura): oggi ci sono **2 pazienti multi-piano** — paziente 46 (piani 4/5, "Vaioli"/"Vaioli2", 294€ ciascuno) con 2 pagamenti da 294€ esatti (id 7 e 8, totale 588€ = esattamente la somma di entrambi i piani — sotto la vecchia FIFO risultavano entrambi saldo 0, verificato con `get_saldo_piano` live) — dopo la migration questi 2 pagamenti finiranno in "Pagamenti da assegnare" (nessuna ambiguità di importo, ma nessun modo di sapere quale pagamento fosse per quale piano) finché non assegnati manualmente; paziente 101 (piani 19/20, "Protesi rimovibile"/"Carico immediato", 2000€/3800€) con **zero pagamenti** — nulla da riallocare. **Nessun paziente reale mostra oggi una regressione di saldo** con la nuova logica: il fix è correttivo/preventivo per il caso di pagamento parziale ambiguo multi-piano, che nei dati reali attuali non si presenta ancora.
  8. **Test/build**: 592/592 (nuovi/aggiornati in `tests/incassiActions.test.mjs`: `addReceivableToLatestPlan` ritorna `{plans, planId}`, `buildContextualPayment` porta/non-porta `pianoId`, `isActivePlan`, `unassignedPaymentsForMultiPlanPatients`); `npm run build` pulita (solo warning pre-esistenti su chunk-size); `git diff --check` pulito. `npm ci` è stato necessario per un gap ambientale pre-esistente (node_modules mancante di `jspdf` — già documentato in handoff precedenti, non causato da questo task).
  9. **Apply in produzione + verifica post-merge** (dopo esplicito via libera del Product Owner in chat): `apply_migration` eseguito su `idklxdqebfceplrualgh`. `get_advisors(security)`: **54 finding totali, stesso numero della baseline precedente (52 WARN + 2 INFO), zero nuovi, nessuno relativo a `payments`/`plans`/`piano_id`/`incassi_plan_saldo_v1`/`get_saldo_piano`/`get_saldi_aperti_studio`**. Confronto reale post-migration su Studio Simondi: paziente 46 → entrambi i piani ora mostrano correttamente `totale_pagato: 0`, `saldo_piano: 294` (erano 0/0 sotto la vecchia FIFO) — i 2 pagamenti da 294€ sono `piano_id NULL`, esclusi dal saldo ed esposti in "Pagamenti da assegnare" com'era previsto, nessun pagamento cancellato; paziente 101 invariato (zero pagamenti). **Scoperta aggiuntiva in fase di verifica** (non un difetto introdotto da questo task, comportamento identico a prima): 6 pazienti di Studio Simondi (id 1, 20, 45, 70, 73, 76) hanno pagamenti registrati ma **zero piani** — questi pagamenti erano già esclusi da ogni saldo per-piano sotto la vecchia FIFO (che operava comunque per piano, via `incassi_plan_totals_v1`) e restano esclusi ora; correttamente **non** compaiono in "Pagamenti da assegnare" (quel worklist è per pazienti con **più** di un piano — con zero piani non c'è nulla a cui assegnare il pagamento, non è un caso di ambiguità ma di assenza di piano). Sanity check integrità dati: 18 pagamenti totali in produzione, 8 assegnati dal backfill automatico, 10 rimasti `piano_id NULL` (2 del paziente 46 + 8 dei 6 pazienti senza piani) — nessun pagamento perso o duplicato.
  10. **PR #78** aperta e mergiata su `master` (merge commit `1061f9d`) su istruzione diretta del Product Owner.
- VINCOLI RISPETTATI: nessuna cancellazione di pagamenti in nessun flusso; non toccati i file della PR #74 (`src/lib/quickActionsCatalog.js`, parte "azioni rapide" di `Impostazioni.jsx`); sezione Incassi estesa, non duplicata; niente lavoro sul branch/task di un altro agente.
- EXACT NEXT ACTION: Product Owner verifica in produzione la nuova sezione "Pagamenti da assegnare" in Incassi (in particolare i 2 pagamenti del paziente 46) e, quando comodo, i 6 pazienti con pagamenti-ma-zero-piani emersi durante la verifica (comportamento pre-esistente, segnalato qui per trasparenza, non un'azione bloccante). Nessun ulteriore lavoro in corso su questo task.

---

# Previous current task

- TASK: POL-FIN-002 (+ follow-up fix)
- TITLE: Modulo Incassi / Da incassare — MERGED, plus a Product-Owner-reported follow-up fix
- OWNER: CLAUDE. POL-FIN-002 itself was implemented by a prior Claude session that handed off to CODEX (see the full detailed record preserved below, unedited); this Claude session independently re-verified it end to end before merging, then fixed a Product Owner bug report on top.
- STATUS: MERGED
  1. **PR #75** ("POL-FIN-002 — Modulo Incassi e gestione Da incassare", branch `feature/modulo-incassi`) — merged to `master` by explicit Product Owner instruction, merge commit `6c76cf0`. Before merging, this session independently re-verified everything rather than trusting the handoff record alone: confirmed the migration (`pol_fin_002_incassi_saldo_piano`) is genuinely applied in production (`list_migrations` on `idklxdqebfceplrualgh`); read the full SQL and confirmed it's additive-only with a preflight guard, `security_invoker=true` views, `REVOKE ALL FROM PUBLIC,anon` + `GRANT` to `authenticated` only; confirmed both new RPCs are `SECURITY INVOKER` (`prosecdef=false`, queried directly) and that `public.plans`/`public.payments` both have RLS enabled with a studio-scoped policy — so `get_saldo_piano` is safe even without an explicit per-call tenant check, since it inherits the underlying tables' RLS; re-ran `get_advisors(security)` and confirmed zero new findings on any `incassi`/`saldo_piano`/`saldi_aperti` object; independently ran the full suite (589/589, matching the Product Owner's own report, not the PR body's stale "538") and a clean production build. One non-blocking observation recorded: `src/lib/domain/planPaymentAllocation.js` (used only for the plan-item removal warning text, never mutates data) reimplements the same patient→plan FIFO allocation client-side to get item-level granularity the RPC doesn't expose — if the SQL formula ever changes this needs a matching manual update. The AI tool portion (`agente-assistente` `segna_prestazione_eseguita`) correctly stayed out of scope — its edge-function source is not in this repository.
  2. **PR #76** ("Fix: checkbox 'Registra pagamento adesso' mancante in Scheda Paziente", branch `fix/scheda-paz-quick-payment-checkbox`) — merged to `master` by explicit Product Owner instruction, merge commit `a041dc9`. Product Owner reported the quick-payment checkbox never appeared when completing a treatment from the patient record. Root cause: that UI was only wired into `Piani.jsx`'s plan-item rendering; `SchedaPaz.jsx` has its own separate, older rendering of the same plan items (kept distinct because it also runs a richiamo auto-detection side effect `Piani.jsx`'s flow doesn't have) and never received the same checkbox. Fixed by adding the same quickOffer/quickPayment UI to `SchedaPaz.jsx`, reusing its existing `setPayments` prop, preserving the richiamo auto-detection untouched, and fixing a real timing bug along the way (the "just executed" flag is now computed from the current render's own state via a `wasEseguita` argument, not as a side effect written inside `setPlans`'s updater, which React does not guarantee runs synchronously). 591/591 tests (2 new), build and `git diff --check` clean.
- EXACT NEXT ACTION: Product Owner QAs both fixes live (production, since both are merged) — the checklist given in chat covers the three-value saldo model, the Incassi worklist, "Aggiungi da incassare", editable plans with safe removal, and now the "Registra pagamento adesso" checkbox from the patient record specifically. No further work in flight on this task; do not start unprompted follow-ups.

---

# Historical record: POL-FIN-002 original implementation (see STATUS above — merged as PR #75)

- TASK: POL-FIN-002
- TITLE: Modulo Incassi / Da incassare (saldo piano, eseguito, acconto)
- OWNER: CLAUDE (handing off to CODEX — session token budget reached). Direct Product Owner request in-session; plan doc committed at `claude/piano-modulo-incassi-da-incassare.md` on this branch.
- BRANCH: `feature/modulo-incassi`
- BASE: `origin/master@05ee761` (merge PR #73)
- STATUS: IN_PROGRESS — steps 1/8 through 5/8 DONE; step 6 UI and step 7 quick payment DONE; live AI tool portion of step 6 BLOCKED by absent authoritative edge-function source/contract; final preview validation remains.
- OBJECTIVE: fix "da incassare" showing a plan's executed total without subtracting payments already received (reported real case: patient Lauretti Giacomo, plan 1.400€, 700€ eseguito shown as owed while 900€ was already paid — real saldo is 500€). Implement the three-value model (saldo_piano / eseguito_non_pagato / acconto) end to end per `claude/piano-modulo-incassi-da-incassare.md` sections 2-9.

## Completed so far

1. **Migration** `supabase/migrations/20260829180000_pol_fin_002_incassi_saldo_piano.sql` — additive only (new `private.incassi_plan_totals_v1`/`incassi_patient_paid_v1`/`incassi_plan_saldo_v1` views + `public.get_saldo_piano(bigint)`/`public.get_saldi_aperti_studio(uuid)` RPCs). Does NOT touch the existing POL-003 canonical financial engine (`financial_*_v1`, `get_financial_snapshot_v1`) — that engine is a studio-period P&L/KPI snapshot at a different granularity, confirmed dormant (its legacy adapter has never been run in production), so nothing collides.
   - **Design decision (confirmed with Product Owner in-session, see chat transcript)**: `public.payments` has no plan/piano FK (only `paziente_id`) — a payment is not tied to one specific plan. When a patient has more than one plan, that patient's paid total is allocated to their plans **FIFO by plan date, oldest first**. Reduces exactly to `totale_piano - totale_pagato` for the single-plan case. Sum of `saldo_piano` across a patient's plans always reconciles to the patient aggregate.
   - `totale_piano`/`totale_eseguito` reuse `Piani.jsx`'s exact discount formula (`sub`, `scontato = pct ? sub*sc/100 : LEAST(sc,sub)`, `finale = GREATEST(0, sub-scontato)`), applied proportionally to the executed-only subtotal too.
   - Only `payments.stato='pagato'` counts as collected (`'sospeso'` = owed-not-collected, per `src/lib/domain/paymentService.js`'s existing convention) — this is a deliberate, documented divergence from `Pagamenti.jsx`'s/old `SchedaPaz.jsx`'s legacy `saldoPaz` formula (which summed all payments regardless of `stato`); on Studio Simondi's real current data the two happen to coincide (no non-`pagato` rows exist there today), verified below.
   - **Applied directly to production** (`idklxdqebfceplrualgh`) via `apply_migration` — Supabase branching is NOT available on this project's plan (`create_branch` returns `PaymentRequiredException: Branching is supported only on the Pro plan or above`), so the "test on a Supabase branch first" step from the runbook could not literally happen. Instead: validated with 19 synthetic assertions against an isolated local Postgres (`@electric-sql/pglite`, zero contact with production) covering the exact Lauretti case, multi-plan FIFO, both discount types, `sospeso`-payment exclusion, malformed/empty `voci`, and cross-studio isolation — all passed. Then applied to production only after explicit Product Owner go-ahead (`AskUserQuestion`, answer: "Applica ora in produzione"). `get_advisors(security)` run immediately after: 52 WARN + 2 INFO, zero mentioning any `incassi`/`saldo_piano`/`saldi_aperti` object — no new security findings.
   - **Old-vs-new comparison on Studio Simondi's real active plans** (studio_id `00000000-0000-0000-0000-000000000001`, "Dott. Luca Simondi") run directly via `execute_sql`: all 11 patients with plans reconcile exactly between the legacy patient-level aggregate and the new per-plan-summed `saldo_piano`, including patient 12 — the real production analogue of the Lauretti case (dovuto 1400, pagato 900, saldo 500, matches the plan doc's worked example exactly). Only one patient (46) has 2 plans in this real dataset, both fully paid — FIFO correctness for a genuinely partial multi-plan case is only proven by the synthetic PGlite tests, not by real data (there wasn't a real example of it).
   - Local-only test harness used for validation lives at `/tmp/.../scratchpad/pgtest/test.mjs` (NOT in the repo — session scratchpad, will not survive; re-derive from the migration file + the assertions described above if you want to re-run it).
2. **Scheda paziente widget** (`src/components/SchedaPaz.jsx`, `tab === 'paga'`): "Situazione finanziaria" card redesigned to the three-value model (red "Da incassare" primary number, "Eseguito non pagato"/"Acconto" secondary tiles, raw eseguito+pagato footer); "Dettaglio per piano" now shows each plan's own `saldo_piano`/`eseguito_non_pagato`/`acconto` instead of the old un-netted `plEseg`/`plDaFare`. Header stat badges ("Pagato"/"Da pagare") also switched to the new aggregate.
   - **Important architectural constraint discovered and respected**: `tests/patientRecordRecovery.test.mjs` asserts `SchedaPaz.jsx`'s source text does NOT match `/useEffect|supabase\.|Promise\.all/` and does NOT import from `../lib/supabase` — a regression guard from the POL-UI-PATIENT-FREEZE-PROD incident (patient record hanging indefinitely on PWA clients when this component did async work itself). So `SchedaPaz.jsx` receives a `saldiPiani` PROP (a plain `{[pianoId]: get_saldo_piano row}` map) — it does no fetching itself. `src/App.jsx` does the actual fetch (new `useEffect` keyed on `[schedaDashPaz?.paz?.id, plans, payments]`, calling `fetchSaldiPiani` from the new `src/lib/domain/incassiService.js`) and passes `saldiPiani={saldiPiani}` down through `PatientWorkspaceBoundary` (which already spreads `{...props}` to `SchedaPaz`, no change needed there).
   - New files: `src/lib/domain/incassiService.js` (I/O: `fetchSaldoPiano`/`fetchSaldiPiani`/`fetchSaldiApertiStudio`, imports `supabase`) and `src/lib/domain/incassiMath.js` (pure: `aggregateSaldi`, NO imports — this is what `SchedaPaz.jsx` imports, to respect the regression guard both in letter and spirit).
   - Full test suite 526/526 passing, production build clean (`npm run build`).

3. **"Incassi" section** (§4): implemented once in `src/components/Incassi.jsx` and exposed both as the `incassi` app page/navigation entry and as the sixth tab in `ControlloGestione.jsx`. It reads only `get_saldi_aperti_studio`, shows Incassato for month/year and the canonical total open balance, persists the studio-scoped sort preference, and opens the selected patient's Pagamenti tab. Dedicated tests 5/5; full suite 531/531; build passed.

4. **"Aggiungi da incassare" form** (§5): added to the shared Incassi surface with patient search, already-loaded pricelist/free-item toggle, description/amount, "Già eseguita" default-on, optional contextual collected payment and live remaining balance. A pure `incassiActions.js` helper appends to the patient's most recent plan or creates a normal "Prestazioni occasionali" plan through `buildNewPlan`; it deliberately does not change the AI planner's separate ambiguity-safe `pickTargetPlanForNewItem` contract. The form writes only through App's existing sync setters. Full suite 534/534; production build passed with the pre-existing duplicate `chat` icon warning.
5. **Piani always editable + removal warning** (§6): every saved plan now exposes "+ Aggiungi prestazione" with free/listino entry and a touch-sized removal control on each item. Removal computes the explanatory collected quota with the canonical patient-to-plan FIFO allocation and proportional plan discount, then item order; if positive it warns that the amount becomes a free advance and explicitly states the payment will not be deleted. Payments are read-only in this flow. Full suite 536/536; build passed.
6. **Execution UI + quick payment** (§7-8 UI): each treatment row now has an inline Da eseguire/Eseguita selector. Completion calls the existing shared `markTreatmentItemCompleted` domain action. After completion an optional "Registra pagamento adesso" checkbox opens a compact form with editable amount, date and method and writes a normal paid payment through App's existing sync setter. Full suite 538/538; build passed.

## NOT started (remaining sections of `claude/piano-modulo-incassi-da-incassare.md`)

6. **AI tool only** (§7): new live `agente-assistente` tool `segna_prestazione_eseguita`. The edge function's server-side source is not in this repository, so its schema/deployment cannot safely be authored here or guessed. Requires the authoritative live function project/contract and separate production deployment authority.
8. **Final validation**: re-run `get_advisors(security)` after any further migration; Vercel preview manual QA (golden path + edge cases in an actual browser — not done yet, no preview deployed); final `npm test`/`npm run build`; update this file + append a handoff entry per section below when each remaining piece lands.

## Explicit constraints (unchanged, still binding)

- Do NOT touch PR #74's files: `src/lib/quickActionsCatalog.js`, the "azioni rapide" part of `src/components/Impostazioni.jsx` — separate branch/task in flight.
- No silent deletion of already-registered payments in any flow.
- No regression on Studio Simondi — re-verify against real active plans before any merge to `master`.
- Do not merge without Product Owner approval. Do not open a PR unless explicitly asked (not asked yet).
- Runbooks `runbook-sviluppo-sicuro.md`/`runbook-rls-nuove-tabelle.md` referenced by the plan doc do **not exist in this repository** (confirmed via `find`/`Glob`) — they live only in the Product Owner's external "Poliedra Soft" Claude Project. This session followed `AGENTS.md`'s own embedded safety rules plus this repo's actual `docs/runbooks/*.md` and existing migration house style instead of inventing their content.

## Exact next action

Push the completed UI workflow, then perform final preview validation. The AI tool remains an explicit external blocker; do not guess its live schema. Do not merge without Product Owner approval.
---

# Integrated master task (PR #74, preserved)
- TASK: POL-UI-017 — ROUND 6
- TITLE: Product Owner follow-up on Round 5 — Ricetta module must open above the dock, plus inline "create new patient" in the Ricetta picker
- OWNER: CLAUDE, on direct Product Owner feedback
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Rounds 2-5 — PR #74, no new PR opened)
- BASE: Round 5's own commit `7acd92a` on this branch
- STATUS: MERGED — PR #74 merged to `master` by explicit Product Owner instruction ("mergia in master"), merge commit `bbae1226`. `master` is now at `bbae1226`, containing all of POL-UI-017 Rounds 1-6.
- OBJECTIVE: two asks in one message. (1) "il modulo ricetta deve essere aperto piu in alto del dock" — the floating Poliedron dock/orb (z-index 1100/1200) was rendering ABOVE DocMedico (z-index 500), covering its content; Round 5's scroll-position fix didn't address this, it's a stacking-order bug, not a scroll one. (2) The Ricetta patient picker (Round 4) needs a free-text field to create a brand-new patient (name/surname) on the spot, which then creates the patient and opens Ricetta for them immediately.
- WHAT SHIPPED:
  - §1 z-index fix — `DocMedico.jsx`'s root overlay raised from `zIndex: 500` to `9999`, the same tier this app's own `Modal.jsx` already uses for a real full-screen takeover — clears the dock (1100), the orb/edge-dock (1200) and the Poliedron command panel (1300/1301). `SchedaPaz.jsx`'s matching Suspense loading fallback ("Caricamento editor ricetta…") raised the same way, so there's no flash of the spinner appearing under the dock before the real screen appears above it.
  - §2 inline patient creation — the Ricetta picker's `SelettorePaziente` now also receives `onCreaPaziente`, wired to a new `creaPazienteRapidoRicetta(nome, cognome)` in `Dashboard.jsx` that is a straight port of `Agenda.jsx`'s own existing `creaPazienteRapido` (same `uid()`-based optimistic local record, same `features.max_pazienti` plan-limit fail-closed guard, same "no results while typing → inline Nome/Cognome create form" UX `SelettorePaziente` already ships for Agenda/Piani/ArchivioDocs) — no new patient-creation logic invented. Handles the one real subtlety: `SelettorePaziente` calls `onChange(id)` synchronously right after `onCreaPaziente` returns, before the `setPatients` update has flushed into a re-render, so a plain `patients.find(...)` would miss the brand-new record — closed with a `ricettaJustCreatedRef` holding the just-created object for that one call. `App.jsx` now passes `setPatients={setPatientsSync}` into `Dashboard` (previously read-only there) — Dashboard's own toast state was renamed `comingSoonMsg`→`homeToastMsg` since it now also confirms "Paziente ... creato ✓", not only the round-3 "Da incassare" placeholder.
- FILES CHANGED (round 6): `src/App.jsx`, `src/components/Dashboard.jsx`, `src/components/DocMedico.jsx`, `src/components/SchedaPaz.jsx`, `tests/mobileHomeRound2.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 577/577 (3 new assertions); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA — same constraint as prior rounds.
- EXACT NEXT ACTION: PR #74 is merged. Product Owner verifies the live behavior in production (or the next preview) at their convenience — confirms Ricetta opens fully above the dock, and that typing a not-yet-existing patient's name/surname in the picker creates them and opens Ricetta immediately. No further POL-UI-017 work is in flight; do not start a Round 7 or any new work on this branch unless explicitly instructed — the branch is merged and its purpose is complete.
- MERGE NOTE: this session did not independently trigger a production deployment — merging to `master` was performed via explicit Product Owner instruction. Whether Vercel's own GitHub integration auto-deploys `master` to production is a pre-existing project configuration outside this session's control; not separately verified here.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 5
- TITLE: Product Owner follow-up on Round 4 — "il tab ricetta deve essere aperto più in alto"
- OWNER: CLAUDE, on direct Product Owner feedback
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Rounds 2-4 — PR #74, no new PR opened)
- BASE: Round 4's own commit `0d5a6e8` on this branch
- STATUS: SUPERSEDED BY ROUND 6 ABOVE — round 5's own record kept verbatim below for audit history.
- OBJECTIVE: Round 4 made "Ricetta" open DocMedico's Ricetta tab directly, but on a phone the actual "Farmaci prescritti" fields sit below two full cards (the 6-option "Tipo documento" selector + "Data documento"), i.e. below the fold — the Product Owner asked for it to open "more toward the top".
- WHAT SHIPPED: `src/components/DocMedico.jsx` — when it opens with `initialType === 'ricetta'` (true for the Home quick action, the pre-existing "Nuova ricetta" button inside the patient's Doc tab, and the Poliedron prescription workflow — all three set it identically, so all three benefit), a mount-only effect scrolls the "Farmaci prescritti" section into view immediately, so it is the first thing visible under the header instead of requiring a scroll past the type selector. The type selector itself is not hidden or removed — scrolling up still reaches it to change type. No change to any other document type's behavior, no change to persistence/`useFormPersistente`, no change to `puoiPrescrivere` gating.
- FILES CHANGED (round 5): `src/components/DocMedico.jsx`, `tests/mobileHomeRound2.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 574/574 (1 new source-level regression test); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA — same constraint as prior rounds; the exact scroll offset/feel on a real phone still needs the Product Owner's own device.
- EXACT NEXT ACTION: Product Owner re-tests the redeployed PR #74 preview — confirms the Ricetta fields appear near the top on open. Do NOT merge/deploy without approval. Do not start Round 6 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 4
- TITLE: Product Owner follow-up on Round 3 — "Ricetta deve aprire il tab ricetta, non paziente"
- OWNER: CLAUDE, on direct Product Owner feedback
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Rounds 2-3 — PR #74, no new PR opened)
- BASE: Round 3's own commit `8cb70f0` on this branch
- STATUS: SUPERSEDED BY ROUND 5 ABOVE — round 4's own record kept verbatim below for audit history.
- OBJECTIVE: the Ricetta quick action landed only on the Pazienti list (Round 3), leaving the user to find the patient, then the Doc tab, then the Ricetta type manually. Make it land directly on DocMedico's Ricetta tab for the picked patient.
- WHAT SHIPPED: Home has no current patient, so a pick is still required — but it now goes straight to the target instead of a dead-end list. New inline patient picker (`SelettorePaziente` in a `Modal`, same pattern the existing "Nuova attività" modal already uses), opened via a new `openRicettaPicker` context hook on the Ricetta quick action; on selection it calls `onOpenPaz(paz, 'doc', { type: 'ricetta' })`. `App.jsx`'s `goSchedaPaz` gained an optional 3rd `documentRequest` argument (default `null`, every existing 2-arg call site unaffected) forwarded into the SAME `initialDocumentRequest` prop `SchedaPaz.jsx` already consumes for the Poliedron prescription workflow — this is a second caller into existing, unmodified `SchedaPaz`/`DocMedico` plumbing (including `DocMedico`'s own unchanged `puoiPrescrivere` licensing gate), nothing new was built. Consenso was left unchanged (still navigates to Pazienti) — not raised in this feedback round; same underlying limitation, noted rather than silently changed.
- FILES CHANGED (round 4): `src/App.jsx`, `src/components/Dashboard.jsx`, `src/lib/quickActionsCatalog.js`, `tests/mobileHomeRound2.test.mjs`, `tests/quickActionsCatalog.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 573/573 (4 new assertions); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA — same constraint as prior rounds.
- EXACT NEXT ACTION: Product Owner re-tests the same PR #74 preview once Vercel redeploys — confirms tapping Ricetta, picking a patient, lands directly on the Ricetta form. Do NOT merge/deploy without approval. Do not start Round 5 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 3
- TITLE: Product Owner live-preview feedback on Round 2 — Setup dock clearance hardening, quick-action icon/label fixes, three new quick actions
- OWNER: CLAUDE, on direct Product Owner feedback after testing the R2 preview
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn` (same branch/PR as Round 2 — PR #74, no new PR opened)
- BASE: Round 2's own commit `94bc651` on this branch
- STATUS: SUPERSEDED BY ROUND 4 ABOVE — round 3's own record kept verbatim below for audit history.
- OBJECTIVE: a fourth round of Product Owner feedback on the same live PR #74 preview, addressing four points: (1) harden the `.page-dock-clearance` pattern Round 2 already introduced for Impostazioni so it is byte-parallel to `.home-dock-clearance` in both mobile media queries, closing any doubt that a long Setup section could end up under the floating dock; (2) fix the "Documento" quick action rendering with no icon; (3) remove a literal "+" prefix baked into several quick-action labels; (4) add three new quick actions (Ricetta, Consenso, Da incassare) on the same catalog infrastructure.
- WHAT SHIPPED:
  - §1 Dock clearance hardening — `.page-dock-clearance` was already added in Round 2's own last commit (`94bc651`) and applies unconditionally to Impostazioni (rendered once, outside every `sezione`-gated block, so it covers every Setup tab, not only the new "Azioni rapide" one). Re-verified structurally correct (base `display:none`, `display:block` inside the canonical `(max-width:719px), (pointer:coarse)…` query, no later override resets it) and hardened for full parity: it is now ALSO declared `display:block` inside the legacy `@media (max-width:600px)` block, exactly mirroring `.home-dock-clearance`'s own dual declaration, removing any remaining doubt.
  - §2 Icon fix — `Ic.jsx`'s `ICONS` map has no `doc` key, so the "Documento" quick action (`ic: 'doc'`) silently rendered nothing (not a "+" fallback — `Ic` returns `null` for an unknown key). Changed to `ic: 'file'`, the same generic-document icon `DocMedico.jsx`'s own "Foglio bianco intestato" type already uses for the identical concept. New regression test reads the real `Ic.jsx` icon registry and asserts every catalog `ic` id is a real key, so a future typo'd icon id fails the suite instead of rendering blank.
  - §3 "+" removed — the "+" the Product Owner saw was NOT an icon-missing fallback (confirmed distinct from §2 by reading the code): it was a literal `'+ '` text prefix baked into several `QUICK_ACTIONS_CATALOG` labels (Nuovo appuntamento, Nuovo paziente, Paziente e appuntamento, Nuovo preventivo, Nuova spesa, Documento, Task). Removed from all of them; the actions/ids/gates/`run()` handlers are unchanged, only the display string.
  - §4 Three new quick actions, same infrastructure, nothing invented: **Ricetta** (`ic:'pill'`, the exact icon `DocMedico.jsx`'s own TIPI list already uses for `id:'ricetta'`) and **Consenso** (`ic:'edit'`) both land on Pazienti first (`run: (ctx) => ctx.onNavigate('paz')`), the same "patient-scoped, no target patient from Home" fallback `nuovo_paziente_appuntamento`/`nuova_seduta_fisio` already use — from there the existing, unmodified SchedaPaz "Doc" tab (DocMedico for Ricetta, its own `puoiPrescrivere` gate untouched; `consenso_modelli`/`PannelloInvioDocumento` for Consenso) takes over unchanged. **Da incassare** (`ic:'eur'`, the same icon this file's own "Eseguito da incassare" modal already uses for the identical concept) is an explicit, honest placeholder per Product Owner instruction — the real receivables module is separate, still in development, and a doc named `piano-modulo-incassi-da-incassare.md` referenced in the feedback was searched for and does NOT exist in this repository (recorded here for transparency; the Product Owner's own instruction to build a placeholder now stood regardless and did not require that doc). The placeholder calls a new `openComingSoon(msg)` hook on the quick-action context — wired in `Dashboard.jsx` as a small `comingSoonMsg` state rendering the SAME shared `Toast` component `Impostazioni.jsx` already uses (no new UI primitive) — never a fake navigation. None of the three new actions were added to `DEFAULT_QUICK_ACTION_IDS`: they appear in "Personalizza azioni rapide" as addable, exactly like `documento`/`nuova_spesa`/`controllo_gestione` already do, with no change to what shows without configuration.
- SAFETY BOUNDARIES HONOURED: same as Round 2 (see below) — no schema/RLS/financial-formula/business-logic/Chat-persistence change; `git diff` shows zero changes to the Poliedron engine/dock-geometry files; no widget id added or removed; Home's personalization save/load path untouched. The three new quick actions reuse existing pages/tabs/gates (Pazienti, DocMedico, consenso_modelli) — no new route, no new table, no new RPC.
- FILES CHANGED (round 3, in addition to round 2's own list below): `src/lib/quickActionsCatalog.js`, `src/components/Dashboard.jsx`, `src/components/PremiumVisualSystem.css`, `tests/mobileHomeRound2.test.mjs`, `tests/quickActionsCatalog.test.mjs`, this file, `docs/coordination/handoffs.md`.
- VALIDATION: full `npm test` 570/570 (6 new assertions in `quickActionsCatalog.test.mjs`, 4 new in `mobileHomeRound2.test.mjs`); `npm run build` clean; `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA on a real device or preview — same constraint as Round 2, no authenticated session available here. The dock-clearance hardening and icon fix are argued from source/stylesheet-level regression tests, not a live rendering.
- EXACT NEXT ACTION: Product Owner re-tests the same PR #74 preview (new commit on the same branch, same URL once Vercel redeploys) — confirms Setup no longer clips under the dock on a real phone, "Documento" shows its icon, no quick action shows a "+", and Ricetta/Consenso/Da incassare appear correctly in "Personalizza azioni rapide". Do NOT merge and do NOT deploy without explicit Product Owner approval. Do not start Round 4 unprompted.

---

# Previous current task

- TASK: POL-UI-017 — ROUND 2
- TITLE: Mobile Home and navigation refresh (action-first Home, priority area, progressive-disclosure quick actions, dock/bell audit)
- OWNER: CLAUDE
- BRANCH: `claude/pol-ui-017-mobile-home-r2-3pizhn`
- BASE: `origin/master@05ee761` (merge PR #73, POL-UI-017 R1 — mobile foundation and shell)
- STATUS: SUPERSEDED BY ROUND 3 ABOVE — round 2's own record kept verbatim below for audit history.
- OBJECTIVE: make the mobile Home an OPERATIONAL HOME rather than a stack of boxes — a compact branded hero, a real "Richiede attenzione" priority area built only from data the Home already holds, quick actions with the most frequent at the first level and the rest behind "Altro", a today-oriented band, and the existing informational/financial widgets demoted to a hierarchically secondary position. Scope is strictly mobile Home + mobile navigation + the visual integration between Home and the dock, built ON TOP of the Round 1 foundation (`MobilePageShell`, `mobileShell.js`, `designTokens.css`) rather than replacing it.
- WHAT SHIPPED:
  - §1 Hero — one compact sticky row on mobile (brand gem + greeting + date/time/appointment count) instead of three stacked lines with clamp(25px,3vw,32px) display type.
  - §2 Priority area — new `.home-attention` page chrome above the widget workspace, driven by the new pure selector `src/lib/homeAttention.js`. Sources, all pre-existing: open/overdue `richiami` (same `stato === 'da_fare'` + `dataScadenza` rule the Richiami widget uses), overdue payment deadlines from `useControlloDati` (only when `homePermissions.managementControl` is true), overdue patient-annotation promemoria, the next not-yet-passed appointment from today's list, and unread Poliedron advice. Capped at 4 rows; empty state is ONE compact "Tutto sotto controllo" line, never a large empty box.
  - §3 Quick actions — `partitionQuickActionsForMobile()` in `quickActionsCatalog.js` surfaces Nuovo appuntamento / Nuovo paziente / Pagamento / Richiamo first and moves the rest behind an "Altro (N)" toggle, mobile-only. A user who set their own order in Personalizza Home keeps it verbatim.
  - §4/§5 Hierarchy — mobile-only CSS priority banding on `.home-workspace .home-widget-frame[data-widget-id=…]`: actions (10) → today (20) → operational (30) → overview (40) → deeper detail (50). The persisted layout is untouched; DOM order remains the user's saved order and still decides within each band.
  - §7 Dock — the active slot's contrast was raised (11%→18% wash, 18%→34% border, plus a small ink bar). BUG FIXED: `.home-dock-clearance`, `.home-page` padding and the compact hero were gated on `@media (max-width: 600px)`, so every coarse-pointer landscape phone (844x390, 852x393, 932x430) and every 601–719px viewport — all of which the React shell already treats as mobile and therefore still shows the floating dock — lost the clearance entirely and rendered the last widget underneath the dock. Home now uses the Round 1 canonical mobile media query.
  - §8 Bell — was a 40x40 target, below the Round 1 44px touch floor; raised to `var(--pol-touch-min)`. Position, destination, unread architecture and the "no duplicate badge on the dock's Chat slot" rule are unchanged.
  - §9 Personalizza Home — a discreet 44x44 icon button on mobile (label visually hidden, aria-label/title kept). Save/load logic untouched.
- SAFETY BOUNDARIES HONOURED: no schema, migration, RLS, RBAC, financial-formula, business-logic or Chat-persistence change. `git diff` shows ZERO changes to `PoliedronOrb.jsx`, `usePoliedronPosition.js`, `usePoliedronEdgePosition.js`, `poliedronDragMath.js`, `poliedronSafeBounds.js`, `poliedronOrbSize.js`, `poliedronMobileDock.js`, `PoliedronMobileDock.jsx` and `PoliedronBell.jsx` — the Poliedron engine, the orb's size/position/drag and the dock's structure/slots/destinations/geometry are all untouched. No new quick action, no new widget id, no new alert for data that does not already exist, no second AI panel. Home's personalization save/load path (`homeLayoutPersistence.js`, the `layoutSaveEpochRef` stale-write guard, `draftInherits` semantics) is byte-for-byte unchanged. Desktop Home is not redesigned: every added surface is `display: none` outside the mobile media query.
- FILES CHANGED: `src/components/Dashboard.jsx`, `src/components/PremiumVisualSystem.css`, `src/lib/quickActionsCatalog.js`, new `src/lib/homeAttention.js`, new `tests/mobileHomeRound2.test.mjs`, `docs/coordination/current-task.md`, `docs/coordination/handoffs.md`.
- VALIDATION: new dedicated suite 38/38; full `npm test` 564/564; `npm run build` clean (only the pre-existing chunk-size warnings); `git diff --check` clean.
- NOT VERIFIABLE: authenticated runtime/visual QA on a real device or preview — no authenticated session is available in this environment and none was requested or used. Responsive behaviour is argued from the stylesheet and the Round 1 shell contract, not from a live rendering.
- EXACT NEXT ACTION: Product Owner reviews the PR ("POL-UI-017 R2: mobile Home and navigation refresh") and QAs the mobile Home on a real phone at 375x667, 390x844 and 430x932 portrait plus 844x390 landscape. Do NOT merge and do NOT deploy without explicit Product Owner approval.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE-MOBILE-OPEN-FIX
- TITLE: Patient record Documenti/Ricette — Apri/Stampa still didn't open on mobile after POL-DOC-ARCHIVE-OPEN-FIX
- OWNER: CLAUDE, on direct Product Owner report: in the patient record's Documenti tab, archived documents and ricette list correctly and open/download fine in the general Documenti (archivio) section, but on mobile specifically, opening/printing one from inside the patient record still shows nothing. Desktop works.
- BRANCH: `claude/mobile-recipes-docs-visibility-v9hk10`
- BASE: `origin/master@a34b4a0` (merge PR #70, which shipped POL-DOC-ARCHIVE-OPEN-FIX)
- STATUS: MERGED (PR #71, merge commit `070b28f`) — this file still recorded it as `IMPLEMENTED_AWAITING_PRODUCT_OWNER_QA` long after the merge landed; corrected during POL-UI-017 R2, see the handoff entry for the audit note.
- OBJECTIVE: make Apri/Stampa in `PatientWorkspaceDocuments.jsx` (the patient record's Documenti/Ricette tab, mounted by `SchedaPaz.jsx`) actually display the archived PDF on mobile, without touching the archive list/metadata loading, RLS, schema, or the working `ArchivioDocs.jsx` (general Documenti page) behavior.
- ROOT CAUSE: PR #70's fix made `apriPdf()` convert the `data:` URI to a `blob:` URL before `window.open()`, which fixed the previous data-URI-blocking bug, but `PatientWorkspaceDocuments.jsx` calls it from inside `withPdf()` — an `async` handler that `await`s a Supabase fetch (`loadPatientDocumentPdf`) before ever calling `apriPdf`/`window.open`. Desktop browsers tolerate `window.open()` shortly after an awaited gap tied to a click; mobile Safari/Chrome do not — they require the new-tab open to happen synchronously inside the original tap's call stack, otherwise it is silently blocked with no error and no fallback (`apriPdf`'s null-popup fallback never fires because mobile browsers return a non-null, permanently blank window instead of `null`). This is exactly why the general Documenti page (`ArchivioDocs.jsx`) already worked fine on mobile: its `visualizzaDoc()` also awaits the PDF fetch, but instead of `window.open` it opens the in-app `PdfViewerModal` (a `pdf.js`-based full-screen viewer, no new tab/window involved at all) — the same component `PannelloInvioDocumento.jsx` already uses for the fresh "Genera PDF" preview.
- FIX: `PatientWorkspaceDocuments.jsx` no longer imports/calls `apriPdf`/`window.open`. Both "Apri" and "Stampa / PDF" now call one `viewPdf(document)` that, once the PDF is fetched, opens the same lazy-loaded `PdfViewerModal` (with its existing Condividi/Scarica actions) used by `ArchivioDocs.jsx` and `PannelloInvioDocumento.jsx` — no new PDF viewer/backend was invented.
- SAFETY: no migration, database, RLS, Storage, dependency or financial formula change. Document/prescription list, metadata loading, and the general Documenti (`ArchivioDocs.jsx`) page are untouched. `src/lib/condivisionePdf.js`'s `apriPdf`/`scaricaPdf` are untouched and still used elsewhere.
- VALIDATION: dedicated test 11/11 (`tests/patientWorkspaceDocuments.test.mjs`, new regression test added); full suite 516/516; production build passed; `git diff --check` clean.
- EXACT NEXT ACTION: push the branch, then Product Owner confirms on an actual phone that Apri/Stampa in the patient record's Documenti tab display an archived document/ricetta. Do not merge without Product Owner approval.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE-OPEN-FIX
- TITLE: Patient document archive — fix Apri/Stampa showing no document
- OWNER: CLAUDE, on direct Product Owner report after PR #69 merged (`281f2da`): archived documents now list correctly, but opening/printing one shows no document.
- BRANCH: `claude/merge-pr-69-master-u1o2fn`
- BASE: `origin/master@281f2da` (merge PR #69)
- STATUS: MERGED (PR #70, merge commit `a34b4a0`) — fix was real but incomplete: it resolved the desktop `data:` URI blocking, but not the mobile popup-blocking-after-await case. See POL-DOC-ARCHIVE-MOBILE-OPEN-FIX above.
- OBJECTIVE: make Apri/Stampa on `PatientWorkspaceDocuments` actually display the archived PDF, without changing the archive list, RLS, schema or lazy-load contract from PR #69.
- ROOT CAUSE: `openPdf`/`printPdf` called `window.open(dataUrl, …)` directly on the raw `data:` URI returned by `loadPatientDocumentPdf`. Modern Chrome/Edge/Android block top-level navigation to a `data:` URI (anti-phishing measure): the new tab opens but stays blank, with no visible error — exactly "non c'è nessun documento". `openPdf` additionally passed `noopener`, which per spec makes `window.open` always return `null`, so it silently fell back to a download every time instead of showing the PDF.
- VERIFIED IN PRODUCTION DB (read-only, no data exposed): `documenti_medici`/`documenti_fiscali` both have `pdf_base64` populated on every row (15/15, 7/7) and RLS (`documenti_medici_studio` / `documenti_fiscali_studio`, studio-scoped) is unchanged — the failure is client-side rendering, not missing data or access.
- FIX: added `apriPdf(dataUrl, filename, { print })` to `src/lib/condivisionePdf.js`, converting the data URI to a `blob:` object URL (the pattern this file and `PdfView.jsx` already use elsewhere for the same class of bug) before calling `window.open`, with a `scaricaPdf` download fallback if the popup is blocked. `PatientWorkspaceDocuments.jsx`'s `openPdf`/`printPdf` now call it instead of using `window.open` directly.
- SAFETY: no migration, database, RLS, Storage, dependency or financial formula change. Document list/metadata loading (PR #69) untouched.
- VALIDATION: full suite 515/515; production build passed.

---

# Previous current task

- TASK: POL-DOC-ARCHIVE
- TITLE: Patient document archive visibility
- OWNER: CODEX
- BRANCH: `fix/POL-DOC-ARCHIVE-patient-documents`
- BASE: `origin/master@36faf3f`
- STATUS: MERGED (PR #69, merge commit `281f2da`)
- OBJECTIVE: show the current patient's archived medical and fiscal documents in the stable patient record without loading PDF payloads until requested.
- ROOT CAUSE: the optional `onDocumentsChange` default was a new function on every render, retriggering the loading effect after every state update. A failure from either archive table also discarded the successful source.
- SAFETY: no migration, database, RLS, Storage, dependency, financial formula or production-data change.
- VALIDATION: dedicated document tests 26/26; full suite 515/515; production build passed.
- FOLLOW-UP: merging surfaced a pre-existing, separate bug in Apri/Stampa (see POL-DOC-ARCHIVE-OPEN-FIX above) — not a regression from this task, the `window.open` code path predates it.

- TASK: POL-UI-005C
- TITLE: Patient Workspace documents, prescriptions and consent adapters
- OWNER: CODEX
- BRANCH: `ui/POL-UI-005C-patient-docs-prescriptions-consents`
- BASE: `origin/master` at `6de2050` (merged PR #59)
- STATUS: PR_61_REALIGNED_AND_VALIDATED
- OBJECTIVE: connect the isolated Patient Workspace 2.0 to the existing patient document sources, real `DocMedico` prescription workflow, verified consent templates, structured context and read-aggregated timeline without changing the stable production patient route or creating schema.
- SAFETY: no migration, RLS, Storage, dependency, production route or stable `SchedaPaz.jsx`/`App.jsx` change. Document metadata is loaded only when the Documenti tab opens; PDF/base64 is fetched per click.
- GAP: signed-consent persistence/link creation is not verifiable from repository migrations or authenticated client code. The template/preview adapter is real, but signing remains disabled and clearly labelled; no backend was invented.
- REALIGNMENT: fetched and verified `origin/master@6de2050`; the PR branch already had that exact commit as its direct parent, so `git merge origin/master` was a clean no-op with no conflicts. Dedicated tests 23/23, full suite 458/458, build and `git diff --check` passed after verification.
- NEXT_ACTION: push the validation commit, wait for PR #61 previews/checks, verify the isolated demo and mergeability, then stop. Do not merge.

## Superseded task record

- TASK: POL-UI-005B
- TITLE: Patient Workspace 2.0 isolated visual foundation
- OWNER: CLAUDE (Round 6 + Round 6 recovery, direct Product Owner request; previous rounds by CODEX — see handoff below)
- BRANCH: `ui/POL-UI-005B-patient-workspace-v2`
- BASE: `origin/master` at `981724e` (merged PR #58 stable patient record recovery)
- STATUS: READY_FOR_PR_UPDATE
- OBJECTIVE: Round 6 recovery — commit `67fe427` introduced unauthorized CSS layout side-effects (flex-wrap on the Situazione economica bar, left-align + padding on the economy grid buttons, a margin-top on its `strong`, and a new border on installment chips) alongside the two authorized changes. Reverted every layout side-effect to `67fe427`'s parent (`c5edc7b`) while keeping only the quadrant tooth selector and the canonical economic color scheme.
- SCOPE (Round 6 recovery): `src/components/PatientWorkspaceV2.css` (surgical revert of the 5 non-color properties listed above) and `tests/patientWorkspaceV2.test.mjs` (updated + added guard assertions) only. No JSX change was needed — the regression was CSS-only.
- SAFETY: `SchedaPaz.jsx` and `App.jsx` remain byte-for-byte unchanged from `origin/master`; no Supabase, Storage, migration, dependency, effect, fetch, or production-route change. Demo stays isolated on `/patient-workspace-v2-demo`.
- NEXT_ACTION: commit and push the recovery to the existing PR #59, wait for Vercel/Netlify Ready, then stop for Product Owner review. Do not implement the audit proposal or merge.

## Previous incident record

- TASK: POL-UI-PATIENT-FREEZE-PROD
- TITLE: Production patient record loading hotfix
- OWNER: CODEX
- BRANCH: `hotfix/POL-UI-patient-freeze-prod`
- BASE: `origin/master` at `96b01c6`
- STATUS: READY_FOR_PR
- OBJECTIVE: remove the asynchronous patient-record chunk boundary that can leave PWA clients suspended indefinitely when opening a patient.
- SCOPE: `src/App.jsx`, one regression assertion, and coordination records only. No database, Dashboard, Agenda, dock, Polyedron, Chat, or Patient Workspace 2.0 changes.
- NEXT_ACTION: push the branch, open a PR to `master`, and perform authenticated preview smoke QA. Do not merge automatically.

## Previous task record

- TASK: CHAT-POLYEDRON
- TITLE: Persistent Chat Polyedron
- OWNER: COPILOT
- BRANCH: `lucasimondi-chat-polyedron`
- BASE: `master` — PR #51 (POL-UI-015 Dashboard Premium V2) merged as
  `36a149759b7d1cf7827d17d4a8648fdb1f999570`, integrated into this branch by
  a merge commit (POL-CHAT-001 integration).
- PR: `#53`
- STATUS: `WAITING_PRODUCT_OWNER_FINAL_QA` — implementation complete, merged
  onto the POL-UI-015 master, and the single authorized migration
  `20260824030000_chat_polyedron.sql` is now APPLIED to project
  `idklxdqebfceplrualgh` and verified with 26 real-database assertions
  (all rolled back, no residual test data). FASE 4-13 completed: the quick
  panel no longer carries any Chat history or history banner and no longer
  depends on the Chat backend; the Chat page is the one persistent-history
  surface, with classified error states (loading / empty / schema /
  permission / network / generic) and initialization-error precedence; the
  unread badge exists only on the bell; the temporary POL-UI-015 on-screen
  save diagnostics are removed. Not merged, not deployed to production; no
  other migration was applied. See the POL-CHAT-001 FASE 1-17 handoff entry
  for the full evidence and for what remains NOT VERIFIABLE (authenticated
  browser QA on the preview).

## Objective

Implement Chat as the persistent conversational interface for the one existing
Polyedron. Reuse the singleton Poliedron orchestration, provider/model gateway,
context, permission, action, and memory path; persist one continuous primary
thread per active studio user with fail-closed RLS; expose the same conversation
through mobile Chat, desktop navigation, and a real unread bell.

## Completed scope

- Persistent recent history with bounded upward pagination.
- Studio + user isolation, active-membership enforcement, RLS, indexes, and
  synthetic cross-user/cross-tenant tests in one additive migration.
- Same `processQuery` / Model Gateway / `agente-assistente` path as the existing
  Polyedron; no second chatbot, provider, prompt stack, or orchestration layer.
- Mobile-first dynamic-viewport Chat, desktop long-conversation layout,
  keyboard-safe composer, retry/double-submit/slow-response handling, and
  near-bottom conditional auto-scroll.
- Real unread/read semantics (`read` never means task completion).
- Mobile Chat replaces Setup in the five-slot dock. Setup remains explicitly
  available in the Poliedron navigation menu, per Product Owner decision.
- Desktop Chat navigation and a global bell open the same primary conversation.

## Safety boundaries

- Do not modify Agenda's unrelated booking-request bell semantics.
- Do not implement reminders, scheduler/cron, proactive message generation,
  autonomous loops, task completion/snooze, push, email, or SMS.
- Do not weaken RLS, add tenant fallback, expose provider secrets, duplicate
  Polyedron, or invent production state.
- Do not apply migrations remotely, deploy, merge, or use production data.

## Exact next action

Product Owner reviews PR #53, including mobile/desktop
conversation UX and the additive migration/RLS contract. Do not merge, deploy,
or apply `20260824030000_chat_polyedron.sql` remotely without explicit Product
Owner approval.

## POL-CHAT-001 — integration of the merged POL-UI-015 master

The new `master` (merge commit `36a1497`) is the source of truth for Dashboard
Premium V2, persistent Home personalization, the Richiami widget, mobile
fullscreen Home, the floating hero, dock clearance, the Consigli Poliedron
carousel, and the STRUCTURE of both the notification bell and the mobile dock.
This branch remains the source of truth for the persistent Chat itself:
conversations/messages, unread/read state, the Chat route, the Chat entry in
the dock, the bell wired to Chat, Chat persistence/Realtime, and the Chat
migration.

Where the two overlapped, POL-UI-015's approved UI was kept and POL-CHAT-001's
real behaviour was wired into it:

- **Bell** — POL-UI-015 shipped `PoliedronBell.jsx` as a UI-only placeholder
  (badge with no producer, click reopened the quick panel). The component, its
  look and its approved mobile/desktop positioning are kept unchanged; it now
  receives the real `unreadCount` from `usePoliedronConversation()` and opens
  the persistent Chat page. PR #53's own separately positioned
  `.poliedron-notification-bell` markup/CSS was dropped as a duplicate. The
  bell is hidden while already on Chat.
- **Mobile dock** — Chat replaces Impostazioni in the five slots (POL-UI-015
  structure), but the Chat slot no longer calls `onToggle` on the quick panel:
  it navigates to the real Chat route and carries the unread badge.
  Impostazioni stays reachable from the central Poliedron panel's default
  suggestions (`searchEngine.js` preferred sections, from master).
- **One Poliedron** — the Chat page is the single `Poliedron` instance
  portalled into `App.jsx`'s `poliedronChatHost`. No second agent, no second
  open state, no second orchestration path.
- **App shell padding** — the merged `App.jsx` keeps master's mobile
  fullscreen rules for Home/Agenda and adds the zero-padding Chat page.
- **Dashboard persistence** — the new Home persistence and its
  (still temporary) `HOME_SAVE_*` preview instrumentation from round 4 of
  POL-UI-015 were NOT modified by this integration; removing or downgrading
  that instrumentation remains an open POL-UI-015 debt on master.


---

# Historical record: POL-UI-015 / Dashboard Premium V2 (merged to master as `36a1497`)

- TITLE: Dashboard premium v2 — personalization persistence root cause,
  Richiami widget, mobile fullscreen, floating dock/hero, Consigli
  carousel, Poliedron bell + Chat entry point, Impostazioni relocation
- OWNER: CLAUDE
- BRANCH: `feature/POL-UI-015-dashboard-premium-v2`
- BASE: `master` (POL-UI-004-AGENDA-QUICK-HUB/Agenda Mobile V2 merged as
  `b65cdba`, PR #50)
- STATUS: `WAITING_PRODUCT_OWNER_REAL_QA` — PR #51 open, not merged, not
  deployed. Rounds 1 (`c4df202`), 2 (`77d64d5`) and 3 (`1a82027`) were all
  rejected. On `1a82027` the Product Owner verified the preview personally:
  **Richiami OK, Dashboard OK, Personalizza Home STILL DOES NOT SAVE.**
  BUG A is therefore CLOSED; round 4 touched BUG B only — Richiami, the
  visual Dashboard, Richiami CSS, fullscreen and Poliedron were not
  modified.

  Round 4 found that round 3's own fix was the blocker:

  - The verified read-back compared `JSON.stringify` of the layout sent with
    `JSON.stringify` of the layout read back. Postgres `jsonb` stores object
    keys sorted by length then bytewise, so the two strings could never be
    equal for ANY layout on ANY account. Every save therefore threw
    "il layout Home persistito non corrisponde a quello inviato" AFTER the
    write had landed, the modal stayed open and nothing was committed to
    state. Fixed with a canonical fingerprint that ignores key ORDER while
    still comparing array order, ids, `visible`, `size`, `config` and
    length. The UPSERT → READ-BACK → compare → THROW contract is preserved.
  - `homeLayoutDiagnostics` was gated on `import.meta.env.DEV`, and a
    Netlify deploy preview is a production build — so the entire diagnostic
    trail was compiled away in the only environment where the bug
    reproduces. It is now enabled on deploy-preview/localhost hostnames too,
    never on production hostnames.
  - `draftInherits` was audited and is NOT the cause: all five editing
    handlers clear it, and for the reporting account it is already `false`
    on open. There is no second, divergent Salva button and no overlay
    intercepting the click.
  - The Product Owner's device is an **iPhone** (verified from edge logs).
    The footer action row now wraps and the primary Salva button is
    non-shrinking with a 44px touch target; the Azioni rapide tab gained the
    error alert it was missing.

  STILL OPEN: the edge logs show ZERO write requests on
  `user_home_layouts` in the test window, so it is not proven that the click
  reaches `saveHomeCustomization` on iOS Safari at all. Temporary
  preview-only instrumentation (`HOME_SAVE_*` events plus an on-screen
  "DEV/PREVIEW · save state" badge under both Salva buttons, no secrets and
  no identifiers) was added to settle exactly that on the next real QA. It
  must be removed or downgraded before merge.

  See "POL-UI-015 handoff round 4" in `handoffs.md` for the full evidence
  and the VERIFIED / NOT VERIFIABLE split. Same branch, same PR #51 — no new
  branch, no new PR, no merge, no deploy.

  NOT VERIFIABLE in round 4: authenticated preview QA, iPhone QA and desktop
  QA — no browser with the Product Owner's session is available here and no
  credentials were requested or used. `npm test` 410/410, build clean.

## Objective

Fix the real Dashboard personalization persistence bug at its root cause,
build a premium operational Richiami widget, bring mobile Dashboard to the
same fullscreen principle Agenda already has, turn the greeting block into
a compact sticky/floating bar with date/time, guarantee the last widget
always clears the floating dock, redesign Consigli Poliedron as a mobile
one-card-at-a-time carousel, prepare (UI-only) the Poliedron bell and a
Chat dock entry point — both reusing the single existing Poliedron agent,
never a second one — and move Impostazioni out of the mobile dock into the
central Poliedron panel's default suggestions. Explicitly out of scope:
any real AI/reminder/notification engine, a second Poliedron, or a real
Chat implementation — those are future tasks this one only prepares UI/
navigation for.

## Safety boundaries

- No schema, RLS, dependency, or production change of any kind.
- No new AI engine, reminder engine, notification polling, or second
  Poliedron/chat agent — the bell and dock Chat button are UI-only
  placeholders that open the SAME existing Poliedron conversation.
- Agenda, Pazienti, Poliedron's own size/behavior, and the global design
  system are untouched except where this task explicitly required a
  shared-rule fix (the mobile Home `!important` padding override).
- No merge or deploy without explicit Product Owner approval.

## Exact next action

Product Owner re-tests preview #51 once it rebuilds from the round-3 commit:
confirm the Richiami widget now appears in the Dashboard without any other
personalization changing, and that Personalizza Home either really persists
(verifiable with a page reload) or fails with a visible error while staying
open with the draft intact. Do not merge, do not deploy to production, do
not open a new PR.

Open decision (`PRODUCT_OWNER_DECISION_REQUIRED` if the answer is no): the
round-3 Richiami fix treats a pre-POL-UI-015 `richiami: visible:false` as a
stale default rather than a deliberate user choice, per the explicit
requirement "visibile di default per owner/admin" combined with "non
resettare tutte le personalizzazioni". If that reading is wrong, the
migration must be reverted.

---

# Historical record: POL-UI-004-AGENDA-QUICK-HUB / Agenda Mobile V2 (merged to master)

- Branch: `lucasimondi-agenda-mobile-fullscreen` — PR #50, merged to
  `master` as `b65cdba`.
- Objective: mobile Agenda fullscreen shell, floating overlay controls,
  dynamic day strip, dock-aware appointment action sheet, and the
  Appointment Quick Action Hub (call/patient/recall/activity/contextual
  Poliedron mini-input).
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-004-AGENDA..."
  entries).

---

# Historical record: POL-AI-005A (merged to master)

- Branch: `feature/POL-AI-005-transactional-action-planner` — PR #46, merged
  to `master` as `c442c6f`.
- Objective: Phase A (READ + PLAN only) foundation for the transactional
  action planner — deterministic command parsing, patient/procedure
  resolution contracts, a tooth model for incomplete-but-valid clinical
  data, and non-executing Action Plans for representative workflows. No
  writes, no CONFIRM/ACT/VERIFY — that became POL-AI-005B (see "Current
  task" above).
- Full detail: `docs/architecture/POL-AI-005A-domain-audit.md`,
  `docs/architecture/POL-AI-005A-planner-foundation.md`, and
  `docs/coordination/handoffs.md` ("POL-AI-005A..." entries).

---

# Historical record: POL-AI-004 (merged to master)

- Branch: `lucasimondi-feature-pol-ai-004-proactive-intelligenc` — PR #45,
  squash-merged to `master` as `ab1bd27`.
- Objective: deterministic, explainable, permission-aware, tenant-safe
  Poliedron proactive intelligence layer — canonical source adapters,
  transparent scoring/confidence, Studio Data Health, bounded cache,
  semantic query routing, grouped approved-panel renderer. Zero Model
  Gateway calls for discovery; no writes.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AI-004..." entries)
  and `docs/architecture/POL-AI-004-proactive-intelligence.md`.

---

# Historical record: POL-UI-013 (merged to master)

- Branch: `feature/POL-UI-013-dashboard-modular-workspace` — PR #44, merged to
  `master` as `590b8ca`.
- Objective: Dashboard modular workspace, `Consigli Poliedron`, touch/mouse
  drag-and-drop, widget resize and the personalization load/save race fix.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-013 Dashboard
  modular workspace + Poliedron centrality" and subsequent audit/race entries).

---

# Historical record: POL-UI-012 (merged to master)

- Branch: `lucasimondi-pol-ui-012-mobile-document-kpis` — PR #42, merged to `master` as `93dfe6a`.
- Objective: correct the top Documenti KPI cards on mobile so their values remain proportionate and contained at 375px, 390px, and 430px widths, without changing desktop/tablet presentation or shared `StatCard` behavior elsewhere.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-012 Mobile Document KPI sizing").

---

# Historical record: POL-AI-002B (merged to master)

- Branch: `lucasimondi-pol-ai-002b-workflows` — PR #41, merged to `master` as `c82b69a`.
- Objective: restore Poliedron as the application's single conversational AI and action surface, including Product Owner-approved suggest-first input semantics.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AI-002B Poliedron Conversational Actions & Workflows" and subsequent reconciliation/revision entries).

---

# Historical record: POL-AGD-WA-001 (merged to master)

- Branch: `claude/whatsapp-agenda-cancel-rql7fg` — PR #39, merged to `master` as `e5b24d4`.
- Objective: allow an in-progress Agenda WhatsApp bulk send to be cancelled before all scheduled windows open.
- Full detail: see `docs/coordination/handoffs.md` ("POL-AGD-WA-001 Agenda — allow cancelling a WhatsApp send").

---

# Historical record: POL-AI-002A (merged to master)

- Branch: `fix/POL-AI-002A-adaptive-poliedron` — PR #36, merged to `master` as `1faa9bb`.
- Objective: Poliedron adaptive interface — compact mobile dock, desktop edge dock, precise drag, prefix navigation. Full detail in `docs/coordination/handoffs.md`.

---

# Historical record: POL-AI-001 (merged to master)

- Branch: `feature/POL-AI-001-poliedron-universal-interface` — PR #35, squash-merged to `master` as `e504e52`.
- Objective: first architecture of Poliedron — global Orb, Spotlight-style command panel, provider-independent Model Gateway, deterministic-first intent/search, Action Registry reusing existing workflows, Permission Engine reusing existing RBAC. Revised once more to make Poliedron the app's single AI entry point (AssistenteAI's floating widget unmounted, kept internal for future convergence).
- Full detail: `docs/coordination/handoffs.md` ("POL-AI-001 Poliedron Universal Operating Interface (Phase 1)" and the two review-round entries that follow it).

---

# Historical record: POL-UI-011 (merged to master)

- Branch: `lucasimondi-hotfix-pol-ui-011-mobile-edge-to-edge-sh` — PR #37, merged to `master` as `d95af43`.
- Objective: establish the mobile `100dvh` edge-to-edge flex shell and remove the retired dock's global bottom reservation while keeping fixed controls as overlays.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UI-011 mobile edge-to-edge shell").

---

# Historical record: POL-UX-001 (draft PR open, awaiting Product Owner review)

- Branch: `ui/POL-UX-001-visual-system-dashboard-experience`, based on `master@7a0c490` (POL-UI-003 already merged).
- Objective: complete the Poliedra UI/UX as one organic design-system mission — shared tokens, header/Home visual integration, real Quick Booking with authoritative free-slot computation, customizable quick actions with a workflow contract, a unified Pannello Economico on the canonical contract only, and app-wide propagation of shared card/button primitives — without touching clinical/financial logic, RLS, or migrations.
- Full detail: see `docs/coordination/handoffs.md` ("POL-UX-001 Poliedra Visual System & Dashboard Experience" entry) for the complete audit, files changed, database impact (none), and test results.
- Status when superseded as the active task: `WAITING_PRODUCT_OWNER` — draft PR open, not merged. Exact next action unchanged: Product Owner reviews the draft PR; do not deploy or merge without explicit approval.

---

# Historical record: POL-UI-003 (completed, merged to master)

Apply the Product Owner-approved premium visual direction to the Poliedra Home (desktop/tablet sidebar, hero, quick actions, canonical KPI card styling) while preserving POL-UI-001/POL-UI-002 personalization behavior, POL-RBAC-001/POL-RBAC-001A's capability-based permission model, and all canonical financial contracts unchanged. Also fixed a Product Owner-flagged mobile layout defect in the Agenda widget and audited touch targets across Home. Merged to `master` as `7a0c490`; PR #17 closed.

---

# Historical record: POL-RBAC-001A (completed, merged to master)

Close the residual risk the Product Owner identified in POL-RBAC-001: a
`clinical.personal_trainer`/`clinical.massage_therapist` capability alone let
a user read every Fisio patient in the tenant. Separate CAPABILITY ("may act
as X") from ASSIGNMENT ("may act on THIS patient"), add a tenant-safe
`patient_care_assignments` table, and make PT/massage_therapist Fisio RLS
require an active assignment. Physiotherapist access stays tenant-wide
per the already-approved contract. Add a minimal "Team del percorso"
UI to view/manage a patient's assigned professionals.

## Product Owner decisions (recorded verbatim)

Two open decisions were resolved by the Product Owner and applied in full:

> 1. APPROVATO `episode_id → physio_piani` esclusivamente come adapter
>    transitorio fino alla stabilizzazione del canonical episode di
>    POL-FIS-001. Documentalo esplicitamente come transitional compatibility
>    layer. Non creare un secondo modello episodio e non eseguire backfill
>    inventati.
> 2. Per PT e massage therapist approvo la visibilità del roster
>    esclusivamente sul percorso al quale sono attivamente assegnati,
>    applicando data minimization: possono vedere nome/identità
>    professionale, ruolo nel percorso e stato dei membri attivi del team.
>    Non devono poter derivare capability globali, altri assignment, altri
>    pazienti o contenuti clinici aggiuntivi tramite il roster. Il
>    fisioterapista autorizzato può avere la vista completa del team
>    prevista dal contratto.

**Decision 1 — already satisfied, documentation-only change.** The
implementation already matched exactly: nullable `episode_id`, patient-level
RLS gating only, no second episode model, no backfill anywhere. The
migration's table/column comments, header, and the architecture doc now say
"TRANSITIONAL COMPATIBILITY LAYER" explicitly, per instruction.

**Decision 2 — did not match, real fix applied (checked before assuming).**
Two gaps found and closed:

1. `patient_care_assignments_select`'s "shared teammate" branch granted
   **full-row** SELECT (including `created_by`, timestamps, `ended_by`,
   `reason`) to any active teammate on the same patient — exceeding
   "identità, ruolo, stato". Fixed by removing that branch from the base
   table policy entirely and adding `patient_care_team_roster_v1(studio_id,
   patient_id)`, a `SECURITY DEFINER` function returning only `id, user_id,
   assignment_type, active` — a structural column restriction, not a
   convention. `PhysioCartella.jsx` now reads the roster exclusively through
   this RPC; a direct API call gets the same four columns regardless of
   client code.
2. While rebuilding this, found `caller_has_active_patient_assignment_v1`
   never re-checked the caller's own `studio_users.stato = 'attivo'` — a
   suspended user with a still-`active=true` assignment row could still pass
   it. Fixed with a `studio_users` join; the same membership check now also
   applies to the *listed* rows in the roster (a suspended member's
   still-active assignment no longer counts as part of "the active team").

Full detail: `docs/architecture/pol-rbac-001a-patient-care-assignment.md`
("Authorization" section) and `docs/architecture/pol-rbac-001a-local-validation.md`.

## Rebase onto master (PR #15 squash-merged)

PR #15 (POL-UI-002) was squash-merged to `master` as
`1348dd9801dad882ad0a370cbb08e89066af7c31`. GitHub then retargeted PR #16
onto `master`, but its branch still carried the old, now-duplicate
stacked history (the individual POL-UI-002 commits plus everything
before them), making it unmergeable against the new `master`.

Before touching anything, confirmed the trees were byte-identical:
`git diff b9370ad 1348dd9` (old POL-UI-002 branch tip vs. the new squash
commit on master) produced **zero** output — the squash preserved the
content exactly. This meant the seven POL-RBAC-001/POL-RBAC-001A commits
(`b9370ad..0c675e9` on the old history) could be replayed verbatim onto the
new master with `git rebase --onto origin/master b9370ad
security/POL-RBAC-001-authoritative-capabilities` — and they applied with
**zero conflicts**, confirming the prediction.

Verified before pushing:
- `git diff <pre-rebase-tip> <post-rebase-tip>` — empty. The resulting tree
  is byte-for-byte identical to before the rebase; nothing was lost,
  changed, or duplicated by the history rewrite itself.
- `git merge-base --is-ancestor origin/master HEAD` — true. The branch is
  now a direct, clean, fast-forwardable stack on `master`.
- `git diff origin/master..HEAD --stat` — 24 files, all POL-RBAC-001/
  POL-RBAC-001A-owned (migrations, RLS tests, `PhysioCartella.jsx`,
  `SchedaPaz.jsx`, docs) plus exactly two pre-existing, intentional
  touch-ups to POL-UI-002's own files that predate this session (part of
  the original POL-RBAC-001 commit, not introduced by the rebase):
  `tests/homeFinancialWidgets.test.mjs` (updated to the capability-array
  contract `createRolePresetLayout([...])` replaced the old
  `(ruolo, vertical)` signature) and
  `docs/architecture/pol-ui-002-implementation-validation.md` (updated
  prose to describe the capability-based preset resolution). No
  `CanonicalFinancialWidget`/`homeWidgetRegistry`/`homeLayoutPersistence`
  or other POL-UI-002 feature file appears in the diff — no duplication.
- Full required checklist re-run after the rebase, before pushing: 30/30
  Node tests (20 original POL-UI-002 + 10 POL-RBAC-001/POL-RBAC-001A);
  PostgreSQL 16 (dev) full migration/regression chain; `supabase db lint`
  (PG16, no schema errors); **PostgreSQL 17.5 final gate** (PGlite,
  complete chain incl. the two-tenant/assignment/suspension/roster
  assertions) — all green; `npm run build` clean; `git diff --check`
  clean; secret-pattern scan over the full `origin/master..HEAD` diff — no
  matches.

A local tag `backup/pol-rbac-001a-pre-rebase-0c675e9` was created before
rewriting, pointing at the pre-rebase tip, purely as a local safety net —
not pushed, not part of the repository's tracked history.

The push to `origin/security/POL-RBAC-001-authoritative-capabilities` after
this rebase is **non-fast-forward** (history was rewritten) and uses
`--force-with-lease`, per explicit Product Owner instruction to realign the
branch. No merge, deploy, or remote migration was performed.

## Safety boundaries

- No automatic patient/professional assignments are inferred or seeded in
  any migration; only synthetic test fixtures create assignment rows.
- Assignment authorization requires active membership on both caller and
  target, in the same tenant; suspended membership denies access even with
  a matching capability and an active assignment — now enforced on every
  read path, including the team roster (see decision 2 above).
- Physiotherapist Fisio access is unchanged (tenant-wide by capability) —
  not accidentally narrowed by this task.
- No production access, remote migration, backfill, deployment or merge is
  authorized or performed.

## Completion state

`patient_care_assignments` (additive table), its authorization/eligibility
helper functions, author-enforcement/immutability trigger and RLS are
implemented in one migration stacked after POL-RBAC-001's. Redefining
`physio_patient_in_studio_v1` in place tightens all its existing callers;
the three Fisio READ policies that previously granted tenant-wide access on
capability alone are re-scoped to patient level; `physio_esecuzioni` gains
server-enforced authorship so PT/massage_therapist can record and read their
own execution log. `studio_user_capabilities` SELECT is extended (clinical.*
rows only) so a physiotherapist can browse teammate capabilities for the
"Assegna professionista" picker. `PhysioCartella.jsx` gains a "Team del
percorso" section and management modal, gated client-side by capability
(`canManageTeam`) purely for UX — RLS/the roster RPC's own authorization
check is authoritative. `episode_id` is a nullable, Product-Owner-approved
transitional compatibility layer onto the existing `physio_piani` table,
pending POL-FIS-001 convergence — this did not block the tenant/RLS/
assignment work.

Validation passed locally: original 20 POL-UI-002 + 6 POL-RBAC-001 Node/SQL
regressions (with the RBAC fixture updated for the new assignment-gated
contract), all POL-RBAC-001A SQL assertions — including nine new assertions
for the decision-2 roster/suspension fix — (Studio A/B, Patient A/B, PT1/
PT2/Massage1/multi-role/suspended/cross-tenant/revocation/author-spoofing/
assignment-management-authorization/roster-data-minimization), 4 POL-RBAC-001A
Node tests (one updated this round for the roster RPC change), and a clean
Vite production build. See
`docs/architecture/pol-rbac-001a-local-validation.md`.

**PostgreSQL 16 was preliminary development only.** Per explicit Product
Owner instruction, the full required checklist (migration chain, POL-RBAC-001
regression, POL-RBAC-001A assignment regression, RLS two-tenant, assignment/
revoke, suspended user, author spoofing, cross-tenant, unassigned PT,
unassigned massage therapist, physiotherapist flow, build, Node test,
secret/diff/scope check) was re-run unmodified — including after the
decision-2 fix above — against a genuine **PostgreSQL 17.5** engine. Docker
and `apt.postgresql.org` are both denied by this sandbox's network policy
(confirmed with concrete 403s against three independent hosts: PGDG apt,
Supabase's own Docker image blob storage, and plain Docker Hub's blob
storage), so PostgreSQL 17.5 was obtained via `@electric-sql/pglite` — a
real Postgres compiled from unmodified source to WASM, distributed on the
(allowlisted) npm registry — after an RLS smoke test confirmed it enforces
roles/policies/`set_config` correctly, not a stub. Every item on the list
passed on PostgreSQL 17.5 except `supabase db lint`, which ran for real but
against PostgreSQL 16 (the TCP adapter needed to expose PGlite over the wire
protocol only supports the PostgreSQL 18 PGlite line, confirmed by a hung
handshake when forced against 17.5) — see "Residual risks" below. Full
engine-by-engine breakdown, transcripts and exact hosts/errors:
`docs/architecture/pol-rbac-001a-local-validation.md`.

Two self-review passes after the initial push (a code-review pass and a
dedicated security-review pass) each found and fixed one real least-privilege
issue, both since regression-tested: (1) the `studio_user_capabilities`
extension for physiotherapists originally exposed every capability row in
the studio, not just `clinical.*` ones — narrowed with
`capability LIKE 'clinical.%'`; (2) `patient_care_assignments_select`'s
"shared patient" branch checked the caller's active assignment but not
whether the row being read was itself active — this branch was since removed
entirely per Product Owner decision 2 above, superseding that earlier fix.
The responsive "Team del percorso" UI (375/768/1024/1440px) was verified by
screenshotting the shipped component's exact markup/styles headlessly (the
live app cannot be driven in this sandbox without touching the real
production Supabase project it's hardcoded to, which the safety rules
forbid) — see the local-validation doc for details and results.

## Residual risks

- `supabase db lint` ran against PostgreSQL 16, not PostgreSQL 17 (see
  above) — the schema/policy checks it performs are static, not
  version-dependent, and it reported no errors both before and after the
  decision-2 fix, but a literal PG17 CLI-lint run needs Docker or PGDG apt
  access this sandbox's network policy does not grant.
  `PRODUCT_OWNER_DECISION_REQUIRED` if that's required before merge.
  Security/performance advisors (Supabase-hosted) remain unavailable in this
  sandbox for the same reason on either engine.
- Physiotherapist Fisio access remains tenant-wide (unchanged from
  POL-RBAC-001); the model supports but does not yet implement per-patient
  restriction for physiotherapists, as the mission anticipated as future
  work. Not requested by either Product Owner decision in this round.
- `episode_id`/POL-FIS-001 convergence and the roster visibility tier are
  now **decided**, not open — removed from this list. When POL-FIS-001
  merges and stabilizes, a follow-up migration must repoint/rename
  `episode_id`; that follow-up's exact mechanics remain to be designed then,
  not a decision blocking this task.
- Existing dependency advisories (`npm audit`) and pre-existing build
  warnings remain outside this task's scope, unchanged from prior handoffs.

## Exact next action

Product Owner and Tech Lead review the stacked POL-RBAC-001 + POL-RBAC-001A
commits together on PR #16, now incorporating both recorded decisions. Do
not apply remotely, deploy, merge POL-RBAC-001A/POL-RBAC-001, or merge PR
#15/#16 without explicit Product Owner approval.

(POL-RBAC-001/POL-RBAC-001A have since merged to `master`; PR #16 is closed. This record is kept for audit history — see "Current task" above for the active task.)
