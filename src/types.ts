export interface CV {
  id: string;
  user_id: string;
  filename: string;
  content?: string;
  file_path?: string;
  parsed_data?: any;
  metadata?: any;
  created_at: string;
  updated_at?: string;
  is_favorite: boolean;
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