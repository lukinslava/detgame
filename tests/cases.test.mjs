// Проверка всех дел: целостность данных и полные партии.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_LIST, CASES, DIFFICULTY } from '../js/cases/index.js';
import { artSvg, coverSvg } from '../js/art.js';
import { createGame, addPlayer, applyAction, canPlayFaceUp, setCase, score } from '../js/engine.js';

for (const cd of CASE_LIST) {
  test(`${cd.title}: данные дела`, () => {
    assert.ok(DIFFICULTY[cd.difficulty], 'сложность');
    for (const k of ['id', 'title', 'subtitle', 'blurb']) assert.ok(cd[k], k);
    assert.ok(cd.intro.length && cd.solution.length);

    const ids = new Set(cd.cards.map((c) => c.id));
    assert.equal(ids.size, cd.cards.length, 'id карт уникальны');
    assert.equal(cd.cards.filter((c) => c.type === 'end').length, 1);
    assert.equal(cd.cards.at(-1).type, 'end', 'последняя карта — «Дело закрыто»');
    for (const c of cd.cards) {
      assert.ok(['clue', 'scene', 'twist', 'end'].includes(c.type), c.id);
      assert.ok(c.title && c.text, c.id);
      if (c.type === 'clue' || c.type === 'scene') assert.ok(Number.isInteger(c.value) && c.value >= 0 && c.value <= 10, c.id);
      for (const m of c.marks || []) assert.ok(cd.map.points[m], `${c.id}: нет точки ${m}`);
    }
    assert.ok(cd.cards.slice(0, 6).filter((c) => c.value === 0).length >= 2, 'в начале колоды есть карты с нулём');

    // иллюстрации
    assert.ok(coverSvg(cd.id), 'есть обложка');
    for (const c of cd.cards) {
      assert.ok(c.art, `${c.id}: нет картинки`);
      assert.ok(artSvg(c.art, cd).startsWith('<svg'), `${c.id}: картинка «${c.art}» не рисуется`);
    }

    // схема
    const { width, height, shapes, points } = cd.map;
    for (const sh of shapes) if (sh.when) assert.ok(points[sh.when], `фигура ждёт неизвестную метку ${sh.when}`);
    for (const [k, p] of Object.entries(points)) {
      assert.ok(p.label, k);
      if (p.x != null) assert.ok(p.x > 0 && p.x < width && p.y > 0 && p.y < height, `${k} вне схемы`);
    }
    const used = new Set(cd.cards.flatMap((c) => c.marks || []));
    for (const k of Object.keys(points)) assert.ok(used.has(k), `точку ${k} не открывает ни одна карта`);

    // вопросы и ранги
    const qids = new Set(cd.questions.map((q) => q.id));
    assert.equal(qids.size, cd.questions.length);
    for (const q of cd.questions) assert.ok(q.correct >= 0 && q.correct < q.options.length, q.id);
    const max = cd.questions.reduce((s, q) => s + q.points, 0);
    assert.equal(cd.ranks.at(-1).min, 0);
    for (let i = 1; i < cd.ranks.length; i++) assert.ok(cd.ranks[i - 1].min > cd.ranks[i].min);
    assert.ok(cd.ranks[0].min <= max);
    const perfect = Object.fromEntries(cd.questions.map((q) => [q.id, q.correct]));
    assert.equal(score(cd, perfect).total, max);
    assert.equal(score(cd, perfect).rank.title, cd.ranks[0].title);
  });

  test(`${cd.title}: партии на 1–6 игроков доходят до конца`, () => {
    for (let n = 1; n <= 6; n++) {
      for (let round = 0; round < 15; round++) {
        const state = createGame(cd, { secret: 's0', name: 'Ведущий' });
        for (let i = 1; i < n; i++) addPlayer(state, { secret: 's' + i, name: 'И' + i });
        assert.ok(applyAction(state, cd, 's0', { type: 'start' }).ok);
        let guard = 0;
        while (state.phase === 'play') {
          const p = state.players[state.turn];
          const playable = p.hand.filter((id) => canPlayFaceUp(state, cd, id));
          const usePlay = playable.length && Math.random() < 0.6;
          const cardId = usePlay ? playable[0] : p.hand[0];
          assert.ok(applyAction(state, cd, p.secret, { type: usePlay ? 'play' : 'archive', cardId }).ok);
          assert.ok(++guard < 500);
        }
        assert.equal(state.phase, 'questions');
        assert.equal(state.table.length + state.archive.length, cd.cards.length);
      }
    }
  });
}

test('ведущий меняет дело только в комнате ожидания', () => {
  const [a, b] = CASE_LIST;
  const state = createGame(a, { secret: 's0', name: 'В' });
  assert.ok(setCase(state, b.id).ok);
  assert.equal(state.caseId, b.id);
  assert.ok(applyAction(state, CASES[state.caseId], 's0', { type: 'start' }).ok);
  assert.equal(setCase(state, a.id).ok, false);
  assert.ok(applyAction(state, CASES[state.caseId], 's0', { type: 'reset' }).ok);
  assert.equal(state.caseId, b.id, 'после сброса дело сохраняется');
});
