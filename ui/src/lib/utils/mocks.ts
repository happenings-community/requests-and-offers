import type {
  OfferInDHT,
  OrganizationInDHT,
  RequestInDHT,
  UserInDHT,
  UserType
} from '@/lib/types/holochain';
import { SimpleFaker, faker } from '@faker-js/faker';

import { fetchImageAndConvertToUInt8Array, getRandomNumber } from '@lib/utils';
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
    requests.push({
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraphs(getRandomNumber(2, 4)),
      requirements: Array.from({ length: getRandomNumber(2, 5) }, () => faker.person.jobArea()),
      urgency: faker.helpers.arrayElement(['High', 'Medium', 'Low', undefined])
    });
  }

  return requests;
}

export async function createMockedOffers(count: number = 1): Promise<OfferInDHT[]> {
  const offers: OfferInDHT[] = [];

  for (let i = 0; i < count; i++) {
    offers.push({
      title: faker.company.catchPhrase(),
      description: faker.lorem.paragraphs(getRandomNumber(2, 4)),
      capabilities: Array.from({ length: getRandomNumber(2, 5) }, () => faker.person.jobArea()),
      availability: faker.helpers.arrayElement(['Full-time', 'Part-time', 'One-time', undefined])
    });
  }

  return offers;
}
