import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FileText, Upload, Search, AlertCircle, 
  CheckCircle, XCircle, Target, Book, Award,
  Lightbulb, ArrowRight, Loader2, Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { analyzeSkillGaps } from '../lib/api';
import type { CV } from '../types';
import LoadingScreen from './LoadingScreen';
import ErrorMessage from './ErrorMessage';
import TransitionWrapper from './TransitionWrapper';
import ProgressBar from './ProgressBar';

// Define types for skill gap analysis
interface MatchedSkill {
  name: string;
  relevance: 'high' | 'medium' | 'low';
  description: string;
}

interface MissingSkill {
  name: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  description: string;
}

interface Recommendation {
  type: 'course' | 'certification' | 'project' | 'experience';
  name: string;
  provider: string;
  duration: string;
  description: string;
  url: string;
}

interface KeywordOptimization {
  original: string;
  suggested: string;
  reason: string;
}

interface SkillGapAnalysisResult {
  matchPercentage: number;
  matchedSkills: MatchedSkill[];
  missingSkills: MissingSkill[];
  recommendations: Recommendation[];
  keywordOptimization: KeywordOptimization[];
  summary: string;
}

const SkillGapAnalyzer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SkillGapAnalysisResult | null>(null);
  const [currentView, setCurrentView] = useState<'form' | 'results'>('form');
  const [savedJobs, setSavedJobs] = useState<{id: string, title: string, description: string}[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchUserCVs();
    fetchSavedJobs();
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

  const fetchSavedJobs = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('saved_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setSavedJobs(data || []);
    } catch (err) {
      console.error('Error fetching saved jobs:', err);
      // Non-critical error, don't show to user
    }
  };

  const handleSelectSavedJob = (jobId: string) => {
    const job = savedJobs.find(j => j.id === jobId);
    if (job) {
      setJobTitle(job.title);
      setJobDescription(job.description);
    }
  };

  const handleAnalyzeSkillGaps = async () => {
    if (!selectedCV || !jobDescription.trim()) {
      setError(t('skillGap.missingFields'));
      return;
    }

    setError(null);
    setAnalyzing(true);
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

      // Call API to analyze skill gaps
      const result = await analyzeSkillGaps(selectedCV.id, jobDescription);
      
      // Complete progress and show results
      clearInterval(progressInterval);
      setProgress(100);
      setAnalysisResult(result);
      setCurrentView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('skillGap.analysisFailed'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setCurrentView('form');
    setJobDescription('');
    setJobTitle('');
    setAnalysisResult(null);
  };

  const handleSaveJob = async () => {
    if (!user || !jobTitle || !jobDescription) return;

    try {
      // Check if already saved
      const existingJob = savedJobs.find(
        job => job.title === jobTitle && job.description === jobDescription
      );

      if (existingJob) {
        return; // Already saved
      }

      const { error } = await supabase
        .from('saved_jobs')
        .insert({
          user_id: user.id,
          title: jobTitle,
          description: jobDescription,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      // Refetch saved jobs
      fetchSavedJobs();
    } catch (err) {
      console.error('Error saving job:', err);
      // Non-critical error, don't show to user
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
            {t('skillGap.noCvs')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('skillGap.uploadFirst')}
          </p>
        </div>
      </TransitionWrapper>
    );
  }

  return (
    <TransitionWrapper>
      <div className="max-w-5xl mx-auto" data-component="SkillGapAnalyzer">
        {loading ? (
          <LoadingScreen />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('skillGap.title')}</h1>
              <p className="text-gray-600 mb-6">{t('skillGap.description')}</p>

              {/* CV Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('skillGap.selectCV')}
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

              {/* Job Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('skillGap.jobTitle')}
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={t('skillGap.jobTitlePlaceholder')}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              {/* Job Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('skillGap.enterJobDescription')}
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder={t('skillGap.jobDescriptionPlaceholder')}
                  className="w-full h-48 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              {/* Saved Jobs */}
              {savedJobs.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('skillGap.savedJobs')}
                  </label>
                  <select
                    onChange={(e) => handleSelectSavedJob(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {t('skillGap.selectSavedJob')}
                    </option>
                    {savedJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-between mt-8">
                <button
                  onClick={handleSaveJob}
                  disabled={!jobTitle || !jobDescription || analyzing}
                  className="inline-flex items-center px-4 py-2 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('skillGap.saveJob')}
                </button>
                <button
                  onClick={handleAnalyzeSkillGaps}
                  disabled={!selectedCV || !jobDescription || analyzing}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {t('skillGap.analyzing')}
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      {t('skillGap.analyze')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Bar during analysis */}
            {analyzing && (
              <div className="mt-4">
                <ProgressBar 
                  progress={progress} 
                  label={t('skillGap.analyzingProgress')} 
                />
              </div>
            )}

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
                  {/* Analysis Results */}
                  {analysisResult && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                          <Target className="mr-2 h-5 w-5 text-indigo-600" />
                          {t('skillGap.analysisResults')}
                        </h2>
                        <button
                          onClick={handleReset}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          {t('skillGap.newAnalysis')}
                        </button>
                      </div>

                      {/* Match Percentage */}
                      <div className="mb-6">
                        <div className="flex items-center mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {t('skillGap.matchPercentage')}
                          </h3>
                          <div className="ml-auto text-2xl font-bold">
                            {analysisResult.matchPercentage}%
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-indigo-600 h-2.5 rounded-full"
                            style={{ width: `${analysisResult.matchPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                        <p className="text-indigo-700">{analysisResult.summary}</p>
                      </div>

                      {/* Matched & Missing Skills */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Matched Skills */}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                            {t('skillGap.matchedSkills')}
                          </h3>
                          <div className="space-y-3">
                            {analysisResult.matchedSkills.map((skill, index) => (
                              <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-100">
                                <div className="flex items-center">
                                  <span className="text-green-800 font-medium">{skill.name}</span>
                                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                                    skill.relevance === 'high' 
                                      ? 'bg-green-100 text-green-800' 
                                      : skill.relevance === 'medium'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {skill.relevance}
                                  </span>
                                </div>
                                <p className="text-sm text-green-700 mt-1">{skill.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Missing Skills */}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <XCircle className="h-5 w-5 mr-2 text-red-500" />
                            {t('skillGap.missingSkills')}
                          </h3>
                          <div className="space-y-3">
                            {analysisResult.missingSkills.map((skill, index) => (
                              <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center">
                                  <span className="text-red-800 font-medium">{skill.name}</span>
                                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                                    skill.importance === 'critical' 
                                      ? 'bg-red-100 text-red-800' 
                                      : skill.importance === 'important'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {skill.importance}
                                  </span>
                                </div>
                                <p className="text-sm text-red-700 mt-1">{skill.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div className="mb-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Book className="h-5 w-5 mr-2 text-indigo-600" />
                          {t('skillGap.recommendations')}
                        </h3>
                        <div className="space-y-4">
                          {analysisResult.recommendations.map((rec, index) => (
                            <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <div className="flex items-start">
                                <div className={`p-2 rounded-full mr-3 ${
                                  rec.type === 'course' 
                                    ? 'bg-blue-100' 
                                    : rec.type === 'certification'
                                      ? 'bg-purple-100'
                                      : rec.type === 'project'
                                        ? 'bg-green-100'
                                        : 'bg-yellow-100'
                                }`}>
                                  {rec.type === 'course' && <Book className="h-5 w-5 text-blue-600" />}
                                  {rec.type === 'certification' && <Award className="h-5 w-5 text-purple-600" />}
                                  {rec.type === 'project' && <Lightbulb className="h-5 w-5 text-green-600" />}
                                  {rec.type === 'experience' && <Target className="h-5 w-5 text-yellow-600" />}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{rec.name}</h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {rec.provider} • {rec.duration}
                                  </p>
                                  <p className="mt-2 text-sm text-gray-700">{rec.description}</p>
                                  {rec.url && (
                                    <a
                                      href={rec.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                                    >
                                      <Link className="h-4 w-4 mr-1" />
                                      {t('skillGap.learnMore')}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Keyword Optimizations */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                          {t('skillGap.keywordOptimizations')}
                        </h3>
                        <div className="space-y-3">
                          {analysisResult.keywordOptimization.map((keyword, index) => (
                            <div key={index} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                              <div className="flex items-center">
                                <span className="text-amber-800">{keyword.original}</span>
                                <ArrowRight className="h-4 w-4 mx-2 text-amber-500" />
                                <span className="text-amber-800 font-medium">{keyword.suggested}</span>
                              </div>
                              <p className="text-sm text-amber-700 mt-1">{keyword.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
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
                  {/* Analysis Results */}
                  {analysisResult && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                          <Target className="mr-2 h-5 w-5 text-indigo-600" />
                          {t('skillGap.analysisResults')}
                        </h2>
                        <button
                          onClick={handleReset}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          {t('skillGap.newAnalysis')}
                        </button>
                      </div>

                      {/* Match Percentage */}
                      <div className="mb-6">
                        <div className="flex items-center mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {t('skillGap.matchPercentage')}
                          </h3>
                          <div className="ml-auto text-2xl font-bold">
                            {analysisResult.matchPercentage}%
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-indigo-600 h-2.5 rounded-full"
                            style={{ width: `${analysisResult.matchPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                        <p className="text-indigo-700">{analysisResult.summary}</p>
                      </div>

                      {/* Matched & Missing Skills */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Matched Skills */}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                            {t('skillGap.matchedSkills')}
                          </h3>
                          <div className="space-y-3">
                            {analysisResult.matchedSkills.map((skill, index) => (
                              <div key={index} className="p-3 bg-green-50 rounded-lg border border-green-100">
                                <div className="flex items-center">
                                  <span className="text-green-800 font-medium">{skill.name}</span>
                                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                                    skill.relevance === 'high' 
                                      ? 'bg-green-100 text-green-800' 
                                      : skill.relevance === 'medium'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {skill.relevance}
                                  </span>
                                </div>
                                <p className="text-sm text-green-700 mt-1">{skill.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Missing Skills */}
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <XCircle className="h-5 w-5 mr-2 text-red-500" />
                            {t('skillGap.missingSkills')}
                          </h3>
                          <div className="space-y-3">
                            {analysisResult.missingSkills.map((skill, index) => (
                              <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center">
                                  <span className="text-red-800 font-medium">{skill.name}</span>
                                  <span className={`ml-auto px-2 py-1 text-xs rounded-full ${
                                    skill.importance === 'critical' 
                                      ? 'bg-red-100 text-red-800' 
                                      : skill.importance === 'important'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {skill.importance}
                                  </span>
                                </div>
                                <p className="text-sm text-red-700 mt-1">{skill.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div className="mb-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Book className="h-5 w-5 mr-2 text-indigo-600" />
                          {t('skillGap.recommendations')}
                        </h3>
                        <div className="space-y-4">
                          {analysisResult.recommendations.map((rec, index) => (
                            <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                              <div className="flex items-start">
                                <div className={`p-2 rounded-full mr-3 ${
                                  rec.type === 'course' 
                                    ? 'bg-blue-100' 
                                    : rec.type === 'certification'
                                      ? 'bg-purple-100'
                                      : rec.type === 'project'
                                        ? 'bg-green-100'
                                        : 'bg-yellow-100'
                                }`}>
                                  {rec.type === 'course' && <Book className="h-5 w-5 text-blue-600" />}
                                  {rec.type === 'certification' && <Award className="h-5 w-5 text-purple-600" />}
                                  {rec.type === 'project' && <Lightbulb className="h-5 w-5 text-green-600" />}
                                  {rec.type === 'experience' && <Target className="h-5 w-5 text-yellow-600" />}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{rec.name}</h4>
                                  <p className="text-sm text-gray-600 mt-1">
                                    {rec.provider} • {rec.duration}
                                  </p>
                                  <p className="mt-2 text-sm text-gray-700">{rec.description}</p>
                                  {rec.url && (
                                    <a
                                      href={rec.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                                    >
                                      <Link className="h-4 w-4 mr-1" />
                                      {t('skillGap.learnMore')}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Keyword Optimizations */}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                          <Lightbulb className="h-5 w-5 mr-2 text-amber-500" />
                          {t('skillGap.keywordOptimizations')}
                        </h3>
                        <div className="space-y-3">
                          {analysisResult.keywordOptimization.map((keyword, index) => (
                            <div key={index} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                              <div className="flex items-center">
                                <span className="text-amber-800">{keyword.original}</span>
                                <ArrowRight className="h-4 w-4 mx-2 text-amber-500" />
                                <span className="text-amber-800 font-medium">{keyword.suggested}</span>
                              </div>
                              <p className="text-sm text-amber-700 mt-1">{keyword.reason}</p>
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
        )}
      </div>
    </TransitionWrapper>
  );
};

export default SkillGapAnalyzer; 