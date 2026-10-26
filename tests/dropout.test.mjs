// Вылет игрока посреди партии и возвращение.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_LIST } from '../js/cases/index.js';
import { createGame, addPlayer, applyAction, canPlayFaceUp, setOnline, claimSeat, viewFor } from '../js/engine.js';

const cd = CASE_LIST[0];

function game(n) {
  const state = createGame(cd, { secret: 'h', name: 'Ведущий' });
  for (let i = 1; i < n; i++) addPlayer(state, { secret: 's' + i, name: 'Игрок ' + i });
  applyAction(state, cd, 'h', { type: 'start' });
  return state;
}

function turnOnce(state) {
  const p = state.players[state.turn];
  const playable = p.hand.filter((id) => canPlayFaceUp(state, cd, id));
  const res = playable.length
    ? applyAction(state, cd, p.secret, { type: 'play', cardId: playable[0] })
    : applyAction(state, cd, p.secret, { type: 'archive', cardId: p.hand[0] });
  assert.ok(res.ok, res.error);
}

// Играем, а вылетевшего ведущий убирает, когда до него доходит ход.
function playWithDrop(state) {
  let guard = 0;
  while (state.phase === 'play') {
    const p = state.players[state.turn];
    if (!p.online) {
      assert.ok(applyAction(state, cd, 'h', { type: 'drop', pid: p.pid }).ok);
    } else {
      turnOnce(state);
    }
    assert.ok(++guard < 500, 'партия не заканчивается');
  }
}

test('партию можно доиграть, если игрок вылетел и не вернулся', () => {
  for (let r = 0; r < 30; r++) {
    const state = game(4);
    for (let i = 0; i < 5; i++) turnOnce(state);
    setOnline(state, 's2', false, cd);
    playWithDrop(state);
    assert.equal(state.phase, 'questions');
    assert.equal(state.table.length + state.archive.length, cd.cards.length, 'ни одна карта не потерялась');
  }
});

test('карты вылетевшего раздаются остальным', () => {
  const state = game(3);
  const gone = state.players[2];
  const before = state.players[0].hand.length + state.players[1].hand.length;
  const count = gone.hand.length;
  setOnline(state, gone.secret, false, cd);
  assert.ok(applyAction(state, cd, 'h', { type: 'drop', pid: gone.pid }).ok);
  assert.equal(gone.hand.length, 0);
  assert.ok(gone.left);
  assert.equal(state.players[0].hand.length + state.players[1].hand.length, before + count);
});

test('нельзя раздать карты игрока в сети и не ведущему', () => {
  const state = game(3);
  const p = state.players[1];
  assert.equal(applyAction(state, cd, 'h', { type: 'drop', pid: p.pid }).ok, false);
  setOnline(state, p.secret, false, cd);
  assert.equal(applyAction(state, cd, 's2', { type: 'drop', pid: p.pid }).ok, false);
  assert.equal(applyAction(state, cd, 'h', { type: 'drop', pid: state.players[0].pid }).ok, false, 'ведущего убрать нельзя');
});

test('выбывший игрок возвращается и снова получает карты', () => {
  const state = game(3);
  const p = state.players[1];
  setOnline(state, p.secret, false, cd);
  applyAction(state, cd, 'h', { type: 'drop', pid: p.pid });
  assert.equal(p.hand.length, 0);
  setOnline(state, p.secret, true, cd);
  assert.equal(p.left, false);
  assert.equal(p.hand.length, 3, 'добрал руку из колоды');
});

test('вернуться с другого устройства на своё место', () => {
  const state = game(3);
  const p = state.players[1];
  const hand = [...p.hand];
  assert.equal(addPlayer(state, { secret: 'new-phone', name: 'Игрок 1' }).ok, false, 'как новый игрок — нельзя');
  assert.equal(claimSeat(state, cd, 'new-phone', p.pid).ok, false, 'пока старое устройство в сети — нельзя');
  setOnline(state, 's1', false, cd);
  const res = claimSeat(state, cd, 'new-phone', p.pid);
  assert.ok(res.ok, res.error);
  assert.equal(res.oldSecret, 's1');
  assert.deepEqual(viewFor(state, cd, 'new-phone').hand, hand, 'карты на месте');
  assert.equal(viewFor(state, cd, 's1').me, null, 'старое устройство больше не в игре');
  assert.equal(claimSeat(state, cd, 'x', state.players[0].pid).ok, false, 'место ведущего не занять');
});

test('доклад сдаётся без вылетевших', () => {
  const state = game(3);
  setOnline(state, 's2', false, cd);
  playWithDrop(state);
  for (const q of cd.questions) applyAction(state, cd, 'h', { type: 'answer', q: q.id, opt: q.correct });
  applyAction(state, cd, 'h', { type: 'ready', value: true });
  applyAction(state, cd, 's1', { type: 'ready', value: true });
  assert.equal(state.phase, 'result');
});
