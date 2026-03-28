import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Eye,
  Crown,
  Activity,
  Clock,
  Send
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { DataTable, DataTableColumn, DataTableAction } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { UserStatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { GracefulErrorBoundary } from '@/components/common/feedback/GracefulErrorBoundary';

interface User {
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  isTenantAdmin: boolean;
  onboardingCompleted: boolean;
  department?: string;
  title?: string;
  lastLoginAt?: string;
  avatar?: string;
}

export function ModernUserDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Forms
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    message: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    title: '',
    department: '',
    isActive: true,
    isTenantAdmin: false
  });

  const { isExpired: isTrialExpired, expiredData } = useTrialStatus();

  // Load data
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    // If trial is expired, don't try to load users
    if (isTrialExpired || expiredData?.expired || localStorage.getItem('trialExpired')) {
      setLoading(false);
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/admin/users');

      if (response.data?.success && response.data?.data) {
        const transformedUsers = response.data.data.map((user: User) => {
          return {
            userId: user.userId || (user as any).id,
            email: user.email,
            name: user.name || (user as any).firstName + ' ' + (user as any).lastName || user.email,
            isActive: user.isActive !== false,
            isTenantAdmin: user.isTenantAdmin || (user as any).role === 'admin',
            onboardingCompleted: user.onboardingCompleted !== false,
            department: user.department,
            title: user.title,
            lastLoginAt: user.lastLoginAt,
            avatar: user.avatar
          };
        });

        setUsers(transformedUsers.filter((user: User) =>
          user && typeof user === 'object' && user.userId && typeof user.email === 'string'
        ));
      }
    } catch (error: any) {
      // Don't show error toasts for trial expiry
      if (error?.response?.status === 200 && (error.response.data as any)?.subscriptionExpired) {
        return;
      }

      // Only show error toasts if not in trial expiry state
      const trialExpired = localStorage.getItem('trialExpired');
      if (!trialExpired) {
        console.error('Failed to load users:', error);
        toast.error('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  // User stats
  const userStats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const adminUsers = users.filter(u => u.isTenantAdmin).length;
    const pendingUsers = users.filter(u => !u.onboardingCompleted).length;

    return [
      {
        title: "Total Users",
        value: totalUsers,
        icon: Users,
        iconColor: "text-[#1B2E5A]"
      },
      {
        title: "Active Users",
        value: activeUsers,
        icon: Activity,
        iconColor: "text-green-600"
      },
      {
        title: "Admins",
        value: adminUsers,
        icon: Crown,
        iconColor: "text-purple-600"
      },
      {
        title: "Pending Setup",
        value: pendingUsers,
        icon: Clock,
        iconColor: "text-orange-600"
      }
    ];
  }, [users]);

  // Table columns
  const columns: DataTableColumn<User>[] = [
    {
      key: 'user',
      label: 'User',
      searchable: true,
      render: (user) => (
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={user.avatar} />
            <AvatarFallback>
              {user.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (user) => (
        <UserStatusBadge
          isActive={user.isActive}
          onboardingCompleted={user.onboardingCompleted}
        />
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (user) => (
        <div className="flex items-center space-x-2">
          {user.isTenantAdmin && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              <Crown className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'department',
      label: 'Department',
      render: (user) => user.department || '-'
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (user) => user.lastLoginAt
        ? new Date(user.lastLoginAt).toLocaleDateString()
        : 'Never'
    }
  ];

  // Table actions
  const actions: DataTableAction<User>[] = [
    {
      key: 'view',
      label: 'View Details',
      icon: Eye,
      onClick: (user) => {
        setCurrentUser(user);
        setShowUserModal(true);
      }
    },
    {
      key: 'edit',
      label: 'Edit User',
      icon: Edit,
      onClick: (user) => {
        setCurrentUser(user);
        setEditForm({
          name: user.name,
          email: user.email,
          title: user.title || '',
          department: user.department || '',
          isActive: user.isActive,
          isTenantAdmin: user.isTenantAdmin
        });
        setShowEditModal(true);
      }
    },
    {
      key: 'delete',
      label: 'Delete User',
      icon: Trash2,
      variant: 'destructive',
      separator: true,
      onClick: (user) => {
        setCurrentUser(user);
        setShowDeleteModal(true);
      }
    }
  ];

  // Handlers
  const handleInviteUser = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      toast.error('Email and name are required');
      return;
    }

    try {
      const response = await api.post('/admin/organizations/current/invite-user', inviteForm);
      if (response.data.success) {
        toast.success('User invited successfully!');
        setShowInviteModal(false);
        setInviteForm({ email: '', name: '', message: '' });
        loadUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to invite user');
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUser) return;

    try {
      await api.delete(`/tenants/current/users/${currentUser.userId}`);
      toast.success('User deleted successfully!');
      setShowDeleteModal(false);
      setCurrentUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleEditUser = async () => {
    if (!currentUser) return;

    try {
      await api.put(`/tenants/current/users/${currentUser.userId}`, editForm);
      toast.success('User updated successfully!');
      setShowEditModal(false);
      setCurrentUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  // If trial is expired, show graceful error boundary
  if (isTrialExpired || expiredData?.expired) {
    return (
      <GracefulErrorBoundary
        fallbackTitle="User Management Unavailable"
        fallbackMessage="User management features require an active subscription."
        showRetry={false}
      >
        <div />
      </GracefulErrorBoundary>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-8"
    >
      {/* Page Header */}
      <PageHeader
        title="User Management"
        description="Manage team members, roles, and access across your organization"
        icon={Users}
        actions={
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {userStats.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.iconColor}
            loading={loading}
          />
        ))}
      </div>

      {/* Users Table */}
      <DataTable
        data={users}
        columns={columns}
        actions={actions}
        loading={loading}
        selectable
        selectedItems={selectedUsers}
        onSelectionChange={setSelectedUsers}
        getItemId={(user) => user.userId}
        title="Team Members"
        description="All users in your organization"
        onRefresh={loadUsers}
        emptyMessage="No users found. Start by inviting your first team member."
      />

      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite New User"
        description="Send an invitation to a new team member"
        size="md"
        footer={
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser}>
              <Send className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="message">Welcome Message (Optional)</Label>
            <Textarea
              id="message"
              value={inviteForm.message}
              onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Welcome to our team!"
            />
          </div>
        </div>
      </Modal>

      {/* User Details Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="User Details"
        size="lg"
      >
        {currentUser && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={currentUser.avatar} />
                <AvatarFallback className="text-lg">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">{currentUser.name}</h3>
                <p className="text-muted-foreground">{currentUser.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <UserStatusBadge
                    isActive={currentUser.isActive}
                    onboardingCompleted={currentUser.onboardingCompleted}
                  />
                  {currentUser.isTenantAdmin && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      <Crown className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Department</Label>
                <p className="text-sm text-muted-foreground">
                  {currentUser.department || 'Not specified'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <p className="text-sm text-muted-foreground">
                  {currentUser.title || 'Not specified'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Last Login</Label>
                <p className="text-sm text-muted-foreground">
                  {currentUser.lastLoginAt
                    ? new Date(currentUser.lastLoginAt).toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        size="md"
        footer={
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                value={editForm.department}
                onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked: boolean) => setEditForm(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-admin"
                checked={editForm.isTenantAdmin}
                onCheckedChange={(checked: boolean) => setEditForm(prev => ({ ...prev, isTenantAdmin: checked }))}
              />
              <Label htmlFor="edit-admin">Admin</Label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        description={`Are you sure you want to delete ${currentUser?.name}? This action cannot be undone.`}
        confirmText="Delete User"
        confirmVariant="destructive"
      />
    </motion.div>
  );
} 