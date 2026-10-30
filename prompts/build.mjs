// Собирает промпты для нейросетей из prompts/src/*.mjs.
// Запуск: npm run prompts  →  prompts/<дело>.md, prompts/prompts.csv
// С аргументом --html <файл> ещё и страницу с кнопками «Скопировать».
import { writeFileSync, mkdirSync } from 'node:fs';
import { CASE_LIST, DIFFICULTY } from '../js/cases/index.js';
import nightExpress from './src/night-express.mjs';
import lastAct from './src/last-act.mjs';
import snowEstate from './src/snow-estate.mjs';
import polarNight from './src/polar-night.mjs';

export const SOURCES = {
  'night-express': nightExpress,
  'last-act': lastAct,
  'snow-estate': snowEstate,
  'polar-night': polarNight,
};

export const STYLE = 'vintage engraving illustration, fine etching with crosshatching, sepia and dark ink on aged cream paper, muted colours, dramatic chiaroscuro, detective noir mood, no text, no lettering, no watermark, no border';
export const MJ = '--ar 2:1 --style raw';

// Полный промпт: сюжет + эпоха дела + общий стиль.
export function fullPrompt(src, subject) {
  const filled = subject.replace(/\{(\w+)\}/g, (_, id) => {
    if (!src.people[id]) throw new Error(`Нет персонажа ${id}`);
    return src.people[id];
  });
  return `${filled}. ${src.era}. ${STYLE}`;
}

// ---------- ChatGPT: одно сообщение со стилем, потом короткие сообщения по картам ----------
export function chatCard(src, id, subject) {
  const filled = subject.replace(/\{(\w+)\}/g, (_, pid) => {
    if (!src.names?.[pid]) throw new Error(`Нет имени персонажа ${pid}`);
    return src.names[pid];
  });
  return `${id}. ${filled}.`;
}

export function chatSetup(cd, src) {
  const people = Object.keys(src.people).map((id) => `— ${src.names[id]}: ${src.people[id]}.`).join('\n');
  return [
    `Ты будешь рисовать иллюстрации к карточкам детективной настольной игры. Дело называется «${cd.title}». Я буду присылать описания карточек по одному. На каждое сообщение — ровно одна картинка, без уточняющих вопросов и пояснений.`,
    '',
    'Единый стиль для ВСЕХ картинок этого чата — соблюдай его строго и не меняй от картинки к картинке:',
    '— старинная гравюра (офорт) с тонкой штриховкой;',
    '— сепия и тёмные чернила на состаренной кремовой бумаге, приглушённые цвета;',
    '— драматичный свет и тени, атмосфера нуарного детектива;',
    '— никакого текста: ни букв, ни цифр, ни подписей, ни водяных знаков, ни рамок;',
    '— горизонтальный формат 3:2. Всё важное держи в средней горизонтальной полосе кадра: верх и низ картинки в игре обрезаются;',
    '— если в описании есть «accent of deep red», добавь один тёмно-красный акцент, а остальное оставь в той же сепии;',
    '— смерть и раны показывай сдержанно, без крови и жестокости.',
    '',
    `Эпоха и место: ${src.era}.`,
    '',
    'Персонажи. Рисуй каждого всегда одинаково, чтобы его узнавали на всех карточках:',
    people,
    '',
    `Для начала нарисуй обложку дела — она станет образцом стиля для всех следующих картинок: ${src.cover}.`,
  ].join('\n');
}

export function allPrompts() {
  return CASE_LIST.map((cd) => {
    const src = SOURCES[cd.id];
    return {
      id: cd.id,
      title: cd.title,
      difficulty: DIFFICULTY[cd.difficulty].label,
      era: src.era,
      people: src.people,
      cover: { file: `img/${cd.id}/cover.jpg`, prompt: fullPrompt(src, src.cover) },
      chatSetup: chatSetup(cd, src),
      cards: cd.cards.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        file: `img/${cd.id}/${c.id}.jpg`,
        prompt: fullPrompt(src, src.cards[c.id] ?? ''),
        chat: chatCard(src, c.id, src.cards[c.id] ?? ''),
      })),
    };
  });
}

const TYPE = { clue: 'улика', scene: 'место', twist: 'поворот', end: 'финал' };

function markdown(c) {
  const lines = [
    `# Промпты: «${c.title}» (${c.difficulty.toLowerCase()})`,
    '',
    'Общие правила — в [README](README.md). Для Midjourney добавьте в конец каждого промпта `' + MJ + '`.',
    '',
    `## Обложка`,
    '',
    `Файл: \`${c.cover.file}\``,
    '',
    '```',
    c.cover.prompt,
    '```',
    '',
  ];
  for (const k of c.cards) {
    lines.push(`## ${k.id} · ${k.title} _(${TYPE[k.type]})_`, '', `Файл: \`${k.file}\``, '', '```', k.prompt, '```', '');
  }
  return lines.join('\n');
}

function chatMarkdown(c) {
  const lines = [
    `# ChatGPT: «${c.title}»`,
    '',
    'Откройте новый чат с ChatGPT для этого дела. Отправьте первое сообщение целиком, потом присылайте карточки по одной. Подробнее — в [README](../README.md).',
    '',
    '## 1. Первое сообщение: стиль, эпоха, персонажи',
    '',
    `Картинку-обложку из ответа сохраните как \`${c.cover.file}\`.`,
    '',
    '```',
    c.chatSetup,
    '```',
    '',
    '## 2. Карточки — по одной в сообщении',
    '',
  ];
  for (const k of c.cards) lines.push(`**${k.id} · ${k.title}** → \`${k.file}\``, '', '```', k.chat, '```', '');
  return lines.join('\n');
}

function csv(all) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [['case', 'card', 'title', 'file', 'prompt'].join(',')];
  for (const c of all) {
    rows.push([c.id, 'cover', 'Обложка', c.cover.file, c.cover.prompt].map(q).join(','));
    for (const k of c.cards) rows.push([c.id, k.id, k.title, k.file, k.prompt].map(q).join(','));
  }
  return rows.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = allPrompts();
  mkdirSync(new URL('./chatgpt/', import.meta.url), { recursive: true });
  for (const c of all) {
    writeFileSync(new URL(`./${c.id}.md`, import.meta.url), markdown(c));
    writeFileSync(new URL(`./chatgpt/${c.id}.md`, import.meta.url), chatMarkdown(c));
  }
  writeFileSync(new URL('./prompts.csv', import.meta.url), csv(all));
  const i = process.argv.indexOf('--json');
  if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify({ style: STYLE, mj: MJ, cases: all }));
  console.log(`Готово: ${all.reduce((n, c) => n + c.cards.length + 1, 0)} промптов`);
}
