// Only SteamID64 is accepted. Do not accept profile URLs or vanity names here.
export const isSteamId64 = value => {
  if (typeof value !== 'string' || !/^\d{17}$/.test(value.trim())) return false;
  const id = BigInt(value.trim());
  return id >= 76561197960265728n && id <= 76561202255233023n;
};

const isVanityName = value => /^[A-Za-z0-9_.-]{1,64}$/.test(value);

export function parseSteamIdentity(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || input.length > 200) return null;
  if (isSteamId64(input)) return { steamId: input };
  if (!input.includes('/')) return !/^\d+$/.test(input) && isVanityName(input) ? { vanity: input } : null;
  let url;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== 'https:' || !['steamcommunity.com', 'www.steamcommunity.com'].includes(url.hostname)
    || url.port || url.username || url.password || url.search || url.hash) return null;
  const match = /^\/(id|profiles)\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return null;
  if (match[1] === 'profiles') return isSteamId64(match[2]) ? { steamId: match[2] } : null;
  return isVanityName(match[2]) ? { vanity: match[2] } : null;
}

export async function resolveSteamId(input, apiKey, fetchImpl = fetch) {
  const identity = parseSteamIdentity(input);
  if (!identity || !apiKey) throw new Error('Steam lookup unavailable');
  if (identity.steamId) return identity.steamId;
  const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('vanityurl', identity.vanity);
  url.searchParams.set('url_type', '1');
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Steam lookup unavailable');
  const result = (await response.json())?.response;
  return result?.success === 1 && isSteamId64(result.steamid) ? result.steamid : null;
}

export async function getSteamNickname(steamId, apiKey, fetchImpl = fetch) {
  if (!isSteamId64(steamId) || !apiKey) throw new Error('Steam lookup unavailable');
  const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('steamids', steamId);
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Steam lookup unavailable');
  const player = (await response.json())?.response?.players?.[0];
  if (!player || player.steamid !== steamId) return null;
  const nick = typeof player.personaname === 'string' ? player.personaname.trim() : '';
  return nick && nick.length <= 100 && !/[\u0000-\u001f\u007f]/.test(nick) ? nick : null;
}
