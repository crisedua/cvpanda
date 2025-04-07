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
 * This function now only writes to the parsed_cvs table, which is our single source of truth.
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
  console.log('Saving parsed data to parsed_cvs table for user:', userId);
  console.log('File Name:', fileName);
  console.log('Storage Path:', filePath);
  
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

  // Prepare data for insertion
  const dataToInsert = {
    user_id: userId,
    file_name: fileName,
    storage_path: filePath, // Store the storage path if available
    // Map fields from cvData to database columns
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
    // Ensure JSON fields are properly handled
    skills: cvData.skills, 
    work_experience: cvData.work_experience, 
    education: cvData.education, 
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_favorite: false // Default to not favorite
  };

  console.log('Data prepared for insertion:', dataToInsert);

  try {
    // Direct insert to parsed_cvs - no fallbacks or alternative tables
    const { data: insertData, error: insertError } = await supabase
      .from('parsed_cvs')
      .insert([dataToInsert])
      .select();
      
    if (insertError) {
      console.error('Error saving data to parsed_cvs table:', insertError);
      console.error('Error code:', insertError.code);
      console.error('Error details:', insertError.details);
      
      // Provide guidance on potential RLS policy issues
      if (insertError.message.includes('permission denied') || 
          insertError.code === '42501' || 
          insertError.message.includes('policy')) {
        console.error('THIS APPEARS TO BE AN RLS POLICY ISSUE!');
        console.error('Go to your Supabase dashboard -> Authentication -> Policies');
        console.error('Ensure you have an INSERT policy for the parsed_cvs table with this condition:');
        console.error('(auth.uid() = user_id)');
      }
      
      throw new Error(`Failed to save CV data: ${insertError.message}`);
    }
    
    console.log('✅ Successfully saved data to parsed_cvs table:', insertData);
    
    // Save a reference to the storage path for easier cleanup later
    if (filePath) {
      try {
        const { error: pathError } = await supabase
          .from('storage_file_paths')
          .insert([{ 
            cv_id: insertData?.[0]?.id,
            user_id: userId,
            file_path: filePath,
            created_at: new Date().toISOString()
          }]);
          
        if (pathError) {
          console.warn('Warning: Could not save file path reference:', pathError);
          // Non-critical error, don't throw
        }
      } catch (pathErr) {
        console.warn('Exception saving file path reference:', pathErr);
        // Non-critical error, don't throw
      }
    }
  } catch (error) {
    console.error('Exception during CV data save operation:', error);
    throw error;
  }
}; 