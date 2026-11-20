// CONCORDATO: i PDF della sezione. «Situazione degli immobili» (A4 orizzontale, per l'avvocato e il gestore della
// crisi), «Beni in comune» (per Anna: solo i beni di famiglia) e «Proposta di divisione» (A4 verticale). Ricevono il costruttore di jsPDF, così girano anche fuori dal
// browser (test e copia prodotta in sessione).
import { calcolaDivisione, datiCatastali, DESTINI, etichettaNatura, euroIntero, formalitaDi, fraseConguaglio, quota, tipoBene } from './concordato.js';

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

const comproprietari = (b) => (b.intestatari?.length ? b.intestatari.filter((i) => i.nome !== 'Simondi Luca').map((i) => `${i.nome} ${i.quota}`).join('\n') : b.altri_comproprietari || 'Da verificare');
const valoreTesto = (b) => (b.valore == null ? 'da stimare' : `${euroIntero(b.valore)}\ntua parte ${euroIntero(Number(b.valore) * (quota(b.quota_luca) || 0))}`);
function perGruppo(beni) {
  const g = new Map();
  for (const b of beni) { const k = b.gruppo || b.comune; if (!g.has(k)) g.set(k, []); g.get(k).push(b); }
  return [...g.entries()];
}
const dataBreve = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT');
const CERT = { certo: '', probabile: ' (probabile)', da_verificare: ' (da verificare)' };
// Gravami di un bene in poche righe: «Pignoramento Primo srl RGE 25/2025 – 25/02/2025».
function gravamiTesto(b, formalita, { soloQuotaLuca = false } = {}) {
  const g = formalitaDi(b.id, formalita, { soloGravami: true });
  if (!g.length) return formalita.length ? 'Nessuna ipoteca o pignoramento risultante' : (b.vincoli || '');
  return g.map((f) => `${etichettaNatura(f.natura)}${f.creditore && !/^Da verificare/.test(f.creditore) ? ` ${f.creditore.replace(/\s*\(.*\)$/, '')}` : ''}${f.procedura ? ` ${f.procedura}` : ''} – ${dataBreve(f.data)}${CERT[f.certezza] || ''}`)
    .join('\n') + (soloQuotaLuca ? '' : '');
}
function sezioneTitolo(doc, y, testo, titoloPagina, spazio = 30) {
  const { h, m } = pagina(doc);
  if (y > h - spazio) { doc.addPage(); y = testata(doc, titoloPagina); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...BLU); doc.text(t(testo), m, y + 2);
  return y + 5;
}
function elenco(doc, y, righe, titoloPagina, { corpo = 9 } = {}) {
  const { w, h, m } = pagina(doc);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(corpo); doc.setTextColor(...INCHIOSTRO);
  for (const r of righe) {
    const l = doc.splitTextToSize(`• ${t(r)}`, w - 2 * m - 2);
    if (y + l.length * corpo * 0.42 > h - 14) { doc.addPage(); y = testata(doc, titoloPagina); doc.setFont('helvetica', 'normal'); doc.setFontSize(corpo); doc.setTextColor(...INCHIOSTRO); }
    doc.text(l, m + 1, y); y += l.length * corpo * 0.42 + 1.4;
  }
  return y + 2;
}
function caselle(doc, y, voci) {
  const { w, m } = pagina(doc); const cw = (w - 2 * m - (voci.length - 1) * 4) / voci.length;
  voci.forEach(([n, l], i) => {
    const x = m + i * (cw + 4);
    doc.setFillColor(...AZZURRO); doc.roundedRect(x, y, cw, 17, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BLU); doc.text(n, x + 4, y + 9.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INCHIOSTRO);
    doc.text(doc.splitTextToSize(t(l), cw - 18), x + 16 + (n.length > 2 ? (n.length - 2) * 3 : 0), y + 7.5);
  });
  return y + 23;
}
// Cose da sistemare nei registri, ricavate dai dati (intestatari non aggiornati, codici fiscali doppi, notifiche).
function daSistemare(beni) {
  const out = [];
  const lev = beni.filter((b) => (b.intestatari || []).some((i) => /^Levrone/.test(i.nome)));
  if (lev.length) out.push(`${lev.length} immobili risultano ancora in parte intestati a Levrone Anna Bruna (aree urbane di via Piccona 4/6, via Castello e terreni di Pradleves 1/9, terreno part. 112 2/9): dopo la successione vanno volturati agli eredi. Nella visura compaiono anche due codici fiscali diversi per lei (nata a Cervasca / a Pradleves), uno non validato: da correggere al catasto.`);
  if (beni.some((b) => b.comune === 'Pradleves' && b.particella === '102')) out.push('Via Castello 3 (Pradleves): notifica catastale in corso dal 2004 (protocollo CN0314638) sui tre subalterni.');
  if (beni.some((b) => b.catasto === 'F' && b.comune === 'Cuneo' && ['276', '664', '1600'].includes(b.particella))) out.push('Via Piccona 36: per alcune unità classamento e rendita non rettificati entro 12 mesi (D.M. 701/94); il tecnico del tribunale ha previsto il frazionamento in due unità.');
  if (beni.some((b) => b.comune === 'Pradleves' && ['65', '251'].includes(b.particella))) out.push('Terreni di Pradleves part. 65 e 251: riserva catastale «inesistenza di atti legali giustificanti uno o più passaggi intermedi».');
  return out;
}

export function pdfBeni(JsPdf, beni, { intestatario = 'Luca Simondi', data = new Date(), formalita = [] } = {}) {
  const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Situazione degli immobili di ${intestatario}`, subject: 'Beni, intestatari, ipoteche e trascrizioni', creator: 'Poliedron' });
  const { w, m } = pagina(doc); const titoloPagina = `Situazione degli immobili di ${intestatario} – al ${dataIt(data)}`;
  const fab = beni.filter((b) => b.catasto === 'F'), ter = beni.filter((b) => b.catasto === 'T');
  const anna = beni.filter((b) => b.in_divisione);
  const contro = formalita.filter((f) => f.verso === 'contro' && !['convenzione', 'cessione'].includes(f.natura));
  const colpiti = beni.filter((b) => (formalita.length ? formalitaDi(b.id, contro).length : b.vincoli));
  const fonti = [...new Set(beni.map((b) => b.fonte).filter(Boolean))];

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...BLU);
  doc.text(t(`Situazione degli immobili di ${intestatario}`), m, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INCHIOSTRO);
  doc.text('Beni, quote, intestatari, provenienza, ipoteche, pignoramenti e trascrizioni – documento di lavoro per l\'avvocato e il gestore della crisi', m, 27);
  doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
  doc.text(doc.splitTextToSize(t(`Aggiornato al ${dataIt(data)}${fonti.length ? ` · Fonti: ${fonti.join('; ')}` : ''}`), w - 2 * m), m, 32.5);
  let y = caselle(doc, 38, [[String(fab.length), 'fabbricati'], [String(ter.length), 'terreni'], [String(anna.length), 'beni in comune con Anna (1/2 ciascuno)'],
    [String(contro.length), 'ipoteche, pignoramenti e domande giudiziali'], [String(colpiti.length), 'beni toccati da almeno uno']]);

  const riepilogo = perGruppo(beni).map(([g, lista]) => {
    const quote = [...new Set(lista.map((b) => b.quota_luca))].join(', ');
    const conValore = lista.filter((b) => b.valore != null);
    const parte = conValore.reduce((s, b) => s + Number(b.valore) * (quota(b.quota_luca) || 0), 0);
    const nat = [...new Set(lista.flatMap((b) => formalitaDi(b.id, contro).map((f) => etichettaNatura(f.natura))))];
    return { celle: [g, String(lista.length), quote, [...new Set(lista.map((b) => comproprietari(b).replace(/\n/g, ', ')))].join('; '),
      nat.length ? nat.join(', ') : (formalita.length ? 'Nessuno' : '—'),
      conValore.length ? `${euroIntero(parte)}${conValore.length < lista.length ? ` (${conValore.length} di ${lista.length})` : ''}` : 'da stimare'] };
  });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...BLU); doc.text('Riepilogo per luogo', m, y); y += 3;
  y = tabella(doc, y, { titoloPagina, corpo: 8.3, righe: riepilogo, colonne: [
    { titolo: 'Luogo', w: 64, grassetto: true }, { titolo: 'Unità', w: 12, destra: true }, { titolo: 'Tua quota', w: 24 },
    { titolo: 'Altri intestatari', w: 82 }, { titolo: 'Gravami', w: 60, colore: (r) => (r.celle[4] !== 'Nessuno' && r.celle[4] !== '—' ? AMBRA : INCHIOSTRO) },
    { titolo: 'Valore tua parte', w: w - 2 * m - 242, destra: true },
  ] });

  // Fabbricati.
  doc.addPage(); y = testata(doc, titoloPagina);
  y = sezioneTitolo(doc, y, `Fabbricati (${fab.length})`, titoloPagina);
  let n = 0;
  const righeF = perGruppo(fab).flatMap(([g, lista]) => [{ gruppo: g, destra: `${lista.length} unità` },
    ...lista.map((b) => ({ b, celle: [String(++n), `${b.nome || tipoBene(b)}\n${tipoBene(b)}${b.indirizzo ? ` – ${b.indirizzo}` : ''}${b.piano ? `, piano ${b.piano}` : ''}`,
      datiCatastali(b, true), `${b.categoria || ''}${b.classe ? ` cl. ${b.classe}` : ''}\n${b.consistenza || ''}${b.superficie ? `\nsup. ${b.superficie.replace(/ \(.*\)/, '')}` : ''}`,
      b.rendita != null ? `${num(b.rendita)} €` : '—', `${b.titolo || 'Proprietà'} ${b.quota_luca}`, comproprietari(b), valoreTesto(b), gravamiTesto(b, formalita)] }))]);
  y = tabella(doc, y, { titoloPagina, corpo: 7.8, righe: righeF, colonne: [
    { titolo: 'N.', w: 7 }, { titolo: 'Bene', w: 52, grassetto: true }, { titolo: 'Dati catastali', w: 27 }, { titolo: 'Categoria, consistenza, superficie', w: 29 },
    { titolo: 'Rendita', w: 16, destra: true }, { titolo: 'Tuo diritto', w: 26, colore: () => BLU }, { titolo: 'Altri intestatari', w: 34 },
    { titolo: 'Valore di mercato', w: 21, destra: true }, { titolo: 'Ipoteche, pignoramenti, domande giudiziali', w: 61, colore: (r) => (formalitaDi(r.b?.id, contro).length ? AMBRA : INCHIOSTRO) },
  ] });

  // Terreni.
  doc.addPage(); y = testata(doc, titoloPagina);
  y = sezioneTitolo(doc, y, `Terreni (${ter.length})`, titoloPagina);
  const righeT = perGruppo(ter).flatMap(([g, lista]) => [{ gruppo: g, destra: `${lista.length} particelle` },
    ...lista.map((b) => ({ b, celle: [String(++n), b.nome || tipoBene(b), datiCatastali(b), `${b.categoria || ''}${b.classe ? ` cl. ${b.classe}` : ''}`, b.consistenza || '—',
      b.reddito_dominicale == null && b.reddito_agrario == null ? '—' : `RD ${num(b.reddito_dominicale)} €\nRA ${num(b.reddito_agrario)} €`,
      b.quota_luca, comproprietari(b), valoreTesto(b), gravamiTesto(b, formalita)] }))]);
  y = tabella(doc, y, { titoloPagina, corpo: 7.8, righe: righeT, colonne: [
    { titolo: 'N.', w: 7 }, { titolo: 'Terreno', w: 56, grassetto: true }, { titolo: 'Dati catastali', w: 26 }, { titolo: 'Qualità e classe', w: 32 },
    { titolo: 'Superficie', w: 18, destra: true }, { titolo: 'Redditi', w: 21, destra: true }, { titolo: 'Tua quota', w: 15, colore: () => BLU },
    { titolo: 'Altri intestatari', w: 36 }, { titolo: 'Valore', w: 20, destra: true }, { titolo: 'Gravami', w: 42, colore: (r) => (formalitaDi(r.b?.id, contro).length ? AMBRA : INCHIOSTRO) },
  ] });

  // Formalità.
  if (formalita.length) {
    doc.addPage(); y = testata(doc, titoloPagina);
    y = sezioneTitolo(doc, y, `Ipoteche, pignoramenti e trascrizioni (${formalita.length})`, titoloPagina);
    const nomi = Object.fromEntries(beni.map((b) => [b.id, b.nome || tipoBene(b)]));
    const righe = [...formalita].sort((a, b) => b.data.localeCompare(a.data)).map((f) => {
      const lista = f.beni || []; const certi = lista.filter((l) => l.certezza === 'certo');
      const beniTesto = lista.length <= 4 ? lista.map((l) => `${nomi[l.id] || '?'}${CERT[l.certezza]}`).join('\n')
        : `${lista.length} beni${certi.length && certi.length < lista.length ? ` (${certi.length} certi)` : certi.length ? ' (certi)' : ''}: ${[...new Set(lista.map((l) => beni.find((b) => b.id === l.id)?.gruppo).filter(Boolean))].join('; ')}`;
      return { f, celle: [dataBreve(f.data), `${f.tipo === 'iscrizione' ? 'Iscrizione' : 'Trascrizione'} ${f.verso === 'contro' ? 'contro' : 'a favore'}\nRP ${f.reg_particolare} · RG ${f.reg_generale}`,
        `${etichettaNatura(f.natura)}\n${f.atto}`, `${f.pubblico_ufficiale}\nrep. ${f.repertorio}`, [f.creditore, f.procedura].filter(Boolean).join('\n') || '—', beniTesto, f.note || ''] };
    });
    y = tabella(doc, y, { titoloPagina, corpo: 7.6, righe, colonne: [
      { titolo: 'Data', w: 17 }, { titolo: 'Formalità', w: 32 }, { titolo: 'Atto', w: 50, grassetto: true, colore: (r) => (r.f?.verso === 'contro' ? AMBRA : BLU) },
      { titolo: 'Pubblico ufficiale', w: 36 }, { titolo: 'Creditore e procedura', w: 38 }, { titolo: 'Beni', w: 56 }, { titolo: 'Note', w: w - 2 * m - 229 },
    ] });
  }

  y = sezioneTitolo(doc, y, 'Da sistemare e da verificare', titoloPagina, 50);
  y = elenco(doc, y + 1, [
    ...daSistemare(beni),
    'Collegamenti «probabile» e «da verificare»: le ispezioni «Note del soggetto» elencano le formalità per immobile senza riportare il subalterno nelle schermate; vanno confermati con l\'ispezione per singolo immobile o con la relazione notarile delle esecuzioni.',
    'Ipoteca volontaria 2013 (mutuo fondiario): ristretta nel 2015 e nel 2022, verificare su quali unità grava ancora e il debito residuo.',
    'Ipoteche giudiziali del Tribunale di Milano (decreto rep. 1183/2024): identificare il creditore.',
    'Valore di mercato: valore dell\'intero bene inserito da Luca (perizia, stima di agenzia o stima propria); la «tua parte» è il valore per la quota.',
  ], titoloPagina, { corpo: 8.5 });
  piedi(doc, `Situazione degli immobili di ${intestatario} · documento di lavoro, non sostituisce visure e certificati ufficiali · ${dataIt(data)}`);
  return doc;
}

// Per Anna: solo i beni di famiglia e quello che serve per dividerli. Niente concordato, niente altri debiti.
export function pdfBeniComuni(JsPdf, beni, formalita = [], { data = new Date() } = {}) {
  const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: 'Beni in comune tra Luca e Anna Simondi', subject: 'Beni ereditati e comproprietà di famiglia', creator: 'Poliedron' });
  const { w, m } = pagina(doc); const titoloPagina = `Beni in comune tra Luca e Anna Simondi – al ${dataIt(data)}`;
  const comuni = beni.filter((b) => b.in_divisione);
  const altri = beni.filter((b) => !b.in_divisione && (b.intestatari || []).some((i) => i.nome === 'Simondi Anna'));
  const contro = formalita.filter((f) => f.verso === 'contro' && !['convenzione', 'cessione'].includes(f.natura));
  const rendita = comuni.reduce((s, b) => s + (Number(b.rendita) || 0), 0);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...BLU);
  doc.text('Beni in comune tra Luca e Anna Simondi', m, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INCHIOSTRO);
  doc.text('Immobili ricevuti in successione e intestati a entrambi al 50% – base di lavoro per la divisione', m, 27);
  doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
  doc.text(t(`Aggiornato al ${dataIt(data)} · Fonti: visure catastali per soggetto del 20/11/2026 e ispezioni ipotecarie · Documento di lavoro, non è un accordo`), m, 32.5);
  let y = caselle(doc, 38, [[String(comuni.length), 'immobili intestati a Luca e Anna, 1/2 ciascuno'], [String(altri.length), 'altri immobili in comune con altri parenti'],
    [`${num(rendita, 0)} €`, 'rendita catastale totale dei beni al 50%']]);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INCHIOSTRO);
  const intro = doc.splitTextToSize(t('Questi sono gli immobili che risultano intestati a Luca e Anna in parti uguali. Per dividerli servono i valori di mercato (perizia o stima concordata): ognuno deve ricevere beni per la metà del valore totale e chi riceve di più versa all\'altro la differenza (conguaglio). Le colonne «Valore» e «A chi» sono da compilare insieme.'), w - 2 * m);
  doc.text(intro, m, y); y += intro.length * 4.2 + 3;

  let n = 0;
  const righe = perGruppo(comuni).flatMap(([g, lista]) => [{ gruppo: g, destra: `${lista.length} ${lista.length === 1 ? 'immobile' : 'immobili'}` },
    ...lista.map((b) => ({ b, celle: [String(++n), `${b.nome || tipoBene(b)}\n${tipoBene(b)}${b.piano ? `, piano ${b.piano}` : ''}`, datiCatastali(b, true),
      `${b.categoria || ''}${b.classe ? ` cl. ${b.classe}` : ''}\n${b.consistenza || ''}${b.superficie ? `\nsup. ${b.superficie.replace(/ \(.*\)/, '')}` : ''}`,
      b.catasto === 'T' ? `RD ${num(b.reddito_dominicale)} €` : b.rendita != null ? `${num(b.rendita)} €` : '—',
      b.titolo && b.titolo !== 'Proprietà' ? `${b.titolo}\nLuca 1/2 · Anna 1/2` : 'Luca 1/2 · Anna 1/2',
      gravamiTesto(b, contro.length ? formalita : []) || '—', b.valore != null ? euroIntero(b.valore) : '', ''] }))]);
  y = tabella(doc, y, { titoloPagina, corpo: 7.8, righe, colonne: [
    { titolo: 'N.', w: 7 }, { titolo: 'Immobile', w: 54, grassetto: true }, { titolo: 'Dati catastali', w: 27 }, { titolo: 'Categoria e superficie', w: 29 },
    { titolo: 'Rendita', w: 18, destra: true }, { titolo: 'Intestazione', w: 30, colore: () => BLU },
    { titolo: 'Ipoteche, pignoramenti, domande giudiziali', w: 62, colore: (r) => (formalitaDi(r.b?.id, contro).length ? AMBRA : INCHIOSTRO) },
    { titolo: 'Valore (da compilare)', w: 25, destra: true }, { titolo: 'A chi (da compilare)', w: w - 2 * m - 252 },
  ] });

  if (altri.length) {
    y = sezioneTitolo(doc, y, 'Altri immobili di famiglia (in comune anche con altri parenti)', titoloPagina, 50);
    y = tabella(doc, y + 1, { titoloPagina, corpo: 7.8, righe: perGruppo(altri).map(([g, lista]) => ({ celle: [g, String(lista.length),
      [...new Set(lista.map((b) => (b.intestatari || []).map((i) => `${i.nome} ${i.quota}`).join(', ')))].join(' | '), [...new Set(lista.map((b) => b.provenienza).filter(Boolean))].join(' | ')] })),
    colonne: [{ titolo: 'Luogo', w: 62, grassetto: true }, { titolo: 'Unità', w: 13, destra: true }, { titolo: 'Intestatari e quote', w: 110 }, { titolo: 'Provenienza', w: w - 2 * m - 185 }] });
  }

  y = sezioneTitolo(doc, y, 'Come si fa la divisione', titoloPagina, 60);
  y = elenco(doc, y + 1, [
    'Valori: serve un valore di mercato per ogni immobile, uguale per entrambi (perizia del tecnico del tribunale dove c\'è, oppure una stima concordata).',
    'Lotti: ognuno riceve immobili per la metà del valore totale. Se un lotto vale di più, chi lo riceve paga all\'altro metà della differenza (conguaglio).',
    'Ipoteche e pignoramenti iscritti solo sulla quota di Luca: con la divisione si spostano sui beni che vengono assegnati a Luca. I creditori che li hanno iscritti devono partecipare alla divisione, altrimenti non vale nei loro confronti: per questo va fatta con l\'avvocato, dentro le cause di divisione già aperte dove possibile.',
    'Le divisioni già disposte dal Tribunale di Cuneo riguardano via Piccona 36 (udienza 14/01/2027) e i terreni di Cascina Piccona: lì un accordo tra Luca e Anna sui lotti si può presentare al giudice.',
    'Gli immobili di Pradleves e le aree urbane di via Piccona sono in comune anche con altri parenti: restano fuori da questa divisione e prima vanno regolarizzate le intestazioni.',
  ], titoloPagina, { corpo: 9 });
  y = sezioneTitolo(doc, y, 'Da sistemare insieme', titoloPagina, 40);
  y = elenco(doc, y + 1, daSistemare(beni), titoloPagina, { corpo: 9 });
  piedi(doc, `Beni in comune tra Luca e Anna Simondi · documento di lavoro preparato da Luca, non è un accordo né una perizia · ${dataIt(data)}`);
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
export async function creaPdfBeniComuni(beni, formalita, opz) {
  const { jsPDF } = await import('jspdf');
  return pdfBeniComuni(jsPDF, beni, formalita, opz).output('blob');
}
export async function creaPdfDivisione(beni, scenario, opz) {
  const { jsPDF } = await import('jspdf');
  return pdfDivisione(jsPDF, beni, scenario, opz).output('blob');
}
