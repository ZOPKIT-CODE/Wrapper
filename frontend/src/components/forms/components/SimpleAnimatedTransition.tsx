import React from 'react';
import { cn } from '@/lib/utils';

interface SimpleAnimatedTransitionProps {
  children: React.ReactNode;
  direction?: 'forward' | 'backward' | 'none';
  className?: string;
}

/**
 * Simple animated transition component without external dependencies
 */
export const SimpleAnimatedTransition: React.FC<SimpleAnimatedTransitionProps> = ({
  children,
  direction = 'none',
  className
}) => {
  const getTransitionClasses = () => {
    switch (direction) {
      case 'forward':
        return 'animate-in slide-in-from-right-4 duration-300';
      case 'backward':
        return 'animate-in slide-in-from-left-4 duration-300';
      default:
        return 'animate-in fade-in duration-200';
    }
  };

  return (
    <div className={cn('w-full', getTransitionClasses(), className)}>
      {children}
    </div>
  );
};

/**
 * Simple loading skeleton component
 */
export const SimpleFormFieldSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
      <div className="h-12 bg-gray-200 rounded animate-pulse" />
      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
    </div>
  );
};

/**
 * Simple progress bar component
 */
export const SimpleProgressBar: React.FC<{
  progress: number;
  className?: string;
}> = ({ progress, className }) => {
  return (
    <div className={cn('w-full bg-gray-200 rounded-full h-2 overflow-hidden', className)}>
      <div 
        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/**
 * Simple step indicator
 */
export const SimpleStepIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  className?: string;
}> = ({ currentStep, totalSteps, className }) => {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index}
          className={cn(
            'w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300',
            index <= currentStep
              ? 'bg-[#1B2E5A] border-[#1B2E5A] text-white'
              : 'bg-gray-200 border-gray-300 text-gray-500'
          )}
        >
          {index < currentStep ? '✓' : index + 1}
        </div>
      ))}
    </div>
  );
};

/**
 * Simple error message
 */
export const SimpleErrorMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  return (
    <div className={cn('text-red-600 text-sm mt-1 animate-in fade-in duration-200', className)}>
      {message}
    </div>
  );
};

/**
 * Simple success message
 */
export const SimpleSuccessMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  return (
    <div className={cn('text-green-600 text-sm mt-1 flex items-center animate-in fade-in duration-200', className)}>
      <span className="mr-1">✓</span>
      {message}
    </div>
  );
};
