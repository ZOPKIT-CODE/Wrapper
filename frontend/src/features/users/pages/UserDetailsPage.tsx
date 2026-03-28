import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Mail, CheckCircle, Clock, AlertCircle, Shield, Building2, Calendar, LogIn } from 'lucide-react';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatarPresets } from '@/components/common/UserAvatar';
import { PearlButton } from '@/components/ui/pearl-button';
import { useUsers } from '@/features/users/components/hooks/useUsers';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { useUserActions } from '@/features/users/components/hooks/useUserActions';
import { UserAccessContent } from '@/features/users/components/modals/UserAccessModal';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext';

export function UserDetailsPage() {
  const { userId } = useParams({ strict: false });
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const { data: users = [], isLoading } = useUsers({});
  const { generateInvitationUrl, copyInvitationUrl } = useUserActions();
  const { setLastSegmentLabel } = useBreadcrumbLabel();

  // Find user by ID
  const user = React.useMemo(() => {
    if (!users || !userId) return null;
    return users.find((u: any) => u.userId === userId || u.id === userId) || null;
  }, [users, userId]);

  // Set breadcrumb label when user is loaded, clear on unmount
  useEffect(() => {
    if (user) {
      const displayName = user.name || user.email || user.userName || 'User';
      setLastSegmentLabel(displayName);
    }
    
    return () => {
      setLastSegmentLabel(null);
    };
  }, [user, setLastSegmentLabel]);

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">User Not Found</h2>
          <p className="text-gray-600">The user you're looking for doesn't exist.</p>
          <Button onClick={() => navigate({ to: '/dashboard/users' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </Container>
    );
  }

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
    <Container>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/users' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>
        </div>

        {/* User Details Content */}
        <Card className="w-full">
          <div className="px-8 py-6 border-b">
            <div className="flex items-center gap-5">
              <UserAvatarPresets.Header user={user} className="h-16 w-16 shadow-sm border-2 border-white dark:border-slate-800" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">
                    {user.name || 'Unnamed User'}
                  </h1>
                  {getStatusBadge()}
                </div>
                <p className="text-base font-normal text-muted-foreground flex items-center gap-2">
                  {user.email || 'No email provided'}
                  <span className="text-muted-foreground/40">•</span>
                  <span className="font-medium">{user.roles?.[0]?.roleName || 'No Role'}</span>
                </p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-8 border-b">
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

            <ScrollArea className="flex-1">
              <div className="p-8">
                <TabsContent value="profile" className="mt-0 space-y-8">
                  {/* Invitation URL Section */}
                  {user.invitationStatus === 'pending' && (
                    <div className="rounded-xl border border-[#1B2E5A]/20 bg-[#1B2E5A]/5 p-5 space-y-4">
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
                          className="font-mono text-xs bg-white/80 border-[#1B2E5A]/20 h-9"
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
                      <Card>
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-center justify-between py-1 border-b pb-3">
                            <span className="text-sm text-muted-foreground">Current Status</span>
                            {getStatusBadge()}
                          </div>
                          <div className="flex items-center justify-between py-1 border-b pb-3">
                            <span className="text-sm text-muted-foreground">Assigned role(s)</span>
                            <span className="text-sm font-medium">
                              {user.roles?.length
                                ? user.roles.map((r: { roleName: string }) => r.roleName).join(', ')
                                : <span className="text-amber-600 dark:text-amber-400">No role assigned</span>
                              }
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-sm text-muted-foreground">Onboarding</span>
                            {getOnboardingStatus()}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Activity Summary */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Activity
                      </h3>
                      <Card>
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-center justify-between py-1 border-b pb-3">
                            <span className="text-sm text-muted-foreground">Invited Date</span>
                            <span className="text-sm font-medium">
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
                        </CardContent>
                      </Card>
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
                          <Card key={org.membershipId}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-2.5 h-2.5 rounded-full ring-2 ${org.isPrimary ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                                  <div className="min-w-0">
                                    <div className="font-medium text-sm truncate">{org.organizationName}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{org.entityType}</div>
                                  </div>
                                </div>
                                {org.isPrimary && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Primary</Badge>}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic px-4 py-8 text-center border-2 border-dashed rounded-xl">
                        No organizations assigned to this user.
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="access" className="mt-0">
                  <UserAccessContent user={user} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </Card>
      </div>
    </Container>
  );
}
