import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { extractTextFromFile } from '../lib/documentParser';
import { parseCV } from '../lib/gpt';
import ParsedCV from './ParsedCV';
import LoadingScreen from './LoadingScreen';
import ProgressBar from './ProgressBar';
import TransitionWrapper from './TransitionWrapper';
import type { CV } from '../types';

const UPLOAD_STEPS = ['Upload', 'Extract', 'Analyze', 'Save'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const CVUpload = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedCV, setParsedCV] = useState<CV | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<string>('');

  const updateProgress = (step: number, subProgress: number = 0) => {
    const baseProgress = (step / UPLOAD_STEPS.length) * 100;
    const stepProgress = (subProgress / 100) * (100 / UPLOAD_STEPS.length);
    setProgress(Math.min(baseProgress + stepProgress, 100));
    setCurrentStep(step);
  };

  const processFile = async (file: File) => {
    if (!user) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(t('cv.upload.error.fileSize', { size: '10MB' }));
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    setCurrentStep(0);

    try {
      // Step 1: Upload
      setProcessingStage(t('cv.upload.uploading'));
      updateProgress(0, 50);
      
      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop();
      const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cvs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      
      updateProgress(0, 100);

      // Step 2: Extract
      setProcessingStage(t('cv.upload.extracting'));
      updateProgress(1, 50);
      const extractedText = await extractTextFromFile(file);
      updateProgress(1, 100);

      // Step 3: Analyze
      setProcessingStage(t('cv.upload.analyzing'));
      updateProgress(2, 50);
      const parsedData = await parseCV(extractedText);
      updateProgress(2, 100);

      // Step 4: Save
      setProcessingStage(t('cv.upload.saving'));
      updateProgress(3, 50);
      
      const { data: cv, error: insertError } = await supabase
        .from('cvs')
        .insert({
          user_id: user.id,
          filename: file.name,
          file_path: filePath,
          parsed_data: parsedData,
          is_favorite: false
        })
        .select()
        .single();

      if (insertError) throw new Error(`Database error: ${insertError.message}`);

      updateProgress(3, 100);
      setParsedCV(cv);
    } catch (err) {
      console.error('Upload error:', err);
      
      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('OpenAI API key')) {
          setError(t('cv.upload.error.api'));
        } else if (err.message.includes('Upload failed')) {
          setError(t('cv.upload.error.uploadFailed'));
        } else if (err.message.includes('Database error')) {
          setError(t('cv.upload.error.database'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('cv.upload.error.generic'));
      }

      // Clean up storage if upload succeeded but later steps failed
      if (err instanceof Error && !err.message.includes('Upload failed')) {
        try {
          await supabase.storage
            .from('cvs')
            .remove([`${user.id}/${file.name}`]);
        } catch (cleanupError) {
          console.error('Failed to clean up uploaded file:', cleanupError);
        }
      }
    } finally {
      setLoading(false);
      setProcessingStage('');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => processFile(files[0]),
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: loading
  });

  if (!user) {
    return (
      <TransitionWrapper>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  {t('auth.required')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </TransitionWrapper>
    );
  }

  return (
    <TransitionWrapper>
      <div className="max-w-6xl mx-auto p-6">
        {!parsedCV ? (
          <div className="space-y-8">
            {/* Progress Bar */}
            {loading && (
              <div className="mb-8">
                <ProgressBar
                  progress={progress}
                  steps={UPLOAD_STEPS}
                  currentStep={currentStep}
                />
              </div>
            )}

            {/* Upload Area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
              }`}
            >
              <input {...getInputProps()} />
              {loading ? (
                <div className="space-y-4">
                  <LoadingScreen
                    message={processingStage}
                    showTips={true}
                    size="medium"
                  />
                </div>
              ) : (
                <>
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-lg text-gray-600">{t('cv.upload.title')}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    {t('cv.upload.dragDrop')}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {t('cv.upload.formats')}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{t('cv.upload.parsed')}</h2>
              <button
                onClick={() => {
                  setParsedCV(null);
                  setProgress(0);
                  setCurrentStep(0);
                }}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Upload className="h-5 w-5 mr-2" />
                {t('cv.upload.new')}
              </button>
            </div>
            <ParsedCV cv={parsedCV} />
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </TransitionWrapper>
  );
};

export default CVUpload;