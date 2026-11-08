// STUDIO-BENTO: raggruppa le voci per taglia (due colonne, tre colonne, fila di pulsanti).
const COLONNE = { grande: 'due', alta: 'due', media: 'due', piccola: 'tre', pulsante: 'fila' };
export function blocchiBento(voci) {
  const blocchi = [];
  for (const v of voci) {
    const tipo = COLONNE[v.taglia] || 'tre';
    const ultimo = blocchi[blocchi.length - 1];
    if (ultimo && ultimo.tipo === tipo) ultimo.voci.push(v); else blocchi.push({ tipo, voci: [v] });
  }
  return blocchi;
}
