// Small client-side fetch helper that throws on non-2xx with the server message.
export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    // Auth-gated, always-changing data (poll tallies, etc.): never let the
    // browser/PWA HTTP cache serve a stale response, or polled views freeze
    // until the app is force-quit. Callers can override via options.cache.
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options?.headers,
    },
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (data && typeof data === 'object' && 'error' in data) {
      message = String((data as { error: unknown }).error);
    }
    throw new Error(message);
  }
  return data as T;
}
