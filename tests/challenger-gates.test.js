import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, translations } from '../src/i18n.js';
import { createLayout } from '../src/layout.js';
import { createHeresyWarnings } from '../src/heresy-warnings.js';
import { PURSUIT_DURATION_MS, HERESY_WARNING_COUNT, pursuitRemainingMs, isPursuitLocked, createWarningSequence } from '../src/challenger-gates.js';

test('YES is locked for the complete 300 seconds, including the last millisecond', () => {
  const start = 1_800_000_000_000;
  assert.equal(PURSUIT_DURATION_MS, 300_000);
  for (const elapsed of [0, 1, 1000, 299_000, 299_999]) {
    assert.equal(isPursuitLocked(start, start + elapsed), true);
    assert.equal(pursuitRemainingMs(start, start + elapsed), 300_000 - elapsed);
  }
  for (const elapsed of [300_000, 300_001, 900_000]) {
    assert.equal(isPursuitLocked(start, start + elapsed), false);
    assert.equal(pursuitRemainingMs(start, start + elapsed), 0);
  }
});

test('reloading a saved start retains remaining time; missing/corrupt timestamps fail closed', () => {
  const start = 1_800_000_000_000;
  const restored = JSON.parse(JSON.stringify({ superiorityStartedAt: start }));
  assert.equal(pursuitRemainingMs(restored.superiorityStartedAt, start + 120_000), 180_000);
  for (const invalid of [undefined, null, 0, -1, NaN, Infinity, '0']) assert.equal(pursuitRemainingMs(invalid, start), 300_000);
  assert.equal(pursuitRemainingMs(start, start - 50_000), 300_000);
});

test('either answer requires five acknowledgments, preserves the choice, and cannot start parallel sequences', () => {
  for (const answer of ['yes', 'no']) {
    const warnings = createWarningSequence();
    assert.equal(warnings.begin(answer), true);
    assert.equal(warnings.begin(answer === 'yes' ? 'no' : 'yes'), false);
    for (let i = 0; i < 4; i++) {
      assert.equal(warnings.index, i);
      assert.equal(warnings.acknowledge(), null);
      assert.equal(warnings.active, true);
    }
    assert.equal(warnings.acknowledge(), answer);
    assert.equal(warnings.active, false);
    assert.equal(warnings.acknowledge(), null);
  }
});

test('canceling a warning never confirms an answer; retry starts at warning one', () => {
  const warnings = createWarningSequence();
  assert.equal(warnings.begin('invalid'), false);
  warnings.begin('yes');
  warnings.acknowledge();
  warnings.acknowledge();
  warnings.cancel();
  assert.equal(warnings.acknowledge(), null);
  assert.equal(warnings.begin('no'), true);
  assert.equal(warnings.index, 0);
});

class FakeElement extends EventTarget {
  textContent = '';
  style = {};
  focus() { this.focused = true; }
  click() { this.dispatchEvent(new Event('click')); }
}
class FakeDialog extends EventTarget {
  open = false;
  nodes = new Map();
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new FakeElement());
    return this.nodes.get(selector);
  }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}

test('custom dialog shows five localized messages and advances only after the fifth OK', () => {
  const dialog = new FakeDialog();
  const i18n = createI18n();
  const confirmed = [];
  const warnings = createHeresyWarnings({ dialog, i18n, onConfirm: answer => confirmed.push(answer) });
  const ok = dialog.querySelector('[data-warning-ok]');
  warnings.show('no');
  assert.equal(dialog.open, true);
  assert.equal(ok.focused, true);
  for (let i = 0; i < 5; i++) {
    assert.equal(dialog.querySelector('[data-warning-message]').textContent, translations.sr.signup.heresyWarnings.entries[i].message);
    assert.equal(confirmed.length, 0);
    ok.click();
  }
  assert.equal(dialog.open, false);
  assert.deepEqual(confirmed, ['no']);
  ok.click();
  assert.deepEqual(confirmed, ['no']);
  warnings.show('yes');
  ok.click();
  i18n.setLanguage('en');
  warnings.refresh();
  assert.equal(dialog.querySelector('[data-warning-count]').textContent, 'SEAL 2 / 5');
  assert.equal(dialog.querySelector('[data-warning-message]').textContent, translations.en.signup.heresyWarnings.entries[1].message);
  dialog.dispatchEvent(new Event('cancel'));
  dialog.close();
  assert.deepEqual(confirmed, ['no']);
  warnings.show('yes');
  assert.equal(dialog.querySelector('[data-warning-count]').textContent, 'SEAL 1 / 5');
});

test('both languages contain five warnings; dialog is not a form and countdown is not a live announcement every second', () => {
  for (const language of ['sr', 'en']) {
    assert.equal(translations[language].signup.heresyWarnings.entries.length, HERESY_WARNING_COUNT);
    const i18n = createI18n();
    i18n.setLanguage(language);
    const html = createLayout(i18n);
    assert.match(html, /<dialog id="heresy-dialog"[^>]*aria-labelledby="heresy-title"[^>]*aria-describedby="heresy-message"/);
    assert.match(html, /id="better-yes"[^>]*aria-disabled="true"/);
    assert.match(html, /id="pursuit-clock" role="timer" aria-live="off"/);
    assert.equal((html.match(/<form /g) || []).length, 1);
  }
});
