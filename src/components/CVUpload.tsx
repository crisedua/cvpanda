import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Loader2, AlertCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { extractPdfText, parseCvText } from '../lib/api';
import { extractTextFromDOCX } from '../lib/documentParser';
import type { CV } from '../types';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { saveParsedData } from '@/lib/supabaseUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ParsedCVData {
  full_text?: string;
  name?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location?: string;
  job_title?: string;
  summary?: string;
  skills?: { technical?: string[], soft?: string[], industry?: string[] } | string[];
  work_experience?: {
    company: string;
    position: string;
    dates?: string;
    duration?: string;
    responsibilities?: string[];
    achievements?: string[];
    location?: string;
  }[];
  education?: {
    institution: string;
    degree: string;
    year?: string;
    dates?: string;
    honors?: string[];
  }[];
  [key: string]: any;
}

interface ApiExtractionResponse {
  success: boolean;
  cvData: ParsedCVData | null;
  error?: string;
}

interface CVUploadProps {
  onUploadSuccess: (data: ParsedCVData) => void;
}

export default function CVUpload({ onUploadSuccess }: CVUploadProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCVData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const processFile = useCallback(async (file: File) => {
    if (!user) {
      setError(t('auth.required'));
      return;
    }
    const userId = user.id;

    setIsLoading(true);
    setError(null);
    setParsedData(null);
    setFileName(file.name);
    setProgress(0);

    let filePath = '';

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(t('cv.upload.error.fileSize', { size: '10MB' }));
      }
      setProgress(10);

      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const supabaseFileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      filePath = `${userId}/${supabaseFileName}`;
      try {
        console.log(`Attempting upload: ${filePath}`);
        const { error: uploadError } = await supabase.storage
          .from('cvs')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        console.log('Upload successful');
        setProgress(30);
      } catch (uploadError: any) {
        console.warn(`Supabase storage upload failed (continuing): ${uploadError.message}`);
        filePath = '';
        setProgress(30);
      }

      setProgress(40);
      let apiResponse: ApiExtractionResponse | null = null;

      if (fileExt === 'pdf') {
        console.log('Calling extractPdfText API...');
        apiResponse = await extractPdfText(file);
      } else if (fileExt === 'docx' || fileExt === 'doc') {
        console.log('Extracting text from Word doc...');
        const textContent = await extractTextFromDOCX(file);
        if (!textContent) throw new Error(t('cv.upload.error.wordExtract'));
        console.log('Calling parseCvText API...');
        apiResponse = await parseCvText(textContent);
      } else {
        throw new Error(t('cv.upload.error.unsupportedFormat', { format: fileExt }));
      }
      setProgress(70);

      if (!apiResponse) {
        throw new Error(t('cv.upload.error.noApiResponse'));
      }
      console.log('API Response received.');

      if (!apiResponse.success || !apiResponse.cvData) {
        throw new Error(apiResponse.error || t('cv.upload.error.apiError'));
      }
      
      setParsedData(apiResponse.cvData);
      console.log('CV successfully parsed.');
      setProgress(80);

      try {
        console.log('Saving parsed data to database...');
        await saveParsedData(userId, file.name, filePath, apiResponse.cvData);
        console.log('Saved parsed data to database.');
        setProgress(95);
        onUploadSuccess(apiResponse.cvData);
      } catch (dbError: any) {
        console.error('Database save failed:', dbError);
        setError(t('cv.upload.error.dbSaveError', { message: dbError.message || 'Unknown error' }));
        onUploadSuccess(apiResponse.cvData);
      }

      setProgress(100);

    } catch (err: any) {
      console.error('Error during CV processing:', err);
      setError(err.message || t('cv.upload.error.generic'));
      setParsedData(null);
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  }, [user, onUploadSuccess, t]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    multiple: false,
    maxSize: MAX_FILE_SIZE,
    disabled: isLoading,
  });

  const handleRemoveFile = () => {
    setFileName(null);
    setError(null);
    setParsedData(null);
    setProgress(0);
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200 ease-in-out
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          ${isLoading ? 'cursor-not-allowed opacity-60' : ''}
          ${parsedData ? 'border-green-500 bg-green-50' : ''}
          `}
      >
        <input {...getInputProps()} disabled={isLoading} />
        
        {isLoading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-4" />
            <p className="text-sm text-gray-600">{t('cv.upload.processing')}: {fileName || t('cv.upload.yourCv')}...</p>
            <Progress value={progress} className="w-full mt-4 h-2" />
            <p className="text-xs text-gray-500 mt-1">{progress}%</p>
          </div>
        ) : parsedData ? (
          <div className="flex items-center justify-center text-left relative text-green-700">
            <FileText className="w-10 h-10 text-green-500 mr-3 flex-shrink-0" />
            <div>
                <p className="font-medium">{t('cv.upload.processedSuccess')}</p>
                <p className="text-sm break-all">{fileName}</p>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                className="absolute top-0 right-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                aria-label={t('cv.upload.removeFile')}
            >
                <XCircle className="w-5 h-5" />
            </button>
          </div>
        ): (
          fileName && !error ? (
            <div className="flex items-center justify-center text-left relative">
                <FileText className="w-10 h-10 text-blue-500 mr-3 flex-shrink-0" />
                <div>
                    <p className="font-medium text-gray-700">{t('cv.upload.fileReady')}:</p>
                    <p className="text-sm text-gray-600 break-all">{fileName}</p>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                    className="absolute top-0 right-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label={t('cv.upload.removeFile')}
                >
                    <XCircle className="w-5 h-5" />
                </button>
              </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-gray-700 font-medium">
                {isDragActive ? t('cv.upload.dropHere') : t('cv.upload.dragDrop')}
              </p>
              <p className="text-sm text-gray-500 mt-1">{t('cv.upload.formatsLimited')}</p>
            </div>
          )
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('cv.upload.error.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}