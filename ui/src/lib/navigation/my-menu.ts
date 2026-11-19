import { paths } from '$lib/paths';

/**
 * The member's own items, in one place (#344). **My Activity** is what you do on
 * the network: exchanges, listings, and My Messages where the network has
 * messaging. On the nav bar they are links and an envelope (Sam, 16 November);
 * the mobile drawer and the home page list them in this order. **Your profile**,
 * under your picture, is who you are. One list, so they cannot drift apart.
 */
export interface MyMenuItem {
  href: string;
  label: string;
  icon: string;
  description: string;
}

/** My Messages, where this network has messaging. */
export const MY_MESSAGES: MyMenuItem = {
  href: paths.messages(),
  label: 'My Messages',
  icon: '✉️',
  description: 'Your conversations with other members'
};

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
 * My Activity: what you are doing on the network. Every page here is for accepted
 * members, so a pending or suspended member gets no links that end at the Members
 * only wall (#349 review). My Messages is here, beside My Exchanges, where this
 * network has messaging (R121): conversations are something you do, not part of who
 * you are. The caller says whether it has: shared chrome asks `messagingPresence`,
 * and this list stays a plain function.
 */
export function myActivityItems(accepted: boolean, withMessages = false): MyMenuItem[] {
  if (!accepted) return [];
  return [
    {
      href: paths.exchanges(),
      label: 'My Exchanges',
      icon: '🤝',
      description: 'Agreements you are part of'
    },
    {
      href: paths.myListings(),
      label: 'My Listings',
      icon: '📋',
      description: 'Manage your requests and offers'
    },
    ...(withMessages ? [MY_MESSAGES] : [])
  ];
}

/** Everything of your own, profile first: the home page's cards. */
export function myMenuItems(
  hasProfile: boolean,
  accepted: boolean,
  withMessages = false
): MyMenuItem[] {
  return [...myProfileItems(hasProfile), ...myActivityItems(accepted, withMessages)];
}
