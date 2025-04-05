export interface CV {
  id: string;
  user_id: string;
  filename: string;
  file_path: string;
  is_favorite: boolean;
  content?: string;
  parsed_data: {
    personal?: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
    };
    summary?: string;
    experience?: Array<{
      company: string;
      position: string;
      location?: string;
      duration: string;
      responsibilities?: string[];
      achievements?: string[];
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      year: string;
      honors?: string[];
    }>;
    skills?: {
      technical?: string[];
      soft?: string[];
      industry?: string[];
    };
    additional?: {
      certifications?: string[];
      courses?: string[];
      projects?: string[];
      publications?: string[];
      volunteer?: string[];
    };
  };
  parsed_data_english?: {
    personal?: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
    };
    summary?: string;
    experience?: Array<{
      company: string;
      position: string;
      location?: string;
      duration: string;
      responsibilities?: string[];
      achievements?: string[];
    }>;
    education?: Array<{
      institution: string;
      degree: string;
      year: string;
      honors?: string[];
    }>;
    skills?: {
      technical?: string[];
      soft?: string[];
      industry?: string[];
    };
    additional?: {
      certifications?: string[];
      courses?: string[];
      projects?: string[];
      publications?: string[];
      volunteer?: string[];
    };
  };
  created_at: string;
  updated_at: string;
  source_language?: string;
  binary_content?: boolean;
  // New properties for CV diagnostics
  is_large_cv?: boolean;
  warning_message?: string;
  section_metrics?: {
    [key: string]: {
      size: number;
      type: string;
      count: number;
    }
  };
  // Raw data handling
  using_raw_data?: boolean;
  available_sections?: string[];
  raw_content_length?: number;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// Job Scanning Types
export interface JobSource {
  id: string;
  name: string;
  url: string;
  icon: string; // icon name from Lucide icons
  enabled: boolean;
  requiresAuth: boolean;
  authData?: {
    username?: string;
    apiKey?: string;
    token?: string;
  };
}

export interface JobScanFilter {
  id: string;
  userId: string;
  name: string;
  keywords: string[];
  locations: string[];
  jobTypes: string[]; // full-time, part-time, contract, etc.
  experienceLevels: string[]; // entry, mid, senior, etc.
  salaryRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
  excludeKeywords: string[];
  sources: string[]; // IDs of sources to scan
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  notificationMethod: 'email' | 'app' | 'both';
}

export interface ScannedJob {
  id: string;
  filterId: string;
  userId: string;
  jobTitle: string;
  company: string;
  location: string;
  jobType: string;
  salary?: string;
  description: string;
  url: string;
  source: string;
  sourceId: string;
  postedDate: string;
  discoveredDate: string;
  status: 'new' | 'viewed' | 'saved' | 'applied' | 'rejected';
  matchScore: number;
  notes?: string;
  cvId?: string;
}