import { supabase } from '../lib/supabase';

export const supplyDeliveryService = {
  async getByOrderId(orderId) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .select(`
        *,
        courier:user_roles!fk_supply_deliveries_courier_user_roles(id, display_name, email)
      `)
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getByQrToken(token) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .select(`
        *,
        courier:user_roles!fk_supply_deliveries_courier_user_roles(id, display_name, email),
        order:supply_orders(
          id,
          order_number,
          status,
          notes,
          organization_id,
          facility:facilities(id, name, address, city, state, zip),
          items:supply_order_items(id, free_form_description, quantity_requested, quantity_fulfilled, notes, catalog_item:supply_catalog(id, name, unit))
        )
      `)
      .eq('qr_token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getByCourier(courierUserId) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .select(`
        *,
        order:supply_orders(
          id,
          order_number,
          status,
          facility:facilities(id, name, city, state, address)
        )
      `)
      .eq('assigned_courier_user_id', courierUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(deliveryData) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .insert(deliveryData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async confirmPickup(id, { courierTypedName, signatureBase64 }) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .update({
        picked_up_at: new Date().toISOString(),
        courier_typed_name_at_pickup: courierTypedName,
        picked_up_signature: signatureBase64,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async confirmDelivery(id, { recipientTypedName, recipientSignature, courierTypedName, latitude, longitude, timezone, localTimestamp }) {
    const { data, error } = await supabase
      .from('supply_deliveries')
      .update({
        delivered_at: new Date().toISOString(),
        recipient_typed_name: recipientTypedName,
        recipient_signature: recipientSignature,
        courier_typed_name: courierTypedName,
        delivery_latitude: latitude || null,
        delivery_longitude: longitude || null,
        delivery_timezone: timezone || '',
        delivery_local_timestamp: localTimestamp || '',
        qr_used: true,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
