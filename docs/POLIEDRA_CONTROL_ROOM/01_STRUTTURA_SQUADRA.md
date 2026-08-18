# Struttura squadra Poliedra

## Product Owner
**Luca** — decide priorità prodotto, approva cambi sensibili, merge/deploy critici e decisioni di business.

## Tech Lead / coordinamento
**ChatGPT** — trasforma gli obiettivi in task, verifica architettura e Supabase, coordina review e propone le decisioni al Product Owner.

## Coding agents
**Codex** e **Claude Code** — sviluppatori intercambiabili. Un solo owner per task alla volta. Lo stato del lavoro deve vivere nel repository, non nella cronologia chat.

## Fonte di verità
**GitHub** — codice, documentazione, migrations, task, handoff e decisioni.

**Supabase** — backend/database reale. Ogni modifica deve diventare riproducibile e versionata prima di essere considerata parte stabile dell'architettura.

**Vercel** — deployment applicativo attualmente rilevato; l'autorità definitiva di deployment va mantenuta documentata.

## Flusso standard

Product Owner → Tech Lead → task `POL-XXX` → agente owner → branch dedicato → test → handoff → review → approvazione Product Owner → PR → merge → deployment controllato.

## Cambio agente

Se l'agente termina crediti o disponibilità, il nuovo agente legge `AGENTS.md`, `current-task.md`, documentazione rilevante e ultimo handoff, quindi continua sullo stesso stato verificato senza ricostruire il contesto dalla chat.