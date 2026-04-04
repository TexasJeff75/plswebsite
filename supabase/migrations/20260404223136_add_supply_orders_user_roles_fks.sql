/*
  # Add foreign keys from supply_orders and supply_deliveries to user_roles

  ## Summary
  Adds named foreign key relationships to enable Supabase join queries from
  supply_orders and supply_deliveries to the user_roles table.
  These join via user_id so we can retrieve display names and emails.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_orders_requester_user_roles') THEN
    ALTER TABLE supply_orders
      ADD CONSTRAINT fk_supply_orders_requester_user_roles
      FOREIGN KEY (requested_by) REFERENCES user_roles(user_id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_orders_approver_user_roles') THEN
    ALTER TABLE supply_orders
      ADD CONSTRAINT fk_supply_orders_approver_user_roles
      FOREIGN KEY (approved_by) REFERENCES user_roles(user_id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_deliveries_courier_user_roles') THEN
    ALTER TABLE supply_deliveries
      ADD CONSTRAINT fk_supply_deliveries_courier_user_roles
      FOREIGN KEY (assigned_courier_user_id) REFERENCES user_roles(user_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_order_activity_actor_user_roles') THEN
    ALTER TABLE supply_order_activity
      ADD CONSTRAINT fk_supply_order_activity_actor_user_roles
      FOREIGN KEY (actor_user_id) REFERENCES user_roles(user_id) ON DELETE SET NULL;
  END IF;
END $$;
