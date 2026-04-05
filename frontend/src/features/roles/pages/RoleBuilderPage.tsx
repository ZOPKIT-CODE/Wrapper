import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { ApplicationModuleRoleBuilder } from '@/features/roles/ApplicationModuleRoleBuilder';
import { useRoles, useInvalidateQueries } from '@/hooks/useSharedQueries';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { DASHBOARD_PAGE_TITLE_CLASS } from '@/components/dashboard/DashboardPageHeader';
import { AlertCircle } from 'lucide-react';
import { useRoleIdParam } from '@/hooks/useRoleRouteParams';

export function RoleBuilderPage() {
  const roleId = useRoleIdParam();
  const navigate = useNavigate();
  const isEditMode = !!roleId;
  
  // Fetch role if editing
  const { data: rolesData = [], isLoading } = useRoles({});
  const initialRole = React.useMemo(() => {
    if (!isEditMode || !roleId) return null;
    return rolesData.find((r: any) => r.roleId === roleId || r.id === roleId) || null;
  }, [rolesData, roleId, isEditMode]);

  const { invalidateRoles } = useInvalidateQueries();

  const handleSave = async (_role?: any) => {
    invalidateRoles();
    navigate({ to: '/dashboard/roles' });
  };

  const handleCancel = () => {
    navigate({ to: '/dashboard/roles' });
  };

  if (isEditMode && isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (isEditMode && !initialRole) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Role Not Found</h2>
          <p className="text-gray-600">The role you're trying to edit doesn't exist.</p>
          <Button onClick={() => navigate({ to: '/dashboard/roles' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Roles
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[500px] w-full">
      {/* Header with Back Button */}
      <div className="flex-none flex items-center gap-4 px-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </Button>
        <div className="flex-1">
          <h1 className={DASHBOARD_PAGE_TITLE_CLASS}>
            {isEditMode ? 'Edit Role' : 'Create New Role'}
          </h1>
        </div>
      </div>

      {/* Role Builder - fills remaining space */}
      <div className="flex-1 min-h-0">
        <ApplicationModuleRoleBuilder
          onSave={handleSave}
          onCancel={handleCancel}
          initialRole={initialRole || undefined}
        />
      </div>
    </div>
  );
}
