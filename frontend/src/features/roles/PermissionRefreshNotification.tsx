import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserContext } from '@/contexts/UserContextProvider';
import { toast } from 'sonner';
import ActionableAlert from '@/components/common/data-display/ActionableAlert';

interface PermissionRefreshNotificationProps {
  className?: string;
}

export const PermissionRefreshNotification: React.FC<PermissionRefreshNotificationProps> = ({ className }) => {
  // Guard against context not being available
  let contextValue;
  try {
    contextValue = useUserContext();
  } catch (error) {
    return null;
  }

  const { refreshUserContext, loading, lastRefreshTime, autoRefresh, setAutoRefresh } = contextValue;
  const [isVisible, setIsVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState<Date | null>(null);

  // Show notification when permissions might be stale (5+ minutes since last refresh)
  useEffect(() => {
    const checkPermissionStaleness = () => {
      if (!lastRefreshTime) return;
      
      const now = new Date();
      const timeSinceRefresh = now.getTime() - lastRefreshTime.getTime();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      if (timeSinceRefresh > staleThreshold && !autoRefresh) {
        setIsVisible(true);
        setLastNotificationTime(now);
      }
    };

    const interval = setInterval(checkPermissionStaleness, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastRefreshTime, autoRefresh]);

  // Listen for storage events from admin panel
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'permissions_updated') {
        const data = event.newValue ? JSON.parse(event.newValue) : null;
        if (data && data.timestamp) {
          setIsVisible(true);
          setLastNotificationTime(new Date(data.timestamp));
          toast.info('Your permissions may have been updated. Click to refresh.');
          // Remove the flag after showing notification
          localStorage.removeItem('permissions_updated');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUserContext();
      setIsVisible(false);
      toast.success('Permissions refreshed successfully!');
    } catch (error) {
      toast.error('Failed to refresh permissions');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleEnableAutoRefresh = () => {
    setAutoRefresh(true);
    setIsVisible(false);
    toast.success('Auto-refresh enabled. Your permissions will stay up to date.');
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md ${className}`}>
      <ActionableAlert title="Your permissions may have changed" subTitle={lastNotificationTime ? `Last detected: ${lastNotificationTime.toLocaleTimeString()}` : lastRefreshTime ? `Last refreshed: ${lastRefreshTime.toLocaleTimeString()}` : undefined}
               actions={<div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100" onClick={handleRefresh} disabled={isRefreshing || loading}>
          {isRefreshing || loading ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          Refresh Now
        </Button>
        <Button size="sm" variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100" onClick={handleEnableAutoRefresh}>
          <Check className="h-3 w-3 mr-1" />
          Enable Auto-refresh
        </Button>
      </div>} severity="warning" onClose={handleDismiss} />
      {/* <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="pr-8">
          <div className="flex flex-col gap-2">
            <div className="font-medium">
              Your permissions may have changed
            </div>
            <div className="text-sm text-yellow-700">
              {lastNotificationTime && (
                <>Last detected: {lastNotificationTime.toLocaleTimeString()}</>
              )}
              {!lastNotificationTime && lastRefreshTime && (
                <>Last refreshed: {lastRefreshTime.toLocaleTimeString()}</>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
              >
                {isRefreshing || loading ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Refresh Now
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                onClick={handleEnableAutoRefresh}
              >
                <Check className="h-3 w-3 mr-1" />
                Enable Auto-refresh
              </Button>
            </div>
          </div>
        </AlertDescription>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 text-yellow-600 hover:text-yellow-800"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </Alert> */}
    </div>
  );
};

// Component for showing current permission status in header/nav
export const PermissionStatusIndicator: React.FC<{ className?: string }> = ({ className }) => {
  // Guard against context not being available
  let contextValue;
  try {
    contextValue = useUserContext();
  } catch (error) {
    return null;
  }

  const { lastRefreshTime, autoRefresh, refreshUserContext, loading } = contextValue;
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const checkStaleness = () => {
      if (!lastRefreshTime) return;
      
      const now = new Date();
      const timeSinceRefresh = now.getTime() - lastRefreshTime.getTime();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes
      
      setIsStale(timeSinceRefresh > staleThreshold && !autoRefresh);
    };

    const interval = setInterval(checkStaleness, 30000); // Check every 30 seconds
    checkStaleness(); // Check immediately

    return () => clearInterval(interval);
  }, [lastRefreshTime, autoRefresh]);

  if (!lastRefreshTime) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${
          isStale ? 'bg-yellow-500' : autoRefresh ? 'bg-green-500' : 'bg-gray-400'
        }`} />
        <span className="text-gray-600">
          {isStale && 'Permissions may be outdated'}
          {!isStale && autoRefresh && 'Auto-refreshing'}
          {!isStale && !autoRefresh && 'Up to date'}
        </span>
      </div>
      
      {isStale && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={refreshUserContext}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      )}
    </div>
  );
};

// Hook for triggering permission refresh from admin actions
export const usePermissionRefreshTrigger = () => {
  const triggerRefresh = (message?: string) => {
    // Set a flag that other tabs can detect
    localStorage.setItem('permissions_updated', JSON.stringify({
      timestamp: new Date().toISOString(),
      message: message || 'Permissions have been updated'
    }));
    
    // Trigger storage event in current tab
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'permissions_updated',
      newValue: localStorage.getItem('permissions_updated'),
      oldValue: null
    }));
  };

  return { triggerRefresh };
}; 