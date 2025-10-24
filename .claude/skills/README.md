# Claude Skills for Holochain Development

## Overview

This directory contains three comprehensive Claude Skills designed to accelerate and standardize Holochain hApp development using the proven patterns from the Requests and Offers project. These skills cover the complete development lifecycle from architecture to deployment.

## Available Skills

### 1. Effect-TS 7-Layer Architecture Skill
**Purpose**: Package the sophisticated 7-layer Effect-TS architecture pattern used across 8 domains
**Location**: `./effect-ts-7layer-architecture/`
**Best For**: New domain implementation, architectural consistency, development velocity

### 2. Holochain Development Skill
**Purpose**: Complete Holochain development expertise from DNA to testing
**Location**: `./holochain-development/`
**Best For**: Environment setup, zome development, testing infrastructure

### 3. Deployment Automation Skill
**Purpose**: Complete deployment system with multi-repository coordination and CI/CD automation
**Location**: `./deployment/`
**Best For**: Release management, cross-platform deployment, production operations

## Quick Start

### Using Skills with Claude Code

These skills are designed to work with Claude's Skills system:

1. **Auto-discovery**: Claude automatically detects relevant skills based on context
2. **Progressive loading**: Only loads what's needed for the current task
3. **Composable**: Skills work together for complex workflows

### Integration with Your Project

#### For New Development
```bash
# Start a new Holochain project
mkdir my-holochain-app
cd my-holochain-app

# Use the skills to set up the environment
# Claude will automatically load the Holochain Development Skill

# Create a new domain using the Effect-TS patterns
# Claude will automatically load the Effect-TS Architecture Skill
```

#### For Existing Projects
```bash
# Add to existing Holochain project
cd your-existing-project

# Create skills directory in .claude
mkdir -p .claude/skills

# Copy skills to your project
cp -r path/to/requests-and-offers/.claude/skills/* .claude/skills/

# Skills are now available for Claude to use
```

#### Skill Location
**Project-based skills** should be placed in:
```
.claude/skills/
├── README.md
├── INTEGRATION_GUIDE.md
├── effect-ts-7layer-architecture/
└── holochain-development/
```

This follows the official Claude Skills documentation for project-based skills.

## Skill Contents

### Effect-TS 7-Layer Architecture Skill
```
effect-ts-7layer-architecture/
├── SKILL.md                    # Main documentation and patterns
├── templates/                  # Code templates for rapid development
│   ├── service.template.ts     # Service layer template
│   └── store.template.ts       # Store layer template with 9 helpers
├── examples/                   # Real examples from the project
└── validation/                 # Architecture validation tools
    └── architecture-check.ts   # Validates 7-layer implementation
```

### Holochain Development Skill
```
holochain-development/
├── SKILL.md                    # Complete Holochain development guide
├── templates/                  # Zome and DNA templates
│   └── integrity-zome.template.rs
├── examples/                   # Working examples
├── scripts/                    # Automation scripts
│   └── setup-holochain-dev.sh  # Complete environment setup
└── troubleshooting/            # Common issues and solutions
```

### Deployment Automation Skill
```
deployment/
├── SKILL.md                    # Comprehensive deployment automation guide
├── templates/                  # Deployment templates and configs
│   ├── release-checklist.md    # Proven 570-line checklist
│   ├── github-workflows/       # CI/CD template patterns
│   │   └── release.template.yaml
│   ├── kangaroo-config.template.ts
│   └── deployment-config.template.json
├── scripts/                    # Automation scripts
│   ├── pre-flight-check.sh     # Environment validation
│   ├── release-orchestrator.sh # 7-step release automation
│   ├── build-verification.sh   # Cross-platform build validation
│   └── rollback-procedures.sh  # Emergency rollback automation
├── troubleshooting/            # Common issues and proven solutions
│   ├── asset-upload-failures.md
│   ├── ci-cd-debugging.md
│   └── repository-sync-issues.md
└── examples/                   # Real-world deployment examples
    ├── v0.1.9-success-case.md
    └── platform-specific-configs/
        └── production-setup-examples.md
```

## Usage Examples

### Example 1: Creating a New Domain
**User Request**: "Create a new Reviews domain with ratings and comments"

**Claude's Response** (using both skills):
1. **Effect-TS Architecture Skill** provides:
   - Service interface template
   - Store implementation with 9 helper functions
   - Schema definitions
   - Error handling patterns

2. **Holochain Development Skill** provides:
   - Integrity zome structure
   - Coordinator zome implementation
   - Testing patterns
   - DNA configuration

### Example 2: Setting Up Development Environment
**User Request**: "Set up a new Holochain development environment"

**Claude's Response** (using Holochain Development Skill):
1. Runs the setup script automatically
2. Installs Nix, Rust, Bun, and Holochain tools
3. Configures project structure
4. Sets up git hooks and development scripts

### Example 3: Debugging Architecture Issues
**User Request**: "My new domain isn't following the established patterns"

**Claude's Response** (using Effect-TS Architecture Skill):
1. Runs architecture validation script
2. Identifies missing components
3. Provides specific fixes
4. Generates code templates for missing parts

### Example 4: Complete Release Deployment
**User Request**: "Deploy version 0.2.0 with all platforms and documentation"

**Claude's Response** (using Deployment Automation Skill):
1. Runs pre-flight validation checks
2. Executes 7-step proven release process
3. Monitors cross-platform CI/CD builds
4. Updates all repositories with release assets
5. Generates comprehensive release notes
6. Provides download statistics and validation

### Example 5: Emergency Deployment Fix
**User Request**: "The macOS build failed to upload assets, need urgent fix"

**Claude's Response** (using Deployment Automation Skill):
1. Applies proven asset upload fixes
2. Uses wildcard file discovery patterns
3. Implements manual GitHub CLI upload strategy
4. Verifies cross-platform build success
5. Updates release documentation with working links

### Example 6: Environment Setup for New Team Member
**User Request**: "Set up deployment environment for a new developer"

**Claude's Response** (using Deployment Automation Skill):
1. Validates GitHub CLI authentication
2. Configures git submodule access
3. Sets up Nix environment for builds
4. Verifies all deployment prerequisites
5. Provides test deployment scenario

## Integration with Existing Tooling

### With Package.json Scripts
```json
{
  "scripts": {
    "skill:validate-architecture": "tsx .claude/skills/effect-ts-7layer-architecture/validation/architecture-check.ts MyDomain",
    "skill:setup-dev": "./.claude/skills/holochain-development/scripts/setup-holochain-dev.sh",
    "skill:create-domain": "./scripts/create-domain.sh",
    "skill:deploy": "./.claude/skills/deployment/scripts/release-orchestrator.sh",
    "skill:deploy-validate": "./.claude/skills/deployment/scripts/build-verification.sh",
    "skill:deploy-rollback": "./.claude/skills/deployment/scripts/rollback-procedures.sh",
    "skill:preflight": "./.claude/skills/deployment/scripts/pre-flight-check.sh"
  }
}
```

### With VS Code / Cursor
- Skills automatically provide context-aware code completion
- Architecture validation highlights issues in real-time
- Templates are available as snippets

### With CI/CD Pipeline
```yaml
# Example GitHub Actions integration
- name: Validate Architecture
  run: bun run skill:validate-architecture

- name: Setup Development Environment
  run: bun run skill:setup-dev
```

## Best Practices

### For Maximum Benefit

1. **Use Both Skills Together**: They're designed to complement each other
2. **Follow Templates**: Start with provided templates for consistency
3. **Run Validation**: Use architecture validation regularly
4. **Customize Thoughtfully**: Adapt patterns to your specific needs
5. **Contribute Back**: Share improvements with the community

### When to Use Which Skill

| Situation | Primary Skill | Secondary Skill |
|-----------|---------------|-----------------|
| New project setup | Holochain Development | - |
| New domain implementation | Effect-TS Architecture | Holochain Development |
| Debugging architecture | Effect-TS Architecture | - |
| Testing issues | Holochain Development | Effect-TS Architecture |
| Performance optimization | Both | Both |
| Code review | Both | Both |
| Release deployment | Deployment Automation | Effect-TS Architecture |
| CI/CD setup | Deployment Automation | Holochain Development |
| Production operations | Deployment Automation | Both |
| Emergency rollback | Deployment Automation | - |
| Cross-platform builds | Deployment Automation | Holochain Development |

## Customization

### Adapting Skills to Your Project

1. **Modify Templates**: Adjust templates to match your project's conventions
2. **Extend Validation**: Add custom validation rules
3. **Add Examples**: Include your own success stories
4. **Update Scripts**: Adapt automation scripts to your workflow

### Creating Project-Specific Skills

Use these skills as templates for your own project-specific skills:

```bash
# Copy and customize
cp -r .claude/skills/effect-ts-7layer-architecture .claude/skills/my-project-architecture

# Update the skill metadata
vim .claude/skills/my-project-architecture/SKILL.md

# Add project-specific templates and examples
```

## Troubleshooting

### Common Issues

1. **Skill Not Loading**: Ensure SKILL.md has proper YAML frontmatter
2. **Templates Not Working**: Check file paths and permissions
3. **Validation Errors**: Run validation script for detailed diagnostics
4. **Environment Issues**: Use the setup script to verify installation

### Getting Help

1. **Check Documentation**: Each skill has comprehensive documentation
2. **Run Validation**: Use built-in validation tools
3. **Review Examples**: Study working examples from the project
4. **Ask Claude**: Claude can use the skills to help debug issues

## Contributing

### How to Contribute

1. **Report Issues**: Document bugs or improvement requests
2. **Share Templates**: Contribute useful templates and patterns
3. **Update Documentation**: Keep documentation current
4. **Test Thoroughly**: Ensure changes work with both skills

### Contribution Guidelines

- Follow existing code patterns
- Include comprehensive documentation
- Add tests for new functionality
- Update examples and validation

## Performance Impact

### Resource Usage

- **Progressive Loading**: Only loads necessary components
- **Efficient Caching**: Reuses loaded components across sessions
- **Minimal Overhead**: Optimized for fast response times

### Best Practices for Performance

1. **Specific Requests**: Ask for exactly what you need
2. **Context Awareness**: Skills load based on current context
3. **Incremental Loading**: Complex content loads progressively
4. **Smart Caching**: Reuse existing skill components

## Future Roadmap

### Planned Enhancements

1. **Additional Skills**: More specialized skills for specific use cases
2. **AI-Generated Templates**: Dynamic template generation
3. **Enhanced Validation**: More sophisticated architecture analysis
4. **Integration Tools**: Better IDE and CI/CD integration
5. **Community Skills**: Framework for community-contributed skills

### Long-term Vision

Create a comprehensive skill ecosystem for Holochain development that:
- Accelerates development by 70%+
- Ensures architectural consistency
- Reduces onboarding time dramatically
- Scales with project complexity
- Serves as knowledge preservation

## License

These skills are provided under the same license as the Requests and Offers project. Feel free to:
- Use in your projects
- Customize for your needs
- Share with the community
- Contribute improvements

## Support

For support with these skills:
1. Check the comprehensive documentation in each skill
2. Use the validation tools for diagnostics
3. Study the working examples from the project
4. Ask Claude - it can use these skills to help you

---

**Happy coding with Claude Skills! 🚀**