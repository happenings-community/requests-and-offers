# Development Features & Testing Utilities Plan

This document outlines the plan for creating a system of development-only features to aid in testing and accelerate the development workflow.

## 1. Core Objectives

- **Centralized Control**: Implement a centralized system for enabling/disabling development features using `.env` files.
- **Developer Experience**: Provide developers and testers with tools to quickly populate forms, test edge cases, and visualize component states without manual data entry.
- **Production Safety**: Ensure that all development-only features, buttons, and utilities are completely stripped from production builds to prevent performance issues and security risks.
- **Consistency**: Standardize the approach for adding new development features across the application.

## 2. Environment Configuration (`.env`)

We will use Vite's built-in support for environment variables to control the feature flags. This is the cornerstone of the system.

- **Create `.env` files**:
  - `.env.development`: For local development. This is where `VITE_DEV_MODE=true` will be set.
  - `.env.test`: For the alpha testers. This will have `VITE_TEST_MODE=true`, which might show a limited set of tools compared to full dev mode.
  - `.env.production`: For production builds. No development-related variables will be set here.

- **Example `.env.development`**:
  ```
  VITE_APP_ENV=development
  VITE_DEV_FEATURES_ENABLED=true
  VITE_MOCK_BUTTONS_ENABLED=true
  ```
- **Example `.env.test`**:
  ```
  VITE_APP_ENV=test
  VITE_DEV_FEATURES_ENABLED=true
  VITE_MOCK_BUTTONS_ENABLED=false 
  ```

- **Access in Code**: These variables will be available in the SvelteKit frontend via `import.meta.env.VITE_...`.

## 3. Proposed Development Features

Based on the UI analysis, here is a list of proposed features.

### 3.1. Mock Buttons in Forms

This is the primary feature requested.

- **Target Forms**:
  - `RequestForm.svelte`
  - `OfferForm.svelte`
  - `OrganizationForm.svelte`
  - `UserForm.svelte`
  - `ServiceTypeForm.svelte`
  - `ServiceTypeSuggestionForm.svelte`
  - `MediumOfExchangeForm.svelte`
  - `MediumOfExchangeSuggestionForm.svelte`

- **Implementation**:
  - A new utility/store, let's call it `DevFeaturesService`, will expose the state of the flags (e.g., `DevFeaturesService.mockButtonsEnabled`).
  - In each target form, the "Create Mocked..." button will be conditionally rendered:
    ```svelte
    {#if import.meta.env.VITE_MOCK_BUTTONS_ENABLED}
      <button type="button" on:click={createMockData}>
        Create Mock
      </button>
    {/if}
    ```
  - The existing `createMocked...` functions in `ui/src/lib/utils/mocks.ts` will be used. We will centralize them if needed.

### 3.2. Visual Debugging Aids (Optional, for Future)

While not in the initial scope, the system should be extensible to support these.

- **Component Boundary Visualizer**: A toggle to draw borders around all reusable components to help debug layout issues.
- **State Inspector**: A floating panel that displays the current state (`$state`) of a focused component, useful for complex components with lots of reactive state.
- **Event Bus Monitor**: A UI to log all events passing through the `storeEventBus`, helping to trace data flow between different parts of the application.

## 4. Implementation Plan

### Step 1: Environment Setup (1-2 hours)

1.  **Create `.env` files**: Create `.env.development`, `.env.test`, and `.env.example` in the `ui/` directory.
2.  **Add to `.gitignore`**: Ensure `.env.*` (except `.env.example`) are added to the `.gitignore` file to avoid committing secrets. The `.cursor` entry in `.gitignore` should be checked to ensure it's not ignoring these files unintentionally. It seems it is already ignoring .env files.
3.  **Update `package.json` scripts**: Modify the `dev`, `build`, and a new `test:deploy` script in `ui/package.json` to use the correct `.env` files with the `--mode` flag.
    - `dev`: `vite dev --mode development`
    - `build`: `vite build --mode production`
    - `build:test`: `vite build --mode test` (for deploying to a test environment)

### Step 2: Create `DevFeaturesService` (2-3 hours)

1.  **Create the service file**: `ui/src/lib/services/devFeatures.service.ts`.
2.  **Define the service**: This will be a simple object or Svelte store that reads from `import.meta.env` and provides clean boolean flags.

    ```typescript
    // ui/src/lib/services/devFeatures.service.ts
    const isDevMode = import.meta.env.VITE_APP_ENV === 'development';
    const areDevFeaturesEnabled = import.meta.env.VITE_DEV_FEATURES_ENABLED === 'true';

    export const DevFeatures = {
      isDev: isDevMode,
      devFeaturesEnabled: areDevFeaturesEnabled,
      mockButtonsEnabled: import.meta.env.VITE_MOCK_BUTTONS_ENABLED === 'true' && areDevFeaturesEnabled,
      // Add other feature flags here
    };
    ```

### Step 3: Refactor Forms to Use the Feature Flag (3-5 hours)

1.  **Import `DevFeatures`**: In each of the target forms, import the new service.
2.  **Conditionally Render Mock Buttons**: Wrap all existing "Create Mocked..." buttons with an `{#if DevFeatures.mockButtonsEnabled}` block.
3.  **Centralize Mock Functions**: Review `ui/src/lib/utils/mocks.ts` and ensure all mock creation functions are consistent. Create a single entry point if it makes sense.

### Step 4: Documentation (1 hour)

1.  **Update `README.md`**: Add a section in the main `README.md` or a `contributing.md` explaining how to use the new `.env` system for development.
2.  **Document `DevFeaturesService`**: Add TSDoc comments to `devFeatures.service.ts` explaining how to add new feature flags.

## 5. Production Safety

Vite's build process, when using `vite build --mode production`, will not include any of the `VITE_...` variables from `.env.development` or `.env.test`. Furthermore, the conditional rendering (`{#if ...}`) combined with tree-shaking will ensure that the mock buttons and their associated logic are completely removed from the production bundle.

We can verify this by inspecting the production build output after implementation. The code inside the `{#if DevFeatures.mockButtonsEnabled}` should not be present if `VITE_MOCK_BUTTONS_ENABLED` is `false` or not defined.

## 6. Alpha Test Considerations

For the upcoming alpha test, we will deploy a build using the `test` mode. Based on your feedback, this means:
- `VITE_APP_ENV=test`
- `VITE_DEV_FEATURES_ENABLED=true`
- `VITE_MOCK_BUTTONS_ENABLED=false`

This will allow us to enable other potential developer tools for testers (like a feedback button or performance metrics) without cluttering their UI with mock data buttons. The system is flexible enough to change this configuration easily if the alpha testers' needs change. 