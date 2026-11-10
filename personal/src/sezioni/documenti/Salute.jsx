// MIA-SALUTE (PO 2026-11-10) — «La mia salute ed esami»: i tuoi referti, esami, ricette e visite
// (anche foto di referti), filtrabili per tipo e da inviare insieme selezionandoli (fino a 20).
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiSalute, io, tipoSalute, TIPI_SALUTE } from '../../lib/salute.js';
import { Chips, Vuoto } from '../../ui.jsx';
import { IconaPiu, IconaInvia, IconaScansiona } from '../../Icone.jsx';
import { ElencoSelezionabile } from './Selezione.jsx';

const MAX_SALUTE = 20;

export function PaginaSalute({ ctx }) {
  const { esegui, apri, versione, impostazioni } = ctx;
  const persona = io(impostazioni);
  const [docs, setDocs] = useState(null);
  const [tipo, setTipo] = useState('tutti');
  const [rinfresca, setRinfresca] = useState(0);
  const [invio, setInvio] = useState(0); // «Seleziona e invia»: riapre l'elenco già in selezione
  useEffect(() => {
    let vivo = true;
    esegui(async () => { const r = await documentiSalute(archivioDb, persona); if (vivo) setDocs(r); });
    return () => { vivo = false; };
  }, [esegui, versione, rinfresca, persona]);
  const conteggi = useMemo(() => {
    const n = { tutti: docs?.length || 0 };
    for (const d of docs || []) { const t = tipoSalute(d); n[t] = (n[t] || 0) + 1; }
    return n;
  }, [docs]);
  const elenco = useMemo(() => (docs || []).filter((d) => tipo === 'tutti' || tipoSalute(d) === tipo), [docs, tipo]);
  const opzioni = { persona, fascicolo: 'sanitario_famiglia', salute: true };
  const aggiungi = () => apri({ tipo: 'carica', opzioni });
  const scansiona = () => apri({ tipo: 'scansione', opzioni });
  if (!docs) return <Vuoto>Carico…</Vuoto>;
  return (
    <>
      <p className="pp-riga-meta">Referti, esami, ricette e visite di {persona || 'te'}. Scegli i documenti (o «Tutti») e mandali con Mail o WhatsApp, anche uniti in un solo PDF, fino a {MAX_SALUTE} alla volta. Apri una foto per ritagliarla o convertirla in PDF.</p>
      <div className="pp-modifica-strumenti">
        <button className="pp-bottone" onClick={() => setInvio((n) => n + 1)}><IconaInvia size={18} /> Seleziona e invia</button>
        <button className="pp-bottone pp-bottone-chiaro" onClick={scansiona}><IconaScansiona size={18} /> Scansiona documento</button>
      </div>
      <Chips voci={TIPI_SALUTE.filter(([id]) => id === 'tutti' || conteggi[id]).map(([id, nome]) => [id, `${nome} ${conteggi[id] || 0}`])} attiva={tipo} onScegli={setTipo} />
      {elenco.length
        ? <ElencoSelezionabile key={`invio-${invio}`} selezioneIniziale={invio > 0} invio titoloInvio="Referti ed esami" elenco={elenco} ctx={ctx} maxCondivisi={MAX_SALUTE} onCambiato={() => setRinfresca((n) => n + 1)} intestazione={`${elenco.length} documenti`} />
        : <Vuoto>Nessun documento qui. Dall'archivio puoi selezionarne e scegliere Altro → «Aggiungi a La mia salute».</Vuoto>}
      <button className="pp-invito" onClick={aggiungi}><IconaPiu size={20} /><span><strong>Aggiungi referto o esame</strong><br />Foto o file dal telefono: finisce qui</span></button>
    </>
  );
}
