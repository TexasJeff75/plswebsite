import { supabase } from '../lib/supabase';

export const referenceDataService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('reference_data')
      .select('category')
      .order('category');

    if (error) throw error;

    const uniqueCategories = [...new Set(data.map(d => d.category))];
    return uniqueCategories;
  },

  async getByCategory(category, includeInactive = false) {
    let query = supabase
      .from('reference_data')
      .select('*')
      .eq('category', category)
      .order('sort_order')
      .order('display_name');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('reference_data')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getByCode(category, code) {
    const { data, error } = await supabase
      .from('reference_data')
      .select('*')
      .eq('category', category)
      .eq('code', code)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(item) {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('reference_data')
      .insert({
        category: item.category,
        code: item.code.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        display_name: item.display_name,
        description: item.description || null,
        sort_order: item.sort_order || 0,
        is_active: item.is_active !== false,
        is_system: item.is_system || false,
        color: item.color || null,
        icon: item.icon || null,
        metadata: item.metadata || {},
        created_by: userData?.user?.id || null
      })
      .select()
      .single();

    if (error) throw error;

    await this.logAudit(data.id, 'create', null, null, JSON.stringify(data), userData?.user?.id);

    return data;
  },

  async update(id, updates) {
    const { data: userData } = await supabase.auth.getUser();

    const existing = await this.getById(id);
    if (!existing) throw new Error('Reference data not found');

    const { data, error } = await supabase
      .from('reference_data')
      .update({
        display_name: updates.display_name,
        description: updates.description,
        sort_order: updates.sort_order,
        is_active: updates.is_active,
        color: updates.color,
        icon: updates.icon,
        metadata: updates.metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const changedFields = [];
    if (existing.display_name !== updates.display_name) {
      changedFields.push({ field: 'display_name', old: existing.display_name, new: updates.display_name });
    }
    if (existing.is_active !== updates.is_active) {
      changedFields.push({ field: 'is_active', old: String(existing.is_active), new: String(updates.is_active) });
    }
    if (existing.color !== updates.color) {
      changedFields.push({ field: 'color', old: existing.color, new: updates.color });
    }

    for (const change of changedFields) {
      await this.logAudit(id, 'update', change.field, change.old, change.new, userData?.user?.id);
    }

    return data;
  },

  async delete(id) {
    const { data: userData } = await supabase.auth.getUser();

    const existing = await this.getById(id);
    if (!existing) throw new Error('Reference data not found');

    if (existing.is_system) {
      throw new Error('Cannot delete system reference data');
    }

    const usage = await this.checkUsage(existing.category, existing.code);
    if (usage.total > 0) {
      throw new Error(`Cannot delete - this value is used in ${usage.total} records. Deactivate instead.`);
    }

    const { error } = await supabase
      .from('reference_data')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await this.logAudit(id, 'delete', null, JSON.stringify(existing), null, userData?.user?.id);
  },

  async deactivate(id, reason = null) {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('reference_data')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit(id, 'deactivate', 'is_active', 'true', 'false', userData?.user?.id, reason);

    return data;
  },

  async reactivate(id) {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('reference_data')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit(id, 'reactivate', 'is_active', 'false', 'true', userData?.user?.id);

    return data;
  },

  async checkUsage(category, code) {
    const usage = { total: 0, details: [] };

    const tableFieldMap = {
      configuration_type: [{ table: 'facilities', field: 'site_configuration' }],
      facility_type: [{ table: 'facilities', field: 'facility_type' }],
      organization_type: [{ table: 'organizations', field: 'type' }],
      equipment_type: [{ table: 'equipment', field: 'equipment_type' }],
      equipment_status: [{ table: 'equipment', field: 'equipment_status' }],
      milestone_category: [
        { table: 'milestones', field: 'category' },
        { table: 'milestone_templates', field: 'category' }
      ],
      milestone_status: [{ table: 'milestones', field: 'status' }],
      responsible_party: [{ table: 'milestones', field: 'responsible_party' }],
      ticket_priority: [{ table: 'support_tickets', field: 'priority' }],
      ticket_status: [{ table: 'support_tickets', field: 'status' }],
      ticket_category: [{ table: 'support_tickets', field: 'category' }],
      deployment_phase: [{ table: 'facilities', field: 'deployment_phase' }],
      us_state: [{ table: 'facilities', field: 'state' }]
    };

    const mappings = tableFieldMap[category] || [];

    for (const mapping of mappings) {
      try {
        const { count, error } = await supabase
          .from(mapping.table)
          .select('*', { count: 'exact', head: true })
          .eq(mapping.field, code);

        if (!error && count > 0) {
          usage.total += count;
          usage.details.push({ table: mapping.table, field: mapping.field, count });
        }
      } catch (e) {
        console.error(`Error checking usage in ${mapping.table}:`, e);
      }
    }

    return usage;
  },

  async migrateRecords(category, oldCode, newCode) {
    const { data: userData } = await supabase.auth.getUser();

    const tableFieldMap = {
      configuration_type: [{ table: 'facilities', field: 'site_configuration' }],
      facility_type: [{ table: 'facilities', field: 'facility_type' }],
      organization_type: [{ table: 'organizations', field: 'type' }],
      equipment_type: [{ table: 'equipment', field: 'equipment_type' }],
      equipment_status: [{ table: 'equipment', field: 'equipment_status' }],
      milestone_category: [
        { table: 'milestones', field: 'category' },
        { table: 'milestone_templates', field: 'category' }
      ],
      milestone_status: [{ table: 'milestones', field: 'status' }],
      responsible_party: [{ table: 'milestones', field: 'responsible_party' }],
      ticket_priority: [{ table: 'support_tickets', field: 'priority' }],
      ticket_status: [{ table: 'support_tickets', field: 'status' }],
      ticket_category: [{ table: 'support_tickets', field: 'category' }],
      deployment_phase: [{ table: 'facilities', field: 'deployment_phase' }],
      us_state: [{ table: 'facilities', field: 'state' }]
    };

    const mappings = tableFieldMap[category] || [];
    let totalMigrated = 0;

    for (const mapping of mappings) {
      try {
        const { data, error } = await supabase
          .from(mapping.table)
          .update({ [mapping.field]: newCode })
          .eq(mapping.field, oldCode)
          .select();

        if (!error && data) {
          totalMigrated += data.length;
        }
      } catch (e) {
        console.error(`Error migrating ${mapping.table}:`, e);
      }
    }

    const oldRef = await this.getByCode(category, oldCode);
    if (oldRef) {
      await this.logAudit(
        oldRef.id,
        'migrate',
        'records_migrated',
        oldCode,
        newCode,
        userData?.user?.id,
        `Migrated ${totalMigrated} records to ${newCode}`
      );
    }

    return { migrated: totalMigrated };
  },

  async updateSortOrder(items) {
    for (const item of items) {
      await supabase
        .from('reference_data')
        .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
        .eq('id', item.id);
    }
  },

  async logAudit(referenceDataId, action, fieldChanged, oldValue, newValue, changedBy, reason = null) {
    try {
      await supabase
        .from('reference_data_audit')
        .insert({
          reference_data_id: referenceDataId,
          action,
          field_changed: fieldChanged,
          old_value: oldValue,
          new_value: newValue,
          changed_by: changedBy,
          reason
        });
    } catch (e) {
      console.error('Error logging audit:', e);
    }
  },

  async getAuditLog(referenceDataId = null, limit = 50) {
    let query = supabase
      .from('reference_data_audit')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (referenceDataId) {
      query = query.eq('reference_data_id', referenceDataId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};

export const CATEGORY_GROUPS = {
  'Core Types': ['configuration_type', 'facility_type', 'organization_type'],
  'Equipment': ['equipment_type', 'equipment_status', 'procurement_method'],
  'Milestones': ['milestone_category', 'milestone_status', 'responsible_party', 'deployment_phase'],
  'Support': ['ticket_priority', 'ticket_status', 'ticket_category'],
  'Compliance': ['clia_certificate_type', 'accreditation_body', 'pt_provider'],
  'Integration': ['lis_provider'],
  'System': ['user_role', 'notification_type', 'us_state']
};

export const CATEGORY_LABELS = {
  configuration_type: 'Configuration Types',
  facility_type: 'Facility Types',
  organization_type: 'Organization Types',
  equipment_type: 'Equipment Types',
  equipment_status: 'Equipment Status',
  procurement_method: 'Procurement Methods',
  milestone_category: 'Milestone Categories',
  milestone_status: 'Milestone Status',
  responsible_party: 'Responsible Parties',
  deployment_phase: 'Deployment Phases',
  ticket_priority: 'Ticket Priority',
  ticket_status: 'Ticket Status',
  ticket_category: 'Ticket Categories',
  clia_certificate_type: 'CLIA Certificate Types',
  accreditation_body: 'Accreditation Bodies',
  pt_provider: 'PT Providers',
  lis_provider: 'LIS Providers',
  user_role: 'User Roles',
  notification_type: 'Notification Types',
  us_state: 'US States'
};
