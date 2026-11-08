// DOCK-PER-TE passo 3 — gli ingressi del tasto + (selettori di file) e dove porta ciascuno.
// Ogni selettore si apre con il gesto dell'utente; il file scelto apre la pagina giusta.
export const LIVELLI_AGGIUNGI = ['documento', 'spesa', 'foto'];
export const INGRESSI = {
  fotocamera: { accept: 'image/*', capture: 'environment', pagina: (file) => ({ tipo: 'carica', file, opzioni: { autoInvia: true } }) },
  libreria: { accept: 'image/*', pagina: (file) => ({ tipo: 'carica', file, opzioni: { autoInvia: true } }) },
  file: { pagina: (file) => ({ tipo: 'carica', file, opzioni: {} }) },
  spesaScontrino: { accept: 'image/*', capture: 'environment', pagina: (file) => ({ tipo: 'spesaRicevuta', file }) },
  spesaFile: { accept: 'image/*,application/pdf,.heic,.heif', pagina: (file) => ({ tipo: 'spesaRicevuta', file }) },
  fotoCamera: { accept: 'image/*,video/*', capture: 'environment', pagina: (file) => ({ tipo: 'carica', file, opzioni: { fascicolo: 'foto_video', descrizione: 'Foto personale' } }) },
  fotoGalleria: { accept: 'image/*,video/*', pagina: (file) => ({ tipo: 'carica', file, opzioni: { fascicolo: 'foto_video', descrizione: 'Foto personale' } }) },
};
// Pagine aperte direttamente da una voce del + (senza selettore).
export const PAGINE_AGGIUNGI = {
  scansiona: { tipo: 'scansione' },
  pdf: { tipo: 'pdf' },
  spesaManuale: { tipo: 'spesaRicevuta' },
  personale: { tipo: 'carica', opzioni: { fascicolo: 'identita', portafoglio: true } },
  fotovideo: { tipo: 'carica', opzioni: { fascicolo: 'foto_video', descrizione: 'Foto o video personale' } },
  incasso: { tipo: 'movimento', m: { tipo: 'entrata' } },
  pagamento: { tipo: 'scadenza' },
  evento: { tipo: 'evento' },
  appuntamento: { tipo: 'evento', cosa: 'appuntamento' },
};
// Il + dello Studio (Per te) arriva con ?aggiungi=…: si legge una volta e si toglie dall'indirizzo.
const DA_INDIRIZZO = [...LIVELLI_AGGIUNGI, 'nota', 'password', 'spesaManuale', 'pdf'];
export function voceDaIndirizzo(win = globalThis) {
  const url = new URL(win.location.href), voce = url.searchParams.get('aggiungi');
  if (!voce) return null;
  url.searchParams.delete('aggiungi'); win.history.replaceState(null, '', url);
  return DA_INDIRIZZO.includes(voce) ? voce : null;
}
