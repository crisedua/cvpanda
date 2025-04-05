import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { createComponentLogger } from './logger';

const logger = createComponentLogger('Pinecone');

// Add polyfill for global - this fixes the "global is not defined" error in browser
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.global = window;
}

const pineconeApiKey = import.meta.env.VITE_PINECONE_API_KEY;
const pineconeIndex = import.meta.env.VITE_PINECONE_INDEX || 'cvpanda';
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!pineconeApiKey) {
  logger.error('Missing Pinecone API key');
  console.warn('Missing Pinecone API key - please add VITE_PINECONE_API_KEY to your .env file');
}

if (!openaiApiKey) {
  logger.error('Missing OpenAI API key');
  console.warn('Missing OpenAI API key - please add VITE_OPENAI_API_KEY to your .env file');
}

// Initialize Pinecone client with error handling
let pinecone: Pinecone | null = null;
try {
  pinecone = new Pinecone({
    apiKey: pineconeApiKey || 'dummy-key-for-development',
  });
  console.log('Pinecone client initialized successfully');
} catch (error) {
  console.error('Error initializing Pinecone client:', error);
  // Create a fallback mock client for development
  pinecone = {
    index: () => ({
      upsert: async () => ({ upsertedCount: 0 }),
      query: async () => ({ matches: [] })
    })
  } as any;
}

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: openaiApiKey || 'dummy-key-for-development',
  dangerouslyAllowBrowser: true,
  baseURL: '/api/openai'
});

// Get index instance
export const getIndex = async () => {
  try {
    if (!pinecone) {
      throw new Error('Pinecone client not initialized');
    }
    
    const index = pinecone.index(pineconeIndex);
    return index;
  } catch (error) {
    logger.error('Error getting Pinecone index:', error);
    throw error;
  }
};

// Generate embedding for text
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    logger.log('Generating embedding for text');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Error generating embedding:', error);
    throw error;
  }
};

// Type for CV metadata that is compatible with Pinecone RecordMetadata
interface CVMetadata {
  type: 'cv';
  cvId: string;
  [key: string]: any; // Add index signature for string keys
}

// Type for job metadata that is compatible with Pinecone RecordMetadata
interface JobMetadata {
  type: 'job';
  jobId: string;
  [key: string]: any; // Add index signature for string keys
}

// Type for match result with CV
export interface CVMatchResult {
  cvId: string;
  score: number;
}

// Type for match result with job
export interface JobMatchResult {
  jobId: string;
  score: number;
}

// Store CV embeddings
export const storeCV = async (cvId: string, cvText: string) => {
  try {
    logger.log(`Storing CV embedding for ID: ${cvId}`);
    const embedding = await generateEmbedding(cvText);
    const index = await getIndex();
    
    await index.upsert([{
      id: `cv_${cvId}`,
      values: embedding,
      metadata: {
        type: 'cv',
        cvId,
      } as CVMetadata,
    }]);
    
    logger.log(`CV embedding stored successfully for ID: ${cvId}`);
    return true;
  } catch (error) {
    logger.error('Error storing CV embedding:', error);
    throw error;
  }
};

// Store job description embeddings
export const storeJobDescription = async (jobId: string, jobText: string) => {
  try {
    logger.log(`Storing job description embedding for ID: ${jobId}`);
    const embedding = await generateEmbedding(jobText);
    const index = await getIndex();
    
    await index.upsert([{
      id: `job_${jobId}`,
      values: embedding,
      metadata: {
        type: 'job',
        jobId,
      } as JobMetadata,
    }]);
    
    logger.log(`Job description embedding stored successfully for ID: ${jobId}`);
    return true;
  } catch (error) {
    logger.error('Error storing job description embedding:', error);
    throw error;
  }
};

// Match CV to job description
export const matchCVToJob = async (cvId: string, limit = 10): Promise<JobMatchResult[]> => {
  try {
    logger.log(`Finding matching jobs for CV ID: ${cvId}`);
    const index = await getIndex();
    
    const queryResponse = await index.query({
      vector: (await generateEmbedding(`cv_${cvId}`)),
      filter: { type: 'job' },
      topK: limit,
      includeMetadata: true,
    });
    
    logger.log(`Found ${queryResponse.matches.length} matching jobs`);
    return queryResponse.matches
      .filter(match => match.metadata)
      .map(match => {
        const metadata = match.metadata as unknown as JobMetadata;
        return {
          jobId: metadata.jobId,
          score: match.score || 0,
        };
      });
  } catch (error) {
    logger.error('Error matching job to CV:', error);
    throw error;
  }
};

// Match job to CV
export const matchJobToCV = async (jobId: string, limit = 10): Promise<CVMatchResult[]> => {
  try {
    logger.log(`Finding matching CVs for job ID: ${jobId}`);
    const index = await getIndex();
    
    const queryResponse = await index.query({
      vector: (await generateEmbedding(`job_${jobId}`)),
      filter: { type: 'cv' },
      topK: limit,
      includeMetadata: true,
    });
    
    logger.log(`Found ${queryResponse.matches.length} matching CVs`);
    return queryResponse.matches
      .filter(match => match.metadata)
      .map(match => {
        const metadata = match.metadata as unknown as CVMetadata;
        return {
          cvId: metadata.cvId,
          score: match.score || 0,
        };
      });
  } catch (error) {
    logger.error('Error matching CV to job:', error);
    throw error;
  }
};

// Calculate match score between specific CV and job
export const calculateMatchScore = async (cvId: string, jobId: string) => {
  try {
    logger.log(`Calculating match score between CV ${cvId} and job ${jobId}`);
    const index = await getIndex();
    
    // Get CV embedding
    const cvEmbedding = await generateEmbedding(`cv_${cvId}`);
    
    // Query with CV embedding against specific job
    const queryResponse = await index.query({
      vector: cvEmbedding,
      filter: { 
        type: 'job',
        jobId: jobId
      },
      topK: 1,
      includeMetadata: true,
    });
    
    if (queryResponse.matches.length === 0) {
      logger.error('No match found');
      return 0;
    }
    
    logger.log(`Match score: ${queryResponse.matches[0].score}`);
    return queryResponse.matches[0].score || 0;
  } catch (error) {
    logger.error('Error calculating match score:', error);
    throw error;
  }
}; 