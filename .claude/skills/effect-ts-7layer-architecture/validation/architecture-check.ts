#!/usr/bin/env tsx

/**
 * Validates Effect-TS 7-Layer Architecture implementation for a domain.
 * Usage: npx tsx architecture-check.ts <DomainName>
 * Example: npx tsx architecture-check.ts ServiceType
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class ArchitectureValidator {
  private domainName: string;
  private domainCamel: string;
  private basePath: string;
  private result: ValidationResult;

  constructor(domainName: string, basePath: string = 'ui/src/lib') {
    this.domainName = domainName;
    // Convert PascalCase to camelCase for file lookups (e.g. ServiceType → serviceType)
    this.domainCamel = domainName.charAt(0).toLowerCase() + domainName.slice(1);
    this.basePath = basePath;
    this.result = { valid: true, errors: [], warnings: [] };
  }

  async validate(): Promise<ValidationResult> {
    console.log(`Validating ${this.domainName} domain (files: ${this.domainCamel})...`);

    this.checkServiceLayer();
    this.checkStoreLayer();
    this.checkSchemaLayer();
    this.checkErrorLayer();
    await this.checkComposablesLayer();
    await this.checkComponentLayer();
    await this.checkTestingLayer();

    this.result.valid = this.result.errors.length === 0;
    return this.result;
  }

  private checkServiceLayer(): void {
    // Service files use plural snake_case: serviceTypes.service.ts
    const servicePath = join(this.basePath, 'services/zomes', `${this.domainCamel}s.service.ts`);
    const servicePathAlt = join(this.basePath, 'services/zomes', `${this.domainCamel}.service.ts`);

    const path = existsSync(servicePath) ? servicePath : existsSync(servicePathAlt) ? servicePathAlt : null;
    if (!path) {
      this.result.errors.push(`Service file not found: ${servicePath} or ${servicePathAlt}`);
      return;
    }

    const content = readFileSync(path, 'utf-8');

    if (!content.includes('Context.Tag')) {
      this.result.errors.push('Service missing Context.Tag pattern');
    }
    if (!content.includes('wrapZomeCallWithErrorFactory')) {
      this.result.warnings.push('Service should use wrapZomeCallWithErrorFactory');
    }
    if (!content.includes('E.gen') && !content.includes('Effect.gen')) {
      this.result.warnings.push('Service should use E.gen for implementation');
    }
    if (!content.includes('Layer.effect')) {
      this.result.errors.push('Service missing Layer.effect for live layer');
    }
    console.log('  Service layer checked');
  }

  private checkStoreLayer(): void {
    // Store files: .store.svelte.ts (Svelte 5)
    const storePath = join(this.basePath, 'stores', `${this.domainCamel}s.store.svelte.ts`);
    const storePathAlt = join(this.basePath, 'stores', `${this.domainCamel}.store.svelte.ts`);

    const path = existsSync(storePath) ? storePath : existsSync(storePathAlt) ? storePathAlt : null;
    if (!path) {
      this.result.errors.push(`Store file not found: ${storePath} or ${storePathAlt}`);
      return;
    }

    const content = readFileSync(path, 'utf-8');

    // Check Svelte 5 Runes (NOT Svelte 4 stores)
    if (content.includes('writable') || content.includes('readable')) {
      this.result.errors.push('Store uses Svelte 4 stores (writable/readable) — must use Svelte 5 Runes ($state/$derived)');
    }
    if (!content.includes('$state')) {
      this.result.errors.push('Store missing Svelte 5 $state() rune');
    }

    // Check store helper imports
    if (!content.includes("from '$lib/utils/store-helpers'")) {
      this.result.errors.push('Store must import helpers from $lib/utils/store-helpers');
    }

    const requiredHelpers = ['withLoadingState', 'createUIEntityFromRecord'];
    for (const helper of requiredHelpers) {
      if (!content.includes(helper)) {
        this.result.warnings.push(`Store missing helper: ${helper}`);
      }
    }

    // Check DI pattern
    if (!content.includes('E.provide') && !content.includes('E.provideService')) {
      this.result.warnings.push('Store should use E.provide for dependency injection');
    }
    console.log('  Store layer checked');
  }

  private checkSchemaLayer(): void {
    const schemaPath = join(this.basePath, 'schemas', `${this.domainCamel}s.schemas.ts`);
    const schemaPathAlt = join(this.basePath, 'schemas', `${this.domainCamel}.schemas.ts`);

    if (!existsSync(schemaPath) && !existsSync(schemaPathAlt)) {
      this.result.warnings.push(`Schema file not found: ${schemaPath}`);
    } else {
      console.log('  Schema layer checked');
    }
  }

  private checkErrorLayer(): void {
    const errorPath = join(this.basePath, 'errors', `${this.domainCamel}s.errors.ts`);
    const errorPathAlt = join(this.basePath, 'errors', `${this.domainCamel}.errors.ts`);

    if (!existsSync(errorPath) && !existsSync(errorPathAlt)) {
      this.result.warnings.push(`Error file not found: ${errorPath}`);
    } else {
      console.log('  Error layer checked');
    }
  }

  private async checkComposablesLayer(): Promise<void> {
    const patterns = [
      join(this.basePath, 'composables', `**/*${this.domainCamel}*.ts`),
      join(this.basePath, 'composables', 'domain', `**/*${this.domainCamel}*.ts`)
    ];
    let found = 0;
    for (const p of patterns) {
      found += (await glob(p)).length;
    }
    if (found === 0) {
      this.result.warnings.push('No composables found for domain');
    } else {
      console.log(`  Composables layer checked (${found} files)`);
    }
  }

  private async checkComponentLayer(): Promise<void> {
    const components = await glob(
      join('ui/src/lib/components', `**/*${this.domainCamel}*.svelte`),
      { nocase: true }
    );
    if (components.length === 0) {
      this.result.warnings.push('No Svelte components found for domain');
    } else {
      console.log(`  Component layer checked (${components.length} files)`);
    }
  }

  private async checkTestingLayer(): Promise<void> {
    const tests = await glob(
      join('ui/tests/unit', `**/*${this.domainCamel}*.test.ts`)
    );
    if (tests.length === 0) {
      this.result.warnings.push('No unit tests found for domain');
    } else {
      console.log(`  Testing layer checked (${tests.length} files)`);
    }
  }

  printResults(): void {
    console.log('\nArchitecture Validation Results');
    console.log('='.repeat(40));

    if (this.result.valid) {
      console.log('PASSED');
    } else {
      console.log('FAILED');
    }

    for (const e of this.result.errors) console.log(`  ERROR: ${e}`);
    for (const w of this.result.warnings) console.log(`  WARN:  ${w}`);

    const score = Math.max(0, 100 - this.result.errors.length * 20 - this.result.warnings.length * 5);
    console.log(`\nScore: ${score}/100`);
  }
}

async function main() {
  const domainName = process.argv[2];
  if (!domainName) {
    console.error('Usage: npx tsx architecture-check.ts <DomainName>');
    process.exit(1);
  }

  const validator = new ArchitectureValidator(domainName);
  const result = await validator.validate();
  validator.printResults();
  process.exit(result.valid ? 0 : 1);
}

main().catch(console.error);

export { ArchitectureValidator, type ValidationResult };
