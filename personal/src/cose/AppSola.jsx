// APP-AUTO-CASA-SALUTE: Auto, Casa, Salute (o la Rubrica) aperta come app a sé (icona sulla Home del telefono). Solo l'app, a
// tutto schermo, con un link per tornare a Personal; stessa sessione e stessi dati di Personal.
import { useCallback, useState } from 'react';
import { AppCose } from './AppCose.jsx';
import { AppRubrica } from '../rubrica/AppRubrica.jsx';
import { indirizzoPersonal } from '../lib/scan.js';
import { APP_COSE } from '../lib/appCose.js';
import './cose.css';

export function AppSola({ id }) {
  const [toast, setToast] = useState(null);
  const mostra = useCallback((t) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? null : x)), 2600); }, []);
  const esegui = useCallback(async (fn) => { try { return await fn(); } catch (e) { mostra(e.message || 'Errore'); return undefined; } }, [mostra]);
  return <div className="pp-app pp-ac-sola">
    <div className="pp-ac-sola-barra"><span>Poliedron · {APP_COSE[id]?.breve}</span><a href={indirizzoPersonal()}>Apri Personal</a></div>
    <main className="pp-ac-sola-corpo">{id === 'rubrica' ? <AppRubrica ctx={{ esegui, mostra, versione: 0 }} /> : <AppCose ambito={id} ctx={{ esegui, mostra, versione: 0 }} aParte />}</main>
    {toast && <div className="pp-ac-sola-toast" role="status">{toast}</div>}
  </div>;
}
