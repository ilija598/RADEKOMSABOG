import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, onRequestPost } from '../functions/api/signup.js';
import { validateSignup } from '../src/validation.js';
import { submitSignup } from '../src/signup-api.js';
import { getSteamNickname, parseSteamIdentity, resolveSteamId } from '../src/steam-profile.js';

test('Steam nickname comes only from the fixed Steam API and matching ID', async () => {
  const steamId = '76561198000000000';
  const nick = await getSteamNickname(steamId, 'test-secret', async (url, options) => {
    assert.equal(url.hostname, 'api.steampowered.com');
    assert.equal(url.pathname, '/ISteamUser/GetPlayerSummaries/v2/');
    assert.equal(url.searchParams.get('steamids'), steamId);
    assert.equal(url.searchParams.get('key'), 'test-secret');
    assert.ok(options.signal);
    return Response.json({ response: { players: [{ steamid: steamId, personaname: '  Actual Steam Nick  ' }] } });
  });
  assert.equal(nick, 'Actual Steam Nick');
  assert.equal(await getSteamNickname(steamId, 'test-secret', async () => Response.json({ response: { players: [{ steamid: '76561198000000001', personaname: 'Impersonator' }] } })), null);
});

const valid = { steamIdentity: '76561198000000000', description: 'I am worthy of mid.', mmr: 5000, immortalWorthy: 'da', believesRadeMortal: 'ne', betterThanRade: 'da' };
const request = (body = valid, options = {}) => new Request('https://example.com/api/signup', {
  method: 'POST', ...options,
  headers: { 'Content-Type': 'application/json', Origin: 'https://example.com', ...options.headers },
  body: options.body ?? JSON.stringify(body),
});

test('accepts Steam profiles, vanity names, SteamID64 and MMR boundaries', () => {
  assert.ok(validateSignup({ ...valid, steamIdentity: '76561202255233023' }).value);
  assert.ok(validateSignup({ ...valid, steamIdentity: 'https://steamcommunity.com/id/sn0w98/' }).value);
  assert.ok(validateSignup({ ...valid, steamIdentity: 'sn0w98' }).value);
  assert.equal(validateSignup({ ...valid, steamIdentity: '76561202255233024' }).errorCode, 'steamIdentity');
  for (const mmr of [0, 20000]) {
    assert.deepEqual(validateSignup({ ...valid, steamIdentity: '  76561198000000000  ', description: '  Reason  ', mmr }).value, { ...valid, steamIdentity: '76561198000000000', description: 'Reason', mmr });
  }
});

test('invalid input always returns 400 and never reaches D1', async () => {
  const env = { DB: { prepare() { assert.fail('Invalid data reached D1'); } } };
  const invalid = [null, [], {}, { ...valid, steamIdentity: '' }, { ...valid, steamIdentity: '  ' }, { ...valid, steamIdentity: 'x'.repeat(65) }, { ...valid, steamIdentity: 'https://evil.example/id/sn0w98/' },
    ...['', '  ', 'x'.repeat(501), null, 123].map(description => ({ ...valid, description })),
    ...[-1, 20001, 0.5, '5000', null].map(mmr => ({ ...valid, mmr })),
  ];
  for (const input of invalid) {
    const response = await onRequestPost({ request: request(input), env });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['error', 'success']);
    assert.equal(body.success, false);
    assert.ok(body.error);
  }
});

test('malformed JSON, oversized body, content type, origin and method protections', async () => {
  for (const [req, status] of [
    [request(valid, { body: '{' }), 400],
    [request(valid, { headers: { 'Content-Type': 'text/plain' } }), 400],
    [request({ ...valid, description: 'x'.repeat(9000) }), 400],
    [request(valid, { headers: { Origin: 'https://evil.com' } }), 403],
  ]) assert.equal((await onRequestPost({ request: req, env: {} })).status, status);
  const get = onRequest({ request: new Request('https://example.com/api/signup') });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('Allow'), 'POST');
});

test('D1 writes are parameterized, trimmed and awaited before success', async () => {
  let finishWrite;
  let finished = false;
  const write = new Promise(resolve => { finishWrite = resolve; });
  const input = { ...valid, description: "  O'Brien; DROP TABLE challengers;--  " };
  const DB = { prepare(sql) {
    assert.equal(sql, 'INSERT INTO challengers (steam_nick, steam_id, description, mmr, immortal_worthy, believes_rade_mortal, better_than_rade) VALUES (?, ?, ?, ?, ?, ?, ?)');
    return { bind(...args) {
      assert.deepEqual(args, ['Steam Persona', input.steamIdentity, input.description.trim(), input.mmr, input.immortalWorthy, input.believesRadeMortal, input.betterThanRade]);
      return { run: () => write };
    } };
  } };
  const pending = onRequestPost({ request: request(input), env: { DB, STEAM_API_KEY: 'test-key' }, steamFetch: async () => Response.json({ response: { players: [{ steamid: input.steamIdentity, personaname: 'Steam Persona' }] } }) }).then(response => { finished = true; return response; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  finishWrite({ success: true });
  const response = await pending;
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { success: true });
});

test('missing bindings, exceptions and unsuccessful D1 writes return the exact generic 500', async () => {
  for (const env of [{}, { DB: { prepare() { throw new Error('SECRET DATABASE DETAILS'); } } },
    { DB: { prepare: () => ({ bind: () => ({ run: async () => ({ success: false, error: 'SECRET SQL' }) }) }) } },
    { DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('SECRET SQL'); } }) }) } },
  ]) {
    const response = await onRequestPost({ request: request(), env: { ...env, STEAM_API_KEY: 'test-key' }, steamFetch: async () => Response.json({ response: { players: [{ steamid: valid.steamIdentity, personaname: 'Steam Persona' }] } }) });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false, error: 'Internal server error' });
  }
});

test('frontend sends the six required fields as JSON to /api/signup', async () => {
  let calls = 0;
  const result = await submitSignup({ ...valid, steamNick: 'must not be sent' }, {
    language: 'en',
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, '/api/signup');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.equal(options.headers['Accept-Language'], 'en');
      assert.deepEqual(JSON.parse(options.body), valid);
      return Response.json({ success: true });
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 1);
});

test('frontend does not treat arbitrary 200 HTML, failed status or a false body as saved', async () => {
  for (const response of [new Response('<html>fallback</html>'), Response.json({ success: false }), Response.json({ success: true }, { status: 500 })]) {
    assert.deepEqual(await submitSignup(valid, { fetchImpl: async () => response }), { ok: false, code: 'unavailable' });
  }
  assert.deepEqual(await submitSignup(valid, { fetchImpl: async () => Response.json({ success: false, error: 'Bad link' }, { status: 400, headers: { 'X-Error-Code': 'steamIdentity' } }) }), { ok: false, code: 'steamIdentity' });
  assert.deepEqual(await submitSignup(valid, { fetchImpl: async () => { throw new TypeError('network'); } }), { ok: false, code: 'network' });
});

test('frontend timeout returns uncertainty instead of retrying the write', async () => {
  let calls = 0;
  const result = await submitSignup(valid, { timeoutMs: 1, fetchImpl: async (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  } });
  assert.deepEqual(result, { ok: false, code: 'timeout' });
  assert.equal(calls, 1);
});

test('all three answers must be literal da/ne, never booleans or defaults', async () => {
  for (const key of ['immortalWorthy', 'believesRadeMortal', 'betterThanRade']) {
    for (const value of [undefined, null, true, false, 0, 1, '', 'yes', 'no', 'DA']) {
      const response = await onRequestPost({ request: request({ ...valid, [key]: value }), env: { DB: { prepare() { assert.fail('Invalid answer reached DB'); } } } });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('X-Error-Code'), 'answers');
    }
    for (const value of ['da', 'ne']) assert.equal(validateSignup({ ...valid, [key]: value }).value[key], value);
  }
});

test('vanity resolution calls only the fixed Steam endpoint', async () => {
  const identity = 'https://steamcommunity.com/id/sn0w98/';
  assert.deepEqual(parseSteamIdentity(identity), { vanity: 'sn0w98' });
  assert.deepEqual(parseSteamIdentity('https://steamcommunity.com/profiles/76561198000000000/'), { steamId: '76561198000000000' });
  for (const input of ['http://steamcommunity.com/id/sn0w98/', 'https://steamcommunity.com.evil.test/id/sn0w98/', 'https://steamcommunity.com/groups/sn0w98', 'https://steamcommunity.com/id/sn0w98/extra', 'https://steamcommunity.com/id/sn0w98/?next=evil', 'https://user@steamcommunity.com/id/sn0w98/', 'javascript:alert(1)']) assert.equal(parseSteamIdentity(input), null);
  const result = await resolveSteamId(identity, 'test-secret', async url => {
    assert.equal(url.hostname, 'api.steampowered.com');
    assert.equal(url.pathname, '/ISteamUser/ResolveVanityURL/v1/');
    assert.equal(url.searchParams.get('vanityurl'), 'sn0w98');
    assert.equal(url.searchParams.get('url_type'), '1');
    return Response.json({ response: { success: 1, steamid: '76561198000000000' } });
  });
  assert.equal(result, '76561198000000000');
  assert.equal(await resolveSteamId('sn0w98', 'test-secret', async () => Response.json({ response: { success: 42 } })), null);
});
