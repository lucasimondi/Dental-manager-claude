/**
 * Helper condiviso per la gestione dei PDF generati nell'app: condivisione
 * nativa (menù Condividi del telefono, con WhatsApp/Mail/altro come opzioni
 * reali perché il FILE viene passato per davvero, non un link), scorciatoia
 * diretta su WhatsApp del paziente, e download classico come fallback per
 * i browser/contesti dove la condivisione nativa non è disponibile (es.
 * desktop, o browser più vecchi).
 *
 * Il problema che risolve: un semplice link <a download> salva il file ma
 * non lo rende "condivisibile" dal telefono — l'app di destinazione (WhatsApp,
 * Mail) non lo trova automaticamente. navigator.share() con un vero oggetto
 * File risolve questo, perché passa il contenuto binario reale al sistema.
 */

// Converte un data URL "data:application/pdf;base64,...." in un oggetto File,
// necessario per navigator.share (non accetta stringhe base64 dirette).
//
// ATTENZIONE: jsPDF (doc.output('datauristring')) genera un header NON
// standard che include un parametro filename, tipo:
//   data:application/pdf;filename=ricetta.pdf;base64,JVBERi0x...
// Un regex ingenuo su "data:(.*?);base64" cattura per sbaglio anche il
// "filename=..." come se fosse parte del MIME type, producendo un File con
// `type` corrotto — su iOS Safari questo fa sì che navigator.share() scarti
// silenziosamente l'allegato e mandi solo il testo. Qui isoliamo sempre e
// solo il vero MIME type (prima del primo ";"), ignorando ogni parametro extra.
function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/^data:([^;]+)/);
  const mime = mimeMatch?.[1] || 'application/pdf';
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/**
 * Prova la condivisione nativa con il file allegato. Ritorna true se è
 * partita (o l'utente ha annullato dal picker, che per noi è comunque un
 * "successo" nel senso che il meccanismo ha funzionato), false se il
 * browser non supporta affatto la condivisione di file — in quel caso il
 * chiamante deve ricadere sul download classico.
 *
 * IMPORTANTE: non passare mai `text` insieme a `files`. Su molte
 * implementazioni Android (WhatsApp in particolare) se c'è un testo non
 * vuoto insieme all'allegato, l'app ricevente privilegia il testo e "perde"
 * il file vero e proprio — arriva solo il messaggio, non il PDF. Passando
 * solo `files` (+ eventualmente `title`, che è metadato e non appare come
 * messaggio) il file arriva sempre correttamente.
 */
export async function condividiPdf(dataUrl, filename) {
  const file = dataUrlToFile(dataUrl, filename);
  const canShareFiles = typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (!canShareFiles) return false;

  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (err) {
    // AbortError = l'utente ha chiuso il picker senza scegliere: non è un
    // errore reale, il meccanismo ha funzionato, semplicemente ha desistito.
    if (err?.name === 'AbortError') return true;
    return false;
  }
}

/** Download classico via link temporaneo — fallback quando la condivisione nativa non c'è. */
export function scaricaPdf(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Apre WhatsApp verso il numero del paziente. Nota: WhatsApp Web/App non
 * permette di allegare automaticamente un file da URL esterno per motivi di
 * sicurezza — quindi qui apriamo la chat pronta e, se la condivisione nativa
 * è disponibile, la lanciamo comunque in parallelo così l'utente può
 * scegliere "WhatsApp" dal menù di condivisione e allegare il file lì.
 */
export function whatsappUrl(telefono, testo) {
  const numero = (telefono || '').replace(/[^\d+]/g, '');
  if (!numero) return null;
  const numeroIntl = numero.startsWith('+') ? numero.slice(1) : (numero.startsWith('39') ? numero : `39${numero}`);
  return `https://wa.me/${numeroIntl}?text=${encodeURIComponent(testo || '')}`;
}

/**
 * "Invia al paziente": non esiste un'API che apra la chat di un contatto
 * specifico CON l'allegato già pronto — è un limite reale della piattaforma,
 * non aggirabile lato browser. L'approccio più vicino a "diretto e veloce"
 * possibile: apriamo prima la chat WhatsApp del paziente (così è già lì,
 * pronta), e con un piccolo ritardo lanciamo la condivisione nativa del
 * file — l'utente si ritrova con WhatsApp già in primo piano/tra le scelte
 * più recenti nel picker, e allega con un tap invece di cercare il contatto.
 * Ritorna true se la chat si è aperta, false se il paziente non ha un
 * telefono salvato.
 */
export async function inviaAlPaziente(telefono, dataUrl, filename) {
  const link = whatsappUrl(telefono, '');
  if (!link) return false;
  window.open(link, '_blank');
  // Piccolo ritardo per lasciare che WhatsApp prenda il focus prima di
  // sovrapporre il picker di condivisione di sistema.
  await new Promise((r) => setTimeout(r, 600));
  await condividiPdf(dataUrl, filename);
  return true;
}
