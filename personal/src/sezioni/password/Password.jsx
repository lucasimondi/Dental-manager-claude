import { useEffect, useState } from 'react';
import PasswordPage from '../../../../shared/password/PasswordPage.jsx';
import { studioDb, sessioneStudio } from '../../lib/studio.js';

// PASSWORD-PERSONALI — lo stesso registro di Studio: sta nel database dello studio, come le note,
// e si legge con la sessione dello studio già usata dall'agenda. Senza sessione, niente registro.
export function VistaPassword({ ctx }) {
  // «nuova» (dal + dell'agenda) apre il modulo; altrimenti il testo arriva dalla ricerca.
  const nuova = ctx?.sotto === 'nuova';
  const cerca = typeof ctx?.sotto === 'string' && !nuova ? ctx.sotto : '';
  const [studioId, setStudioId] = useState(undefined);
  useEffect(() => {
    let vivo = true;
    sessioneStudio().then((s) => { if (vivo) setStudioId(s?.user?.app_metadata?.studio_id || null); }).catch(() => { if (vivo) setStudioId(null); });
    return () => { vivo = false; };
  }, []);
  if (studioId === undefined) return <p className="pp-riga-meta">Caricamento…</p>;
  if (!studioId) return <div className="pw-page"><h1 className="pw-title">Password</h1><p className="pw-empty">Per usare il registro collega l'account dello studio dall'agenda.</p></div>;
  return <PasswordPage db={studioDb} studioId={studioId} cercaIniziale={cerca} nuovaSubito={nuova} />;
}
