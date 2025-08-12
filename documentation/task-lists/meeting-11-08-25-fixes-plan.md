# Meeting 11-08-25 Implementation Plan

## Overview

This plan addresses the "To fix" section from the meeting notes, focusing on improvements to Medium of Exchange, Service Types, and Organizations domains. The fixes involve UI/UX improvements, form enhancements, data modeling changes, and feature additions.

## Completed Tasks

_No tasks completed yet_

## In Progress Tasks

_No tasks currently in progress_

## Future Tasks

### Medium of Exchange Domain

- [ ] **MoE-01**: Implement clear distinction between generic and specific MoEs in forms
- [ ] **MoE-02**: Add "additional currency" checkbox for specific MoEs with dynamic list display
- [ ] **MoE-03**: Remove MoE public page completely
- [ ] **MoE-04**: Add suggest button functionality in forms

### Service Types Domain

- [ ] **ST-01**: Convert service types page from card layout to table layout
- [ ] **ST-02**: Remove tags functionality from service types
- [ ] **ST-03**: Implement technical/non-technical filter and sort functionality

### Organizations Domain

- [ ] **ORG-01**: Enhance welcome message modal with Exchange Coordinator role description
- [ ] **ORG-02**: Rename "Description" field to "Vision/Mission"
- [ ] **ORG-03**: Add new "Full legal name" field to organization schema
- [ ] **ORG-04**: Implement specific email addresses for organizations and coordinators

## Implementation Strategy

### Phase 1: Medium of Exchange Improvements (Priority: High)

**Impact**: Forms used across requests/offers - high user interaction

**Technical Approach**:

- Update `MediumOfExchangeForm` component for generic/specific distinction
- Implement conditional rendering for "additional currency" checkbox
- Remove public routes and pages for MoE
- Add suggestion functionality with autocomplete/search

**Files to Modify**:

- `ui/src/lib/components/mediums-of-exchange/MediumOfExchangeForm.svelte`
- `ui/src/routes/mediums-of-exchange/+page.svelte` (remove)
- `ui/src/lib/services/zomes/mediums-of-exchange.service.ts`
- `ui/src/lib/components/shared/Navbar.svelte` (navigation updates)

### Phase 2: Service Types UI Overhaul (Priority: Medium)

**Impact**: Administrative interface improvements

**Technical Approach**:

- Replace card components with data table component
- Remove tags-related UI and backend functionality
- Implement filter/sort controls with technical classification

**Files to Modify**:

- `ui/src/routes/service-types/+page.svelte`
- `ui/src/lib/components/service-types/` (various components)
- `dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs`
- `ui/src/lib/stores/service-types.store.ts`

### Phase 3: Organizations Enhancement (Priority: Low)

**Impact**: Organization management and onboarding

**Technical Approach**:

- Update welcome modal content and organization forms
- Schema changes for new fields
- Email field separation for org vs coordinator

**Files to Modify**:

- `ui/src/lib/components/organizations/OrganizationWelcomeModal.svelte`
- `ui/src/lib/components/organizations/OrganizationForm.svelte`
- `dnas/requests_and_offers/zomes/integrity/organizations/src/lib.rs`
- `ui/src/lib/schemas/organizations.schema.ts`

## Detailed Task Breakdown

### Medium of Exchange Tasks

#### MoE-01: Generic vs Specific MoE Distinction

**Complexity**: Medium | **Est. Time**: 4-6 hours

**Requirements**:

- Clear visual/functional distinction between generic MoEs (e.g., "Local Currency") and specific MoEs (e.g., "Ithaca HOURS")
- Update form UI to make this distinction obvious to users
- Possibly separate form sections or use different input styles

**Implementation Steps**:

1. Update `MediumOfExchangeFormField` component with conditional rendering
2. Modify form validation to handle different input types
3. Update styling for visual distinction
4. Test across all forms that use MoE selection (requests/offers)

#### MoE-02: Additional Currency Checkbox

**Complexity**: Medium | **Est. Time**: 3-4 hours

**Requirements**:

- Add checkbox labeled "additional currency" for specific MoEs only
- When checked, display list of available currencies
- Dynamic form behavior with proper state management

**Implementation Steps**:

1. Add checkbox to form component with conditional visibility
2. Implement dynamic list display with proper loading states
3. Update form data structure and validation
4. Integrate with existing MoE service layer

#### MoE-03: Remove MoE Public Page

**Complexity**: Low | **Est. Time**: 1-2 hours

**Requirements**:

- Remove the public-facing MoE page completely
- Clean up navigation and routing
- Ensure no broken links remain

**Implementation Steps**:

1. Delete public page files
2. Update navigation components to remove MoE links
3. Update routing configuration
4. Test navigation flow

#### MoE-04: Add Suggest Button

**Complexity**: Medium | **Est. Time**: 4-5 hours

**Requirements**:

- Add "suggest" functionality to MoE forms
- Allow users to suggest new MoE entries
- Proper form handling and validation

**Implementation Steps**:

1. Add suggest button to form components
2. Create suggestion modal/form
3. Implement backend functionality for suggestions
4. Add proper state management and error handling

### Service Types Tasks

#### ST-01: Card to Table Conversion

**Complexity**: Medium | **Est. Time**: 3-4 hours

**Requirements**:

- Replace existing card layout with data table
- Maintain all current functionality (edit, delete, view)
- Improve data density and scanning ability
- Use SkeletonUI table components

**Implementation Steps**:

1. Create new table component using SkeletonUI DataTable
2. Update service types page to use table instead of cards
3. Implement table actions (edit, delete, view)
4. Update styling and responsive behavior

#### ST-02: Remove Tags Functionality

**Complexity**: Medium | **Est. Time**: 3-4 hours

**Requirements**:

- Remove all tags-related UI components
- Clean up backend/schema references to tags
- Remove tags from service type creation/editing

**Implementation Steps**:

1. Remove tags UI components from service types
2. Update service type schema to remove tags fields
3. Update backend zome functions to exclude tags
4. Clean up any tag-related stores/services

#### ST-03: Technical/Non-Technical Filter

**Complexity**: Medium | **Est. Time**: 4-5 hours

**Requirements**:

- Add filter/sort controls for technical classification
- Categorize existing service types appropriately
- Implement proper filtering and sorting logic

**Implementation Steps**:

1. Add technical classification field to service type schema
2. Create filter/sort UI components
3. Implement filtering logic in store layer
4. Update existing service types with classifications

### Organizations Tasks

#### ORG-01: Welcome Message Enhancement

**Complexity**: Low | **Est. Time**: 2-3 hours

**Requirements**:

- Add clear description of Exchange Coordinator role
- Update welcome modal content and messaging
- Improve user understanding of organizational roles

**Implementation Steps**:

1. Update welcome modal component content
2. Add role descriptions and explanations
3. Update styling and layout as needed
4. Test modal functionality

#### ORG-02: Description to Vision/Mission Rename

**Complexity**: Low | **Est. Time**: 1-2 hours

**Requirements**:

- Rename "Description" field to "Vision/Mission"
- Update all references in UI and backend
- Maintain data compatibility

**Implementation Steps**:

1. Update form field labels and placeholders
2. Update schema field names
3. Update database migration if needed
4. Test form functionality

#### ORG-03: Add Full Legal Name Field

**Complexity**: Medium | **Est. Time**: 3-4 hours

**Requirements**:

- Add new "Full legal name" field to organization schema
- Update forms and validation
- Ensure proper data handling

**Implementation Steps**:

1. Add field to organization schema and validation
2. Update organization form components
3. Update backend zome functions
4. Test data persistence and retrieval

#### ORG-04: Specific Email Addresses

**Complexity**: Medium | **Est. Time**: 4-5 hours

**Requirements**:

- Separate email fields for organization vs coordinator
- Update schema and validation accordingly
- Maintain proper email handling and validation

**Implementation Steps**:

1. Update organization schema with separate email fields
2. Modify form components for dual email inputs
3. Update validation rules for both email types
4. Test email functionality and validation

## Risk Assessment & Mitigation

### High Risk Items

- **MoE Form Changes**: High user impact - requires thorough testing
- **Service Types Backend Changes**: Schema modifications need careful migration

### Medium Risk Items

- **Organizations Schema Changes**: New fields require proper validation
- **Navigation Updates**: Removing MoE page needs thorough link checking

### Mitigation Strategies

- Comprehensive testing at each phase
- Backup data before schema changes
- Staged rollout with user feedback
- Proper error handling and validation

## Success Criteria

### Technical Criteria

- All forms function correctly with new requirements
- No broken navigation or dead links
- Proper data validation and error handling
- Responsive design maintained

### User Experience Criteria

- Clear distinction between MoE types
- Intuitive service types table interface
- Improved organization onboarding experience
- Maintained or improved workflow efficiency

## Dependencies & Prerequisites

- Current Effect-TS architecture patterns must be maintained
- All changes must follow established 7-layer architecture
- Svelte 5 and SkeletonUI component patterns
- Existing validation and error handling frameworks

## Total Estimated Time

**Phase 1 (Medium of Exchange)**: 12-17 hours
**Phase 2 (Service Types)**: 10-13 hours  
**Phase 3 (Organizations)**: 10-14 hours

**Total Project**: 32-44 hours (4-5.5 working days)

## Next Steps

1. **Phase 1 Start**: Begin with Medium of Exchange improvements (highest user impact)
2. **Documentation Update**: Update relevant documentation as changes are implemented
3. **Testing Strategy**: Implement comprehensive testing for each domain
4. **User Feedback**: Gather feedback after each phase for adjustments

This plan provides a structured approach to implementing all the fixes identified in the meeting, with clear priorities, task breakdown, and risk mitigation strategies.
