import React, { useState, useEffect, useRef } from 'react';
import { StepIndicator } from './StepIndicator';
import { NavigationButtons } from './NavigationButtons';
import { StepRenderer } from './StepRenderer';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData } from '../schemas';
import { StepConfig } from '../config/flowConfigs';
import { UserClassification } from './FlowSelector';
import { config } from '@/lib/config';
import { 
  ShieldCheck, 
  Loader2, 
  Globe, 
  Zap, 
  FileText, 
  HelpCircle, 
  Sparkles,
  ChevronUp,
  ChevronDown,
  ArrowRight
} from 'lucide-react';

interface OnboardingLayoutProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  stepsConfig: StepConfig[];
  currentStep: number;
  canProceed: () => boolean;
  canSubmit: () => boolean;
  getStepStatus: (stepNumber: number) => 'completed' | 'active' | 'error' | 'upcoming';
  onPrev: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  onEditStep?: (stepNumber: number) => void;
  onStepClick?: (stepNumber: number) => void;
  userClassification?: UserClassification;
  isSubmitting?: boolean;
}

export const OnboardingLayout = React.memo(({
  form,
  stepsConfig = [],
  currentStep,
  canProceed,
  canSubmit,
  getStepStatus,
  onPrev,
  onNext,
  onSubmit,
  onEditStep,
  onStepClick,
  userClassification,
  isSubmitting = false
}: OnboardingLayoutProps) => {
  const [showSupport, setShowSupport] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top when step changes (without smooth behavior to prevent lag)
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentStep]);

  if (!stepsConfig || stepsConfig.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1B2E5A] animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((currentStep / stepsConfig.length) * 100);

  // Dynamic content configuration based on current step
  const getFooterContent = (step: number) => {
    switch (step) {
      case 1: // Location
        return {
          title: "Regional Intelligence",
          subtitle: "Optimizing for India",
          text: "Zopkit is actively configuring local tax schemas and compliance rules for your region.",
          icon: <Globe className="w-4 h-4 text-emerald-600" />,
          color: "emerald"
        };
      case 2: // Business Details
        return {
          title: "Entity Verification",
          subtitle: "Real-time Registry Check",
          text: "We are syncing with official business registries to verify your trade name availability.",
          icon: <Zap className="w-4 h-4 text-amber-600" />,
          color: "amber"
        };
      case 3: // Admin Details
        return {
          title: "Secure Vault",
          subtitle: "AES-256 Encryption",
          text: "Your sensitive personal data is being encrypted before transmission. Zopkit Shield™ active.",
          icon: <ShieldCheck className="w-4 h-4 text-blue-600" />,
          color: "blue"
        };
      case 4: // Review
        return {
          title: "Compliance Audit",
          subtitle: "Final System Check",
          text: "Our AI is scanning your application for inconsistencies before submission to regulators.",
          icon: <FileText className="w-4 h-4 text-rose-600" />,
          color: "rose"
        };
      default:
        return {
          title: "Onboarding Guide",
          subtitle: "Zopkit Assistant",
          text: "Follow the steps to complete your profile. We're here to help you set up correctly.",
          icon: <Sparkles className="w-4 h-4 text-purple-600" />,
          color: "purple"
        };
    }
  };

  const footerContent = getFooterContent(currentStep);

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row overflow-hidden font-sans text-[#1B2E5A] selection:bg-slate-200 selection:text-slate-900 relative">
      {/* Global Background Gradients (Moved from main to cover the entire container) */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-100 to-indigo-100 pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-300 via-transparent to-pink-200/40 pointer-events-none -z-10" />
      {/* Right/Top - Blue for iPhone Area */}
      <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-gradient-to-bl from-blue-500/50 to-indigo-500/40 blur-3xl rounded-full pointer-events-none transform translate-x-1/4 -translate-y-1/4 -z-10" />
      {/* Left/Bottom - Pink/Purple for Sidebar Area */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-pink-100/40 to-purple-100/40 blur-3xl rounded-full pointer-events-none transform -translate-x-1/4 translate-y-1/4 -z-10" />
      {/* Center - Subtle Blend */}
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-200/20 via-indigo-200/20 to-pink-200/20 blur-3xl rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 -z-10" />
      
      {/* LEFT SIDEBAR: Ultra Glass Aesthetics - Pink & White Theme */}
      <aside className="hidden lg:flex flex-col w-[340px] border-r border-white/20 z-20 relative shadow-[0_8px_32px_0_rgba(255,192,203,0.15)] backdrop-blur-[25px] backdrop-saturate-[180%] bg-white/20 overflow-hidden">
        
        {/* Dynamic Animated Background Layer - Pink/White Theme */}
        <div className="absolute inset-0 z-0 pointer-events-none">
           {/* Base Gradient Overlay */}
           <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-pink-50/30 to-white/40" />
           
           {/* Moving Color Blobs - Pink/Rose/White for soft glass effect */}
           <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-pink-300/30 rounded-full blur-[100px] animate-pulse mix-blend-overlay" style={{ animationDuration: '8s' }} />
           <div className="absolute bottom-[-10%] right-[-20%] w-[400px] h-[400px] bg-rose-300/30 rounded-full blur-[100px] animate-pulse mix-blend-overlay" style={{ animationDuration: '10s', animationDelay: '2s' }} />
           <div className="absolute top-[40%] left-[-30%] w-[300px] h-[300px] bg-fuchsia-200/30 rounded-full blur-[80px] animate-pulse mix-blend-overlay" style={{ animationDuration: '7s', animationDelay: '4s' }} />
           
           {/* Noise Texture for Frosted Glass Realism */}
           <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
           
           {/* Refractive Border Shine */}
           <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/80 to-transparent opacity-60" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="p-8 flex-1 flex flex-col min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Brand Header */}
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex justify-center w-full">
                <div className="relative group cursor-pointer p-0 m-0">
                  {/* Logo Glow */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-pink-400/30 to-rose-400/30 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  
                  {/* Logo Glass Container - Centered & Attractive */}
                  <div className="relative  bg-white/10 p-0 m-0 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] border border-white/60 ring-1 ring-white/40 group-hover:bg-white/60 transition-all duration-300 flex items-center justify-center  hover:shadow-lg hover:shadow-pink-100/50 hover:scale-[1.02]">
              <img
                src={config.LOGO_URL}
                alt="Zopkit Logo"
                      className="h-24 w-full object-contain rounded-lg drop-shadow-md"
              />
            </div>
                       </div>
                 </div>
              
              <div className="h-px w-full bg-gradient-to-r from-white/0 via-pink-200/50 to-white/0" />
          </div>

            <div className="flex-1 pl-1">
             <StepIndicator
              stepsConfig={stepsConfig}
              currentStep={currentStep}
              getStepStatus={getStepStatus}
              onStepClick={onStepClick}
            />
          </div>
        </div>

          {/* HIGHLY DYNAMIC FOOTER - Glass Card Style */}
          <div className="relative border-t border-white/30 bg-gradient-to-b from-white/10 to-white/30 backdrop-blur-xl flex-shrink-0 shadow-[0_-1px_0_rgba(255,255,255,0.2)]">
            {/* Dynamic Progress Line - Pink Glowing */}
            <div className="absolute top-0 left-0 h-[3px] bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400 shadow-[0_0_15px_rgba(244,114,182,0.6)]" style={{ width: `${progressPercent}%`, transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
            
            <div className="p-6 relative z-10">
              {/* Context Card */}
            <div 
              key={currentStep}
                className="bg-white/30 backdrop-blur-xl rounded-2xl border border-white/50 p-4 shadow-[0_8px_32px_0_rgba(255,192,203,0.1)] transition-all duration-300 hover:bg-white/50 hover:border-white/60 hover:shadow-[0_8px_32px_0_rgba(255,192,203,0.2)] group ring-1 ring-white/30"
            >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br from-white/60 to-white/40 border border-white/60 shrink-0 shadow-lg shadow-pink-500/5 group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/40`}>
                  {footerContent.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-slate-800/90 drop-shadow-sm">
                    {footerContent.title}
                  </h4>
                      <span className="text-[9px] font-bold text-slate-500/80 bg-white/50 px-2 py-0.5 rounded-full border border-white/40 shadow-sm">
                        STEP {currentStep}/{stepsConfig.length}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-pink-600/90 uppercase tracking-wider mb-1.5">
                    {footerContent.subtitle}
                  </p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {footerContent.text}
                  </p>
                </div>
              </div>
            </div>

            {/* Expandable Support Area */}
              <div className="mt-3" id="need-assistance-section">
                 <div className={`overflow-hidden transition-all duration-300 ease-out ${showSupport ? 'max-h-[300px] mb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-2 bg-white/30 rounded-xl p-2 border border-white/40 shadow-inner ring-1 ring-white/20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Handle documentation action
                      }}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-white/40 hover:bg-white/70 hover:shadow-lg hover:shadow-pink-500/5 border border-transparent hover:border-white/50 group/option text-left cursor-pointer transition-all duration-300"
                    >
                       <div>
                         <div className="text-xs font-bold text-slate-700">Read Documentation</div>
                           <div className="text-[10px] text-slate-500">View guide for Step {currentStep}</div>
                         </div>
                         <div className="h-7 w-7 rounded-full bg-white/50 flex items-center justify-center group-hover/option:bg-pink-500 group-hover/option:text-white transition-all shadow-sm">
                           <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover/option:text-white" />
                       </div>
                    </button>
                  </div>
                 </div>

                 <button
                    type="button"
                    onClick={() => {
                      const newShowSupport = !showSupport;
                      setShowSupport(newShowSupport);
                      // Scroll to top of assistance section when opened
                      if (newShowSupport) {
                        setTimeout(() => {
                          const section = document.getElementById('need-assistance-section');
                          if (section) {
                            section.scrollIntoView({ behavior: 'smooth', block: 'end' });
                          }
                        }, 100);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-white/30 transition-all duration-300 group/btn border border-transparent hover:border-white/40 hover:shadow-sm"
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-7 h-7 rounded-full bg-white/50 flex items-center justify-center group-hover/btn:bg-pink-500 group-hover/btn:text-white transition-all shadow-sm ring-1 ring-white/40">
                        <HelpCircle className="w-4 h-4 text-slate-500 group-hover/btn:text-white transition-colors" />
                     </div>
                     <span className="text-xs font-bold text-slate-600 group-hover/btn:text-slate-800">Need help?</span>
                   </div>
                   {showSupport ? (
                     <ChevronDown className="w-4 h-4 text-slate-400 group-hover/btn:text-slate-600 transition-colors" />
                   ) : (
                     <ChevronUp className="w-4 h-4 text-slate-400 group-hover/btn:text-slate-600 transition-colors" />
                   )}
                 </button>
               </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden glass-panel border-b border-white/20 sticky top-0 z-30 px-4 py-3">
        <div className="flex justify-between items-center mb-2">
           <div className="flex items-center gap-3">
             <img 
               src={config.LOGO_URL} 
               alt="Zopkit Logo" 
               className="h-8 w-auto object-contain"
             />
             <div>
               <span className="block text-sm font-bold text-[#1B2E5A]">Step {currentStep}</span>
               <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                 {stepsConfig.find(s => s.number === currentStep)?.title}
               </span>
             </div>
           </div>
           <span className="text-xs font-bold text-[#1B2E5A]">{progressPercent}%</span>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-slate-900 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* RIGHT CONTENT: Main Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Elegant Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-purple-100/20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-3xl rounded-full pointer-events-none transform translate-x-1/4 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/20 to-pink-500/20 blur-3xl rounded-full pointer-events-none transform -translate-x-1/4 translate-y-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-300/10 via-indigo-300/10 to-purple-300/10 blur-3xl rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2" />
        
        {/* Scrollable Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto scroll-smooth relative z-10 custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="max-w-5xl mx-auto w-full px-6 py-10 lg:px-8 lg:py-12">
            <StepRenderer
              currentStep={currentStep}
              stepsConfig={stepsConfig}
              form={form}
              onEditStep={onEditStep}
              userClassification={userClassification}
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 border-t border-white/10 bg-white/10 backdrop-blur-md px-6 py-4 lg:px-8 lg:py-5 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <div className="max-w-5xl mx-auto w-full">
            <NavigationButtons
              currentStep={currentStep}
              stepsConfig={stepsConfig}
              canProceed={canProceed}
              canSubmit={canSubmit}
              onPrev={onPrev}
              onNext={onNext}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </main>

    </div>
  );
});
