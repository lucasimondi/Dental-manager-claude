import React, { useState } from 'react';
import { Btn, Crd, Fld, Inp, Modal, Ic } from './ui';
import { C, uid } from '../lib/utils';
import {
  FARMACI_PREFERITI_DEFAULT, MAX_FARMACI_PREFERITI,
  normalizzaFarmacoPreferito, normalizzaListaFarmaciPreferiti, resolveFarmaciPreferiti,
} from '../lib/farmaciPreferiti.js';

const VUOTO = { farmaco: '', dosaggio: '', posologia: '', durata: '', note: '' };

/* POL-UI-044 — gestione delle scorciatoie farmaci della Ricetta
   (Impostazioni → Documenti). Ogni modifica viene salvata subito su
   studio_info.farmaci_preferiti tramite `onSalva(lista)`, così vale per
   tutti gli utenti e i dispositivi dello studio. */
export default function FarmaciPreferitiSettings({ si, onSalva }) {
  const lista = resolveFarmaciPreferiti(si);
  const isDentistico = !si?.vertical || si.vertical === 'dentistico';
  const [form, setForm] = useState(null); // { id|null, ...campi }
  const [conferma, setConferma] = useState(null); // { tipo: 'elimina', voce } | { tipo: 'ripristina' }

  const salva = (nuova) => onSalva(normalizzaListaFarmaciPreferiti(nuova));
  const sposta = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const nuova = [...lista];
    [nuova[i], nuova[j]] = [nuova[j], nuova[i]];
    salva(nuova);
  };
  const confermaForm = () => {
    const voce = normalizzaFarmacoPreferito({ ...form, id: form.id || `fp_${uid()}` });
    if (!voce) return;
    salva(form.id ? lista.map((v) => (v.id === form.id ? voce : v)) : [...lista, voce]);
    setForm(null);
  };
  const pieno = lista.length >= MAX_FARMACI_PREFERITI;

  return (
    <>
      <div style={{ marginTop: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}><Ic n="pill" s={15} c={C.txt} />Scorciatoie farmaci</div>
        <div style={{ fontSize: 12, color: C.txl, marginTop: 2 }}>Compaiono come pulsanti nella Ricetta: un tocco aggiunge il farmaco già compilato con dosaggio, posologia e durata. Valgono per tutto lo studio. Verifica sempre dosaggi e posologie.</div>
      </div>
      <Crd style={{ marginBottom: 14 }}>
        {lista.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.txl, padding: '6px 2px 12px' }}>Nessuna scorciatoia. Aggiungi i farmaci che prescrivi più spesso.</div>
        )}
        {lista.map((v, i) => (
          <div key={v.id} data-farmaco-preferito={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 2px', borderBottom: i < lista.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: C.txt }}>{v.farmaco}</div>
              <div style={{ fontSize: 11.5, color: C.txl, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[v.dosaggio, v.posologia, v.durata].filter(Boolean).join(' · ') || '—'}</div>
            </div>
            <button type="button" aria-label={`Sposta su ${v.farmaco}`} disabled={i === 0} onClick={() => sposta(i, -1)} style={btnIc(i === 0)}>↑</button>
            <button type="button" aria-label={`Sposta giù ${v.farmaco}`} disabled={i === lista.length - 1} onClick={() => sposta(i, 1)} style={btnIc(i === lista.length - 1)}>↓</button>
            <button type="button" aria-label={`Modifica ${v.farmaco}`} onClick={() => setForm({ ...VUOTO, ...v })} style={btnIc(false)}><Ic n="edit" s={14} c={C.pri} /></button>
            <button type="button" aria-label={`Elimina ${v.farmaco}`} onClick={() => setConferma({ tipo: 'elimina', voce: v })} style={btnIc(false)}><Ic n="del" s={14} c={C.dan} /></button>
          </div>
        ))}
        <button
          type="button"
          disabled={pieno}
          onClick={() => setForm({ id: null, ...VUOTO })}
          style={{ width: '100%', marginTop: 10, padding: '10px', border: `2px dashed ${C.brd}`, borderRadius: 10, background: 'transparent', color: pieno ? C.txl : C.pri, fontWeight: 700, fontSize: 13, cursor: pieno ? 'not-allowed' : 'pointer' }}
        >
          {pieno ? `Massimo ${MAX_FARMACI_PREFERITI} scorciatoie` : '+ Aggiungi farmaco'}
        </button>
        {isDentistico && (
          <button type="button" onClick={() => setConferma({ tipo: 'ripristina' })} style={{ marginTop: 8, background: 'none', border: 'none', color: C.txl, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 4 }}>
            Ripristina lista iniziale
          </button>
        )}
      </Crd>

      {form && (
        <Modal title={form.id ? 'Modifica scorciatoia' : 'Nuova scorciatoia farmaco'} icon="pill" onClose={() => setForm(null)}>
          <Fld label="Nome farmaco / principio attivo">
            <Inp value={form.farmaco} onChange={(e) => setForm({ ...form, farmaco: e.target.value })} placeholder="es. Amoxicillina 1 g" autoFocus />
          </Fld>
          <Fld label="Dosaggio">
            <Inp value={form.dosaggio} onChange={(e) => setForm({ ...form, dosaggio: e.target.value })} placeholder="es. 875 mg + 125 mg" />
          </Fld>
          <Fld label="Posologia">
            <Inp value={form.posologia} onChange={(e) => setForm({ ...form, posologia: e.target.value })} placeholder="es. 1 compressa ogni 12 ore" />
          </Fld>
          <Fld label="Durata">
            <Inp value={form.durata} onChange={(e) => setForm({ ...form, durata: e.target.value })} placeholder="es. Per 6 giorni" />
          </Fld>
          <Fld label="Note">
            <Inp value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Indicazioni aggiuntive" />
          </Fld>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setForm(null)} full />
            <Btn ch="Salva scorciatoia" onClick={confermaForm} dis={!form.farmaco.trim()} full />
          </div>
        </Modal>
      )}

      {conferma && (
        <Modal title={conferma.tipo === 'elimina' ? 'Eliminare la scorciatoia?' : 'Ripristinare la lista iniziale?'} onClose={() => setConferma(null)}>
          <div style={{ fontSize: 13, color: C.txm, marginBottom: 14 }}>
            {conferma.tipo === 'elimina'
              ? `"${conferma.voce.farmaco}" non comparirà più tra le scorciatoie della Ricetta.`
              : 'Le scorciatoie attuali verranno sostituite dalla lista iniziale. Le modifiche fatte andranno perse.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn ch="Annulla" v="sec" onClick={() => setConferma(null)} full />
            <Btn
              ch={conferma.tipo === 'elimina' ? 'Elimina' : 'Ripristina'}
              v={conferma.tipo === 'elimina' ? 'dan' : undefined}
              onClick={() => {
                salva(conferma.tipo === 'elimina' ? lista.filter((v) => v.id !== conferma.voce.id) : FARMACI_PREFERITI_DEFAULT.map((v) => ({ ...v })));
                setConferma(null);
              }}
              full
            />
          </div>
        </Modal>
      )}
    </>
  );
}

const btnIc = (disabilitato) => ({
  width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8,
  border: `1px solid ${C.brd}`, background: C.sur, color: disabilitato ? C.txl : C.txm,
  opacity: disabilitato ? 0.4 : 1, cursor: disabilitato ? 'default' : 'pointer', fontSize: 15, fontWeight: 800, padding: 0,
});
