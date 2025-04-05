import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchUserCVs, optimizeProfile } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from './ProgressBar';
import { CheckCircle, ArrowUp, Lightbulb, TrendingUp, Sparkles, HelpCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3001';

interface CV {
  id: string;
  filename: string;
  parsed_data: any;
  user_id: string;
}

interface OptimizationResult {
  overallScore: {
    before: number;
    after: number;
  };
  summary: string;
  sectionImprovements: {
    title: string;
    before: string;
    after: string;
    reason: string;
  }[];
  keywordOptimizations: {
    keyword: string;
    relevance: number;
    placement: string;
  }[];
  bestPractices: {
    title: string;
    description: string;
  }[];
  industryTrends: {
    trend: string;
    relevance: string;
  }[];
}

export const ProfileOptimizer: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [cvs, setCVs] = useState<CV[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [selectedCV, setSelectedCV] = useState<string>('');
  const [targetPlatform, setTargetPlatform] = useState<'linkedin' | 'cv'>('linkedin');
  const [industryFocus, setIndustryFocus] = useState<string>('');
  const [careerLevel, setCareerLevel] = useState<'entry' | 'mid' | 'senior'>('mid');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCVs = async () => {
      try {
        console.log('Fetching CVs for user:', user?.id);
        const fetchedCVs = await fetchUserCVs(user?.id || '');
        console.log('CVs fetched:', fetchedCVs);
        
        // Check if fetchedCVs is array and has items
        if (Array.isArray(fetchedCVs)) {
          console.log('Number of CVs:', fetchedCVs.length);
          setCVs(fetchedCVs);
          
          if (fetchedCVs.length === 0) {
            console.log('No CVs found for user');
          }
        } else {
          console.error('Fetched CVs is not an array:', fetchedCVs);
          setCVs([]);
        }
      } catch (error) {
        console.error('Error fetching CVs:', error);
        setError(t('profileOptimizer.noCvs'));
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchCVs();
    } else {
      console.error('No user ID available');
      setLoading(false);
    }
  }, [t, user?.id]);

  const handleRefreshCVs = async () => {
    setLoading(true);
    try {
      const fetchedCVs = await fetchUserCVs(user?.id || '');
      console.log('CVs refreshed:', fetchedCVs.length, fetchedCVs);
      setCVs(fetchedCVs);
      setError(null);
    } catch (error) {
      console.error('Error refreshing CVs:', error);
      setError(t('profileOptimizer.noCvs'));
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!selectedCV) {
      setError(t('profileOptimizer.selectCv'));
      return;
    }

    if (!industryFocus) {
      setError('Please specify an industry focus');
      return;
    }

    setOptimizing(true);
    setProgress(0);
    setError(null);

    // Set up progress simulation
    const progressInterval = setInterval(() => {
      setProgress((prevProgress) => {
        const newProgress = prevProgress + Math.random() * 5;
        return newProgress >= 95 ? 95 : newProgress;
      });
    }, 500);

    try {
      console.log('Starting profile optimization for CV:', selectedCV);
      console.log('Using specialized large CV handler for 5-page CV');
      
      // Use the new endpoint for large CVs
      const response = await fetch(`${API_BASE_URL}/api/optimize-large-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCV,
          targetPlatform,
          industryFocus,
          careerLevel
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize profile');
      }
      
      const result = await response.json();
      console.log('Optimization complete. Result:', result);

      setProgress(100);
      setOptimizationResult(result);
    } catch (error) {
      console.error('Error optimizing profile:', error);
      setError(t('profileOptimizer.optimizationFailed'));
    } finally {
      clearInterval(progressInterval);
      setOptimizing(false);
    }
  };

  const handleNewOptimization = () => {
    setOptimizationResult(null);
    setProgress(0);
  };

  const handleSaveOptimization = async () => {
    if (!selectedCV || !optimizationResult) {
      setError("No optimization to save");
      return;
    }
    
    setLoading(true);
    
    try {
      // Add API call to save optimization
      const response = await fetch(`${API_BASE_URL}/api/save-optimization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cvId: selectedCV,
          optimizationResult,
          targetPlatform,
          industryFocus,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save optimization');
      }
      
      setSuccessMessage(t('profileOptimizer.saveSuccess'));
      console.log('Optimization saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving optimization:', error);
      setError(t('profileOptimizer.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4">
        <div className="flex justify-center items-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (cvs.length === 0) {
    return (
      <div className="container mx-auto px-4">
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold mb-2">
            {t('profileOptimizer.noCvs')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('profileOptimizer.uploadFirst')}
          </p>
          <button
            onClick={handleRefreshCVs}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Refrescar CVs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <div className="mt-8 mb-4">
        <h1 className="text-3xl font-bold mb-2">
          {t('profileOptimizer.title')}
        </h1>
        <p className="text-gray-600 mb-6">
          {t('profileOptimizer.description')}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-6 flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          {successMessage}
        </div>
      )}

      {optimizing ? (
        <div className="bg-white rounded-lg shadow-md p-8 my-6">
          <div className="flex flex-col items-center text-center">
            <h3 className="text-xl font-semibold mb-4">
              {t('profileOptimizer.optimizing')}
            </h3>
            <div className="w-full mt-4">
              <ProgressBar progress={progress} />
            </div>
            <p className="text-gray-500 mt-4">
              {t('profileOptimizer.optimizingProgress')}
            </p>
          </div>
        </div>
      ) : optimizationResult ? (
        <div className="mt-6">
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-6">
              {t('profileOptimizer.optimizationResults')}
            </h2>
            
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">
                {t('profileOptimizer.overallScore')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 justify-center">
                <div className="sm:col-span-5">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-center text-gray-700 font-medium mb-2">
                      {t('profileOptimizer.before')}
                    </p>
                    <div className="flex justify-center my-2">
                      {/* Star rating */}
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-xl ${star <= Math.round(optimizationResult.overallScore.before / 20) ? 'text-yellow-400' : 'text-gray-300'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-3xl text-center text-gray-600">
                      {optimizationResult.overallScore.before}/100
                    </p>
                  </div>
                </div>
                <div className="sm:col-span-2 flex items-center justify-center">
                  <ArrowUp className="text-green-500" size={36} />
                </div>
                <div className="sm:col-span-5">
                  <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
                    <p className="text-center text-gray-700 font-medium mb-2">
                      {t('profileOptimizer.after')}
                    </p>
                    <div className="flex justify-center my-2">
                      {/* Star rating */}
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-xl ${star <= Math.round(optimizationResult.overallScore.after / 20) ? 'text-yellow-400' : 'text-gray-300'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-3xl text-center text-gray-800 font-medium">
                      {optimizationResult.overallScore.after}/100
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 my-8 pt-8"></div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">
                Summary
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-700">
                  {optimizationResult.summary}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 my-8 pt-8"></div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4">
                Section Improvements
              </h3>
              {optimizationResult.sectionImprovements.map((improvement, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-lg mb-3">
                    {improvement.title}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                      <p className="text-gray-600 text-sm mb-1">
                        {t('profileOptimizer.before')}:
                      </p>
                      <div className="bg-gray-50 border border-gray-200 rounded p-3">
                        <p className="text-sm">{improvement.before}</p>
                      </div>
                    </div>
                    <div className="md:col-span-5">
                      <p className="text-green-600 text-sm mb-1">
                        {t('profileOptimizer.after')}:
                      </p>
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <p className="text-sm">{improvement.after}</p>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-gray-600 text-sm mb-1">
                        Reason:
                      </p>
                      <p className="text-sm">{improvement.reason}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 my-8 pt-8"></div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Lightbulb className="text-yellow-500 mr-2" size={20} /> Keyword Optimizations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {optimizationResult.keywordOptimizations.map((keyword, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                        {keyword.keyword}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${keyword.relevance > 7 ? 'border-green-200 text-green-800 bg-green-50' : 'border-gray-200 text-gray-600 bg-gray-50'}`}>
                        Relevance: {keyword.relevance}/10
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Best placement: {keyword.placement}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 my-8 pt-8"></div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <CheckCircle className="text-green-500 mr-2" size={20} /> Best Practices
              </h3>
              <ul className="space-y-4">
                {optimizationResult.bestPractices.map((practice, index) => (
                  <li key={index} className="flex">
                    <CheckCircle className="text-green-500 flex-shrink-0 mr-3 mt-1" size={18} />
                    <div>
                      <p className="font-medium">{practice.title}</p>
                      <p className="text-gray-600 text-sm">{practice.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 my-8 pt-8"></div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <TrendingUp className="text-blue-500 mr-2" size={20} /> Industry Trends
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {optimizationResult.industryTrends.map((trend, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <TrendingUp className="text-blue-500 mr-2 mt-1 flex-shrink-0" size={18} />
                      <div>
                        <p className="font-medium">{trend.trend}</p>
                        <p className="text-gray-600 text-sm">{trend.relevance}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 flex items-center"
                onClick={handleNewOptimization}
              >
                <Sparkles className="mr-2" size={18} />
                {t('profileOptimizer.newOptimization')}
              </button>
              <button 
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                onClick={handleSaveOptimization}
              >
                {t('profileOptimizer.save')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="cv-select">
                {t('profileOptimizer.selectCv')}
              </label>
              <select
                id="cv-select"
                className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedCV}
                onChange={(e) => setSelectedCV(e.target.value)}
              >
                <option value="" disabled>Select a CV</option>
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.filename}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="platform-select">
                {t('profileOptimizer.targetPlatform')}
              </label>
              <select
                id="platform-select"
                className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value as 'linkedin' | 'cv')}
              >
                <option value="linkedin">{t('profileOptimizer.linkedin')}</option>
                <option value="cv">{t('profileOptimizer.cv')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="industry-focus">
                {t('profileOptimizer.industryFocus')}
              </label>
              <input
                id="industry-focus"
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={t('profileOptimizer.industryPlaceholder')}
                value={industryFocus}
                onChange={(e) => setIndustryFocus(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="career-level">
                {t('profileOptimizer.careerLevel')}
              </label>
              <select
                id="career-level"
                className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={careerLevel}
                onChange={(e) => setCareerLevel(e.target.value as 'entry' | 'mid' | 'senior')}
              >
                <option value="entry">{t('profileOptimizer.entry')}</option>
                <option value="mid">{t('profileOptimizer.mid')}</option>
                <option value="senior">{t('profileOptimizer.senior')}</option>
              </select>
            </div>
            <div className="md:col-span-2 mt-4">
              <button
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                onClick={handleOptimize}
                disabled={!selectedCV || !industryFocus}
              >
                {t('profileOptimizer.optimize')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileOptimizer; 