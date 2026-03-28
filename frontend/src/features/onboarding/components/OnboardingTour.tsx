import { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  target: string;
  content: string;
  title: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingTour = ({ onComplete, onSkip }: OnboardingTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [elementFound, setElementFound] = useState(false);

  const handleComplete = () => {
    localStorage.setItem('onboarding-tour-completed', 'true');
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-tour-completed', 'true');
    setIsVisible(false);
    onSkip();
  };

  const tourSteps: TourStep[] = [
    {
      target: '#need-assistance-section',
      title: 'AI Assistant Available',
      content: 'Click here to access our AI assistant! It can help you fill out the entire onboarding form automatically.',
      position: 'left'
    },
    {
      target: '#fill-with-ai-button',
      title: 'Fill with AI',
      content: 'Click "Fill with AI" to open the AI chatbot. You can drag it anywhere on the screen and it will help you complete the form.',
      position: 'top'
    }
  ];

  // Initialize tour visibility
  useEffect(() => {
    const tourCompleted = localStorage.getItem('onboarding-tour-completed');
    if (!tourCompleted) {
      // Wait for DOM elements to be ready - check multiple times
      let retries = 0;
      const maxRetries = 10;
      
      const checkAndShow = () => {
        const firstElement = document.querySelector(tourSteps[0].target);
        if (firstElement) {
          setIsVisible(true);
        } else {
          retries++;
          if (retries < maxRetries) {
            // Retry if element not found
            setTimeout(checkAndShow, 300);
          } else {
            console.warn('Tour: Element not found after max retries');
            // Show anyway after max retries
            setIsVisible(true);
          }
        }
      };
      
      // Start checking after initial render delay
      setTimeout(checkAndShow, 1500);
    } else {
    }
  }, []);

  // Handle element highlighting and scrolling
  useEffect(() => {
    if (!isVisible) return;

    const currentStepData = tourSteps[currentStep];
    if (!currentStepData) {
      handleComplete();
      return;
    }

    const timer = setTimeout(() => {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        setElementFound(true);
        
        // Scroll to element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the element after scroll
        setTimeout(() => {
          (element as HTMLElement).style.transition = 'all 0.3s';
          (element as HTMLElement).style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5)';
          (element as HTMLElement).style.borderRadius = '8px';
          (element as HTMLElement).style.zIndex = '100';
          (element as HTMLElement).style.position = 'relative';
        }, 500);
      } else {
        console.warn(`Tour: Element not found for step ${currentStep + 1}:`, currentStepData.target);
        setElementFound(false);
        // Skip to next step if element not found
        if (currentStep < tourSteps.length - 1) {
          setTimeout(() => setCurrentStep(currentStep + 1), 500);
        } else {
          handleComplete();
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      const element = document.querySelector(currentStepData.target);
      if (element) {
        (element as HTMLElement).style.boxShadow = '';
        (element as HTMLElement).style.zIndex = '';
        (element as HTMLElement).style.position = '';
      }
    };
  }, [currentStep, isVisible]);

  // Skip to next step if element not found
  useEffect(() => {
    if (!isVisible) return;
    
    if (!elementFound) {
      const timer = setTimeout(() => {
        const currentStepData = tourSteps[currentStep];
        if (currentStepData) {
          const element = document.querySelector(currentStepData.target);
          if (!element && currentStep < tourSteps.length - 1) {
            setCurrentStep(currentStep + 1);
          } else if (!element) {
            handleComplete();
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [elementFound, currentStep, isVisible]);

  if (!isVisible || currentStep >= tourSteps.length) {
    return null;
  }

  const currentStepData = tourSteps[currentStep];
  if (!currentStepData) {
    return null;
  }

  const element = document.querySelector(currentStepData.target);
  if (!element) {
    // Show a fallback tooltip in center if element not found
    return (
      <>
        <div 
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
        <div
          className="fixed z-[110] w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-5"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#1B2E5A] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1B2E5A] mb-1">{currentStepData.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{currentStepData.content}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSkip();
              }}
              className="h-6 w-6 p-0 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-slate-500">
              Step {currentStep + 1} of {tourSteps.length}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setElementFound(false);
                    setCurrentStep(currentStep - 1);
                  }}
                  className="text-xs"
                >
                  Previous
                </Button>
              )}
              {currentStep < tourSteps.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setElementFound(false);
                    setCurrentStep(currentStep + 1);
                  }}
                  className="text-xs bg-[#1B2E5A] hover:bg-[#152449]"
                >
                  Next <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleComplete();
                  }}
                  className="text-xs bg-[#1B2E5A] hover:bg-[#152449]"
                >
                  Got it!
                </Button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const rect = element.getBoundingClientRect();
  const position = currentStepData.position || 'top';

  const getTooltipPosition = () => {
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const offset = 20;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20; // Minimum padding from viewport edges

    // Ensure rect is valid
    if (!rect || rect.width === 0 || rect.height === 0) {
      // Fallback to center
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    try {
      switch (position) {
        case 'left':
          // Position to the left of the element
          let leftX = rect.left - tooltipWidth - offset;
          let leftTop = rect.top + rect.height / 2;
          
          // If tooltip would go off left edge, position to the right instead
          if (leftX < padding) {
            leftX = rect.right + offset;
            // If still off screen, center horizontally
            if (leftX + tooltipWidth > viewportWidth - padding) {
              leftX = Math.max(padding, (viewportWidth - tooltipWidth) / 2);
            }
          }
          
          // Ensure vertical position is within bounds
          leftTop = Math.max(
            padding + tooltipHeight / 2,
            Math.min(leftTop, viewportHeight - padding - tooltipHeight / 2)
          );
          
          return {
            top: `${leftTop}px`,
            left: `${Math.max(padding, Math.min(leftX, viewportWidth - tooltipWidth - padding))}px`,
            transform: 'translateY(-50%)'
          };
          
        case 'right':
          // Position to the right of the element
          let rightX = rect.right + offset;
          let rightTop = rect.top + rect.height / 2;
          
          // If tooltip would go off right edge, position to the left instead
          if (rightX + tooltipWidth > viewportWidth - padding) {
            rightX = rect.left - tooltipWidth - offset;
            // If still off screen, center horizontally
            if (rightX < padding) {
              rightX = Math.max(padding, (viewportWidth - tooltipWidth) / 2);
            }
          }
          
          // Ensure vertical position is within bounds
          rightTop = Math.max(
            padding + tooltipHeight / 2,
            Math.min(rightTop, viewportHeight - padding - tooltipHeight / 2)
          );
          
          return {
            top: `${rightTop}px`,
            left: `${Math.max(padding, Math.min(rightX, viewportWidth - tooltipWidth - padding))}px`,
            transform: 'translateY(-50%)'
          };
          
        case 'bottom':
          let bottomTop = rect.bottom + offset;
          let bottomLeft = rect.left + rect.width / 2;
          
          // Ensure vertical position is within bounds
          if (bottomTop + tooltipHeight > viewportHeight - padding) {
            bottomTop = rect.top - tooltipHeight - offset;
            // If still off screen, center vertically
            if (bottomTop < padding) {
              bottomTop = Math.max(padding, (viewportHeight - tooltipHeight) / 2);
            }
          }
          
          // Ensure horizontal position is within bounds
          bottomLeft = Math.max(
            padding + tooltipWidth / 2,
            Math.min(bottomLeft, viewportWidth - padding - tooltipWidth / 2)
          );
          
          return {
            top: `${Math.max(padding, Math.min(bottomTop, viewportHeight - tooltipHeight - padding))}px`,
            left: `${bottomLeft}px`,
            transform: 'translateX(-50%)'
          };
          
        default: // top
          let topY = rect.top - tooltipHeight - offset;
          let topLeft = rect.left + rect.width / 2;
          
          // Ensure vertical position is within bounds
          if (topY < padding) {
            topY = rect.bottom + offset;
            // If still off screen, center vertically
            if (topY + tooltipHeight > viewportHeight - padding) {
              topY = Math.max(padding, (viewportHeight - tooltipHeight) / 2);
            }
          }
          
          // Ensure horizontal position is within bounds
          topLeft = Math.max(
            padding + tooltipWidth / 2,
            Math.min(topLeft, viewportWidth - padding - tooltipWidth / 2)
          );
          
          return {
            top: `${Math.max(padding, Math.min(topY, viewportHeight - tooltipHeight - padding))}px`,
            left: `${topLeft}px`,
            transform: 'translateX(-50%)'
          };
      }
    } catch (error) {
      console.error('Tour: Error calculating position', error);
      // Fallback to center
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
  };

  const tooltipStyle = getTooltipPosition();
  
  // Ensure tooltip is visible - add fallback positioning
  const safeTooltipStyle = {
    ...tooltipStyle,
    // Ensure it's within viewport bounds
    maxWidth: 'calc(100vw - 40px)',
    maxHeight: 'calc(100vh - 40px)',
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
        }}
      />
      
      {/* Tooltip */}
      <div
        className="fixed z-[110] w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-5"
        style={safeTooltipStyle}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#1B2E5A] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[#1B2E5A] mb-1">{currentStepData.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{currentStepData.content}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSkip();
            }}
            className="h-6 w-6 p-0 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-slate-500">
            Step {currentStep + 1} of {tourSteps.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setElementFound(false);
                  setCurrentStep(currentStep - 1);
                }}
                className="text-xs"
              >
                Previous
              </Button>
            )}
            {currentStep < tourSteps.length - 1 ? (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setElementFound(false);
                  setCurrentStep(currentStep + 1);
                }}
                className="text-xs bg-[#1B2E5A] hover:bg-[#152449]"
              >
                Next <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleComplete();
                }}
                className="text-xs bg-[#1B2E5A] hover:bg-[#152449]"
              >
                Got it!
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
