// SCAN-HUB — «Estrai testo»: parte pura (testabile senza browser) del riconoscimento locale.
// righe ordinate dai blocchi di Tesseract (un paragrafo = righe consecutive, poi riga vuota).
export function testoDaBlocchi(blocks, fiduciaMin = 30) {
  const paragrafi = [];
  for (const b of blocks || []) for (const par of b.paragraphs || []) {
    const righe = (par.lines || []).map((l) => (l.words || []).filter((w) => (w.confidence ?? 100) >= fiduciaMin).map((w) => (w.text || '').trim()).filter(Boolean).join(' ')).filter(Boolean);
    if (righe.length) paragrafi.push(righe.join('\n'));
  }
  return paragrafi.join('\n\n');
}

