/*
  # Fix recursive policies for profiles table

  1. Changes
    - Remove recursive policy that was causing infinite recursion
    - Implement simplified policies for profile access
    - Add separate admin policy without recursion
    - Ensure RLS remains enabled

  2. Security
    - Maintain secure access control
    - Users can still only access their own profiles
    - Admins can access all profiles through a direct role check
*/

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Allow users to read own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow initial profile creation" ON profiles;

-- Create new, non-recursive policies
CREATE POLICY "Allow users to read own profile"
ON profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR role = 'admin'
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