import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { searchJobs, JobSearchResult } from '../lib/api';
import { createComponentLogger } from '../lib/logger';
// Import necessary hooks/context to get current CV data - Placeholder
// import { useCurrentCv } from '../contexts/CvContext'; // Example

const logger = createComponentLogger('JobSearch');

export default function JobSearch() {
  const { t } = useTranslation();
  const [interest, setInterest] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<JobSearchResult[]>([]);

  // --- Placeholder: Fetch current CV data and pre-fill inputs ---
  useEffect(() => {
    // TODO: Replace with actual logic to get current CV data
    const currentCvData = { job_title: 'Software Engineer', location: 'Santiago, Chile' }; // Dummy data
    logger.log('Fetching current CV data (placeholder)', currentCvData);
    if (currentCvData) {
      setInterest(currentCvData.job_title || '');
      setLocation(currentCvData.location || '');
    }
  }, []); // Run once on component mount
  // ---------------------------------------------------------------

  const handleSearch = async () => {
    if (!interest || !location) {
      setError(t('jobSearch.error.missingFields'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    logger.log(`Initiating job search with interest: "${interest}", location: "${location}"`);

    try {
      const response = await searchJobs(interest, location);
      if (response.success && response.jobs) {
        logger.log(`Search successful, received ${response.jobs.length} results.`);
        setResults(response.jobs);
      } else {
        logger.error('Job search failed:', response.error);
        setError(response.error || t('jobSearch.error.generic'));
      }
    } catch (err: any) {
      logger.error('Exception during job search:', err);
      setError(err.message || t('jobSearch.error.exception'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-6">{t('jobSearch.title')}</h1>

      {/* Search Input Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-grow">
          <label htmlFor="interest" className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobSearch.interestLabel')}
          </label>
          <input
            type="text"
            id="interest"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder={t('jobSearch.interestPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
        <div className="flex-grow">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobSearch.locationLabel')}
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('jobSearch.locationPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !interest || !location}
          className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="animate-spin h-5 w-5 mr-2" />
          ) : (
            <Search className="h-5 w-5 mr-2" />
          )}
          {isLoading ? t('jobSearch.searching') : t('jobSearch.searchButton')}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">{t('error.title')} </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-10">
          <Loader2 className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" />
          <p>{t('jobSearch.loadingResults')}</p>
        </div>
      )}

      {/* Results Section */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">{t('jobSearch.resultsTitle')} ({results.length})</h2>
          {results.map((job, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-blue-700">
                <a href={job.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {job.title}
                </a>
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                {job.company} - {job.location}
              </p>
              <p className="text-sm text-gray-700">
                {job.description}
              </p>
              <p className="text-xs text-gray-500 mt-2">Source: {job.source}</p>
            </div>
          ))}
        </div>
      )}

      {/* No Results Found */}
      {!isLoading && !error && results.length === 0 && (
          <div className="text-center py-10 text-gray-500">
              <p>{t('jobSearch.noResults')}</p>
          </div>
      )}

    </div>
  );
} 