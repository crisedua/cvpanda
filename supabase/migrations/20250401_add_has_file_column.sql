/*
  # Add has_file column to cvs table

  1. Changes
    - Add a boolean column `has_file` to the `cvs` table.
    - This column tracks whether the CV file content was successfully uploaded to storage.
    - Defaults to FALSE.

  2. Security
    - No changes to RLS policies required for this column.
*/

ALTER TABLE cvs
ADD COLUMN IF NOT EXISTS has_file BOOLEAN DEFAULT FALSE; 