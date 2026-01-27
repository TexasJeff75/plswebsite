import { supabase } from '../lib/supabase';

export const documentService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async uploadDocument(facilityId, file, documentData) {
    const fileName = `${facilityId}/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        facility_id: facilityId,
        name: file.name,
        url: publicUrlData.publicUrl,
        type: documentData.type,
        uploaded_by: documentData.userId,
        expiration_date: documentData.expirationDate,
      })
      .select()
      .single();

    if (docError) throw docError;
    return docData;
  },

  async deleteDocument(documentId, fileUrl) {
    if (fileUrl) {
      const fileName = fileUrl.split('/').pop();
      await supabase.storage
        .from('documents')
        .remove([fileName]);
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
