import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

const tips = [
  {
    text: "A well-crafted CV increases your interview chances by up to 65%",
    category: "statistics"
  },
  {
    text: "93% of employers use ATS systems to screen CVs - optimize yours for better visibility",
    category: "technology"
  },
  {
    text: "Including quantifiable achievements can increase response rates by 40%",
    category: "content"
  },
  {
    text: "Tailoring your CV to each job application increases success rates by 50%",
    category: "strategy"
  },
  {
    text: "Professional CVs with clear formatting get 25% more responses",
    category: "design"
  },
  {
    text: "Adding relevant keywords from job descriptions improves ATS scores by 35%",
    category: "optimization"
  },
  {
    text: "Multilingual CVs open up 30% more job opportunities globally",
    category: "language"
  },
  {
    text: "Regular CV updates increase your chances of being headhunted by 45%",
    category: "maintenance"
  },
  {
    text: "Including a professional summary increases readability by 40%",
    category: "structure"
  },
  {
    text: "CVs with industry-specific skills get 20% more interview invitations",
    category: "skills"
  }
];

const LoadingTips = () => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-md mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTipIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="flex items-start space-x-4 bg-indigo-50 p-4 rounded-lg shadow-inner"
        >
          <Lightbulb className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-sm font-medium text-indigo-900 mb-1">
              Did you know?
            </h4>
            <p className="text-sm text-indigo-700">
              {tips[currentTipIndex].text}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LoadingTips;