import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  GraduationCap, BookOpen, Award, Target, 
  Loader2, AlertCircle, ExternalLink, Calendar,
  Clock, CheckCircle, ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { analyzeLearningPath } from '../lib/gpt';
import type { CV } from '../types';
import LoadingScreen from './LoadingScreen';
import ErrorMessage from './ErrorMessage';
import TransitionWrapper from './TransitionWrapper';

interface LearningPath {
  analysis: {
    current_level: string;
    target_level: string;
    key_gaps: string[];
  };
  learning_path: {
    immediate: {
      courses: Array<{
        title: string;
        provider: string;
        url: string;
        duration: string;
        description: string;
      }>;
      certifications: Array<{
        name: string;
        provider: string;
        level: string;
        description: string;
      }>;
    };
    short_term: {
      courses: Array<{
        title: string;
        provider: string;
        url: string;
        duration: string;
        description: string;
      }>;
      certifications: Array<{
        name: string;
        provider: string;
        level: string;
        description: string;
      }>;
    };
    long_term: {
      courses: Array<{
        title: string;
        provider: string;
        url: string;
        duration: string;
        description: string;
      }>;
      certifications: Array<{
        name: string;
        provider: string;
        level: string;
        description: string;
      }>;
    };
  };
  projects: Array<{
    title: string;
    description: string;
    skills_practiced: string[];
    estimated_duration: string;
  }>;
  timeline: {
    months_to_goal: number;
    milestones: Array<{
      title: string;
      description: string;
      target_date: string;
    }>;
  };
}

const ProfessionalDevelopment = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [cvs, setCvs] = useState<CV[]>([]);
  const [selectedCV, setSelectedCV] = useState<CV | null>(null);
  const [careerGoal, setCareerGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);

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
      setError(t('errors.loadCvs'));
    } finally {
      setLoading(false);
    }
  };

  const analyzePath = async () => {
    if (!selectedCV || !careerGoal.trim()) {
      setError(t('errors.selectCvAndGoal'));
      return;
    }

    setAnalyzing(true);
    setError(null);
    setLearningPath(null);

    try {
      const result = await analyzeLearningPath(
        selectedCV.parsed_data,
        careerGoal,
        i18n.language
      );
      setLearningPath(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.analysisError'));
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <LoadingScreen message={t('common.loading')} />;
  }

  if (cvs.length === 0) {
    return (
      <TransitionWrapper>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('development.noCvs')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('development.uploadFirst')}
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
            <GraduationCap className="h-6 w-6 mr-2 text-indigo-600" />
            {t('development.title')}
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
              {t('development.selectCv')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cvs.map((cv) => (
                <div
                  key={cv.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedCV?.id === cv.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                  onClick={() => setSelectedCV(cv)}
                >
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-indigo-600 mr-2" />
                    <div>
                      <h3 className="font-medium text-gray-900">{cv.filename}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(cv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Career Goal Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('development.careerGoal')}
            </label>
            <textarea
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value)}
              placeholder={t('development.careerGoalPlaceholder')}
              className="w-full h-32 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {/* Analyze Button */}
          <div className="flex justify-center">
            <button
              onClick={analyzePath}
              disabled={!selectedCV || !careerGoal.trim() || analyzing}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t('development.analyzing')}
                </>
              ) : (
                <>
                  <Target className="h-5 w-5 mr-2" />
                  {t('development.analyze')}
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {learningPath && (
            <div className="mt-12 space-y-12">
              {/* Analysis */}
              <div className="bg-indigo-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-indigo-900 mb-4">
                  {t('development.analysis')}
                </h3>
                <div className="space-y-4">
                  <p className="text-indigo-700">
                    <strong>{t('development.currentLevel')}:</strong> {learningPath.analysis.current_level}
                  </p>
                  <p className="text-indigo-700">
                    <strong>{t('development.targetLevel')}:</strong> {learningPath.analysis.target_level}
                  </p>
                  <div>
                    <strong className="text-indigo-700">{t('development.keyGaps')}:</strong>
                    <ul className="mt-2 space-y-2">
                      {learningPath.analysis.key_gaps.map((gap, index) => (
                        <li key={index} className="flex items-start">
                          <ArrowRight className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-indigo-700">{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Learning Path */}
              <div className="space-y-8">
                <h3 className="text-xl font-semibold text-gray-900">
                  {t('development.learningPath')}
                </h3>

                {/* Immediate */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-indigo-600" />
                    {t('development.immediate')}
                  </h4>
                  
                  <div className="space-y-6">
                    {/* Courses */}
                    <div>
                      <h5 className="text-md font-medium text-gray-900 mb-3">
                        {t('development.courses')}
                      </h5>
                      <div className="grid gap-4">
                        {learningPath.learning_path.immediate.courses.map((course, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h6 className="font-medium text-indigo-600">
                                  {course.title}
                                </h6>
                                <p className="text-sm text-gray-600">
                                  {course.provider} • {course.duration}
                                </p>
                              </div>
                              <a
                                href={course.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-700"
                              >
                                <ExternalLink className="h-5 w-5" />
                              </a>
                            </div>
                            <p className="mt-2 text-sm text-gray-600">
                              {course.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Certifications */}
                    <div>
                      <h5 className="text-md font-medium text-gray-900 mb-3">
                        {t('development.certifications')}
                      </h5>
                      <div className="grid gap-4">
                        {learningPath.learning_path.immediate.certifications.map((cert, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h6 className="font-medium text-indigo-600">
                                  {cert.name}
                                </h6>
                                <p className="text-sm text-gray-600">
                                  {cert.provider} • {cert.level}
                                </p>
                              </div>
                              <Award className="h-5 w-5 text-indigo-600" />
                            </div>
                            <p className="mt-2 text-sm text-gray-600">
                              {cert.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                    {t('development.timeline')}
                  </h4>
                  
                  <p className="text-gray-600 mb-4">
                    {t('development.estimatedTime', { months: learningPath.timeline.months_to_goal })}
                  </p>

                  <div className="space-y-4">
                    {learningPath.timeline.milestones.map((milestone, index) => (
                      <div key={index} className="flex items-start">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                          <h6 className="font-medium text-gray-900">
                            {milestone.title}
                          </h6>
                          <p className="text-sm text-gray-600">
                            {milestone.description}
                          </p>
                          <p className="text-sm text-indigo-600 mt-1">
                            {milestone.target_date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Projects */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    {t('development.projects')}
                  </h4>
                  
                  <div className="grid gap-6">
                    {learningPath.projects.map((project, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h5 className="font-medium text-indigo-600 mb-2">
                          {project.title}
                        </h5>
                        <p className="text-sm text-gray-600 mb-3">
                          {project.description}
                        </p>
                        <div className="flex items-center text-sm text-gray-500 mb-2">
                          <Clock className="h-4 w-4 mr-1" />
                          {project.estimated_duration}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {project.skills_practiced.map((skill, skillIndex) => (
                            <span
                              key={skillIndex}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TransitionWrapper>
  );
};

export default ProfessionalDevelopment;