import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Star, Trash2, Download, ExternalLink, Upload, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserCVs, deleteCV, toggleFavorite, processCV, downloadCV } from '../lib/api';
import { useTranslation } from 'react-i18next';
import LoadingScreen from './LoadingScreen';

interface CV {
  id: string;
  filename: string;
  createdAt?: string;
  created_at?: string;
  userId?: string;
  user_id?: string;
  isFavorite?: boolean;
  is_favorite?: boolean;
  source?: string;
  parsedData?: {
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[] | Record<string, string[]>;
    work_experience?: Array<any>;
    education?: Array<any>;
    [key: string]: any;
  };
  metadata?: {
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[];
    experience?: Array<any>;
    education?: Array<any>;
    [key: string]: any;
  };
  [key: string]: any;
}

const CVList: React.FC = () => {
  const { user } = useAuth();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      fetchCVs();
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  const fetchCVs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUserCVs(user?.id || '');
      setCvs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CVs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this CV?')) {
      return;
    }

    try {
      await deleteCV(id);
      setCvs(cvs.filter(cv => cv.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete CV');
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const { cv } = await toggleFavorite(id);
      setCvs(cvs.map(c => c.id === id ? cv : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite status');
    }
  };

  const handleProcessCV = async (id: string) => {
    try {
      setLoading(true);
      const { cv } = await processCV(id);
      setCvs(cvs.map(c => c.id === id ? cv : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CV');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (cv: CV) => {
    try {
      await downloadCV(cv.id, cv.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download CV');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
        <button
          onClick={fetchCVs}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My CVs</h1>
        <button
          onClick={() => navigate('/import')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Upload New CV
        </button>
      </div>

      {cvs.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-gray-500 mb-6">{t('cv.list.empty')}</p>
          <button
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            onClick={() => navigate('/import')}
          >
            <Upload className="h-5 w-5 mr-2" />
            {t('cv.upload.title')}
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-12">
          <LoadingScreen />
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('cv.list.title')}</h2>
            <button
              onClick={() => navigate('/import')}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Upload className="h-5 w-5 mr-2" />
              {t('cv.upload.new')}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cvs.map((cv) => (
              <div
                key={cv.id}
                className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <FileText className="h-6 w-6 text-blue-500 mr-2" />
                    <h2 className="text-xl font-semibold">{cv.filename}</h2>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(cv.id)}
                    className={`p-2 rounded-full ${
                      cv.is_favorite ? 'text-yellow-500' : 'text-gray-400'
                    }`}
                  >
                    <Star className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  {cv.metadata?.name && (
                    <p className="text-gray-600">
                      <span className="font-medium">Name:</span> {cv.metadata.name}
                    </p>
                  )}
                  {cv.metadata?.email && (
                    <p className="text-gray-600">
                      <span className="font-medium">Email:</span> {cv.metadata.email}
                    </p>
                  )}
                  {cv.metadata?.phone && (
                    <p className="text-gray-600">
                      <span className="font-medium">Phone:</span> {cv.metadata.phone}
                    </p>
                  )}
                  {Array.isArray(cv.parsedData?.skills) && 
                    cv.parsedData.skills.slice(0, 5).map((skill: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 rounded text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  {Array.isArray(cv.parsedData?.skills) && 
                    cv.parsedData.skills.length > 5 && (
                      <span className="text-xs text-gray-400">...</span>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleProcessCV(cv.id)}
                      className="p-2 text-blue-500 hover:text-blue-600"
                      title="Process CV"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cv.id)}
                      className="p-2 text-red-500 hover:text-red-600"
                      title="Delete CV"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleDownload(cv)}
                    className="p-2 text-gray-500 hover:text-gray-600"
                    title="Download CV"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CVList; 