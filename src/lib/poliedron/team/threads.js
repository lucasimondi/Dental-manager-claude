import { TEAM_ASSISTANTS } from './catalog.js';
import { defineTeamGroup } from './consultation.js';

// POL-AI-TEAM-002: conversations with the team and the user's groups.
// Kept on this device for now (per studio and user); server persistence needs
// its own schema/RLS review. Data only: nothing here grants access — the
// server re-checks every request and gives the team read-only tools.
export const MAX_THREAD_MESSAGES = 60;
const storageKey = (studioId, userId) => `poliedron-team:v1:${studioId}:${userId}`;

export const contactKey = (contact) => (contact.kind === 'group' ? `group:${contact.id}` : `assistant:${contact.id}`);

export function emptyTeamState() {
  return { groups: [], threads: {} };
}

export function loadTeamState(storage, studioId, userId) {
  if (!studioId || !userId) return emptyTeamState();
  try {
    const raw = JSON.parse(storage?.getItem(storageKey(studioId, userId)) || 'null');
    if (!raw || typeof raw !== 'object') return emptyTeamState();
    const groups = Array.isArray(raw.groups) ? raw.groups.filter((g) => {
      try { defineTeamGroup({ ...g, studioId, userId }); return true; } catch { return false; }
    }) : [];
    const threads = raw.threads && typeof raw.threads === 'object' ? raw.threads : {};
    return { groups, threads };
  } catch {
    return emptyTeamState();
  }
}

export function saveTeamState(storage, studioId, userId, state) {
  if (!studioId || !userId) return;
  try { storage?.setItem(storageKey(studioId, userId), JSON.stringify(state)); } catch { /* best effort */ }
}

/** Contacts: Clinic Manager first, then specialists, then the user's groups. */
export function teamContacts(state) {
  return [
    ...TEAM_ASSISTANTS.map((a) => ({ kind: 'assistant', id: a.id, label: a.label, description: a.responsibility })),
    ...state.groups.map((g) => ({ kind: 'group', id: g.id, label: g.title, description: g.objective, assistantIds: g.assistantIds })),
  ];
}

export function addGroup(state, { title, objective, assistantIds }, { studioId, userId, id }) {
  const group = defineTeamGroup({ id, studioId, userId, title, objective, assistantIds });
  return { ...state, groups: [...state.groups, { id: group.id, title: group.title, objective: group.objective, assistantIds: [...group.assistantIds] }] };
}

export function removeGroup(state, groupId) {
  const threads = { ...state.threads };
  delete threads[`group:${groupId}`];
  return { groups: state.groups.filter((g) => g.id !== groupId), threads };
}

export function appendMessage(state, key, message) {
  const thread = [...(state.threads[key] || []), message].slice(-MAX_THREAD_MESSAGES);
  return { ...state, threads: { ...state.threads, [key]: thread } };
}

/** The `team` part of the request for a contact. */
export function teamRequestFor(contact) {
  if (contact.kind === 'group') {
    return { assistente: 'clinic-manager', membri: [...contact.assistantIds], titolo: contact.label, obiettivo: contact.description || undefined };
  }
  return { assistente: contact.id };
}

/** Model history: the last answered user/assistant turns of this thread. */
export function threadHistory(thread = []) {
  return thread
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() && !m.failed)
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));
}

export const PARERE_LABEL = Object.freeze({ ok: null, non_disponibile: 'non disponibile' });
