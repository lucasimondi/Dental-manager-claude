import { useRef, useState } from 'react';
import { archivioDb } from './lib/supabasePersonal.js';
import { cercaArchivio, cestinaSuDrive, eliminaDocumenti } from './lib/archivio.js';
import { eliminaConDrive } from './lib/eliminazioneSwipe.js';
import { tokenSessione } from './ui.jsx';
import { IconaCestino } from './Icone.jsx';

// Il gesto rivela l'azione; solo la conferma esplicita modifica archivio e Drive.
export function ScorriElimina({ children, doc, cartella, ctx, onCambiato, disabilitato = false }) {
  const [aperto, setAperto] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [attesa, setAttesa] = useState(false);
  const gesto = useRef(null);
  const bloccaClick = useRef(false);
  const nome = cartella?.ente || doc?.titolo || doc?.nome_file_originale || 'documento';
  const elimina = () => {
    if (attesa) return;
    setAttesa(true);
    ctx.esegui(async () => {
      try {
        const docs = cartella ? await cercaArchivio(archivioDb, { ente: cartella.ente, anchePocoUtili: true, limite: 10000 }) : [doc];
        // Non cancellare una cartella parzialmente caricata (limite del server o dati cambiati).
        if (cartella && docs.length !== Number(cartella.n)) throw new Error('La cartella è cambiata o non è completa. Aggiorna e riprova.');
        const token = await tokenSessione();
        await eliminaConDrive(docs, {
          cestina: (ids) => cestinaSuDrive({ token, ids }),
          elimina: (ids) => eliminaDocumenti(archivioDb, ids),
        });
        setConferma(false); setAperto(false);
        ctx.aggiorna(); onCambiato?.();
        ctx.mostra(cartella ? 'Cartella e documenti eliminati. File nel Cestino di Drive.' : 'Documento eliminato. File nel Cestino di Drive.');
      } finally { setAttesa(false); }
    });
  };
  if (disabilitato) return children;
  return <div className="pp-scorri-elimina">
    <button className="pp-scorri-azione" aria-label={`Elimina ${nome}`} onClick={() => setConferma(true)}><IconaCestino size={20} />Elimina</button>
    <div className={`pp-scorri-corpo${aperto ? ' aperto' : ''}`}
      onTouchStart={(e) => { bloccaClick.current = false; const t = e.touches[0]; gesto.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }}
      onTouchMove={(e) => { const g = gesto.current; if (!g) return; const t = e.touches[0]; const dx = t.clientX - g.x; const dy = t.clientY - g.y; if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesto.current = null; return; } if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) { bloccaClick.current = true; setAperto(dx < 0); } }}
      onTouchCancel={() => { gesto.current = null; }}
      onTouchEnd={() => { gesto.current = null; }}
      onClickCapture={(e) => { if (bloccaClick.current || aperto) { e.preventDefault(); e.stopPropagation(); bloccaClick.current = false; setAperto(false); } }}>
      {children}
    </div>
    {conferma && <div className="pp-velo" onClick={() => !attesa && setConferma(false)}><div className="pp-foglio pp-pannello" role="alertdialog" aria-label={`Elimina ${nome}`} aria-modal="true" onClick={(e) => e.stopPropagation()}>
      <strong>Eliminare {cartella ? `la cartella “${nome}” e tutti i suoi ${cartella.n} documenti` : `“${nome}”`}?</strong>
      <p>I file verranno spostati anche nel Cestino di Google Drive, recuperabili per 30 giorni. La rimozione dall’archivio non si annulla da qui.</p>
      <button className="pp-bottone pp-bottone-rosso" disabled={attesa} onClick={elimina}>{attesa ? 'Elimino…' : 'Elimina anche da Drive'}</button>
      <button className="pp-bottone pp-bottone-chiaro" disabled={attesa} onClick={() => setConferma(false)}>Annulla</button>
    </div></div>}
  </div>;
}
