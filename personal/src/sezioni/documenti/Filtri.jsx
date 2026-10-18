// Documenti — barra dei filtri: categoria, ente, anno, persona, anche poco utili.
import { useState } from 'react';
import { colore } from '../../ui.jsx';
import { IconaChiudi } from '../../Icone.jsx';
import { FoglioScelta } from './Selezione.jsx';

const ANNI = () => { const y = new Date().getFullYear(); return Array.from({ length: y - 2003 }, (_, i) => String(y - i)); };

export function BarraFiltri({ filtri, setFiltri, ctx, elencoEnti }) {
  const { fascicoli, impostazioni } = ctx;
  const [aperto, setAperto] = useState(null);
  const nomeFasc = fascicoli.find((f) => f.codice === filtri.fascicolo)?.nome;
  const imposta = (k, v) => { setFiltri({ ...filtri, [k]: v || null }); setAperto(null); };
  const chip = (k, etichetta, valore) => (
    <button key={k} className={`pp-filtro${valore ? ' attivo' : ''}`} onClick={() => (valore ? imposta(k, null) : setAperto(k))}>
      {valore || etichetta}{valore ? <IconaChiudi size={12} /> : <span className="pp-filtro-freccia">▾</span>}
    </button>
  );
  const voci = {
    fascicolo: fascicoli.filter((f) => f.n > 0).map((f) => ({ id: f.codice, nome: f.nome, meta: `${f.n}`, colore: colore(f.codice) })),
    ente: (elencoEnti || []).map((e) => ({ id: e.ente, nome: e.ente, meta: `${e.n} documenti` })),
    anno: ANNI().map((a) => ({ id: a, nome: a })),
    persona: impostazioni.persone.map((p) => ({ id: p, nome: p })),
  };
  return (
    <>
      <div className="pp-filtri">
        {chip('fascicolo', 'Categoria', nomeFasc)}
        {chip('ente', 'Ente', filtri.ente)}
        {chip('anno', 'Anno', filtri.anno)}
        {chip('persona', 'Persona', filtri.persona)}
        <button className={`pp-filtro${filtri.anchePocoUtili ? ' attivo' : ''}`} onClick={() => setFiltri({ ...filtri, anchePocoUtili: !filtri.anchePocoUtili })}>
          {filtri.anchePocoUtili ? 'Anche poco utili ✓' : 'Anche poco utili'}
        </button>
      </div>
      {aperto && <FoglioScelta titolo={{ fascicolo: 'Categoria', ente: 'Ente', anno: 'Anno', persona: 'Persona' }[aperto]} voci={voci[aperto]} cerca={aperto !== 'anno'} onScegli={(v) => imposta(aperto, v)} onChiudi={() => setAperto(null)} />}
    </>
  );
}

export const filtriVuoti = { fascicolo: null, ente: null, anno: null, persona: null, anchePocoUtili: false };
export const conFiltri = (f) => !!(f.fascicolo || f.ente || f.anno || f.persona);

