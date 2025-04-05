/*
  # Fix profile creation trigger

  This migration fixes issues with the profile creation trigger:
  1. Adds better error handling
  2. Adds retry logic for profile creation
  3. Ensures proper role assignment
  4. Fixes race conditions in profile creation
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved trigger function with better error handling and retry logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  max_retries int := 3;
  current_try int := 0;
  default_role text;
BEGIN
  -- Set role based on email
  default_role := CASE 
    WHEN new.email = 'admin@example.com' THEN 'admin'
    ELSE 'user'
  END;

  LOOP
    BEGIN
      current_try := current_try + 1;

      -- Try to insert the profile
      INSERT INTO public.profiles (id, email, role)
      VALUES (new.id, new.email, default_role)
      ON CONFLICT (id) DO UPDATE
        SET 
          email = EXCLUDED.email,
          role = CASE 
            WHEN profiles.role IS NULL THEN EXCLUDED.role
            ELSE profiles.role
          END
      WHERE 
        profiles.id = EXCLUDED.id;

      -- If we get here, the insert was successful
      RETURN new;
    EXCEPTION
      WHEN unique_violation THEN
        -- Profile already exists, just return
        RETURN new;
      WHEN OTHERS THEN
        -- For other errors, retry if we haven't hit max retries
        IF current_try < max_retries THEN
          -- Wait a bit before retrying (10ms * retry number)
          PERFORM pg_sleep(0.01 * current_try);
          CONTINUE;
        END IF;
        -- If we've hit max retries, raise the error
        RAISE EXCEPTION 'Failed to create profile after % attempts: %', max_retries, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate policies with proper permissions
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON public.profiles;

-- Create simplified, robust policies
CREATE POLICY "Allow profile creation"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'admin'
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;