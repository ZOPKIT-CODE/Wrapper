import { useApplications } from "@/hooks/useApplications";
import { ApplicationHeader } from "@/features/applications/components/ApplicationHeader";
import { ApplicationGrid } from "@/features/applications/components/ApplicationGrid";
import { useNavigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/common/feedback/EmptyState";
import { LoadingState } from "@/features/applications/components/LoadingState";
import { useState, useEffect } from "react";

// Hook to manage recently used applications
function useRecentlyUsedApps() {
    const [recentlyUsedApps, setRecentlyUsedApps] = useState<any[]>([])

    // Load recently used apps from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('recentlyUsedApps')
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                setRecentlyUsedApps(parsed)
            } catch (e) {
                console.error('Error parsing recently used apps:', e)
            }
        }
    }, [])

    // Track application usage
    const trackAppUsage = (app: any) => {
        const appId = app.appId || app.id
        const now = Date.now()

        // Get current recently used apps
        const current = [...recentlyUsedApps]

        // Remove if already exists (to move to front)
        const filtered = current.filter(item => item.appId !== appId)

        // Add to front with timestamp
        const updated = [{
            appId,
            appData: app,
            lastUsed: now,
            usageCount: (current.find(item => item.appId === appId)?.usageCount || 0) + 1
        }, ...filtered.slice(0, 9)] // Keep only top 10

        // Save to localStorage
        localStorage.setItem('recentlyUsedApps', JSON.stringify(updated))
        setRecentlyUsedApps(updated)
    }

    return { recentlyUsedApps, trackAppUsage }
}

/**
 * Applications Tab Component
 * Displays and manages organization applications using Section components
 */
export function ApplicationPage() {
    const {
        applications,
        isLoading,
        handleRefresh,
    } = useApplications();

    const navigate = useNavigate();
    const { trackAppUsage } = useRecentlyUsedApps();

    if (isLoading) {
        return <LoadingState />;
    }

    // Enhanced view handler that tracks usage and navigates
    const handleViewAppWithTracking = (app: any) => {
        trackAppUsage(app)
        navigate({ to: `/dashboard/applications/${app.appId}` })
    }

    return (
        <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <ApplicationHeader
                applicationCount={applications.length}
                isLoading={isLoading}
                onRefresh={handleRefresh}
            />

            {applications.length === 0 ? (
                <EmptyState isLoading={isLoading} onRefresh={handleRefresh} />
            ) : (
                <ApplicationGrid
                    applications={applications}
                    onViewApplication={handleViewAppWithTracking}
                />
            )}
        </div>
    );
}
