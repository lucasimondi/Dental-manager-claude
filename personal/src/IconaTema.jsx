// Small original pixel drawings, rendered as SVG so they stay crisp at every density.
export function Pixel({ tipo, size = 24 }) {
  let disegno;
  const cartella = <><path d="M2 5h8l2 3h10v13H2Z" fill="#000" /><path d="M3 6h6l2 3h10v11H3Z" fill="#e6a600" /><path d="M3 10h18l-2 10H2Z" fill="#ffff55" stroke="#000" strokeWidth="1" /><path d="M4 11h15M3 12v6" stroke="#fff" /></>;
  switch (tipo) {
    case 'piu': case 'chiudi': case 'indietro': case 'freccia': case 'invia': case 'apri':
      disegno = <path d={tipo === 'piu' ? 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7Z' : tipo === 'chiudi' ? 'M4 3 12 11 20 3 22 5 14 13 22 21 20 23 12 15 4 23 2 21 10 13 2 5Z' : tipo === 'indietro' ? 'M11 4 3 12l8 8v-5h10V9H11Z' : tipo === 'apri' ? 'M3 5h9v3H6v12h12v-6h3v9H3ZM13 2h10v10h-3V7l-9 9-3-3 9-8h-4Z' : 'M13 4 21 12l-8 8v-5H3V9h10Z'} fill="currentColor" />; break;
    case 'cerca': disegno = <><path d="M3 2h10v2h3v10h-3v3H3v-3H1V4h2Z" fill="#000"/><path d="M4 4h8v2h2v6h-2v3H4v-3H3V6h1Z" fill="#fff"/><path d="m14 14 8 7-3 3-8-8Z" fill="#808080" stroke="#000"/><path d="M5 5h5v2H5Z" fill="#00ffff"/></>; break;
    case 'file': disegno = <><path d="M5 2h11l5 5v15H5Z" fill="#fff" stroke="#000"/><path d="M16 2v6h5M8 11h9M8 14h9M8 17h7" fill="none" stroke="#000080"/></>; break;
    case 'email': disegno = <><path d="M2 5h20v15H2Z" fill="#ffffaa" stroke="#000"/><path d="m2 5 10 9L22 5M2 20l7-8M22 20l-7-8" fill="none" stroke="#808000"/></>; break;
    case 'fotocamera': case 'scansiona': disegno = <><path d="M2 7h5l2-3h7l2 3h4v14H2Z" fill="#808080" stroke="#000"/><path d="M3 8h18v3H3Z" fill="#c0c0c0"/><path d="M9 10h7v8H9Z" fill="#000"/><path d="M10 11h5v5h-5Z" fill="#008080"/><path d="M4 9h3v2H4Z" fill="#fff"/></>; break;
    case 'impostazioni': case 'ruota': disegno = <><path d="M9 2h6v4h4v3h3v6h-4v4h-3v3H9v-4H5v-3H2V9h4V5h3Z" fill="#808080" stroke="#000"/><path d="M9 8h7v8H8V9h1Z" fill="#c0c0c0" stroke="#fff"/><path d="M11 11h3v3h-3Z" fill="#000"/></>; break;
    case 'cestino': disegno = <><path d="M6 6h13l-2 16H8Z" fill="#c0c0c0" stroke="#000"/><path d="M4 4h17v3H4ZM9 2h8v2H9Z" fill="#808080" stroke="#000"/><path d="M10 9v10M14 9v10" stroke="#fff"/></>; break;
    case 'stella': disegno = <path d="m12 2 3 7h7l-6 5 2 8-6-4-6 4 2-8-6-5h7Z" fill="#ffff00" stroke="#000"/>; break;
    case 'grafico': disegno = <><path d="M3 2v20h20" stroke="#000" fill="none"/><path d="M6 14h4v6H6Z" fill="#008000"/><path d="M12 9h4v11h-4Z" fill="#000080"/><path d="M18 4h4v16h-4Z" fill="#800000"/></>; break;
    case 'graffetta': disegno = <path d="M17 3h-5L4 12v6l4 4h5l9-10V5l-4-4-3 1M18 6l-10 11v2h3l8-9V7h-3l-7 8" fill="none" stroke="#000" strokeWidth="2"/>; break;
    case 'esci': disegno = <><path d="M3 2h12v20H3Z" fill="#808000" stroke="#000"/><path d="M4 3h9v17l-9 2Z" fill="#ffffaa" stroke="#000"/><path d="M12 11h9v-4l3 5-3 5v-4h-9Z" fill="#008000"/><path d="M9 11h2v2H9Z" fill="#000"/></>; break;
    case 'nuvola': disegno = <><path d="M3 11V8h3V5h4V3h6v3h4v4h3v8H2v-6Z" fill="#fff" stroke="#000"/><path d="M11 21v-8H7l5-5 5 5h-4v8Z" fill="#008000" stroke="#000"/></>; break;
    case 'condividi': disegno = <><path d="M3 12h18v10H3Z" fill="#c0c0c0" stroke="#000"/><path d="M10 15V8H5l7-7 7 7h-5v7Z" fill="#008000" stroke="#000"/><path d="M5 18h14" stroke="#fff"/></>; break;
    case 'documenti': case 'foto': case 'legal': case 'personali': disegno = <>{cartella}{tipo === 'personali' && <><path d="M7 12h10v6H7Z" fill="#fff" /><path d="M8 13h3v3H8Z" fill="#000080" /><path d="M13 13h3M13 15h3" stroke="#000080" /></>}{tipo === 'foto' && <><path d="M7 12h10v6H7Z" fill="#0ff" /><path d="m7 18 4-5 3 3 2-1 1 3" fill="#008000" /></>}</>; break;
    case 'agenda': disegno = <><path d="M3 4h18v18H3Z" fill="#000" /><path d="M4 5h16v16H4Z" fill="#fff" /><path d="M4 5h16v5H4Z" fill="#000080" /><path d="M7 2h2v6H7zM15 2h2v6h-2z" fill="#808080" stroke="#000" /><path d="M6 12h3v3H6zM11 12h3v3h-3zM16 12h2v3h-2zM6 17h3v2H6zM11 17h3v2h-3z" fill="#808080" /><path d="M16 17h2v2h-2z" fill="#f00" /></>; break;
    case 'poliedron': disegno = <><path d="M3 4h17v13h-7l-5 4v-4H3Z" fill="#fff" stroke="#000" /><path d="M7 9h2v2H7zM11 9h2v2h-2zM15 9h2v2h-2z" fill="#000" /></>; break;
    case 'diario': case 'didattica': disegno = <><path d="M3 3h15v19H3Z" fill="#000080" stroke="#000" /><path d="M6 4h11v16H6Z" fill="#fff" /><path d="M8 7h7M8 10h7M8 13h6" stroke="#000080" /><path d="m13 19 7-13 2 1-7 13-3 2Z" fill="#ffff00" stroke="#000" /></>; break;
    case 'conti': disegno = <><path d="M3 11h12v10H3Z" fill="#aa7700" stroke="#000" /><path d="M3 11h12v3H3Z" fill="#ffff55" stroke="#000" /><path d="M10 5h11v16H10Z" fill="#d49d00" stroke="#000" /><path d="M10 5h11v3H10Z" fill="#ffff55" stroke="#000" /><path d="M11 11h9M11 15h9M11 18h9" stroke="#6f5000" /></>; break;
    case 'altro': disegno = <><path d="M3 4h18v17H3Z" fill="#fff" stroke="#000" /><path d="M3 4h18v4H3Z" fill="#000080" /><path d="M6 11h3v3H6zM11 11h3v3h-3zM16 11h2v3h-2zM6 16h3v2H6zM11 16h3v2h-3zM16 16h2v2h-2z" fill="#008080" /></>; break;
    default: disegno = <><path d="M4 2h16v13H4Z" fill="#c0c0c0" stroke="#000" /><path d="M6 4h12v9H6Z" fill="#008080" stroke="#808080" /><path d="M10 15h4v3h-4zM2 18h20v4H2Z" fill="#c0c0c0" stroke="#000" /><path d="M4 19h3v1H4Z" fill="#00ff00" /><path d="M7 5h2v6H7Z" fill="#fff" opacity=".5" /></>;
  }
  return <svg className="pp-icon-pixel" width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">{disegno}</svg>;
}
export function IconaTema({ tipo, Icona, size = 22 }) {
  return <span className="pp-icona-tema" aria-hidden="true"><span className="pp-icon-modern"><Icona size={size} /></span><Pixel tipo={tipo} size={size} /></span>;
}
