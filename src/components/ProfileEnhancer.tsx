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
  const [selectedCVContent, setSelectedCVContent] = useState<string>('');
  const [targetPlatform, setTargetPlatform] = useState<'linkedin' | 'resume'>('linkedin');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [enhancementResult, setEnhancementResult] = useState<ProfileEnhancementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('keywords');

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

  useEffect(() => {
    // Fetch the content of the selected CV
    const fetchCVContent = async () => {
      if (!selectedCV) return;
      
      try {
        setLoading(true);
        console.log("Fetching content for CV ID:", selectedCV);
        const selectedCvData = cvs.find(cv => cv.id === selectedCV);
        console.log("Selected CV data:", selectedCvData);
        
        if (selectedCvData?.content) {
          console.log("Using CV content from local data");
          setSelectedCVContent(selectedCvData.content);
        } else {
          console.log("Fetching CV content from API");
          // Fetch the CV content if not already loaded
          const response = await fetch(`${API_BASE_URL}/api/cvs/${selectedCV}/content`);
          if (!response.ok) {
            throw new Error('Failed to fetch CV content');
          }
          const data = await response.json();
          console.log("API response for CV content:", data);
          if (data.success && data.content) {
            setSelectedCVContent(data.content);
          }
        }
      } catch (error) {
        console.error('Error fetching CV content:', error);
        setError('No se pudo cargar el contenido del CV');
      } finally {
        setLoading(false);
      }
    };

    fetchCVContent();
  }, [selectedCV, cvs]);

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

    if (!jobTitle || !jobDescription) {
      setError('Please enter a job title and description');
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
      console.log('Selected CV content:', selectedCVContent);
      console.log('API parameters:', {
        cvId: selectedCV,
        targetPlatform,
        industryFocus: jobTitle,
        careerLevel: jobDescription
      });
      
      // Call the enhancement API with detailed error logging
      const result = await enhanceProfile(
        selectedCV,
        targetPlatform,
        jobTitle,
        jobDescription
      );
      
      console.log('Enhancement complete. Result:', result);

      if (result.success && result.enhancedData) {
        setProgress(100);
        // Store the original content in the enhancement result
        result.enhancedData.originalContent = selectedCVContent;
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
          industryFocus: jobTitle,
          careerLevel: jobDescription,
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
      await generateEnhancementPDF(enhancementResult, targetPlatform, jobTitle);
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
                {cvs?.map((cv) => (
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
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="job-title">
                Título del Trabajo
              </label>
              <input
                id="job-title"
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ingresa el título del trabajo"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="job-description">
                Ingresa la Descripción del Puesto
              </label>
              <textarea
                id="job-description"
                className="w-full h-48 p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Ingresa la descripción detallada del puesto de trabajo"
              />
            </div>
            <div className="md:col-span-2 mt-4">
              <button
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                onClick={handleEnhance}
                disabled={!selectedCV || !jobTitle || !jobDescription}
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-2xl font-semibold text-indigo-700">
              CV Optimizado para: {jobTitle}
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
              >
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </button>
              <button
                onClick={handleSaveEnhancement}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Guardar Resultados
              </button>
              <button
                onClick={handleNewEnhancement}
                className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 transition-colors"
              >
                Nueva Mejora
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-gray-600">Este CV ha sido optimizado específicamente para el puesto de <strong>{jobTitle}</strong>. Las modificaciones realizadas destacan tus habilidades y experiencias más relevantes para este rol, aumentando tus posibilidades de ser seleccionado.</p>
          </div>

          {/* Optimized CV */}
          <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
            <div className="space-y-5">
              {/* Profile Summary */}
              {enhancementResult?.sectionEnhancements?.find(section => 
                section.section.toLowerCase().includes('summary') || 
                section.section.toLowerCase().includes('perfil') || 
                section.section.toLowerCase().includes('resumen')
              ) && (
                <div className="pb-3 border-b border-indigo-100">
                  <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                    Perfil Profesional
                  </h3>
                  <p className="text-gray-800">
                    {enhancementResult.sectionEnhancements.find(section => 
                      section.section.toLowerCase().includes('summary') || 
                      section.section.toLowerCase().includes('perfil') || 
                      section.section.toLowerCase().includes('resumen')
                    )?.enhancedContent}
                  </p>
                </div>
              )}

              {/* Skills Section */}
              <div className="pb-3 border-b border-indigo-100">
                <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                  Habilidades Clave
                </h3>
                <div className="flex flex-wrap gap-2">
                  {enhancementResult?.keywordAnalysis?.map((keyword, index) => (
                    <span 
                      key={index}
                      className={`px-3 py-1 rounded-full text-sm ${
                        keyword.relevance > 80 ? 'bg-green-100 text-green-800 border border-green-200' : 
                        keyword.relevance > 50 ? 'bg-blue-100 text-blue-800 border border-blue-200' : 
                        'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}
                    >
                      {keyword.keyword}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience Section */}
              {enhancementResult?.sectionEnhancements?.find(section => 
                section.section.toLowerCase().includes('experience') || 
                section.section.toLowerCase().includes('experiencia')
              ) && (
                <div className="pb-3 border-b border-indigo-100">
                  <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                    Experiencia Profesional
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ 
                      __html: enhancementResult.sectionEnhancements.find(section => 
                        section.section.toLowerCase().includes('experience') || 
                        section.section.toLowerCase().includes('experiencia')
                      )?.enhancedContent || ''
                    }} />
                  </div>
                </div>
              )}

              {/* Education Section */}
              {enhancementResult?.sectionEnhancements?.find(section => 
                section.section.toLowerCase().includes('education') || 
                section.section.toLowerCase().includes('educación') ||
                section.section.toLowerCase().includes('formación')
              ) && (
                <div className="pb-3 border-b border-indigo-100">
                  <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                    Educación
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ 
                      __html: enhancementResult.sectionEnhancements.find(section => 
                        section.section.toLowerCase().includes('education') || 
                        section.section.toLowerCase().includes('educación') ||
                        section.section.toLowerCase().includes('formación')
                      )?.enhancedContent || ''
                    }} />
                  </div>
                </div>
              )}
              
              {/* Certifications Section (if exists) */}
              {enhancementResult?.sectionEnhancements?.find(section => 
                section.section.toLowerCase().includes('certif') 
              ) && (
                <div className="pb-3 border-b border-indigo-100">
                  <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                    Certificaciones
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ 
                      __html: enhancementResult.sectionEnhancements.find(section => 
                        section.section.toLowerCase().includes('certif')
                      )?.enhancedContent || ''
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tips section */}
          <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              Consejos para aumentar tus posibilidades
            </h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Adapta tu CV para cada solicitud de empleo, destacando las habilidades y experiencias más relevantes para el puesto específico.</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Utiliza palabras clave específicas del sector y de la descripción del puesto para superar los filtros ATS.</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Cuantifica tus logros cuando sea posible (por ej., "Aumenté las ventas en un 25%") para demostrar el impacto de tu trabajo.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEnhancer;