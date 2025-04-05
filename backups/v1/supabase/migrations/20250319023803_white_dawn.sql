/*
  # Add English CV Data Column

  1. Changes
    - Add parsed_data_english column to cvs table for storing English versions
    - Column uses same JSONB type as parsed_data
    - Maintain existing RLS policies

  2. Security
    - No additional security changes needed
    - Existing RLS policies will cover the new column
*/

-- Add parsed_data_english column to cvs table
ALTER TABLE cvs
ADD COLUMN IF NOT EXISTS parsed_data_english jsonb;