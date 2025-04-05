/*
  # Add Profile Management Columns

  1. New Columns
    - `display_name` (text, nullable) - User's display name
    - `bio` (text, nullable) - User's biography
    - `avatar_url` (text, nullable) - URL to user's profile picture
    - `notification_preferences` (jsonb, nullable) - User's notification settings

  2. Changes
    - Add new columns to profiles table
    - Add default values for notification preferences
*/

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"email": true, "desktop": false, "updates": true, "marketing": false}'::jsonb;

-- Create storage bucket for avatars if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name)
  VALUES ('avatars', 'avatars')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Set up storage policy for avatars
DO $$
BEGIN
  -- Policy to allow authenticated users to upload their own avatar
  CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Policy to allow authenticated users to update their own avatar
  CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Policy to allow authenticated users to delete their own avatar
  CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Policy to allow public read access to avatars
  CREATE POLICY "Avatar files are publicly accessible" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'avatars');
END $$;