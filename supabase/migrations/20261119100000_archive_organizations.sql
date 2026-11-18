/*
  # Archive organizations

  An organization we no longer work with can be archived instead of deleted.
  Archived organizations are hidden from the main Organizations list and the
  Dashboard, but every record (facilities, orders, results, users) is kept,
  and the organization can be restored at any time.

  - organizations.archived_at: when it was archived (empty = active)
  - organizations.archived_by: who archived it

  Archiving uses the existing organization update permissions.
*/

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
