import { useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Mail,
  MoreHorizontal,
  Copy,
  MapPin,
  UserCog,
  Shield,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PearlButton } from '@/components/ui/pearl-button';
import { Checkbox } from '@/components/ui/checkbox';
import { User } from '@/types/user-management';
import { useUserManagement } from '../context/UserManagementContext';
import { useUserActions } from '../hooks/useUserActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserTableProps {
  users: User[];
  selectedUsers: Set<string>;
  onSelectionChange: (selection: Set<string>) => void;
  onUserAction: (action: string, user: User) => void;
  loading: boolean;
}

const ROW_HEIGHT = 64;
const MAX_TABLE_HEIGHT = 600;

export function UserTable({
  users,
  selectedUsers,
  onSelectionChange,
  onUserAction,
  loading
}: UserTableProps) {
  const { userMutations } = useUserManagement();
  const {
    getUserStatus,
    getStatusColor,
    generateInvitationUrl,
    copyInvitationUrl
  } = useUserActions();

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const allSelected = users.length > 0 && users.every(u => selectedUsers.has(u.userId));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(users.map(u => u.userId)));
    }
  }, [allSelected, users, onSelectionChange]);

  const toggleUser = useCallback((userId: string) => {
    const next = new Set(selectedUsers);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    onSelectionChange(next);
  }, [selectedUsers, onSelectionChange]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-white text-lg">No users found matching your filters</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 border-none">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-sky-50 to-blue-50 border-b border-sky-100">
          <tr>
            <th className="p-4 text-left w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="p-4 text-left font-black text-sky-900 uppercase tracking-wider text-[10px]" style={{ width: 240 }}>User</th>
            <th className="p-4 text-left font-black text-sky-900 uppercase tracking-wider text-[10px]" style={{ width: 180 }}>Location</th>
            <th className="p-4 text-left font-black text-sky-900 uppercase tracking-wider text-[10px]" style={{ width: 160 }}>Role</th>
            <th className="p-4 text-left font-black text-sky-900 uppercase tracking-wider text-[10px]" style={{ width: 200 }}>Invite Link</th>
            <th className="p-4 text-left font-black text-sky-900 uppercase tracking-wider text-[10px]" style={{ width: 120 }}>Status</th>
            <th className="p-4 text-left" style={{ width: 50 }}></th>
          </tr>
        </thead>
      </table>

      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: MAX_TABLE_HEIGHT }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          <table className="w-full">
            <tbody>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const user = users[virtualRow.index];
                const primaryOrg = user.organizations?.find(org => org.isPrimary);
                const inviteUrl = user.invitationStatus === 'pending' ? generateInvitationUrl(user) : null;
                const firstRole = user.roles?.[0];
                const extraRoleCount = (user.roles?.length ?? 0) - 1;

                return (
                  <tr
                    key={user.userId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-700"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      display: 'table-row',
                    }}
                  >
                    {/* Selection */}
                    <td className="p-4" style={{ width: 40 }}>
                      <Checkbox
                        checked={selectedUsers.has(user.userId)}
                        onCheckedChange={() => toggleUser(user.userId)}
                        aria-label={`Select ${user.name || user.email}`}
                      />
                    </td>

                    {/* User */}
                    <td className="p-4" style={{ width: 240 }}>
                      <div className="flex items-center gap-3.5">
                        <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-sky-100">
                          <AvatarImage src={user.avatar} alt={user.name || 'User'} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-sky-600 text-white font-black text-xs">
                            {(user.name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm truncate text-foreground/90">
                            {user.name || 'Unnamed User'}
                          </span>
                          <span className="text-xs text-muted-foreground truncate font-normal">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="p-4" style={{ width: 180 }}>
                      {primaryOrg ? (
                        <div className="flex items-center gap-2 text-sm text-foreground/80 group">
                          <div className="p-1 rounded-md bg-slate-50 text-slate-500 group-hover:bg-slate-100 transition-colors">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <span className="truncate font-medium" title={primaryOrg.organizationName}>
                            {primaryOrg.organizationName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="p-4" style={{ width: 160 }}>
                      {firstRole ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-bold bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 px-2 py-0.5 rounded-md">
                            {firstRole.roleName}
                          </Badge>
                          {extraRoleCount > 0 && (
                            <span className="text-xs text-muted-foreground font-medium px-1.5 py-0.5 bg-muted rounded-md">
                              +{extraRoleCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">No roles</span>
                      )}
                    </td>

                    {/* Invite Link */}
                    <td className="p-4" style={{ width: 200 }}>
                      {inviteUrl && (
                        <div className="flex items-center gap-2">
                          <div className="max-w-[140px] truncate text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded select-all border border-transparent hover:border-border transition-colors">
                            {inviteUrl}
                          </div>
                          <PearlButton
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 flex items-center justify-center rounded-lg"
                            onClick={() => copyInvitationUrl(user)}
                          >
                            <Copy className="h-3 w-3" />
                          </PearlButton>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4" style={{ width: 120 }}>
                      {user.invitationStatus === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          <span className="text-sm font-medium text-amber-700">Pending</span>
                        </div>
                      ) : user.isActive ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_-2px_rgba(59,130,246,0.5)]"></span>
                          <span className="text-sm font-black text-blue-700">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                          <span className="text-sm font-medium text-slate-600">Inactive</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4" style={{ width: 50 }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <PearlButton variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center rounded-lg">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </PearlButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onUserAction('view', user)}>
                            <UserCog className="mr-2 h-4 w-4" />
                            Manage User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUserAction('manageAccess', user)}>
                            <Shield className="mr-2 h-4 w-4" />
                            Manage Access
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onUserAction('edit', user)}>
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => userMutations.resendInvite.mutate(user.userId)}
                            disabled={user.isActive || !user.email || userMutations.resendInvite.isPending}
                          >
                            {userMutations.resendInvite.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-4 w-4" />
                                Resend Invite
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onUserAction('delete', user)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
