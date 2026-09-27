const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function onRequestPost({ request, params, env }) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return json({ success: false }, 400);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ success: false }, 403);
  try {
    // Atomic compare-and-set: concurrent clicks can never replace the first verdict.
    const updated = await env.DB.prepare(`UPDATE challengers SET defeated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND defeated_at IS NULL RETURNING defeated_at`).bind(id).first();
    if (updated) return json({ success: true, defeatedAt: updated.defeated_at });
    // Retries after a timeout return the original verdict instead of modifying it.
    const existing = await env.DB.prepare('SELECT defeated_at FROM challengers WHERE id = ?').bind(id).first();
    if (!existing) return json({ success: false }, 404);
    if (!existing.defeated_at) throw new Error('Missing verdict');
    return json({ success: true, defeatedAt: existing.defeated_at });
  } catch { return json({ success: false, error: 'Internal server error' }, 500); }
}

export function onRequest() { return json({ success: false }, 405); }
