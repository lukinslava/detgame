// Запуск: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import caseData from '../js/cases/night-express.js';
import { createGame, addPlayer, applyAction, viewFor, canPlayFaceUp, score } from '../js/engine.js';

function setup(n) {
  const state = createGame(caseData, { secret: 's0', name: 'Ведущий' });
  for (let i = 1; i < n; i++) addPlayer(state, { secret: 's' + i, name: 'Игрок ' + i });
  return state;
}

function current(state) {
  return state.players[state.turn];
}

// Простой бот: выкладывает, если можно, иначе архивирует.
function playOut(state, rnd = Math.random) {
  let guard = 0;
  while (state.phase === 'play') {
    const p = current(state);
    const playable = p.hand.filter((id) => canPlayFaceUp(state, caseData, id));
    const usePlay = playable.length && rnd() < 0.6;
    const cardId = usePlay ? playable[0] : p.hand[Math.floor(rnd() * p.hand.length)];
    const res = applyAction(state, caseData, p.secret, { type: usePlay ? 'play' : 'archive', cardId });
    assert.ok(res.ok, res.error);
    assert.ok(++guard < 500, 'игра не заканчивается');
  }
}

test('дело: уникальные id и корректные вопросы', () => {
  const ids = new Set(caseData.cards.map((c) => c.id));
  assert.equal(ids.size, caseData.cards.length);
  assert.equal(caseData.cards.filter((c) => c.type === 'end').length, 1);
  assert.equal(caseData.cards.at(-1).type, 'end');
  for (const c of caseData.cards) {
    if (c.type === 'clue' || c.type === 'scene') assert.ok(Number.isInteger(c.value), c.id);
    for (const m of c.marks || []) assert.ok(caseData.map.points[m], `${c.id}: нет точки ${m}`);
  }
  for (const q of caseData.questions) assert.ok(q.correct >= 0 && q.correct < q.options.length);
  // В стартовой раздаче должно быть что выложить с нулевым архивом
  assert.ok(caseData.cards.slice(0, 6).some((c) => c.value === 0));
});

for (let n = 1; n <= 6; n++) {
  test(`полная партия на ${n} игроков`, () => {
    for (let round = 0; round < 30; round++) {
      const state = setup(n);
      assert.ok(applyAction(state, caseData, 's0', { type: 'start' }).ok);
      playOut(state);
      assert.equal(state.phase, 'questions');
      assert.equal(state.deck.length, 0);
      assert.ok(state.endDrawn);
      const placed = state.table.length + state.archive.length;
      assert.equal(placed, caseData.cards.length, 'каждая карта либо на столе, либо в архиве');
      for (const p of state.players) assert.equal(p.hand.length, 0);
    }
  });
}

test('нельзя выложить карту, если архив мал', () => {
  const state = setup(2);
  applyAction(state, caseData, 's0', { type: 'start' });
  const p = current(state);
  const high = p.hand.find((id) => !canPlayFaceUp(state, caseData, id));
  if (high) {
    const res = applyAction(state, caseData, p.secret, { type: 'play', cardId: high });
    assert.equal(res.ok, false);
  }
});

test('нельзя ходить не в свой ход и чужой картой', () => {
  const state = setup(3);
  applyAction(state, caseData, 's0', { type: 'start' });
  const cur = current(state);
  const other = state.players.find((p) => p !== cur);
  assert.equal(applyAction(state, caseData, other.secret, { type: 'archive', cardId: other.hand[0] }).ok, false);
  assert.equal(applyAction(state, caseData, cur.secret, { type: 'archive', cardId: other.hand[0] }).ok, false);
});

test('вид игрока не раскрывает чужие руки и архив', () => {
  const state = setup(3);
  applyAction(state, caseData, 's0', { type: 'start' });
  const v = viewFor(state, caseData, 's1');
  const json = JSON.stringify(v);
  assert.ok(!json.includes('"secret"'));
  assert.equal(v.archive, null);
  const other = v.players.find((p) => p.pid !== v.me);
  assert.ok(other.handTitles.length > 0);
  assert.ok(other.handTitles.every((t) => !('id' in t)));
});

test('новые игроки не входят после старта, но старые переподключаются', () => {
  const state = setup(2);
  applyAction(state, caseData, 's0', { type: 'start' });
  assert.equal(addPlayer(state, { secret: 'new', name: 'X' }).ok, false);
  assert.equal(addPlayer(state, { secret: 's1', name: 'Игрок 1' }).ok, true);
});

test('ответы, готовность и подсчёт очков', () => {
  const state = setup(2);
  applyAction(state, caseData, 's0', { type: 'start' });
  playOut(state);
  assert.equal(applyAction(state, caseData, 's0', { type: 'ready', value: true }).ok, false, 'без ответов нельзя');
  for (const q of caseData.questions) applyAction(state, caseData, 's1', { type: 'answer', q: q.id, opt: q.correct });
  applyAction(state, caseData, 's0', { type: 'ready', value: true });
  assert.equal(state.phase, 'questions');
  // смена ответа сбрасывает готовность
  applyAction(state, caseData, 's1', { type: 'answer', q: 'q3', opt: 0 });
  assert.deepEqual(state.ready, {});
  applyAction(state, caseData, 's1', { type: 'answer', q: 'q3', opt: caseData.questions[2].correct });
  applyAction(state, caseData, 's0', { type: 'ready', value: true });
  applyAction(state, caseData, 's1', { type: 'ready', value: true });
  assert.equal(state.phase, 'result');
  assert.equal(state.result.total, state.result.max);
  assert.equal(state.result.max, 10);
  assert.ok(viewFor(state, caseData, 's1').archive);
});

test('ранги', () => {
  assert.equal(score(caseData, {}).rank.title, 'Дело передано другой группе');
});

test('ведущий пропускает ход отключившегося игрока', () => {
  const state = setup(2);
  applyAction(state, caseData, 's0', { type: 'start' });
  state.turn = 1;
  state.players[1].online = false;
  assert.equal(applyAction(state, caseData, 's1', { type: 'skip' }).ok, false);
  assert.ok(applyAction(state, caseData, 's0', { type: 'skip' }).ok);
  assert.equal(state.turn, 0);
});
