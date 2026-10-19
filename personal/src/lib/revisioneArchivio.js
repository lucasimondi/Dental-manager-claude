// Triage prudente: una data o un importo non dimostrano un debito.
export const AREE_ARCHIVIO = [
  ['Casa e auto', ['immobili', 'utenze', 'riscaldamento', 'veicoli', 'assicurazioni']],
  ['Conti, fisco e pratiche', ['conti', 'fiscale', 'previdenza', 'legale', 'successione']],
  ['Lavoro e studio', ['studio_fornitori', 'studio_fatture_emesse', 'personale_studio']],
  ['Famiglia e personali', ['identita', 'famiglia_scuola', 'sanitario_famiglia', 'corrispondenza']],
  ['Inviti e opportunità', ['formazione', 'pubblicita']],
  ['Acquisti e servizi', ['acquisti', 'servizi', 'altro', 'foto_video']],
];
export const areaArchivio = (f) => AREE_ARCHIVIO.find(([, fs]) => fs.includes(f))?.[0] || 'Acquisti e servizi';
export const oggiRoma = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const testo = (d = {}) => [d.titolo, d.tipo_documento, d.riassunto, d.email_oggetto].filter(Boolean).join(' ').toLowerCase();
export function valutaScadenza(s, oggi = oggiRoma()) {
  if (s.completata) return { tipo: 'completata' };
  const d = s.documento;
  if (!d) return { tipo: s.importo != null ? 'pagamento' : 'promemoria' };
  if (d.fascicolo === 'clinico_pazienti') return { tipo: 'escluso' };
  const confermata = (d.tag || []).includes(`pagamento-verificato:${s.id}`);
  if (confermata && s.importo != null) return { tipo: 'pagamento' };
  const t = testo(d);
  const obbligo = /^(fattura|bolletta|sollecito|avviso di pagamento|f24)$/i.test(d.tipo_documento || '');
  if (!obbligo && (['pubblicita', 'formazione'].includes(d.fascicolo) || /\b(invito|newsletter|promozion|programma corso)\b/.test(t))) {
    return { tipo: 'opportunita', proposta: s.data < oggi ? 'Evento o offerta trascorsi: propongo di archiviare.' : 'Valuta se ti interessa; posso aiutarti a verificare programma e iscrizione.' };
  }
  if (/\b(quietanza|già pagat|gia pagat|è stato addebitato|pagamento ricevuto)\b/.test(t) || /^(ricevuta|scontrino)$/i.test(d.tipo_documento || '')) {
    return { tipo: 'verifica', proposta: 'Il documento indica un pagamento o un addebito: verifica la ricevuta o il conto prima di pagare di nuovo.' };
  }
  if (s.importo == null || !obbligo) return { tipo: 'promemoria', proposta: 'È un termine o un rinnovo, senza un obbligo di pagamento dimostrato.' };
  const anni = (t.match(/\b20\d{2}\b/g) || []);
  const vecchia = s.storica || s.data?.slice(0, 4) < oggi.slice(0, 4) || anni.some((a) => a < oggi.slice(0, 4));
  if (!confermata && (vecchia || d.analisi_contenuto === false)) return { tipo: 'verifica', proposta: 'Risulta una richiesta, ma manca la prova del saldo attuale. È già stata pagata? Propongo di cercare ricevute e solleciti successivi.' };
  return { tipo: 'pagamento' };
}
export function propostaDocumento(d) {
  const t = testo(d);
  if (d.analisi_contenuto === false || /catalogo provvisorio/.test(t)) return 'Contenuto ancora da leggere: propongo di rileggere mail e allegato prima di decidere.';
  return d.azione_descrizione || 'Propongo di verificare obblighi, termini e documenti collegati prima di archiviare.';
}
export function avvisoCartella(scadenze, oggi = oggiRoma()) {
  const limite = new Date(`${oggi}T12:00:00Z`); limite.setUTCDate(limite.getUTCDate() + 14);
  const entro = limite.toISOString().slice(0, 10);
  const attive = scadenze.filter((s) => !s.completata && !s.storica && s.data <= entro && !['opportunita', 'escluso'].includes(valutaScadenza(s, oggi).tipo));
  return { n: attive.length, colore: attive.some((s) => s.data <= oggi) ? '#B42318' : '#d97706' };
}
