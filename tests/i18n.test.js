import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, translations, lookup, LANGUAGE_KEY } from '../src/i18n.js';
import { createLayout } from '../src/layout.js';
import { radeQuotes, pickQuote } from '../src/content/quotes.js';
import { errors } from '../src/content/errors.js';
import { onRequest, onRequestPost } from '../functions/api/signup.js';

function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry !== null && typeof entry === 'object' ? keys(entry, path) : [path];
  });
}
test('complete bilingual dictionaries with Serbian Latin script and stable lore IDs', () => {
  assert.deepEqual(keys(translations.sr), keys(translations.en));
  for (const language of ['sr', 'en']) for (const key of keys(translations[language])) {
    const value = lookup(language, key);
    assert.equal(typeof value, 'string', key);
    assert.ok(value.trim(), `${language}.${key} is empty`);
  }
  assert.doesNotMatch(JSON.stringify(translations.sr), /\p{Script=Cyrillic}/u);
  for (const path of ['faq.entries', 'mythology.facts']) {
    const sr = lookup('sr', path).map(entry => entry.id);
    const en = lookup('en', path).map(entry => entry.id);
    assert.deepEqual(sr, en);
    assert.equal(new Set(sr).size, sr.length);
  }
});
test('defaults to Serbian, persists choices, ignores invalid choices, works without storage', () => {
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  const first = createI18n(storage);
  assert.equal(first.language, 'sr');
  assert.equal(first.t('hero.cta'), 'IZAZOVI FARAONA I OSVOJI 50E');
  first.setLanguage('en');
  assert.equal(store.get(LANGUAGE_KEY), 'en');
  assert.equal(createI18n(storage).language, 'en');
  first.setLanguage('de');
  assert.equal(first.language, 'en');
  const blocked = createI18n({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  assert.equal(blocked.language, 'sr');
  blocked.setLanguage('en');
  assert.equal(blocked.t('hero.cta'), 'CHALLENGE THE PHARAOH AND WIN 50E');
  assert.equal(createI18n().language, 'sr');
});
test('number formatting follows current language', () => {
  const i18n = createI18n();
  assert.equal(i18n.format(14882943112), '14.882.943.112');
  assert.equal(i18n.format(2.4, 1), '2,4');
  i18n.setLanguage('en');
  assert.equal(i18n.format(14882943112), '14,882,943,112');
  assert.equal(i18n.format(2.4, 1), '2.4');
});
test('single layout renders both languages with complete translation bindings and preserved form contract', () => {
  const i18n = createI18n();
  for (const language of ['sr', 'en']) {
    i18n.setLanguage(language);
    const html = createLayout(i18n);
    for (const match of html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)) assert.equal(typeof lookup(language, match[1]), 'string');
    assert.equal((html.match(/<form /g) || []).length, 1);
    assert.match(html, /id="challenge"/);
    assert.match(html, /class="[^"]*challenge-page[^"]*"/);
    assert.match(html, /href="#challenge"/);
    assert.equal((html.match(/class="[^"]*bait-cta/g) || []).length, 4);
    for (const bait of ['challenge', 'immortal', 'better', 'noob']) {
      assert.match(html, new RegExp(`data-i18n="bait\\.${bait}"`));
    }
    assert.doesNotMatch(html, /class="technology|class="mythology|class="archaeology|class="chess section/);
    assert.ok(html.indexOf('id="challenge"') < html.indexOf('id="why"'));
    assert.ok(html.indexOf('id="why"') < html.indexOf('id="failures"'));
    assert.ok(html.indexOf('id="failures"') < html.indexOf('id="faq"'));
    assert.equal((html.match(/<video /g) || []).length, 2);
    assert.equal((html.match(/preload="metadata"/g) || []).length, 2);
    for (const index of ['01', '02']) {
      assert.match(html, new RegExp(`/videos/failed-challenge-${index}\\.m4v`));
      assert.match(html, new RegExp(`/videos/failed-challenge-${index}\\.jpg`));
    }
    assert.match(html, /name="radekomsa-challenger"/);
    assert.doesNotMatch(html, /data-netlify|form-name/);
    for (const field of ['immortalWorthy', 'believesRadeMortal', 'betterThanRade', 'steamId', 'mmr', 'description', 'lieYesAttempts', 'superiorityEvades', 'submissionLanguage', 'submittedAt', 'website']) assert.match(html, new RegExp(`name="${field}"`));
    assert.equal((html.match(/class="form-step/g) || []).length, 5);
    assert.equal((html.match(/data-faq-id=/g) || []).length, translations[language].faq.entries.length);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'HTML IDs must remain unique');
    assert.doesNotMatch(html, /<audio|autoplay|undefined|\[object Object\]/);
  }
});
test('quotes are centralized, bilingual, audio-ready but silent; signup always wins', () => {
  assert.equal(new Set(radeQuotes.map(quote => quote.id)).size, radeQuotes.length);
  for (const quote of radeQuotes) {
    assert.ok(quote.sr && quote.en && quote.triggers.length);
    assert.equal(quote.audio, null);
  }
  for (const random of [0, .1, .5, .999]) assert.equal(pickQuote('signup', () => random).id, 'bezite-nobovi');
  for (const trigger of ['logo', 'chess', 'faq', 'oracle', 'badge', 'myth', 'decoration']) assert.ok(pickQuote(trigger).triggers.includes(trigger));
  assert.equal(pickQuote('unknown'), null);
});
test('API returns translated errors and stable codes without weakening validation', async () => {
  for (const language of ['sr', 'en']) {
    const request = new Request('https://example.com/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': language }, body: JSON.stringify({ steamId: '76561198000000000', description: 'A worthy challenger', mmr: 20001 }) });
    const response = await onRequestPost({ request, env: {} });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Content-Language'), language);
    assert.deepEqual(await response.json(), { success: false, error: errors[language].mmr });
  }
  const fallback = await onRequest({ request: new Request('https://example.com/api/signup'), env: {} });
  assert.equal((await fallback.json()).error, errors.sr.method);
});
