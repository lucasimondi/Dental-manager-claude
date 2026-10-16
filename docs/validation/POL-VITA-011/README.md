# POL-VITA-011 — Agenda Personal: dettaglio, collegamento Studio, 24 ore e persistenza

Base: `master@173a78ed62f915d39f483a54508c7f7cb738c856` (PR #199). Branch: `codex/pol-vita-011-agenda-persistence`.

## Cause e correzioni

- La pagina dettaglio aveva z-index 8, inferiore ai controlli agenda (30/31), e finiva a 62px dal bordo mentre il dock flottante occupa 76px. Ora il livello è 40 e il bordo inferiore lascia 84px più safe-area: 8px di separazione dal dock. Il corpo resta uno scroller flex con min-height 0, scorrimento touch e ritorno/chiusura visibili. `Pagina.jsx` contiene lo stesso shell usato dall'app e dalle prove, senza una seconda implementazione simulata.
- «Vai a Studio» era flottante in basso e puntava all'host tecnico Vercel. Ora sta sotto i controlli in alto, con altezza misurata per lasciare libera la griglia. Sul dominio Personal punta a `https://personal.poliedrasoft.it/studio`: il catch-all esistente serve `/index.html` (Studio), mentre il redirect a Personal interessa soltanto `/`. Non sono stati inventati altri domini né modificati DNS, hosting, manifest o sessioni. Giorno/vista/mese restano nell'URL; nessun dato clinico o token attraversa il link. La raggiungibilità pubblica dal container non è verificabile; la destinazione è verificata rispetto al routing del repository, da controllare anche dopo il deploy.
- Personal tagliava gli eventi fuori 08–20. Giorno e Settimana ora coprono 00–24, con righe leggibili e scorrimento; le impostazioni cliniche dello Studio rimangono invariate. Uno slot delle 23 termina alle 23:59, evitando un intervallo negativo sullo stesso giorno.
- L'insert dei nuovi impegni ometteva `id`. La verifica in sola lettura di `information_schema.columns` sul progetto Studio ha confermato `id bigint NOT NULL`, senza default. L'adapter ora invia l'ID numerico secondo la convenzione già presente nello Studio (`uid`). Successo/chiusura avvengono dopo la risposta di `.select(...).single()`; il pulsante è bloccato durante la richiesta. Un errore mantiene aperto il modulo e non annuncia il salvataggio. Nessuna modifica a schema, RLS, dati o funzioni cliniche. Non viene dichiarato recuperato un evento precedentemente non salvato.

## Verifica

- `npm test`: **1.272/1.272**.
- `npm run build` e `npm run build:personal`: riuscite; restano gli avvisi preesistenti su chunk grandi e chiavi duplicate.
- `npm run test:agenda:reliability`: **6/6 scenari**, Chromium e WebKit, 375×812, 390×844, 430×932. Shell e modulo reali, dati fittizi e server intercettato; niente scritture in produzione. Ogni prova verifica 24 etichette orarie, link in alto raggiungibile, note lunghe scorrevoli senza controlli sopra, separazione dal dock, slot 23:30–23:59, rifiuto del salvataggio (503) senza successo/chiusura, retry e riapertura in un nuovo browser context. Il server simulato rifiuta insert senza ID; la riapertura rilegge tramite `impegniTra` reale, senza conservare lo stato React.
- `npm run test:agenda:visual`: matrice di 20 scenari (tre viste × tre larghezze × due motori, più settimana configurata per motore), baseline Studio congelata dal commit base **insieme alle dipendenze condivise e al CSS**. Il confronto Studio verifica geometria e pixel; Personal ha le differenze richieste (24 ore e link in alto), quindi non viene falsamente dichiarata identica al vecchio range 08–20. Screenshot affiancati e metriche allegati.
- Browser desktop con viewport/touch mobile e WebKit: queste prove non sostituiscono una verifica su dispositivo iPhone fisico.

## Screenshot

`*-detail-before-after.png`: a sinistra viene riprodotto il precedente z-index/bordo inferiore sullo shell reale, a destra la correzione. Le schermate del dettaglio sono scorse fino in fondo per mostrare l'ultima nota e la chiusura. Il confronto "prima" riguarda la regressione di stacking, non un intero deploy precedente.

`*-reopened.png`: evento delle 23:30 presente dopo chiusura del browser context e nuova lettura dal server simulato.

`webkit-390-*-comparison.png`: da sinistra Studio base, Studio corrente, Personal. Le differenze di range e collegamento Personal sono intenzionali.

Tutti i dati rappresentati sono sintetici. I test CI allegano anche la matrice completa. Metriche in `comparison-metrics.json` e `reliability-metrics.json`.

## Rilascio e rollback

Solo frontend, nessuna migrazione o deploy di Edge Functions. PR da revisionare; nessun nuovo merge autorizzato da questa correzione. Rollback: revert del commit della PR. Checkpoint immutabile preservato: `stable/2026-08-27-full-recovery@070b28fd4eae4e2cc397584201d0bb149468fae7`.
