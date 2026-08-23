import { SIGNAL_TYPE } from './model.js';

export const SIGNAL_WEIGHTS = Object.freeze({
  [SIGNAL_TYPE.UNFINISHED_TREATMENT]: 45,
  [SIGNAL_TYPE.NO_FUTURE_APPOINTMENT]: 20,
  [SIGNAL_TYPE.RECALL_OVERDUE]: 40,
  [SIGNAL_TYPE.RECALL_DUE]: 30,
  [SIGNAL_TYPE.RECALL_OPEN]: 18,
  [SIGNAL_TYPE.HYGIENE_OVERDUE]: 35,
  [SIGNAL_TYPE.OPEN_ACTIVITY]: 24,
  [SIGNAL_TYPE.ACCEPTED_QUOTE_FOLLOW_UP]: 18,
  [SIGNAL_TYPE.MISSING_TREATMENT_PLAN]: 10,
  [SIGNAL_TYPE.MISSING_EXECUTION_STATUS]: 14,
  [SIGNAL_TYPE.MISSING_PLAN_STATUS]: 12,
  [SIGNAL_TYPE.EMPTY_ACCEPTED_PLAN]: 12,
  [SIGNAL_TYPE.HYGIENE_CONFIGURATION_MISSING]: 8,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function scoreSignals(signals) {
  if (!signals?.length) return { score: 0, confidence: 0 };
  const weighted = signals.map((signal) => ({
    signal,
    weight: SIGNAL_WEIGHTS[signal.type] ?? 0,
  }));
  const score = Math.min(100, weighted.reduce((sum, item) => sum + item.weight, 0));
  const totalWeight = weighted.reduce((sum, item) => sum + Math.max(1, item.weight), 0);
  const evidenceConfidence = weighted.reduce(
    (sum, item) => sum + clamp(item.signal.confidence ?? 1, 0, 1) * Math.max(1, item.weight),
    0
  ) / totalWeight;
  const penalty = Math.min(0.45, signals.reduce((sum, signal) => sum + (signal.confidencePenalty || 0), 0));
  return {
    score,
    confidence: Number(clamp(evidenceConfidence - penalty, 0.1, 1).toFixed(2)),
  };
}
