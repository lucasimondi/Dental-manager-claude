// APP-AUTO-CASA-SALUTE (e RUBRICA): le icone delle app (quadrato colorato con il disegno bianco, come le icone sulla Home
// del telefono). `piatta` = solo il disegno, per lo spazio della foto vuota. Gli stessi disegni stanno nelle
// icone PNG dei manifest (public/auto-*.png, casa-*, salute-*: scripts/icone-app-cose.mjs).
export const DISEGNI = {
  auto: 'M5 16.5h14M6.5 16.5v2M17.5 16.5v2M4 16.5v-3.2l1.8-4.6A2 2 0 0 1 7.7 7.4h8.6a2 2 0 0 1 1.9 1.3l1.8 4.6v3.2M4.3 13.2h15.4M7.5 14.8h.01M16.5 14.8h.01',
  casa: 'M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
  salute: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10ZM8.5 12h2l1-2 1.5 4 1-2h1.5',
  rubrica: 'M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11zM4.5 7.5h3M4.5 12h3M4.5 16.5h3M12.5 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.5 16a3 3 0 0 1 6 0', // RUBRICA
};
export const SFONDI = { auto: ['#E2852F', '#B4561A'], casa: ['#4A8BEA', '#1F56B8'], salute: ['#E0507F', '#A3194B'], rubrica: ['#1FB3A4', '#0B6F66'] };

export function IconaApp({ ambito, size = 40, piatta = false }) {
  const [a, b] = SFONDI[ambito] || ['#667085', '#475467'];
  const disegno = <path d={DISEGNI[ambito] || DISEGNI.casa} fill="none" stroke={piatta ? 'currentColor' : '#fff'} strokeWidth={piatta ? 1.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" />;
  if (piatta) return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{disegno}</svg>;
  return <svg className="pp-ac-icona" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id={`ac-g-${ambito}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
    <rect width="24" height="24" rx="6" fill={`url(#ac-g-${ambito})`} />
    <g transform="translate(2.4 2.4) scale(.8)">{disegno}</g>
  </svg>;
}

// Icona a tratto per Start e barra (stessa forma delle altre icone di Personal).
export const iconaTratto = (ambito) => function IconaTratto({ size = 22 }) {
  return <span className="pp-icona-contenuto" aria-hidden="true"><svg className="pp-icona-tratto" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={DISEGNI[ambito]} /></svg></span>;
};
