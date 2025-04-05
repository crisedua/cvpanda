/*
  # Add favorites functionality to CVs

  1. Changes
    - Add is_favorite column to cvs table
    - Add index for faster sorting by favorite status
    - Update existing rows with default value

  2. Security
    - Maintain existing RLS policies
*/

-- Add is_favorite column
ALTER TABLE cvs
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Add index for faster sorting
CREATE INDEX IF NOT EXISTS idx_cvs_is_favorite ON cvs(is_favorite);

-- Update existing rows
UPDATE cvs SET is_favorite = false WHERE is_favorite IS NULL;