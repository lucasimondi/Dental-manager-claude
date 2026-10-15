// POL-VITA-003 — icone a tratto, 24×24, colore dal testo.
const Svg = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const IconaOggi = (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5h5v5" /></Svg>;
export const IconaDocumenti = (p) => <Svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Svg>;
export const IconaPortafoglio = (p) => <Svg {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M16 14.5h2" /><path d="M6 6V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></Svg>;
export const IconaPratiche = (p) => <Svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2" /><path d="M3 12.5h18" /></Svg>;
export const IconaPiu = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconaCerca = (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const IconaChiudi = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const IconaIndietro = (p) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconaFreccia = (p) => <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>;
export const IconaApri = (p) => <Svg {...p}><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Svg>;
export const IconaEmail = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></Svg>;
export const IconaCalendario = (p) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>;
export const IconaFotocamera = (p) => <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></Svg>;
export const IconaFile = (p) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></Svg>;
export const IconaStella = ({ piena, ...p }) => <Svg {...p}><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" fill={piena ? 'currentColor' : 'none'} /></Svg>;
export const IconaCestino = (p) => <Svg {...p}><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></Svg>;
export const IconaEsci = (p) => <Svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></Svg>;
