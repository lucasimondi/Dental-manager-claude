import ProfiloUtente from './ProfiloUtente.jsx';
import GestioneUtenti from './GestioneUtenti.jsx';
import React, { useState, useEffect } from 'react';
import { Btn, Crd, Fld, Inp, Sel, Txt, Modal, Toast, Ic, DockIc, DOCK_ICON_STYLES } from './ui';
import { C, uid, DEF_STUDIO, COLORI_DISPONIBILI, VERTICALI_DISPONIBILI, DEF_DOCK_SETTINGS, DEF_AGENDA_SETTINGS, DEF_DOCUMENTI_SETTINGS } from '../lib/utils';
import { supabase } from '../lib/supabase';

const GIORNI_SETTIMANA = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

export default function Impostazioni({ studioInfo, setStudioInfo, appTypes, setAppTypes, currentUserId, onNomeChange, features, theme, toggleTheme }) {
  const [si, setSi] = useState({ ...DEF_STUDIO, ...(studioInfo || {}) });
  const [toast, setToast] = useState('');
  const [tipoModal, setTipoModal] = useState(null);
  const [tipoForm, setTipoForm] = useState({ nome: '', colore: COLORI_DISPONIBILI[0], durata: '', online_abilitato: false, online_giorni: [1, 2, 3, 4, 5], online_ora_inizio: '09:00', online_ora_fine: '18:00' });
  const S = (f) => setSi((s) => ({ ...s, ...f }));
  const agSet = { ...DEF_AGENDA_SETTINGS, ...(si.agenda_settings || {}) };
  const SA = (f) => S({ agenda_settings: { ...agSet, ...f } });
  const docSet = { ...DEF_DOCUMENTI_SETTINGS, ...(si.documenti_settings || {}) };
  const SD = (f) => S({ documenti_settings: { ...docSet, ...f } });
  const save = () => { setStudioInfo(si); setToast('Salvato ✓'); };

  // Slug pubblico per il link di prenotazione online: non è parte del blob
  // studio_info come le altre impostazioni sopra, è una colonna diretta
  // sulla tabella studios — va caricata/salvata separatamente.
  const [studioId, setStudioId] = useState(null);
  const [slug, setSlug] = useState('');
  const [slugSalvato, setSlugSalvato] = useState('');
  const [slugStato, setSlugStato] = useState(''); // '', 'salvando', 'ok', 'occupato', 'errore'
  const [modalitaPrenotazione, setModalitaPrenotazione] = useState('richiesta');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const id = session?.user?.app_metadata?.studio_id;
      if (!id) return;
      setStudioId(id);
      supabase.from('studios').select('slug, modalita_prenotazione').eq('id', id).maybeSingle().then(({ data }) => {
        if (data?.slug) { setSlug(data.slug); setSlugSalvato(data.slug); }
        if (data?.modalita_prenotazione) setModalitaPrenotazione(data.modalita_prenotazione);
      });
    });
  }, []);

  const cambiaModalitaPrenotazione = async (nuova) => {
    setModalitaPrenotazione(nuova); // ottimistico, l'interazione resta fluida
    if (!studioId) return;
    await supabase.from('studios').update({ modalita_prenotazione: nuova }).eq('id', studioId);
  };

  const slugPulito = (v) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const salvaSlug = async () => {
    const pulito = slugPulito(slug);
    if (!pulito || !studioId) return;
    setSlugStato('salvando');
    const { error } = await supabase.from('studios').update({ slug: pulito }).eq('id', studioId);
    if (error) {
      // violazione unique constraint = slug già usato da un altro studio
      setSlugStato(error.code === '23505' ? 'occupato' : 'errore');
      return;
    }
    setSlug(pulito);
    setSlugSalvato(pulito);
    setSlugStato('ok');
  };

  const linkPrenotazione = slugSalvato ? `${window.location.origin}/prenota/${slugSalvato}` : '';
  const [linkCopiato, setLinkCopiato] = useState(false);
  const copiaLink = async () => {
    try { await navigator.clipboard.writeText(linkPrenotazione); setLinkCopiato(true); setTimeout(() => setLinkCopiato(false), 2000); } catch {}
  };

  // ── WhatsApp Business (automazione) ──
  // Tabella separata (whatsapp_config), non fa parte di studioInfo: si legge/scrive
  // direttamente, protetta dalla stessa RLS studio-scoped di tutto il resto.
  const [waConfig, setWaConfig] = useState(null); // riga esistente (null finché non caricata/creata)
  const [waForm, setWaForm] = useState({ phone_number_id: '', waba_id: '', attivo: true });
  const [waLoading, setWaLoading] = useState(true);
  const [waSaving, setWaSaving] = useState(false);
  const [waMsg, setWaMsg] = useState('');

  useEffect(() => {
    let annullato = false;
    (async () => {
      if (!si.studio_id) { setWaLoading(false); return; }
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('studio_id', si.studio_id)
        .maybeSingle();
      if (annullato) return;
      if (!error && data) {
        setWaConfig(data);
        setWaForm({
          phone_number_id: data.phone_number_id || '',
          waba_id: data.waba_id || '',
          attivo: data.attivo !== false,
        });
      }
      setWaLoading(false);
    })();
    return () => { annullato = true; };
  }, [si.studio_id]);

  const WF = (f) => setWaForm((p) => ({ ...p, ...f }));

  const saveWaConfig = async () => {
    if (!waForm.phone_number_id) {
      setWaMsg('Serve almeno il Phone Number ID (te lo dà Meta quando aggiunge il numero dello studio alla App).');
      return;
    }
    setWaSaving(true);
    setWaMsg('');
    const payload = { ...waForm, studio_id: si.studio_id };
    const { data, error } = waConfig
      ? await supabase.from('whatsapp_config').update(payload).eq('id', waConfig.id).select().single()
      : await supabase.from('whatsapp_config').insert(payload).select().single();
    setWaSaving(false);
    if (error) { setWaMsg('Errore: ' + error.message); return; }
    setWaConfig(data);
    setWaMsg('Salvato ✓');
  };

  const openNewTipo = () => { setTipoForm({ nome: '', colore: COLORI_DISPONIBILI[Math.floor(Math.random() * COLORI_DISPONIBILI.length)] }); setTipoModal('new'); };
  const openEditTipo = (t) => { setTipoForm({ durata: '', online_abilitato: false, online_giorni: [1, 2, 3, 4, 5], online_ora_inizio: '09:00', online_ora_fine: '18:00', ...t }); setTipoModal(t.id); };
  const saveTipo = () => {
    if (!tipoForm.nome) return;
    if (tipoModal === 'new') setAppTypes((p) => [...p, { ...tipoForm, id: uid() }]);
    else setAppTypes((p) => p.map((t) => (t.id === tipoModal ? { ...tipoForm } : t)));
    setTipoModal(null);
  };
  const delTipo = (id) => {
    if (confirm('Eliminare questo tipo di appuntamento?')) {
      setAppTypes((p) => p.filter((t) => t.id !== id));
      setTipoModal(null);
    }
  };

  return (
    <div>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Impostazioni Studio</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Dati che appaiono sul PDF preventivo</div>
      </div>
      {toggleTheme && (
        <Crd style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Aspetto</div>
              <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Tema chiaro per il lavoro diurno, scuro per le sessioni serali</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn ch="Chiaro" sz="sm" v={theme === 'light' ? 'pri' : 'sec'} onClick={() => theme !== 'light' && toggleTheme()} ic="sun" />
              <Btn ch="Scuro" sz="sm" v={theme === 'dark' ? 'pri' : 'sec'} onClick={() => theme !== 'dark' && toggleTheme()} ic="moon" />
            </div>
          </div>
        </Crd>
      )}
      <Crd style={{ marginBottom: 11, background: `linear-gradient(135deg,${C.priL},${C.sucL})`, border: `1px solid ${C.pri}30` }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 19, fontStyle: 'italic', fontWeight: 700 }}>{si.nome || 'Nome Studio'}</div>
          {si.spec && <div style={{ fontSize: 11, color: '#4A90C4', marginTop: 2 }}>{si.spec}</div>}
          {si.iscr && <div style={{ fontSize: 10, color: '#4A90C4' }}>{si.iscr}</div>}
        </div>
        <div style={{ borderTop: `1px solid ${C.brd}`, marginTop: 8, paddingTop: 7, display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 5 }}>
          {si.tel && <span style={{ fontSize: 10, color: C.txm }}>📞 {si.tel}</span>}
          {si.addr1 && <span style={{ fontSize: 10, color: C.txm }}>📍 {si.addr1}</span>}
          {si.email && <span style={{ fontSize: 10, color: C.txm }}>✉️ {si.email}</span>}
        </div>
      </Crd>
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Tipo di studio</div>
        <Fld label="Ambito professionale">
          <div style={{ padding: '11px 13px', borderRadius: 10, background: C.bg, border: `1.5px solid ${C.brd}`, fontSize: 14, fontWeight: 700, color: C.txt }}>
            {si.vertical === 'altro' && si.vertical_altro ? si.vertical_altro : (VERTICALI_DISPONIBILI.find((v) => v.id === (si.vertical || 'dentistico')) || {}).label}
          </div>
        </Fld>
        <div style={{ fontSize: 11, color: C.txl, marginTop: 4 }}>Impostato in fase di registrazione e non modificabile, per evitare incoerenze tra i dati (es. listino, template). Contattaci se hai bisogno di cambiarlo.</div>
      </Crd>
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Intestazione PDF</div>
        <Fld label="Nome / Ragione sociale"><Inp value={si.nome} onChange={(e) => S({ nome: e.target.value })} /></Fld>
        <Fld label="Specializzazione"><Inp value={si.spec} onChange={(e) => S({ spec: e.target.value })} /></Fld>
        <Fld label="Iscrizione ordine"><Inp value={si.iscr} onChange={(e) => S({ iscr: e.target.value })} /></Fld>
      </Crd>
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Contatti</div>
        <Fld label="Telefono"><Inp type="tel" value={si.tel} onChange={(e) => S({ tel: e.target.value })} /></Fld>
        <Fld label="Email"><Inp type="email" value={si.email} onChange={(e) => S({ email: e.target.value })} /></Fld>
        <Fld label="Sede 1"><Inp value={si.addr1} onChange={(e) => S({ addr1: e.target.value })} /></Fld>
        <Fld label="Sede 2"><Inp value={si.addr2} onChange={(e) => S({ addr2: e.target.value })} /></Fld>
        <Fld label="P.IVA"><Inp value={si.piva} onChange={(e) => S({ piva: e.target.value })} /></Fld>
      </Crd>
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Timbro professionale e firma</div>
        <div style={{ fontSize: 11, color: C.txl, marginBottom: 10 }}>Usati nei documenti medici (ricette, certificati, lettere) e nei rimborsi spese. Nome, specializzazione, iscrizione e contatti sono già presi dalle sezioni sopra.</div>
        <Fld label="IBAN (per rimborsi)"><Inp value={si.iban || ''} onChange={(e) => S({ iban: e.target.value })} placeholder="es. IT60X0542811101000000123456" style={{ fontFamily: 'monospace' }} /></Fld>
        <Fld label="Firma scansionata">
          {si.firma_b64 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={si.firma_b64} alt="Firma" style={{ height: 50, background: '#fff', border: `1px solid ${C.brd}`, borderRadius: 6, padding: 4 }} />
              <Btn ch="Rimuovi" v="sec" sz="sm" onClick={() => S({ firma_b64: null })} />
            </div>
          ) : (
            <div>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1_500_000) { setToast('Immagine troppo grande (max 1.5MB)'); return; }
                  const reader = new FileReader();
                  reader.onload = () => S({ firma_b64: reader.result });
                  reader.readAsDataURL(file);
                }}
                style={{ fontSize: 12 }}
              />
              <div style={{ fontSize: 10, color: C.txl, marginTop: 4 }}>PNG o JPG, meglio se con sfondo trasparente. Comparirà nel timbro dei documenti medici, nella stessa posizione della firma.</div>
            </div>
          )}
        </Fld>
      </Crd>
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Personalizzazione (Premium)</div>
        {!features?.custom_branding ? (
          <div style={{ background: C.bg, borderRadius: 12, padding: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🔒</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Disponibile nel piano Premium</div>
            <div style={{ fontSize: 12, color: C.txm }}>Carica il tuo logo al posto di quello Poliedra nell'intestazione dell'app.</div>
          </div>
        ) : (
          <Fld label="Logo personalizzato (sostituisce quello Poliedra nell'header)">
            {si.custom_logo_b64 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={si.custom_logo_b64} alt="Logo" style={{ height: 40, background: C.priD, borderRadius: 6, padding: 6 }} />
                <Btn ch="Rimuovi" v="sec" sz="sm" onClick={() => S({ custom_logo_b64: null })} />
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1_500_000) { setToast('Immagine troppo grande (max 1.5MB)'); return; }
                    const reader = new FileReader();
                    reader.onload = () => S({ custom_logo_b64: reader.result });
                    reader.readAsDataURL(file);
                  }}
                  style={{ fontSize: 12 }}
                />
                <div style={{ fontSize: 10, color: C.txl, marginTop: 4 }}>PNG o JPG, meglio se con sfondo trasparente. Comparirà al posto del logo Poliedra nell'header scuro dell'app.</div>
              </div>
            )}
          </Fld>
        )}
      </Crd>
      <Crd style={{ marginBottom: 11 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.pri, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Note legali PDF</div>
        <Txt value={si.note} onChange={(e) => S({ note: e.target.value })} rows={3} placeholder="Il preventivo è valido 30 giorni…" />
      </Crd>
      <Btn ch="💾 Salva impostazioni" onClick={save} full sz="lg" />

      <div style={{ marginTop: 26, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Agenda</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Tipi di appuntamento e colori associati</div>
      </div>
      <Crd style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
        {appTypes.map((t, i) => (
          <div key={t.id} onClick={() => openEditTipo(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', borderBottom: i < appTypes.length - 1 ? `1px solid ${C.brd}` : 'none', cursor: 'pointer' }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: t.colore, flexShrink: 0, border: '1px solid rgba(0,0,0,0.08)' }} />
            <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{t.nome}</span>
            <Ic n="edit" s={12} c={C.txl} />
          </div>
        ))}
        {appTypes.length === 0 && <div style={{ textAlign: 'center', color: C.txl, padding: 24 }}>Nessun tipo configurato</div>}
      </Crd>
      <Btn ch="+ Nuovo tipo appuntamento" v="sec" onClick={openNewTipo} full />

      <div style={{ marginTop: 26, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Impostazioni Agenda</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Orari, slot e giorni visibili — valgono per tutto lo studio</div>
      </div>
      <Crd style={{ marginBottom: 14 }}>
        <Fld label="Ora inizio giornata">
          <Sel value={agSet.oraInizio} onChange={(e) => SA({ oraInizio: Number(e.target.value) })}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </Sel>
        </Fld>
        <Fld label="Ora fine giornata">
          <Sel value={agSet.oraFine} onChange={(e) => SA({ oraFine: Number(e.target.value) })}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </Sel>
        </Fld>
        <Fld label="Dimensione slot">
          <Sel value={agSet.slotMin} onChange={(e) => SA({ slotMin: Number(e.target.value) })}>
            <option value={15}>15 minuti</option>
            <option value={30}>30 minuti (consigliato)</option>
            <option value={60}>60 minuti</option>
          </Sel>
        </Fld>
        <Fld label="Durata predefinita nuovo appuntamento">
          <Sel value={agSet.durataDefault} onChange={(e) => SA({ durataDefault: Number(e.target.value) })}>
            <option value={15}>15 minuti</option>
            <option value={30}>30 minuti</option>
            <option value={45}>45 minuti</option>
            <option value={60}>60 minuti</option>
            <option value={90}>90 minuti</option>
          </Sel>
        </Fld>
        <Fld label="Zoom griglia">
          <Sel value={agSet.zoom} onChange={(e) => SA({ zoom: Number(e.target.value) })}>
            <option value={0.6}>Compatto — vedo più ore insieme</option>
            <option value={0.8}>Ridotto</option>
            <option value={1}>Normale (consigliato)</option>
            <option value={1.3}>Grande</option>
            <option value={1.6}>Molto grande — più leggibile</option>
          </Sel>
        </Fld>
        {agSet.oraInizio >= agSet.oraFine && <div style={{ background: C.danL, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: C.dan, fontWeight: 700 }}>⚠️ L'ora di inizio deve essere prima dell'ora di fine</div>}
        <div style={{ background: C.bg, borderRadius: 9, padding: '9px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.txm, fontWeight: 700 }}>{String(agSet.oraInizio).padStart(2, '0')}:00 — {String(agSet.oraFine).padStart(2, '0')}:00 · slot da {agSet.slotMin} min · {Math.ceil((agSet.oraFine - agSet.oraInizio) * 60 / agSet.slotMin)} slot totali</div>
        </div>
        <Fld label="Giorni visibili in vista Settimana">
          <div style={{ display: 'flex', gap: 4 }}>
            {GIORNI_SETTIMANA.map((lbl, wd) => {
              const hidden = (agSet.hiddenWeekdays || []).includes(wd);
              return (
                <button key={wd} onClick={() => SA({ hiddenWeekdays: hidden ? agSet.hiddenWeekdays.filter((x) => x !== wd) : [...(agSet.hiddenWeekdays || []), wd] })} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${hidden ? C.brd : C.pri}`, background: hidden ? C.bg : C.priL, color: hidden ? C.txl : C.pri, fontWeight: 700, fontSize: 10.5, cursor: 'pointer' }}>{lbl}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: C.txl, marginTop: 5 }}>Tocca un giorno per nasconderlo dalla vista Settimana (es. domenica se lo studio è chiuso)</div>
        </Fld>
      </Crd>
      <Btn ch="💾 Salva impostazioni agenda" onClick={save} dis={agSet.oraInizio >= agSet.oraFine} full sz="lg" />

      <div style={{ marginTop: 26, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Archiviazione documenti</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Quali PDF generati restano salvati in scheda paziente (consultabili e cancellabili in seguito). Se disattivato, il documento resta comunque scaricabile/condivisibile ma non ne tieni una copia nell'app.</div>
      </div>
      <Crd style={{ marginBottom: 14 }}>
        {[
          ['ricetta', '💊 Ricetta medica'],
          ['esami', '🩸 Prescrizione esami ematici'],
          ['certificato', '📋 Certificato di visita'],
          ['lettera', '✉️ Lettera per specialista'],
          ['protocollo', '📖 Protocollo post-trattamento'],
          ['vuoto', '📝 Foglio bianco intestato'],
          ['fattura', '🧾 Fattura'],
          ['rimborso', '🧾 Rimborso spese'],
        ].map(([key, label], i, arr) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px', borderBottom: i < arr.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
            <span style={{ fontSize: 13.5, color: C.txt }}>{label}</span>
            <button
              onClick={() => SD({ [key]: !docSet[key] })}
              style={{
                width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: docSet[key] ? C.pri : C.brd, transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3,
                left: docSet[key] ? 21 : 3, transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              }} />
            </button>
          </div>
        ))}
      </Crd>
      <Btn ch="💾 Salva impostazioni documenti" onClick={save} full sz="lg" />

      <div style={{ marginTop: 26, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Prenotazione online</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Link pubblico da condividere con i pazienti per fissare un appuntamento.</div>
      </div>
      <Crd style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 10 }}>Modalità</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => cambiaModalitaPrenotazione('richiesta')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${modalitaPrenotazione === 'richiesta' ? C.pri : C.brd}`, background: modalitaPrenotazione === 'richiesta' ? C.priL : C.sur, cursor: 'pointer' }}
          >
            <div style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${modalitaPrenotazione === 'richiesta' ? C.pri : C.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {modalitaPrenotazione === 'richiesta' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.pri }} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: C.txt }}>Richiesta</div>
              <div style={{ fontSize: 11.5, color: C.txm, marginTop: 2 }}>Il paziente indica date preferite, tu confermi a mano dall'Agenda</div>
            </div>
          </button>
          <button
            onClick={() => cambiaModalitaPrenotazione('diretta')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${modalitaPrenotazione === 'diretta' ? C.pri : C.brd}`, background: modalitaPrenotazione === 'diretta' ? C.priL : C.sur, cursor: 'pointer' }}
          >
            <div style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${modalitaPrenotazione === 'diretta' ? C.pri : C.brd}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {modalitaPrenotazione === 'diretta' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.pri }} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: C.txt }}>Diretta</div>
              <div style={{ fontSize: 11.5, color: C.txm, marginTop: 2 }}>Il paziente vede gli orari liberi e prenota subito, senza conferma manuale</div>
            </div>
          </button>
        </div>
        {modalitaPrenotazione === 'diretta' && (
          <div style={{ fontSize: 11, color: C.txl, marginTop: 10 }}>
            Per attivarla, apri ogni Tipo Appuntamento che vuoi rendere prenotabile online (qui sopra ↑) e abilita "Prenotabile online".
          </div>
        )}
      </Crd>

      <Crd style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Indirizzo del link</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: `1.5px solid ${C.brd}`, borderRadius: 10, overflow: 'hidden' }}>
            <span style={{ padding: '11px 0 11px 12px', fontSize: 13, color: C.txl, whiteSpace: 'nowrap' }}>/prenota/</span>
            <input
              value={slug}
              onChange={(e) => { setSlug(slugPulito(e.target.value)); setSlugStato(''); }}
              placeholder="nome-studio"
              style={{ flex: 1, border: 'none', outline: 'none', padding: '11px 12px 11px 0', fontSize: 13, color: C.txt, minWidth: 0 }}
            />
          </div>
          <button
            onClick={salvaSlug}
            disabled={!slug || slug === slugSalvato || slugStato === 'salvando'}
            style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: (!slug || slug === slugSalvato) ? C.brd : C.pri, color: (!slug || slug === slugSalvato) ? C.txl : '#fff', fontWeight: 700, fontSize: 13, cursor: (!slug || slug === slugSalvato) ? 'default' : 'pointer' }}
          >
            {slugStato === 'salvando' ? '…' : 'Salva'}
          </button>
        </div>
        {slugStato === 'ok' && <div style={{ fontSize: 11.5, color: C.suc, marginBottom: 8 }}>✓ Indirizzo salvato</div>}
        {slugStato === 'occupato' && <div style={{ fontSize: 11.5, color: C.dan, marginBottom: 8 }}>Questo indirizzo è già in uso, scegline un altro</div>}
        {slugStato === 'errore' && <div style={{ fontSize: 11.5, color: C.dan, marginBottom: 8 }}>Errore nel salvataggio, riprova</div>}

        {linkPrenotazione && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.txt, marginBottom: 8, marginTop: 6 }}>Link da condividere</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: '11px 12px', fontSize: 12, color: C.txm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: C.bg }}>
                {linkPrenotazione}
              </div>
              <button onClick={copiaLink} style={{ padding: '0 16px', borderRadius: 10, border: `1.5px solid ${C.brd}`, background: C.sur, color: C.pri, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {linkCopiato ? '✓ Copiato' : '📋 Copia'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: C.txl, marginTop: 8 }}>Condividilo su WhatsApp, sito web, biglietti da visita, o QR code stampato in studio.</div>
          </>
        )}
      </Crd>

      <div style={{ marginTop: 26, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Menu mobile</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Stile delle icone nel dock in basso, su telefono</div>
      </div>
      <Crd style={{ marginBottom: 14 }}>
        <Fld label="Stile icone">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {DOCK_ICON_STYLES.map((opt) => {
              const active = (si.dock_settings?.iconStyle || DEF_DOCK_SETTINGS.iconStyle) === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => S({ dock_settings: { ...DEF_DOCK_SETTINGS, ...(si.dock_settings || {}), iconStyle: opt.id } })}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 6px', borderRadius: 12, border: `1.5px solid ${active ? C.pri : C.brd}`, background: active ? C.priL : C.sur, cursor: 'pointer' }}
                >
                  <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DockIc n="cal" style={opt.id} s={28} c={C.pri} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, color: active ? C.pri : C.txm }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Fld>
        <div style={{ fontSize: 11, color: C.txl, marginTop: 2 }}>"Vivid" è lo stile consigliato — icone a duotono, più riconoscibili al tocco.</div>
      </Crd>
      <Btn ch="💾 Salva impostazioni" onClick={save} full sz="lg" />

      <div style={{ marginTop: 26, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>WhatsApp Business — Automazione</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Credenziali per i promemoria automatici e l'assistente AI su WhatsApp</div>
      </div>
      <Crd style={{ marginBottom: 14 }}>
        {!features?.whatsapp_automatico ? (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Non incluso nel tuo piano</div>
            <div style={{ fontSize: 12.5, color: C.txm, lineHeight: 1.5 }}>
              Promemoria automatici e assistente AI su WhatsApp sono un modulo a parte rispetto
              al WhatsApp manuale già incluso. Contatta l'assistenza per attivarlo sul tuo studio.
            </div>
          </div>
        ) : waLoading ? (
          <div style={{ fontSize: 13, color: C.txl, padding: '8px 0' }}>Caricamento…</div>
        ) : (
          <>
            {!waConfig && (
              <div style={{ background: C.priL, borderRadius: 9, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: C.pri }}>
                Non ancora configurato. Il Phone Number ID te lo dà chi gestisce l'attivazione (assistenza DentalManager) quando aggiunge il numero del tuo studio.
              </div>
            )}
            {waConfig && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: waForm.attivo ? '#E8F5E9' : C.bg, borderRadius: 9, padding: '9px 12px', marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: waForm.attivo ? '#2E7D32' : C.txl, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: waForm.attivo ? '#2E7D32' : C.txm }}>{waForm.attivo ? 'Configurato e attivo' : 'Configurato ma disattivato'}</span>
              </div>
            )}
            <Fld label="Phone Number ID">
              <Inp value={waForm.phone_number_id} onChange={(e) => WF({ phone_number_id: e.target.value })} placeholder="es. 109876543210987" />
            </Fld>
            <Fld label="WABA ID (opzionale)">
              <Inp value={waForm.waba_id} onChange={(e) => WF({ waba_id: e.target.value })} placeholder="ID del WhatsApp Business Account" />
            </Fld>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={waForm.attivo} onChange={(e) => WF({ attivo: e.target.checked })} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.txm }}>Attivo — se spento, l'assistente smette di rispondere su questo numero</span>
            </label>
            {waMsg && <div style={{ fontSize: 12, color: waMsg.startsWith('Errore') ? C.dan : C.suc, marginBottom: 10, fontWeight: 700 }}>{waMsg}</div>}
            <Btn ch={waSaving ? 'Salvataggio…' : '💾 Salva'} onClick={saveWaConfig} dis={waSaving} full />
            {waConfig && (
              <div style={{ fontSize: 11, color: C.txl, marginTop: 10, wordBreak: 'break-all' }}>
                URL webhook da incollare nel pannello Meta:<br />
                <code style={{ fontSize: 10.5 }}>https://idklxdqebfceplrualgh.supabase.co/functions/v1/whatsapp-webhook</code>
              </div>
            )}
          </>
        )}
      </Crd>

      {tipoModal && (
        <Modal title={tipoModal === 'new' ? 'Nuovo tipo appuntamento' : 'Modifica tipo'} onClose={() => setTipoModal(null)}>
          <Fld label="Nome"><Inp value={tipoForm.nome} onChange={(e) => setTipoForm((f) => ({ ...f, nome: e.target.value }))} placeholder="es. Igiene, Urgenza, Controllo…" /></Fld>
          <Fld label="Colore">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 10 }}>
              {COLORI_DISPONIBILI.map((c) => (
                <button key={c} onClick={() => setTipoForm((f) => ({ ...f, colore: c }))} style={{ width: '100%', aspectRatio: '1', borderRadius: 9, background: c, border: tipoForm.colore === c ? `3px solid ${C.txt}` : '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {tipoForm.colore === c && <Ic n="ok" s={14} c="#fff" />}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.txm }}>Colore personalizzato:</div>
              <div style={{ position: 'relative' }}>
                <input type="color" value={tipoForm.colore} onChange={e => setTipoForm(f => ({ ...f, colore: e.target.value }))} style={{ width: 40, height: 32, border: `1.5px solid ${C.brd}`, borderRadius: 8, cursor: 'pointer', padding: 2, background: 'none' }} />
              </div>
              <div style={{ background: tipoForm.colore, borderRadius: 7, padding: '4px 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{tipoForm.colore}</span>
              </div>
            </div>
          </Fld>
          <div style={{ background: C.bg, borderRadius: 9, padding: 10, marginTop: 6, marginBottom: 11, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: tipoForm.colore, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.txt }}>{tipoForm.nome || 'Anteprima tipo'}</span>
          </div>

          <Fld label="Durata (minuti)">
            <Inp
              type="number" min="5" step="5"
              value={tipoForm.durata || ''}
              onChange={(e) => setTipoForm((f) => ({ ...f, durata: e.target.value ? Number(e.target.value) : '' }))}
              placeholder={`Predefinita studio (${agSet.durataDefault} min)`}
            />
          </Fld>

          <div style={{ marginTop: 14, marginBottom: 4 }}>
            <button
              onClick={() => setTipoForm((f) => ({ ...f, online_abilitato: !f.online_abilitato }))}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 9, border: `1.5px solid ${tipoForm.online_abilitato ? C.pri : C.brd}`, background: tipoForm.online_abilitato ? C.priL : C.sur, cursor: 'pointer' }}
            >
              <div style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${tipoForm.online_abilitato ? C.pri : C.brd}`, background: tipoForm.online_abilitato ? C.pri : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {tipoForm.online_abilitato && <Ic n="ok" s={11} c="#fff" />}
              </div>
              <span style={{ fontSize: 12.5, color: tipoForm.online_abilitato ? C.pri : C.txt, fontWeight: 600 }}>Prenotabile online (modalità diretta)</span>
            </button>
          </div>

          {tipoForm.online_abilitato && (
            <div style={{ background: C.bg, borderRadius: 9, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.txm, marginBottom: 8, textTransform: 'uppercase' }}>Giorni disponibili</div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                {GIORNI_SETTIMANA.map((lbl, wd) => {
                  const attivo = (tipoForm.online_giorni || []).includes(wd);
                  return (
                    <button
                      key={wd}
                      onClick={() => setTipoForm((f) => ({ ...f, online_giorni: attivo ? f.online_giorni.filter(g => g !== wd) : [...f.online_giorni, wd] }))}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${attivo ? C.pri : C.brd}`, background: attivo ? C.pri : C.sur, color: attivo ? '#fff' : C.txm, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Fld label="Dalle">
                  <Inp type="time" value={tipoForm.online_ora_inizio} onChange={(e) => setTipoForm((f) => ({ ...f, online_ora_inizio: e.target.value }))} />
                </Fld>
                <Fld label="Alle">
                  <Inp type="time" value={tipoForm.online_ora_fine} onChange={(e) => setTipoForm((f) => ({ ...f, online_ora_fine: e.target.value }))} />
                </Fld>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 7 }}>
            {tipoModal !== 'new' && <Btn ch="Elimina" v="dan" sz="sm" onClick={() => delTipo(tipoModal)} />}
            <Btn ch="Annulla" v="sec" onClick={() => setTipoModal(null)} full />
            <Btn ch="Salva" onClick={saveTipo} full />
          </div>
        </Modal>
      )}
    <ProfiloUtente onNomeChange={onNomeChange} />
    <GestioneUtenti studioId={studioInfo?.studio_id || '00000000-0000-0000-0000-000000000001'} currentUserId={currentUserId} features={features} />
    </div>
  );
}






