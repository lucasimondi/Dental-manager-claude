# Stato progetto — Poliedra

Ultimo aggiornamento iniziale Control Room: 18 agosto 2026.

## Operatività squadra
- GitHub coordinamento: operativo.
- Codex: operativo sul repository.
- Claude Code: previsto come agente intercambiabile secondo handoff.
- Supabase: accesso backend verificato dal Tech Lead.
- Ambiente locale Windows: WSL2 + Ubuntu configurati; setup test Supabase locale in corso.

## Task corrente
`POL-002A — Critical Security Hardening`

Stato noto: `WAITING_PRODUCT_OWNER` dopo preparazione patch; migration e test SQL preparati ma non ancora eseguiti in ambiente Supabase isolato.

## P0 noti
- `patient-files` pubblico e utilizzato per file associati ai pazienti.
- Patch POL-002A da validare in ambiente isolato prima di qualsiasi applicazione production.
- Inventario SECURITY DEFINER/grants da completare.
- Backend Supabase da rendere progressivamente riproducibile dal repository.
- Relazioni Physio da valutare per tenant-safe foreign keys.

## Regola aggiornamento
Questo file è una vista executive. Lo stato operativo autorevole dei task resta in `docs/coordination/current-task.md` e `docs/coordination/handoffs.md`.