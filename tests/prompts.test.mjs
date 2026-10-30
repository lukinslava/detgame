// У каждой карты каждого дела есть промпт для картинки, и он собирается без ошибок.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_LIST } from '../js/cases/index.js';
import { SOURCES, fullPrompt, allPrompts } from '../prompts/build.mjs';

for (const cd of CASE_LIST) {
  test(`${cd.title}: промпты на все карты`, () => {
    const src = SOURCES[cd.id];
    assert.ok(src, 'есть файл промптов');
    assert.ok(src.era && src.cover);
    for (const c of cd.cards) {
      assert.ok(src.cards[c.id], `${c.id}: нет промпта`);
      const p = fullPrompt(src, src.cards[c.id]);
      assert.ok(!/[{}]/.test(p), `${c.id}: не подставлен персонаж`);
    }
    for (const id of Object.keys(src.cards)) assert.ok(cd.cards.some((c) => c.id === id), `лишний промпт ${id}`);
  });
}

test('всего промптов: карты + обложки', () => {
  const all = allPrompts();
  const n = all.reduce((s, c) => s + c.cards.length + 1, 0);
  assert.equal(n, CASE_LIST.reduce((s, c) => s + c.cards.length + 1, 0));
});
