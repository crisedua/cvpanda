import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchUserCVs, enhanceProfile } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from './ProgressBar';
import { 
  CheckCircle, 
  ArrowUp, 
  Lightbulb, 
  TrendingUp, 
  Sparkles, 
  HelpCircle, 
  Award, 
  BarChart, 
  Target, 
  Calendar, 
  FileText,
  Download
} from 'lucide-react';
import { CV, ProfileEnhancementResult } from '../types';
import { generateEnhancementPDF } from '../lib/documentGenerator';

const ProfileEnhancer: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [cvs, setCVs] = useState<CV[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [enhancing, setEnhancing] = useState<boolean>(false);
  const [selectedCV, setSelectedCV] = useState<string>('');
  const [targetPlatform, setTargetPlatform] = useState<'linkedin' | 'resume'>('linkedin');
  const [industryFocus, setIndustryFocus] = useState<string>('Software Development');
  const [careerLevel, setCareerLevel] = useState<string>('Mid-Level');
  const [enhancementResult, setEnhancementResult] = useState<ProfileEnhancementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('keywords');

  // Replace hardcoded industry options with translations
  const INDUSTRY_OPTIONS = [
    t('profileEnhancer.industries.software'),
    t('profileEnhancer.industries.dataScience'),
    t('profileEnhancer.industries.productManagement'),
    t('profileEnhancer.industries.digitalMarketing'),
    t('profileEnhancer.industries.design'),
    t('profileEnhancer.industries.finance'),
    t('profileEnhancer.industries.healthcare'),
    t('profileEnhancer.industries.education'),
    t('profileEnhancer.industries.sales'),
    t('profileEnhancer.industries.customerService'),
    t('profileEnhancer.industries.humanResources'),
    t('profileEnhancer.industries.engineering'),
    t('profileEnhancer.industries.manufacturing'),
    t('profileEnhancer.industries.legal'),
    t('profileEnhancer.industries.other')
  ];
  
  // Replace hardcoded career level options with translations
  const CAREER_LEVEL_OPTIONS = [
    t('profileEnhancer.careerLevels.entry'),
    t('profileEnhancer.careerLevels.junior'),
    t('profileEnhancer.careerLevels.mid'),
    t('profileEnhancer.careerLevels.senior'),
    t('profileEnhancer.careerLevels.manager'),
    t('profileEnhancer.careerLevels.director'),
    t('profileEnhancer.careerLevels.executive')
  ];

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const fetchCVs = async () => {
      try {
        console.log('Fetching CVs for user:', user?.id);
        const fetchedCVs = await fetchUserCVs(user?.id || '');
        console.log('CVs fetched:', fetchedCVs);
        
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

  const handleEnhance = async () => {
    if (!selectedCV) {
      setError(t('profileOptimizer.selectCv'));
      return;
    }

    if (!industryFocus) {
      setError('Please specify an industry focus');
      return;
    }

    setEnhancing(true);
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
      console.log('Starting profile enhancement for CV:', selectedCV);
      console.log('API parameters:', {
        cvId: selectedCV,
        targetPlatform,
        industryFocus,
        careerLevel
      });
      
      // Call the enhancement API with detailed error logging
      const result = await enhanceProfile(
        selectedCV,
        targetPlatform,
        industryFocus,
        careerLevel
      );
      
      console.log('Enhancement complete. Result:', result);

      if (result.success && result.enhancedData) {
        setProgress(100);
        setEnhancementResult(result.enhancedData);
      } else {
        console.error('Enhancement result is not valid:', result.error || 'Unknown error');
        setError(result.error || 'Enhancement result is not valid');
      }
    } catch (error) {
      console.error('Error enhancing profile:', error);
      // More specific error message in Spanish
      setError('Error al mejorar el perfil: ' + (error instanceof Error ? error.message : 'Error de conexión con el servidor'));
    } finally {
      clearInterval(progressInterval);
      setEnhancing(false);
    }
  };

  const handleNewEnhancement = () => {
    setEnhancementResult(null);
    setProgress(0);
  };

  const handleSaveEnhancement = async () => {
    if (!selectedCV || !enhancementResult) {
      setError("No enhancement to save");
      return;
    }
    
    setLoading(true);
    
    try {
      // Save enhancement data
      const response = await fetch(`${API_BASE_URL}/api/save-optimization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cvId: selectedCV,
          optimizationResult: enhancementResult,
          targetPlatform,
          industryFocus,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save enhancement');
      }
      
      setSuccessMessage(t('profileOptimizer.saveSuccess'));
      console.log('Enhancement saved successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving enhancement:', error);
      setError(t('profileOptimizer.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!enhancementResult) {
      setError("No enhancement result to download");
      return;
    }
    
    try {
      await generateEnhancementPDF(enhancementResult, targetPlatform, industryFocus);
      console.log('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF');
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
            Refresh CVs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="text-2xl font-semibold mb-2 flex items-center">
          <Sparkles className="mr-2 h-6 w-6 text-indigo-600" />
          Profile Enhancement
        </h1>
        <p className="text-gray-600 mb-6">
          Enhance your LinkedIn profile or resume with AI-powered recommendations based on industry trends and keyword effectiveness.
        </p>

        {!enhancing && !enhancementResult && (
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
              <div className="grid grid-cols-2 gap-4">
                <button
                  className={`p-3 rounded-md text-center ${
                    targetPlatform === 'linkedin' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-blue-50 text-gray-700 hover:bg-blue-100'
                  }`}
                  onClick={() => setTargetPlatform('linkedin')}
                >
                  {t('profileEnhancer.linkedin')}
                </button>
                <button
                  className={`p-3 rounded-md text-center ${
                    targetPlatform === 'resume' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-blue-50 text-gray-700 hover:bg-blue-100'
                  }`}
                  onClick={() => setTargetPlatform('resume')}
                >
                  {t('profileEnhancer.resume')}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="industry-focus">
                {t('profileOptimizer.industryFocus')}
              </label>
              <select
                id="industry-focus"
                className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={industryFocus}
                onChange={(e) => setIndustryFocus(e.target.value)}
              >
                {INDUSTRY_OPTIONS.map((industry) => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="career-level">
                {t('profileOptimizer.careerLevel')}
              </label>
              <select
                id="career-level"
                className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={careerLevel}
                onChange={(e) => setCareerLevel(e.target.value)}
              >
                {CAREER_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 mt-4">
              <button
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                onClick={handleEnhance}
                disabled={!selectedCV || !industryFocus}
              >
                {t('profileEnhancer.enhance')}
              </button>
            </div>
          </div>
        )}

        {enhancing && (
          <div className="bg-white rounded-lg p-8 my-6">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-xl font-semibold mb-4">
                {t('profileEnhancer.enhancing')}
              </h3>
              <div className="w-full mt-4">
                <ProgressBar progress={progress} />
              </div>
              <p className="text-gray-500 mt-4">
                {t('profileEnhancer.enhancingProgress')}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {enhancementResult && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">
              {t('profileEnhancer.enhancementResults')}
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
              >
                <Download className="mr-2 h-5 w-5" />
                Download PDF
              </button>
              <button
                onClick={handleSaveEnhancement}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                {t('profileEnhancer.saveResults')}
              </button>
              <button
                onClick={handleNewEnhancement}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                {t('profileEnhancer.newEnhancement')}
              </button>
            </div>
          </div>

          {/* Profile Score */}
          <div className="flex flex-wrap mb-8">
            <div className="w-full lg:w-1/3 px-4 mb-6 lg:mb-0">
              <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100 h-full">
                <h3 className="text-lg font-semibold text-indigo-800 mb-2 flex items-center">
                  <BarChart className="mr-2 h-5 w-5" />
                  {t('profileEnhancer.profileScore')}
                </h3>
                <div className="flex items-center justify-around mt-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600">
                      {enhancementResult.profileScore.current}%
                    </div>
                    <div className="text-sm text-gray-600">{t('profileEnhancer.current')}</div>
                  </div>
                  <div className="text-indigo-500">→</div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {enhancementResult.profileScore.potential}%
                    </div>
                    <div className="text-sm text-gray-600">{t('profileEnhancer.potential')}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="font-medium text-indigo-800 mb-2">{t('profileEnhancer.keyFactors')}</h4>
                  <ul className="list-disc pl-5 text-sm">
                    {enhancementResult.profileScore.keyFactors.map((factor, index) => (
                      <li key={index} className="mb-1 text-gray-700">{factor}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-2/3 px-4">
              <div className="bg-white p-6 rounded-lg border border-gray-200 h-full">
                <div className="flex space-x-2 overflow-x-auto pb-2 mb-4 border-b">
                  <button
                    className={`px-4 py-2 rounded-md ${activeTab === 'keywords' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setActiveTab('keywords')}
                  >
                    Keyword Analysis
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${activeTab === 'sections' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setActiveTab('sections')}
                  >
                    Section Enhancements
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${activeTab === 'trends' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setActiveTab('trends')}
                  >
                    Industry Trends
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${activeTab === 'ats' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setActiveTab('ats')}
                  >
                    ATS Optimization
                  </button>
                  <button
                    className={`px-4 py-2 rounded-md ${activeTab === 'actionPlan' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    onClick={() => setActiveTab('actionPlan')}
                  >
                    Action Plan
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'keywords' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="mr-2 h-5 w-5 text-indigo-600" />
                      {t('profileEnhancer.keywordAnalysis')}
                    </h3>
                    <div className="space-y-4">
                      {enhancementResult.keywordAnalysis.map((keyword, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-md mb-2">{keyword.keyword}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              keyword.relevance > 80 ? 'bg-green-100 text-green-800' : 
                              keyword.relevance > 50 ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {t('profileEnhancer.relevance')}: {keyword.relevance}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{t('profileEnhancer.placement')}: </span>
                            {keyword.placement}
                          </p>
                          <p className="text-sm text-gray-700 mt-2">
                            <span className="font-medium">{t('profileEnhancer.recommendedUsage')}: </span>
                            {keyword.recommendedUsage}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'sections' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <FileText className="mr-2 h-5 w-5 text-indigo-600" />
                      {t('profileEnhancer.sectionEnhancements')}
                    </h3>
                    <div className="space-y-6">
                      {enhancementResult.sectionEnhancements.map((enhancement, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-semibold text-lg mb-2 text-indigo-700">{enhancement.section}</h4>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">{t('profileEnhancer.currentContent')}</p>
                              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                                {enhancement.currentContent}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-green-500 mb-1">{t('profileEnhancer.enhancedContent')}</p>
                              <div className="bg-green-50 p-3 rounded border border-green-200 text-sm">
                                {enhancement.enhancedContent}
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">{t('profileEnhancer.rationale')}</p>
                            <p className="text-sm text-gray-700">{enhancement.rationale}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'trends' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <TrendingUp className="mr-2 h-5 w-5 text-indigo-600" />
                      {t('profileEnhancer.industryTrends')}
                    </h3>
                    <div className="space-y-4">
                      {enhancementResult.industryTrends.map((trend, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-md mb-2">{trend.trend}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              trend.relevance > 80 ? 'bg-green-100 text-green-800' : 
                              trend.relevance > 50 ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {t('profileEnhancer.relevance')}: {trend.relevance}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{t('profileEnhancer.implementation')}: </span>
                            {trend.implementation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'ats' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Award className="mr-2 h-5 w-5 text-indigo-600" />
                      ATS Optimization
                    </h3>
                    {enhancementResult.atsOptimization ? (
                      <>
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">ATS Compatibility Score</span>
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              enhancementResult.atsOptimization.currentScore > 80 ? 'bg-green-100 text-green-800' : 
                              enhancementResult.atsOptimization.currentScore > 50 ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {enhancementResult.atsOptimization.currentScore}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                enhancementResult.atsOptimization.currentScore > 80 ? 'bg-green-600' : 
                                enhancementResult.atsOptimization.currentScore > 50 ? 'bg-yellow-500' : 
                                'bg-red-600'
                              }`}
                              style={{ width: `${enhancementResult.atsOptimization.currentScore}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {enhancementResult.atsOptimization.recommendations && enhancementResult.atsOptimization.recommendations.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Recommendations</h4>
                              <ul className="space-y-2">
                                {enhancementResult.atsOptimization.recommendations.map((rec, i) => (
                                  <li key={i} className="flex items-start">
                                    <svg className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {enhancementResult.atsOptimization.keywordsToAdd && enhancementResult.atsOptimization.keywordsToAdd.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Keywords to Add</h4>
                              <div className="flex flex-wrap gap-2">
                                {enhancementResult.atsOptimization.keywordsToAdd.map((keyword, i) => (
                                  <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                        <p className="text-yellow-800">ATS optimization data not available in this result.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'actionPlan' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Calendar className="mr-2 h-5 w-5 text-indigo-600" />
                      Action Plan
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-medium text-indigo-700 mb-2 flex items-center">
                          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                          Immediate Actions
                        </h4>
                        <ul className="space-y-2 pl-5">
                          {enhancementResult.actionPlan.immediate.map((action, i) => (
                            <li key={i} className="text-sm text-gray-700 list-disc">{action}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-indigo-700 mb-2 flex items-center">
                          <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                          Short-Term Actions (1 month)
                        </h4>
                        <ul className="space-y-2 pl-5">
                          {enhancementResult.actionPlan.shortTerm.map((action, i) => (
                            <li key={i} className="text-sm text-gray-700 list-disc">{action}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-indigo-700 mb-2 flex items-center">
                          <span className="inline-block w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
                          Long-Term Actions (3-6 months)
                        </h4>
                        <ul className="space-y-2 pl-5">
                          {enhancementResult.actionPlan.longTerm.map((action, i) => (
                            <li key={i} className="text-sm text-gray-700 list-disc">{action}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Competitive Advantage Section */}
          {enhancementResult.competitiveAdvantage && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Lightbulb className="mr-2 h-5 w-5 text-amber-500" />
                Competitive Advantage Strategy
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                {enhancementResult.competitiveAdvantage.differentiationStrategy && (
                  <div className="mb-4">
                    <h4 className="font-medium text-amber-800 mb-2">Differentiation Strategy</h4>
                    <p className="text-gray-700">{enhancementResult.competitiveAdvantage.differentiationStrategy}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {enhancementResult.competitiveAdvantage.uniqueSellingPoints && enhancementResult.competitiveAdvantage.uniqueSellingPoints.length > 0 && (
                    <div>
                      <h4 className="font-medium text-amber-800 mb-2">Unique Selling Points</h4>
                      <ul className="space-y-2">
                        {enhancementResult.competitiveAdvantage.uniqueSellingPoints.map((point, i) => (
                          <li key={i} className="flex items-start">
                            <svg className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-gray-700">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {enhancementResult.competitiveAdvantage.emergingOpportunities && enhancementResult.competitiveAdvantage.emergingOpportunities.length > 0 && (
                    <div>
                      <h4 className="font-medium text-amber-800 mb-2">Emerging Opportunities</h4>
                      <ul className="space-y-2">
                        {enhancementResult.competitiveAdvantage.emergingOpportunities.map((opportunity, i) => (
                          <li key={i} className="flex items-start">
                            <svg className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span className="text-gray-700">{opportunity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileEnhancer; 