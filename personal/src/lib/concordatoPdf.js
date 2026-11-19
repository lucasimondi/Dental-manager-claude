// CONCORDATO: i PDF della sezione. «Elenco dei beni» (A4 orizzontale, per l'avvocato e il gestore della crisi)
// e «Proposta di divisione» (A4 verticale). Ricevono il costruttore di jsPDF, così girano anche fuori dal
// browser (test e copia prodotta in sessione).
import { calcolaDivisione, datiCatastali, DESTINI, euroIntero, fraseConguaglio, quota, tipoBene } from './concordato.js';

const BLU = [12, 68, 124], GRIGIO = [102, 112, 133], INCHIOSTRO = [16, 24, 40], ZEBRA = [246, 248, 251], AZZURRO = [232, 240, 248], AMBRA = [181, 71, 8];
const dataIt = (d = new Date()) => d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const num = (n, dec = 2) => (n == null ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
// I caratteri standard del PDF non hanno la «–» lunga in tutti i lettori: la normalizziamo.
const t = (s) => String(s ?? '').replace(/−/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ');

function pagina(doc) {
  return { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight(), m: 12 };
}
function testata(doc, titolo) {
  const { w, m } = pagina(doc);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GRIGIO);
  doc.text(t(titolo), m, 8);
  doc.setDrawColor(...BLU); doc.setLineWidth(0.4); doc.line(m, 10, w - m, 10);
  return 15;
}
function piedi(doc, nota) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const { w, h, m } = pagina(doc);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIGIO);
    doc.text(t(nota), m, h - 6, { maxWidth: w - 2 * m - 30 });
    doc.text(`Pagina ${i} di ${n}`, w - m, h - 6, { align: 'right' });
  }
}

// Tabella con intestazione ripetuta a ogni pagina, righe di gruppo e testo a capo dentro le celle.
function tabella(doc, y, { colonne, righe, titoloPagina, corpo = 8, pad = 1.6 }) {
  const { h, m } = pagina(doc); const fondo = h - 12; const lh = corpo * 0.42;
  const intestazione = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(corpo);
    const linee = colonne.map((c) => doc.splitTextToSize(t(c.titolo), c.w - 2 * pad));
    const alto = Math.max(...linee.map((l) => l.length)) * lh + 2 * pad;
    doc.setFillColor(...BLU); doc.rect(m, y, colonne.reduce((s, c) => s + c.w, 0), alto, 'F');
    doc.setTextColor(255, 255, 255);
    let x = m;
    colonne.forEach((c, i) => { doc.text(linee[i], c.destra ? x + c.w - pad : x + pad, y + pad + lh * 0.8, { align: c.destra ? 'right' : 'left' }); x += c.w; });
    y += alto;
  };
  const larghezza = colonne.reduce((s, c) => s + c.w, 0);
  intestazione();
  let zebra = false;
  for (const riga of righe) {
    if (riga.gruppo) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(corpo + 0.5);
      const alto = lh + 2 * pad + 1;
      if (y + alto + lh * 2 + 2 * pad > fondo) { doc.addPage(); y = testata(doc, titoloPagina); intestazione(); }
      doc.setFillColor(...AZZURRO); doc.rect(m, y, larghezza, alto, 'F');
      doc.setTextColor(...BLU); doc.text(t(riga.gruppo), m + pad, y + pad + lh * 0.85 + 0.5);
      if (riga.destra) doc.text(t(riga.destra), m + larghezza - pad, y + pad + lh * 0.85 + 0.5, { align: 'right' });
      y += alto; zebra = false; continue;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(corpo);
    const linee = colonne.map((c, i) => {
      const v = riga.celle[i];
      if (c.grassetto) doc.setFont('helvetica', 'bold');
      const l = doc.splitTextToSize(t(v ?? ''), c.w - 2 * pad);
      doc.setFont('helvetica', 'normal');
      return l;
    });
    const alto = Math.max(1, ...linee.map((l) => l.length)) * lh + 2 * pad;
    if (y + alto > fondo) { doc.addPage(); y = testata(doc, titoloPagina); intestazione(); }
    if (zebra) { doc.setFillColor(...ZEBRA); doc.rect(m, y, larghezza, alto, 'F'); }
    zebra = !zebra;
    let x = m;
    colonne.forEach((c, i) => {
      doc.setFont('helvetica', c.grassetto ? 'bold' : 'normal');
      doc.setTextColor(...(c.colore?.(riga) || INCHIOSTRO));
      doc.text(linee[i], c.destra ? x + c.w - pad : x + pad, y + pad + lh * 0.8, { align: c.destra ? 'right' : 'left' });
      x += c.w;
    });
    doc.setDrawColor(228, 231, 236); doc.setLineWidth(0.1); doc.line(m, y + alto, m + larghezza, y + alto);
    y += alto;
  }
  return y + 4;
}

const quotaTesto = (b) => `${b.titolo || 'Proprietà'} per ${b.quota_luca}`;
const comproprietari = (b) => b.altri_comproprietari || (b.quota_anna ? `Anna Simondi ${b.quota_anna}` : 'Da verificare');
const vincoliNote = (b) => [b.vincoli, b.note].filter(Boolean).join(' — ');
const valoreTesto = (b) => (b.valore == null ? 'da stimare' : `${euroIntero(b.valore)}\ntua parte ${euroIntero(Number(b.valore) * (quota(b.quota_luca) || 0))}`);
function perGruppo(beni) {
  const g = new Map();
  for (const b of beni) { const k = b.gruppo || b.comune; if (!g.has(k)) g.set(k, []); g.get(k).push(b); }
  return [...g.entries()];
}

export function pdfBeni(JsPdf, beni, { intestatario = 'Luca Simondi', data = new Date() } = {}) {
  const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Beni immobili di ${intestatario}`, subject: 'Elenco dei beni con quote e vincoli', creator: 'Poliedron' });
  const { w, m } = pagina(doc); const titoloPagina = `Beni immobili di ${intestatario} – elenco al ${dataIt(data)}`;
  const fab = beni.filter((b) => b.catasto === 'F'), ter = beni.filter((b) => b.catasto === 'T');
  const anna = beni.filter((b) => b.in_divisione), vincolati = beni.filter((b) => b.vincoli);
  const fonti = [...new Set(beni.map((b) => b.fonte).filter(Boolean))];

  // Copertina compatta: titolo, fonte e riepilogo.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...BLU);
  doc.text(t(`Beni immobili di ${intestatario}`), m, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INCHIOSTRO);
  doc.text('Elenco con quote di proprietà, comproprietari e vincoli – documento di lavoro per il concordato minore', m, 27);
  doc.setFontSize(9); doc.setTextColor(...GRIGIO);
  doc.text(t(`Aggiornato al ${dataIt(data)}${fonti.length ? ` · Fonte: ${fonti.join('; ')}` : ''}`), m, 32.5, { maxWidth: w - 2 * m });

  const caselle = [
    [String(fab.length), 'fabbricati'], [String(ter.length), 'terreni'],
    [String(anna.length), 'beni in comune con Anna (1/2 ciascuno)'], [String(vincolati.length), 'beni con pignoramenti o vincoli'],
  ];
  const cw = (w - 2 * m - 3 * 4) / 4;
  caselle.forEach(([n, l], i) => {
    const x = m + i * (cw + 4);
    doc.setFillColor(...AZZURRO); doc.roundedRect(x, 37, cw, 17, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BLU); doc.text(n, x + 4, 46.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INCHIOSTRO);
    doc.text(doc.splitTextToSize(l, cw - 18), x + 16, 44.5);
  });

  // Riepilogo per luogo.
  let y = 60;
  const riepilogo = perGruppo(beni).map(([g, lista]) => {
    const quote = [...new Set(lista.map((b) => b.quota_luca))].join(', ');
    const conValore = lista.filter((b) => b.valore != null);
    const parte = conValore.reduce((s, b) => s + Number(b.valore) * (quota(b.quota_luca) || 0), 0);
    return { celle: [g, String(lista.length), quote, [...new Set(lista.map(comproprietari))].join('; '), lista.some((b) => b.vincoli) ? 'Sì' : '—',
      conValore.length ? `${euroIntero(parte)}${conValore.length < lista.length ? ` (${conValore.length} di ${lista.length})` : ''}` : 'da stimare'] };
  });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...BLU); doc.text('Riepilogo per luogo', m, y); y += 3;
  y = tabella(doc, y, { titoloPagina, corpo: 8.5, righe: riepilogo, colonne: [
    { titolo: 'Luogo', w: 78, grassetto: true }, { titolo: 'Unità', w: 14, destra: true }, { titolo: 'Tua quota', w: 28 },
    { titolo: 'Comproprietari', w: 85 }, { titolo: 'Vincoli', w: 16 }, { titolo: 'Valore della tua parte', w: w - 2 * m - 221, destra: true },
  ] });

  // Fabbricati.
  doc.addPage(); y = testata(doc, titoloPagina);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...BLU); doc.text(`Fabbricati (${fab.length})`, m, y + 2); y += 5;
  let n = 0;
  const righeF = perGruppo(fab).flatMap(([g, lista]) => [{ gruppo: g, destra: `${lista.length} unità` },
    ...lista.map((b) => ({ b, celle: [String(++n), `${b.nome || tipoBene(b)}\n${tipoBene(b)}${b.indirizzo ? ` – ${b.indirizzo}` : ''}${b.piano ? `, piano ${b.piano}` : ''}`,
      datiCatastali(b, true), `${b.categoria || ''}${b.classe ? ` cl. ${b.classe}` : ''}\n${b.consistenza || ''}`, b.rendita != null ? `${num(b.rendita)} €` : '—',
      quotaTesto(b), comproprietari(b), valoreTesto(b), vincoliNote(b)] }))]);
  y = tabella(doc, y, { titoloPagina, righe: righeF, colonne: [
    { titolo: 'N.', w: 7 }, { titolo: 'Bene', w: 50, grassetto: true }, { titolo: 'Dati catastali', w: 30 }, { titolo: 'Categoria e consistenza', w: 26 },
    { titolo: 'Rendita', w: 17, destra: true }, { titolo: 'Titolo e tua quota', w: 32, colore: () => BLU }, { titolo: 'Comproprietari', w: 26 },
    { titolo: 'Valore di mercato', w: 22, destra: true }, { titolo: 'Vincoli e note', w: 63, colore: (r) => (r.b?.vincoli ? AMBRA : INCHIOSTRO) },
  ] });

  // Terreni.
  doc.addPage(); y = testata(doc, titoloPagina);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...BLU); doc.text(`Terreni (${ter.length})`, m, y + 2); y += 5;
  const righeT = perGruppo(ter).flatMap(([g, lista]) => [{ gruppo: g, destra: `${lista.length} particelle` },
    ...lista.map((b) => ({ b, celle: [String(++n), b.nome || tipoBene(b), datiCatastali(b), `${b.categoria || ''}${b.classe ? ` cl. ${b.classe}` : ''}`, b.consistenza || '—',
      b.reddito_dominicale == null && b.reddito_agrario == null ? '—' : `RD ${num(b.reddito_dominicale)} €\nRA ${num(b.reddito_agrario)} €`,
      b.quota_luca, comproprietari(b), valoreTesto(b), vincoliNote(b)] }))]);
  y = tabella(doc, y, { titoloPagina, righe: righeT, colonne: [
    { titolo: 'N.', w: 7 }, { titolo: 'Terreno', w: 58, grassetto: true }, { titolo: 'Dati catastali', w: 28 }, { titolo: 'Qualità e classe', w: 36 },
    { titolo: 'Superficie', w: 20, destra: true }, { titolo: 'Redditi', w: 22, destra: true }, { titolo: 'Tua quota', w: 16, colore: () => BLU },
    { titolo: 'Comproprietari', w: 26 }, { titolo: 'Valore di mercato', w: 22, destra: true }, { titolo: 'Vincoli e note', w: 38, colore: (r) => (r.b?.vincoli ? AMBRA : INCHIOSTRO) },
  ] });

  // Note finali.
  const note = [
    "L'elenco è ricostruito dalle schermate della visura per soggetto: va confrontato con la visura ufficiale (tra una schermata e l'altra potrebbe mancare qualche riga).",
    'Comproprietari: indicati dove risultano dai documenti dell\'archivio o da Luca; "da verificare" dove la visura per soggetto non li riporta.',
    'Valore di mercato: valore dell\'intero bene inserito da Luca (perizia, stima di agenzia o stima propria); la "tua parte" è il valore moltiplicato per la quota.',
    'Vincoli: pignoramenti e ipoteche risultanti dagli atti in archivio; da verificare con ispezione ipotecaria aggiornata.',
  ];
  if (y > pagina(doc).h - 40) { doc.addPage(); y = testata(doc, titoloPagina); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...BLU); doc.text('Note', m, y + 2); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INCHIOSTRO);
  for (const nota of note) { const l = doc.splitTextToSize(`• ${t(nota)}`, w - 2 * m); doc.text(l, m, y); y += l.length * 3.8 + 1; }
  piedi(doc, `Beni immobili di ${intestatario} · documento di lavoro, non ha valore di certificazione · ${dataIt(data)}`);
  return doc;
}

export function pdfDivisione(JsPdf, beni, scenario, { data = new Date() } = {}) {
  const doc = new JsPdf({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Divisione con Anna – ${scenario.nome}`, subject: 'Proposta di divisione', creator: 'Poliedron' });
  const { w, m } = pagina(doc); const c = calcolaDivisione(beni, scenario); const titoloPagina = `Proposta di divisione – ${scenario.nome}`;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...BLU);
  doc.text(doc.splitTextToSize(t(scenario.nome), w - 2 * m), m, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INCHIOSTRO);
  doc.text('Divisione dei beni in comune tra Luca Simondi e Anna Simondi (1/2 ciascuno)', m, 27);
  doc.setFontSize(8.5); doc.setTextColor(...GRIGIO); doc.text(`Proposta di lavoro, non è un accordo · ${dataIt(data)}`, m, 32);
  let y = 37;
  if (scenario.descrizione) { doc.setFontSize(9.5); doc.setTextColor(...INCHIOSTRO); const l = doc.splitTextToSize(t(scenario.descrizione), w - 2 * m); doc.text(l, m, y); y += l.length * 4.2 + 2; }

  // Riquadro dei risultati.
  const box = [['A te', euroIntero(c.lottoLuca)], ['Ad Anna', euroIntero(c.lottoAnna)], ['Si vende', euroIntero(c.vendita)], ['Conguaglio', fraseConguaglio(c.conguaglio)]];
  const cw = (w - 2 * m - 9) / 4;
  box.forEach(([k, v], i) => {
    const x = m + i * (cw + 3);
    doc.setFillColor(...(i === 3 ? BLU : AZZURRO)); doc.roundedRect(x, y, cw, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...(i === 3 ? [255, 255, 255] : GRIGIO)); doc.text(k, x + 3, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(i === 3 ? 9.5 : 12); doc.setTextColor(...(i === 3 ? [255, 255, 255] : BLU));
    doc.text(doc.splitTextToSize(t(v), cw - 6), x + 3, y + 11);
  });
  y += 23;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INCHIOSTRO);
  const perConcordato = `Per il concordato entrano ${euroIntero(c.entrateLuca)} (conguaglio${c.venditaLuca ? ` + tua metà delle vendite ${euroIntero(c.venditaLuca)}` : ''}). Valore dei beni che tieni: ${euroIntero(c.lottoLuca)}. Tua quota di diritto: ${euroIntero(c.dirittoLuca)}.`;
  const l0 = doc.splitTextToSize(perConcordato, w - 2 * m); doc.text(l0, m, y); y += l0.length * 4 + 2;
  if (!c.completo) {
    doc.setTextColor(...AMBRA);
    const avv = [c.daDecidere.length ? `${c.daDecidere.length} beni ancora da assegnare` : '', c.mancanti.length ? `${c.mancanti.length} beni senza valore (esclusi dal conto)` : ''].filter(Boolean).join(' · ');
    doc.text(`Attenzione: ${avv}.`, m, y); y += 6;
  }
  const nome = Object.fromEntries(DESTINI);
  const righe = c.righe.map((r) => ({ r, celle: [`${r.bene.nome || tipoBene(r.bene)}\n${datiCatastali(r.bene)} · ${r.bene.categoria || ''}`,
    r.valore == null ? 'da stimare' : euroIntero(r.valore), r.dove ? nome[r.dove] : 'da decidere', euroIntero(r.parteLuca), euroIntero(r.parteAnna)] }));
  y = tabella(doc, y, { titoloPagina, corpo: 8.5, righe, colonne: [
    { titolo: 'Bene', w: 82, grassetto: true }, { titolo: 'Valore intero', w: 25, destra: true },
    { titolo: 'A chi va', w: 28, colore: (x) => (x.r?.dove === 'luca' ? BLU : x.r?.dove ? INCHIOSTRO : AMBRA) },
    { titolo: 'Metà di Luca', w: 25, destra: true }, { titolo: 'Metà di Anna', w: w - 2 * m - 160, destra: true },
  ] });
  const voci = (scenario.voci || []).filter((v) => Number(v.importo) > 0);
  if (voci.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...BLU); doc.text('Altre voci del conguaglio', m, y); y += 3;
    y = tabella(doc, y, { titoloPagina, corpo: 8.5, righe: voci.map((v) => ({ celle: [v.descrizione || 'Voce', v.a_favore === 'anna' ? 'a favore di Anna' : 'a favore di Luca', euroIntero(v.importo)] })),
      colonne: [{ titolo: 'Descrizione', w: 110 }, { titolo: 'A favore di', w: 40 }, { titolo: 'Importo', w: w - 2 * m - 150, destra: true }] });
  }
  if (scenario.note) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...BLU); doc.text('Note', m, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INCHIOSTRO);
    const l = doc.splitTextToSize(t(scenario.note), w - 2 * m); doc.text(l, m, y); y += l.length * 4;
  }
  piedi(doc, 'Conguaglio = metà di Luca dei beni che vanno ad Anna − metà di Anna dei beni che vanno a Luca ± altre voci. I valori sono quelli inseriti (perizie o stime).');
  return doc;
}

// Nel browser: carica jsPDF solo quando serve.
export async function creaPdfBeni(beni, opz) {
  const { jsPDF } = await import('jspdf');
  return pdfBeni(jsPDF, beni, opz).output('blob');
}
export async function creaPdfDivisione(beni, scenario, opz) {
  const { jsPDF } = await import('jspdf');
  return pdfDivisione(jsPDF, beni, scenario, opz).output('blob');
}
