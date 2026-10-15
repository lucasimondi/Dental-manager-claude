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
 *   EMAIL_DIGEST       destinatario del riepilogo (predefinito: il tuo indirizzo)
 *   DASHBOARD_URL      indirizzo della dashboard, per il link nel riepilogo
 */

const CONFIG = {
  MODELLO: 'claude-haiku-5-5',
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
  altro: 'Altro',
};

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
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const inizio = Date.now();
  const sp = PropertiesService.getScriptProperties();
  try {
    const fatto = etichetta_(CONFIG.ETICHETTA_FATTO);
    const errore = etichetta_(CONFIG.ETICHETTA_ERRORE);
    const pratiche = praticheAperte_();
    const meseOggi = Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM');

    // Recupero: thread di mesi già superati dal cursore e rimessi in coda con riprovaErrori
    const cursore = sp.getProperty('LOTTO_MESE');
    if (cursore) {
      const prima = Math.floor(new Date(+cursore.slice(0, 4), +cursore.slice(5, 7) - 1, 1).getTime() / 1000);
      const recupero = GmailApp.search(CONFIG.QUERY_BASE + ' before:' + prima +
        ' -label:' + etichettaQuery_(CONFIG.ETICHETTA_FATTO) +
        ' -label:' + etichettaQuery_(CONFIG.ETICHETTA_ERRORE), 0, 20).reverse();
      for (let i = 0; i < recupero.length; i++) {
        const t = recupero[i];
        if (Date.now() - inizio > CONFIG.TEMPO_MAX_MS) return;
        try {
          elaboraThread_(t, pratiche, inizio, null);
          t.addLabel(fatto);
        } catch (e) {
          if (e.message === 'TEMPO' || e.message === 'RIPROVA') return;
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
          if (e.message === 'TEMPO' || e.message === 'RIPROVA') { interrotto = true; break; }
          console.error('Thread ' + t.getId() + ': ' + (e.stack || e));
          t.addLabel(errore);
          stat.errori++;
          logErrore_('thread ' + t.getId() + ' — ' + t.getFirstMessageSubject(), e);
        }
      }
      salvaStatLotto_(mese, stat);
      if (interrotto) break;
    }
  } finally {
    lock.releaseLock();
  }
}

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
    } else {
      meta.corpo = (m.getPlainBody() || '').replace(/\s+\n/g, '\n').slice(0, 2500);
      const contenuto = contenutoPerAnalisi_(bytes, mime, nome, file);
      if (!contenuto) analisiContenuto = false;
      analisi = analizza_(meta, nome, contenuto, pratiche);
    }

    const fasc = FASCICOLI[analisi.fascicolo] ? analisi.fascicolo : 'altro';
    const dataRif = dataValida_(analisi.data_documento) ||
      Utilities.formatDate(meta.data, CONFIG.FUSO, 'yyyy-MM-dd');
    // Originale su Drive: Archivio personale/<anno>/<mese> (data dell'email)
    const cartella = sottocartella_(
      sottocartella_(cartellaRadice_(), Utilities.formatDate(meta.data, CONFIG.FUSO, 'yyyy')),
      Utilities.formatDate(meta.data, CONFIG.FUSO, 'MM'));
    const estensione = (nome.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
    file.setName(dataRif + '_' + pulisciNome_(analisi.titolo || nome.replace(/\.[^.]+$/, '')) + estensione);
    file.moveTo(cartella);

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
    '- Materiale pubblicitario: fascicolo "altro" con tag "promozionale".',
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
  const analisi = parseJson_(claude_(system, blocchi, SCHEMA_ANALISI));
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
    'scadenze', 'azione_richiesta', 'azione_descrizione', 'urgenza', 'pratica', 'tag', 'dati'],
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
    throw new Error('API Claude ' + code + ': ' + res.getContentText().slice(0, 500));
  }
  throw new Error('RIPROVA'); // API sovraccarica: si riprova al giro successivo
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
function digest() {
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
    } else {
      const contenuto = contenutoPerAnalisi_(bytes, mime, nome, file);
      if (!contenuto) analisiContenuto = false;
      analisi = analizza_(meta, nome, contenuto, praticheAperte_());
    }
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

/* Rimette in coda i thread finiti in errore (togli l'etichetta Archivio/Errore) */
function riprovaErrori() {
  const errore = etichetta_(CONFIG.ETICHETTA_ERRORE);
  errore.getThreads(0, 100).forEach(function (t) { t.removeLabel(errore); });
}
