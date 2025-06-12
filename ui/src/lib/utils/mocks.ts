import {
  ExchangePreference,
  InteractionType,
  ContactPreferenceHelpers,
  TimePreferenceHelpers,
  type OfferInDHT,
  type OrganizationInDHT,
  type RequestInDHT,
  type ServiceTypeInDHT,
  type UserInDHT,
  type UserType
} from '$lib/types/holochain';
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
      title: 'Need help with React component optimization',
      description:
        'Looking for someone to help optimize my React components for better performance. I have several components that are re-rendering unnecessarily.',
      contact_preference: 'Email',
      date_range: {
        start: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
        end: Date.now() + 14 * 24 * 60 * 60 * 1000 // 2 weeks from now
      },
      time_estimate_hours: 5,
      time_preference: 'Evening',
      time_zone: 'America/New_York',
      exchange_preference: ExchangePreference.Exchange,
      interaction_type: InteractionType.Virtual,
      links: ['https://github.com/myuser/my-react-project']
    },
    {
      title: 'Python automation script development',
      description:
        'I need help creating a Python script to automate my daily data processing tasks. Should be able to handle CSV files and generate reports.',
      contact_preference: ContactPreferenceHelpers.createOther('Discord: myuser#1234'),
      time_estimate_hours: 8,
      time_preference: TimePreferenceHelpers.createOther('Weekends only'),
      time_zone: 'Europe/London',
      exchange_preference: ExchangePreference.Arranged,
      interaction_type: InteractionType.Virtual,
      links: []
    },
    {
      title: 'WordPress site security audit',
      description:
        'Looking for someone to perform a comprehensive security audit of my WordPress website and provide recommendations for improvements.',
      contact_preference: 'Phone',
      date_range: {
        start: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days from now
        end: Date.now() + 10 * 24 * 60 * 60 * 1000 // 10 days from now
      },
      time_estimate_hours: 12,
      time_preference: 'Morning',
      time_zone: 'Australia/Sydney',
      exchange_preference: ExchangePreference.Exchange,
      interaction_type: InteractionType.Virtual,
      links: ['https://mywebsite.com']
    }
  ];

  return Promise.resolve(mockRequests);
}

export function createMockedOffers(): Promise<OfferInDHT[]> {
  const mockOffers: OfferInDHT[] = [
    {
      title: 'Frontend React Development Services',
      description:
        'Offering professional React development services. Experienced with hooks, context API, and modern React patterns. Can help with component architecture, state management, and performance optimization.',
      time_preference: 'Evening',
      time_zone: 'America/New_York',
      exchange_preference: ExchangePreference.Exchange,
      interaction_type: InteractionType.Virtual,
      links: ['https://github.com/myportfolio', 'https://myportfolio.com']
    },
    {
      title: 'Python & Data Analysis Consulting',
      description:
        'Providing Python development and data analysis services. Specializing in pandas, numpy, data visualization, and automation scripts. Can help with data processing pipelines and machine learning.',
      time_preference: TimePreferenceHelpers.createOther('Late nights preferred'),
      time_zone: 'Europe/Berlin',
      exchange_preference: ExchangePreference.PayItForward,
      interaction_type: InteractionType.Virtual,
      links: ['https://github.com/myanalytics']
    },
    {
      title: 'Web Security & WordPress Expertise',
      description:
        'Offering web security audits and WordPress development services. Can help with vulnerability assessments, security hardening, and custom plugin development.',
      time_preference: 'Morning',
      time_zone: 'Asia/Tokyo',
      exchange_preference: ExchangePreference.Arranged,
      interaction_type: InteractionType.InPerson,
      links: ['https://securityservices.com']
    }
  ];

  return Promise.resolve(mockOffers);
}

export async function createMockedServiceTypes(count: number = 1): Promise<ServiceTypeInDHT[]> {
  const serviceTypes: ServiceTypeInDHT[] = [];

  const predefinedServiceTypes = [
    {
      name: 'Holochain Zome Development (Rust)',
      description: 'Design and development of custom Holochain zomes using Rust, including integrity and coordinator zomes.',
      tags: ['holochain', 'rust', 'zome', 'happ', 'backend', 'p2p', 'dht']
    },
    {
      name: 'Holochain hApp Architecture & Design',
      description: 'Architecting and designing decentralized applications (hApps) on Holochain, including data modeling and security considerations.',
      tags: ['holochain', 'happ', 'architecture', 'design', 'decentralized', 'p2p', 'security']
    },
    {
      name: 'UI/UX Design for dApps',
      description: 'User interface and user experience design specifically tailored for decentralized applications, focusing on usability and trust.',
      tags: ['ui', 'ux', 'design', 'dapp', 'holochain', 'web3', 'figma', 'wireframing', 'prototyping']
    },
    {
      name: 'Frontend Development (Svelte/TS)',
      description: 'Building responsive and interactive user interfaces for Holochain hApps using Svelte, TypeScript, and modern web technologies.',
      tags: ['frontend', 'svelte', 'typescript', 'javascript', 'ui', 'happ', 'web']
    },
    {
      name: 'hREA/Valueflows Economic Modeling',
      description: 'Designing and implementing economic models and resource flows using hREA (Holochain Resource-Event-Agent) and Valueflows principles.',
      tags: ['hrea', 'valueflows', 'economic-modeling', 'agent-centric', 'resource-management', 'holochain']
    },
    {
      name: 'Holochain hApp Testing & QA',
      description: 'Comprehensive testing of Holochain hApps, including unit tests, integration tests (Tryorama), and end-to-end quality assurance.',
      tags: ['testing', 'qa', 'holochain', 'tryorama', 'rust', 'automation', 'quality-assurance']
    },
    {
      name: 'Technical Writing & Documentation',
      description: 'Creating clear and concise technical documentation for Holochain projects, zomes, hApps, and APIs.',
      tags: ['technical-writing', 'documentation', 'holochain', 'developer-docs', 'guides', 'editing']
    },
    {
      name: 'Community Building & Moderation',
      description: 'Strategies and execution for growing and managing online communities around Holochain projects, including moderation and engagement.',
      tags: ['community', 'moderation', 'engagement', 'growth', 'holochain', 'marketing']
    },
    {
      name: 'Project Management for dApps',
      description: 'Managing decentralized application development projects, including agile methodologies, roadmap planning, and team coordination.',
      tags: ['project-management', 'agile', 'dapp', 'holochain', 'coordination', 'planning']
    },
    {
      name: 'Fundraising & Grant Proposal Writing',
      description: 'Assistance with fundraising strategies, grant applications, and investor relations for Holochain-based projects.',
      tags: ['fundraising', 'grants', 'investment', 'holochain', 'web3', 'proposal-writing']
    },
    {
      name: 'Holochain Mentoring & Training',
      description: 'Providing guidance, mentorship, and training for developers and teams new to Holochain and decentralized application development.',
      tags: ['mentoring', 'training', 'education', 'holochain', 'rust', 'dapp-development']
    },
    {
      name: 'Decentralized Marketing & Outreach',
      description: 'Marketing strategies and outreach tailored for decentralized projects, focusing on community engagement and value proposition.',
      tags: ['marketing', 'outreach', 'decentralized', 'web3', 'holochain', 'community-marketing']
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
        tags: faker.helpers.arrayElements(
          [
            category.toLowerCase(),
            skill,
            faker.lorem.word(),
            faker.lorem.word(),
            faker.lorem.word()
          ],
          getRandomNumber(3, 5)
        )
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
    tags: faker.helpers.arrayElements(uniqueTags, getRandomNumber(3, 5))
  };
}
