import { supabase } from '../lib/supabase';

export const invitationService = {
  async getAll() {
    const { data, error } = await supabase
      .from('user_invitations')
      .select(`
        *,
        invited_by_user:user_roles!user_invitations_invited_by_fkey(display_name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('user_invitations')
      .select(`
        *,
        invited_by_user:user_roles!user_invitations_invited_by_fkey(display_name, email)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(invitation) {
    const { data: currentUser } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('user_invitations')
      .insert({
        email: invitation.email,
        role: invitation.role,
        invited_by: currentUser.user.id,
        organization_assignments: invitation.organization_assignments || [],
        expires_at: invitation.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('user_invitations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async cancel(id) {
    const { data, error } = await supabase
      .from('user_invitations')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async resend(id) {
    const invitation = await this.getById(id);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Can only resend pending invitations');
    }

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('user_invitations')
      .update({
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('user_invitations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async sendInvitationEmail(invitation) {
    const inviteUrl = `${window.location.origin}/#/login?invitation=${invitation.invitation_token}`;

    const { data, error } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        email: invitation.email,
        role: invitation.role,
        inviteUrl: inviteUrl,
        expiresAt: invitation.expires_at,
      },
    });

    if (error) throw error;
    return data;
  },

  async getPendingInvitations() {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getExpiredInvitations() {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('*')
      .or('status.eq.expired,and(status.eq.pending,expires_at.lt.' + new Date().toISOString() + ')')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async expireOldInvitations() {
    const { error } = await supabase.rpc('expire_old_invitations');
    if (error) throw error;
  },
};
