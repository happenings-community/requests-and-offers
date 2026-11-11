/**
 * The Admin menu's items, in one place (#359). The nav bar's Admin button and
 * the mobile drawer's Administration section read the same list, so they
 * cannot drift apart. The Developer pages (hREA test, status history) stay in
 * the admin sidebar only.
 */
import type { UIOrganization, UIUser } from '$lib/types/ui';

export interface AdminMenuItem {
  href: string;
  label: string;
  icon: string;
  description: string;
  badge?: number;
}

/** Who is waiting for an administrator to decide: pending members and organizations. */
export interface AdminWaiting {
  members: number;
  organizations: number;
}

const isPending = (entity: { status?: { status_type?: string } }) =>
  entity.status?.status_type === 'pending';

export function adminWaiting(
  users: readonly Pick<UIUser, 'status'>[],
  organizations: readonly Pick<UIOrganization, 'status'>[]
): AdminWaiting {
  return {
    members: users.filter(isPending).length,
    organizations: organizations.filter(isPending).length
  };
}

/** A badge only where something is waiting, so the menu shows none at zero. */
const badge = (n: number) => (n > 0 ? n : undefined);

export function adminMenuItems(waiting: AdminWaiting): AdminMenuItem[] {
  return [
    {
      href: '/admin',
      label: 'Admin home',
      icon: '⚙️',
      description: 'The administration dashboard'
    },
    {
      href: '/admin/users',
      label: 'Members',
      icon: '👥',
      description: 'Accept, suspend or reject members',
      badge: badge(waiting.members)
    },
    {
      href: '/admin/organizations',
      label: 'Organizations',
      icon: '🏢',
      description: 'Accept and manage organizations',
      badge: badge(waiting.organizations)
    },
    {
      href: '/admin/requests',
      label: 'Requests',
      icon: '📝',
      description: 'Every request on the network'
    },
    {
      href: '/admin/offers',
      label: 'Offers',
      icon: '💡',
      description: 'Every offer on the network'
    },
    {
      href: '/admin/service-types',
      label: 'Service Types',
      icon: '🏷️',
      description: 'Approve and edit service types'
    },
    {
      href: '/admin/mediums-of-exchange',
      label: 'Mediums of Exchange',
      icon: '💱',
      description: 'Approve and edit mediums of exchange'
    },
    {
      href: '/admin/administrators',
      label: 'Administrators',
      icon: '🛡️',
      description: 'Who administers this network'
    }
  ];
}
