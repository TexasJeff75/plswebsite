import { supabase } from '../lib/supabase';

export const equipmentCatalogDocumentService = {
  async getDocuments(equipmentCatalogId) {
    const { data, error } = await supabase
      .from('equipment_catalog_documents')
      .select('*')
      .eq('equipment_catalog_id', equipmentCatalogId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async uploadDocument(equipmentCatalogId, file, documentInfo) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${equipmentCatalogId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('equipment-catalog-docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('equipment_catalog_documents')
        .insert({
          equipment_catalog_id: equipmentCatalogId,
          document_name: documentInfo.document_name || file.name,
          document_type: documentInfo.document_type,
          description: documentInfo.description,
          version: documentInfo.version,
          storage_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id,
          expiration_date: documentInfo.expiration_date
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

  async downloadDocument(storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from('equipment-catalog-docs')
        .download(storagePath);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  async getDocumentUrl(storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from('equipment-catalog-docs')
        .createSignedUrl(storagePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting document URL:', error);
      throw error;
    }
  },

  async updateDocument(documentId, updates) {
    const { data, error } = await supabase
      .from('equipment_catalog_documents')
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

  async deleteDocument(documentId) {
    const { data: doc, error: fetchError } = await supabase
      .from('equipment_catalog_documents')
      .select('storage_path')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    const { error: storageError } = await supabase.storage
      .from('equipment-catalog-docs')
      .remove([doc.storage_path]);

    if (storageError) throw storageError;

    const { error } = await supabase
      .from('equipment_catalog_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async deactivateDocument(documentId) {
    const { data, error } = await supabase
      .from('equipment_catalog_documents')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
