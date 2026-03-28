import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTableColumnHeader,
  DataTableColumnCell,
  tableCellFilterFns,
} from "@/components/data-grid";
import { Badge } from "@/components/ui/badge";

import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types/user-management";
import { UserActions } from "./actions";
import { Crown } from "lucide-react";
import { getUserStatus, getStatusColor } from "@/lib/utils";

export const columns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "user", // Keep this if you want to use row.getValue
    id: "user", // Required when using accessorFn and accessorKey together
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => {
    const user = row.original;
    return <div className="flex items-center gap-3">
    <div 
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
      style={{ 
        background: user.avatar ? `url(${user.avatar})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      {!user.avatar && (user.name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
    </div>
    <div className="min-w-0 flex-1">
      <div className="font-medium text-[#1B2E5A] truncate">
        {user.name || 'Unnamed User'}
      </div>
      <div className="text-sm text-gray-500 truncate">{user.email}</div>
      {user.department && (
        <div className="text-xs text-gray-400 truncate">{user.department}</div>
      )}
    </div>
  </div>;
    },
    filterFn: tableCellFilterFns.filter,
    enableColumnFilter: true,
  },
  {
    accessorKey: "roles",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Roles" />;
    },
    cell: ({ row }) => {
      const user = row.original as User;

      return  <div className="space-y-2">
      <div className="flex gap-100">
        {user.isTenantAdmin && (
          <Badge className="bg-purple-100 text-purple-800">
            <Crown className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        )}
        {user.roles?.map(role => (
          <Badge key={role.roleId} className="text-xs">
            {role.roleName}
          </Badge>
        ))}
        {!user.isTenantAdmin && (!user.roles || user.roles.length === 0) && (
          <Badge className="text-gray-500">No roles</Badge>
        )}
           

      </div>
    </div>
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Status" />;
    },
    cell: ({ row }) => {
      const user = row.original as User;
      return <Badge className={getStatusColor(user)}>
        {getUserStatus(user)}
      </Badge>
    },
  },
  {
    accessorKey: "department",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Department" />;
    },
    cell: ({ row }) => {
      const user = row.original as User;
      return <Badge className={getStatusColor(user)}>
        {user.department || 'No department'}
      </Badge>
    },
  },
  {
    accessorKey: "activity",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Last Activity" />;
    },
    cell: ({ row }) => {
      const user = row.original as User;
      return <div className="text-sm">
        <div className="text-[#1B2E5A]">
          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
        </div>
        {/* <div className="text-gray-500">
          {user.lastLoginAt ? 'Last login' : 'No login'}
        </div> */}
      </div>
    },
  },
  {
    accessorKey: "invited",
    header: ({ column }) => {
      return <DataTableColumnHeader column={column} title="Invited" />;
    },
    cell: ({ row }) => {
      const user = row.original as User;
      return <div className="text-sm">
        <div className="text-[#1B2E5A]">
          {user.invitedAt ? new Date(user.invitedAt).toLocaleDateString() : 'N/A'}
        </div>
        <div className="text-gray-500">
          {user.invitedBy ? `by ${user.invitedBy}` : ''}
        </div>
      </div>
    },
  },
   {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <UserActions row={row} />,
  },
];
