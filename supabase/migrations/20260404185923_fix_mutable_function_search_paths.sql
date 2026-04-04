
/*
  # Fix Mutable Function Search Paths

  ## Summary
  Sets a fixed search_path on all functions that have a mutable search_path.
  This prevents potential schema injection attacks.

  ## Functions Fixed
  - update_facility_tasks_updated_at
  - update_milestone_tasks_updated_at
  - set_task_completed_at
  - update_facility_contacts_updated_at
  - set_document_replacement
  - calculate_facility_phase(uuid)
  - trigger_update_facility_stats
  - trigger_update_facility_stats_on_facility_change
*/

ALTER FUNCTION public.update_facility_tasks_updated_at() SET search_path = public;
ALTER FUNCTION public.update_milestone_tasks_updated_at() SET search_path = public;
ALTER FUNCTION public.set_task_completed_at() SET search_path = public;
ALTER FUNCTION public.update_facility_contacts_updated_at() SET search_path = public;
ALTER FUNCTION public.set_document_replacement() SET search_path = public;
ALTER FUNCTION public.calculate_facility_phase(uuid) SET search_path = public;
ALTER FUNCTION public.trigger_update_facility_stats() SET search_path = public;
ALTER FUNCTION public.trigger_update_facility_stats_on_facility_change() SET search_path = public;
