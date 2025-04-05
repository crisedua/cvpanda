import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, Edit, Sparkles, Briefcase, ArrowRight,
  Brain, Shield, Trophy, Globe, Gauge, Workflow, 
  Puzzle, FileText, Zap, Star, TrendingUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { createComponentLogger } from '../lib/logger';
import { supabase } from '../lib/supabase';

const logger = createComponentLogger('Home');

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasActivity, setHasActivity] = React.useState(false);

  React.useEffect(() => {
    const checkForActivity = async () => {
      if (!user) return;

      try {
        const { count } = await supabase
          .from('cvs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        setHasActivity(count ? count > 0 : false);
      } catch (error) {
        logger.error('Failed to check for activity', error);
        setHasActivity(false);
      }
    };

    checkForActivity();
  }, [user]);

  const handleNavigation = (path: string) => {
    logger.log('Navigation clicked', { path });
    navigate(path);
  };

  // Show different content for logged-in users
  if (user) {
    return (
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div>
              <h1 className="text-3xl font-bold">{t('home.welcome')}</h1>
              <p className="text-lg opacity-90 mt-2">{t('home.whatToDo')}</p>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => handleNavigation('/import')}
          >
            <Upload className="h-8 w-8 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('home.uploadNew')}
            </h3>
            <p className="text-gray-600">
              {t('home.uploadDescription')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <Brain className="h-8 w-8 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('home.aiAnalysis')}
            </h3>
            <p className="text-gray-600">
              {t('home.aiAnalysisDescription')}
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Landing page for non-logged-in users
  return (
    <div className="relative">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 -mt-16 pt-16">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2850&q=80')] bg-cover bg-center opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-purple-900/90 to-indigo-800/90" />
          
          {/* Animated Shapes */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20"
            animate={{
              scale: [1.2, 1, 1.2],
              rotate: [90, 0, 90],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center px-6 py-2 rounded-full bg-white/10 backdrop-blur-sm"
            >
              <Sparkles className="h-5 w-5 text-indigo-300 mr-2" />
              <span className="text-indigo-200">{t('home.aiPowered')}</span>
            </motion.div>
            
            <h1 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="block mb-2"
              >
                {t('home.transformCareer')}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="block text-3xl sm:text-4xl text-indigo-300"
              >
                {t('home.withIntelligent')}
              </motion.span>
            </h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-6 max-w-lg mx-auto text-xl text-indigo-100 sm:max-w-3xl"
            >
              {t('home.description')}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-10 max-w-sm mx-auto sm:max-w-none sm:flex sm:justify-center"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigation('/auth')}
                className="w-full sm:w-auto flex items-center justify-center px-8 py-4 text-base font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 md:text-lg md:px-10 transition-all duration-200 transform hover:shadow-xl group"
              >
                {t('home.getStarted')}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-indigo-800 to-purple-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              {t('home.cta.title')}
            </h2>
            <p className="mt-4 text-xl text-indigo-200">
              {t('home.cta.subtitle')}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation('/auth')}
              className="mt-8 inline-flex items-center px-8 py-4 border border-transparent text-base font-medium rounded-lg shadow-sm text-indigo-900 bg-white hover:bg-indigo-50 md:text-lg md:px-10 transition-all duration-200"
            >
              {t('home.cta.button')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Home;