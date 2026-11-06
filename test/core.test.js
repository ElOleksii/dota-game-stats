const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../renderer/core.js');

test('parseAccountInput: all formats give the same Steam32 ID', () => {
  const expected = '86745912';
  for (const input of [
    '86745912',
    '76561198047011640',
    'https://steamcommunity.com/profiles/76561198047011640/',
    'https://www.opendota.com/players/86745912',
    'https://www.dotabuff.com/players/86745912/matches',
    'https://stratz.com/players/86745912',
    '[U:1:86745912]',
    '  86745912  ',
  ]) {
    assert.deepEqual(core.parseAccountInput(input), { id: expected }, input);
  }
});

test('parseAccountInput: errors', () => {
  assert.ok(core.parseAccountInput('').error);
  assert.ok(core.parseAccountInput('https://steamcommunity.com/id/somename').error);
  assert.ok(core.parseAccountInput('hello').error);
  assert.ok(core.parseAccountInput('0').error);
  assert.ok(core.parseAccountInput('99999999999').error); // > 2^32 but not a Steam64 ID
});

test('isWin: Radiant/Dire', () => {
  assert.equal(core.isWin({ player_slot: 0, radiant_win: true }), true);
  assert.equal(core.isWin({ player_slot: 4, radiant_win: false }), false);
  assert.equal(core.isWin({ player_slot: 128, radiant_win: false }), true);
  assert.equal(core.isWin({ player_slot: 132, radiant_win: true }), false);
  assert.equal(core.isWin({ player_slot: 1, radiant_win: null }), null);
});

test('filterToday + summarize', () => {
  const now = new Date(2026, 10, 6, 15, 0, 0);
  const midnight = new Date(2026, 10, 6, 0, 0, 0).getTime() / 1000;
  const matches = [
    { start_time: midnight - 60, player_slot: 0, radiant_win: true },   // yesterday
    { start_time: midnight, player_slot: 0, radiant_win: true },        // W
    { start_time: midnight + 3600, player_slot: 130, radiant_win: true }, // L
    { start_time: midnight + 7200, player_slot: 130, radiant_win: false }, // W
    { start_time: midnight + 9000, player_slot: 2, radiant_win: null },  // unknown
  ];
  const today = core.filterToday(matches, now);
  assert.equal(today.length, 4);
  assert.deepEqual(core.summarize(today), { wins: 2, losses: 1, total: 3, winrate: 67 });
  assert.deepEqual(core.summarize([]), { wins: 0, losses: 0, total: 0, winrate: null });
});

test('formatDuration', () => {
  assert.equal(core.formatDuration(2405), '40:05');
  assert.equal(core.formatDuration(59), '0:59');
});
