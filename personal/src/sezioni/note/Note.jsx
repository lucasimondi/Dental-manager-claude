import { useEffect, useState } from 'react';
import NotePage from '../../../../shared/note/NotePage.jsx';
import { studioDb, sessioneStudio } from '../../lib/studio.js';

// NOTE-PERSONALI — le stesse note di Studio: stanno nel database dello studio, come gli impegni,
// e si leggono con la sessione dello studio già usata dall'agenda. Senza sessione, niente note.
export function VistaNote() {
  const [studioId, setStudioId] = useState(undefined);
  useEffect(() => {
    let vivo = true;
    sessioneStudio().then((s) => { if (vivo) setStudioId(s?.user?.app_metadata?.studio_id || null); }).catch(() => { if (vivo) setStudioId(null); });
    return () => { vivo = false; };
  }, []);
  if (studioId === undefined) return <p className="pp-riga-meta">Caricamento…</p>;
  if (!studioId) return <div className="note-page pp-note"><h1 className="note-title">Note</h1><p className="note-empty">Per usare le note collega l'account dello studio dall'agenda (Agenda → Studio).</p></div>;
  return <div className="pp-note"><NotePage db={studioDb} studioId={studioId} /></div>;
}
