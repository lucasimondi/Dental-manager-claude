import { useEffect, useRef } from 'react';
import { leggiCondivisione } from './ingresso.js';
// attivo = false: chi è dentro un'altra app (Scan nel desktop di Personal) lascia la condivisione a lei.
export function useIngressoPdf(apri, setErrore, attivo = true) {
  const started = useRef(false);
  useEffect(() => {
    if (!attivo) return;
    const url = new URL(window.location.href), id = url.searchParams.get('pdf-share');
    if (url.searchParams.has('pdf-share-error')) {
      setErrore('Condivisione non riuscita. Apri Documenti → Apri PDF e scegli il file dal telefono.');
      url.searchParams.delete('pdf-share-error'); history.replaceState(null, '', url);
    }
    if (!id || started.current) return;
    started.current = true;
    void leggiCondivisione(id).then(files => {
      apri({ tipo: 'pdf', files }); url.searchParams.delete('pdf-share'); history.replaceState(null, '', url);
    }).catch(e => setErrore(e.message));
  }, [apri, setErrore, attivo]);
}
