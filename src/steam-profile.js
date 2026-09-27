// Only SteamID64 is accepted. Do not accept profile URLs or vanity names here.
export const isSteamId64 = value => typeof value === 'string'
  && /^7656119\d{10}$/.test(value.trim());

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
