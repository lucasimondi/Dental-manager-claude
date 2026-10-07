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
  return { groups: [], threads: {}, alertsSent: {} };
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
    const alertsSent = raw.alertsSent && typeof raw.alertsSent === 'object' ? raw.alertsSent : {};
    return { groups, threads, alertsSent };
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
  return { ...state, groups: state.groups.filter((g) => g.id !== groupId), threads };
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

/** Model history: the last answered user/assistant turns of this thread.
 *  Alerts start a thread with an assistant message and can follow each
 *  other, so leading assistant turns are dropped and consecutive turns of
 *  the same role are merged (the model expects user/assistant alternation). */
export function threadHistory(thread = []) {
  const turns = [];
  for (const m of thread) {
    if (!(m?.role === 'user' || m?.role === 'assistant') || typeof m.content !== 'string' || !m.content.trim() || m.failed) continue;
    const last = turns.at(-1);
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
    else turns.push({ role: m.role, content: m.content });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns.slice(-20);
}

/** Unread assistant messages in a thread. */
export const unreadIn = (thread = []) => thread.filter((m) => m?.unread).length;

export function markThreadRead(state, key) {
  const thread = state.threads[key];
  if (!thread?.some((m) => m.unread)) return state;
  return { ...state, threads: { ...state.threads, [key]: thread.map((m) => (m.unread ? { ...m, unread: false } : m)) } };
}

/** Append proactive alerts (and daily reminders) to their owners' chats. */
export function deliverAlerts(state, deliveries, nowIso, newId) {
  if (!deliveries.length) return state;
  let next = { ...state, alertsSent: { ...(state.alertsSent || {}) } };
  for (const { alert, reminder } of deliveries) {
    const key = `assistant:${alert.owner}`;
    next = appendMessage(next, key, {
      id: newId(),
      role: 'assistant',
      content: reminder ? `Promemoria — ${alert.text}` : alert.text,
      at: nowIso,
      unread: true,
      alert: { id: alert.id, kind: alert.kind, patientId: alert.patientId, patientName: alert.patientName, appointment: alert.appointment, actions: alert.actions },
    });
    const previous = next.alertsSent[alert.id];
    next.alertsSent[alert.id] = { at: nowIso, count: (previous?.count || 0) + 1, answered: false };
  }
  return next;
}

/** Record the answer: buttons disappear from every copy of the alert. */
export function answerAlert(state, alertId, answer) {
  const threads = {};
  for (const [key, thread] of Object.entries(state.threads)) {
    threads[key] = thread.some((m) => m.alert?.id === alertId && !m.answered)
      ? thread.map((m) => (m.alert?.id === alertId && !m.answered ? { ...m, answered: answer, unread: false } : m))
      : thread;
  }
  const previous = (state.alertsSent || {})[alertId] || {};
  return { ...state, threads, alertsSent: { ...(state.alertsSent || {}), [alertId]: { ...previous, answered: true } } };
}

/** Pending alerts no longer active (solved elsewhere) are closed quietly. */
export function closeSolvedAlerts(state, activeIds) {
  const active = new Set(activeIds);
  let next = state;
  for (const [id, record] of Object.entries(state.alertsSent || {})) {
    if (!record.answered && !active.has(id)) next = answerAlert(next, id, 'Risolto');
  }
  return next;
}

export const PARERE_LABEL = Object.freeze({ ok: null, non_disponibile: 'non disponibile' });
