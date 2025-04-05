/*
  # Restore Working RLS Policies from March 30th, 2025

  1. Changes
    - Recreate the RLS policy setup that was working on 3/30/2025
    - Focus on making insertion work for server-side operations
    - Balance security with functionality

  2. Security Considerations
    - Based on previously working configuration
    - Targeted fix for the specific issue with CV uploads
*/

-- First clean up any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own CVs" ON cvs;
DROP POLICY IF EXISTS "Users can insert own CVs" ON cvs;
DROP POLICY IF EXISTS "Admins can read all CVs" ON cvs;
DROP POLICY IF EXISTS "Users can update own CVs" ON cvs;
DROP POLICY IF EXISTS "Users can delete own CVs" ON cvs;
DROP POLICY IF EXISTS "Backend can insert any CV" ON cvs;
DROP POLICY IF EXISTS "Anyone can read CVs" ON cvs;
DROP POLICY IF EXISTS "Server can insert CVs" ON cvs;
DROP POLICY IF EXISTS "Allow all operations on cvs" ON cvs;

-- Make sure RLS is enabled
ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;

-- Create policy for server operations (anon key)
CREATE POLICY "Server access"
  ON cvs
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users to access their own CVs
CREATE POLICY "Users access own CVs"
  ON cvs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policy for admins to access all CVs
CREATE POLICY "Admins access all CVs"
  ON cvs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  ); 