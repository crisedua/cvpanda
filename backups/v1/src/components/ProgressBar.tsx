import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  steps: string[];
  currentStep: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, steps, currentStep }) => {
  return (
    <div className="w-full space-y-4">
      {/* Step Labels */}
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`flex items-center ${
              index <= currentStep ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  index <= currentStep
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300'
                }`}
              >
                {index < currentStep ? (
                  '✓'
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="text-sm mt-2">{step}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-full mt-4 ${
                  index < currentStep ? 'bg-indigo-600' : 'bg-gray-300'
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