import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Radar, Plus, Filter, BarChart, Search, Trash2, Edit, 
  RefreshCw, Bell, Calendar, MapPin, Briefcase, DollarSign,
  Tag, Save, CheckCircle, Clock, ExternalLink, Linkedin, Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchJobScanFilters, fetchScannedJobs, updateScannedJobStatus, runJobScanNow } from '../lib/api';
import TransitionWrapper from './TransitionWrapper';
import ProgressBar from './ProgressBar';
import { JobScanFilter, ScannedJob } from '../types/index';

const JobScanner: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'jobs' | 'filters'>('jobs');
  const [filters, setFilters] = useState<JobScanFilter[]>([]);
  const [jobs, setJobs] = useState<ScannedJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeJobStatus, setActiveJobStatus] = useState<ScannedJob['status'] | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showFilterForm, setShowFilterForm] = useState<boolean>(false);
  const [jobDetailsId, setJobDetailsId] = useState<string | null>(null);
  const [runningFilter, setRunningFilter] = useState<string | null>(null);
  
  // Pre-defined job sources (in a real app, these would come from the server)
  const jobSources = [
    { id: 'linkedin', name: 'LinkedIn', icon: 'Linkedin', url: 'https://www.linkedin.com' },
    { id: 'indeed', name: 'Indeed', icon: 'Search', url: 'https://www.indeed.com' },
    { id: 'glassdoor', name: 'Glassdoor', icon: 'Building', url: 'https://www.glassdoor.com' },
    { id: 'monster', name: 'Monster', icon: 'Globe', url: 'https://www.monster.com' },
    { id: 'ziprecruiter', name: 'ZipRecruiter', icon: 'Briefcase', url: 'https://www.ziprecruiter.com' },
    { id: 'company', name: 'Company Websites', icon: 'Globe', url: '' },
  ];
  
  useEffect(() => {
    if (user?.id) {
      loadFilters();
      loadJobs();
    }
  }, [user?.id, activeFilter, activeJobStatus, currentPage]);
  
  const loadFilters = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await fetchJobScanFilters(user.id);
      setFilters(data);
      
      // Set the first filter as active if none is selected
      if (!activeFilter && data.length > 0) {
        setActiveFilter(data[0].id);
      }
    } catch (err) {
      console.error('Error loading filters:', err);
      setError('Failed to load job scan filters');
    } finally {
      setLoading(false);
    }
  };
  
  const loadJobs = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const data = await fetchScannedJobs(user.id, activeFilter, activeJobStatus, currentPage);
      setJobs(data.jobs);
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError('Failed to load scanned jobs');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRunScan = async (filterId: string) => {
    try {
      setRunningFilter(filterId);
      await runJobScanNow(filterId);
      // In a real app, you'd probably want to poll for results or use websockets
      // For now, just wait a bit and then reload the jobs
      setTimeout(() => {
        loadJobs();
        setRunningFilter(null);
      }, 3000);
    } catch (err) {
      console.error('Error running scan:', err);
      setError('Failed to run job scan');
      setRunningFilter(null);
    }
  };
  
  const handleUpdateJobStatus = async (jobId: string, status: ScannedJob['status']) => {
    try {
      await updateScannedJobStatus(jobId, status);
      
      // Update local state
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status } : job
        )
      );
    } catch (err) {
      console.error('Error updating job status:', err);
      setError('Failed to update job status');
    }
  };
  
  const jobStatusCounts = {
    new: jobs.filter(job => job.status === 'new').length,
    viewed: jobs.filter(job => job.status === 'viewed').length,
    saved: jobs.filter(job => job.status === 'saved').length,
    applied: jobs.filter(job => job.status === 'applied').length,
    rejected: jobs.filter(job => job.status === 'rejected').length,
  };

  // Get the selected job for the details view
  const selectedJob = jobDetailsId ? jobs.find(job => job.id === jobDetailsId) : null;
  
  // Get the active filter details
  const activeFilterDetails = activeFilter ? filters.find(filter => filter.id === activeFilter) : null;
  
  const renderJobStatusFilter = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        className={`px-3 py-1 rounded-full text-sm flex items-center ${
          activeJobStatus === null 
            ? 'bg-indigo-100 text-indigo-800' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => setActiveJobStatus(null)}
      >
        All ({jobs.length})
      </button>
      <button
        className={`px-3 py-1 rounded-full text-sm flex items-center ${
          activeJobStatus === 'new' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => setActiveJobStatus('new')}
      >
        <Clock className="h-3 w-3 mr-1" />
        New ({jobStatusCounts.new})
      </button>
      <button
        className={`px-3 py-1 rounded-full text-sm flex items-center ${
          activeJobStatus === 'saved' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => setActiveJobStatus('saved')}
      >
        <Save className="h-3 w-3 mr-1" />
        Saved ({jobStatusCounts.saved})
      </button>
      <button
        className={`px-3 py-1 rounded-full text-sm flex items-center ${
          activeJobStatus === 'applied' 
            ? 'bg-purple-100 text-purple-800' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => setActiveJobStatus('applied')}
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Applied ({jobStatusCounts.applied})
      </button>
      <button
        className={`px-3 py-1 rounded-full text-sm flex items-center ${
          activeJobStatus === 'rejected' 
            ? 'bg-red-100 text-red-800' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => setActiveJobStatus('rejected')}
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Rejected ({jobStatusCounts.rejected})
      </button>
    </div>
  );
  
  const renderJobsList = () => {
    if (loading && jobs.length === 0) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      );
    }
    
    if (jobs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <Search className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('jobScanner.noJobsFound')}</h3>
          <p className="text-gray-500 mb-6">
            {activeFilter 
              ? t('jobScanner.noJobsMatchFilter')
              : t('jobScanner.noFiltersYet')}
          </p>
          {activeFilter && (
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
              onClick={() => handleRunScan(activeFilter)}
              disabled={runningFilter === activeFilter}
            >
              {runningFilter === activeFilter ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  {t('jobScanner.scanning')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  {t('jobScanner.runScanNow')}
                </>
              )}
            </button>
          )}
        </div>
      );
    }
    
    return (
      <div className={`grid ${jobDetailsId ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
        {/* Job List */}
        <div className="space-y-4">
          {jobs.map(job => (
            <div 
              key={job.id} 
              className={`p-4 border rounded-lg hover:shadow-md cursor-pointer transition-shadow ${
                jobDetailsId === job.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
              }`}
              onClick={() => {
                setJobDetailsId(job.id);
                if (job.status === 'new') {
                  handleUpdateJobStatus(job.id, 'viewed');
                }
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-lg">{job.jobTitle}</h3>
                  <p className="text-gray-600">{job.company}</p>
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{job.location}</span>
                  </div>
                </div>
                <div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    job.matchScore > 85 ? 'bg-green-100 text-green-800' :
                    job.matchScore > 70 ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {t('jobScanner.matchScore', { score: job.matchScore })}
                  </span>
                </div>
              </div>
              
              <div className="mt-3 flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {t('jobScanner.posted', { date: new Date(job.postedDate).toLocaleDateString() })}
                </div>
                <div className="flex space-x-1">
                  {job.status !== 'saved' && (
                    <button
                      className="p-1 text-gray-500 hover:text-indigo-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateJobStatus(job.id, 'saved');
                      }}
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  )}
                  {job.status !== 'applied' && (
                    <button
                      className="p-1 text-gray-500 hover:text-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateJobStatus(job.id, 'applied');
                      }}
                      title="Mark as applied"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                  {job.status !== 'rejected' && (
                    <button
                      className="p-1 text-gray-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateJobStatus(job.id, 'rejected');
                      }}
                      title="Reject"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Job Details */}
        {jobDetailsId && selectedJob && (
          <div className="border rounded-lg p-6 bg-white shadow-md">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{selectedJob.jobTitle}</h3>
              <div className="flex space-x-2">
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-gray-500 hover:text-indigo-600"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
                <button
                  className="p-1 text-gray-500 hover:text-gray-700"
                  onClick={() => setJobDetailsId(null)}
                  title="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center text-gray-700 mb-2">
                <Briefcase className="h-5 w-5 mr-2" />
                <span className="font-medium">{selectedJob.company}</span>
              </div>
              <div className="flex items-center text-gray-700 mb-2">
                <MapPin className="h-5 w-5 mr-2" />
                <span>{selectedJob.location}</span>
              </div>
              {selectedJob.salary && (
                <div className="flex items-center text-gray-700 mb-2">
                  <DollarSign className="h-5 w-5 mr-2" />
                  <span>{selectedJob.salary}</span>
                </div>
              )}
              <div className="flex items-center text-gray-700 mb-2">
                <Tag className="h-5 w-5 mr-2" />
                <span>{selectedJob.jobType}</span>
              </div>
              <div className="flex items-center text-gray-700 mb-2">
                <Calendar className="h-5 w-5 mr-2" />
                <span>{t('jobScanner.posted', { date: new Date(selectedJob.postedDate).toLocaleDateString() })}</span>
              </div>
              <div className="flex items-center text-gray-700 mb-4">
                <BarChart className="h-5 w-5 mr-2" />
                <span className={`px-2 py-1 rounded-full text-xs ${
                  selectedJob.matchScore > 85 ? 'bg-green-100 text-green-800' :
                  selectedJob.matchScore > 70 ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {t('jobScanner.matchScore', { score: selectedJob.matchScore })}
                </span>
              </div>
            </div>
            
            <div className="mb-4 prose max-w-none">
              <h4 className="text-lg font-medium mb-2">{t('jobScanner.jobDescription')}</h4>
              <div className="text-gray-700 whitespace-pre-line">
                {selectedJob.description}
              </div>
            </div>
            
            <div className="flex space-x-2 mt-6">
              <button
                className={`px-4 py-2 border rounded-md font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selectedJob.status === 'saved'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handleUpdateJobStatus(selectedJob.id, 'saved')}
              >
                <Save className="h-4 w-4 inline mr-1" />
                {t('jobScanner.save')}
              </button>
              <button
                className={`px-4 py-2 border rounded-md font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selectedJob.status === 'applied'
                    ? 'bg-green-50 text-green-700 border-green-300'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handleUpdateJobStatus(selectedJob.id, 'applied')}
              >
                <CheckCircle className="h-4 w-4 inline mr-1" />
                {t('jobScanner.applied')}
              </button>
              <button
                className={`px-4 py-2 border rounded-md font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  selectedJob.status === 'rejected'
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => handleUpdateJobStatus(selectedJob.id, 'rejected')}
              >
                <Trash2 className="h-4 w-4 inline mr-1" />
                {t('jobScanner.reject')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <TransitionWrapper>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Radar className="h-6 w-6 mr-2 text-indigo-600" />
            {t('jobScanner.title')}
          </h2>
          
          {/* Tabs */}
          <div className="flex border-b mb-6">
            <button
              className={`py-2 px-4 ${
                activeTab === 'jobs' 
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('jobs')}
            >
              {t('jobScanner.jobListings')}
            </button>
            <button
              className={`py-2 px-4 ${
                activeTab === 'filters' 
                  ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('filters')}
            >
              {t('jobScanner.scanFilters')}
            </button>
          </div>
          
          {/* Content */}
          {activeTab === 'jobs' && (
            <div>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">{t('jobScanner.filter')}</label>
                    <select
                      className="border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      value={activeFilter || ''}
                      onChange={(e) => setActiveFilter(e.target.value)}
                    >
                      <option value="">{t('jobScanner.allJobs')}</option>
                      {filters.map(filter => (
                        <option key={filter.id} value={filter.id}>{filter.name}</option>
                      ))}
                    </select>
                    {activeFilter && (
                      <button
                        className="ml-2 p-1 text-gray-400 hover:text-indigo-600"
                        onClick={() => handleRunScan(activeFilter)}
                        disabled={runningFilter === activeFilter}
                        title="Run scan now"
                      >
                        <RefreshCw className={`h-5 w-5 ${runningFilter === activeFilter ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                  <button
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                    onClick={() => {
                      setActiveTab('filters');
                      setShowFilterForm(true);
                    }}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    {t('jobScanner.newFilter')}
                  </button>
                </div>
                
                {renderJobStatusFilter()}
              </div>
              
              {renderJobsList()}
            </div>
          )}

          {activeTab === 'filters' && (
            <div>
              {showFilterForm ? (
                <FilterForm 
                  onSave={(filter) => {
                    // In a real app, you'd save the filter to the server here
                    // For now, just add it to the local state
                    const newFilter: JobScanFilter = {
                      ...filter,
                      id: `filter-${Date.now()}`,
                      userId: user?.id as string,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      name: filter.name || 'Untitled Filter',
                      keywords: filter.keywords || [],
                      locations: filter.locations || [],
                      jobTypes: filter.jobTypes || [],
                      excludeKeywords: filter.excludeKeywords || [],
                      sources: filter.sources || [],
                      frequency: filter.frequency || 'daily',
                      notificationMethod: filter.notificationMethod || 'app',
                      experienceLevels: filter.experienceLevels || []
                    };
                    setFilters([...filters, newFilter]);
                    setShowFilterForm(false);
                  }}
                  onCancel={() => setShowFilterForm(false)}
                  jobSources={jobSources}
                />
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-medium text-gray-900">{t('jobScanner.yourScanFilters')}</h3>
                    <button
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                      onClick={() => setShowFilterForm(true)}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      {t('jobScanner.newFilter')}
                    </button>
                  </div>
                  
                  {filters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <Filter className="h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t('jobScanner.noFiltersCreated')}</h3>
                      <p className="text-gray-500 mb-6">
                        {t('jobScanner.createFirstFilter')}
                      </p>
                      <button
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                        onClick={() => setShowFilterForm(true)}
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        {t('jobScanner.createFirstFilterButton')}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filters.map(filter => (
                        <div key={filter.id} className="border rounded-lg p-5 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-lg font-medium text-gray-900">{filter.name}</h4>
                            <div className="flex space-x-1">
                              <button
                                className="p-1 text-gray-500 hover:text-indigo-600"
                                onClick={() => {
                                  // In a real app, you'd navigate to the edit page
                                  // For now, just log
                                  console.log('Edit filter', filter.id);
                                }}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1 text-gray-500 hover:text-red-600"
                                onClick={() => {
                                  // In a real app, you'd delete the filter from the server
                                  // For now, just remove from local state
                                  setFilters(filters.filter(f => f.id !== filter.id));
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <p className="text-sm text-gray-600 flex items-center">
                              <Bell className="h-4 w-4 mr-2" />
                              {t('jobScanner.frequency', { 
                                frequency: filter.frequency === 'hourly' 
                                  ? t('jobScanner.everyHour')
                                  : filter.frequency === 'daily' 
                                    ? t('jobScanner.daily')
                                    : t('jobScanner.weekly')
                              })}
                            </p>
                            {filter.lastRunAt && (
                              <p className="text-sm text-gray-600 flex items-center">
                                <Calendar className="h-4 w-4 mr-2" />
                                {t('jobScanner.lastScan', { date: new Date(filter.lastRunAt).toLocaleString() })}
                              </p>
                            )}
                          </div>
                          
                          <div className="mb-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-1">{t('jobScanner.keywords')}:</h5>
                            <div className="flex flex-wrap gap-1">
                              {filter.keywords.map((keyword, index) => (
                                <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {filter.locations.length > 0 && (
                            <div className="mb-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-1">{t('jobScanner.locations')}:</h5>
                              <div className="flex flex-wrap gap-1">
                                {filter.locations.map((location, index) => (
                                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                    {location}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="mb-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-1">{t('jobScanner.jobSources')}:</h5>
                            <div className="flex flex-wrap gap-1">
                              {filter.sources.map((sourceId, index) => {
                                const source = jobSources.find(s => s.id === sourceId);
                                return (
                                  <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                                    {source?.name || sourceId}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-end">
                            <button
                              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center text-sm"
                              onClick={() => handleRunScan(filter.id)}
                              disabled={runningFilter === filter.id}
                            >
                              {runningFilter === filter.id ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  {t('jobScanner.scanning')}
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  {t('jobScanner.runScanNow')}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TransitionWrapper>
  );
};

// FilterForm Component
interface FilterFormProps {
  onSave: (filter: Partial<JobScanFilter>) => void;
  onCancel: () => void;
  initialFilter?: Partial<JobScanFilter>;
  jobSources: { id: string; name: string; icon: string; url: string; }[];
}

const FilterForm: React.FC<FilterFormProps> = ({ onSave, onCancel, initialFilter, jobSources }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialFilter?.name || '');
  const [keywords, setKeywords] = useState<string[]>(initialFilter?.keywords || []);
  const [keywordInput, setKeywordInput] = useState('');
  const [locations, setLocations] = useState<string[]>(initialFilter?.locations || []);
  const [locationInput, setLocationInput] = useState('');
  const [jobTypes, setJobTypes] = useState<string[]>(initialFilter?.jobTypes || []);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(initialFilter?.excludeKeywords || []);
  const [excludeKeywordInput, setExcludeKeywordInput] = useState('');
  const [sources, setSources] = useState<string[]>(initialFilter?.sources || jobSources.map(s => s.id));
  const [frequency, setFrequency] = useState<JobScanFilter['frequency']>(initialFilter?.frequency || 'daily');
  const [notificationMethod, setNotificationMethod] = useState<JobScanFilter['notificationMethod']>(initialFilter?.notificationMethod || 'app');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      keywords,
      locations,
      jobTypes,
      excludeKeywords,
      sources,
      frequency,
      notificationMethod,
    });
  };
  
  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };
  
  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };
  
  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput('');
    }
  };
  
  const removeLocation = (location: string) => {
    setLocations(locations.filter(l => l !== location));
  };
  
  const addExcludeKeyword = () => {
    if (excludeKeywordInput.trim() && !excludeKeywords.includes(excludeKeywordInput.trim())) {
      setExcludeKeywords([...excludeKeywords, excludeKeywordInput.trim()]);
      setExcludeKeywordInput('');
    }
  };
  
  const removeExcludeKeyword = (keyword: string) => {
    setExcludeKeywords(excludeKeywords.filter(k => k !== keyword));
  };
  
  const toggleJobType = (type: string) => {
    if (jobTypes.includes(type)) {
      setJobTypes(jobTypes.filter(t => t !== type));
    } else {
      setJobTypes([...jobTypes, type]);
    }
  };
  
  const toggleSource = (sourceId: string) => {
    if (sources.includes(sourceId)) {
      setSources(sources.filter(s => s !== sourceId));
    } else {
      setSources([...sources, sourceId]);
    }
  };
  
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {initialFilter ? 'Edit Filter' : 'Create New Filter'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobScanner.filterName')}
          </label>
          <input
            type="text"
            id="name"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            placeholder={t('jobScanner.filterNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobScanner.keywordsRequired')}
          </label>
          <div className="flex mb-2">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={t('jobScanner.keywordsPlaceholder')}
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            />
            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700"
              onClick={addKeyword}
            >
              {t('jobScanner.add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((keyword, index) => (
              <div key={index} className="bg-indigo-100 text-indigo-800 rounded-full px-3 py-1 text-sm flex items-center">
                {keyword}
                <button
                  type="button"
                  className="ml-2 text-indigo-600 hover:text-indigo-800"
                  onClick={() => removeKeyword(keyword)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {t('jobScanner.keywordsHelp')}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobScanner.locations')}
          </label>
          <div className="flex mb-2">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={t('jobScanner.addLocation')}
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
            />
            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700"
              onClick={addLocation}
            >
              {t('jobScanner.add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {locations.map((location, index) => (
              <div key={index} className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm flex items-center">
                {location}
                <button
                  type="button"
                  className="ml-2 text-blue-600 hover:text-blue-800"
                  onClick={() => removeLocation(location)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {t('jobScanner.locationsHelp')}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobScanner.jobTypes')}
          </label>
          <div className="flex flex-wrap gap-2">
            {['Full-time', 'Part-time', 'Contract', 'Temporary', 'Remote'].map((type) => (
              <button
                key={type}
                type="button"
                className={`px-3 py-1 rounded-full text-sm ${
                  jobTypes.includes(type)
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
                onClick={() => toggleJobType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('jobScanner.jobTypesHelp')}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobScanner.excludeKeywords')}
          </label>
          <div className="flex mb-2">
            <input
              type="text"
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={t('jobScanner.excludeKeywordsPlaceholder')}
              value={excludeKeywordInput}
              onChange={(e) => setExcludeKeywordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword())}
            />
            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700"
              onClick={addExcludeKeyword}
            >
              {t('jobScanner.add')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {excludeKeywords.map((keyword, index) => (
              <div key={index} className="bg-red-100 text-red-800 rounded-full px-3 py-1 text-sm flex items-center">
                {keyword}
                <button
                  type="button"
                  className="ml-2 text-red-600 hover:text-red-800"
                  onClick={() => removeExcludeKeyword(keyword)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {t('jobScanner.excludeKeywordsHelp')}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('jobScanner.jobSources')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {jobSources.map((source) => (
              <div
                key={source.id}
                className={`p-3 border rounded-md flex items-center cursor-pointer ${
                  sources.includes(source.id)
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => toggleSource(source.id)}
              >
                <input
                  type="checkbox"
                  checked={sources.includes(source.id)}
                  onChange={() => {}}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"
                />
                <span>{source.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {t('jobScanner.sourcesHelp')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('jobScanner.scanFrequency')}
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as JobScanFilter['frequency'])}
            >
              <option value="hourly">{t('jobScanner.everyHour')}</option>
              <option value="daily">{t('jobScanner.daily')}</option>
              <option value="weekly">{t('jobScanner.weekly')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('jobScanner.notifications')}
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              value={notificationMethod}
              onChange={(e) => setNotificationMethod(e.target.value as JobScanFilter['notificationMethod'])}
            >
              <option value="app">{t('jobScanner.inAppOnly')}</option>
              <option value="email">{t('jobScanner.emailOnly')}</option>
              <option value="both">{t('jobScanner.bothEmailAndApp')}</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
          >
            {t('jobScanner.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
            disabled={!name || keywords.length === 0 || sources.length === 0}
          >
            {t('jobScanner.saveFilter')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobScanner; 