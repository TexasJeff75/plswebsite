/*
  # Add Order/Result Status Flags (Canceled, Rejected, Finalized)

  ## Overview
  The StratusDX API includes canceled_datetime, rejected_datetime, and
  finalized_datetime inside the order object. These are currently only
  buried in the JSON blob. This migration adds dedicated boolean flag
  columns and timestamp columns so orders/results can be filtered by
  status directly in SQL.

  ## New Columns on lab_orders
  - is_canceled (boolean, default false)
  - is_rejected (boolean, default false)
  - is_finalized (boolean, default false) -- true when finalized_datetime has a value
  - canceled_at (text) -- raw datetime string from API
  - rejected_at (text) -- raw datetime string from API
  - finalized_at (text) -- already exists as finalized_datetime, but adding for clarity

  ## New Columns on lab_results
  - is_canceled (boolean, default false)
  - is_rejected (boolean, default false)
  - is_finalized (boolean, default false)
  - canceled_at (text)
  - rejected_at (text)
  - finalized_at (text)

  ## Backfill
  Sets flags based on existing JSON data:
  - is_canceled = true WHERE canceled_datetime is non-empty
  - is_rejected = true WHERE rejected_datetime is non-empty
  - is_finalized = true WHERE finalized_datetime is non-empty
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'is_canceled') THEN
    ALTER TABLE lab_orders ADD COLUMN is_canceled boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'is_rejected') THEN
    ALTER TABLE lab_orders ADD COLUMN is_rejected boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'is_finalized') THEN
    ALTER TABLE lab_orders ADD COLUMN is_finalized boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'canceled_at') THEN
    ALTER TABLE lab_orders ADD COLUMN canceled_at text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'rejected_at') THEN
    ALTER TABLE lab_orders ADD COLUMN rejected_at text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'is_canceled') THEN
    ALTER TABLE lab_results ADD COLUMN is_canceled boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'is_rejected') THEN
    ALTER TABLE lab_results ADD COLUMN is_rejected boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'is_finalized') THEN
    ALTER TABLE lab_results ADD COLUMN is_finalized boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'canceled_at') THEN
    ALTER TABLE lab_results ADD COLUMN canceled_at text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'rejected_at') THEN
    ALTER TABLE lab_results ADD COLUMN rejected_at text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'finalized_at') THEN
    ALTER TABLE lab_results ADD COLUMN finalized_at text;
  END IF;
END $$;

-- Backfill lab_orders status flags from JSON
UPDATE lab_orders
SET
  canceled_at = NULLIF(order_data->'order'->>'canceled_datetime', ''),
  rejected_at = NULLIF(order_data->'order'->>'rejected_datetime', ''),
  is_canceled = COALESCE(NULLIF(order_data->'order'->>'canceled_datetime', '') IS NOT NULL, false),
  is_rejected = COALESCE(NULLIF(order_data->'order'->>'rejected_datetime', '') IS NOT NULL, false),
  is_finalized = COALESCE(NULLIF(order_data->'order'->>'finalized_datetime', '') IS NOT NULL, false)
WHERE order_data IS NOT NULL AND order_data != '{}'::jsonb;

-- Backfill lab_results status flags from JSON
UPDATE lab_results
SET
  canceled_at = NULLIF(result_data->'order'->>'canceled_datetime', ''),
  rejected_at = NULLIF(result_data->'order'->>'rejected_datetime', ''),
  finalized_at = NULLIF(result_data->'order'->>'finalized_datetime', ''),
  is_canceled = COALESCE(NULLIF(result_data->'order'->>'canceled_datetime', '') IS NOT NULL, false),
  is_rejected = COALESCE(NULLIF(result_data->'order'->>'rejected_datetime', '') IS NOT NULL, false),
  is_finalized = COALESCE(NULLIF(result_data->'order'->>'finalized_datetime', '') IS NOT NULL, false)
WHERE result_data IS NOT NULL AND result_data != '{}'::jsonb;

-- Indexes for filtering by status
CREATE INDEX IF NOT EXISTS idx_lab_orders_is_canceled ON lab_orders(is_canceled) WHERE is_canceled = true;
CREATE INDEX IF NOT EXISTS idx_lab_orders_is_rejected ON lab_orders(is_rejected) WHERE is_rejected = true;
CREATE INDEX IF NOT EXISTS idx_lab_orders_is_finalized ON lab_orders(is_finalized) WHERE is_finalized = true;
CREATE INDEX IF NOT EXISTS idx_lab_results_is_canceled ON lab_results(is_canceled) WHERE is_canceled = true;
CREATE INDEX IF NOT EXISTS idx_lab_results_is_rejected ON lab_results(is_rejected) WHERE is_rejected = true;
CREATE INDEX IF NOT EXISTS idx_lab_results_is_finalized ON lab_results(is_finalized) WHERE is_finalized = true;
