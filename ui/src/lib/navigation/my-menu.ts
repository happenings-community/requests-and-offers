/**
 * The member's own items, in one place (#344): the nav bar's top-right menu,
 * the mobile drawer and the home page's cards all read this list, so they
 * cannot drift apart again.
 */
export interface MyMenuItem {
  href: string;
  label: string;
  icon: string;
  description: string;
}

export function myMenuItems(hasProfile: boolean): MyMenuItem[] {
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
        },
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
