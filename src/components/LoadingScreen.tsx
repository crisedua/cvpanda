import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import LoadingTips from './LoadingTips';

interface LoadingScreenProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  showTips?: boolean;
  className?: string;
  preserveContent?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message, 
  size = 'medium',
  overlay = false,
  showTips = false,
  className = '',
  preserveContent = false
}) => {
  const { t } = useTranslation();

  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-12 w-12',
    large: 'h-16 w-16'
  };

  const containerClasses = overlay
    ? 'fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center'
    : `flex items-center justify-center min-h-[200px] ${className}`;

  const contentClasses = overlay
    ? `bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4 space-y-6 ${preserveContent ? 'bg-opacity-90' : ''}`
    : 'text-center space-y-6';

  return (
    <div className={containerClasses}>
      <div className={contentClasses}>
        <div className="relative">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Loader2 
              className={`${sizeClasses[size]} text-indigo-600 mx-auto`} 
            />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Loader2 
              className={`${sizeClasses[size]} text-indigo-400 mx-auto`} 
            />
          </motion.div>
        </div>

        <div className="space-y-4">
          {message ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-medium text-gray-700"
            >
              {message}
            </motion.p>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-medium text-gray-700"
            >
              {t('common.loading')}
            </motion.p>
          )}

          {showTips && <LoadingTips />}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;