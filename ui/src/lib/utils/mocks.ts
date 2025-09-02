import {
  InteractionType,
  ContactPreferenceHelpers,
  TimePreferenceHelpers,
  type OfferInDHT,
  type RequestInDHT,
  type ServiceTypeInDHT,
  type UserInDHT,
  type OrganizationInDHT,
  type UserType
} from '$lib/types/holochain';
import type { MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
import type { Record } from '@holochain/client';
import { SimpleFaker, faker } from '@faker-js/faker';

import { fetchImageAndConvertToUInt8Array, getRandomNumber } from '$lib/utils';
export async function createMockedUsers(count: number = 1): Promise<UserInDHT[]> {
  const users: UserInDHT[] = [];

  const fakedUserType = new SimpleFaker().helpers.arrayElements<UserType>(
    ['creator', 'advocate'],
    1
  )[0] as UserType;

  for (let i = 0; i < count; i++) {
    users.push({
      name: faker.person.fullName({ sex: 'female' }),
      nickname: faker.person.firstName('female'),
      bio: faker.lorem.paragraphs(getRandomNumber(2, 5)),
      picture: await fetchImageAndConvertToUInt8Array('https://picsum.photos/200/300'),
      user_type: fakedUserType,
      email: faker.internet.email(),
      phone: '123456789',
      time_zone: 'Europe/Paris',
      location: 'Paris, France'
    });
  }

  return users;
}

export async function createMockedOrganizations(count: number = 1): Promise<OrganizationInDHT[]> {
  const organizations: OrganizationInDHT[] = [];

  for (let i = 0; i < count; i++) {
    organizations.push({
      name: faker.company.name(),
      description: faker.company.catchPhrase(),
      full_legal_name: `${faker.company.name()} ${faker.helpers.arrayElement(['Inc.', 'LLC', 'Corp.', 'Ltd.', 'Co.', 'Foundation'])}`,
      email: faker.internet.email(),
      urls: Array.from({ length: 3 }, () => faker.internet.url()),
      location: faker.location.city(),
      logo: await fetchImageAndConvertToUInt8Array('https://picsum.photos/200/300')
    });
  }

  return organizations;
}

export function createMockedRequests(): Promise<RequestInDHT[]> {
  const mockRequests: RequestInDHT[] = [
    {
      title: 'Web Development Assistance',
      description: 'Need help building a responsive website for my small business',
      contact_preference: 'Email',
      date_range: {
        start: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
        end: Date.now() + 14 * 24 * 60 * 60 * 1000 // 2 weeks from now
      },
      time_estimate_hours: 5,
      time_preference: 'Evening',
      time_zone: 'America/New_York',
      interaction_type: InteractionType.Virtual,
      links: ['https://mybusiness.com']
    },
    {
      title: 'Spanish Tutoring Sessions',
      description: 'Looking for conversational Spanish practice with a native speaker',
      contact_preference: ContactPreferenceHelpers.createOther('Discord: myuser#1234'),
      time_estimate_hours: 8,
      time_preference: TimePreferenceHelpers.createOther('Weekends only'),
      time_zone: 'Europe/London',
      interaction_type: InteractionType.Virtual,
      links: []
    },
    {
      title: 'Graphic Design for Logo',
      description: 'Need a professional logo design for my startup',
      contact_preference: 'Phone',
      date_range: {
        start: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days from now
        end: Date.now() + 10 * 24 * 60 * 60 * 1000 // 10 days from now
      },
      time_estimate_hours: 12,
      time_preference: 'Morning',
      time_zone: 'Australia/Sydney',
      interaction_type: InteractionType.Virtual,
      links: ['https://mystartup.com']
    }
  ];

  return Promise.resolve(mockRequests);
}

export function createMockedOffers(): Promise<OfferInDHT[]> {
  const mockOffers: OfferInDHT[] = [
    {
      title: 'Professional Web Development',
      description: 'Experienced full-stack developer offering website creation services',
      time_preference: 'Evening',
      time_zone: 'America/New_York',
      interaction_type: InteractionType.Virtual,
      links: ['https://myportfolio.com', 'https://github.com/myuser']
    },
    {
      title: 'Guitar Lessons',
      description: 'Professional guitar instructor offering lessons for all skill levels',
      time_preference: TimePreferenceHelpers.createOther('Late nights preferred'),
      time_zone: 'Europe/Berlin',
      interaction_type: InteractionType.Virtual,
      links: ['https://musiclessons.com']
    },
    {
      title: 'Japanese Language Tutoring',
      description: 'Native Japanese speaker offering language lessons',
      time_preference: 'Morning',
      time_zone: 'Asia/Tokyo',
      interaction_type: InteractionType.InPerson,
      links: []
    }
  ];

  return Promise.resolve(mockOffers);
}

export async function createMockedServiceTypes(count: number = 1): Promise<ServiceTypeInDHT[]> {
  const serviceTypes: ServiceTypeInDHT[] = [];

  const predefinedServiceTypes = [
    {
      name: 'Holochain Zome Development (Rust)',
      description:
        'Design and development of custom Holochain zomes using Rust, including integrity and coordinator zomes.',
      technical: true
    },
    {
      name: 'Holochain hApp Architecture & Design',
      description:
        'Architecting and designing decentralized applications (hApps) on Holochain, including data modeling and security considerations.',
      technical: true
    },
    {
      name: 'UI/UX Design for dApps',
      description:
        'User interface and user experience design specifically tailored for decentralized applications, focusing on usability and trust.',
      technical: false
    },
    {
      name: 'Frontend Development (Svelte/TS)',
      description:
        'Building responsive and interactive user interfaces for Holochain hApps using Svelte, TypeScript, and modern web technologies.',
      technical: true
    },
    {
      name: 'hREA/Valueflows Economic Modeling',
      description:
        'Designing and implementing economic models and resource flows using hREA (Holochain Resource-Event-Agent) and Valueflows principles.',
      technical: true
    },
    {
      name: 'Holochain hApp Testing & QA',
      description:
        'Comprehensive testing of Holochain hApps, including unit tests, integration tests (Tryorama), and end-to-end quality assurance.',
      technical: true
    },
    {
      name: 'Technical Writing & Documentation',
      description:
        'Creating clear and concise technical documentation for Holochain projects, zomes, hApps, and APIs.',
      technical: false
    },
    {
      name: 'Community Building & Moderation',
      description:
        'Strategies and execution for growing and managing online communities around Holochain projects, including moderation and engagement.',
      technical: false
    },
    {
      name: 'Project Management for dApps',
      description:
        'Managing decentralized application development projects, including agile methodologies, roadmap planning, and team coordination.',
      technical: false
    },
    {
      name: 'Fundraising & Grant Proposal Writing',
      description:
        'Assistance with fundraising strategies, grant applications, and investor relations for Holochain-based projects.',
      technical: false
    },
    {
      name: 'Holochain Mentoring & Training',
      description:
        'Providing guidance, mentorship, and training for developers and teams new to Holochain and decentralized application development.',
      technical: false
    },
    {
      name: 'Decentralized Marketing & Outreach',
      description:
        'Marketing strategies and outreach tailored for decentralized projects, focusing on community engagement and value proposition.',
      technical: false
    }
  ];

  for (let i = 0; i < count; i++) {
    // Use predefined service types if available, otherwise generate random ones
    if (i < predefinedServiceTypes.length) {
      serviceTypes.push(predefinedServiceTypes[i]);
    } else {
      // Generate random service types
      const categories = [
        'Technology',
        'Design',
        'Marketing',
        'Finance',
        'Health',
        'Education',
        'Entertainment'
      ];
      const skills = [
        'programming',
        'design',
        'writing',
        'analysis',
        'consulting',
        'training',
        'support'
      ];

      const category = faker.helpers.arrayElement(categories);
      const skill = faker.helpers.arrayElement(skills);

      serviceTypes.push({
        name: `${category} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
        description: faker.lorem.paragraphs(getRandomNumber(1, 2)).substring(0, 300),
        technical: category === 'Technology' || skill === 'programming'
      });
    }
  }

  return serviceTypes;
}

// Create unique service types that are different from the predefined ones
export function createSuggestedMockedServiceType(): ServiceTypeInDHT {
  // Define unique categories and skills not used in the predefined service types
  const uniqueCategories = [
    'Sustainability',
    'Research',
    'Networking',
    'Legal',
    'Translation',
    'Logistics',
    'Coaching',
    'Wellness',
    'Agriculture',
    'Manufacturing'
  ];

  const uniqueSkills = [
    'facilitation',
    'mediation',
    'localization',
    'prototyping',
    'auditing',
    'visualization',
    'coordination',
    'assessment',
    'strategy',
    'implementation'
  ];

  // Generate a unique combination
  const category = faker.helpers.arrayElement(uniqueCategories);
  const skill = faker.helpers.arrayElement(uniqueSkills);

  // Create unique tags
  const uniqueTags = [
    category.toLowerCase(),
    skill,
    faker.word.adjective(),
    faker.word.noun(),
    'community',
    'collaboration',
    'decentralized'
  ];

  return {
    name: `${category} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
    description: faker.lorem.paragraph(getRandomNumber(2, 4)).substring(0, 300),
    technical:
      category === 'Research' ||
      skill === 'auditing' ||
      skill === 'prototyping' ||
      skill === 'implementation'
  };
}

export function createMockedMediumOfExchange(): MediumOfExchangeInDHT {
  const mediums = [
    {
      code: 'USD',
      name: 'US Dollar',
      description: 'United States Dollar - Standard monetary exchange',
      exchange_type: 'currency' as const
    },
    {
      code: 'EUR',
      name: 'Euro',
      description: 'European Union currency for international transactions',
      exchange_type: 'currency' as const
    },
    {
      code: 'BTC',
      name: 'Bitcoin',
      description: 'Cryptocurrency for decentralized digital payments',
      exchange_type: 'currency' as const
    },
    {
      code: 'TIME',
      name: 'Time Banking',
      description: 'Hour-for-hour time exchange system',
      exchange_type: 'base' as const
    },
    {
      code: 'SKILL',
      name: 'Skill Exchange',
      description: 'Direct skill-for-skill bartering system',
      exchange_type: 'base' as const
    },
    {
      code: 'GOODS',
      name: 'Goods Exchange',
      description: 'Physical goods and materials exchange',
      exchange_type: 'base' as const
    },
    {
      code: 'FAVOR',
      name: 'Favor Exchange',
      description: 'Favor-based reciprocal exchange system',
      exchange_type: 'base' as const
    },
    {
      code: 'POINTS',
      name: 'Community Points',
      description: 'Local community point system for services',
      exchange_type: 'base' as const
    }
  ];

  return faker.helpers.arrayElement(mediums);
}

export function createMockedMediumsOfExchange(count: number = 3): MediumOfExchangeInDHT[] {
  const allMediums = [
    {
      code: 'USD',
      name: 'US Dollar',
      description: 'United States Dollar - Standard monetary exchange',
      exchange_type: 'currency' as const
    },
    {
      code: 'EUR',
      name: 'Euro',
      description: 'European Union currency for international transactions',
      exchange_type: 'currency' as const
    },
    {
      code: 'BTC',
      name: 'Bitcoin',
      description: 'Cryptocurrency for decentralized digital payments',
      exchange_type: 'currency' as const
    },
    {
      code: 'ETH',
      name: 'Ethereum',
      description: 'Smart contract platform cryptocurrency',
      exchange_type: 'currency' as const
    },
    {
      code: 'TIME',
      name: 'Time Banking',
      description: 'Hour-for-hour time exchange system',
      exchange_type: 'base' as const
    },
    {
      code: 'SKILL',
      name: 'Skill Exchange',
      description: 'Direct skill-for-skill bartering system',
      exchange_type: 'base' as const
    },
    {
      code: 'GOODS',
      name: 'Goods Exchange',
      description: 'Physical goods and materials exchange',
      exchange_type: 'base' as const
    },
    {
      code: 'FAVOR',
      name: 'Favor Exchange',
      description: 'Favor-based reciprocal exchange system',
      exchange_type: 'base' as const
    },
    {
      code: 'POINTS',
      name: 'Community Points',
      description: 'Local community point system for services',
      exchange_type: 'base' as const
    },
    {
      code: 'CREDITS',
      name: 'Service Credits',
      description: 'Accumulated service credit system',
      exchange_type: 'base' as const
    }
  ];

  return faker.helpers.arrayElements(allMediums, Math.min(count, allMediums.length));
}

export function createSuggestedMockedMediumOfExchange(): MediumOfExchangeInDHT {
  const uniqueMediums = [
    {
      code: 'CARBON',
      name: 'Carbon Credits',
      description: 'Environmental impact offset trading system',
      exchange_type: 'currency' as const
    },
    {
      code: 'ENERGY',
      name: 'Energy Exchange',
      description: 'Renewable energy credit trading platform',
      exchange_type: 'base' as const
    },
    {
      code: 'SOCIAL',
      name: 'Social Capital',
      description: 'Community social impact measurement system',
      exchange_type: 'base' as const
    },
    {
      code: 'LEARN',
      name: 'Learning Credits',
      description: 'Educational achievement and knowledge sharing points',
      exchange_type: 'base' as const
    },
    {
      code: 'HEALTH',
      name: 'Health Points',
      description: 'Wellness and healthcare service exchange system',
      exchange_type: 'base' as const
    },
    {
      code: 'LOCAL',
      name: 'Local Currency',
      description: 'Regional community-based currency system',
      exchange_type: 'base' as const
    }
  ];

  return faker.helpers.arrayElement(uniqueMediums);
}

export function createMockedExchangeResponse(targetEntityType: 'request' | 'offer' = 'request') {
  const exchangeMediums = ['USD', 'CAD', 'EUR', 'Hours', 'Favor', 'Barter', 'Local Currency'];
  const timeframes = ['1-2 days', 'within a week', 'flexible', 'ASAP', '2-3 weeks', 'negotiable'];

  const baseResponse = {
    service_details:
      targetEntityType === 'request'
        ? faker.lorem.sentences(2, ' ') +
          ' I can provide this service with high quality and attention to detail.'
        : faker.lorem.sentences(2, ' ') +
          ' I would like to use this offered service for my project.',
    terms:
      faker.lorem.sentences(3, ' ') +
      ' All work will be completed according to agreed specifications.',
    exchange_medium: faker.helpers.arrayElement(exchangeMediums),
    exchange_value: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement(['$50', '$100', '2 hours', 'negotiable', '€75', 'fair trade']),
      { probability: 0.8 }
    ),
    delivery_timeframe: faker.helpers.maybe(() => faker.helpers.arrayElement(timeframes), {
      probability: 0.7
    }),
    notes: faker.helpers.maybe(
      () => faker.lorem.sentence() + ' Please feel free to contact me with any questions.',
      { probability: 0.6 }
    )
  };

  return baseResponse;
}
