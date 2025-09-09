# New GitHub Issues for Simplified MVP

## Issue 1: Implement Contact Information Display
- Add contact info section to request/offer detail views
- Show email, phone (if provided), and preferred contact method
- Display organization contact if applicable

## Issue 2: Add Archive Functionality
- Users can archive their own requests/offers
- Archived items hidden from public view
- Accessible in user's dashboard for reactivation

## Issue 3: Add Delete Functionality  
- Users can permanently delete their own content
- Confirmation dialog required
- Cascade delete related data

## Issue 4: Simplify Navigation
- Remove "My Exchanges" from main navigation
- Add "My Listings" section to user dashboard
- Streamline request/offer creation flow

## Issue 5: Create My Listings Dashboard
- New page to view all user's requests and offers
- Status indicators (active/archived)
- Quick actions for archive/delete

## Issue 6: Update Request/Offer Detail Pages
- Remove "Respond to Request" button
- Add "View Contact" section
- Update layout to focus on contact information

## Issue 7: Implement Listing Status Management
- Add ListingStatus enum (Active, Archived, Deleted)
- Update backend zomes to support status changes
- Update frontend to handle status changes

## Issue 8: Create Contact Display Component
- New Svelte component to display contact information
- Support for user and organization contacts
- Responsive design for all device sizes

## Issue 9: Create Listing Actions Component
- New Svelte component for archive/delete actions
- Confirmation dialogs for destructive actions
- Proper loading states and error handling

## Issue 10: Update User Dashboard
- Replace "My Exchanges" with "My Listings"
- Show counts of active/archived listings
- Links to create new requests/offers