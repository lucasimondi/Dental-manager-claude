// PERSONAL-FINESTRE: icona di ogni finestra (barra del titolo e barra delle applicazioni), dal tipo di pagina.
import { IconaCartellaW11 } from './IconeW11.jsx';
import { IconaApp } from './cose/IconeCose.jsx'; // APP-AUTO-CASA-SALUTE
import { IconaScansiona, IconaFile, IconaImpostazioni, IconaCalendario, IconaEuro, IconaNote, IconaLucchetto, IconaFoto, IconaDocumenti, IconaCuore, IconaPerTe } from './Icone.jsx';

const PER_TIPO = {
  esplora: 'esplora', 'cartella-mia': 'esplora', firmati: 'esplora', cosa: 'doc', documento: 'doc', 'documento-intero': 'doc', pratica: 'doc', elenco: 'doc', ricerca: 'doc', 'senza-cartella': 'doc',
  pdf: 'pdf', pdfStrumento: 'pdf', scansione: 'scan', scan: 'scan', scanner: 'scan', carica: 'doc', 'modifica-immagine': 'foto',
  impostazioni: 'imp', evento: 'cal', impegno: 'cal', spesa: 'conti', pagamento: 'conti', nota: 'note', password: 'pass', salute: 'salute', foto: 'foto',
};
const APP_COSE = { auto: 'auto', casa: 'casa', saluteApp: 'salute' };
export function IconaFinestra({ tipo, size = 18 }) {
  if (APP_COSE[tipo]) return <IconaApp ambito={APP_COSE[tipo]} size={size} />;
  const k = PER_TIPO[tipo] || 'altro';
  if (k === 'esplora') return <IconaCartellaW11 size={size} />;
  if (k === 'pdf') return <span className="pf-icona-pdf" style={{ width: size, height: size }}>PDF</span>;
  const I = { scan: IconaScansiona, doc: IconaDocumenti, imp: IconaImpostazioni, cal: IconaCalendario, conti: IconaEuro, note: IconaNote, pass: IconaLucchetto, salute: IconaCuore, foto: IconaFoto, altro: IconaPerTe }[k] || IconaFile;
  return <I size={size} />;
}
