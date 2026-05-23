/**
 * 🚀 **ONBOARDING FEATURE - OPTIMIZED VERSION**
 * Performance-optimized onboarding feature module
 * Exports optimized components for better performance
 */

// Pages
export { default as OnboardingPage } from './pages/Onboarding';

// Components
export { OnboardingForm } from './components/OnboardingForm';
export { FlowSelector, type UserClassification } from './components/FlowSelector';
export { StepRenderer } from './components/StepRenderer';

// Steps
export { AdminDetailsStep } from './components/steps/AdminDetailsStep';
export { BusinessDetailsStep } from './components/steps/BusinessDetailsStep';
export { CompanyTypeStep } from './components/steps/CompanyTypeStep';
export { PersonalDetailsStep } from './components/steps/PersonalDetailsStep';
export { ReviewStep } from './components/steps/ReviewStep';
export { StateStep } from './components/steps/StateStep';
export { TaxDetailsStep } from './components/steps/TaxDetailsStep';
export { TeamStep } from './components/steps/TeamStep';
export { OrganizationHierarchyStep } from './components/steps/OrganizationHierarchyStep';
export { CreditPackagesStep } from './components/steps/CreditPackagesStep';
export { SettingsOverviewStep } from './components/steps/SettingsOverviewStep';

// Guards
export { OnboardingPageGuard } from './components/OnboardingPageGuard';
export { OnboardingGuard } from './components/OnboardingGuard';

// Utilities
export { determineUserClassification } from './components/OnboardingForm';