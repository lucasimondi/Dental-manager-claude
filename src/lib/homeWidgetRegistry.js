/* POL-UI-013 §5: each entry supports id/title(label)/visible(defaultVisible)/
   order(assigned by createDefaultHomeLayout)/size(defaultSize)/minSize/
   maxSize/permission — minSize/maxSize are derived below from `sizes`
   (already every widget's real allowed range) rather than hand-duplicated,
   so they can never drift out of sync with it. `sizes` values are
   internal/persisted ('small'|'medium'|'wide') for backward compatibility
   with already-saved layouts; the user-facing labels are small/medium/
   large (see WidgetWorkspace.jsx's S/M/L buttons) — 'wide' is presented
   as "grande/L", never renamed in the data itself. There is intentionally
   no `component` field: today each widget's markup is rendered inline in
   Dashboard.jsx keyed by `id`, not dispatched from a component reference
   in this registry — documented as a Phase 2 follow-up, not faked here. */
const withSizeBounds = (widget) => ({ ...widget, minSize: widget.sizes[0], maxSize: widget.sizes[widget.sizes.length - 1] });

const RAW_HOME_WIDGET_REGISTRY = [
  { id: 'agenda', ic: 'cal', label: 'Agenda oggi', category: 'Agenda', defaultVisible: true, defaultSize: 'wide', sizes: ['medium', 'wide'] },
  { id: 'consigli_ai', ic: 'compass', label: 'Consigli Poliedron', category: 'AI', variant: 'poliedron', defaultVisible: true, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'todo', ic: 'okc', label: 'Attività e promemoria', category: 'Attività', defaultVisible: true, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'appuntamenti', ic: 'cal', label: 'Prossimi appuntamenti', category: 'Agenda', defaultVisible: true, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'wa', ic: 'wa', label: 'Reminder WhatsApp', category: 'Comunicazioni', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'economico', ic: 'eur', label: 'Pannello economico', category: 'Finanza legacy', permission: 'management_control', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'preventivi', ic: 'clip', label: 'Preventivi', category: 'Finanza', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  // POL-UI-015 bugfix round 2: was defaultVisible:false, which combined
  // with the owner-role preset also excluding it meant this widget's own
  // rendering was fully correct but it was never actually shown to a
  // studio owner/admin's Dashboard by default — reported as "il widget
  // Richiami non compare". Now visible out of the box for any user whose
  // role doesn't resolve a specific preset too (createRolePresetLayout
  // returns null -> platform default -> this flag).
  // POL-UI-015 bugfix round 3: this flag and the owner role preset are
  // BOTH unreachable for an account that already has a saved personal
  // layout — `resolveDashboardLayout` gives `userLayout` absolute
  // precedence, and `normalizeHomeLayout`'s defaultVisible fallback only
  // applies to widget ids MISSING from that saved layout. See
  // `migrateSavedHomeLayout` below for the actual root-cause fix.
  { id: 'richiami', ic: 'bell', label: 'Richiami', category: 'Pazienti/Clienti', defaultVisible: true, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'scadenze', ic: 'cal', label: 'Scadenze pagamento', category: 'Finanza', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'ortodonzia', ic: 'tooth', label: 'Ortodonzia', category: 'Clinica', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fisio', ic: 'pulse', label: 'Fisioterapia', category: 'Clinica', permission: 'physio_contract', verticals: ['fisioterapista', 'massofisioterapista'], defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'statistiche', ic: 'chart', label: 'Statistiche', category: 'KPI legacy', permission: 'management_control', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'grafici', ic: 'trend', label: 'Grafici e andamento', category: 'KPI legacy', permission: 'management_control', defaultVisible: false, defaultSize: 'wide', sizes: ['medium', 'wide'] },
  { id: 'fin_preventivato', ic: 'clip', label: 'Preventivato netto', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_accettato', ic: 'ok', label: 'Accettato', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_prodotto', ic: 'trend', label: 'Prodotto', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_fatturato', ic: 'doc', label: 'Fatturato', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_incassato', ic: 'eur', label: 'Incassato', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_credito_clienti', ic: 'cal', label: 'Credito clienti', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_costi_fissi', ic: 'home', label: 'Costi fissi operativi', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_costi_variabili', ic: 'box', label: 'Costi variabili', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_margine_contribuzione', ic: 'chart', label: 'Margine di contribuzione', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_ebitda', ic: 'trend', label: 'EBITDA gestionale', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_break_even', ic: 'target', label: 'Break-even', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_costo_orario', ic: 'clk', label: 'Costo orario struttura', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_ore_disponibili', ic: 'clk', label: 'Ore disponibili', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_produzione_ora', ic: 'pulse', label: 'Produzione/ora', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'fin_incasso_ora', ic: 'eur', label: 'Incasso/ora', category: 'Finanza canonica', permission: 'management_control', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
  { id: 'quick_actions', ic: 'zap', label: 'Azioni rapide', category: 'Azioni', defaultVisible: true, defaultSize: 'wide', sizes: ['medium', 'wide'] },
];

export const HOME_WIDGET_REGISTRY = Object.freeze(RAW_HOME_WIDGET_REGISTRY.map(withSizeBounds));

const registryById = new Map(HOME_WIDGET_REGISTRY.map((widget) => [widget.id, widget]));

export const getHomeWidget = (id) => registryById.get(id) || null;

export const getHomeWidgetIdFromReactKey = (key) => String(key ?? '').replace(/^\.\$/, '');

export const createDefaultHomeLayout = () => HOME_WIDGET_REGISTRY.map((widget, order) => ({
  id: widget.id,
  order,
  visible: widget.defaultVisible,
  size: widget.defaultSize,
}));

/* POL-UX-001: `config` is an optional, per-widget-instance payload (only
   the quick_actions widget uses it today, to persist which actions the
   user chose and in what order — see quickActionsCatalog.js). Omitted
   entirely when absent so existing layouts and their {id,order,visible,
   size}-only shape keep working unchanged. */
export const normalizeHomeLayout = (value) => {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const item of raw) {
    const widget = item && getHomeWidget(item.id);
    if (!widget || seen.has(widget.id)) continue;
    seen.add(widget.id);
    const entry = {
      id: widget.id,
      order: normalized.length,
      visible: item.visible !== false && item.attivo !== false,
      size: widget.sizes.includes(item.size) ? item.size : widget.defaultSize,
    };
    if (item.config && typeof item.config === 'object' && !Array.isArray(item.config)) entry.config = item.config;
    normalized.push(entry);
  }
  for (const fallback of createDefaultHomeLayout()) {
    if (!seen.has(fallback.id)) normalized.push({ ...fallback, order: normalized.length });
  }
  return normalized;
};

/* POL-UI-015 bugfix round 3 — REAL root cause of "il widget Richiami non
   compare" in preview #51, proven against the production database (read
   only): the reporting account's `user_home_layouts` row, last written
   2026-08-19 (i.e. before this task's branch existed), contains an
   EXPLICIT `{id:'richiami', visible:false}` entry inherited from the old
   pre-POL-UI-015 Richiami StatCard. Because `resolveDashboardLayout`
   returns `{source:'user'}` for any account with a saved layout, and
   `normalizeHomeLayout` only falls back to `defaultVisible` for ids that
   are ABSENT, neither round-2 fix (registry `defaultVisible:true`, nor
   `HOME_PRESETS.owner` gaining `'richiami'`) can ever reach that account.
   Round 2's browser QA started from an empty fake store, so it never had
   a pre-existing saved layout and could not observe this.

   The fix must not reset the user's other personalizations, so it is
   deliberately narrow and one-shot: only layouts written by a registry
   generation that predates POL-UX-001 — detectable with zero schema
   change because they cannot contain the `quick_actions` sentinel widget
   introduced by it — have the widgets listed in
   `POL_UI_015_REDEFAULTED_WIDGET_IDS` re-defaulted to their registry
   `defaultVisible`. Every other entry (visibility, order, size, config)
   is preserved exactly. It is idempotent by construction: the first
   successful save writes the full current registry, `quick_actions`
   included, after which this migration is a no-op forever and a user who
   then deliberately hides Richiami keeps it hidden. `size` is left
   untouched on purpose — only the visibility the old UI could not have
   expressed an informed choice about is re-defaulted. */
export const HOME_LAYOUT_MODERN_SENTINEL_ID = 'quick_actions';
export const POL_UI_015_REDEFAULTED_WIDGET_IDS = Object.freeze(['richiami']);

export const isLegacySavedHomeLayout = (value) => {
  const raw = Array.isArray(value) ? value : [];
  return raw.length > 0 && !raw.some((item) => item && item.id === HOME_LAYOUT_MODERN_SENTINEL_ID);
};

export const migrateSavedHomeLayout = (value) => {
  if (!isLegacySavedHomeLayout(value)) return normalizeHomeLayout(value);
  return normalizeHomeLayout(value.map((item) => {
    if (!item || !POL_UI_015_REDEFAULTED_WIDGET_IDS.includes(item.id)) return item;
    const widget = getHomeWidget(item.id);
    return widget ? { ...item, visible: widget.defaultVisible } : item;
  }));
};

export const moveHomeWidget = (layout, sourceId, targetId) => {
  const next = normalizeHomeLayout(layout);
  const sourceIndex = next.findIndex((item) => item.id === sourceId);
  const targetIndex = next.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return next;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next.map((item, order) => ({ ...item, order }));
};

export const moveHomeWidgetByOffset = (layout, id, offset) => {
  const next = normalizeHomeLayout(layout);
  const visible = next.filter((item) => item.visible);
  const sourceIndex = visible.findIndex((item) => item.id === id);
  const target = visible[sourceIndex + offset];
  return sourceIndex < 0 || !target ? next : moveHomeWidget(next, id, target.id);
};

export const setHomeWidgetVisibility = (layout, id, visible) => normalizeHomeLayout(layout)
  .map((item) => item.id === id ? { ...item, visible: Boolean(visible) } : item);

export const setHomeWidgetSize = (layout, id, size) => normalizeHomeLayout(layout).map((item) => {
  const widget = getHomeWidget(item.id);
  return item.id === id && widget?.sizes.includes(size) ? { ...item, size } : item;
});

export const setHomeWidgetConfig = (layout, id, config) => normalizeHomeLayout(layout).map((item) => item.id === id ? { ...item, config } : item);

export const serializeHomeLayout = (layout) => normalizeHomeLayout(layout).map(({ id, order, visible, size, config }) =>
  config ? { id, order, visible, size, config } : { id, order, visible, size });
