/*
  # Add CV improvements and favorites functionality

  1. Changes
    - Add parsed_data_english column for English translations
    - Add is_favorite column for favorite CVs
    - Add index for faster sorting by favorite status
    - Update existing rows with default values

  2. Security
    - Maintain existing RLS policies
*/

-- Add parsed_data_english column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cvs' AND column_name = 'parsed_data_english'
  ) THEN
    ALTER TABLE cvs ADD COLUMN parsed_data_english jsonb;
  END IF;
END $$;

-- Add is_favorite column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cvs' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE cvs ADD COLUMN is_favorite boolean DEFAULT false;
  END IF;
END $$;

-- Add index for faster sorting if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'cvs' AND indexname = 'idx_cvs_is_favorite'
  ) THEN
    CREATE INDEX idx_cvs_is_favorite ON cvs(is_favorite);
  END IF;
END $$;

-- Update existing rows
UPDATE cvs SET is_favorite = false WHERE is_favorite IS NULL;