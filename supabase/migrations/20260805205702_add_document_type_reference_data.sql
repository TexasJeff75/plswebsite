/*
# Add Document Types to Reference Data

## Summary
Seeds the existing hardcoded document types into the `reference_data` table under
the category `document_type`. This makes document types manageable through the
Reference Data settings panel instead of being hardcoded constants in the UI.

## Changes
- Inserts 14 document type entries into `reference_data` with `category = 'document_type'`.
- All entries are marked `is_system = true` so they cannot be accidentally deleted.
- Entries are marked `is_active = true` and ordered logically.
- Uses `ON CONFLICT` on the `(category, code)` unique constraint to be idempotent.

## New Reference Data Values
1. clia_certificate — CLIA Certificate
2. lab_director_agreement — Lab Director Agreement
3. implementation_acknowledgment — Implementation Acknowledgment
4. training_record — Training Record
5. competency_assessment — Competency Assessment
6. pt_report — PT Report
7. manual — Manual
8. specification — Specification
9. certificate — Certificate
10. report — Report
11. training_material — Training Material
12. regulatory — Regulatory Document
13. image — Image
14. other — Other

## Security
- No new tables created; uses existing `reference_data` table.
- No RLS policy changes needed — existing policies on `reference_data` already
  cover the `authenticated` role for CRUD operations.
*/

INSERT INTO reference_data (category, code, display_name, description, sort_order, is_active, is_system, color)
VALUES
  ('document_type', 'clia_certificate', 'CLIA Certificate', 'CLIA certification document', 0, true, true, '#ef4444'),
  ('document_type', 'lab_director_agreement', 'Lab Director Agreement', 'Lab director agreement document', 1, true, true, '#f59e0b'),
  ('document_type', 'implementation_acknowledgment', 'Implementation Acknowledgment', 'Implementation acknowledgment document', 2, true, true, '#8b5cf6'),
  ('document_type', 'training_record', 'Training Record', 'Training record document', 3, true, true, '#3b82f6'),
  ('document_type', 'competency_assessment', 'Competency Assessment', 'Competency assessment document', 4, true, true, '#06b6d4'),
  ('document_type', 'pt_report', 'PT Report', 'Proficiency testing report', 5, true, true, '#10b981'),
  ('document_type', 'manual', 'Manual', 'Equipment or system manual', 6, true, true, '#6b7280'),
  ('document_type', 'specification', 'Specification', 'Technical specification document', 7, true, true, '#6366f1'),
  ('document_type', 'certificate', 'Certificate', 'General certificate document', 8, true, true, '#14b8a6'),
  ('document_type', 'report', 'Report', 'General report document', 9, true, true, '#f97316'),
  ('document_type', 'training_material', 'Training Material', 'Training material document', 10, true, true, '#0ea5e9'),
  ('document_type', 'regulatory', 'Regulatory Document', 'Regulatory compliance document', 11, true, true, '#dc2626'),
  ('document_type', 'image', 'Image', 'Image file', 12, true, true, '#a855f7'),
  ('document_type', 'other', 'Other', 'Other document type', 13, true, true, '#94a3b8')
ON CONFLICT (category, code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  color = EXCLUDED.color,
  is_system = true;
