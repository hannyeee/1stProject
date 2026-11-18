import { request } from '@/api/client';
import { newRequestKey } from '@/utils';
import { browserStorage, trackingStorage } from './trackingStorage';

// 사용자 행동 이벤트 수집기
// - track() 으로 쌓은 이벤트를 큐에 모았다가 백엔드(POST /tracking/events → MongoDB)로 보냅니다.
// - 대기 이벤트는 브라우저에 보관하고 요청당 최대 10개씩 보냅니다.
// - 10개가 안 돼도 3초마다 쌓인 이벤트가 있으면 보냅니다.
// - 화면을 떠날 때(탭 숨김·페이지 이동)는 남은 이벤트를 keepalive 요청으로 보냅니다.
// 이벤트 수집이 실패해도 서비스 이용에는 영향을 주지 않습니다.

// backend/app/core/config.py 의 TRACKING_EVENT_TYPES 와 같게 유지합니다.
export const EVENT_TYPES = [
  // 탐색
  'page_view', 'search', 'category_select', 'sort_change', 'list_expand', 'performance_view', 'taste_view',
  // 찜
  'favorite_add', 'favorite_remove',
  // 예매·결제
  'booking_start', 'reservation_request', 'payment_complete', 'reservation_cancel',
  // 계정
  'sign_up', 'login', 'logout', 'profile_update', 'password_change', 'notification_settings_update', 'account_withdraw',
];
export const MAX_QUEUE = 10;
export const FLUSH_INTERVAL_MS = 3000;
export const SCHEMA_VERSION = 1;

const SESSION_KEY = 'tikit.sessionId';
const ANONYMOUS_KEY = 'tikit.anonymousId';
const MAX_TEXT = 500;
const MAX_PENDING = 250;
const MAX_ATTEMPTS = 12;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;
const SECRET_KEY = /password|passwd|token|authorization|secret|credential/i;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const PAGE_QUERY_KEYS = ['q', 'category', 'sort', 'open', 'resume', 'show'];
const cleanText = value => String(value).replace(JWT, '[redacted]').slice(0, MAX_TEXT);

function cleanPageUrl(value) {
  if (!value) return '';
  try {
    const base = 'https://tracking.invalid';
    const url = new URL(value, base);
    const query = new URLSearchParams();
    if (url.origin === base || url.origin === globalThis.location?.origin) {
      for (const [key, text] of url.searchParams) {
        if (PAGE_QUERY_KEYS.includes(key)) query.append(key, cleanText(text));
      }
    }
    const origin = url.origin === base ? '' : url.origin;
    const search = query.toString();
    return cleanText(origin + url.pathname + (search ? `?${search}` : ''));
  } catch {
    return '';
  }
}

// 저장소가 막힌 환경(사생활 보호 모드 등)에서는 이번 실행 동안만 쓰는 id 를 만듭니다.
function storedId(storage, key, makeId) {
  try {
    let id = storage?.getItem(key);
    if (!id) { id = makeId(); storage?.setItem(key, id); }
    return id;
  } catch {
    return makeId();
  }
}

// 서버가 받는 형태(한 단계, 짧은 값)로 props 를 정리합니다. undefined 는 뺍니다.
function cleanProps(props) {
  return Object.fromEntries(Object.entries(props || {})
    .filter(([key, value]) => value !== undefined && !SECRET_KEY.test(key))
    .map(([key, value]) => [
      cleanText(key),
      value === null || typeof value === 'boolean' || Number.isFinite(value) ? value : cleanText(value),
    ]));
}

// sub는 로컬 큐 선택에만 사용합니다. 수집 서버는 토큰 서명을 검증합니다.
function tokenClaims(token) {
  if (!token) return { owner: null };
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { sub, exp } = JSON.parse(atob(payload));
    if (typeof sub === 'string' && sub) return { owner: sub, expiresAt: exp * 1000 };
  } catch { /* 계정을 확인할 수 없으면 비회원으로 처리하지 않습니다. */ }
  return { owner: undefined };
}

const httpReason = status => ({
  400: 'invalid_request',
  401: 'authentication_required',
  403: 'forbidden',
  413: 'payload_too_large',
  422: 'validation_failed',
  429: 'rate_limited',
}[status] ?? 'client_error');

/**
 * 테스트에서 시간·전송·저장소를 바꿔 끼울 수 있도록 만든 수집기 생성 함수.
 * send(events, { token, keepalive }) 는 Promise 를 돌려줘야 합니다.
 */
export function createTracker({
  send,
  getToken = () => null,
  now = () => new Date(),
  makeId = newRequestKey,
  sessionStorage: sStore = browserStorage('sessionStorage'),
  localStorage: lStore = browserStorage('localStorage'),
  initialPage = () => ({ path: globalThis.location ? location.pathname + location.search : '/', referrer: globalThis.document?.referrer || '' }),
  maxQueue = MAX_QUEUE,
  intervalMs = FLUSH_INTERVAL_MS,
  maxPending = MAX_PENDING,
  maxAttempts = MAX_ATTEMPTS,
  locks = globalThis.navigator?.locks,
  onIssue = issue => console.warn('[tracking]', issue),
} = {}) {
  const storage = trackingStorage(lStore, onIssue);
  const inFlight = new Map();
  const batchSize = Math.min(maxQueue, MAX_QUEUE);
  let timer = null;
  let page = null;
  let sessionId = null;
  let anonymousId = null;

  const currentPage = () => (page ??= initialPage());

  function reject(event, reason, status, detail) {
    storage.failure({ event_id: event.event_id, type: event.type, reason, status, detail, at: now().getTime() });
  }

  function pending() {
    const cutoff = now().getTime() - MAX_AGE_MS;
    return storage.pending().filter(({ event }) => {
      if (Date.parse(event.occurred_at) >= cutoff) return true;
      reject(event, 'retention_expired');
      storage.acknowledge(event.event_id);
      return false;
    });
  }

  // 화면 주소가 바뀌면 이후 이벤트의 page 를 바꿉니다. 직전 화면이 referrer 가 됩니다.
  function setPage(path) {
    const previous = currentPage();
    if (previous.path === path) return;
    page = { path, referrer: previous.path };
  }

  function track(type, props = {}) {
    if (!EVENT_TYPES.includes(type)) return null;
    sessionId ??= storedId(sStore, SESSION_KEY, makeId);
    anonymousId ??= storedId(lStore, ANONYMOUS_KEY, makeId);
    const { path, referrer } = currentPage();
    const event = {
      event_id: makeId(),
      type,
      occurred_at: now().toISOString(),
      session_id: sessionId,
      anonymous_id: anonymousId,
      page: { path: cleanPageUrl(path), referrer: cleanPageUrl(referrer) },
      props: cleanProps(props),
      schema_version: SCHEMA_VERSION,
    };
    const { owner } = tokenClaims(getToken());
    if (owner === undefined) {
      reject(event, 'unrecognized_account');
      return null;
    }
    const queued = pending();
    if (queued.length >= maxPending) {
      reject(event, 'queue_full');
      return null;
    }
    storage.save({ event, owner });
    if (queued.filter(record => record.owner === owner).length + 1 >= batchSize) flush();
    return event;
  }

  async function sendBatch(owner, token, keepalive) {
    const time = now().getTime();
    const queue = pending().filter(record => record.owner === owner)
      .sort((a, b) => a.event.occurred_at.localeCompare(b.event.occurred_at));
    const batch = [];
    for (const record of queue.slice(0, batchSize)) {
      if (record.retryAt > time) break;
      batch.push(record);
    }
    if (!batch.length) return;

    try {
      await send(batch.map(({ event }) => event), { token, keepalive });
    } catch (error) {
      const status = error?.status;
      for (const record of batch) {
        const { event, attempts } = record;
        if (!storage.isPending(event.event_id)) continue;
        if (status >= 400 && status < 500) {
          reject(event, 'http_rejected', status, httpReason(status));
          storage.acknowledge(event.event_id);
        } else if (attempts + 1 >= maxAttempts) {
          reject(event, 'retries_exhausted', status);
          storage.acknowledge(event.event_id);
        } else {
          const delay = Math.min(intervalMs * 2 ** attempts, MAX_RETRY_DELAY_MS);
          storage.retry(event.event_id, attempts + 1, now().getTime() + delay);
        }
      }
      return;
    }
    for (const { event } of batch) storage.acknowledge(event.event_id);
  }

  function flushOwner(owner, token, keepalive) {
    if (inFlight.has(owner)) return inFlight.get(owner);
    const sendPending = () => sendBatch(owner, token, keepalive);
    const sending = locks
      ? locks.request(`tikit.tracking:${JSON.stringify(owner)}`, { ifAvailable: true }, lock => {
        if (lock) return sendPending();
      })
      : Promise.resolve().then(sendPending);
    const flushing = sending
      .catch(() => onIssue({ reason: 'flush_failed' }))
      .finally(() => inFlight.delete(owner));
    inFlight.set(owner, flushing);
    return flushing;
  }

  function flush({ keepalive = false } = {}) {
    if (globalThis.navigator?.onLine === false) return Promise.resolve();
    const token = getToken();
    const { owner, expiresAt } = tokenClaims(token);
    const anonymous = flushOwner(null, null, keepalive);
    if (!owner || expiresAt <= now().getTime()) return anonymous;
    return Promise.all([anonymous, flushOwner(owner, token, keepalive)]);
  }

  function start() {
    if (timer === null) timer = setInterval(() => { flush(); }, intervalMs);
  }
  function stop() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  return { track, flush, start, stop, setPage, get size() { return storage.pending().length; } };
}

/* ---------- 앱에서 쓰는 기본 수집기 ---------- */
let tokenGetter = () => null;

export const tracker = createTracker({
  getToken: () => tokenGetter(),
  async send(events, { token, keepalive }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let result;
    try {
      result = await request('/tracking/events', {
        method: 'POST', body: { events, require_authentication: Boolean(token) }, token, keepalive,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!Number.isInteger(result?.accepted) || !Number.isInteger(result.duplicates)
        || result.accepted < 0 || result.duplicates < 0 || result.accepted + result.duplicates !== events.length) {
      throw new Error('Tracking batch was not acknowledged');
    }
  },
});

export const track = (type, props) => tracker.track(type, props);

// main.js 에서 한 번 호출합니다: 토큰 연결, 화면 이동 기록, 3초 주기 전송, 화면을 떠날 때 전송.
export function installTracking({ router, getToken }) {
  tokenGetter = getToken;
  router.afterEach((to, from, failure) => {
    if (failure) return;
    tracker.setPage(to.fullPath);
    // 같은 화면에서 쿼리(검색어·카테고리·정렬)만 바뀌면 각 행동 이벤트로 남기고 page_view 는 남기지 않습니다.
    if (to.path !== from.path || from.matched.length === 0) track('page_view', { route: to.name ? String(to.name) : undefined });
  });
  tracker.start();
  window.addEventListener('online', () => { tracker.flush(); });
  const flushOnLeave = () => { tracker.flush({ keepalive: true }); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushOnLeave(); });
  window.addEventListener('pagehide', flushOnLeave);
}
