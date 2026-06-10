import { ReactNode, useState, useEffect } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth/cognito-auth';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { logger } from '@/lib/logger';

interface PermissionGuardProps {
    children: ReactNode;
    requiredPermission: string;
    fallbackPath?: string;
}

/**
 * PermissionGuard - Protects routes based on IdP permissions
 * 
 * Usage:
 * <PermissionGuard requiredPermission="admin:dashboard:view">
 *   <AdminDashboard />
 * </PermissionGuard>
 * 
 * Configure permissions in the IdP dashboard:
 * 1. Go to Settings > Permissions
 * 2. Create permission with key: "admin:dashboard:view"
 * 3. Assign to appropriate roles
 * 4. Assign roles to users
 */
export function PermissionGuard({
    children,
    requiredPermission,
    fallbackPath = '/dashboard/applications'
}: PermissionGuardProps) {
    const { isLoading, isAuthenticated, getPermission, getPermissions } = useAuth();
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        async function checkPermission() {
            if (!isAuthenticated || isLoading) {
                return;
            }

            try {
                // getPermissions() returns a Promise, so we need to await it
                const allPermissions = await getPermissions();

                logger.debug('🔍 All Permissions:', allPermissions);

                // Handle different permission formats from Kinde
                let hasRequiredPermission = false;

                if (allPermissions?.permissions) {
                    // Check if permissions is an array of strings
                    if (Array.isArray(allPermissions.permissions) && allPermissions.permissions.length > 0) {
                        if (typeof allPermissions.permissions[0] === 'string') {
                            // Format: permissions: ['company:admin:access', ...]
                            hasRequiredPermission = allPermissions.permissions.includes(requiredPermission);
                        } else {
                            // Format: permissions: [{ key: 'company:admin:access', isGranted: true }, ...]
                            hasRequiredPermission = allPermissions.permissions.some(
                                (p: any) => p.key === requiredPermission && p.isGranted === true
                            );
                        }
                    }
                }

                logger.debug('🔍 PermissionGuard Debug:', {
                    requiredPermission,
                    allPermissions: allPermissions?.permissions,
                    permissionFormat: typeof allPermissions?.permissions?.[0],
                    hasRequiredPermission,
                    matchingPermission: allPermissions?.permissions?.find((p: any) =>
                        typeof p === 'string' ? p === requiredPermission : p.key === requiredPermission
                    )
                });

                setHasPermission(hasRequiredPermission);
                setPermissionChecked(true);

                if (!hasRequiredPermission) {
                    logger.warn(`❌ Access denied: Missing permission "${requiredPermission}"`);
                    logger.debug('💡 Troubleshooting steps:');
                    logger.debug('1. Verify permission exists in the IdP dashboard: Settings > Permissions');
                    logger.debug('2. Check permission key matches exactly:', requiredPermission);
                    logger.debug('3. Ensure permission is assigned to user via role or directly');
                    logger.debug('4. **IMPORTANT**: Log out and log back in to refresh permissions');
                    logger.debug('5. Clear browser cache if issue persists');
                } else {
                    logger.debug('✅ Permission granted:', requiredPermission);
                }
            } catch (error) {
                logger.error('Error checking permission:', error);
                setHasPermission(false);
                setPermissionChecked(true);
            }
        }

        checkPermission();
    }, [isAuthenticated, isLoading, requiredPermission, getPermission, getPermissions]);

    // Show loading while checking authentication or permissions
    if (isLoading || !permissionChecked) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <AnimatedLoader size="md" className="mb-6" />
                    <p className="text-gray-600 text-base font-medium">
                        Checking permissions...
                    </p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Redirect to fallback if permission denied
    if (!hasPermission) {
        return <Navigate to={fallbackPath} replace />;
    }

    // User has permission, render children
    return <>{children}</>;
}

/**
 * Multiple Permission Guard - Requires ALL permissions
 */
interface MultiPermissionGuardProps {
    children: ReactNode;
    requiredPermissions: string[];
    fallbackPath?: string;
}

export function MultiPermissionGuard({
    children,
    requiredPermissions,
    fallbackPath = '/dashboard/applications'
}: MultiPermissionGuardProps) {
    const { isLoading, isAuthenticated, getPermissions } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <AnimatedLoader size="md" className="mb-6" />
                    <p className="text-gray-600 text-base font-medium">
                        Checking permissions...
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check all required permissions
    const { permissions: granted } = getPermissions();
    const hasAllPermissions = requiredPermissions.every((perm) => granted?.includes(perm));

    if (!hasAllPermissions) {
        logger.warn(`Access denied: Missing one or more permissions`, requiredPermissions);
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
}

/**
 * Any Permission Guard - Requires AT LEAST ONE permission
 */
interface AnyPermissionGuardProps {
    children: ReactNode;
    requiredPermissions: string[];
    fallbackPath?: string;
}

export function AnyPermissionGuard({
    children,
    requiredPermissions,
    fallbackPath = '/dashboard/applications'
}: AnyPermissionGuardProps) {
    const { isLoading, isAuthenticated, getPermissions } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <AnimatedLoader size="md" className="mb-6" />
                    <p className="text-gray-600 text-base font-medium">
                        Checking permissions...
                    </p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check if user has at least one of the required permissions
    const { permissions: granted } = getPermissions();
    const hasAnyPermission = requiredPermissions.some((perm) => granted?.includes(perm));

    if (!hasAnyPermission) {
        logger.warn(`Access denied: Missing all permissions`, requiredPermissions);
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
}
