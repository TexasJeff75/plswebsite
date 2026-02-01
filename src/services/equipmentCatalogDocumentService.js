import { unifiedDocumentService } from './unifiedDocumentService';

/**
 * Equipment Catalog Document Service
 * Wrapper around unified document service for equipment catalog documents
 */
export const equipmentCatalogDocumentService = {
  async getDocuments(equipmentCatalogId) {
    return unifiedDocumentService.getDocuments('equipment_catalog', equipmentCatalogId);
  },

  async uploadDocument(equipmentCatalogId, file, documentInfo) {
    return unifiedDocumentService.uploadDocument(
      'equipment_catalog',
      equipmentCatalogId,
      file,
      documentInfo,
      'equipment-catalog-docs'
    );
  },

  async downloadDocument(storagePath) {
    return unifiedDocumentService.downloadDocument('equipment-catalog-docs', storagePath);
  },

  async getDocumentUrl(storagePath) {
    return unifiedDocumentService.getDocumentUrl('equipment-catalog-docs', storagePath);
  },

  async updateDocument(documentId, updates) {
    return unifiedDocumentService.updateDocument(documentId, updates);
  },

  async deleteDocument(documentId) {
    return unifiedDocumentService.deleteDocument(documentId);
  },

  async deactivateDocument(documentId) {
    return unifiedDocumentService.deactivateDocument(documentId);
  }
};
