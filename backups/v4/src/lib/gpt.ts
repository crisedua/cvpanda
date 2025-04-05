import OpenAI from 'openai';
import { createComponentLogger } from './logger';

const logger = createComponentLogger('GPT');

// Initialize OpenAI client
let openai: OpenAI | null = null;

// Function to initialize OpenAI client
export function initializeOpenAI() {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.error('Missing OpenAI API key');
      throw new Error('OpenAI API key is required. Please add VITE_OPENAI_API_KEY to your environment variables.');
    }

    // Validate API key format
    if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
      logger.error('Invalid OpenAI API key format');
      throw new Error('Invalid OpenAI API key format. The key should start with "sk-" and be at least 40 characters long.');
    }

    return new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  } catch (error) {
    logger.error('Failed to initialize OpenAI client', error);
    throw error;
  }
}

// Initialize the client
openai = initializeOpenAI();

const SYSTEM_PROMPT = `You are a career expert and resume optimization specialist. Your task is to improve the provided CV by reformatting it into a modern, professional resume that highlights the candidate's key strengths and aligns with industry best practices.

You must analyze the CV text and extract the following information in a structured format and respond ONLY with a valid JSON object containing these fields:

{
  "personal": {
    "name": "string",
    "title": "string",
    "email": "string",
    "phone": "string",
    "linkedin": "string"
  },
  "summary": "string",
  "experience": [
    {
      "company": "string",
      "position": "string",
      "location": "string",
      "duration": "string",
      "responsibilities": ["string"],
      "achievements": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "year": "string",
      "honors": ["string"]
    }
  ],
  "skills": {
    "technical": ["string"],
    "soft": ["string"],
    "industry": ["string"]
  },
  "additional": {
    "certifications": ["string"],
    "courses": ["string"],
    "projects": ["string"],
    "publications": ["string"],
    "volunteer": ["string"]
  }
}

If any field is not found in the CV, omit it from the JSON response. Ensure the response is a valid JSON object.`;

const getLearningPathPrompt = (language: string) => {
  const promptsByLanguage = {
    en: `You are a career development and learning path specialist. Your task is to analyze the provided CV data and career goal to create a comprehensive learning and development plan.

Based on the CV content and career goal, create a detailed learning path that includes:

1. Current skill level assessment
2. Target skill requirements
3. Skill gaps analysis
4. Recommended courses and certifications (provide course names and descriptions in English)
5. Practical projects for skill development
6. Timeline with milestones

Respond ONLY with a valid JSON object in this exact structure:

{
  "analysis": {
    "current_level": "string",
    "target_level": "string",
    "key_gaps": ["string"]
  },
  "learning_path": {
    "immediate": {
      "courses": [
        {
          "title": "string",
          "provider": "string",
          "url": "string",
          "duration": "string",
          "description": "string"
        }
      ],
      "certifications": [
        {
          "name": "string",
          "provider": "string",
          "level": "string",
          "description": "string"
        }
      ]
    },
    "short_term": {
      "courses": [...],
      "certifications": [...]
    },
    "long_term": {
      "courses": [...],
      "certifications": [...]
    }
  },
  "projects": [
    {
      "title": "string",
      "description": "string",
      "skills_practiced": ["string"],
      "estimated_duration": "string"
    }
  ],
  "timeline": {
    "months_to_goal": number,
    "milestones": [
      {
        "title": "string",
        "description": "string",
        "target_date": "string"
      }
    ]
  }
}`,
    es: `Eres un especialista en desarrollo profesional y planes de aprendizaje. Tu tarea es analizar el CV proporcionado y el objetivo profesional para crear un plan integral de aprendizaje y desarrollo.

Basándote en el contenido del CV y el objetivo profesional, crea una ruta de aprendizaje detallada que incluya:

1. Evaluación del nivel actual de habilidades
2. Requisitos de habilidades objetivo
3. Análisis de brechas de habilidades
4. Cursos y certificaciones recomendados (proporciona nombres y descripciones en español)
5. Proyectos prácticos para el desarrollo de habilidades
6. Cronograma con hitos

Responde ÚNICAMENTE con un objeto JSON válido en esta estructura exacta:

{
  "analysis": {
    "current_level": "string",
    "target_level": "string",
    "key_gaps": ["string"]
  },
  "learning_path": {
    "immediate": {
      "courses": [
        {
          "title": "string",
          "provider": "string",
          "url": "string",
          "duration": "string",
          "description": "string"
        }
      ],
      "certifications": [
        {
          "name": "string",
          "provider": "string",
          "level": "string",
          "description": "string"
        }
      ]
    },
    "short_term": {
      "courses": [...],
      "certifications": [...]
    },
    "long_term": {
      "courses": [...],
      "certifications": [...]
    }
  },
  "projects": [
    {
      "title": "string",
      "description": "string",
      "skills_practiced": ["string"],
      "estimated_duration": "string"
    }
  ],
  "timeline": {
    "months_to_goal": number,
    "milestones": [
      {
        "title": "string",
        "description": "string",
        "target_date": "string"
      }
    ]
  }
}`
  };

  return promptsByLanguage[language] || promptsByLanguage.en;
};

const getImprovementPrompt = (style: string, focusArea: string, additionalInstructions: string, targetLanguage: string) => {
  const styleInstructions = {
    formal: 'Use formal, traditional corporate language and formatting',
    startup: 'Use modern, dynamic language suitable for startups and tech companies',
    academic: 'Focus on academic achievements and research experience',
    executive: 'Emphasize leadership and strategic achievements'
  }[style] || 'Use formal, professional language';

  const focusInstructions = {
    experience: 'Place strong emphasis on professional experience and achievements',
    education: 'Highlight educational background and academic accomplishments',
    skills: 'Focus on technical and professional skills',
    leadership: 'Emphasize leadership and management capabilities'
  }[focusArea] || 'Maintain a balanced focus across all sections';

  const languageInstruction = targetLanguage === 'en' 
    ? 'Translate and enhance all content into professional English. Maintain the same structure but translate and improve all text content.'
    : 'Keep the original language and structure while improving clarity and impact.';

  return `You are a professional CV enhancement specialist. Your task is to improve the provided CV data following these specific instructions:

Style: ${styleInstructions}
Focus: ${focusInstructions}
Language: ${languageInstruction}

Additional Requirements:
${additionalInstructions || 'Maintain professional tone and clarity'}

Core Improvements:
1. Make language more impactful and professional
2. Highlight achievements and quantifiable results
3. Use industry-specific keywords and phrases
4. Strengthen the professional summary
5. Enhance skill descriptions
6. Improve job descriptions to focus on achievements

CRITICAL: Your response must be ONLY a valid JSON object with the exact same structure as the input. Do not include any additional text, explanations, or formatting. The response should be parseable by JSON.parse().

Example structure:
{
  "personal": { "name": "...", "title": "..." },
  "summary": "...",
  "experience": [{ "company": "...", "position": "..." }],
  "education": [{ "institution": "...", "degree": "..." }],
  "skills": { "technical": ["..."], "soft": ["..."] },
  "additional": { "certifications": ["..."] }
}

IMPORTANT: If targetLanguage is 'en', translate ALL text content into professional English while maintaining the same structure. Otherwise, keep the original language but improve the content quality.`;
};

export async function parseCV(text: string) {
  if (!openai) {
    openai = initializeOpenAI();
  }

  if (!openai) {
    throw new Error('OpenAI API key is required. Please add VITE_OPENAI_API_KEY to your environment variables.');
  }

  try {
    logger.log('Starting CV parsing with GPT-4');

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text }
      ],
      temperature: 0.7,
    });

    const result = completion.choices[0]?.message?.content;
    
    if (!result) {
      throw new Error('No response from GPT-4');
    }

    try {
      const parsedResult = JSON.parse(result);
      logger.log('Successfully parsed CV');
      return parsedResult;
    } catch (parseError) {
      logger.error('Failed to parse GPT response as JSON', parseError);
      throw new Error('Invalid response format from GPT-4');
    }
  } catch (error) {
    logger.error('GPT parsing failed', error);
    throw error instanceof Error ? error : new Error('Failed to parse CV content. Please try again.');
  }
}

export async function improveCV(
  cvData: any,
  style: string,
  focusArea: string,
  additionalInstructions: string,
  targetLanguage: string
) {
  if (!openai) {
    openai = initializeOpenAI();
  }

  if (!openai) {
    throw new Error('OpenAI API key is required. Please add VITE_OPENAI_API_KEY to your environment variables.');
  }

  try {
    logger.log('Starting CV improvement with GPT-4', {
      style,
      focusArea,
      targetLanguage
    });

    const prompt = getImprovementPrompt(style, focusArea, additionalInstructions, targetLanguage);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: prompt },
        { 
          role: "user", 
          content: JSON.stringify(cvData, null, 2) // Pretty print JSON for better GPT understanding
        }
      ],
      temperature: 0.7
    });

    const result = completion.choices[0]?.message?.content;
    
    if (!result) {
      throw new Error('No response from GPT-4');
    }

    try {
      const improvedResult = JSON.parse(result);
      logger.log('Successfully improved CV');
      return improvedResult;
    } catch (parseError) {
      logger.error('Failed to parse GPT improvement response as JSON', parseError);
      throw new Error('Invalid response format from GPT-4');
    }
  } catch (error) {
    logger.error('GPT improvement failed', error);
    throw error instanceof Error ? error : new Error('Failed to improve CV content. Please try again.');
  }
}

export async function analyzeLearningPath(cvData: any, careerGoal: string, language: string = 'en') {
  if (!openai) {
    openai = initializeOpenAI();
  }

  if (!openai) {
    throw new Error('OpenAI API key is required. Please add VITE_OPENAI_API_KEY to your environment variables.');
  }

  try {
    logger.log('Starting learning path analysis with GPT-4', { careerGoal, language });

    const prompt = getLearningPathPrompt(language);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: prompt },
        { 
          role: "user", 
          content: JSON.stringify({
            cv: cvData,
            careerGoal
          }, null, 2)
        }
      ],
      temperature: 0.7
    });

    const result = completion.choices[0]?.message?.content;
    
    if (!result) {
      throw new Error('No response from GPT-4');
    }

    try {
      const analysisResult = JSON.parse(result);
      logger.log('Successfully analyzed learning path');
      return analysisResult;
    } catch (parseError) {
      logger.error('Failed to parse GPT analysis response as JSON', parseError);
      throw new Error('Invalid response format from GPT-4');
    }
  } catch (error) {
    logger.error('GPT analysis failed', error);
    throw error instanceof Error ? error : new Error('Failed to analyze learning path. Please try again.');
  }
}