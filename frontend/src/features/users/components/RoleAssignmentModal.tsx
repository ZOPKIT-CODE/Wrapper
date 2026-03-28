import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PearlButton } from '@/components/ui/pearl-button';
import { Check, Shield, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RoleAssignmentConfirmationModal } from '@/components/common/ConfirmationModal';

interface User {
  userId: string;
  name: string;
  email: string;
}

interface Role {
  roleId: string;
  roleName: string;
  description: string;
  color: string;
  icon: string;
}

interface RoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  roles: Role[];
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  onSave: () => void;
  isLoading?: boolean;
  isDeassigning?: boolean;
}

export function RoleAssignmentModal({
  isOpen,
  onClose,
  user,
  roles,
  selectedRoles,
  setSelectedRoles,
  onSave,
  isLoading = false,
  isDeassigning = false
}: RoleAssignmentModalProps) {
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    action: 'assign' | 'deassign';
    roleId: string;
    roleName: string;
  } | null>(null);

  const handleRoleToggle = (roleId: string) => {
    const role = roles.find(r => r.roleId === roleId);
    if (!role) return;

    const isCurrentlyAssigned = selectedRoles.includes(roleId);
    const action = isCurrentlyAssigned ? 'deassign' : 'assign';

    setConfirmationModal({
      isOpen: true,
      action,
      roleId,
      roleName: role.roleName
    });
  };

  const handleConfirmAction = () => {
    if (!confirmationModal || !user) return;

    const { action, roleId } = confirmationModal;

    if (action === 'assign') {
      setSelectedRoles([...selectedRoles, roleId]);
    } else {
      setSelectedRoles(selectedRoles.filter(id => id !== roleId));
    }

    setConfirmationModal(null);
  };

  const handleCancelConfirmation = () => {
    setConfirmationModal(null);
  };



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-0 gap-0">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Manage Roles
          </DialogTitle>
          <DialogDescription className="text-violet-100 mt-1">
            Assign or remove access roles for <span className="font-semibold text-white">{user?.name || user?.email}</span>
          </DialogDescription>
        </div>

        {/* Summary: assigned vs not assigned */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{selectedRoles.length} assigned</span>
            <span className="text-slate-400 mx-2">•</span>
            <span className="text-slate-600 dark:text-slate-400">{roles.length - selectedRoles.length} not assigned</span>
            <span className="text-slate-400 ml-1 text-xs">(of {roles.length} total). Click a role to toggle.</span>
          </p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
          <div className="grid gap-3">
            {roles.map((role) => {
              const isSelected = selectedRoles.includes(role.roleId);
              return (
                <div
                  key={role.roleId}
                  onClick={() => handleRoleToggle(role.roleId)}
                  className={`relative flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer group ${isSelected
                    ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20 shadow-sm'
                    : 'border-white dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                  <div className={`p-3 rounded-lg mr-4 ${isSelected ? 'bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                    {role.icon ? <span className="text-lg">{role.icon}</span> : <Shield className="w-5 h-5" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-semibold ${isSelected ? 'text-violet-900 dark:text-violet-100' : 'text-[#1B2E5A] dark:text-slate-200'}`}>
                        {role.roleName}
                      </h4>
                      {isSelected ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 text-[10px] px-1.5 h-5 border border-emerald-200 dark:border-emerald-700">
                          Assigned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 dark:text-slate-400 text-[10px] px-1.5 h-5 border-slate-300 dark:border-slate-600">
                          Not assigned
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {role.description || 'No description provided'}
                    </p>
                  </div>

                  <div className="ml-4">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white shadow-md" title="Assigned — click to remove">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-violet-400 transition-colors" title="Not assigned — click to assign" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center">
          <span className="text-sm text-slate-500 ml-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">{selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''} assigned</span>
            {selectedRoles.length === 0 && <span className="text-amber-600 dark:text-amber-400 ml-1">— assign at least one to grant access</span>}
          </span>
          <div className="flex gap-3">
            <PearlButton variant="secondary" onClick={onClose} size="sm" disabled={isLoading || isDeassigning}>
              Cancel
            </PearlButton>
            <PearlButton onClick={onSave} size="sm" disabled={isLoading || isDeassigning}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </PearlButton>
          </div>
        </div>
      </DialogContent>

      {/* Confirmation Modal */}
      {confirmationModal && (
        <RoleAssignmentConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={handleCancelConfirmation}
          onConfirm={handleConfirmAction}
          roleName={confirmationModal.roleName}
          userName={user?.name || user?.email || 'User'}
          action={confirmationModal.action}
          loading={false}
        />
      )}
    </Dialog>
  );
}