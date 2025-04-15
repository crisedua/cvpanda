import React, { useState, useEffect, useRef } from 'react';
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
  Printer,
  Share2
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
  const [showFormattedResume, setShowFormattedResume] = useState<boolean>(false);
  const resumeRef = useRef<HTMLDivElement>(null);

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
        } else if (selectedCvData?.parsed_data) {
          // Use parsed_data if content is not available
          console.log("Using parsed_data as content");
          const parsedContent = formatParsedDataToHTML(selectedCvData.parsed_data);
          setSelectedCVContent(parsedContent);
        } else {
          console.log("Fetching CV content from API");
          try {
            // Try to fetch the CV content
            const response = await fetch(`${API_BASE_URL}/api/cvs/${selectedCV}/content`);
            if (!response.ok) {
              throw new Error(`Failed to fetch CV content: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            console.log("API response for CV content:", data);
            if (data.success && data.content) {
              setSelectedCVContent(data.content);
            } else {
              throw new Error('No content in API response');
            }
          } catch (fetchError) {
            console.error('Error fetching CV content:', fetchError);
            // Handle the case where we can't get the content directly
            // Try to get the parsed data instead
            try {
              const parsedDataResponse = await fetch(`${API_BASE_URL}/api/cvs/${selectedCV}`);
              if (!parsedDataResponse.ok) {
                throw new Error('Failed to fetch CV parsed data');
              }
              const parsedData = await parsedDataResponse.json();
              if (parsedData.success && parsedData.cv?.parsed_data) {
                console.log("Using parsed_data from API as fallback");
                const parsedContent = formatParsedDataToHTML(parsedData.cv.parsed_data);
                setSelectedCVContent(parsedContent);
              } else {
                throw new Error('No parsed data available');
              }
            } catch (parsedError) {
              console.error('Error fetching parsed data:', parsedError);
              throw new Error('Could not retrieve CV data in any format');
            }
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

  // Helper function to format parsed data into HTML
  const formatParsedDataToHTML = (parsedData: {
    name?: string;
    job_title?: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
    skills?: string[];
    work_experience?: Array<{
      title?: string;
      company?: string;
      dates?: string;
      description?: string;
    }>;
    education?: Array<{
      institution?: string;
      degree?: string;
      dates?: string;
    }>;
  }) => {
    if (!parsedData) return '';
    
    let html = '';
    
    // Add name and job title if available
    if (parsedData.name) {
      html += `<h2 class="text-xl font-bold mb-2">${parsedData.name}</h2>`;
    }
    
    if (parsedData.job_title) {
      html += `<p class="mb-4 text-gray-700">${parsedData.job_title}</p>`;
    }
    
    // Add contact info
    let contactInfo = [];
    if (parsedData.email) contactInfo.push(`Email: ${parsedData.email}`);
    if (parsedData.phone) contactInfo.push(`Phone: ${parsedData.phone}`);
    if (parsedData.location) contactInfo.push(`Location: ${parsedData.location}`);
    
    if (contactInfo.length > 0) {
      html += `<div class="mb-4">${contactInfo.join(' | ')}</div>`;
    }
    
    // Add summary if available
    if (parsedData.summary) {
      html += `<div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">Summary</h3>
        <p>${parsedData.summary}</p>
      </div>`;
    }
    
    // Add skills if available
    if (parsedData.skills && parsedData.skills.length > 0) {
      html += `<div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">Skills</h3>
        <p>${parsedData.skills.join(', ')}</p>
      </div>`;
    }
    
    // Add work experience if available
    if (parsedData.work_experience && parsedData.work_experience.length > 0) {
      html += `<div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">Work Experience</h3>`;
      
      parsedData.work_experience.forEach((exp) => {
        html += `<div class="mb-3">
          <p class="font-medium">${exp.title || ''} ${exp.company ? 'at ' + exp.company : ''}</p>
          ${exp.dates ? `<p class="text-sm text-gray-600">${exp.dates}</p>` : ''}
          ${exp.description ? `<p>${exp.description}</p>` : ''}
        </div>`;
      });
      
      html += `</div>`;
    }
    
    // Add education if available
    if (parsedData.education && parsedData.education.length > 0) {
      html += `<div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">Education</h3>`;
      
      parsedData.education.forEach((edu) => {
        html += `<div class="mb-2">
          <p class="font-medium">${edu.degree || ''} ${edu.institution ? 'at ' + edu.institution : ''}</p>
          ${edu.dates ? `<p class="text-sm text-gray-600">${edu.dates}</p>` : ''}
        </div>`;
      });
      
      html += `</div>`;
    }
    
    return html;
  };

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
      
      // Get the selected CV data directly
      const selectedCvData = cvs.find(cv => cv.id === selectedCV);
      console.log('Selected CV data for enhancement:', selectedCvData);
      
      if (!selectedCvData) {
        throw new Error('Selected CV data not found');
      }
      
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
        
        // Create a structured HTML representation of the original CV if we have parsed data
        if (selectedCvData.parsed_data) {
          console.log('Using parsed_data to create originalContent');
          const parsedContent = formatParsedDataToHTML(selectedCvData.parsed_data);
          result.enhancedData.originalContent = parsedContent;
        } else if (selectedCvData.content) {
          console.log('Using content field directly');
          result.enhancedData.originalContent = selectedCvData.content;
        } else {
          console.log('No original content available');
          result.enhancedData.originalContent = '<p>No se pudo cargar el contenido original del CV.</p>';
        }
        
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
      // Make sure to pass all required arguments with additional safety checks
      await generateEnhancementPDF(
        enhancementResult,
        targetPlatform || 'resume',
        jobTitle || 'Position'
      );
      console.log('PDF generated successfully');
      
      // Show success message
      setSuccessMessage('PDF generado exitosamente');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF');
    }
  };

  const handleToggleFormattedResume = () => {
    setShowFormattedResume(prev => !prev);
  };

  const handlePrintResume = () => {
    if (!enhancementResult) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print your resume');
      return;
    }
    
    // Get the resume HTML
    const resumeEl = resumeRef.current;
    if (!resumeEl) return;
    
    // Create a complete HTML document for printing
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Enhanced Resume - ${jobTitle || 'Download'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #333;
              line-height: 1.5;
              padding: 0;
              margin: 0;
            }
            .resume-container {
              max-width: 210mm;
              margin: 0 auto;
              padding: 25mm 25mm;
              background: white;
            }
            .resume-header {
              margin-bottom: 1.5rem;
              border-bottom: 1px solid #eee;
              padding-bottom: 1rem;
            }
            .resume-header h1 {
              font-size: 1.7rem;
              margin: 0 0 0.5rem 0;
              color: #1e40af;
            }
            .resume-header p {
              margin: 0 0 0.25rem 0;
              font-size: 0.9rem;
              color: #555;
            }
            .resume-section {
              margin-bottom: 1.5rem;
            }
            .resume-section h2 {
              font-size: 1.2rem;
              border-bottom: 1px solid #ddd;
              padding-bottom: 0.25rem;
              margin-bottom: 0.75rem;
              color: #2563eb;
            }
            .resume-section p {
              margin: 0 0 0.75rem 0;
              font-size: 0.9rem;
            }
            .skills-container {
              display: flex;
              flex-wrap: wrap;
              gap: 0.5rem;
              margin-bottom: 1rem;
            }
            .skill-tag {
              padding: 0.25rem 0.5rem;
              background: #f3f4f6;
              border-radius: 4px;
              font-size: 0.8rem;
              border: 1px solid #e5e7eb;
            }
            .experience-item, .education-item {
              margin-bottom: 1rem;
            }
            .experience-item h3, .education-item h3 {
              font-size: 1rem;
              margin: 0 0 0.25rem 0;
              color: #374151;
            }
            .experience-item p, .education-item p {
              margin: 0 0 0.25rem 0;
              font-size: 0.9rem;
            }
            .experience-item ul, .education-item ul {
              margin: 0.5rem 0;
              padding-left: 1.5rem;
            }
            .dates {
              font-size: 0.8rem;
              color: #6b7280;
            }
            .personal-info {
              display: flex;
              flex-wrap: wrap;
              gap: 1rem;
              margin-top: 0.5rem;
              font-size: 0.9rem;
            }
            .personal-info span {
              margin-right: 1rem;
            }
            strong {
              color: #4b5563;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
                background: white;
              }
              .resume-container {
                width: 100%;
                box-shadow: none;
                padding: 0;
                margin: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          ${resumeEl.outerHTML}
        </body>
      </html>
    `);
    
    // Trigger print dialog and close window after printing
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.onafterprint = () => {
      printWindow.close();
    };
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
    <div className="container mx-auto px-4 pb-12">
      <h1 className="text-3xl font-bold text-center mb-8 text-indigo-800">
        {t('profileOptimizer.title')}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {!enhancementResult ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-2xl font-semibold mb-2 flex items-center">
            <Sparkles className="mr-2 h-6 w-6 text-indigo-600" />
            Profile Enhancement
          </h1>
          <p className="text-gray-600 mb-6">
            Enhance your LinkedIn profile or resume with AI-powered recommendations based on industry trends and keyword effectiveness.
          </p>

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
        </div>
      ) : (
        <div>
          {/* Button bar for actions */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setShowFormattedResume(false)}
                className={`px-4 py-2 ${!showFormattedResume ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'} rounded-md`}
              >
                Resumen Optimizado
              </button>
              <button
                onClick={() => setShowFormattedResume(true)}
                className={`px-4 py-2 ${showFormattedResume ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'} rounded-md`}
              >
                CV Formateado
              </button>
            </div>
            <div className="flex space-x-3">
              {showFormattedResume && (
                <button
                  onClick={handlePrintResume}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center"
                >
                  <Printer className="mr-2 h-5 w-5" />
                  Imprimir CV
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <Download className="mr-2 h-5 w-5" />
                Descargar PDF
              </button>
              <button
                onClick={handleSaveEnhancement}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Guardar
              </button>
              <button
                onClick={handleNewEnhancement}
                className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 transition-colors"
              >
                Nueva Mejora
              </button>
            </div>
          </div>

          {/* Formatted Resume View */}
          {showFormattedResume ? (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 max-w-4xl mx-auto">
              <div ref={resumeRef} className="resume-container font-sans text-gray-800 leading-relaxed p-8">
                <div className="resume-header mb-6 border-b border-gray-200 pb-4">
                  {/* Name and Personal Info */}
                  <h1 className="text-3xl font-bold text-indigo-800">
                    {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.name || 'Nombre Profesional'}
                  </h1>
                  
                  <div className="text-md text-gray-600 mt-2">
                    {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.job_title && (
                      <p className="font-semibold mb-1">
                        {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.job_title}
                      </p>
                    )}
                    
                    <p className="flex flex-wrap gap-2">
                      {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.email && (
                        <span>
                          <strong className="text-gray-700">Email:</strong> {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.email}
                        </span>
                      )}
                      
                      {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.phone && (
                        <span>
                          <strong className="text-gray-700">Tel:</strong> {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.phone}
                        </span>
                      )}
                      
                      {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.location && (
                        <span>
                          <strong className="text-gray-700">Ubicación:</strong> {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.location}
                        </span>
                      )}
                    </p>
                    
                    {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.linkedin_url && (
                      <p className="mt-1">
                        <strong className="text-gray-700">LinkedIn:</strong> {cvs.find(cv => cv.id === selectedCV)?.parsed_data?.linkedin_url}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Professional Profile Section */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-indigo-700 border-b border-gray-200 pb-1 mb-3">Perfil Profesional</h2>
                  <p className="text-gray-700">{enhancementResult.sectionEnhancements?.find(section => 
                    section?.section?.toLowerCase().includes('summary') || 
                    section?.section?.toLowerCase().includes('perfil') || 
                    section?.section?.toLowerCase().includes('resumen'))?.enhancedContent || 
                    enhancementResult.fullEnhancedCvText?.substring(0, 200) || 
                    'Perfil profesional optimizado'}</p>
                </div>
                
                {/* Skills Section */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-indigo-700 border-b border-gray-200 pb-1 mb-3">Habilidades Clave</h2>
                  <div className="flex flex-wrap gap-2">
                    {enhancementResult?.keywordAnalysis?.map((keyword, index) => (
                      keyword?.keyword ? (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full border border-gray-200"
                        >
                          {keyword.keyword}
                        </span>
                      ) : null
                    ))}
                  </div>
                </div>
                
                {/* Experience Section */}
                {enhancementResult?.sectionEnhancements?.find(section => 
                  section?.section?.toLowerCase().includes('experience') || 
                  section?.section?.toLowerCase().includes('experiencia')
                )?.enhancedContent && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-indigo-700 border-b border-gray-200 pb-1 mb-3">Experiencia Profesional</h2>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ 
                      __html: enhancementResult.sectionEnhancements.find(section => 
                        section?.section?.toLowerCase().includes('experience') || 
                        section?.section?.toLowerCase().includes('experiencia')
                      )?.enhancedContent || ''
                    }} />
                  </div>
                )}
                
                {/* Education Section */}
                {enhancementResult?.sectionEnhancements?.find(section => 
                  section?.section?.toLowerCase().includes('education') || 
                  section?.section?.toLowerCase().includes('educación') ||
                  section?.section?.toLowerCase().includes('formación')
                )?.enhancedContent && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-indigo-700 border-b border-gray-200 pb-1 mb-3">Educación</h2>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ 
                      __html: enhancementResult.sectionEnhancements.find(section => 
                        section?.section?.toLowerCase().includes('education') || 
                        section?.section?.toLowerCase().includes('educación') ||
                        section?.section?.toLowerCase().includes('formación')
                      )?.enhancedContent || ''
                    }} />
                  </div>
                )}
                
                {/* Certifications Section */}
                {enhancementResult?.sectionEnhancements?.find(section => 
                  section?.section?.toLowerCase().includes('certif')
                )?.enhancedContent && (
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-indigo-700 border-b border-gray-200 pb-1 mb-3">Certificaciones</h2>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ 
                      __html: enhancementResult.sectionEnhancements.find(section => 
                        section?.section?.toLowerCase().includes('certif')
                      )?.enhancedContent || ''
                    }} />
                  </div>
                )}
                
                {/* Additional Skills or Sections */}
                {enhancementResult?.sectionEnhancements?.filter(section => 
                  !section?.section?.toLowerCase().includes('summary') && 
                  !section?.section?.toLowerCase().includes('perfil') && 
                  !section?.section?.toLowerCase().includes('resumen') && 
                  !section?.section?.toLowerCase().includes('experience') && 
                  !section?.section?.toLowerCase().includes('experiencia') && 
                  !section?.section?.toLowerCase().includes('education') && 
                  !section?.section?.toLowerCase().includes('educación') && 
                  !section?.section?.toLowerCase().includes('formación') && 
                  !section?.section?.toLowerCase().includes('certif')
                ).map((section, index) => (
                  section?.enhancedContent ? (
                    <div key={index} className="mb-6">
                      <h2 className="text-xl font-semibold text-indigo-700 border-b border-gray-200 pb-1 mb-3">{section.section}</h2>
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: section.enhancedContent }} />
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-semibold text-indigo-700">
                  CV Optimizado para: {jobTitle}
                </h2>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600">Este CV ha sido optimizado específicamente para el puesto de <strong>{jobTitle}</strong>. Las modificaciones realizadas destacan tus habilidades y experiencias más relevantes para este rol, aumentando tus posibilidades de ser seleccionado.</p>
              </div>

              {/* Optimized CV */}
              <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
                <div className="space-y-5">
                  {/* Profile Summary */}
                  {enhancementResult?.sectionEnhancements?.find(section => 
                    section?.section?.toLowerCase().includes('summary') || 
                    section?.section?.toLowerCase().includes('perfil') || 
                    section?.section?.toLowerCase().includes('resumen')
                  )?.enhancedContent && (
                    <div className="pb-3 border-b border-indigo-100">
                      <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                        Perfil Profesional
                      </h3>
                      <p className="text-gray-800">
                        {enhancementResult.sectionEnhancements.find(section => 
                          section?.section?.toLowerCase().includes('summary') || 
                          section?.section?.toLowerCase().includes('perfil') || 
                          section?.section?.toLowerCase().includes('resumen')
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
                        keyword?.keyword ? (
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
                        ) : null
                      ))}
                    </div>
                  </div>

                  {/* Experience Section */}
                  {enhancementResult?.sectionEnhancements?.find(section => 
                    section?.section?.toLowerCase().includes('experience') || 
                    section?.section?.toLowerCase().includes('experiencia')
                  )?.enhancedContent && (
                    <div className="pb-3 border-b border-indigo-100">
                      <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                        Experiencia Profesional
                      </h3>
                      <div className="prose prose-sm max-w-none">
                        <div dangerouslySetInnerHTML={{ 
                          __html: enhancementResult.sectionEnhancements.find(section => 
                            section?.section?.toLowerCase().includes('experience') || 
                            section?.section?.toLowerCase().includes('experiencia')
                          )?.enhancedContent || ''
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Education Section */}
                  {enhancementResult?.sectionEnhancements?.find(section => 
                    section?.section?.toLowerCase().includes('education') || 
                    section?.section?.toLowerCase().includes('educación') ||
                    section?.section?.toLowerCase().includes('formación')
                  )?.enhancedContent && (
                    <div className="pb-3 border-b border-indigo-100">
                      <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                        Educación
                      </h3>
                      <div className="prose prose-sm max-w-none">
                        <div dangerouslySetInnerHTML={{ 
                          __html: enhancementResult.sectionEnhancements.find(section => 
                            section?.section?.toLowerCase().includes('education') || 
                            section?.section?.toLowerCase().includes('educación') ||
                            section?.section?.toLowerCase().includes('formación')
                          )?.enhancedContent || ''
                        }} />
                      </div>
                    </div>
                  )}
                  
                  {/* Certifications Section (if exists) */}
                  {enhancementResult?.sectionEnhancements?.find(section => 
                    section?.section?.toLowerCase().includes('certif') 
                  )?.enhancedContent && (
                    <div className="pb-3 border-b border-indigo-100">
                      <h3 className="text-xl font-semibold mb-3 text-indigo-700">
                        Certificaciones
                      </h3>
                      <div className="prose prose-sm max-w-none">
                        <div dangerouslySetInnerHTML={{ 
                          __html: enhancementResult.sectionEnhancements.find(section => 
                            section?.section?.toLowerCase().includes('certif')
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
      )}
    </div>
  );
};

export default ProfileEnhancer;