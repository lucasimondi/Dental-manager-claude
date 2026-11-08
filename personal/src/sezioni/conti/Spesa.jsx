// DOCK-PER-TE passo 3 (PO 2026-11-08): «Per una spesa acquisita, una sola schermata con allegato,
// importo, data e stato Pagata / Da pagare. Verifichi e salvi: la ricevuta rimane collegata alla
// voce nei Conti.» Nessuna nuova tabella: movimenti.documento_id e scadenze.documento_id esistono.
import { useEffect, useMemo, useRef, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { caricaDocumento } from '../../lib/archivio.js';
import { preparaFile as preparaCaricamento } from '../../lib/file.js';
import { salvaMovimento, nuovaScadenza, spesaDaRegistrare, CATEGORIE_SPESA } from '../../lib/conti.js';
import { Segmenti, oggiIso, tokenSessione } from '../../ui.jsx';
import { IconaFotocamera, IconaFile, IconaChiudi } from '../../Icone.jsx';

export function PaginaSpesa({ file: fileIniziale = null, ctx, chiudi }) {
  const { esegui, aggiorna, mostra, impostazioni } = ctx;
  const [file, setFile] = useState(fileIniziale);
  const [s, setS] = useState({ stato: 'pagata', importo: '', data: oggiIso(), descrizione: '', categoria: '' });
  const [invio, setInvio] = useState(false);
  const scatto = useRef(null), sfoglia = useRef(null);
  const anteprima = useMemo(() => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (anteprima) URL.revokeObjectURL(anteprima); }, [anteprima]);
  const categorie = impostazioni?.categorieSpesa || CATEGORIE_SPESA;
  const valido = Number(String(s.importo).replace(',', '.')) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(s.data);
  const scegli = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f); };
  const salva = () => esegui(async () => {
    setInvio(true);
    try {
      let documentoId = null;
      if (file) {
        const pronto = await preparaCaricamento(file);
        const r = await caricaDocumento({ token: await tokenSessione(), ...pronto, descrizione: s.descrizione || 'Ricevuta', fascicolo: null, nonAnalizzare: false });
        documentoId = r.id;
      }
      const { tipo, dati } = spesaDaRegistrare({ ...s, documentoId });
      if (tipo === 'movimento') await salvaMovimento(archivioDb, dati);
      else await nuovaScadenza(archivioDb, dati);
      aggiorna();
      mostra(tipo === 'movimento' ? (file ? 'Spesa registrata con la ricevuta' : 'Spesa registrata') : (file ? 'Da pagare, con il documento allegato' : 'Aggiunta a Da pagare'));
      chiudi();
    } finally { setInvio(false); }
  });
  return (
    <>
      <input ref={scatto} type="file" accept="image/*" capture="environment" hidden onChange={scegli} />
      <input ref={sfoglia} type="file" accept="image/*,application/pdf,.heic,.heif" hidden onChange={scegli} />
      <section className="pp-spesa-allegato" aria-label="Allegato">
        {file ? (
          <div className="pp-spesa-file">
            {anteprima ? <img src={anteprima} alt="Ricevuta" /> : <span className="pp-spesa-pdf"><IconaFile size={22} /> {file.name}</span>}
            <button type="button" className="pp-icona-bottone pp-piccolo" aria-label="Togli l'allegato" onClick={() => setFile(null)}><IconaChiudi size={16} /></button>
          </div>
        ) : (
          <div className="pp-due">
            <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => scatto.current.click()}><IconaFotocamera size={18} /> Scansiona scontrino</button>
            <button type="button" className="pp-bottone pp-bottone-chiaro" onClick={() => sfoglia.current.click()}><IconaFile size={18} /> Foto o file</button>
          </div>
        )}
      </section>
      <label className="pp-campo pp-campo-importo"><span>Importo (€)</span>
        <input inputMode="decimal" autoFocus value={s.importo} onChange={(e) => setS({ ...s, importo: e.target.value })} placeholder="0,00" />
      </label>
      <div className="pp-due">
        <label className="pp-campo"><span>{s.stato === 'da_pagare' ? 'Entro il' : 'Data'}</span><input type="date" value={s.data} onChange={(e) => setS({ ...s, data: e.target.value })} /></label>
        <label className="pp-campo"><span>Categoria</span>
          <select className="pp-select" value={s.categoria} onChange={(e) => setS({ ...s, categoria: e.target.value })}>
            <option value="">—</option>
            {categorie.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="pp-campo"><span>Descrizione</span><input value={s.descrizione} onChange={(e) => setS({ ...s, descrizione: e.target.value })} placeholder="Es. Farmacia, supermercato, bolletta" /></label>
      <Segmenti voci={[['pagata', 'Pagata'], ['da_pagare', 'Da pagare']]} attiva={s.stato} onScegli={(stato) => setS({ ...s, stato })} />
      <p className="pp-riga-meta">{s.stato === 'pagata' ? 'Diventa una spesa nei Conti' : 'Va in Da pagare e in agenda'}{file ? ', con la ricevuta collegata.' : '.'}</p>
      <button className="pp-bottone pp-bottone-largo" disabled={!valido || invio} onClick={salva}>{invio ? 'Salvo…' : 'Salva'}</button>
    </>
  );
}
