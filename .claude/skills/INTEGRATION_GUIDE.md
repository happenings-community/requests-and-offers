# Claude Skills Integration Guide

## Quick Integration

### Step 1: Install Skills
```bash
# Copy skills to your project (correct location)
cp -r path/to/requests-and-offers/.claude/skills/* .claude/skills/

# Make scripts executable
chmod +x .claude/skills/holochain-development/scripts/*.sh
```

### Step 2: Configure Claude
Skills are automatically discovered by Claude when placed in the `.claude/skills/` directory following the official documentation.

### Step 3: Validate Installation
```bash
# Test Holochain environment setup
./.claude/skills/holochain-development/scripts/setup-holochain-dev.sh

# Validate Effect-TS architecture (example domain)
npx tsx .claude/skills/effect-ts-7layer-architecture/validation/architecture-check.ts MyDomain
```

## Usage Scenarios

### Scenario 1: New Holochain Project
**Request**: "Help me create a new Holochain hApp for resource sharing"

**Claude will**:
1. Load Holochain Development Skill for environment setup
2. Use the setup script to configure development environment
3. Create project structure with DNA and zome templates
4. Load Effect-TS Architecture Skill for frontend patterns
5. Generate service and store templates

### Scenario 2: Adding New Domain
**Request**: "Add a Reviews domain with ratings to our existing app"

**Claude will**:
1. Load Effect-TS Architecture Skill for patterns
2. Generate service layer using template
3. Create store with 9 helper functions
4. Load Holochain Development Skill for zomes
5. Create integrity and coordinator zomes
6. Generate testing patterns

### Scenario 3: Architecture Validation
**Request**: "Check if our Offers domain follows the 7-layer architecture"

**Claude will**:
1. Load Effect-TS Architecture Skill
2. Run validation script
3. Identify missing components
4. Provide specific fixes and templates

### Scenario 4: Debugging Setup Issues
**Request**: "My Holochain environment isn't working properly"

**Claude will**:
1. Load Holochain Development Skill
2. Run environment diagnostics
3. Identify missing tools or configuration
4. Execute setup script to fix issues

## Advanced Integration

### Custom Project Configuration
Create `skills/config.json` for project-specific settings:

```json
{
  "project": {
    "name": "My Holochain App",
    "type": "holochain-happ",
    "domains": ["users", "resources", "exchanges"]
  },
  "preferences": {
    "defaultArchitecture": "effect-ts-7layer",
    "testFramework": "tryorama",
    "buildTool": "nix"
  }
}
```

### Custom Validation Rules
Extend the architecture validator for project-specific rules:

```typescript
// skills/custom-validation.ts
import { ArchitectureValidator } from './effect-ts-7layer-architecture/validation/architecture-check';

export class CustomValidator extends ArchitectureValidator {
  async validateCustomRules() {
    // Add project-specific validation logic
    await this.checkCustomNamingConventions();
    await this.validateSecurityRequirements();
    await this.checkPerformanceStandards();
  }
}
```

### CI/CD Integration
Add to your GitHub Actions workflow:

```yaml
name: Validate Architecture
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Validate Architecture
        run: |
          npx tsx skills/effect-ts-7layer-architecture/validation/architecture-check.ts MyDomain
          npx tsx skills/effect-ts-7layer-architecture/validation/architecture-check.ts AnotherDomain

      - name: Validate Holochain Setup
        run: ./skills/holochain-development/scripts/setup-holochain-dev.sh
```

## IDE Integration

### VS Code / Cursor Extensions
Create `.vscode/settings.json`:

```json
{
  "claude.skills.enabled": true,
  "claude.skills.path": "./skills",
  "claude.skills.autoLoad": ["effect-ts-7layer-architecture", "holochain-development"]
}
```

### Code Snippets
Add to `.vscode/snippets.json`:

```json
{
  "Effect-TS Service": {
    "prefix": "effect-service",
    "body": [
      "// Generated using Effect-TS Architecture Skill",
      "import { Effect as E, Context, pipe } from 'effect';",
      "",
      "export interface ${1:MyDomain}Service {",
      "  readonly create${1:MyDomain}: (input: Create${1:MyDomain}Input) => E.Effect<Record, ${1:MyDomain}Error>;",
      "  // ... other methods",
      "}",
      "",
      "export const ${1:MyDomain}Service = Context.GenericTag<${1:MyDomain}Service>(\"${1:MyDomain}Service\");",
      "",
      "export const make${1:MyDomain}Service = E.gen(function* () {",
      "  // Implementation from Effect-TS Architecture Skill",
      "});"
    ]
  }
}
```

## Troubleshooting

### Common Integration Issues

1. **Skills Not Loading**
   - Ensure `skills/` directory is in project root
   - Check YAML frontmatter in SKILL.md files
   - Verify file permissions on scripts

2. **Template Variables Not Replaced**
   - Manual replacement required for template variables
   - Use find/replace for `{{DOMAIN_NAME}}` and `{{domain_name}}`

3. **Validation Failures**
   - Run validation with verbose output
   - Check missing files or incorrect structure
   - Review error messages for specific issues

4. **Environment Setup Issues**
   - Run setup script with diagnostics
   - Check Nix installation and shell configuration
   - Verify Rust toolchain in Nix shell

### Debug Mode
Enable debug logging:

```bash
# Set debug environment variable
export CLAUDE_SKILLS_DEBUG=true

# Run validation with verbose output
npx tsx skills/effect-ts-7layer-architecture/validation/architecture-check.ts MyDomain --verbose

# Run setup with diagnostics
./skills/holochain-development/scripts/setup-holochain-dev.sh --diagnose
```

## Performance Optimization

### Efficient Skill Usage
1. **Be Specific**: Ask for exactly what you need
2. **Use Progressive Loading**: Start with high-level, then dive deep
3. **Cache Results**: Reuse generated code and configurations
4. **Batch Operations**: Group related requests

### Caching Strategy
```typescript
// skills/cache.ts
export class SkillCache {
  private cache = new Map<string, any>();

  get(key: string) {
    return this.cache.get(key);
  }

  set(key: string, value: any) {
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}
```

## Migration Guide

### From Traditional Development
1. **Analyze Current Structure**: Use validation tools to assess current state
2. **Migrate Incrementally**: Start with one domain or component
3. **Follow Patterns**: Use templates to ensure consistency
4. **Test Thoroughly**: Validate each migration step

### From Other Frameworks
1. **Map Concepts**: Relate existing patterns to Effect-TS/Holochain
2. **Preserve Business Logic**: Focus on architectural transformation
3. **Leverage Templates**: Use provided templates for consistency
4. **Gradual Adoption**: Mix traditional and new patterns during transition

## Customization Examples

### Project-Specific Domain Template
```typescript
// skills/templates/custom-domain.template.ts
export const createCustomService = (domainName: string, customConfig: CustomConfig) => `
// Custom service for ${domainName}
export interface ${domainName}Service {
  // Standard methods from Effect-TS Architecture Skill
  readonly create${domainName}: (input: Create${domainName}Input) => E.Effect<Record, ${domainName}Error>;

  // Custom methods based on project needs
  ${customConfig.customMethods}
}
`;
```

### Custom Validation Rules
```typescript
// skills/validation/custom-rules.ts
export const validateCustomRequirements = (domainName: string) => {
  // Add project-specific validation logic
  console.log(`Validating custom requirements for ${domainName}`);

  // Check custom naming conventions
  // Validate security requirements
  // Verify performance standards
};
```

## Support and Community

### Getting Help
1. **Documentation**: Check comprehensive skill documentation
2. **Validation**: Use built-in validation tools
3. **Examples**: Study working examples from the project
4. **Community**: Share experiences and solutions

### Contributing Back
1. **Improvements**: Share useful customizations
2. **Templates**: Contribute project-specific templates
3. **Validation**: Add new validation rules
4. **Documentation**: Improve integration guides

---

This integration guide helps you get the most value from Claude Skills in your Holochain development workflow.