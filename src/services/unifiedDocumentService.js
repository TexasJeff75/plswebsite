import { supabase } from '../lib/supabase';

/**
 * Unified Document Service
 *
 * Central document management system supporting polymorphic relationships.
 * Documents can be attached to any entity type (facilities, equipment, users, etc.)
 *
 * Supported Entity Types:
 * - 'facility': Facility-related documents
 * - 'equipment_catalog': Equipment catalog reference documents
 * - 'equipment': Individual equipment instance documents
 * - 'user': User-uploaded documents
 * - 'organization': Organization-wide documents
 * - 'milestone': Milestone-related documents
 * - 'training': Training materials
 * - 'regulatory': Regulatory documents
 * - 'support_ticket': Support ticket attachments
 */

export const unifiedDocumentService = {
  /**
   * Get all documents for a specific entity
   * @param {string} entityType - Type of entity ('facility', 'equipment_catalog', etc.)
   * @param {string} entityId - UUID of the entity
   * @param {object} filters - Optional filters (document_type, tags, etc.)
   */
  async getDocuments(entityType, entityId, filters = {}) {
    let query = supabase
      .from('unified_documents')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('is_active', true);

    if (filters.document_type) {
      query = query.eq('document_type', filters.document_type);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single document by ID
   */
  async getDocument(documentId) {
    const { data, error } = await supabase
      .from('unified_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Upload a document and create database record
   * @param {string} entityType - Type of entity
   * @param {string} entityId - UUID of the entity
   * @param {File} file - File to upload
   * @param {object} metadata - Document metadata
   * @param {string} storageBucket - Storage bucket name (optional, defaults based on entity type)
   */
  async uploadDocument(entityType, entityId, file, metadata = {}, storageBucket = null) {
    try {
      // Determine storage bucket based on entity type if not specified
      if (!storageBucket) {
        storageBucket = this.getDefaultBucket(entityType);
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create database record
      const { data, error } = await supabase
        .from('unified_documents')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          document_name: metadata.document_name || file.name,
          document_type: metadata.document_type,
          description: metadata.description,
          version: metadata.version,
          storage_path: uploadData.path,
          storage_bucket: storageBucket,
          file_size: file.size,
          mime_type: file.type,
          organization_id: metadata.organization_id,
          uploaded_by: user?.id,
          expiration_date: metadata.expiration_date,
          tags: metadata.tags || []
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  /**
   * Download a document
   */
  async downloadDocument(storageBucket, storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .download(storagePath);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  /**
   * Get a signed URL for viewing/downloading a document
   * @param {string} storageBucket - Storage bucket name
   * @param {string} storagePath - Path to file in storage
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   */
  async getDocumentUrl(storageBucket, storagePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(storagePath, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting document URL:', error);
      throw error;
    }
  },

  /**
   * Update document metadata
   */
  async updateDocument(documentId, updates) {
    const { data, error } = await supabase
      .from('unified_documents')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a document (both from storage and database)
   */
  async deleteDocument(documentId) {
    // Get document info
    const { data: doc, error: fetchError } = await supabase
      .from('unified_documents')
      .select('storage_bucket, storage_path')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(doc.storage_bucket)
      .remove([doc.storage_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error } = await supabase
      .from('unified_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  /**
   * Soft delete - mark document as inactive
   */
  async deactivateDocument(documentId) {
    const { data, error } = await supabase
      .from('unified_documents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get document count for an entity
   */
  async getDocumentCount(entityType, entityId, filters = {}) {
    let query = supabase
      .from('unified_documents')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('is_active', true);

    if (filters.document_type) {
      query = query.eq('document_type', filters.document_type);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /**
   * Bulk upload documents
   */
  async bulkUploadDocuments(entityType, entityId, files, metadata = {}) {
    const results = [];
    for (const file of files) {
      try {
        const result = await this.uploadDocument(
          entityType,
          entityId,
          file,
          { ...metadata, document_name: file.name }
        );
        results.push({ success: true, file: file.name, data: result });
      } catch (error) {
        results.push({ success: false, file: file.name, error: error.message });
      }
    }
    return results;
  },

  /**
   * Search documents across all entities
   */
  async searchDocuments(searchTerm, filters = {}) {
    let query = supabase
      .from('unified_documents')
      .select('*')
      .eq('is_active', true);

    // Text search
    if (searchTerm) {
      query = query.or(`document_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // Filter by entity type
    if (filters.entity_type) {
      query = query.eq('entity_type', filters.entity_type);
    }

    // Filter by document type
    if (filters.document_type) {
      query = query.eq('document_type', filters.document_type);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    // Filter by organization
    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    query = query.order('created_at', { ascending: false }).limit(100);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get default storage bucket for entity type
   */
  getDefaultBucket(entityType) {
    const bucketMap = {
      'facility': 'documents',
      'equipment_catalog': 'equipment-catalog-docs',
      'equipment': 'documents',
      'organization': 'documents',
      'user': 'documents',
      'milestone': 'documents',
      'training': 'documents',
      'regulatory': 'documents',
      'support_ticket': 'documents'
    };
    return bucketMap[entityType] || 'documents';
  },

  /**
   * Move document to different entity
   */
  async moveDocument(documentId, newEntityType, newEntityId) {
    const { data, error } = await supabase
      .from('unified_documents')
      .update({
        entity_type: newEntityType,
        entity_id: newEntityId,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Copy document to another entity
   */
  async copyDocument(documentId, targetEntityType, targetEntityId) {
    // Get original document
    const original = await this.getDocument(documentId);
    if (!original) throw new Error('Document not found');

    const { data: { user } } = await supabase.auth.getUser();

    // Create new record pointing to same storage file
    const { data, error } = await supabase
      .from('unified_documents')
      .insert({
        entity_type: targetEntityType,
        entity_id: targetEntityId,
        document_name: original.document_name,
        document_type: original.document_type,
        description: original.description,
        version: original.version,
        storage_path: original.storage_path,
        storage_bucket: original.storage_bucket,
        file_size: original.file_size,
        mime_type: original.mime_type,
        organization_id: original.organization_id,
        uploaded_by: user?.id,
        tags: original.tags
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
