// UI theatrics, not an anti-spam/security boundary. No network or timers here.
export const PURSUIT_DURATION_MS = 300_000;
export const HERESY_WARNING_COUNT = 5;

export function pursuitRemainingMs(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || startedAt <= 0) return PURSUIT_DURATION_MS;
  return Math.max(0, PURSUIT_DURATION_MS - Math.max(0, now - startedAt));
}

export const isPursuitLocked = (startedAt, now = Date.now()) => pursuitRemainingMs(startedAt, now) > 0;

export function createWarningSequence() {
  let answer = null;
  let index = 0;
  return {
    get active() { return answer !== null; },
    get index() { return index; },
    begin(value) {
      if (answer !== null || value !== 'yes') return false;
      answer = value;
      index = 0;
      return true;
    },
    acknowledge() {
      if (answer === null) return null;
      index += 1;
      if (index < HERESY_WARNING_COUNT) return null;
      const confirmedAnswer = answer;
      answer = null;
      index = 0;
      return confirmedAnswer;
    },
    cancel() { answer = null; index = 0; },
  };
}
