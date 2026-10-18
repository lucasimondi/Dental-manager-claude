// Poliedron Personal — chat a pagina intera con allegati (PO 2026-10-17: "deve essere una pagina
// a sé, come Poliedron per lo studio, deve poter avere anche allegati tramite tastino").
// Un file allegato viene archiviato come ogni caricamento (stesse regole: duplicati, documenti
// dei pazienti mai letti dal modello) e Poliedron risponde su quel documento.

export const ACCETTA_ALLEGATI = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.txt,.rtf,.heic,.heif';
export const DOMANDA_ALLEGATO = 'Di cosa si tratta? Riassumilo in breve e dimmi se devo fare qualcosa (pagamenti, scadenze).';
export const CHAT_VUOTA = { modo: 'ai', messaggi: [], documento: null };

export const dimensioneFile = (byte = 0) => (byte < 1048576 ? `${Math.max(1, Math.round(byte / 1024))} KB` : `${(byte / 1048576).toFixed(1)} MB`);

// Si può inviare con una domanda, con un file o con entrambi; mai mentre Poliedron sta lavorando.
export const puoInviare = ({ testo = '', file = null, attesa = false }) => !attesa && (Boolean(testo.trim()) || Boolean(file));

// Storia per il modello: solo i messaggi con testo (gli avvisi d'archiviazione non contano), ultimi 6.
export const storiaChat = (messaggi = []) => messaggi.filter((m) => m.testo).map((m) => ({ ruolo: m.ruolo, testo: m.testo })).slice(-6);

// Domanda da mandare: quella scritta, oppure quella standard quando c'è solo il file.
export const domandaDa = (testo = '', conAllegato = false) => testo.trim() || (conAllegato ? DOMANDA_ALLEGATO : '');

// Esito del caricamento → documento su cui prosegue la chat e messaggio da mostrare.
export function esitoAllegato(r, nomeFile) {
  if (!r?.id) return { documento: null, messaggio: { ruolo: 'assistente', fonte: 'archivio', nota: 'File salvato, ma non trovo il documento in archivio.' } };
  const documento = { id: r.id, titolo: r.titolo || nomeFile };
  return { documento, messaggio: { ruolo: 'assistente', fonte: 'archivio', archiviato: documento, duplicato: Boolean(r.duplicato) } };
}
