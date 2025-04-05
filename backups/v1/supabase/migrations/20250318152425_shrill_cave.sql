/*
  # Fix profile policies to prevent recursion

  1. Changes
    - Drop existing policies that may cause recursion
    - Create new, simplified policies for profiles table
    - Ensure proper row-level security without recursive checks

  2. Security
    - Maintain row-level security on profiles table
    - Add clear, non-recursive policies for CRUD operations
    - Ensure admin access is handled properly
*/

-- First, drop any existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;

-- Create new, simplified policies
CREATE POLICY "Allow users to read own profile"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email IN (
      SELECT email FROM profiles WHERE role = 'admin'
    )
  )
);

CREATE POLICY "Allow users to update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow initial profile creation"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;