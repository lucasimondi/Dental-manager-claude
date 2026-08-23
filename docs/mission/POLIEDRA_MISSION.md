# Poliedra — Missione di prodotto

## Missione

Poliedra nasce per restituire al professionista il tempo, la lucidità e la qualità del proprio mestiere.

Il professionista non deve essere costretto a trasformarsi in imprenditore, data analyst, responsabile marketing, controller e project manager per riuscire a competere. Le organizzazioni più grandi dispongono di team dedicati; il singolo professionista e il piccolo studio raramente possono permetterseli. Poliedra colma questo divario attraverso un sistema operativo professionale assistito da agenti AI.

Poliedron è il centro intelligente di questa missione: non una chat aggiunta al gestionale, ma un agente capace di comprendere il contesto, leggere trasversalmente il software, individuare opportunità e incompletezze, suggerire azioni e, quando autorizzato, accompagnare l'utente nell'esecuzione.

## Principio permanente: il gestionale deve premiare i dati completi

Poliedra non deve chiedere dati per burocrazia. Ogni informazione inserita deve restituire valore.

Più i dati sono completi, aggiornati e coerenti, più Poliedra deve diventare utile, precisa e proattiva.

La qualità del dato deve quindi produrre un vantaggio immediatamente percepibile:

- analisi più affidabili;
- suggerimenti più pertinenti;
- opportunità commerciali e cliniche individuate prima;
- meno pazienti dimenticati;
- meno attività sospese;
- meno errori e ricostruzioni manuali;
- migliore continuità operativa;
- maggiore capacità di previsione;
- maggiore autonomia del professionista.

Quando un dato manca, Poliedra non deve limitarsi a mostrare un errore. Deve spiegare perché quel dato è utile e quale valore diventerebbe disponibile completandolo.

## Poliedron come intelligenza operativa

Poliedron deve ragionare sull'intero stato operativo dello studio, non soltanto sulla sezione in cui si trova l'utente.

Una domanda come "Ci sono pazienti che devono prendere appuntamento?" non deve essere interpretata soltanto come una ricerca nei Richiami. Poliedron deve poter valutare, in base ai dati realmente disponibili e ai permessi dell'utente, segnali provenienti da più domini, tra cui:

- richiami aperti, scaduti o prossimi;
- piani di cura con prestazioni non ancora eseguite;
- piani di cura parzialmente completati senza appuntamenti futuri;
- pazienti registrati ma privi di piano di cura o di informazioni necessarie al percorso;
- prestazioni pianificate che non risultano marcate come eseguite;
- attività, note operative o task che fanno riferimento a un paziente;
- preventivi o piani accettati senza prosecuzione operativa;
- pazienti senza appuntamenti futuri quando il percorso suggerisce che ne serva uno;
- igiene o altre prestazioni periodiche non registrate entro la finestra prevista;
- follow-up mancanti;
- schede con dati incompleti che riducono l'affidabilità delle analisi.

Il risultato non deve essere un elenco opaco. Poliedron deve mostrare il motivo per cui ogni paziente o attività è stato segnalato.

Esempio concettuale:

> Mario Rossi — priorità alta
> - 3 prestazioni del piano di cura non risultano eseguite
> - nessun appuntamento futuro
> - ultima igiene registrata 11 mesi fa
> - attività aperta collegata al paziente

## Proattività senza spreco

Poliedron deve diventare progressivamente proattivo, ma la proattività non deve dipendere da continue chiamate a modelli esterni.

Quando una valutazione può essere ottenuta con regole, query, indici, cache o motori deterministici, Poliedra deve elaborarla localmente o tramite i propri servizi applicativi.

I modelli AI esterni devono essere utilizzati quando aggiungono reale capacità di interpretazione, ragionamento o linguaggio, non per sostituire calcoli e controlli che il software può eseguire in modo deterministico.

La direzione architetturale è quindi:

1. dati canonici di Poliedra;
2. scanner e segnali deterministici;
3. motori di scoring e prioritizzazione;
4. Poliedron che compone e presenta il quadro operativo;
5. modello AI soltanto quando l'interpretazione aggiunge valore.

## Il dato come circolo virtuoso

Poliedra deve creare un circolo virtuoso:

**dato migliore → analisi migliore → suggerimento migliore → azione migliore → dato aggiornato**.

Il sistema deve aiutare l'utente a capire dove il dato non è affidabile. Se una prestazione è stata eseguita ma non marcata come tale, Poliedron deve poter evidenziare l'incoerenza. Se un paziente non ha un piano di cura, deve poterlo segnalare come informazione potenzialmente mancante, senza assumere che il piano debba necessariamente esistere.

Poliedra deve distinguere sempre tra:

- dato certo;
- dato mancante;
- dato probabilmente incompleto;
- opportunità suggerita;
- azione confermata dall'utente.

Non deve trasformare un'assenza di dati in una falsa conclusione clinica o amministrativa.

## Data Health

La qualità dei dati deve diventare una dimensione visibile del prodotto.

Poliedra potrà progressivamente misurare una `Data Health` dello studio, per esempio attraverso:

- schede paziente incomplete;
- piani di cura incompleti o non aggiornati;
- prestazioni senza stato coerente;
- pazienti senza continuità operativa documentata;
- richiami non gestiti;
- informazioni amministrative mancanti;
- collegamenti mancanti tra attività, pazienti, documenti e pagamenti.

Il Data Health Score non deve essere punitivo. Deve essere uno strumento che mostra quanto il software può diventare più intelligente completando i dati utili.

## Principi di comportamento

Poliedra e Poliedron devono rispettare stabilmente questi principi:

1. **Il professionista resta professionista.** Il software assorbe complessità organizzativa e gestionale invece di scaricarla sull'utente.
2. **Un dato richiesto deve creare valore.** Nessun campo deve esistere soltanto per alimentare burocrazia interna.
3. **Il gestionale premia la completezza.** Dati migliori devono produrre capacità migliori.
4. **Poliedron guarda trasversalmente.** Non deve ragionare per silos quando la domanda riguarda l'intero studio.
5. **Prima il deterministico, poi il modello.** Non si spendono token per ciò che il software può sapere da solo.
6. **Suggerire non significa inventare.** Le inferenze devono essere motivate e distinguibili dai fatti.
7. **Le azioni importanti restano controllabili.** Poliedron può proporre e preparare, ma autorizzazioni e conferme restano coerenti con sicurezza, RBAC e contesto clinico.
8. **La proattività deve essere utile.** Meno notifiche, più priorità realmente azionabili.
9. **Ogni modulo deve alimentare una visione unica.** Pazienti, agenda, piani, prestazioni, pagamenti, documenti, attività e controllo di gestione devono contribuire allo stesso quadro operativo.
10. **L'intelligenza deve crescere insieme al prodotto.** Ogni nuova funzione dovrebbe chiedersi quali segnali rende disponibili a Poliedron e come migliora la qualità del dato.

## North Star

Poliedra ha successo quando il professionista può aprire il software e capire rapidamente:

- cosa richiede attenzione;
- chi rischia di essere dimenticato;
- quali opportunità sono reali;
- quali dati impediscono al sistema di essere più preciso;
- quale sia la prossima azione migliore;

senza dover ricostruire tutto manualmente e senza dover diventare un imprenditore per utilizzare bene i propri dati.

## Missione viva

Questo documento è una missione viva.

Ogni nuova funzione, decisione di prodotto o comportamento di Poliedron dovrebbe essere confrontato con questi principi. Quando emergono nuove idee coerenti con questa direzione, devono essere integrate qui in modo che la missione diventi progressivamente più precisa e più completa.
