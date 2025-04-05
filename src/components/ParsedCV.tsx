import React, { useState } from 'react';
import { Layout, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import type { CV } from '../types';
import CVTemplates from './CVTemplates';
import { useTranslation } from 'react-i18next';

interface ParsedCVProps {
  cv: CV;
  language?: 'original' | 'english';
}

const ParsedCV: React.FC<ParsedCVProps> = ({ cv, language = 'original' }) => {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<'modern' | 'classic' | 'minimal' | 'executive'>('modern');
  const [showRawContent, setShowRawContent] = useState(false);
  const [displayMode, setDisplayMode] = useState<'structured' | 'formatted-text' | 'raw'>('structured');
  
  // Check if we need to show the raw content viewer for very large CVs
  const isLargeCV = cv.is_large_cv;
  const hasPlainTextContent = cv.content && typeof cv.content === 'string';
  const isUsingRawData = cv.using_raw_data;
  
  // For very large CVs with complex data, offer raw view option
  const shouldOfferRawView = isLargeCV || isUsingRawData || 
    (cv.section_metrics && Object.keys(cv.section_metrics).length > 10) ||
    (cv.parsed_data && JSON.stringify(cv.parsed_data).length > 50000);
    
  // Determine if we should default to raw view for extremely large CVs
  React.useEffect(() => {
    if (isUsingRawData || (hasPlainTextContent && cv.content && cv.content.length > 100000)) {
      setDisplayMode('formatted-text');
    }
  }, [cv.id, isUsingRawData, hasPlainTextContent, cv.content]);
  
  // Format a plain text version of the CV for better reading
  const formatTextContent = () => {
    if (!cv.content) return '';
    
    // Basic cleanup and formatting
    return cv.content
      .replace(/\n\n+/g, '\n\n')  // Remove excessive newlines
      .replace(/\t/g, '  ')       // Replace tabs with spaces
      .trim();
  };
  
  return (
    <div className="space-y-6">
      {/* Template and Display Mode Selector */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Layout className="h-5 w-5 text-gray-500" />
            <div className="flex-1">
              <label htmlFor="template" className="block text-sm font-medium text-gray-700">
                {t('cv.templateSelector')}
              </label>
              <select
                id="template"
                value={template}
                onChange={(e) => setTemplate(e.target.value as any)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="modern">{t('cv.templates.modern')}</option>
                <option value="classic">{t('cv.templates.classic')}</option>
                <option value="minimal">{t('cv.templates.minimal')}</option>
                <option value="executive">{t('cv.templates.executive')}</option>
              </select>
            </div>
          </div>
          
          {/* Display Mode Toggle for large CVs */}
          {shouldOfferRawView && (
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('cv.displayMode')}
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setDisplayMode('structured')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    displayMode === 'structured' 
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700 border border-gray-300'
                  }`}
                >
                  {t('cv.viewStructured')}
                </button>
                <button
                  onClick={() => setDisplayMode('formatted-text')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    displayMode === 'formatted-text' 
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700 border border-gray-300'
                  }`}
                >
                  {t('cv.viewFormatted')}
                </button>
                <button
                  onClick={() => setDisplayMode('raw')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    displayMode === 'raw' 
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700 border border-gray-300'
                  }`}
                >
                  {t('cv.viewRaw')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw Data Notification */}
      {isUsingRawData && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 flex items-start">
          <ExternalLink className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t('cv.rawDataMode')}</p>
            <p className="text-sm mt-1">{t('cv.rawDataDescription')}</p>
            {cv.available_sections && (
              <div className="mt-2">
                <p className="text-sm font-medium">{t('cv.availableSections')}:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {cv.available_sections.map((section) => (
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

      {/* Large CV Warning */}
      {isLargeCV && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t('cv.largeCVWarning')}</p>
            <p className="text-sm mt-1">{t('cv.largeCVDescription')}</p>
          </div>
        </div>
      )}

      {/* CV Content */}
      {displayMode === 'formatted-text' ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t('cv.formattedContent')}</h2>
          <div className="whitespace-pre-wrap font-serif text-md bg-gray-50 p-6 rounded border border-gray-200 max-h-[800px] overflow-y-auto leading-relaxed">
            {formatTextContent()}
          </div>
        </div>
      ) : displayMode === 'raw' ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t('cv.rawContent')}</h2>
          <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 border rounded overflow-auto max-h-[800px]">
            {cv.content || 'No content available'}
          </div>
        </div>
      ) : (
        <CVTemplates cv={cv} language={language} template={template} />
      )}
    </div>
  );
};

export default ParsedCV;