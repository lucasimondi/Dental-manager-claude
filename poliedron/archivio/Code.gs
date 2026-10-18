/**
 * ARCHIVIO DOCUMENTI — acquisizione e catalogazione degli allegati Gmail
 *
 * Gira come Google Apps Script sul tuo account Google:
 *  - ogni 10 minuti prende le email con allegati non ancora elaborate (prima le recenti, poi lo storico)
 *  - legge il contenuto degli allegati con l'API di Claude e li cataloga
 *  - salva i file su Google Drive in "Archivio Documenti/<Fascicolo>/<Anno>/"
 *  - registra dati estratti, soggetti, scadenze e pratiche su Supabase
 *  - ogni mattina alle 7 ti manda un riepilogo, solo se c'è qualcosa da fare
 *
 * Proprietà dello script richieste (Impostazioni progetto > Proprietà script):
 *   SUPABASE_URL       https://xxxx.supabase.co
 *   SUPABASE_KEY       chiave segreta (secret key / service_role)
 *   ANTHROPIC_API_KEY  chiave API di Claude
 * Facoltative:
 *   GEMINI_API_KEY     chiave di Google AI Studio: analisi con Gemini quando Claude è in pausa
 *   GEMINI_MODELLO     modello Gemini (predefinito: CONFIG.MODELLO_GEMINI)
 *   EMAIL_DIGEST       destinatario del riepilogo (predefinito: il tuo indirizzo)
 *   DASHBOARD_URL      indirizzo della dashboard, per il link nel riepilogo
 */

const CONFIG = {
  MODELLO: 'claude-haiku-5-5',
  // Riserva quando Claude è in pausa (PO 2026-10-18). Alias di Google che segue l'ultimo Flash.
  MODELLO_GEMINI: 'gemini-flash-latest',
  ETICHETTA_PADRE: 'Archivio',
  ETICHETTA_FATTO: 'Archivio/Elaborato',
  ETICHETTA_ERRORE: 'Archivio/Errore',
  QUERY_BASE: 'has:attachment -in:chats -category:promotions -category:social',
  THREAD_PER_GIRO: 15,
  TEMPO_MAX_MS: 4.5 * 60 * 1000,
  IMMAGINE_MIN_BYTE: 40 * 1024,          // sotto questa soglia le immagini sono loghi/firme
  PDF_MAX_BYTE: 18 * 1024 * 1024,
  IMMAGINE_MAX_BYTE: 4.5 * 1024 * 1024,
  TESTO_MAX_CARATTERI: 40000,
  CARTELLA_RADICE: 'Archivio personale',
  INIZIO_STORICO: '2004-01',        // primo mese da cui cercare (i mesi vuoti vengono saltati in un attimo)
  EMAIL_PER_LOTTO: true,            // un resoconto via email per ogni lotto (= un mese di posta) con documenti
  CARTELLA_STAGING: '_In elaborazione',
  FILE_DA_IGNORARE: /^(image\d{3}\.(png|jpe?g|gif)|smime\.p7s|signature\.asc|.*\.ics|.*\.vcf)$/i,

  // Documenti clinici dei pazienti: archiviati su Drive ma MAI inviati all'analisi del contenuto.
  // Aggiungi domini o parole se servono (es. 'ieo.it' per tenere fuori anche i documenti sanitari di famiglia).
  CLINICO_DOMINI: ['ospedale.cuneo.it', 'aslcn1.it', 'aslcn2.it'],
  CLINICO_PAROLE: /\b(paziente|pz|referto|referti|dem|opt|ortopanoramica|cbct|tac|rx|radiograf\w*|impegnativa|anamnesi|cartella clinica|consenso informato|piano di cura|preventivo paziente)\b/i,

  GIORNI_DIGEST: 14,
  FUSO: 'Europe/Rome',
};

const FASCICOLI = {
  identita: 'Identità',
  immobili: 'Immobili e catasto',
  successione: 'Successione',
  conti: 'Conti e banche',
  fiscale: 'Fiscale e tasse',
  previdenza: 'Previdenza ed ENPAM',
  utenze: 'Utenze',
  riscaldamento: 'Riscaldamento',
  studio_fornitori: 'Studio - fornitori',
  studio_fatture_emesse: 'Studio - fatture emesse',
  legale: 'Legale e contenziosi',
  assicurazioni: 'Assicurazioni',
  veicoli: 'Veicoli',
  famiglia_scuola: 'Famiglia e scuola',
  sanitario_famiglia: 'Sanitario famiglia',
  clinico_pazienti: 'Clinico pazienti',
  servizi: 'Abbonamenti e servizi',
  acquisti: 'Acquisti',
  formazione: 'Formazione e congressi',
  personale_studio: 'Studio - personale e candidature',
  corrispondenza: 'Corrispondenza personale',
  foto_video: 'Foto e video',
  pubblicita: 'Pubblicità e offerte',
  altro: 'Altro',
};
const RILEVANZE = ['alta', 'normale', 'bassa'];

/* =====================================================================
 * INSTALLAZIONE — esegui una volta "setup" dall'editor
 * ===================================================================*/
function setup() {
  props_();
  etichetta_(CONFIG.ETICHETTA_PADRE);
  etichetta_(CONFIG.ETICHETTA_FATTO);
  etichetta_(CONFIG.ETICHETTA_ERRORE);
  cartellaRadice_();
  sb_('fascicoli?select=codice&limit=1'); // verifica la connessione a Supabase

  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('elabora').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('digest').timeBased().everyDays(1).atHour(7).inTimezone(CONFIG.FUSO).create();
  Logger.log('Setup completato. Cartella Drive: ' + cartellaRadice_().getUrl());
}

/* =====================================================================
 * ELABORAZIONE
 * ===================================================================*/
/*
 * Importa dal più vecchio al più recente. Un lotto = un mese di posta.
 * Il cursore (proprietà LOTTO_MESE) avanza solo quando il mese è completo;
 * a fine lotto il resoconto viene salvato su Supabase e inviato via email.
 * Arrivato al mese corrente resta lì e importa la posta nuova man mano.
 */
function elabora() {
  // Limite di spesa dell'API raggiunto (POL-VITA-013): l'importazione continua senza Claude, con un
  // catalogo provvisorio a regole; l'analisi completa si fa quando l'API torna disponibile.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const inizio = Date.now();
  const sp = PropertiesService.getScriptProperties();
  try {
    const fatto = etichetta_(CONFIG.ETICHETTA_FATTO);
    const errore = etichetta_(CONFIG.ETICHETTA_ERRORE);
    const pratiche = praticheAperte_();
    const meseOggi = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM');

    // Notifiche sul telefono dei promemoria (POL-VITA-018): dalle 8 alle 21, al massimo una volta l'ora.
    inviaNotifiche_(false);

    // Cartelle di Drive per categoria e persona (POL-VITA-013): un po' a ogni giro.
    try { ordinaDrive_(inizio + ORDINA_DRIVE_MS); } catch (e) { logErrore_('ordine Drive', e); }

    if (!apiInPausa_()) {
      // Documenti importati senza Claude: analisi completa, pochi a ogni giro.
      try { analizzaRimasti_(inizio + ANALISI_RIMASTI_MS); } catch (e) { if (e.message !== 'RIPROVA') logErrore_('analisi rimasti', e); }
      // Riordino dell'archivio già importato (POL-VITA-007): un lotto a ogni giro, anche mentre lo
      // storico è ancora in importazione; altri lotti in fondo se avanza tempo.
      if (!claudeInPausa_()) try { riordinaLotto_(); } catch (e) { if (e.message !== 'RIPROVA') logErrore_('riordino', e); }
    }

    // Recupero: thread di mesi già superati dal cursore e rimessi in coda con riprovaErrori
    const cursore = sp.getProperty('LOTTO_MESE');
    if (cursore) {
      const prima = Math.floor(new Date(+cursore.slice(0, 4), +cursore.slice(5, 7) - 1, 1).getTime() / 1000);
      const recupero = GmailApp.search(CONFIG.QUERY_BASE + ' before:' + prima +
        ' -label:' + etichettaQuery_(CONFIG.ETICHETTA_FATTO) +
        ' -label:' + etichettaQuery_(CONFIG.ETICHETTA_ERRORE), 0, 40).reverse();
      for (let i = 0; i < recupero.length; i++) {
        const t = recupero[i];
        if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) return;
        try {
          elaboraThread_(t, pratiche, inizio, null);
          t.addLabel(fatto);
        } catch (e) {
          if (e.message === 'TEMPO' || e.message === 'RIPROVA' || QUOTA_GOOGLE.test(e.message)) return;
          console.error('Thread ' + t.getId() + ': ' + (e.stack || e));
          t.addLabel(errore);
          logErrore_('thread ' + t.getId() + ' — ' + t.getFirstMessageSubject(), e);
        }
      }
    }

    while (Date.now() - inizio < CONFIG.TEMPO_MAX_MS) {
      const mese = sp.getProperty('LOTTO_MESE') || CONFIG.INIZIO_STORICO;
      const a = +mese.slice(0, 4), m = +mese.slice(5, 7);
      const da = Math.floor(new Date(a, m - 1, 1).getTime() / 1000);
      const a_ = Math.floor(new Date(a, m, 1).getTime() / 1000);
      const query = CONFIG.QUERY_BASE + ' after:' + da + ' before:' + a_ +
        ' -label:' + etichettaQuery_(CONFIG.ETICHETTA_FATTO) +
        ' -label:' + etichettaQuery_(CONFIG.ETICHETTA_ERRORE);
      const threads = GmailApp.search(query, 0, 500).reverse(); // dal più vecchio

      if (!threads.length) {
        if (mese >= meseOggi) break;                 // in pari: aspetta la posta nuova
        chiudiLotto_(mese);
        sp.setProperty('LOTTO_MESE', meseSuccessivo_(mese));
        continue;
      }

      const stat = statLotto_(mese);
      let interrotto = false;
      for (let i = 0; i < threads.length; i++) {
        const t = threads[i];
        if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) { interrotto = true; break; }
        try {
          elaboraThread_(t, pratiche, inizio, stat);
          t.addLabel(fatto);
        } catch (e) {
          if (e.message === 'TEMPO' || e.message === 'RIPROVA' || QUOTA_GOOGLE.test(e.message)) { interrotto = true; break; }
          console.error('Thread ' + t.getId() + ': ' + (e.stack || e));
          t.addLabel(errore);
          stat.errori++;
          logErrore_('thread ' + t.getId() + ' — ' + t.getFirstMessageSubject(), e);
        }
      }
      salvaStatLotto_(mese, stat);
      if (interrotto) break;
    }
    // Tempo avanzato: riordina i documenti già in archivio (POL-VITA-007), a piccoli lotti.
    while (!claudeInPausa_() && Date.now() - inizio < CONFIG.TEMPO_MAX_MS - 60000) {
      if (!riordinaLotto_()) break;
    }
  } finally {
    lock.releaseLock();
  }
}

// Quote giornaliere di Google (UrlFetch, Gmail, Drive) esaurite: si riprende al giro dopo, senza
// segnare l'email come errore (POL-VITA-013: senza Claude l'importazione corre molto più veloce).
const QUOTA_GOOGLE = /too many times|invoked too many|quota|limit exceeded|rate limit/i;

function elaboraThread_(thread, pratiche, inizio, stat) {
  const messaggi = thread.getMessages();
  for (let i = 0; i < messaggi.length; i++) {
    const m = messaggi[i];
    const allegati = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
    for (let j = 0; j < allegati.length; j++) {
      if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) throw new Error('TEMPO');
      const esito = elaboraAllegato_(m, allegati[j], pratiche);
      if (!esito || !stat) continue;
      if (esito.tipo === 'duplicato') { stat.duplicati++; continue; }
      stat.documenti++;
      stat.per_fascicolo[esito.fascicolo] = (stat.per_fascicolo[esito.fascicolo] || 0) + 1;
      if (esito.nuovaPratica) stat.nuove_pratiche.push(esito.nuovaPratica);
      if (esito.urgente) stat.urgenti.push(esito.titolo);
    }
  }
}

/* ---------- Lotti ---------- */
function meseSuccessivo_(mese) {
  const d = new Date(+mese.slice(0, 4), +mese.slice(5, 7), 1);
  return Utilities.formatDate(d, CONFIG.FUSO, 'yyyy-MM');
}
function statLotto_(mese) {
  const salvato = PropertiesService.getScriptProperties().getProperty('LOTTO_STAT_' + mese);
  return salvato ? JSON.parse(salvato)
    : { documenti: 0, duplicati: 0, errori: 0, per_fascicolo: {}, nuove_pratiche: [], urgenti: [] };
}
function salvaStatLotto_(mese, stat) {
  stat.nuove_pratiche = stat.nuove_pratiche.slice(-60);
  stat.urgenti = stat.urgenti.slice(-60);
  PropertiesService.getScriptProperties().setProperty('LOTTO_STAT_' + mese, JSON.stringify(stat));
}
function chiudiLotto_(mese) {
  const sp = PropertiesService.getScriptProperties();
  const raw = sp.getProperty('LOTTO_STAT_' + mese);
  if (!raw) return; // mese senza allegati: nessun resoconto
  const s = JSON.parse(raw);
  sp.deleteProperty('LOTTO_STAT_' + mese);
  if (!s.documenti && !s.errori) return;

  try {
    sb_('lotti_importazione?on_conflict=periodo', {
      method: 'post', prefer: 'resolution=merge-duplicates',
      body: { periodo: mese, documenti: s.documenti, duplicati: s.duplicati, errori: s.errori,
              per_fascicolo: s.per_fascicolo, nuove_pratiche: s.nuove_pratiche, urgenti: s.urgenti },
    });
  } catch (e) { logErrore_('lotto ' + mese, e); }

  if (!CONFIG.EMAIL_PER_LOTTO) return;
  // Senza Claude i lotti si chiudono a raffica: niente decine di email, il resoconto resta in archivio.
  if (apiInPausa_()) return;
  const nomeMese = Utilities.formatDate(new Date(+mese.slice(0, 4), +mese.slice(5, 7) - 1, 15), CONFIG.FUSO, 'MMMM yyyy');
  const fascicoli = Object.keys(s.per_fascicolo).sort(function (x, y) { return s.per_fascicolo[y] - s.per_fascicolo[x]; })
    .map(function (k) { return '  ' + (FASCICOLI[k] || k) + ': ' + s.per_fascicolo[k]; }).join('\n');
  const righe = [
    'Lotto ' + mese + ' completato.',
    '',
    'Documenti importati: ' + s.documenti,
    'Duplicati saltati: ' + s.duplicati,
    'Thread in errore: ' + s.errori + (s.errori ? ' (etichetta Archivio/Errore; esegui riprovaErrori per rimetterli in coda)' : ''),
    '',
    'Per fascicolo:', fascicoli || '  nessuno',
  ];
  if (s.nuove_pratiche.length) righe.push('', 'Nuove pratiche:', s.nuove_pratiche.map(function (x) { return '  ' + x; }).join('\n'));
  if (s.urgenti.length) righe.push('', 'Documenti urgenti da verificare:', s.urgenti.map(function (x) { return '  ' + x; }).join('\n'));
  const p = props_();
  if (p.DASHBOARD_URL) righe.push('', 'Dashboard: ' + p.DASHBOARD_URL);
  GmailApp.sendEmail(p.EMAIL_DIGEST || Session.getEffectiveUser().getEmail(),
    'Archivio: lotto ' + nomeMese + ', ' + s.documenti + ' documenti', righe.join('\n'), { name: 'Archivio Documenti' });
}

function elaboraAllegato_(m, a, pratiche) {
  const nome = a.getName() || 'allegato';
  const mime = (a.getContentType() || '').toLowerCase();
  const dimensione = a.getSize();
  if (CONFIG.FILE_DA_IGNORARE.test(nome)) return;
  if (mime.indexOf('image/') === 0 && dimensione < CONFIG.IMMAGINE_MIN_BYTE) return;

  const bytes = a.getBytes();
  const hash = sha256_(bytes);
  if (sb_('documenti?select=id&hash_sha256=eq.' + hash).length) return { tipo: 'duplicato' };

  const meta = {
    oggetto: m.getSubject() || '',
    mittente: m.getFrom() || '',
    destinatari: [m.getTo(), m.getCc()].filter(Boolean).join(', '),
    data: m.getDate(),
  };

  const staging = sottocartella_(cartellaRadice_(), CONFIG.CARTELLA_STAGING);
  const file = staging.createFile(a.copyBlob().setName(nome));

  try {
    let analisi;
    let analisiContenuto = true;

    if (eClinico_(meta, nome)) {
      analisiContenuto = false;
      analisi = {
        fascicolo: 'clinico_pazienti',
        tipo_documento: 'documento clinico',
        titolo: nome.replace(/\.[^.]+$/, ''),
        riassunto: 'Documento clinico: archiviato senza analisi del contenuto.',
        tag: ['clinico'],
      };
    } else if (apiInPausa_()) {
      analisi = analisiDiRiserva_(meta, nome, mime);
      analisiContenuto = false;
    } else {
      meta.corpo = (m.getPlainBody() || '').replace(/\s+\n/g, '\n').slice(0, 2500);
      const contenuto = contenutoPerAnalisi_(bytes, mime, nome, file);
      if (!contenuto) analisiContenuto = false;
      try {
        analisi = analizza_(meta, nome, contenuto, pratiche);
      } catch (e) {
        if (e.message !== 'RIPROVA' || !apiInPausa_()) throw e;
        analisi = analisiDiRiserva_(meta, nome, mime); // limite di spesa raggiunto proprio ora
        analisiContenuto = false;
      }
    }

    const fasc = FASCICOLI[analisi.fascicolo] ? analisi.fascicolo : 'altro';
    const dataRif = dataValida_(analisi.data_documento) ||
      Utilities.formatDate(meta.data, CONFIG.FUSO, 'yyyy-MM-dd');
    // Originale su Drive: Archivio personale/<Categoria>/<anno> (POL-VITA-013)
    const percorso = percorsoDrive_({ fascicolo: fasc, data_documento: dataValida_(analisi.data_documento),
      email_data: meta.data.toISOString() }, []);
    const estensione = (nome.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    file.setName(dataRif + '_' + pulisciNome_(analisi.titolo || nome.replace(/\.[^.]+$/, '')) + estensione);
    file.moveTo(cartellaDaPercorso_(percorso));

    const esito = sb_('rpc/registra_documento', {
      method: 'post',
      body: {
        p: {
          hash_sha256: hash,
          gmail_message_id: m.getId(),
          gmail_thread_id: m.getThread().getId(),
          email_oggetto: meta.oggetto,
          email_mittente: meta.mittente,
          email_data: meta.data.toISOString(),
          nome_file_originale: nome,
          mime_type: mime,
          dimensione_byte: dimensione,
          drive_file_id: file.getId(),
          drive_url: file.getUrl(),
          fascicolo: fasc,
          tipo_documento: analisi.tipo_documento || null,
          titolo: analisi.titolo || nome,
          riassunto: analisi.riassunto || null,
          data_documento: dataValida_(analisi.data_documento),
          importo: typeof analisi.importo === 'number' ? analisi.importo : null,
          tag: Array.isArray(analisi.tag) ? analisi.tag.slice(0, 8) : [],
          azione_richiesta: analisi.azione_richiesta === true,
          azione_descrizione: analisi.azione_descrizione || null,
          urgenza: analisi.urgenza || null,
          analisi_contenuto: analisiContenuto,
          dati_estratti: analisi.dati && typeof analisi.dati === 'object' ? analisi.dati : {},
          soggetti: Array.isArray(analisi.soggetti) ? analisi.soggetti : [],
          scadenze: Array.isArray(analisi.scadenze) ? analisi.scadenze : [],
          pratica: analisi.pratica || {},
        },
      },
    });

    completaCatalogo_(esito && esito.documento_id, analisi, fasc, percorso);

    // Rende subito collegabile una pratica appena creata ai documenti successivi dello stesso giro
    if (esito && esito.pratica_id && analisi.pratica && analisi.pratica.nuova_titolo &&
        !pratiche.some(function (p) { return p.id === esito.pratica_id; })) {
      pratiche.unshift({ id: esito.pratica_id, titolo: analisi.pratica.nuova_titolo });
    }
    return {
      tipo: 'importato', fascicolo: fasc, titolo: analisi.titolo || nome,
      urgente: analisi.urgenza === 'alta' && analisi.azione_richiesta === true,
      nuovaPratica: esito && !esito.esistente && analisi.pratica && analisi.pratica.nuova_titolo &&
        !(analisi.pratica.id_esistente) ? analisi.pratica.nuova_titolo : null,
    };
  } catch (e) {
    file.setTrashed(true); // niente file orfani: verrà rielaborato
    throw e;
  }
}

function eClinico_(meta, nome) {
  const indirizzi = (meta.mittente + ',' + meta.destinatari).toLowerCase();
  const dominio = CONFIG.CLINICO_DOMINI.some(function (d) {
    return indirizzi.indexOf('@' + d) >= 0 || indirizzi.indexOf('.' + d) >= 0;
  });
  return dominio || CONFIG.CLINICO_PAROLE.test(meta.oggetto + ' ' + nome.replace(/[_.-]/g, ' '));
}

/* =====================================================================
 * LETTURA DEL CONTENUTO
 * ===================================================================*/
function contenutoPerAnalisi_(bytes, mime, nome, file) {
  const ext = ((nome.match(/\.([a-z0-9]+)$/i) || [])[1] || '').toLowerCase();

  if (mime === 'application/pdf' || ext === 'pdf') {
    if (bytes.length > CONFIG.PDF_MAX_BYTE) return null;
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Utilities.base64Encode(bytes) } };
  }

  const immagini = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  if (immagini[ext] || /^image\/(jpeg|png|gif|webp)$/.test(mime)) {
    if (bytes.length > CONFIG.IMMAGINE_MAX_BYTE) return null;
    return { type: 'image', source: { type: 'base64', media_type: immagini[ext] || mime, data: Utilities.base64Encode(bytes) } };
  }

  if (ext === 'p7m') return testo_(estraiXmlDaP7m_(bytes, false), 'Fattura elettronica (XML)');

  if (ext === 'xml' || ext === 'txt' || ext === 'csv' || mime.indexOf('text/') === 0 || /xml/.test(mime)) {
    return testo_(Utilities.newBlob(bytes).getDataAsString(), 'Contenuto del file');
  }

  if (['docx', 'doc', 'odt', 'rtf'].indexOf(ext) >= 0) return testo_(convertiInTesto_(file, 'doc'), 'Contenuto del documento');
  if (['xlsx', 'xls', 'ods'].indexOf(ext) >= 0) return testo_(convertiInTesto_(file, 'foglio'), 'Contenuto del foglio');
  return null;
}

function testo_(s, intestazione) {
  if (!s || !String(s).trim()) return null;
  return { type: 'text', text: intestazione + ':\n' + String(s).slice(0, CONFIG.TESTO_MAX_CARATTERI) };
}

// Le fatture elettroniche firmate (.p7m) contengono l'XML in chiaro dentro la busta della firma
function estraiXmlDaP7m_(bytes, giaDecodificato) {
  const s = Utilities.newBlob(bytes).getDataAsString('ISO-8859-1');
  const inizio = s.indexOf('<?xml') >= 0 ? s.indexOf('<?xml') : s.search(/<([\w]+:)?FatturaElettronica[\s>]/);
  if (inizio < 0) {
    if (giaDecodificato) return null;
    try { return estraiXmlDaP7m_(Utilities.base64Decode(s.replace(/\s/g, '')), true); } catch (e) { return null; }
  }
  const chiusure = s.match(/<\/([\w]+:)?FatturaElettronica>/g);
  const fine = chiusure ? s.lastIndexOf(chiusure[chiusure.length - 1]) + chiusure[chiusure.length - 1].length : s.length;
  return s.slice(inizio, fine).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

// Word/Excel: richiede il servizio avanzato "Drive API" attivo nel progetto
function convertiInTesto_(file, tipo) {
  if (typeof Drive === 'undefined') return null;
  let copia = null;
  try {
    copia = Drive.Files.copy(
      { name: 'tmp-conversione', mimeType: tipo === 'doc' ? MimeType.GOOGLE_DOCS : MimeType.GOOGLE_SHEETS },
      file.getId()
    );
    if (tipo === 'doc') return DocumentApp.openById(copia.id).getBody().getText();
    return SpreadsheetApp.openById(copia.id).getSheets().map(function (sh) {
      return '## ' + sh.getName() + '\n' + sh.getDataRange().getDisplayValues().slice(0, 300)
        .map(function (r) { return r.join('\t'); }).join('\n');
    }).join('\n\n');
  } catch (e) {
    console.warn('Conversione non riuscita per ' + file.getName() + ': ' + e);
    return null;
  } finally {
    if (copia) { try { DriveApp.getFileById(copia.id).setTrashed(true); } catch (e) {} }
  }
}

/* =====================================================================
 * ANALISI CON CLAUDE
 * ===================================================================*/
function analizza_(meta, nome, contenuto, pratiche) {
  const oggi = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd');
  const elencoFascicoli = Object.keys(FASCICOLI).map(function (k) { return k + ' = ' + FASCICOLI[k]; }).join('\n');
  const elencoPratiche = pratiche.length
    ? pratiche.slice(0, 200).map(function (p) { return p.id + ' | ' + p.titolo; }).join('\n')
    : '(nessuna)';

  const system = [
    'Sei l\'archivista personale di Luca Simondi, odontoiatra con studi a Cuneo e Neive.',
    'Ricevi un allegato email e lo catalochi. Rispondi SOLO con un oggetto JSON valido: niente testo prima o dopo, niente backtick.',
    'Data di oggi: ' + oggi + '.',
    '',
    'Fascicoli ammessi (usa il codice a sinistra):',
    elencoFascicoli,
    '',
    'Schema della risposta:',
    '{',
    '  "fascicolo": "codice",',
    '  "tipo_documento": "fattura | ricevuta | estratto conto | contratto | diffida | sollecito | avviso di pagamento | visura | atto | documento di identità | certificato | comunicazione | preventivo | polizza | altro",',
    '  "titolo": "max 80 caratteri, specifico: tipo + soggetto + riferimento (es. \\"Fattura Fornitore Luce n. 12345 - via Roma 1\\")",',
    '  "riassunto": "2-4 frasi: cosa è, chi è coinvolto, importi, cosa comporta per Luca",',
    '  "data_documento": "YYYY-MM-DD oppure null",',
    '  "importo": numero (totale da pagare o incassare) oppure null,',
    '  "soggetti": [{"nome": "...", "tipo": "persona|azienda|ente|professionista|banca|altro", "ruolo": "es. creditore, fornitore, intestatario, avvocato"}],',
    '  "scadenze": [{"data": "YYYY-MM-DD", "descrizione": "...", "importo": numero o null}],',
    '  "azione_richiesta": true/false,',
    '  "azione_descrizione": "cosa deve fare Luca, oppure null",',
    '  "urgenza": "bassa | media | alta",',
    '  "pratica": {"id_esistente": "uuid dall\'elenco oppure null", "nuova_titolo": "titolo oppure null"},',
    '  "tag": ["max 6 parole chiave minuscole"],',
    '  "ente": "chi ha emesso o riguarda il documento, nome breve e sempre uguale (es. \\"Enel Energia\\", \\"Agenzia delle Entrate\\", \\"Intesa Sanpaolo\\", \\"Comune di Cuneo\\"), oppure null",',
    '  "rilevanza": "alta | normale | bassa",',
    '  "dati": [{"campo": "nome del campo", "valore": "valore"}] con i campi utili estratti: numero documento, codice cliente, POD/PDR, IBAN del beneficiario, foglio/particella catastale, numero e scadenza del documento d\'identità, partita IVA, protocollo, ecc.',
    '}',
    '',
    'Regole:',
    '- Non inventare: usa solo dati presenti nel documento o nell\'email.',
    '- Pratica = vicenda. Raggruppa nella stessa pratica tutti i documenti della stessa vicenda: stesso soggetto (fornitore, ente, banca, professionista) e stesso oggetto (utenza, contratto, immobile, conto, procedimento, persona). Esempio: fatture, solleciti, preavvisi di sospensione e lettere di recupero crediti della stessa utenza vanno tutti in "Fornitore luce – via Roma 1".',
    '- Se nell\'elenco esiste già una pratica per quella vicenda usa il suo id_esistente; altrimenti crea nuova_titolo nel formato "Soggetto – oggetto" (es. "Ente previdenziale – quota annuale", "Fornitore – contratto di fornitura", "Successione – <nome>", "Catasto – immobile <comune>").',
    '- Metti entrambi i campi della pratica a null solo per documenti isolati senza vicenda (scontrini, newsletter, ricevute una tantum).',
    '- Urgenza alta: diffide, atti legali, preavvisi di sospensione, recupero crediti, scadenze entro 7 giorni da oggi.',
    '- Se il documento è più vecchio di 12 mesi, azione_richiesta è true solo se il contenuto indica una questione rimasta aperta.',
    '- Scadenze: solo date reali presenti nel documento (pagamenti, rinnovi, termini legali, scadenza di documenti d\'identità).',
    '- Pubblicità, volantini, listini, newsletter, offerte commerciali non richieste: fascicolo "pubblicita", rilevanza bassa.',
    '- Corsi ECM, congressi, materiale didattico, tesi e articoli scientifici: fascicolo "formazione".',
    '- Curriculum, candidature e documenti del personale dello studio: fascicolo "personale_studio".',
    '- Foto e video personali senza valore di documento: fascicolo "foto_video", rilevanza bassa.',
    '- Email personali, auguri, catene, presentazioni inoltrate: fascicolo "corrispondenza", rilevanza bassa.',
    '- "altro" solo se nessun fascicolo va bene.',
    '- Rilevanza alta: documenti d\'identità, contratti, atti, rogiti, polizze, diffide, avvisi fiscali, certificati, estratti conto, tutto ciò che va conservato. Bassa: pubblicità, foto, catene, file senza contenuto utile. Il resto normale.',
    '- Titolo nel formato "Tipo – Ente – riferimento" (es. "Fattura – Enel Energia – settembre 2024, via Roma 1").',
    '- Combustibili per il riscaldamento (pellet, legna, gasolio, GPL, cippato) e manutenzione di caldaie e stufe: fascicolo "riscaldamento". Le bollette di luce, gas di rete e acqua restano in "utenze".',
    '- Scrivi in italiano.',
  ].join('\n');

  const intestazione = [
    'EMAIL',
    'Oggetto: ' + meta.oggetto,
    'Da: ' + meta.mittente,
    'A: ' + meta.destinatari,
    'Data: ' + Utilities.formatDate(meta.data, CONFIG.FUSO, 'yyyy-MM-dd HH:mm'),
    'Nome file allegato: ' + nome,
    '',
    'Testo dell\'email (estratto):',
    meta.corpo || '(vuoto)',
    '',
    'Pratiche aperte esistenti (id | titolo):',
    elencoPratiche,
    contenuto ? '' : '\nNota: il contenuto del file non è leggibile; cataloga in base a email e nome file.',
  ].join('\n');

  const blocchi = contenuto ? [contenuto, { type: 'text', text: intestazione }] : [{ type: 'text', text: intestazione }];
  const analisi = parseJson_(modello_(system, blocchi, SCHEMA_ANALISI));
  // "dati" arriva come elenco campo/valore (lo schema vincolato non ammette chiavi libere)
  if (Array.isArray(analisi.dati)) {
    const dati = {};
    analisi.dati.forEach(function (d) { if (d && d.campo) dati[String(d.campo)] = d.valore; });
    analisi.dati = dati;
  }
  return analisi;
}

// Schema vincolato della risposta: Claude non può restituire JSON malformato.
const NULLABILE_ = function (tipo) { return { type: [tipo, 'null'] }; };
const SCHEMA_ANALISI = {
  type: 'object',
  additionalProperties: false,
  required: ['fascicolo', 'tipo_documento', 'titolo', 'riassunto', 'data_documento', 'importo', 'soggetti',
    'scadenze', 'azione_richiesta', 'azione_descrizione', 'urgenza', 'pratica', 'tag', 'dati', 'ente', 'rilevanza'],
  properties: {
    fascicolo: { type: 'string' },
    tipo_documento: { type: 'string' },
    titolo: { type: 'string' },
    riassunto: { type: 'string' },
    data_documento: NULLABILE_('string'),
    importo: NULLABILE_('number'),
    soggetti: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'tipo', 'ruolo'],
      properties: { nome: { type: 'string' }, tipo: { type: 'string' }, ruolo: NULLABILE_('string') } } },
    scadenze: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['data', 'descrizione', 'importo'],
      properties: { data: { type: 'string' }, descrizione: { type: 'string' }, importo: NULLABILE_('number') } } },
    azione_richiesta: { type: 'boolean' },
    azione_descrizione: NULLABILE_('string'),
    urgenza: { type: 'string', enum: ['bassa', 'media', 'alta'] },
    pratica: { type: 'object', additionalProperties: false, required: ['id_esistente', 'nuova_titolo'],
      properties: { id_esistente: NULLABILE_('string'), nuova_titolo: NULLABILE_('string') } },
    tag: { type: 'array', items: { type: 'string' } },
    ente: NULLABILE_('string'),
    rilevanza: { type: 'string', enum: RILEVANZE },
    dati: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['campo', 'valore'],
      properties: { campo: { type: 'string' }, valore: { type: 'string' } } } },
  },
};

function claude_(system, content, schema) {
  const p = props_();
  const body = { model: CONFIG.MODELLO, max_tokens: 4000, system: system, messages: [{ role: 'user', content: content }] };
  if (schema) body.output_config = { format: { type: 'json_schema', schema: schema } };
  for (let tentativo = 1; tentativo <= 4; tentativo++) {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': p.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code === 200) {
      const risposta = JSON.parse(res.getContentText());
      if (risposta.stop_reason === 'max_tokens') throw new Error('Risposta di Claude troncata (max_tokens)');
      return risposta.content
        .filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text; }).join('');
    }
    // Se il modello non accetta lo schema vincolato, si riprova senza (vale il parsing tollerante)
    if (code === 400 && body.output_config && /output_config|json_schema|schema/i.test(res.getContentText())) {
      console.warn('Schema non accettato, riprovo senza: ' + res.getContentText().slice(0, 300));
      delete body.output_config;
      continue;
    }
    if (code === 429 || code >= 500) { Utilities.sleep(tentativo * 8000); continue; }
    // Limite di spesa o credito esaurito: non è colpa dell'email. Pausa e si riprova più tardi,
    // senza segnare il thread come errore (prima finivano in Archivio/Errore a centinaia).
    if (LIMITE_API.test(res.getContentText())) { pausaApi_(res.getContentText()); throw new Error('RIPROVA'); }
    throw new Error('API Claude ' + code + ': ' + res.getContentText().slice(0, 500));
  }
  throw new Error('RIPROVA'); // API sovraccarica: si riprova al giro successivo
}

const LIMITE_API = /usage limits|credit balance|spend limit|billing/i;
const PAUSA_API_MS = 60 * 60 * 1000;
function pausaApi_(testo) {
  const sp = PropertiesService.getScriptProperties();
  const gia = Number(sp.getProperty('API_PAUSA_FINO') || 0) > Date.now();
  sp.setProperty('API_PAUSA_FINO', String(Date.now() + PAUSA_API_MS));
  if (!gia) logErrore_('API Claude in pausa (limite di spesa)', new Error(String(testo).slice(0, 300)));
}
function claudeInPausa_() {
  return Number(PropertiesService.getScriptProperties().getProperty('API_PAUSA_FINO') || 0) > Date.now();
}
// Nessun modello disponibile: né Claude né Gemini. Solo allora si cataloga a regole.
function apiInPausa_() {
  return claudeInPausa_() && !geminiDisponibile_();
}

/* =====================================================================
 * GEMINI DI RISERVA (PO 2026-10-18: "Ma se usassimo Gemini per analizzarli?", piano gratuito
 * scelto da Luca). Analisi dei documenti con lo stesso prompt e lo stesso JSON di Claude; con Claude
 * in pausa anche chat, sintesi delle cartelle, bozze e cartelle suggerite (testoAI_). I documenti dei pazienti non arrivano mai qui: i chiamanti
 * di analizza_() li escludono prima (eClinico_ e fascicolo clinico_pazienti).
 * ===================================================================*/
const GEMINI_INTERVALLO_MS = 5000;               // piano gratuito: al massimo ~12 richieste al minuto
const GEMINI_PAUSA_MS = 3 * 60 * 60 * 1000;      // quota del giorno finita o chiave rifiutata
let GEMINI_ULTIMA = 0;

function geminiDisponibile_() {
  const sp = PropertiesService.getScriptProperties();
  return Boolean(sp.getProperty('GEMINI_API_KEY')) && Number(sp.getProperty('GEMINI_PAUSA_FINO') || 0) <= Date.now();
}

function pausaGemini_(testo) {
  const sp = PropertiesService.getScriptProperties();
  sp.setProperty('GEMINI_PAUSA_FINO', String(Date.now() + GEMINI_PAUSA_MS));
  logErrore_('Gemini in pausa per 3 ore', new Error(String(testo).slice(0, 300)));
}

// Claude se disponibile, altrimenti Gemini; anche quando Claude va in pausa proprio ora.
function modello_(system, content, schema) {
  if (!claudeInPausa_()) {
    try { return claude_(system, content, schema); } catch (e) {
      if (e.message !== 'RIPROVA' || !claudeInPausa_() || !geminiDisponibile_()) throw e;
    }
  }
  if (!geminiDisponibile_()) throw new Error('RIPROVA');
  return gemini_(system, content);
}

// Blocchi in formato Claude (testo, PDF, immagine) → parti di Gemini.
function partiGemini_(content) {
  return content.map(function (b) {
    if (b.type === 'text') return { text: b.text };
    if (b.source && b.source.type === 'base64') return { inline_data: { mime_type: b.source.media_type, data: b.source.data } };
    return null;
  }).filter(Boolean);
}

function gemini_(system, content) {
  const c = geminiChiamata_({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: partiGemini_(content) }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8192 },
  });
  return (c.content.parts || []).filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('');
}

// Una richiesta a Gemini → il primo candidato (con content). Gestisce quote, chiave e ritentativi.
function geminiChiamata_(body) {
  const sp = PropertiesService.getScriptProperties();
  const modello = sp.getProperty('GEMINI_MODELLO') || CONFIG.MODELLO_GEMINI;
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modello) + ':generateContent';
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    const attesa = GEMINI_ULTIMA + GEMINI_INTERVALLO_MS - Date.now();
    if (attesa > 0) Utilities.sleep(attesa);
    GEMINI_ULTIMA = Date.now();
    const res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': sp.getProperty('GEMINI_API_KEY') }, payload: JSON.stringify(body),
    });
    const code = res.getResponseCode();
    const testo = res.getContentText();
    if (code === 200) {
      const r = JSON.parse(testo);
      const c = (r.candidates || [])[0];
      if (!c || !c.content) throw new Error('Gemini non ha risposto (' + ((r.promptFeedback || {}).blockReason || (c && c.finishReason) || 'motivo sconosciuto') + ')');
      if (c.finishReason === 'MAX_TOKENS') throw new Error('Risposta di Gemini troncata (max tokens)');
      return c;
    }
    // Quota del giorno finita (piano gratuito) o chiave non valida: Gemini in pausa, si cataloga a regole.
    if ((code === 429 && /PerDay|per day|daily/i.test(testo)) || code === 401 || code === 403 || /API_KEY_INVALID|API key not valid/i.test(testo)) {
      pausaGemini_(testo);
      throw new Error('RIPROVA');
    }
    if (code === 429) { Utilities.sleep(tentativo * 20000); continue; }   // troppe richieste al minuto
    if (code >= 500) { Utilities.sleep(tentativo * 8000); continue; }
    throw new Error('API Gemini ' + code + ': ' + testo.slice(0, 500));
  }
  throw new Error('RIPROVA');
}

function parseJson_(testo) {
  const pulito = String(testo).replace(/```json|```/g, '').trim();
  const a = pulito.indexOf('{'), b = pulito.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Risposta non in JSON: ' + pulito.slice(0, 300));
  return JSON.parse(pulito.slice(a, b + 1));
}

/* =====================================================================
 * RIEPILOGO GIORNALIERO
 * ===================================================================*/
/* Notifiche sul telefono (POL-VITA-018): la funzione Supabase `notifiche-personal` manda i promemoria
 * di oggi ai telefoni iscritti, una volta al giorno per promemoria (chiamarla più volte non crea
 * doppioni). Qui la si chiama alle 7 col riepilogo e poi, per i promemoria aggiunti in giornata,
 * al massimo una volta l'ora tra le 8 e le 21. */
function inviaNotifiche_(subito) {
  try {
    const sp = PropertiesService.getScriptProperties();
    const ora = Number(Utilities.formatDate(new Date(), CONFIG.FUSO, 'H'));
    if (!subito) {
      if (ora < 8 || ora > 21) return;
      if (Date.now() - Number(sp.getProperty('NOTIFICHE_ULTIMA') || 0) < 55 * 60 * 1000) return;
    }
    sp.setProperty('NOTIFICHE_ULTIMA', String(Date.now()));
    const res = UrlFetchApp.fetch(props_().SUPABASE_URL + '/functions/v1/notifiche-personal', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ azione: 'invia' }), muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) logErrore_('notifiche', new Error(res.getResponseCode() + ' ' + res.getContentText().slice(0, 300)));
  } catch (e) { logErrore_('notifiche', e); }
}

function digest() {
  inviaNotifiche_(true);
  const p = props_();
  const oggi = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd');
  const limite = Utilities.formatDate(new Date(Date.now() + CONFIG.GIORNI_DIGEST * 864e5), CONFIG.FUSO, 'yyyy-MM-dd');
  const da90 = Utilities.formatDate(new Date(Date.now() - 90 * 864e5), CONFIG.FUSO, 'yyyy-MM-dd');
  const ieri = new Date(Date.now() - 864e5).toISOString();
  const da30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const scadenze = sb_('scadenze?select=data,descrizione,importo,documenti(titolo,drive_url)' +
    '&completata=eq.false&data=gte.' + da90 + '&data=lte.' + limite + '&order=data.asc&limit=40');
  const urgenti = sb_('pratiche?select=titolo,aggiornata_il&stato=in.(aperta,in_corso)&urgenza=eq.alta&order=aggiornata_il.desc&limit=20');
  const nuovi = sb_('documenti?select=titolo,azione_descrizione,urgenza,drive_url' +
    '&azione_richiesta=eq.true&creato_il=gte.' + encodeURIComponent(ieri) +
    '&email_data=gte.' + encodeURIComponent(da30) + '&order=email_data.desc&limit=30');

  if (!scadenze.length && !urgenti.length && !nuovi.length) return;

  const e = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const euro = function (n) { return n == null ? '' : ' — € ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2 }); };
  let html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#17232E;max-width:640px">';

  if (urgenti.length) {
    html += '<h3 style="color:#A4262C;margin-bottom:6px">Pratiche urgenti</h3><ul>' +
      urgenti.map(function (x) { return '<li>' + e(x.titolo) + '</li>'; }).join('') + '</ul>';
  }
  if (scadenze.length) {
    html += '<h3 style="margin-bottom:6px">Scadenze</h3><ul>' + scadenze.map(function (s) {
      const scaduta = s.data < oggi;
      const doc = s.documenti ? ' (<a href="' + e(s.documenti.drive_url) + '">' + e(s.documenti.titolo) + '</a>)' : '';
      return '<li' + (scaduta ? ' style="color:#A4262C"' : '') + '><b>' + e(s.data) + (scaduta ? ' scaduta' : '') + '</b>: ' +
        e(s.descrizione) + e(euro(s.importo)) + doc + '</li>';
    }).join('') + '</ul>';
  }
  if (nuovi.length) {
    html += '<h3 style="margin-bottom:6px">Nuovi documenti da gestire</h3><ul>' + nuovi.map(function (d) {
      return '<li><a href="' + e(d.drive_url) + '">' + e(d.titolo) + '</a>' +
        (d.azione_descrizione ? ': ' + e(d.azione_descrizione) : '') + '</li>';
    }).join('') + '</ul>';
  }
  if (p.DASHBOARD_URL) html += '<p><a href="' + e(p.DASHBOARD_URL) + '">Apri la dashboard</a></p>';
  html += '</div>';

  const totale = urgenti.length + scadenze.length + nuovi.length;
  GmailApp.sendEmail(
    p.EMAIL_DIGEST || Session.getEffectiveUser().getEmail(),
    'Archivio: ' + totale + (totale === 1 ? ' cosa da guardare' : ' cose da guardare'),
    'Apri questa email in formato HTML per il riepilogo.',
    { htmlBody: html, name: 'Archivio Documenti' }
  );
}

/* =====================================================================
 * SUPPORTO
 * ===================================================================*/
let PROPS_CACHE = null;
function props_() {
  if (PROPS_CACHE) return PROPS_CACHE;
  const p = PropertiesService.getScriptProperties().getProperties();
  ['SUPABASE_URL', 'SUPABASE_KEY', 'ANTHROPIC_API_KEY'].forEach(function (k) {
    if (!p[k]) throw new Error('Manca la proprietà ' + k + ' (Impostazioni progetto > Proprietà script)');
  });
  p.SUPABASE_URL = p.SUPABASE_URL.replace(/\/+$/, '');
  PROPS_CACHE = p;
  return p;
}

function sb_(percorso, opzioni) {
  opzioni = opzioni || {};
  const p = props_();
  const headers = { apikey: p.SUPABASE_KEY };
  if (/^eyJ/.test(p.SUPABASE_KEY)) headers.Authorization = 'Bearer ' + p.SUPABASE_KEY; // chiavi legacy JWT
  if (opzioni.prefer) headers.Prefer = opzioni.prefer;
  const richiesta = { method: opzioni.method || 'get', contentType: 'application/json', headers: headers, muteHttpExceptions: true };
  if (opzioni.body) richiesta.payload = JSON.stringify(opzioni.body);
  const res = UrlFetchApp.fetch(p.SUPABASE_URL + '/rest/v1/' + percorso, richiesta);
  const code = res.getResponseCode();
  const txt = res.getContentText();
  if (code >= 300) throw new Error('Supabase ' + code + ' su ' + percorso.split('?')[0] + ': ' + txt.slice(0, 400));
  return txt ? JSON.parse(txt) : null;
}

function praticheAperte_() {
  return sb_('pratiche?select=id,titolo&stato=neq.archiviata&order=aggiornata_il.desc&limit=200');
}

function logErrore_(riferimento, e) {
  try { sb_('log_elaborazione', { method: 'post', body: { riferimento: riferimento, errore: String(e.stack || e).slice(0, 2000) } }); } catch (x) {}
}

function etichetta_(nome) { return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome); }
function etichettaQuery_(nome) { return nome.replace(/[\/ ]/g, '-').toLowerCase(); }

const CARTELLE_CACHE = {};
function cartellaRadice_() {
  if (CARTELLE_CACHE.__radice) return CARTELLE_CACHE.__radice;
  const sp = PropertiesService.getScriptProperties();
  const id = sp.getProperty('DRIVE_ROOT_ID');
  let f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) { f = DriveApp.createFolder(CONFIG.CARTELLA_RADICE); sp.setProperty('DRIVE_ROOT_ID', f.getId()); }
  CARTELLE_CACHE.__radice = f;
  return f;
}
function sottocartella_(padre, nome) {
  const chiave = padre.getId() + '/' + nome;
  if (CARTELLE_CACHE[chiave]) return CARTELLE_CACHE[chiave];
  const it = padre.getFoldersByName(nome);
  const f = it.hasNext() ? it.next() : padre.createFolder(nome);
  CARTELLE_CACHE[chiave] = f;
  return f;
}

function sha256_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function dataValida_(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
function pulisciNome_(s) { return String(s).replace(/[\\\/:*?"<>|\r\n]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120); }

/* =====================================================================
 * CARICAMENTO DALL'APP (Poliedron Personal)
 * Web app: esegui come proprietario, accesso "Chiunque". L'identità non viene dal
 * link ma dal token di sessione Supabase dell'app, verificato a ogni richiesta:
 * passa solo il proprietario dell'archivio con email confermata.
 * Il file va su Drive in "Archivio personale/Caricati" e viene catalogato come gli
 * allegati Gmail; i documenti clinici non vengono mai inviati all'analisi.
 * ===================================================================*/
const CARTELLA_CARICATI = 'Caricati';
const PROPRIETARIO = 'luca.simondi@gmail.com';

function doPost(e) {
  let file = null;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const utente = utenteSupabase_(req.token);
    if (!utente || String(utente.email).toLowerCase() !== PROPRIETARIO || !utente.email_confirmed_at) {
      return rispostaJson_({ ok: false, errore: 'Accesso non autorizzato' });
    }
    if (req.azione === 'file') return rispostaJson_(fileDelDocumento_(req.drive_file_id));
    if (req.azione === 'chiedi') return rispostaJson_(chiediPoliedron_(req));
    if (req.azione === 'miniature') return rispostaJson_(miniature_(req.ids));
    if (req.azione === 'cestina') return rispostaJson_(cestinaFile_(req.ids));
    if (req.azione === 'cestina_email') return rispostaJson_(cestinaEmail_(req.ids));
    if (req.azione === 'cartella') return rispostaJson_(analizzaCartella_(req));
    if (req.azione === 'bozza') return rispostaJson_(bozzaRisposta_(req));
    if (req.azione === 'suggerisci') return rispostaJson_(suggerisciCartelle_());
    if (!req.dati || !req.nome) return rispostaJson_({ ok: false, errore: 'File mancante' });

    const nome = pulisciNome_(String(req.nome)) || 'documento';
    const mime = String(req.mime || 'application/octet-stream').toLowerCase();
    const bytes = Utilities.base64Decode(req.dati);
    const hash = sha256_(bytes);
    const esistente = sb_('documenti?select=id,titolo&hash_sha256=eq.' + hash);
    if (esistente.length) return rispostaJson_({ ok: true, duplicato: true, id: esistente[0].id, titolo: esistente[0].titolo });

    const ora = new Date();
    const cartella = sottocartella_(sottocartella_(cartellaRadice_(), CARTELLA_CARICATI),
      Utilities.formatDate(ora, CONFIG.FUSO, 'yyyy'));
    file = cartella.createFile(Utilities.newBlob(bytes, mime, nome));

    const meta = { oggetto: String(req.descrizione || ''), mittente: PROPRIETARIO, destinatari: '', data: ora,
      corpo: 'Documento caricato da Luca dall\'app.' + (req.descrizione ? ' Descrizione: ' + req.descrizione : '') };
    let analisi, analisiContenuto = true;
    const clinico = req.fascicolo === 'clinico_pazienti' || eClinico_(meta, nome);
    if (req.nonAnalizzare || clinico) {
      analisiContenuto = false;
      analisi = { fascicolo: clinico ? 'clinico_pazienti' : (req.fascicolo || 'altro'),
        titolo: req.descrizione || nome.replace(/\.[^.]+$/, ''), tag: [] };
    } else if (apiInPausa_()) {
      analisiContenuto = false;
      analisi = analisiDiRiserva_(meta, nome, mime);
    } else {
      const contenuto = contenutoPerAnalisi_(bytes, mime, nome, file);
      if (!contenuto) analisiContenuto = false;
      try {
        analisi = analizza_(meta, nome, contenuto, praticheAperte_());
      } catch (e) {
        if (e.message !== 'RIPROVA' || !apiInPausa_()) throw e;
        analisiContenuto = false;
        analisi = analisiDiRiserva_(meta, nome, mime);
      }
    }
    if (analisi.riserva && req.descrizione) analisi.titolo = String(req.descrizione).slice(0, 120);
    // La scelta di Luca nell'app vale più della classificazione automatica (mai per i clinici)
    if (req.fascicolo && FASCICOLI[req.fascicolo] && analisi.fascicolo !== 'clinico_pazienti') analisi.fascicolo = req.fascicolo;
    const fasc = FASCICOLI[analisi.fascicolo] ? analisi.fascicolo : 'altro';
    const tag = (Array.isArray(analisi.tag) ? analisi.tag.slice(0, 7) : []).concat(req.portafoglio ? ['portafoglio'] : []);
    const estensione = (nome.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    file.setName((dataValida_(analisi.data_documento) || Utilities.formatDate(ora, CONFIG.FUSO, 'yyyy-MM-dd')) + '_' +
      pulisciNome_(analisi.titolo || nome.replace(/\.[^.]+$/, '')) + estensione);

    const esito = sb_('rpc/registra_documento', { method: 'post', body: { p: {
      hash_sha256: hash, gmail_message_id: 'caricato:' + Utilities.getUuid(), gmail_thread_id: null,
      email_oggetto: req.descrizione || null, email_mittente: 'Caricato dall\'app', email_data: ora.toISOString(),
      nome_file_originale: nome, mime_type: mime, dimensione_byte: bytes.length,
      drive_file_id: file.getId(), drive_url: file.getUrl(), fascicolo: fasc,
      tipo_documento: analisi.tipo_documento || null, titolo: analisi.titolo || nome,
      riassunto: analisi.riassunto || null, data_documento: dataValida_(analisi.data_documento),
      importo: typeof analisi.importo === 'number' ? analisi.importo : null, tag: tag,
      azione_richiesta: analisi.azione_richiesta === true, azione_descrizione: analisi.azione_descrizione || null,
      urgenza: analisi.urgenza || null, analisi_contenuto: analisiContenuto,
      dati_estratti: analisi.dati && typeof analisi.dati === 'object' ? analisi.dati : {},
      soggetti: Array.isArray(analisi.soggetti) ? analisi.soggetti : [],
      scadenze: Array.isArray(analisi.scadenze) ? analisi.scadenze : [], pratica: analisi.pratica || {},
    } } });
    const idDoc = esito && esito.documento_id;
    completaCatalogo_(idDoc, analisi, fasc);
    // Persona e categoria scelte da Luca (documenti personali: carta d'identità, codice fiscale, ...)
    if (idDoc && (req.persona || req.categoria)) {
      sb_('documenti?id=eq.' + idDoc, { method: 'patch', body: {
        persona: req.persona ? String(req.persona).slice(0, 120) : null,
        categoria: req.categoria ? String(req.categoria).slice(0, 60) : null,
      } });
    }
    return rispostaJson_({ ok: true, id: idDoc, titolo: analisi.titolo || nome, fascicolo: fasc });
  } catch (err) {
    if (file) { try { file.setTrashed(true); } catch (x) {} } // niente file orfani se la registrazione fallisce
    logErrore_('caricamento app', err);
    return rispostaJson_({ ok: false, errore: String(err && err.message || err).slice(0, 300) });
  }
}

// Anteprima nell'app: solo file registrati nell'archivio (mai un file Drive qualsiasi).
const ANTEPRIMA_MAX_BYTE = 15 * 1024 * 1024;
function fileDelDocumento_(driveFileId) {
  const id = String(driveFileId || '');
  if (!/^[\w-]{10,}$/.test(id)) return { ok: false, errore: 'File non valido' };
  if (!sb_('documenti?select=id&drive_file_id=eq.' + encodeURIComponent(id) + '&limit=1').length) {
    return { ok: false, errore: 'File non presente in archivio' };
  }
  const blob = DriveApp.getFileById(id).getBlob();
  const bytes = blob.getBytes();
  if (bytes.length > ANTEPRIMA_MAX_BYTE) return { ok: false, errore: 'File troppo grande per l\'anteprima' };
  return { ok: true, nome: blob.getName(), mime: blob.getContentType(), dati: Utilities.base64Encode(bytes) };
}

// Miniature per gli elenchi dell'app: solo file registrati in archivio, mai dei pazienti.
const MINIATURE_MAX = 12;
function miniature_(ids) {
  const richiesti = (Array.isArray(ids) ? ids : []).map(String).filter(function (id) { return /^[\w-]{10,}$/.test(id); }).slice(0, MINIATURE_MAX);
  if (!richiesti.length) return { ok: true, miniature: {} };
  const ammessi = sb_('documenti?select=drive_file_id&fascicolo=neq.clinico_pazienti&drive_file_id=in.(' + richiesti.map(enc_).join(',') + ')')
    .map(function (d) { return d.drive_file_id; });
  const out = {};
  ammessi.forEach(function (id) {
    try {
      const t = DriveApp.getFileById(id).getThumbnail();
      out[id] = t ? 'data:' + (t.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(t.getBytes()) : null;
    } catch (e) { out[id] = null; }
  });
  return { ok: true, miniature: out };
}

// Eliminazione anche da Drive, scelta da Luca nell'app (decisione PO 2026-10-16): i file vanno nel
// Cestino di Drive (recuperabili per 30 giorni) e solo se registrati in archivio. Si chiama PRIMA di
// togliere i documenti dall'archivio, così la verifica sull'archivio è ancora possibile.
const CESTINA_MAX = 50;
function cestinaFile_(ids) {
  const richiesti = (Array.isArray(ids) ? ids : []).map(String).filter(function (id) { return /^[\w-]{10,}$/.test(id); }).slice(0, CESTINA_MAX);
  if (!richiesti.length) return { ok: true, cestinati: [], non_trovati: [] };
  const registrati = sb_('documenti?select=drive_file_id&drive_file_id=in.(' + richiesti.map(enc_).join(',') + ')')
    .map(function (d) { return d.drive_file_id; });
  const cestinati = [];
  const nonTrovati = [];
  richiesti.forEach(function (id) {
    if (registrati.indexOf(id) < 0) { nonTrovati.push(id); return; }
    try { DriveApp.getFileById(id).setTrashed(true); cestinati.push(id); } catch (e) { nonTrovati.push(id); }
  });
  return { ok: true, cestinati: cestinati, non_trovati: nonTrovati };
}

// Pulizia in massa (PO 2026-10-18, conferma esplicita di Luca: "Cestino Gmail"): le email da cui
// arrivano i documenti che Luca elimina vanno nel Cestino di Gmail (recuperabili per 30 giorni), solo
// se TUTTI i documenti archiviati da quell'email sono tra quelli eliminati. Mai i caricati dall'app.
// Si chiama PRIMA di togliere i documenti dall'archivio, come cestinaFile_.
const CESTINA_EMAIL_MAX = 100;
function cestinaEmail_(ids) {
  const richiesti = (Array.isArray(ids) ? ids : []).map(String).filter(function (id) { return /^[0-9a-f-]{36}$/i.test(id); }).slice(0, CESTINA_EMAIL_MAX);
  if (!richiesti.length) return { ok: true, cestinate: 0, tenute: 0 };
  const docs = sb_('documenti?select=id,gmail_message_id&id=in.(' + richiesti.join(',') + ')');
  const messaggi = {};
  docs.forEach(function (d) {
    const m = String(d.gmail_message_id || '');
    if (m && m.indexOf('caricato:') !== 0) messaggi[m] = true;
  });
  let cestinate = 0, tenute = 0;
  Object.keys(messaggi).forEach(function (m) {
    const tutti = sb_('documenti?select=id&gmail_message_id=eq.' + enc_(m));
    if (tutti.some(function (d) { return richiesti.indexOf(d.id) < 0; })) { tenute++; return; } // altri allegati utili
    try { GmailApp.getMessageById(m).moveToTrash(); cestinate++; } catch (e) { tenute++; }
  });
  return { ok: true, cestinate: cestinate, tenute: tenute };
}

/* =====================================================================
 * CATALOGO MIGLIORE (POL-VITA-007)
 * Ogni documento ha un ente (chi lo ha emesso o chi riguarda) e una rilevanza: le cose poco utili
 * (pubblicità, foto, catene) si nascondono nell'app. Il riordino rilegge SOLO i dati già in
 * archivio (titolo, riassunto, mittente, oggetto, nome del file), mai i file, e mai i documenti
 * clinici dei pazienti. Conserva titolo e fascicolo di prima in titolo_originale e
 * fascicolo_originale. Gira a piccoli lotti in coda a "elabora", quando avanza tempo.
 * ===================================================================*/
const RIORDINO_LOTTO = 30;

function completaCatalogo_(idDoc, analisi, fasc, percorso) {
  if (!idDoc || !analisi) return;
  const corpo = {
    ente: analisi.ente ? String(analisi.ente).slice(0, 120) : null,
    rilevanza: fasc === 'clinico_pazienti' ? 'alta' : (RILEVANZE.indexOf(analisi.rilevanza) >= 0 ? analisi.rilevanza : 'normale'),
    riordinato_il: new Date().toISOString(),
  };
  // Catalogo provvisorio (senza Claude): l'analisi completa arriverà con analizzaRimasti_.
  if (analisi.riserva) corpo.da_analizzare = true;
  if (percorso) corpo.drive_cartella = percorso;
  try {
    sb_('documenti?id=eq.' + idDoc, { method: 'patch', body: corpo });
  } catch (e) { logErrore_('catalogo ' + idDoc, e); }
}

const SCHEMA_RIORDINO = {
  type: 'object', additionalProperties: false, required: ['documenti'],
  properties: { documenti: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['id', 'fascicolo', 'tipo_documento', 'titolo', 'ente', 'rilevanza', 'tag'],
    properties: {
      id: { type: 'string' }, fascicolo: { type: 'string' }, tipo_documento: { type: 'string' }, titolo: { type: 'string' },
      ente: { type: ['string', 'null'] }, rilevanza: { type: 'string', enum: RILEVANZE }, tag: { type: 'array', items: { type: 'string' } },
    },
  } } },
};

// Un lotto di documenti da riordinare; restituisce false quando non ce ne sono più.
function riordinaLotto_() {
  const docs = sb_('documenti?select=id,fascicolo,tipo_documento,titolo,riassunto,email_mittente,email_oggetto,nome_file_originale,mime_type,data_documento,email_data,importo,tag,gmail_message_id,titolo_originale,fascicolo_originale' +
    '&riordinato_il=is.null&da_analizzare=is.false&order=email_data.desc.nullslast&limit=' + RIORDINO_LOTTO);
  if (!docs.length) return false;
  const ora = new Date().toISOString();
  // I clinici non vanno al modello: si segnano come riordinati così come sono.
  const clinici = docs.filter(function (d) { return d.fascicolo === 'clinico_pazienti'; });
  clinici.forEach(function (d) { sb_('documenti?id=eq.' + d.id, { method: 'patch', body: { riordinato_il: ora, rilevanza: 'alta' } }); });
  const daRileggere = docs.filter(function (d) { return d.fascicolo !== 'clinico_pazienti'; });
  if (!daRileggere.length) return true;

  const elencoFascicoli = Object.keys(FASCICOLI).filter(function (k) { return k !== 'clinico_pazienti'; })
    .map(function (k) { return k + ' = ' + FASCICOLI[k]; }).join('\n');
  const system = [
    'Sei l\'archivista personale di Luca Simondi, odontoiatra con studi a Cuneo e Neive. Riordini il suo archivio:',
    'per ogni documento ricevi i dati già estratti e restituisci fascicolo, tipo, titolo, ente, rilevanza e tag corretti.',
    'Fascicoli ammessi (codice = nome):', elencoFascicoli,
    'Tipi ammessi: fattura, ricevuta, scontrino, estratto conto, contratto, preventivo, offerta, polizza, atto, rogito, visura, diffida, sollecito, avviso di pagamento, F24, dichiarazione, certificato, documento di identità, referto, prescrizione, attestato, programma corso, curriculum, comunicazione, newsletter, pubblicità, foto, video, presentazione, modulo, altro.',
    'Regole:',
    '- Titolo nel formato "Tipo – Ente – riferimento" (numero, mese e anno, immobile, targa, persona), al massimo 80 caratteri, senza nomi di file.',
    '- Ente: chi ha emesso il documento o chi riguarda, nome breve e sempre scritto allo stesso modo (es. "Enel Energia", "Agenzia delle Entrate", "Comune di Cuneo", "OPT Parker Store"). null se è un privato senza importanza.',
    '- Pubblicità, volantini, listini, offerte non richieste, newsletter → "pubblicita", rilevanza bassa.',
    '- Corsi ECM, congressi, tesi, materiale scientifico → "formazione". Curriculum e candidature → "personale_studio".',
    '- Foto e video personali → "foto_video", rilevanza bassa. Email personali, auguri, catene, presentazioni inoltrate → "corrispondenza", rilevanza bassa.',
    '- Annunci immobiliari o di barche ricevuti come pubblicità → "pubblicita"; un rogito o un preventivo richiesto resta nel suo fascicolo.',
    '- Non spostare in un altro fascicolo un documento già classificato bene. "altro" solo se nessuno va bene.',
    '- Rilevanza alta: identità, contratti, atti, rogiti, polizze, diffide, fiscale, certificati, estratti conto, garanzie. Bassa: pubblicità, foto, catene, file vuoti. Il resto normale.',
    '- tag: al massimo 5 parole chiave minuscole utili per cercare.',
    '- Usa solo i dati ricevuti, non inventare. Restituisci tutti gli id ricevuti. Scrivi in italiano.',
  ].join('\n');
  const righe = daRileggere.map(function (d) {
    return JSON.stringify({ id: d.id, fascicolo: d.fascicolo, tipo: d.tipo_documento, titolo: d.titolo_originale || d.titolo,
      riassunto: String(d.riassunto || '').slice(0, 300), mittente: d.email_mittente, oggetto: d.email_oggetto,
      file: d.nome_file_originale, mime: d.mime_type, data: d.data_documento || String(d.email_data || '').slice(0, 10), importo: d.importo, tag: d.tag,
      caricato_da_luca: String(d.gmail_message_id || '').indexOf('caricato:') === 0 });
  }).join('\n');
  let risposta;
  try {
    risposta = parseJson_(claude_(system, [{ type: 'text', text: 'Documenti da riordinare (uno per riga, JSON):\n' + righe }], SCHEMA_RIORDINO));
  } catch (e) {
    if (e.message !== 'RIPROVA') logErrore_('riordino', e);
    return false; // riprova al prossimo giro
  }
  const perId = {};
  (risposta && risposta.documenti || []).forEach(function (r) { if (r && r.id) perId[r.id] = r; });
  daRileggere.forEach(function (d) {
    const r = perId[d.id];
    const corpo = { riordinato_il: ora };
    if (r) {
      const caricato = String(d.gmail_message_id || '').indexOf('caricato:') === 0;
      // Mai fuori dal clinico, mai dentro dal riordino; i caricati da Luca restano dove li ha messi.
      const fasc = FASCICOLI[r.fascicolo] && r.fascicolo !== 'clinico_pazienti' && !caricato ? r.fascicolo : d.fascicolo;
      corpo.fascicolo = fasc;
      if (d.fascicolo_originale == null) corpo.fascicolo_originale = d.fascicolo;
      if (r.titolo && String(r.titolo).trim()) {
        corpo.titolo = String(r.titolo).trim().slice(0, 120);
        if (d.titolo_originale == null) corpo.titolo_originale = d.titolo;
      }
      if (r.tipo_documento) corpo.tipo_documento = String(r.tipo_documento).slice(0, 60);
      corpo.ente = r.ente ? String(r.ente).trim().slice(0, 120) : null;
      corpo.rilevanza = RILEVANZE.indexOf(r.rilevanza) >= 0 ? r.rilevanza : 'normale';
      const tag = (Array.isArray(r.tag) ? r.tag : []).map(function (t) { return String(t).toLowerCase().slice(0, 30); }).slice(0, 5);
      const speciali = (d.tag || []).filter(function (t) { return t === 'portafoglio'; });
      corpo.tag = speciali.concat(tag.filter(function (t) { return speciali.indexOf(t) < 0; }));
    }
    try { sb_('documenti?id=eq.' + d.id, { method: 'patch', body: corpo }); } catch (e) { logErrore_('riordino ' + d.id, e); }
  });
  return true;
}

// Da eseguire a mano dall'editor per ripartire da capo (es. dopo aver cambiato le regole).
function riordinaDaCapo() {
  sb_('documenti?riordinato_il=not.is.null', { method: 'patch', body: { riordinato_il: null } });
}

/* =====================================================================
 * IMPORTAZIONE SENZA CLAUDE (POL-VITA-013)
 * Quando il limite di spesa dell'API è raggiunto l'importazione non si ferma: ogni allegato va su
 * Drive e in archivio con un catalogo provvisorio a regole (oggetto, mittente, nome del file; nulla
 * esce dallo script). I documenti restano "da_analizzare" e, quando l'API torna disponibile,
 * analizzaRimasti_ li rilegge davvero (mai i clinici) e completa il catalogo.
 * ===================================================================*/
const ANALISI_RIMASTI_MS = 90 * 1000;
const ANALISI_RIMASTI_LOTTO = 6;

// In ordine di priorità: vince la prima regola che trova una parola.
const REGOLE_RISERVA = [
  ['identita', /\b(carta d.?identit\w*|passaport\w*|patente|codice fiscale|tessera sanitaria)\b/],
  ['legale', /\b(avvocat\w*|diffida|tribunale|decreto ingiuntivo|atto di citazione|ricorso|precetto|ufficiale giudiziario)\b/],
  ['successione', /\b(successione|eredit\w*|testamento|de cuius)\b/],
  ['immobili', /\b(rogito|catast\w*|visura|condominio|locazione|affitto|compravendita|notai\w*|planimetri\w*|agibilit\w*)\b/],
  ['riscaldamento', /\b(pellet|legna|gasolio|gpl|cippato|caldai\w*|stufa|bruciatore)\b/],
  ['utenze', /\b(bollett\w*|enel|iren|hera|a2a|edison|sorgenia|eni plenitude|acquedott\w*|egea|alpi acque|servizio idrico|fornitura (gas|luce|energia))\b/],
  ['previdenza', /\b(enpam|inps|pension\w*|contribut\w* previdenzial\w*|quota a)\b/],
  ['fiscale', /\b(f24|730|modello unico|redditi|agenzia delle entrate|entrate|iva|imu|tari|tasi|cartella esattoriale|riscossione|certificazione unica|cu \d{4}|commercialist\w*)\b/],
  ['assicurazioni', /\b(polizz\w*|assicura\w*|sinistro|generali|allianz|unipol\w*|reale mutua|axa|zurich|cattolica)\b/],
  ['veicoli', /\b(bollo auto|libretto di circolazione|revisione auto|targa|aci|carrozzeri\w*|tagliando|concessionari\w*)\b/],
  ['conti', /\b(estratto conto|estratti conto|banca|bancari\w*|intesa|unicredit|bper|fineco|banco bpm|credem|mutuo|bonifico|carta di credito|dossier titoli)\b/],
  ['studio_fornitori', /\b(henry schein|dentsply|ivoclar|straumann|nobel biocare|zimmer|dental\w*|deposito dentale|laboratorio odontotecnico|odontotecnic\w*)\b/],
  ['formazione', /\b(ecm|congress\w*|corso di|corsi di|seminari\w*|webinar|attestat\w*|master|tesi)\b/],
  ['personale_studio', /\b(curriculum|cv|candidatur\w*|assunzion\w*|busta paga|cedolin\w*)\b/],
  ['famiglia_scuola', /\b(scuola|asilo|iscrizion\w*|pagell\w*|mensa|liceo|universit\w*)\b/],
  ['servizi', /\b(abbonament\w*|rinnov\w*|canone|tim|vodafone|fastweb|wind|iliad|netflix|spotify|aruba)\b/],
  ['acquisti', /\b(ordine n\w*|il tuo ordine|conferma d.?ordine|amazon|ebay|spedizion\w*|scontrino|ricevuta di acquisto)\b/],
  ['pubblicita', /\b(newsletter|promo\w*|offert\w*|sconto|sconti|listino|volantin\w*|catalogo)\b/],
  ['corrispondenza', /\b(auguri|buon natale|buona pasqua|pps|catena)\b/],
];
const TIPI_RISERVA = [
  ['fattura', /\b(fattur\w*|invoice)\b/], ['estratto conto', /\bestratt\w* cont\w*\b/], ['F24', /\bf24\b/],
  ['bolletta', /\bbollett\w*\b/], ['contratto', /\bcontratt\w*\b/], ['preventivo', /\bpreventiv\w*\b/],
  ['polizza', /\bpolizz\w*\b/], ['ricevuta', /\bricevut\w*\b/], ['sollecito', /\bsollecit\w*\b/],
  ['certificato', /\bcertificat\w*\b/], ['comunicazione', /\bcomunicazion\w*\b/],
];

function normalizzaTesto_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_.\-]+/g, ' ');
}
// "Enel Energia <noreply@enel.it>" → "Enel Energia"; senza nome, il dominio ("enel.it").
function enteDaMittente_(mittente) {
  const m = String(mittente || '');
  const nome = m.replace(/<[^>]*>/, '').replace(/["']/g, '').trim();
  if (nome && nome.indexOf('@') < 0) return nome.slice(0, 120);
  const dominio = (m.match(/@([\w.-]+)/) || [])[1];
  return dominio ? dominio.toLowerCase().replace(/^(mail|email|pec|noreply|no-reply)\./, '') : null;
}

function analisiDiRiserva_(meta, nome, mime) {
  // Prima oggetto e nome del file; il mittente solo se non bastano (un F24 dal commercialista
  // non diventa "utenze" perché arriva da un indirizzo con "enel" nel nome).
  const t = normalizzaTesto_(meta.oggetto + ' ' + nome);
  const daMittente = normalizzaTesto_(meta.mittente);
  const video = /^video\//.test(mime || '');
  const foto = /^image\//.test(mime || '') && /^(img|dsc|pxl|photo|foto|whatsapp image)[\s_-]?\d/i.test(nome);
  const regola = REGOLE_RISERVA.filter(function (r) { return r[1].test(t); })[0] ||
    (video || foto ? ['foto_video'] : null) ||
    REGOLE_RISERVA.filter(function (r) { return r[1].test(daMittente); })[0];
  const tipo = TIPI_RISERVA.filter(function (r) { return r[1].test(t); })[0];
  const fascicolo = regola ? regola[0] : 'altro';
  const daLuca = String(meta.mittente || '').toLowerCase().indexOf(PROPRIETARIO) >= 0;
  const ente = daLuca ? null : enteDaMittente_(meta.mittente);
  const oggetto = String(meta.oggetto || '').replace(/^\s*((r|i|fw|fwd|re|inoltro)\s*:\s*)+/i, '').trim();
  const titolo = [tipo ? tipo[0].charAt(0).toUpperCase() + tipo[0].slice(1) : null, ente, oggetto || nome.replace(/\.[^.]+$/, '')]
    .filter(Boolean).join(' – ').slice(0, 120);
  return {
    riserva: true,
    fascicolo: fascicolo,
    tipo_documento: tipo ? tipo[0] : null,
    titolo: titolo,
    riassunto: 'Catalogo provvisorio: verrà analizzato appena possibile.',
    data_documento: null,
    tag: ['da analizzare'],
    ente: ente,
    rilevanza: ['pubblicita', 'foto_video', 'corrispondenza'].indexOf(fascicolo) >= 0 ? 'bassa' : 'normale',
  };
}

// Analisi completa dei documenti importati senza Claude; false quando non ne restano.
function analizzaRimasti_(scadenza) {
  const docs = sb_('documenti?select=id,fascicolo,gmail_message_id,email_oggetto,email_mittente,email_data,nome_file_originale,mime_type,drive_file_id' +
    '&da_analizzare=is.true&order=email_data.desc.nullslast&limit=' + ANALISI_RIMASTI_LOTTO);
  if (!docs.length) return false;
  let pratiche = null;
  for (let i = 0; i < docs.length; i++) {
    if (Date.now() > scadenza || apiInPausa_()) return true;
    const d = docs[i];
    const meta = { oggetto: d.email_oggetto || '', mittente: d.email_mittente || '', destinatari: '',
      data: d.email_data ? new Date(d.email_data) : new Date() };
    const nome = d.nome_file_originale || 'documento';
    // Mai al modello i documenti dei pazienti: se le regole cliniche lo riconoscono, va nel clinico.
    if (d.fascicolo === 'clinico_pazienti' || eClinico_(meta, nome)) {
      sb_('documenti?id=eq.' + d.id, { method: 'patch', body: { fascicolo: 'clinico_pazienti', rilevanza: 'alta', da_analizzare: false,
        riassunto: 'Documento clinico: archiviato senza analisi del contenuto.' } });
      continue;
    }
    const caricato = String(d.gmail_message_id || '').indexOf('caricato:') === 0;
    try {
      if (!caricato) {
        try { meta.corpo = (GmailApp.getMessageById(d.gmail_message_id).getPlainBody() || '').replace(/\s+\n/g, '\n').slice(0, 2500); } catch (e) {}
      }
      const file = DriveApp.getFileById(d.drive_file_id);
      const bytes = file.getBlob().getBytes();
      const contenuto = contenutoPerAnalisi_(bytes, String(d.mime_type || '').toLowerCase(), nome, file);
      pratiche = pratiche || praticheAperte_();
      const analisi = analizza_(meta, nome, contenuto, pratiche);
      const esito = sb_('rpc/completa_analisi', { method: 'post', body: { p_id: d.id, p: {
        fascicolo: analisi.fascicolo, mantieni_fascicolo: caricato, tipo_documento: analisi.tipo_documento || null,
        titolo: analisi.titolo || null, riassunto: analisi.riassunto || null, data_documento: dataValida_(analisi.data_documento),
        importo: typeof analisi.importo === 'number' ? analisi.importo : null,
        tag: Array.isArray(analisi.tag) ? analisi.tag.slice(0, 8) : [],
        azione_richiesta: analisi.azione_richiesta === true, azione_descrizione: analisi.azione_descrizione || null,
        urgenza: analisi.urgenza || null, analisi_contenuto: !!contenuto,
        dati_estratti: analisi.dati && typeof analisi.dati === 'object' ? analisi.dati : {},
        soggetti: Array.isArray(analisi.soggetti) ? analisi.soggetti : [],
        scadenze: Array.isArray(analisi.scadenze) ? analisi.scadenze : [], pratica: analisi.pratica || {},
      } } });
      completaCatalogo_(d.id, analisi, esito && esito.fascicolo || analisi.fascicolo);
      const estensione = (nome.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
      const dataRif = dataValida_(analisi.data_documento) || Utilities.formatDate(meta.data, CONFIG.FUSO, 'yyyy-MM-dd');
      try { file.setName(dataRif + '_' + pulisciNome_(analisi.titolo || nome.replace(/\.[^.]+$/, '')) + estensione); } catch (e) {}
    } catch (e) {
      if (e.message === 'RIPROVA') throw e;
      logErrore_('analisi ' + d.id, e);
      // File sparito o illeggibile: resta il catalogo provvisorio, non si riprova all'infinito.
      try { sb_('documenti?id=eq.' + d.id, { method: 'patch', body: { da_analizzare: false } }); } catch (x) {}
    }
  }
  return true;
}

/* =====================================================================
 * CARTELLE DI DRIVE PER CATEGORIA E PERSONA (POL-VITA-013)
 * Per trovare un file in pochi tocchi anche da Mail o WhatsApp (Allega → Google Drive):
 *   Archivio personale/Persone/<Persona>       documenti delle persone elencate in Impostazioni
 *   Archivio personale/<Categoria>/<anno>      tutti gli altri (anche "Clinico pazienti")
 * I file si spostano, non si copiano né si cancellano: id e link restano gli stessi. Quando cambia
 * la categoria o la persona di un documento (anche dall'app), il file segue al giro successivo.
 * ===================================================================*/
const ORDINA_DRIVE_MS = 75 * 1000;
const CARTELLA_PERSONE = 'Persone';
const PERSONE_PREDEFINITE = ['Luca Simondi', 'Martina Simondi', 'Giulia Simondi'];

function personeConfigurate_() {
  try {
    const r = sb_('impostazioni_app?select=valore&chiave=eq.personal');
    const persone = r && r[0] && r[0].valore && r[0].valore.persone;
    if (Array.isArray(persone)) return persone.map(function (p) { return String(p).trim(); }).filter(Boolean);
  } catch (e) { logErrore_('impostazioni persone', e); }
  return PERSONE_PREDEFINITE.slice();
}

function percorsoDrive_(d, persone) {
  if (d.fascicolo !== 'clinico_pazienti' && d.persona && persone.indexOf(d.persona) >= 0) {
    return CARTELLA_PERSONE + '/' + pulisciNome_(d.persona);
  }
  const data = dataValida_(d.data_documento) || String(d.email_data || '').slice(0, 10);
  const anno = /^\d{4}/.test(data) ? data.slice(0, 4) : 'Senza data';
  return (FASCICOLI[d.fascicolo] || FASCICOLI.altro) + '/' + anno;
}

function cartellaDaPercorso_(percorso) {
  return percorso.split('/').reduce(function (padre, nome) { return sottocartella_(padre, nome); }, cartellaRadice_());
}

// Sposta i file non ancora nella cartella giusta finché c'è tempo; false quando sono tutti a posto.
function ordinaDrive_(scadenza) {
  const persone = personeConfigurate_();
  let daSpostare = [];
  for (let da = 0; ; da += 1000) {
    const pagina = sb_('documenti?select=id,drive_file_id,fascicolo,persona,data_documento,email_data,drive_cartella' +
      '&drive_file_id=not.is.null&order=id&limit=1000&offset=' + da);
    daSpostare = daSpostare.concat(pagina.filter(function (d) {
      const voluto = percorsoDrive_(d, persone);
      return d.drive_cartella !== voluto && d.drive_cartella !== '!' + voluto;
    }));
    if (pagina.length < 1000) break;
  }
  for (let i = 0; i < daSpostare.length; i++) {
    if (Date.now() > scadenza) return true;
    const d = daSpostare[i];
    const voluto = percorsoDrive_(d, persone);
    let segnato = voluto;
    try { DriveApp.getFileById(d.drive_file_id).moveTo(cartellaDaPercorso_(voluto)); }
    catch (e) { segnato = '!' + voluto; logErrore_('Drive ' + d.id, e); } // file sparito: non si riprova
    sb_('documenti?id=eq.' + d.id, { method: 'patch', body: { drive_cartella: segnato } });
  }
  return false;
}

// Da eseguire a mano dall'editor per sistemare tutto l'archivio in una volta (gira per ~5 minuti;
// se restano file, eseguila di nuovo o lascia fare al giro automatico).
function sistemaDrive() {
  const restano = ordinaDrive_(Date.now() + 5 * 60 * 1000);
  console.log(restano ? 'Restano file da spostare: eseguila di nuovo.' : 'Archivio su Drive in ordine.');
}

/* =====================================================================
 * CHAT POLIEDRON (dall'app Personal)
 * Claude risponde sull'archivio usando strumenti di sola lettura. I documenti clinici dei
 * pazienti non vengono mai passati al modello: sono esclusi da ogni risultato (si dice solo
 * quanti sono). L'agenda dello studio non passa di qui.
 * ===================================================================*/
const CHAT_MAX_GIRI = 5;
const CAMPI_CHAT = 'id,titolo,fascicolo,tipo_documento,data_documento,email_data,email_mittente,importo,riassunto,azione_richiesta,azione_descrizione,persona,categoria,pratica_id';
const senzaClinici_ = (docs) => docs.filter(function (d) { return d.fascicolo !== 'clinico_pazienti'; });
const breve_ = (d) => ({
  id: d.id, titolo: d.titolo, fascicolo: d.fascicolo, tipo: d.tipo_documento, data: d.data_documento || String(d.email_data || '').slice(0, 10),
  da: d.email_mittente, importo: d.importo, riassunto: d.riassunto, da_fare: d.azione_richiesta ? (d.azione_descrizione || true) : undefined,
  persona: d.persona || undefined, categoria: d.categoria || undefined,
});
const enc_ = encodeURIComponent;

const CRITERI_DOC_ = { type: 'object', properties: {
  descrizione: { type: 'string', description: 'cosa propone, in una frase (es. "Depliant e pubblicità ricevuti prima del 2020")' },
  testo: { type: 'string', description: 'parole da cercare in titolo, oggetto dell\'email, nome del file o ente' },
  fascicolo: { type: 'string', description: 'codice del fascicolo' },
  tipo_documento: { type: 'string', description: 'es. preventivo, comunicazione, fattura' },
  ente: { type: 'string' },
  rilevanza: { type: 'string', description: 'alta, normale o bassa' },
  prima_del: { type: 'string', description: 'solo documenti con email o data prima di questa data (YYYY-MM-DD)' },
} };
const PROPOSTA_MAX = 300;
const STRUMENTI_CHAT = [
  { name: 'cerca_documenti', description: 'Cerca documenti nell\'archivio per parole (nome di un ente, fornitore, tipo di documento, numero) e/o per fascicolo. Restituisce titolo, data, importo e riassunto.',
    input_schema: { type: 'object', properties: { testo: { type: 'string' }, fascicolo: { type: 'string', description: 'codice del fascicolo, facoltativo' }, limite: { type: 'integer' } } } },
  { name: 'documento', description: 'Dettaglio di un documento per id: dati estratti, scadenze, pratica.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'scadenze', description: 'Pagamenti e scadenze. Filtri facoltativi: da/a (YYYY-MM-DD), solo_aperte (default true), testo nella descrizione.',
    input_schema: { type: 'object', properties: { da: { type: 'string' }, a: { type: 'string' }, solo_aperte: { type: 'boolean' }, testo: { type: 'string' } } } },
  { name: 'pratiche', description: 'Pratiche (vicende che raggruppano documenti), con numero di documenti e prossima scadenza. Filtro facoltativo sul titolo.',
    input_schema: { type: 'object', properties: { testo: { type: 'string' }, solo_aperte: { type: 'boolean' } } } },
  { name: 'riepilogo_archivio', description: 'Quanti documenti per fascicolo e quanti da gestire.', input_schema: { type: 'object', properties: {} } },
  // Pulizia in massa (PO 2026-10-18): il modello PROPONE con dei criteri, Luca conferma nell'app.
  { name: 'proponi_eliminazione', description: 'Propone a Luca di eliminare in massa documenti inutili (pubblicità, depliant, preventivi non accettati, newsletter, foto senza valore…) scelti con dei criteri. Non elimina nulla: Luca vede l\'elenco e conferma nell\'app; i file vanno nel Cestino di Drive e le email nel Cestino di Gmail (30 giorni). Usa criteri prudenti e dillo chiaramente.',
    input_schema: CRITERI_DOC_ },
  { name: 'proponi_rianalisi', description: 'Propone di far rileggere e ricatalogare in massa dall\'AI dei documenti (per esempio catalogati male o "da analizzare"). Luca conferma nell\'app.',
    input_schema: CRITERI_DOC_ },
  { name: 'proponi_risolvi_pratiche', description: 'Propone di segnare come risolte in massa delle pratiche aperte (spariscono dall\'app ma restano in archivio). Luca conferma nell\'app.',
    input_schema: { type: 'object', properties: { testo: { type: 'string', description: 'parole nel titolo della pratica' }, fascicolo: { type: 'string' }, ferme_da_mesi: { type: 'integer', description: 'solo pratiche senza attività da almeno N mesi' }, descrizione: { type: 'string', description: 'cosa propone, in una frase' } } } },
  // Assistente personale (PO 2026-10-18): propone un promemoria in agenda o un pagamento da fare; Luca lo aggiunge con un tasto.
  { name: 'proponi_promemoria', description: 'Propone a Luca di aggiungere un impegno o promemoria nella sua agenda personale (cosa = "evento") oppure un pagamento da fare con scadenza (cosa = "pagamento": bollette, assicurazioni, bollo, tasse…). Non salva nulla: Luca vede la scheda, può correggerla e la aggiunge con un tasto. Usala quando Luca chiede di ricordargli qualcosa, di segnare un impegno o un pagamento.',
    input_schema: { type: 'object', properties: {
      cosa: { type: 'string', enum: ['evento', 'pagamento'] },
      titolo: { type: 'string', description: 'breve, es. "Bollo auto" o "Chiamare il commercialista"' },
      data: { type: 'string', description: 'YYYY-MM-DD' },
      ora: { type: 'string', description: 'HH:MM, solo per gli eventi; vuota = tutto il giorno' },
      ora_fine: { type: 'string', description: 'HH:MM, facoltativa' },
      importo: { type: 'number', description: 'euro, solo per i pagamenti, se noto' },
      categoria: { type: 'string', description: 'per i pagamenti: Bollette, Assicurazioni, Tasse, Auto, Casa, Pulizia, Abbonamenti, Altro' },
      ricorrenza: { type: 'string', description: 'solo se si ripete: mensile, bimestrale, trimestrale, semestrale o annuale' },
      note: { type: 'string' },
    }, required: ['cosa', 'titolo', 'data'] } },
];

// Documenti che corrispondono ai criteri. I clinici dei pazienti entrano solo se Luca li ha chiesti
// esplicitamente nella domanda (sua decisione, 2026-10-18) e i loro titoli non arrivano mai al modello.
function documentiPerCriteri_(c, pazientiChiesti) {
  let q = 'documenti?select=id,titolo,fascicolo,drive_file_id,email_data&order=email_data.asc.nullslast&limit=' + PROPOSTA_MAX;
  const pulisci = function (x) { return String(x || '').replace(/[*,()]/g, ' ').trim().slice(0, 80); };
  if (c.fascicolo) q += '&fascicolo=eq.' + enc_(pulisci(c.fascicolo));
  if (!(c.fascicolo === 'clinico_pazienti' && pazientiChiesti)) q += '&fascicolo=neq.clinico_pazienti';
  if (c.tipo_documento) q += '&tipo_documento=ilike.' + enc_('*' + pulisci(c.tipo_documento) + '*');
  if (c.ente) q += '&ente=ilike.' + enc_('*' + pulisci(c.ente) + '*');
  if (c.rilevanza) q += '&rilevanza=eq.' + enc_(pulisci(c.rilevanza));
  if (c.prima_del && /^\d{4}-\d{2}-\d{2}$/.test(c.prima_del)) q += '&email_data=lt.' + c.prima_del;
  if (c.testo) {
    const t = enc_('*' + pulisci(c.testo) + '*');
    q += '&or=(titolo.ilike.' + t + ',email_oggetto.ilike.' + t + ',nome_file_originale.ilike.' + t + ',ente.ilike.' + t + ')';
  }
  return sb_(q) || [];
}

function proposta_(tipo, input, ctx) {
  const nessunCriterio = !['testo', 'fascicolo', 'tipo_documento', 'ente', 'rilevanza', 'prima_del', 'ferme_da_mesi'].some(function (k) { return input[k]; });
  if (nessunCriterio) return { errore: 'Servono dei criteri (testo, fascicolo, tipo, ente, rilevanza o data): non propongo azioni su tutto l\'archivio.' };
  let elementi;
  if (tipo === 'risolvi_pratiche') {
    let q = 'v_pratiche?select=id,titolo,fascicolo,ultima_attivita&stato=in.(aperta,in_corso)&fascicolo=neq.clinico_pazienti&order=ultima_attivita.asc.nullsfirst&limit=' + PROPOSTA_MAX;
    if (input.testo) q += '&titolo=ilike.' + enc_('*' + String(input.testo).replace(/[*,()]/g, ' ') + '*');
    if (input.fascicolo) q += '&fascicolo=eq.' + enc_(String(input.fascicolo));
    if (Number(input.ferme_da_mesi) > 0) {
      const limite = new Date(); limite.setMonth(limite.getMonth() - Math.min(Number(input.ferme_da_mesi), 240));
      q += '&ultima_attivita=lt.' + Utilities.formatDate(limite, CONFIG.FUSO, 'yyyy-MM-dd');
    }
    elementi = (sb_(q) || []).map(function (p) { return { id: p.id, titolo: p.titolo, fascicolo: p.fascicolo }; });
  } else {
    elementi = documentiPerCriteri_(input, tipo === 'elimina' && ctx.pazientiChiesti)
      .filter(function (d) { return tipo !== 'rianalizza' || d.fascicolo !== 'clinico_pazienti'; })
      .map(function (d) { return { id: d.id, titolo: d.titolo || '(senza titolo)', fascicolo: d.fascicolo, drive_file_id: d.drive_file_id || null }; });
  }
  if (!elementi.length) return { trovati: 0 };
  ctx.proposte.push({ tipo: tipo, descrizione: String(input.descrizione || '').slice(0, 160), n: elementi.length, completa: elementi.length < PROPOSTA_MAX, elementi: elementi });
  const visibili = elementi.filter(function (e) { return e.fascicolo !== 'clinico_pazienti'; });
  return { trovati: elementi.length, di_cui_clinici: elementi.length - visibili.length, esempi: visibili.slice(0, 8).map(function (e) { return e.titolo; }),
    nota: 'Proposta mostrata a Luca con un tasto di conferma: non è stato ancora fatto nulla.' + (elementi.length >= PROPOSTA_MAX ? ' Sono i primi ' + PROPOSTA_MAX + ': dopo la conferma si può ripetere.' : '') };
}

// Un solo promemoria per volta, già controllato: la scheda nell'app lo mostra e Luca lo aggiunge.
function promemoria_(input, ctx) {
  const cosa = input.cosa === 'pagamento' ? 'pagamento' : 'evento';
  const data = String(input.data || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { errore: 'Serve la data in formato YYYY-MM-DD.' };
  const ora = function (x) { return /^\d{2}:\d{2}$/.test(String(x || '')) ? String(x) : null; };
  const importo = Number(input.importo);
  const p = {
    tipo: 'promemoria', cosa: cosa, titolo: String(input.titolo || '').trim().slice(0, 120) || (cosa === 'pagamento' ? 'Pagamento' : 'Promemoria'), data: data,
    ora: cosa === 'evento' ? ora(input.ora) : null, ora_fine: cosa === 'evento' ? ora(input.ora_fine) : null,
    importo: cosa === 'pagamento' && isFinite(importo) && importo > 0 ? Math.round(importo * 100) / 100 : null,
    categoria: cosa === 'pagamento' ? String(input.categoria || '').slice(0, 40) || null : null,
    ricorrenza: ['mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale'].indexOf(input.ricorrenza) >= 0 ? input.ricorrenza : null,
    note: String(input.note || '').slice(0, 300) || null,
  };
  if (ctx.proposte.filter(function (x) { return x.tipo === 'promemoria'; }).length >= 5) return { errore: 'Al massimo 5 promemoria per risposta.' };
  ctx.proposte.push(p);
  return { proposto: true, nota: 'Scheda mostrata a Luca con il tasto Aggiungi: non è ancora salvato.' };
}

function strumentoChat_(nome, input, ctx) {
  input = input || {};
  ctx = ctx || { proposte: [], pazientiChiesti: false };
  if (nome === 'proponi_eliminazione') return proposta_('elimina', input, ctx);
  if (nome === 'proponi_rianalisi') return proposta_('rianalizza', input, ctx);
  if (nome === 'proponi_risolvi_pratiche') return proposta_('risolvi_pratiche', input, ctx);
  if (nome === 'proponi_promemoria') return promemoria_(input, ctx);
  if (nome === 'cerca_documenti') {
    const lim = Math.min(Math.max(Number(input.limite) || 15, 1), 30);
    const docs = sb_('rpc/cerca_documenti', { method: 'post', body: { q: String(input.testo || ''), fasc: input.fascicolo || null, lim: lim + 10 } });
    const visibili = senzaClinici_(docs || []);
    return { documenti: visibili.slice(0, lim).map(breve_), esclusi_clinici: (docs || []).length - visibili.length };
  }
  if (nome === 'documento') {
    const d = sb_('documenti?select=' + CAMPI_CHAT + ',dati_estratti,scadenze(id,data,descrizione,importo,completata),pratica:pratiche(id,titolo,stato)&id=eq.' + enc_(String(input.id || '')))[0];
    if (!d) return { errore: 'Documento non trovato' };
    if (d.fascicolo === 'clinico_pazienti') return { errore: 'Documento clinico di un paziente: il contenuto non è consultabile dall\'assistente.' };
    return Object.assign(breve_(d), { dati: d.dati_estratti, scadenze: d.scadenze, pratica: d.pratica });
  }
  if (nome === 'scadenze') {
    let q = 'scadenze?select=id,data,descrizione,importo,completata,documento:documenti(id,titolo,fascicolo)&order=data.asc&limit=80';
    if (input.solo_aperte !== false) q += '&completata=eq.false';
    if (input.da) q += '&data=gte.' + enc_(input.da);
    if (input.a) q += '&data=lte.' + enc_(input.a);
    if (input.testo) q += '&descrizione=ilike.' + enc_('*' + String(input.testo).replace(/[*,()]/g, ' ') + '*');
    return { scadenze: (sb_(q) || []).filter(function (s) { return !s.documento || s.documento.fascicolo !== 'clinico_pazienti'; }) };
  }
  if (nome === 'pratiche') {
    let q = 'v_pratiche?select=id,titolo,fascicolo,stato,urgenza,n_documenti,prossima_scadenza,ultima_attivita&order=ultima_attivita.desc.nullslast&limit=60&fascicolo=neq.clinico_pazienti';
    if (input.solo_aperte !== false) q += '&stato=in.(aperta,in_corso)';
    if (input.testo) q += '&titolo=ilike.' + enc_('*' + String(input.testo).replace(/[*,()]/g, ' ') + '*');
    return { pratiche: sb_(q) || [] };
  }
  if (nome === 'riepilogo_archivio') {
    return { fascicoli: (sb_('v_conteggi_fascicoli?select=codice,nome,n,n_azioni&order=ordine') || []).filter(function (f) { return f.n > 0; }) };
  }
  return { errore: 'Strumento sconosciuto' };
}

function chiediPoliedron_(req) {
  const domanda = String(req.domanda || '').slice(0, 2000).trim();
  if (!domanda) return { ok: false, errore: 'Domanda vuota' };
  const oggi = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd');
  const giorno = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][Number(Utilities.formatDate(new Date(), CONFIG.FUSO, 'u')) % 7] || '';
  const system = [
    'Sei Poliedron, l\'assistente personale di Luca Simondi (odontoiatra, studi a Cuneo e Neive; famiglia: Martina e Giulia Simondi). Oggi è ' + giorno + ' ' + oggi + '.',
    'Parli con Luca come una segretaria di fiducia: diretta, calda, al femminile ("sono pronta", "ci penso io"), mai prolissa. Lo aiuti a tenere in ordine la giornata, l\'agenda, i pagamenti, i documenti e le pratiche.',
    'Sei proattiva: se nella domanda o nei dati vedi una scadenza vicina, un impegno in conflitto o qualcosa da fare, segnalalo in una riga. Quando Luca ti chiede di ricordargli o segnare qualcosa (impegno, chiamata, pagamento, bolletta, bollo, assicurazione) usa proponi_promemoria con la data esatta (calcola "domani", "lunedì", "il 30" a partire da oggi) e di\' che basta toccare Aggiungi.',
    'L\'agenda dei prossimi giorni, se è collegata, arriva insieme alla domanda: per gli appuntamenti dello studio conosci solo quanti sono e gli orari, non i pazienti.',
    'Rispondi in italiano, breve e concreto, usando SOLO i dati che ottieni con gli strumenti: se un dato non c\'è, dillo. Non inventare importi, date o nomi.',
    'Quando citi un documento scrivi [[doc:ID|titolo breve]] con l\'id esatto, così Luca può aprirlo. Per i pagamenti indica data e importo.',
    'Fascicoli: ' + Object.keys(FASCICOLI).join(', ') + '. I documenti clinici dei pazienti non sono consultabili: se servono, rimanda all\'app dello studio.',
    'Non mandi email né messaggi: se Luca chiede di scrivere a qualcuno, prepara solo il testo come bozza.',
    'Pulizia: se Luca chiede di eliminare, rianalizzare o chiudere cose in massa usa gli strumenti proponi_*: tu proponi soltanto, è Luca a confermare con il tasto nell\'app. Criteri prudenti (es. pubblicità, depliant, newsletter, preventivi vecchi non accettati); mai documenti d\'identità, contratti, atti, fiscale o polizze se non li chiede esplicitamente. Di\' quanti sono e qualche esempio.',
  ].join('\n');
  const messaggi = [];
  (Array.isArray(req.storia) ? req.storia.slice(-6) : []).forEach(function (m) {
    if (m && m.testo) messaggi.push({ role: m.ruolo === 'assistente' ? 'assistant' : 'user', content: String(m.testo).slice(0, 2000) });
  });
  let contesto = '';
  if (req.documento_id) {
    const d = strumentoChat_('documento', { id: req.documento_id });
    contesto = d.errore ? '' : '\n\n[Documento aperto nell\'app]\n' + JSON.stringify(d).slice(0, 6000);
  }
  // Agenda preparata dall'app: impegni personali e, dello studio, solo quanti appuntamenti e a che ore (mai i pazienti).
  if (req.agenda) contesto += '\n\n[Agenda di Luca]\n' + String(req.agenda).slice(0, 4000);
  messaggi.push({ role: 'user', content: domanda + contesto });

  const ctx = { proposte: [], pazientiChiesti: /pazient|clinic/i.test(domanda) };
  const esegui = function (nome, input) {
    try { return strumentoChat_(nome, input, ctx); } catch (e) { return { errore: String(e && e.message || e).slice(0, 200) }; }
  };
  // Claude se disponibile, altrimenti Gemini (PO 2026-10-18); stessi strumenti, stesse regole.
  const testo = !claudeInPausa_() ? chatClaude_(system, messaggi, esegui) : chatGemini_(system, messaggi, esegui);
  return { ok: true, risposta: testo, proposte: ctx.proposte };
}

function chatClaude_(system, messaggi, esegui) {
  for (let giro = 0; giro < CHAT_MAX_GIRI; giro++) {
    let r;
    try { r = claudeMessaggi_({ model: CONFIG.MODELLO, max_tokens: 1500, system: system, tools: STRUMENTI_CHAT, messages: messaggi }); } catch (e) {
      if (/limite di spesa/.test(e.message) && geminiDisponibile_()) { pausaApi_(e.message); return chatGemini_(system, messaggi, esegui); }
      throw e;
    }
    if (r.stop_reason !== 'tool_use') {
      const t = (r.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').trim();
      return t || 'Non ho trovato una risposta.';
    }
    messaggi.push({ role: 'assistant', content: r.content });
    messaggi.push({ role: 'user', content: r.content.filter(function (b) { return b.type === 'tool_use'; }).map(function (b) {
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(esegui(b.name, b.input)).slice(0, 20000) };
    }) });
  }
  return 'Domanda troppo ampia: prova a restringerla (un fornitore, un periodo, un tipo di documento).';
}

// Chat con Gemini: messaggi in formato Claude (solo testo) → contents di Gemini, strumenti → functionDeclarations.
function chatGemini_(system, messaggi, esegui) {
  if (!geminiDisponibile_()) throw new Error('Poliedron AI è ferma: Claude ha raggiunto il limite di spesa e Gemini non è disponibile ora.');
  const contents = messaggi.filter(function (m) { return typeof m.content === 'string'; })
    .map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; });
  const strumenti = [{ functionDeclarations: STRUMENTI_CHAT.map(function (t) {
    const f = { name: t.name, description: t.description };
    if (Object.keys(t.input_schema.properties || {}).length) f.parameters = t.input_schema; // Gemini non vuole oggetti vuoti
    return f;
  }) }];
  for (let giro = 0; giro < CHAT_MAX_GIRI; giro++) {
    let c;
    try { c = geminiChiamata_({ systemInstruction: { parts: [{ text: system }] }, contents: contents, tools: strumenti, generationConfig: { temperature: 0.3, maxOutputTokens: 4096 } }); } catch (e) {
      if (e.message === 'RIPROVA') throw new Error('Poliedron AI è occupata (limite gratuito di Gemini raggiunto): riprova più tardi.');
      throw e;
    }
    const parti = c.content.parts || [];
    const chiamate = parti.filter(function (p) { return p.functionCall; });
    if (!chiamate.length) {
      const t = parti.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('').trim();
      return t || 'Non ho trovato una risposta.';
    }
    contents.push({ role: 'model', parts: parti }); // invariato: Gemini vuole indietro anche le firme dei suoi pensieri
    contents.push({ role: 'user', parts: chiamate.map(function (p) {
      return { functionResponse: { name: p.functionCall.name, response: { risultato: esegui(p.functionCall.name, p.functionCall.args || {}) } } };
    }) });
  }
  return 'Domanda troppo ampia: prova a restringerla (un fornitore, un periodo, un tipo di documento).';
}

// Testo da un modello per sintesi delle cartelle, bozze e cartelle suggerite: Claude se disponibile,
// altrimenti Gemini (PO 2026-10-18: "Dobbiamo usare anche api gemini"). I chiamanti escludono già
// i documenti clinici dei pazienti. schema → risposta JSON.
function testoAI_(system, testo, maxToken, schema) {
  if (!claudeInPausa_()) {
    const body = { model: CONFIG.MODELLO, max_tokens: maxToken, system: system, messages: [{ role: 'user', content: testo }] };
    if (schema) body.output_config = { format: { type: 'json_schema', schema: schema } };
    try {
      const r = claudeMessaggi_(body);
      return (r.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').trim();
    } catch (e) {
      if (!/limite di spesa/.test(e.message) || !geminiDisponibile_()) throw e;
      pausaApi_(e.message);
    }
  }
  if (!geminiDisponibile_()) throw new Error('Poliedron AI è ferma: Claude ha raggiunto il limite di spesa e Gemini non è disponibile ora.');
  const config = { temperature: 0.3, maxOutputTokens: 8192 };
  if (schema) config.responseMimeType = 'application/json';
  let c;
  try { c = geminiChiamata_({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: testo }] }], generationConfig: config }); }
  catch (e) {
    if (e.message === 'RIPROVA') throw new Error('Poliedron AI è occupata (limite gratuito di Gemini raggiunto): riprova più tardi.');
    throw e;
  }
  return (c.content.parts || []).filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('').trim();
}

function claudeMessaggi_(body) {
  const p = props_();
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': p.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(body),
    });
    const code = res.getResponseCode();
    if (code === 200) return JSON.parse(res.getContentText());
    if (code === 429 || code >= 500) { Utilities.sleep(tentativo * 2000); continue; }
    if (LIMITE_API.test(res.getContentText())) throw new Error('Poliedron AI è ferma: è stato raggiunto il limite di spesa dell\'API di Claude.');
    throw new Error('API Claude ' + code + ': ' + res.getContentText().slice(0, 300));
  }
  throw new Error('Assistente occupato, riprova tra poco.');
}

/* =====================================================================
 * CARTELLE (POL-VITA-016): sintesi di una cartella (= un ente) e bozza di risposta.
 * Al modello vanno solo i dati già in archivio (titoli, riassunti, date, importi, mittenti) e, per
 * la bozza, il testo dell'ultima email della cartella. Mai i documenti clinici dei pazienti; la
 * bozza resta tra le bozze di Gmail: non parte nulla a nome di Luca.
 * ===================================================================*/
const SCHEMA_CARTELLA = {
  type: 'object', additionalProperties: false, required: ['sintesi', 'punti', 'da_fare', 'promemoria'],
  properties: {
    sintesi: { type: 'string' },
    punti: { type: 'array', items: { type: 'string' } },
    da_fare: { type: 'array', items: { type: 'string' } },
    promemoria: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['data', 'descrizione'],
      properties: { data: { type: 'string' }, descrizione: { type: 'string' } } } },
  },
};
const enteValido_ = (x) => String(x || '').trim().slice(0, 120);

function documentiCartella_(ente, campi, limite) {
  return sb_('documenti?select=' + campi + '&ente=eq.' + enc_(ente) + '&fascicolo=neq.clinico_pazienti&order=email_data.desc.nullslast&limit=' + limite);
}

function analizzaCartella_(req) {
  const ente = enteValido_(req.ente);
  if (!ente) return { ok: false, errore: 'Cartella mancante' };
  const docs = documentiCartella_(ente, 'id,titolo,tipo_documento,data_documento,email_data,email_mittente,email_oggetto,importo,riassunto,azione_richiesta,azione_descrizione', 80);
  if (!docs.length) return { ok: false, errore: 'Cartella vuota' };
  const oggi = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd');
  const system = [
    'Sei l\'archivista personale di Luca Simondi (odontoiatra, studi a Cuneo e Neive). Oggi è ' + oggi + '.',
    'Ricevi i documenti di una cartella (tutti dallo stesso ente) e la riassumi per Luca, in italiano, usando SOLO i dati ricevuti.',
    'sintesi: 3-5 frasi su chi è l\'ente, che rapporto c\'è con Luca, cosa è successo nel tempo e a che punto è.',
    'punti: fino a 6 fatti chiave con date e importi (es. "Fattura n. 12 del 3/3/2024: 84,30 €").',
    'da_fare: cose ancora aperte per Luca (pagamenti, risposte, rinnovi); vuoto se non ce ne sono.',
    'promemoria: solo date future reali che compaiono nei documenti (scadenze, rinnovi), formato YYYY-MM-DD; vuoto se non ce ne sono.',
    'Non inventare nulla.',
  ].join('\n');
  const righe = docs.map(function (d) {
    return JSON.stringify({ titolo: d.titolo, tipo: d.tipo_documento, data: d.data_documento || String(d.email_data || '').slice(0, 10),
      da: d.email_mittente, oggetto: d.email_oggetto, importo: d.importo, riassunto: String(d.riassunto || '').slice(0, 400),
      da_fare: d.azione_richiesta ? (d.azione_descrizione || true) : undefined });
  }).join('\n');
  let analisi;
  try { analisi = parseJson_(testoAI_(system, 'Cartella: ' + ente + ' (' + docs.length + ' documenti)\n' + righe, 1500, SCHEMA_CARTELLA)); }
  catch (e) { return { ok: false, errore: String(e && e.message || e).slice(0, 300) }; }
  const pulito = {
    sintesi: String(analisi.sintesi || '').slice(0, 2000),
    punti: (analisi.punti || []).map(String).slice(0, 8),
    da_fare: (analisi.da_fare || []).map(String).slice(0, 8),
    promemoria: (analisi.promemoria || []).filter(function (p) { return dataValida_(p.data) && p.data >= oggi; }).slice(0, 6),
  };
  sb_('cartelle_ente?on_conflict=ente', { method: 'post', prefer: 'resolution=merge-duplicates',
    body: { ente: ente, sintesi: JSON.stringify(pulito), sintesi_il: new Date().toISOString(), aggiornata_il: new Date().toISOString() } });
  return { ok: true, analisi: pulito };
}

function bozzaRisposta_(req) {
  const ente = enteValido_(req.ente);
  if (!ente) return { ok: false, errore: 'Cartella mancante' };
  const docs = documentiCartella_(ente, 'gmail_message_id,email_oggetto,email_mittente,email_data', 30)
    .filter(function (d) { return d.gmail_message_id && String(d.gmail_message_id).indexOf('caricato:') !== 0; });
  if (!docs.length) return { ok: false, errore: 'In questa cartella non c\'è un\'email a cui rispondere.' };
  let msg;
  try { msg = GmailApp.getMessageById(docs[0].gmail_message_id); } catch (e) { return { ok: false, errore: 'Email non trovata in Gmail.' }; }
  const meta = { oggetto: msg.getSubject() || '', mittente: msg.getFrom() || '', destinatari: [msg.getTo(), msg.getCc()].filter(Boolean).join(', ') };
  if (eClinico_(meta, '')) return { ok: false, errore: 'Email clinica: la bozza va scritta dall\'app dello studio.' };
  let sintesi = '';
  try { const c = sb_('cartelle_ente?select=sintesi&ente=eq.' + enc_(ente)); sintesi = c[0] && c[0].sintesi ? String(c[0].sintesi).slice(0, 2500) : ''; } catch (e) {}
  const system = [
    'Scrivi la bozza di risposta di Luca Simondi (odontoiatra) all\'email ricevuta. Solo il testo della risposta, in italiano,',
    'cortese e concreto, senza oggetto e senza citare l\'email originale. Firma: "Luca Simondi".',
    'Non inventare fatti, importi o date: dove serve un dato che non hai scrivi [da completare].',
  ].join(' ');
  const contenuto = [
    'Cartella: ' + ente, sintesi ? 'Sintesi della cartella: ' + sintesi : '',
    'Email a cui rispondere — Da: ' + meta.mittente + ' — Oggetto: ' + meta.oggetto,
    String(msg.getPlainBody() || '').replace(/\s+\n/g, '\n').slice(0, 4000),
    req.istruzioni ? 'Indicazioni di Luca per la risposta: ' + String(req.istruzioni).slice(0, 500) : '',
  ].filter(Boolean).join('\n\n');
  let testo;
  try { testo = testoAI_(system, contenuto, 1200); }
  catch (e) { return { ok: false, errore: String(e && e.message || e).slice(0, 300) }; }
  if (!testo) return { ok: false, errore: 'Bozza vuota, riprova.' };
  msg.createDraftReply(testo); // solo bozza: Luca la rilegge e la invia lui da Gmail
  return { ok: true, testo: testo, a: meta.mittente, oggetto: 'Re: ' + meta.oggetto, link: 'https://mail.google.com/mail/u/0/#drafts' };
}

// Cartelle suggerite dall'AI (POL-VITA-018): dai nomi delle cartelle e dagli oggetti delle email
// (mai i clinici) propone quali unire perché parlano della stessa cosa. Non cambia nulla: Luca sceglie.
const SCHEMA_SUGGERIMENTI = {
  type: 'object', additionalProperties: false, required: ['gruppi'],
  properties: { gruppi: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['nome', 'enti', 'motivo'],
    properties: { nome: { type: 'string' }, enti: { type: 'array', items: { type: 'string' } }, motivo: { type: 'string' } } } } },
};
function suggerisciCartelle_() {
  const docs = sb_('documenti?select=ente,email_oggetto&ente=not.is.null&fascicolo=neq.clinico_pazienti&order=email_data.desc.nullslast&limit=4000');
  const perEnte = {};
  docs.forEach(function (d) {
    const e = perEnte[d.ente] || (perEnte[d.ente] = { n: 0, oggetti: [] });
    e.n++;
    if (e.oggetti.length < 3 && d.email_oggetto && e.oggetti.indexOf(d.email_oggetto) < 0) e.oggetti.push(String(d.email_oggetto).slice(0, 80));
  });
  const enti = Object.keys(perEnte).sort(function (a, b) { return perEnte[b].n - perEnte[a].n; }).slice(0, 250);
  if (enti.length < 2) return { ok: true, gruppi: [] };
  const righe = enti.map(function (e) { return JSON.stringify({ cartella: e, documenti: perEnte[e].n, oggetti: perEnte[e].oggetti }); }).join('\n');
  const system = [
    'Riordini le cartelle dell\'archivio di Luca Simondi (una cartella per ente). Molte hanno il nome di una persona',
    'che scrive per conto di un\'azienda o di uno studio (es. due impiegati della stessa società per la stessa pratica).',
    'Proponi SOLO gruppi di cartelle che riguardano chiaramente lo stesso ente o la stessa vicenda, con un nome breve',
    'per la cartella unita (es. "Studio Giordano", "Kerdos SPV", "OPT S.r.l."). Non unire persone diverse senza un legame',
    'evidente negli oggetti. Usa i nomi delle cartelle esattamente come li ricevi. motivo: una frase. Al massimo 20 gruppi.',
  ].join(' ');
  let esito;
  try { esito = parseJson_(testoAI_(system, 'Cartelle (una per riga, JSON):\n' + righe, 3000, SCHEMA_SUGGERIMENTI)); }
  catch (e) { return { ok: false, errore: String(e && e.message || e).slice(0, 300) }; }
  const gruppi = (esito.gruppi || []).map(function (g) {
    return { nome: String(g.nome || '').trim().slice(0, 120), motivo: String(g.motivo || '').slice(0, 200),
      enti: (g.enti || []).filter(function (e) { return perEnte[e]; }) };
  }).filter(function (g) { return g.nome && g.enti.length >= 2; }).slice(0, 20);
  return { ok: true, gruppi: gruppi };
}

function utenteSupabase_(token) {
  if (!token) return null;
  const p = props_();
  const res = UrlFetchApp.fetch(p.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: p.SUPABASE_KEY, Authorization: 'Bearer ' + token }, muteHttpExceptions: true,
  });
  return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null;
}

function rispostaJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* Rimette in coda TUTTI i thread finiti in errore (toglie l'etichetta Archivio/Errore, a blocchi di
 * 100 finché ce ne sono o finché c'è tempo; se ne restano, basta eseguirla di nuovo). Toglie
 * anche la pausa dell'API, da usare dopo aver alzato il limite di spesa. */
function riprovaErrori() {
  PropertiesService.getScriptProperties().deleteProperty('API_PAUSA_FINO');
  const errore = etichetta_(CONFIG.ETICHETTA_ERRORE);
  const inizio = Date.now();
  let totale = 0;
  while (Date.now() - inizio < 4 * 60 * 1000) {
    const threads = errore.getThreads(0, 100);
    if (!threads.length) break;
    threads.forEach(function (t) { t.removeLabel(errore); });
    totale += threads.length;
  }
  console.log('Rimessi in coda: ' + totale);
  return totale;
}
