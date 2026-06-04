import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/cognito-auth';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Shield, Lock, AlertCircle } from 'lucide-react';
import AuthButton from './AuthButton';
import { useAuthStatus, useOnboardingStatus } from '@/hooks/useSharedQueries';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { logger } from '@/lib/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredOrganization?: string;
  requiredPermissions?: string[];
  fallbackComponent?: React.ComponentType;
  redirectTo?: string;
  skipOnboardingCheck?: boolean;
}

interface AuthRequiredProps {
  orgCode?: string;
  redirectUri?: string;
  message?: string;
}

const AuthRequired: React.FC<AuthRequiredProps> = ({ 
  orgCode, 
  redirectUri,
  message = "Please sign in to access this page."
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <CardTitle className="text-2xl">Authentication Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600 text-center">
            {message}
          </p>
          
          <div className="space-y-3">
            <AuthButton 
              provider="google" 
              orgCode={orgCode}
              redirectUri={redirectUri}
              showDropdown={false}
              size="lg"
            />
            <AuthButton 
              provider="github" 
              orgCode={orgCode}
              redirectUri={redirectUri}
              showDropdown={false}
              size="lg"
              variant="outline"
            />
            <AuthButton 
              provider="microsoft" 
              orgCode={orgCode}
              redirectUri={redirectUri}
              showDropdown={false}
              size="lg"
              variant="outline"
            />
          </div>
          
          {orgCode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Signing in to organization: <strong>{orgCode}</strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <AnimatedLoader size="lg" className="mb-6" />
        <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">Checking authentication...</p>
      </div>
    </div>
  );
};

const AccessDenied: React.FC<{ reason: string }> = ({ reason }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <CardTitle className="text-2xl text-red-600">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600 text-center">
            {reason}
          </p>
          
          <div className="flex justify-center">
            <Button 
              onClick={() => window.history.back()}
              variant="outline"
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = React.memo(({
  children,
  requiredOrganization,
  requiredPermissions = [],
  fallbackComponent: FallbackComponent,
  redirectTo,
  skipOnboardingCheck = false
}) => {
  const {
    isAuthenticated,
    isLoading,
    user
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: authData, isLoading: authStatusLoading } = useAuthStatus();
  const { data: onboardingResponse, isLoading: onboardingStatusLoading } = useOnboardingStatus();
  const redirectingRef = useRef(false);

  const backendAuthStatus = authData?.authStatus || null;
  const onboardingData = onboardingResponse?.data;

  // Treat as completed if onboarding/status says so (source of truth for completed flow)
  const completedByOnboardingApi =
    onboardingData?.isOnboarded === true ||
    onboardingData?.needsOnboarding === false ||
    onboardingData?.onboardingStep === 'completed';

  const isReady = !isLoading && !authStatusLoading && !onboardingStatusLoading;
  const needsIdpLogin = isReady && (!isAuthenticated || !user);
  const needsBackendLogin = isReady && !needsIdpLogin && !backendAuthStatus?.isAuthenticated;

  const isInvitedOrOnboarded =
    backendAuthStatus?.onboardingCompleted === true ||
    backendAuthStatus?.userType === 'INVITED_USER' ||
    backendAuthStatus?.isInvitedUser === true ||
    completedByOnboardingApi;

  const needsOnboarding =
    isReady &&
    !needsIdpLogin &&
    !needsBackendLogin &&
    !skipOnboardingCheck &&
    location.pathname !== '/onboarding' &&
    backendAuthStatus?.needsOnboarding &&
    !isInvitedOrOnboarded;

  const shouldRedirect = needsIdpLogin || needsBackendLogin || needsOnboarding;

  // Perform all redirects via useEffect to avoid synchronous router state
  // updates during render, which cause "Maximum update depth exceeded" loops.
  useEffect(() => {
    if (!shouldRedirect || redirectingRef.current) return;
    redirectingRef.current = true;

    if (needsIdpLogin || needsBackendLogin) {
      logger.debug('🚫 ProtectedRoute: Not authenticated, redirecting to login', {
        idpAuth: !needsIdpLogin,
        backendAuth: !needsBackendLogin,
        pathname: location.pathname,
      });
      navigate({ to: redirectTo || '/login', replace: true });
      return;
    }

    if (needsOnboarding) {
      logger.debug('🔄 ProtectedRoute: User needs onboarding, redirecting...', {
        needsOnboarding: backendAuthStatus?.needsOnboarding,
        onboardingCompleted: backendAuthStatus?.onboardingCompleted,
        pathname: location.pathname,
      });
      navigate({ to: '/onboarding', replace: true });
    }
  }, [shouldRedirect, needsIdpLogin, needsBackendLogin, needsOnboarding, redirectTo, navigate, location.pathname, backendAuthStatus, user?.email]);

  // Reset the redirect guard when auth state changes (e.g. user logs back in)
  useEffect(() => {
    if (!shouldRedirect) {
      redirectingRef.current = false;
    }
  }, [shouldRedirect]);

  if (!isReady || shouldRedirect) {
    logger.debug('🔄 ProtectedRoute: Loading/redirecting for:', location.pathname);
    if (FallbackComponent) return <FallbackComponent />;
    return <LoadingSpinner />;
  }

  logger.debug('✅ ProtectedRoute: Access granted for:', location.pathname);
  return <>{children}</>;
});

ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute; 