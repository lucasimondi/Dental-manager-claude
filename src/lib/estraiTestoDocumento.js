// Estrae il testo da un file caricato per il pannello Agente AI (tab
// Documenti): solo estrazione testo, il file originale non viene
// conservato — è il testo che alimenta la conoscenza dell'assistente.
// pdfjs viene importato dinamicamente (non nel bundle principale): lo
// stesso pattern usato da PdfViewerModal.jsx, per non appesantire il
// caricamento dell'app a chi non usa mai questa funzione.

const MAX_CHAR = 40000; // oltre non serve: l'edge function tronca comunque per studio

const leggiTxt = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
});

const leggiPdf = async (file) => {
  const [pdfjsLib, { default: pdfjsWorker }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.js'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.js?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pagine = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pagine.push(content.items.map((it) => it.str).join(' '));
  }
  return pagine.join('\n\n');
};

export async function estraiTestoDocumento(file) {
  const nome = file.name || '';
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(nome);
  const testo = isPdf ? await leggiPdf(file) : await leggiTxt(file);
  return testo.trim().slice(0, MAX_CHAR);
}
