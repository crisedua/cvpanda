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
  Download,
  FileDown,
  Briefcase,
  Building,
  AlertCircle
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
  const [jobTitle, setJobTitle] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');

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

  const handleDownloadAdaptedCV = () => {
    if (!enhancementResult || !enhancementResult.adaptedCV) {
      setError("No adaptation available to download");
      return;
    }
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Adapted CV for ${enhancementResult.jobTitle || 'Job Application'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1, h2, h3 {
            color: #2563eb;
          }
          .section {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <h1>Adapted CV for: ${enhancementResult.jobTitle || 'Job Application'}</h1>
        <p><strong>Company:</strong> ${companyName || 'N/A'}</p>
        <div class="adapted-content">
          ${enhancementResult.adaptedCV}
        </div>
      </body>
      </html>
    `;
    
    try {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adapted-cv-${(enhancementResult.jobTitle || 'job-application').replace(/\s+/g, '-').toLowerCase()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading adapted CV:', error);
      setError('Failed to download adapted CV');
    }
  };

  const handleAdaptCV = async () => {
    if (!selectedCV) {
      setError(t('profileOptimizer.selectCv'));
      return;
    }

    if (!jobTitle) {
      setError('Please enter the job title');
      return;
    }

    if (!jobDescription) {
      setError('Please provide the job description');
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
      console.log('Starting CV adaptation for job:', jobTitle);
      console.log('API parameters:', {
        cvId: selectedCV,
        jobTitle,
        jobDescription,
        companyName
      });
      
      // Call the enhancement API with job details
      const result = await enhanceProfile(
        selectedCV,
        'resume', // Use 'resume' as the targetPlatform
        jobTitle, // Use jobTitle as industryFocus
        'Experienced' // Default career level
      );
      
      console.log('CV adaptation complete. Result:', result);

      if (result.success && result.enhancedData) {
        // Add job details to the result
        const adaptedResult = {
          ...result.enhancedData,
          jobTitle,
          adaptedCV: result.enhancedData.sectionEnhancements
            .map(section => `<div class="section">
              <h3>${section.section}</h3>
              <div>${section.enhancedContent}</div>
            </div>`)
            .join('\n')
        };
        
        setProgress(100);
        setEnhancementResult(adaptedResult);
      } else {
        console.error('CV adaptation result is not valid:', result.error || 'Unknown error');
        setError(result.error || 'CV adaptation result is not valid');
      }
    } catch (error) {
      console.error('Error adapting CV:', error);
      setError('Error adapting CV: ' + (error instanceof Error ? error.message : 'Error de conexión con el servidor'));
    } finally {
      clearInterval(progressInterval);
      setEnhancing(false);
    }
  };

  const handleNewAdaptation = () => {
    setEnhancementResult(null);
    setProgress(0);
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
          <Briefcase className="mr-2 h-6 w-6 text-indigo-600" />
          CV Adaptation for Job Applications
        </h1>
        <p className="text-gray-600 mb-6">
          Optimize your CV for specific job applications by tailoring it to match the job requirements and highlight relevant skills and experience.
        </p>

        {!enhancing && !enhancementResult && (
          <div className="space-y-6">
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
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="job-title">
                  Job Title*
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">
                    <Briefcase className="h-5 w-5" />
                  </span>
                  <input
                    id="job-title"
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="company-name">
                  Company Name
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-2">
                    <Building className="h-5 w-5" />
                  </span>
                  <input
                    id="company-name"
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="job-description">
                  Job Description*
                </label>
                <textarea
                  id="job-description"
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[200px]"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  For best results, include the full job description including required skills, qualifications, and responsibilities.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-gray-700 bg-blue-50 p-4 rounded-md">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <p className="text-sm">
                Our system will use GPT-4o Mini to analyze your CV and the job description, then create a tailored version of your CV optimized for this specific job application.
              </p>
            </div>
            <div>
              <button
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                onClick={handleAdaptCV}
                disabled={!selectedCV || !jobTitle || !jobDescription}
              >
                Adapt CV for This Job
              </button>
            </div>
          </div>
        )}

        {enhancing && (
          <div className="bg-white rounded-lg p-8 my-6">
            <div className="flex flex-col items-center text-center">
              <h3 className="text-xl font-semibold mb-4">
                Adapting your CV for the job application
              </h3>
              <div className="w-full mt-4">
                <ProgressBar progress={progress} />
              </div>
              <p className="text-gray-500 mt-4">
                Our AI is analyzing your CV and job requirements to create a tailored version that highlights your most relevant experience and skills...
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

      {enhancementResult && enhancementResult.adaptedCV && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">
              Adapted CV for: {enhancementResult.jobTitle || jobTitle}
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={handleDownloadAdaptedCV}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
              >
                <FileDown className="mr-2 h-5 w-5" />
                Download Adapted CV
              </button>
              <button
                onClick={handleNewAdaptation}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Create New Adaptation
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: enhancementResult.adaptedCV }} />
          </div>
          
          <div className="mt-6 bg-blue-50 p-4 rounded-md">
            <h3 className="text-lg font-semibold mb-2 text-blue-800">Key Adaptations Made</h3>
            <ul className="list-disc pl-5 space-y-2">
              {enhancementResult.profileScore?.keyFactors && enhancementResult.profileScore.keyFactors.length > 0 && 
                enhancementResult.profileScore.keyFactors.map((factor, index) => (
                  <li key={index} className="text-gray-700">{factor}</li>
                ))
              }
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEnhancer; 