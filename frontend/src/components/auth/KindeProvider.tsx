import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { CognitoAuthProvider } from '@/lib/auth/cognito-auth';
import { setKindeTokenGetter } from '@/lib/api';

/**
 * App auth provider — Cognito-backed (Kinde->Cognito migration).
 *
 * Login/session/logout run through the Wrapper backend's Cognito flow (see
 * src/lib/auth/cognito-auth.tsx). API auth rides the httpOnly Cognito session cookie
 * (axios `withCredentials`), so there is no JS-held Bearer — the token getter returns null.
 * The component name `KindeProvider` is kept so the app-root wiring is unchanged.
 */

// Point the API client's Bearer getter at "nothing": auth is carried by the httpOnly cookie.
function TokenGetterSetup() {
  useEffect(() => {
    setKindeTokenGetter(async () => null);
  }, []);
  return null;
}

// Online/offline status toasts (unchanged from the previous provider).
function OnlineStatusMonitor() {
  useEffect(() => {
    const handleOffline = () => {
      toast.error("You're offline. Please check your internet connection.", {
        id: 'offline-status',
        duration: Infinity,
        position: 'top-center',
      });
    };
    const handleOnline = () => {
      toast.dismiss('offline-status');
      toast.success("You're back online.", { id: 'back-online', duration: 3000, position: 'top-center' });
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (!navigator.onLine) handleOffline();
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  return null;
}

export const KindeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CognitoAuthProvider>
      <TokenGetterSetup />
      <OnlineStatusMonitor />
      {children}
    </CognitoAuthProvider>
  );
};

export default KindeProvider;
