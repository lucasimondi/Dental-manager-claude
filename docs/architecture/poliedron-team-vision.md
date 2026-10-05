# Poliedron — assistenti verticali, gruppi e Clinic Manager

Decisione Product Owner: Luca Simondi, 5 ottobre 2026.
Stato: direzione di prodotto richiesta; implementazione futura da progettare e prioritizzare.

## Visione richiesta

Poliedron deve diventare una chat nella quale gli assistenti AI appaiono come utenti/contatti. Ogni assistente ha un'area assegnata e una conoscenza specialistica verticale.

L'utente può creare gruppi con più assistenti. I gruppi sono tematici, hanno obiettivi condivisi e permettono agli assistenti di ragionare insieme e collaborare per raggiungerli.

Il Clinic Manager è un assistente con un ruolo specifico di gestione e coordinamento. Quando la risposta richiede conoscenza verticale, può interrogare autonomamente gli specialisti necessari, raccoglierne i contributi e restituire una risposta integrata all'utente.

## Relazione con l'architettura attuale

Questa decisione estende la direzione precedente di un unico Poliedron conversazionale. Il requisito attuale del singleton, descritto in `chat-polyedron.md`, documenta l'implementazione esistente: questa nota non afferma che contatti AI, gruppi o orchestrazione multi-agente siano già implementati.

Poliedron resta l'esperienza unificata. La futura progettazione deve riusare core, Model Gateway, fonti autorevoli, strumenti e autorizzazioni esistenti; non autorizza incidentalmente motori paralleli, nuovi schemi, migration o deploy.

## Proposte tecniche da valutare

- Ruolo, conoscenze, strumenti e permessi espliciti per ogni assistente.
- Obiettivo, contesto condiviso e responsabile della sintesi per ogni gruppo.
- Coinvolgimento dei soli specialisti necessari, con limiti a tempi, costi e turni di confronto.
- Contributi e divergenze tracciabili; l'accordo fra agenti non verifica i fatti.
- Nessuna estensione dei permessi dell'utente tramite il Clinic Manager o un gruppo; mantenere isolamento tra studi, capability e assignment.
- Conservare le regole di autonomia, audit e conferma applicabili alle azioni esistenti; il coordinamento non autorizza nuove scritture.

## Prossimo passo

Audit dell'orchestrazione e della persistenza esistenti, quindi proposta di implementazione progressiva con criteri di accettazione. Questa registrazione non sostituisce il lavoro operativo POL-AI-010 in corso.
