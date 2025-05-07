# Work in Progress

This document tracks the current focus of development, recent changes, and next steps.

## Recent Updates

- Completed Issue #38: Align Request/Offer Features with Lightpaper
  - Updated Request/Offer data structures with new fields:
    - Contact preference (Email, Phone, Other)
    - Date range with start/end timestamps
    - Time estimate in hours
    - Time preference (Morning, Afternoon, Evening, No Preference, Other)
    - Time zone support
    - Exchange preference (Exchange, Arranged, Pay It Forward, Open)
    - Interaction type (Virtual, In-Person)
    - Links for additional resources
  - Enhanced UI components with form fields for all new data points
  - Integrated Luxon for consistent date/time handling and timezone support
  - Added validation for all fields (including 500 character limit on descriptions)
  - Created new form components:
    - TimeZoneSelect for timezone selection
    - UserForm for user profile management
    - OrganizationForm for organization management
  - Enhanced service methods to properly pass new data to Holochain backend
  - Updated card views to display key new fields
- Implemented Event Bus pattern using Effect TS for cross-store communication
- Enhanced EntityCache with Effect TS integration for improved state management
- Updated error handling in stores to use Data.TaggedError pattern
- Added comprehensive test mocks for Offers and Requests stores
- Enhanced UI components with responsive patterns (dashboard layouts, responsive tables)

## Current Focus

- Implementing testing for the new Request/Offer features (Issue #38)
  - Frontend unit tests for new form components
  - Integration tests for Request/Offer creation flows
- Building out the "Other" skill suggestion flow with admin review
- Implementing Exchange Completion/Validation Flow
  - Designing DHT structures for validation and reviews
  - Creating UI components for mutual validation
- Improving documentation on functional patterns used in the codebase
- Ensuring consistent implementation of Effect TS patterns across the application

## Next Steps

- Complete frontend testing for new Request/Offer features
- Implement Skill Suggestion Flow for "Other" skill type
- Begin implementation of Exchange Completion/Validation Flow
- Expand test coverage for store and service layers
- Enhance error handling using the Effect TS patterns
- Implement advanced search/filter functionality for Requests and Offers 