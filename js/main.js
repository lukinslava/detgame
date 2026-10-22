import nightExpress from './cases/night-express.js';
import * as E from './engine.js';
import { hostNet, clientNet, DEFAULT_BROKER } from './net.js';

const CASES = { [nightExpress.id]: nightExpress };
const DEFAULT_CASE = nightExpress;

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const BROKER = params.get('broker') || DEFAULT_BROKER;

// ---------- хранилище ----------
const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* приватный режим */ } },
  del(k) { try { localStorage.removeItem(k); } catch (_) { /* приватный режим */ } },
};

function rand(len, abc = 'abcdefghijkmnopqrstuvwxyz0123456789') {
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => abc[x % abc.length]).join('');
}

const ROOM_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let secret = store.get('dg.secret');
if (!secret) { secret = rand(22); store.set('dg.secret', secret); }

// ---------- состояние страницы ----------
let session = null; // { role: 'host'|'client', room }
let net = null;
let hostState = null;
let view = null;
const ui = {
  tab: 'hand',
  confirmArchive: null,
  seenChat: 0,
  hostOnline: true,
  netStatus: 'connecting',
  homeError: '',
  joinTimer: null,
  joinSlow: false,
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const caseOf = (v) => CASES[v?.caseId] || DEFAULT_CASE;
const card = (cd, id) => E.cardById(cd, id);
const playerName = (pid) => view?.players.find((p) => p.pid === pid)?.name || '?';

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

let toastTimer = null;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ---------- сеть: ведущий ----------
function startHost(room, state) {
  session = { role: 'host', room };
  store.set('dg.session', { ...session, broker: BROKER });
  hostState = state;
  for (const p of hostState.players) p.online = p.secret === secret;
  net = hostNet({
    url: BROKER,
    room,
    secret,
    onStatus: (s) => { ui.netStatus = s; renderStatus(); },
    onPresence: (s, online) => { if (E.setOnline(hostState, s, online)) broadcast(); },
    onMessage: (from, msg) => {
      if (msg.t === 'hello') {
        const res = E.addPlayer(hostState, { secret: from, name: msg.name });
        if (!res.ok) net.send(from, { t: 'rejected', msg: res.error });
        broadcast();
      } else if (msg.t === 'act') {
        const res = E.applyAction(hostState, caseOf(hostState), from, msg.action);
        if (!res.ok) net.send(from, { t: 'error', msg: res.error });
        else {
          if (res.kicked) net.send(res.kicked, { t: 'rejected', msg: 'Ведущий убрал вас из комнаты.' });
          broadcast();
        }
      }
    },
  });
  broadcast();
}

function broadcast() {
  store.set('dg.host.' + session.room, hostState);
  const cd = caseOf(hostState);
  for (const p of hostState.players) {
    if (p.secret === secret) continue;
    net.send(p.secret, { t: 'state', view: E.viewFor(hostState, cd, p.secret) }, true);
  }
  setView(E.viewFor(hostState, cd, secret));
}

// ---------- сеть: игрок ----------
function startClient(room, name) {
  session = { role: 'client', room };
  store.set('dg.session', { ...session, broker: BROKER });
  ui.joinSlow = false;
  clearTimeout(ui.joinTimer);
  ui.joinTimer = setTimeout(() => { if (!view) { ui.joinSlow = true; render(); } }, 10000);
  net = clientNet({
    url: BROKER,
    room,
    secret,
    name,
    onStatus: (s) => { ui.netStatus = s; renderStatus(); },
    onHost: (online) => { ui.hostOnline = online; render(); },
    onMessage: (msg) => {
      if (msg.t === 'state') {
        if (!view || msg.view.rev >= view.rev || msg.view.phase !== view.phase) setView(msg.view);
      } else if (msg.t === 'error') {
        toast(msg.msg);
      } else if (msg.t === 'rejected') {
        leave(msg.msg);
      }
    },
  });
  render();
}

function act(action) {
  if (!session) return;
  if (session.role === 'host') {
    const res = E.applyAction(hostState, caseOf(hostState), secret, action);
    if (!res.ok) { toast(res.error); return; }
    if (res.kicked) net.send(res.kicked, { t: 'rejected', msg: 'Ведущий убрал вас из комнаты.' });
    broadcast();
  } else {
    net.act(action);
  }
}

function setView(v) {
  const prevPhase = view?.phase;
  const wasMyTurn = view && view.turnPid === view.me;
  view = v;
  if (v.phase !== prevPhase) {
    if (v.phase === 'play') ui.tab = 'table';
    if (v.phase === 'questions' || v.phase === 'result') ui.tab = 'hand';
  }
  if (v.phase === 'play' && !wasMyTurn && v.turnPid === v.me && prevPhase === 'play') {
    toast('Ваш ход');
    try { navigator.vibrate?.(80); } catch (_) { /* не все браузеры */ }
  }
  render();
}

function leave(message) {
  if (net) net.close();
  if (session?.role === 'host') store.del('dg.host.' + session.room);
  store.del('dg.session');
  net = null; session = null; view = null; hostState = null;
  ui.homeError = message || '';
  clearTimeout(ui.joinTimer);
  history.replaceState(null, '', location.pathname + (params.get('broker') ? '?broker=' + encodeURIComponent(BROKER) : ''));
  render();
}

function inviteLink() {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('room', session.room);
  if (BROKER !== DEFAULT_BROKER) u.searchParams.set('broker', BROKER);
  return u.toString();
}

// ---------- отрисовка ----------
function render() {
  let screen = 'home';
  if (session && !view) screen = 'connecting';
  else if (view?.phase === 'lobby') screen = 'lobby';
  else if (view) screen = 'game';

  if (app.dataset.screen !== screen) {
    app.dataset.screen = screen;
    app.innerHTML = '';
    app.onclick = null;
  }
  if (screen === 'home') renderHome();
  else if (screen === 'connecting') renderConnecting();
  else if (screen === 'lobby') renderLobby();
  else renderGame();
}

function renderStatus() {
  const el = document.getElementById('net');
  if (!el) return;
  const map = { online: ['ok', 'В сети'], connecting: ['warn', 'Подключение…'], offline: ['bad', 'Нет связи'], error: ['bad', 'Ошибка связи'] };
  const [cls, text] = map[ui.netStatus] || map.connecting;
  el.className = 'net net--' + cls;
  el.title = text;
  el.setAttribute('aria-label', text);
}

function brand() {
  return `<div class="brand"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="26" cy="26" r="15" fill="none" stroke="currentColor" stroke-width="5"/><path d="M37 37l15 15" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg><span>Сыскное бюро</span></div>`;
}

function renderHome() {
  const room = (params.get('room') || '').toUpperCase();
  const name = store.get('dg.name', '');
  const cd = DEFAULT_CASE;
  app.innerHTML = `
    <main class="home">
      ${brand()}
      <section class="hero">
        <p class="eyebrow">Кооперативный детектив · ${esc(cd.players)} игроков · ~${cd.minutes} минут</p>
        <h1>${esc(cd.title)}</h1>
        <p class="lead">${esc(cd.subtitle)}. Соберите улики по карточкам, не показывая их друг другу, и вместе раскройте убийство в спальном вагоне.</p>
      </section>
      ${ui.homeError ? `<p class="alert">${esc(ui.homeError)}</p>` : ''}
      <form class="box" id="home-form" autocomplete="off">
        <label class="field">
          <span>Ваше имя</span>
          <input id="name" maxlength="24" required placeholder="Например, Аня" value="${esc(name)}">
        </label>
        ${room ? `
          <p class="hint">Вас пригласили в комнату <b class="code">${esc(room)}</b></p>
          <button class="btn btn--primary" data-act="join">Войти в комнату</button>
          <button class="btn btn--ghost" type="button" data-act="forget">Создать свою комнату</button>
        ` : `
          <button class="btn btn--primary" data-act="create">Создать комнату</button>
          <div class="or"><span>или войдите по коду</span></div>
          <div class="row">
            <input id="room" maxlength="5" placeholder="КОД" autocapitalize="characters" class="code-input" aria-label="Код комнаты">
            <button class="btn" data-act="join">Войти</button>
          </div>
        `}
      </form>
      <button class="link" type="button" data-act="rules">Как играть</button>
    </main>`;

  const form = document.getElementById('home-form');
  const nameEl = document.getElementById('name');
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.act === 'forget') {
      params.delete('room');
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
      render();
      return;
    }
    const n = nameEl.value.trim();
    if (!n) { nameEl.focus(); toast('Введите имя'); return; }
    store.set('dg.name', n);
    ui.homeError = '';
    if (b.dataset.act === 'create') {
      const code = rand(5, ROOM_ABC);
      history.replaceState(null, '', '?room=' + code + (params.get('broker') ? '&broker=' + encodeURIComponent(BROKER) : ''));
      startHost(code, E.createGame(DEFAULT_CASE, { secret, name: n }));
    } else {
      const code = (room || document.getElementById('room').value).trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) { toast('Код комнаты — 5 символов'); return; }
      startClient(code, n);
    }
  });
  app.querySelector('[data-act="rules"]').addEventListener('click', openRules);
}

function renderConnecting() {
  app.innerHTML = `
    <main class="home">
      ${brand()}
      <section class="box center">
        <div class="spinner" aria-hidden="true"></div>
        <p>Подключаемся к комнате <b class="code">${esc(session.room)}</b>…</p>
        ${ui.joinSlow ? `<p class="hint">Ответа пока нет. Проверьте код комнаты и попросите ведущего не закрывать вкладку с игрой.</p>` : ''}
        <button class="btn btn--ghost" data-act="back">Назад</button>
      </section>
    </main>`;
  app.querySelector('[data-act="back"]').onclick = () => leave();
}

function playerChips() {
  return view.players.map((p) => {
    const turn = p.pid === view.turnPid;
    return `<li class="chip ${turn ? 'chip--turn' : ''} ${p.online ? '' : 'chip--off'}">
      <span class="dot" title="${p.online ? 'в сети' : 'не в сети'}"></span>
      <span class="chip__name">${esc(p.name)}${p.pid === view.me ? ' <small>(вы)</small>' : ''}${p.pid === view.hostPid ? ' <small>★</small>' : ''}</span>
      ${view.phase === 'play' ? `<span class="chip__count" title="Карт на руке">${p.handCount}</span>` : ''}
    </li>`;
  }).join('');
}

function renderLobby() {
  const cd = caseOf(view);
  const isHost = view.isHost;
  app.innerHTML = `
    <main class="home">
      <header class="topline">${brand()}<span id="net" class="net"></span></header>
      <section class="box">
        <p class="eyebrow">Комната</p>
        <p class="room-code">${esc(session.room)}</p>
        <p class="hint">Отправьте друзьям ссылку или код. Играть можно с телефона.</p>
        <div class="row">
          <button class="btn btn--primary" data-act="share">Пригласить</button>
          <button class="btn" data-act="copy">Скопировать ссылку</button>
        </div>
      </section>
      <section class="box">
        <p class="eyebrow">Сыщики · ${view.players.length} из ${E.MAX_PLAYERS}</p>
        <ul class="people">
          ${view.players.map((p, i) => `
            <li class="${p.online ? '' : 'off'}">
              <span class="dot"></span>
              <span>${esc(p.name)}${p.pid === view.me ? ' <small>(вы)</small>' : ''}${i === 0 ? ' <small>ведущий</small>' : ''}</span>
              ${isHost && i > 0 ? `<button class="x" data-kick="${esc(p.pid)}" aria-label="Убрать ${esc(p.name)}">×</button>` : ''}
            </li>`).join('')}
        </ul>
      </section>
      <section class="box">
        <p class="eyebrow">Дело</p>
        <h2>${esc(cd.title)}</h2>
        <p class="hint">${esc(cd.subtitle)}</p>
      </section>
      ${!ui.hostOnline && !isHost ? `<p class="alert">Ведущий не в сети. Ждём его возвращения…</p>` : ''}
      ${isHost
        ? `<button class="btn btn--primary btn--big" data-act="start">Начать расследование</button>
           <p class="hint center">Не закрывайте эту вкладку: игра идёт через ваше устройство.</p>`
        : `<p class="hint center">Ждём, когда ведущий начнёт игру.</p>`}
      <div class="row center">
        <button class="link" data-act="rules">Как играть</button>
        <button class="link" data-act="leave">Выйти</button>
      </div>
    </main>`;
  renderStatus();
  app.onclick = (e) => {
    const b = e.target.closest('[data-act],[data-kick]');
    if (!b) return;
    if (b.dataset.kick) return act({ type: 'kick', pid: b.dataset.kick });
    const a = b.dataset.act;
    if (a === 'start') act({ type: 'start' });
    if (a === 'rules') openRules();
    if (a === 'leave') confirmLeave();
    if (a === 'copy') copyInvite();
    if (a === 'share') shareInvite();
  };
}

async function copyInvite() {
  try { await navigator.clipboard.writeText(inviteLink()); toast('Ссылка скопирована'); } catch (_) { prompt('Скопируйте ссылку', inviteLink()); }
}

async function shareInvite() {
  if (navigator.share) {
    try { await navigator.share({ title: 'Сыскное бюро', text: `Заходи расследовать дело! Код комнаты: ${session.room}`, url: inviteLink() }); return; } catch (_) { return; }
  }
  copyInvite();
}

function confirmLeave() {
  const msg = session.role === 'host'
    ? 'Выйти из игры? Вы ведущий: без вас игра остановится для всех.'
    : 'Выйти из игры? Вернуться можно будет по той же ссылке.';
  if (confirm(msg)) leave();
}

// ---------- игровой экран ----------
const TYPE_LABEL = { clue: 'Улика', scene: 'Место', twist: 'Поворот', end: 'Финал' };

function cardHtml(cd, id, opts = {}) {
  const c = card(cd, id);
  if (!c) return '';
  const hasValue = c.type === 'clue' || c.type === 'scene';
  return `
    <article class="card card--${c.type} ${opts.cls || ''}">
      <header class="card__head">
        ${hasValue ? `<span class="card__value" title="Можно выложить, когда в архиве не меньше ${c.value} карт">${c.value}</span>` : `<span class="card__value card__value--mark">${c.type === 'end' ? '■' : '!'}</span>`}
        <h3>${esc(c.title)}</h3>
        <span class="card__type">${TYPE_LABEL[c.type]}${c.marks ? ' · на схеме' : ''}</span>
      </header>
      <p>${esc(c.text)}</p>
      ${opts.footer || ''}
    </article>`;
}

function ensureGameSkeleton() {
  if (document.getElementById('game')) return;
  app.innerHTML = `
    <div id="game" class="game">
      <header class="topbar">
        <div class="topbar__title">${brand()}</div>
        <div class="stats" id="stats"></div>
        <div class="topbar__actions">
          <span id="net" class="net"></span>
          <button class="iconbtn" data-act="rules" aria-label="Правила">?</button>
          <button class="iconbtn" data-act="leave" aria-label="Выйти" title="Выйти"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 8l-4 4 4 4"/><path d="M5 12h10"/></svg></button>
        </div>
      </header>
      <ul class="chips" id="chips"></ul>
      <div id="banner"></div>
      <div class="layout" id="layout">
        <section class="panel" id="p-hand"></section>
        <section class="panel" id="p-table"></section>
        <section class="panel panel--side" id="p-side">
          <div id="p-map"></div>
          <div id="p-chat" class="chat">
            <h2 class="section-title">Чат</h2>
            <div id="chat-list" class="chat__list"></div>
            <form id="chat-form" class="chat__form" autocomplete="off">
              <input id="chat-input" maxlength="300" placeholder="Сообщение…" aria-label="Сообщение">
              <button class="btn btn--primary" aria-label="Отправить">↑</button>
            </form>
          </div>
        </section>
      </div>
      <nav class="tabs" id="tabs"></nav>
    </div>`;

  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    act({ type: 'chat', text });
    input.value = '';
  });

  app.onclick = (e) => {
    const b = e.target.closest('[data-act],[data-tab],[data-play],[data-archive],[data-confirm],[data-answer]');
    if (!b) return;
    if (b.dataset.tab) { ui.tab = b.dataset.tab; renderGame(); window.scrollTo({ top: 0 }); return; }
    if (b.dataset.play) { act({ type: 'play', cardId: b.dataset.play }); ui.confirmArchive = null; return; }
    if (b.dataset.archive) { ui.confirmArchive = b.dataset.archive; renderGame(); return; }
    if (b.dataset.confirm) {
      if (b.dataset.confirm === 'yes') act({ type: 'archive', cardId: ui.confirmArchive });
      ui.confirmArchive = null;
      renderGame();
      return;
    }
    if (b.dataset.answer) {
      const [q, opt] = b.dataset.answer.split(':');
      act({ type: 'answer', q, opt: Number(opt) });
      return;
    }
    const a = b.dataset.act;
    if (a === 'rules') openRules();
    if (a === 'leave') confirmLeave();
    if (a === 'skip') act({ type: 'skip' });
    if (a === 'ready') act({ type: 'ready', value: !view.ready[view.me] });
    if (a === 'reset' && confirm('Вернуть всех в комнату ожидания? Текущая партия закончится.')) act({ type: 'reset' });
  };
}

function renderGame() {
  ensureGameSkeleton();
  const cd = caseOf(view);
  const layout = document.getElementById('layout');
  layout.dataset.tab = ui.tab;

  // счётчики
  document.getElementById('stats').innerHTML = view.phase === 'play'
    ? `<span class="stat" title="Карт в архиве"><b>${view.archiveCount}</b> в архиве</span><span class="stat" title="Карт в колоде"><b>${view.deckCount}</b> в колоде</span>`
    : `<span class="stat">${view.phase === 'questions' ? 'Доклад следователю' : 'Дело раскрыто?'}</span>`;
  document.getElementById('chips').innerHTML = playerChips();
  renderStatus();

  // баннер хода
  const banner = document.getElementById('banner');
  let b = '';
  if (!ui.hostOnline && !view.isHost) b = `<div class="banner banner--bad">Ведущий не в сети. Ждём его возвращения…</div>`;
  else if (view.phase === 'play') {
    const cur = view.players.find((p) => p.pid === view.turnPid);
    if (view.turnPid === view.me) {
      b = `<div class="banner banner--me"><span>Ваш ход: выложите карту на стол или отправьте в архив</span>${ui.tab !== 'hand' ? '<button class="btn btn--small" data-tab="hand">К картам</button>' : ''}</div>`;
    } else if (cur) {
      b = `<div class="banner"><span>Ходит <b>${esc(cur.name)}</b>${cur.online ? '' : ' — не в сети'}</span>${!cur.online && view.isHost ? '<button class="btn btn--small" data-act="skip">Пропустить ход</button>' : ''}</div>`;
    }
    if (view.endDrawn) b += `<div class="banner banner--end">Колода закончилась. Доиграйте карты с рук</div>`;
  } else if (view.phase === 'questions') {
    b = `<div class="banner banner--me"><span>Все карты сыграны. Ответьте вместе на вопросы следователя</span>${ui.tab !== 'hand' ? '<button class="btn btn--small" data-tab="hand">К докладу</button>' : ''}</div>`;
  }
  banner.innerHTML = b;

  // вкладки (на телефоне)
  const unread = Math.max(0, view.chat.length - ui.seenChat);
  if (ui.tab === 'chat') ui.seenChat = view.chat.length;
  const firstTab = view.phase === 'play' ? `Рука <small>${view.hand.length}</small>` : view.phase === 'questions' ? 'Доклад' : 'Итог';
  document.getElementById('tabs').innerHTML = [
    ['hand', firstTab],
    ['table', `Стол <small>${view.table.length}</small>`],
    ['map', 'Схема'],
    ['chat', `Чат${unread && ui.tab !== 'chat' ? ` <small class="badge">${unread}</small>` : ''}`],
  ].map(([k, label]) => `<button class="tab ${ui.tab === k ? 'tab--on' : ''}" data-tab="${k}">${label}</button>`).join('');

  if (view.phase === 'play') renderHand(cd);
  else if (view.phase === 'questions') renderQuestions(cd);
  else renderResult(cd);
  renderTable(cd);
  renderMap(cd);
  renderChat();
}

function renderHand(cd) {
  const el = document.getElementById('p-hand');
  const myTurn = view.turnPid === view.me;
  if (!view.hand.length) {
    el.innerHTML = `<h2 class="section-title">Ваши карты</h2><p class="empty">Ваши карты закончились. Подождите, пока остальные доиграют свои.</p>`;
    return;
  }
  el.innerHTML = `
    <h2 class="section-title">Ваши карты <small>— показывать и пересказывать нельзя</small></h2>
    <div class="hand">
      ${view.hand.map((id) => {
        const c = card(cd, id);
        const can = c.value <= view.archiveCount;
        const confirming = ui.confirmArchive === id;
        let footer = '';
        if (myTurn && confirming) {
          footer = `<footer class="card__actions card__actions--confirm">
            <span>Отправить в архив? Прочитать её до конца игры будет нельзя.</span>
            <button class="btn btn--danger btn--small" data-confirm="yes">В архив</button>
            <button class="btn btn--small" data-confirm="no">Отмена</button>
          </footer>`;
        } else if (myTurn) {
          footer = `<footer class="card__actions">
            <button class="btn btn--primary btn--small" data-play="${id}" ${can ? '' : 'disabled'}>На стол</button>
            <button class="btn btn--small" data-archive="${id}">В архив</button>
            ${can ? '' : `<span class="why">нужно ${c.value} в архиве, сейчас ${view.archiveCount}</span>`}
          </footer>`;
        } else if (!can) {
          footer = `<footer class="card__actions"><span class="why">На стол — когда в архиве будет ${c.value}</span></footer>`;
        }
        return cardHtml(cd, id, { footer, cls: confirming ? 'card--confirm' : '' });
      }).join('')}
    </div>`;
}

function renderTable(cd) {
  const el = document.getElementById('p-table');
  const others = view.players.filter((p) => p.pid !== view.me && p.handTitles.length);
  const items = [...view.table].reverse();
  el.innerHTML = `
    <details class="intro" ${view.table.length < 3 ? 'open' : ''}>
      <summary>Вводная: ${esc(cd.title)}</summary>
      ${cd.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
    </details>
    ${view.phase === 'play' && others.length ? `
      <details class="others" open>
        <summary>У других на руках</summary>
        <p class="hint">Названия карт можно знать всем. Содержание — нет.</p>
        ${others.map((p) => `
          <div class="others__row"><b>${esc(p.name)}</b>
            <ul>${p.handTitles.map((t) => `<li><span class="mini-value">${t.value}</span>${esc(t.title)}</li>`).join('')}</ul>
          </div>`).join('')}
      </details>` : ''}
    <h2 class="section-title">На столе ${view.archiveCount ? `<small>· в архиве ${view.archiveCount} ${plural(view.archiveCount, 'карта', 'карты', 'карт')}</small>` : ''}</h2>
    ${items.length ? `<div class="table">${items.map((t) => cardHtml(cd, t.id, {
      footer: t.by ? `<footer class="card__by">Выложено: ${esc(playerName(t.by))}</footer>` : '',
    })).join('')}</div>` : `<p class="empty">Пока пусто. Первые карты с числом 0 можно выложить сразу.</p>`}
    <details class="log">
      <summary>Журнал хода игры</summary>
      <ol>${[...view.log].reverse().map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>
    </details>`;
}

function revealedMarks(cd) {
  const marks = [];
  for (const t of view.table) {
    for (const m of card(cd, t.id)?.marks || []) if (!marks.includes(m)) marks.push(m);
  }
  if (view.phase === 'result') {
    for (const c of cd.cards) for (const m of c.marks || []) if (!marks.includes(m)) marks.push(m);
  }
  return marks;
}

function renderMap(cd) {
  const el = document.getElementById('p-map');
  const marks = revealedMarks(cd);
  const pts = cd.map.points;
  const showNames = marks.some((m) => pts[m].names);
  const showPlatform = marks.some((m) => pts[m].platform);
  const pins = marks.filter((m) => pts[m].x != null);
  const rooms = cd.map.rooms;

  const compartments = rooms.map((name, i) => {
    const x = 190 + i * 120;
    return `
      <rect x="${x}" y="100" width="120" height="170" class="m-room"/>
      <rect x="${x + 35}" y="266" width="50" height="8" class="m-win"/>
      <rect x="${x + 40}" y="96" width="40" height="8" class="m-door"/>
      <text x="${x + 60}" y="132" class="m-num">${i + 1}</text>
      ${showNames ? `<text x="${x + 60}" y="158" class="m-name">${esc(name)}</text>` : ''}`;
  }).join('');

  const corridorWins = Array.from({ length: 8 }, (_, i) => `<rect x="${60 + i * 120}" y="36" width="50" height="8" class="m-win"/>`).join('');

  el.innerHTML = `
    <h2 class="section-title">Схема вагона № 4</h2>
    <div class="map">
      <svg viewBox="0 0 1000 300" role="img" aria-label="Схема спального вагона">
        ${showPlatform ? `<rect x="10" y="4" width="980" height="22" class="m-platform"/><text x="500" y="20" class="m-plabel">ПЕРРОН В ЛОЗОВОЙ</text>` : ''}
        <rect x="10" y="40" width="980" height="230" class="m-wagon"/>
        ${corridorWins}
        <text x="560" y="76" class="m-label">коридор</text>
        <rect x="10" y="100" width="120" height="170" class="m-room"/>
        <text x="70" y="180" class="m-label">служебное</text>
        <rect x="130" y="100" width="60" height="170" class="m-room m-room--stove"/>
        <text x="160" y="150" class="m-label m-small">печь</text>
        ${compartments}
        <rect x="910" y="100" width="80" height="170" class="m-room"/>
        <text x="950" y="140" class="m-label m-small">уборная</text>
        <text x="500" y="292" class="m-caption">окна купе</text>
        ${pins.map((m, i) => `<g class="m-pin"><circle cx="${pts[m].x}" cy="${pts[m].y}" r="14"/><text x="${pts[m].x}" y="${pts[m].y + 5}">${i + 1}</text></g>`).join('')}
      </svg>
    </div>
    ${marks.length ? `<ol class="legend">
      ${pins.map((m, i) => `<li><span class="pin">${i + 1}</span>${esc(pts[m].label)}</li>`).join('')}
      ${marks.filter((m) => pts[m].x == null).map((m) => `<li><span class="pin pin--info">i</span>${esc(pts[m].label)}</li>`).join('')}
    </ol>` : `<p class="empty">Детали появятся на схеме, когда на стол лягут карты места преступления.</p>`}`;
}

function renderChat() {
  const list = document.getElementById('chat-list');
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.innerHTML = view.chat.length
    ? view.chat.map((m) => `<p class="msg ${m.pid === view.me ? 'msg--me' : ''}"><b>${esc(playerName(m.pid))}</b>${esc(m.text)}</p>`).join('')
    : `<p class="empty">Обсуждайте выложенные карты здесь или голосом. Пересказывать карты с руки нельзя.</p>`;
  if (atBottom) list.scrollTop = list.scrollHeight;
}

function renderQuestions(cd) {
  const el = document.getElementById('p-hand');
  const allAnswered = cd.questions.every((q) => view.answers[q.id] !== undefined);
  const online = view.players.filter((p) => p.online);
  const readyCount = online.filter((p) => view.ready[p.pid]).length;
  const meReady = !!view.ready[view.me];
  el.innerHTML = `
    <h2 class="section-title">Доклад следователю</h2>
    <p class="hint">Ответы общие: их видят и могут менять все. Когда все нажмут «Готовы», доклад будет сдан. Любая правка ответа сбрасывает готовность.</p>
    <ol class="questions">
      ${cd.questions.map((q) => `
        <li class="q">
          <p class="q__text">${esc(q.text)} <small>${q.points} ${plural(q.points, 'очко', 'очка', 'очков')}</small></p>
          <div class="q__opts">
            ${q.options.map((o, i) => `<button class="opt ${view.answers[q.id] === i ? 'opt--on' : ''}" data-answer="${q.id}:${i}">${esc(o)}</button>`).join('')}
          </div>
        </li>`).join('')}
    </ol>
    <div class="ready">
      <p>Готовы: <b>${readyCount}</b> из ${online.length}${online.length ? ' — ' + online.map((p) => `${esc(p.name)} ${view.ready[p.pid] ? '✓' : '…'}`).join(', ') : ''}</p>
      <button class="btn ${meReady ? '' : 'btn--primary'} btn--big" data-act="ready" ${allAnswered ? '' : 'disabled'}>
        ${meReady ? 'Отменить готовность' : allAnswered ? 'Готовы сдать доклад' : 'Ответьте на все вопросы'}
      </button>
    </div>`;
}

function renderResult(cd) {
  const el = document.getElementById('p-hand');
  const r = view.result;
  el.innerHTML = `
    <section class="result">
      <p class="eyebrow">Итог расследования</p>
      <p class="score"><b>${r.total}</b> из ${r.max}</p>
      <h2 class="rank">${esc(r.rank.title)}</h2>
      <p>${esc(r.rank.text)}</p>
    </section>
    <h2 class="section-title">Ваши ответы</h2>
    <ol class="questions questions--result">
      ${cd.questions.map((q, i) => {
        const pr = r.perQ[i];
        const given = view.answers[q.id];
        return `<li class="q ${pr.ok ? 'q--ok' : 'q--bad'}">
          <p class="q__text">${esc(q.text)} <small>${pr.points} из ${q.points}</small></p>
          <p>${pr.ok ? '✓' : '✗'} ${esc(q.options[given] ?? '—')}</p>
          ${pr.ok ? '' : `<p class="q__right">Верно: ${esc(q.options[q.correct])}</p>`}
        </li>`;
      }).join('')}
    </ol>
    <details class="solution" open>
      <summary>Разгадка</summary>
      ${cd.solution.map((p) => `<p>${esc(p)}</p>`).join('')}
    </details>
    ${view.archive?.length ? `
      <details class="archive">
        <summary>Что лежало в архиве (${view.archive.length})</summary>
        <div class="table">${view.archive.map((a) => cardHtml(cd, a.id, { footer: `<footer class="card__by">В архив отправлено: ${esc(playerName(a.by))}</footer>` })).join('')}</div>
      </details>` : ''}
    ${view.isHost ? `<button class="btn btn--big" data-act="reset">Вернуться в комнату ожидания</button>` : ''}`;
}

// ---------- правила ----------
function openRules() {
  const d = document.getElementById('rules');
  const sizes = Object.entries(E.HAND_SIZE).map(([n, s]) => `${n} — ${s}`).join(', ');
  d.innerHTML = `
    <form method="dialog" class="rules">
      <h2>Как играть</h2>
      <p>Вы вместе расследуете одно дело. Улики — это карты. В конце нужно ответить на вопросы следователя и набрать как можно больше очков.</p>
      <ol>
        <li><b>Колоду не перемешивают.</b> Каждый получает карты на руку. Сколько карт, зависит от числа игроков: ${sizes}.</li>
        <li><b>Свои карты нельзя показывать и пересказывать.</b> Можно только назвать заголовок — заголовки чужих карт видны всем на вкладке «Стол».</li>
        <li><b>В свой ход сделайте одно из двух:</b>
          <ul>
            <li><b>Выложить карту на стол.</b> Её прочтут все, и её можно обсуждать. Но выложить карту можно, только если её число не больше, чем карт в архиве.</li>
            <li><b>Отправить карту в архив.</b> Её никто не прочтёт до конца игры. Зато архив растёт, и открываются карты с большими числами.</li>
          </ul>
        </li>
        <li>После хода вы берёте новую карту из колоды. <b>Повороты сюжета</b> открываются сразу всем.</li>
        <li>Карты места преступления отмечают детали на <b>схеме вагона</b>.</li>
        <li>Когда придёт карта <b>«Дело закрыто»</b>, колода кончилась. Доиграйте карты с рук.</li>
        <li>В конце все вместе отвечают на вопросы. Когда все нажмут «Готовы», вы узнаете счёт и разгадку.</li>
      </ol>
      <p class="hint">Записывать улики нельзя — полагайтесь на память. Обсуждать выложенные карты можно в чате или голосом. Игра одноразовая: второй раз дело уже не загадка.</p>
      <button class="btn btn--primary">Понятно</button>
    </form>`;
  d.showModal();
}

// ---------- запуск ----------
function boot() {
  const saved = store.get('dg.session');
  const room = (params.get('room') || '').toUpperCase();
  if (saved && (!room || room === saved.room) && (saved.broker || DEFAULT_BROKER) === BROKER) {
    if (saved.role === 'host') {
      const st = store.get('dg.host.' + saved.room);
      if (st && st.hostSecret === secret) { startHost(saved.room, st); return; }
    } else {
      startClient(saved.room, store.get('dg.name', ''));
      return;
    }
  }
  render();
}

boot();
