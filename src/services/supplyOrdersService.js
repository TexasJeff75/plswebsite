import { supabase } from '../lib/supabase';

const VALID_TRANSITIONS = {
  submitted: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  draft: ['submitted', 'cancelled'],
};

export const supplyOrdersService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('supply_orders')
      .select(`
        id,
        order_number,
        facility_id,
        organization_id,
        requested_by,
        approved_by,
        status,
        notes,
        cancel_reason,
        created_at,
        updated_at,
        facility:facilities(id, name, city, state),
        organization:organizations(id, name),
        requester:user_roles!fk_supply_orders_requester_user_roles(id, display_name, email),
        approver:user_roles!fk_supply_orders_approver_user_roles(id, display_name, email),
        items:supply_order_items(id, catalog_item_id, free_form_description, quantity_requested, quantity_fulfilled, notes, catalog_item:supply_catalog(id, name, unit)),
        delivery:supply_deliveries(id, assigned_courier_user_id, tracking_number, estimated_delivery_date, qr_token, qr_used, picked_up_at, delivered_at, courier:user_roles!fk_supply_deliveries_courier_user_roles(id, display_name, email))
      `)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.facility_id) query = query.eq('facility_id', filters.facility_id);
    if (filters.organization_id) query = query.eq('organization_id', filters.organization_id);
    if (filters.from_date) query = query.gte('created_at', filters.from_date);
    if (filters.to_date) query = query.lte('created_at', filters.to_date);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getByFacility(facilityId) {
    return this.getAll({ facility_id: facilityId });
  },

  async getByOrganization(orgId) {
    return this.getAll({ organization_id: orgId });
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('supply_orders')
      .select(`
        id,
        order_number,
        facility_id,
        organization_id,
        requested_by,
        approved_by,
        status,
        notes,
        cancel_reason,
        created_at,
        updated_at,
        facility:facilities(id, name, address, city, state, zip),
        organization:organizations(id, name, logo_storage_path),
        requester:user_roles!fk_supply_orders_requester_user_roles(id, display_name, email),
        approver:user_roles!fk_supply_orders_approver_user_roles(id, display_name, email),
        items:supply_order_items(id, catalog_item_id, free_form_description, quantity_requested, quantity_fulfilled, notes, catalog_item:supply_catalog(id, name, unit, category)),
        delivery:supply_deliveries(id, assigned_courier_user_id, tracking_number, estimated_delivery_date, qr_token, qr_used, picked_up_at, picked_up_signature, courier_typed_name_at_pickup, delivered_at, recipient_typed_name, recipient_signature, courier_typed_name, delivery_latitude, delivery_longitude, delivery_timezone, delivery_local_timestamp, courier:user_roles!fk_supply_deliveries_courier_user_roles(id, display_name, email)),
        activity:supply_order_activity(id, actor_user_id, action, from_status, to_status, notes, created_at, actor:user_roles!fk_supply_order_activity_actor_user_roles(id, display_name, email))
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create({ facilityId, organizationId, requestedBy, notes, items }) {
    const { data: order, error: orderError } = await supabase
      .from('supply_orders')
      .insert({
        facility_id: facilityId,
        organization_id: organizationId,
        requested_by: requestedBy,
        notes: notes || '',
        status: 'submitted',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    if (items && items.length > 0) {
      const itemRows = items.map(item => ({
        order_id: order.id,
        catalog_item_id: item.catalog_item_id || null,
        free_form_description: item.free_form_description || '',
        quantity_requested: item.quantity_requested,
        notes: item.notes || '',
      }));

      const { error: itemsError } = await supabase
        .from('supply_order_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;
    }

    await this._logActivity(order.id, requestedBy, 'Order created', null, 'submitted', notes);

    return order;
  },

  async updateStatus(id, newStatus, actorUserId, meta = {}) {
    const { data: order } = await supabase
      .from('supply_orders')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!order) throw new Error('Order not found');

    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
    }

    const updateData = { status: newStatus };
    if (newStatus === 'cancelled' && meta.cancel_reason) {
      updateData.cancel_reason = meta.cancel_reason;
    }
    if (meta.approved_by) {
      updateData.approved_by = meta.approved_by;
    }

    const { data, error } = await supabase
      .from('supply_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this._logActivity(id, actorUserId, `Status changed to ${newStatus}`, order.status, newStatus, meta.notes || '');

    return data;
  },

  async update(id, updates, actorUserId) {
    const { data, error } = await supabase
      .from('supply_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await this._logActivity(id, actorUserId, 'Order updated', null, null, '');

    return data;
  },

  async updateItemFulfillment(itemId, quantityFulfilled, orderId, actorUserId) {
    const { data, error } = await supabase
      .from('supply_order_items')
      .update({ quantity_fulfilled: quantityFulfilled })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    await this._logActivity(orderId, actorUserId, `Item fulfillment updated to ${quantityFulfilled}`, null, null, '');

    return data;
  },

  async getPendingCount() {
    const { count, error } = await supabase
      .from('supply_orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'processing']);

    if (error) return 0;
    return count || 0;
  },

  async _logActivity(orderId, actorUserId, action, fromStatus, toStatus, notes) {
    try {
      await supabase
        .from('supply_order_activity')
        .insert({
          order_id: orderId,
          actor_user_id: actorUserId,
          action,
          from_status: fromStatus,
          to_status: toStatus,
          notes: notes || '',
        });
    } catch (err) {
      console.error('Failed to log supply order activity:', err);
    }
  },
};
