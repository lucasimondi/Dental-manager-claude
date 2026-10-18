// Personali — carta d'identità, codice fiscale, ... delle persone elencate in Impostazioni.
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiPersonali } from '../../lib/archivio.js';
import { categoriaDi, personaDi } from '../../lib/impostazioni.js';
import { colore, dataBreve, titoloDoc, Sezione, Chips, BottoneCondividi } from '../../ui.jsx';
import { Miniatura } from '../../Miniatura.jsx';
import { IconaPiu, IconaFreccia } from '../../Icone.jsx';

/* ---------- Personali (carta d'identità, codice fiscale, ... per persona) ---------- */
function CartaDocumento({ doc, onApri, etichetta, mostra }) {
  return (
    <button className="pp-carta pp-carta-con-anteprima" style={{ '--c': colore(doc.fascicolo === 'identita' ? 'identita' : doc.fascicolo) }} onClick={() => onApri(doc)}>
      <Miniatura doc={doc} colore={colore(doc.fascicolo === 'identita' ? 'identita' : doc.fascicolo)} grande />
      <span className="pp-carta-testo">
        <span className="pp-carta-tipo">{etichetta || doc.tipo_documento || doc.fascicolo}</span>
        <span className="pp-carta-titolo">{titoloDoc(doc)}</span>
        <span className="pp-carta-piede">{[doc._persona || doc.persona, dataBreve(doc.data_documento || doc.email_data)].filter(Boolean).join(' · ')}</span>
      </span>
      <BottoneCondividi doc={doc} piccolo mostra={mostra} />
    </button>
  );
}

export function VistaPersonali({ ctx }) {
  const { esegui, apri, versione, impostazioni } = ctx;
  const { persone, categorie } = impostazioni;
  const [docs, setDocs] = useState(null);
  const [scheda, setScheda] = useState('tutti');
  useEffect(() => { esegui(async () => setDocs(await documentiPersonali(archivioDb))); }, [esegui, versione]);
  const arricchiti = useMemo(() => (docs || []).map((d) => ({ ...d, _cat: categoriaDi(d, categorie), _persona: personaDi(d, persone) })), [docs, categorie, persone]);
  if (!docs) return null;
  const attiva = scheda === 'tutti' || categorie.some((c) => c.id === scheda) ? scheda : 'tutti';
  const nomeCat = (id) => categorie.find((c) => c.id === id)?.nome;
  const apriDoc = (d) => apri({ tipo: 'documento', id: d.id });
  const aggiungi = (persona, categoria) => apri({ tipo: 'carica', opzioni: { persona, categoria, fascicolo: 'identita', portafoglio: true } });

  const perPersona = (persona, elenco) => (
    <Sezione key={persona} titolo={persona}>
      <div className="pp-carte">
        {elenco.map((d) => <CartaDocumento key={d.id} doc={d} etichetta={nomeCat(d._cat)} onApri={apriDoc} mostra={ctx.mostra} />)}
        {persona && attiva !== 'tutti' && !elenco.length && (
          <button className="pp-carta pp-carta-nuova" onClick={() => aggiungi(persona, attiva)}><IconaPiu size={24} /><span>Aggiungi {nomeCat(attiva)}</span></button>
        )}
        {persona && attiva === 'tutti' && (
          <button className="pp-carta pp-carta-nuova pp-carta-bassa" onClick={() => aggiungi(persona, null)}><IconaPiu size={22} /><span>Aggiungi un documento</span></button>
        )}
      </div>
    </Sezione>
  );

  // POL-VITA-008: qui solo i documenti delle persone elencate in Impostazioni; gli altri restano in
  // Documenti, catalogati per categoria ed ente.
  const delleMie = arricchiti.filter((d) => d._persona && persone.includes(d._persona));
  const filtrati = attiva === 'tutti' ? delleMie : delleMie.filter((d) => d._cat === attiva);
  const altri = arricchiti.length - delleMie.length;
  return (
    <>
      <Chips voci={[['tutti', 'Tutti'], ...categorie.map((c) => [c.id, c.nome])]} attiva={attiva} onScegli={setScheda} />
      {persone.map((p) => perPersona(p, filtrati.filter((d) => d._persona === p)))}
      {altri > 0 && (
        <button className="pp-riga pp-riga-sola pp-altri-personali" onClick={() => apri({ tipo: 'elenco', titolo: 'Documenti d\'identità di altri', carica: async () => arricchiti.filter((d) => !(d._persona && persone.includes(d._persona))) })}>
          <span className="pp-riga-testo"><span className="pp-riga-titolo">{altri} documenti di altre persone</span><span className="pp-riga-meta">Restano in Documenti. Se uno è vostro, aprilo e scegli la persona.</span></span>
          <IconaFreccia size={16} />
        </button>
      )}
      <p className="pp-riga-meta pp-nota-fondo">Persone e tipi di documento si cambiano in Impostazioni (icona in alto a destra).</p>
    </>
  );
}
