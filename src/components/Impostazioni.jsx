import ProfiloUtente from './ProfiloUtente.jsx';
import GestioneUtenti from './GestioneUtenti.jsx';
import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Txt, Modal, Toast, Ic, DockIc, DOCK_ICON_STYLES } from './ui';
import { C, uid, DEF_STUDIO, COLORI_DISPONIBILI, VERTICALI_DISPONIBILI, DEF_DOCK_SETTINGS } from '../lib/utils';

export default function Impostazioni({ studioInfo, setStudioInfo, appTypes, setAppTypes, currentUserId, onNomeChange, features, theme, toggleTheme }) {
  const [si, setSi] = useState({ ...DEF_STUDIO, ...(studioInfo || {}) });
  const [toast, setToast] = useState('');
  const [tipoModal, setTipoModal] = useState(null);
  const [tipoForm, setTipoForm] = useState({ nome: '', colore: COLORI_DISPONIBILI[0] });
  const S = (f) => setSi((s) => ({ ...s, ...f }));
  const save = () => { setStudioInfo(si); setToast('Salvato ✓'); };

  const openNewTipo = () => { setTipoForm({ nome: '', colore: COLORI_DISPONIBILI[Math.floor(Math.random() * COLORI_DISPONIBILI.length)] }); setTipoModal('new'); };
  const openEditTipo = (t) => { setTipoForm({ ...t }); setTipoModal(t.id); };
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






