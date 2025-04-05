import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Upload, Sparkles, AlertCircle, 
  Briefcase, CheckCircle, RefreshCw, Lightbulb,
  Award, Loader2, Link, ArrowRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { optimizeProfile } from '../lib/api';
import type { CV } from '../types';
import LoadingScreen from './LoadingScreen';
import ErrorMessage from './ErrorMessage';
import TransitionWrapper from './TransitionWrapper';
import ProgressBar from './ProgressBar';

// Define types for profile optimization
interface BeforeAfterImprovement {
  section: string;
  before: string;
  after: string;
  explanation: string;
}

interface IndustryInsight {
  title: string;
  description: string;
}

interface OptimizationSuggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface KeywordOptimization {
  section: string;
  keywords: string[];
  explanation: string;
}

interface ProfileOptimizationResult {
  improvementSummary: string;
  beforeAfterImprovements: BeforeAfterImprovement[];
  industryInsights: IndustryInsight[];
  optimizationSuggestions: OptimizationSuggestion[];
  keywordOptimizations: KeywordOptimization[];
  overallScore: {
    before: number;
    after: number;
  };
}

const INDUSTRY_OPTIONS = [
  'Software Development',
  'Data Science',
  'Product Management',
  'Digital Marketing',
  'Design/UX',
  'Finance',
  'Healthcare',
  'Education',
  'Sales',
  'Customer Service',
  'Human Resources',
  'Engineering',
  'Manufacturing',
  'Legal',
  'Other'
];

const CAREER_LEVEL_OPTIONS = [
  'Entry Level',
  'Junior',
  'Mid-Level',
  'Senior',
  'Manager',
  'Director',
  'Executive'
];

const TARGET_PLATFORM_OPTIONS = [
  'LinkedIn',
  'Resume/CV',
  'Both'
];

const ProfileOptimizer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<ProfileOptimizationResult | null>(null);
  const [currentView, setCurrentView] = useState<'form' | 'results'>('form');
  const [targetPlatform, setTargetPlatform] = useState('LinkedIn');
  const [industryFocus, setIndustryFocus] = useState('Software Development');
  const [careerLevel, setCareerLevel] = useState('Mid-Level');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchUserCVs();
  }, [user]);

  const fetchUserCVs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCvs(data || []);
    } catch (err) {
      setError(t('errors.loadCvs'));
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeProfile = async () => {
    if (!selectedCV) {
      setError(t('profileOptimizer.selectCv'));
      return;
    }

    setError(null);
    setOptimizing(true);
    setProgress(0);

    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 1000);

      // Call API to optimize profile
      const result = await optimizeProfile(
        selectedCV.id,
        targetPlatform,
        industryFocus, 
        careerLevel
      );
      
      // Complete progress and show results
      clearInterval(progressInterval);
      setProgress(100);
      setOptimizationResult(result);
      setCurrentView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profileOptimizer.optimizationFailed'));
    } finally {
      setOptimizing(false);
    }
  };

  const handleReset = () => {
    setCurrentView('form');
    setOptimizationResult(null);
  };

  const handleSaveOptimizedProfile = async () => {
    if (!optimizationResult || !selectedCV || !user) return;

    try {
      setLoading(true);
      // For now, just save the optimization result in a separate table
      // In a real implementation, we'd also allow the user to create a new CV based on the suggestions
      const { error } = await supabase
        .from('profile_optimizations')
        .insert({
          user_id: user.id,
          cv_id: selectedCV.id,
          target_platform: targetPlatform,
          industry_focus: industryFocus,
          career_level: careerLevel,
          result: optimizationResult,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      // Show success message or feedback to user
      setError(t('profileOptimizer.saveSuccess'));
    } catch (err) {
      setError(t('profileOptimizer.saveFailed'));
    } finally {
      setLoading(false);
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
            {t('profileOptimizer.noCvs')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('profileOptimizer.uploadFirst')}
          </p>
        </div>
      </TransitionWrapper>
    );
  }

  return (
    <TransitionWrapper>
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {currentView === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-indigo-600" />
                  {t('profileOptimizer.title')}
                </h2>
                <p className="text-gray-600 mb-6">
                  {t('profileOptimizer.description')}
                </p>

                {/* CV Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('profileOptimizer.selectCv')}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cvs.map((cv) => (
                      <div
                        key={cv.id}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedCV?.id === cv.id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                        onClick={() => setSelectedCV(cv)}
                      >
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-indigo-600 mr-2" />
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {cv.parsed_data?.personal?.name || cv.filename}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(cv.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Platform */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('profileOptimizer.targetPlatform')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {TARGET_PLATFORM_OPTIONS.map((platform) => (
                      <div
                        key={platform}
                        className={`p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                          targetPlatform === platform
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                        onClick={() => setTargetPlatform(platform)}
                      >
                        {platform}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Industry Focus */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('profileOptimizer.industryFocus')}
                  </label>
                  <select
                    value={industryFocus}
                    onChange={(e) => setIndustryFocus(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {INDUSTRY_OPTIONS.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Career Level */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('profileOptimizer.careerLevel')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {CAREER_LEVEL_OPTIONS.map((level) => (
                      <div
                        key={level}
                        className={`p-3 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                          careerLevel === level
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                        onClick={() => setCareerLevel(level)}
                      >
                        {level}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <ErrorMessage
                    message={error}
                    onDismiss={() => setError(null)}
                  />
                )}

                {/* Action Buttons */}
                <div className="flex justify-end mt-8">
                  <button
                    onClick={handleOptimizeProfile}
                    disabled={!selectedCV || optimizing}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {optimizing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {t('profileOptimizer.optimizing')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        {t('profileOptimizer.optimize')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Bar during analysis */}
              {optimizing && (
                <div className="mt-4">
                  <ProgressBar 
                    progress={progress} 
                    label={t('profileOptimizer.optimizingProgress')} 
                  />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Optimization Results */}
              {optimizationResult && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                      <Sparkles className="mr-2 h-5 w-5 text-indigo-600" />
                      {t('profileOptimizer.optimizationResults')}
                    </h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveOptimizedProfile}
                        className="inline-flex items-center px-4 py-2 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        {t('profileOptimizer.save')}
                      </button>
                      <button
                        onClick={handleReset}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {t('profileOptimizer.newOptimization')}
                      </button>
                    </div>
                  </div>

                  {/* Overall Score */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Award className="h-5 w-5 mr-2 text-indigo-600" />
                      {t('profileOptimizer.overallScore')}
                    </h3>
                    <div className="flex items-center bg-indigo-50 p-4 rounded-lg">
                      <div className="flex-1">
                        <p className="text-gray-700 mb-2">{t('profileOptimizer.before')}</p>
                        <div className="text-3xl font-bold text-indigo-800">
                          {optimizationResult.overallScore.before}/100
                        </div>
                      </div>
                      <ArrowRight className="h-6 w-6 text-indigo-500 mx-6" />
                      <div className="flex-1">
                        <p className="text-gray-700 mb-2">{t('profileOptimizer.after')}</p>
                        <div className="text-3xl font-bold text-green-600">
                          {optimizationResult.overallScore.after}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-green-50 p-4 rounded-lg mb-6">
                    <p className="text-green-800">
                      {optimizationResult.improvementSummary}
                    </p>
                  </div>

                  {/* Before & After Improvements */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <RefreshCw className="h-5 w-5 mr-2 text-indigo-600" />
                      {t('profileOptimizer.beforeAfterImprovements')}
                    </h3>
                    <div className="space-y-6">
                      {optimizationResult.beforeAfterImprovements.map((improvement, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 p-3 border-b border-gray-200">
                            <h4 className="font-medium text-gray-900">{improvement.section}</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                            <div className="p-4 bg-red-50">
                              <div className="text-sm text-gray-600 mb-2">{t('profileOptimizer.before')}</div>
                              <p className="text-red-800 whitespace-pre-wrap">{improvement.before}</p>
                            </div>
                            <div className="p-4 bg-green-50">
                              <div className="text-sm text-gray-600 mb-2">{t('profileOptimizer.after')}</div>
                              <p className="text-green-800 whitespace-pre-wrap">{improvement.after}</p>
                            </div>
                          </div>
                          <div className="p-3 bg-indigo-50 border-t border-gray-200">
                            <p className="text-indigo-700 text-sm">{improvement.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Industry Insights */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Briefcase className="h-5 w-5 mr-2 text-indigo-600" />
                      {t('profileOptimizer.industryInsights')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {optimizationResult.industryInsights.map((insight, index) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                          <h4 className="font-medium text-blue-900 mb-2">{insight.title}</h4>
                          <p className="text-blue-700 text-sm">{insight.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optimization Suggestions */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                      {t('profileOptimizer.optimizationSuggestions')}
                    </h3>
                    <div className="space-y-3">
                      {optimizationResult.optimizationSuggestions.map((suggestion, index) => (
                        <div key={index} className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                          <div className="flex items-center mb-2">
                            <h4 className="font-medium text-amber-900">{suggestion.title}</h4>
                            <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                              suggestion.priority === 'high' 
                                ? 'bg-red-100 text-red-800' 
                                : suggestion.priority === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                              {suggestion.priority} {t('profileOptimizer.priority')}
                            </span>
                          </div>
                          <p className="text-amber-700 text-sm">{suggestion.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Keyword Optimizations */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                      {t('profileOptimizer.keywordOptimizations')}
                    </h3>
                    <div className="space-y-4">
                      {optimizationResult.keywordOptimizations.map((keyword, index) => (
                        <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-100">
                          <h4 className="font-medium text-green-900 mb-2">{keyword.section}</h4>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {keyword.keywords.map((word, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                          <p className="text-green-700 text-sm">{keyword.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TransitionWrapper>
  );
};

export default ProfileOptimizer; 