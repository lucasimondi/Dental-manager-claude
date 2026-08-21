/* POL-UX-002 section 6/8/9 — vertical semantic isolation for the Team UI.
   Separates the RBAC CAPABILITY (technical, authoritative, unchanged —
   still lives in studio_user_capabilities and is checked by the same
   code paths as before) from the DISPLAY LABEL the studio actually sees.
   A Dental studio must never see "Fisioterapista"/"Personal trainer"/
   "Massaggiatore"; a Physio studio must never see Dental-only wording.
   Adding a new vertical is one entry here, not a UI rewrite. */

// Capabilities every vertical can grant (reception + a generic "can do
// clinical work" toggle) — only the LABEL changes per vertical.
const UNIVERSAL_CAPABILITIES = ['home.front_desk', 'clinical.general'];

// Capabilities that only make sense for specific verticals — hidden as an
// offerable toggle everywhere else (still rendered, never hidden, if a
// user already holds one out of scope — see resolveTeamCapabilities below).
const VERTICAL_ONLY_CAPABILITIES = {
  fisioterapista: ['clinical.physiotherapist'],
  massofisioterapista: ['clinical.physiotherapist', 'clinical.massage_therapist'],
  massaggiatore: ['clinical.massage_therapist'],
  personal_trainer: ['clinical.personal_trainer'],
};

// capability -> { label, description } per vertical. 'default' covers any
// vertical without a specific entry (medico_chirurgo, psicologo,
// professionista_sanitario, altro, and dentistico's clinical.general).
const LABELS = {
  'home.front_desk': {
    default: { label: 'Segreteria', description: 'Gestisce agenda, pazienti e accoglienza, senza accesso ai dati clinici.' },
  },
  'clinical.general': {
    dentistico: { label: 'Odontoiatra', description: 'Può visualizzare e modificare i dati clinici odontoiatrici.' },
    fisioterapista: { label: 'Fisioterapista', description: 'Può visualizzare e modificare i dati clinici del paziente.' },
    massofisioterapista: { label: 'Fisioterapista', description: 'Può visualizzare e modificare i dati clinici del paziente.' },
    massaggiatore: { label: 'Operatore', description: 'Può visualizzare e modificare i dati clinici del paziente.' },
    personal_trainer: { label: 'Personal trainer', description: 'Può visualizzare e modificare i dati clinici del paziente.' },
    default: { label: 'Collaboratore clinico', description: 'Può visualizzare e modificare i dati clinici del paziente.' },
  },
  'clinical.physiotherapist': {
    default: { label: 'Fisioterapista', description: 'Accesso alla cartella Fisio dei pazienti a lui assegnati.' },
  },
  'clinical.massage_therapist': {
    default: { label: 'Massoterapista', description: 'Accesso alla cartella Fisio dei pazienti a lui assegnati (dato minimizzato).' },
  },
  'clinical.personal_trainer': {
    default: { label: 'Personal trainer', description: 'Accesso alla cartella Fisio dei pazienti a lui assegnati (dato minimizzato).' },
  },
  'finance.management.read': {
    default: { label: 'Controllo di gestione', description: 'Può accedere al controllo di gestione economico dello studio.' },
  },
};

const FALLBACK_LABEL = { label: 'Accesso specifico', description: 'Permesso attivo non associato al verticale corrente.' };

// POL-RBAC-002 — customLabel is the studio's own override (from
// studio_capability_labels, purely presentational, see
// docs/architecture/pol-ux-002-studio-capability-labels-design.md). It can
// only ever replace `label`: `description` (what the capability actually
// does) always stays the vertical-aware default, so a rename can never
// obscure the real meaning of a permission. An empty/whitespace override is
// treated as "not set" — the fallback chain is custom -> vertical default ->
// generic safe label, never a blank control.
export const getCapabilityPresentation = (capability, vertical, customLabel) => {
  const perVertical = LABELS[capability];
  const fallback = perVertical ? (perVertical[vertical] || perVertical.default || FALLBACK_LABEL) : FALLBACK_LABEL;
  const trimmed = typeof customLabel === 'string' ? customLabel.trim() : '';
  return trimmed ? { ...fallback, label: trimmed } : fallback;
};

// Capabilities an admin can offer/toggle for this vertical, in a stable,
// vertical-appropriate order. Real, already-granted capabilities outside
// this set are never hidden (see resolveTeamCapabilities) — this only
// controls what's offered as a *new* grant.
export const getOfferableCapabilities = (vertical) => [
  ...UNIVERSAL_CAPABILITIES,
  ...(VERTICAL_ONLY_CAPABILITIES[vertical] || []),
];

// Merges the offerable set for this vertical with any capability the user
// already holds (even if it's out of the current vertical's normal scope —
// e.g. the studio's vertical changed after the grant), so an active
// permission is never silently hidden from the admin managing it.
export const resolveTeamCapabilities = (vertical, heldCapabilities = []) => {
  const offered = getOfferableCapabilities(vertical);
  const extra = heldCapabilities.filter((c) => LABELS[c] && !offered.includes(c));
  return [...offered, ...extra];
};
