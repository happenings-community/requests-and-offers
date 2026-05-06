/**
 * Unit tests for getCounterpartRoute — the pure lookup function backing
 * the contextual Alt+A navigation feature (issue #67).
 *
 * Covers all acceptance criteria from the issue plus edge cases:
 * trailing-slash normalisation, search-param preservation, and fallback
 * behaviour for unmapped routes.
 */

import { describe, it, expect } from 'vitest';
import { getCounterpartRoute } from '$lib/services/navigation.service';

describe('getCounterpartRoute', () => {
  // ─── Direct bidirectional pairs ────────────────────────────────────────

  describe('direct bidirectional pairs', () => {
    it('navigates from /users to /admin/users', () => {
      expect(getCounterpartRoute('/users')).toBe('/admin/users');
    });

    it('navigates from /admin/users to /users', () => {
      expect(getCounterpartRoute('/admin/users')).toBe('/users');
    });

    it('navigates from /organizations to /admin/organizations', () => {
      expect(getCounterpartRoute('/organizations')).toBe('/admin/organizations');
    });

    it('navigates from /admin/organizations to /organizations', () => {
      expect(getCounterpartRoute('/admin/organizations')).toBe('/organizations');
    });

    it('navigates from /requests to /admin/requests', () => {
      expect(getCounterpartRoute('/requests')).toBe('/admin/requests');
    });

    it('navigates from /admin/requests to /requests', () => {
      expect(getCounterpartRoute('/admin/requests')).toBe('/requests');
    });

    it('navigates from /offers to /admin/offers', () => {
      expect(getCounterpartRoute('/offers')).toBe('/admin/offers');
    });

    it('navigates from /admin/offers to /offers', () => {
      expect(getCounterpartRoute('/admin/offers')).toBe('/offers');
    });

    it('navigates from /service-types to /admin/service-types', () => {
      expect(getCounterpartRoute('/service-types')).toBe('/admin/service-types');
    });

    it('navigates from /admin/service-types to /service-types', () => {
      expect(getCounterpartRoute('/admin/service-types')).toBe('/service-types');
    });
  });

  // ─── Dynamic pair: service-types/[id] ──────────────────────────────────

  describe('service-types detail (dynamic pair, params carry over)', () => {
    it('navigates from /service-types/abc-123 to /admin/service-types/abc-123', () => {
      expect(getCounterpartRoute('/service-types/abc-123')).toBe('/admin/service-types/abc-123');
    });

    it('navigates from /admin/service-types/abc-123 to /service-types/abc-123', () => {
      expect(getCounterpartRoute('/admin/service-types/abc-123')).toBe('/service-types/abc-123');
    });

    it('handles complex hash-style IDs', () => {
      const id = 'uhCEkXXX-some-hash-with-dashes_and_underscores';
      expect(getCounterpartRoute(`/service-types/${id}`)).toBe(`/admin/service-types/${id}`);
    });
  });

  // ─── Semantic pair: suggest ↔ moderate ─────────────────────────────────

  describe('semantic pair: suggest ↔ moderate', () => {
    it('navigates from /service-types/suggest to /admin/service-types/moderate', () => {
      expect(getCounterpartRoute('/service-types/suggest')).toBe('/admin/service-types/moderate');
    });

    it('navigates from /admin/service-types/moderate to /service-types/suggest', () => {
      expect(getCounterpartRoute('/admin/service-types/moderate')).toBe('/service-types/suggest');
    });

    it('does not treat /service-types/suggest as a dynamic [id] match', () => {
      // Regression guard: exact match must take precedence over the
      // /service-types/[id] regex pattern.
      const result = getCounterpartRoute('/service-types/suggest');
      expect(result).toBe('/admin/service-types/moderate');
      expect(result).not.toBe('/admin/service-types/suggest');
    });
  });

  // ─── Detail pages with no admin counterpart fall back to list ──────────

  describe('detail pages without admin counterpart fall back to admin list', () => {
    it('falls back from /users/[id] to /admin/users', () => {
      expect(getCounterpartRoute('/users/some-id')).toBe('/admin/users');
    });

    it('falls back from /organizations/[id] to /admin/organizations', () => {
      expect(getCounterpartRoute('/organizations/some-id')).toBe('/admin/organizations');
    });

    it('falls back from /organizations/[id]/edit to /admin/organizations', () => {
      expect(getCounterpartRoute('/organizations/some-id/edit')).toBe('/admin/organizations');
    });

    it('falls back from /requests/[id] to /admin/requests', () => {
      expect(getCounterpartRoute('/requests/some-id')).toBe('/admin/requests');
    });

    it('falls back from /requests/[id]/edit to /admin/requests', () => {
      expect(getCounterpartRoute('/requests/some-id/edit')).toBe('/admin/requests');
    });

    it('falls back from /offers/[id] to /admin/offers', () => {
      expect(getCounterpartRoute('/offers/some-id')).toBe('/admin/offers');
    });

    it('falls back from /offers/[id]/edit to /admin/offers', () => {
      expect(getCounterpartRoute('/offers/some-id/edit')).toBe('/admin/offers');
    });
  });

  // ─── Public create pages → admin list ──────────────────────────────────

  describe('public create pages fall back to admin list', () => {
    it('falls back from /organizations/create to /admin/organizations', () => {
      expect(getCounterpartRoute('/organizations/create')).toBe('/admin/organizations');
    });

    it('falls back from /requests/create to /admin/requests', () => {
      expect(getCounterpartRoute('/requests/create')).toBe('/admin/requests');
    });

    it('falls back from /offers/create to /admin/offers', () => {
      expect(getCounterpartRoute('/offers/create')).toBe('/admin/offers');
    });
  });

  // ─── Personal/no-counterpart pages → /admin ────────────────────────────

  describe('personal pages fall back to /admin', () => {
    it('falls back from /user to /admin', () => {
      expect(getCounterpartRoute('/user')).toBe('/admin');
    });

    it('falls back from /user/create to /admin', () => {
      expect(getCounterpartRoute('/user/create')).toBe('/admin');
    });

    it('falls back from /user/edit to /admin', () => {
      expect(getCounterpartRoute('/user/edit')).toBe('/admin');
    });

    it('falls back from /my-listings to /admin', () => {
      expect(getCounterpartRoute('/my-listings')).toBe('/admin');
    });

    it('falls back from /tags/[tag] to /admin', () => {
      expect(getCounterpartRoute('/tags/holochain')).toBe('/admin');
    });
  });

  // ─── Admin-only pages → / ──────────────────────────────────────────────

  describe('admin-only pages fall back to /', () => {
    it('falls back from /admin to /', () => {
      expect(getCounterpartRoute('/admin')).toBe('/');
    });

    it('falls back from /admin/administrators to /', () => {
      expect(getCounterpartRoute('/admin/administrators')).toBe('/');
    });

    it('falls back from /admin/mediums-of-exchange to /', () => {
      expect(getCounterpartRoute('/admin/mediums-of-exchange')).toBe('/');
    });

    it('falls back from /admin/users/status-history to /', () => {
      expect(getCounterpartRoute('/admin/users/status-history')).toBe('/');
    });

    it('falls back from /admin/organizations/status-history to /', () => {
      expect(getCounterpartRoute('/admin/organizations/status-history')).toBe('/');
    });

    it('falls back from /admin/service-types/create to /', () => {
      expect(getCounterpartRoute('/admin/service-types/create')).toBe('/');
    });

    it('falls back from /admin/service-types/[id]/edit to /', () => {
      expect(getCounterpartRoute('/admin/service-types/some-id/edit')).toBe('/');
    });

    it('falls back from /admin/mediums-of-exchange/[id]/edit to /', () => {
      expect(getCounterpartRoute('/admin/mediums-of-exchange/some-id/edit')).toBe('/');
    });
  });

  // ─── Search-param preservation ─────────────────────────────────────────

  describe('search params are preserved across the switch', () => {
    it('preserves ?organization=foo on a public create page', () => {
      expect(getCounterpartRoute('/offers/create', '?organization=foo')).toBe(
        '/admin/offers?organization=foo',
      );
    });

    it('preserves multiple params', () => {
      expect(getCounterpartRoute('/users', '?sort=name&filter=active')).toBe(
        '/admin/users?sort=name&filter=active',
      );
    });

    it('preserves params on dynamic pair routes', () => {
      expect(getCounterpartRoute('/service-types/abc-123', '?tab=details')).toBe(
        '/admin/service-types/abc-123?tab=details',
      );
    });

    it('preserves params on default-fallback paths', () => {
      expect(getCounterpartRoute('/some-unknown-page', '?x=1')).toBe('/admin?x=1');
    });

    it('treats empty search string as no-op', () => {
      expect(getCounterpartRoute('/users', '')).toBe('/admin/users');
    });
  });

  // ─── Default fallback for unmapped routes ──────────────────────────────

  describe('default fallback for unmapped routes', () => {
    it('falls back unmapped public paths to /admin', () => {
      expect(getCounterpartRoute('/something-new')).toBe('/admin');
    });

    it('falls back unmapped admin paths to /', () => {
      expect(getCounterpartRoute('/admin/something-new')).toBe('/');
    });

    it('falls back nested unmapped admin paths to /', () => {
      expect(getCounterpartRoute('/admin/foo/bar/baz')).toBe('/');
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('normalises trailing slashes on mapped routes', () => {
      expect(getCounterpartRoute('/users/')).toBe('/admin/users');
    });

    it('normalises trailing slashes on dynamic routes', () => {
      expect(getCounterpartRoute('/service-types/abc-123/')).toBe('/admin/service-types/abc-123');
    });

    it('does not strip the root "/" when normalising', () => {
      // "/" is a public root; should fall back to /admin
      expect(getCounterpartRoute('/')).toBe('/admin');
    });
  });
});
