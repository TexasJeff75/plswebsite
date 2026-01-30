import { supabase } from '../lib/supabase';

export const documentService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const docsWithUrls = await Promise.all(
      (data || []).map(async (doc) => {
        if (doc.storage_path) {
          const { data: signedUrlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.storage_path, 3600);
          return { ...doc, url: signedUrlData?.signedUrl || doc.url };
        }
        return doc;
      })
    );

    return docsWithUrls;
  },

  async uploadDocument(facilityId, file, documentData) {
    const storagePath = `${facilityId}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from('documents')
      .upload(storagePath, file);

    if (error) throw error;

    const { data: signedUrlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        facility_id: facilityId,
        name: file.name,
        url: signedUrlData?.signedUrl || '',
        storage_path: storagePath,
        type: documentData.type,
        uploaded_by: documentData.userId,
        expiration_date: documentData.expirationDate,
      })
      .select()
      .single();

    if (docError) throw docError;
    return docData;
  },

  async deleteDocument(documentId, storagePath) {
    if (storagePath) {
      await supabase.storage
        .from('documents')
        .remove([storagePath]);
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async updateDocument(documentId, updateData) {
    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
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
