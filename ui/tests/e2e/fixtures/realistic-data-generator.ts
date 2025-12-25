import { faker } from '@faker-js/faker';
import type { ActionHash } from '@holochain/client';

// ============================================================================
// TYPE DEFINITIONS (matching Holochain types)
// ============================================================================

export type User = {
  name: string;
  nickname: string;
  bio: string;
  picture?: Uint8Array;
  user_type: 'advocate' | 'creator';
  email: string;
  phone?: string;
  time_zone: string;
  location: string;
  skills: string[];
};

export type Organization = {
  name: string;
  description: string;
  logo?: Uint8Array;
  email: string;
  urls: string[];
  location: string;
};

export type ServiceType = {
  name: string;
  description: string;
  tags: string[];
};

export type MediumOfExchange = {
  code: string;
  name: string;
  resource_spec_hrea_id?: string;
};

export type Request = {
  title: string;
  description: string;
  contact_preference: 'Email' | 'Phone' | 'Other';
  date_range?: {
    start?: number;
    end?: number;
  };
  time_estimate_hours?: number;
  time_preference: 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other';
  time_zone?: string;
  interaction_type: 'Virtual' | 'InPerson';
  links: string[];
};

export type Offer = {
  title: string;
  description: string;
  time_preference: 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other';
  time_zone?: string;
  interaction_type: 'Virtual' | 'InPerson';
  links: string[];
};

// ============================================================================
// REALISTIC DATA GENERATORS
// ============================================================================

export class RealisticDataGenerator {
  private static readonly SKILLS = [
    'JavaScript',
    'TypeScript',
    'React',
    'Vue',
    'Angular',
    'Node.js',
    'Python',
    'Rust',
    'Graphic Design',
    'UI/UX Design',
    'Web Design',
    'Logo Design',
    'Branding',
    'Content Writing',
    'Technical Writing',
    'Copywriting',
    'Blog Writing',
    'Digital Marketing',
    'SEO',
    'Social Media Marketing',
    'Email Marketing',
    'Project Management',
    'Business Consulting',
    'Financial Planning',
    'Photography',
    'Video Editing',
    'Animation',
    'Illustration',
    'Translation',
    'Language Teaching',
    'Tutoring',
    'Training',
    'Data Analysis',
    'Machine Learning',
    'DevOps',
    'Cloud Architecture'
  ];

  private static readonly SERVICE_CATEGORIES = [
    { name: 'Web Development', tags: ['frontend', 'backend', 'fullstack', 'javascript', 'react'] },
    { name: 'Mobile Development', tags: ['ios', 'android', 'react-native', 'flutter'] },
    { name: 'Graphic Design', tags: ['logo', 'branding', 'print', 'digital', 'illustration'] },
    { name: 'Content Creation', tags: ['writing', 'blogging', 'copywriting', 'technical-writing'] },
    { name: 'Digital Marketing', tags: ['seo', 'social-media', 'email-marketing', 'ppc'] },
    { name: 'Business Consulting', tags: ['strategy', 'operations', 'finance', 'management'] },
    {
      name: 'Education & Training',
      tags: ['tutoring', 'workshops', 'online-courses', 'mentoring']
    },
    { name: 'Creative Services', tags: ['photography', 'video', 'animation', 'music'] }
  ];

  private static readonly MEDIUMS_OF_EXCHANGE = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'PAY_IT_FORWARD', name: 'Free/Pay it Forward' },
    { code: 'SKILL_EXCHANGE', name: 'Skill Exchange' },
  ];

  private static readonly TIME_ZONES = [
    'UTC-8',
    'UTC-7',
    'UTC-6',
    'UTC-5',
    'UTC-4',
    'UTC-3',
    'UTC+0',
    'UTC+1',
    'UTC+2',
    'UTC+3',
    'UTC+8',
    'UTC+9'
  ];

  // Generate realistic users with diverse profiles
  static generateUsers(count: number): User[] {
    return Array.from({ length: count }, () => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const skills = faker.helpers.arrayElements(this.SKILLS, { min: 2, max: 6 });

      return {
        name: `${firstName} ${lastName}`,
        nickname:
          faker.helpers.maybe(() => faker.internet.userName(), { probability: 0.7 }) || firstName,
        bio: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
        user_type: faker.helpers.arrayElement(['advocate', 'creator']),
        email: faker.internet.email({ firstName, lastName }),
        phone: faker.helpers.maybe(() => faker.phone.number(), { probability: 0.6 }),
        time_zone: faker.helpers.arrayElement(this.TIME_ZONES),
        location: `${faker.location.city()}, ${faker.location.country()}`,
        skills
      };
    });
  }

  // Generate realistic organizations
  static generateOrganizations(count: number): Organization[] {
    return Array.from({ length: count }, () => {
      const companyName = faker.company.name();

      return {
        name: companyName,
        description: faker.company.catchPhrase() + '. ' + faker.lorem.sentences(2),
        email: faker.internet.email({
          firstName: 'contact',
          lastName: companyName.toLowerCase().replace(/\s+/g, '')
        }),
        urls: [faker.internet.url()],
        location: `${faker.location.city()}, ${faker.location.country()}`
      };
    });
  }

  // Generate service types
  static generateServiceTypes(): ServiceType[] {
    return this.SERVICE_CATEGORIES.map((category) => ({
      name: category.name,
      description: `Professional ${category.name.toLowerCase()} services including ${category.tags.slice(0, 3).join(', ')} and more.`,
      tags: category.tags
    }));
  }

  // Generate mediums of exchange
  static generateMediumsOfExchange(): MediumOfExchange[] {
    return this.MEDIUMS_OF_EXCHANGE.map((medium) => ({
      code: medium.code,
      name: medium.name,
      resource_spec_hrea_id: undefined
    }));
  }

  // Generate realistic requests
  static generateRequests(count: number, serviceTypeHashes: ActionHash[]): Request[] {
    return Array.from({ length: count }, () => {
      const serviceCategory = faker.helpers.arrayElement(this.SERVICE_CATEGORIES);
      const skill = faker.helpers.arrayElement(serviceCategory.tags);

      return {
        title: `Need ${serviceCategory.name} - ${faker.lorem.words(3)}`,
        description: `Looking for help with ${skill}. ${faker.lorem.sentences(2)}`,
        contact_preference: faker.helpers.arrayElement(['Email', 'Phone', 'Other']),
        date_range: faker.helpers.maybe(
          () => ({
            start: Date.now() + faker.number.int({ min: 86400000, max: 2592000000 }), // 1 day to 30 days
            end: Date.now() + faker.number.int({ min: 2592000000, max: 7776000000 }) // 30 to 90 days
          }),
          { probability: 0.7 }
        ),
        time_estimate_hours: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 40 }), {
          probability: 0.8
        }),
        time_preference: faker.helpers.arrayElement([
          'Morning',
          'Afternoon',
          'Evening',
          'NoPreference'
        ]),
        time_zone: faker.helpers.arrayElement(this.TIME_ZONES),
        interaction_type: faker.helpers.arrayElement(['Virtual', 'InPerson']),
        links: faker.helpers.maybe(() => [faker.internet.url()], { probability: 0.4 }) || []
      };
    });
  }

  // Generate realistic offers
  static generateOffers(count: number, serviceTypeHashes: ActionHash[]): Offer[] {
    return Array.from({ length: count }, () => {
      const serviceCategory = faker.helpers.arrayElement(this.SERVICE_CATEGORIES);
      const skill = faker.helpers.arrayElement(serviceCategory.tags);

      return {
        title: `${serviceCategory.name} Services - ${faker.lorem.words(3)}`,
        description: `Offering professional ${skill} services. ${faker.lorem.sentences(2)}`,
        time_preference: faker.helpers.arrayElement([
          'Morning',
          'Afternoon',
          'Evening',
          'NoPreference'
        ]),
        time_zone: faker.helpers.arrayElement(this.TIME_ZONES),
        interaction_type: faker.helpers.arrayElement(['Virtual', 'InPerson']),
        links:
          faker.helpers.maybe(() => [faker.internet.url(), faker.internet.url()], {
            probability: 0.6
          }) || []
      };
    });
  }

  // Generate a complete realistic dataset
  static generateCompleteDataset() {
    return {
      users: this.generateUsers(25),
      organizations: this.generateOrganizations(8),
      serviceTypes: this.generateServiceTypes(),
      mediumsOfExchange: this.generateMediumsOfExchange()
      // Note: requests and offers will be generated after service types are created
      // to use their actual ActionHashes
    };
  }
}
