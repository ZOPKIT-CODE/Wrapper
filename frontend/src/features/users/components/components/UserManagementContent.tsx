import { UserStats } from '../UserStats';
import { UserFilters } from '../UserFilters';
import { BulkActions } from '../BulkActions';
import { UserTable } from './UserTable';
import { useUserManagement } from '../context/UserManagementContext';
import { LoadingSpinner } from '@/components/common/feedback/LoadingSpinner';
import { ErrorMessage } from '@/components/common/feedback/ErrorMessage';
import { useNavigate } from '@tanstack/react-router';

/**
 * Main content component for User Management Dashboard
 * 
 * Features:
 * - Statistics cards
 * - Filters and search
 * - Bulk actions
 * - Users table
 * - Loading and error states
 */
export function UserManagementContent() {
  const navigate = useNavigate();
  const {
    users,
    roles,
    filteredUsers,
    isLoading,
    error,
    state,
    actions,
    dispatch
  } = useUserManagement();

  // Error state
  if (error) {
    return (
      <ErrorMessage
        title="Failed to load users"
        message="There was an error loading the user data. Please try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <LoadingSpinner message="Loading users..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <UserStats users={users} isLoading={isLoading} />

      {/* Controls & Data Section */}
      <div className="space-y-4">
        {/* Filters Bar */}
        <div className="rounded-2xl border border-[#1B2E5A]/10 bg-gradient-to-r from-[#1B2E5A]/5 to-white p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
          <UserFilters
            searchQuery={state.searchQuery}
            setSearchQuery={(query) => actions.setFilters({ searchQuery: query })}
            statusFilter={state.statusFilter}
            setStatusFilter={(filter) => actions.setFilters({ statusFilter: filter })}
            roleFilter={state.roleFilter}
            setRoleFilter={(filter) => actions.setFilters({ roleFilter: filter })}
            sortBy={state.sortBy}
            setSortBy={(sort) => actions.setFilters({ sortBy: sort })}
            sortOrder={state.sortOrder}
            setSortOrder={(order) => actions.setFilters({ sortOrder: order })}
            roles={roles}
            onRefresh={() => window.location.reload()}
          />
        </div>

        {/* Bulk Actions */}
        {state.selectedUsers.size > 0 && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="rounded-2xl border border-[#1B2E5A]/30 bg-[#1B2E5A] p-4 shadow-lg text-white">
              <BulkActions
                selectedCount={state.selectedUsers.size}
                onClearSelection={actions.clearSelection}
              />
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden" data-tour-feature="users-table">
          <div className="min-w-0 w-full overflow-x-auto">
            <UserTable
              users={filteredUsers}
              selectedUsers={state.selectedUsers}
              onSelectionChange={(selection) => dispatch({ type: 'SET_SELECTED_USERS', payload: selection })}
              onUserAction={(action, user) => {
                switch (action) {
                  case 'view':
                    navigate({ to: `/dashboard/users/${user.userId}` });
                    break;
                  case 'edit':
                    actions.openModal('edit', user);
                    break;
                  case 'delete':
                    actions.openModal('delete', user);
                    break;
                  case 'assignRoles':
                    actions.openModal('roleAssign', user);
                    break;
                  case 'manageAccess':
                    actions.openModal('access', user);
                    break;
                  default:
                    console.warn('Unknown user action:', action);
                }
              }}
              loading={isLoading}
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          Showing {filteredUsers.length} users
        </div>
      </div>
    </div>
  );
}
