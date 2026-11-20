import type { Role } from '@prisma/client';

/**
 * Tells the service worker (public/sw.js) whether a role-filtered read may be
 * stored in its shared, on-disk API cache. Only the least-privileged view — what
 * a member sees — is marked `shared`: it's safe for every viewer, so a cached
 * copy can never show someone events they've lost access to (e.g. a leader who
 * was demoted while the browser kept a leader-only copy). Leader responses are
 * `private` and always come from the network.
 *
 * Keep the header name in sync with SW_SCOPE_HEADER in public/sw.js.
 */
export const SW_CACHE_SCOPE_HEADER = 'X-GNW-Cache-Scope';

export function swCacheScope(role: Role): 'shared' | 'private' {
  return role === 'leader' ? 'private' : 'shared';
}
