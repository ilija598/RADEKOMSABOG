const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function onRequestGet({ request, env }) {
  try {
    const raw = new URL(request.url).searchParams.get('before');
    const before = raw === null ? Number.MAX_SAFE_INTEGER : Number(raw);
    if (!Number.isSafeInteger(before) || before < 1) return json({ success: false }, 400);
    // Explicit public fields prevent future private columns from leaking into this API.
    const { results } = await env.DB.prepare(`SELECT id, steam_nick, description, mmr, created_at,
      immortal_worthy, believes_rade_mortal, better_than_rade, defeated_at
      FROM challengers WHERE id < ? ORDER BY id DESC LIMIT 51`).bind(before).all();
    const challengers = results.slice(0, 50);
    return json({ success: true, challengers, next: results.length > 50 ? challengers.at(-1).id : null });
  } catch { return json({ success: false, error: 'Internal server error' }, 500); }
}

export function onRequest() { return json({ success: false }, 405); }
