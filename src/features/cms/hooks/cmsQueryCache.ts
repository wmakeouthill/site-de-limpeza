const store = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

export function peekCmsQuery<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeCmsQuery<T>(key: string, value: T): void {
  store.set(key, value);
}

export function readCmsQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  force = false,
): Promise<T> {
  if (!force) {
    const cached = peekCmsQuery<T>(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
  }

  const inFlight = pending.get(key);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const request = fetcher()
    .then((value) => {
      writeCmsQuery(key, value);
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, request);
  return request;
}

export function invalidateCmsQueries(prefix: string, except?: string): void {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix) && key !== except) {
      store.delete(key);
    }
  }
}

export function clearCmsQueryCache(): void {
  store.clear();
  pending.clear();
}
