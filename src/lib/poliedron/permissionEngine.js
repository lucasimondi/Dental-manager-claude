/* POL-AI-001 §12 — permission engine. Poliedron creates NO second
   authorization model: this module only re-exposes the exact gates
   MobileDock already enforced (feature flags + admin-only nav ids) and the
   existing capability-based `isQuickActionAllowed` from quickActionsCatalog
   (already used by Dashboard's own quick actions). Every result/action
   Poliedron offers is filtered through here; nothing bypasses RLS/RBAC —
   this is presentation-layer filtering only, the authoritative check
   remains server-side exactly as before. */

import { isQuickActionAllowed } from '../quickActionsCatalog.js';

// Same mapping MobileDock.jsx used before being superseded by Poliedron —
// moved here as the single source instead of duplicated.
export const FEATURE_GATE_BY_NAV_ID = Object.freeze({
  wa: 'whatsapp', spese: 'spese', archivio: 'archivio_documenti', controllo: 'controllo_gestione',
});
export const ADMIN_ONLY_NAV_IDS = Object.freeze(new Set(['agenteai']));

export const isNavItemAllowed = (id, { features = {}, isStudioAdmin = false } = {}) => {
  if (ADMIN_ONLY_NAV_IDS.has(id) && !isStudioAdmin) return false;
  const gate = FEATURE_GATE_BY_NAV_ID[id];
  return !gate || !!features[gate];
};

export const filterNavigationIndex = (index, permissionCtx) => index.filter((item) => isNavItemAllowed(item.id, permissionCtx));

// Action registry entries carry either a `quickAction` (reuse the existing
// capability/feature/vertical gate from quickActionsCatalog) or a `navId`
// (reuse the nav gate above) or neither (e.g. patient.open — gated only by
// the patient already being in the caller's own authorized `patients`
// list, which is itself RLS-scoped server-side).
export const isActionAllowed = (action, ctx) => {
  if (action.requiresActiveMember && ctx.quickActionCtx?.permissions?.activeMember !== true) return false;
  if (action.verticals && !action.verticals.includes(ctx.quickActionCtx?.vertical || ctx.vertical || 'dentistico')) return false;
  if (action.featureNotFalse && ctx.features?.[action.featureNotFalse] === false) return false;
  if (action.quickAction) return isQuickActionAllowed(action.quickAction, ctx.quickActionCtx || {});
  if (action.navId) return isNavItemAllowed(action.navId, ctx);
  return true;
};

export const filterActions = (actions, ctx) => actions.filter((action) => isActionAllowed(action, ctx));
