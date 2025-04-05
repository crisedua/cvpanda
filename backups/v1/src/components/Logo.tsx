import React from 'react';
import { Hand as Panda } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`flex items-center ${className}`}>
      <Panda className={`text-indigo-600 ${
        size === 'sm' ? 'h-6 w-6' :
        size === 'md' ? 'h-8 w-8' :
        'h-10 w-10'
      } mr-2`} />
      <span className={`font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent ${sizes[size]}`}>
        CVPanda
      </span>
    </div>
  );
};

export default Logo;