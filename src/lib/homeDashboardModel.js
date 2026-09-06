import { createDefaultHomeLayout, normalizeHomeLayout } from './homeWidgetRegistry.js';

export const HOME_PRESETS = Object.freeze({
  // POL-UI-015 bugfix round 2: 'richiami' added — the new premium Richiami
  // widget was registered and fully functional but invisible by default
  // for the owner/admin role (the Product Owner's own likely test
  // account), since this preset never listed it. front_desk already had
  // it; clinician_fisio is left as its own narrow, deliberately minimal
  // clinical scope, unchanged.
  owner: Object.freeze(['fin_incassato', 'fin_prodotto', 'fin_margine_contribuzione', 'fin_ebitda', 'fin_break_even', 'fin_costi_fissi', 'fin_costi_variabili', 'fin_costo_orario', 'fin_ore_disponibili', 'agenda', 'todo', 'richiami']),
  // POL-UI-026 follow-up: 'preventivi' was merged into 'andamento_studio'
  // and removed from the registry — this preset referenced the old id, so
  // createRolePresetLayout's presetIds.has(item.id) check silently stopped
  // matching anything for front_desk (front_desk users lost the widget
  // entirely instead of getting the merged one).
  front_desk: Object.freeze(['agenda', 'appuntamenti', 'todo', 'richiami', 'wa', 'andamento_studio', 'scadenze']),
  clinician_fisio: Object.freeze(['agenda', 'appuntamenti', 'todo']),
});

export const normalizeHomeRole = (capabilities = []) => {
  const effective = new Set(Array.isArray(capabilities) ? capabilities : []);
  if (effective.has('home.owner')) return 'owner';
  if (effective.has('clinical.physiotherapist') || effective.has('clinical.personal_trainer')
    || effective.has('clinical.massage_therapist') || effective.has('clinical.general')) return 'clinician_fisio';
  if (effective.has('home.front_desk')) return 'front_desk';
  return null;
};

export const createRolePresetLayout = (capabilities = []) => {
  const preset = normalizeHomeRole(capabilities);
  if (!preset) return null;
  const presetIds = new Set(HOME_PRESETS[preset] || []);
  return createDefaultHomeLayout().map((item) => ({ ...item, visible: presetIds.has(item.id) }));
};

export const resolveDashboardLayout = ({ userLayout, studioLayout, roleLayout }) => {
  if (userLayout) return { layout: normalizeHomeLayout(userLayout), source: 'user' };
  if (studioLayout) return { layout: normalizeHomeLayout(studioLayout), source: 'studio' };
  if (roleLayout) return { layout: normalizeHomeLayout(roleLayout), source: 'role' };
  return { layout: createDefaultHomeLayout(), source: 'platform' };
};

export const buildHomePermissions = ({ membership, features, vertical }) => {
  const active = membership?.stato === 'attivo';
  const capabilities = new Set(active && Array.isArray(membership?.capabilities) ? membership.capabilities : []);
  return Object.freeze({
    activeMember: active,
    managementControl: capabilities.has('finance.management.read') && features?.controllo_gestione === true,
    physioClinicalSelectors: false,
    physioFullAccess: capabilities.has('clinical.physiotherapist'),
    physioOperationalAccess: capabilities.has('clinical.personal_trainer') || capabilities.has('clinical.massage_therapist'),
    clinicalContent: capabilities.has('clinical.general') || capabilities.has('clinical.physiotherapist')
      || capabilities.has('clinical.personal_trainer') || capabilities.has('clinical.massage_therapist'),
    capabilities: Object.freeze([...capabilities]),
    vertical,
  });
};

export const isWidgetAllowed = (widget, permissions) => {
  if (!permissions?.activeMember) return false;
  if (widget.permission === 'management_control') return permissions.managementControl === true;
  if (widget.permission === 'physio_contract') return permissions.physioClinicalSelectors === true;
  if (widget.verticals && !widget.verticals.includes(permissions.vertical)) return false;
  return true;
};

export const filterWidgetCatalog = (registry, permissions) => registry.filter((widget) => isWidgetAllowed(widget, permissions));

export const applyWidgetPermissions = (layout, registry, permissions) => {
  const allowed = new Set(filterWidgetCatalog(registry, permissions).map((widget) => widget.id));
  return normalizeHomeLayout(layout).map((item) => allowed.has(item.id) ? item : { ...item, visible: false });
};

const ymd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const resolveHomePeriod = (periodId, now = new Date()) => {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (periodId === 'previous_month') {
    return { id: periodId, label: 'Mese precedente', dateFrom: ymd(new Date(year, month - 1, 1)), dateTo: ymd(new Date(year, month, 0)) };
  }
  if (periodId === 'current_year') {
    return { id: periodId, label: 'Anno corrente', dateFrom: ymd(new Date(year, 0, 1)), dateTo: ymd(new Date(year, 11, 31)) };
  }
  return { id: 'current_month', label: 'Mese corrente', dateFrom: ymd(new Date(year, month, 1)), dateTo: ymd(new Date(year, month + 1, 0)) };
};
