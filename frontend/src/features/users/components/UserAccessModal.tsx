import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2 } from 'lucide-react';
import UserRoleManager from './UserRoleManager';
import { UserOrganizationManager } from './UserOrganizationManager';

interface User {
  userId: string;
  email: string;
  name: string;
  isActive: boolean;
  isTenantAdmin: boolean;
  onboardingCompleted: boolean;
  roles?: any[];
}

interface UserAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  defaultTab?: 'roles' | 'organizations';
}

export const UserAccessModal: React.FC<UserAccessModalProps> = ({
  isOpen,
  onClose,
  user,
  defaultTab = 'roles'
}) => {
  return (
    <Dialog open={isOpen && !!user} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-0 gap-0 max-h-[90vh] flex flex-col">
        {user && (
          <>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-200 dark:border-slate-800">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-[#1B2E5A] dark:text-white">
                <Shield className="w-5 h-5 text-blue-600" />
                User Access Management
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-1">
                Manage roles and organization access for <span className="font-semibold text-[#1B2E5A] dark:text-slate-200">{user.name || user.email}</span>
              </DialogDescription>
            </div>

            <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="roles" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Roles
                  </TabsTrigger>
                  <TabsTrigger value="organizations" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Organizations
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <TabsContent value="roles" className="mt-0 h-full">
                  <UserRoleManager userId={user.userId} />
                </TabsContent>
                
                <TabsContent value="organizations" className="mt-0 h-full">
                  <UserOrganizationManager userId={user.userId} user={user} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

