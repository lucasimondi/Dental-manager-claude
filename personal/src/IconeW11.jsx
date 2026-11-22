// PERSONAL-ESPLORA-WIN11: icone stile Windows 11 dal prototipo (Esplora file e barra in basso).
export function IconaCartellaW11({ size = 48 }) {
  return (
    <svg className="esp-svg-cartella" viewBox="0 0 96 80" width={size} height={size * 80 / 96} aria-hidden="true">
      <path d="M6 10a6 6 0 0 1 6-6h22l8 8h42a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6z" fill="#E0A21B" />
      <rect x="14" y="16" width="68" height="40" rx="3" fill="#fff" />
      <path d="M4 28a6 6 0 0 1 6-6h76a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="#FFC83D" />
    </svg>
  );
}
const COLORI_FILE = { pdf: '#C42B1C', immagine: '#0E700E', office: '#0F6CBD', email: '#5C5C5C', altro: '#8A8A8A' };
const SIGLE_FILE = { pdf: 'PDF', immagine: 'IMG', office: 'DOC', email: 'MAIL', altro: '' };
export function IconaFileW11({ tipo = 'altro', size = 48 }) {
  return (
    <svg className="esp-svg-file" viewBox="0 0 64 80" width={size * 0.8} height={size} aria-hidden="true">
      <path d="M8 2h34l20 20v52a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z" fill="#fff" stroke="#C8C8C8" strokeWidth="2" />
      <path d="M42 2v16a4 4 0 0 0 4 4h16" fill="#EDEDED" stroke="#C8C8C8" strokeWidth="2" />
      <rect x="4" y="50" width="58" height="16" fill={COLORI_FILE[tipo]} />
      {SIGLE_FILE[tipo] && <text x="33" y="62" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Segoe UI, system-ui, sans-serif">{SIGLE_FILE[tipo]}</text>}
    </svg>
  );
}
