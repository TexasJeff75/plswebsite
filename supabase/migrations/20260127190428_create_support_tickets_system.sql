/*
  # Create Support Tickets System

  1. New Tables
    - `support_tickets`
      - Tracks customer support requests and issues
      - Includes priority, category, status, SLA tracking
      - Links to organizations and optionally sites
      - Assignment to staff members
    
    - `ticket_messages`
      - Conversation thread for each ticket
      - Supports attachments (stored as jsonb)
      - Internal notes visible only to staff

  2. Security
    - Enable RLS on all tables
    - Customers can view their organization's tickets
    - Staff can view all tickets
    - Assigned staff have full access to their tickets
    - Internal notes visible only to staff

  3. Indexes
    - Optimized for ticket lookups by organization, site, status
    - Message searches by ticket
    - SLA and priority queries
*/

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  
  ticket_number text UNIQUE NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  
  priority text DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  category text NOT NULL, -- 'technical', 'compliance', 'training', 'equipment', 'integration', 'other'
  status text DEFAULT 'open', -- 'open', 'in_progress', 'waiting_customer', 'waiting_vendor', 'resolved', 'closed'
  
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  sla_deadline timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ticket Messages Table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  
  message text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb, -- Array of {filename, url, size, type}
  is_internal boolean DEFAULT false, -- Internal notes visible only to staff
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Support Tickets Policies

-- Customers can read tickets from their organization
CREATE POLICY "Customers can read their organization tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

-- Customers can create tickets for their organization
CREATE POLICY "Customers can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Customers and assigned staff can update their tickets
CREATE POLICY "Users can update relevant tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Only admins can delete tickets
CREATE POLICY "Admins can delete tickets"
  ON support_tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'Proximity Admin'
    )
  );

-- Ticket Messages Policies

-- Users can read non-internal messages from accessible tickets
CREATE POLICY "Users can read ticket messages"
  ON ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        st.organization_id IN (
          SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
        )
      )
    )
    AND (
      is_internal = false
      OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
      )
    )
  );

-- Users can create messages on accessible tickets
CREATE POLICY "Users can create ticket messages"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        st.organization_id IN (
          SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
        )
        OR st.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() 
          AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
        )
      )
    )
    AND (
      is_internal = false
      OR EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
      )
    )
  );

-- Users can update their own messages
CREATE POLICY "Users can update their messages"
  ON ticket_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "Users can delete their messages"
  ON ticket_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_support_tickets_org_id ON support_tickets(organization_id);
CREATE INDEX idx_support_tickets_site_id ON support_tickets(site_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_category ON support_tickets(category);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_sla_deadline ON support_tickets(sla_deadline);

CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_user_id ON ticket_messages(user_id);
CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(created_at ASC);

-- Function to generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get the count of existing tickets and add 1
  SELECT COUNT(*) + 1 INTO counter FROM support_tickets;
  
  -- Format as TKT-XXXXXX
  new_number := 'TKT-' || LPAD(counter::TEXT, 6, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket numbers
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_ticket_messages_updated_at
  BEFORE UPDATE ON ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();