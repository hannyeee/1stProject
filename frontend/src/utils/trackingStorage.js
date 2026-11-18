const PENDING = 'tikit.tracking.pending.';
const RETRY = 'tikit.tracking.retry.';
const FAILURE = 'tikit.tracking.failure.';
const MAX_FAILURES = 100;

export function browserStorage(name) {
  try { return globalThis[name]; } catch { return null; }
}

export function trackingStorage(storage, onIssue) {
  const memory = new Map();
  let readFailed = false;

  function readStorage(read, fallback) {
    try {
      return read();
    } catch {
      if (!readFailed) onIssue({ reason: 'storage_read_failed' });
      readFailed = true;
      return fallback;
    }
  }

  function read(key, valid) {
    if (memory.has(key)) return memory.get(key);
    const raw = readStorage(() => storage?.getItem(key), null);
    if (raw == null) return null;
    try {
      const record = JSON.parse(raw);
      if (valid(record)) return record;
    } catch { /* Continue reading the other records. */ }
    onIssue({ reason: 'storage_record_corrupt' });
    remove(key);
    return null;
  }

  function records(prefix, valid) {
    const keys = new Set(memory.keys());
    readStorage(() => {
      for (let i = 0; i < (storage?.length ?? 0); i++) keys.add(storage.key(i));
    });
    const result = [];
    for (const key of keys) {
      if (!key?.startsWith(prefix)) continue;
      const record = read(key, item => valid(item, key.slice(prefix.length)));
      if (record) result.push(record);
    }
    return result;
  }

  function write(key, value) {
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(key, JSON.stringify(value));
      memory.delete(key);
    } catch {
      memory.set(key, value);
      onIssue({ reason: 'storage_write_failed', event_id: value.event_id ?? value.event.event_id });
    }
  }

  function remove(key) {
    try {
      storage?.removeItem(key);
      memory.delete(key);
    } catch {
      memory.set(key, null);
      onIssue({ reason: 'storage_remove_failed' });
    }
  }

  const validPending = (record, id) => record?.event?.event_id === id
    && typeof record.event.occurred_at === 'string'
    && (record.owner === null || typeof record.owner === 'string');
  const validRetry = record => Number.isInteger(record?.attempts) && Number.isFinite(record.retryAt);

  function isPending(id) {
    return Boolean(read(PENDING + id, record => validPending(record, id)));
  }

  return {
    pending() {
      return records(PENDING, validPending).map(record => {
        const { attempts = 0, retryAt = 0 } = read(RETRY + record.event.event_id, validRetry) ?? {};
        return { ...record, attempts, retryAt };
      });
    },
    save: record => write(PENDING + record.event.event_id, record),
    isPending,
    retry(id, attempts, retryAt) {
      // A late response from another tab can update retry state but cannot recreate a pending event.
      if (!isPending(id)) return;
      write(RETRY + id, { event_id: id, attempts, retryAt });
      if (!isPending(id)) remove(RETRY + id);
    },
    acknowledge(id) {
      remove(PENDING + id);
      remove(RETRY + id);
    },
    failure(issue) {
      const history = records(FAILURE, (record, id) => record?.event_id === id && Number.isFinite(record.at))
        .sort((a, b) => a.at - b.at);
      for (const old of history.slice(0, Math.max(0, history.length - MAX_FAILURES + 1))) {
        remove(FAILURE + old.event_id);
      }
      write(FAILURE + issue.event_id, issue);
      onIssue(issue);
    },
  };
}
