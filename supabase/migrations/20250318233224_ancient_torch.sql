/*
  # Add CV update policy

  1. Changes
    - Drop existing update policy if it exists
    - Add RLS policy for CV updates
    - Users can update their own CVs
    - Admins can update any CV

  2. Security
    - Enable RLS on cvs table
    - Add policy for authenticated users to update their own CVs
    - Add policy for admins to update any CV
*/

-- Ensure RLS is enabled
ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update own CVs" ON cvs;

-- Add policy for users to update their own CVs
CREATE POLICY "Users can update own CVs"
  ON cvs
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );