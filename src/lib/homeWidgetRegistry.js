export const HOME_WIDGET_REGISTRY = Object.freeze([
  { id: 'agenda', ic: 'cal', label: 'Agenda oggi', category: 'Agenda', defaultVisible: true, defaultSize: 'wide', sizes: ['medium', 'wide'] },
  { id: 'consigli_ai', ic: 'compass', label: 'Consigli AI', category: 'AI', defaultVisible: true, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'todo', ic: 'okc', label: 'Attività e promemoria', category: 'Attività', defaultVisible: true, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'appuntamenti', ic: 'cal', label: 'Prossimi appuntamenti', category: 'Agenda', defaultVisible: true, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'wa', ic: 'wa', label: 'Reminder WhatsApp', category: 'Comunicazioni', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'economico', ic: 'eur', label: 'Pannello economico', category: 'Finanza legacy', permission: 'management_control', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'preventivi', ic: 'clip', label: 'Preventivi', category: 'Finanza', defaultVisible: false, defaultSize: 'medium', sizes: ['medium', 'wide'] },
  { id: 'richiami', ic: 'bell', label: 'Richiami', category: 'Pazienti/Clienti', defaultVisible: false, defaultSize: 'small', sizes: ['small', 'medium'] },
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
]);

const registryById = new Map(HOME_WIDGET_REGISTRY.map((widget) => [widget.id, widget]));

export const getHomeWidget = (id) => registryById.get(id) || null;

export const getHomeWidgetIdFromReactKey = (key) => String(key ?? '').replace(/^\.\$/, '');

export const createDefaultHomeLayout = () => HOME_WIDGET_REGISTRY.map((widget, order) => ({
  id: widget.id,
  order,
  visible: widget.defaultVisible,
  size: widget.defaultSize,
}));

export const normalizeHomeLayout = (value) => {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const item of raw) {
    const widget = item && getHomeWidget(item.id);
    if (!widget || seen.has(widget.id)) continue;
    seen.add(widget.id);
    normalized.push({
      id: widget.id,
      order: normalized.length,
      visible: item.visible !== false && item.attivo !== false,
      size: widget.sizes.includes(item.size) ? item.size : widget.defaultSize,
    });
  }
  for (const fallback of createDefaultHomeLayout()) {
    if (!seen.has(fallback.id)) normalized.push({ ...fallback, order: normalized.length });
  }
  return normalized;
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

export const serializeHomeLayout = (layout) => normalizeHomeLayout(layout).map(({ id, order, visible, size }) => ({ id, order, visible, size }));
