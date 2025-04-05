import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Edit2, Trash2, Plus, Loader2, AlertCircle, 
  Save, X, PlusCircle, MinusCircle, Star, Languages,
  Download, Eye, EyeOff, Copy, CheckCircle, ArrowRight,
  History, RotateCcw, AlertTriangle, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createComponentLogger } from '../lib/logger';
import ParsedCV from './ParsedCV';
import type { CV } from '../types';
import { getCV, getRawCV } from '../lib/api';

const logger = createComponentLogger('CVEdit');

const CVEdit = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [viewLanguage, setViewLanguage] = useState<'original' | 'english'>('original');
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const [rawData, setRawData] = useState<any>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserCVs();
    }
  }, [user]);

  useEffect(() => {
    const fetchCV = async () => {
      if (!selectedCVId) return;
      
      setLoading(true);
      try {
        logger.log(`Fetching CV: ${selectedCVId}`);
        
        // Attempt to get raw CV data first for large CVs
        let rawData = null;
        try {
          rawData = await getRawCV(selectedCVId);
          logger.log('Successfully fetched raw CV data');
        } catch (rawError) {
          logger.warn('Failed to fetch raw CV data, falling back to regular endpoint', rawError);
        }
        
        const cv = await getCV(selectedCVId);
        logger.log('Successfully fetched CV');
        
        // If we have raw data, store it
        if (rawData && rawData.rawContent) {
          setRawData(rawData);
        }
        
        setSelectedCV(cv);
        setLoading(false);
      } catch (error) {
        logger.error('Error fetching CV:', error);
        setError('Failed to load CV');
        setLoading(false);
      }
    };

    if (selectedCVId) {
      fetchCV();
    } else {
      setSelectedCV(null);
    }
  }, [selectedCVId]);

  const fetchUserCVs = async () => {
    if (!user) return;

    try {
      logger.log('Fetching user CVs', { userId: user.id });
      const { data, error: fetchError } = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      logger.log('CVs fetched successfully', { count: data?.length });
      setCvs(data || []);
    } catch (err) {
      logger.error('Error fetching CVs', err);
      setError(t('cv.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (cv: CV) => {
    try {
      const { error: updateError } = await supabase
        .from('cvs')
        .update({ is_favorite: !cv.is_favorite })
        .eq('id', cv.id);

      if (updateError) throw updateError;

      setCvs(prevCvs => prevCvs.map(c => 
        c.id === cv.id ? { ...c, is_favorite: !c.is_favorite } : c
      ).sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));

      setSuccess(t('cv.success.favoriteUpdated'));
    } catch (err) {
      setError(t('cv.errors.favoriteUpdateFailed'));
    }
  };

  const handleDelete = async (cv: CV) => {
    if (!confirm(t('cv.confirmDelete'))) return;

    try {
      logger.log('Deleting CV', { cvId: cv.id });
      setLoading(true);

      const { error: storageError } = await supabase.storage
        .from('cvs')
        .remove([cv.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('cvs')
        .delete()
        .eq('id', cv.id);

      if (dbError) throw dbError;

      logger.log('CV deleted successfully');
      setCvs(prevCvs => prevCvs.filter(c => c.id !== cv.id));
      setSelectedCV(null);
      setEditMode(false);
      setSuccess(t('cv.success.deleted'));
    } catch (err) {
      logger.error('Error deleting CV', err);
      setError(t('cv.errors.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const selectCV = async (cv: CV) => {
    try {
      setLoading(true);
      setError(null);
      
      logger.log('Selecting CV', { cvId: cv.id });
      
      // Set the CV immediately for better UX
      setSelectedCV(cv);
      setEditMode(false);
      setEditedData(null);
      
      // Try to fetch raw data for large CVs first
      try {
        logger.log('Fetching raw CV data', { cvId: cv.id });
        const rawData = await getRawCV(cv.id);
        
        if (rawData && rawData.raw_content) {
          logger.log('Received raw CV data', { 
            cvId: cv.id, 
            contentSize: rawData.raw_content.length
          });
          
          // Update the CV with the raw content
          cv.content = rawData.raw_content;
          
          // If there's extracted data, add it
          if (rawData.extracted) {
            if (!cv.parsed_data) {
              cv.parsed_data = {};
            }
            
            // Fill in any missing sections with the extracted data
            if (rawData.extracted.personal && !cv.parsed_data.personal) {
              cv.parsed_data.personal = rawData.extracted.personal;
            }
            
            if (rawData.extracted.summary && !cv.parsed_data.summary) {
              cv.parsed_data.summary = rawData.extracted.summary;
            }
            
            // Mark the CV as using raw data
            cv.using_raw_data = true;
            cv.available_sections = rawData.extracted.available_sections;
          }
          
          // Mark large CVs
          if (rawData.raw_content.length > 30000) {
            cv.is_large_cv = true;
            cv.warning_message = t('cv.warnings.largeCV');
          }
          
          // Update the CV with the raw data
          setSelectedCV({...cv});
          setLoading(false);
          return;
        }
      } catch (rawErr) {
        logger.warn('Could not fetch raw CV data, falling back to detailed view', rawErr);
        // Continue with detailed view as fallback
      }
      
      // Then try to fetch enhanced data in the background
      logger.log('Fetching detailed CV data', { cvId: cv.id });
      
      try {
        // Use the API endpoint with a timeout to prevent hanging
        const fetchPromise = getCV(cv.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 5000)
        );
        
        // Race the fetch against a timeout
        const detailedData = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (detailedData) {
          logger.log('Received detailed CV data', { cvId: cv.id });
          
          // If the CV has text_content from the detailed view, update the local CV object
          if (detailedData.text_content && !cv.content) {
            cv.content = detailedData.text_content;
          }
          
          // If there's section metadata, add it to the CV
          if (detailedData.section_metrics) {
            cv.section_metrics = detailedData.section_metrics;
          }
          
          // Add extra metadata
          cv.is_large_cv = detailedData.metrics?.content_size > 50000 || 
                         detailedData.metrics?.parsed_data_size > 50000;
          if (cv.is_large_cv) {
            cv.warning_message = t('cv.warnings.largeCV');
          }
          
          // Update the CV with the enhanced data
          setSelectedCV({...cv});
        }
      } catch (fetchErr) {
        // Just log the error but don't show to user since we already have basic CV data
        logger.warn('Could not fetch detailed CV data', fetchErr);
        // Continue with the basic CV data
      }
    } catch (err) {
      logger.error('Error selecting CV', err);
      setError(t('cv.errors.loadDetailsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cv: CV) => {
    const data = viewLanguage === 'english' ? cv.parsed_data_english : cv.parsed_data;
    if (!data) {
      setError(t('cv.errors.noData'));
      return;
    }
    
    const initialData = JSON.parse(JSON.stringify(data));
    setEditedData(initialData);
    setEditHistory([initialData]);
    setHistoryIndex(0);
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!selectedCV || !editedData) return;

    try {
      setSaving(true);
      logger.log('Saving CV changes', { cvId: selectedCV.id });

      const updateData = viewLanguage === 'english' 
        ? { parsed_data_english: editedData }
        : { parsed_data: editedData };

      const { error } = await supabase
        .from('cvs')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCV.id);

      if (error) throw error;

      logger.log('CV updated successfully');
      setSelectedCV(prev => prev ? {
        ...prev,
        ...(viewLanguage === 'english' 
          ? { parsed_data_english: editedData }
          : { parsed_data: editedData }),
        updated_at: new Date().toISOString()
      } : null);
      
      setCvs(prevCvs => prevCvs.map(cv => 
        cv.id === selectedCV.id 
          ? {
              ...cv,
              ...(viewLanguage === 'english' 
                ? { parsed_data_english: editedData }
                : { parsed_data: editedData }),
              updated_at: new Date().toISOString()
            }
          : cv
      ));

      setEditMode(false);
      setSuccess(t('cv.success.updated'));
    } catch (err) {
      logger.error('Error saving CV', err);
      setError(t('cv.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (editMode && editedData) {
      const confirmed = window.confirm(t('cv.confirmDiscard'));
      if (!confirmed) return;
    }
    setEditMode(false);
    setEditedData(null);
    setEditHistory([]);
    setHistoryIndex(-1);
  };

  const handleUploadNew = () => {
    logger.log('Navigating to CV upload');
    navigate('/import');
  };

  const updateField = (path: string[], value: any) => {
    setEditedData(prevData => {
      const newData = { ...prevData };
      let current = newData;
      
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }
      
      current[path[path.length - 1]] = value;

      const newHistory = editHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      return newData;
    });
  };

  const addArrayItem = (path: string[], template: any) => {
    setEditedData(prevData => {
      const newData = { ...prevData };
      let current = newData;
      
      for (let i = 0; i < path.length; i++) {
        if (!current[path[i]]) {
          current[path[i]] = i === path.length - 1 ? [] : {};
        }
        if (i === path.length - 1) {
          current[path[i]] = [...current[path[i]], template];
        } else {
          current = current[path[i]];
        }
      }

      const newHistory = editHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return newData;
    });
  };

  const removeArrayItem = (path: string[], index: number) => {
    setEditedData(prevData => {
      const newData = { ...prevData };
      let current = newData;
      
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) break;
        current = current[path[i]];
      }
      
      if (Array.isArray(current[path[path.length - 1]])) {
        current[path[path.length - 1]] = current[path[path.length - 1]].filter((_: any, i: number) => i !== index);
      }

      const newHistory = editHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return newData;
    });
  };

  const updateArrayItem = (path: string[], index: number, field: string, value: any) => {
    setEditedData(prevData => {
      const newData = { ...prevData };
      let current = newData;
      
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) break;
        current = current[path[i]];
      }
      
      if (Array.isArray(current[path[path.length - 1]])) {
        current[path[path.length - 1]][index][field] = value;
      }

      const newHistory = editHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      setEditHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      
      return newData;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setEditedData(JSON.parse(JSON.stringify(editHistory[historyIndex - 1])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < editHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setEditedData(JSON.parse(JSON.stringify(editHistory[historyIndex + 1])));
    }
  };

  const filteredCVs = cvs.filter(cv => 
    cv.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cv.parsed_data?.personal?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDebugInfo = (cvId: string) => {
    // Open the backend debug endpoint directly
    window.open(`/api/cv-debug/${cvId}`, '_blank');
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.required')}</h2>
        <p className="text-gray-600">{t('auth.signInToAccess')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg flex items-center">
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (cvs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('cv.noCvs.title')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('cv.noCvs.description')}
        </p>
        <button
          onClick={handleUploadNew}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          {t('cv.noCvs.uploadButton')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('cv.edit.title')}</h2>
          <div className="flex space-x-4">
            {selectedCV && editMode && (
              <>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0 || saving}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('cv.edit.undo')}
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= editHistory.length - 1 || saving}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {t('cv.edit.redo')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5 mr-2" />
                  )}
                  {t('cv.edit.save')}
                </button>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <X className="h-5 w-5 mr-2" />
                  {t('cv.edit.cancel')}
                </button>
              </>
            )}
            <button
              onClick={handleUploadNew}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              {t('cv.edit.uploadNew')}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('cv.edit.search')}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {success && (
          <div className="mt-4 bg-green-50 p-4 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-green-700">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-500 hover:text-green-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4 space-y-4">
          <AnimatePresence>
            {filteredCVs.map((cv) => (
              <motion.div
                key={cv.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  selectedCV?.id === cv.id
                    ? 'bg-indigo-50 border-2 border-indigo-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
                onClick={() => selectCV(cv)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-indigo-600 mr-2" />
                    <div>
                      <h3 className="font-medium text-gray-900 truncate max-w-[150px]">
                        {cv.filename}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(cv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(cv);
                      }}
                      className={`transition-colors ${
                        cv.is_favorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                      }`}
                    >
                      <Star className="h-4 w-4" fill={cv.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCV(cv);
                        handleEdit(cv);
                      }}
                      className="text-gray-400 hover:text-indigo-500 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(cv);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {cv.id === selectedCV?.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDebugInfo(cv.id);
                        }}
                        className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                        title="Debug CV information"
                      >
                        Debug
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-3">
          {selectedCV ? (
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {selectedCV.parsed_data_english && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setViewLanguage('original')}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${
                            viewLanguage === 'original'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {t('cv.languages.original')}
                        </button>
                        <button
                          onClick={() => setViewLanguage('english')}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${
                            viewLanguage === 'english'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {t('cv.languages.english')}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                    >
                      {showPreview ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          {t('cv.edit.hidePreview')}
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          {t('cv.edit.showPreview')}
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {/* Handle copy */}}
                      className="flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {t('cv.edit.copy')}
                    </button>
                    <button
                      onClick={() => {/* Handle download */}}
                      className="flex items-center px-3 py-1 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {t('cv.edit.download')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {selectedCV?.is_large_cv && selectedCV?.warning_message && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('cv.warnings.largeCV')}</p>
                      <p className="text-sm mt-1">{t('cv.warnings.largeCVDescription')}</p>
                    </div>
                  </div>
                )}
                {selectedCV?.using_raw_data && (
                  <div className="mt-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 flex items-start">
                    <ExternalLink className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{t('cv.rawDataMode')}</p>
                      <p className="text-sm mt-1">{t('cv.rawDataDescription')}</p>
                      {selectedCV.available_sections && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">{t('cv.availableSections')}:</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedCV.available_sections.map((section: string) => (
                              <span key={section} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {section}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedCV && !editMode && (
                  <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-700">
                        {t('cv.viewMode')}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setViewMode('structured')}
                          className={`px-3 py-1.5 rounded text-sm font-medium ${
                            viewMode === 'structured' 
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {t('cv.viewStructured')}
                        </button>
                        <button
                          onClick={() => setViewMode('raw')}
                          className={`px-3 py-1.5 rounded text-sm font-medium ${
                            viewMode === 'raw' 
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                            : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          {t('cv.viewRaw')}
                        </button>

                      </div>
                    </div>
                  </div>
                )}
                {selectedCV && !editMode && viewMode === 'raw' && selectedCV.content && (
                  <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">{t('cv.rawContent')}</h2>
                    <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded border border-gray-200 max-h-[800px] overflow-y-auto">
                      {selectedCV.content || 'No content available'}
                    </div>
                  </div>
                )}
                {selectedCV && !editMode && viewMode === 'structured' && (
                  <ParsedCV 
                    cv={selectedCV} 
                    language={viewLanguage}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('cv.edit.select')}
              </h3>
              <p className="text-gray-600">
                {t('cv.edit.selectDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CVEdit;
