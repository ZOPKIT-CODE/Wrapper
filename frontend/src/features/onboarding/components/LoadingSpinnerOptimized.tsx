import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Loader2,
  Server,
  ShieldCheck,
  Sparkles,
  Database,
  Cpu
} from 'lucide-react';
import { config } from '@/lib/config';

// Types derived from usage
export interface LoadingStep {
  id: string;
  label: string;
  subtext: string;
  duration: number;
}

export enum LaunchStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED'
}

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  onComplete?: () => void;
  userName?: string;
  companyName?: string;
}

const DEFAULT_STEPS: LoadingStep[] = [
  { id: 'org', label: 'Creating Organization', subtext: 'Setting up your workspace and company profile...', duration: 1800 },
  { id: 'db', label: 'Configuring Database', subtext: 'Initializing secure data storage and backups...', duration: 2000 },
  { id: 'auth', label: 'Setting Up Security', subtext: 'Configuring authentication and access controls...', duration: 1500 },
  { id: 'features', label: 'Enabling Features', subtext: 'Activating billing, users, and team management...', duration: 1700 },
];

export const LoadingSpinnerOptimized: React.FC<LoadingSpinnerProps> = ({
  message,
  size = 'md',
  showProgress = false,
  onComplete,
  userName = "Creator",
  companyName
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<LaunchStatus>(LaunchStatus.PROCESSING);

  // Simplified progress bar - less frequent updates
  useEffect(() => {
    if (!showProgress) return;
    if (status === LaunchStatus.COMPLETED) return;

    const totalDuration = DEFAULT_STEPS.reduce((acc, step) => acc + step.duration, 0);
    const updateInterval = 100; // Update every 100ms instead of 50ms
    const totalUpdates = totalDuration / updateInterval;
    const progressIncrement = 100 / totalUpdates;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + progressIncrement;
        if (next >= 100) {
          clearInterval(timer);
          return 100;
        }
        return next;
      });
    }, updateInterval);

    return () => clearInterval(timer);
  }, [status, showProgress]);

  // Handle Step Transitions
  useEffect(() => {
    if (!showProgress) return;
    if (status === LaunchStatus.COMPLETED) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const processStep = (index: number) => {
      if (index >= DEFAULT_STEPS.length) {
        // All steps done
        setStatus(LaunchStatus.COMPLETED);
        // Wait a moment to show the success state before calling onComplete
        if (onComplete) {
          setTimeout(() => onComplete(), 2000); // Reduced from 2500ms
        }
        return;
      }

      setCurrentStepIndex(index);

      const stepDuration = DEFAULT_STEPS[index].duration;
      timeoutId = setTimeout(() => {
        processStep(index + 1);
      }, stepDuration);
    };

    // Start processing
    if (currentStepIndex === 0 && progress < 5) {
      processStep(0);
    }

    return () => clearTimeout(timeoutId);
  }, [showProgress]); // Run once on mount if showProgress is true

  const getStepIcon = (index: number) => {
    if (index < currentStepIndex) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (index === currentStepIndex) return <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />;
    return <div className="w-5 h-5 rounded-full border-2 border-gray-200" />;
  };

  const getSpecificIcon = (id: string) => {
    switch (id) {
      case 'org': return <Server className="w-4 h-4" />;
      case 'db': return <Database className="w-4 h-4" />;
      case 'auth': return <ShieldCheck className="w-4 h-4" />;
      case 'features': return <Sparkles className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  // If showProgress is false, show a simplified loader (fallback)
  if (!showProgress) {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
    };
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <Loader2 className={`animate-spin ${sizeClasses[size]} text-indigo-600 mb-4`} />
        {message && <p className="text-gray-600 font-medium">{message}</p>}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[500px] w-full max-w-2xl mx-auto p-4">

      {/* SIMPLIFIED: Single subtle background instead of multiple animated blobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-3xl pointer-events-none" />

      {/* Main Card - Simplified, no glass effects */}
      <div className="relative w-full bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">

        {/* Header Section - Simplified */}
        <div className="p-8 border-b border-slate-200 text-center">
          <div className="flex flex-col items-center">
            {/* Logo */}
            <div className="mb-4 relative">
              <div className="absolute inset-0 bg-white/20 rounded-xl blur-md"></div>
              <img
                src={config.LOGO_URL}
                alt="Zopkit Logo"
                className="relative h-14 w-auto object-contain rounded-lg"
              />
            </div>

            {/* Company Name */}
            {companyName && (
              <div className="mb-4">
                <h1 className="text-xl font-bold text-[#1B2E5A] tracking-tight">
                  Welcome, {companyName}
                </h1>
              </div>
            )}

            <h2 className="text-2xl font-bold text-[#1B2E5A] mb-2 tracking-tight">
              {status === LaunchStatus.COMPLETED ? `Welcome, ${userName}!` : (message || 'Setting up your organization...')}
            </h2>
            <p className="text-gray-600 text-base max-w-xs mx-auto">
              {status === LaunchStatus.COMPLETED
                ? "Your workspace is ready! Start managing your team and business operations."
                : "We're configuring your workspace with all the tools you need to succeed."}
            </p>
          </div>
        </div>

        {/* Progress Section - Simplified */}
        <div className="p-8 space-y-6 bg-slate-50/50">

          {/* Main Progress Bar - Simplified */}
          <div className="relative">
            <div className="flex justify-between text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>System Status</span>
              </div>
              <span className={`transition-colors duration-300 ${status === LaunchStatus.COMPLETED ? "text-emerald-600" : "text-indigo-600"}`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  status === LaunchStatus.COMPLETED
                    ? 'bg-emerald-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Steps List - Simplified */}
          <div className="space-y-3">
            {DEFAULT_STEPS.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex || status === LaunchStatus.COMPLETED;

              return (
                <div
                  key={step.id}
                  className={`flex items-center p-4 rounded-xl border transition-all duration-300 ${
                    isActive
                      ? 'bg-white border-indigo-200 shadow-md'
                      : 'bg-transparent border-transparent'
                  }`}
                >
                  <div className="mr-4 flex-shrink-0">
                    {getStepIcon(index)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isCompleted ? 'text-gray-800' : 'text-gray-600'}`}>
                        {step.label}
                      </span>
                      {isActive && (
                         <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                           Processing
                         </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                      {isActive && (
                        <span className="text-indigo-600">
                          {getSpecificIcon(step.id)}
                        </span>
                      )}
                      {step.subtext}
                    </p>
                  </div>
                  {isCompleted && (
                    <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      DONE
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer / Status Bar - Simplified */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 text-xs font-mono text-gray-500 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === LaunchStatus.COMPLETED ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
            <span className="font-semibold tracking-wider">
                {status === LaunchStatus.COMPLETED ? 'SYSTEM_READY' : 'EXECUTING_BATCH_JOBS...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-50">SESSION ID:</span>
            <span className="font-semibold">{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};