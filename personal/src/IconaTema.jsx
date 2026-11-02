// Small original pixel drawings, rendered as SVG so they stay crisp at every density.
function Pixel({ tipo, size = 24 }) {
  let disegno;
  const cartella = <><path d="M2 5h8l2 3h10v13H2Z" fill="#000" /><path d="M3 6h6l2 3h10v11H3Z" fill="#e6a600" /><path d="M3 10h18l-2 10H2Z" fill="#ffff55" stroke="#000" strokeWidth="1" /><path d="M4 11h15M3 12v6" stroke="#fff" /></>;
  switch (tipo) {
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
