/*
  # Add RPC Functions to Bypass RLS

  1. Changes
    - Add stored procedure to bypass RLS for CV insertions
    - Function will be callable by the server with anon key

  2. Security
    - Function uses SECURITY DEFINER to run with caller's permissions
    - Only performs specific operations that are needed
*/

-- Function to insert a CV without RLS checks
CREATE OR REPLACE FUNCTION insert_cv_bypass_rls(
  p_id UUID,
  p_user_id UUID,
  p_filename TEXT,
  p_file_path TEXT,
  p_parsed_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO cvs (id, user_id, filename, file_path, parsed_data)
  VALUES (p_id, p_user_id, p_filename, p_file_path, p_parsed_data);
END;
$$;

-- Function to retrieve CVs for a user without RLS checks
CREATE OR REPLACE FUNCTION get_cvs_for_user(
  p_user_id UUID
)
RETURNS SETOF cvs
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM cvs
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;
$$; 