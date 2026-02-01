# Unified Documents System

## Overview

The Unified Documents System is a centralized document management architecture that handles document storage and retrieval for any entity type in the deployment tracker. This eliminates duplicate code and provides a consistent interface across all features.

## Architecture

### Database Structure

**Table: `unified_documents`**

The core table uses a polymorphic relationship pattern:

```sql
CREATE TABLE unified_documents (
  id uuid PRIMARY KEY,

  -- Polymorphic relationship
  entity_type text NOT NULL,  -- 'facility', 'equipment_catalog', etc.
  entity_id uuid NOT NULL,    -- UUID of the entity

  -- Document metadata
  document_name text NOT NULL,
  document_type text,
  description text,
  version text,

  -- Storage
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'documents',
  file_size bigint,
  mime_type text,

  -- Multi-tenancy
  organization_id uuid,

  -- Metadata
  uploaded_by uuid,
  upload_date timestamptz DEFAULT now(),
  expiration_date date,
  is_active boolean DEFAULT true,
  tags text[],

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Supported Entity Types

1. **facility** - Facility-related documents (permits, certificates, etc.)
2. **equipment_catalog** - Equipment catalog reference documents (manuals, specs)
3. **equipment** - Individual equipment instance documents
4. **user** - User-uploaded documents
5. **organization** - Organization-wide documents
6. **milestone** - Milestone-related documents
7. **training** - Training materials
8. **regulatory** - Regulatory documents
9. **support_ticket** - Support ticket attachments

Future entity types can be added without schema changes.

## Service Layer

### Core Service: `unifiedDocumentService`

Located at: `/src/services/unifiedDocumentService.js`

This service provides the foundation for all document operations:

#### Key Methods

```javascript
// Get documents for an entity
await unifiedDocumentService.getDocuments(entityType, entityId, filters);

// Upload a document
await unifiedDocumentService.uploadDocument(entityType, entityId, file, metadata, storageBucket);

// Get signed URL for viewing
await unifiedDocumentService.getDocumentUrl(storageBucket, storagePath);

// Update document metadata
await unifiedDocumentService.updateDocument(documentId, updates);

// Delete document
await unifiedDocumentService.deleteDocument(documentId);

// Soft delete
await unifiedDocumentService.deactivateDocument(documentId);

// Get document count
await unifiedDocumentService.getDocumentCount(entityType, entityId);

// Bulk upload
await unifiedDocumentService.bulkUploadDocuments(entityType, entityId, files);

// Search across all documents
await unifiedDocumentService.searchDocuments(searchTerm, filters);

// Move document to different entity
await unifiedDocumentService.moveDocument(documentId, newEntityType, newEntityId);

// Copy document to another entity
await unifiedDocumentService.copyDocument(documentId, targetEntityType, targetEntityId);
```

### Entity-Specific Wrappers

For backward compatibility and convenience, entity-specific services wrap the unified service:

#### Equipment Catalog Documents
```javascript
// /src/services/equipmentCatalogDocumentService.js
import { unifiedDocumentService } from './unifiedDocumentService';

export const equipmentCatalogDocumentService = {
  async getDocuments(equipmentCatalogId) {
    return unifiedDocumentService.getDocuments('equipment_catalog', equipmentCatalogId);
  },
  // ... other methods
};
```

#### Facility Documents
```javascript
// /src/services/documentService.js
import { unifiedDocumentService } from './unifiedDocumentService';

export const documentService = {
  async getByFacilityId(facilityId) {
    const docs = await unifiedDocumentService.getDocuments('facility', facilityId);
    // ... add backward compatibility mappings
  },
  // ... other methods
};
```

## Storage Buckets

Documents are stored in Supabase Storage buckets:

| Entity Type | Default Bucket |
|-------------|----------------|
| facility | documents |
| equipment_catalog | equipment-catalog-docs |
| equipment | documents |
| organization | documents |
| user | documents |
| milestone | documents |
| training | documents |
| regulatory | documents |
| support_ticket | documents |

## Security (RLS)

Row Level Security policies provide context-aware access control:

1. **Facility Documents**: Users can access documents for facilities in their organization
2. **Equipment Catalog**: All authenticated users can view
3. **Organization Documents**: Organization members only
4. **User Documents**: Owner and admins only
5. **Default**: Admin access only

### Policy Examples

```sql
-- Users can view documents for entities they have access to
CREATE POLICY "Users can view accessible documents"
  ON unified_documents FOR SELECT
  TO authenticated
  USING (
    CASE entity_type
      WHEN 'facility' THEN EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_organization_assignments uoa
          ON uoa.organization_id = f.organization_id
        WHERE f.id = entity_id
        AND uoa.user_id = auth.uid()
      )
      WHEN 'equipment_catalog' THEN true
      -- ... other cases
    END
  );
```

## Migration

All existing documents have been automatically migrated:

1. **Facility documents** from `documents` table → `unified_documents` with `entity_type='facility'`
2. **Equipment catalog documents** from `equipment_catalog_documents` table → `unified_documents` with `entity_type='equipment_catalog'`

Backward compatibility views are provided:
- `facility_documents` view
- `equipment_catalog_document_view` view

## Usage Examples

### Adding Documents to a New Entity Type

Let's say you want to add document support for milestones:

1. **Use the unified service directly:**

```javascript
import { unifiedDocumentService } from '../services/unifiedDocumentService';

// In your milestone component
const handleUpload = async (milestoneId, file) => {
  await unifiedDocumentService.uploadDocument(
    'milestone',           // entity type
    milestoneId,          // entity ID
    file,                 // file object
    {
      document_name: file.name,
      document_type: 'milestone_report',
      description: 'Milestone completion report'
    }
  );
};

// Get milestone documents
const docs = await unifiedDocumentService.getDocuments('milestone', milestoneId);
```

2. **Create a wrapper service (optional):**

```javascript
// /src/services/milestoneDocumentService.js
import { unifiedDocumentService } from './unifiedDocumentService';

export const milestoneDocumentService = {
  async getDocuments(milestoneId) {
    return unifiedDocumentService.getDocuments('milestone', milestoneId);
  },

  async uploadDocument(milestoneId, file, metadata) {
    return unifiedDocumentService.uploadDocument(
      'milestone',
      milestoneId,
      file,
      metadata
    );
  }
};
```

### Searching Documents

```javascript
// Search all documents
const results = await unifiedDocumentService.searchDocuments(
  'safety manual',  // search term
  {
    entity_type: 'equipment_catalog',
    document_type: 'manual',
    tags: ['safety']
  }
);
```

### Moving Documents Between Entities

```javascript
// Move a document from one facility to another
await unifiedDocumentService.moveDocument(
  documentId,
  'facility',
  newFacilityId
);
```

### Bulk Operations

```javascript
// Upload multiple files at once
const files = [...]; // array of File objects
const results = await unifiedDocumentService.bulkUploadDocuments(
  'facility',
  facilityId,
  files,
  {
    document_type: 'certificate',
    tags: ['compliance', '2026']
  }
);

// Check results
results.forEach(result => {
  if (result.success) {
    console.log(`Uploaded: ${result.file}`);
  } else {
    console.error(`Failed: ${result.file} - ${result.error}`);
  }
});
```

## Benefits

1. **Single Source of Truth**: One table, one service for all document operations
2. **Consistent Interface**: Same methods work across all entity types
3. **Reduced Duplication**: No need to create separate tables and services for each entity
4. **Flexible**: Add new entity types without schema changes
5. **Powerful Search**: Search across all documents or filter by entity type
6. **Advanced Features**: Move, copy, and bulk operations built-in
7. **Proper Security**: Context-aware RLS policies
8. **Backward Compatible**: Existing code continues to work via wrapper services

## Future Enhancements

Potential additions to the unified system:

1. **Document versions**: Track multiple versions of the same document
2. **Document templates**: Reusable document templates
3. **Sharing**: Share documents across organizations
4. **Permissions**: Granular document-level permissions
5. **Metadata extraction**: Auto-extract metadata from PDFs
6. **Full-text search**: Index document contents for search
7. **Preview generation**: Generate thumbnails for images/PDFs
8. **Collaboration**: Comments and annotations on documents
