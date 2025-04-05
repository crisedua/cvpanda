import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Edit2, Trash2, Plus, Loader2, AlertCircle, 
  Save, X, PlusCircle, MinusCircle, Star, Languages,
  Download, Eye, EyeOff, Copy, CheckCircle, ArrowRight,
  History, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createComponentLogger } from '../lib/logger';
import ParsedCV from './ParsedCV';
import type { CV } from '../types';

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

  useEffect(() => {
    if (user) {
      fetchUserCVs();
    }
  }, [user]);

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
                onClick={() => {
                  setSelectedCV(cv);
                  setEditMode(false);
                  setEditedData(null);
                }}
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
                {editMode ? (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">{t('cv.edit.personal')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          value={editedData.personal?.name || ''}
                          onChange={(e) => updateField(['personal', 'name'], e.target.value)}
                          placeholder={t('cv.edit.fullName')}
                          className="border rounded-md p-2"
                        />
                        <input
                          type="text"
                          value={editedData.personal?.title || ''}
                          onChange={(e) => updateField(['personal', 'title'], e.target.value)}
                          placeholder={t('cv.edit.professionalTitle')}
                          className="border rounded-md p-2"
                        />
                        <input
                          type="email"
                          value={editedData.personal?.email || ''}
                          onChange={(e) => updateField(['personal', 'email'], e.target.value)}
                          placeholder={t('cv.edit.email')}
                          className="border rounded-md p-2"
                        />
                        <input
                          type="tel"
                          value={editedData.personal?.phone || ''}
                          onChange={(e) => updateField(['personal', 'phone'], e.target.value)}
                          placeholder={t('cv.edit.phone')}
                          className="border rounded-md p-2"
                        />
                        <input
                          type="url"
                          value={editedData.personal?.linkedin || ''}
                          onChange={(e) => updateField(['personal', 'linkedin'], e.target.value)}
                          placeholder={t('cv.edit.linkedin')}
                          className="border rounded-md p-2"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-lg font-medium">{t('cv.edit.summary')}</h4>
                      <textarea
                        value={editedData.summary || ''}
                        onChange={(e) => updateField(['summary'], e.target.value)}
                        placeholder={t('cv.edit.summaryPlaceholder')}
                        className="w-full h-32 border rounded-md p-2"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-lg font-medium">{t('cv.edit.experience')}</h4>
                        <button
                          onClick={() => addArrayItem(['experience'], {
                            company: '',
                            position: '',
                            location: '',
                            duration: '',
                            responsibilities: [],
                            achievements: []
                          })}
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          <PlusCircle className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="space-y-6">
                        {editedData.experience?.map((exp: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4 relative">
                            <button
                              onClick={() => removeArrayItem(['experience'], index)}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                            >
                              <MinusCircle className="h-5 w-5" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <input
                                type="text"
                                value={exp.company || ''}
                                onChange={(e) => updateArrayItem(['experience'], index, 'company', e.target.value)}
                                placeholder={t('cv.edit.company')}
                                className="border rounded-md p-2"
                              />
                              <input
                                type="text"
                                value={exp.position || ''}
                                onChange={(e) => updateArrayItem(['experience'], index, 'position', e.target.value)}
                                placeholder={t('cv.edit.position')}
                                className="border rounded-md p-2"
                              />
                              <input
                                type="text"
                                value={exp.location || ''}
                                onChange={(e) => updateArrayItem(['experience'], index, 'location', e.target.value)}
                                placeholder={t('cv.edit.location')}
                                className="border rounded-md p-2"
                              />
                              <input
                                type="text"
                                value={exp.duration || ''}
                                onChange={(e) => updateArrayItem(['experience'], index, 'duration', e.target.value)}
                                placeholder={t('cv.edit.duration')}
                                className="border rounded-md p-2"
                              />
                            </div>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {t('cv.edit.responsibilities')}
                                </label>
                                <textarea
                                  value={exp.responsibilities?.join('\n') || ''}
                                  onChange={(e) => updateArrayItem(['experience'], index, 'responsibilities', e.target.value.split('\n').filter(Boolean))}
                                  placeholder={t('cv.edit.responsibilitiesPlaceholder')}
                                  className="w-full h-32 border rounded-md p-2"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {t('cv.edit.achievements')}
                                </label>
                                <textarea
                                  value={exp.achievements?.join('\n') || ''}
                                  onChange={(e) => updateArrayItem(['experience'], index, 
                                  'achievements', e.target.value.split('\n').filter(Boolean))}
                                  placeholder={t('cv.edit.achievementsPlaceholder')}
                                  className="w-full h-32 border rounded-md p-2"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-lg font-medium">{t('cv.edit.education')}</h4>
                        <button
                          onClick={() => addArrayItem(['education'], {
                            institution: '',
                            degree: '',
                            year: '',
                            honors: []
                          })}
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          <PlusCircle className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="space-y-6">
                        {editedData.education?.map((edu: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4 relative">
                            <button
                              onClick={() => removeArrayItem(['education'], index)}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                            >
                              <MinusCircle className="h-5 w-5" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <input
                                type="text"
                                value={edu.institution || ''}
                                onChange={(e) => updateArrayItem(['education'], index, 'institution', e.target.value)}
                                placeholder={t('cv.edit.institution')}
                                className="border rounded-md p-2"
                              />
                              <input
                                type="text"
                                value={edu.degree || ''}
                                onChange={(e) => updateArrayItem(['education'], index, 'degree', e.target.value)}
                                placeholder={t('cv.edit.degree')}
                                className="border rounded-md p-2"
                              />
                              <input
                                type="text"
                                value={edu.year || ''}
                                onChange={(e) => updateArrayItem(['education'], index, 'year', e.target.value)}
                                placeholder={t('cv.edit.year')}
                                className="border rounded-md p-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t('cv.edit.honors')}
                              </label>
                              <textarea
                                value={edu.honors?.join('\n') || ''}
                                onChange={(e) => updateArrayItem(['education'], index, 'honors', e.target.value.split('\n').filter(Boolean))}
                                placeholder={t('cv.edit.honorsPlaceholder')}
                                className="w-full h-32 border rounded-md p-2"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">{t('cv.edit.skills')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.technicalSkills')}
                          </label>
                          <textarea
                            value={editedData.skills?.technical?.join('\n') || ''}
                            onChange={(e) => updateField(['skills', 'technical'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.technicalSkillsPlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.softSkills')}
                          </label>
                          <textarea
                            value={editedData.skills?.soft?.join('\n') || ''}
                            onChange={(e) => updateField(['skills', 'soft'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.softSkillsPlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.industryKnowledge')}
                          </label>
                          <textarea
                            value={editedData.skills?.industry?.join('\n') || ''}
                            onChange={(e) => updateField(['skills', 'industry'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.industryKnowledgePlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-lg font-medium">{t('cv.edit.additional')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.certifications')}
                          </label>
                          <textarea
                            value={editedData.additional?.certifications?.join('\n') || ''}
                            onChange={(e) => updateField(['additional', 'certifications'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.certificationsPlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.courses')}
                          </label>
                          <textarea
                            value={editedData.additional?.courses?.join('\n') || ''}
                            onChange={(e) => updateField(['additional', 'courses'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.coursesPlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.projects')}
                          </label>
                          <textarea
                            value={editedData.additional?.projects?.join('\n') || ''}
                            onChange={(e) => updateField(['additional', 'projects'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.projectsPlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('cv.edit.publications')}
                          </label>
                          <textarea
                            value={editedData.additional?.publications?.join('\n') || ''}
                            onChange={(e) => updateField(['additional', 'publications'], e.target.value.split('\n').filter(Boolean))}
                            placeholder={t('cv.edit.publicationsPlaceholder')}
                            className="w-full h-32 border rounded-md p-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  showPreview && <ParsedCV cv={selectedCV} language={viewLanguage} />
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