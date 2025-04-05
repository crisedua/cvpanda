/*
  # Add CV deletion policy

  1. Changes
    - Add RLS policy for CV deletion
    - Users can delete their own CVs
    - Admins can delete any CV

  2. Security
    - Enable RLS on cvs table (if not already enabled)
    - Add policy for authenticated users to delete their own CVs
    - Add policy for admins to delete any CV
*/

-- Ensure RLS is enabled
ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;

-- Add policy for users to delete their own CVs
CREATE POLICY "Users can delete own CVs"
  ON cvs
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );