import { errors } from './content/errors.js';

const invalid = errorCode => ({ errorCode, error: errors.en[errorCode] });

export function validateSignup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return invalid('invalidBody');
  const { steamNick, description, mmr } = data;
  if (typeof steamNick !== 'string' || !steamNick.trim() || steamNick.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(steamNick)) return invalid('nick');
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(description)) return invalid('description');
  if (!Number.isInteger(mmr) || mmr < 0 || mmr > 20000) return invalid('mmr');
  return { value: { steamNick: steamNick.trim(), description: description.trim(), mmr } };
}

export function validateChallenger(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return invalid('invalidBody');
  for (const name of ['immortalWorthy', 'believesRadeMortal', 'betterThanRade']) {
    if (data[name] !== 'yes' && data[name] !== 'no') return invalid('answers');
  }
  if (typeof data.challengerName !== 'string' || !data.challengerName.trim() || data.challengerName.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(data.challengerName)) return invalid('challengerName');
  if (!Number.isInteger(data.mmr) || data.mmr < 0 || data.mmr > 20000) return invalid('mmr');
  if (typeof data.description !== 'string' || !data.description.trim() || data.description.trim().length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data.description)) return invalid('description');
  return {
    value: {
      immortalWorthy: data.immortalWorthy,
      believesRadeMortal: data.believesRadeMortal,
      betterThanRade: data.betterThanRade,
      challengerName: data.challengerName.trim(),
      mmr: data.mmr,
      description: data.description.trim(),
    },
  };
}
