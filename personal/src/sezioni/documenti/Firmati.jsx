// DOCUMENTI-FIRMATI (PO 2026-11-17): "Deve esserci una sottosezione in documenti che si chiama documenti
// firmati esattamente come in drive". È la cartella speciale «Documenti firmati» di Le mie cartelle
// (gemella di Archivio personale/Documenti firmati su Drive): stessa pagina, con tutte le sue azioni.
import { useEffect, useState } from 'react';
import { archivioDb } from '../../lib/supabasePersonal.js';
import { cartellaFirmati } from '../../lib/cartelleMie.js';
import { Vuoto } from '../../ui.jsx';
import { PaginaCartellaMia } from './CartelleMie.jsx';

export function PaginaFirmati({ ctx }) {
  const [cartella, setCartella] = useState(undefined);
  useEffect(() => {
    let vivo = true;
    cartellaFirmati(archivioDb).then((c) => { if (vivo) setCartella(c || null); }).catch(() => { if (vivo) setCartella(null); });
    return () => { vivo = false; };
  }, [ctx.versione]);
  if (cartella === undefined) return <Vuoto>Carico…</Vuoto>;
  if (!cartella) return <Vuoto>Qui arrivano i documenti che firmi e salvi dal Gestore PDF.</Vuoto>;
  return <PaginaCartellaMia key={cartella.id} id={cartella.id} ctx={ctx} />;
}
