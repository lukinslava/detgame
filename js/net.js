// Сеть через публичный MQTT-брокер по WebSocket. Сервер не нужен, работает через любой NAT.
// Ведущий хранит состояние и рассылает каждому игроку его личный «вид».
// Внимание: брокер публичный, и тексты карт всё равно лежат в исходниках страницы.
// Скрытность карт держится на честности игроков, как и в настольной версии.

/* global mqtt */

export const DEFAULT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const PREFIX = 'detgame/v1/';

function topics(room) {
  const base = PREFIX + room;
  return {
    toHost: base + '/to-host',
    hostStatus: base + '/host-status',
    presence: (secret) => base + '/presence/' + secret,
    presenceAll: base + '/presence/+',
    player: (secret) => base + '/p/' + secret,
  };
}

function connect(url, will) {
  return mqtt.connect(url, {
    clientId: 'dg_' + Math.random().toString(36).slice(2, 12),
    clean: true,
    keepalive: 30,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    will,
  });
}

function reviveOnFocus(client) {
  const handler = () => {
    if (document.visibilityState === 'visible' && !client.connected && !client.disconnecting) {
      try { client.reconnect(); } catch (_) { /* reconnect сам повторится */ }
    }
  };
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('online', handler);
}

function parse(buf) {
  try { return JSON.parse(new TextDecoder().decode(buf)); } catch (_) { return null; }
}

// Ведущий. onMessage(secret, msg) — пришло от игрока; onPresence(secret, online).
export function hostNet({ url, room, secret, onMessage, onPresence, onStatus }) {
  const t = topics(room);
  const client = connect(url, { topic: t.hostStatus, payload: 'offline', retain: true, qos: 1 });
  reviveOnFocus(client);

  client.on('connect', () => {
    onStatus?.('online');
    client.subscribe([t.toHost, t.presenceAll], { qos: 1 });
    client.publish(t.hostStatus, 'online', { retain: true, qos: 1 });
  });
  client.on('reconnect', () => onStatus?.('connecting'));
  client.on('offline', () => onStatus?.('offline'));
  client.on('error', () => onStatus?.('error'));

  client.on('message', (topic, payload) => {
    if (topic === t.toHost) {
      const msg = parse(payload);
      if (msg && typeof msg.secret === 'string' && msg.secret !== secret) onMessage(msg.secret, msg);
      return;
    }
    const m = topic.match(/\/presence\/([^/]+)$/);
    if (m && m[1] !== secret) onPresence(m[1], new TextDecoder().decode(payload) === 'online');
  });

  return {
    send(toSecret, msg, retain = false) {
      client.publish(t.player(toSecret), JSON.stringify(msg), { qos: 1, retain });
    },
    close() {
      client.publish(t.hostStatus, 'offline', { retain: true, qos: 1 }, () => client.end());
    },
  };
}

// Игрок. onMessage(msg) — пришло от ведущего; onHost(online) — статус ведущего.
export function clientNet({ url, room, secret, name, onMessage, onHost, onStatus }) {
  const t = topics(room);
  const client = connect(url, { topic: t.presence(secret), payload: 'offline', retain: true, qos: 1 });
  reviveOnFocus(client);

  const hello = () => client.publish(t.toHost, JSON.stringify({ t: 'hello', secret, name }), { qos: 1 });

  client.on('connect', () => {
    onStatus?.('online');
    client.subscribe([t.player(secret), t.hostStatus], { qos: 1 }, () => {
      client.publish(t.presence(secret), 'online', { retain: true, qos: 1 });
      hello();
    });
  });
  client.on('reconnect', () => onStatus?.('connecting'));
  client.on('offline', () => onStatus?.('offline'));
  client.on('error', () => onStatus?.('error'));

  client.on('message', (topic, payload) => {
    if (topic === t.hostStatus) {
      const online = new TextDecoder().decode(payload) === 'online';
      onHost(online);
      if (online) hello();
      return;
    }
    const msg = parse(payload);
    if (msg) onMessage(msg);
  });

  return {
    act(action) {
      client.publish(t.toHost, JSON.stringify({ t: 'act', secret, action }), { qos: 1 });
    },
    close() {
      client.publish(t.presence(secret), 'offline', { retain: true, qos: 1 }, () => client.end());
    },
  };
}
