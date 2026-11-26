// PERSONAL-FINESTRE: icona di ogni finestra (barra del titolo e barra delle applicazioni), dal tipo di pagina.
// ICONE-START (PO 2026-11-26): le stesse icone a colori di Start e del dock (stile Esplora file).
import { IconaColore } from './IconeColore.jsx';

const PER_TIPO = {
  esplora: 'esplora', 'cartella-mia': 'esplora', firmati: 'esplora', cosa: 'documenti', documento: 'documenti', 'documento-intero': 'documenti', pratica: 'pratiche', elenco: 'documenti', ricerca: 'documenti', 'senza-cartella': 'documenti',
  pdf: 'pdf', pdfStrumento: 'pdf', scansione: 'scan', scan: 'scan', scanner: 'scan', tessera: 'scan', testo: 'scan', carica: 'documenti', 'modifica-immagine': 'foto',
  impostazioni: 'impostazioni', evento: 'agenda', impegno: 'agenda', spesa: 'conti', pagamento: 'conti', nota: 'note', password: 'password', salute: 'salute', foto: 'foto',
  auto: 'auto', casa: 'casa', saluteApp: 'salute', rubrica: 'rubrica', dati: 'dati',
};
export function IconaFinestra({ tipo, size = 18 }) {
  const k = PER_TIPO[tipo] || 'personale';
  if (k === 'pdf') return <span className="pf-icona-pdf" style={{ width: size, height: size }}>PDF</span>;
  return <IconaColore id={k} size={size} />;
}
