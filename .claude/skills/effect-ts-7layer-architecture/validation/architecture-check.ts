#!/usr/bin/env tsx

/**
 * Validation script for Effect-TS 7-Layer Architecture implementation
 * Ensures new domains follow the established patterns
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

class ArchitectureValidator {
  private domainName: string;
  private basePath: string;
  private result: ValidationResult;

  constructor(domainName: string, basePath: string = 'ui/src/lib') {
    this.domainName = domainName;
    this.basePath = basePath;
    this.result = {
      valid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };
  }

  async validate(): Promise<ValidationResult> {
    console.log(`🔍 Validating ${this.domainName} domain architecture...`);

    await this.checkServiceLayer();
    await this.checkStoreLayer();
    await this.checkSchemaLayer();
    await this.checkErrorLayer();
    await this.checkComposablesLayer();
    await this.checkComponentLayer();
    await this.checkTestingLayer();

    this.result.valid = this.result.errors.length === 0;
    return this.result;
  }

  private async checkServiceLayer(): Promise<void> {
    const servicePath = join(this.basePath, 'services/zomes', `${this.domainName.toLowerCase()}.service.ts`);

    if (!existsSync(servicePath)) {
      this.result.errors.push(`❌ Service file not found: ${servicePath}`);
      return;
    }

    const content = readFileSync(servicePath, 'utf-8');

    // Check for required service interface
    if (!content.includes(`${this.domainName}Service`)) {
      this.result.errors.push(`❌ Service interface not found: ${this.domainName}Service`);
    }

    // Check for Context.Tag
    if (!content.includes('Context.GenericTag')) {
      this.result.errors.push(`❌ Service missing Context.GenericTag pattern`);
    }

    // Check for Effect.gen implementation
    if (!content.includes('Effect.gen') && !content.includes('E.gen')) {
      this.result.warnings.push(`⚠️  Service should use Effect.gen for implementation`);
    }

    // Check for proper error handling
    if (!content.includes(`${this.domainName}Error`)) {
      this.result.errors.push(`❌ Service missing domain-specific error handling`);
    }

    // Check for layer exports
    if (!content.includes('Live') || !content.includes('Test')) {
      this.result.recommendations.push(`💡 Consider adding Live and Test layers for dependency injection`);
    }

    console.log(`✅ Service layer validated`);
  }

  private async checkStoreLayer(): Promise<void> {
    const storePath = join(this.basePath, 'stores', `${this.domainName.toLowerCase()}.store.ts`);

    if (!existsSync(storePath)) {
      this.result.errors.push(`❌ Store file not found: ${storePath}`);
      return;
    }

    const content = readFileSync(storePath, 'utf-8');

    // Check for all 9 helper functions
    const requiredHelpers = [
      'createUIEntity',
      'mapRecordsToUIEntities',
      'createCacheSyncHelper',
      'createStatusAwareEventEmitters',
      'createEntitiesFetcher',
      'withLoadingState',
      'createRecordCreationHelper',
      'createStatusTransitionHelper',
      'processMultipleRecordCollections'
    ];

    requiredHelpers.forEach(helper => {
      if (!content.includes(helper)) {
        this.result.errors.push(`❌ Store missing helper function: ${helper}`);
      }
    });

    // Check for proper Effect integration
    if (!content.includes('Effect.gen') && !content.includes('E.gen')) {
      this.result.warnings.push(`⚠️  Store should use Effect for async operations`);
    }

    // Check for Svelte stores
    if (!content.includes('writable') && !content.includes('readable')) {
      this.result.errors.push(`❌ Store missing Svelte store integration`);
    }

    console.log(`✅ Store layer validated`);
  }

  private async checkSchemaLayer(): Promise<void> {
    const schemaPath = join(this.basePath, 'schemas', `${this.domainName.toLowerCase()}.schemas.ts`);

    if (!existsSync(schemaPath)) {
      this.result.errors.push(`❌ Schema file not found: ${schemaPath}`);
      return;
    }

    const content = readFileSync(schemaPath, 'utf-8');

    // Check for Effect Schema usage
    if (!content.includes('Schema.Struct') && !content.includes('Schema.')) {
      this.result.warnings.push(`⚠️  Consider using Effect Schema for validation`);
    }

    // Check for type exports
    if (!content.includes('export type')) {
      this.result.warnings.push(`⚠️  Schema should export TypeScript types`);
    }

    console.log(`✅ Schema layer validated`);
  }

  private async checkErrorLayer(): Promise<void> {
    const errorPath = join(this.basePath, 'errors', `${this.domainName.toLowerCase()}.errors.ts`);

    if (!existsSync(errorPath)) {
      this.result.warnings.push(`⚠️  Error file not found: ${errorPath}`);
      return;
    }

    const content = readFileSync(errorPath, 'utf-8');

    // Check for tagged error pattern
    if (!content.includes('TaggedError')) {
      this.result.recommendations.push(`💡 Consider using TaggedError pattern for domain errors`);
    }

    console.log(`✅ Error layer validated`);
  }

  private async checkComposablesLayer(): Promise<void> {
    const composablesPattern = join(this.basePath, 'composables', `${this.domainName.toLowerCase()}*.ts`);
    const composables = await glob(composablesPattern);

    if (composables.length === 0) {
      this.result.recommendations.push(`💡 Consider adding composables for reusable logic`);
    } else {
      console.log(`✅ Composables layer validated (${composables.length} files found)`);
    }
  }

  private async checkComponentLayer(): Promise<void> {
    const componentPattern = join('ui/src/routes', `**/*${this.domainName.toLowerCase()}*.svelte`);
    const components = await glob(componentPattern);

    if (components.length === 0) {
      this.result.warnings.push(`⚠️  No Svelte components found for domain`);
    } else {
      // Check accessibility in components
      for (const component of components) {
        const content = readFileSync(component, 'utf-8');
        if (content.includes('<button') && !content.includes('aria-') && !content.includes('type=')) {
          this.result.recommendations.push(`💡 Add accessibility attributes to buttons in ${component}`);
        }
      }
      console.log(`✅ Component layer validated (${components.length} files found)`);
    }
  }

  private async checkTestingLayer(): Promise<void> {
    const testPattern = join('tests', `**/*${this.domainName.toLowerCase()}*.test.ts`);
    const tests = await glob(testPattern);

    if (tests.length === 0) {
      this.result.warnings.push(`⚠️  No tests found for domain`);
    } else {
      console.log(`✅ Testing layer validated (${tests.length} test files found)`);
    }
  }

  printResults(): void {
    console.log('\n📊 Architecture Validation Results');
    console.log('=====================================');

    if (this.result.valid) {
      console.log('✅ Architecture validation PASSED');
    } else {
      console.log('❌ Architecture validation FAILED');
    }

    if (this.result.errors.length > 0) {
      console.log('\n🚨 Errors:');
      this.result.errors.forEach(error => console.log(`  ${error}`));
    }

    if (this.result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.result.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    if (this.result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.result.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log('\n📈 Architecture Score:');
    const totalChecks = this.result.errors.length + this.result.warnings.length + this.result.recommendations.length;
    const score = Math.max(0, 100 - (this.result.errors.length * 20) - (this.result.warnings.length * 5));
    console.log(`  Score: ${score}/100`);

    if (score >= 90) {
      console.log('  Rating: 🏆 Excellent');
    } else if (score >= 80) {
      console.log('  Rating: ✨ Good');
    } else if (score >= 70) {
      console.log('  Rating: 👍 Acceptable');
    } else {
      console.log('  Rating: 🚧 Needs Improvement');
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const domainName = args[0];

  if (!domainName) {
    console.error('Usage: tsx architecture-check.ts <domain-name>');
    console.error('Example: tsx architecture-check.ts MyDomain');
    process.exit(1);
  }

  const validator = new ArchitectureValidator(domainName);
  const result = await validator.validate();

  validator.printResults();

  process.exit(result.valid ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

export { ArchitectureValidator, type ValidationResult };