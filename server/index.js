require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ApifyClient } = require('apify-client');

// Initialize OpenAI client
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('OpenAI client initialized.');
} else {
  console.warn('OpenAI API Key not found in environment variables. GPT parsing will be disabled.');
}

// Initialize ApifyClient
let apifyClient;
if (process.env.APIFY_API_TOKEN) {
  apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
  });
  console.log('Apify client initialized.');
} else {
  console.warn('Apify API Token not found in environment variables (APIFY_API_TOKEN). Job scraping will be disabled.');
}

const app = express();

// Add custom header middleware *before* CORS
app.use((req, res, next) => {
  // Add a unique header to verify deployment
  res.setHeader('X-CVPANDA-BACKEND-VERSION', 'cors-check-v2'); 
  
  // Log the origin for debugging CORS issues
  console.log('⚠️ Request Origin:', req.headers.origin);
  
  // Pre-flight response headers for CORS
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('⚠️ Handling preflight request');
    return res.status(200).end();
  }
  
  next();
});

// More permissive CORS configuration that overrides any defaults
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if(!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://cvpanda.info',
      'http://cvpanda.info',
      'https://www.cvpanda.info',
      'http://www.cvpanda.info',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'https://cvpanda-git-main-criseduas-projects.vercel.app',
      'https://cvpanda-backend.onrender.com'
    ];
    
    // Check if origin is allowed
    if(allowedOrigins.indexOf(origin) === -1){
      console.warn(`⚠️ Origin ${origin} not allowed by CORS`);
      // Don't block the request, but log it
      return callback(null, true);
    }
    
    console.log(`✅ Origin ${origin} allowed by CORS`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['X-CVPANDA-BACKEND-VERSION']
}));
app.use(express.json({ limit: '50mb' }));

// *** ADD SIMPLE PING TEST ROUTE ***
app.get('/api/ping', (req, res) => {
  console.log('[DIAGNOSTIC LOG] Reached GET /api/ping');
  res.status(200).json({ message: 'pong', timestamp: new Date().toISOString() });
});
// *** END PING TEST ROUTE ***

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max file size
  },
  fileFilter: function (req, file, cb) {
    // Accept both PDF and Word document formats
    const acceptedMimeTypes = [
      'application/pdf',                                              // PDF
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/msword'                                            // DOC
    ];
    
    if (!acceptedMimeTypes.includes(file.mimetype)) {
      console.error(`[upload] Rejected file with mimetype: ${file.mimetype}`);
      return cb(new Error('Only PDF and Word documents are allowed'), false);
    }
    
    console.log(`[upload] Accepted file: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  }
});

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Request started`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Response: ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Initialize Supabase client (optional, remove if not needed for this endpoint)
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
        'X-Client-Info': 'server',
        'X-Server-Authorization': 'bypass-rls'
      }
    }
  }
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Base route
app.get('/', (req, res) => {
  res.json({ status: 'CV Management API is running - GPT Only Extraction' });
});

// --- Helper Functions ---

// NEW: Function to extract search terms from parsed CV data
function generateSearchTermsFromCV(cvData) {
  let interest = '';
  let location = cvData?.personal_info?.location || cvData?.location || ''; // Try different possible location fields
  let skills = [];

  // Prioritize latest job title
  if (cvData?.work_experience && cvData.work_experience.length > 0) {
    // Sort by end date (assuming dates are parsable or have a consistent format)
    // This sorting might need refinement based on actual date formats from GPT
    try {
      cvData.work_experience.sort((a, b) => {
        // Handle "Present" or missing end dates - this logic is basic
        const dateA = a.end_date === 'Present' ? new Date() : new Date(a.end_date || 0);
        const dateB = b.end_date === 'Present' ? new Date() : new Date(b.end_date || 0);
        // Basic check if dates are valid
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0; 
        return dateB - dateA; // Descending order
      });
      interest = cvData.work_experience[0].job_title || '';
      console.log(`  -> Using latest job title: ${interest}`);
    } catch (e) {
      console.warn('  -> Could not sort work experience for job title extraction:', e.message);
      // Fallback to first job title if sorting fails
      interest = cvData.work_experience[0].job_title || '';
    }
  }

  // Add top skills (limit to e.g., 3-5)
  if (cvData?.skills && Array.isArray(cvData.skills)) {
    skills = cvData.skills.slice(0, 4); // Take top 4 skills
    if (skills.length > 0) {
       interest += interest ? ' ' + skills.join(' ') : skills.join(' ');
       console.log(`  -> Added skills: ${skills.join(', ')}`);
    }
  }

  interest = interest.trim();
  // Basic location cleanup (e.g., remove country if too generic for local search)
  if (location) {
      location = location.split(',')[0].trim(); // Often City, Region, Country - take City
      console.log(`  -> Using location: ${location}`);
  }

  if (!interest) console.warn('  -> Could not generate meaningful interest search term from CV.');
  if (!location) console.warn('  -> Could not determine location from CV for job search.');

  return { interest, location };
}

// --- API Endpoints ---

// REVERT /api/extract-pdf-gpt
app.post('/api/extract-pdf-gpt', upload.single('file'), async (req, res) => {
  // **** ADD DIAGNOSTIC LOG ****
  console.log('[DIAGNOSTIC LOG] Reached POST /api/extract-pdf-gpt handler!');
  // **** END DIAGNOSTIC LOG ****
  try {
    console.log('[extract-pdf-gpt] GPT-only PDF extraction requested');
    const file = req.file;
    if (!file) {
      console.error('[extract-pdf-gpt] No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }
    
    if (!openai) {
      console.error('[extract-pdf-gpt] OpenAI client not initialized.');
      return res.status(500).json({ error: 'OpenAI client not initialized' });
    }
    
    let pdfText = '';
    try {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      pdfText = pdfData.text;
      console.log(`[extract-pdf-gpt] Extracted ${pdfText.length} characters from PDF using pdf-parse.`);
      if (pdfText.length < 50) {
        console.warn('[extract-pdf-gpt] Warning: Very little text extracted from PDF.');
      }
    } catch (pdfError) {
      console.error('[extract-pdf-gpt] Error extracting text from PDF:', pdfError);
      // Clean up file even if PDF parsing fails
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e){}
      return res.status(500).json({ error: 'Failed to extract text from PDF', details: pdfError.message });
    }
    
    console.log('[extract-pdf-gpt] Sending extracted text to GPT-4o-mini for parsing...');
    try {
      const systemPrompt = `You are an expert CV parser. Analyze the provided CV text and extract the following information in JSON format. Ensure the output is ONLY the JSON object, with no introductory text or explanations. 
      
      IMPORTANT: Do NOT format your response as a markdown code block. Do NOT use \`\`\`json or any markdown formatting. Return ONLY the raw JSON object.
      
      For job experiences: Please extract ALL job experiences from the CV. Start from the 'Experience' section and continue until the 'Education' section begins. Identify job entries by detecting date ranges (such as 'January 2013 - Present' or similar patterns) and ensure that each occurrence is treated as a new job entry. 
      
      VERY IMPORTANT: For each work experience, check for "Key Achievements" or similar sections, and include these as a separate array field called "achievements" in the work experience object.
      
      The JSON object should have these keys:
      - name (string): The full name of the candidate.
      - email (string): The primary email address.
      - phone (string): The primary phone number.
      - linkedin_url (string): The URL to the LinkedIn profile, if present.
      - github_url (string): The URL to the GitHub profile, if present.
      - website_url (string): The URL to a personal website or portfolio, if present.
      - location (string): The general location (e.g., City, Country).
      - summary (string): The professional summary or objective section.
      - skills (array of strings): A list of key skills mentioned.
      - education (array of objects): Each object should have 'institution', 'degree', and 'dates'.
      - work_experience (array of objects): Each object should have:
        - company (string): Company name
        - title (string): Job title
        - dates (string): Employment period
        - location (string): Job location if specified
        - description (string): Main job description text
        - achievements (array of strings): Key achievements for this position, if present
      
      EXTRACT ALL WORK EXPERIENCES - even if there are more than 6. Do not truncate or summarize the list.`;

      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt + "\n\nProvide your response as a valid JSON object, with no additional text before or after the JSON. DO NOT use markdown code blocks." },
          { role: "user", content: pdfText }
        ],
        temperature: 0.2,
      });

      const gptResultContent = gptResponse.choices[0]?.message?.content;
      console.log('[extract-pdf-gpt] Raw response content from GPT-4o-mini:', gptResultContent);

      if (!gptResultContent) {
        console.error('[extract-pdf-gpt] GPT returned empty content.');
        throw new Error('GPT returned empty content.');
      }
      console.log('[extract-pdf-gpt] Received response from GPT.');
      
      let gptParsedData;
      try {
        // Clean up markdown formatting if present (remove code blocks)
        let cleanContent = gptResultContent;
        
        // Check if response is wrapped in code blocks and extract just the JSON
        if (cleanContent.includes('```json') || cleanContent.includes('```')) {
          const jsonMatch = cleanContent.match(/```(?:json)?\s*\n([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanContent = jsonMatch[1].trim();
          }
        }
        
        gptParsedData = JSON.parse(cleanContent);
        console.log('[extract-pdf-gpt] Successfully parsed JSON from GPT response.');
      } catch (jsonError) {
        console.error('[extract-pdf-gpt] Failed to parse JSON response from GPT:', jsonError);
        console.error('[extract-pdf-gpt] Original raw content causing error:', gptResultContent);
        throw new Error('Failed to parse structured data from GPT response.');
      }

      // Original structure (adjust if needed based on frontend expectations)
      const finalResponse = {
        success: true,
        // Ensure this structure matches what CVUpload expects now
        result: {
            gpt_data: gptParsedData,
            full_text: pdfText,
        }
      };
      
      console.log('[API Response] Sending structured CV data ONLY.');
      res.json(finalResponse);

    } catch (gptError) {
      console.error('[extract-pdf-gpt] Error during GPT parsing:', gptError);
      return res.status(500).json({ error: 'GPT Parsing failed', details: gptError.message });
    } finally {
      // Always clean up the temporary file
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e){ console.warn('Cleanup error:', e); }
    }
  } catch (error) {
    console.error('[extract-pdf-gpt] General error in endpoint:', error);
    // Clean up file in case of general error before returning response
    try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch(e){}
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// Backward compatibility route - redirects to the GPT-only endpoint
app.post('/api/extract-pdf-improved', upload.single('file'), async (req, res) => {
  console.log('[extract-pdf-improved] Received request, redirecting to GPT-only endpoint');
  
  try {
    // Forward to the GPT endpoint handler
    const file = req.file;
    if (!file) {
      console.error('[extract-pdf-improved] No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }
    
    if (!openai) {
      console.error('[extract-pdf-improved] OpenAI client not initialized');
      return res.status(500).json({ error: 'OpenAI client not initialized' });
    }
    
    // Reuse the same logic as /api/extract-pdf-gpt
    let pdfText = '';
    try {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      pdfText = pdfData.text;
      console.log(`[extract-pdf-improved] Extracted ${pdfText.length} characters from PDF`);
    } catch (pdfError) {
      console.error('[extract-pdf-improved] Error extracting text from PDF:', pdfError);
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e){}
      return res.status(500).json({ error: 'Failed to extract text from PDF', details: pdfError.message });
    }
    
    console.log('[extract-pdf-improved] Sending text to GPT-4o-mini for parsing');
    try {
      const systemPrompt = `You are an expert CV parser. Analyze the provided CV text and extract the following information in JSON format. Ensure the output is ONLY the JSON object, with no introductory text or explanations.
      
      IMPORTANT: Do NOT format your response as a markdown code block. Do NOT use \`\`\`json or any markdown formatting. Return ONLY the raw JSON object.
      
      For job experiences: Please extract ALL job experiences from the CV. Start from the 'Experience' section and continue until the 'Education' section begins. Identify job entries by detecting date ranges (such as 'January 2013 - Present' or similar patterns) and ensure that each occurrence is treated as a new job entry. 
      
      VERY IMPORTANT: For each work experience, check for "Key Achievements" or similar sections, and include these as a separate array field called "achievements" in the work experience object.
      
      The JSON object should have these keys:
      - name (string): The full name of the candidate.
      - email (string): The primary email address.
      - phone (string): The primary phone number.
      - linkedin_url (string): The URL to the LinkedIn profile, if present.
      - github_url (string): The URL to the GitHub profile, if present.
      - website_url (string): The URL to a personal website or portfolio, if present.
      - location (string): The general location (e.g., City, Country).
      - summary (string): The professional summary or objective section.
      - skills (array of strings): A list of key skills mentioned.
      - education (array of objects): Each object should have 'institution', 'degree', and 'dates'.
      - work_experience (array of objects): Each object should have:
        - company (string): Company name
        - title (string): Job title
        - dates (string): Employment period
        - location (string): Job location if specified
        - description (string): Main job description text
        - achievements (array of strings): Key achievements for this position, if present
      
      EXTRACT ALL WORK EXPERIENCES - even if there are more than 6. Do not truncate or summarize the list.`;

      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt + "\n\nProvide your response as a valid JSON object, with no additional text before or after the JSON. DO NOT use markdown code blocks." },
          { role: "user", content: pdfText }
        ],
        temperature: 0.2,
      });

      const gptResultContent = gptResponse.choices[0]?.message?.content;
      console.log('[extract-pdf-improved] Raw response content from GPT-4o-mini:', gptResultContent);

      if (!gptResultContent) {
        console.error('[extract-pdf-improved] GPT returned empty content.');
        throw new Error('GPT returned empty content');
      }
      
      let gptParsedData;
      try {
        // Clean up markdown formatting if present (remove code blocks)
        let cleanContent = gptResultContent;
        
        // Check if response is wrapped in code blocks and extract just the JSON
        if (cleanContent.includes('```json') || cleanContent.includes('```')) {
          const jsonMatch = cleanContent.match(/```(?:json)?\s*\n([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanContent = jsonMatch[1].trim();
          }
        }
        
        gptParsedData = JSON.parse(cleanContent);
        console.log('[extract-pdf-improved] Successfully parsed JSON from GPT response.');
      } catch (jsonError) {
        console.error('[extract-pdf-improved] Failed to parse JSON response from GPT:', jsonError);
        console.error('[extract-pdf-improved] Original raw content causing error:', gptResultContent);
        throw new Error('Failed to parse structured data from GPT response');
      }

      // Original structure (adjust if needed based on frontend expectations)
      const finalResponse = {
        success: true,
        // Ensure this structure matches what CVUpload expects now
        result: {
            gpt_data: gptParsedData,
            full_text: pdfText,
        }
      };
      
      console.log('[API Response] Sending structured CV data ONLY.');
      res.json(finalResponse);
    } catch (gptError) {
      console.error('[extract-pdf-improved] Error during GPT parsing:', gptError);
      return res.status(500).json({ error: 'GPT Parsing failed', details: gptError.message });
    } finally {
      // Always clean up the temporary file
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e){ console.warn('Cleanup error:', e); }
    }
  } catch (error) {
    console.error('[extract-pdf-improved] General error:', error);
    try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch(e){}
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// REVERT /api/parse-text
app.post('/api/parse-text', async (req, res) => {
  try {
    console.log('[parse-text] Received request to parse raw text');
    const { text: cvText } = req.body; // Expect { "text": "..." } in JSON body

    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      console.error('[parse-text] No valid text provided in request body');
      return res.status(400).json({ error: 'No text provided' });
    }
    
    if (!openai) {
      console.error('[parse-text] OpenAI client not initialized.');
      return res.status(500).json({ error: 'OpenAI client not initialized' });
    }

    console.log(`[parse-text] Received ${cvText.length} characters. Sending to GPT-4o-mini for parsing...`);
    try {
      // Reuse the same system prompt from the PDF endpoint
      const systemPrompt = `You are an expert CV parser. Analyze the provided CV text and extract the following information in JSON format. Ensure the output is ONLY the JSON object, with no introductory text or explanations. 
      
      IMPORTANT: Do NOT format your response as a markdown code block. Do NOT use \`\`\`json or any markdown formatting. Return ONLY the raw JSON object.
      
      For job experiences: Please extract ALL job experiences from the CV. Start from the 'Experience' section and continue until the 'Education' section begins. Identify job entries by detecting date ranges (such as 'January 2013 - Present' or similar patterns) and ensure that each occurrence is treated as a new job entry. 
      
      VERY IMPORTANT: For each work experience, check for "Key Achievements" or similar sections, and include these as a separate array field called "achievements" in the work experience object.
      
      The JSON object should have these keys:
      - name (string): The full name of the candidate.
      - email (string): The primary email address.
      - phone (string): The primary phone number.
      - linkedin_url (string): The URL to the LinkedIn profile, if present.
      - github_url (string): The URL to the GitHub profile, if present.
      - website_url (string): The URL to a personal website or portfolio, if present.
      - location (string): The general location (e.g., City, Country).
      - summary (string): The professional summary or objective section.
      - skills (array of strings): A list of key skills mentioned.
      - education (array of objects): Each object should have 'institution', 'degree', and 'dates'.
      - work_experience (array of objects): Each object should have:
        - company (string): Company name
        - title (string): Job title
        - dates (string): Employment period
        - location (string): Job location if specified
        - description (string): Main job description text
        - achievements (array of strings): Key achievements for this position, if present
      
      EXTRACT ALL WORK EXPERIENCES - even if there are more than 6. Do not truncate or summarize the list.`;

      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt + "\n\nProvide your response as a valid JSON object, with no additional text before or after the JSON. DO NOT use markdown code blocks." },
          { role: "user", content: cvText } 
        ],
        temperature: 0.2,
      });

      const gptResultContent = gptResponse.choices[0]?.message?.content;
      console.log('[parse-text] Raw response content from GPT-4o-mini:', gptResultContent);

      if (!gptResultContent) {
        console.error('[parse-text] GPT returned empty content.');
        throw new Error('GPT returned empty content.');
      }
      
      let gptParsedData;
      try {
        let cleanContent = gptResultContent;
        if (cleanContent.includes('```json') || cleanContent.includes('```')) {
          const jsonMatch = cleanContent.match(/```(?:json)?\s*\n([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            cleanContent = jsonMatch[1].trim();
          }
        }
        gptParsedData = JSON.parse(cleanContent);
        console.log('[parse-text] Successfully parsed JSON from GPT response.');
      } catch (jsonError) {
        console.error('[parse-text] Failed to parse JSON response from GPT:', jsonError);
        console.error('[parse-text] Original raw content causing error:', gptResultContent);
        throw new Error('Failed to parse structured data from GPT response.');
      }

      const finalResponse = {
        success: true,
        // Ensure this structure matches what CVUpload expects now
        cvData: {
            gpt_data: gptParsedData,
            full_text: cvText,
        }
      };

      console.log('[API Response - Text] Sending structured CV data matching frontend expectation.');
      res.json(finalResponse);

    } catch (gptError) {
      console.error('[parse-text] Error during GPT parsing:', gptError);
      return res.status(500).json({ error: 'GPT Parsing failed', details: gptError.message });
    }
  } catch (error) {
    console.error('[parse-text] General error in endpoint:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

app.post('/api/search-jobs', async (req, res) => {
  const { interest, location } = req.body;

  if (!interest || !location) {
    return res.status(400).json({ success: false, error: 'Interest and location are required.' });
  }
  if (!apifyClient) {
     console.error('Attempted job search, but Apify client is not initialized.');
     return res.status(500).json({ success: false, error: 'Job search feature is not configured (missing API token).' });
  }

  console.log(`🔍 Received job search request: Interest="${interest}", Location="${location}"`);

  try {
    const jobs = await scrapeTrabajandoWithApify(interest, location);
    console.log(`✅ Found ${jobs.length} jobs for "${interest}" in "${location}" via Apify`);
    res.json({ success: true, jobs });
  } catch (error) {
    console.error(`❌ Error scraping jobs for "${interest}" in "${location}" via Apify:`, error);
    res.status(500).json({ success: false, error: 'Failed to scrape job listings using Apify.', details: error.message });
  }
});

// --- Scraping Function using Apify ---
async function scrapeTrabajandoWithApify(interest, location) {
  const domain = 'www.trabajando.cl'; // Example for Chile - ADJUST AS NEEDED
  const searchUrl = `https://${domain}/trabajo-busqueda?bq=${encodeURIComponent(interest)}&blo=${encodeURIComponent(location)}`;
  console.log(`  -> Apify scraping URL: ${searchUrl}`);

  // --- Define the Page Function logic --- 
  const scrapingLogic = async (context) => {
      const { $, request, log } = context;
      const results = [];
      // *** CORRECTED SELECTOR based on image ***
      const jobCardSelector = 'div.result-box-container'; 

      log.info(`[Trabajando Scraper] Scraping ${request.url}... Found ${$(jobCardSelector).length} potential cards.`);

      $(jobCardSelector).each((index, element) => {
        try {
          // Find the main content area within the card first, if applicable
          // const contentArea = $(element).find('.center.text-break'); // Optional refinement

          // *** CORRECTED SELECTORS based on image ***
          const titleElement = $(element).find('h2 a');                  // Seems correct
          const companyElement = $(element).find('h2 + span.type');      // Span after H2 with class 'type' (more specific)
          const locationElement = $(element).find('span.location');       // Span with class 'location'
          const descriptionElement = $(element).find('p.description');   // P with class 'description'

          const title = titleElement.text().trim();
          const link = titleElement.attr('href'); 
          const company = companyElement.text().trim();
          const jobLocation = locationElement.text().trim();
          const descriptionSnippet = descriptionElement ? descriptionElement.text().trim().substring(0, 250) + '...' : ''; // Slightly longer snippet

          if (title && link) {
            const absoluteLink = link.startsWith('http') 
              ? link 
              : link.startsWith('/') // Handle relative links starting with /
                ? new URL(link, `https://${domain}`).toString() // Construct URL based on domain
                : new URL(link, request.loadedUrl || request.url).toString(); // Fallback for other relative links
                
            results.push({
              title: title,
              company: company || 'N/A',
              location: jobLocation || 'N/A',
              description: descriptionSnippet || 'N/A',
              link: absoluteLink,
              source: 'Trabajando.com'
            });
            // log.info(`[Trabajando Scraper] Extracted: ${title}`); // Keep logging minimal unless debugging
          } else {
             log.warning(`[Trabajando Scraper] Skipping item ${index}. Missing title ('${title}') or link ('${link}'). Check selectors inside card.`);
          }
        } catch(e) {
           log.error(`[Trabajando Scraper] Error processing item card ${index}: ${e.message}`, { error: e });
        }
      });

      log.info(`[Trabajando Scraper] Finished page. Extracted ${results.length} valid jobs.`);
      return results;
  };

  // Convert the logic function to a string for Apify
  const pageFunctionString = `async function pageFunction(context) { const scrapingLogic = ${scrapingLogic.toString()}; return await scrapingLogic(context); }`;


  // --- Run the Apify Web Scraper Actor ---
  const actorId = 'apify/web-scraper';
  console.log(`  -> Calling Apify actor: ${actorId}`);

  try {
    const run = await apifyClient.actor(actorId).call({
      startUrls: [{ url: searchUrl }],
      pageFunction: pageFunctionString, // Use the stringified function
      // proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
      maxPagesPerRun: 1,
      maxResultRecords: 50,
    });

    console.log(`  -> Apify actor run finished: Run ID ${run.id}, Status: ${run.status}`);

    if (run.status === 'SUCCEEDED') {
      console.log(`  -> Fetching results from dataset: ${run.defaultDatasetId}`);
      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      console.log(`  -> Fetched ${items.length} job items from Apify.`);
      return items;
    } else {
      throw new Error(`Apify actor run failed or did not succeed. Status: ${run.status}. Check Apify console for run ${run.id}.`);
    }

  } catch (error) {
    console.error('  -> Error calling Apify actor or fetching results:', error);
    throw new Error(`Apify scraping task failed: ${error.message}`);
  }
}

// Add a new optimized PDF extraction endpoint
app.post('/api/extract-pdf', upload.single('pdf'), async (req, res) => {
  console.log('[extract-pdf] Fast PDF extraction requested');
  const startTime = Date.now();
  
  try {
    const file = req.file;
    if (!file) {
      console.error('[extract-pdf] No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log(`[extract-pdf] Processing ${file.originalname} (${file.size} bytes)`);
    
    // Extract text using pdf-parse (without GPT)
    let pdfText = '';
    let pageCount = 0;
    
    try {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      pdfText = pdfData.text;
      pageCount = pdfData.numpages || 0;
      
      console.log(`[extract-pdf] Extracted ${pdfText.length} characters from ${pageCount} pages in ${Date.now() - startTime}ms`);
    } catch (pdfError) {
      console.error('[extract-pdf] Error extracting text from PDF:', pdfError);
      // Clean up file even if PDF parsing fails
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch(e){}
      return res.status(500).json({ 
        error: 'Failed to extract text from PDF', 
        details: pdfError.message 
      });
    }
    
    // Return a fast response with just the raw text
    const responseData = {
      text: pdfText,
      pages: pageCount,
      processingTimeMs: Date.now() - startTime
    };
    
    res.json(responseData);
    
  } catch (error) {
    console.error('[extract-pdf] General error in endpoint:', error);
    // Clean up file in case of general error
    try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch(e){}
    res.status(500).json({ 
      error: 'Failed to process request', 
      details: error.message 
    });
  } finally {
    // Always clean up the temporary file
    try { 
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('[extract-pdf] Temporary file cleaned up');
      } 
    } catch(e){ 
      console.warn('[extract-pdf] Cleanup error:', e); 
    }
  }
});

// Add a new endpoint to handle Word document uploads
app.post('/api/extract-docx', upload.single('file'), async (req, res) => {
  console.log('[extract-docx] Word document extraction requested');
  const startTime = Date.now();
  
  try {
    const file = req.file;
    if (!file) {
      console.error('[extract-docx] No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log(`[extract-docx] Processing ${file.originalname} (${file.size} bytes)`);
    
    // Check if file is a Word document
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && 
        file.mimetype !== 'application/msword') {
      console.error(`[extract-docx] Wrong file type: ${file.mimetype}`);
      return res.status(400).json({ error: 'Only Word documents are allowed for this endpoint' });
    }
    
    // For DOCX files, we need to use a package like mammoth
    // Since we're in Node.js, we can use mammoth directly
    console.log('[extract-docx] Importing mammoth...');
    const mammoth = require('mammoth');
    
    try {
      console.log('[extract-docx] Reading file...');
      const buffer = fs.readFileSync(file.path);
      
      console.log('[extract-docx] Extracting text with mammoth...');
      const result = await mammoth.extractRawText({ buffer });
      
      const extractedText = result.value;
      console.log(`[extract-docx] Successfully extracted ${extractedText.length} characters in ${Date.now() - startTime}ms`);
      
      if (result.messages.length > 0) {
        console.log('[extract-docx] Extraction warnings:', result.messages);
      }
      
      // Return the text just like the PDF endpoint does
      res.json({
        text: extractedText,
        pages: 0, // We don't have page information for Word docs
        processingTimeMs: Date.now() - startTime
      });
      
    } catch (docxError) {
      console.error('[extract-docx] Error extracting text from Word document:', docxError);
      return res.status(500).json({ 
        error: 'Failed to extract text from Word document', 
        details: docxError.message 
      });
    }
    
  } catch (error) {
    console.error('[extract-docx] General error in endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to process Word document', 
      details: error.message 
    });
  } finally {
    // Always clean up the temporary file
    try { 
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('[extract-docx] Temporary file cleaned up');
      }
    } catch(e) { 
      console.warn('[extract-docx] Cleanup error:', e); 
    }
  }
});

// Enhanced Server Startup Logging
const PORT = process.env.PORT || 3001;
console.log(`Attempting to start server on port ${PORT}...`);

// Use 0.0.0.0 to listen on all available network interfaces
const server = app.listen(PORT, '0.0.0.0', () => {
  // This callback ONLY runs if listen() is successful
  console.log(`\n--- SERVER LISTENING ---`);
  console.log(`Backend server successfully bound and listening on port ${PORT}`);
  console.log(`Accessible at: http://localhost:${PORT}`);
  // Log environment details again after successful start
  console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Present' : 'MISSING'}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Present' : 'MISSING'}`);
  console.log(`Supabase Anon Key: ${process.env.SUPABASE_ANON_KEY ? 'Present' : 'MISSING'}`);
  console.log(`------------------------\n`);
});

server.on('error', (error) => {
  // Log any errors specifically related to the server listening process
  console.error('\n--- SERVER LISTENING ERROR --- ');
  if (error.syscall !== 'listen') {
    console.error('Server error unrelated to listening:', error);
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      console.error(`Port ${PORT} requires elevated privileges.`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`Port ${PORT} is already in use. Please stop the other process or use a different port.`);
      process.exit(1);
      break;
    default:
      console.error('An unexpected error occurred during server startup:', error);
      throw error;
  }
});

console.log('Server instance created, waiting for listening event...');

// Graceful Shutdown (Optional but good practice)
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
}); 