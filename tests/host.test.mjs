// Смена ведущего.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_LIST } from '../js/cases/index.js';
import { createGame, addPlayer, applyAction, canPlayFaceUp, viewFor, backupOf, takeOver, matchByHash, compareEpoch, normalize } from '../js/engine.js';

const cd = CASE_LIST[0];
const H = (s) => 'hash:' + s;

function game() {
  const state = createGame(cd, { secret: 'h', name: 'Аня' });
  addPlayer(state, { secret: 'b', name: 'Боря' });
  addPlayer(state, { secret: 'v', name: 'Вика' });
  for (const p of state.players) p.hash = H(p.secret);
  applyAction(state, cd, 'h', { type: 'start' });
  for (let i = 0; i < 4; i++) {
    const p = state.players[state.turn];
    const ok = p.hand.find((id) => canPlayFaceUp(state, cd, id));
    applyAction(state, cd, p.secret, ok ? { type: 'play', cardId: ok } : { type: 'archive', cardId: p.hand[0] });
  }
  return state;
}

test('в резервной копии нет секретов игроков', () => {
  const state = game();
  const json = JSON.stringify(backupOf(state));
  for (const s of ['"h"', '"b"', '"v"']) assert.ok(!json.includes('"secret":' + s));
  assert.ok(!json.includes('hostSecret'));
});

test('игрок становится ведущим по резервной копии и партия продолжается', () => {
  const state = game();
  const hands = Object.fromEntries(state.players.map((p) => [p.pid, [...p.hand]]));
  const res = takeOver(backupOf(state), 'b', H('b'));
  assert.ok(res.ok, res.error);
  const ns = res.state;
  const boris = ns.players.find((p) => p.name === 'Боря');
  assert.equal(ns.hostPid, boris.pid);
  assert.equal(ns.hostSecret, 'b');
  assert.ok(compareEpoch(ns, state) > 0, 'срок нового ведущего новее');
  assert.equal(viewFor(ns, cd, 'b').isHost, true);
  // остальные возвращаются по отпечатку
  assert.equal(matchByHash(ns, 'v', H('v')).name, 'Вика');
  assert.equal(matchByHash(ns, 'h', H('h')).name, 'Аня');
  assert.equal(matchByHash(ns, 'x', H('x')), null, 'чужой не пройдёт');
  for (const p of ns.players) assert.deepEqual(p.hand, hands[p.pid], 'карты на месте');
  assert.equal(viewFor(ns, cd, 'h').isHost, false, 'старый ведущий теперь обычный игрок');
  // доигрываем
  let guard = 0;
  while (ns.phase === 'play') {
    const p = ns.players[ns.turn];
    const ok = p.hand.find((id) => canPlayFaceUp(ns, cd, id));
    assert.ok(applyAction(ns, cd, p.secret, ok ? { type: 'play', cardId: ok } : { type: 'archive', cardId: p.hand[0] }).ok);
    assert.ok(++guard < 300);
  }
  assert.equal(ns.table.length + ns.archive.length, cd.cards.length);
});

test('посторонний не может стать ведущим', () => {
  assert.equal(takeOver(backupOf(game()), 'x', H('x')).ok, false);
});

test('ведущего нельзя убрать из комнаты, даже если он не первый', () => {
  const state = createGame(cd, { secret: 'h', name: 'Аня' });
  addPlayer(state, { secret: 'b', name: 'Боря' });
  for (const p of state.players) p.hash = H(p.secret);
  const ns = takeOver(backupOf(state), 'b', H('b')).state;
  matchByHash(ns, 'h', H('h'));
  const anya = ns.players.find((p) => p.name === 'Аня');
  const boris = ns.players.find((p) => p.name === 'Боря');
  assert.equal(applyAction(ns, cd, 'b', { type: 'kick', pid: boris.pid }).ok, false);
  assert.ok(applyAction(ns, cd, 'b', { type: 'kick', pid: anya.pid }).ok);
});

test('старое сохранённое состояние дополняется', () => {
  const state = createGame(cd, { secret: 'h', name: 'Аня' });
  delete state.hostPid; delete state.epoch; delete state.token;
  normalize(state);
  assert.equal(state.hostPid, state.players[0].pid);
  assert.equal(state.epoch, 1);
});
