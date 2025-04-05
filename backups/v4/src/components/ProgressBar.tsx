import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  steps?: string[];
  currentStep?: number;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, steps, currentStep, label }) => {
  // Simple progress bar with just a label
  if (label) {
    return (
      <div className="w-full space-y-2">
        {/* Label */}
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    );
  }
  
  // Stepped progress bar
  return (
    <div className="w-full space-y-4">
      {/* Step Labels */}
      <div className="flex justify-between">
        {steps?.map((step, index) => (
          <div
            key={step}
            className={`flex items-center ${
              index <= (currentStep || 0) ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  index <= (currentStep || 0)
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300'
                }`}
              >
                {index < (currentStep || 0) ? (
                  '✓'
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="text-sm mt-2">{step}</span>
            </div>
            {index < (steps?.length || 0) - 1 && (
              <div
                className={`h-0.5 w-full mt-4 ${
                  index < (currentStep || 0) ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-indigo-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;