import { createComponentLogger } from './logger';
import { JobScanFilter, ScannedJob } from '../types/index';
import { extractTextFromDOCX } from './documentParser'; // Assuming it's exported from here
import { supabase } from './supabase';

const logger = createComponentLogger('API');

// Revert back to direct API URL - CORS must be fixed on Railway backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// API response interfaces
interface ApiExtractionResponse {
  success: boolean;
  result?: {
    text: string;
    pages?: number;
    characters: number;
    processingTimeMs: number;
  };
  error?: string;
  cvData?: any; // For backward compatibility
}

// Fetch all CVs for a user
export const fetchUserCVs = async (userId: string) => {
  try {
    logger.log('Fetching CVs for user', { userId });
    
    if (!userId || userId.trim() === '') {
      console.error('Invalid user ID provided to fetchUserCVs:', userId);
      return [];
    }
    
    // Array to store combined results
    let allCVs: any[] = [];
    
    // Step 1: Fetch from Supabase parsed_cvs table
    console.log('🔍 Fetching CVs from Supabase database...');
    console.log('🔑 Using user ID:', userId);
    try {
      // First, check if the table exists by getting its schema
      const { data: tableInfo, error: tableError } = await supabase
        .from('parsed_cvs')
        .select('*')
        .limit(1);
      
      console.log('🔍 Table check result:', tableInfo ? 'Table exists' : 'Table not found', tableError ? `Error: ${tableError.message}` : '');
      
      // Try both user_id and userId formats
      console.log('🔍 Attempting query with user_id field...');
      const { data: supabaseCVs, error: supabaseError } = await supabase
        .from('parsed_cvs')
        .select('*');

      console.log('🔍 All records in table:', supabaseCVs ? supabaseCVs.length : 0);
      
      // Now filter by user_id
      const { data: userCVs, error: userError } = await supabase
        .from('parsed_cvs')
        .select('*')
        .eq('user_id', userId);
        
      console.log('🔍 Records matching user_id:', userId, ':', userCVs ? userCVs.length : 0);
      console.log('🔍 Raw records:', userCVs);
        
      if (supabaseError) {
        console.error('❌ Error fetching from Supabase:', supabaseError);
      } else if (userCVs && userCVs.length > 0) {
        console.log('✅ Successfully fetched CVs from Supabase, count:', userCVs.length);
        
        // Map Supabase data to the expected format
        const formattedSupabaseCVs = userCVs.map((cv: any) => ({
          id: cv.id,
          userId: cv.user_id,
          filename: cv.file_name || 'Unnamed CV',
          isFavorite: false, // Default value since we don't have this in database
          createdAt: cv.created_at,
          lastUpdated: cv.created_at,
          source: 'supabase',
          parsedData: {
            name: cv.name,
            email: cv.email,
            phone: cv.phone,
            linkedin: cv.linkedin_url,
            github: cv.github_url,
            website: cv.website_url,
            location: cv.location,
            summary: cv.summary,
            skills: cv.skills,
            work_experience: cv.work_experience,
            education: cv.education,
            ...cv // Include any other fields
          }
        }));
        
        allCVs = [...formattedSupabaseCVs];
      }
    } catch (dbError) {
      console.error('Exception fetching from Supabase:', dbError);
    }
    
    // Step 2: Also fetch from the API endpoint if it's configured
    if (API_BASE_URL) {
      try {
        console.log('Making request to:', `${API_BASE_URL}/api/cvs?userId=${userId}`);
        const response = await fetch(`${API_BASE_URL}/api/cvs?userId=${userId}`);
        
        if (!response.ok) {
          console.error('API error:', response.status, response.statusText);
        } else {
          const apiData = await response.json();
          console.log('Successfully fetched CVs from API, count:', apiData.length);
          
          // Add a source property to distinguish API CVs
          const apiCVs = apiData.map((cv: any) => ({
            ...cv,
            source: 'api'
          }));
          
          // Combine with Supabase results, avoiding duplicates by filename
          const existingFilenames = new Set(allCVs.map(cv => cv.filename));
          const uniqueApiCVs = apiCVs.filter(cv => !existingFilenames.has(cv.filename));
          
          allCVs = [...allCVs, ...uniqueApiCVs];
        }
      } catch (apiError) {
        console.error('Error fetching from API:', apiError);
      }
    }
    
    console.log('Combined CV results count:', allCVs.length);
    return allCVs;
    
  } catch (error) {
    logger.error('Error fetching CVs', error);
    console.error('Detailed error fetching CVs:', error);
    return []; // Return empty array instead of throwing to prevent UI crashes
  }
};

// Store a CV on the server
export const storeCV = async (userId: string, cvData: any) => {
  try {
    logger.log('Storing CV for user', { userId, filename: cvData.filename });
    
    // ---- START DEBUG LOG ----
    console.log('[api.ts] storeCV received cvData. Keys:', Object.keys(cvData || {}));
    console.log('[api.ts] storeCV received cvData.content exists:', !!cvData?.content);
    // ---- END DEBUG LOG ----

    console.log('CV data being sent to server:', { 
      userId, 
      filename: cvData.filename,
      contentLength: cvData.content?.length,
      hasParsedData: !!cvData.parsed_data,
      parsedDataKeys: cvData.parsed_data ? Object.keys(cvData.parsed_data) : []
    });
    
    // Validate payload before sending
    if (!cvData.filename) {
      throw new Error('Missing filename in CV data');
    }
    
    // No need to check for content field as it's not in DB schema
    
    // Ensure parsed_data is present
    if (!cvData.parsed_data) {
      logger.log('Warning: Missing parsed_data in CV, using empty object');
      cvData.parsed_data = {};
    }
    
    const payload = { userId, cvData };
    console.log('Request payload size:', JSON.stringify(payload).length, 'bytes');
    
    // Try up to 3 times with increasing timeout
    let response;
    let lastError;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logger.log(`Attempt ${attempt + 1} to store CV`);
        
        response = await fetch(`${API_BASE_URL}/api/store-cv`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        // If we got a response, break out of retry loop
        break;
      } catch (err) {
        logger.error(`Attempt ${attempt + 1} failed:`, err);
        lastError = err;
        
        // Wait before retrying (exponential backoff)
        if (attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000;
          logger.log(`Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all attempts failed, throw the last error
    if (!response) {
      throw lastError || new Error('Failed to connect to server after multiple attempts');
    }
    
    // Log the response status
    console.log('Server response status:', response.status);
    
    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage = 'Failed to store CV';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) errorMessage += `: ${errorText}`;
        } catch (e2) {
          // Ignore if we can't get text either
        }
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Validate server response
    if (!data.success || !data.id) {
      logger.error('Invalid server response:', data);
      throw new Error('Server returned an invalid response');
    }
    
    logger.log('Successfully stored CV', { id: data.id });
    return data;
  } catch (error) {
    logger.error('Error storing CV', error);
    throw error;
  }
};

// Parse CV text content using the new endpoint
export const parseCVText = async (textContent: string) => {
  const logger = createComponentLogger('API.parseCVText');
  try {
    logger.log('Sending text content for parsing, length:', textContent.length);
    
    const response = await fetch(`${API_BASE_URL}/api/parse-cv-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textContent }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to parse CV text';
      let errorDetails = null;
      try {
        // Attempt to parse JSON first
        errorDetails = await response.json(); 
        errorMessage = errorDetails.error || errorMessage;
        logger.error('Server error during parsing (JSON response):', errorDetails);
      } catch (jsonError) { 
        // If JSON parsing fails, THEN try reading as text. Only read ONCE.
        logger.warn('Could not parse error response as JSON, trying text...', jsonError);
        try {
          // Clone the response to read the text body without consuming the original
          const clonedResponse = response.clone();
          const textResponse = await clonedResponse.text();
          logger.error('Non-JSON server error during parsing:', { status: response.status, text: textResponse });
          errorMessage += `: ${response.status} - ${textResponse}`;
        } catch (textErr) {
           // If reading text also fails, log that.
           logger.error('Could not read error response body as text either', textErr);
           errorMessage += `: ${response.status} ${response.statusText}`; 
        }
      }
      // Throw the constructed error message
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.success || !data.parsedData) {
      logger.error('Invalid server response:', data);
      throw new Error('Server returned invalid parsing response');
    }

    logger.log('Successfully parsed CV text');
    return data.parsedData; // Return just the parsed data object

  } catch (error) {
    logger.error('Error parsing CV text', error);
    throw error;
  }
};

// Process a CV for extraction
export const processCV = async (cvId: string) => {
  try {
    logger.log('Processing CV', { cvId });
    const response = await fetch(`${API_BASE_URL}/api/process-cv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cvId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to process CV');
    }
    
    const data = await response.json();
    logger.log('Successfully processed CV', { id: data.cv?.id });
    return data;
  } catch (error) {
    logger.error('Error processing CV', error);
    throw error;
  }
};

// Delete a CV
export const deleteCV = async (cvId: string) => {
  try {
    logger.log('Deleting CV:', cvId);
    
    // For API-stored CVs
    if (API_BASE_URL) {
      try {
        const apiResponse = await fetch(`${API_BASE_URL}/api/cvs/${cvId}`, {
          method: 'DELETE',
        });
        
        if (apiResponse.ok) {
          logger.log('Successfully deleted CV from API');
        } else {
          logger.warn('Failed to delete CV from API:', apiResponse.statusText);
        }
      } catch (apiError) {
        logger.warn('Error deleting CV from API:', apiError);
        // Continue with Supabase deletion even if API deletion fails
      }
    }
    
    // Delete from Supabase
    // First try parsed_cvs
    let deleted = false;
    try {
      console.log('Attempting to delete from parsed_cvs table...');
      const { error: parsedError, data: parsedResult } = await supabase
        .from('parsed_cvs')
        .delete()
        .eq('id', cvId)
        .select()
        .single();
      
      if (parsedError) {
        if (parsedError.code === 'PGRST116') {
          // Not found - not an error
          console.log('CV not found in parsed_cvs');
        } else {
          console.error('Error deleting from parsed_cvs:', parsedError);
        }
      } else if (parsedResult) {
        console.log('Successfully deleted from parsed_cvs');
        deleted = true;
      }
    } catch (parsedError) {
      console.error('Exception deleting from parsed_cvs:', parsedError);
    }
    
    // Then try cvs 
    try {
      console.log('Attempting to delete from cvs table...');
      const { error: cvsError, data: cvsResult } = await supabase
        .from('cvs')
        .delete()
        .eq('id', cvId)
        .select()
        .single();
      
      if (cvsError) {
        if (cvsError.code === 'PGRST116') {
          // Not found - not an error
          console.log('CV not found in cvs table');
        } else {
          console.error('Error deleting from cvs:', cvsError);
        }
      } else if (cvsResult) {
        console.log('Successfully deleted from cvs table');
        deleted = true;
      }
    } catch (cvsError) {
      console.error('Exception deleting from cvs:', cvsError);
    }
    
    // Now try to delete the actual file from storage
    try {
      console.log('Attempting to delete file from storage...');
      const { data: filePathData, error: filePathError } = await supabase
        .from('storage_file_paths')
        .select('file_path')
        .eq('cv_id', cvId)
        .maybeSingle();
      
      if (filePathError) {
        console.error('Error getting file path:', filePathError);
      } else if (filePathData && filePathData.file_path) {
        console.log('Found file path:', filePathData.file_path);
        
        const { error: storageError } = await supabase.storage
          .from('cvs')
          .remove([filePathData.file_path]);
          
        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        } else {
          console.log('Successfully deleted file from storage');
          
          // Also delete the path entry
          await supabase
            .from('storage_file_paths')
            .delete()
            .eq('cv_id', cvId);
        }
      } else {
        console.log('No file path found for this CV');
      }
    } catch (storageError) {
      console.error('Exception deleting file from storage:', storageError);
    }
    
    if (deleted) {
      return { success: true, message: 'CV deleted successfully' };
    } else {
      return { success: false, message: 'CV not found in any table' };
    }
  } catch (error) {
    logger.error('Error in deleteCV:', error);
    throw error;
  }
};

// Toggle favorite status
export const toggleFavorite = async (cvId: string) => {
  try {
    logger.log('Toggling favorite status', { cvId });
    const response = await fetch(`${API_BASE_URL}/api/cvs/${cvId}/favorite`, {
      method: 'PUT',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to toggle favorite status');
    }
    
    const data = await response.json();
    logger.log('Successfully toggled favorite status', { cvId });
    return data;
  } catch (error) {
    logger.error('Error toggling favorite status', error);
    throw error;
  }
};

// Download a CV
export const downloadCV = async (cvId: string, filename: string) => {
  try {
    logger.log('Downloading CV', { cvId });
    const response = await fetch(`${API_BASE_URL}/api/cvs/${cvId}/download`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to download CV');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    logger.log('Successfully downloaded CV', { cvId });
    return true;
  } catch (error) {
    logger.error('Error downloading CV', error);
    throw error;
  }
};

// Analyze skill gaps between CV and job description
export const analyzeSkillGaps = async (cvId: string, jobDescription: string) => {
  try {
    logger.log('Analyzing skill gaps', { cvId });
    const response = await fetch(`${API_BASE_URL}/api/analyze-skill-gaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cvId, jobDescription }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze skill gaps');
    }
    
    const data = await response.json();
    logger.log('Successfully analyzed skill gaps', { cvId });
    return data.result;
  } catch (error) {
    logger.error('Error analyzing skill gaps', error);
    throw error;
  }
};

// Optimize profile (LinkedIn or CV) based on industry trends
export const optimizeProfile = async (
  cvId: string, 
  targetPlatform: string, 
  industryFocus: string, 
  careerLevel: string
) => {
  try {
    logger.log('Optimizing profile', { cvId, targetPlatform });
    const response = await fetch(`${API_BASE_URL}/api/optimize-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        cvId, 
        targetPlatform, 
        industryFocus, 
        careerLevel 
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to optimize profile');
    }
    
    const data = await response.json();
    logger.log('Successfully optimized profile', { cvId });
    return data;
  } catch (error) {
    logger.error('Error optimizing profile', error);
    throw error;
  }
};

// Enhance profile with advanced keyword analytics and industry trends
export const enhanceProfile = async (
  cvId: string,
  targetPlatform: string,
  industryFocus: string,
  careerLevel: string,
  enhancementOptions?: Record<string, any>
) => {
  try {
    console.log('Enhancing profile with parameters:', { 
      cvId, 
      targetPlatform, 
      industryFocus,
      careerLevel,
      apiUrl: API_BASE_URL
    });
    
    const response = await fetch(`${API_BASE_URL}/api/enhance-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        cvId, 
        targetPlatform, 
        industryFocus, 
        careerLevel,
        enhancementOptions
      }),
    });
    
    if (!response.ok) {
      console.error('Error response from enhance-profile endpoint:', {
        status: response.status,
        statusText: response.statusText
      });
      
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Error: ${response.status} ${response.statusText}`;
      } catch (e) {
        errorMessage = `Error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Successfully enhanced profile, got data:', { dataSize: JSON.stringify(data).length });
    return data;
  } catch (error) {
    console.error('Error enhancing profile:', error);
    throw error;
  }
};

/**
 * Get detailed CV data
 * @param cvId - The ID of the CV to fetch
 * @returns The detailed CV data
 */
export const getCV = async (cvId: string) => {
  try {
    console.log(`Fetching detailed CV data for ID ${cvId}`);
    
    const response = await fetch(`/api/cv-detailed-view/${cvId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching CV data:', errorData);
      throw new Error(`Failed to fetch CV data: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Successfully fetched detailed CV data');
    return data;
  } catch (error) {
    console.error('Error in getCV function:', error);
    throw error;
  }
};

/**
 * Fetches raw CV data
 * @param cvId The CV ID
 * @returns The raw CV data
 */
export const getRawCV = async (cvId: string) => {
  try {
    console.log(`Fetching raw CV data for ID ${cvId}`);
    
    const response = await fetch(`/api/cv-raw/${cvId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching raw CV data:', errorData);
      throw new Error(`Failed to fetch raw CV data: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Successfully fetched raw CV data, size:', 
                data.raw_content ? data.raw_content.length : 0, 'characters');
    return data;
  } catch (error) {
    console.error('Error in getRawCV function:', error);
    throw error;
  }
};

/**
 * Sends a PDF file to the server for text extraction.
 * @param file The PDF file to extract text from.
 * @returns The extracted text content.
 */
export const extractPdfText = async (file: File, options: { signal?: AbortSignal } = {}): Promise<ApiExtractionResponse> => {
  const startTime = Date.now();
  try {
    logger.log('Extracting text from PDF', { fileName: file.name, fileSize: file.size });
    
    // Add a fast timeout to abort if taking too long
    const { signal } = options;
    
    // Create FormData for the file
    const formData = new FormData();
    formData.append('pdf', file);
    
    // Use fetch with timeout
    const response = await fetch(`${API_BASE_URL}/api/extract-pdf`, {
      method: 'POST',
      body: formData,
      signal, // Pass abort signal
    });
    
    if (!response.ok) {
      // Attempt to get the error message
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Server error: ${response.status}`;
      } catch {
        errorMessage = `HTTP error: ${response.status}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    // Validate response here instead of relying on the frontend
    if (!data || !data.text) {
      logger.error('Invalid response from PDF extraction:', data);
      throw new Error('Invalid response structure from PDF extraction API');
    }
    
    logger.log('Successfully extracted text from PDF', { 
      fileName: file.name, 
      textLength: data.text.length,
      duration: `${duration}ms`
    });
    
    // Return a standardized format
    return {
      success: true,
      result: {
        text: data.text,
        pages: data.pages || 0,
        characters: data.text.length,
        processingTimeMs: duration
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('PDF extraction timed out', { 
        fileName: file.name, 
        duration: `${duration}ms` 
      });
      throw new Error('PDF extraction timed out. Please try a smaller file or a different format.');
    }
    
    logger.error('Error extracting text from PDF', error);
    throw error;
  }
};

/**
 * Sends a PDF file to the server for improved text extraction using pdfminer.six.
 * This version provides better structure detection and section parsing.
 * @param file The PDF file to extract text from.
 * @returns The extracted text content with section information.
 */
export const extractPdfTextImproved = async (file: File) => {
  const logger = createComponentLogger('API.extractPdfTextImproved');
  try {
    logger.log('Sending PDF for GPT-only extraction', { fileName: file.name, fileSize: file.size });
    
    const formData = new FormData();
    formData.append('file', file);

    // Use the GPT-only extraction endpoint
    const response = await fetch(`${API_BASE_URL}/api/extract-pdf-gpt`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Server failed to extract text from PDF';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        logger.error('Server error during improved PDF extraction:', { status: response.status, errorData });
      } catch (e) {
        errorMessage = `${response.status}: ${response.statusText}`;
        logger.error('Server error during improved PDF extraction:', { status: response.status, statusText: response.statusText });
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data || !data.success || !data.result) {
      logger.error('Invalid server response format', data);
      throw new Error('Server returned an invalid response format after PDF extraction.');
    }

    // Add a sections property to match what the frontend expects
    // This is needed to prevent "Cannot convert undefined or null to object" errors
    if (!data.result.sections) {
      data.result.sections = {};
    }

    logger.log('Successfully extracted PDF text using GPT-4', { 
      fullTextLength: data.result.full_text?.length || 0,
      parsedData: !!data.result,
      source: data.source || 'unknown',
      workExperiences: data.result.work_experience?.length || 0
    });
    
    return data.result;
  } catch (error) {
    logger.error('Error calling improved PDF extraction', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred');
  }
};

/**
 * Job Scanning API Functions
 */

export const fetchJobSources = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job-sources`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch job sources');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching job sources:', error);
    throw error;
  }
};

export const createJobScanFilter = async (filterData: Partial<JobScanFilter>) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job-scan-filters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filterData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create job scan filter');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating job scan filter:', error);
    throw error;
  }
};

export const updateJobScanFilter = async (filterId: string, filterData: Partial<JobScanFilter>) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job-scan-filters/${filterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filterData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update job scan filter');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating job scan filter:', error);
    throw error;
  }
};

export const deleteJobScanFilter = async (filterId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job-scan-filters/${filterId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete job scan filter');
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting job scan filter:', error);
    throw error;
  }
};

export const fetchJobScanFilters = async (userId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job-scan-filters?userId=${userId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch job scan filters');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching job scan filters:', error);
    throw error;
  }
};

export const fetchScannedJobs = async (
  userId: string, 
  filterId: string | null = null, 
  status: string | null = null, 
  page: number = 1, 
  limit: number = 20
) => {
  try {
    let url = `${API_BASE_URL}/api/scanned-jobs?userId=${userId}&page=${page}&limit=${limit}`;
    
    if (filterId) url += `&filterId=${filterId}`;
    if (status) url += `&status=${status}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch scanned jobs');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching scanned jobs:', error);
    throw error;
  }
};

export const updateScannedJobStatus = async (
  jobId: string, 
  status: ScannedJob['status'], 
  notes: string | null = null
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/scanned-jobs/${jobId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, notes }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update job status');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
};

export const runJobScanNow = async (filterId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/job-scan-filters/${filterId}/run`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to run job scan');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error running job scan:', error);
    throw error;
  }
};

/**
 * Sends raw text content to the server for parsing using GPT.
 * @param text The text content to parse.
 * @returns The structured data result from the server.
 */
export const parseCvText = async (text: string) => {
  const logger = createComponentLogger('API.parseCvText');
  try {
    logger.log('Sending raw text for server-side parsing', { textLength: text.length });
    
    const response = await fetch(`${API_BASE_URL}/api/parse-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }), // Send text in JSON body
    });

    if (!response.ok) {
      let errorMessage = 'Server failed to parse text';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        logger.error('Server error during text parsing:', { status: response.status, errorData });
      } catch (e) {
        errorMessage = `${response.status}: ${response.statusText}`;
        logger.error('Server error during text parsing (non-JSON response):', { status: response.status, statusText: response.statusText });
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data || !data.success || !data.result) {
      logger.error('Invalid server response format after text parsing', data);
      throw new Error('Server returned an invalid response format after text parsing.');
    }

    logger.log('Successfully parsed text using GPT', { 
      source: data.source || 'unknown',
      workExperiences: data.result.structured_data?.work_experience?.length || 0
    });
    
    // Return the same structure as extractPdfText for consistency
    return data.result;
  } catch (error) {
    logger.error('Error calling text parsing endpoint', error);
    throw error instanceof Error ? error : new Error('An unknown error occurred');
  }
}; 