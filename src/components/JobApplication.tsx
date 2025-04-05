import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Briefcase, FileText, Mail, Building2, Loader2, 
  AlertCircle, CheckCircle, Target, Send 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CV } from '../types';
import LoadingScreen from './LoadingScreen';
import ErrorMessage from './ErrorMessage';
import TransitionWrapper from './TransitionWrapper';
import { motion } from 'framer-motion';

interface JobMatch {
  title: string;
  company: string;
  matchScore: number;
  skills: {
    matching: string[];
    missing: string[];
  };
  description: string;
}

interface EmailTemplate {
  type: 'formal' | 'startup' | 'creative';
  subject: string;
  body: string;
}

const JobApplication = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchUserCVs();
  }, [user]);

  const fetchUserCVs = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('cvs')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCvs(data || []);
    } catch (err) {
      setError('Failed to load your CVs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const analyzeJobMatches = async () => {
    if (!selectedCV) return;

    setAnalyzing(true);
    setError(null);
    setJobMatches([]);
    setEmailTemplates([]);

    try {
      // Simulated job matches - In a real app, this would call an API
      const matches: JobMatch[] = [
        {
          title: "Senior Software Engineer",
          company: "TechCorp Inc.",
          matchScore: 92,
          skills: {
            matching: ["React", "TypeScript", "Node.js"],
            missing: ["GraphQL", "AWS"]
          },
          description: "Looking for a senior developer to lead our frontend team..."
        },
        {
          title: "Full Stack Developer",
          company: "StartupX",
          matchScore: 85,
          skills: {
            matching: ["JavaScript", "React", "SQL"],
            missing: ["Vue.js", "MongoDB"]
          },
          description: "Join our fast-growing startup as a full stack developer..."
        },
        {
          title: "Frontend Architect",
          company: "Enterprise Solutions",
          matchScore: 78,
          skills: {
            matching: ["React", "TypeScript", "CSS"],
            missing: ["Angular", "Java"]
          },
          description: "Seeking an experienced frontend architect to design..."
        }
      ];

      setJobMatches(matches);

      // Simulated email templates
      const templates: EmailTemplate[] = [
        {
          type: 'formal',
          subject: 'Application for [Position] at [Company]',
          body: `Dear Hiring Manager,\n\nI am writing to express my interest in the [Position] position at [Company]...`
        },
        {
          type: 'startup',
          subject: 'Excited to Join [Company] as [Position]',
          body: `Hi [Company] team!\n\nI came across your opening for [Position] and I'm thrilled...`
        },
        {
          type: 'creative',
          subject: "Let's Create Something Amazing Together at [Company]",
          body: `Hello [Company] team,\n\nYour mission to [Company Mission] resonates deeply...`
        }
      ];

      setEmailTemplates(templates);
    } catch (err) {
      setError('Failed to analyze job matches. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading your CVs..." />;
  }

  if (cvs.length === 0) {
    return (
      <TransitionWrapper>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No CVs Found</h2>
          <p className="text-gray-600 mb-6">
            Upload a CV first to use the job application wizard.
          </p>
        </div>
      </TransitionWrapper>
    );
  }

  return (
    <TransitionWrapper>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Briefcase className="h-6 w-6 mr-2 text-indigo-600" />
            Job Application Wizard
          </h2>

          {error && (
            <ErrorMessage
              message={error}
              className="mb-6"
              onDismiss={() => setError(null)}
            />
          )}

          {/* CV Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CV to Analyze
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cvs.map((cv) => (
                <motion.div
                  key={cv.id}
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedCV?.id === cv.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                  onClick={() => setSelectedCV(cv)}
                >
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-indigo-600 mr-2" />
                    <div>
                      <h3 className="font-medium text-gray-900">{cv.filename}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(cv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <button
              onClick={analyzeJobMatches}
              disabled={!selectedCV || analyzing}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Target className="h-5 w-5 mr-2" />
                  Find Matching Jobs
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {jobMatches.length > 0 && (
            <div className="mt-12 space-y-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Recommended Jobs
              </h3>

              {/* Job Matches */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {jobMatches.map((job) => (
                  <motion.div
                    key={job.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedJob === job
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {job.title}
                        </h4>
                        <p className="text-gray-600">{job.company}</p>
                      </div>
                      <div className="flex items-center">
                        <div className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                          job.matchScore >= 90
                            ? 'bg-green-100 text-green-800'
                            : job.matchScore >= 80
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {job.matchScore}% Match
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-gray-600">
                      {job.description}
                    </p>

                    <div className="mt-4">
                      <div className="mb-2">
                        <h5 className="text-sm font-medium text-gray-700">
                          Matching Skills
                        </h5>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {job.skills.matching.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">
                          Skills to Develop
                        </h5>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {job.skills.missing.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Email Templates */}
              {selectedJob && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Application Email Templates
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {emailTemplates.map((template) => (
                      <motion.div
                        key={template.type}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedTemplate === template
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-center mb-4">
                          {template.type === 'formal' ? (
                            <Building2 className="h-5 w-5 text-gray-600" />
                          ) : template.type === 'startup' ? (
                            <Target className="h-5 w-5 text-indigo-600" />
                          ) : (
                            <Mail className="h-5 w-5 text-purple-600" />
                          )}
                          <h4 className="ml-2 text-lg font-medium capitalize">
                            {template.type} Style
                          </h4>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Subject
                            </label>
                            <p className="mt-1 text-sm text-gray-600">
                              {template.subject}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Preview
                            </label>
                            <p className="mt-1 text-sm text-gray-600">
                              {template.body.substring(0, 100)}...
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {selectedTemplate && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => {
                          // Here you would implement the email sending logic
                          alert('Email template copied to clipboard!');
                        }}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <Send className="h-5 w-5 mr-2" />
                        Use This Template
                      </button>
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

export default JobApplication;