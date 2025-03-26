import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const updateImports = (content) => {
  return content
    // Update store imports
    .replace(/@\/stores\//g, '@lib/stores/')
    .replace(/@stores\//g, '@lib/stores/')
    // Update type imports
    .replace(/@\/types\//g, '@lib/types/')
    .replace(/@types\//g, '@lib/types/')
    // Update service imports
    .replace(/@\/services\//g, '@lib/services/')
    .replace(/@services\//g, '@lib/services/')
    // Update utils imports
    .replace(/@\/utils/g, '@lib/utils')
    .replace(/@utils/g, '@lib/utils')
    // Update mocks imports
    .replace(/@\/mocks/g, '@mocks')
    // Update component imports
    .replace(/@\/lib\/components\//g, '@components/')
    .replace(/@components\//g, '@lib/components/')
    // Update test helper imports
    .replace(/@\/tests\/utils\//g, '@lib/tests/utils/')
    // Update lib imports
    .replace(/\$lib\//g, '@lib/')
    .replace(/@\/lib\//g, '@lib/');
};

const files = glob.sync('src/**/*.{ts,js,svelte}');

files.forEach((file) => {
  const content = readFileSync(file, 'utf-8');
  const updatedContent = updateImports(content);
  if (content !== updatedContent) {
    console.log(`Updating imports in ${file}`);
    writeFileSync(file, updatedContent);
  }
}); 