# Instructions for Creating the saved_jobs Table in Supabase

Follow these steps to create the saved_jobs table and required stored procedure in your Supabase project:

1. Go to your Supabase dashboard at https://app.supabase.com
2. Select your project (with the URL `tamxvaacgomdalopkytv`)
3. Go to "SQL Editor" in the left sidebar
4. Create a new query and paste this code:

```sql
-- Create a function to create the saved_jobs table if it doesn't exist
CREATE OR REPLACE FUNCTION create_saved_jobs_table()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the table already exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_jobs'
  ) THEN
    -- Table already exists
    RETURN true;
  END IF;

  -- Create saved_jobs table
  CREATE TABLE public.saved_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Enable Row Level Security
  ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

  -- Create policy to allow users to view only their saved jobs
  CREATE POLICY "Users can view their own saved jobs" 
  ON public.saved_jobs 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

  -- Create policy to allow users to insert their own saved jobs
  CREATE POLICY "Users can insert their own saved jobs" 
  ON public.saved_jobs 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

  -- Create policy to allow users to update their own saved jobs
  CREATE POLICY "Users can update their own saved jobs" 
  ON public.saved_jobs 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id);

  -- Create policy to allow users to delete their own saved jobs
  CREATE POLICY "Users can delete their own saved jobs" 
  ON public.saved_jobs 
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id);

  RETURN true;
END;
$$;

-- Also create a function to list tables for debugging
CREATE OR REPLACE FUNCTION list_tables()
RETURNS SETOF information_schema.tables
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM information_schema.tables 
  WHERE table_schema = 'public';
$$;

-- Test creating the table (will only create if it doesn't exist)
SELECT create_saved_jobs_table();
```

5. Click "Run" to execute the SQL
6. You should see a successful result with `true` indicating the function was created and executed
7. Now your application will be able to call this function to create the table if it doesn't exist

## Testing the Table

After creating the function and table, you can test it in the SQL Editor with:

```sql
-- Check if the table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'saved_jobs'
);

-- List all tables in your schema
SELECT * FROM list_tables();

-- Test inserting a record
INSERT INTO public.saved_jobs (user_id, title, description)
VALUES (
  auth.uid(), -- This will use your current user ID 
  'Test Job Title',
  'This is a test job description'
);

-- View the saved jobs
SELECT * FROM public.saved_jobs;
```

With these steps completed, your application should work properly with the saved_jobs table. 