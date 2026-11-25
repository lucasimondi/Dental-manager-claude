import { IconaPerTe } from '../../Icone.jsx';
import { VistaPersonale } from './Personale.jsx';

// DOCK-PER-TE (PO 2026-11-08): la vita personale. L'id resta «altro» per i link già esistenti
// (?sezione=altro). PERSONALE-HOME (PO 2026-11-16, mockup approvato): il dock dice «Personale» e
// apre subito la Home personale (Da fare, Conti, Documenti, Scan, Il tuo spazio, Recenti).
// PER_TE resta l'elenco delle sezioni: la ricerca della Home cerca qui.
export const PER_TE = [
  // DA-FARE (2026-11-16): promemoria d'azione letti da email e documenti.
  ['dafare', 'Da fare', 'attivita', 'grande', 'Cosa gestire: solleciti, scadenze, risposte'],
  ['conti', 'Spese e pagamenti', 'conti', 'grande', 'Conti, ricevute e cose da pagare'],
  // DOCUMENTI-DRIVE (PO 2026-11-09): tutti i documenti di Drive, con la barra di ricerca.
  ['documenti', 'Documenti', 'documenti', 'alta', 'Tutto Drive: cerca per nome, ente, anno'],
  // MIEI-DATI (2026-11-25): P.IVA, PEC, IBAN tuoi e delle società, con i consulenti.
  ['dati', 'I miei dati', 'personali', 'media', 'P.IVA, PEC, IBAN tuoi e delle società, consulenti'],
  // APP-AUTO-CASA-SALUTE (2026-11-25): tre app, anche a sé sulla Home del telefono.
  ['auto', 'Auto e motori', 'auto', 'media', 'Foto, assicurazione, bollo, revisione, tagliandi'],
  ['casa', 'Casa', 'home', 'media', 'Utenze, catasto, assicurazione, manutenzioni'],
  ['salute', 'Salute', 'salute', 'media', 'Medico, tessera, allergie, controlli, esami'],
  ['personali', 'Documenti personali', 'personali', 'media', "Carta d'identità, patente, codice fiscale"],
  ['foto', 'Foto', 'foto', 'media'],
  ['note', 'Note', 'nota', 'piccola'], ['diario', 'Diario', 'diario', 'piccola'], ['legal', 'Pratiche', 'pratiche', 'piccola'],
  // CONCORDATO (2026-11-20): beni con quote, PDF e divisione con Anna (si apre anche da Pratiche).
  ['concordato', 'Concordato', 'pratiche', 'piccola', 'Beni, quote, divisione con Anna, conguaglio'],
  ['didattica', 'Biblioteca', 'biblioteca', 'pulsante'], ['password', 'Password', 'password', 'pulsante'], ['oggi', 'Oggi', 'oggi', 'pulsante'],
];

export const altro = { id: 'altro', nome: 'Personale', Icona: IconaPerTe, Vista: VistaPersonale, pagine: {}, senzaPiu: true, senzaTitolo: true,
  // PERSONALE-GRAFICA: la Home ha la sua testata (titolo e Impostazioni): quella dell'app si nasconde.
  classeTestata: 'pp-testata-personale' };
