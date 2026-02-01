import { unifiedDocumentService } from './unifiedDocumentService';

/**
 * Document Service for Facility Documents
 * Wrapper around unified document service with facility-specific helpers
 */
export const documentService = {
  async getByFacilityId(facilityId) {
    const docs = await unifiedDocumentService.getDocuments('facility', facilityId);

    // Add signed URLs for compatibility
    const docsWithUrls = await Promise.all(
      (docs || []).map(async (doc) => {
        if (doc.storage_path) {
          try {
            const url = await unifiedDocumentService.getDocumentUrl(
              doc.storage_bucket,
              doc.storage_path
            );
            return {
              ...doc,
              url,
              // Map to old field names for backward compatibility
              name: doc.document_name,
              type: doc.document_type,
              created_at: doc.upload_date,
              facility_id: doc.entity_id
            };
          } catch (error) {
            console.error('Error getting signed URL:', error);
            return {
              ...doc,
              name: doc.document_name,
              type: doc.document_type,
              created_at: doc.upload_date,
              facility_id: doc.entity_id
            };
          }
        }
        return {
          ...doc,
          name: doc.document_name,
          type: doc.document_type,
          created_at: doc.upload_date,
          facility_id: doc.entity_id
        };
      })
    );

    return docsWithUrls;
  },

  async uploadDocument(facilityId, file, documentData) {
    const doc = await unifiedDocumentService.uploadDocument(
      'facility',
      facilityId,
      file,
      {
        document_name: file.name,
        document_type: documentData.type,
        expiration_date: documentData.expirationDate,
        organization_id: documentData.organizationId
      },
      'documents'
    );

    // Return in old format for compatibility
    const url = await unifiedDocumentService.getDocumentUrl(doc.storage_bucket, doc.storage_path);
    return {
      ...doc,
      name: doc.document_name,
      type: doc.document_type,
      url,
      facility_id: doc.entity_id,
      created_at: doc.upload_date
    };
  },

  async deleteDocument(documentId, storagePath) {
    await unifiedDocumentService.deleteDocument(documentId);
  },

  async updateDocument(documentId, updateData) {
    // Map old field names to new ones
    const mappedData = {
      document_name: updateData.name,
      document_type: updateData.type,
      expiration_date: updateData.expiration_date
    };

    const doc = await unifiedDocumentService.updateDocument(documentId, mappedData);

    // Return in old format for compatibility
    return {
      ...doc,
      name: doc.document_name,
      type: doc.document_type,
      facility_id: doc.entity_id,
      created_at: doc.upload_date
    };
  },

  getExpiringDocuments(documents, daysThreshold = 30) {
    const today = new Date();
    const thresholdDate = new Date(today.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

    return documents.filter(doc => {
      if (!doc.expiration_date) return false;
      const expirationDate = new Date(doc.expiration_date);
      return expirationDate <= thresholdDate && expirationDate >= today;
    });
  },

  isExpired(document) {
    if (!document.expiration_date) return false;
    return new Date(document.expiration_date) < new Date();
  },
};
