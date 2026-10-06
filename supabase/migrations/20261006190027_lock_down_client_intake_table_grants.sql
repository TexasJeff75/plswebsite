/*
# Lock Down Client Intake Table Grants

## Summary
Removes direct table privileges for anonymous callers from `client_intakes`.
The public onboarding form must use the two narrowly scoped token functions;
it should never be able to query, insert, update, or delete intake rows directly.

## Security Changes
- Revoke all direct privileges on `client_intakes` from `anon`.
- Keep the existing row-level security policies for authenticated internal users.
- Keep the existing function grants for public read/save and authenticated conversion.

## Important Notes
1. This does not change any intake data.
2. The public link continues to work through `get_public_client_intake` and
   `save_public_client_intake`.
3. Internal users continue to manage intakes through the authenticated app.
*/

REVOKE ALL ON TABLE client_intakes FROM anon;
