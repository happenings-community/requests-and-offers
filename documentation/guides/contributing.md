# Contributing Guide

Thank you for your interest in contributing to the Requests & Offers project! This guide will help you get started with contributing to our codebase.

## Code of Conduct

Please read and follow our Code of Conduct to maintain a welcoming and inclusive environment for all contributors.

## Getting Started

1. Fork the [repository](https://github.com/Happening-Community/requests-and-offers)
2. Clone your fork
3. Set up the development environment following our [Installation Guide](./installation.md)

## Development Workflow

### 1. Branches

- `main`: Production-ready code
- `develop`: Main development branch
- Feature branches: `feature/your-feature-name`
- Bug fix branches: `fix/bug-description`

### 2. Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```text
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

Scopes:

- `ui`: Frontend changes
- `users`: Users Organizations feature
- `admin`: Administration feature
- `requests`: Requests feature
- `organizations`: Organizations feature
- `offers`: Offers feature
- `status`: Status module
- `test`: Test infrastructure
- `build`: Build system changes

### 3. Pull Requests

1. Create a new branch for your changes
2. Make your changes
3. Write or update tests
4. Update documentation
5. Submit a pull request to the `dev` branch

### 4. Development Standards

#### Code Style

- Follow Rust style guidelines for zomes
- Use SvelteKit best practices for frontend
- Maintain consistent code formatting
- All code contributions must adhere to the most possible to the standards outlined in `.windsurfrules` and the specific rule files within `.cursor/rules/`.
- To suggest code style changes, please open a GitHub issue or pull request labeled `suggestion`.

#### Testing

- Write unit tests for zome functions
- Include integration tests for complex features
- Test frontend components
- Verify documentation accuracy

#### Documentation

- Update relevant documentation
- Include code examples
- Maintain cross-references
- Follow documentation structure

#### Feature Development Workflow

We follow a systematic approach to feature development that ensures proper testing and integration at each level.

##### Step 1: DNA Development

1. **Zome Planning**
   - Define entry types and validation rules
   - Plan link types and their relationships
   - Document expected behaviors

2. **Zome Implementation**

   ```rust
   // Example: New entry type in integrity zome
   #[hdk_entry_helper]
   pub struct NewFeature {
       pub field1: String,
       pub field2: Vec<String>,
   }

   // Coordinator zome function
   #[hdk_extern]
   pub fn create_new_feature(input: NewFeature) -> ExternResult<Record> {
       // Implementation
   }
   ```

3. **DNA Testing with Tryorama**

   ```typescript
   // tests/src/requests_and_offers/new_feature.test.ts
   test("should create new feature", async () => {
     const client = await player1.client();
     const result = await createNewFeature(client, {
       field1: "test",
       field2: ["value1", "value2"],
     });
     t.ok(result);
   });
   ```

##### Step 2: Service Layer

1. **Holochain Service**

   ```typescript
   // ui/src/services/zomes/new-feature.service.ts
   export class NewFeatureService {
     constructor(private client: AppAgentClient) {}

     async createNewFeature(input: NewFeature): Promise<Record> {
       return await this.client.callZome({
         zome_name: "new_feature",
         fn_name: "create_new_feature",
         payload: input,
       });
     }
   }
   ```

2. **Store Implementation**

   ```typescript
   // ui/src/stores/new-feature.store.ts
   export const newFeatureStore = writable<NewFeature[]>([]);

   export const createNewFeature = async (input: NewFeature) => {
     const result = await service.createNewFeature(input);
     newFeatureStore.update((features) => [...features, result]);
     return result;
   };
   ```

##### Step 3: UI Implementation

1. **Components**

   ```svelte
   <!-- ui/src/lib/components/NewFeature.svelte -->
   <script lang="ts">
     import { newFeatureStore, createNewFeature } from '$lib/stores/new-feature.store';

     async function handleSubmit(event) {
       const result = await createNewFeature({
         field1: event.detail.value,
         field2: event.detail.options,
       });
     }
   </script>
   ```

2. **Pages**

   ```svelte
   <!-- ui/src/routes/new-feature/+page.svelte -->
   <script lang="ts">
     import NewFeature from '$lib/components/NewFeature.svelte';
   </script>

   <NewFeature />
   ```

##### Development Order

1. **DNA First**
   - Implement and test entry types
   - Create and verify zome functions
   - Write comprehensive Tryorama tests

2. **Services and Stores (Parallel)**
   - Create Holochain service methods
   - Implement store with state management
   - Add store actions and subscriptions

3. **UI Components**
   - Develop reusable components
   - Create feature pages
   - Implement user interactions

##### Testing Strategy

1. **DNA Testing**

   ```bash
   # Test specific feature
   bun test:new-feature

   # Run all tests
   bun test
   ```

2. **UI Testing**

   ```bash
   # Component tests
   bun test:ui

   # E2E tests (if applicable)
   bun test:e2e
   ```

3. **Manual Testing**
   - Start development environment
   - Test with multiple agents
   - Verify all user flows

##### Documentation

1. **DNA Documentation**
   - Update zome documentation
   - Document entry and link types
   - Add usage examples

2. **Frontend Documentation**
   - Document services and stores
   - Add component documentation
   - Update user guides

3. **Testing Documentation**
   - Document test scenarios
   - Add test data examples
   - Update test instructions

## Project Structure

### Frontend (`ui/`)

- SvelteKit application
- Component documentation
- UI/UX guidelines

### Backend (`dnas/requests_and_offers/zomes/`)

- Users Organizations Zome
  - User management
  - Organization handling
- Administration Zome
  - System administration
  - Status management

### Documentation (`documentation/`)

- Technical specifications
- User guides
- API documentation
- Development guides

## Getting Help

- Join our [Community](https://happenings.community/)
- Ask questions on [Discord](https://discord.gg/happening)
- Check [GitHub Issues](https://github.com/Happening-Community/requests-and-offers/issues)
- Review [Technical Documentation](../technical-specs.md) & [Architecture](../architecture.md)

### Development Support

- Check [Zome Documentation](../technical-specs/zomes/README.md)
- Follow [Feature Development](./contributing.md#feature-development-workflow)
