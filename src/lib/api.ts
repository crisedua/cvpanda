import { createComponentLogger } from './logger';
import { JobScanFilter, ScannedJob } from '../types/index';
import { extractTextFromDOCX } from './documentParser'; // Assuming it's exported from here
import { supabase } from './supabase';

const logger = createComponentLogger('API');

// Revert back to direct API URL - CORS must be fixed on Railway backend
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace('http://', 'https://');

console.log('🌐 API Base URL:', API_BASE_URL);

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
    
    // Only fetch from parsed_cvs table - our single source of truth
    console.log('🔍 Fetching CVs from parsed_cvs table...');
    console.log('🔑 Using user ID:', userId);
    
    const { data: userCVs, error: dbError } = await supabase
      .from('parsed_cvs')
      .select('*')
      .eq('user_id', userId)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });
      
    if (dbError) {
      console.error('❌ Error fetching from parsed_cvs:', dbError);
      return [];
    }
    
    console.log('✅ Successfully fetched CVs from parsed_cvs, count:', userCVs?.length || 0);
    console.log('🔍 Raw records:', userCVs);
    
    // Standardize data format to match the CVList component expectations
    const standardizedCVs = (userCVs || []).map(cv => {
      return {
        id: cv.id,
        userId: cv.user_id,
        user_id: cv.user_id,
        filename: cv.file_name || 'Unnamed CV',
        file_name: cv.file_name,
        isFavorite: cv.is_favorite,
        is_favorite: cv.is_favorite,
        createdAt: cv.created_at,
        created_at: cv.created_at,
        lastUpdated: cv.updated_at,
        source: 'parsed_cvs',
        // Provide data in both expected formats for compatibility
        parsed_data: {
          name: cv.name,
          email: cv.email,
          phone: cv.phone,
          linkedin: cv.linkedin_url,
          github: cv.github_url,
          website: cv.website_url,
          location: cv.location,
          title: cv.job_title,
          summary: cv.summary,
          skills: cv.skills,
          work_experience: cv.work_experience,
          education: cv.education,
        },
        // Also provide data in the format expected by some components
        parsedData: {
          name: cv.name,
          email: cv.email,
          phone: cv.phone,
          linkedin: cv.linkedin_url,
          github: cv.github_url,
          website: cv.website_url,
          location: cv.location,
          title: cv.job_title,
          summary: cv.summary,
          skills: cv.skills,
          work_experience: cv.work_experience,
          education: cv.education,
        },
        // Add metadata in both formats
        metadata: {
          name: cv.name,
          email: cv.email,
          phone: cv.phone,
        },
        // Include raw content if available
        content: cv.full_text,
        full_text: cv.full_text,
      };
    });
    
    console.log('📊 Standardized CV count:', standardizedCVs.length);
    return standardizedCVs;
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
    
    // First try to delete the actual file from storage
    try {
      console.log('Finding file path for CV:', cvId);
      const { data: filePathData, error: filePathError } = await supabase
        .from('storage_file_paths')
        .select('file_path')
        .eq('cv_id', cvId)
        .maybeSingle();
      
      if (filePathError) {
        console.warn('Error getting file path:', filePathError);
      } else if (filePathData && filePathData.file_path) {
        console.log('Found file path:', filePathData.file_path);
        
        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from('cvs')
          .remove([filePathData.file_path]);
          
        if (storageError) {
          console.warn('Error deleting file from storage:', storageError);
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
      console.warn('Exception deleting file from storage:', storageError);
      // Continue with database deletion even if storage cleanup fails
    }
    
    // Delete from parsed_cvs table - our single source of truth
    console.log('Deleting CV from parsed_cvs table...');
    const { data: deletedRecord, error: deleteError } = await supabase
      .from('parsed_cvs')
      .delete()
      .eq('id', cvId)
      .select()
      .single();
    
    if (deleteError) {
      if (deleteError.code === 'PGRST116') {
        // Not found
        console.warn('CV not found in parsed_cvs table');
        return { success: false, message: 'CV not found' };
      } else {
        console.error('Error deleting CV from parsed_cvs:', deleteError);
        throw deleteError;
      }
    }
    
    if (deletedRecord) {
      console.log('Successfully deleted CV from parsed_cvs table');
      return { success: true, message: 'CV deleted successfully' };
    } else {
      console.warn('No CV was deleted (not found)');
      return { success: false, message: 'CV not found' };
    }
    
  } catch (error) {
    logger.error('Error in deleteCV:', error);
    throw error;
  }
};

// Toggle favorite status
export const toggleFavorite = async (cvId: string) => {
  try {
    logger.log('Toggling favorite for CV:', cvId);
    
    // First, get the current favorite status
    const { data: cv, error: fetchError } = await supabase
      .from('parsed_cvs')
      .select('id, is_favorite')
      .eq('id', cvId)
      .single();
    
    if (fetchError) {
      logger.error('Error fetching CV favorite status:', fetchError);
      throw new Error('Failed to find CV');
    }
    
    // Toggle the favorite status
    const newFavoriteStatus = !cv.is_favorite;
    logger.log(`Updating favorite status to: ${newFavoriteStatus}`);
    
    const { data: updatedCV, error: updateError } = await supabase
      .from('parsed_cvs')
      .update({ is_favorite: newFavoriteStatus })
      .eq('id', cvId)
      .select()
      .single();
    
    if (updateError) {
      logger.error('Error updating favorite status:', updateError);
      throw new Error('Failed to update favorite status');
    }
    
    logger.log('Successfully updated favorite status');
    
    // Format the response to maintain compatibility with the existing interface
    return { 
      success: true, 
      cv: {
        ...updatedCV,
        isFavorite: updatedCV.is_favorite, // Add isFavorite property for components expecting it
      } 
    };
  } catch (error) {
    logger.error('Error in toggleFavorite:', error);
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
 * Parse raw CV text without requiring a PDF file
 * @param text Raw text from the CV to parse
 * @returns The parsed CV data
 */
export const parseCvText = async (text: string): Promise<ApiExtractionResponse> => {
  const startTime = Date.now();
  try {
    console.log('🔄 Parsing CV text, length:', text.length, 'characters');
    
    if (!text || text.trim().length === 0) {
      throw new Error('Empty text provided for CV parsing');
    }
    
    // Use fetch with timeout for better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // INCREASED to 60 second timeout
    
    console.log(`📤 Sending text to ${API_BASE_URL}/api/parse-text`);
    
    let attempts = 0;
    let lastError: any = null;
    
    while (attempts < 3) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/parse-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
          credentials: 'omit' // Important: don't send cookies for cross-origin
        });
        
        clearTimeout(timeoutId);
        
        // Handle HTTP errors
        if (!response.ok) {
          console.warn(`❌ Server error (${response.status}) on attempt ${attempts + 1}`);
          const responseText = await response.text();
          console.warn('Response body:', responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
          
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Successfully parsed CV text in', Date.now() - startTime, 'ms');
        
        // Return standardized response format
        return {
          success: true,
          cvData: data.cvData // Ensure we expect cvData here
        };
      } catch (fetchError: any) {
        lastError = fetchError;
        attempts++;
        
        if (fetchError.name === 'AbortError') {
          console.error('❌ Text parsing request timed out after 60s'); // Update log message
          break; // Don't retry timeouts
        }
        
        console.error(`❌ Text parsing attempt ${attempts} failed:`, fetchError.message);
        
        // Wait before retrying (500ms, 1000ms, then give up)
        if (attempts < 3) {
          const delay = 500 * attempts;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('❌ Text parsing failed after multiple attempts');
    throw lastError || new Error('Failed to parse CV text after multiple attempts');
  } catch (error) {
    console.error('❌ Text parsing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in parseCvText'
    };
  }
};

/**
 * Legacy export for backwards compatibility with documentParser.ts
 * This function maintains the old interface for PDF extraction
 * @param file The PDF file to extract text from.
 * @returns Plain string text content
 */
export const extractPdfTextServer = async (file: File): Promise<string> => {
  try {
    // Use the new implementation but adapt the return value
    const result = await extractPdfText(file);
    
    // Return only the text content to maintain compatibility
    if (result && result.success && result.result && result.result.text) {
      return result.result.text;
    }
    
    throw new Error('Failed to extract text from PDF');
  } catch (error) {
    console.error('Error in extractPdfTextServer:', error);
    throw error;
  }
}; 