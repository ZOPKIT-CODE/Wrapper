import React, { useState, useEffect } from 'react';
import {
  Crown,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  UserCheck,
  Clock,
  Building
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  userId: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

interface CurrentAdmin {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  assignedAt: string;
}

interface AdminStatus {
  currentAdmin: CurrentAdmin | null;
  eligibleUsers: User[];
  canPromote: boolean;
  organizationInfo: {
    name: string;
    kindeOrgId: string;
    totalEligibleUsers: number;
  };
  policies: {
    singleAdminOnly: boolean;
    requiresConfirmationForTransfer: boolean;
    cannotDeleteOnlyAdmin: boolean;
  };
}

interface PromotionPreview {
  newAdmin: {
    userId: string;
    name: string;
    email: string;
    willReceiveRole: string;
  };
  currentAdmin?: {
    userId: string;
    name: string;
    email: string;
    willLoseRole: string;
  };
  willDemoteCurrentAdmin: boolean;
  systemAdminRole: {
    name: string;
    description: string;
    permissions: string;
  };
  warnings: string[];
}

export const AdminPromotionManager: React.FC = () => {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [promotionPreview, setPromotionPreview] = useState<PromotionPreview | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [forceTransfer, setForceTransfer] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [requiredConfirmationCode, setRequiredConfirmationCode] = useState('');

  // Load admin status and eligible users
  const loadAdminStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin-promotion/admin-status');
      setAdminStatus(response.data.data);
    } catch (error: any) {
      console.error('Failed to load admin status:', error);
      toast.error('Failed to load system administrator status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminStatus();
  }, []);

  // Preview promotion impact
  const previewPromotion = async (user: User) => {
    try {
      const response = await api.post('/admin-promotion/preview', {
        targetUserId: user.userId
      });
      
      setPromotionPreview(response.data.data.impact);
      setSelectedUser(user);
      setShowConfirmDialog(true);
      setReason('');
      setForceTransfer(false);
      setConfirmationCode('');
      setRequiredConfirmationCode('');
    } catch (error: any) {
      console.error('Failed to preview promotion:', error);
      toast.error('Failed to preview promotion impact');
    }
  };

  // Execute promotion
  const executePromotion = async () => {
    if (!selectedUser || !reason.trim()) {
      toast.error('Please provide a reason for the promotion');
      return;
    }

    try {
      setPromoting(true);

      const requestData: any = {
        targetUserId: selectedUser.userId,
        reason: reason.trim(),
        forceTransfer
      };

      if (confirmationCode) {
        requestData.confirmationCode = confirmationCode;
      }

      const response = await api.post('/admin-promotion/promote-system-admin', requestData);

      if (response.data.success) {
        toast.success(`Successfully promoted ${selectedUser.name} to System Administrator!`);
        setShowConfirmDialog(false);
        await loadAdminStatus(); // Reload to show updated state
      } else {
        throw new Error(response.data.message || 'Promotion failed');
      }

    } catch (error: any) {
      console.error('Promotion failed:', error);
      
      if (error.response?.status === 409) {
        // Handle existing admin case
        const errorData = error.response.data;
        if (errorData.requiresConfirmation) {
          setForceTransfer(true);
          toast.error('Another admin exists. Enable "Force Transfer" and provide confirmation code.');
        }
      } else if (error.response?.status === 400) {
        // Handle confirmation code requirement
        const errorData = error.response.data;
        if (errorData.requiredConfirmationCode) {
          setRequiredConfirmationCode(errorData.requiredConfirmationCode);
          toast.error('Confirmation code required for this operation');
        } else {
          toast.error(errorData.message || 'Invalid request');
        }
      } else {
        toast.error(error.response?.data?.message || 'Failed to promote user');
      }
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading System Administrator management...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-8 h-8 text-yellow-600" />
          <div>
            <h1 className="text-2xl font-bold text-[#1B2E5A]">System Administrator Management</h1>
            <p className="text-gray-600">Manage the single System Administrator role for your organization</p>
          </div>
        </div>

        {/* Organization Info */}
        {adminStatus?.organizationInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">Organization Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Name:</span>
                <span className="ml-2 text-blue-900">{adminStatus.organizationInfo.name}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">ID:</span>
                <span className="ml-2 text-blue-900 font-mono text-xs">{adminStatus.organizationInfo.kindeOrgId}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Eligible Users:</span>
                <span className="ml-2 text-blue-900">{adminStatus.organizationInfo.totalEligibleUsers}</span>
              </div>
            </div>
          </div>
        )}

        {/* Current Admin Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">Current System Administrator</h3>
          </div>
          
          {adminStatus?.currentAdmin ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-[#1B2E5A]">{adminStatus.currentAdmin.name}</p>
                <p className="text-sm text-gray-600">{adminStatus.currentAdmin.email}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Assigned: {new Date(adminStatus.currentAdmin.assignedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Badge variant="default" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                  <Crown className="w-3 h-3 mr-1" />
                  Active Admin
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {adminStatus.currentAdmin.roleName}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">No System Administrator assigned</span>
            </div>
          )}
        </div>

        {/* System Policies */}
        {adminStatus?.policies && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle className="text-sm">Single Admin Only</AlertTitle>
              <AlertDescription className="text-xs">
                Only one System Administrator can exist at a time
              </AlertDescription>
            </Alert>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle className="text-sm">Transfer Protection</AlertTitle>
              <AlertDescription className="text-xs">
                Confirmation required for admin transfers
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-sm">Deletion Protection</AlertTitle>
              <AlertDescription className="text-xs">
                Cannot delete the only System Administrator
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Eligible Users */}
      {adminStatus?.canPromote && adminStatus.eligibleUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Eligible Users for System Administrator
            </CardTitle>
            <CardDescription>
              Users who can be promoted to System Administrator role. Only one can hold this role at a time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {adminStatus.eligibleUsers.map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-[#1B2E5A]">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          Joined: {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => previewPromotion(user)}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Promote to Admin
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Eligible Users */}
      {adminStatus?.canPromote && adminStatus.eligibleUsers.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Eligible Users</AlertTitle>
          <AlertDescription>
            There are no users eligible for System Administrator promotion. 
            All active users either already have admin roles or are inactive.
          </AlertDescription>
        </Alert>
      )}

      {/* Cannot Promote */}
      {!adminStatus?.canPromote && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            Only System Administrators can promote other users to admin roles.
          </AlertDescription>
        </Alert>
      )}

      {/* Promotion Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-600" />
              Promote to System Administrator
            </DialogTitle>
            <DialogDescription>
              Review the promotion details and confirm this high-impact operation.
            </DialogDescription>
          </DialogHeader>

          {promotionPreview && selectedUser && (
            <div className="space-y-6">
              {/* Promotion Impact */}
              <div className="space-y-4">
                <h3 className="font-semibold text-[#1B2E5A]">Promotion Impact</h3>
                
                {/* New Admin */}
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-900">{promotionPreview.newAdmin.name}</p>
                    <p className="text-sm text-green-700">{promotionPreview.newAdmin.email}</p>
                    <p className="text-xs text-green-600">Will become: {promotionPreview.newAdmin.willReceiveRole}</p>
                  </div>
                </div>

                {/* Current Admin (if exists) */}
                {promotionPreview.currentAdmin && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-orange-900">{promotionPreview.currentAdmin.name}</p>
                      <p className="text-sm text-orange-700">{promotionPreview.currentAdmin.email}</p>
                      <p className="text-xs text-orange-600">Will lose: {promotionPreview.currentAdmin.willLoseRole}</p>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {promotionPreview.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Important Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {promotionPreview.warnings.map((warning, index) => (
                          <li key={index} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* Promotion Form */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reason">Reason for Promotion *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Explain why this user should be promoted to System Administrator..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {promotionPreview.willDemoteCurrentAdmin && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="forceTransfer"
                        checked={forceTransfer}
                        onCheckedChange={(checked) => setForceTransfer(!!checked)}
                      />
                      <Label 
                        htmlFor="forceTransfer" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Force transfer from current System Administrator
                      </Label>
                    </div>

                    {forceTransfer && requiredConfirmationCode && (
                      <div>
                        <Label htmlFor="confirmationCode">Confirmation Code *</Label>
                        <Input
                          id="confirmationCode"
                          type="text"
                          placeholder="Enter the required confirmation code"
                          value={confirmationCode}
                          onChange={(e) => setConfirmationCode(e.target.value)}
                          className="mt-1 font-mono"
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Required code: <code className="bg-gray-100 px-1 rounded">{requiredConfirmationCode}</code>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={promoting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={executePromotion}
                  disabled={promoting || !reason.trim() || (forceTransfer && requiredConfirmationCode && confirmationCode !== requiredConfirmationCode)}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  {promoting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Promoting...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Confirm Promotion
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}; 