/*
  # Add Ticket Message Notification Type
  
  1. Changes
    - Add 'ticket_message' to the allowed notification types
    - This enables notifications when new messages are posted to support tickets
  
  2. Purpose
    - Notify ticket creators when staff replies
    - Notify assigned staff when customers reply
    - Keep all stakeholders informed of ticket activity
*/

-- Drop the existing constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with the additional type
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('clia_expiring', 'pt_due', 'competency_due', 'sla_warning', 'milestone_blocked', 'ticket_assigned', 'ticket_message', 'general'));
