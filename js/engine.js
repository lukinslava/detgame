// Игровая логика. Чистые функции над объектом состояния: никакой сети и DOM.
// Состояние хранит только ведущий (host). Остальные получают «вид» через viewFor().

export const MAX_PLAYERS = 6;
export const HAND_SIZE = { 1: 6, 2: 4, 3: 3, 4: 3, 5: 2, 6: 2 };

const LOG_LIMIT = 200;
const CHAT_LIMIT = 100;

function randomId(len = 6) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export function cardById(caseData, id) {
  return caseData.cards.find((c) => c.id === id);
}

export function createGame(caseData, host) {
  const state = {
    caseId: caseData.id,
    phase: 'lobby',
    hostSecret: host.secret,
    players: [],
    deck: [],
    table: [],
    archive: [],
    turn: 0,
    endDrawn: false,
    log: [],
    chat: [],
    answers: {},
    ready: {},
    result: null,
    rev: 0,
    // Номер «срока» ведущего. Растёт при каждой смене ведущего; у кого номер больше — тот и ведущий.
    epoch: 1,
    token: randomId(8),
  };
  const { player: hp } = addPlayer(state, host);
  state.hostPid = hp.pid;
  return state;
}

// Состояние, сохранённое старой версией игры, — дополняем новыми полями.
export function normalize(state) {
  if (!state.hostPid) state.hostPid = state.players.find((p) => p.secret === state.hostSecret)?.pid;
  if (!state.epoch) state.epoch = 1;
  if (!state.token) state.token = randomId(8);
  return state;
}

// Сравнение сроков ведущего: (номер, жетон). Больше — новее.
export function compareEpoch(a, b) {
  return (a.epoch - b.epoch) || (a.token > b.token ? 1 : a.token < b.token ? -1 : 0);
}

// Резервная копия партии для смены ведущего. Секреты игроков в неё не попадают —
// только их отпечатки (hash), по которым новый ведущий узнает вернувшихся игроков.
export function backupOf(state) {
  const copy = JSON.parse(JSON.stringify(state));
  delete copy.hostSecret;
  for (const p of copy.players) delete p.secret;
  return copy;
}

// Игрок с отпечатком myHash берёт на себя роль ведущего по резервной копии.
export function takeOver(backup, mySecret, myHash) {
  const state = JSON.parse(JSON.stringify(backup));
  const me = state.players.find((p) => p.hash && p.hash === myHash);
  if (!me) return { ok: false, error: 'Вас нет в этой партии.' };
  for (const p of state.players) {
    p.secret = p === me ? mySecret : null;
    p.online = p === me;
  }
  const old = state.players.find((p) => p.pid === state.hostPid);
  state.hostSecret = mySecret;
  state.hostPid = me.pid;
  state.epoch = (state.epoch || 1) + 1;
  state.token = randomId(8);
  state.ready = {};
  log(state, `${me.name} становится ведущим${old && old !== me ? ` вместо ${old.name}` : ''}`);
  state.rev++;
  return { ok: true, state };
}

// После смены ведущего игроки заходят заново: узнаём их по отпечатку секрета.
export function matchByHash(state, secret, hash) {
  const p = state.players.find((x) => !x.secret && x.hash && x.hash === hash);
  if (!p) return null;
  p.secret = secret;
  p.online = true;
  state.rev++;
  return p;
}

// Смена дела в комнате ожидания. Проверку, что дело существует, делает вызывающий код.
export function setCase(state, caseId) {
  if (state.phase !== 'lobby') return { ok: false, error: 'Дело можно сменить только до начала игры.' };
  if (state.caseId === caseId) return { ok: true };
  state.caseId = caseId;
  state.rev++;
  return { ok: true };
}

function player(state, secret) {
  return state.players.find((p) => p.secret === secret);
}

function nameOf(state, pid) {
  const p = state.players.find((x) => x.pid === pid);
  return p ? p.name : '?';
}

function log(state, text) {
  state.log.push({ at: Date.now(), text });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function cardsWord(n) {
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? 'карта' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'карты' : 'карт';
  return `${n} ${w}`;
}

function cleanName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return s || 'Сыщик';
}

// Новый игрок или переподключение старого. Возвращает {ok, error?, player?}.
export function addPlayer(state, { secret, name }) {
  const existing = player(state, secret);
  if (existing) {
    existing.online = true;
    if (state.phase === 'lobby' && name) existing.name = cleanName(name);
    return { ok: true, player: existing };
  }
  if (state.phase !== 'lobby') return { ok: false, error: 'Игра уже началась. Новые игроки не могут присоединиться.' };
  if (state.players.length >= MAX_PLAYERS) return { ok: false, error: 'В комнате уже 6 сыщиков.' };
  let pid = randomId(5);
  while (state.players.some((p) => p.pid === pid)) pid = randomId(5);
  const p = { pid, secret, name: cleanName(name), online: true, hand: [] };
  state.players.push(p);
  if (state.players.length > 1) log(state, `${p.name} присоединяется к расследованию`);
  state.rev++;
  return { ok: true, player: p };
}

export function setOnline(state, secret, online, caseData) {
  const p = player(state, secret);
  if (!p || p.online === online) return false;
  p.online = online;
  if (online && caseData) comeBack(state, caseData, p);
  state.rev++;
  return true;
}

// Игрок вернулся. Если его карты успели раздать остальным, а колода не кончилась, —
// добираем ему руку, чтобы он снова мог ходить.
function comeBack(state, caseData, p) {
  if (!p.left) return;
  p.left = false;
  log(state, `${p.name} возвращается в игру`);
  if (state.phase !== 'play') return;
  const size = HAND_SIZE[state.players.length];
  while (p.hand.length < size && state.deck.length && !state.endDrawn) {
    const before = p.hand.length;
    drawInto(state, caseData, p);
    if (p.hand.length === before) break;
  }
  if (state.players[state.turn]?.hand.length === 0) advanceIfStuck(state);
}

// Игрок вылетел и зашёл с другого устройства или браузера: занимает своё прежнее место.
// Занять можно только место игрока, который сейчас не в сети.
export function claimSeat(state, caseData, newSecret, pid) {
  if (state.phase === 'lobby') return { ok: false, error: 'Игра ещё не началась — просто войдите в комнату.' };
  if (player(state, newSecret)) return { ok: false, error: 'Вы уже в игре.' };
  const p = state.players.find((x) => x.pid === pid);
  if (!p) return { ok: false, error: 'Такого игрока нет.' };
  if (p.pid === state.hostPid) return { ok: false, error: 'Место ведущего занять нельзя. Если ведущий вылетел, любой игрок может стать ведущим.' };
  if (p.online) return { ok: false, error: `${p.name} сейчас в сети. Если это вы на старом устройстве — подождите минуту, пока оно отключится, и попробуйте снова.` };
  const oldSecret = p.secret;
  p.secret = newSecret;
  p.online = true;
  log(state, `${p.name} возвращается с другого устройства`);
  comeBack(state, caseData, p);
  state.rev++;
  return { ok: true, oldSecret, player: p };
}

// Места, которые можно занять при возвращении.
export function seatsFor(state) {
  return state.players.map((p) => ({
    pid: p.pid,
    name: p.name,
    online: p.online,
    host: p.pid === state.hostPid,
  }));
}

// Берём карты сверху колоды, пока не попадётся обычная карта.
// Повороты сюжета сразу ложатся на стол, «Дело закрыто» останавливает добор.
function drawInto(state, caseData, p) {
  while (state.deck.length && !state.endDrawn) {
    const id = state.deck.shift();
    const card = cardById(caseData, id);
    if (card.type === 'twist') {
      state.table.push({ id, by: null, kind: 'twist' });
      log(state, `Поворот сюжета: «${card.title}»`);
      continue;
    }
    if (card.type === 'end') {
      state.endDrawn = true;
      state.table.push({ id, by: null, kind: 'end' });
      log(state, 'Колода закончилась: дело закрыто. Доиграйте карты с рук');
      return;
    }
    p.hand.push(id);
    return;
  }
}

export function startGame(state, caseData) {
  if (state.phase !== 'lobby') return { ok: false, error: 'Игра уже идёт.' };
  const n = state.players.length;
  const size = HAND_SIZE[n];
  state.deck = caseData.cards.map((c) => c.id);
  state.table = [];
  state.archive = [];
  state.endDrawn = false;
  state.answers = {};
  state.ready = {};
  state.result = null;
  state.log = [];
  for (const p of state.players) p.hand = [];
  for (let r = 0; r < size; r++) {
    for (const p of state.players) drawInto(state, caseData, p);
  }
  state.phase = 'play';
  state.turn = Math.floor(Math.random() * n);
  log(state, `Расследование началось. Первым ходит ${state.players[state.turn].name}`);
  advanceIfStuck(state);
  state.rev++;
  return { ok: true };
}

// Если у текущего игрока пусто — передаём ход дальше. Если пусто у всех — к вопросам.
function advanceIfStuck(state) {
  const n = state.players.length;
  for (let i = 0; i < n; i++) {
    const idx = (state.turn + i) % n;
    if (state.players[idx].hand.length) {
      state.turn = idx;
      return;
    }
  }
  state.phase = 'questions';
  log(state, 'Все карты сыграны. Пора отвечать на вопросы следователя');
}

function nextTurn(state) {
  state.turn = (state.turn + 1) % state.players.length;
  advanceIfStuck(state);
}

export function canPlayFaceUp(state, caseData, cardId) {
  const card = cardById(caseData, cardId);
  return !!card && (card.value ?? 0) <= state.archive.length;
}

// Действие игрока. Возвращает {ok, error?}.
export function applyAction(state, caseData, secret, action) {
  const p = player(state, secret);
  if (!p) return { ok: false, error: 'Вы не в этой игре.' };
  const isHost = secret === state.hostSecret;
  const a = action || {};

  switch (a.type) {
    case 'chat': {
      const text = String(a.text || '').trim().slice(0, 300);
      if (!text) return { ok: false, error: 'Пустое сообщение.' };
      state.chat.push({ at: Date.now(), pid: p.pid, text });
      if (state.chat.length > CHAT_LIMIT) state.chat.splice(0, state.chat.length - CHAT_LIMIT);
      state.rev++;
      return { ok: true };
    }

    case 'rename': {
      if (state.phase !== 'lobby') return { ok: false, error: 'Имя меняется только до начала игры.' };
      p.name = cleanName(a.name);
      state.rev++;
      return { ok: true };
    }

    case 'kick': {
      if (!isHost) return { ok: false, error: 'Только ведущий может убрать игрока.' };
      if (state.phase !== 'lobby') return { ok: false, error: 'Убрать игрока можно только до начала игры.' };
      const idx = state.players.findIndex((x) => x.pid === a.pid);
      if (idx < 0 || state.players[idx].pid === state.hostPid) return { ok: false, error: 'Нельзя убрать этого игрока.' };
      const [gone] = state.players.splice(idx, 1);
      log(state, `${gone.name} покидает комнату`);
      state.rev++;
      return { ok: true, kicked: gone.secret };
    }

    case 'start': {
      if (!isHost) return { ok: false, error: 'Начать игру может только ведущий.' };
      return startGame(state, caseData);
    }

    case 'play':
    case 'archive': {
      if (state.phase !== 'play') return { ok: false, error: 'Сейчас нельзя ходить.' };
      if (state.players[state.turn] !== p) return { ok: false, error: 'Сейчас не ваш ход.' };
      const i = p.hand.indexOf(a.cardId);
      if (i < 0) return { ok: false, error: 'Этой карты нет у вас на руке.' };
      const card = cardById(caseData, a.cardId);
      if (a.type === 'play') {
        if (!canPlayFaceUp(state, caseData, a.cardId)) {
          return { ok: false, error: `Чтобы выложить эту карту, в архиве должно быть не меньше ${card.value} карт.` };
        }
        p.hand.splice(i, 1);
        state.table.push({ id: card.id, by: p.pid, kind: 'played' });
        log(state, `${p.name} выкладывает на стол «${card.title}»`);
      } else {
        p.hand.splice(i, 1);
        state.archive.push({ id: card.id, by: p.pid });
        log(state, `${p.name} отправляет карту «${card.title}» в архив`);
      }
      drawInto(state, caseData, p);
      nextTurn(state);
      state.rev++;
      return { ok: true };
    }

    case 'skip': {
      if (!isHost) return { ok: false, error: 'Пропустить чужой ход может только ведущий.' };
      if (state.phase !== 'play') return { ok: false, error: 'Сейчас нельзя ходить.' };
      const cur = state.players[state.turn];
      if (cur.online) return { ok: false, error: 'Игрок в сети — пусть ходит сам.' };
      log(state, `Ведущий пропускает ход игрока ${cur.name}: он не в сети`);
      nextTurn(state);
      state.rev++;
      return { ok: true };
    }

    case 'drop': {
      if (!isHost) return { ok: false, error: 'Раздать чужие карты может только ведущий.' };
      if (state.phase !== 'play') return { ok: false, error: 'Сейчас это не нужно.' };
      const idx = state.players.findIndex((x) => x.pid === a.pid);
      const gone = state.players[idx];
      if (!gone || gone.pid === state.hostPid) return { ok: false, error: 'Нельзя убрать этого игрока.' };
      if (gone.online) return { ok: false, error: `${gone.name} в сети — пусть ходит сам.` };
      const others = [];
      for (let i = 1; i < state.players.length; i++) {
        const x = state.players[(idx + i) % state.players.length];
        if (!x.left) others.push(x);
      }
      const cards = gone.hand.splice(0);
      cards.forEach((id, i) => others[i % others.length].hand.push(id));
      gone.left = true;
      log(state, `${gone.name} выходит из партии. ${cardsWord(cards.length)} с руки ${cards.length === 1 ? 'передана' : 'розданы'} остальным`);
      if (state.players[state.turn] === gone) nextTurn(state);
      else advanceIfStuck(state);
      state.rev++;
      return { ok: true };
    }

    case 'answer': {
      if (state.phase !== 'questions') return { ok: false, error: 'Вопросы ещё не открыты.' };
      const q = caseData.questions.find((x) => x.id === a.q);
      if (!q) return { ok: false, error: 'Нет такого вопроса.' };
      const opt = Number(a.opt);
      if (!Number.isInteger(opt) || opt < 0 || opt >= q.options.length) return { ok: false, error: 'Нет такого ответа.' };
      if (state.answers[q.id] === opt) return { ok: true };
      state.answers[q.id] = opt;
      state.ready = {};
      state.rev++;
      return { ok: true };
    }

    case 'ready': {
      if (state.phase !== 'questions') return { ok: false, error: 'Вопросы ещё не открыты.' };
      if (a.value) {
        const missing = caseData.questions.filter((q) => state.answers[q.id] === undefined);
        if (missing.length) return { ok: false, error: 'Сначала ответьте на все вопросы.' };
        state.ready[p.pid] = true;
      } else {
        delete state.ready[p.pid];
      }
      const voters = state.players.filter((x) => x.online);
      if (voters.length && voters.every((x) => state.ready[x.pid])) finish(state, caseData);
      state.rev++;
      return { ok: true };
    }

    case 'reset': {
      if (!isHost) return { ok: false, error: 'Начать заново может только ведущий.' };
      state.phase = 'lobby';
      state.deck = [];
      state.table = [];
      state.archive = [];
      state.endDrawn = false;
      state.answers = {};
      state.ready = {};
      state.result = null;
      state.log = [];
      for (const x of state.players) x.hand = [];
      log(state, 'Ведущий вернул всех в комнату ожидания');
      state.rev++;
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Неизвестное действие.' };
  }
}

export function score(caseData, answers) {
  let total = 0;
  let max = 0;
  const perQ = caseData.questions.map((q) => {
    max += q.points;
    const ok = answers[q.id] === q.correct;
    if (ok) total += q.points;
    return { id: q.id, ok, points: ok ? q.points : 0 };
  });
  const rank = caseData.ranks.find((r) => total >= r.min) || caseData.ranks[caseData.ranks.length - 1];
  return { total, max, perQ, rank: { title: rank.title, text: rank.text } };
}

function finish(state, caseData) {
  state.result = score(caseData, state.answers);
  state.phase = 'result';
  log(state, `Доклад сдан: ${state.result.total} из ${state.result.max} очков`);
}

// Что видит конкретный игрок. Чужие руки — только названия и числа (их по правилам можно назвать вслух).
export function viewFor(state, caseData, secret) {
  const me = player(state, secret);
  const reveal = state.phase === 'result';
  return {
    rev: state.rev,
    caseId: state.caseId,
    phase: state.phase,
    me: me ? me.pid : null,
    isHost: secret === state.hostSecret,
    hostPid: state.hostPid,
    epoch: state.epoch,
    token: state.token,
    players: state.players.map((p) => ({
      pid: p.pid,
      name: p.name,
      online: p.online,
      left: !!p.left,
      handCount: p.hand.length,
      handTitles: p === me ? [] : p.hand.map((id) => {
        const c = cardById(caseData, id);
        return { title: c.title, value: c.value ?? 0 };
      }),
    })),
    hand: me ? [...me.hand] : [],
    table: state.table.map((t) => ({ ...t })),
    archiveCount: state.archive.length,
    archive: reveal ? state.archive.map((a) => ({ ...a })) : null,
    deckCount: state.deck.length,
    turnPid: state.phase === 'play' ? state.players[state.turn]?.pid : null,
    endDrawn: state.endDrawn,
    log: state.log.slice(-60),
    chat: state.chat.slice(-60),
    answers: { ...state.answers },
    ready: { ...state.ready },
    result: state.result,
  };
}

export { nameOf };
