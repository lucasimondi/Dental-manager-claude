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

/**
 * Download classico via link temporaneo — fallback quando la condivisione nativa non c'è.
 *
 * Usa sempre un blob: URL, mai il data: URI grezzo direttamente in `href`:
 * Safari iOS (e diverse WebView Android) ignora o gestisce in modo
 * inaffidabile l'attributo `download` su un `<a href="data:...">` di
 * dimensioni non banali — spesso naviga/apre l'anteprima invece di
 * scaricare il file, che è esattamente il sintomo "su mobile non scarica".
 * Un blob: URL è l'oggetto che tutti i browser mobili moderni sanno
 * scaricare in modo affidabile con lo stesso pattern <a download>.
 */
export function scaricaPdf(dataUrl, filename) {
  const file = dataUrlToFile(dataUrl, filename);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * "Invia al paziente": non esiste un'API che apra la chat di un contatto
 * specifico CON l'allegato già pronto — è un limite reale della
 * piattaforma, non aggirabile lato browser.
 *
 * Un primo tentativo era: aprire prima la chat WhatsApp del paziente con
 * window.open(), poi lanciare la condivisione nativa dopo un breve ritardo.
 * Non funziona: su iOS Safari, window.open() verso un link wa.me naviga via
 * dalla pagina (o passa il controllo all'app WhatsApp), interrompendo
 * l'esecuzione dello script prima che il setTimeout successivo possa
 * scattare — la chat resta aperta ma vuota, senza che la condivisione parta
 * mai. Non c'è un modo affidabile per "riprendere" dopo quella navigazione.
 *
 * L'unico percorso realmente funzionante: la condivisione nativa parte
 * subito, mentre siamo ancora nella pagina. L'utente sceglie "WhatsApp" dal
 * picker di sistema, e da lì è WhatsApp stesso — non noi — a fargli
 * scegliere il contatto e ad allegare il file nella chat corretta.
 */
export async function inviaAlPaziente(dataUrl, filename) {
  return condividiPdf(dataUrl, filename);
}

/**
 * Copia il numero di telefono negli appunti, ripulito da spazi/simboli.
 * Utile prima di aprire il picker di condivisione: l'utente può incollarlo
 * nella ricerca contatti di WhatsApp invece di scorrere la rubrica a mano.
 * Ritorna true se la copia è riuscita.
 */
export async function copiaNumero(telefono) {
  const numero = (telefono || '').trim();
  if (!numero) return false;
  try {
    await navigator.clipboard.writeText(numero);
    return true;
  } catch {
    return false;
  }
}
