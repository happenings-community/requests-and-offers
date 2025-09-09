# Contact Information Display

This document describes how contact information is displayed in the MVP version.

## Purpose

The MVP focuses on facilitating direct communication between users by clearly displaying contact information. This removes the need for complex in-app messaging systems while still enabling connections.

## Contact Information Fields

### Required Information
- Username/display name
- Profile picture (if available)

### Optional Information
- Email address
- Phone number
- Preferred contact method
- Organization name (if applicable)
- Organization contact info (if applicable)

## Display Locations

### Request Detail View
Contact information for the requester is displayed at the bottom of the request details page.

### Offer Detail View
Contact information for the provider is displayed at the bottom of the offer details page.

## Privacy Considerations

### User Control
- Users can choose which contact methods to display
- Users can hide contact information entirely (though this reduces utility)
- All contact information is opt-in

### Data Handling
- Contact information is only visible to logged-in users
- No public scraping of contact information is allowed
- Users can update their contact information at any time

## UI Implementation

### Contact Display Component
A standardized component displays contact information consistently:
- Clear visual separation from listing content
- Prominent "Contact" heading
- Standardized formatting for each contact method
- Links/buttons for easy contact initiation

### Responsive Design
- Mobile-friendly contact display
- Appropriate sizing for different screen widths
- Accessible for users with disabilities