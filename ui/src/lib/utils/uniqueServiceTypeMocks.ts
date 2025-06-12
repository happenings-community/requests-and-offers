import { faker } from '@faker-js/faker';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { getRandomNumber } from '$lib/utils';

// Create unique service types that are different from the predefined ones
export function createUniqueMockedServiceType(): ServiceTypeInDHT {
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
