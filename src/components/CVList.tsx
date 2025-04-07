import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Star, Trash2, Download, ExternalLink, Upload, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchUserCVs, deleteCV, toggleFavorite, downloadCV } from '../lib/api';
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      fetchCVs();
    } else {
      navigate('/auth');
    }
  }, [user, navigate]);

  const fetchCVs = async () => {
    setLoading(true);
    setError(null);
    console.log('[CVList] Fetching CVs for user:', user?.id);
    try {
      const rawData = await fetchUserCVs(user?.id || '');
      console.log('[CVList] === RAW DATA RECEIVED FROM API ===');
      console.log(JSON.stringify(rawData, null, 2));
      
      if (Array.isArray(rawData)) {
        console.log(`[CVList] Received ${rawData.length} CV records.`);
        rawData.forEach((cv: CV, index) => {
          console.log(`[CVList] Processing CV ${index + 1}:`, {
            id: cv.id,
            filename: cv.filename,
            source: cv.source,
            hasParsedData: !!cv.parsedData,
            hasMetadata: !!cv.metadata,
            createdAt: cv.createdAt || cv.created_at
          });
        });
        setCvs(rawData);
        console.log('[CVList] State updated with fetched CVs.');
      } else {
        console.warn('[CVList] Received unexpected data format, setting CVs to empty array:', rawData);
        setCvs([]);
      }
    } catch (err) {
      console.error('[CVList] Error during fetchCVs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load CVs');
      setCvs([]);
    } finally {
      setLoading(false);
      console.log('[CVList] Fetching complete.');
    }
  };

  const handleDelete = async (id: string) => {
    console.log(`[CVList handleDelete] Clicked delete for ID: ${id}`);
    if (!confirm(t('cv.list.deleteConfirm'))) {
      console.log('[CVList handleDelete] User cancelled deletion.');
      return;
    }

    setError(null);
    setIsDeleting(id);

    try {
      console.log(`[CVList handleDelete] Calling deleteCV API function for ID: ${id}`);
      const result = await deleteCV(id);
      console.log(`[CVList handleDelete] API call result:`, result);
      
      if (result.success) {
        console.log(`[CVList handleDelete] Successfully deleted CV ${id}, refreshing list...`);
        setCvs(prevCvs => prevCvs.filter(cv => cv.id !== id));
      } else {
        console.error('[CVList handleDelete] API reported failure:', result.message);
        setError(result.message || t('cv.list.errorDelete'));
      }
      
    } catch (err: any) {
      console.error(`[CVList handleDelete] Error during delete process for ID ${id}:`, err);
      setError(err.message || t('cv.list.errorDelete'));
    } finally {
      console.log(`[CVList handleDelete] Finished delete process for ID: ${id}`);
      setIsDeleting(null);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    console.log(`[CVList] Toggling favorite for CV: ${id}`);
    try {
      const response = await toggleFavorite(id);
      console.log(`[CVList] Favorite toggle response for ${id}:`, response);
      setCvs(prevCvs => 
        prevCvs.map(c => 
          c.id === id ? { ...c, isFavorite: response?.cv?.is_favorite, is_favorite: response?.cv?.is_favorite } : c
        )
      );
    } catch (err) {
      console.error(`[CVList] Error toggling favorite for ${id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite status');
    }
  };

  const handleDownload = async (cv: CV) => {
    console.log(`[CVList] Attempting to download CV: ${cv.id}, Filename: ${cv.filename}`);
    try {
      await downloadCV(cv.id, cv.filename);
      console.log(`[CVList] Download initiated for CV: ${cv.id}`);
    } catch (err) {
      console.error(`[CVList] Error downloading CV ${cv.id}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to download CV');
    }
  };

  const handleEdit = (cvId: string) => {
    console.log(`[CVList] Navigating to edit page for CV: ${cvId}`);
    navigate(`/edit?cvId=${cvId}`);
  };

  if (loading && cvs.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingScreen />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={fetchCVs}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('cv.list.title')}</h1>
        <div className="flex space-x-2 sm:space-x-4">
          <button
            onClick={fetchCVs}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center text-sm sm:text-base"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5 mr-1 sm:mr-2" /> : <RefreshCw className="h-5 w-5 mr-1 sm:mr-2" />}
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
          <button
            onClick={() => navigate('/import')}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center text-sm sm:text-base"
          >
            <Upload className="h-5 w-5 mr-1 sm:mr-2" />
            {t('cv.upload.new')}
          </button>
        </div>
      </div>

      {cvs.length === 0 && !loading ? (
        <div className="mt-10 text-center border rounded-lg p-8 bg-gray-50">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600 mb-6">{t('cv.list.empty')}</p>
          <button
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            onClick={() => navigate('/import')}
          >
            <Upload className="h-5 w-5 mr-2" />
            {t('cv.upload.title')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {cvs.map((cv) => (
            <div
              key={cv.id}
              className="border rounded-lg p-4 sm:p-6 hover:shadow-lg transition-shadow bg-white flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center min-w-0 mr-2">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500 mr-2 flex-shrink-0" />
                    <h2 className="text-base sm:text-lg font-semibold truncate" title={cv.filename}>{cv.filename}</h2>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(cv.id)}
                    className={`p-1 rounded-full ml-auto flex-shrink-0 ${
                      (cv.isFavorite || cv.is_favorite) ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-gray-500'
                    }`}
                    title={t('cv.list.toggleFavorite')}
                  >
                    <Star className="h-5 w-5" fill={(cv.isFavorite || cv.is_favorite) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className="space-y-1 mb-4 text-xs sm:text-sm text-gray-600">
                  <p>
                    <span className="font-medium">{t('cv.list.uploaded')}:</span> {
                      (() => {
                        const dateStr = cv.createdAt || cv.created_at;
                        if (!dateStr) return 'N/A';
                        try {
                          return new Date(dateStr).toLocaleDateString();
                        } catch (e) {
                          console.warn(`Invalid date format: ${dateStr}`);
                          return 'N/A';
                        }
                      })()
                    }
                  </p>
                  {(cv.parsedData?.name || cv.metadata?.name) && (
                    <p className="truncate" title={cv.parsedData?.name || cv.metadata?.name}>
                      <span className="font-medium">{t('common.name')}:</span> {cv.parsedData?.name || cv.metadata?.name}
                    </p>
                  )}
                  {(cv.parsedData?.email || cv.metadata?.email) && (
                    <p className="truncate" title={cv.parsedData?.email || cv.metadata?.email}>
                      <span className="font-medium">{t('common.email')}:</span> {cv.parsedData?.email || cv.metadata?.email}
                    </p>
                  )}
                  {(() => {
                    const skillsArray = Array.isArray(cv.parsedData?.skills) 
                      ? cv.parsedData.skills 
                      : Array.isArray(cv.metadata?.skills) 
                      ? cv.metadata.skills 
                      : [];
                    if (skillsArray.length > 0) {
                      return (
                        <div>
                          <span className="font-medium">{t('common.skills')}:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {skillsArray.slice(0, 4).map((skill: string, index: number) => (
                              <span
                                key={index}
                                className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                            {skillsArray.length > 4 && (
                              <span className="text-xs text-gray-400">...</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="flex justify-end items-center border-t pt-3 mt-4">
                <div className="flex space-x-1 sm:space-x-2">
                  <button
                    onClick={() => handleEdit(cv.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                    title={t('common.edit')}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(cv)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                    title={t('common.download')}
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cv.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CVList; 