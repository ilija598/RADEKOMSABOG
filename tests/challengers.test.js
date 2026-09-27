import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/challengers.js';
import { onRequestPost } from '../functions/api/challengers/[id]/defeat.js';

test('concurrent verdicts and retries preserve the first timestamp', async () => {
  let stored = null, writes = 0;
  const context = { request: new Request('https://example.com/api/challengers/1/defeat', { method: 'POST', headers: { Origin: 'https://example.com' } }), params: { id: '1' }, env: { DB: {
    prepare(sql) { return { bind(id) {
      assert.equal(id, 1);
      return { first: async () => {
        if (sql.startsWith('UPDATE')) {
          assert.match(sql, /WHERE id = \? AND defeated_at IS NULL RETURNING defeated_at/);
          if (stored) return null;
          writes++;
          stored = { defeated_at: '2026-09-27 12:00:00' };
        }
        return stored;
      } };
    } }; },
  } } };
  const responses = await Promise.all(Array.from({ length: 10 }, () => onRequestPost(context)));
  for (const response of responses) assert.deepEqual(await response.json(), { success: true, defeatedAt: '2026-09-27 12:00:00' });
  assert.equal(writes, 1);
});

test('verdict rejects invalid IDs, foreign origins, missing records and conceals database errors', async () => {
  const request = new Request('https://example.com/api/challengers/1/defeat', { method: 'POST' });
  for (const id of ['0', '-1', 'abc', '1.5']) assert.equal((await onRequestPost({ request, params: { id }, env: {} })).status, 400);
  assert.equal((await onRequestPost({ request: new Request(request, { headers: { Origin: 'https://evil.com' } }), params: { id: '1' }, env: {} })).status, 403);
  assert.equal((await onRequestPost({ request, params: { id: '1' }, env: { DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } } })).status, 404);
  const response = await onRequestPost({ request, params: { id: '1' }, env: {} });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, error: 'Internal server error' });
});

test('public archive uses bounded pagination and an explicit projection', async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ id: 100 - i }));
  const response = await onRequestGet({ request: new Request('https://example.com/api/challengers?before=101'), env: { DB: {
    prepare(sql) {
      assert.doesNotMatch(sql, /SELECT\s+\*/i);
      assert.match(sql, /WHERE id < \? ORDER BY id DESC LIMIT 51/);
      return { bind(id) { assert.equal(id, 101); return { all: async () => ({ results: rows }) }; } };
    },
  } } });
  const data = await response.json();
  assert.equal(data.challengers.length, 50);
  assert.equal(data.next, 51);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('archive rejects invalid cursors and hides database exceptions', async () => {
  for (const value of ['0', '-1', '1.5', 'abc']) {
    assert.equal((await onRequestGet({ request: new Request(`https://example.com/api/challengers?before=${value}`), env: {} })).status, 400);
  }
  const response = await onRequestGet({ request: new Request('https://example.com/api/challengers'), env: {} });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { success: false, error: 'Internal server error' });
});
