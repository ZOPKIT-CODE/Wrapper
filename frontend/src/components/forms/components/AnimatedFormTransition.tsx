import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedFormTransitionProps {
  children: React.ReactNode;
  direction?: 'forward' | 'backward' | 'none';
  className?: string;
}

/**
 * Animation variants for different transitions
 */
const slideVariants: Variants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? 300 : -300,
    opacity: 0,
    scale: 0.95
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30
    }
  },
  exit: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? -300 : 300,
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  })
};

const fadeVariants: Variants = {
  enter: {
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.2
    }
  }
};

const scaleVariants: Variants = {
  enter: {
    scale: 0.8,
    opacity: 0,
    rotateY: 90
  },
  center: {
    scale: 1,
    opacity: 1,
    rotateY: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25
    }
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    rotateY: -90,
    transition: {
      duration: 0.2
    }
  }
};

/**
 * Animated form transition component
 */
export const AnimatedFormTransition: React.FC<AnimatedFormTransitionProps> = ({
  children,
  direction = 'none',
  className
}) => {
  const [animationType, setAnimationType] = useState<'slide' | 'fade' | 'scale'>('slide');

  // Choose animation based on direction
  useEffect(() => {
    if (direction === 'none') {
      setAnimationType('fade');
    } else {
      setAnimationType('slide');
    }
  }, [direction]);

  const getVariants = () => {
    switch (animationType) {
      case 'slide':
        return slideVariants;
      case 'fade':
        return fadeVariants;
      case 'scale':
        return scaleVariants;
      default:
        return slideVariants;
    }
  };

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={direction}
        custom={direction}
        variants={getVariants()}
        initial="enter"
        animate="center"
        exit="exit"
        className={cn('w-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Loading skeleton component for form fields
 */
export const FormFieldSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
      <div className="h-12 bg-gray-200 rounded animate-pulse" />
      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
    </div>
  );
};

/**
 * Animated progress bar component
 */
export const AnimatedProgressBar: React.FC<{
  progress: number;
  className?: string;
}> = ({ progress, className }) => {
  return (
    <div className={cn('w-full bg-gray-200 rounded-full h-2 overflow-hidden', className)}>
      <motion.div
        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: 0.5,
          ease: 'easeInOut'
        }}
      />
    </div>
  );
};

/**
 * Animated step indicator
 */
export const AnimatedStepIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  className?: string;
}> = ({ currentStep, totalSteps, className }) => {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <motion.div
          key={index}
          className={cn(
            'w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium',
            index <= currentStep
              ? 'bg-[#1B2E5A] border-[#1B2E5A] text-white'
              : 'bg-gray-200 border-gray-300 text-gray-500'
          )}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: index * 0.1,
            duration: 0.3
          }}
        >
          {index < currentStep ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              ✓
            </motion.div>
          ) : (
            index + 1
          )}
        </motion.div>
      ))}
    </div>
  );
};

/**
 * Animated error message
 */
export const AnimatedErrorMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn('text-red-600 text-sm mt-1', className)}
    >
      {message}
    </motion.div>
  );
};

/**
 * Animated success message
 */
export const AnimatedSuccessMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      className={cn('text-green-600 text-sm mt-1 flex items-center', className)}
    >
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
        className="mr-1"
      >
        ✓
      </motion.span>
      {message}
    </motion.div>
  );
};
