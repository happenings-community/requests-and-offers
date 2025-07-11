# Component Library Documentation

This document provides a comprehensive inventory of the reusable UI components in the Requests and Offers application.

## Component Organization

Components are organized by domain with a feature-based approach, located in `ui/src/lib/components`:

```
/components/
├── service-types/     # Service type related components
├── requests/         # Request management components
├── offers/           # Offer management components
├── users/            # User profile components
├── organizations/    # Organization management components
├── tags/             # Tag related components
├── shared/           # Shared utility components
├── hrea/             # hREA integration components
├── moe/              # Medium of Exchange components
└── mediums-of-exchange/ # Medium of Exchange components
```

## Core Components

### Service Types Components

#### ServiceTypeCard.svelte

**Purpose**: Displays a service type with its metadata in a card format.

**Props**:

- `serviceType`: ServiceTypeOutput - The service type to display
- `showActions`: boolean - Whether to show action buttons (edit, delete)
- `compact`: boolean - Whether to show a compact version of the card

**Events**:

- `edit`: When edit button is clicked
- `delete`: When delete button is clicked
- `select`: When the card is selected

#### ServiceTypeSelector.svelte

**Purpose**: Multi-select component for choosing service types with search capability.

**Props**:

- `selectedServiceTypes`: ServiceTypeOutput[] - Currently selected service types
- `multiple`: boolean - Whether multiple selection is allowed
- `required`: boolean - Whether selection is required
- `disabled`: boolean - Whether the component is disabled

**Events**:

- `selection`: When selection changes, emits array of selected service types
- `search`: When search text changes

### Requests/Offers Components

#### RequestForm.svelte / OfferForm.svelte

**Purpose**: Form for creating or editing a request/offer.

**Props**:

- `request`/`offer`: Optional - Existing request/offer for editing
- `serviceTypes`: ServiceTypeOutput[] - Available service types
- `organizations`: OrganizationOutput[] - User's organizations

**Events**:

- `submit`: When form is submitted successfully
- `cancel`: When form is cancelled
- `error`: When form submission fails

### Shared Components

#### TagAutocomplete.svelte

**Purpose**: Tag input with autocomplete suggestions.

**Props**:

- `selectedTags`: string[] - Currently selected tags
- `suggestTags`: boolean - Whether to show tag suggestions
- `maxTags`: number - Maximum number of tags allowed

**Events**:

- `update`: When selected tags change

#### LoadingSpinner.svelte

**Purpose**: Consistent loading indicator for async operations.

**Props**:

- `size`: 'small' | 'medium' | 'large' - Size of the spinner
- `message`: string - Optional loading message

#### ErrorDisplay.svelte

**Purpose**: Standardized error display component.

**Props**:

- `error`: any - Error object to display
- `retry`: () => void - Optional retry function

## Styling and Theming

The application uses a combination of TailwindCSS and SkeletonUI for styling, with a custom theme defined in
`src/happening_theme.ts`.

### Custom Theme Configuration

The Happening theme extends the base Skeleton theme with:

1. **Custom Colors**: Brand-specific color palette with primary, secondary, and accent colors
2. **Typography**: Custom font family and size scale
3. **Component Styling**: Customized appearance for buttons, cards, and form elements

### Using the Theme

Theme values should be accessed through Skeleton's theme system rather than hard-coding colors:

```html
<!-- Recommended -->
<button class="btn variant-filled-primary">Submit</button>

<!-- Avoid -->
<button class="bg-blue-500 hover:bg-blue-600">Submit</button>
```

### Custom Utility Classes

In addition to Tailwind's utility classes, the application defines several custom utilities for consistent styling:

- `.card-hover`: Standard hover effects for cards
- `.form-input-wrapper`: Consistent styling for form inputs
- `.tag-pill`: Styling for tag elements

## Best Practices

1. **Component Composition**: Prefer composition over complex, monolithic components
2. **Props Typing**: Always define proper TypeScript interfaces for component props
3. **Error Handling**: Use ErrorDisplay component for consistent error presentation
4. **Loading States**: Use LoadingSpinner for all asynchronous operations
5. **Accessibility**: Ensure all components meet WCAG AA standards

## Component Development Guidelines

1. **New Components**: Place in appropriate domain folder
2. **Testing**: Create component tests in corresponding test file
3. **Documentation**: Update this document when adding new components
4. **Composition**: Extract reusable logic to composables when appropriate
