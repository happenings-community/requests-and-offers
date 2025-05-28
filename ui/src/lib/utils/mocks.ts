import {
  ExchangePreference,
  InteractionType,
  TimePreference,
  type OfferInDHT,
  type OrganizationInDHT,
  type RequestInDHT,
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
      skills: ['JavaScript', 'Svelte', 'SvelteKit', 'Rust', 'WebAssembly'],
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
