/*
  # Fix RLS Policy for Admin Document Access
  
  ## Issue
  Proximity Admin and Proximity Staff users couldn't view all documents even though
  they had admin roles. The RLS policy required specific organization assignments.
  
  ## Changes
  1. Updated "Users can view accessible documents" policy
     - Added admin bypass for facility documents
     - Added admin bypass for organization documents  
     - Maintains security for non-admins
  
  2. Policy now allows:
     - Proximity Admin/System Admin to view ALL documents
     - Non-admins see only documents they have access to via org/facility membership
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view accessible documents" ON unified_documents;

-- Recreate policy with admin bypass
CREATE POLICY "Users can view accessible documents"
  ON unified_documents FOR SELECT
  TO authenticated
  USING (
    CASE 
      -- Admins can see everything
      WHEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'System Admin')
      ) THEN true
      
      -- Facility documents: check facility access via organization
      WHEN entity_type = 'facility' THEN EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        WHERE f.id = entity_id
        AND uoa.user_id = auth.uid()
      )
      
      -- Equipment catalog: all authenticated users can view
      WHEN entity_type = 'equipment_catalog' THEN true
      
      -- Organization documents: check organization membership
      WHEN entity_type = 'organization' THEN EXISTS (
        SELECT 1 FROM user_organization_assignments uoa
        WHERE uoa.organization_id = entity_id
        AND uoa.user_id = auth.uid()
      )
      
      -- User documents: owner or admin
      WHEN entity_type = 'user' THEN (
        entity_id = auth.uid()
      )
      
      -- Default: deny access
      ELSE false
    END
  );
