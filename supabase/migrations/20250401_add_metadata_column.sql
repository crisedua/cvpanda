/*
  # Add Metadata Column to CVs Table

  1. Changes
    - Add metadata column to cvs table for storing additional metadata
    - Column uses JSONB type for flexible data storage
    - Maintain existing RLS policies

  2. Security
    - No additional security changes needed
    - Existing RLS policies will cover the new column
*/

-- Add metadata column to cvs table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cvs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE cvs ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$; 