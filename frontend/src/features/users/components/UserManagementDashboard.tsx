import { UserManagementProvider, useUserManagement } from './context/UserManagementContext';
import { UserManagementContent } from './components/UserManagementContent';
import { UserManagementModals } from './components/UserManagementModals';
import { ErrorBoundary } from '@/components/common/feedback/ErrorBoundary';
import { UserPlus, AlertCircle, RefreshCcw } from 'lucide-react';
import { PearlButton } from '@/components/ui/pearl-button';
import { motion } from 'framer-motion';
import { useNavigate } from '@tanstack/react-router';

/**
 * Main User Management Dashboard Component
 * 
 * This component serves as the main entry point for user management functionality.
 * It provides context to all child components and handles error boundaries.
 * 
 * Features:
 * - Centralized state management through context
 * - Error boundary for graceful error handling
 * - Loading states for better UX
 * - Modular component architecture
 */
export function UserManagementDashboard() {
  return (
    <ErrorBoundary fallback={<UserManagementErrorFallback />}>
      <UserManagementProvider>
        <UserManagementDashboardContent />
      </UserManagementProvider>
    </ErrorBoundary>
  );
}

import { Container } from '@/components/common/Page/Container';

/**
 * Internal component that uses the UserManagement context
 */
function UserManagementDashboardContent() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-full"
    >
      <Container className="h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-[#1B2E5A]">
              User Management
            </h1>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Manage team members, roles, and permissions across your organization.
            </p>
          </div>
          <PearlButton
            onClick={() => navigate({ to: '/dashboard/users/invite' })}
            className="gap-2 !bg-[#1B2E5A] hover:!bg-[#152449]"
            data-tour-feature="invite-user"
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </PearlButton>
        </div>

        <div className="flex-1 w-full min-w-0">
          <UserManagementContent />
        </div>
        <UserManagementModals />
      </Container>
    </motion.div>
  );
}


/**
 * Error fallback component for user management
 */
function UserManagementErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-12 w-full h-[60vh] space-y-6 text-center">
      <div className="p-4 rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-10 w-10" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">User Management Error</h2>
        <p className="text-muted-foreground">
          Something went wrong while loading the user management dashboard.
        </p>
      </div>
      <PearlButton
        variant="outline"
        onClick={() => window.location.reload()}
        className="gap-2"
      >
        <RefreshCcw className="h-4 w-4" />
        Reload Page
      </PearlButton>
    </div>
  );
}