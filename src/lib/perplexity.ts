import { createComponentLogger } from './logger';

const logger = createComponentLogger('PerplexityAPI');

interface PerplexityCertification {
  title: string;
  provider: string;
  link?: string;
  description: string;
  duration?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  skills?: string[];
}

interface PerplexitySearchResponse {
  success: boolean;
  certifications?: PerplexityCertification[];
  resources?: {
    courses: {
      title: string;
      provider: string;
      link?: string;
      description: string;
    }[];
    books?: {
      title: string;
      author: string;
      description: string;
    }[];
    communities?: {
      name: string;
      description: string;
      link?: string;
    }[];
  };
  careerPathSuggestions?: {
    shortTerm: string[];
    mediumTerm: string[];
    longTerm: string[];
  };
  error?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace('http://', 'https://');

/**
 * Searches for certifications and learning resources based on a career goal
 * 
 * @param careerGoal - The user's career goal (e.g., "Become a Senior Data Scientist at a tech company")
 * @returns Certifications and learning resources to achieve the career goal
 */
export const findResourcesForCareerGoal = async (
  careerGoal: string, 
  currentSkills?: string[]
): Promise<PerplexitySearchResponse> => {
  try {
    logger.log('Searching for career resources', { careerGoal });
    
    // Call our backend which will use the Perplexity API
    const response = await fetch(`${API_BASE_URL}/api/career-resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        careerGoal,
        currentSkills: currentSkills || []
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      throw new Error(errorData.error || `Server returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to find career resources');
    }
    
    logger.log('Successfully found career resources', { 
      certificationCount: data.certifications?.length || 0,
      coursesCount: data.resources?.courses?.length || 0
    });
    
    return data;
  } catch (error) {
    logger.error('Error finding career resources', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Mock function to simulate Perplexity API response during development
 * Remove this when the actual API is implemented
 */
export const mockFindResourcesForCareerGoal = async (
  careerGoal: string
): Promise<PerplexitySearchResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    success: true,
    certifications: [
      {
        title: "Google Data Analytics Professional Certificate",
        provider: "Coursera",
        link: "https://www.coursera.org/professional-certificates/google-data-analytics",
        description: "Prepare for a new career in the high-growth field of data analytics, no experience or degree required.",
        duration: "6 months",
        difficulty: "Beginner",
        skills: ["Data Analysis", "SQL", "R Programming", "Data Visualization"]
      },
      {
        title: "IBM Data Science Professional Certificate",
        provider: "Coursera",
        link: "https://www.coursera.org/professional-certificates/ibm-data-science",
        description: "Develop skills in Python, SQL, data visualization, and machine learning.",
        duration: "8 months",
        difficulty: "Intermediate",
        skills: ["Python", "Machine Learning", "Data Science", "SQL", "Data Visualization"]
      },
      {
        title: "Machine Learning Specialization",
        provider: "Coursera (Stanford)",
        link: "https://www.coursera.org/specializations/machine-learning-introduction",
        description: "Comprehensive introduction to modern machine learning, taught by Andrew Ng.",
        duration: "3 months",
        difficulty: "Intermediate",
        skills: ["Machine Learning", "Python", "Neural Networks", "Supervised Learning"]
      }
    ],
    resources: {
      courses: [
        {
          title: "Python for Data Science and Machine Learning Bootcamp",
          provider: "Udemy",
          link: "https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/",
          description: "Learn how to use NumPy, Pandas, Seaborn, Matplotlib, Scikit-Learn, and more."
        },
        {
          title: "Statistics and Probability",
          provider: "Khan Academy",
          link: "https://www.khanacademy.org/math/statistics-probability",
          description: "Free courses on statistics fundamentals and probability theory."
        }
      ]
    },
    careerPathSuggestions: {
      shortTerm: [
        "Complete foundational data science courses",
        "Build a portfolio of data analysis projects",
        "Learn SQL fundamentals"
      ],
      mediumTerm: [
        "Contribute to open-source data projects",
        "Participate in Kaggle competitions",
        "Network with data professionals on LinkedIn"
      ],
      longTerm: [
        "Specialize in a specific domain (finance, healthcare, etc.)",
        "Develop expertise in advanced ML techniques",
        "Pursue leadership roles in data teams"
      ]
    }
  };
}; 