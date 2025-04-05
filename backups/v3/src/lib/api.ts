import { createComponentLogger } from './logger';

const logger = createComponentLogger('API');
const API_BASE_URL = 'http://localhost:3001';

// Fetch all CVs for a user
export const fetchUserCVs = async (userId: string) => {
  try {
    logger.log('Fetching CVs for user', { userId });
    const response = await fetch(`${API_BASE_URL}/api/cvs?userId=${userId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch CVs');
    }
    
    const data = await response.json();
    logger.log('Successfully fetched CVs', { count: data.length });
    return data;
  } catch (error) {
    logger.error('Error fetching CVs', error);
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
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        logger.error('Server error during parsing:', errorData);
      } catch (e) { /* Ignore JSON parse error */ }
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