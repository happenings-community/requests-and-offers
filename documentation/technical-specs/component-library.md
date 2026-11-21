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

### Users Components

#### UserName.svelte

**Purpose**: Renders a user's display name with the mononym sentinel stripped via `formatUserName`. Use wherever `user.name` would otherwise be interpolated directly.

**Props**:

- `user`: UIUser | UserInDHT | { name?: string } | null | undefined - The user, or any object carrying a `name`
- `fallback`: string - Text shown when no name is available (default: "User")
- `class`: string - Optional CSS class applied to the wrapping `<span>`

### Shared Components

#### PageHeader.svelte

**Purpose**: The top of a list page, drawn one way on every one: a bold title at the left (the design system's h1, black), an optional line under it, and the page's own buttons at the right, which wrap under the title on a narrow screen.

**Props**:

- `title`: string - The page's title, its only `<h1>`. A Community page is titled as the menu names it ("All Users", "Organizations", "Service Types").
- `subtitle`: string - Optional line under the title
- `actions`: Snippet - Optional buttons at the right, small (`btn-sm`). A create button on Requests, Offers or My Listings is "+ Request" in gold or "+ Offer" in orange.

**Used on**: My Exchanges, My Listings, Messages, Blocked members, Requests, Offers, All Users, Organizations, Service Types. A page added to that list takes its title from `PageHeader` too: `tests/unit/components/shared/PageHeader.test.ts` checks each.

**Around it**: a list's search sits in one row at the left, with the count under it ("Showing 3 of 10", or "10 in all"); buttons that choose a view are drawn as My Exchanges' tabs, violet when chosen (`variant-filled-primary`), plain otherwise (`variant-ghost`), with `aria-pressed`. On Requests, Offers and My Listings an empty list is a card, with a create button where one can be made, and a search that matches none of a list says so instead.

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

### Chips and badges

`ui/src/app.postcss` draws every Skeleton `chip` and `badge` as the design system's pill: fully round, 4 by 10px, 12px semibold. A count keeps its own padding utilities (`px-1.5 py-0`).

- **Labels** use a soft variant, which on member pages is one of seven pale tones: each colour's 100 shade behind its 800 text, or its 900 for gold (`secondary`) and green (`success`), so every one reads at 4.5:1 or more. Admin's dark mode keeps Skeleton's soft variants.
- **Offer and Request labels** are solid: `variant-filled-warning` for an Offer, `variant-filled-secondary` for a Request, as in the nav bar. Gold and orange mean Requests and Offers.
- **Counts** stay solid (`variant-filled-*`, or white on the violet bar).
- The tone rule weighs two classes: a `hover:variant-*` on a chip still wins, but a plain `text-*` or `bg-*` colour on a soft chip does not; use another variant instead.
- The grey tone (`variant-soft-surface`) is surface-100, so it reads on a white card and not on a grey surface.

`ui/tests/unit/theme/contrast.test.ts` reads the stylesheet for each tone and holds its text to 4.5:1.

### Custom Utility Classes

In addition to Tailwind's utility classes, the application defines several custom utilities for consistent styling:

- `.card-hover`: Standard hover effects for cards
- `.form-input-wrapper`: Consistent styling for form inputs
- `.tag-pill`: Styling for tag elements

### Cards and fields

`ui/src/app.postcss` restyles Skeleton's cards and fields to the design system, inside `@layer components`:

- **Cards**: a `.card` is white with 12px corners, a surface-200 hairline and a faint shadow; in admin's dark mode it keeps Skeleton's surface-800 fill with a surface-700 edge. A card with a `variant-*` class keeps its variant. The rule weighs one class, so a utility on the card (`bg-*`, `border-*`, `shadow-*`, `ring-*`) wins in light mode: write `bg-warning-50` for a notice. In dark mode Skeleton's `.dark .card` still wins over a plain `bg-*` or `ring-*`, so a tinted card needs its `dark:bg-*` too.
- **Cards that open something**: an `a.card` or `button.card` without a variant (and not disabled) lifts 3px on hover with a violet edge (primary-400; primary-300 in admin) and a larger shadow; `card-hover` on it no longer scales. Every `a.card` and `button.card`, variant or not, shows a violet focus ring when tabbed to. The hover rule weighs as much as a `hover:` utility, which still wins; the transition (transform, shadow, border, background, text colour, 150ms) outweighs `transition-*` and `duration-*` utilities on these cards. Nothing moves with reduced motion.
- **Fields**: `.input`, `.select`, `.textarea` and `.input-group` have 8px corners, a white fill and a surface-500 edge (surface-400 in dark mode, on Skeleton's surface-700 fill). Focus adds a primary-500 edge and halo. On an `.input`, `.select` or `.textarea`, `input-error` or `aria-invalid="true"` adds a red edge and halo; the field keeps its white fill (dark fill in dark mode) and its own text colour, where Skeleton filled it pink. An `.input-group` has no error state of its own. On phones (below 640px) a field's text is 16px, so the browser does not zoom in, unless the field itself carries a `text-*` size.

`ui/tests/unit/theme/contrast.test.ts` checks these edges at 3:1 and reads the stylesheet, so changing a colour there means changing the test.

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
