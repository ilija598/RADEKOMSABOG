import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChallenger } from '../src/validation.js';
import { pickEvasivePosition } from '../src/challenger-form.js';

const challenger = {
  immortalWorthy: 'yes',
  believesRadeMortal: 'no',
  betterThanRade: 'no',
  steamId: '76561198000000000',
  mmr: 5000,
  description: 'Dostojan sam jer sam tako odlučio.',
};
test('validates and normalizes the five-step challenger payload', () => {
  assert.deepEqual(validateChallenger({ ...challenger, steamId: '  76561198000000000  ', description: '  Kratak razlog.  ' }).value, { ...challenger, steamId: '76561198000000000', description: 'Kratak razlog.' });
  for (const field of ['immortalWorthy', 'believesRadeMortal', 'betterThanRade']) {
    assert.equal(validateChallenger({ ...challenger, [field]: '' }).errorCode, 'answers');
    assert.equal(validateChallenger({ ...challenger, [field]: 'maybe' }).errorCode, 'answers');
  }
  for (const steamId of ['', ' ', '123', '76561198000000000x', 'https://steamcommunity.com/profiles/76561198000000000']) assert.equal(validateChallenger({ ...challenger, steamId }).errorCode, 'steamId');
  for (const description of ['', ' ', 'x'.repeat(501), 'Rade\u0000']) assert.equal(validateChallenger({ ...challenger, description }).errorCode, 'description');
  for (const mmr of [-1, 20001, 1.5, '5000']) assert.equal(validateChallenger({ ...challenger, mmr }).errorCode, 'mmr');
});
test('an evasive answer is positioned outside the current pointer zone before it is rendered', () => {
  const rolls = [0, 0, 1, 1];
  const position = pickEvasivePosition({
    arenaWidth: 500,
    arenaHeight: 255,
    buttonWidth: 132,
    buttonHeight: 62,
    pointerX: 40,
    pointerY: 40,
    random: () => rolls.shift() ?? 1,
  });
  assert.deepEqual(position, { x: 354, y: 107 });

  const fallback = pickEvasivePosition({
    arenaWidth: 314,
    arenaHeight: 225,
    buttonWidth: 108,
    buttonHeight: 58,
    pointerX: 40,
    pointerY: 40,
    random: () => 0,
  });
  assert.ok(fallback.x > 40 + 20, 'fallback must clear the cursor and its safety buffer');
});
