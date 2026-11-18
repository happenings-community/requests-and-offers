import { paths } from '$lib/paths';

/**
 * The member's own items, in one place (#344). The nav bar has two menus for
 * them (Sam, 17 October): **My Activity** (listings and exchanges, what you
 * do on the network) and **your profile menu** under your picture (your
 * profile, and My Messages once messaging is switched on). The mobile drawer
 * and the home page read the same lists, so they cannot drift apart.
 */
export interface MyMenuItem {
  href: string;
  label: string;
  icon: string;
  description: string;
}

/** Under your picture: your profile, or Create Profile until there is one. */
export function myProfileItems(hasProfile: boolean): MyMenuItem[] {
  return [
    hasProfile
      ? {
          href: paths.myProfile(),
          label: 'My Profile',
          icon: '👤',
          description: 'View and edit your profile'
        }
      : {
          href: paths.myProfileCreate(),
          label: 'Create Profile',
          icon: '👤',
          description: 'Join the community'
        }
  ];
}

/**
 * My Activity: what you are doing on the network. Both pages are for accepted
 * members, so a pending or suspended member gets no links that end at the
 * Members only wall (#349 review).
 */
export function myActivityItems(accepted: boolean): MyMenuItem[] {
  if (!accepted) return [];
  return [
    {
      href: paths.myListings(),
      label: 'My Listings',
      icon: '📋',
      description: 'Manage your requests and offers'
    },
    {
      href: paths.exchanges(),
      label: 'My Exchanges',
      icon: '🤝',
      description: 'Agreements you are part of'
    }
  ];
}

/** Everything of your own, profile first: the home page's cards. */
export function myMenuItems(hasProfile: boolean, accepted: boolean): MyMenuItem[] {
  return [...myProfileItems(hasProfile), ...myActivityItems(accepted)];
}
