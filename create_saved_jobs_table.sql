-- Create saved_jobs table
CREATE TABLE IF NOT EXISTS public.saved_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add indexes for better performance
    CONSTRAINT saved_jobs_user_id_idx UNIQUE (user_id, title)
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

-- Test if saved_jobs table already exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_jobs'
); 