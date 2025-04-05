import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { createComponentLogger } from '../lib/logger';
import LoadingScreen from '../components/LoadingScreen';
import type { User } from '../types';

const logger = createComponentLogger('AuthContext');

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  avatarUrl: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateAvatar: (url: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Profile load error', error);
        return null;
      }

      if (!profile) {
        logger.error('No profile found');
        return null;
      }

      // Set the avatar URL in the context state
      setAvatarUrl(profile.avatar_url);

      return {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      };
    } catch (err) {
      logger.error('Profile load failed', err);
      return null;
    }
  };

  const initAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (profile) {
          setUser(profile);
          setIsAdmin(profile.role === 'admin');
        }
      }
      
      setConnectionError(null);
    } catch (err) {
      logger.error('Auth initialization failed', err);
      setConnectionError(err instanceof Error ? err.message : 'Failed to initialize authentication');
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    if (mounted) {
      initAuth();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      logger.log('Auth state changed', { event });

      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (profile) {
          setUser(profile);
          setIsAdmin(profile.role === 'admin');
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setAvatarUrl(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setAvatarUrl(null);
  };

  const updateAvatar = (url: string) => {
    setAvatarUrl(url);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">{connectionError}</h2>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin, 
      avatarUrl,
      signIn, 
      signUp, 
      signOut,
      updateAvatar
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};