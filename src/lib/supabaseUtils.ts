import { supabase } from './supabase';
// Assuming you have a types file, adjust the import path if necessary
// import type { CV } from '../types'; 

// Define the structure of your parsed CV data here or import it
// This should match the structure returned by your parsing API
interface ParsedCVData {
  full_text?: string;
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location?: string;
  job_title?: string;
  summary?: string;
  skills?: { technical?: string[], soft?: string[], industry?: string[] } | string[];
  work_experience?: {
    company: string;
    position: string;
    dates?: string;
    duration?: string;
    responsibilities?: string[];
    achievements?: string[];
    location?: string;
  }[];
  education?: {
    institution: string;
    degree: string;
    year?: string;
    dates?: string;
    honors?: string[];
  }[];
  [key: string]: any; // Allows for other potential fields
}

/**
 * Saves parsed CV data to the Supabase database.
 * Placeholder function - **Implement your actual database interaction here.**
 *
 * @param userId - The ID of the user uploading the CV.
 * @param fileName - The original name of the uploaded file.
 * @param filePath - The path where the file is stored in Supabase Storage (optional).
 * @param cvData - The parsed data extracted from the CV.
 */
export const saveParsedData = async (
  userId: string,
  fileName: string,
  filePath: string | null,
  cvData: ParsedCVData
): Promise<void> => {
  console.log('Attempting to save parsed data for user:', userId);
  console.log('File Name:', fileName);
  console.log('Storage Path:', filePath);
  // console.log('Parsed Data:', cvData); // Log full data if needed for debugging

  // Check authentication status
  console.log('⚠️ CHECKING AUTH STATUS ⚠️');
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('Current session:', sessionData);
  
  if (!sessionData?.session) {
    console.error('⛔ NO ACTIVE SESSION FOUND - THIS WILL CAUSE RLS POLICY FAILURES');
  } else {
    console.log('✅ Session exists, user is authenticated');
    console.log('Auth user ID:', sessionData.session.user.id);
    console.log('Parameter user ID:', userId);
    
    if (sessionData.session.user.id !== userId) {
      console.warn('⚠️ MISMATCH: Auth user ID does not match parameter userId');
    }
  }

  // --- Placeholder Implementation ---
  // Replace this with your actual logic to insert/update data in your Supabase table.
  // Ensure your table schema matches the fields you are inserting.
  const dataToInsert = {
    user_id: userId,
    file_name: fileName,
    storage_path: filePath, // Store the storage path if available
    // Map fields from cvData to your table columns (adjust names as needed)
    full_text: cvData.full_text,
    name: cvData.name,
    email: cvData.email,
    phone: cvData.phone,
    linkedin_url: cvData.linkedin,
    github_url: cvData.github,
    website_url: cvData.website,
    location: cvData.location,
    job_title: cvData.job_title,
    summary: cvData.summary,
    // Ensure 'skills', 'work_experience', 'education' columns are type JSON/JSONB in Supabase
    skills: cvData.skills, 
    work_experience: cvData.work_experience, 
    education: cvData.education, 
    created_at: new Date().toISOString(), // Use ISO string format for timestamp
  };

  console.log('Data prepared for Supabase (placeholder):', dataToInsert);

  /*
  // --- Example Supabase Insert --- 
  // 1. Uncomment this block.
  // 2. Replace 'parsed_cvs' with your actual Supabase table name.
  // 3. Verify column names in dataToInsert match your table schema.

  const { data, error } = await supabase
    .from('parsed_cvs') // <-- Replace with your table name
    .insert([dataToInsert])
    .select(); // Optionally select the inserted data to confirm

  if (error) {
    console.error('Error saving parsed data to Supabase:', error);
    // Consider more specific error handling or user feedback
    throw new Error(`Failed to save CV data: ${error.message}`);
  }

  console.log('Successfully saved parsed data to Supabase:', data);
  */

  // Simulate async operation for placeholder
  await new Promise(resolve => setTimeout(resolve, 50)); 
  console.log('Placeholder: saveParsedData executed (no actual DB write performed yet).');

  console.log('Data prepared for Supabase:', dataToInsert);

  // --- Actual Supabase Insert --- 
  try {
    // First, check if the table exists by trying to select a single row
    const { data: tableCheck, error: tableError } = await supabase
      .from('parsed_cvs')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('Error verifying table exists:', tableError);
      // The table might not exist, let's try both commonly used names
      console.log('Attempting fallback to "cvs" table...');
      
      const { data: insertData, error: insertError } = await supabase
        .from('cvs') // Try alternative table name
        .insert([dataToInsert])
        .select();
        
      if (insertError) {
        console.error('Failed with both table names. Details:', insertError);
        console.error('Most common issues:');
        console.error('1. Table does not exist - check Supabase schema');
        console.error('2. RLS policy blocking insert - check Authentication -> Policies');
        console.error('3. Data type mismatch - check if JSON fields need to be stringified');
        throw new Error(`Database error: ${insertError.message}`);
      }
      
      console.log('Successfully saved to "cvs" table:', insertData);
      return;
    }
    
    // If table check passed, proceed with normal insert
    console.log('Table "parsed_cvs" exists, proceeding with insert...');
    const { data: insertData, error: insertError } = await supabase
      .from('parsed_cvs')
      .insert([dataToInsert])
      .select();
      
    if (insertError) {
      // More detailed error logging
      console.error('Insert failed. Full error:', insertError);
      console.error('Error code:', insertError.code);
      console.error('Error details:', insertError.details);
      console.error('Hint:', insertError.hint);
      
      // Try to determine if it's an RLS issue
      if (insertError.message.includes('permission denied') || 
          insertError.code === '42501' || 
          insertError.message.includes('policy')) {
        console.error('THIS APPEARS TO BE AN RLS POLICY ISSUE!');
        console.error('Go to your Supabase dashboard -> Authentication -> Policies');
        console.error('Ensure you have an INSERT policy for the parsed_cvs table');
      }
      
      throw new Error(`Failed to save CV data: ${insertError.message}`);
    }
    
    console.log('Successfully saved parsed data to Supabase:', insertData);

    // Try a simplified insert operation with minimal data
    console.log('Attempting simplified insert with minimal data...');
    try {
      // Create a minimal object with just the required fields
      const minimalData = {
        user_id: userId,
        file_name: fileName || 'unknown.pdf',
        full_text: cvData.full_text || 'No text extracted',
        created_at: new Date().toISOString()
      };
      
      console.log('Minimal data structure:', minimalData);
      
      const { data: minimalInsert, error: minimalError } = await supabase
        .from('parsed_cvs')
        .insert([minimalData])
        .select();
        
      if (minimalError) {
        console.error('Even minimal insert failed:', minimalError);
        console.error('This suggests a fundamental issue with database access or permissions');
      } else {
        console.log('✅ MINIMAL INSERT SUCCEEDED!', minimalInsert);
        console.log('This means the issue is with the data format, not permissions');
      }
    } catch (e) {
      console.error('Exception during minimal insert:', e);
    }
  } catch (err) {
    console.error('Unexpected error during save operation:', err);
    throw err;
  }
}; 