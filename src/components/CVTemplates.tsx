import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, AlertCircle } from 'lucide-react';
import type { CV } from '../types';
import { generatePDF, generateWord } from '../lib/documentGenerator';

interface CVTemplatesProps {
  cv: CV;
  language?: 'original' | 'english';
  template?: 'modern' | 'classic' | 'minimal' | 'executive';
}

// Helper function to safely extract data from potentially complex structures
const extractDataSafely = (data: any, path: string[] = [], defaultValue = '') => {
  try {
    let result = data;
    for (const key of path) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return defaultValue;
      }
    }
    return result || defaultValue;
  } catch (e) {
    console.error(`Error extracting data at path ${path.join('.')}:`, e);
    return defaultValue;
  }
};

const CVTemplates: React.FC<CVTemplatesProps> = ({ 
  cv, 
  language = 'original',
  template = 'modern' 
}) => {
  const { t } = useTranslation();
  const data = language === 'english' ? cv.parsed_data_english : cv.parsed_data;
  if (!data) return null;

  // If this is a large CV, add extra handling to prevent rendering errors
  const isLargeCV = cv.is_large_cv;
  
  // If sections are missing, create empty placeholders to prevent errors
  const safeData = {
    personal: data.personal || {},
    summary: data.summary || '',
    experience: Array.isArray(data.experience) ? data.experience : [],
    education: Array.isArray(data.education) ? data.education : [],
    skills: data.skills || {},
    additional: data.additional || {}
  };

  const templates = {
    modern: {
      name: t('cv.templates.modern'),
      description: 'Clean and contemporary design with bold section headers',
      className: 'bg-white p-8 font-sans'
    },
    classic: {
      name: t('cv.templates.classic'),
      description: 'Traditional format ideal for corporate positions',
      className: 'bg-white p-8 font-serif'
    },
    minimal: {
      name: t('cv.templates.minimal'),
      description: 'Streamlined layout focusing on essential information',
      className: 'bg-white p-6 font-sans'
    },
    executive: {
      name: t('cv.templates.executive'),
      description: 'Professional design for senior positions',
      className: 'bg-white p-10 font-serif'
    }
  };

  const templateStyle = templates[template];

  const downloadPDF = async () => {
    await generatePDF(cv, language);
  };

  const downloadWord = async () => {
    await generateWord(cv, language);
  };

  return (
    <div>
      {/* Template Controls */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {templateStyle.name}
          </h3>
          <p className="text-sm text-gray-500">
            {templateStyle.description}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={downloadPDF}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('cv.download.pdf')}
          </button>
          <button
            onClick={downloadWord}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('cv.download.word')}
          </button>
        </div>
      </div>

      {/* CV Content */}
      <div className={`${templateStyle.className} rounded-lg shadow-lg`}>
        {/* Personal Information */}
        <div className={template === 'modern' ? 'text-center mb-8' : 'mb-8'}>
          <h1 className={`text-3xl font-bold text-gray-900 ${
            template === 'executive' ? 'uppercase tracking-wide' : ''
          }`}>
            {extractDataSafely(safeData.personal, ['name'])}
          </h1>
          {extractDataSafely(safeData.personal, ['title']) && (
            <p className={`text-xl text-gray-600 mt-2 ${
              template === 'minimal' ? 'font-light' : ''
            }`}>
              {extractDataSafely(safeData.personal, ['title'])}
            </p>
          )}
          <div className={`mt-4 text-gray-600 ${
            template === 'modern' ? 'flex justify-center space-x-4' :
            template === 'minimal' ? 'text-sm' :
            'space-y-1'
          }`}>
            {extractDataSafely(safeData.personal, ['email']) && (
              <p>{extractDataSafely(safeData.personal, ['email'])}</p>
            )}
            {extractDataSafely(safeData.personal, ['phone']) && (
              <p>{extractDataSafely(safeData.personal, ['phone'])}</p>
            )}
            {extractDataSafely(safeData.personal, ['linkedin']) && (
              <a
                href={String(extractDataSafely(safeData.personal, ['linkedin']))}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Summary */}
        {safeData.summary && (
          <div className="mb-8">
            <h2 className={`text-2xl font-semibold mb-4 ${
              template === 'executive' ? 'uppercase tracking-wide border-b border-gray-300 pb-2' :
              template === 'modern' ? 'text-indigo-600' :
              ''
            }`}>
              {t('cv.sections.summary')}
            </h2>
            <p className={`text-gray-700 leading-relaxed ${
              template === 'minimal' ? 'text-sm' : ''
            }`}>
              {safeData.summary}
            </p>
          </div>
        )}

        {/* Experience */}
        {safeData.experience.length > 0 && (
          <div className="mb-8">
            <h2 className={`text-2xl font-semibold mb-4 ${
              template === 'executive' ? 'uppercase tracking-wide border-b border-gray-300 pb-2' :
              template === 'modern' ? 'text-indigo-600' :
              ''
            }`}>
              {t('cv.sections.experience')}
            </h2>
            <div className="space-y-6">
              {safeData.experience.map((exp, index) => (
                <div key={index} className={template === 'modern' ? 'border-l-2 border-indigo-200 pl-4' : ''}>
                  <h3 className={`text-xl font-semibold text-gray-900 ${
                    template === 'minimal' ? 'text-lg' : ''
                  }`}>
                    {extractDataSafely(exp, ['position'])}
                  </h3>
                  <div className="text-gray-600 mb-2">
                    <span className="font-medium">{extractDataSafely(exp, ['company'])}</span>
                    {extractDataSafely(exp, ['location']) && 
                      <span> • {extractDataSafely(exp, ['location'])}</span>
                    }
                    {extractDataSafely(exp, ['duration']) && (
                      <div className="text-sm mt-1">
                        {extractDataSafely(exp, ['duration'])}
                      </div>
                    )}
                  </div>
                  
                  {extractDataSafely(exp, ['responsibilities']) && 
                   Array.isArray(extractDataSafely(exp, ['responsibilities'])) && (
                    <ul className={`list-disc list-inside text-gray-700 mb-2 ${
                      template === 'minimal' ? 'text-sm' : ''
                    }`}>
                      {extractDataSafely(exp, ['responsibilities'], []).map((resp, idx) => (
                        <li key={idx} className="mb-1">{resp}</li>
                      ))}
                    </ul>
                  )}
                  
                  {extractDataSafely(exp, ['achievements']) && 
                   Array.isArray(extractDataSafely(exp, ['achievements'])) && (
                    <div className="mt-2">
                      <p className="font-medium text-gray-900">Key Achievements:</p>
                      <ul className={`list-disc list-inside text-gray-700 ${
                        template === 'minimal' ? 'text-sm' : ''
                      }`}>
                        {extractDataSafely(exp, ['achievements'], []).map((achievement, idx) => (
                          <li key={idx} className="mb-1">{achievement}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {safeData.education.length > 0 && (
          <div className="mb-8">
            <h2 className={`text-2xl font-semibold mb-4 ${
              template === 'executive' ? 'uppercase tracking-wide border-b border-gray-300 pb-2' :
              template === 'modern' ? 'text-indigo-600' :
              ''
            }`}>
              {t('cv.sections.education')}
            </h2>
            <div className="space-y-4">
              {safeData.education.map((edu, index) => (
                <div key={index} className={template === 'modern' ? 'border-l-2 border-indigo-200 pl-4' : ''}>
                  <h3 className={`text-xl font-semibold text-gray-900 ${
                    template === 'minimal' ? 'text-lg' : ''
                  }`}>
                    {extractDataSafely(edu, ['degree'])}
                  </h3>
                  <p className="text-gray-600">{extractDataSafely(edu, ['institution'])}</p>
                  <p className="text-gray-600 text-sm">{extractDataSafely(edu, ['year'])}</p>
                  {extractDataSafely(edu, ['honors']) && 
                   Array.isArray(extractDataSafely(edu, ['honors'])) && (
                    <ul className={`mt-2 list-disc list-inside text-gray-700 ${
                      template === 'minimal' ? 'text-sm' : ''
                    }`}>
                      {extractDataSafely(edu, ['honors'], []).map((honor, idx) => (
                        <li key={idx}>{honor}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {safeData.skills && (
          <div className="mb-8">
            <h2 className={`text-2xl font-semibold mb-6 ${
              template === 'executive' ? 'uppercase tracking-wide border-b border-gray-300 pb-2' :
              template === 'modern' ? 'text-indigo-600' :
              ''
            }`}>
              {t('cv.sections.skills')}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {extractDataSafely(safeData.skills, ['technical']) && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Technical Skills</h3>
                  <div className="space-y-2">
                    {extractDataSafely(safeData.skills, ['technical'], []).map((skill, index) => (
                      <div
                        key={index}
                        className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700"
                      >
                        {skill}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {extractDataSafely(safeData.skills, ['soft']) && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Soft Skills</h3>
                  <div className="space-y-2">
                    {extractDataSafely(safeData.skills, ['soft'], []).map((skill, index) => (
                      <div
                        key={index}
                        className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700"
                      >
                        {skill}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {extractDataSafely(safeData.skills, ['industry']) && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Industry Knowledge</h3>
                  <div className="space-y-2">
                    {extractDataSafely(safeData.skills, ['industry'], []).map((skill, index) => (
                      <div
                        key={index}
                        className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700"
                      >
                        {skill}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {Object.keys(safeData.additional).length > 0 && (
          <div>
            <h2 className={`text-2xl font-semibold mb-4 ${
              template === 'executive' ? 'uppercase tracking-wide border-b border-gray-300 pb-2' :
              template === 'modern' ? 'text-indigo-600' :
              ''
            }`}>
              {t('cv.sections.additional')}
            </h2>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
              template === 'minimal' ? 'text-sm' : ''
            }`}>
              {Object.entries(safeData.additional).map(([key, values]) => (
                values && values.length > 0 && (
                  <div key={key}>
                    <h3 className="font-semibold text-gray-900 capitalize mb-2">{key}</h3>
                    <ul className="list-disc list-inside text-gray-700">
                      {values.map((item, index) => (
                        <li key={index} className="mb-1">{item}</li>
                      ))}
                    </ul>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Warning if the CV is too large or complex to fully render */}
        {isLargeCV && (
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
              <div>
                <h3 className="text-amber-800 font-medium">{t('cv.complexCVWarning')}</h3>
                <p className="text-amber-700 text-sm mt-1">{t('cv.complexCVDescription')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CVTemplates;