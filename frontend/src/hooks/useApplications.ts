import { useState, useCallback, useMemo } from "react";
import useOrganizationAuth from "./useOrganizationAuth";
import { useAuthStatus, useTenantApplications } from "./useSharedQueries";
import { Application } from "@/types/application";
import toast from "react-hot-toast";

export function useApplications() {
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showAppDetails, setShowAppDetails] = useState(false);

  // Auth status loading state — while this is in-flight, tenantId is not yet
  // available and the applications query will be disabled.  Treat it as a
  // loading state so we show <LoadingState /> rather than an empty-state card.
  const { isLoading: authLoading } = useAuthStatus();

  const { tenantId } = useOrganizationAuth();

  // Use shared hook to avoid duplicate API calls
  const { data: tenantApps = [], isLoading, isFetching, refetch } = useTenantApplications(tenantId);

  // useTenantApplications is `enabled: false` when tenantId is null, which
  // means isLoading=false and data=[] (placeholderData).  We still want to
  // show LoadingState — not EmptyState — while we're waiting for the tenantId.
  const hasTenantId = !!tenantId;

  /**
   * Normalize applications data to match expected shape (with baseUrl)
   * Also normalize enabledModules to always be an array and enabledModulesPermissions to Record<string, string[]>
   */
  const applications = useMemo(() => {
    return (tenantApps || []).map((app: any) => {
      // Normalize enabledModules to always be an array
      const normalizedEnabledModules = Array.isArray(app.enabledModules) 
        ? app.enabledModules 
        : [];

      // Normalize enabledModulesPermissions to Record<string, string[]> by extracting permission codes
      const normalizedEnabledModulesPermissions: Record<string, string[]> = {};
      if (app.enabledModulesPermissions && typeof app.enabledModulesPermissions === 'object') {
        Object.keys(app.enabledModulesPermissions).forEach((moduleCode) => {
          const permissions = app.enabledModulesPermissions[moduleCode];
          if (Array.isArray(permissions)) {
            // Extract codes from permission objects or use strings directly
            normalizedEnabledModulesPermissions[moduleCode] = permissions.map((p: any) => 
              typeof p === 'string' ? p : (p?.code || p?.name || '')
            ).filter(Boolean);
          }
        });
      }

      return {
        ...app,
        baseUrl: app.baseUrl || app.base_url || app.baseurl || "",
        enabledModules: normalizedEnabledModules,
        enabledModulesPermissions: normalizedEnabledModulesPermissions,
      };
    });
  }, [tenantApps]);

  /**
   * Refresh applications data
   */
  const handleRefresh = useCallback(async () => {
    await refetch();
    toast.success("Applications refreshed successfully");
  }, [refetch]);

  /**
   * Handle viewing application details in modal
   */
  const handleViewApp = useCallback((app: Application) => {
    setSelectedApp(app);
    setShowAppDetails(true);
  }, []);

  /**
   * Close application details modal
   */
  const handleCloseAppDetails = useCallback(() => {
    setShowAppDetails(false);
    setSelectedApp(null);
  }, []);

  // Show loading when:
  //  1. auth-status query is still in flight (tenantId not yet available → apps query disabled)
  //  2. the apps query itself is loading
  //  3. refetching with no cached data yet (e.g. after invalidation)
  const isInitialLoading = authLoading || !hasTenantId || isLoading || (isFetching && applications.length === 0);

  // Memoize the return object to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    applications,
    isLoading: isInitialLoading,
    isFetching,
    selectedApp,
    showAppDetails,
    fetchApplications: handleRefresh, // Alias for compatibility
    handleRefresh,
    handleViewApp,
    handleCloseAppDetails,
  }), [
    applications,
    isInitialLoading,
    isFetching,
    selectedApp,
    showAppDetails,
    handleRefresh,
    handleViewApp,
    handleCloseAppDetails,
  ]);

  return returnValue;
}
