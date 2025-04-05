import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle, AlertCircle, Upload } from 'lucide-react';

interface ParsedCV {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'stored' | 'error';
  error?: string;
}

const StoreExistingCVs: React.FC = () => {
  const { t } = useTranslation();
  const [cvs, setCvs] = useState<ParsedCV[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the proxied API URL through Vite instead of direct connection
  const API_URL = '/api'; // This will be proxied to http://localhost:3001/api by Vite

  const uploadFilesToServer = async (files: File[]) => {
    if (files.length === 0) return;
    
    setLoading(true);
    setMessage(t('pinecone.store.storing'));
    
    try {
      // Add files to the CVs list with pending status
      const newCVs = files.map(file => ({
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        status: 'processing' as const
      }));
      
      setCvs(prev => [...prev, ...newCVs]);
      
      // Create FormData
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      
      console.log('Uploading files to:', `${API_URL}/store-multiple-cvs`);
      
      // Make API call
      const response = await fetch(`${API_URL}/store-multiple-cvs`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        console.error('Server response error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Server response:', data);
      
      // Update CVs with server response
      setCvs(prev => {
        const updated = [...prev];
        const serverResults = data.results || [];
        
        // Match server results with temporary CV entries
        serverResults.forEach((result: any, index: number) => {
          // Find the temporary entry that corresponds to this result
          const tempIndex = updated.findIndex(cv => 
            cv.status === 'processing' && 
            cv.name === files[index].name && 
            cv.id.startsWith('temp-')
          );
          
          if (tempIndex !== -1) {
            // Update with server result
            updated[tempIndex] = {
              id: result.cvId,
              name: result.fileName,
              status: result.success ? 'stored' : 'error',
              error: result.error
            };
          }
        });
        
        return updated;
      });
      
      setMessage(t('pinecone.store.success'));
    } catch (error: any) {
      console.error('Error uploading files:', error);
      
      // Mark all processing CVs as error
      setCvs(prev => prev.map(cv => 
        cv.status === 'processing' 
          ? { ...cv, status: 'error', error: error.message } 
          : cv
      ));
      
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const files = Array.from(event.target.files);
    uploadFilesToServer(files);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    const files = Array.from(e.dataTransfer.files);
    uploadFilesToServer(files);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{t('pinecone.store.title')}</h3>
      
      <p className="mb-4">
        {t('pinecone.store.description')}
      </p>
      
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h4 className="text-lg font-medium mb-2">Drag and drop CV files or click to browse</h4>
        <p className="text-sm text-gray-500">Supported formats: PDF, DOC, DOCX, TXT, JSON</p>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          multiple 
          accept=".pdf,.doc,.docx,.txt,.json"
        />
      </div>
      
      {loading && (
        <div className="flex items-center mb-4">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <p>{t('common.loading')}</p>
        </div>
      )}
      
      {message && (
        <div className={`border rounded-md p-3 mb-4 ${
          message.startsWith('Error') 
            ? 'bg-red-50 text-red-700' 
            : 'bg-blue-50 text-blue-700'
        }`}>
          {message}
        </div>
      )}
      
      {cvs.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CV</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cvs.map(cv => (
                <tr key={cv.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {cv.name || t('Unnamed CV')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {cv.status === 'processing' && (
                      <div className="flex items-center text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>{t('pinecone.store.processing')}...</span>
                      </div>
                    )}
                    {cv.status === 'stored' && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span>{t('pinecone.store.stored')}</span>
                      </div>
                    )}
                    {cv.status === 'error' && (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span>
                          {t('pinecone.store.error')}
                          {cv.error && <span className="text-xs ml-2">({cv.error})</span>}
                        </span>
                      </div>
                    )}
                    {cv.status === 'pending' && (
                      <span className="text-gray-500">{t('pinecone.store.pending')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StoreExistingCVs;