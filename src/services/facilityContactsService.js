import { supabase } from '../lib/supabase';

export const facilityContactsService = {
  async getContactsByFacility(facilityId) {
    const { data, error } = await supabase
      .from('facility_contacts')
      .select(`
        *,
        created_by_user:user_roles!facility_contacts_created_by_fkey(
          full_name,
          email
        ),
        updated_by_user:user_roles!facility_contacts_updated_by_fkey(
          full_name,
          email
        )
      `)
      .eq('facility_id', facilityId)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getContactById(contactId) {
    const { data, error } = await supabase
      .from('facility_contacts')
      .select(`
        *,
        facility:facilities(id, name),
        created_by_user:user_roles!facility_contacts_created_by_fkey(
          full_name,
          email
        ),
        updated_by_user:user_roles!facility_contacts_updated_by_fkey(
          full_name,
          email
        )
      `)
      .eq('id', contactId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createContact(contactData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('facility_contacts')
      .insert({
        ...contactData,
        created_by: userRole?.id,
        updated_by: userRole?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateContact(contactId, updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('facility_contacts')
      .update({
        ...updates,
        updated_by: userRole?.id
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteContact(contactId) {
    const { error } = await supabase
      .from('facility_contacts')
      .delete()
      .eq('id', contactId);

    if (error) throw error;
  },

  async setPrimaryContact(contactId, facilityId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    await supabase
      .from('facility_contacts')
      .update({
        is_primary: false,
        updated_by: userRole?.id
      })
      .eq('facility_id', facilityId)
      .neq('id', contactId);

    const { data, error } = await supabase
      .from('facility_contacts')
      .update({
        is_primary: true,
        updated_by: userRole?.id
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getContactRoles() {
    const { data, error } = await supabase
      .from('reference_data')
      .select('*')
      .eq('category', 'contact_role')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data;
  }
};
