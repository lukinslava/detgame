// Все дела. Порядок — от простого к сложному.
import nightExpress from './night-express.js';
import lastAct from './last-act.js';
import snowEstate from './snow-estate.js';
import polarNight from './polar-night.js';

export const CASE_LIST = [nightExpress, lastAct, snowEstate, polarNight];
export const CASES = Object.fromEntries(CASE_LIST.map((c) => [c.id, c]));
export const DEFAULT_CASE = nightExpress;

export const DIFFICULTY = {
  1: { label: 'Лёгкое', hint: 'Один виновный, улики прямые.' },
  2: { label: 'Среднее', hint: 'Ложные следы и свидетели, которые недоговаривают.' },
  3: { label: 'Сложное', hint: 'Несколько виновных, ложное признание, лгущие свидетели.' },
  4: { label: 'Очень сложное', hint: 'Ложное алиби, путаница со временем, сообщники.' },
};
