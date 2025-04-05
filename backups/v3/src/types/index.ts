export interface CV {
  id: string;
  user_id: string;
  filename: string;
  file_path: string;
  is_favorite: boolean;
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
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}