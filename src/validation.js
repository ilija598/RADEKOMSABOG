import { parseSteamIdentity } from './steam-profile.js';
import { errors } from './content/errors.js';

const invalid = errorCode => ({ errorCode, error: errors.en[errorCode] });

export function validateSignup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return invalid('invalidBody');
  const { steamIdentity, description, mmr } = data;
  if (!parseSteamIdentity(steamIdentity)) return invalid('steamIdentity');
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(description)) return invalid('description');
  if (!Number.isInteger(mmr) || mmr < 0 || mmr > 20000) return invalid('mmr');
  const { immortalWorthy, believesRadeMortal, betterThanRade } = data;
  for (const answer of [immortalWorthy, believesRadeMortal, betterThanRade]) {
    if (answer !== 'da' && answer !== 'ne') return invalid('answers');
  }
  return { value: { steamIdentity: steamIdentity.trim(), description: description.trim(), mmr, immortalWorthy, believesRadeMortal, betterThanRade } };
}

export function validateChallenger(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return invalid('invalidBody');
  for (const name of ['immortalWorthy', 'believesRadeMortal', 'betterThanRade']) {
    if (data[name] !== 'yes' && data[name] !== 'no') return invalid('answers');
  }
  if (!parseSteamIdentity(data.steamIdentity)) return invalid('steamIdentity');
  if (!Number.isInteger(data.mmr) || data.mmr < 0 || data.mmr > 20000) return invalid('mmr');
  if (typeof data.description !== 'string' || !data.description.trim() || data.description.trim().length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data.description)) return invalid('description');
  return {
    value: {
      immortalWorthy: data.immortalWorthy,
      believesRadeMortal: data.believesRadeMortal,
      betterThanRade: data.betterThanRade,
      steamIdentity: data.steamIdentity.trim(),
      mmr: data.mmr,
      description: data.description.trim(),
    },
  };
}
