// Impostazioni — persone, documenti personali, sezioni dei documenti, categorie, etichette, studio, account.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { sessioneStudio, esciStudio, studioDb, impostazioniAgenda, aggiornaAgendaStudio } from '../../lib/studio.js';
import { slug } from '../../lib/impostazioni.js';
import LabelSwatches from '../../../../shared/agenda/LabelSwatches.jsx';
import { labelColor } from '../../../../shared/agenda/labelPalette.js';
import { nuovaEtichetta } from '../../../../shared/agenda/etichette.js';
import { sectionDestination } from '../../../../shared/agenda/navigation.js';
import { colore, Sezione, Gruppo, Conferma, tokenSessione } from '../../ui.jsx';
import { statoNotifiche, attivaNotifiche, disattivaNotifiche, provaNotifica } from '../../lib/notifiche.js';
import { IconaPiu, IconaChiudi, IconaFreccia, IconaCestino, IconaEsci } from '../../Icone.jsx';

function ListaModificabile({ voci, onTogli, onAggiungi, segnaposto }) {
  const [nuovo, setNuovo] = useState('');
  return (
    <Gruppo>
      {voci.map((v) => (
        <div key={v.id} className="pp-voce">
          <span>{v.nome}</span>
          <button className="pp-icona-bottone pp-piccolo" aria-label={`Togli ${v.nome}`} onClick={() => onTogli(v.id)}><IconaChiudi size={16} /></button>
        </div>
      ))}
      <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nuovo.trim()) { onAggiungi(nuovo.trim()); setNuovo(''); } }}>
        <input value={nuovo} onChange={(e) => setNuovo(e.target.value)} placeholder={segnaposto} />
        <button type="submit" className="pp-chip-azione" disabled={!nuovo.trim()}>Aggiungi</button>
      </form>
    </Gruppo>
  );
}

// POL-VITA-018 — notifiche dei promemoria (cartelle, pagamenti, scadenze): alle 7 e, per quelli
// aggiunti in giornata, entro un'ora (dalle 8 alle 21).
function NotificheTelefono({ ctx }) {
  const { esegui, mostra } = ctx;
  const [stato, setStato] = useState(null);
  const leggi = () => statoNotifiche().then(setStato).catch(() => setStato({ ok: false, motivo: 'browser' }));
  useEffect(() => { leggi(); }, []);
  if (!stato) return <Gruppo><div className="pp-voce"><span className="pp-riga-meta">Controllo…</span></div></Gruppo>;
  if (!stato.ok) {
    return (
      <Gruppo><div className="pp-voce pp-voce-testo">
        {stato.motivo === 'installa'
          ? <span>Su iPhone le notifiche funzionano con l'app sulla schermata Home: in Safari tocca <strong>Condividi › Aggiungi alla schermata Home</strong>, apri Personal da lì e torna qui.</span>
          : <span>Questo browser non riceve notifiche. Usa l'app installata sul telefono.</span>}
      </div></Gruppo>
    );
  }
  const attiva = () => esegui(async () => { await attivaNotifiche(archivioDb); await leggi(); mostra('Notifiche attive su questo telefono'); });
  const spegni = () => esegui(async () => { await disattivaNotifiche(archivioDb); await leggi(); mostra('Notifiche spente su questo telefono'); });
  const prova = () => esegui(async () => { await provaNotifica({ token: await tokenSessione(), endpoint: stato.endpoint }); mostra('Notifica di prova inviata'); });
  return (
    <Gruppo>
      <div className="pp-voce pp-voce-testo">
        <span>{stato.attive ? 'Attive su questo telefono.' : 'Spente su questo telefono.'} Ricevi i promemoria del giorno alle 7 e, per quelli aggiunti in giornata, entro un'ora (dalle 8 alle 21).</span>
      </div>
      {stato.attive ? (
        <div className="pp-voce pp-voce-azioni">
          <button className="pp-chip-azione" onClick={prova}>Invia una prova</button>
          <button className="pp-testo-link" onClick={spegni}>Spegni</button>
        </div>
      ) : (
        <div className="pp-voce pp-voce-azioni"><button className="pp-bottone" onClick={attiva}>Attiva le notifiche</button></div>
      )}
    </Gruppo>
  );
}

// IMPOSTAZIONI-UNICHE (PO 2026-11-21): stessa pagina in Studio e Personal. In cima l'Agenda (comune:
// etichette e visualizzazione), poi i tasti Studio e Personale. «?imp=» sceglie l'area.
const AREE = [['agenda', 'Agenda'], ['studio', 'Studio'], ['personale', 'Personale']];
const areaIniziale = () => {
  try { const v = new URLSearchParams(globalThis.location?.search || '').get('imp'); return AREE.some(([k]) => k === v) ? v : 'agenda'; } catch { return 'agenda'; }
};
const versoStudio = (imp) => { const url = new URL(sectionDestination('studio', 'set')); url.searchParams.set('imp', imp); return url.href; };

export function PaginaImpostazioni({ ctx, email }) {
  const [area, setArea] = useState(areaIniziale);
  return (
    <>
      <div className="pp-segmenti pp-impostazioni-aree" role="tablist" aria-label="Impostazioni">
        {AREE.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={area === k} className={area === k ? 'attivo' : ''} onClick={() => setArea(k)}>{l}</button>)}
      </div>
      {area === 'agenda' && <AreaAgenda ctx={ctx} />}
      {area === 'studio' && <AreaStudio />}
      {area === 'personale' && <AreaPersonale ctx={ctx} email={email} />}
    </>
  );
}

function AreaStudio() {
  return (
    <>
      <Sezione titolo="Impostazioni dello Studio">
        <p className="pp-riga-meta pp-spiegazione">Dati dello studio, Home, documenti, privacy, prenotazione online, aspetto, azioni rapide, WhatsApp, profilo e team.</p>
        <Gruppo>
          <a className="pp-riga" href={versoStudio('studio')}>
            <span className="pp-riga-testo"><span className="pp-riga-titolo">Apri le impostazioni dello Studio</span><span className="pp-riga-meta">Stessa pagina, scheda Studio</span></span>
            <IconaFreccia size={16} />
          </a>
        </Gruppo>
      </Sezione>
      <Sezione titolo="Collegamento all'agenda dello studio">
        <StatoStudio />
      </Sezione>
    </>
  );
}

// Visualizzazione dell'agenda (stessa di studio_info.agenda_settings): valori predefiniti come
// DEF_AGENDA_SETTINGS dello studio (src/lib/utils.js).
const VISUALIZZAZIONE_BASE = { oraInizio: 8, oraFine: 20, slotMin: 30, durataDefault: 45, zoom: 1, hiddenWeekdays: [] };
const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ORE = Array.from({ length: 16 }, (_, i) => i + 6);

function AreaAgenda({ ctx }) {
  const { impostazioni, salvaEtichette, esegui, mostra } = ctx;
  const { etichette } = impostazioni;
  const cambiaEtichette = (nuove) => esegui(async () => { await salvaEtichette(nuove); });
  const [vis, setVis] = useState(null);
  const [collegata, setCollegata] = useState(true);
  useEffect(() => {
    let vivo = true;
    sessioneStudio().then(async (s) => {
      if (!s) { if (vivo) setCollegata(false); return; }
      const a = await impostazioniAgenda();
      if (vivo) setVis({ ...VISUALIZZAZIONE_BASE, ...a });
    }).catch(() => { if (vivo) setCollegata(false); });
    return () => { vivo = false; };
  }, []);
  const salvaVis = (parte) => {
    const prossima = { ...vis, ...parte };
    if (prossima.oraInizio >= prossima.oraFine) { mostra("L'ora di inizio deve essere prima dell'ora di fine"); setVis(prossima); return; }
    setVis(prossima);
    esegui(async () => { await aggiornaAgendaStudio(parte); mostra('Agenda aggiornata'); });
  };
  return (
    <>
      <p className="pp-riga-meta pp-spiegazione">Un'agenda sola per Studio e Personal: queste impostazioni valgono in entrambe.</p>
      <Sezione titolo="Etichette dell'agenda">
        <p className="pp-riga-meta pp-spiegazione">Le trovi quando crei un impegno, con il loro colore. «Compleanni» c'è sempre.</p>
        <Gruppo>
          {etichette.map((e) => (
            <div key={e.id} className="pp-voce">
              <span><span className="pp-punto" style={{ '--c': labelColor(e.colore) }} />{e.nome}</span>
              <span className="pp-voce-azioni">
                <input type="color" className="pp-colore pp-colore-piccolo" value={e.colore} aria-label={`Colore di ${e.nome}`}
                  onChange={(ev) => cambiaEtichette(etichette.map((x) => (x.id === e.id ? { ...x, colore: ev.target.value } : x)))} />
                <button className="pp-icona-bottone pp-piccolo" aria-label={`Togli ${e.nome}`} disabled={etichette.length < 2 || e.id === 'compleanni'}
                  onClick={() => cambiaEtichette(etichette.filter((x) => x.id !== e.id))}><IconaChiudi size={16} /></button>
              </span>
            </div>
          ))}
          <NuovaEtichetta onAggiungi={(nome, colore) => esegui(async () => { await salvaEtichette([...etichette, nuovaEtichetta(etichette, nome, colore)]); })} />
        </Gruppo>
      </Sezione>
      <Sezione titolo="Visualizzazione">
        {!collegata ? (
          <Gruppo><div className="pp-voce pp-voce-testo"><span>Collega l'agenda dello studio (scheda Studio) per cambiare orari e giorni visibili.</span></div></Gruppo>
        ) : !vis ? (
          <Gruppo><div className="pp-voce"><span className="pp-riga-meta">Carico…</span></div></Gruppo>
        ) : (
          <div className="pp-agenda-vis">
            <div className="pp-due">
              <label className="pp-campo"><span>Inizio giornata</span>
                <select className="pp-select" value={vis.oraInizio} onChange={(e) => salvaVis({ oraInizio: Number(e.target.value) })}>{ORE.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
              <label className="pp-campo"><span>Fine giornata</span>
                <select className="pp-select" value={vis.oraFine} onChange={(e) => salvaVis({ oraFine: Number(e.target.value) })}>{ORE.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
            </div>
            <div className="pp-due">
              <label className="pp-campo"><span>Righe ogni</span>
                <select className="pp-select" value={vis.slotMin} onChange={(e) => salvaVis({ slotMin: Number(e.target.value) })}>{[15, 30, 60].map((m) => <option key={m} value={m}>{m} minuti</option>)}</select></label>
              <label className="pp-campo"><span>Durata nuovo appuntamento</span>
                <select className="pp-select" value={vis.durataDefault} onChange={(e) => salvaVis({ durataDefault: Number(e.target.value) })}>{[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minuti</option>)}</select></label>
            </div>
            <label className="pp-campo"><span>Zoom della griglia</span>
              <select className="pp-select" value={vis.zoom} onChange={(e) => salvaVis({ zoom: Number(e.target.value) })}>
                {[[0.6, 'Compatto'], [0.8, 'Ridotto'], [1, 'Normale'], [1.3, 'Grande'], [1.6, 'Molto grande']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></label>
            <div className="pp-campo"><span>Giorni visibili nella settimana</span>
              <div className="pp-giorni-visibili">
                {[1, 2, 3, 4, 5, 6, 0].map((g) => {
                  const nascosto = (vis.hiddenWeekdays || []).includes(g);
                  return <button key={g} type="button" aria-pressed={!nascosto} className={nascosto ? '' : 'attivo'}
                    onClick={() => salvaVis({ hiddenWeekdays: nascosto ? vis.hiddenWeekdays.filter((x) => x !== g) : [...(vis.hiddenWeekdays || []), g] })}>{GIORNI[g]}</button>;
                })}
              </div>
            </div>
          </div>
        )}
      </Sezione>
      <Sezione titolo="Tipi di appuntamento e multi-agenda">
        <Gruppo>
          <a className="pp-riga" href={versoStudio('agenda')}>
            <span className="pp-riga-testo"><span className="pp-riga-titolo">Tipi di appuntamento, operatori e poltrone</span><span className="pp-riga-meta">Nella stessa pagina dello Studio, scheda Agenda</span></span>
            <IconaFreccia size={16} />
          </a>
        </Gruppo>
      </Sezione>
    </>
  );
}

function AreaPersonale({ ctx, email }) {
  const { impostazioni, salvaImp, apri } = ctx;
  const { persone, categorie, sezioni } = impostazioni;
  return (
    <>
      <Sezione titolo="Persone">
        <p className="pp-riga-meta pp-spiegazione">A chi appartengono i documenti personali (carta d'identità, codice fiscale, …).</p>
        <ListaModificabile
          voci={persone.map((p) => ({ id: p, nome: p }))}
          onTogli={(p) => salvaImp({ ...impostazioni, persone: persone.filter((x) => x !== p) })}
          onAggiungi={(p) => salvaImp({ ...impostazioni, persone: [...persone, p] })}
          segnaposto="Nome e cognome"
        />
      </Sezione>
      <Sezione titolo="Documenti personali">
        <p className="pp-riga-meta pp-spiegazione">Le schede della sezione Personali.</p>
        <ListaModificabile
          voci={categorie}
          onTogli={(id) => salvaImp({ ...impostazioni, categorie: categorie.filter((c) => c.id !== id) })}
          onAggiungi={(nome) => salvaImp({ ...impostazioni, categorie: [...categorie, { id: slug(nome), nome, parole: [nome.toLowerCase()] }] })}
          segnaposto="Es. Tessera elettorale"
        />
      </Sezione>
      <Sezione titolo="Sezioni dei documenti">
        <p className="pp-riga-meta pp-spiegazione">Le schede in Documenti, accanto a Tutti e Pratiche. Ogni sezione raccoglie fascicoli e parole chiave.</p>
        <Gruppo>
          {sezioni.map((s) => (
            <button key={s.id} className="pp-riga" onClick={() => apri({ tipo: 'sezione', id: s.id })}>
              <span className="pp-riga-testo"><span className="pp-riga-titolo">{s.nome}</span><span className="pp-riga-meta">{[...s.fascicoli, ...s.parole].join(', ') || 'nessuna regola'}</span></span>
              <IconaFreccia size={16} />
            </button>
          ))}
          <button className="pp-riga pp-riga-aggiungi" onClick={() => apri({ tipo: 'sezione', id: null })}><IconaPiu size={18} /><span>Nuova sezione</span></button>
        </Gruppo>
      </Sezione>
      <Sezione titolo="Categorie delle spese">
        <ListaModificabile
          voci={impostazioni.categorieSpesa.map((c) => ({ id: c, nome: c }))}
          onTogli={(c) => salvaImp({ ...impostazioni, categorieSpesa: impostazioni.categorieSpesa.filter((x) => x !== c) })}
          onAggiungi={(c) => salvaImp({ ...impostazioni, categorieSpesa: [...impostazioni.categorieSpesa, c] })}
          segnaposto="Es. Animali"
        />
      </Sezione>
      <Sezione titolo="Categorie degli incassi">
        <ListaModificabile
          voci={impostazioni.categorieIncasso.map((c) => ({ id: c, nome: c }))}
          onTogli={(c) => salvaImp({ ...impostazioni, categorieIncasso: impostazioni.categorieIncasso.filter((x) => x !== c) })}
          onAggiungi={(c) => salvaImp({ ...impostazioni, categorieIncasso: [...impostazioni.categorieIncasso, c] })}
          segnaposto="Es. Vendite"
        />
      </Sezione>
      <Sezione titolo="Notifiche sul telefono">
        <NotificheTelefono ctx={ctx} />
      </Sezione>
      <Sezione titolo="Account">
        <Gruppo>
          <div className="pp-voce"><span>{email}</span></div>
          <button className="pp-riga pp-rosso" onClick={() => archivioDb.auth.signOut()}><IconaEsci size={18} /><span>Esci</span></button>
        </Gruppo>
      </Sezione>
    </>
  );
}

function NuovaEtichetta({ onAggiungi }) {
  const [nome, setNome] = useState('');
  const [colore, setColore] = useState('#8460CC');
  return (
    <form className="pp-voce pp-voce-nuova" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) { onAggiungi(nome.trim(), colore); setNome(''); } }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nuova etichetta" />
      <button type="submit" className="pp-chip-azione" disabled={!nome.trim()}>Aggiungi</button>
      <LabelSwatches value={colore} onChange={setColore} size={24} className="pp-voce-colori" />
    </form>
  );
}

function StatoStudio() {
  const [sessione, setSessione] = useState(undefined);
  useEffect(() => {
    sessioneStudio().then(setSessione);
    const { data } = studioDb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (sessione === undefined) return null;
  return (
    <Gruppo>
      <div className="pp-voce"><span>{sessione ? `Collegata come ${sessione.user?.email}` : 'Non collegata: apri Agenda per collegarla.'}</span></div>
      {sessione && <button className="pp-riga pp-rosso" onClick={() => esciStudio()}><IconaEsci size={18} /><span>Scollega l'agenda dello studio</span></button>}
    </Gruppo>
  );
}

export function PaginaSezione({ id, ctx, chiudi }) {
  const { impostazioni, salvaImp, fascicoli } = ctx;
  const esistente = impostazioni.sezioni.find((s) => s.id === id);
  const [nome, setNome] = useState(esistente?.nome || '');
  const [scelti, setScelti] = useState(esistente?.fascicoli || []);
  const [parole, setParole] = useState((esistente?.parole || []).join(', '));
  const [conferma, setConferma] = useState(false);
  const salva = async () => {
    const sezione = { id: esistente?.id || slug(nome), nome: nome.trim(), fascicoli: scelti, parole: parole.split(',').map((p) => p.trim()).filter(Boolean) };
    const altre = impostazioni.sezioni.filter((s) => s.id !== esistente?.id);
    await salvaImp({ ...impostazioni, sezioni: esistente ? impostazioni.sezioni.map((s) => (s.id === esistente.id ? sezione : s)) : [...altre, sezione] });
    chiudi();
  };
  return (
    <>
      <label className="pp-campo"><span>Nome della sezione</span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Casa al mare" /></label>
      <Sezione titolo="Fascicoli inclusi">
        <Gruppo>
          {fascicoli.map((f) => (
            <label key={f.codice} className="pp-voce pp-spunta">
              <span><span className="pp-punto" style={{ '--c': colore(f.codice) }} />{f.nome}</span>
              <input type="checkbox" checked={scelti.includes(f.codice)} onChange={(e) => setScelti(e.target.checked ? [...scelti, f.codice] : scelti.filter((x) => x !== f.codice))} />
            </label>
          ))}
        </Gruppo>
      </Sezione>
      <label className="pp-campo"><span>Parole chiave (separate da virgole)</span>
        <input value={parole} onChange={(e) => setParole(e.target.value)} placeholder="Es. pellet, legna, stufa" />
      </label>
      <p className="pp-riga-meta">Un documento entra nella sezione se è in uno dei fascicoli scelti, oppure se il titolo o il riassunto contiene una delle parole.</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!nome.trim() || (!scelti.length && !parole.trim())} onClick={salva}>Salva sezione</button>
      {esistente && (
        <div className="pp-elimina">
          {!conferma
            ? <button className="pp-testo-link pp-rosso" onClick={() => setConferma(true)}><IconaCestino size={16} /> Togli la sezione</button>
            : <Conferma testo="Togliere la sezione? I documenti restano in archivio." etichetta="Togli"
              onNo={() => setConferma(false)} onSi={async () => { await salvaImp({ ...impostazioni, sezioni: impostazioni.sezioni.filter((s) => s.id !== esistente.id) }); chiudi(); }} />}
        </div>
      )}
    </>
  );
}
