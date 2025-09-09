# Environment Setup

Comprehensive guide for setting up development environment, Nix configuration, and documentation standards.

## Nix Development Environment

### Core Nix Setup

The project uses Nix for reproducible development environments, particularly for Holochain development. The Nix environment ensures consistent toolchain versions across all development machines.

```nix
# flake.nix - Development environment specification
{
  description = "Requests and Offers hApp Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    holochain-flake.url = "github:holochain/holochain";
    holochain-flake.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, holochain-flake }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          holochain = holochain-flake.packages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # Holochain development tools
              holochain.holochain
              holochain.lair-keystore
              holochain.hc

              # Rust toolchain
              rustc
              cargo
              rustfmt
              clippy

              # Node.js ecosystem
              nodejs_20
              bun

              # Development utilities
              git
              jq
              curl
              which
            ];

            shellHook = ''
              echo "🧬 Holochain Development Environment Ready"
              echo "📦 Available tools:"
              echo "  - holochain: $(holochain --version)"
              echo "  - hc: $(hc --version)"
              echo "  - rustc: $(rustc --version)"
              echo "  - node: $(node --version)"
              echo "  - bun: $(bun --version)"

              # Set environment variables
              export RUST_LOG=warn
              export HC_APP_PORT=8888
              export ADMIN_PORT=4444

              # Create necessary directories
              mkdir -p .hc
              mkdir -p logs

              echo "🚀 Run 'bun start' to begin development"
            '';
          };
        });
    };
}
```

### Environment Activation

```bash
# Enter Nix development environment
nix develop

# Alternative: Use direnv for automatic activation
echo "use flake" > .envrc
direnv allow
```

### Nix Environment Validation

```typescript
// Validate Nix environment setup
export const validateNixEnvironment = Effect.gen(function* () {
  const requiredTools = [
    "holochain",
    "hc",
    "lair-keystore",
    "rustc",
    "cargo",
    "node",
    "bun",
  ];

  const toolVersions = yield* Effect.all(
    requiredTools.map((tool) =>
      Effect.gen(function* () {
        const version = yield* Effect.tryPromise(() =>
          exec(`${tool} --version`).then((result) => result.stdout.trim()),
        );
        return { tool, version, available: true };
      }).pipe(
        Effect.catchAll(() =>
          Effect.succeed({ tool, version: null, available: false }),
        ),
      ),
    ),
    { concurrency: "unbounded" },
  );

  const missingTools = toolVersions.filter((t) => !t.available);

  if (missingTools.length > 0) {
    return yield* Effect.fail(
      new EnvironmentError({
        message: "Required tools not available in Nix environment",
        missingTools: missingTools.map((t) => t.tool),
      }),
    );
  }

  return {
    status: "valid",
    tools: toolVersions,
    recommendations: generateEnvironmentRecommendations(toolVersions),
  };
});
```

## Development Environment Configuration

### VS Code Integration

```json
// .vscode/settings.json - Project-specific VS Code settings
{
  "rust-analyzer.server.path": "rust-analyzer",
  "rust-analyzer.cargo.target": null,
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.rustfmt.overrideCommand": ["rustfmt", "--edition", "2021"],

  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifierEnding": "index",
  "typescript.suggest.autoImports": true,

  "svelte.enable-ts-plugin": true,
  "svelte.plugin.typescript.enable": true,
  "svelte.plugin.typescript.diagnostics.enable": true,

  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },

  "files.associations": {
    "*.md": "markdown"
  },

  "search.exclude": {
    "**/node_modules": true,
    "**/target": true,
    "**/.hc": true,
    "**/dist": true
  }
}
```

### Environment Variables

```bash
# .env.development - Development environment variables
# Holochain Configuration
HC_APP_PORT=8888
ADMIN_PORT=4444
BOOTSTRAP_URL=https://bootstrap.holo.host
SIGNALING_URL=wss://signal.holo.host

# Application Configuration
NODE_ENV=development
VITE_APP_TITLE="Requests and Offers - Development"
VITE_HOLOCHAIN_APP_PORT=8888
VITE_HOLOCHAIN_ADMIN_PORT=4444

# Development Features
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_DATA_ENABLED=true
VITE_DEBUG_MODE=true

# Logging
RUST_LOG=warn
VITE_LOG_LEVEL=debug
```

### Git Configuration

```bash
# .gitignore - Development artifacts to ignore
# Holochain
.hc/
*.dna
*.happ
*.lock

# Rust
target/
Cargo.lock

# Node.js
node_modules/
dist/
.env.local
.env.production

# IDE
.vscode/settings.json.local
.idea/

# Logs
logs/
*.log

# Development
.direnv/
result
result-*
```

## Documentation Standards

### Documentation Structure Requirements

1. **Consistent Formatting**: All markdown files follow standardized structure
2. **Cross-References**: Internal links validated and maintained
3. **Code Examples**: Working, tested code snippets with explanations
4. **Accessibility**: Clear headings, alt text for images, descriptive links
5. **Maintenance**: Regular updates and link validation

### Markdown Standards

````markdown
# Document Title

Brief description of the document's purpose and scope.

## Section Structure

### Subsection Pattern

- Use sentence case for headings
- Include brief introductory content for each section
- Provide context before diving into details

### Code Examples

```typescript
// Always include comments explaining the code
export const exampleFunction = (input: ExampleInput) =>
  Effect.gen(function* () {
    // Step-by-step explanation of what's happening
    const result = yield* processInput(input);
    return result;
  });
```
````

### Cross-References

- Use relative links for internal documentation: `[Architecture](../architecture.md)`
- Include context for external links: `[Holochain Documentation](https://developer.holochain.org/)`
- Verify all links during documentation updates

## Implementation Notes

Document any specific implementation details, gotchas, or important considerations.

## Related Documentation

- List related documents with brief descriptions
- Include links to relevant API documentation
- Reference any external resources

````

### Documentation Generation

```typescript
// Automated documentation generation and validation
export const generateDocumentation = (sourceFiles: string[]) =>
  Effect.gen(function* () {
    // 1. Parse source files for documentation
    const docSections = yield* Effect.all(
      sourceFiles.map(parseDocumentationFromSource),
      { concurrency: "unbounded" }
    );

    // 2. Generate API documentation
    const apiDocs = yield* generateApiDocumentation(docSections);

    // 3. Create cross-references
    const crossRefs = yield* generateCrossReferences(docSections);

    // 4. Validate links and references
    const validationResults = yield* validateDocumentationLinks(apiDocs, crossRefs);

    // 5. Generate table of contents
    const tableOfContents = yield* generateTableOfContents(apiDocs);

    return {
      apiDocumentation: apiDocs,
      crossReferences: crossRefs,
      tableOfContents,
      validation: validationResults,
      generatedAt: new Date()
    };
  });

// Documentation maintenance workflow
export const maintainDocumentation = Effect.gen(function* () {
  // 1. Check for outdated documentation
  const outdatedDocs = yield* identifyOutdatedDocumentation();

  // 2. Validate all internal links
  const brokenLinks = yield* validateInternalLinks();

  // 3. Check code examples
  const invalidExamples = yield* validateCodeExamples();

  // 4. Update changelog and version info
  const versionInfo = yield* updateVersionInformation();

  return {
    maintenance: {
      outdatedDocs: outdatedDocs.length,
      brokenLinks: brokenLinks.length,
      invalidExamples: invalidExamples.length
    },
    actions: {
      linksFixed: brokenLinks.length,
      examplesUpdated: invalidExamples.length,
      docsRefreshed: outdatedDocs.length
    },
    version: versionInfo
  };
});
````

### Documentation Testing

```typescript
// Test documentation for accuracy and completeness
export const testDocumentation = Effect.gen(function* () {
  // 1. Test all code examples
  const codeExampleResults = yield* testAllCodeExamples();

  // 2. Validate API documentation matches implementation
  const apiValidation = yield* validateApiDocumentation();

  // 3. Check documentation coverage
  const coverageAnalysis = yield* analyzeDocumentationCoverage();

  // 4. Validate cross-references
  const referenceValidation = yield* validateCrossReferences();

  return {
    codeExamples: {
      total: codeExampleResults.length,
      passing: codeExampleResults.filter((r) => r.status === "pass").length,
      failing: codeExampleResults.filter((r) => r.status === "fail").length,
    },
    apiDocumentation: {
      accuracy: apiValidation.accuracyScore,
      coverage: apiValidation.coveragePercentage,
      outdatedSections: apiValidation.outdatedSections,
    },
    coverage: {
      overall: coverageAnalysis.overallPercentage,
      byModule: coverageAnalysis.moduleBreakdown,
    },
    references: {
      valid: referenceValidation.validLinks,
      broken: referenceValidation.brokenLinks,
      external: referenceValidation.externalLinks,
    },
  };
});
```

## Environment Troubleshooting

### Common Issues and Solutions

```typescript
// Automated environment troubleshooting
export const troubleshootEnvironment = Effect.gen(function* () {
  const issues = [];

  // Check Nix environment
  const nixStatus = yield* checkNixEnvironment();
  if (!nixStatus.valid) {
    issues.push({
      type: "nix",
      message: "Nix environment not properly activated",
      solution: "Run `nix develop` in project root",
    });
  }

  // Check Holochain services
  const holochainStatus = yield* checkHolochainServices();
  if (!holochainStatus.running) {
    issues.push({
      type: "holochain",
      message: "Holochain conductor not running",
      solution: "Run `bun start` to start the development environment",
    });
  }

  // Check port availability
  const portStatus = yield* checkPortAvailability([8888, 4444]);
  portStatus.unavailable.forEach((port) => {
    issues.push({
      type: "port",
      message: `Port ${port} is not available`,
      solution: `Kill process using port ${port} or change configuration`,
    });
  });

  return {
    status: issues.length === 0 ? "healthy" : "issues",
    issues,
    recommendations: generateTroubleshootingRecommendations(issues),
  };
});
```

This comprehensive environment setup guide ensures consistent, reproducible development environments while maintaining high documentation standards throughout the project.
