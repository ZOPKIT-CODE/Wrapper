import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  Server, 
  ShieldCheck, 
  Database, 
  Layout,
  Zap,
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

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
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
  
  // Create a smoother progress bar by updating frequently
  useEffect(() => {
    if (!showProgress) return;
    if (status === LaunchStatus.COMPLETED) return;

    const totalDuration = DEFAULT_STEPS.reduce((acc, step) => acc + step.duration, 0);
    const updateInterval = 50; // Update every 50ms
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
          setTimeout(() => onComplete(), 2500); 
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      case 'features': return <Layout className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
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
    <div className="relative flex flex-col items-center justify-center min-h-[600px] w-full max-w-2xl mx-auto p-4">
      
      {/* Dynamic Background Elements - Light Theme */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200/50 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob animation-delay-4000"></div>

      {/* Main Card - Glassmorphism White */}
      <div className="relative w-full backdrop-blur-xl bg-white/90 border border-white/50 rounded-3xl shadow-2xl overflow-hidden animate-scale-in ring-1 ring-black/5">
        
        {/* Header Section */}
        <div className="p-8 border-b border-gray-100 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-purple-50/50 to-pink-50/50 opacity-80"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo */}
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-white/20 rounded-xl blur-md"></div>
              <img
                src={config.LOGO_URL}
                alt="Zopkit Logo"
                className="relative h-16 w-auto object-contain rounded-lg"
              />
            </div>

            {/* Company Name */}
            {companyName && (
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-[#1B2E5A] tracking-tight">
                  Welcome, {companyName}
                </h1>
              </div>
            )}

            <h2 className="text-3xl font-bold text-[#1B2E5A] mb-2 tracking-tight">
              {status === LaunchStatus.COMPLETED ? `Welcome, ${userName}!` : (message || 'Setting up your organization...')}
            </h2>
            <p className="text-gray-500 text-base max-w-xs mx-auto font-medium">
              {status === LaunchStatus.COMPLETED 
                ? "Your workspace is ready! Start managing your team and business operations." 
                : "We're configuring your workspace with all the tools you need to succeed."}
            </p>
          </div>
        </div>

        {/* Progress Section */}
        <div className="p-8 space-y-8 bg-white/50">
          
          {/* Main Progress Bar */}
          <div className="relative group">
            <div className="flex justify-between text-xs uppercase tracking-wider font-bold text-gray-400 mb-3">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>System Status</span>
              </div>
              <span className={`transition-colors duration-300 ${status === LaunchStatus.COMPLETED ? "text-emerald-600" : "text-indigo-600"}`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner ring-1 ring-gray-200/50">
              <div 
                className={`
                  h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden
                  ${status === LaunchStatus.COMPLETED 
                    ? 'bg-emerald-500' 
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500'}
                `}
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer Effect */}
                {status !== LaunchStatus.COMPLETED && (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" 
                       style={{ backgroundSize: '1000px 100%' }}>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-3">
            {DEFAULT_STEPS.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex || status === LaunchStatus.COMPLETED;
              const isPending = index > currentStepIndex && status !== LaunchStatus.COMPLETED;

              return (
                <div 
                  key={step.id}
                  className={`
                    flex items-center p-4 rounded-xl border transition-all duration-500
                    ${isActive 
                      ? 'bg-white border-indigo-100 shadow-lg shadow-indigo-100/50 translate-x-2' 
                      : 'bg-transparent border-transparent'}
                    ${isPending ? 'opacity-50 grayscale' : 'opacity-100'}
                  `}
                >
                  <div className={`
                    mr-4 flex-shrink-0 transition-transform duration-300
                    ${isActive ? 'scale-110' : 'scale-100'}
                  `}>
                    {getStepIcon(index)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>
                        {step.label}
                      </span>
                      {isActive && (
                         <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold animate-pulse border border-indigo-100">
                           Processing
                         </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                      {isActive && (
                        <span className="text-indigo-500">
                          {getSpecificIcon(step.id)}
                        </span>
                      )}
                      {step.subtext}
                    </p>
                  </div>
                  {isCompleted && (
                    <div className="opacity-0 animate-fade-up flex items-center gap-1" style={{ opacity: 1 }}>
                       <span className="text-[10px] font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                         DONE
                       </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer / Status Bar */}
        <div className="bg-gray-50/80 p-4 border-t border-gray-100 text-[10px] font-mono text-gray-400 flex justify-between items-center backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === LaunchStatus.COMPLETED ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
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
