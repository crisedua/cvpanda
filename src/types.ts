export interface CV {
  id: string;
  user_id: string;
  filename: string;
  content?: string;
  file_path?: string;
  parsed_data?: ParsedCVData;
  parsed_data_english?: ParsedCVData;
  metadata?: any;
  created_at: string;
  updated_at?: string;
  is_favorite: boolean;
  isFavorite?: boolean;
  source?: string;
  is_large_cv?: boolean;
  warning_message?: string;
  using_raw_data?: boolean;
  available_sections?: string[];
}

export interface ParsedCVData {
  name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  github_url?: string;
  website_url?: string;
  location?: string;
  job_title?: string;
  summary?: string;
  skills?: string[];
  work_experience?: WorkExperience[];
  education?: EducationEntry[];
  [key: string]: any;
}

export interface WorkExperience {
  company?: string;
  title?: string;
  dates?: string;
  location?: string;
  description?: string;
  achievements?: string[];
}

export interface EducationEntry {
  institution?: string;
  degree?: string;
  dates?: string;
}

export interface ProfileKeywordAnalysis {
  keyword: string;
  relevance: number;
  currentUsage: string;
  recommendedUsage: string;
  placement: string;
}

export interface ProfileSectionEnhancement {
  section: string;
  currentContent: string;
  enhancedContent: string;
  rationale: string;
}

export interface IndustryTrend {
  trend: string;
  relevance: number;
  implementation: string;
}

export interface AtsOptimization {
  currentScore: number;
  recommendations: string[];
  keywordsToAdd: string[];
}

export interface CompetitiveAdvantage {
  uniqueSellingPoints: string[];
  differentiationStrategy: string;
  emergingOpportunities: string[];
}

export interface ActionPlan {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
}

export interface ProfileEnhancementResult {
  profileScore: {
    current: number;
    potential: number;
    keyFactors: string[];
  };
  keywordAnalysis: ProfileKeywordAnalysis[];
  sectionEnhancements: ProfileSectionEnhancement[];
  industryTrends: IndustryTrend[];
  atsOptimization: AtsOptimization;
  competitiveAdvantage: CompetitiveAdvantage;
  actionPlan: ActionPlan;
  metadata?: {
    processedAt: string;
    targetPlatform: string;
    industryFocus: string;
    careerLevel: string;
  };
} 