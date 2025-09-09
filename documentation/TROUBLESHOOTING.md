# Troubleshooting Guide

Comprehensive troubleshooting guide for common issues in the Requests and Offers project development.

## 🚨 Common Issues

### Environment Setup Issues

#### **Issue**: Nix environment not activating properly

```bash
# Error: command not found: holochain
```

**Solutions**:

```bash
# 1. Ensure you're in the project root
cd requests-and-offers

# 2. Activate Nix environment manually
nix develop

# 3. Verify tools are available
which holochain && which hc && which rustc

# 4. If using direnv (optional)
echo "use flake" > .envrc
direnv allow
```

**Verification**:

```bash
# Check all required tools
holochain --version    # Should show Holochain version
hc --version           # Should show hc CLI version
rustc --version        # Should show Rust compiler version
bun --version          # Should show Bun version
```

#### **Issue**: Port conflicts when starting development

```bash
# Error: Port 8888 is already in use
```

**Solutions**:

```bash
# 1. Kill processes using the ports
lsof -ti:8888 | xargs kill -9    # Kill process on port 8888
lsof -ti:4444 | xargs kill -9    # Kill process on port 4444

# 2. Find what's using the port
lsof -i :8888                    # Show process using port 8888

# 3. Use different ports (temporary)
HC_APP_PORT=8889 ADMIN_PORT=4445 bun start

# 4. Check for running Holochain processes
ps aux | grep holochain
ps aux | grep lair-keystore
```

### Build Issues

#### **Issue**: Zome compilation failures

```bash
# Error: failed to compile Rust zomes
```

**Solutions**:

```bash
# 1. Ensure you're in Nix environment
nix develop

# 2. Clean build artifacts
rm -rf target/
rm -rf dnas/requests_and_offers/target/

# 3. Rebuild zomes
bun build:zomes

# 4. Check Rust toolchain
rustc --version
cargo --version

# 5. Update dependencies if needed
cd dnas/requests_and_offers
cargo update
```

#### **Issue**: Frontend build failures

```bash
# Error: TypeScript compilation errors
```

**Solutions**:

```bash
# 1. Check TypeScript configuration
cd ui
bun run check

# 2. Clear node_modules and reinstall
rm -rf node_modules
rm -f bun.lockb
bun install

# 3. Fix TypeScript errors
bun run lint --fix

# 4. Verify SvelteKit configuration
cat svelte.config.js
```

### Testing Issues

#### **Issue**: Unit tests failing with hREA integration errors

```bash
# Error: Cannot find hREA DNA
```

**Solutions**:

```bash
# 1. Use autonomous test execution (RECOMMENDED)
nix develop --command bun test:unit

# 2. Ensure hREA DNA is downloaded
bun run download-hrea

# 3. Verify Nix environment is active
echo $IN_NIX_SHELL    # Should output "1" or "impure"

# 4. Check hREA DNA location
ls -la dnas/hrea/     # Should contain DNA files
```

#### **Issue**: Tryorama tests failing

```bash
# Error: Conductor startup failed
```

**Solutions**:

```bash
# 1. Ensure Nix environment
nix develop

# 2. Clean previous conductor state
rm -rf .hc/
rm -rf /tmp/holochain_*

# 3. Build zomes first
bun build:zomes

# 4. Run specific test
cd tests
bun test -- --test-name-pattern="service_types"

# 5. Check conductor logs
ls -la logs/
tail -f logs/conductor.log
```

### Development Workflow Issues

#### **Issue**: Effect-TS service not working properly

```typescript
// Error: Service not found in context
```

**Solutions**:

```typescript
// 1. Ensure service is properly tagged
export const MyService = Context.GenericTag<MyService>("MyService");

// 2. Create service layer
export const MyServiceLive = Layer.effect(MyService, makeMyService);

// 3. Provide service in component/store
Effect.provide(MyServiceLive);

// 4. Verify dependency injection
const service = yield * MyService; // Should not throw
```

#### **Issue**: Svelte store not updating reactively

```javascript
// Store state not updating UI
```

**Solutions**:

```javascript
// 1. Ensure using Svelte 5 runes correctly
let entities = $state([]); // Not: let entities = [];

// 2. Update state immutably
entities = [...entities, newEntity]; // Not: entities.push(newEntity);

// 3. Check component is using runes
const { entities } = store; // Should use store.entities()

// 4. Verify store factory pattern
export const store = createEntitiesStore(); // Module level
```

### Data Issues

#### **Issue**: Holochain entries not appearing

```bash
# Created entries not visible to other agents
```

**Solutions**:

```bash
# 1. Wait for DHT synchronization
# In tests, use wait_for_integration()

# 2. Check entry validation
# Review integrity zome validation functions

# 3. Verify link creation
# Check if entries are properly linked

# 4. Debug with Holochain Playground
# Open http://localhost:8888 when running bun start
```

#### **Issue**: Schema validation errors

```typescript
// Error: Schema decode failed
```

**Solutions**:

```typescript
// 1. Check schema matches Holochain entry structure
const EntrySchema = Schema.Struct({
  name: Schema.String,
  created_at: Schema.DateFromSelf, // Use DateFromSelf for timestamps
});

// 2. Handle unknown data properly
Schema.decodeUnknown(EntrySchema)(data).pipe(
  Effect.mapError((error) => new ValidationError({ cause: error })),
);

// 3. Add proper error context
Effect.mapError(transformErrorWithContext("ServiceType.Validation"));

// 4. Debug schema issues
console.log("Raw data:", data);
console.log("Schema:", EntrySchema);
```

## 🔧 Development Environment Debugging

### Health Check Script

```bash
#!/bin/bash
# Save as: scripts/health-check.sh

echo "🔍 Development Environment Health Check"
echo "======================================"

# Check Nix environment
if [ -n "$IN_NIX_SHELL" ]; then
    echo "✅ Nix environment: Active"
else
    echo "❌ Nix environment: Not active (run 'nix develop')"
fi

# Check required tools
tools=("holochain" "hc" "lair-keystore" "rustc" "cargo" "node" "bun")
for tool in "${tools[@]}"; do
    if command -v "$tool" &> /dev/null; then
        version=$(${tool} --version 2>/dev/null | head -n1)
        echo "✅ $tool: $version"
    else
        echo "❌ $tool: Not found"
    fi
done

# Check ports
ports=(8888 4444)
for port in "${ports[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        process=$(lsof -Pi :$port -sTCP:LISTEN | tail -n1 | awk '{print $1}')
        echo "⚠️  Port $port: In use by $process"
    else
        echo "✅ Port $port: Available"
    fi
done

# Check project structure
if [ -f "package.json" ] && [ -d "dnas" ] && [ -d "ui" ]; then
    echo "✅ Project structure: Valid"
else
    echo "❌ Project structure: Invalid (not in project root?)"
fi

echo ""
echo "🚀 To start development: bun start"
```

### Environment Reset Script

```bash
#!/bin/bash
# Save as: scripts/reset-env.sh

echo "🔄 Resetting Development Environment"
echo "===================================="

# Kill Holochain processes
echo "Stopping Holochain processes..."
pkill -f holochain
pkill -f lair-keystore

# Clean state directories
echo "Cleaning state directories..."
rm -rf .hc/
rm -rf /tmp/holochain_*
rm -rf logs/

# Clean build artifacts
echo "Cleaning build artifacts..."
rm -rf target/
rm -rf dnas/requests_and_offers/target/
cd ui && rm -rf node_modules && rm -f bun.lockb

# Reinstall dependencies
echo "Reinstalling dependencies..."
cd .. && bun install

# Rebuild zomes
echo "Rebuilding zomes..."
nix develop --command bun build:zomes

echo "✅ Environment reset complete!"
echo "🚀 Run 'bun start' to begin development"
```

## 🧪 Testing Troubleshooting

### Test Debugging Strategies

```typescript
// Debug Effect-TS tests
describe("ServiceType Tests", () => {
  it("should debug service operations", async () => {
    const program = Effect.gen(function* () {
      // Add logging for debugging
      yield* Effect.log("Starting service operation");

      const service = yield* ServiceTypeService;

      // Log intermediate steps
      const input = { name: "Test", description: "Test desc" };
      yield* Effect.log("Input:", input);

      const result = yield* service.createServiceType(input);
      yield* Effect.log("Result:", result);

      return result;
    });

    // Run with detailed error information
    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(TestServiceLayer),
        Effect.tapError((error) => Effect.log("Error occurred:", error)),
      ),
    );

    expect(result.name).toBe("Test");
  });
});
```

### Backend Test Debugging

```rust
// Debug Tryorama tests
#[tokio::test(flavor = "multi_thread")]
async fn debug_service_type_creation() -> anyhow::Result<()> {
    // Enable detailed logging
    std::env::set_var("RUST_LOG", "debug");
    env_logger::init();

    let (conductor, agent, cell) = setup_conductor_test().await?;

    let input = CreateServiceTypeInput {
        name: "Debug Test".to_string(),
        description: Some("Debug description".to_string()),
        tags: vec!["debug".to_string()],
    };

    // Log input data
    println!("Input: {:?}", input);

    let result: Result<ActionHash, _> = conductor
        .call(&cell.zome("service_types_coordinator"), "create_service_type", input)
        .await;

    // Debug result
    match result {
        Ok(hash) => {
            println!("Success: {:?}", hash);
            assert!(!hash.get_raw_39().is_empty());
        }
        Err(e) => {
            println!("Error: {:?}", e);
            panic!("Service type creation failed: {:?}", e);
        }
    }

    Ok(())
}
```

## 🆘 Getting Help

### Internal Resources

- **[Development Guidelines](ai/rules/development-guidelines.md)** - Comprehensive coding patterns
- **[Architecture Patterns](ai/rules/architecture-patterns.md)** - System architecture guidance
- **[Testing Framework](ai/rules/testing-framework.md)** - Testing strategies and patterns
- **[Quick Reference](QUICK_REFERENCE.md)** - Essential commands and workflows

### Community Support

- **Discord**: [Join our community](https://discord.gg/happening) for real-time help
- **GitHub Issues**: [Report bugs and get support](https://github.com/Happening-Community/requests-and-offers/issues)
- **Holochain Documentation**: [Official Holochain docs](https://developer.holochain.org/)
- **Effect-TS Documentation**: [Effect-TS official docs](https://effect.website/)

### Escalation Process

1. **Check this troubleshooting guide** for common solutions
2. **Search existing GitHub issues** for similar problems
3. **Ask in Discord** for community help
4. **Create GitHub issue** with detailed reproduction steps
5. **Tag maintainers** for urgent production issues

---

> **💡 Pro Tip**: Most issues can be resolved by ensuring you're in the Nix environment (`nix develop`) and using the autonomous test command (`nix develop --command bun test:unit`) for hREA-integrated tests.

> **🔍 Debug Mode**: Set `RUST_LOG=debug` and `VITE_LOG_LEVEL=debug` for detailed logging during development.
