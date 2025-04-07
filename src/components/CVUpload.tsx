import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Loader2, AlertCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { extractPdfText, parseCvText } from '../lib/api';
import { extractTextFromDOCX } from '../lib/documentParser';
import { saveParsedData } from '../lib/supabaseUtils';
import { createComponentLogger } from '../lib/logger';

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
  success?: boolean;
  cvData?: ParsedCVData | null;
  error?: string;
  [key: string]: any; // Allow for additional properties from API
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
  const [databaseSaveError, setDatabaseSaveError] = useState<string | null>(null);

  const logger = createComponentLogger('CVUpload');

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
    logger.log(`Starting file upload process for file: ${file.name}`);

    logger.log(`Detected file type: ${file.type}`);

    let filePath: string | null = null;

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(t('cv.upload.error.fileSize', { size: '10MB' }));
      }
      console.log("📂 File validated:", file.name, file.size);
      setProgress(10);

      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      const supabaseFileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const potentialFilePath = `${userId}/${supabaseFileName}`;
      try {
        console.log(`⬆️ Attempting Supabase storage upload: ${potentialFilePath}`);
        const { error: uploadError } = await supabase.storage
          .from('cvs')
          .upload(potentialFilePath, file, { cacheControl: '3600', upsert: false });
        if (uploadError) {
          console.warn(`⚠️ Supabase storage upload failed (continuing): ${uploadError.message}`);
          filePath = null;
        } else {
          console.log('✅ Supabase storage upload successful.');
          filePath = potentialFilePath;
        }
        setProgress(30);
      } catch (uploadCatchError: any) {
        console.warn(`⚠️ Error during Supabase storage upload attempt (continuing): ${uploadCatchError.message}`);
        filePath = null;
        setProgress(30);
      }

      console.log(`📄 Starting text extraction (${fileExt.toUpperCase()} file)`);
      setProgress(40);
      let apiResponse: ApiExtractionResponse | null = null;

      try {
        let textContent: string | null = null;

        // Step 1: Extract Raw Text
        if (fileExt === 'pdf') {
          console.log('🔄 Calling extractPdfText API...');
          const extractionResponse = await extractPdfText(file);
          console.log('✅ extractPdfText API call completed', extractionResponse);
          if (!extractionResponse?.success || !extractionResponse.result?.text) {
            throw new Error(extractionResponse?.error || t('cv.upload.error.pdfExtract'));
          }
          textContent = extractionResponse.result.text;
          console.log(`📄 Raw text extracted from PDF (${textContent.length} chars).`);
          setProgress(60); // Update progress after extraction
        } else if (fileExt === 'docx' || fileExt === 'doc') {
          console.log('🔄 Extracting text from Word doc locally...');
          textContent = await extractTextFromDOCX(file);
          if (!textContent) throw new Error(t('cv.upload.error.wordExtract'));
          console.log(`📄 Raw text extracted from DOCX (${textContent.length} chars).`);
          setProgress(60); // Update progress after extraction
        } else {
          throw new Error(t('cv.upload.error.unsupportedFormat', { format: fileExt }));
        }

        // Step 2: Parse the Extracted Text
        if (textContent) {
          console.log('🔄 Calling parseCvText API with extracted text...');
          apiResponse = await parseCvText(textContent);
          console.log('✅ parseCvText API call completed');
        } else {
          // Should not happen if extraction succeeded, but handle defensively
          throw new Error('Text content was empty after extraction.');
        }

      } catch (extractionOrParsingError: any) {
        console.error('❌ Text extraction or parsing failed:', extractionOrParsingError);
        let errorMessage = extractionOrParsingError.message || t('cv.upload.error.generic');
        if (extractionOrParsingError instanceof Error) {
          if (extractionOrParsingError.message.includes('aborted')) {
            errorMessage = t('cv.upload.error.timeout');
          } else if (extractionOrParsingError.message.includes('parseCvText') || 
                     extractionOrParsingError.message.includes('parse-text') || 
                     errorMessage.includes('API Error')) {
            // Catch errors from the parsing step more specifically
            errorMessage = t('cv.upload.error.apiError'); 
          } else if (errorMessage.includes('extractPdfText') || errorMessage.includes('extract-pdf')){
            // Catch errors from the text extraction step
             errorMessage = t('cv.upload.error.pdfExtract');
          }
        }
        throw new Error(errorMessage);
      }
      
      console.log('✅ Text extraction and parsing complete'); 
      setProgress(70);

      if (!apiResponse) {
        throw new Error(t('cv.upload.error.noApiResponse'));
      }
      console.log('🔍 API Response received, checking format:', apiResponse);

      // Handle response from API which may be in different formats
      let parsedData;
      
      // Debug what we got
      console.log('🔍 Debug - API Response structure:', 
                  Object.keys(apiResponse).length ? Object.keys(apiResponse).join(', ') : 'empty');
      
      // New format: {success: true, cvData: {...}}
      if (apiResponse.success && apiResponse.cvData) {
        console.log('✅ Found expected format with cvData');
        parsedData = apiResponse.cvData;
      } 
      // Backend format not updated yet: {success: true, result: {...}}
      else if (apiResponse.success && apiResponse.result) {
        console.log('✅ Found backend format with result');
        parsedData = apiResponse.result; 
      }
      // Direct data format
      else if (apiResponse.gpt_data || apiResponse.structured_data) {
        console.log('✅ Found legacy format with gpt_data/structured_data');
        parsedData = apiResponse;
      }
      // Try to recover data even if structure is unexpected
      else if (apiResponse.success === true && typeof apiResponse === 'object') {
        console.log('⚠️ Attempting to recover data from unexpected structure');
        
        // Look for any property that might contain our data
        const possibleDataFields = Object.keys(apiResponse).filter(key => 
          key !== 'success' && 
          key !== 'error' && 
          typeof apiResponse[key] === 'object' && 
          apiResponse[key] !== null
        );
        
        if (possibleDataFields.length > 0) {
          console.log('✅ Found potential data fields:', possibleDataFields.join(', '));
          // Use the first object-type field we find
          parsedData = apiResponse[possibleDataFields[0]];
        } else {
          // Last resort - use the whole response
          console.log('⚠️ No data fields found, using entire response');
          parsedData = apiResponse;
        }
      }
      // Invalid format
      else {
        console.error('❌ Invalid API response format:', apiResponse);
        
        // If we got an error message from the API, display it
        if (apiResponse.error) {
          throw new Error(`API Error: ${apiResponse.error}`);
        }
        
        // If response timed out or was aborted, show a more specific message
        if (String(apiResponse).includes('aborted') || String(apiResponse).includes('timeout')) {
          throw new Error(t('cv.upload.error.timeout'));
        }
        
        // Default generic error
        throw new Error(t('cv.upload.error.apiError'));
      }
      
      setParsedData(parsedData);
      console.log('✅ CV data successfully parsed by API.');
      setProgress(80);

      try {
        console.log('🔄 Attempting to save parsed data via saveParsedData function...');
        try {
          await saveParsedData(userId, file.name, filePath, parsedData);
          console.log('✅ CV data successfully saved to database.');
          setDatabaseSaveError(null); // Clear any previous errors
        } catch (dbError: any) {
          console.error('❌ DATABASE SAVE ERROR:', dbError);
          // Show detailed diagnostics in console but don't stop the flow
          console.warn('⚠️ CV was successfully parsed but could not be saved to the database.');
          console.warn('⚠️ This is often due to Supabase configuration issues:');
          console.warn('1. Check if the "parsed_cvs" or "cvs" table exists in your Supabase project');
          console.warn('2. Verify Row Level Security (RLS) policies allow inserts');
          console.warn('3. Check column names match the keys in dataToInsert object');
          
          // Set a user-friendly database error but don't block main flow
          setDatabaseSaveError('Your CV was processed successfully, but couldn\'t be stored in your account database. '
            + 'You can still work with it in this session. Error: ' + (dbError.message || 'Database connection issue'));
        }
        
        // Continue with successful flow regardless of DB save outcome
        setProgress(95);
        onUploadSuccess(parsedData);
      } catch (e: any) {
        // This catch is just a safety net for completely unexpected errors
        console.error('❌ Unexpected error in database save process:', e);
        setError(t('cv.upload.error.generic'));
        onUploadSuccess(parsedData); // Still try to continue with the flow
      }

      console.log("🎉 CV Processing complete:", new Date().toISOString());
      setProgress(100);

    } catch (err: any) {
      console.error('❌ Error during overall CV processing pipeline:', err);
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

  const handleRemoveFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
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
          ${parsedData && !isLoading && !error ? 'border-green-500 bg-green-50' : ''}
          `}
      >
        <input {...getInputProps()} disabled={isLoading} />
        
        {isLoading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-4" />
            <p className="text-sm text-gray-600">{t('cv.upload.processing')}: {fileName || t('cv.upload.yourCv')}...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-4 dark:bg-gray-700">
               <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">({progress}%)</p>
          </div>
        ) : parsedData ? (
          <div className="flex items-center justify-center text-left relative text-green-700">
            <FileText className="w-10 h-10 text-green-500 mr-3 flex-shrink-0" />
            <div>
                <p className="font-medium">{t('cv.upload.processedSuccess')}</p>
                <p className="text-sm break-all">{fileName}</p>
            </div>
            <button 
                onClick={handleRemoveFile}
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
                    onClick={handleRemoveFile}
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

      {databaseSaveError && !isLoading && !error && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg flex items-center border border-yellow-200">
          <AlertCircle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
          <div>
              <p className="font-medium text-yellow-700">Storage Notice</p>
              <p className="text-sm text-yellow-600">{databaseSaveError}</p>
          </div>
          <button
                onClick={() => setDatabaseSaveError(null)}
                className="ml-auto p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                aria-label={t('common.dismiss')}
            >
                <XCircle className="w-5 h-5" />
           </button>
        </div>
      )}

      {error && !isLoading && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg flex items-center border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
          <div>
              <p className="font-medium text-red-700">{t('cv.upload.error.title')}</p>
              <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
                onClick={() => setError(null)}
                className="ml-auto p-1 text-gray-400 hover:text-red-600 transition-colors"
                aria-label={t('common.dismiss')}
            >
                <XCircle className="w-5 h-5" />
           </button>
        </div>
      )}
    </div>
  );
}