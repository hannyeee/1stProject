import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { middlewareMode: true },
  appType: 'custom',
});
after(() => server.close());
const { createTracker, MAX_QUEUE, FLUSH_INTERVAL_MS } = await server.ssrLoadModule('/src/utils/tracker.js');

const memoryStorage = () => {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
    values: () => [...data.values()].join('\n'),
  };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const accountToken = (sub, signature = 'signature', exp = Date.parse('2026-11-05T00:00:00Z') / 1000) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub, exp })).toString('base64url')}.${signature}`;

let n = 0;
function setup({ send, token = null, getToken = () => token, storage = memoryStorage(), ...options } = {}) {
  const sent = [];
  const tracker = createTracker({
    send: send || ((events, opts) => { sent.push({ events, ...opts }); return Promise.resolve(); }),
    getToken,
    now: () => new Date('2026-11-04T05:29:44.172Z'),
    makeId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    sessionStorage: memoryStorage(),
    localStorage: storage,
    onIssue: () => {},
    initialPage: () => ({ path: '/', referrer: '' }),
    ...options,
  });
  return { tracker, sent };
}

test('events have the collection schema and reuse session/anonymous ids', () => {
  const { tracker } = setup();
  const a = tracker.track('performance_view', { performance_id: 'opera', price_krw: 80000, skip: undefined, obj: { x: 1 } });
  const b = tracker.track('search', { query: '재즈' });
  assert.deepEqual(Object.keys(a).sort(), ['anonymous_id', 'event_id', 'occurred_at', 'page', 'props', 'schema_version', 'session_id', 'type']);
  assert.equal(a.occurred_at, '2026-11-04T05:29:44.172Z');
  assert.deepEqual(a.page, { path: '/', referrer: '' });
  assert.deepEqual(a.props, { performance_id: 'opera', price_krw: 80000, obj: '[object Object]' });
  assert.equal(a.schema_version, 1);
  assert.notEqual(a.event_id, b.event_id);
  assert.equal(a.session_id, b.session_id);
  assert.equal(a.anonymous_id, b.anonymous_id);
  assert.equal(tracker.track('not_a_real_type'), null);
  assert.equal(tracker.size, 2);
});

test('the queue is sent as soon as it reaches 10 events', async () => {
  const token = accountToken('account-a');
  const { tracker, sent } = setup({ token });
  for (let i = 0; i < MAX_QUEUE - 1; i++) tracker.track('page_view');
  await tick();
  assert.equal(sent.length, 0);
  tracker.track('page_view');
  await tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].events.length, MAX_QUEUE);
  assert.equal(sent[0].token, token);
  assert.equal(tracker.size, 0);
});

test('every 3 seconds pending events are sent, and nothing is sent when the queue is empty', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const { tracker, sent } = setup();
    tracker.start();
    mock.timers.tick(FLUSH_INTERVAL_MS);
    await tick();
    assert.equal(sent.length, 0);

    tracker.track('login');
    tracker.track('page_view');
    mock.timers.tick(FLUSH_INTERVAL_MS - 1);
    await tick();
    assert.equal(sent.length, 0);
    mock.timers.tick(1);
    await tick();
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].events.map(e => e.type), ['login', 'page_view']);
    tracker.stop();
  } finally {
    mock.timers.reset();
  }
});

test('network/server failures survive refresh and 4xx records a terminal rejection', async () => {
  let fail = { status: 0 };
  const calls = [];
  const storage = memoryStorage();
  let time = Date.parse('2026-11-04T05:29:44Z');
  const options = {
    storage,
    now: () => new Date(time),
    send: events => { calls.push(events[0].event_id); return fail ? Promise.reject(fail) : Promise.resolve(); },
  };
  const { tracker } = setup(options);
  const event = tracker.track('page_view');
  await tracker.flush();
  assert.equal(tracker.size, 1);

  const { tracker: reloaded } = setup(options);
  fail = { status: 503 };
  time += 3000;
  await reloaded.flush();
  assert.equal(reloaded.size, 1);

  fail = { status: 422 };
  time += 6000;
  await reloaded.flush();
  await reloaded.flush();
  assert.equal(reloaded.size, 0);
  assert.deepEqual(calls, Array(3).fill(event.event_id));
  assert.match(storage.values(), /http_rejected/);
  assert.match(storage.values(), /"status":422/);
  assert.match(storage.values(), /validation_failed/);
});

test('recovers every event across multiple batches after a server outage', async () => {
  const storage = memoryStorage();
  const { tracker } = setup({ storage, send: () => Promise.reject({ status: 503 }) });
  const ids = Array.from({ length: 25 }, () => tracker.track('page_view').event_id);
  await tick();
  assert.equal(tracker.size, 25);
  const { tracker: reloaded, sent } = setup({ storage, now: () => new Date('2026-11-04T05:30:00Z') });
  for (let i = 0; i < 3; i++) await reloaded.flush();
  assert.deepEqual(sent.map(batch => batch.events.length), [10, 10, 5]);
  assert.deepEqual(sent.flatMap(batch => batch.events.map(event => event.event_id)), ids);
  assert.equal(setup({ storage }).tracker.size, 0);
});

test('keeps an in-flight event until acknowledged and coalesces concurrent flushes', async () => {
  const storage = memoryStorage();
  let acknowledge;
  const sent = [];
  const { tracker } = setup({ storage, send: events => {
    sent.push(events[0].event_id);
    return new Promise(resolve => { acknowledge = resolve; });
  } });
  const event = tracker.track('page_view');
  const first = tracker.flush();
  const second = tracker.flush();
  await tick();
  assert.equal(setup({ storage }).tracker.size, 1);
  assert.deepEqual(sent, [event.event_id]);
  acknowledge();
  await Promise.all([first, second]);
  assert.equal(setup({ storage }).tracker.size, 0);
});

test('a stale retry from another tab cannot recreate an acknowledged event', async () => {
  const storage = memoryStorage();
  let fail;
  const { tracker: first } = setup({ storage, locks: null });
  const { tracker: second } = setup({ storage, locks: null, send: () =>
    new Promise((resolve, reject) => { fail = reject; }),
  });
  first.track('page_view');
  const pending = second.flush();
  await tick();
  await first.flush();
  fail({ status: 503 });
  await pending;
  assert.equal(setup({ storage }).tracker.size, 0);
});

test('isolates anonymous and member events across login, logout, and account changes', async () => {
  const storage = memoryStorage();
  const a = accountToken('account-a');
  const b = accountToken('account-b');
  let token = null;
  const { tracker } = setup({ storage, getToken: () => token });
  const guest = tracker.track('page_view');
  token = a;
  const first = tracker.track('login', { password: 'private', access_token: a, query: a });
  token = null;
  tracker.setPage('/login?password=other-private');
  const loggedOut = tracker.track('page_view');
  token = b;
  const second = tracker.track('login');
  assert.doesNotMatch(storage.values(), /private|signature|access_token/);

  const { tracker: reloaded, sent } = setup({ storage, getToken: () => token });
  await reloaded.flush();
  const byId = new Map(sent.flatMap(batch => batch.events.map(event => [event.event_id, batch.token])));
  assert.deepEqual(byId, new Map([[guest.event_id, null], [loggedOut.event_id, null], [second.event_id, b]]));
  assert.equal(reloaded.size, 1);
  token = null;
  await reloaded.flush();
  assert.equal(sent.length, 2);

  token = accountToken('account-a', 'replacement');
  await reloaded.flush();
  assert.equal(sent.at(-1).events[0].event_id, first.event_id);
  assert.equal(sent.at(-1).token, token);
  assert.equal(reloaded.size, 0);
});

test('records queue overflow and exhausted retries without evicting pending events', async () => {
  const storage = memoryStorage();
  const issues = [];
  let time = Date.parse('2026-11-04T05:29:44Z');
  const { tracker } = setup({
    storage, maxPending: 2, maxAttempts: 2,
    now: () => new Date(time), onIssue: issue => issues.push(issue),
    send: () => Promise.reject({ status: 503 }),
  });
  tracker.track('page_view');
  tracker.track('page_view');
  assert.equal(tracker.track('page_view'), null);
  await tracker.flush();
  assert.equal(tracker.size, 2);
  time += 3000;
  await tracker.flush();
  assert.equal(tracker.size, 0);
  assert.equal(issues[0].reason, 'queue_full');
  assert.match(storage.values(), /retries_exhausted/);
});

test('keeps member events pending when the same account token has expired', async () => {
  let token = accountToken('account-a', 'expired', 1);
  const { tracker, sent } = setup({ getToken: () => token });
  const event = tracker.track('page_view');
  await tracker.flush();
  assert.equal(sent.length, 0);
  assert.equal(tracker.size, 1);
  token = accountToken('account-a');
  await tracker.flush();
  assert.equal(sent[0].events[0].event_id, event.event_id);
  assert.equal(sent[0].token, token);
});

test('a corrupt storage record does not block later valid events', async () => {
  const storage = memoryStorage();
  const corruptKey = 'tikit.tracking.pending.corrupt';
  storage.setItem(corruptKey, '{invalid');
  storage.setItem('tikit.tracking.pending.invalid-shape', '{}');
  const issues = [];
  const { tracker, sent } = setup({ storage, onIssue: issue => issues.push(issue) });
  const event = tracker.track('page_view');
  await tracker.flush();
  assert.equal(sent[0].events[0].event_id, event.event_id);
  assert.ok(issues.some(issue => issue.reason === 'storage_record_corrupt'));
});

test('warns on a storage write failure and still sends from memory', async () => {
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error('storage full'); };
  const issues = [];
  const { tracker, sent } = setup({ storage, onIssue: issue => issues.push(issue) });
  const event = tracker.track('page_view');
  await tracker.flush();
  assert.equal(sent[0].events[0].event_id, event.event_id);
  assert.ok(issues.some(issue => issue.reason === 'storage_write_failed'));
});

test('setPage updates path and referrer of later events', () => {
  const { tracker } = setup();
  tracker.setPage('/mypage/orders');
  const e = tracker.track('page_view');
  assert.deepEqual(e.page, { path: '/mypage/orders', referrer: '/' });
});

test('flush passes keepalive for page-leave sends', async () => {
  const { tracker, sent } = setup();
  tracker.track('logout');
  await tracker.flush({ keepalive: true });
  assert.equal(sent[0].keepalive, true);
});
