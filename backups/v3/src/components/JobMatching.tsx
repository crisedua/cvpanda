import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle, Search, FileText, Briefcase, BarChart, Percent } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  storeJobDescription, 
  storeCV, 
  matchCVToJob, 
  matchJobToCV, 
  calculateMatchScore,
  JobMatchResult,
  CVMatchResult
} from '../lib/pinecone';
import TransitionWrapper from './TransitionWrapper';
import type { CV } from '../types';

interface JobListing {
  id: string;
  title: string;
  company: string;
  description: string;
  created_at: string;
  user_id: string;
}

interface MatchResult {
  id: string;
  title?: string;
  company?: string;
  name?: string;
  score: number;
}

const JobMatching = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [jobListings, setJobListings] = useState<JobListing[]>([]);
  const [userCVs, setUserCVs] = useState<CV[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchUserCVs();
      fetchJobListings();
    }
  }, [user]);

  const fetchUserCVs = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (data) setUserCVs(data);
    } catch (err) {
      console.error('Error fetching CVs:', err);
      setError(t('job.error.fetch.cvs'));
    }
  };

  const fetchJobListings = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('job_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (data) setJobListings(data);
    } catch (err) {
      console.error('Error fetching job listings:', err);
      setError(t('job.error.fetch.jobs'));
    }
  };

  const handleJobDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(e.target.value);
  };

  const saveJobListing = async () => {
    if (!user || !jobDescription.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setProcessingStage(t('job.saving'));

      // Save to Supabase
      const { data, error: insertError } = await supabase
        .from('job_listings')
        .insert({
          title: 'New Job Listing',
          description: jobDescription,
          user_id: user.id,
          company: 'My Company'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!data) throw new Error('Failed to save job listing');

      // Store in Pinecone
      await storeJobDescription(data.id, jobDescription);

      // Update job listings
      setJobListings(prev => [data, ...prev]);
      setJobDescription('');
      
      setProcessingStage('');
      setLoading(false);
    } catch (err) {
      console.error('Error saving job listing:', err);
      setError(t('job.error.save'));
      setLoading(false);
    }
  };

  const findMatchingCVs = async (jobId: string) => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);
      setProcessingStage(t('job.finding'));
      setSelectedJobId(jobId);
      setSelectedCVId(null);

      // Get job description
      const job = jobListings.find(job => job.id === jobId);
      if (!job) throw new Error('Job not found');

      // Find matching CVs
      const matches: CVMatchResult[] = await matchJobToCV(jobId, 10);
      
      // Map to human-readable results
      const cvMatches: MatchResult[] = [];
      
      for (const match of matches) {
        const cv = userCVs.find(cv => cv.id === match.cvId);
        if (cv) {
          cvMatches.push({
            id: cv.id,
            name: cv.parsed_data?.personal?.name || 'Unnamed CV',
            score: match.score
          });
        }
      }
      
      setMatchResults(cvMatches);
      setProcessingStage('');
      setLoading(false);
    } catch (err) {
      console.error('Error finding matching CVs:', err);
      setError(t('job.error.match'));
      setLoading(false);
    }
  };

  const findMatchingJobs = async (cvId: string) => {
    if (!cvId) return;

    try {
      setLoading(true);
      setError(null);
      setProcessingStage(t('job.finding'));
      setSelectedCVId(cvId);
      setSelectedJobId(null);

      // Get CV
      const cv = userCVs.find(cv => cv.id === cvId);
      if (!cv) throw new Error('CV not found');

      // Make sure CV is in Pinecone
      const cvText = JSON.stringify(cv.parsed_data);
      await storeCV(cvId, cvText);

      // Find matching jobs
      const matches: JobMatchResult[] = await matchCVToJob(cvId, 10);
      
      // Map to human-readable results
      const jobMatches: MatchResult[] = [];
      
      for (const match of matches) {
        const job = jobListings.find(job => job.id === match.jobId);
        if (job) {
          jobMatches.push({
            id: job.id,
            title: job.title,
            company: job.company,
            score: match.score
          });
        }
      }
      
      setMatchResults(jobMatches);
      setProcessingStage('');
      setLoading(false);
    } catch (err) {
      console.error('Error finding matching jobs:', err);
      setError(t('job.error.match'));
      setLoading(false);
    }
  };

  return (
    <TransitionWrapper>
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {t('job.matching')}
        </h2>

        {/* New Job Description */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">
            {t('job.add')}
          </h3>
          <textarea
            value={jobDescription}
            onChange={handleJobDescriptionChange}
            className="w-full border rounded-md p-3 mb-4 h-32 bg-white text-gray-900"
            placeholder={t('job.paste')}
            disabled={loading}
          />
          <button
            onClick={saveJobListing}
            disabled={loading || !jobDescription.trim()}
            className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              t('job.save')
            )}
          </button>
        </div>

        {/* Match Finder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* CV Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              {t('job.cv.select')}
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {userCVs.length === 0 ? (
                <p className="text-gray-500">{t('job.no.cvs')}</p>
              ) : (
                userCVs.map(cv => (
                  <div 
                    key={cv.id}
                    onClick={() => !loading && findMatchingJobs(cv.id)}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                      selectedCVId === cv.id ? 'border-indigo-500 bg-indigo-50' : ''
                    }`}
                  >
                    <p className="font-medium">{cv.parsed_data?.personal?.name || 'Unnamed CV'}</p>
                    <p className="text-sm text-gray-500">{new Date(cv.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Job Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center">
              <Briefcase className="h-5 w-5 mr-2" />
              {t('job.select')}
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {jobListings.length === 0 ? (
                <p className="text-gray-500">{t('job.no.jobs')}</p>
              ) : (
                jobListings.map(job => (
                  <div 
                    key={job.id}
                    onClick={() => !loading && findMatchingCVs(job.id)}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 ${
                      selectedJobId === job.id ? 'border-indigo-500 bg-indigo-50' : ''
                    }`}
                  >
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-gray-500">{job.company}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Match Results */}
        {matchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="font-semibold text-lg mb-4 flex items-center">
              <BarChart className="h-5 w-5 mr-2" />
              {selectedJobId 
                ? t('job.match.cvs')
                : t('job.match.jobs')
              }
            </h3>
            <div className="space-y-4">
              {matchResults.map(result => (
                <div key={result.id} className="p-4 border rounded-md">
                  {selectedJobId ? (
                    <p className="font-medium">{result.name}</p>
                  ) : (
                    <>
                      <p className="font-medium">{result.title}</p>
                      <p className="text-sm text-gray-600">{result.company}</p>
                    </>
                  )}
                  <div className="flex items-center mt-2">
                    <Percent className="h-4 w-4 mr-1 text-indigo-600" />
                    <p className="text-indigo-600 font-medium">
                      {Math.round(result.score * 100)}% {t('job.match')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading & Error States */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mr-2" />
            <p className="text-indigo-600 font-medium">{processingStage}</p>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-red-50 rounded-lg flex items-center mt-6">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </TransitionWrapper>
  );
};

export default JobMatching; 