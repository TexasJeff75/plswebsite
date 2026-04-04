
/*
  # Fix Auth RLS Initialization Plan Performance

  ## Summary
  Replaces bare `auth.uid()` calls with `(select auth.uid())` in all affected
  RLS policies. This prevents PostgreSQL from re-evaluating the auth function
  for every row, significantly improving query performance at scale.
*/

-- ============================================================
-- user_organization_assignments
-- ============================================================
DROP POLICY IF EXISTS "Users can view organization assignments" ON user_organization_assignments;
CREATE POLICY "Users can view organization assignments"
  ON user_organization_assignments FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR user_id = (SELECT auth.uid())
  );

-- ============================================================
-- milestones
-- ============================================================
DROP POLICY IF EXISTS "Users can view milestones" ON milestones;
DROP POLICY IF EXISTS "Users can insert milestones" ON milestones;
DROP POLICY IF EXISTS "Users can update milestones" ON milestones;

CREATE POLICY "Users can view milestones"
  ON milestones FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert milestones"
  ON milestones FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update milestones"
  ON milestones FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- notes
-- ============================================================
DROP POLICY IF EXISTS "Users can view notes" ON notes;
DROP POLICY IF EXISTS "Users can insert notes" ON notes;
DROP POLICY IF EXISTS "Users can update notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;

CREATE POLICY "Users can view notes"
  ON notes FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = notes.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert notes"
  ON notes FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = notes.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update notes"
  ON notes FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR created_by = (SELECT auth.uid())
  );

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR created_by = (SELECT auth.uid())
  );

-- ============================================================
-- documents
-- ============================================================
DROP POLICY IF EXISTS "Users can view documents" ON documents;
DROP POLICY IF EXISTS "Users can insert documents" ON documents;
DROP POLICY IF EXISTS "Users can update documents" ON documents;

CREATE POLICY "Users can view documents"
  ON documents FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update documents"
  ON documents FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR uploaded_by = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR uploaded_by = (SELECT auth.uid())
  );

-- ============================================================
-- facilities
-- ============================================================
DROP POLICY IF EXISTS "Users can view accessible facilities" ON facilities;
DROP POLICY IF EXISTS "Users can view facilities in accessible organizations" ON facilities;
DROP POLICY IF EXISTS "Internal users can create facilities" ON facilities;
DROP POLICY IF EXISTS "Users can update accessible facilities" ON facilities;

CREATE POLICY "Users can view accessible facilities"
  ON facilities FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = facilities.organization_id
    )
  );

CREATE POLICY "Internal users can create facilities"
  ON facilities FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.role = ANY (ARRAY['Admin', 'Manager'])
    )
  );

CREATE POLICY "Users can update accessible facilities"
  ON facilities FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = facilities.organization_id
    )
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = facilities.organization_id
        AND ur.role = 'Customer Admin'
    )
  );

-- ============================================================
-- equipment
-- ============================================================
DROP POLICY IF EXISTS "Users can view equipment" ON equipment;
DROP POLICY IF EXISTS "Users can insert equipment" ON equipment;
DROP POLICY IF EXISTS "Users can update equipment" ON equipment;

CREATE POLICY "Users can view equipment"
  ON equipment FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert equipment"
  ON equipment FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update equipment"
  ON equipment FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id AND uoa.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- organizations
-- ============================================================
DROP POLICY IF EXISTS "Users can view accessible organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update accessible organizations" ON organizations;

CREATE POLICY "Users can view accessible organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = organizations.id
    )
  );

CREATE POLICY "Users can update accessible organizations"
  ON organizations FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = organizations.id
        AND uoa.role = ANY (ARRAY['Admin', 'Manager'])
    )
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = organizations.id
        AND uoa.role = ANY (ARRAY['Admin', 'Manager'])
    )
  );

-- ============================================================
-- projects
-- ============================================================
DROP POLICY IF EXISTS "External users can read their organization projects" ON projects;

CREATE POLICY "External users can read their organization projects"
  ON projects FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = projects.organization_id
    )
  );

-- ============================================================
-- tracker_organizations
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert tracker organizations" ON tracker_organizations;
DROP POLICY IF EXISTS "Admins and managers can update tracker organizations" ON tracker_organizations;
DROP POLICY IF EXISTS "Admins can delete tracker organizations" ON tracker_organizations;

CREATE POLICY "Admins and managers can insert tracker organizations"
  ON tracker_organizations FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can update tracker organizations"
  ON tracker_organizations FOR UPDATE TO authenticated
  USING ((SELECT is_internal_user()) = true)
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins can delete tracker organizations"
  ON tracker_organizations FOR DELETE TO authenticated
  USING ((SELECT is_internal_user()) = true);

-- ============================================================
-- tracker_projects
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert tracker projects" ON tracker_projects;
DROP POLICY IF EXISTS "Admins and managers can update tracker projects" ON tracker_projects;
DROP POLICY IF EXISTS "Admins can delete tracker projects" ON tracker_projects;

CREATE POLICY "Admins and managers can insert tracker projects"
  ON tracker_projects FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can update tracker projects"
  ON tracker_projects FOR UPDATE TO authenticated
  USING ((SELECT is_internal_user()) = true)
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins can delete tracker projects"
  ON tracker_projects FOR DELETE TO authenticated
  USING ((SELECT is_internal_user()) = true);

-- ============================================================
-- tracker_facilities
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert tracker facilities" ON tracker_facilities;
DROP POLICY IF EXISTS "Admins and managers can update tracker facilities" ON tracker_facilities;
DROP POLICY IF EXISTS "Admins can delete tracker facilities" ON tracker_facilities;

CREATE POLICY "Admins and managers can insert tracker facilities"
  ON tracker_facilities FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can update tracker facilities"
  ON tracker_facilities FOR UPDATE TO authenticated
  USING ((SELECT is_internal_user()) = true)
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins can delete tracker facilities"
  ON tracker_facilities FOR DELETE TO authenticated
  USING ((SELECT is_internal_user()) = true);

-- ============================================================
-- deployment_organizations
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view deployment orgs they have access t" ON deployment_organizations;
DROP POLICY IF EXISTS "Admins and managers can insert deployment orgs" ON deployment_organizations;
DROP POLICY IF EXISTS "Admins and managers can update deployment orgs" ON deployment_organizations;
DROP POLICY IF EXISTS "Admins can delete deployment orgs" ON deployment_organizations;

CREATE POLICY "Authenticated users can view deployment orgs they have access t"
  ON deployment_organizations FOR SELECT TO authenticated
  USING ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can insert deployment orgs"
  ON deployment_organizations FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can update deployment orgs"
  ON deployment_organizations FOR UPDATE TO authenticated
  USING ((SELECT is_internal_user()) = true)
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins can delete deployment orgs"
  ON deployment_organizations FOR DELETE TO authenticated
  USING ((SELECT is_internal_user()) = true);

-- ============================================================
-- deployment_projects
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view deployment projects they have acce" ON deployment_projects;
DROP POLICY IF EXISTS "Admins and managers can insert deployment projects" ON deployment_projects;
DROP POLICY IF EXISTS "Admins and managers can update deployment projects" ON deployment_projects;
DROP POLICY IF EXISTS "Admins can delete deployment projects" ON deployment_projects;

CREATE POLICY "Authenticated users can view deployment projects they have acce"
  ON deployment_projects FOR SELECT TO authenticated
  USING ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can insert deployment projects"
  ON deployment_projects FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can update deployment projects"
  ON deployment_projects FOR UPDATE TO authenticated
  USING ((SELECT is_internal_user()) = true)
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins can delete deployment projects"
  ON deployment_projects FOR DELETE TO authenticated
  USING ((SELECT is_internal_user()) = true);

-- ============================================================
-- deployment_facilities
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view deployment facilities they have ac" ON deployment_facilities;
DROP POLICY IF EXISTS "Admins and managers can insert deployment facilities" ON deployment_facilities;
DROP POLICY IF EXISTS "Admins and managers can update deployment facilities" ON deployment_facilities;
DROP POLICY IF EXISTS "Admins can delete deployment facilities" ON deployment_facilities;

CREATE POLICY "Authenticated users can view deployment facilities they have ac"
  ON deployment_facilities FOR SELECT TO authenticated
  USING ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can insert deployment facilities"
  ON deployment_facilities FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins and managers can update deployment facilities"
  ON deployment_facilities FOR UPDATE TO authenticated
  USING ((SELECT is_internal_user()) = true)
  WITH CHECK ((SELECT is_internal_user()) = true);

CREATE POLICY "Admins can delete deployment facilities"
  ON deployment_facilities FOR DELETE TO authenticated
  USING ((SELECT is_internal_user()) = true);

-- ============================================================
-- lab_orders
-- ============================================================
DROP POLICY IF EXISTS "Users can view their organization lab orders" ON lab_orders;
DROP POLICY IF EXISTS "Customer admins can manage their organization lab orders" ON lab_orders;

CREATE POLICY "Users can view their organization lab orders"
  ON lab_orders FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = lab_orders.organization_id
    )
  );

CREATE POLICY "Customer admins can manage their organization lab orders"
  ON lab_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = lab_orders.organization_id
        AND ur.role = 'Customer Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = lab_orders.organization_id
        AND ur.role = 'Customer Admin'
    )
  );

-- ============================================================
-- lab_order_confirmations (uses organization_id column)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their organization lab confirmations" ON lab_order_confirmations;

CREATE POLICY "Users can view their organization lab confirmations"
  ON lab_order_confirmations FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR organization_id IN (
      SELECT uoa.organization_id FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- lab_results (uses organization_id column)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their organization lab results" ON lab_results;

CREATE POLICY "Users can view their organization lab results"
  ON lab_results FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR organization_id IN (
      SELECT uoa.organization_id FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- facility_tasks
-- ============================================================
DROP POLICY IF EXISTS "Users can view facility tasks for accessible facilities" ON facility_tasks;
DROP POLICY IF EXISTS "Users can view tasks for accessible facilities" ON facility_tasks;
DROP POLICY IF EXISTS "Users can create facility tasks for accessible facilities" ON facility_tasks;
DROP POLICY IF EXISTS "Users can update facility tasks they own or admin" ON facility_tasks;
DROP POLICY IF EXISTS "Admins and creators can delete facility tasks" ON facility_tasks;

CREATE POLICY "Users can view facility tasks for accessible facilities"
  ON facility_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create facility tasks for accessible facilities"
  ON facility_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = (SELECT auth.uid())
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Users can update facility tasks they own or admin"
  ON facility_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR created_by IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = (SELECT auth.uid())
        AND ur.role = 'Customer Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR created_by IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = (SELECT auth.uid())
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Admins and creators can delete facility tasks"
  ON facility_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR created_by IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = (SELECT auth.uid())
        AND ur.role = 'Customer Admin'
    )
  );

-- ============================================================
-- task_comments
-- ============================================================
DROP POLICY IF EXISTS "Users can view comments for accessible tasks" ON task_comments;
DROP POLICY IF EXISTS "Users can add comments to accessible tasks" ON task_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON task_comments;
DROP POLICY IF EXISTS "Users can delete own comments, admins can delete any" ON task_comments;

CREATE POLICY "Users can view comments for accessible tasks"
  ON task_comments FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facility_tasks ft
      JOIN facilities f ON f.id = ft.facility_id
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE ft.id = task_comments.task_id
        AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can add comments to accessible tasks"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facility_tasks ft
      JOIN facilities f ON f.id = ft.facility_id
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE ft.id = task_comments.task_id
        AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update their own comments"
  ON task_comments FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own comments, admins can delete any"
  ON task_comments FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT is_internal_user()) = true
  );

-- ============================================================
-- stratus_facility_mappings
-- ============================================================
DROP POLICY IF EXISTS "Users can view their organization StratusDX mappings" ON stratus_facility_mappings;
DROP POLICY IF EXISTS "Customer admins can manage their organization StratusDX mapping" ON stratus_facility_mappings;

CREATE POLICY "Users can view their organization StratusDX mappings"
  ON stratus_facility_mappings FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = stratus_facility_mappings.organization_id
    )
  );

CREATE POLICY "Customer admins can manage their organization StratusDX mapping"
  ON stratus_facility_mappings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = stratus_facility_mappings.organization_id
        AND ur.role = 'Customer Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = stratus_facility_mappings.organization_id
        AND ur.role = 'Customer Admin'
    )
  );

-- ============================================================
-- stratus_orders
-- ============================================================
DROP POLICY IF EXISTS "Users can view orders for their organizations" ON stratus_orders;
DROP POLICY IF EXISTS "Users can create orders for their organizations" ON stratus_orders;

CREATE POLICY "Users can view orders for their organizations"
  ON stratus_orders FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = stratus_orders.organization_id
    )
  );

CREATE POLICY "Users can create orders for their organizations"
  ON stratus_orders FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = stratus_orders.organization_id
    )
  );

-- ============================================================
-- stratus_confirmations (uses order_id -> stratus_orders)
-- ============================================================
DROP POLICY IF EXISTS "Users can view confirmations for their organizations" ON stratus_confirmations;

CREATE POLICY "Users can view confirmations for their organizations"
  ON stratus_confirmations FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR order_id IN (
      SELECT so.id FROM stratus_orders so
      WHERE so.organization_id IN (
        SELECT uoa.organization_id FROM user_organization_assignments uoa
        WHERE uoa.user_id = (SELECT auth.uid())
      )
    )
  );

-- ============================================================
-- stratus_results (uses order_id -> stratus_orders)
-- ============================================================
DROP POLICY IF EXISTS "Users can view results for their organizations" ON stratus_results;

CREATE POLICY "Users can view results for their organizations"
  ON stratus_results FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR order_id IN (
      SELECT so.id FROM stratus_orders so
      WHERE so.organization_id IN (
        SELECT uoa.organization_id FROM user_organization_assignments uoa
        WHERE uoa.user_id = (SELECT auth.uid())
      )
    )
  );

-- ============================================================
-- activity_log
-- ============================================================
DROP POLICY IF EXISTS "Users can view activity log" ON activity_log;
DROP POLICY IF EXISTS "Users can insert activity log" ON activity_log;

CREATE POLICY "Users can view activity log"
  ON activity_log FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (SELECT auth.uid())
        AND uoa.organization_id = activity_log.organization_id
    )
  );

CREATE POLICY "Users can insert activity log"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- sales_reps
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Proximity Admin can insert sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Proximity Admin can update sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Proximity Admin can delete sales reps" ON sales_reps;

CREATE POLICY "Proximity Admin and Staff can view sales reps"
  ON sales_reps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert sales reps"
  ON sales_reps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update sales reps"
  ON sales_reps FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can delete sales reps"
  ON sales_reps FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- qbo_invoices
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view qbo invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Proximity Admin can insert qbo invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Proximity Admin can update qbo invoices" ON qbo_invoices;

CREATE POLICY "Proximity Admin and Staff can view qbo invoices"
  ON qbo_invoices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert qbo invoices"
  ON qbo_invoices FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update qbo invoices"
  ON qbo_invoices FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- commission_rules
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Proximity Admin can insert commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Proximity Admin can update commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Proximity Admin can delete commission rules" ON commission_rules;

CREATE POLICY "Proximity Admin and Staff can view commission rules"
  ON commission_rules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert commission rules"
  ON commission_rules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update commission rules"
  ON commission_rules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can delete commission rules"
  ON commission_rules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- qbo_invoice_line_items
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view invoice line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Proximity Admin can insert invoice line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Proximity Admin can update invoice line items" ON qbo_invoice_line_items;

CREATE POLICY "Proximity Admin and Staff can view invoice line items"
  ON qbo_invoice_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert invoice line items"
  ON qbo_invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update invoice line items"
  ON qbo_invoice_line_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- commission_periods
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Proximity Admin can insert commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Proximity Admin can update commission periods" ON commission_periods;

CREATE POLICY "Proximity Admin and Staff can view commission periods"
  ON commission_periods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert commission periods"
  ON commission_periods FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update commission periods"
  ON commission_periods FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- commission_report_items
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view report items" ON commission_report_items;
DROP POLICY IF EXISTS "Proximity Admin can insert report items" ON commission_report_items;
DROP POLICY IF EXISTS "Proximity Admin can update report items" ON commission_report_items;

CREATE POLICY "Proximity Admin and Staff can view report items"
  ON commission_report_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert report items"
  ON commission_report_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update report items"
  ON commission_report_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- commission_calculations
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Proximity Admin can insert commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Proximity Admin can update commission calculations" ON commission_calculations;

CREATE POLICY "Proximity Admin and Staff can view commission calculations"
  ON commission_calculations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert commission calculations"
  ON commission_calculations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update commission calculations"
  ON commission_calculations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- commission_reports
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Proximity Admin can insert commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Proximity Admin can update commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Proximity Admin can delete commission reports" ON commission_reports;

CREATE POLICY "Proximity Admin and Staff can view commission reports"
  ON commission_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert commission reports"
  ON commission_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can update commission reports"
  ON commission_reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Proximity Admin can delete commission reports"
  ON commission_reports FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- n8n_webhook_logs
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view webhook logs" ON n8n_webhook_logs;
DROP POLICY IF EXISTS "Proximity Admin can insert webhook logs" ON n8n_webhook_logs;

CREATE POLICY "Proximity Admin and Staff can view webhook logs"
  ON n8n_webhook_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity Admin can insert webhook logs"
  ON n8n_webhook_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- commission_settings
-- ============================================================
DROP POLICY IF EXISTS "Staff can read commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Staff can insert commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Staff can update commission settings" ON commission_settings;

CREATE POLICY "Staff can read commission settings"
  ON commission_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Staff can insert commission settings"
  ON commission_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

CREATE POLICY "Staff can update commission settings"
  ON commission_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- ============================================================
-- qb_import_batches
-- ============================================================
DROP POLICY IF EXISTS "Proximity staff can view import batches" ON qb_import_batches;
DROP POLICY IF EXISTS "Proximity staff can insert import batches" ON qb_import_batches;

CREATE POLICY "Proximity staff can view import batches"
  ON qb_import_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Proximity staff can insert import batches"
  ON qb_import_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin', 'Account Manager', 'Technical Consultant', 'Compliance Specialist')
    )
  );

-- ============================================================
-- user_roles
-- ============================================================
DROP POLICY IF EXISTS "Users can read accessible roles" ON user_roles;

CREATE POLICY "Users can read accessible roles"
  ON user_roles FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR user_id = (SELECT auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
  );

-- ============================================================
-- milestone_tasks
-- ============================================================
DROP POLICY IF EXISTS "Users can create tasks for accessible facilities" ON milestone_tasks;
DROP POLICY IF EXISTS "Users can update milestone tasks they own or admin" ON milestone_tasks;
DROP POLICY IF EXISTS "Task creators and admins can delete milestone tasks" ON milestone_tasks;

CREATE POLICY "Users can create tasks for accessible facilities"
  ON milestone_tasks FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestone_tasks.facility_id
        AND uoa.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update milestone tasks they own or admin"
  ON milestone_tasks FOR UPDATE TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR (SELECT is_internal_user()) = true
    OR (
      facility_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = milestone_tasks.facility_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  )
  WITH CHECK (
    created_by IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR (SELECT is_internal_user()) = true
    OR (
      facility_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = milestone_tasks.facility_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  );

CREATE POLICY "Task creators and admins can delete milestone tasks"
  ON milestone_tasks FOR DELETE TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = (SELECT auth.uid()))
    OR (SELECT is_internal_user()) = true
    OR (
      facility_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = milestone_tasks.facility_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  );

-- ============================================================
-- user_invitations
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all invitations" ON user_invitations;
DROP POLICY IF EXISTS "Account managers can view their invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins and creators can update invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON user_invitations;

CREATE POLICY "Admins can view all invitations"
  ON user_invitations FOR SELECT TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR invited_by = (SELECT auth.uid())
  );

CREATE POLICY "Admins can create invitations"
  ON user_invitations FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Admins and creators can update invitations"
  ON user_invitations FOR UPDATE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR invited_by = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT is_internal_user()) = true
    OR invited_by = (SELECT auth.uid())
  );

CREATE POLICY "Admins can delete invitations"
  ON user_invitations FOR DELETE TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR invited_by = (SELECT auth.uid())
  );
