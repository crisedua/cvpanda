import { createComponentLogger } from './logger';
import { JobScanFilter, ScannedJob } from '../types/index';
import { extractTextFromDOCX } from './documentParser'; // Assuming it's exported from here

const logger = createComponentLogger('API');

// Revert back to direct API URL - CORS must be fixed on Railway backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Fetch all CVs for a user
export const fetchUserCVs = async (userId: string) => {
  try {
    logger.log('Fetching CVs for user', { userId });
    
    if (!userId || userId.trim() === '') {
      console.error('Invalid user ID provided to fetchUserCVs:', userId);
      return [];
    }
    
    console.log('Making request to:', `${API_BASE_URL}/api/cvs?userId=${userId}`);
    const response = await fetch(`${API_BASE_URL}/api/cvs?userId=${userId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response from server:', errorData);
      throw new Error(errorData.error || 'Failed to fetch CVs');
    }
    
    const data = await response.json();
    console.log('Successfully fetched CVs, count:', data.length, 'data:', data);
    return data;
  } catch (error) {
    logger.error('Error fetching CVs', error);
    console.error('Detailed error fetching CVs:', error);
    throw error;
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
    logger.log('Deleting CV', { cvId });
    const response = await fetch(`${API_BASE_URL}/api/cvs/${cvId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete CV');
    }
    
    logger.log('Successfully deleted CV', { cvId });
    return true;
  } catch (error) {
    logger.error('Error deleting CV', error);
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
export const extractPdfTextServer = async (file: File): Promise<string> => {
  const logger = createComponentLogger('API.extractPdfTextServer');
  try {
    logger.log('Sending PDF for server-side extraction', { fileName: file.name, fileSize: file.size });
    
    const formData = new FormData();
    formData.append('pdfFile', file, file.name); // Add filename

    // Try the Python-powered endpoint first
    try {
      logger.log('Attempting to use Python-powered PDF extraction');
      const pythonResponse = await fetch(`${API_BASE_URL}/api/extract-pdf-text-python`, {
        method: 'POST',
        body: formData,
      });

      if (pythonResponse.ok) {
        const data = await pythonResponse.json();
        if (data && typeof data.text === 'string') {
          logger.log('Successfully extracted PDF text via Python service', { textLength: data.text.length });
          return data.text;
        }
      }
      
      logger.warn('Python PDF extraction failed, falling back to Node.js extraction', 
        { status: pythonResponse.status, statusText: pythonResponse.statusText });
    } catch (pythonError) {
      logger.warn('Error using Python PDF extraction, falling back to Node.js extraction', pythonError);
    }

    // Fall back to original Node.js endpoint
    logger.log('Falling back to Node.js PDF extraction');
    const response = await fetch(`${API_BASE_URL}/api/extract-pdf-text`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Server failed to extract text from PDF';
      let errorDetails = null;
      
      // Clone the response immediately before consuming it
      let responseForText;
      try {
        responseForText = response.clone();
      } catch (cloneError) {
        // If cloning fails, just log it but continue
        logger.warn('Could not clone response for text fallback:', cloneError);
      }
      
      try {
        // Attempt to parse JSON first
        errorDetails = await response.json(); 
        errorMessage = errorDetails.error || errorMessage;
        logger.error('Server error during PDF extraction (JSON response):', errorDetails);
      } catch (jsonError) { 
        // If JSON parsing fails, THEN try reading as text
        logger.warn('Could not parse error response as JSON, trying text...', jsonError);
        try {
          // Use the previously cloned response if available
          if (responseForText) {
            const textResponse = await responseForText.text();
            logger.error('Non-JSON server error during PDF extraction:', { status: response.status, text: textResponse });
            errorMessage += `: ${response.status} - ${textResponse}`;
          } else {
            // If we couldn't clone, at least log the response status
            logger.error('Could not read response body (already consumed):', { status: response.status });
            errorMessage += `: ${response.status} - ${response.statusText}`;
          }
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
    if (!data || typeof data.text !== 'string') { // Check if text field is a string
      logger.error('Invalid server response format', data);
      throw new Error('Server returned an invalid response format after PDF extraction.');
    }

    logger.log('Successfully extracted PDF text via Node.js service', { textLength: data.text.length });
    return data.text;

  } catch (error) {
    logger.error('Error calling server-side PDF extraction', error);
    // Re-throw the original error or a new one if needed
    throw error instanceof Error ? error : new Error('An unknown error occurred');
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

// Function to extract text and structured data from a PDF file
export const extractPdfText = async (file: File) => {
  const logger = createComponentLogger('API.extractPdfText');
  try {
    logger.log('Starting PDF extraction request', { filename: file.name, size: file.size });

    const formData = new FormData();
    formData.append('file', file);

    // Log the endpoint being called
    const endpoint = `${API_BASE_URL}/api/extract-pdf-gpt`;
    logger.log('Calling endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData, // Send as FormData, not JSON
      // Do NOT set Content-Type header, browser will set it correctly with boundary for FormData
    });

    if (!response.ok) {
      let errorMessage = 'Failed to extract data from PDF';
      let errorDetails = null;
      
      // Clone the response immediately before consuming it
      let responseForText;
      try {
        responseForText = response.clone();
      } catch (cloneError) {
        // If cloning fails, just log it but continue
        logger.warn('Could not clone response for text fallback:', cloneError);
      }
      
      try {
        // Attempt to parse JSON first
        errorDetails = await response.json(); 
        errorMessage = errorDetails.error || errorMessage;
        logger.error('Server error during PDF extraction (JSON response):', errorDetails);
      } catch (jsonError) { 
        // If JSON parsing fails, THEN try reading as text
        logger.warn('Could not parse error response as JSON, trying text...', jsonError);
        try {
          // Use the previously cloned response if available
          if (responseForText) {
            const textResponse = await responseForText.text();
            logger.error('Non-JSON server error during PDF extraction:', { status: response.status, text: textResponse });
            errorMessage += `: ${response.status} - ${textResponse}`;
          } else {
            // If we couldn't clone, at least log the response status
            logger.error('Could not read response body (already consumed):', { status: response.status });
            errorMessage += `: ${response.status} - ${response.statusText}`;
          }
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
    
    // Correctly access the nested result object
    if (!data || !data.result || (!data.result.structured_data && !data.result.gpt_data)) {
        logger.error('Invalid response structure (missing result or nested data):', data);
        throw new Error('Server returned an invalid response structure after PDF extraction.');
    }

    logger.log('Successfully extracted data from PDF');
    // Transform to format expected by CVUpload component
    return {
      success: true,
      cvData: data.result.gpt_data || data.result
    };

  } catch (error) {
    logger.error('Error extracting PDF text', error);
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