/**
 * Navigation service for Alt+A bidirectional admin/public page switching.
 *
 * Given a pathname, returns the corresponding counterpart route — public ↔ admin.
 * Falls back to /admin (from public-without-counterpart) or / (from admin-without-counterpart)
 * when no specific mapping exists.
 *
 * Pure string-based lookup — no framework dependencies, no Holochain, no state.
 * The actual goto() side effect lives at the call site in +layout.svelte.
 *
 * See issue #67 for the full route correspondence map and acceptance criteria.
 */

// ─── Exact pairs (no dynamic segments) ──────────────────────────────────────

const EXACT_PAIRS: Record<string, string> = {
  // Direct entity list pairs
  '/users':                            '/admin/users',
  '/admin/users':                      '/users',
  '/organizations':                    '/admin/organizations',
  '/admin/organizations':              '/organizations',
  '/requests':                         '/admin/requests',
  '/admin/requests':                   '/requests',
  '/offers':                           '/admin/offers',
  '/admin/offers':                     '/offers',
  '/service-types':                    '/admin/service-types',
  '/admin/service-types':              '/service-types',

  // Semantic pair: both deal with proposed service types
  '/service-types/suggest':            '/admin/service-types/moderate',
  '/admin/service-types/moderate':     '/service-types/suggest',

  // Public create/edit pages → admin list (no admin counterpart exists)
  '/organizations/create':             '/admin/organizations',
  '/requests/create':                  '/admin/requests',
  '/offers/create':                    '/admin/offers',

  // Personal/no-counterpart public → /admin dashboard
  '/user':                             '/admin',
  '/user/create':                      '/admin',
  '/user/edit':                        '/admin',
  '/my-listings':                      '/admin',
  '/test-status-history':              '/admin',

  // Admin dashboard → /
  '/admin':                            '/',

  // Admin-only pages → /
  '/admin/administrators':             '/',
  '/admin/mediums-of-exchange':        '/',
  '/admin/mediums-of-exchange/create': '/',
  '/admin/users/status-history':       '/',
  '/admin/organizations/status-history': '/',
  '/admin/service-types/create':       '/',
  '/admin/hrea-test':                  '/',
};

// ─── Dynamic patterns (with [id]/[tag] segments) ────────────────────────────

type DynamicRule = { pattern: RegExp; counterpart: (m: RegExpMatchArray) => string };

const DYNAMIC_RULES: DynamicRule[] = [
  // Direct dynamic pair — service type detail (params carry over)
  { pattern: /^\/service-types\/([^/]+)$/,
    counterpart: (m) => `/admin/service-types/${m[1]}` },
  { pattern: /^\/admin\/service-types\/([^/]+)$/,
    counterpart: (m) => `/service-types/${m[1]}` },

  // Public detail/edit pages → admin list (no admin counterpart)
  { pattern: /^\/users\/[^/]+$/,                            counterpart: () => '/admin/users' },
  { pattern: /^\/organizations\/[^/]+$/,                    counterpart: () => '/admin/organizations' },
  { pattern: /^\/organizations\/[^/]+\/edit$/,              counterpart: () => '/admin/organizations' },
  { pattern: /^\/requests\/[^/]+$/,                         counterpart: () => '/admin/requests' },
  { pattern: /^\/requests\/[^/]+\/edit$/,                   counterpart: () => '/admin/requests' },
  { pattern: /^\/offers\/[^/]+$/,                           counterpart: () => '/admin/offers' },
  { pattern: /^\/offers\/[^/]+\/edit$/,                     counterpart: () => '/admin/offers' },

  // Tag pages → /admin (no counterpart)
  { pattern: /^\/tags\/[^/]+$/,                             counterpart: () => '/admin' },

  // Admin dynamic pages with no public counterpart → /
  { pattern: /^\/admin\/service-types\/[^/]+\/edit$/,       counterpart: () => '/' },
  { pattern: /^\/admin\/mediums-of-exchange\/[^/]+\/edit$/, counterpart: () => '/' },
];

// ─── Pure lookup function ───────────────────────────────────────────────────

/**
 * Returns the counterpart route for a given pathname, with optional search
 * string (e.g. "?organization=foo") preserved on the result.
 *
 * Resolution order:
 *   1. Exact match in EXACT_PAIRS
 *   2. First matching pattern in DYNAMIC_RULES
 *   3. Default fallback: /admin (if pathname is public) or / (if pathname is admin)
 */
export function getCounterpartRoute(pathname: string, search: string = ''): string {
  // Strip trailing slash for consistent matching, except for root "/"
  const normalised = pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;

  // 1. Exact match
  const exact = EXACT_PAIRS[normalised];
  if (exact !== undefined) return exact + search;

  // 2. Dynamic pattern match
  for (const { pattern, counterpart } of DYNAMIC_RULES) {
    const match = normalised.match(pattern);
    if (match) return counterpart(match) + search;
  }

  // 3. Default fallback
  const fallback = normalised.startsWith('/admin') ? '/' : '/admin';
  return fallback + search;
}
