import React, { useState } from 'react';
import { Layout, FileText } from 'lucide-react';
import type { CV } from '../types';
import CVTemplates from './CVTemplates';

interface ParsedCVProps {
  cv: CV;
  language?: 'original' | 'english';
}

const ParsedCV: React.FC<ParsedCVProps> = ({ cv, language = 'original' }) => {
  const [template, setTemplate] = useState<'modern' | 'classic' | 'minimal' | 'executive'>('modern');
  
  return (
    <div className="space-y-6">
      {/* Template Selector */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <Layout className="h-5 w-5 text-gray-500" />
          <div className="flex-1">
            <label htmlFor="template" className="block text-sm font-medium text-gray-700">
              Select Template
            </label>
            <select
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
              <option value="executive">Executive</option>
            </select>
          </div>
        </div>
      </div>

      {/* CV Content */}
      <CVTemplates cv={cv} language={language} template={template} />
    </div>
  );
};

export default ParsedCV;