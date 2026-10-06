import { supabase } from '../lib/supabase';

export const clientIntakeService = {
  async create({ organizationId, projectId, expiresAt }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const accessToken = crypto.randomUUID();
    const { data, error } = await supabase
      .from('client_intakes')
      .insert({
        access_token: accessToken,
        organization_id: organizationId || null,
        project_id: projectId || null,
        expires_at: expiresAt || null,
        created_by: user.id,
      })
      .select('id, access_token, status, expires_at, created_at')
      .single();

    if (error) throw error;
    return data;
  },

  async list() {
    const { data, error } = await supabase
      .from('client_intakes')
      .select('id, access_token, organization_id, project_id, status, expires_at, created_at, updated_at, submitted_at, converted_at, organization:organizations(name), project:projects(name)')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getPublic(accessToken) {
    const { data, error } = await supabase.rpc('get_public_client_intake', {
      p_access_token: accessToken,
    });

    if (error) throw error;
    return data;
  },

  async savePublic(accessToken, payload, submit = false) {
    const { data, error } = await supabase.rpc('save_public_client_intake', {
      p_access_token: accessToken,
      p_payload: payload,
      p_submit: submit,
    });

    if (error) throw error;
    return data;
  },

  async convert(id) {
    const { data, error } = await supabase.rpc('convert_client_intake', {
      p_intake_id: id,
    });

    if (error) throw error;
    return data;
  },
};
