import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/cognito-auth';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';


interface SocialLoginProps {
  orgCode?: string;
  redirectUri?: string;
  title?: string;
  subtitle?: string;
  providers?: string[];
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

export const SocialLogin: React.FC<SocialLoginProps> = ({
  orgCode,
  redirectUri,
  title = "Sign In",
  subtitle = "Choose your preferred authentication method",
  providers = ['google', 'github', 'microsoft', 'apple', 'linkedin'],
  onSuccess,
  onError
}) => {
  const { login, isLoading, isAuthenticated, user } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Use provided organization code - no auto-detection
  const finalOrgCode = orgCode;

  // Handle successful authentication
  React.useEffect(() => {
    if (isAuthenticated && user && onSuccess) {
      onSuccess(user);
    }
  }, [isAuthenticated, user, onSuccess]);

  const handleLogin = async (provider: string) => {
    try {
      setLoadingProvider(provider);

      // Cognito: pass the provider straight through to federate (skips the hosted-UI selector).
      const loginOptions: any = { provider };

      // Add organization context if available
      if (finalOrgCode) {
        loginOptions.org_code = finalOrgCode;
        logger.debug('🏢 SocialLogin: Using organization code for login:', finalOrgCode);
      }

      // Check for external redirect parameters
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect_to');
      const app = urlParams.get('app');
      
      // For invitation flows, use popup to prevent redirect issues
      const isInvitationFlow = window.location.pathname.includes('/invite/accept');
      
      if (isInvitationFlow) {
        logger.debug('🎯 SocialLogin: Invitation flow detected, using popup authentication');
        loginOptions.popup = true;
        // Don't set redirect options for popup auth
      } else if (redirectTo) {
        logger.debug('🔄 SocialLogin: External redirect detected:', redirectTo);
        loginOptions.app_state = {
          redirectTo,
          app: app || 'external'
        };
      } else if (redirectUri) {
        // Add custom redirect URI if provided
        loginOptions.app_state = {
          redirectTo: redirectUri
        };
      }

      logger.debug('🚀 SocialLogin: Login options:', loginOptions);
      await login(loginOptions);
    } catch (error) {
      logger.error(`${provider} login error:`, error);
      setLoadingProvider(null);
      if (onError) {
        onError(`Failed to authenticate with ${provider}`);
      }
    }
  };

  if (isAuthenticated) {
    return (
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center">
          <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <CardTitle className="text-2xl text-green-600">Authentication Successful!</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-gray-600 mb-4">
            Welcome, {user?.givenName || user?.email}!
          </p>
          {finalOrgCode && (
            <p className="text-sm text-gray-500">
              Accessing organization: <strong>{finalOrgCode}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Only show Google provider
  const googleProvider = providers.includes('google') ? 'google' : null;
  
  if (!googleProvider) {
    return null;
  }

  const isProviderLoading = loadingProvider === 'google' || (isLoading && loadingProvider === 'google');

  return (
    <div className="w-full">
      {title && (
        <div className="text-center mb-6">
          <CardTitle className="text-2xl mb-2">{title}</CardTitle>
          {subtitle && <p className="text-gray-600">{subtitle}</p>}
        </div>
      )}
      
      <div className="space-y-6">
        <Button
          onClick={() => handleLogin('google')}
          disabled={isLoading || isProviderLoading}
          className="w-full flex items-center justify-center space-x-4 py-6 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-gray-300 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 font-semibold text-base"
          variant="outline"
        >
          {isProviderLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-gray-700">Authenticating...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700">Continue with Google</span>
            </>
          )}
        </Button>

        <div className="text-center text-xs text-gray-500 leading-relaxed pt-4 border-t border-gray-100">
          <p>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            <br />
            <span className="text-gray-400">Your credentials are never stored on our servers.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SocialLogin; 