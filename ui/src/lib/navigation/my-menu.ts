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
          href: '/user',
          label: 'My Profile',
          icon: '👤',
          description: 'View and edit your profile'
        }
      : {
          href: '/user/create',
          label: 'Create Profile',
          icon: '👤',
          description: 'Join the community'
        }
  ];
}

/** My Activity: what you are doing on the network. */
export function myActivityItems(): MyMenuItem[] {
  return [
    {
      href: '/my-listings',
      label: 'My Listings',
      icon: '📋',
      description: 'Manage your requests and offers'
    },
    {
      href: '/exchanges',
      label: 'My Exchanges',
      icon: '🤝',
      description: 'Agreements you are part of'
    }
  ];
}

/** Everything of your own, profile first: the home page's cards. */
export function myMenuItems(hasProfile: boolean): MyMenuItem[] {
  return [...myProfileItems(hasProfile), ...myActivityItems()];
}
