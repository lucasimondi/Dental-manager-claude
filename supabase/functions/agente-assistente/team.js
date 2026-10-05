// POL-AI-TEAM-002: il team di Poliedron (Clinic Manager e specialisti).
// Gli specialisti danno pareri: hanno solo strumenti di lettura, sempre
// intersecati con quelli che lo studio e l'utente hanno già in questa chat,
// così nessun assistente vede più di quanto vede l'utente. Il Clinic Manager
// legge e consulta gli specialisti; nessuno del team scrive.

export const SPECIALISTI = Object.freeze({
  agenda: Object.freeze({
    nome: 'Assistente Agenda',
    focus: "Sei esperto di organizzazione dell'agenda: disponibilità, saturazione delle poltrone e degli operatori, buchi da riempire, richiami da fissare, durata e sequenza delle sedute.",
    strumenti: ['disponibilita_agenda', 'appuntamenti', 'cerca_pazienti', 'richiami'],
  }),
  clinical: Object.freeze({
    nome: 'Assistente Clinico',
    focus: "Sei un supporto clinico per il professionista: storico, sedute, prestazioni eseguite e da eseguire, priorità di cura, controlli e richiami clinici. Non fai diagnosi e non finalizzi atti clinici: proponi, il professionista decide.",
    strumenti: ['cerca_pazienti', 'scheda_paziente', 'storico_paziente', 'appuntamenti', 'catalogo_prestazioni'],
  }),
  marketing: Object.freeze({
    nome: 'Assistente Marketing',
    focus: "Sei esperto di marketing per studi sanitari: fidelizzazione, richiami dei pazienti persi, campagne di prevenzione, comunicazione e recensioni, prestazioni da promuovere. Rispetti il codice deontologico (niente promesse di risultato, niente prezzi aggressivi) e la privacy: comunicazioni solo a chi ha dato il consenso.",
    strumenti: ['richiami', 'kpi_controllo_gestione', 'andamento_kpi', 'catalogo_prestazioni', 'appuntamenti'],
  }),
  finance: Object.freeze({
    nome: 'Assistente Finanza',
    focus: "Sei esperto di controllo di gestione dello studio: incassi, crediti, margini, KPI e andamento. Usi solo i dati economici letti dagli strumenti e dici chiaramente quando un dato manca.",
    strumenti: ['situazione_economica', 'kpi_controllo_gestione', 'andamento_kpi', 'catalogo_prestazioni'],
  }),
  documents: Object.freeze({
    nome: 'Assistente Documenti',
    focus: "Sei esperto di documentazione dello studio: consensi informati, certificati, ricette, preventivi e informative. Indichi cosa serve, cosa manca nella scheda e come compilarlo; i documenti si generano nei moduli dell'app.",
    strumenti: ['cerca_pazienti', 'scheda_paziente', 'storico_paziente', 'catalogo_prestazioni'],
  }),
});

export const CLINIC_MANAGER = Object.freeze({
  nome: 'Clinic Manager',
  focus: "Sei il Clinic Manager dello studio: hai la visione d'insieme e coordini gli specialisti. Per le domande che richiedono competenza verticale consulta gli specialisti necessari (solo quelli utili, insieme nello stesso passaggio), poi integra i loro pareri in una risposta unica: indica chi ha detto cosa quando conta, conserva le divergenze e i dati mancanti, e chiudi con le azioni consigliate in ordine di priorità.",
});

export const ID_TEAM = Object.freeze(['clinic-manager', ...Object.keys(SPECIALISTI)]);
export const MAX_MEMBRI = Object.keys(SPECIALISTI).length;
const MAX_OBIETTIVO = 2000;
const MAX_DOMANDA = 4000;

/** Valida la parte `team` della richiesta; restituisce null se assente. */
export function leggiRichiestaTeam(team) {
  if (team == null) return null;
  if (typeof team !== 'object' || Array.isArray(team)) throw new Error('Richiesta team non valida');
  const assistente = team.assistente;
  if (!ID_TEAM.includes(assistente)) throw new Error('Assistente del team non valido');
  let membri = Object.keys(SPECIALISTI);
  if (team.membri != null) {
    if (assistente !== 'clinic-manager') throw new Error('Solo il Clinic Manager coordina un gruppo');
    if (!Array.isArray(team.membri) || !team.membri.length || team.membri.length > MAX_MEMBRI) throw new Error('Membri del gruppo non validi');
    if (new Set(team.membri).size !== team.membri.length || team.membri.some((id) => !Object.hasOwn(SPECIALISTI, id))) throw new Error('Membri del gruppo non validi');
    membri = [...team.membri];
  }
  let obiettivo = null;
  if (team.obiettivo != null) {
    if (typeof team.obiettivo !== 'string' || team.obiettivo.trim().length > MAX_OBIETTIVO) throw new Error('Obiettivo del gruppo non valido');
    obiettivo = team.obiettivo.trim() || null;
  }
  let titolo = null;
  if (team.titolo != null) {
    if (typeof team.titolo !== 'string' || team.titolo.trim().length > 120) throw new Error('Titolo del gruppo non valido');
    titolo = team.titolo.trim() || null;
  }
  return Object.freeze({ assistente, membri: Object.freeze(membri), obiettivo, titolo });
}

/** Strumenti di uno specialista: solo i suoi, e solo se già consentiti in lettura. */
export function strumentiSpecialista(id, strumentiLettura) {
  const propri = new Set(SPECIALISTI[id]?.strumenti || []);
  return strumentiLettura.filter((t) => propri.has(t.name));
}

export const CONSULTA_SPECIALISTI = 'consulta_specialisti';

export function toolConsulta(membri) {
  return {
    name: CONSULTA_SPECIALISTI,
    description: 'Chiede un parere agli specialisti del team, in parallelo. Usalo solo quando serve competenza verticale; ogni specialista legge i dati dello studio in sola lettura e risponde con un parere. Specialisti: '
      + membri.map((id) => `${id} = ${SPECIALISTI[id].nome}`).join('; ') + '.',
    input_schema: {
      type: 'object',
      properties: {
        consulti: {
          type: 'array',
          minItems: 1,
          maxItems: membri.length,
          items: {
            type: 'object',
            properties: {
              specialista: { type: 'string', enum: [...membri] },
              domanda: { type: 'string', description: 'Domanda precisa e autosufficiente, con il contesto utile (pazienti, periodo, obiettivo).' },
            },
            required: ['specialista', 'domanda'],
          },
        },
      },
      required: ['consulti'],
    },
  };
}

/** Normalizza i consulti chiesti dal Clinic Manager: solo membri, niente doppioni. */
export function leggiConsulti(input, membri) {
  const consulti = Array.isArray(input?.consulti) ? input.consulti : [];
  const visti = new Set();
  const validi = [];
  for (const c of consulti) {
    if (!membri.includes(c?.specialista) || visti.has(c.specialista)) continue;
    if (typeof c.domanda !== 'string' || !c.domanda.trim()) continue;
    visti.add(c.specialista);
    validi.push({ specialista: c.specialista, domanda: c.domanda.trim().slice(0, MAX_DOMANDA) });
  }
  return validi;
}

/** Esegue i consulti in parallelo con un tempo massimo; i pareri restano attribuiti. */
export async function eseguiConsulti(consulti, esegui, { timeoutMs = 45000 } = {}) {
  return Promise.all(consulti.map(async ({ specialista, domanda }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const testo = await esegui(specialista, domanda, controller.signal);
      if (typeof testo !== 'string' || !testo.trim()) return { specialista, nome: SPECIALISTI[specialista].nome, stato: 'non_disponibile', parere: null };
      return { specialista, nome: SPECIALISTI[specialista].nome, stato: 'ok', parere: testo.trim().slice(0, 6000) };
    } catch {
      return { specialista, nome: SPECIALISTI[specialista].nome, stato: 'non_disponibile', parere: null };
    } finally {
      clearTimeout(timer);
    }
  }));
}

const REGOLE_TEAM = `REGOLE DEL TEAM (prevalgono su quanto scritto sopra):
- Sei in sola lettura e consulenza: non puoi creare, modificare o annullare nulla. Se serve un'azione, scrivi esattamente cosa chiedere a Poliedron nella chat principale.
- Usa i dati letti con gli strumenti e distingui sempre i dati dalle tue ipotesi o stime. Se un dato manca, dillo.
- Non inventare pazienti, numeri, date o prezzi.
- Rispondi in italiano, in modo concreto e breve: prima la risposta, poi al massimo 3-5 punti d'azione.`;

/** Parte stabile del system prompt (in cache) per un membro del team. */
export function promptTeam(assistente, basePrompt) {
  const ruolo = assistente === 'clinic-manager' ? CLINIC_MANAGER : SPECIALISTI[assistente];
  return `Sei ${ruolo.nome}, membro del team di Poliedron per uno studio che usa il gestionale Poliedra.
${ruolo.focus}

${basePrompt}

${REGOLE_TEAM}`;
}

/** Parte dinamica: gruppo e obiettivo condiviso, se presenti. */
export function contestoGruppo(richiesta) {
  if (!richiesta || richiesta.assistente !== 'clinic-manager') return '';
  const nomi = richiesta.membri.map((id) => SPECIALISTI[id].nome).join(', ');
  return `\n\n## Gruppo${richiesta.titolo ? ` "${richiesta.titolo}"` : ''}
Specialisti disponibili: ${nomi}.${richiesta.obiettivo ? `\nObiettivo condiviso del gruppo: ${richiesta.obiettivo}` : ''}`;
}
