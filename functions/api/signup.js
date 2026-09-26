import { validateSignup } from '../../src/validation.js';
import { errors } from '../../src/content/errors.js';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
});

function failure(request, code, status = 400, extra = {}) {
  const language = /^en(?:\b|-)/i.test(request.headers.get('Accept-Language') || '') ? 'en' : 'sr';
  return json({ success: false, error: errors[language][code] }, status, {
    'Content-Language': language,
    'X-Error-Code': code,
    Vary: 'Accept-Language',
    ...extra,
  });
}

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalidBody');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); throw new Error('large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Pages dispatches POST to this handler instead of the method fallback below.
export async function onRequestPost(context) {
  const { request } = context;
  try {
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return failure(request, 'origin', 403);
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return failure(request, 'contentType');
    let data;
    try { data = await readJson(request); }
    catch (error) { return failure(request, error.message === 'large' ? 'large' : 'invalidBody'); }
    const checked = validateSignup(data);
    if (checked.error) return failure(request, checked.errorCode);
    const { steamNick, description, mmr } = checked.value;
    const result = await context.env.DB.prepare(
      'INSERT INTO challengers (steam_nick, description, mmr) VALUES (?, ?, ?)',
    ).bind(steamNick, description, mmr).run();
    if (!result.success) throw new Error('Write failed');
    return json({ success: true });
  } catch {
    // Never return D1 messages, SQL, bindings, or stack traces to the browser.
    return json({ success: false, error: 'Internal server error' }, 500);
  }
}

// A specific onRequestPost export takes precedence; all other methods are rejected.
export function onRequest(context) {
  return failure(context.request, 'method', 405, { Allow: 'POST' });
}
