/*
  # Permissive Row Level Security Policy Fix

  1. Changes
    - Keep RLS enabled but with permissive policies
    - Allow anonymous access for server operations
    - Maintain basic security model with more permissive rules

  2. Security Considerations
    - More permissive than typical production policies
    - Allows server to perform operations with anon key
    - Still maintains some level of security
*/

-- First, drop all existing policies for the cvs table
DROP POLICY IF EXISTS "Users can read own CVs" ON cvs;
DROP POLICY IF EXISTS "Users can insert own CVs" ON cvs;
DROP POLICY IF EXISTS "Admins can read all CVs" ON cvs;
DROP POLICY IF EXISTS "Users can update own CVs" ON cvs;
DROP POLICY IF EXISTS "Users can delete own CVs" ON cvs;
DROP POLICY IF EXISTS "Backend can insert any CV" ON cvs;
DROP POLICY IF EXISTS "Anyone can read CVs" ON cvs;

-- Enable RLS on the cvs table (in case it was disabled)
ALTER TABLE cvs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anonymous (server) INSERT operations
CREATE POLICY "Server can insert CVs"
  ON cvs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create a policy that allows authenticated users to insert their own CVs
CREATE POLICY "Users can insert own CVs"
  ON cvs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create a policy that allows all READ operations for both anon and authenticated
CREATE POLICY "Anyone can read CVs"
  ON cvs
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create a policy that allows authenticated users to update their own CVs
CREATE POLICY "Users can update own CVs"
  ON cvs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ))
  WITH CHECK (true);

-- Create a policy that allows authenticated users to delete their own CVs
CREATE POLICY "Users can delete own CVs"
  ON cvs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )); 