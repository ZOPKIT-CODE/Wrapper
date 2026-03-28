import { useState } from 'react';
import { Mail, CheckCircle, Clock, AlertCircle, Shield, Building2, Calendar, LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PearlButton } from "@/components/ui/pearl-button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { User } from "@/types/user-management";
import { UserAvatarPresets } from "@/components/common/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAccessContent } from './modals/UserAccessModal';

interface UserDetailsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  generateInvitationUrl: (user: User) => string | null;
  copyInvitationUrl: (user: User) => Promise<void>;
}

export const UserDetailsModal = ({
  user,
  isOpen,
  onClose,
  generateInvitationUrl,
  copyInvitationUrl
}: UserDetailsModalProps) => {
  const [activeTab, setActiveTab] = useState("profile");

  if (!isOpen || !user) return null;

  const getStatusBadge = () => {
    if (user.invitationStatus === 'pending') {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 h-6">
          <Clock className="w-3 h-3" />
          Pending
        </Badge>
      );
    }
    if (user.isActive) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 h-6">
          <CheckCircle className="w-3 h-3" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 gap-1.5 h-6">
        <AlertCircle className="w-3 h-3" />
        Inactive
      </Badge>
    );
  };

  const getOnboardingStatus = () => {
    return user.onboardingCompleted ? (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle className="w-4 h-4" />
        <span>Completed</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-sm text-amber-700">
        <Clock className="w-4 h-4" />
        <span>Pending</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl border-none shadow-2xl">
        <DialogHeader className="px-8 py-6 border-b flex-shrink-0 bg-background/50">
          <div className="flex items-center gap-5">
            <UserAvatarPresets.Header user={user} className="h-16 w-16 shadow-sm border-2 border-white dark:border-slate-800" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-2xl font-bold tracking-tight text-foreground/90">
                  {user.name || 'Unnamed User'}
                </DialogTitle>
                {getStatusBadge()}
              </div>
              <DialogDescription className="text-base font-normal text-muted-foreground flex items-center gap-2">
                {user.email || 'No email provided'}
                <span className="text-muted-foreground/40">•</span>
                <span className="font-medium text-foreground/70">{user.roles?.[0]?.roleName || 'No Role'}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 border-b bg-background/50">
            <TabsList className="bg-transparent h-12 p-0 space-x-8">
              <TabsTrigger
                value="profile"
                className="h-12 px-0 text-sm font-medium bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none transition-none"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="access"
                className="h-12 px-0 text-sm font-medium bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none transition-none"
              >
                Access Management
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 bg-muted/5">
            <div className="p-8">
              <TabsContent value="profile" className="mt-0 space-y-8 focus-visible:outline-none">

                {/* Invitation URL Section - Prominent if pending */}
                {user.invitationStatus === 'pending' && (
                  <div className="rounded-xl border border-[#1B2E5A]/15 bg-[#1B2E5A]/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-[#1B2E5A] flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#1B2E5A]" /> Pending Invitation
                        </h3>
                        <p className="text-sm text-[#1B2E5A]/90">
                          User has not accepted the invitation yet.
                        </p>
                      </div>
                      <PearlButton
                        size="sm"
                        variant="outline"
                        className="text-[#1B2E5A] hover:text-[#162447]"
                        onClick={() => copyInvitationUrl(user)}
                      >
                        Copy Link
                      </PearlButton>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generateInvitationUrl(user) || 'No invitation URL available'}
                        readOnly
                        className="font-mono text-xs bg-white/80 border-[#1B2E5A]/30 focus-visible:ring-[#1B2E5A] h-9"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Account Summary */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Account
                    </h3>
                    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
                      <div className="flex items-center justify-between py-1 border-b border-border/50 pb-3">
                        <span className="text-sm text-muted-foreground">Current Status</span>
                        {getStatusBadge()}
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-border/50 pb-3">
                        <span className="text-sm text-muted-foreground">Assigned Role</span>
                        <span className="text-sm font-medium">{user.roles?.[0]?.roleName || 'None'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">Onboarding</span>
                        {getOnboardingStatus()}
                      </div>
                    </div>
                  </div>

                  {/* Activity Summary */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Activity
                    </h3>
                    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-4">
                      <div className="flex items-center justify-between py-1 border-b border-border/50 pb-3">
                        <span className="text-sm text-muted-foreground">Invited Date</span>
                        <span className="text-sm font-medium flex items-center gap-2">
                          {user.invitedAt ? new Date(user.invitedAt).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">Last Login</span>
                        <span className="text-sm font-medium flex items-center gap-2">
                          <LogIn className="w-3.5 h-3.5 text-muted-foreground" />
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Organizations */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Organizations
                  </h3>
                  {user.organizations && user.organizations.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {user.organizations.map(org => (
                        <div key={org.membershipId} className="flex items-center justify-between p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${org.isPrimary ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate" title={org.organizationName}>{org.organizationName}</div>
                              <div className="text-xs text-muted-foreground capitalize">{org.entityType}</div>
                            </div>
                          </div>
                          {org.isPrimary && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">Primary</Badge>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic px-4 py-8 text-center border-2 border-dashed rounded-xl">
                      No organizations assigned to this user.
                    </div>
                  )}
                </div>

              </TabsContent>

              <TabsContent value="access" className="mt-0 h-full focus-visible:outline-none">
                <UserAccessContent user={user} />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;