/*
  # Fix unified_documents RLS policies for internal roles

  ## Problem
  1. The INSERT policy's `facility` and `organization` CASE branches only checked
     `user_organization_assignments`, blocking Proximity Staff, Proximity Admin,
     and Super Admin from uploading facility/org documents.
  2. All policies referenced `'System Admin'` which does not exist — the correct
     role name is `'Super Admin'`.

  ## Changes
  - DROP and recreate all four RLS policies on `unified_documents`
  - Add an internal-role short-circuit to each CASE branch in the INSERT policy
    so Proximity Staff, Proximity Admin, and Super Admin can always insert
  - Replace every `'System Admin'` reference with `'Super Admin'` across SELECT,
    UPDATE, and DELETE policies
*/

-- Helper: TRUE when the current user is an internal Proximity/Super Admin role
-- (used inline to avoid a separate function dependency)

-- ============================================================
-- DROP existing policies
-- ============================================================
DROP POLICY IF EXISTS "Users can insert documents for accessible entities" ON unified_documents;
DROP POLICY IF EXISTS "Users can view accessible documents" ON unified_documents;
DROP POLICY IF EXISTS "Users can update documents they uploaded or have admin rights" ON unified_documents;
DROP POLICY IF EXISTS "Admins and uploaders can delete documents" ON unified_documents;

-- ============================================================
-- INSERT policy
-- ============================================================
CREATE POLICY "Users can insert documents for accessible entities"
  ON unified_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Internal staff always allowed
    (EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = ANY (ARRAY['Proximity Admin', 'Proximity Staff', 'Super Admin'])
    ))
    OR
    CASE entity_type
      WHEN 'facility' THEN
        EXISTS (
          SELECT 1
          FROM facilities f
          JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
          WHERE f.id = unified_documents.entity_id
            AND uoa.user_id = (SELECT auth.uid())
        )
      WHEN 'equipment_catalog' THEN
        -- already covered by the top-level internal check; keep for symmetry
        false
      WHEN 'organization' THEN
        EXISTS (
          SELECT 1 FROM user_organization_assignments uoa
          WHERE uoa.organization_id = unified_documents.entity_id
            AND uoa.user_id = (SELECT auth.uid())
        )
      WHEN 'user' THEN
        entity_id = (SELECT auth.uid())
      ELSE false
    END
  );

-- ============================================================
-- SELECT policy
-- ============================================================
CREATE POLICY "Users can view accessible documents"
  ON unified_documents
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = (SELECT auth.uid())
          AND user_roles.role = ANY (ARRAY['Proximity Admin', 'Proximity Staff', 'Super Admin'])
      ) THEN true
      WHEN entity_type = 'facility' THEN
        EXISTS (
          SELECT 1
          FROM facilities f
          JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
          WHERE f.id = unified_documents.entity_id
            AND uoa.user_id = (SELECT auth.uid())
        )
      WHEN entity_type = 'equipment_catalog' THEN true
      WHEN entity_type = 'organization' THEN
        EXISTS (
          SELECT 1 FROM user_organization_assignments uoa
          WHERE uoa.organization_id = unified_documents.entity_id
            AND uoa.user_id = (SELECT auth.uid())
        )
      WHEN entity_type = 'user' THEN
        entity_id = (SELECT auth.uid())
      ELSE false
    END
  );

-- ============================================================
-- UPDATE policy
-- ============================================================
CREATE POLICY "Users can update documents they uploaded or have admin rights"
  ON unified_documents
  FOR UPDATE
  TO authenticated
  USING (
    (uploaded_by = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = ANY (ARRAY['Proximity Admin', 'Proximity Staff', 'Super Admin'])
    ))
    OR (
      entity_type = 'facility'
      AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
    OR (
      entity_type = 'organization'
      AND EXISTS (
        SELECT 1
        FROM user_organization_assignments uoa
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE uoa.organization_id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  )
  WITH CHECK (
    (uploaded_by = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = ANY (ARRAY['Proximity Admin', 'Proximity Staff', 'Super Admin'])
    ))
    OR (
      entity_type = 'facility'
      AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
    OR (
      entity_type = 'organization'
      AND EXISTS (
        SELECT 1
        FROM user_organization_assignments uoa
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE uoa.organization_id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  );

-- ============================================================
-- DELETE policy
-- ============================================================
CREATE POLICY "Admins and uploaders can delete documents"
  ON unified_documents
  FOR DELETE
  TO authenticated
  USING (
    (uploaded_by = (SELECT auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = ANY (ARRAY['Proximity Admin', 'Proximity Staff', 'Super Admin'])
    ))
    OR (
      entity_type = 'facility'
      AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
    OR (
      entity_type = 'organization'
      AND EXISTS (
        SELECT 1
        FROM user_organization_assignments uoa
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE uoa.organization_id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  );
