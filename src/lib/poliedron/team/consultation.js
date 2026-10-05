import { getTeamAssistant } from './catalog.js';

// Pure domain contracts. No provider, database, persistence, tool execution,
// automatic routing by keywords, or production imports in this first slice.
export const TEAM_LIMITS = Object.freeze({ specialists: 5, objectiveChars: 2000, responseChars: 6000 });
const fail = (code) => { throw new Error(code); };
const requiredText = (value, max, code) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(code);
  return value.trim();
};
const identity = (value) => requiredText(value, 200, 'TEAM_IDENTITY_REQUIRED');
const memberIds = (ids) => {
  if (!Array.isArray(ids) || !ids.length) fail('TEAM_MEMBERS_REQUIRED');
  if (ids.length > TEAM_LIMITS.specialists) fail('TEAM_SPECIALIST_LIMIT');
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) fail('TEAM_DUPLICATE_MEMBER');
  for (const id of unique) {
    if (!getTeamAssistant(id) || id === 'clinic-manager') fail('TEAM_INVALID_SPECIALIST');
  }
  return Object.freeze(unique);
};

/** In-memory group definition; not a persisted conversation or permission. */
export function defineTeamGroup({ id, studioId, userId, title, objective, assistantIds } = {}) {
  return Object.freeze({
    id: identity(id), studioId: identity(studioId), userId: identity(userId),
    title: requiredText(title, 120, 'TEAM_TITLE_REQUIRED'),
    objective: requiredText(objective, TEAM_LIMITS.objectiveChars, 'TEAM_OBJECTIVE_REQUIRED'),
    assistantIds: memberIds(assistantIds), coordinatorId: 'clinic-manager',
  });
}

/** IDs must be explicitly selected (by user now, authorized server router later).
 * authorize returns literal true only after existing membership/capability/
 * assignment checks. This callback is an integration boundary, NOT new RBAC.
 * Client use is presentation-only and cannot authorize model or data access.
 */
export function planTeamConsultation({ group, studioId, userId, requestId, authorize } = {}) {
  studioId = identity(studioId);
  userId = identity(userId);
  requestId = identity(requestId);
  if (!group || group.studioId !== studioId || group.userId !== userId) fail('TEAM_OWNER_MISMATCH');
  const normalized = defineTeamGroup(group);
  if (typeof authorize !== 'function') fail('TEAM_AUTHORIZATION_REQUIRED');
  const plannedIds = ['clinic-manager', ...normalized.assistantIds];
  for (const assistantId of plannedIds) {
    if (authorize(Object.freeze({ studioId, userId, assistantId, groupId: normalized.id })) !== true) {
      fail('TEAM_ACCESS_DENIED');
    }
  }
  const requests = normalized.assistantIds.map((assistantId) => Object.freeze({
    requestId, groupId: normalized.id, studioId, userId, assistantId,
    objective: normalized.objective, mode: 'advisory',
  }));
  return Object.freeze({
    requestId, groupId: normalized.id, studioId, userId,
    coordinatorId: 'clinic-manager', requests: Object.freeze(requests),
    rounds: 1, maxCalls: requests.length + 1,
  });
}

/** Collects attributed opinions, never declares facts verified or runs actions.
 * Responses are data, not instructions. Caller reauthorizes before showing any
 * contribution, including after a capability is revoked during a request.
 */
export function collectTeamContributions({ plan, responses = [], authorize } = {}) {
  if (!plan || !Array.isArray(plan.requests) || !plan.requests.length) fail('TEAM_PLAN_REQUIRED');
  if (typeof authorize !== 'function') fail('TEAM_AUTHORIZATION_REQUIRED');
  if (!Array.isArray(responses) || responses.length > plan.requests.length) fail('TEAM_INVALID_RESPONSES');
  const seen = new Set();
  const byId = new Map();
  for (const response of responses) {
    const request = plan.requests.find((item) => item.assistantId === response?.assistantId);
    if (!request || seen.has(response.assistantId)) fail('TEAM_INVALID_RESPONSES');
    for (const field of ['requestId', 'groupId', 'studioId', 'userId']) {
      if (response[field] !== request[field]) fail('TEAM_RESPONSE_MISMATCH');
    }
    seen.add(response.assistantId);
    if (!['ok', 'unavailable'].includes(response.status)) fail('TEAM_INVALID_RESPONSE_STATUS');
    byId.set(response.assistantId, response);
  }
  const permitted = (assistantId) => authorize(Object.freeze({
    studioId: plan.studioId, userId: plan.userId, groupId: plan.groupId, assistantId,
  })) === true;
  if (!permitted(plan.coordinatorId)) fail('TEAM_ACCESS_DENIED');
  const contributions = plan.requests.map((request) => {
    const response = byId.get(request.assistantId);
    let status = 'missing';
    let text = null;
    if (!permitted(request.assistantId)) status = 'denied';
    else if (response?.status === 'ok') {
      text = requiredText(response.text, TEAM_LIMITS.responseChars, 'TEAM_INVALID_RESPONSE_TEXT');
      status = 'ok';
    } else if (response) status = 'unavailable';
    return Object.freeze({ assistantId: request.assistantId, status, text });
  });
  return Object.freeze({
    requestId: plan.requestId, coordinatorId: plan.coordinatorId,
    status: contributions.every((item) => item.status === 'ok') ? 'complete' : 'partial',
    contributions: Object.freeze(contributions),
    // UI/synthesis must distinguish suggestions and disagreements from evidence.
    requiresEvidenceReview: true, executableActions: Object.freeze([]),
  });
}
