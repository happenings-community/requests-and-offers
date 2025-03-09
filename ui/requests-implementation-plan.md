# Requests Feature Implementation Plan

## Overview

This document outlines the comprehensive plan for implementing the requests feature in the UI, leveraging the newly created functional requests service and store. The implementation will follow existing patterns and structures in the codebase while ensuring a seamless integration with the Holochain backend.

## 1. Component Architecture

### 1.1 Core Components

#### RequestCard Component

**Path:** `/src/lib/components/RequestCard.svelte`

This reusable component will display individual request information:

- **Features:**
  - Display request title, description, skills, and process state
  - Show creator information with avatar
  - Display organization information if applicable
  - Include appropriate action buttons based on user role and request state
  - Support different display modes (compact/expanded)
  - Responsive design for both mobile and desktop views

- **Props:**

  ```typescript
  type Props = {
    request: UIRequest;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
  };
  ```

✅ **IN PROGRESS**

#### RequestsTable Component

**Path:** `/src/lib/tables/RequestsTable.svelte`

This component will display requests in a tabular format, similar to the existing OrganizationsTable:

- **Features:**
  - Tabular display for desktop views
  - Card-based display for mobile views
  - Columns for title, description, skills, state, creator, and actions
  - Support for sorting and filtering
  - Pagination for large datasets

- **Props:**

  ```typescript
  type Props = {
    requests: UIRequest[];
    title?: string;
    showOrganization?: boolean;
    showCreator?: boolean;
  };
  ```

✅ **IN PROGRESS**

#### RequestDetailsModal Component

**Path:** `/src/lib/modals/RequestDetailsModal.svelte`

This modal will display comprehensive request information:

- **Features:**
  - Complete request details
  - Creator information
  - Organization information (if applicable)
  - Request history and status changes
  - Action buttons based on user permissions
  - Responsive layout

- **Meta:**

  ```typescript
  type RequestDetailsModalMeta = {
    request: UIRequest;
    canEdit: boolean;
    canDelete: boolean;
  };
  ```

✅ **IN PROGRESS**

- Add creator avatar and details when available
- Add organization logo and details when available
- Implement delete confirmation and action

#### RequestForm Component

**Path:** `/src/lib/components/RequestForm.svelte`

This form component will handle request creation and editing:

- **Features:**
  - Fields for title, description, skills, and process state
  - Organization selection for users with multiple organizations
  - Input validation
  - Support for both create and update operations
  - Responsive design

- **Props:**

  ```typescript
  type Props = {
    request?: UIRequest;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<void>;
  };
  ```

✅ **IN PROGRESS**

**TODOs:**

- Enhance form validation with more specific error messages
- Add confirmation before submitting changes in edit mode
- Consider adding a preview mode
- Add loading state for organization data

### 1.2 Utility Components

#### RequestStatusBadge Component

**Path:** `/src/lib/components/RequestStatusBadge.svelte`

This component will display the current state of a request:

- **Features:**
  - Visual indication of request state (color-coded)
  - Text label for the state
  - Optional tooltip with additional information

- **Props:**

  ```typescript
  type Props = {
    state: RequestProcessState;
    showLabel?: boolean;
  };
  ```

✅ **IN PROGRESS**

#### RequestSkillsTags Component

**Path:** `/src/lib/components/RequestSkillsTags.svelte`

This component will display the skills associated with a request:

- **Features:**
  - Display skills as tags
  - Support for limiting the number of visible tags
  - "Show more" functionality for many tags

- **Props:**

  ```typescript
  type Props = {
    skills: string[];
    maxVisible?: number;
  };
  ```

✅ **IN PROGRESS**

## 2. Page Implementation

### 2.1 Main Requests Page

**Path:** `/src/routes/(app)/requests/+page.svelte`

This page will display all requests and provide filtering options:

- **Features:**
  - Integration with the requests store
  - Filtering options (my requests, organization requests, all requests)
  - Create request button for logged-in users
  - Sorting and pagination
  - Loading and error states

- **Implementation Details:**
  - Use `$effect` for data fetching
  - Implement filter state with `$state`
  - Use RequestsTable component for display
  - Add responsive design considerations

✅ **IN PROGRESS**

**TODOs:**

- Implement pagination for large datasets
- Add sorting functionality
- Enhance filtering with more options (status, date, etc.)

### 2.2 Request Creation Page

**Path:** `/src/routes/(app)/requests/create/+page.svelte`

This page will handle the creation of new requests:

- **Features:**
  - RequestForm component integration
  - Organization selection for users in multiple organizations
  - Form validation
  - Success/error feedback
  - Redirect to request details on success

- **Implementation Details:**
  - Fetch user's organizations
  - Handle form submission
  - Integrate with requests store
  - Provide clear error messages

✅ **IN PROGRESS**

**TODOs:**

- Add loading state for form submission
- Consider adding a preview step before submission
- Add confirmation for organization selection

### 2.3 Request Details Page

**Path:** `/src/routes/(app)/requests/[id]/+page.svelte`

This page will display detailed information about a specific request:

- **Features:**
  - Display all request information
  - Show creator and organization details
  - Edit and delete options for request owners
  - Status badge and skills tags
  - Metadata (created/updated dates)

- **Implementation Details:**
  - Fetch request data using request hash from URL
  - Fetch related organization data if applicable
  - Check permissions for edit/delete actions
  - Format dates for display

✅ **IN PROGRESS**

**TODOs:**

- Enhance creator and organization information display
- Implement delete functionality when available
- Add confirmation dialog for delete action
- Consider adding a share feature

### 2.4 Request Edit Page

**Path:** `/src/routes/(app)/requests/[id]/edit/+page.svelte`

This page will allow editing of existing requests:

- **Features:**
  - Pre-populated RequestForm component
  - Validation
  - Success/error feedback
  - Cancel option

- **Implementation Details:**
  - Fetch existing request data
  - Handle form submission for updates
  - Redirect to request details on success

### 2.5 Admin Requests Page

**Path:** `/src/routes/admin/requests/+page.svelte`

This page will provide administrative functions for requests:

- **Features:**
  - Advanced filtering and sorting
  - Bulk operations
  - Status management
  - Administrative actions

- **Implementation Details:**
  - Enhanced RequestsTable with admin actions
  - Integration with administration store
  - Advanced filtering options

## 3. Integration with Existing Pages

### 3.1 User Profile Page

**Path:** `/src/routes/(app)/user/+page.svelte`

Add a requests section to the user profile:

- **Features:**
  - Display requests created by the user
  - Show requests where the user is involved
  - Quick access to request management

- **Implementation Details:**
  - Add a new section to the existing page
  - Fetch user's requests
  - Display in a compact format

### 3.2 Organization Details Page

**Path:** `/src/routes/(app)/organizations/[id]/+page.svelte`

Add a requests tab to organization details:

- **Features:**
  - Display requests associated with the organization
  - Create request button for organization members
  - Filtering and sorting options

- **Implementation Details:**
  - Add a new tab to the existing page
  - Fetch organization's requests
  - Show appropriate actions based on user role

## 4. State Management

### 4.1 Requests Store Integration

The implementation will leverage the existing functional requests store:

- **Usage:**
  - Import the store in components and pages
  - Use reactive state with Svelte 5 runes
  - Handle loading and error states consistently

- **Example:**

  ```typescript
  import requestsStore from '@/stores/requests.store.svelte';
  
  // In component
  const { requests, loading, error } = $derived(requestsStore);
  
  // Effect for data fetching
  $effect(() => {
    requestsStore.getAllRequests();
  });
  ```

### 4.2 Event Bus Integration

The implementation will use the event bus for cross-component communication:

- **Events:**
  - `request:created` - Emitted when a new request is created
  - `request:updated` - Emitted when a request is updated
  - `request:deleted` - Emitted when a request is deleted

- **Example:**

  ```typescript
  import eventBus from '@/stores/eventBus';
  
  // Listen for events
  const unsubscribe = $effect(() => {
    const handler = eventBus.on('request:created', ({ request }) => {
      // Handle new request
    });
    
    return () => handler(); // Cleanup
  });
  ```

## 5. UI/UX Considerations

### 5.1 Responsive Design

- Follow existing patterns of table view for desktop and cards for mobile
- Ensure all forms and modals work well on mobile devices
- Use Skeleton UI and TailwindCSS for consistent styling

### 5.2 Loading States

- Implement skeleton loaders for better user experience
- Show loading indicators for asynchronous operations
- Provide clear feedback during form submissions

### 5.3 Error Handling

- Display meaningful error messages
- Provide retry options where appropriate
- Implement graceful fallbacks

### 5.4 Accessibility

- Ensure proper ARIA attributes
- Maintain keyboard navigation
- Provide sufficient color contrast

## 6. Implementation Phases

### Phase 1: Core Components (Week 1)

- Create RequestCard component
- Create RequestsTable component
- Implement RequestStatusBadge and RequestSkillsTags components
- Create RequestDetailsModal component
- Create RequestForm component
- Set up basic structure for main requests page

### Phase 2: Basic Pages (Week 1-2)

- Complete main requests page implementation
- Create request creation page
- Implement RequestForm component
- Set up basic request details page

### Phase 3: Advanced Features (Week 2)

- Create request edit page
- Implement request filtering and sorting
- Add pagination for large datasets
- Enhance user experience with loading states and error handling

### Phase 4: Integration (Week 3)

- Add requests section to user profile
- Add requests tab to organization details
- Implement filtering and sorting
- Connect all components with event bus

### Phase 5: Polish and Testing (Week 3-4)

- Add animations and transitions
- Implement responsive design improvements
- Add confirmation dialogs
- Comprehensive testing
- Documentation

## 7. Testing Strategy

### 7.1 Component Testing

- Test individual components in isolation
- Verify props and event handling
- Test responsive behavior

### 7.2 Integration Testing

- Test interaction between components
- Verify store integration
- Test event bus communication

### 7.3 End-to-End Testing

- Test complete user flows
- Verify data persistence
- Test error handling and edge cases

## 8. Technical Considerations

### 8.1 Performance

- Implement pagination for large datasets
- Use lazy loading for request details
- Cache request data appropriately

### 8.2 Security

- Validate user permissions for actions
- Sanitize user input
- Implement proper error handling

### 8.3 Maintainability

- Follow existing code patterns
- Use consistent naming conventions
- Document components and functions
- Use TypeScript interfaces for type safety

## 9. Documentation

### 9.1 Component Documentation

- Document props and events for each component
- Provide usage examples
- Document state management approach

### 9.2 API Documentation

- Document requests store methods
- Document requests service methods
- Document event bus events

### 9.3 User Documentation

- Create user guides for request management
- Document request lifecycle
- Provide troubleshooting information

## 10. Pending TODOs

### 10.1 RequestCard Component

- Implement actual logic for determining if a request is editable based on the current user
- Implement edit navigation or modal
- Implement delete confirmation and action
- Fetch and display the actual user profile picture instead of using the default avatar

### 10.2 RequestsTable Component

- Implement sorting and filtering functionality
- Add pagination for large datasets
- Enhance the display of creator and organization information

### 10.3 RequestDetailsModal Component

- Add creator avatar and details when available
- Add organization logo and details when available
- Implement delete confirmation and action

### 10.4 RequestForm Component

- Enhance form validation with more specific error messages
- Add confirmation before submitting changes in edit mode
- Consider adding a preview mode
- Add loading state for organization data

### 10.5 Main Requests Page

- Implement pagination for large datasets
- Add sorting functionality
- Enhance filtering with more options (status, date, etc.)

### 10.6 Request Creation Page

- Add loading state for form submission
- Consider adding a preview step before submission
- Add confirmation for organization selection

### 10.7 Request Details Page

- Enhance creator and organization information display
- Implement delete functionality when available
- Add confirmation dialog for delete action
- Consider adding a share feature

### 10.8 Next Components to Implement

- Request edit page

## Conclusion

This implementation plan provides a comprehensive roadmap for adding the requests feature to the UI. By following existing patterns and leveraging the new functional approach, we will create a cohesive and maintainable solution that integrates seamlessly with the rest of the application.

The plan is modular, allowing for incremental implementation and testing, and ensures that the requests feature will be consistent with the overall application design and user experience.
