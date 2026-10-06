/* POL-AI-010 — "come se lo dicessi a una persona": while Poliedron shows a
   pending confirmation, a short typed reply decides it, exactly like the
   Conferma / Non procedere buttons. Only a whole-message match counts, so a
   new request that merely starts with "sì, ma..." is never taken as a yes. */
const SI = /^(s[iìí]|ok|okay|confermo|conferma|procedi|vai|va bene|certo|esatto|perfetto)[\s.!👍]*$/iu;
const NO = /^(no|annulla|non procedere|lascia stare|lascia perdere|stop|niente)[\s.!]*$/iu;

export function decisioneConferma(testo) {
  const t = String(testo || '').trim();
  if (SI.test(t)) return 'conferma';
  if (NO.test(t)) return 'annulla';
  return null;
}
