import { createClient } from '@supabase/supabase-js';
import { createComponentLogger } from './logger';

const logger = createComponentLogger('Supabase');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

logger.log('Initializing Supabase client', { url: supabaseUrl });

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: window.sessionStorage,
    storageKey: 'supabase.auth.token'
  }
});

// Test database connection
const testConnection = async () => {
  try {
    logger.log('Testing database connection...');
    
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError) {
      logger.error('Auth connection error', authError);
      return false;
    }
    
    // Test a simple query to verify database connection
    const { error: dbError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
      .single();

    if (dbError && !dbError.message.includes('JWT')) {
      logger.error('Database connection error', dbError);
      return false;
    }
    
    logger.log('Connection test successful');
    return true;
  } catch (err) {
    logger.error('Connection test failed', err);
    return false;
  }
};

let connectionPromise: Promise<boolean> | null = null;
let lastConnectionCheck = 0;
const CONNECTION_CACHE_TIME = 5000; // 5 seconds

export const checkSupabaseConnection = async () => {
  const now = Date.now();
  
  if (!connectionPromise || (now - lastConnectionCheck) > CONNECTION_CACHE_TIME) {
    connectionPromise = testConnection();
    lastConnectionCheck = now;
  }
  
  return connectionPromise;
};