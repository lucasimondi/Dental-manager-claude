// Sezione Foto e video: album, anni, luoghi; si apre da Documenti e dal +.
import { IconaFoto } from '../../Icone.jsx';
import { VistaFoto, PaginaFoto } from './Foto.jsx';

export const foto = {
  id: 'foto', nome: 'Foto', Icona: IconaFoto, Vista: VistaFoto,
  pagine: {
    fotovideo: { titolo: 'Foto e video', render: (p, { ctx }) => <VistaFoto ctx={ctx} albumIniziale={p.album || null} /> },
    foto: { titolo: 'Foto', render: (p, { ctx }) => <PaginaFoto ids={p.ids} indice={p.indice} ctx={ctx} /> },
  },
};
