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

- `dev`: the default branch and the integration target. Every pull request goes here.
- `main`: release promotions only. `dev` is merged into `main` when a version ships, and the tag is cut there. See the [Release Checklist](../RELEASE_CHECKLIST.md).
- Working branches take the commit type as their prefix: `feat/`, `fix/`, `docs/`, `test/`, `chore/`, `refactor/`, `ci/`, followed by a short slug.

There is no `develop` branch. This guide named one until September 2026 and no such branch is in the repository.

#### Branch protection

`dev` is covered by one repository ruleset, **No deletion or force push** (id `2344243`), active and scoped to the default branch. It enforces exactly two things:

- the branch cannot be deleted
- the branch cannot be force pushed (no non fast-forward update)

Nothing else is enforced anywhere. There is no required review, no required status check and no linear-history rule, on `dev` or on `main`, and `main` carries no rules at all. A green pipeline followed by a merge is a human decision here, not a gate the forge holds. Organization admins bypass the ruleset.

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

Opening the pull request runs the fast checks automatically: type check, the front-end unit suite, a lint report, and a zome build that packs the hApp. They take two to three minutes. See [Continuous Integration](continuous-integration.md) for what each job does and how to run the same checks locally.

The heavy suites do not run automatically. If your change touches the zomes or a user journey, add the `run:sweettest`, `run:e2e` or `run:heavy` label to your pull request and the suite runs against it. The label comes off by itself, so re-applying it runs the suite again.

#### Draft or in review

A pull request is either a draft or in review, never both at once. Open it as a draft while you are still working on it, and mark it ready for review only when you would be content to see it merged as it stands. If review turns up work you need to do, put it back to draft until that work is done. A pull request in review is one the reviewer may merge at any moment, so nothing still in progress belongs there.

Drafts are unlimited. The review queue is capped at 3 pull requests per person, and the board's In Review column at 6, because that column counts issues and pull requests together.

#### Reviewers, and who merges

Every pull request in review names its reviewer, by requesting that person's review on GitHub. **The reviewer merges.** The reviewer is the one who decides the change is good enough, so merge authority stays with them and nobody has to ask who presses the button.

Self-review is allowed for a low-risk change, such as a pinned version, a CI setting or a documentation fix, but it is never assumed: say in the pull request that you are reviewing it yourself. Anything that changes behaviour, a zome, or the DNA hash gets a second person.

#### What a review checks

- **Documentation.** A change in behaviour updates the documentation that describes it, in the same pull request. A pull request that changes what the app does and no page under `documentation/` is incomplete.
- **Tests.** A fix carries a regression test that fails without it. A feature carries unit or end-to-end coverage for what it adds. A Sweettest file only runs in CI if its target is listed in the `sweettest` matrix of `.github/workflows/tests-manual.yml`, so a new test file adds its line there too.
- **The pipeline.** The fast checks are green, and the heavy suites have run when the change touches the zomes or a user journey.

#### Whose turn it is

A pull request is stale by whose turn it is to respond, not by its age. The last comment, the review state, and whether the last word came from the reviewer or the author decide whose court it is in. A pull request with changes requested waits on its author; one whose author has answered waits on its reviewer.

#### Merge method

Squash and merge is the default: one pull request becomes one conventional commit on `dev`. Use rebase and merge instead when every commit in the pull request builds, passes, and stands on its own, so that one of them could be reverted alone. The reviewer picks the method when merging; making the commits worth keeping is the author's job.

#### Lanes and commitment

Board lanes are thematic. @Soushi888 owns exchange and hREA, @AlchemicalSpiralizer owns stewarding, onboarding and administration, and the Either lane holds items nobody owns yet. Commitment is expressed by the GitHub assignee, not by labels: the `lane:*` labels were removed on 3 September 2026 and are not coming back. The board is [Requests and Offers hApp MVP](https://github.com/orgs/happenings-community/projects/2).

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

3. **DNA Testing with Sweettest**

   ```rust
   // tests/sweettest/tests/new_feature.rs
   #[tokio::test(flavor = "multi_thread")]
   async fn basic_new_feature_crud() {
       let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;
       conductors[0]
           .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
           .await;
       await_consistency(15, [&alice, &bob]).await.unwrap();

       let record: Record = conductors[0]
           .call(&alice.zome("new_feature"), "create_new_feature", sample_new_feature())
           .await;
       assert!(record.signed_action.hashed.hash.get_raw_39().len() > 0);
   }
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
   - Write comprehensive Sweettest tests

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
