/*
  # Add Super Admin Role

  1. Changes
    - Updates jeff.lutz@proximitylabservices.com's role to 'Super Admin'
    - Super Admin has access to everything in the application including Commissions

  2. Notes
    - This role is distinct from 'Proximity Admin' but grants equivalent or greater access
    - Only jeff.lutz@proximitylabservices.com is assigned this role
*/

UPDATE user_roles
SET role = 'Super Admin'
WHERE email = 'jeff.lutz@proximitylabservices.com';
