# Facility Phone Field Update

## What Changed

Added a `phone` field to the `facilities` table to properly store the main facility phone number, separate from individual contact phone numbers.

## Database Changes

1. **New Field**: `facilities.phone` - Stores the main facility contact number
2. **Migration**: Automatically moved phone numbers from contacts to facilities where all contacts had the same number
3. **Display**: Phone now appears in the facility's Location tab

## Import Updates

The CSV import now properly handles two types of phone numbers:

- **`facility_phone`**: Main facility phone number → Saved to `facilities.phone`
- **`phone`**: Individual contact phone → Saved to `facility_contacts.phone`

## No Re-import Needed!

Your existing data has been automatically migrated. The system:
1. Added the phone field to facilities
2. Moved phone numbers from contacts to facilities where appropriate
3. Updated the import logic for future imports

## Location Card Now Shows

- Street address
- City, State
- **Facility phone number** (clickable tel: link)
- County (if available)
- Region (if available)

## Geocoding Enhancement

When geocoding addresses, the system now also:
- Automatically determines the county from coordinates
- Updates the county field if it was previously empty

## CSV Template Update

The import template now clearly distinguishes:
- "Facility Phone" - Main facility number
- "Phone" - Individual contact number

This ensures proper data separation in future imports.
