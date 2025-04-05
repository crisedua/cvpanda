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