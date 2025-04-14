import { createComponentLogger } from './logger';
import { JobScanFilter, ScannedJob } from '../types/index';
import { extractTextFromDOCX } from './documentParser'; // Assuming it's exported from here
import { supabase } from './supabase';
import { ParsedCVData, ProfileEnhancementResult } from '../types'; // Ensure types are imported

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

// Fetch all CVs for a given user ID via backend API
export const fetchUserCVs = async (userId: string) => {
  if (!userId) {
    logger.error('fetchUserCVs called without userId');
    throw new Error('User ID is required to fetch CVs.');
  }
  if (!API_BASE_URL) {
    logger.error('API_BASE_URL not configured for fetchUserCVs');
    throw new Error('API base URL is not configured.');
  }

  const targetUrl = `${API_BASE_URL}/api/cvs?userId=${encodeURIComponent(userId)}`;
  logger.log('Fetching user CVs via API:', { userId, url: targetUrl });

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch CVs';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Server error ${response.status}`;
        logger.error('Error fetching CVs (server response):', { status: response.status, errorData });
      } catch (e) {
        errorMessage = `Server error ${response.status} fetching CVs.`;
        logger.error('Error fetching CVs, non-JSON response:', { status: response.status, text: await response.text() });
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (data.success && Array.isArray(data.cvs)) {
      logger.log('Successfully fetched CVs via API', { count: data.cvs.length });
      // Data should already be sorted by the backend and include isFavorite
      return data.cvs;
    } else {
      logger.error('Invalid response format from fetch CVs API', { data });
      throw new Error(data.error || 'Invalid response format from server.');
    }

  } catch (error) {
    logger.error('Error in fetchUserCVs function:', error);
    throw error; // Re-throw to be caught by the component
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
  console.log(`[api.ts deleteCV] Function called with ID: ${cvId}`); // LOG A: Function entry
  if (!cvId) {
    console.error('[api.ts deleteCV] Error: No cvId provided.');
    throw new Error('No CV ID provided for deletion.');
  }
  if (!API_BASE_URL) {
     console.error('[api.ts deleteCV] Error: API_BASE_URL is not set.');
     throw new Error('API base URL is not configured.');
  }
  
  const targetUrl = `${API_BASE_URL}/api/cvs/${cvId}`;
  console.log(`[api.ts deleteCV] Target URL: ${targetUrl}`); // LOG B: Target URL
  
  try {
    logger.log('Attempting to delete CV via backend endpoint:', cvId);
    console.log(`[api.ts deleteCV] Sending DELETE request to: ${targetUrl}`); // LOG C: Before fetch
    
    const response = await fetch(targetUrl, {
      method: 'DELETE',
    });
    console.log(`[api.ts deleteCV] Fetch response status: ${response.status}`); // LOG D: After fetch

    if (!response.ok) {
      let errorMessage = 'Failed to delete CV';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Server error ${response.status}`;
        if (response.status === 404) {
          errorMessage = 'CV not found on server.';
        }
        console.error('[api.ts deleteCV] Error deleting CV (server response):', errorData); // LOG E: Server error JSON
      } catch (e) {
        const responseText = await response.text();
        errorMessage = `Server error ${response.status} during delete. Response: ${responseText.substring(0,100)}`;
        console.error('[api.ts deleteCV] Error deleting CV, non-JSON response:', responseText); // LOG F: Server error text
      }
      throw new Error(errorMessage);
    }
    
    // Assuming the backend returns { success: true, message: '...' } on success
    const data = await response.json();
    console.log('[api.ts deleteCV] Backend response data:', data); // LOG G: Success response
    
    if (data.success) {
        console.log('[api.ts deleteCV] Successfully deleted CV via backend endpoint');
        return { success: true, message: data.message || 'CV deleted successfully' };
    } else {
        console.warn('[api.ts deleteCV] Backend reported delete failure:', data.message);
        throw new Error(data.message || 'Backend failed to delete CV');
    }

  } catch (error) {
    console.error('[api.ts deleteCV] Error in deleteCV function catch block:', error); // LOG H: Catch block
    logger.error('Error in deleteCV function:', error);
    throw error; // Re-throw to be caught by the component
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

// --- Profile Enhancement ---
export const enhanceProfile = async (
  cvId: string, 
  targetPlatform: 'linkedin' | 'resume',
  industryFocus: string,
  careerLevel: string
): Promise<{ success: boolean; enhancedData?: ProfileEnhancementResult; error?: string }> => {
  const logger = createComponentLogger('API:enhanceProfile');
  logger.log('Starting profile enhancement call', { cvId, targetPlatform, industryFocus, careerLevel });

  if (!API_BASE_URL) {
    logger.error('API_BASE_URL is not configured');
    return { success: false, error: 'API URL is not configured.' };
  }
  if (!cvId) {
     logger.error('CV ID is required for enhancement');
     return { success: false, error: 'CV ID is required.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/enhance-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        cvId, 
        targetPlatform, 
        industryFocus, 
        careerLevel 
      }),
    });

    if (!response.ok) {
      let errorBody = { error: `Server error ${response.status}` };
      try {
        errorBody = await response.json();
      } catch (e) { /* Ignore if response is not JSON */ }
      logger.error(`Enhancement API call failed: ${response.status}`, errorBody);
      throw new Error(errorBody.error || `Server returned ${response.status}`);
    }

    const data = await response.json();
    
    // Validate success and presence of enhancedData
    if (data.success && data.enhancedData) {
        logger.log('Profile enhancement successful', { cvId });
        return { success: true, enhancedData: data.enhancedData };
    } else {
        logger.error('Enhancement API returned success=false or missing data', data);
        return { success: false, error: data.error || 'Invalid response from enhancement API' };
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch enhancement results';
    logger.error(`Exception during profile enhancement fetch: ${errorMessage}`);
    return { success: false, error: errorMessage };
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
    console.log('🔄 Extracting text from PDF', { fileName: file.name, fileSize: file.size });
    
    // Create a custom AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏱️ PDF extraction timeout triggered after 45 seconds');
      controller.abort();
    }, 45000); // 45 second timeout
    
    // Use either our timeout signal or the provided one
    const signal = options.signal || controller.signal;
    
    // Create FormData for the file
    const formData = new FormData();
    formData.append('pdf', file);
    
    console.log(`📤 Sending PDF to ${API_BASE_URL}/api/extract-pdf...`);
    
    // Use fetch with timeout
    const response = await fetch(`${API_BASE_URL}/api/extract-pdf`, {
      method: 'POST',
      body: formData,
      signal, // Pass abort signal
    });
    
    // Clear our timeout if we set one
    if (timeoutId) clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Attempt to get the error message
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Server error: ${response.status}`;
        console.error('❌ Server returned error:', errorMessage);
      } catch (e) {
        errorMessage = `HTTP error: ${response.status}`;
        console.error('❌ Server error (non-JSON response):', response.status);
      }
      
      throw new Error(errorMessage);
    }
    
    console.log('✅ Server response received, parsing JSON...');
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    // Validate response here instead of relying on the frontend
    if (!data || !data.text) {
      console.error('❌ Invalid response from PDF extraction:', data);
      throw new Error('Invalid response structure from PDF extraction API');
    }
    
    console.log('✅ Successfully extracted text from PDF', { 
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
      console.error('⏱️ PDF extraction timed out', { 
        fileName: file.name, 
        duration: `${duration}ms` 
      });
      return {
        success: false,
        error: 'PDF extraction timed out after 45 seconds. Please try a smaller file or a different format.'
      };
    }
    
    console.error('❌ Error extracting text from PDF:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in PDF extraction'
    };
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

// Upload a file and parse it (Handles PDF and DOCX)
export const uploadAndParseCV = async (file: File) => {
  const startTime = Date.now();
  logger.log('Starting CV upload and parse process...', { filename: file.name, size: file.size });

  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    let extractionEndpoint = '';

    if (fileExt === 'pdf') {
      extractionEndpoint = `${API_BASE_URL}/api/extract-pdf`;
    } else if (['docx', 'doc'].includes(fileExt || '')) {
      extractionEndpoint = `${API_BASE_URL}/api/extract-docx`;
    } else {
      throw new Error('Unsupported file format for direct extraction.');
    }

    // --- Step 1: Extract Text using the fast endpoint --- 
    console.log(`Step 1: Uploading ${file.name} to ${extractionEndpoint} for text extraction...`);
    const formData = new FormData();
    // IMPORTANT: The backend endpoint expects the key 'pdf' or 'file' based on the route
    const fileKey = extractionEndpoint.includes('extract-pdf') ? 'pdf' : 'file';
    formData.append(fileKey, file);

    const extractionResponse = await fetch(extractionEndpoint, {
      method: 'POST',
      body: formData,
      // No timeout needed here, should be fast
    });

    if (!extractionResponse.ok) {
      let errorText = 'Failed to extract text from file.';
      try {
        const errorData = await extractionResponse.json();
        errorText = errorData.error || errorText;
        console.error('Text extraction failed:', errorData);
      } catch (e) {
        errorText = `Server error ${extractionResponse.status} during text extraction.`;
        console.error('Text extraction failed, non-JSON response:', await extractionResponse.text());
      }
      throw new Error(errorText);
    }

    const extractionData = await extractionResponse.json();
    const textContent = extractionData.text;

    if (!textContent || typeof textContent !== 'string' || textContent.trim().length === 0) {
      console.error('No text content extracted from file.');
      throw new Error('Could not extract text content from the uploaded file.');
    }
    
    console.log(`Step 1 Complete: Extracted ${textContent.length} characters in ${Date.now() - startTime}ms.`);

    // --- Step 2: Parse the extracted text using GPT --- 
    console.log(`Step 2: Sending extracted text (${textContent.length} chars) to /api/parse-text...`);
    const parseStartTime = Date.now();
    
    // Use the existing parseCvText function which already includes timeout and retries
    const parseResult = await parseCvText(textContent);
    
    console.log(`Step 2 Complete: Text parsing finished in ${Date.now() - parseStartTime}ms.`);
    console.log('Total processing time:', Date.now() - startTime, 'ms');

    // Return the result from parseCvText (which should be { success: true, cvData: ... } or { success: false, error: ... })
    return parseResult;

  } catch (error) {
    logger.error('Error in uploadAndParseCV:', error);
    // Return error in the standardized format
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during CV processing'
    };
  }
};

// --- Job Search ---
export interface JobSearchResult {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
  source: string; // e.g., 'Trabajando.com'
}

export interface JobSearchResponse {
  success: boolean;
  jobs?: JobSearchResult[];
  error?: string;
}

export const searchJobs = async (interest: string, location: string): Promise<JobSearchResponse> => {
  const logger = createComponentLogger('API:searchJobs');
  logger.log(`Searching jobs for interest="${interest}", location="${location}"`);

  if (!API_BASE_URL) {
    logger.error('API_BASE_URL is not configured');
    return { success: false, error: 'API URL is not configured.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/search-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ interest, location }),
      // Add timeout? Consider long scraping times
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = { error: response.statusText };
      }
      logger.error(`Server error ${response.status}: ${JSON.stringify(errorBody)}`);
      throw new Error(errorBody.error || `Server returned ${response.status}`);
    }

    const data: JobSearchResponse = await response.json();
    logger.log(`Received ${data.jobs?.length || 0} job results`);
    return data;

  } catch (error: any) {
    logger.error(`Error during job search fetch: ${error.message}`);
    return { success: false, error: error.message || 'Failed to fetch job search results' };
  }
}; 