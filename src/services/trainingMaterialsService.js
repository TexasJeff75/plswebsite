import { supabase } from '../lib/supabase';

const BUCKET = 'training-materials';

export const trainingMaterialsService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('training_materials')
      .select('*, uploader:uploaded_by(email)')
      .order('created_at', { ascending: false });

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters.material_type && filters.material_type !== 'all') {
      query = query.eq('material_type', filters.material_type);
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('training_materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('training_materials')
      .insert({ ...payload, uploaded_by: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('training_materials')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const record = await this.getById(id);
    if (record?.storage_path) {
      await supabase.storage.from(BUCKET).remove([record.storage_path]);
    }
    const { error } = await supabase
      .from('training_materials')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async uploadFile(file) {
    const ext = file.name.split('.').pop();
    const path = `uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return { path: data.path, bucket: BUCKET, file_name: file.name, file_size: file.size, mime_type: file.type };
  },

  async getFileUrl(storagePath, expiresIn = 3600) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async incrementViewCount(id) {
    await supabase.rpc('increment_training_material_views', { material_id: id }).catch(() => {
      supabase
        .from('training_materials')
        .update({ view_count: supabase.raw('view_count + 1') })
        .eq('id', id);
    });
  },
};
