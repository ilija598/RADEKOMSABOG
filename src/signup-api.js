import { errors } from './content/errors.js';

// The UI owns its existing processing animation. This module only confirms persistence.
export async function submitSignup(payload, { language = 'sr', fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { steamNick, description, mmr } = payload;
    const response = await fetchImpl('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': language },
      body: JSON.stringify({ steamNick, description, mmr }),
      signal: controller.signal,
    });
    let result;
    try { result = await response.json(); } catch { return { ok: false, code: 'unavailable' }; }
    if (response.ok && result?.success === true) return { ok: true };
    const code = response.headers.get('X-Error-Code');
    return { ok: false, code: Object.hasOwn(errors.en, code) ? code : 'unavailable' };
  } catch (error) {
    return { ok: false, code: error.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timeout);
  }
}
