// Ricerca pazienti tollerante, condivisa da tutti i punti dell'app dove si
// cerca un paziente per nome: ordine parole libero ("Rossi Mario" = "Mario
// Rossi"), accent/maiuscole-insensitive, e tolleranza a piccoli refusi di
// battitura. Estratta da Pazienti.jsx per essere riusata in Agenda, Piani,
// ArchivioDocs, Pagamenti e ovunque serva lo stesso comportamento.

// Normalizza rimuovendo accenti/maiuscole, così "Perù" == "peru".
export const normalizza = (s) => (s || '')
  .toString()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

// Distanza di Levenshtein "economica": conta quante modifiche servono per
// trasformare a in b, fermandosi presto se supera la soglia (performance
// su liste lunghe). Usata solo su parole corte/medie.
const distanzaBreve = (a, b, soglia) => {
  if (Math.abs(a.length - b.length) > soglia) return soglia + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
};

// Una "parola" cercata combacia con un campo se: è contenuta direttamente
// (caso più comune), oppure se è abbastanza vicina per tolleranza a un
// piccolo errore di battitura (1 carattere ogni ~5).
const tokenCombacia = (token, campoNorm) => {
  if (!token) return true;
  if (campoNorm.includes(token)) return true;
  if (token.length < 3) return false; // token troppo corti: solo match esatto
  const soglia = token.length <= 5 ? 1 : 2;
  return campoNorm.split(/\s+/).some((w) => w.length >= 2 && distanzaBreve(token, w, soglia) <= soglia);
};

/**
 * Filtra e ordina un elenco di pazienti per rilevanza rispetto a una query.
 * Ogni token della query deve combaciare (ordine libero) con nome, cognome,
 * CF o telefono. Ritorna l'elenco ordinato (match migliori prima).
 */
export function cercaPazienti(patients, query) {
  const q = normalizza(query);
  if (!q) return patients;
  const tokens = q.split(/\s+/).filter(Boolean);
  const risultati = [];
  for (const p of patients) {
    const nomeCompleto = normalizza(`${p.nome} ${p.cognome}`);
    const cf = normalizza(p.cf);
    const tel = normalizza(p.telefono);
    const campoUnico = `${nomeCompleto} ${cf} ${tel}`;

    const tuttiCombaciano = tokens.every((t) =>
      tokenCombacia(t, nomeCompleto) || tokenCombacia(t, cf) || tokenCombacia(t, tel)
    );
    if (!tuttiCombaciano) continue;

    let score = 0;
    if (nomeCompleto.startsWith(q)) score = 100;
    else if (nomeCompleto.includes(q)) score = 80;
    else if (campoUnico.includes(q)) score = 60;
    else score = 30;
    risultati.push({ p, score });
  }
  return risultati.sort((a, b) => b.score - a.score).map((r) => r.p);
}

/**
 * Direzione opposta di cercaPazienti: invece di filtrare pazienti per una
 * query digitata, cerca QUALE paziente è nominato dentro un testo libero
 * (es. la causale di un bonifico su un estratto conto — "BONIFICO DA MARIO
 * ROSSI RIF FATTURA 123"). Richiede che sia nome sia cognome del paziente
 * compaiano come sottostringa nel testo normalizzato (match esatto, non
 * tollerante — il testo è già pulito dall'estrazione AI, non digitato a
 * mano). Se più di un paziente qualifica (es. due "Mario Rossi" diversi),
 * ritorna null: niente inferenza silenziosa in caso di ambiguità, meglio
 * lasciare la scelta a chi conferma (stesso principio di POL-FIN-003).
 */
export function trovaPazienteInTesto(patients, testo) {
  const t = normalizza(testo);
  if (!t) return null;
  const match = (patients || []).filter((p) => {
    const nome = normalizza(p.nome);
    const cognome = normalizza(p.cognome);
    return nome.length >= 2 && cognome.length >= 2 && t.includes(nome) && t.includes(cognome);
  });
  return match.length === 1 ? match[0] : null;
}
