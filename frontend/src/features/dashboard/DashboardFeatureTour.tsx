import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, ArrowRight, Package, Users, Shield, Coins, CheckCircle2, Lightbulb, Zap, Building2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';
// @ts-ignore - canvas-confetti doesn't have types
import confetti from 'canvas-confetti';

interface TourStep {
  target: string;
  content: string;
  title: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  icon?: React.ComponentType<{ className?: string }>;
  proTip?: string;
  tryIt?: boolean;
  href?: string;
  isNew?: boolean;
  keyAction?: string;
  featureTarget?: string;
  secondaryFeatureTarget?: string;
  secondaryContent?: string;
  secondaryKeyAction?: string;
  tertiaryFeatureTarget?: string;
  tertiaryContent?: string;
  tertiaryKeyAction?: string;
  bullets?: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour-step="applications"]',
    title: 'Applications',
    content: 'Launch and manage your apps. Your connected applications live here.',
    position: 'bottom',
    icon: Package,
    proTip: 'You can launch multiple apps from here',
    tryIt: true,
    href: '/dashboard/applications',
    isNew: false,
    keyAction: 'Launch an app',
    featureTarget: '[data-tour-feature="launch-app"]',
    bullets: ['Launch an app', 'View app details', 'Manage access']
  },
  {
    target: '[data-tour-step="users"]',
    title: 'Team',
    content: 'Invite and manage team members. Control who has access to which apps.',
    position: 'bottom',
    icon: Users,
    proTip: 'Invite link can be copied and shared',
    tryIt: true,
    href: '/dashboard/users',
    isNew: false,
    keyAction: 'Invite a team member',
    featureTarget: '[data-tour-feature="invite-user"]',
    secondaryFeatureTarget: '[data-tour-feature="users-table"]',
    secondaryContent: 'View and manage all your team members in this table. You can search, filter, and perform actions on users.',
    secondaryKeyAction: 'View user details',
    bullets: ['Invite team members', 'Assign apps to users', 'Manage permissions']
  },
  {
    target: '[data-tour-step="organization"]',
    title: 'Organization',
    content: 'View and manage your organization structure. Create locations and departments to organize your team.',
    position: 'bottom',
    icon: Building2,
    proTip: 'You can create nested organizations and locations',
    tryIt: true,
    href: '/dashboard/organization',
    isNew: false,
    keyAction: 'View organization hierarchy',
    featureTarget: '[data-tour-feature="visual-map"]',
    bullets: ['View organization hierarchy', 'Create locations', 'Manage departments', 'Allocate credits']
  },
  
  {
    target: '[data-tour-step="roles"]',
    title: 'Roles & Permissions',
    content: 'Create and copy roles. Define permissions so access stays secure.',
    position: 'bottom',
    icon: Shield,
    proTip: 'Roles can be copied to save time',
    tryIt: true,
    href: '/dashboard/roles',
    isNew: true,
    keyAction: 'Copy a role',
    featureTarget: '[data-tour-feature="create-role"]',
    bullets: ['Create custom roles', 'Copy existing roles', 'Fine-tune permissions']
  },
  {
    target: '[data-tour-step="credits"]',
    title: 'Billing & Credits',
    content: 'Top up credits and manage your plan. Track usage and purchase credits here.',
    position: 'bottom',
    icon: Coins,
    proTip: 'Usage alerts can be set in Settings',
    tryIt: true,
    href: '/dashboard/billing',
    isNew: false,
    keyAction: 'Purchase credits',
    featureTarget: '[data-tour-feature="purchase-credits"]',
    secondaryFeatureTarget: '[data-tour-feature="credit-packages"]',
    secondaryContent: 'Browse available credit packages. Choose from starter, professional, or enterprise packages based on your needs.',
    secondaryKeyAction: 'Select a credit package',
    tertiaryFeatureTarget: '[data-tour-feature="upgrade-plans"]',
    tertiaryContent: 'Upgrade your plan to unlock more features and credits. All plans include annual free credits that renew with your subscription.',
    tertiaryKeyAction: 'Upgrade your plan',
    bullets: ['Purchase credits', 'View credit balance', 'Track usage', 'Upgrade plans']
  },
  {
    target: '[data-tour-step="settings"]',
    title: 'Settings',
    content: 'Customize your workspace, manage account details, and configure preferences.',
    position: 'bottom',
    icon: Settings,
    proTip: 'Settings are saved automatically',
    tryIt: true,
    href: '/dashboard/settings',
    isNew: false,
    keyAction: 'Configure settings',
    featureTarget: '[data-tour-feature="settings-account"]',
    bullets: ['Appearance & theme', 'Account details', 'Preferences', 'Localization']
  }
];

interface DashboardFeatureTourProps {
  onComplete: () => void;
  onSkip: () => void;
  initialStep?: number;
  onDismiss?: (stepIndex: number) => void;
}

export const DashboardFeatureTour = ({ onComplete, onSkip, initialStep = 0, onDismiss }: DashboardFeatureTourProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(() => {
    // Check for saved step from resume, otherwise use initialStep
    const savedStep = localStorage.getItem('dashboard-tour-step');
    return savedStep ? parseInt(savedStep, 10) : initialStep;
  });
  const [isVisible, setIsVisible] = useState(false);
  const [elementFound, setElementFound] = useState(false);
  const [hasTriedStep, setHasTriedStep] = useState(false);
  const [featurePhase, setFeaturePhase] = useState<'sidebar' | 'in-page'>('sidebar');
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0); // 0 = first feature, 1 = secondary feature
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoAdvanceDisabled, setAutoAdvanceDisabled] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [connectorUpdateTrigger, setConnectorUpdateTrigger] = useState(0);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tourSteps = TOUR_STEPS;
  const estimatedTime = Math.ceil(tourSteps.length * 15 / 60); // ~15s per step

  // Cleanup function to remove all tour highlights (stable: TOUR_STEPS is constant)
  const cleanupAllHighlights = useCallback(() => {
    TOUR_STEPS.forEach(step => {
      const element = document.querySelector(step.target) as HTMLElement;
      if (element) {
        element.style.boxShadow = '';
        element.style.zIndex = '';
        element.style.position = '';
        element.classList.remove('tour-pulse');
      }
      // Also clean up feature targets if they exist
      if (step.featureTarget) {
        const featureElement = document.querySelector(step.featureTarget) as HTMLElement;
        if (featureElement) {
          featureElement.style.boxShadow = '';
          featureElement.style.zIndex = '';
          featureElement.style.position = '';
          featureElement.classList.remove('tour-pulse');
        }
      }
    });
    targetElementRef.current = null;
  }, []);

  const handleComplete = useCallback(() => {
    // Clean up all highlights first
    cleanupAllHighlights();
    
    // Celebration confetti
    const fireConfetti = () => {
      const count = 150;
      const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999,
      };

      function fire(particleRatio: number, opts: any) {
        if (confetti && typeof confetti === 'function') {
          confetti(Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio)
          }));
        }
      }

      fire(0.25, { spread: 26, startVelocity: 55, colors: ['#6366f1', '#8b5cf6'] });
      fire(0.2, { spread: 60, colors: ['#6366f1', '#a855f7'] });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#6366f1', '#8b5cf6'] });
    };

    setShowCelebration(true);
    fireConfetti();

    setTimeout(() => {
      localStorage.setItem('dashboard-tour-completed', 'true');
      localStorage.removeItem('dashboard-tour-step');
      localStorage.removeItem('dashboard-tour-dismissed');
      setIsVisible(false);
      onComplete();
    }, 1500);
  }, [onComplete, cleanupAllHighlights]);

  const handleSkip = useCallback(() => {
    // Clean up all highlights first
    cleanupAllHighlights();
    
    // Save current step for resume
    localStorage.setItem('dashboard-tour-step', currentStep.toString());
    localStorage.setItem('dashboard-tour-dismissed', 'true');
    setIsVisible(false);
    onDismiss?.(currentStep);
    onSkip();
  }, [currentStep, onSkip, onDismiss, cleanupAllHighlights]);

  const handleDismiss = useCallback(() => {
    handleSkip();
  }, [handleSkip]);

  const goToNextStep = useCallback(() => {
    const currentStepData = tourSteps[currentStep];
    // If we're in in-page phase, cycle through features: 0 -> 1 -> 2 -> next step
    if (featurePhase === 'in-page') {
      if (currentStepData?.secondaryFeatureTarget && currentFeatureIndex === 0) {
        // Move to secondary feature
        setCurrentFeatureIndex(1);
        setElementFound(false);
        return;
      }
      if (currentStepData?.tertiaryFeatureTarget && currentFeatureIndex === 1) {
        // Move to tertiary feature
        setCurrentFeatureIndex(2);
        setElementFound(false);
        return;
      }
    }
    
    if (currentStep < tourSteps.length - 1) {
      setElementFound(false);
      setHasTriedStep(false);
      setFeaturePhase('sidebar'); // Reset to sidebar phase for next step
      setCurrentFeatureIndex(0);
      setCountdown(null);
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, tourSteps, featurePhase, currentFeatureIndex, handleComplete]);

  const goToPreviousStep = useCallback(() => {
    const currentStepData = tourSteps[currentStep];
    // If we're in in-page phase, go back through features: 2 -> 1 -> 0 -> previous step
    if (featurePhase === 'in-page') {
      if (currentStepData?.tertiaryFeatureTarget && currentFeatureIndex === 2) {
        // Go back to secondary feature
        setCurrentFeatureIndex(1);
        setElementFound(false);
        return;
      }
      if (currentStepData?.secondaryFeatureTarget && currentFeatureIndex === 1) {
        // Go back to first feature
        setCurrentFeatureIndex(0);
        setElementFound(false);
        return;
      }
    }
    
    if (currentStep > 0) {
      setElementFound(false);
      setHasTriedStep(false);
      setFeaturePhase('sidebar'); // Reset to sidebar phase
      setCurrentFeatureIndex(0);
      setCountdown(null);
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, tourSteps, featurePhase, currentFeatureIndex]);

  const handleTryIt = useCallback(() => {
    const currentStepData = tourSteps[currentStep];
    if (currentStepData?.href) {
      navigate({ to: currentStepData.href });
      setHasTriedStep(true);
      
      // Special handling for Settings: programmatically open Account Details tab
      if (currentStepData.href.includes('/dashboard/settings')) {
        setTimeout(() => {
          // Dispatch custom event to open account tab
          window.dispatchEvent(new CustomEvent('tour-open-account-tab'));
        }, 500);
      }
      
      // If this step has a featureTarget, switch to in-page phase after navigation
      if (currentStepData.featureTarget) {
        // Wait for page and lazy content to render, then switch to feature phase
        setTimeout(() => {
          setFeaturePhase('in-page');
          setCurrentFeatureIndex(0); // Start with first feature
          setElementFound(false); // Reset to trigger element finding for feature target
        }, 800);
      }
    }
  }, [currentStep, tourSteps, navigate]);

  // Initialize tour visibility once when not yet visible (avoids re-running on every step change)
  useEffect(() => {
    const tourCompleted = localStorage.getItem('dashboard-tour-completed');
    if (tourCompleted || isVisible) return;

    let retries = 0;
    const maxRetries = 15;
    const checkAndShow = () => {
      const targetStep = tourSteps[currentStep] || tourSteps[0];
      const firstElement = document.querySelector(targetStep.target);
      if (firstElement) {
        setIsVisible(true);
      } else {
        retries++;
        if (retries < maxRetries) {
          setTimeout(checkAndShow, 300);
        } else {
          setIsVisible(true);
        }
      }
    };
    const t = setTimeout(checkAndShow, 1000);
    return () => clearTimeout(t);
  }, [currentStep, isVisible]);

  // Keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        goToPreviousStep();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        const currentStepData = tourSteps[currentStep];
        if (currentStepData?.tryIt && featurePhase === 'sidebar' && !hasTriedStep) {
          handleTryIt();
        } else {
          goToNextStep();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, currentStep, hasTriedStep, goToNextStep, goToPreviousStep, handleDismiss, tourSteps]);

  // Click on highlighted element to advance
  useEffect(() => {
    if (!isVisible || !elementFound) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (targetElementRef.current && targetElementRef.current.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        const currentStepData = tourSteps[currentStep];
        if (currentStepData?.tryIt && featurePhase === 'sidebar' && !hasTriedStep) {
          handleTryIt();
        } else {
          goToNextStep();
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isVisible, elementFound, currentStep, hasTriedStep, featurePhase, handleTryIt, goToNextStep, tourSteps]);

  // Auto-advance with countdown (skip if tryIt step or in feature phase)
  useEffect(() => {
    if (!isVisible || autoAdvanceDisabled || tourSteps[currentStep]?.tryIt || featurePhase === 'in-page') return;

    setCountdown(8);
    const interval = setInterval(() => {
      setCountdown((prev: number | null) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          goToNextStep();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, currentStep, autoAdvanceDisabled, goToNextStep, tourSteps, featurePhase]);

  // Handle element highlighting and scrolling
  useEffect(() => {
    if (!isVisible) return;

    const currentStepData = tourSteps[currentStep];
    if (!currentStepData) {
      handleComplete();
      return;
    }

    // Determine which target to use: featureTarget if in feature phase, otherwise sidebar target
    const targetSelector = (featurePhase === 'in-page' && currentStepData.featureTarget) 
      ? (currentFeatureIndex === 2 && currentStepData.tertiaryFeatureTarget
          ? currentStepData.tertiaryFeatureTarget
          : currentFeatureIndex === 1 && currentStepData.secondaryFeatureTarget 
          ? currentStepData.secondaryFeatureTarget 
          : currentStepData.featureTarget)
      : currentStepData.target;

    const timer = setTimeout(() => {
      // Try to find the target element, with retries for feature targets
      let element = document.querySelector(targetSelector) as HTMLElement;
      
      // If in feature phase and element not found, retry (page/lazy content might still be loading)
      if (featurePhase === 'in-page' && !element && currentStepData.featureTarget) {
        let retries = 0;
        const maxRetries = 25;
        const retryInterval = setInterval(() => {
          element = document.querySelector(targetSelector) as HTMLElement;
          retries++;
          if (element || retries >= maxRetries) {
            clearInterval(retryInterval);
            if (element) {
              highlightElement(element);
              setConnectorUpdateTrigger((prev: number) => prev + 1);
            } else {
              setElementFound(false);
            }
          }
        }, 300);
        return () => clearInterval(retryInterval);
      }

      if (element) {
        highlightElement(element);
        setConnectorUpdateTrigger((prev: number) => prev + 1);
      } else {
        setElementFound(false);
        // If feature phase and target not found, allow user to continue
        if (featurePhase === 'in-page') {
          // Don't auto-advance, let user click Continue
          return;
        }
        if (currentStep < tourSteps.length - 1) {
          setTimeout(() => setCurrentStep(currentStep + 1), 500);
        } else {
          handleComplete();
        }
      }
    }, featurePhase === 'in-page' ? 300 : 300);

    const highlightElement = (el: HTMLElement) => {
      setElementFound(true);
      targetElementRef.current = el;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        el.style.transition = 'all 0.3s';
        el.style.boxShadow = '0 0 0 3px rgb(255, 255, 255), 0 0 20px rgba(99, 102, 241, 0.15)';
        el.style.borderRadius = '8px';
        el.style.zIndex = '100';
        el.style.position = 'relative';
        el.classList.add('tour-pulse');
      }, 400);
    };

    return () => {
      clearTimeout(timer);
      const cleanupElement = document.querySelector(targetSelector) as HTMLElement;
      if (cleanupElement) {
        cleanupElement.style.boxShadow = '';
        cleanupElement.style.zIndex = '';
        cleanupElement.style.position = '';
        cleanupElement.classList.remove('tour-pulse');
      }
      targetElementRef.current = null;
    };
  }, [currentStep, isVisible, featurePhase, currentFeatureIndex, tourSteps, handleComplete]);

  // Cleanup on unmount or when tour becomes invisible
  useEffect(() => {
    if (!isVisible) {
      cleanupAllHighlights();
    }
    // Also cleanup on unmount
    return () => {
      cleanupAllHighlights();
    };
  }, [isVisible, cleanupAllHighlights]);

  // Update connector on scroll/resize (must be before any early return to satisfy Rules of Hooks)
  useEffect(() => {
    if (!isVisible) return;

    const updateConnector = () => {
      setConnectorUpdateTrigger((prev: number) => prev + 1);
    };

    window.addEventListener('scroll', updateConnector, true);
    window.addEventListener('resize', updateConnector);

    return () => {
      window.removeEventListener('scroll', updateConnector, true);
      window.removeEventListener('resize', updateConnector);
    };
  }, [isVisible]);

  if (!isVisible || currentStep >= tourSteps.length) {
    return null;
  }

  const currentStepData = tourSteps[currentStep];
  if (!currentStepData) {
    return null;
  }

  // Determine which target to use: featureTarget if in feature phase, otherwise sidebar target
  const targetSelector = (featurePhase === 'in-page' && currentStepData.featureTarget) 
    ? (currentFeatureIndex === 2 && currentStepData.tertiaryFeatureTarget
        ? currentStepData.tertiaryFeatureTarget
        : currentFeatureIndex === 1 && currentStepData.secondaryFeatureTarget 
        ? currentStepData.secondaryFeatureTarget 
        : currentStepData.featureTarget)
    : currentStepData.target;
  const Icon = currentStepData.icon || Sparkles;
  const isLastStep = currentStep === tourSteps.length - 1;

  const getTooltipPosition = () => {
    const currentElement = document.querySelector(targetSelector) as HTMLElement;
    const tooltipWidth = 360;
    const padding = 24;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Use measured card height when available so we never place card out of viewport
    const measuredHeight = cardRef.current?.getBoundingClientRect()?.height;
    const tooltipHeight = typeof measuredHeight === 'number' && measuredHeight > 0
      ? Math.min(measuredHeight, viewportHeight - padding * 2)
      : 420;

    if (!currentElement) {
      return {
        top: `${Math.max(padding, (viewportHeight - tooltipHeight) / 2)}px`,
        left: `${Math.max(padding + tooltipWidth / 2, Math.min(viewportWidth / 2, viewportWidth - padding - tooltipWidth / 2))}px`,
        transform: 'translateX(-50%)',
        maxHeight: `${viewportHeight - padding * 2}px`,
      };
    }

    const rect = currentElement.getBoundingClientRect();
    const offset = 20;

    try {
      let topY: number;
      let leftX: number;
      let transform: string = 'none';

      // For sidebar phase: right-align the card to avoid overlapping main content
      if (featurePhase === 'sidebar') {
        // Right-align: card's right edge aligns with viewport right edge minus padding
        leftX = viewportWidth - tooltipWidth - padding;
        transform = 'none';
        
        // Vertically align with target (center of target minus half card height)
        topY = rect.top + rect.height / 2 - tooltipHeight / 2;
        
        // Clamp vertical position so card stays fully in viewport
        topY = Math.max(padding, Math.min(topY, viewportHeight - tooltipHeight - padding));
        
        // Ensure card doesn't go off left edge (shouldn't happen but safety check)
        leftX = Math.max(padding, Math.min(leftX, viewportWidth - tooltipWidth - padding));
      } else {
        // In-page phase: position relative to target but avoid overlap
        const position = currentStepData.position || 'bottom';
        let centerX = rect.left + rect.width / 2;

        if (position === 'bottom') {
          topY = rect.bottom + offset;
          if (topY + tooltipHeight > viewportHeight - padding) {
            topY = rect.top - tooltipHeight - offset;
          }
        } else {
          topY = rect.top - tooltipHeight - offset;
          if (topY < padding) {
            topY = rect.bottom + offset;
          }
        }

        // Prefer right side of target to avoid covering it
        // Try right side first
        let preferredLeft = rect.right + offset;
        if (preferredLeft + tooltipWidth > viewportWidth - padding) {
          // If right side doesn't fit, try left side
          preferredLeft = rect.left - tooltipWidth - offset;
          if (preferredLeft < padding) {
            // If neither side fits, center on target
            preferredLeft = centerX;
            transform = 'translateX(-50%)';
          } else {
            transform = 'none';
          }
        } else {
          transform = 'none';
        }

        leftX = preferredLeft;
        
        // Clamp vertical position so card stays fully in viewport
        topY = Math.max(padding, Math.min(topY, viewportHeight - tooltipHeight - padding));
        
        // Clamp horizontal position
        if (transform === 'translateX(-50%)') {
          // Centered: clamp center point
          leftX = Math.max(
            padding + tooltipWidth / 2,
            Math.min(leftX, viewportWidth - padding - tooltipWidth / 2)
          );
        } else {
          // Not centered: clamp left edge
          leftX = Math.max(padding, Math.min(leftX, viewportWidth - tooltipWidth - padding));
        }
      }

      return {
        top: `${topY}px`,
        left: `${leftX}px`,
        transform: transform || 'none',
        maxHeight: `${viewportHeight - padding * 2}px`,
      } as const;
    } catch (error) {
      return {
        top: `${Math.max(padding, (viewportHeight - tooltipHeight) / 2)}px`,
        left: `${viewportWidth / 2}px`,
        transform: 'translateX(-50%)',
        maxHeight: `${viewportHeight - padding * 2}px`,
      };
    }
  };

  const tooltipStyle = getTooltipPosition();
  const safeTooltipStyle = {
    ...tooltipStyle,
    maxWidth: 'min(360px, calc(100vw - 48px))',
    overflowY: 'auto' as const,
  };

  const getOverlayStyle = () => {
    // Use the current target element (sidebar or in-page feature)
    const currentElement = document.querySelector(targetSelector) as HTMLElement;
    if (!currentElement) {
      return { backgroundColor: 'rgba(0, 0, 0, 0.5)' };
    }
    
    const rect = currentElement.getBoundingClientRect();
    const padding = 10;
    
    return {
      clipPath: `polygon(
        0% 0%, 
        0% 100%, 
        ${Math.max(0, rect.left - padding)}px 100%, 
        ${Math.max(0, rect.left - padding)}px ${Math.max(0, rect.top - padding)}px, 
        ${Math.min(window.innerWidth, rect.right + padding)}px ${Math.max(0, rect.top - padding)}px, 
        ${Math.min(window.innerWidth, rect.right + padding)}px ${Math.min(window.innerHeight, rect.bottom + padding)}px, 
        ${Math.max(0, rect.left - padding)}px ${Math.min(window.innerHeight, rect.bottom + padding)}px, 
        ${Math.max(0, rect.left - padding)}px 100%, 
        100% 100%, 
        100% 0%
      )`
    };
  };

  const getConnectorPath = () => {
    // Use the current target element (sidebar or in-page feature)
    const currentElement = document.querySelector(targetSelector) as HTMLElement;
    if (!currentElement || !cardRef.current) return null;

    const elementRect = currentElement.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();
    
    // Calculate connection points - use appropriate edge based on position
    const elementCenterX = elementRect.left + elementRect.width / 2;
    const elementCenterY = elementRect.top + elementRect.height / 2;
    
    // Determine which edge of the card to connect from based on relative position
    const cardLeft = cardRect.left;
    const cardRight = cardRect.right;
    const cardTop = cardRect.top;
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;
    
    // Determine start point based on relative position
    let startX: number, startY: number;
    if (elementRect.left < cardLeft) {
      // Target is to the left of card
      startX = cardLeft;
      startY = cardCenterY;
    } else if (elementRect.left > cardRight) {
      // Target is to the right of card
      startX = cardRight;
      startY = cardCenterY;
    } else if (elementRect.top < cardTop) {
      // Target is above card
      startX = cardCenterX;
      startY = cardTop;
    } else {
      // Target is below card (default)
      startX = cardRight;
      startY = cardCenterY;
    }
    
    const endX = elementCenterX;
    const endY = elementCenterY;

    // Calculate control points for smooth cubic bezier curve
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Control point offset for smooth curve (adjust based on distance and direction)
    const controlOffset = Math.min(Math.max(distance * 0.5, 50), 300);
    
    // Adjust control points based on direction for smoother curves
    const cp1X = startX + (dx > 0 ? controlOffset : -controlOffset) * 0.6;
    const cp1Y = startY + (dy > 0 ? controlOffset : -controlOffset) * 0.3;
    const cp2X = endX - (dx > 0 ? controlOffset : -controlOffset) * 0.3;
    const cp2Y = endY - (dy > 0 ? controlOffset : -controlOffset) * 0.6;
    
    // Create smooth cubic bezier path
    const path = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

    return { path, endX, endY };
  };

  // Recalculate connector path (triggered by connectorUpdateTrigger on scroll/resize)
  void connectorUpdateTrigger; // Force re-render so getConnectorPath() runs with fresh layout
  const connector = getConnectorPath();

  return (
    <>
      {/* Overlay with spotlight effect */}
      <div 
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={getOverlayStyle()}
      />

      {/* Connector line SVG */}
      {connector && (
        <svg
          className="fixed z-[105] pointer-events-none"
          style={{ width: '100vw', height: '100vh', top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path
            d={connector.path}
            stroke="url(#connectorGradient)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 4"
            className="animate-pulse"
          />
          <circle
            cx={connector.endX}
            cy={connector.endY}
            r="4"
            fill="#ffffff"
            className="animate-pulse"
          />
        </svg>
      )}
      
      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.96, x: 8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.96, x: -8 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed z-[110] w-[360px] bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden"
          style={{
            ...safeTooltipStyle,
            borderLeftWidth: '4px',
            borderLeftColor: '#1B2E5A',
          }}
        >
          {/* Progress bar */}
          <div className="h-1 bg-slate-100 dark:bg-slate-700">
            <motion.div
              className="h-full bg-[#1B2E5A]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          <div className="p-5">
            {/* Header with estimated time */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tourSteps.length} steps · ~{estimatedTime} min
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDismiss();
                }}
                className="h-7 w-7 p-0 flex-shrink-0 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#1B2E5A] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#1B2E5A]/20">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[#1B2E5A] dark:text-slate-100 text-base">{currentStepData.title}</h3>
                  {currentStepData.isNew && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-[#1B2E5A] text-white rounded-full">
                      New
                    </span>
                  )}
                </div>
                {featurePhase === 'in-page' && currentFeatureIndex === 2 && currentStepData.tertiaryContent ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                    {currentStepData.tertiaryKeyAction ? (
                      <>Here's where you <strong>{currentStepData.tertiaryKeyAction.toLowerCase()}</strong>. {currentStepData.tertiaryContent}</>
                    ) : (
                      currentStepData.tertiaryContent
                    )}
                  </p>
                ) : featurePhase === 'in-page' && currentFeatureIndex === 1 && currentStepData.secondaryContent ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                    {currentStepData.secondaryKeyAction ? (
                      <>Here's where you <strong>{currentStepData.secondaryKeyAction.toLowerCase()}</strong>. {currentStepData.secondaryContent}</>
                    ) : (
                      currentStepData.secondaryContent
                    )}
                  </p>
                ) : featurePhase === 'in-page' && currentStepData.keyAction ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                    Here's where you <strong>{currentStepData.keyAction.toLowerCase()}</strong>. {currentStepData.content}
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-2">{currentStepData.content}</p>
                )}
                {featurePhase === 'in-page' && currentFeatureIndex === 2 && currentStepData.tertiaryKeyAction ? (
                  <div className="text-xs font-medium text-[#1B2E5A] dark:text-[#4A6FA5] mb-2">
                    You can: {currentStepData.tertiaryKeyAction}
                  </div>
                ) : featurePhase === 'in-page' && currentFeatureIndex === 1 && currentStepData.secondaryKeyAction ? (
                  <div className="text-xs font-medium text-[#1B2E5A] dark:text-[#4A6FA5] mb-2">
                    You can: {currentStepData.secondaryKeyAction}
                  </div>
                ) : currentStepData.keyAction && (
                  <div className="text-xs font-medium text-[#1B2E5A] dark:text-[#4A6FA5] mb-2">
                    You can: {currentStepData.keyAction}
                  </div>
                )}
                {currentStepData.bullets && (
                  <div className="mb-2">
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      {currentStepData.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-[#1B2E5A]">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentStepData.proTip && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#1B2E5A]" />
                    <span><strong>Pro tip:</strong> {currentStepData.proTip}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Step checklist on last step */}
            {isLastStep && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">You've seen:</p>
                <div className="flex flex-wrap gap-2">
                  {tourSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1B2E5A]" />
                      <span>{step.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          
            {/* Step dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {tourSteps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i <= currentStep ? 'bg-[#1B2E5A] w-5' : 'bg-slate-200 dark:bg-slate-600 w-1.5'
                  }`}
                />
              ))}
            </div>
        
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Step {currentStep + 1} of {tourSteps.length}
                </span>
                {countdown !== null && countdown > 0 && !autoAdvanceDisabled && (
                  <span className="text-xs text-slate-400">
                    Next in {countdown}s
                  </span>
                )}
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
                      goToPreviousStep();
                    }}
                    className="text-xs border-slate-200 dark:border-slate-600"
                  >
                    Back
                  </Button>
                )}
                {countdown !== null && !autoAdvanceDisabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAutoAdvanceDisabled(true);
                      setCountdown(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  Skip all
                </Button>
                {currentStepData.tryIt && featurePhase === 'sidebar' && !hasTriedStep ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleTryIt();
                    }}
                    className="text-xs bg-[#1B2E5A] hover:bg-[#162447] text-white shadow-md shadow-[#1B2E5A]/20"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    Try it
                  </Button>
                ) : currentStepData.tryIt && (hasTriedStep || featurePhase === 'in-page') ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      goToNextStep();
                    }}
                    className="text-xs bg-[#1B2E5A] hover:bg-[#162447] text-white shadow-md shadow-[#1B2E5A]/20"
                  >
                    Continue tour <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                ) : currentStep < tourSteps.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      goToNextStep();
                    }}
                    className="text-xs bg-[#1B2E5A] hover:bg-[#162447] text-white shadow-md shadow-[#1B2E5A]/20"
                  >
                    Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
                    className="text-xs bg-[#1B2E5A] hover:bg-[#162447] text-white shadow-md shadow-[#1B2E5A]/20"
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>

            {/* Keyboard hint */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                Use ← → to move • Enter to continue • Esc to skip
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/20"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-700"
            >
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="w-16 h-16 text-[#1B2E5A]" />
                <h3 className="text-xl font-semibold text-[#1B2E5A] dark:text-slate-100">You're all set!</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">You've completed the tour</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
