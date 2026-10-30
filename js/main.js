import { CASES, CASE_LIST, DEFAULT_CASE, DIFFICULTY } from './cases/index.js';
import * as E from './engine.js';
import { artSvg, coverSvg } from './art.js';

// Список готовых картинок грузим в обход кэша браузера: он меняется при каждом
// добавлении картинок, а GitHub Pages разрешает браузеру хранить файлы до 10 минут.
let imageUrl = () => null;
import(`./images.js?t=${Date.now()}`)
  .then((m) => { imageUrl = m.imageUrl; if (view) render(); })
  .catch(() => { /* без списка остаются векторные рисунки */ });

// Картинка карты: готовое изображение, если есть, иначе векторный рисунок.
function cardArt(cd, c) {
  const url = imageUrl(cd.id, c.id);
  if (url) return `<div class="card__art card__art--img"><img src="${url}" alt=""></div>`;
  return c.art ? `<div class="card__art">${artSvg(c.art, cd)}</div>` : '';
}
function coverArt(cd) {
  const url = imageUrl(cd.id, 'cover');
  return url ? `<img src="${url}" alt="">` : coverSvg(cd.id);
}
import { hostNet, clientNet, DEFAULT_BROKER } from './net.js';

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

function setNetStatus(s) {
  const was = ui.netStatus;
  ui.netStatus = s;
  if (s === 'online') { clearTimeout(ui.netTimer); ui.netBad = false; }
  else if (was === 'online' || !ui.netTimer) {
    clearTimeout(ui.netTimer);
    ui.netTimer = setTimeout(() => { if (ui.netStatus !== 'online') { ui.netBad = true; render(); } }, 3000);
  }
  renderStatus();
  if (s === 'online') render();
}

let toastTimer = null;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ---------- отпечаток секрета ----------
// В резервную копию партии кладём не секреты игроков, а их отпечатки:
// по ним новый ведущий узнаёт вернувшихся, но сам секрет из копии не достать.
const hashCache = new Map();
async function hashOf(s) {
  const key = session.room + ':' + s;
  if (hashCache.has(key)) return hashCache.get(key);
  let hex;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch (_) {
    // Нет crypto.subtle (страница открыта не по https) — простой, но стабильный хеш.
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < key.length; i++) {
      const ch = key.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    hex = 'f' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
  }
  hashCache.set(key, hex);
  return hex;
}

async function ensureHashes() {
  for (const p of hostState?.players || []) {
    if (p.secret && !p.hash) p.hash = await hashOf(p.secret);
  }
}

// ---------- сеть: ведущий ----------
const host = { ready: false, handingOff: null, backupTimer: null };

function startHost(room, state) {
  session = { role: 'host', room };
  store.set('dg.session', { ...session, broker: BROKER });
  hostState = E.normalize(state);
  host.ready = false;
  host.handingOff = null;
  for (const p of hostState.players) p.online = p.secret === secret;
  const me = net = hostNet({
    url: BROKER,
    room,
    secret,
    onStatus: setNetStatus,
    onPresence: (s, online) => { if (E.setOnline(hostState, s, online, caseOf(hostState))) broadcast(); },
    onEpoch: (e) => {
      if (net !== me || !hostState) return;
      const cmp = E.compareEpoch(e, hostState);
      if (cmp > 0) {
        const name = hostState.players.find((p) => p.pid === e.hostPid)?.name;
        demote(name ? `Теперь ведущий — ${name}` : 'Роль ведущего перешла другому игроку');
      } else if (cmp < 0 && host.ready) {
        // Вернулся старый ведущий и затёр объявление — восстанавливаем своё.
        net.announce({ epoch: hostState.epoch, token: hostState.token, hostPid: hostState.hostPid });
        publishBackup();
      }
    },
    onReady: () => {
      if (net !== me || !hostState) return;
      host.ready = true;
      net.announce({ epoch: hostState.epoch, token: hostState.token, hostPid: hostState.hostPid });
      broadcast();
    },
    onMessage: (from, msg) => { if (net === me) hostMessage(from, msg); },
  });
  broadcast();
}

async function hostMessage(from, msg) {
  if (msg.t === 'hello') {
    let known = hostState.players.some((p) => p.secret === from);
    if (!known) {
      // После смены ведущего игроки представляются заново: узнаём их по отпечатку.
      const m = E.matchByHash(hostState, from, await hashOf(from));
      if (m) { broadcast(); return; }
    }
    known = hostState.players.some((p) => p.secret === from);
    if (!known && hostState.phase !== 'lobby') {
      // Игра идёт, а устройство незнакомое: предлагаем вернуться на своё место.
      net.send(from, { t: 'seats', seats: E.seatsFor(hostState) });
      return;
    }
    const res = E.addPlayer(hostState, { secret: from, name: msg.name });
    if (!res.ok) net.send(from, { t: 'rejected', msg: res.error });
    broadcast();
  } else if (msg.t === 'claim') {
    const res = E.claimSeat(hostState, caseOf(hostState), from, msg.pid);
    if (!res.ok) { net.send(from, { t: 'seats', seats: E.seatsFor(hostState), msg: res.error }); return; }
    res.player.hash = await hashOf(from);
    if (res.oldSecret) net.forget(res.oldSecret);
    broadcast();
  } else if (msg.t === 'act') {
    if (host.handingOff) { net.send(from, { t: 'error', msg: 'Ведущий передаёт роль. Повторите через пару секунд.' }); return; }
    const res = E.applyAction(hostState, caseOf(hostState), from, msg.action);
    if (!res.ok) net.send(from, { t: 'error', msg: res.error });
    else {
      if (res.kicked) net.send(res.kicked, { t: 'rejected', msg: 'Ведущий убрал вас из комнаты.' });
      broadcast();
    }
  }
}

function broadcast() {
  store.set('dg.host.' + session.room, hostState);
  const cd = caseOf(hostState);
  if (host.ready) {
    for (const p of hostState.players) {
      if (!p.secret || p.secret === secret) continue;
      net.send(p.secret, { t: 'state', view: E.viewFor(hostState, cd, p.secret) }, true);
    }
    scheduleBackup();
  }
  setView(E.viewFor(hostState, cd, secret));
}

// Резервная копия на брокере: по ней другой игрок сможет стать ведущим, если этот вылетит.
function scheduleBackup() {
  clearTimeout(host.backupTimer);
  host.backupTimer = setTimeout(publishBackup, 400);
}
async function publishBackup(force = false) {
  clearTimeout(host.backupTimer);
  if (!hostState || !host.ready || (host.handingOff && !force)) return;
  await ensureHashes();
  if (!hostState || !host.ready) return;
  net.backup({ room: session.room, savedAt: Date.now(), ...E.backupOf(hostState) });
}

// Добровольная передача роли игроку в сети.
async function handOff(pid) {
  const p = hostState.players.find((x) => x.pid === pid);
  if (!p || !p.online || !p.secret || p.secret === secret) { toast('Передать роль можно только игроку в сети.'); return; }
  host.handingOff = pid;
  await publishBackup(true);
  net.send(p.secret, { t: 'handoff' });
  toast(`Передаём роль ведущего: ${p.name}…`);
  const epoch = hostState.epoch;
  setTimeout(() => {
    if (session?.role === 'host' && host.handingOff === pid && hostState?.epoch === epoch) {
      host.handingOff = null;
      toast(`${p.name} не ответил(а). Вы остаётесь ведущим.`);
    }
  }, 12000);
}

// Нас сменил другой ведущий: становимся обычным игроком.
function demote(message) {
  if (session?.role !== 'host') return;
  const room = session.room;
  clearTimeout(host.backupTimer);
  host.ready = false;
  host.handingOff = null;
  try { net.close(); } catch (_) { /* уже закрыто */ }
  store.del('dg.host.' + room);
  hostState = null;
  startClient(room, store.get('dg.name', ''));
  if (message) toast(message);
}

// ---------- сеть: игрок ----------
function startClient(room, name) {
  session = { role: 'client', room };
  store.set('dg.session', { ...session, broker: BROKER });
  ui.joinSlow = false;
  ui.takingOver = false;
  clearTimeout(ui.joinTimer);
  ui.joinTimer = setTimeout(() => { if (!view) { ui.joinSlow = true; render(); } }, 10000);
  const me = net = clientNet({
    url: BROKER,
    room,
    secret,
    name,
    onStatus: setNetStatus,
    onHost: (online) => {
      if (net !== me) return;
      ui.hostOnline = online;
      clearTimeout(ui.hostTimer);
      ui.hostOffSince = online ? 0 : Date.now();
      if (!online) ui.hostTimer = setTimeout(render, TAKEOVER_AFTER_MS + 100);
      render();
    },
    onMessage: (msg) => {
      if (net !== me) return;
      if (msg.t === 'state') {
        ui.seats = null;
        clearInterval(ui.seatsTimer);
        const cmp = view ? E.compareEpoch(msg.view, view) : 1;
        if (cmp < 0) return; // устаревший ведущий
        if (cmp > 0 || !view || msg.view.rev >= view.rev || msg.view.phase !== view.phase) setView(msg.view);
      } else if (msg.t === 'seats') {
        if (view) return;
        ui.seats = { list: msg.seats, msg: msg.msg || '' };
        clearInterval(ui.seatsTimer);
        ui.seatsTimer = setInterval(() => net?.hello(), 4000);
        render();
      } else if (msg.t === 'handoff') {
        becomeHost('Ведущий передал вам свою роль');
      } else if (msg.t === 'error') {
        toast(msg.msg);
      } else if (msg.t === 'rejected') {
        leave(msg.msg);
      }
    },
  });
  render();
}

const TAKEOVER_AFTER_MS = 15000;

// Раскрывающиеся блоки перерисовываются после каждого хода — помним, какие открыл игрок.
const openState = {};
function openAttr(key, byDefault) {
  const open = key in openState ? openState[key] : byDefault;
  return `data-key="${key}"${open ? ' open' : ''}`;
}
// Запоминаем сразу по клику: событие toggle приходит позже и может попасть на уже перерисованный блок.
document.addEventListener('click', (e) => {
  const d = e.target.closest?.('summary')?.parentElement;
  if (d?.tagName === 'DETAILS' && d.dataset.key) openState[d.dataset.key] = !d.open;
}, true);

function hostAwayHtml(cls) {
  if (ui.takingOver) return `<div class="${cls}"><span>Берём роль ведущего…</span></div>`;
  return `<div class="${cls}">
    <span>Ведущий не в сети. ${canTakeOver()
      ? 'Если он не возвращается, любой из вас может стать ведущим — партия продолжится с того же места.'
      : 'Ждём его возвращения. Если он не вернётся за 15 секунд, любой из вас сможет стать ведущим.'}</span>
    ${canTakeOver() ? '<button class="btn btn--small btn--primary" data-act="takeover">Стать ведущим</button>' : ''}
  </div>`;
}

function confirmTakeover() {
  if (confirm('Стать ведущим? Игра будет идти через ваше устройство — не закрывайте вкладку до конца партии.')) becomeHost();
}

function handOffHtml() {
  const others = view.players.filter((p) => p.pid !== view.me && p.online);
  if (!view.isHost || !others.length) return '';
  return `<details class="handoff" ${openAttr('handoff', false)}>
    <summary>Передать роль ведущего</summary>
    <p class="hint">Если вам нужно уйти, передайте роль другому игроку: партия продолжится через его устройство, а вы останетесь в игре обычным сыщиком.</p>
    <div class="row">${others.map((p) => `<button class="btn btn--small" data-handoff="${esc(p.pid)}">${esc(p.name)}</button>`).join('')}</div>
  </details>`;
}
const canTakeOver = () => session?.role === 'client' && view && !ui.hostOnline && ui.hostOffSince && Date.now() - ui.hostOffSince >= TAKEOVER_AFTER_MS;

// Взять роль ведущего: по резервной копии с брокера.
async function becomeHost(message) {
  if (session?.role !== 'client' || ui.takingOver) return;
  ui.takingOver = true;
  render();
  const room = session.room;
  const data = await net.fetchBackup();
  if (session?.role !== 'client' || session.room !== room) return;
  if (!data || data.room !== room) {
    ui.takingOver = false;
    toast('Не удалось получить копию партии. Попробуйте ещё раз.');
    render();
    return;
  }
  const res = E.takeOver(data, secret, await hashOf(secret));
  if (!res.ok) { ui.takingOver = false; toast(res.error); render(); return; }
  delete res.state.room;
  delete res.state.savedAt;
  net.close();
  ui.takingOver = false;
  ui.hostOnline = true;
  startHost(room, res.state);
  toast(message || 'Вы — ведущий. Не закрывайте эту вкладку.');
}

function act(action) {
  if (!session) return;
  if (session.role === 'host') {
    if (action.type === 'case') {
      if (!CASES[action.caseId]) return;
      const r = E.setCase(hostState, action.caseId);
      if (!r.ok) { toast(r.error); return; }
      broadcast();
      return;
    }
    if (action.type === 'handoff') { handOff(action.pid); return; }
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
  ui.seats = null;
  clearInterval(ui.seatsTimer);
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

// ---------- экран не гаснет во время игры ----------
// Когда телефон засыпает, браузер рвёт соединение. Просим не гасить экран, пока открыта игра.
let wakeLock = null;
async function keepAwake() {
  if (!session || wakeLock || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { /* браузер не разрешил — не страшно */ }
}
function letSleep() {
  try { wakeLock?.release(); } catch (_) { /* уже отпущен */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', keepAwake);

// ---------- отрисовка ----------
function render() {
  if (session) keepAwake(); else letSleep();
  let screen = 'home';
  if (session && !view) screen = ui.seats ? 'seats' : 'connecting';
  else if (view?.phase === 'lobby') screen = 'lobby';
  else if (view) screen = 'game';

  if (app.dataset.screen !== screen) {
    app.dataset.screen = screen;
    app.innerHTML = '';
    app.onclick = null;
  }
  if (screen === 'home') renderHome();
  else if (screen === 'connecting') renderConnecting();
  else if (screen === 'seats') renderSeats();
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
  app.innerHTML = `
    <main class="home">
      ${brand()}
      <section class="hero">
        <p class="eyebrow">Кооперативный детектив · 1–6 игроков</p>
        <h1>Раскройте дело вместе</h1>
        <p class="lead">Соберите улики по карточкам, не показывая их друг другу, и ответьте на вопросы следователя. ${CASE_LIST.length} ${plural(CASE_LIST.length, 'дело', 'дела', 'дел')} — от лёгкого до очень сложного.</p>
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

function renderSeats() {
  const list = ui.seats.list;
  app.innerHTML = `
    <main class="home">
      <header class="topline">${brand()}<span id="net" class="net"></span></header>
      <section class="box">
        <p class="eyebrow">Комната ${esc(session.room)}</p>
        <h2>Игра уже идёт</h2>
        <p class="hint">Если вы вылетели, выберите себя — вернётесь на своё место со своими картами. Занять можно только место игрока, который сейчас не в сети.</p>
        ${ui.seats.msg ? `<p class="alert">${esc(ui.seats.msg)}</p>` : ''}
        <div class="seats">
          ${list.map((p) => {
            const can = !p.online && !p.host;
            return `<button class="seat" data-claim="${esc(p.pid)}" ${can ? '' : 'disabled'}>
              <span class="dot ${p.online ? '' : 'dot--off'}"></span>
              <span class="seat__name">${esc(p.name)}</span>
              <span class="seat__state">${p.host ? 'ведущий' : p.online ? 'в сети' : 'это я'}</span>
            </button>`;
          }).join('')}
        </div>
        <p class="hint">Если ваше имя ещё «в сети», подождите минуту: старое подключение отвалится само.</p>
      </section>
      <button class="link" data-act="back">Назад</button>
    </main>`;
  renderStatus();
  app.onclick = (e) => {
    const b = e.target.closest('[data-claim],[data-act]');
    if (!b) return;
    if (b.dataset.claim) {
      const p = list.find((x) => x.pid === b.dataset.claim);
      if (p && confirm(`Вернуться в игру как ${p.name}?`)) net.claim(p.pid);
    }
    if (b.dataset.act === 'back') leave();
  };
}

function playerChips() {
  return view.players.map((p0) => {
    // Если ведущий вылетел, обновлять список некому — его статус знаем сами.
    const p = p0.pid === view.hostPid && !view.isHost && !ui.hostOnline ? { ...p0, online: false } : p0;
    const turn = p.pid === view.turnPid;
    return `<li class="chip ${turn ? 'chip--turn' : ''} ${p.online ? '' : 'chip--off'}">
      <span class="dot" title="${p.online ? 'в сети' : 'не в сети'}"></span>
      <span class="chip__name">${esc(p.name)}${p.pid === view.me ? ' <small>(вы)</small>' : ''}${p.pid === view.hostPid ? ' <small>★</small>' : ''}${p.left ? ' <small>вне игры</small>' : ''}</span>
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
              <span>${esc(p.name)}${p.pid === view.me ? ' <small>(вы)</small>' : ''}${p.pid === view.hostPid ? ' <small>ведущий</small>' : ''}</span>
              ${isHost && p.pid !== view.hostPid ? `<button class="x" data-kick="${esc(p.pid)}" aria-label="Убрать ${esc(p.name)}">×</button>` : ''}
            </li>`).join('')}
        </ul>
      </section>
      <section class="box">
        <p class="eyebrow">${isHost ? 'Выберите дело' : 'Дело'}</p>
        ${isHost
          ? `<div class="cases">${CASE_LIST.map((c) => caseTile(c, { selected: c.id === cd.id, button: true })).join('')}</div>
             <p class="hint">Каждое дело можно сыграть один раз: второй раз оно уже не загадка.</p>`
          : caseTile(cd, { selected: true })}
      </section>
      ${!ui.hostOnline && !isHost ? hostAwayHtml('alert alert--row') : ''}
      ${handOffHtml()}
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
    const b = e.target.closest('[data-act],[data-kick],[data-case],[data-handoff]');
    if (!b) return;
    if (b.dataset.handoff) return confirmHandoff(b.dataset.handoff);
    if (b.dataset.kick) return act({ type: 'kick', pid: b.dataset.kick });
    if (b.dataset.case) return act({ type: 'case', caseId: b.dataset.case });
    const a = b.dataset.act;
    if (a === 'start') act({ type: 'start' });
    if (a === 'rules') openRules();
    if (a === 'leave') confirmLeave();
    if (a === 'takeover') confirmTakeover();
    if (a === 'copy') copyInvite();
    if (a === 'share') shareInvite();
  };
}

function difficultyBadge(level) {
  const d = DIFFICULTY[level] || DIFFICULTY[1];
  const pips = [1, 2, 3, 4].map((i) => `<i class="${i <= level ? 'on' : ''}"></i>`).join('');
  return `<span class="diff diff--${level}" title="${esc(d.hint)}"><span class="pips" aria-hidden="true">${pips}</span>${esc(d.label)}</span>`;
}

function caseTile(c, { selected, button } = {}) {
  const done = store.get('dg.done', {})[c.id];
  const tag = button ? 'button' : 'div';
  return `
    <${tag} class="case ${selected ? 'case--on' : ''}" ${button ? `data-case="${esc(c.id)}" aria-pressed="${selected}"` : ''}>
      <span class="cover">${coverArt(c)}</span>
      <span class="case__top">${difficultyBadge(c.difficulty)}<span class="case__meta">~${c.minutes} мин</span></span>
      <span class="case__title">${esc(c.title)}</span>
      <span class="case__sub">${esc(c.subtitle)}</span>
      <span class="case__blurb">${esc(c.blurb)}</span>
      ${done ? `<span class="case__done">Вы уже раскрыли это дело: ${done.total} из ${done.max}</span>` : ''}
    </${tag}>`;
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

function confirmHandoff(pid) {
  const p = view.players.find((x) => x.pid === pid);
  if (p && confirm(`Передать роль ведущего игроку ${p.name}?`)) act({ type: 'handoff', pid });
}

function confirmLeave() {
  const msg = session.role === 'host'
    ? 'Выйти из игры? Вы ведущий. Лучше сначала передайте роль другому игроку. Если просто выйти, игра встанет, пока кто-нибудь не станет ведущим.'
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
      ${cardArt(cd, c)}
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
    const b = e.target.closest('[data-act],[data-tab],[data-play],[data-archive],[data-confirm],[data-answer],[data-drop],[data-handoff]');
    if (!b) return;
    if (b.dataset.handoff) { confirmHandoff(b.dataset.handoff); return; }
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
    if (a === 'reconnect') net?.restart();
    if (a === 'takeover') confirmTakeover();
    if (b.dataset.drop) {
      const p = view.players.find((x) => x.pid === b.dataset.drop);
      if (p && confirm(`Раздать карты игрока ${p.name} остальным? Если игрок вернётся, то доберёт новые карты из колоды.`)) act({ type: 'drop', pid: p.pid });
    }
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
  if (ui.netBad) b += `<div class="banner banner--bad"><span>Нет связи. Переподключаемся…</span><button class="btn btn--small" data-act="reconnect">Переподключить</button></div>`;
  if (!ui.hostOnline && !view.isHost) b += hostAwayHtml('banner banner--bad');
  else if (view.phase === 'play') {
    const cur = view.players.find((p) => p.pid === view.turnPid);
    if (view.turnPid === view.me) {
      b += `<div class="banner banner--me"><span>Ваш ход: выложите карту на стол или отправьте в архив</span>${ui.tab !== 'hand' ? '<button class="btn btn--small" data-tab="hand">К картам</button>' : ''}</div>`;
    } else if (cur && cur.online) {
      b += `<div class="banner"><span>Ходит <b>${esc(cur.name)}</b></span></div>`;
    } else if (cur) {
      b += `<div class="banner banner--warn"><span>Ходит <b>${esc(cur.name)}</b>, но сейчас не в сети. ${view.isHost
        ? 'Можно подождать или раздать карты этого игрока остальным.'
        : 'Ждём возвращения. Ведущий может раздать карты этого игрока остальным.'}</span>
        ${view.isHost ? `<span class="row"><button class="btn btn--small" data-act="skip">Пропустить ход</button><button class="btn btn--small btn--danger" data-drop="${esc(cur.pid)}">Раздать карты</button></span>` : ''}
      </div>`;
    }
    if (view.isHost) {
      const away = view.players.filter((p) => !p.online && p.handCount && p.pid !== view.turnPid);
      for (const p of away) {
        b += `<div class="banner banner--warn"><span><b>${esc(p.name)}</b> не в сети, на руке ${p.handCount} ${plural(p.handCount, 'карта', 'карты', 'карт')}.</span><button class="btn btn--small btn--danger" data-drop="${esc(p.pid)}">Раздать карты</button></div>`;
      }
    }
    if (view.endDrawn) b += `<div class="banner banner--end">Колода закончилась. Доиграйте карты с рук</div>`;
  } else if (view.phase === 'questions') {
    b += `<div class="banner banner--me"><span>Все карты сыграны. Ответьте вместе на вопросы следователя</span>${ui.tab !== 'hand' ? '<button class="btn btn--small" data-tab="hand">К докладу</button>' : ''}</div>`;
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
    <details class="intro" ${openAttr('intro', view.table.length < 3)}>
      <summary>Вводная: ${esc(cd.title)}</summary>
      <div class="cover">${coverArt(cd)}</div>
      ${cd.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
    </details>
    ${view.phase === 'play' && others.length ? `
      <details class="others" ${openAttr('others', true)}>
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
    ${handOffHtml()}
    <details class="log" ${openAttr('log', false)}>
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

function shapeSvg(sh, marks) {
  if (sh.when && !marks.includes(sh.when)) return '';
  if (sh.t === 'rect') return `<rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" class="m-${sh.c}"/>`;
  if (sh.t === 'line') return `<line x1="${sh.x1}" y1="${sh.y1}" x2="${sh.x2}" y2="${sh.y2}" class="m-${sh.c}"/>`;
  if (sh.t === 'text') return `<text x="${sh.x}" y="${sh.y}" class="m-t m-${sh.c}">${esc(sh.s)}</text>`;
  return '';
}

function renderMap(cd) {
  const el = document.getElementById('p-map');
  const map = cd.map;
  const marks = revealedMarks(cd);
  const pts = map.points;
  const pins = marks.filter((m) => pts[m].x != null);
  const infos = marks.filter((m) => pts[m].x == null);

  el.innerHTML = `
    <h2 class="section-title">${esc(map.title)}</h2>
    <div class="map">
      <svg viewBox="0 0 ${map.width} ${map.height}" role="img" aria-label="${esc(map.title)}">
        ${map.shapes.map((sh) => shapeSvg(sh, marks)).join('')}
        ${pins.map((m, i) => `<g class="m-pin"><circle cx="${pts[m].x}" cy="${pts[m].y}" r="14"/><text x="${pts[m].x}" y="${pts[m].y + 5}">${i + 1}</text></g>`).join('')}
      </svg>
    </div>
    ${marks.length ? `<ol class="legend">
      ${pins.map((m, i) => `<li><span class="pin">${i + 1}</span>${esc(pts[m].label)}</li>`).join('')}
      ${infos.map((m) => `<li><span class="pin pin--info">i</span>${esc(pts[m].label)}</li>`).join('')}
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

// Порядок вариантов ответа: перемешан, чтобы верный не стоял всегда на одном месте,
// но одинаков у всех игроков (зависит только от дела и вопроса).
function optionOrder(cd, q) {
  let h = 2166136261;
  // Число в конце подобрано так, чтобы верные ответы не скапливались на одной позиции.
  for (const ch of cd.id + ':' + q.id + ':2365') h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
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
            ${optionOrder(cd, q).map((i) => `<button class="opt ${view.answers[q.id] === i ? 'opt--on' : ''}" data-answer="${q.id}:${i}">${esc(q.options[i])}</button>`).join('')}
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
  const done = store.get('dg.done', {});
  if (!done[cd.id] || done[cd.id].total < r.total) {
    done[cd.id] = { total: r.total, max: r.max };
    store.set('dg.done', done);
  }
  el.innerHTML = `
    <section class="result">
      <div class="cover">${coverArt(cd)}</div>
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
    <details class="solution" ${openAttr('solution', true)}>
      <summary>Разгадка</summary>
      ${cd.solution.map((p) => `<p>${esc(p)}</p>`).join('')}
    </details>
    ${view.archive?.length ? `
      <details class="archive" ${openAttr('archive', false)}>
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
        <li>Карты места преступления отмечают детали на <b>схеме места преступления</b>.</li>
        <li>Когда придёт карта <b>«Дело закрыто»</b>, колода кончилась. Доиграйте карты с рук.</li>
        <li>В конце все вместе отвечают на вопросы. Когда все нажмут «Готовы», вы узнаете счёт и разгадку.</li>
      </ol>
      <p><b>Если кто-то вылетел</b>, пусть снова откроет ссылку на игру. С того же телефона он вернётся сразу, с другого — выберет своё имя в списке. Если игрок не возвращается, ведущий может раздать его карты остальным и доиграть без него.</p>
      <p><b>Ведущий</b> может передать свою роль другому игроку (внизу вкладки «Стол»). Если ведущий вылетел и не вернулся за 15 секунд, любой игрок может нажать «Стать ведущим» — партия продолжится с того же места.</p>
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
