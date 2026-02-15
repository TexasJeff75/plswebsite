import { supabase } from '../lib/supabase';

export const templatesService = {
  async getDeploymentTemplates(complexityLevel = null) {
    let query = supabase
      .from('deployment_templates')
      .select(`
        *,
        template_milestones(
          id,
          milestone_template:milestone_templates(id, title, category, applicable_complexity_levels),
          is_required,
          sort_order
        ),
        template_equipment(
          id,
          equipment:equipment_catalog(id, equipment_name, equipment_type, applicable_complexity_levels),
          quantity,
          is_required,
          sort_order
        )
      `)
      .order('created_at', { ascending: false });

    if (complexityLevel) {
      query = query.eq('target_complexity_level', complexityLevel);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getDeploymentTemplate(id) {
    const { data, error } = await supabase
      .from('deployment_templates')
      .select(`
        *,
        template_milestones(
          id,
          milestone_template_id,
          milestone_template:milestone_templates(id, title, category, phase, description, responsible_party_default, priority, applicable_complexity_levels, is_required_for_complexity),
          is_required,
          priority,
          sort_order
        ),
        template_equipment(
          id,
          equipment_catalog_id,
          equipment:equipment_catalog(id, equipment_name, equipment_type, manufacturer, applicable_complexity_levels, complexity_specific_notes),
          quantity,
          is_required,
          sort_order
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createDeploymentTemplate(template) {
    const { data, error } = await supabase
      .from('deployment_templates')
      .insert({
        template_name: template.template_name,
        template_type: template.template_type,
        description: template.description,
        target_complexity_level: template.target_complexity_level || 'CLIA Waived',
        is_incremental: template.is_incremental || false,
        organization_id: template.organization_id || null,
        is_system_template: template.is_system_template || false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateDeploymentTemplate(id, template) {
    const { data, error } = await supabase
      .from('deployment_templates')
      .update({
        template_name: template.template_name,
        template_type: template.template_type,
        description: template.description,
        target_complexity_level: template.target_complexity_level,
        is_incremental: template.is_incremental,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDeploymentTemplate(id) {
    const { error } = await supabase
      .from('deployment_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async duplicateDeploymentTemplate(id) {
    const original = await this.getDeploymentTemplate(id);
    if (!original) throw new Error('Template not found');

    const newTemplate = await this.createDeploymentTemplate({
      template_name: `${original.template_name} (Copy)`,
      template_type: original.template_type,
      description: original.description,
      organization_id: original.organization_id,
      is_system_template: false
    });

    if (original.template_milestones?.length > 0) {
      const milestones = original.template_milestones.map(tm => ({
        deployment_template_id: newTemplate.id,
        milestone_template_id: tm.milestone_template_id,
        is_required: tm.is_required,
        priority: tm.priority || 5,
        sort_order: tm.sort_order
      }));
      await supabase.from('template_milestones').insert(milestones);
    }

    if (original.template_equipment?.length > 0) {
      const equipment = original.template_equipment.map(te => ({
        template_id: newTemplate.id,
        equipment_catalog_id: te.equipment_catalog_id,
        quantity: te.quantity,
        is_required: te.is_required,
        sort_order: te.sort_order
      }));
      await supabase.from('template_equipment').insert(equipment);
    }

    return newTemplate;
  },

  async setTemplateMilestones(templateId, milestoneTemplateIds, priorities = {}) {
    await supabase
      .from('template_milestones')
      .delete()
      .eq('deployment_template_id', templateId);

    if (milestoneTemplateIds.length > 0) {
      const inserts = milestoneTemplateIds.map((id, index) => ({
        deployment_template_id: templateId,
        milestone_template_id: id,
        sort_order: index,
        priority: priorities[id] || 5
      }));
      const { error } = await supabase.from('template_milestones').insert(inserts);
      if (error) throw error;
    }
  },

  async setTemplateEquipment(templateId, equipmentCatalogIds) {
    await supabase
      .from('template_equipment')
      .delete()
      .eq('template_id', templateId);

    if (equipmentCatalogIds.length > 0) {
      const inserts = equipmentCatalogIds.map((id, index) => ({
        template_id: templateId,
        equipment_catalog_id: id,
        sort_order: index
      }));
      const { error } = await supabase.from('template_equipment').insert(inserts);
      if (error) throw error;
    }
  },

  async getMilestoneTemplates() {
    const { data, error } = await supabase
      .from('milestone_templates')
      .select('*')
      .order('category')
      .order('sort_order');

    if (error) throw error;
    return data || [];
  },

  async getMilestoneTemplate(id) {
    const { data, error } = await supabase
      .from('milestone_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createMilestoneTemplate(template) {
    const { data, error } = await supabase
      .from('milestone_templates')
      .insert({
        template_name: template.template_name || template.title,
        category: template.category,
        title: template.title,
        description: template.description,
        responsible_party_default: template.responsible_party_default,
        priority: template.priority || 5,
        applicable_complexity_levels: template.applicable_complexity_levels || ['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
        is_required_for_complexity: template.is_required_for_complexity !== false,
        dependencies: template.dependencies || [],
        phase: template.phase || null,
        organization_id: template.organization_id || null,
        is_system_template: template.is_system_template || false,
        sort_order: template.sort_order || 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateMilestoneTemplate(id, template) {
    const { data, error } = await supabase
      .from('milestone_templates')
      .update({
        template_name: template.template_name || template.title,
        category: template.category,
        title: template.title,
        description: template.description,
        responsible_party_default: template.responsible_party_default,
        priority: template.priority || 5,
        applicable_complexity_levels: template.applicable_complexity_levels,
        is_required_for_complexity: template.is_required_for_complexity,
        dependencies: template.dependencies || [],
        phase: template.phase || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteMilestoneTemplate(id) {
    const { error } = await supabase
      .from('milestone_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getEquipmentCatalog() {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .order('equipment_type')
      .order('equipment_name');

    if (error) throw error;
    return data || [];
  },

  async getEquipmentCatalogItem(id) {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createEquipmentCatalogItem(item) {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .insert({
        equipment_name: item.equipment_name,
        equipment_type: item.equipment_type,
        manufacturer: item.manufacturer || null,
        model_number: item.model_number || null,
        procurement_method_default: item.procurement_method_default || 'purchase',
        applicable_complexity_levels: item.applicable_complexity_levels || ['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
        complexity_specific_notes: item.complexity_specific_notes || null,
        notes: item.notes || null,
        organization_id: item.organization_id || null,
        is_system_item: item.is_system_item || false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEquipmentCatalogItem(id, item) {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .update({
        equipment_name: item.equipment_name,
        equipment_type: item.equipment_type,
        manufacturer: item.manufacturer || null,
        model_number: item.model_number || null,
        procurement_method_default: item.procurement_method_default || 'purchase',
        applicable_complexity_levels: item.applicable_complexity_levels,
        complexity_specific_notes: item.complexity_specific_notes,
        notes: item.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEquipmentCatalogItem(id) {
    const { error } = await supabase
      .from('equipment_catalog')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async applyTemplateToFacility(facilityId, templateId, options = {}) {
    const { deduplicateMilestones = true, deduplicateEquipment = true, targetComplexityLevel = null } = options;

    const template = await this.getDeploymentTemplate(templateId);
    if (!template) throw new Error('Template not found');

    const { data: facility } = await supabase
      .from('facilities')
      .select('complexity_level')
      .eq('id', facilityId)
      .maybeSingle();

    const facilityComplexityLevel = targetComplexityLevel || facility?.complexity_level || 'CLIA Waived';

    await supabase
      .from('facilities')
      .update({ deployment_template_id: templateId })
      .eq('id', facilityId);

    let addedMilestones = 0;
    let skippedMilestones = 0;

    if (template.template_milestones?.length > 0) {
      let existingMilestones = [];

      if (deduplicateMilestones) {
        const { data } = await supabase
          .from('milestones')
          .select('name, category')
          .eq('facility_id', facilityId);

        existingMilestones = data || [];
      }

      const existingMilestoneKeys = new Set(
        existingMilestones.map(m => `${m.category}:${m.name}`)
      );

      const milestones = template.template_milestones
        .filter(tm => {
          const mt = tm.milestone_template;
          if (!mt) return false;

          if (mt.applicable_complexity_levels && !mt.applicable_complexity_levels.includes(facilityComplexityLevel)) {
            return false;
          }

          const key = `${mt.category}:${mt.title}`;
          if (deduplicateMilestones && existingMilestoneKeys.has(key)) {
            skippedMilestones++;
            return false;
          }

          return true;
        })
        .map((tm, index) => ({
          facility_id: facilityId,
          name: tm.milestone_template?.title || 'Milestone',
          description: tm.milestone_template?.description || '',
          category: tm.milestone_template?.category || 'custom',
          phase: tm.milestone_template?.phase || null,
          responsible_party: tm.milestone_template?.responsible_party_default || 'Proximity',
          priority: tm.priority || tm.milestone_template?.priority || 5,
          milestone_order: index + 1,
          status: 'not_started'
        }));

      if (milestones.length > 0) {
        const { error } = await supabase.from('milestones').insert(milestones);
        if (error) throw error;
        addedMilestones = milestones.length;
      }
    }

    let addedEquipment = 0;
    let skippedEquipment = 0;

    if (template.template_equipment?.length > 0) {
      let existingEquipment = [];

      if (deduplicateEquipment) {
        const { data } = await supabase
          .from('equipment')
          .select('name, equipment_type')
          .eq('facility_id', facilityId);

        existingEquipment = data || [];
      }

      const existingEquipmentKeys = new Set(
        existingEquipment.map(e => `${e.equipment_type}:${e.name}`)
      );

      const equipment = template.template_equipment
        .filter(te => {
          const eq = te.equipment;
          if (!eq) return false;

          if (eq.applicable_complexity_levels && !eq.applicable_complexity_levels.includes(facilityComplexityLevel)) {
            return false;
          }

          const key = `${eq.equipment_type}:${eq.equipment_name}`;
          if (deduplicateEquipment && existingEquipmentKeys.has(key)) {
            skippedEquipment++;
            return false;
          }

          return true;
        })
        .map(te => ({
          facility_id: facilityId,
          name: te.equipment?.equipment_name || 'Equipment',
          equipment_type: te.equipment?.equipment_type,
          required: te.is_required,
          procurement_method: te.equipment?.procurement_method_default || 'purchase',
          status: 'Ordered',
          equipment_status: 'not_ordered',
          from_template: true,
          template_equipment_id: te.id
        }));

      if (equipment.length > 0) {
        const { error } = await supabase.from('equipment').insert(equipment);
        if (error) throw error;
        addedEquipment = equipment.length;
      }
    }

    return {
      success: true,
      addedMilestones,
      skippedMilestones,
      addedEquipment,
      skippedEquipment
    };
  },

  async syncTemplateToFacilities(templateId) {
    const { data, error } = await supabase.rpc('sync_template_equipment_to_facilities', {
      p_template_id: templateId
    });

    if (error) throw error;
    return data;
  },

  async syncTemplateToFacility(facilityId, templateId) {
    const template = await this.getDeploymentTemplate(templateId);
    if (!template) throw new Error('Template not found');

    const { data: existingEquipment } = await supabase
      .from('equipment')
      .select('equipment_type')
      .eq('facility_id', facilityId);

    const existingTypes = new Set(existingEquipment?.map(e => e.equipment_type) || []);

    if (template.template_equipment?.length > 0) {
      const newEquipment = template.template_equipment
        .filter(te => !existingTypes.has(te.equipment?.equipment_type))
        .map(te => ({
          facility_id: facilityId,
          name: te.equipment?.equipment_name || 'Equipment',
          equipment_type: te.equipment?.equipment_type,
          required: te.is_required,
          procurement_method: te.equipment?.procurement_method_default || 'purchase',
          status: 'Not Ordered',
          equipment_status: 'not_ordered',
          from_template: true,
          template_equipment_id: te.id
        }));

      if (newEquipment.length > 0) {
        const { error } = await supabase.from('equipment').insert(newEquipment);
        if (error) throw error;
      }

      return { added: newEquipment.length };
    }

    return { added: 0 };
  },

  getComplexityLevels() {
    return ['CLIA Waived', 'Moderate Complexity', 'High Complexity'];
  },

  async getTemplatesForComplexityLevel(complexityLevel) {
    return this.getDeploymentTemplates(complexityLevel);
  },

  async getMilestonesForComplexityLevel(complexityLevel) {
    const { data, error } = await supabase
      .from('milestone_templates')
      .select('*')
      .contains('applicable_complexity_levels', [complexityLevel])
      .order('category')
      .order('sort_order');

    if (error) throw error;
    return data || [];
  },

  async getEquipmentForComplexityLevel(complexityLevel) {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .contains('applicable_complexity_levels', [complexityLevel])
      .order('equipment_type')
      .order('equipment_name');

    if (error) throw error;
    return data || [];
  }
};
