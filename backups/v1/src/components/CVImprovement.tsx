import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Wand2, FileText, Loader2, AlertCircle, 
  Save, X, PlusCircle, MinusCircle, Star, Languages,
  Download, Eye, EyeOff, Copy, CheckCircle, ArrowRight,
  History, RotateCcw, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createComponentLogger } from '../lib/logger';
import { improveCV } from '../lib/gpt';
import type { CV } from '../types';
import LoadingScreen from './LoadingScreen';
import ErrorMessage from './ErrorMessage';
import TransitionWrapper from './TransitionWrapper';
import ProgressBar from './ProgressBar';
import Testimonials from './Testimonials';

const logger = createComponentLogger('CVImprovement');

const IMPROVEMENT_STEPS = ['Analyze', 'Enhance', 'Translate', 'Save'];

const CVImprovement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [loading, setLoading] = useState(true);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [options, setOptions] = useState({
    style: 'formal',
    focusArea: 'experience',
    additionalInstructions: '',
    targetLanguage: 'original'
  });

  useEffect(() => {
    fetchUserCVs();
  }, [user]);

  const updateProgress = (step: number, subProgress: number = 0) => {
    const baseProgress = (step / IMPROVEMENT_STEPS.length) * 100;
    const stepProgress = (subProgress / 100) * (100 / IMPROVEMENT_STEPS.length);
    setProgress(Math.min(baseProgress + stepProgress, 100));
    setCurrentStep(step);
  };

  const fetchUserCVs = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCvs(data || []);
    } catch (err) {
      setError(t('errors.loadCvs'));
    } finally {
      setLoading(false);
    }
  };

  const handleImprovement = async () => {
    if (!selectedCV) return;

    setImproving(true);
    setError(null);
    setSuccess(null);
    setProgress(0);
    setCurrentStep(0);

    try {
      // Step 1: Analyze
      setProcessingStage(t('cv.improve.analyzing'));
      updateProgress(0, 50);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate analysis
      updateProgress(0, 100);

      // Step 2: Enhance
      setProcessingStage(t('cv.improve.enhancing'));
      updateProgress(1, 50);
      const improved = await improveCV(
        selectedCV.parsed_data,
        options.style,
        options.focusArea,
        options.additionalInstructions,
        'original'
      );
      updateProgress(1, 100);

      // Step 3: Translate
      setProcessingStage(t('cv.improve.translating'));
      updateProgress(2, 50);
      const improvedEnglish = await improveCV(
        selectedCV.parsed_data,
        options.style,
        options.focusArea,
        options.additionalInstructions,
        'en'
      );
      updateProgress(2, 100);

      // Step 4: Save
      setProcessingStage(t('cv.improve.saving'));
      updateProgress(3, 50);
      const { error: updateError } = await supabase
        .from('cvs')
        .update({
          parsed_data: improved,
          parsed_data_english: improvedEnglish,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCV.id);

      if (updateError) throw updateError;

      // Update local state
      setSelectedCV({
        ...selectedCV,
        parsed_data: improved,
        parsed_data_english: improvedEnglish,
        updated_at: new Date().toISOString()
      });

      // Update CVs list
      setCvs(prevCvs => prevCvs.map(cv => 
        cv.id === selectedCV.id 
          ? {
              ...cv,
              parsed_data: improved,
              parsed_data_english: improvedEnglish,
              updated_at: new Date().toISOString()
            }
          : cv
      ));

      updateProgress(3, 100);
      setSuccess(t('cv.improve.success'));
    } catch (err) {
      setError(t('cv.improve.error'));
    } finally {
      setImproving(false);
      setProcessingStage('');
    }
  };

  if (loading) {
    return <LoadingScreen message={t('common.loading')} />;
  }

  if (cvs.length === 0) {
    return (
      <TransitionWrapper>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('development.noCvs')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('development.uploadFirst')}
          </p>
        </div>
      </TransitionWrapper>
    );
  }

  return (
    <TransitionWrapper>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold mb-4 flex items-center">
              <Wand2 className="h-8 w-8 mr-3" />
              {t('cv.improve.title')}
            </h1>
            <p className="text-lg opacity-90">
              {t('cv.improve.description')}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - CV Selection & Features */}
          <div className="lg:col-span-1 space-y-6">
            {/* CV Selection */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                {t('cv.improve.selectCv')}
              </h2>
              <div className="space-y-3">
                {cvs.map((cv) => (
                  <motion.div
                    key={cv.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedCV?.id === cv.id
                        ? 'bg-indigo-50 border-2 border-indigo-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    onClick={() => setSelectedCV(cv)}
                  >
                    <div className="flex items-center justify-between">
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
                      {cv.is_favorite && (
                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Star className="h-5 w-5 mr-2 text-indigo-600" />
                {t('cv.improve.features')}
              </h2>
              <div className="space-y-4">
                {[
                  {
                    title: t('cv.improve.features.aiAnalysis'),
                    description: t('cv.improve.features.aiAnalysisDesc')
                  },
                  {
                    title: t('cv.improve.features.multilingual'),
                    description: t('cv.improve.features.multilingualDesc')
                  },
                  {
                    title: t('cv.improve.features.targeted'),
                    description: t('cv.improve.features.targetedDesc')
                  },
                  {
                    title: t('cv.improve.features.atsOptimized'),
                    description: t('cv.improve.features.atsOptimizedDesc')
                  }
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start p-3 rounded-lg bg-gray-50"
                  >
                    <Star className="h-5 w-5 text-indigo-600 mt-1 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900">{feature.title}</h3>
                      <p className="text-sm text-gray-500">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Enhancement Options */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <ErrorMessage
                message={error}
                type="error"
                onDismiss={() => setError(null)}
              />
            )}

            {success && (
              <ErrorMessage
                message={success}
                type="success"
                onDismiss={() => setSuccess(null)}
              />
            )}

            {/* Progress Bar */}
            {improving && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <ProgressBar
                  progress={progress}
                  steps={IMPROVEMENT_STEPS}
                  currentStep={currentStep}
                />
                <div className="mt-4 text-center text-gray-600">
                  {processingStage}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-indigo-600" />
                {t('cv.improve.enhancementOptions')}
              </h2>

              <div className="space-y-6">
                {/* Style Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('cv.improve.options.style')}
                  </label>
                  <select
                    value={options.style}
                    onChange={(e) => setOptions({ ...options, style: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    disabled={improving}
                  >
                    <option value="formal">{t('cv.improve.options.style.formal')}</option>
                    <option value="startup">{t('cv.improve.options.style.startup')}</option>
                    <option value="academic">{t('cv.improve.options.style.academic')}</option>
                    <option value="executive">{t('cv.improve.options.style.executive')}</option>
                  </select>
                </div>

                {/* Focus Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('cv.improve.options.focus')}
                  </label>
                  <select
                    value={options.focusArea}
                    onChange={(e) => setOptions({ ...options, focusArea: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    disabled={improving}
                  >
                    <option value="experience">{t('cv.improve.options.focus.experience')}</option>
                    <option value="education">{t('cv.improve.options.focus.education')}</option>
                    <option value="skills">{t('cv.improve.options.focus.skills')}</option>
                    <option value="leadership">{t('cv.improve.options.focus.leadership')}</option>
                  </select>
                </div>

                {/* Language Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('cv.improve.targetLanguage')}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {['original', 'english'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setOptions({ ...options, targetLanguage: lang })}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          options.targetLanguage === lang
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        disabled={improving}
                      >
                        <Languages className="h-5 w-5 mx-auto mb-2" />
                        <div className="text-sm font-medium capitalize">
                          {t(`cv.improve.${lang}`)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('cv.improve.additionalInstructions')}
                  </label>
                  <textarea
                    value={options.additionalInstructions}
                    onChange={(e) => setOptions({ ...options, additionalInstructions: e.target.value })}
                    placeholder={t('cv.improve.instructionsPlaceholder')}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    rows={4}
                    disabled={improving}
                  />
                </div>

                {/* Enhance Button */}
                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleImprovement}
                    disabled={!selectedCV || improving}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-lg font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {improving ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {t('cv.improve.processing')}
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-5 w-5 mr-2" />
                        {t('cv.improve.enhanceButton')}
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Star className="h-5 w-5 mr-2 text-indigo-600" />
                {t('cv.improve.successStories')}
              </h2>
              <Testimonials />
            </div>
          </div>
        </div>
      </div>
    </TransitionWrapper>
  );
};

export default CVImprovement;