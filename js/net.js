// Сеть через публичный MQTT-брокер по WebSocket. Сервер не нужен, работает через любой NAT.
// Ведущий хранит состояние и рассылает каждому игроку его личный «вид».
// Внимание: брокер публичный, и тексты карт всё равно лежат в исходниках страницы.
// Скрытность карт держится на честности игроков, как и в настольной версии.
//
// Присутствие: у каждого подключения свой топик presence/<secret>/<conn> с сохранённым
// сообщением «online». Если подключение обрывается, брокер стирает его «завещанием»
// (пустое сохранённое сообщение). Игрок в сети, пока у него есть хоть одно живое подключение.
// Так старое отвалившееся подключение не может «выключить» новое.

/* global mqtt */

export const DEFAULT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const PREFIX = 'detgame/v1/';
const STALE_AFTER_HIDDEN_MS = 8000;

function topics(room) {
  const base = PREFIX + room;
  return {
    toHost: base + '/to-host',
    hostConn: (conn) => base + '/host/' + conn,
    hostAll: base + '/host/+',
    presence: (secret, conn) => base + '/presence/' + secret + '/' + conn,
    presenceAll: base + '/presence/+/+',
    player: (secret) => base + '/p/' + secret,
    epoch: base + '/epoch',
    backup: base + '/backup',
  };
}

const rid = () => Math.random().toString(36).slice(2, 10);
const decode = (buf) => new TextDecoder().decode(buf);
function parse(buf) {
  try { return JSON.parse(decode(buf)); } catch (_) { return null; }
}

// Учёт живых подключений. После переподключения брокер присылает только те отметки,
// что живы сейчас, поэтому всё, что не подтвердилось за пару секунд, считаем умершим.
function tracker(onChange) {
  const map = new Map(); // key -> Set(conn)
  let confirmed = null;
  let timer = null;
  const alive = (key) => (map.get(key)?.size || 0) > 0;
  function seen(key, conn, online) {
    const set = map.get(key) || new Set();
    const was = set.size > 0;
    if (online) { set.add(conn); confirmed?.add(key + '/' + conn); } else set.delete(conn);
    map.set(key, set);
    if (was !== set.size > 0) onChange(key, set.size > 0);
  }
  function resync() {
    confirmed = new Set();
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const [key, set] of map) {
        const was = set.size > 0;
        for (const conn of [...set]) if (!confirmed.has(key + '/' + conn)) set.delete(conn);
        if (was !== set.size > 0) onChange(key, set.size > 0);
      }
      confirmed = null;
    }, 2500);
  }
  const has = (key, conn) => !!map.get(key)?.has(conn);
  return { seen, resync, alive, has };
}

// Подключение, которое умеет полностью пересоздаваться: после сна телефона
// старый сокет часто «жив» только на словах, и ждать таймаута долго.
function resilient({ url, presenceTopic, topics: subs, onBeforeSubscribe, onConnect, onMessage, onStatus }) {
  let client = null;
  let conn = null;
  let hiddenAt = 0;
  let closed = false;
  let retryTimer = null;

  function open() {
    conn = rid();
    const topic = presenceTopic(conn);
    const c = mqtt.connect(url, {
      clientId: 'dg_' + rid(),
      clean: true,
      keepalive: 20,
      reconnectPeriod: 0, // переподключаемся сами, каждый раз с новым conn
      connectTimeout: 10000,
      will: { topic, payload: '', retain: true, qos: 1 },
    });
    c.on('connect', () => {
      if (c !== client) return;
      onStatus?.('online');
      // Сначала подписываемся, потом объявляем себя в сети: иначе первые сообщения потеряются.
      onBeforeSubscribe?.();
      c.subscribe(subs, { qos: 1 }, () => {
        if (c !== client) return;
        c.publish(topic, 'online', { retain: true, qos: 1 });
        onConnect?.(c);
      });
    });
    c.on('close', () => {
      if (c !== client || closed) return;
      onStatus?.('offline');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(restart, 2000);
    });
    c.on('error', () => c === client && onStatus?.('error'));
    c.on('message', (t, payload) => c === client && onMessage(t, payload));
    client = c;
  }

  function restart() {
    if (closed) return;
    clearTimeout(retryTimer);
    const old = client;
    onStatus?.('connecting');
    open();
    // Резко рвём старое соединение: брокер сам сотрёт его присутствие.
    try { old?.end(true); } catch (_) { /* уже закрыто */ }
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    const slept = hiddenAt && Date.now() - hiddenAt > STALE_AFTER_HIDDEN_MS;
    hiddenAt = 0;
    if (slept || !client.connected) restart();
  }
  const onOnline = () => restart();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  window.addEventListener('pageshow', (e) => { if (e.persisted) restart(); });

  open();

  return {
    get client() { return client; },
    get conn() { return conn; },
    restart,
    publish(topic, payload, opts) { client.publish(topic, payload, opts); },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      const c = client;
      c.publish(presenceTopic(conn), '', { retain: true, qos: 1 }, () => c.end());
    },
  };
}

// Ведущий. onMessage(secret, msg) — пришло от игрока; onPresence(secret, online).
export function hostNet({ url, room, secret, onMessage, onPresence, onStatus, onEpoch, onReady }) {
  const t = topics(room);
  const people = tracker((who, online) => onPresence(who, online));

  const link = resilient({
    url,
    presenceTopic: (conn) => t.hostConn(conn),
    topics: [t.toHost, t.presenceAll, t.epoch],
    onStatus,
    onBeforeSubscribe: () => people.resync(),
    // Сначала узнаём, не сменился ли ведущий, пока нас не было, и только потом рассылаем.
    onConnect: () => setTimeout(() => onReady?.(), 2000),
    onMessage: (topic, payload) => {
      if (topic === t.toHost) {
        const msg = parse(payload);
        if (msg && typeof msg.secret === 'string' && msg.secret !== secret) onMessage(msg.secret, msg);
        return;
      }
      if (topic === t.epoch) {
        const msg = parse(payload);
        if (msg) onEpoch?.(msg);
        return;
      }
      const m = topic.match(/\/presence\/([^/]+)\/([^/]+)$/);
      if (!m || m[1] === secret) return;
      people.seen(m[1], m[2], decode(payload) === 'online');
    },
  });

  return {
    send(toSecret, msg, retain = false) {
      link.publish(t.player(toSecret), JSON.stringify(msg), { qos: 1, retain });
    },
    announce(epoch) {
      link.publish(t.epoch, JSON.stringify(epoch), { qos: 1, retain: true });
    },
    backup(data) {
      link.publish(t.backup, JSON.stringify(data), { qos: 1, retain: true });
    },
    // Стереть сохранённое состояние для устройства, которое больше не в игре.
    forget(oldSecret) {
      link.publish(t.player(oldSecret), '', { qos: 1, retain: true });
    },
    isOnline: (who) => people.alive(who),
    restart: () => link.restart(),
    close: () => link.close(),
  };
}

// Игрок. onMessage(msg) — пришло от ведущего; onHost(online) — статус ведущего.
export function clientNet({ url, room, secret, name, onMessage, onHost, onStatus }) {
  const t = topics(room);
  let link = null;
  const backupWaiters = [];
  const host = tracker((_, online) => {
    onHost(online);
    if (online) hello();
  });

  const send = (msg) => link.publish(t.toHost, JSON.stringify({ ...msg, secret }), { qos: 1 });
  const hello = () => send({ t: 'hello', name });

  link = resilient({
    url,
    presenceTopic: (conn) => t.presence(secret, conn),
    topics: [t.player(secret), t.hostAll],
    onStatus,
    onBeforeSubscribe: () => host.resync(),
    onConnect: () => hello(),
    onMessage: (topic, payload) => {
      const hm = topic.match(/\/host\/([^/]+)$/);
      if (hm) {
        const online = decode(payload) === 'online';
        const fresh = online && !host.has('host', hm[1]);
        host.seen('host', hm[1], online);
        // Появилось новое подключение ведущего (возможно, это уже другой человек) — представимся.
        if (fresh) hello();
        return;
      }
      if (topic === t.backup) {
        const data = payload.length ? parse(payload) : null;
        const w = backupWaiters.splice(0);
        w.forEach((fn) => fn(data));
        return;
      }
      if (!payload.length) return;
      const msg = parse(payload);
      if (msg) onMessage(msg);
    },
  });

  return {
    act: (action) => send({ t: 'act', action }),
    claim: (pid) => send({ t: 'claim', pid }),
    // Прочитать резервную копию партии, которую держит брокер.
    fetchBackup(timeoutMs = 6000) {
      return new Promise((resolve) => {
        const c = link.client;
        const done = (data) => {
          clearTimeout(timer);
          c.unsubscribe(t.backup);
          resolve(data);
        };
        const timer = setTimeout(() => {
          const i = backupWaiters.indexOf(done);
          if (i >= 0) backupWaiters.splice(i, 1);
          done(null);
        }, timeoutMs);
        backupWaiters.push(done);
        c.subscribe(t.backup, { qos: 1 });
      });
    },
    hello,
    restart: () => link.restart(),
    close: () => link.close(),
  };
}
