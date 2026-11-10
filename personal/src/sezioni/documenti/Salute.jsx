// MIA-SALUTE (PO 2026-11-10) — «La mia salute ed esami»: i tuoi referti, esami, ricette e visite
// (anche foto di referti), filtrabili per tipo e da inviare insieme selezionandoli (fino a 20).
import { useEffect, useMemo, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { documentiSalute, io, tipoSalute, TIPI_SALUTE } from '../../lib/salute.js';
import { Chips, Vuoto } from '../../ui.jsx';
import { IconaPiu } from '../../Icone.jsx';
import { ElencoSelezionabile } from './Selezione.jsx';

const MAX_SALUTE = 20;

export function PaginaSalute({ ctx }) {
  const { esegui, apri, versione, impostazioni } = ctx;
  const persona = io(impostazioni);
  const [docs, setDocs] = useState(null);
  const [tipo, setTipo] = useState('tutti');
  const [rinfresca, setRinfresca] = useState(0);
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
  const aggiungi = () => apri({ tipo: 'carica', opzioni: { persona, fascicolo: 'sanitario_famiglia', salute: true } });
  if (!docs) return <Vuoto>Carico…</Vuoto>;
  return (
    <>
      <p className="pp-riga-meta">Referti, esami, ricette e visite di {persona || 'te'}. Tocca «Seleziona», poi «Tutti» o i documenti che ti servono e «Condividi» per mandarli insieme (Mail, WhatsApp…), fino a {MAX_SALUTE} alla volta.</p>
      <Chips voci={TIPI_SALUTE.filter(([id]) => id === 'tutti' || conteggi[id]).map(([id, nome]) => [id, `${nome} ${conteggi[id] || 0}`])} attiva={tipo} onScegli={setTipo} />
      {elenco.length
        ? <ElencoSelezionabile elenco={elenco} ctx={ctx} maxCondivisi={MAX_SALUTE} onCambiato={() => setRinfresca((n) => n + 1)} intestazione={`${elenco.length} documenti`} />
        : <Vuoto>Nessun documento qui. Dall'archivio puoi selezionarne e scegliere Altro → «Aggiungi a La mia salute».</Vuoto>}
      <button className="pp-invito" onClick={aggiungi}><IconaPiu size={20} /><span><strong>Aggiungi referto o esame</strong><br />Scatta una foto o carica un file: finisce qui</span></button>
    </>
  );
}
