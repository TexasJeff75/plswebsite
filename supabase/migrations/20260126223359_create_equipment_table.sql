/*
  # Create Equipment Table

  1. New Tables
    - `equipment`
      - `id` (uuid, primary key) - Unique identifier
      - `facility_id` (uuid, foreign key) - Reference to facility
      - `device_type` (text) - Type of device
      - `device_name` (text) - Full device name
      - `status` (text) - Equipment status
      - `ordered_date` (date) - Date ordered
      - `shipped_date` (date) - Date shipped
      - `delivered_date` (date) - Date delivered
      - `installed_date` (date) - Date installed
      - `validated_date` (date) - Date validated
      - `trained_date` (date) - Date training completed
      - `serial_number` (text) - Device serial number
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Device Types
    - Siemens epoc (blood gas analyzer)
    - Diatron Abacus 3 (CBC)
    - Clarity Platinum (urinalysis)
    - Cepheid GeneXpert (molecular respiratory)

  3. Status Options
    - Ordered
    - Shipped
    - Delivered
    - Installed
    - Validated
    - Trained

  4. Security
    - Enable RLS on `equipment` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  device_type text NOT NULL,
  device_name text NOT NULL,
  status text NOT NULL DEFAULT 'Ordered',
  ordered_date date,
  shipped_date date,
  delivered_date date,
  installed_date date,
  validated_date date,
  trained_date date,
  serial_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_device_type CHECK (device_type IN ('Siemens epoc', 'Diatron Abacus 3', 'Clarity Platinum', 'Cepheid GeneXpert')),
  CONSTRAINT valid_equipment_status CHECK (status IN ('Ordered', 'Shipped', 'Delivered', 'Installed', 'Validated', 'Trained'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_facility ON equipment(facility_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(device_type);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert equipment"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipment"
  ON equipment FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete equipment"
  ON equipment FOR DELETE
  TO authenticated
  USING (true);