import {
  ExchangePreference,
  InteractionType,
  TimePreference,
  type OfferInDHT,
  type OrganizationInDHT,
  type RequestInDHT,
  type ServiceTypeInDHT,
  type UserInDHT,
  type UserType,
  ContactPreference
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

export async function createMockedRequests(count: number = 1): Promise<RequestInDHT[]> {
  const requests: RequestInDHT[] = [];

  for (let i = 0; i < count; i++) {
    // Create a date range with random dates
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + getRandomNumber(1, 30)); // Start 1-30 days from now

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + getRandomNumber(1, 60)); // End 1-60 days after start

    const dateRange = {
      start: startDate.getTime(),
      end: endDate.getTime()
    };

    requests.push({
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraphs(getRandomNumber(1, 2)).substring(0, 500), // Limit to 500 chars
      links: Array.from({ length: getRandomNumber(2, 5) }, () => faker.internet.url()),
      contact_preference: faker.helpers.arrayElement([
        ContactPreference.Email,
        ContactPreference.Phone,
        ContactPreference.Other
      ]),
      date_range: dateRange,
      time_estimate_hours: getRandomNumber(1, 40),
      time_preference: faker.helpers.arrayElement([
        TimePreference.Morning,
        TimePreference.Afternoon,
        TimePreference.Evening,
        TimePreference.NoPreference,
        TimePreference.Other
      ]),
      time_zone: faker.helpers.arrayElement([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        undefined
      ]),
      exchange_preference: faker.helpers.arrayElement([
        ExchangePreference.Exchange,
        ExchangePreference.Arranged,
        ExchangePreference.PayItForward,
        ExchangePreference.Open
      ]),
      interaction_type: faker.helpers.arrayElement([
        InteractionType.Virtual,
        InteractionType.InPerson
      ])
    });
  }

  return requests;
}

export async function createMockedOffers(count: number = 1): Promise<OfferInDHT[]> {
  const offers: OfferInDHT[] = [];

  for (let i = 0; i < count; i++) {
    offers.push({
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraphs(getRandomNumber(1, 2)).substring(0, 500), // Limit to 500 chars
      links: Array.from({ length: getRandomNumber(2, 5) }, () => faker.internet.url()),
      time_preference: faker.helpers.arrayElement([
        TimePreference.Morning,
        TimePreference.Afternoon,
        TimePreference.Evening,
        TimePreference.NoPreference,
        TimePreference.Other
      ]),
      time_zone: faker.helpers.arrayElement([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        undefined
      ]),
      exchange_preference: faker.helpers.arrayElement([
        ExchangePreference.Exchange,
        ExchangePreference.Arranged,
        ExchangePreference.PayItForward,
        ExchangePreference.Open
      ]),
      interaction_type: faker.helpers.arrayElement([
        InteractionType.Virtual,
        InteractionType.InPerson
      ])
    });
  }

  return offers;
}

export async function createMockedServiceTypes(count: number = 1): Promise<ServiceTypeInDHT[]> {
  const serviceTypes: ServiceTypeInDHT[] = [];

  const predefinedServiceTypes = [
    {
      name: 'Web Development',
      description:
        'Frontend and backend web development services including modern frameworks, responsive design, and API integration.',
      tags: ['javascript', 'typescript', 'react', 'svelte', 'nodejs', 'frontend', 'backend']
    },
    {
      name: 'Mobile App Development',
      description: 'Native and cross-platform mobile application development for iOS and Android.',
      tags: ['mobile', 'ios', 'android', 'react-native', 'flutter', 'swift', 'kotlin']
    },
    {
      name: 'UI/UX Design',
      description:
        'User interface and user experience design services including wireframing, prototyping, and visual design.',
      tags: ['design', 'ui', 'ux', 'figma', 'sketch', 'prototyping', 'wireframing']
    },
    {
      name: 'Blockchain Development',
      description:
        'Decentralized application development, smart contracts, and blockchain integration services.',
      tags: ['blockchain', 'ethereum', 'solidity', 'web3', 'defi', 'smart-contracts', 'holochain']
    },
    {
      name: 'DevOps & Infrastructure',
      description:
        'Cloud infrastructure, CI/CD pipelines, containerization, and deployment automation services.',
      tags: ['devops', 'aws', 'docker', 'kubernetes', 'cicd', 'terraform', 'monitoring']
    },
    {
      name: 'Data Science & Analytics',
      description:
        'Data analysis, machine learning, statistical modeling, and business intelligence services.',
      tags: ['data-science', 'machine-learning', 'python', 'r', 'sql', 'analytics', 'ai']
    },
    {
      name: 'Content Creation',
      description:
        'Writing, editing, video production, graphic design, and multimedia content creation services.',
      tags: ['writing', 'editing', 'video', 'graphics', 'content', 'copywriting', 'marketing']
    },
    {
      name: 'Business Consulting',
      description:
        'Strategic planning, market research, process optimization, and business development services.',
      tags: ['consulting', 'strategy', 'business', 'market-research', 'planning', 'optimization']
    },
    {
      name: 'Translation & Localization',
      description: 'Language translation, cultural adaptation, and internationalization services.',
      tags: ['translation', 'localization', 'languages', 'cultural', 'international', 'i18n']
    },
    {
      name: 'Legal & Compliance',
      description:
        'Legal advice, contract review, regulatory compliance, and intellectual property services.',
      tags: ['legal', 'contracts', 'compliance', 'ip', 'regulatory', 'law', 'patents']
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
