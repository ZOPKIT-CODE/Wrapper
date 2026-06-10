import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MotionAnimatedTransitionProps {
  children: React.ReactNode;
  direction?: 'forward' | 'backward' | 'none';
  className?: string;
}

/**
 * Motion-based animated transition component using the motion library
 */
export const MotionAnimatedTransition: React.FC<MotionAnimatedTransitionProps> = ({
  children,
  direction = 'none',
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const elements = Array.from(container.querySelectorAll('[data-animate]'));

    // Reset any existing animations
    elements.forEach(el => {
      (el as HTMLElement).style.transform = '';
      (el as HTMLElement).style.opacity = '';
    });

    // Animate based on direction
    switch (direction) {
      case 'forward':
        animate(
          elements,
          {
            x: ['100%', '0%'],
            opacity: [0, 1]
          },
          {
            duration: 0.3,
            ease: 'easeOut',
            delay: stagger(0.05)
          }
        );
        break;
      case 'backward':
        animate(
          elements,
          {
            x: ['-100%', '0%'],
            opacity: [0, 1]
          },
          {
            duration: 0.3,
            ease: 'easeOut',
            delay: stagger(0.05)
          }
        );
        break;
      default:
        animate(
          elements,
          {
            opacity: [0, 1],
            y: ['20px', '0px']
          },
          {
            duration: 0.2,
            ease: 'easeOut',
            delay: stagger(0.03)
          }
        );
    }
  }, [direction]);

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      {children}
    </div>
  );
};

/**
 * Motion-based form field skeleton
 */
export const MotionFormFieldSkeleton: React.FC<{ 
  className?: string;
  count?: number;
}> = ({ className, count = 3 }) => {
  const skeletonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!skeletonRef.current) return;

    const elements = Array.from(skeletonRef.current.querySelectorAll('.skeleton-item'));
    
    animate(
      elements,
      {
        opacity: [0.5, 1, 0.5]
      },
      {
        duration: 1.5,
        repeat: Infinity,
        delay: stagger(0.2)
      }
    );
  }, []);

  return (
    <div ref={skeletonRef} className={cn('space-y-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="skeleton-item h-4 bg-gray-200 rounded animate-pulse"
          style={{ width: `${Math.random() * 40 + 40}%` }}
        />
      ))}
    </div>
  );
};

/**
 * Motion-based progress bar
 */
export const MotionProgressBar: React.FC<{
  progress: number;
  className?: string;
}> = ({ progress, className }) => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!barRef.current) return;

    animate(
      barRef.current,
      {
        width: `${progress}%`
      },
      {
        duration: 0.5,
        ease: 'easeOut'
      }
    );
  }, [progress]);

  return (
    <div className={cn('w-full bg-gray-200 rounded-full h-2 overflow-hidden', className)}>
      <div 
        ref={barRef}
        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
        style={{ width: '0%' }}
      />
    </div>
  );
};

/**
 * Motion-based step indicator
 */
export const MotionStepIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  className?: string;
}> = ({ currentStep, totalSteps, className }) => {
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!indicatorRef.current) return;

    const steps = indicatorRef.current.querySelectorAll('.step-item');
    
    steps.forEach((step, index) => {
      const isActive = index <= currentStep;
      const isCurrent = index === currentStep;
      
      animate(
        step as HTMLElement,
        {
          scale: isCurrent ? [1, 1.1, 1] : 1,
          backgroundColor: isActive ? '#2563eb' : '#e5e7eb',
          borderColor: isActive ? '#2563eb' : '#d1d5db',
          color: isActive ? '#ffffff' : '#6b7280'
        },
        {
          duration: 0.3,
          ease: 'easeOut',
          delay: index * 0.1
        }
      );
    });
  }, [currentStep, totalSteps]);

  return (
    <div ref={indicatorRef} className={cn('flex items-center space-x-2', className)}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index}
          className="step-item w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300"
        >
          {index < currentStep ? '✓' : index + 1}
        </div>
      ))}
    </div>
  );
};

/**
 * Motion-based error message
 */
export const MotionErrorMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messageRef.current || !message) return;

    animate(
      messageRef.current,
      {
        opacity: [0, 1],
        y: ['-10px', '0px'],
        scale: [0.95, 1]
      },
      {
        duration: 0.2,
        ease: 'easeOut'
      }
    );
  }, [message]);

  if (!message) return null;

  return (
    <div 
      ref={messageRef}
      className={cn('text-red-600 text-sm mt-1', className)}
    >
      {message}
    </div>
  );
};

/**
 * Motion-based success message
 */
export const MotionSuccessMessage: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className }) => {
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messageRef.current || !message) return;

    animate(
      messageRef.current,
      {
        opacity: [0, 1],
        y: ['-10px', '0px'],
        scale: [0.95, 1]
      },
      {
        duration: 0.2,
        ease: 'easeOut'
      }
    );
  }, [message]);

  if (!message) return null;

  return (
    <div 
      ref={messageRef}
      className={cn('text-green-600 text-sm mt-1 flex items-center', className)}
    >
      <span className="mr-1">✓</span>
      {message}
    </div>
  );
};

/**
 * Motion-based loading spinner
 */
export const MotionLoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className }) => {
  const spinnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!spinnerRef.current) return;

    animate(
      spinnerRef.current,
      {
        rotate: [0, 360]
      },
      {
        duration: 1,
        repeat: Infinity,
        ease: 'linear'
      }
    );
  }, []);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div
      ref={spinnerRef}
      className={cn(
        'border-2 border-gray-300 border-t-blue-600 rounded-full',
        sizeClasses[size],
        className
      )}
    />
  );
};
