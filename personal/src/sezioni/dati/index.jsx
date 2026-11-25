import { differito } from '../../Differito.jsx';
import { IconaPortafoglio } from '../../Icone.jsx';

// MIEI-DATI (PO 2026-11-25): i dati di Luca e delle sue società (fatturazione, contatti, banca, consulenti) pronti
// da copiare, una scheda per soggetto affiancate in orizzontale, tutto modificabile; si aggiungono società o altro.
const MieiDati = differito(() => import('./MieiDati.jsx'), 'MieiDati');
export const dati = {
  id: 'dati', nome: 'I miei dati', Icona: IconaPortafoglio, Vista: MieiDati,
  pagine: {
    dati: { titolo: 'I miei dati', render: (p, { ctx }) => <MieiDati ctx={ctx} /> },
  },
};
