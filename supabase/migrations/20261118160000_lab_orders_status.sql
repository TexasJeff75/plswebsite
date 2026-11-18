/*
  # Lab order status for the StratusDX Data Viewer

  lab_orders.lab_status is worked out from the order's own dates, because the
  StratusDX status field is often empty on finalized orders:
    Canceled          canceled date set
    Rejected          rejected date set
    Final             finalized date set
    Pending Received  specimen received date set
    Pending           none of the above

  It is a stored generated column, so it stays correct as the sync updates an
  order. Indexes support the viewer's filters and its newest-first sort.
*/

ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS lab_status text GENERATED ALWAYS AS (
  CASE
    WHEN is_canceled THEN 'Canceled'
    WHEN is_rejected THEN 'Rejected'
    WHEN coalesce(finalized_datetime, '') <> '' THEN 'Final'
    WHEN coalesce(received_datetime, '') <> '' THEN 'Pending Received'
    ELSE 'Pending'
  END
) STORED;

CREATE INDEX IF NOT EXISTS idx_lab_orders_lab_status ON lab_orders(lab_status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_requisition_datetime ON lab_orders(requisition_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_lab_orders_received_datetime ON lab_orders(received_datetime);
CREATE INDEX IF NOT EXISTS idx_lab_orders_finalized_datetime ON lab_orders(finalized_datetime);
CREATE INDEX IF NOT EXISTS idx_stratus_result_observations_order ON stratus_result_observations(lab_order_id);
