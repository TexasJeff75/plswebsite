# Document Viewer and Management Guide

## What Changed

### Issue 1: Equipment Catalog Documents Not Visible
**Problem**: Documents uploaded in the Equipment Catalog weren't showing in the Facility's Documents tab.

**Root Cause**: The unified document system uses an entity-type pattern. Equipment catalog documents are stored with `entity_type = 'equipment_catalog'`, while the Documents tab only queried facility documents with `entity_type = 'facility'`.

**Solution**: Modified `DocumentsTab.jsx` to fetch and display equipment catalog reference documents in a dedicated "Equipment Reference Documents" section.

### Issue 2: Document Viewing Without Download
**Status**: Already Supported!

The `DocumentViewer` component already provides inline viewing for:
- **PDFs** - Displayed in full-screen embedded iframe
- **Images** - JPG, PNG, GIF, WebP, SVG displayed inline
- **Other formats** - Shows preview unavailable message with download option

## Document System Architecture

### Entity Types
The unified document system supports these entity types:
- `facility` - Facility-specific documents (certificates, reports, training records)
- `equipment_catalog` - System-wide equipment reference materials (manuals, specs, guides)
- `equipment` - Individual equipment instance documents
- `organization` - Organization-wide documents
- `milestone` - Milestone-related documentation
- `support_ticket` - Support ticket attachments
- `training` - Training materials
- `regulatory` - Regulatory documents
- `user` - User-uploaded documents

### Storage Buckets
- `documents` - Facility, organization, training, regulatory, support documents
- `equipment-catalog-docs` - Equipment catalog reference documents
- `equipment-images` - Equipment instance photos

## Document Viewing Features

### Supported Preview Formats

**Images** (Inline Display)
- JPG, JPEG, PNG, GIF, WebP, SVG
- Auto-detected by MIME type or file extension
- Rendered at full resolution with zoom capability
- Display in full-screen modal with light background

**PDFs** (Inline Display)
- Embedded in HTML5 iframe
- Full PDF viewer functionality (browser-native)
- Minimum height 600px, scrollable
- Display in full-screen modal with dark background

**Office Documents** (Download Required)
- Word (DOCX), Excel (XLSX), PowerPoint (PPTX)
- Shows "Preview Not Available" dialog
- Users can download to open in Microsoft Office or compatible software

**Other Formats** (Download Required)
- Text files, CSV, JSON, etc.
- Shows preview unavailable message
- Download button provides file access

### Viewing Workflow

1. **User clicks Eye icon** on any document (facility or equipment reference)
2. **Signed URL is generated** (valid for 1 hour, Supabase security feature)
3. **DocumentViewer component loads** with full-screen modal
4. **Content detected** and rendered appropriately:
   - Images shown in max-width/max-height container
   - PDFs loaded in iframe
   - Unsupported formats show download prompt
5. **User can**:
   - Download the document
   - Open in new tab (for images and PDFs)
   - Close modal and return to documents list

## Equipment Reference Documents Section

### What It Shows
- All system-wide equipment catalog documents
- Manuals, specifications, installation guides, maintenance schedules, SDS, etc.
- Displayed in Documents tab under "Equipment Reference Documents"
- Marked as "System-wide" to distinguish from facility-specific documents

### Organizational Features
- **Blue icon and border** for visual differentiation
- **Document type badge** showing classification
- **Version tracking** (if available)
- **Upload date** for reference
- **Count badge** showing total equipment docs available

### Actions Available
- **View** (Eye icon) - Preview in modal (PDFs and images)
- **Download** (Download icon) - Save file locally
- **Read-only** - Reference materials cannot be edited/deleted at facility level

### Why Separate from Facility Documents?
Equipment catalog documents are system-wide reference materials managed centrally:
- One set of manuals applies to all facilities
- Prevents duplicate storage and maintenance overhead
- Maintains clear separation: facility docs vs system reference docs
- Equipment docs are read-only at facility level (managed via Equipment Catalog tab)

## How to View Documents

### Step 1: Open Documents Tab
Navigate to any facility and select the **Documents** tab

### Step 2: Find Your Document
- **Active Documents** - Your facility-specific documents (editable)
- **Equipment Reference Documents** - System-wide manuals and specs (read-only)
- **Retired Documents** - Archived facility documents (view-only)

### Step 3: Click View Icon
- Click the **Eye icon** on any document
- For **PDFs**: Full embedded viewer opens, scroll through pages
- For **Images**: Full-screen image viewer, zoom capable
- For **Other formats**: Download prompt appears

### Step 4: Interact with Document
**Available options**:
- **Close** (X button) - Return to documents list
- **Download** (Download icon) - Save to computer
- **Open in New Tab** (External link icon) - Open in browser tab (PDFs and images only)
- **Full Screen** - Available on most browsers for iframes

## For Equipment Managers

### Uploading Equipment Reference Documents

1. Go to **Settings** → **Templates** → **Equipment Catalog**
2. Find the equipment (GeneXpert, Clarity, EPOC, etc.)
3. Click **"Manage Documents"**
4. Upload document with:
   - Document name (required)
   - Document type: Manual, Specification, Installation Guide, Maintenance Schedule, SDS, etc.
   - Description (optional)
   - Version (optional)
5. Document appears immediately in all facilities' Equipment Reference Documents section

### Document Types for Equipment
- `manual` - Operating manual and procedures
- `specification` - Technical specifications
- `installation_guide` - Installation instructions
- `maintenance_schedule` - Maintenance procedures
- `sds` - Safety Data Sheet
- `other` - Other reference materials

### Best Practices
- Include clear descriptions for each document
- Version your documents (v1.0, v2.0, etc.)
- Use consistent naming: "GeneXpert_UserManual_v2.0"
- Update documents when new versions available
- Specify document type for easy filtering

## File Format Recommendations

### For Maximum Compatibility

**PDFs** (Recommended for most documents)
- ✅ Universal compatibility
- ✅ Preserves formatting across devices
- ✅ Inline preview support
- ✅ Secure (can't be modified easily)

**Images** (For quick reference)
- ✅ Inline preview support
- ✅ Fast loading
- ✅ Perfect for diagrams, process flows
- Use PNG or JPG format

**Office Documents** (If necessary)
- ⚠️ No preview in browser (download required)
- ⚠️ Users need Office software
- Consider converting to PDF for better UX

## Security & Access Control

### Visibility Rules
- **Facility documents** - Only organization members with facility access
- **Equipment reference docs** - Visible to all authenticated users in organization
- **Retired documents** - Visible only with archive permission

### URL Security
- All document URLs use time-limited signed URLs (1 hour validity)
- Storage buckets configured with RLS policies
- Equipment catalog bucket requires authenticated access
- Documents remain secure even if URL is shared after expiration

## Troubleshooting

### Document Won't Preview
**Issue**: "Preview Not Available" message
**Solution**:
- Download the document to view on your computer
- For Office documents, use Microsoft Office or LibreOffice
- If PDF doesn't preview, download and open in PDF reader

### Can't Find Equipment Documents
**Solution**:
- Scroll down in Documents tab to "Equipment Reference Documents" section
- If section is empty, no equipment docs have been uploaded yet
- Check with Equipment Manager to upload manuals

### Download Not Working
**Solution**:
- Check browser pop-up blocker settings
- Try "Open in New Tab" instead
- Verify stable internet connection

### Very Large Documents Load Slowly
**Solution**:
- This is normal for large PDFs (100+ MB)
- Consider breaking into multiple smaller documents
- Download for faster access on your device

## Technical Details

### Signed URL Generation
- Service: `unifiedDocumentService.getDocumentUrl()`
- Expiration: 1 hour
- Method: Supabase Storage signed URLs
- Security: Time-limited access prevents unauthorized sharing

### Storage Path Structure
- Facility docs: `{facility_id}/{timestamp}-{random}.{ext}`
- Equipment docs: `{equipment_id}/{timestamp}-{random}.{ext}`
- Organization docs: `{organization_id}/{timestamp}-{random}.{ext}`

### Metadata Stored
- Document name, type, description
- File size and MIME type
- Upload date and uploader
- Version number (optional)
- Expiration date (optional)
- Retirement status and reason
- Replacement tracking (for versioning)

## Future Enhancements

Potential improvements for document management:
- **Office document preview** - Integrate OnlyOffice or LibreOffice Online
- **Full-text search** - Search across document content
- **Annotations** - Comment and mark up documents
- **Version control** - Track all document changes
- **Compliance audit trail** - Document access logging
- **Bulk operations** - Upload multiple documents at once
- **Document templates** - Pre-made facility document sets
