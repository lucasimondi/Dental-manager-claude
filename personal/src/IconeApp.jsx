// SCAN-GOOGLE-OFFICE (PO 2026-11-24): icone delle app nelle cartelle «Google» e «Office» di Start.
// Disegni semplici con i colori delle app (non i loghi): foglio con le righe, griglia, lavagna, ecc.
const FOGLIO = 'M7 2.5h10.5L23 8v17.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 6 25.5V4a1.5 1.5 0 0 1 1-1.5Z';
const ANGOLO = 'M17.5 2.5V8H23';

function Foglio({ colore, children }) {
  return (<><path d={FOGLIO} fill={colore} /><path d={ANGOLO} fill="#fff" opacity=".45" />{children}</>);
}
function Lettera({ colore, lettera }) {
  return (<><rect x="3" y="4" width="22" height="22" rx="4" fill={colore} /><text x="14" y="20.5" textAnchor="middle" fontSize="14" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#fff">{lettera}</text></>);
}

const DISEGNI = {
  google: <><rect x="3" y="3" width="10" height="10" rx="2.5" fill="#4285F4" /><rect x="15" y="3" width="10" height="10" rx="2.5" fill="#EA4335" /><rect x="3" y="15" width="10" height="10" rx="2.5" fill="#34A853" /><rect x="15" y="15" width="10" height="10" rx="2.5" fill="#FBBC04" /></>,
  office: <><rect x="3" y="3" width="10" height="10" rx="2.5" fill="#185ABD" /><rect x="15" y="3" width="10" height="10" rx="2.5" fill="#107C41" /><rect x="3" y="15" width="10" height="10" rx="2.5" fill="#C43E1C" /><rect x="15" y="15" width="10" height="10" rx="2.5" fill="#7A7A7A" /></>,
  documenti: <Foglio colore="#4285F4"><path d="M10 13h9M10 16.5h9M10 20h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></Foglio>,
  fogli: <Foglio colore="#0F9D58"><path d="M10 12.5h9v8h-9ZM10 16.5h9M14.5 12.5v8" fill="none" stroke="#fff" strokeWidth="1.4" /></Foglio>,
  presentazioni: <Foglio colore="#F4B400"><rect x="10" y="13" width="9" height="6.5" rx="1" fill="none" stroke="#fff" strokeWidth="1.6" /></Foglio>,
  moduli: <Foglio colore="#7248B9"><circle cx="11" cy="13.5" r="1.1" fill="#fff" /><circle cx="11" cy="17" r="1.1" fill="#fff" /><circle cx="11" cy="20.5" r="1.1" fill="#fff" /><path d="M13.5 13.5H19M13.5 17H19M13.5 20.5H19" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></Foglio>,
  drive: <><path d="M10.2 4h7.6l7.2 12.5-3.8 6.5-7.2-12.5Z" fill="#FBBC04" /><path d="M10.2 4 3 16.5 6.8 23l7.2-12.5Z" fill="#0F9D58" /><path d="M6.8 23h14.4l3.8-6.5H10.6Z" fill="#4285F4" /></>,
  gmail: <><rect x="3" y="6" width="22" height="16" rx="2.5" fill="#fff" stroke="#C5221F" strokeWidth="1.2" /><path d="M4 7.5 14 15l10-7.5" fill="none" stroke="#EA4335" strokeWidth="2.4" strokeLinejoin="round" /></>,
  calendar: <><rect x="4" y="5" width="20" height="19" rx="3" fill="#fff" stroke="#4285F4" strokeWidth="1.6" /><path d="M4 10h20" stroke="#4285F4" strokeWidth="3" /><text x="14" y="21" textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#4285F4">31</text></>,
  word: <Lettera colore="#185ABD" lettera="W" />,
  excel: <Lettera colore="#107C41" lettera="X" />,
  powerpoint: <Lettera colore="#C43E1C" lettera="P" />,
};

export function IconaApp({ tipo, size = 28 }) {
  const d = DISEGNI[tipo];
  if (!d) return null;
  return <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true" focusable="false">{d}</svg>;
}
