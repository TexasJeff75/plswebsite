/*
  # Remove Unused Indexes and Fix Function Search Paths

  ## Summary

  ### Part 1: Remove Unused Indexes
  Drops indexes that have never been used according to pg_stat_user_indexes.
  These indexes consume disk space and slow down write operations with no query benefit.

  ### Part 2: Fix Mutable Function Search Paths
  Sets explicit search_path on functions that have a mutable search_path,
  which is a security risk (search_path injection). Setting search_path = public
  prevents schema injection attacks.
*/

-- ============================================================
-- Part 1: Drop unused indexes
-- ============================================================

DROP INDEX IF EXISTS public.idx_unified_documents_retired_by;
DROP INDEX IF EXISTS public.idx_milestone_tasks_facility_id;
DROP INDEX IF EXISTS public.idx_milestone_tasks_status;
DROP INDEX IF EXISTS public.idx_user_invitations_token;
DROP INDEX IF EXISTS public.idx_user_invitations_status;
DROP INDEX IF EXISTS public.idx_lab_orders_organization;
DROP INDEX IF EXISTS public.idx_deployment_projects_org_id;
DROP INDEX IF EXISTS public.idx_deployment_facilities_project_id;
DROP INDEX IF EXISTS public.idx_deployment_facilities_status;
DROP INDEX IF EXISTS public.idx_deployment_projects_status;
DROP INDEX IF EXISTS public.idx_lab_confirmations_accession;
DROP INDEX IF EXISTS public.idx_lab_results_organization;
DROP INDEX IF EXISTS public.idx_lab_confirmations_organization;
DROP INDEX IF EXISTS public.idx_lab_results_accession;
DROP INDEX IF EXISTS public.idx_lab_results_sync_status;
DROP INDEX IF EXISTS public.idx_stratus_orders_status;
DROP INDEX IF EXISTS public.idx_stratus_orders_order_number;
DROP INDEX IF EXISTS public.idx_facility_tasks_facility_id;
DROP INDEX IF EXISTS public.idx_facility_tasks_milestone_id;
DROP INDEX IF EXISTS public.idx_facility_tasks_status;
DROP INDEX IF EXISTS public.idx_projects_status;
DROP INDEX IF EXISTS public.idx_facility_tasks_due_date;
DROP INDEX IF EXISTS public.idx_stratus_results_received_at;
DROP INDEX IF EXISTS public.idx_stratus_mappings_organization;
DROP INDEX IF EXISTS public.idx_stratus_mappings_stratus_facility;
DROP INDEX IF EXISTS public.idx_stratus_mappings_stratus_org;
DROP INDEX IF EXISTS public.idx_stratus_mappings_active;
DROP INDEX IF EXISTS public.idx_stratus_results_result_date;
DROP INDEX IF EXISTS public.idx_stratus_orders_guid;
DROP INDEX IF EXISTS public.idx_stratus_orders_test_method;
DROP INDEX IF EXISTS public.idx_stratus_orders_created_at;
DROP INDEX IF EXISTS public.idx_stratus_confirmations_order;
DROP INDEX IF EXISTS public.idx_stratus_confirmations_guid;
DROP INDEX IF EXISTS public.idx_stratus_confirmations_org_code;
DROP INDEX IF EXISTS public.idx_stratus_confirmations_received_at;
DROP INDEX IF EXISTS public.idx_stratus_results_order;
DROP INDEX IF EXISTS public.idx_stratus_results_guid;
DROP INDEX IF EXISTS public.idx_stratus_results_org_code;
DROP INDEX IF EXISTS public.idx_stratus_results_acknowledged;
DROP INDEX IF EXISTS public.idx_deployment_projects_org_id_lookup;
DROP INDEX IF EXISTS public.idx_stratus_orgs_code;
DROP INDEX IF EXISTS public.idx_stratus_orgs_active;
DROP INDEX IF EXISTS public.idx_stratus_test_methods_code;
DROP INDEX IF EXISTS public.idx_stratus_test_methods_active;
DROP INDEX IF EXISTS public.idx_stratus_orders_org;
DROP INDEX IF EXISTS public.idx_facility_contacts_is_primary;
DROP INDEX IF EXISTS public.idx_facilities_complexity_level;
DROP INDEX IF EXISTS public.idx_deployment_templates_target_complexity;
DROP INDEX IF EXISTS public.idx_milestone_templates_applicable_complexity;
DROP INDEX IF EXISTS public.idx_equipment_catalog_applicable_complexity;
DROP INDEX IF EXISTS public.idx_facility_contacts_role;
DROP INDEX IF EXISTS public.idx_qbo_invoices_status;
DROP INDEX IF EXISTS public.idx_commission_calcs_invoice;
DROP INDEX IF EXISTS public.idx_qbo_invoices_rep_name;

-- ============================================================
-- Part 2: Fix mutable function search paths
-- ============================================================

ALTER FUNCTION public.update_facility_tasks_updated_at() SET search_path = public;
ALTER FUNCTION public.update_milestone_tasks_updated_at() SET search_path = public;
ALTER FUNCTION public.set_task_completed_at() SET search_path = public;
ALTER FUNCTION public.update_facility_contacts_updated_at() SET search_path = public;
ALTER FUNCTION public.set_document_replacement() SET search_path = public;
ALTER FUNCTION public.calculate_facility_phase(uuid) SET search_path = public;
ALTER FUNCTION public.trigger_update_facility_stats() SET search_path = public;
ALTER FUNCTION public.trigger_update_facility_stats_on_facility_change() SET search_path = public;
