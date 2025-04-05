require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const crypto = require('crypto');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Request started`);
  
  // Log request body for POST/PUT requests (with size limit for readability)
  if (['POST', 'PUT'].includes(req.method) && req.body) {
    const bodySize = JSON.stringify(req.body).length;
    console.log(`Request body size: ${bodySize} bytes`);
    if (bodySize < 1000) {
      console.log('Request body:', JSON.stringify(req.body));
    } else {
      console.log('Request body keys:', Object.keys(req.body));
      if (req.body.cvData) {
        console.log('CV data keys:', Object.keys(req.body.cvData));
      }
    }
  }
  
  // Log response when completed
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Response: ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Add custom error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Server error occurred',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Initialize Supabase client with server-side auth headers
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        // Set headers to bypass RLS - this simulates a server-side request
        'X-Client-Info': 'server',
        'X-Server-Authorization': 'bypass-rls'
      }
    }
  }
);

// For any auth request, set dummy user ID for RLS bypass
(async function initializeAuth() {
  try {
    // Set up auth state with anonymous access
    const { data, error } = await supabase.auth.signUp({
      email: 'server@example.com',
      password: 'server-password-bypass'
    });
    
    if (error) {
      console.log('Auth error during setup:', error);
    } else {
      console.log('Auth setup complete:', data.user?.id || 'No user ID');
    }
  } catch (error) {
    console.error('Error during auth setup:', error);
  }
})();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check endpoint - Make sure path is exactly /api/health
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      supabase: (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) ? 'configured' : 'missing',
      pinecone: process.env.PINECONE_API_KEY ? 'configured' : 'missing'
    }
  };
  
  res.json(healthInfo);
});

// Debug endpoint to check request handling
app.post('/api/debug', (req, res) => {
  console.log('Debug endpoint called');
  console.log('Request body size:', JSON.stringify(req.body).length, 'bytes');
  console.log('Request body type:', typeof req.body);
  console.log('Request body keys:', Object.keys(req.body));
  
  res.json({
    received: true,
    bodySize: JSON.stringify(req.body).length,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body)
  });
});

// Test endpoint for browser debugging
app.get('/api/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({
    status: 'success',
    message: 'Server is working correctly',
    timestamp: new Date().toISOString()
  });
});

// Base route
app.get('/', (req, res) => {
  res.json({ status: 'CV Management API is running' });
});

// Analyze skill gaps between CV and job description
app.post('/api/analyze-skill-gaps', async (req, res) => {
  try {
    console.log('Analyze skill gaps endpoint called');
    const { cvId, jobDescription } = req.body;
    
    if (!cvId) {
      return res.status(400).json({ error: 'Missing CV ID' });
    }
    
    if (!jobDescription || jobDescription.trim() === '') {
      return res.status(400).json({ error: 'Missing or empty job description' });
    }
    
    // Fetch the CV from Supabase
    const { data: cv, error: cvError } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .single();
    
    if (cvError) {
      console.error('Error fetching CV:', cvError);
      return res.status(404).json({ error: 'CV not found' });
    }
    
    // Extract CV content
    const cvContent = cv.parsed_data;
    
    // Prepare prompt for OpenAI
    const systemPrompt = `You are an expert career advisor specializing in skill gap analysis. 
    Analyze the following CV and job description to identify matching skills, missing skills, and provide recommendations.`;
    
    const userPrompt = `
    # CV Information
    ${JSON.stringify(cvContent, null, 2)}
    
    # Job Description
    ${jobDescription}
    
    Perform a detailed skill gap analysis between the CV and the job description. 
    Return a JSON object with the following structure:
    {
      "matchPercentage": number, // overall match percentage (0-100)
      "matchedSkills": [
        {
          "name": string, // name of the skill
          "relevance": "high" | "medium" | "low", // relevance to the job
          "description": string // brief explanation of how this skill matches
        }
      ],
      "missingSkills": [
        {
          "name": string, // name of the missing skill
          "importance": "critical" | "important" | "nice-to-have", // importance for the job
          "description": string // explanation of why this skill is important
        }
      ],
      "recommendations": [
        {
          "type": "course" | "certification" | "project" | "experience", // type of recommendation
          "title": string, // title of the recommendation
          "description": string, // description of the recommendation
          "link": string, // optional link to resource (can be empty if not applicable)
          "timeToAcquire": string // estimated time to acquire this skill
        }
      ],
      "keywordOptimization": [
        {
          "original": string, // original text or wording in CV
          "suggested": string, // suggested improvement
          "reason": string // reason for the change
        }
      ],
      "summary": string // overall summary of the analysis
    }`;
    
    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview', // or any available model that fits your needs
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    // Parse the response
    const result = JSON.parse(completion.choices[0].message.content);
    
    // Return the analysis result
    return res.json({ success: true, result });
    
  } catch (error) {
    console.error('Error analyzing skill gaps:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze skill gaps', 
      details: error.message 
    });
  }
});

// Store CV endpoint
app.post('/api/store-cv', async (req, res) => {
  try {
    console.log('Store CV endpoint called');
    console.log('Request body size:', JSON.stringify(req.body).length, 'bytes');
    
    const { userId, cvData } = req.body;
    
    // Check if userId and cvData are provided
    if (!userId) {
      console.log('Missing userId in request');
      return res.status(400).json({ error: 'Missing userId in request' });
    }
    
    if (!cvData) {
      console.log('Missing cvData in request');
      return res.status(400).json({ error: 'Missing cvData in request' });
    }
    
    console.log('CV data received for user:', userId);
    console.log('CV data type:', typeof cvData);
    console.log('CV data keys:', Object.keys(cvData));
    
    if (!cvData.filename) {
      console.log('CV data is missing filename');
      return res.status(400).json({ error: 'CV data is missing filename' });
    }
    
    // Generate a UUID v4 for the CV ID
    const id = crypto.randomUUID();

    // Prepare CV data from either direct fields or parsed data
    let metadata = {};
    if (cvData.parsed_data) {
      // Handle the older format where data is in parsed_data
      metadata = cvData.parsed_data;
      console.log('Using parsed_data field for metadata');
    } else {
      // Handle the new format where fields are directly in cvData
      metadata = {
        name: cvData.name || '',
        email: cvData.email || '',
        phone: cvData.phone || '',
        skills: cvData.skills || [],
        experience: cvData.experience || [],
        education: cvData.education || []
      };
      console.log('Constructed metadata from individual fields');
    }

    // Create a file path for consistency with schema
    const timestamp = new Date().getTime();
    const fileExt = cvData.filename.split('.').pop();
    const filePath = `${userId}/${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    console.log('About to insert CV with ID:', id);
    
    // First, try to store the file content in Storage if available
    let fileUploadSuccess = false;
    let fileContent = null;
    
    // Check if we have content in any of the possible fields
    if (cvData.content) {
      fileContent = cvData.content;
      console.log('Found content field in cvData');
    } else if (cvData.file) {
      fileContent = cvData.file;
      console.log('Found file field in cvData');
    } else if (cvData.fileContent) {
      fileContent = cvData.fileContent;
      console.log('Found fileContent field in cvData');
    } else if (cvData.text) {
      fileContent = cvData.text;
      console.log('Found text field in cvData');
    }
    
    if (fileContent) {
      try {
        console.log('Storing file content in Storage bucket, content type:', typeof fileContent);
        
        // Prepare content for storage
        let binaryContent = fileContent;
        
        // Handle different content formats
        if (typeof fileContent === 'string') {
          if (fileContent.startsWith('data:')) {
            // Handle base64 data URL
            const base64Content = fileContent.split(',')[1];
            binaryContent = Buffer.from(base64Content, 'base64');
            console.log('Converted data URL to Buffer');
          } else {
            // Treat as plain text or base64
            try {
              // Try to convert from base64
              binaryContent = Buffer.from(fileContent, 'base64');
              console.log('Converted base64 string to Buffer');
            } catch (e) {
              // If fails, treat as plain text
              binaryContent = Buffer.from(fileContent, 'utf-8');
              console.log('Using plain text content as UTF-8 Buffer');
            }
          }
        } else if (fileContent instanceof Buffer) {
          console.log('Content already in Buffer format');
        } else if (typeof fileContent === 'object') {
          // Try to stringify the object
          binaryContent = Buffer.from(JSON.stringify(fileContent), 'utf-8');
          console.log('Converted object to JSON string Buffer');
        }
        
        // Make sure the cvs bucket exists
        try {
          const { data: bucketData, error: bucketError } = await supabase
            .storage
            .getBucket('cvs');
          
          if (bucketError && bucketError.message.includes('not found')) {
            console.log('Creating cvs bucket');
            await supabase.storage.createBucket('cvs', {
              public: false,
              allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
              fileSizeLimit: 10485760 // 10MB
            });
          }
        } catch (bucketError) {
          console.error('Bucket check/creation error:', bucketError);
        }
        
        // Store in Supabase Storage
        const { data: storageData, error: storageError } = await supabase
          .storage
          .from('cvs')
          .upload(filePath, binaryContent, {
            contentType: `application/${fileExt}`,
            upsert: true
          });
          
        if (storageError) {
          console.error('Error storing file in Supabase Storage:', storageError);
        } else {
          console.log('File stored successfully in Storage');
          fileUploadSuccess = true;
        }
      } catch (storageError) {
        console.error('Exception during file storage:', storageError);
        // Continue with database insertion even if storage fails
      }
    } else {
      console.log('No file content provided in any recognized field');
    }
    
    // Always insert the database record, even if file storage failed
    try {
      // Insert record in database
      const { data, error } = await supabase
        .from('cvs')
        .insert([
          {
            id,
            user_id: userId,
            filename: cvData.filename,
            file_path: filePath,
            parsed_data: cvData.parsed_data || metadata
          }
        ]);
          
      if (error) {
        console.log('Supabase error during direct CV upload:', error);
        throw error;
      }
      
      console.log('CV database record created successfully:', id);
      console.log('CV upload process completed successfully:', id);
      
      // Respond without has_file for now
      res.json({ 
        success: true, 
        id
      });
      
    } catch (dbError) {
      console.error('Database error during CV upload:', dbError);
      return res.status(500).json({ 
        error: `Database error: ${dbError.message}`,
        details: dbError.details || 'No additional details'
      });
    }
  } catch (error) {
    console.error('Error storing CV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all CVs endpoint
app.get('/api/cvs', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    // Try RPC function first
    let data;
    let error;

    try {
      // Try to use the RPC function
      const result = await supabase.rpc('get_cvs_for_user', { p_user_id: userId });
      data = result.data;
      error = result.error;

      if (error) {
        console.log('Error using RPC function:', error);
        
        // Fall back to direct query if RPC fails
        console.log('Falling back to direct query...');
        const directResult = await supabase
          .from('cvs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        data = directResult.data;
        error = directResult.error;
      }
    } catch (err) {
      console.error('Error during CV fetch:', err);
      // Fallback to direct query
      const directResult = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      data = directResult.data;
      error = directResult.error;
    }

    if (error) throw error;

    const cvs = data.map(cv => ({
      id: cv.id,
      filename: cv.filename,
      created_at: cv.created_at,
      metadata: cv.parsed_data || {},
      is_favorite: cv.is_favorite || false
    }));

    res.json(cvs);
  } catch (error) {
    console.error('Error fetching CVs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process CV endpoint
app.post('/api/process-cv', async (req, res) => {
  try {
    const { cvId } = req.body;

    if (!cvId) {
      return res.status(400).json({ error: 'Missing cvId parameter' });
    }

    console.log('Processing CV:', cvId);
    
    // Get CV record from database
    const { data: cv, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .single();

    if (error) throw error;
    if (!cv) {
      return res.status(404).json({ error: 'CV not found' });
    }

    console.log('CV record retrieved:', cv.id);
    
    // Get file content from Storage if available
    let fileContent = null;
    let fileText = null;
    
    if (cv.file_path) {
      try {
        console.log(`Attempting to retrieve file from Storage: bucket=cvs, path=${cv.file_path}`);
        const { data: fileData, error: fileError } = await supabase
          .storage
          .from('cvs') // Ensure bucket name is correct
          .download(cv.file_path);
        
        if (fileError) {
          // Log the detailed error object
          console.error('Error retrieving file from Storage:', JSON.stringify(fileError, null, 2));
          // Add specific checks for common errors
          if (fileError.message && fileError.message.includes('Object not found')) {
            console.error('--> Specific Error: The file object was not found at the specified path.');
          } else if (fileError.message && fileError.message.includes('Unauthorized')) {
            console.error('--> Specific Error: Check Storage RLS policies or service key permissions.');
          }
        } else if (fileData) {
          console.log('File retrieved from Storage successfully');
          fileContent = fileData;
          
          // For text extraction/processing, we'll need the content as text
          // This is simplified - in a real app you'd use a proper parser for PDF/DOCX etc.
          try {
            // Simple text extraction for demo purposes
            if (fileData instanceof Blob) {
              fileText = await fileData.text();
              console.log('File text extracted from Blob, length:', fileText.length);
            } else if (Buffer.isBuffer(fileData)) {
              fileText = fileData.toString('utf-8');
              console.log('File text extracted from Buffer, length:', fileText.length);
            } else if (typeof fileData === 'string') {
              fileText = fileData;
              console.log('File already in text format, length:', fileText.length);
            } else {
              // For other formats, try to convert to string
              fileText = String(fileData);
              console.log('File converted to string, length:', fileText.length);
            }
          } catch (textError) {
            console.error('Error extracting text from file:', textError);
            // Create a minimal text representation if we can't extract it properly
            const fileExt = cv.filename.split('.').pop().toLowerCase();
            fileText = `This is a ${fileExt.toUpperCase()} file named ${cv.filename}. `;
            fileText += `The file appears to be in ${fileExt} format which couldn't be directly extracted.`;
          }
        }
      } catch (storageError) {
        console.error('Exception during file retrieval:', storageError);
      }
    }

    // Fall back to using metadata if we couldn't extract text from the file
    if (!fileText || fileText.trim().length < 50) {
      console.log('Using data from parsed_data for analysis');
      if (cv.parsed_data) {
        let dataText = '';
        try {
          // Try to create a text representation of the parsed data
          const data = cv.parsed_data;
          
          // Extract personal info
          if (data.personal) {
            dataText += `Name: ${data.personal.name || 'Unknown'}\n`;
            if (data.personal.title) dataText += `Title: ${data.personal.title}\n`;
            if (data.personal.email) dataText += `Email: ${data.personal.email}\n`;
            if (data.personal.phone) dataText += `Phone: ${data.personal.phone}\n`;
            if (data.personal.linkedin) dataText += `LinkedIn: ${data.personal.linkedin}\n`;
          }
          
          // Add summary
          if (data.summary) dataText += `\nSummary: ${data.summary}\n`;
          
          // Add skills
          if (data.skills) {
            dataText += '\nSkills:\n';
            if (Array.isArray(data.skills)) {
              dataText += data.skills.join(', ') + '\n';
            } else {
              // Handle nested skills object
              for (const category in data.skills) {
                if (Array.isArray(data.skills[category])) {
                  dataText += `${category}: ${data.skills[category].join(', ')}\n`;
                }
              }
            }
          }
          
          // Add experience
          if (data.experience && Array.isArray(data.experience)) {
            dataText += '\nExperience:\n';
            data.experience.forEach(job => {
              dataText += `- ${job.position || 'Role'} at ${job.company || 'Company'}`;
              if (job.duration) dataText += ` (${job.duration})`;
              dataText += '\n';
              if (job.responsibilities && Array.isArray(job.responsibilities)) {
                job.responsibilities.forEach(resp => dataText += `  * ${resp}\n`);
              }
              if (job.achievements && Array.isArray(job.achievements)) {
                job.achievements.forEach(ach => dataText += `  * ${ach}\n`);
              }
            });
          }
          
          // Add education
          if (data.education && Array.isArray(data.education)) {
            dataText += '\nEducation:\n';
            data.education.forEach(edu => {
              dataText += `- ${edu.degree || 'Degree'} from ${edu.institution || 'Institution'}`;
              if (edu.year) dataText += ` (${edu.year})`;
              dataText += '\n';
            });
          }
          
          console.log('Generated parsed data text, length:', dataText.length);
          fileText = dataText;
        } catch (parseError) {
          console.error('Error creating text from parsed data:', parseError);
        }
      }
      
      // Last resort fallback
      if (!fileText || fileText.trim().length < 50) {
        console.log('Using placeholder text for processing');
        fileText = `CV for ${cv.parsed_data?.personal?.name || "Anonymous"}. ` +
          `Filename: ${cv.filename}. ` +
          `This is a placeholder text for CV processing. ` +
          `The actual file content could not be retrieved or parsed. ` +
          `Skills might include programming, communication, and problem-solving. ` +
          `Experience might include software development, project management, and technical support.`;
      }
    }

    // Process CV with OpenAI
    console.log('Sending CV to OpenAI for processing, text length:', fileText.length);
    
    // Ensure fileText is valid for OpenAI API
    if (!fileText || typeof fileText !== 'string') {
      fileText = "No valid content could be extracted from this CV.";
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional CV analyzer. Extract and structure the information from the CV content.
          Return a JSON object with the following structure:
          {
            "name": "Full name of the person",
            "email": "Email address if found",
            "phone": "Phone number if found",
            "skills": ["List of skills found"],
            "experience": [
              {
                "company": "Company name",
                "position": "Job title",
                "startDate": "Start date",
                "endDate": "End date",
                "description": "Job description"
              }
            ],
            "education": [
              {
                "institution": "Name of institution",
                "degree": "Degree obtained",
                "date": "Graduation date"
              }
            ]
          }
          
          If you can't find specific information, use empty strings or arrays as appropriate.`
        },
        {
          role: "user",
          content: fileText
        }
      ]
    });

    // Parse the OpenAI completion output, handling any JSON parse errors
    let processedData;
    try {
      processedData = JSON.parse(completion.choices[0].message.content);
      console.log('Processing complete, result:', JSON.stringify(processedData).substring(0, 100) + '...');
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      const responseText = completion.choices[0].message.content;
      console.log('Raw response:', responseText.substring(0, 200) + '...');
      
      // Try to extract JSON from the response by finding content between curly braces
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          processedData = JSON.parse(jsonMatch[0]);
          console.log('Extracted and parsed JSON from response');
        } catch (extractError) {
          console.error('Failed to extract JSON from response');
          // Create a minimal structure
          processedData = {
            name: "Could not parse name",
            email: "",
            phone: "",
            skills: ["Information extraction failed"],
            experience: [],
            education: []
          };
        }
      } else {
        // Create a minimal structure
        processedData = {
          name: "Could not parse name",
          email: "",
          phone: "",
          skills: ["Information extraction failed"],
          experience: [],
          education: []
        };
      }
    }

    // Update CV with processed data
    const { data: updatedCV, error: updateError } = await supabase
      .from('cvs')
      .update({
        parsed_data: {
          ...cv.parsed_data,
          ...processedData,
          processed_at: new Date().toISOString()
        }
      })
      .eq('id', cvId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      cv: {
        id: updatedCV.id,
        filename: updatedCV.filename,
        created_at: updatedCV.created_at,
        metadata: updatedCV.parsed_data || {}
      }
    });
  } catch (error) {
    console.error('Error processing CV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete CV endpoint
app.delete('/api/cvs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing CV ID' });
    }
    
    console.log('Deleting CV:', id);

    // Get CV first to get the file path
    const { data: cv, error: getError } = await supabase
      .from('cvs')
      .select('file_path')
      .eq('id', id)
      .single();
      
    if (getError) {
      console.error('Error retrieving CV for deletion:', getError);
      // Continue with deletion even if we can't get the file path
    } else if (cv && cv.file_path) {
      // Delete file from storage if exists
      try {
        console.log('Removing file from Storage:', cv.file_path);
        const { data: removeData, error: removeError } = await supabase
          .storage
          .from('cvs')
          .remove([cv.file_path]);
          
        if (removeError) {
          console.error('Error removing file from storage:', removeError);
          // Continue with database deletion even if storage deletion fails
        } else {
          console.log('File removed from Storage successfully');
        }
      } catch (storageError) {
        console.error('Exception during file removal:', storageError);
        // Continue with database deletion
      }
    }

    // Delete from Supabase database
    console.log('Deleting CV record from database');
    const { error } = await supabase
      .from('cvs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    console.log('CV deleted successfully:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting CV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update CV endpoint
app.put('/api/cvs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing CV ID' });
    }

    // Get the CV first to have access to content
    const { data: cv, error: getError } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', id)
      .single();

    if (getError) throw getError;
    if (!cv) {
      return res.status(404).json({ error: 'CV not found' });
    }

    // Update in Supabase - use parsed_data instead of metadata
    const { data: updatedCV, error } = await supabase
      .from('cvs')
      .update({ parsed_data: metadata })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, cv: updatedCV });
  } catch (error) {
    console.error('Error updating CV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle favorite status endpoint
app.put('/api/cvs/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: cv, error: fetchError } = await supabase
      .from('cvs')
      .select('is_favorite')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('cvs')
      .update({ is_favorite: !cv.is_favorite })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, cv: data });
  } catch (error) {
    console.error('Error toggling favorite status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download CV endpoint
app.get('/api/cvs/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Download requested for CV:', id);

    // Get CV record from database
    const { data: cv, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!cv) {
      return res.status(404).json({ error: 'CV not found' });
    }

    // Check if we have a file path
    if (!cv.file_path) {
      return res.status(404).json({ error: 'CV file not found' });
    }

    console.log('Retrieving file from Storage:', cv.file_path);
    
    try {
      // Get file from Supabase Storage
      const { data: fileData, error: storageError } = await supabase
        .storage
        .from('cvs')
        .download(cv.file_path);
      
      if (storageError) {
        console.error('Storage error during download:', storageError);
        throw storageError;
      }
      
      if (!fileData) {
        return res.status(404).json({ error: 'File content not found in storage' });
      }
      
      console.log('File retrieved successfully, sending to client');
      
      // Set appropriate headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${cv.filename}"`);
      
      // Convert Blob to Buffer if needed
      if (fileData instanceof Blob) {
        const arrayBuffer = await fileData.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      } else {
        // Send the file data directly
        res.send(fileData);
      }
    } catch (storageError) {
      console.error('Error retrieving file from storage:', storageError);
      res.status(500).json({ error: 'Error retrieving file from storage' });
    }
  } catch (error) {
    console.error('Error downloading CV:', error);
    res.status(500).json({ error: error.message });
  }
});

// New Endpoint: Parse CV Text Content
app.post('/api/parse-cv-text', async (req, res) => {
  try {
    const { textContent } = req.body;

    if (!textContent || typeof textContent !== 'string' || textContent.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or invalid textContent' });
    }

    console.log(`Parsing CV text content, length: ${textContent.length}`);

    // Process CV text with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional CV analyzer. Extract and structure the information from the CV content.
          Return a JSON object with the following structure:
          {
            "name": "Full name of the person",
            "email": "Email address if found",
            "phone": "Phone number if found",
            "skills": ["List of skills found"],
            "experience": [
              {
                "company": "Company name",
                "position": "Job title",
                "startDate": "Start date",
                "endDate": "End date",
                "description": "Job description"
              }
            ],
            "education": [
              {
                "institution": "Name of institution",
                "degree": "Degree obtained",
                "date": "Graduation date"
              }
            ]
          }
          
          If you can't find specific information, use empty strings or arrays as appropriate.`
        },
        {
          role: "user",
          content: textContent // Use the provided text content
        }
      ]
    });

    // Parse the OpenAI completion output, handling any JSON parse errors
    let processedData;
    const responseText = completion.choices[0].message.content;
    try {
      // Try extracting JSON from potentially markdown-formatted response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          processedData = JSON.parse(jsonMatch[0]);
          console.log('Extracted and parsed JSON from response');
      } else {
          // If no JSON object found, try parsing the whole string (might fail)
          processedData = JSON.parse(responseText);
      }
      console.log('Processing complete, result:', JSON.stringify(processedData).substring(0, 100) + '...');
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw response:', responseText.substring(0, 200) + '...');
      // Return an error or a default structure if parsing fails
      return res.status(500).json({ 
        error: 'Failed to parse OpenAI response',
        rawResponse: responseText 
      });
    }

    res.json({ success: true, parsedData: processedData });

  } catch (error) {
    console.error('Error in /api/parse-cv-text:', error);
    // Handle potential OpenAI API errors specifically
    if (error.response && error.response.status) {
      return res.status(error.response.status).json({ error: error.message });
    } 
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Present' : 'Missing'}`);
  console.log(`Supabase Anon Key: ${process.env.SUPABASE_ANON_KEY ? 'Present' : 'Missing'}`);
  
  console.log('Server is ready to accept connections');
});