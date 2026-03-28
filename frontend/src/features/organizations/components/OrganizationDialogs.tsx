import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, CreditCard } from 'lucide-react';
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader';
import { Organization } from '@/types/organization';

interface OrganizationDialogsProps {
  // Create Organization Dialog
  showCreateSub: boolean;
  setShowCreateSub: (show: boolean) => void;
  subForm: {
    name: string;
    description: string;
    responsiblePersonId: string;
    organizationType: string;
  };
  setSubForm: (form: (prev: any) => any) => void;
  onCreateSubOrganization: () => void;
  isCreating?: boolean;
  
  // Edit Organization Dialog
  showEdit: boolean;
  setShowEdit: (show: boolean) => void;
  editForm: {
    name: string;
    description: string;
    isActive: boolean;
  };
  setEditForm: (form: (prev: any) => any) => void;
  onUpdateOrganization: () => void;
  isUpdating?: boolean;
  
  // Create Location Dialog
  showCreateLocation: boolean;
  setShowCreateLocation: (show: boolean) => void;
  locationForm: {
    name: string;
    locationType: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    responsiblePersonId: string;
  };
  setLocationForm: (form: (prev: any) => any) => void;
  onCreateLocation: () => void;
  isCreatingLocation?: boolean;
  
  // Credit Transfer Dialog
  showCreditTransfer: boolean;
  setShowCreditTransfer: (show: boolean) => void;
  creditTransferForm: {
    sourceEntityType: string;
    sourceEntityId: string;
    destinationEntityType: string;
    destinationEntityId: string;
    amount: string;
    transferType: string;
    isTemporary: boolean;
    recallDeadline: string;
    description: string;
  };
  setCreditTransferForm: (form: (prev: any) => any) => void;
  onTransferCredits: () => void;
  
  // Data
  users: any[];
  locations: any[];
  hierarchy: any;
  selectedOrg: Organization | null;
}

export function OrganizationDialogs({
  showCreateSub,
  setShowCreateSub,
  selectedOrg,
  subForm,
  setSubForm,
  onCreateSubOrganization,
  isCreating = false,
  showEdit,
  setShowEdit,
  editForm,
  setEditForm,
  onUpdateOrganization,
  isUpdating = false,
  showCreateLocation,
  setShowCreateLocation,
  locationForm,
  setLocationForm,
  onCreateLocation,
  isCreatingLocation = false,
  showCreditTransfer,
  setShowCreditTransfer,
  creditTransferForm,
  setCreditTransferForm,
  onTransferCredits,
  users,
  locations,
  hierarchy
}: OrganizationDialogsProps) {
  return (
    <>
      {/* Create Organization Dialog */}
      <Dialog open={showCreateSub} onOpenChange={setShowCreateSub}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedOrg ? 'Create Sub-Organization' : 'Create Organization'}
            </DialogTitle>
            <DialogDescription>
              {selectedOrg
                ? `Create a sub-organization under ${selectedOrg.entityName}.`
                : 'Create a new top-level organization for this tenant.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sub-name">Organization Name *</Label>
              <Input
                id="sub-name"
                value={subForm.name}
                onChange={(e) => setSubForm((prev: any) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>
            <div>
              <Label htmlFor="sub-description">Description</Label>
              <Textarea
                id="sub-description"
                value={subForm.description}
                onChange={(e) => setSubForm((prev: any) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter organization description"
              />
            </div>
            <div>
              <Label htmlFor="sub-type">Organization Type</Label>
              <Select
                value={subForm.organizationType}
                onValueChange={(value) => setSubForm((prev: any) => ({ ...prev, organizationType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="division">Division</SelectItem>
                  <SelectItem value="branch">Branch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sub-responsible">Responsible Person</Label>
              <Select
                value={subForm.responsiblePersonId}
                onValueChange={(value) => setSubForm((prev: any) => ({ ...prev, responsiblePersonId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select responsible person (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No responsible person</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.userId} value={user.userId}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#1B2E5A] flex items-center justify-center text-white text-xs font-semibold">
                          {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name || 'Unnamed User'}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSub(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={onCreateSubOrganization} disabled={!subForm.name.trim() || isCreating}>
              {isCreating ? (
                <>
                  <ZopkitRoundLoader size="xs" className="mr-2" />
                  Creating...
                </>
              ) : (
                selectedOrg ? 'Create Sub-Organization' : 'Create Organization'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update the details for {selectedOrg?.entityName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Organization Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, description: e.target.value }))}
                placeholder="Enter organization description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, isActive: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={onUpdateOrganization} disabled={!editForm.name.trim() || isUpdating}>
              {isUpdating ? (
                <>
                  <ZopkitRoundLoader size="xs" className="mr-2" />
                  Updating...
                </>
              ) : (
                'Update Organization'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Location Dialog */}
      <Dialog open={showCreateLocation} onOpenChange={setShowCreateLocation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Location</DialogTitle>
            <DialogDescription>
              Create a new location for {selectedOrg?.entityName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="location-name">Location Name *</Label>
              <Input
                id="location-name"
                value={locationForm.name}
                onChange={(e) => setLocationForm((prev: any) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter location name"
              />
            </div>
            <div>
              <Label htmlFor="location-type">Location Type</Label>
              <Select
                value={locationForm.locationType || 'office'}
                onValueChange={(value) => setLocationForm((prev: any) => ({ ...prev, locationType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="retail">Retail Store</SelectItem>
                  <SelectItem value="remote">Remote Work</SelectItem>
                  <SelectItem value="branch">Branch Office</SelectItem>
                  <SelectItem value="headquarters">Headquarters</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="location-address">Street Address *</Label>
              <Input
                id="location-address"
                value={locationForm.address}
                onChange={(e) => setLocationForm((prev: any) => ({ ...prev, address: e.target.value }))}
                placeholder="Enter street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location-city">City *</Label>
                <Input
                  id="location-city"
                  value={locationForm.city}
                  onChange={(e) => setLocationForm((prev: any) => ({ ...prev, city: e.target.value }))}
                  placeholder="Enter city"
                />
              </div>
              <div>
                <Label htmlFor="location-state">State</Label>
                <Input
                  id="location-state"
                  value={locationForm.state}
                  onChange={(e) => setLocationForm((prev: any) => ({ ...prev, state: e.target.value }))}
                  placeholder="Enter state"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location-zip">ZIP Code</Label>
                <Input
                  id="location-zip"
                  value={locationForm.zipCode}
                  onChange={(e) => setLocationForm((prev: any) => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="Enter ZIP code"
                />
              </div>
              <div>
                <Label htmlFor="location-country">Country *</Label>
                <Input
                  id="location-country"
                  value={locationForm.country}
                  onChange={(e) => setLocationForm((prev: any) => ({ ...prev, country: e.target.value }))}
                  placeholder="Enter country"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="location-responsible">Responsible Person</Label>
              <Select 
                value={locationForm.responsiblePersonId} 
                onValueChange={(value) => setLocationForm((prev: any) => ({ ...prev, responsiblePersonId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select responsible person (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No responsible person</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.userId} value={user.userId}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#1B2E5A] flex items-center justify-center text-white text-xs font-semibold">
                          {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name || 'Unnamed User'}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLocation(false)} disabled={isCreatingLocation}>
              Cancel
            </Button>
            <Button
              onClick={onCreateLocation}
              disabled={!locationForm.name.trim() || !locationForm.address.trim() || !locationForm.city.trim() || !locationForm.country.trim() || isCreatingLocation}
            >
              {isCreatingLocation ? (
                <>
                  <ZopkitRoundLoader size="xs" className="mr-2" />
                  Creating...
                </>
              ) : (
                'Create Location'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Transfer Dialog */}
      <Dialog open={showCreditTransfer} onOpenChange={setShowCreditTransfer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Transfer Credits
            </DialogTitle>
            <DialogDescription>
              Transfer credits from {selectedOrg?.entityName} to its child organizations or locations.
              Credits flow down the hierarchy from parent to child entities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="source-entity">From (Source)</Label>
              <div className="p-3 border rounded-lg bg-[#1B2E5A]/5 border-[#1B2E5A]/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1B2E5A] flex items-center justify-center text-white font-semibold">
                    {selectedOrg?.entityName?.charAt(0)?.toUpperCase() || 'O'}
                  </div>
                  <div>
                    <div className="font-medium">{selectedOrg?.entityName}</div>
                    <div className="text-xs text-gray-600">Organization</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="destination-type">Transfer To</Label>
              <Select 
                value={creditTransferForm.destinationEntityType} 
                onValueChange={(value) => setCreditTransferForm((prev: any) => ({ ...prev, destinationEntityType: value, destinationEntityId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Child Organization</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="destination-entity">Select Destination</Label>
              <Select 
                value={creditTransferForm.destinationEntityId} 
                onValueChange={(value) => setCreditTransferForm((prev: any) => ({ ...prev, destinationEntityId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {creditTransferForm.destinationEntityType === 'organization' ? (
                    // Show only child organizations (direct children and nested children)
                    (() => {
                      const getChildOrganizations = (org: Organization): Organization[] => {
                        let children: Organization[] = [];
                        if (org.children) {
                          children = [...org.children];
                          // Recursively get nested children
                          org.children.forEach(child => {
                            children = [...children, ...getChildOrganizations(child)];
                          });
                        }
                        return children;
                      };

                      const childOrgs = selectedOrg ? getChildOrganizations(selectedOrg) : [];
                      
                      return childOrgs.length > 0 ? childOrgs.map(org => (
                        <SelectItem key={org.entityId} value={org.entityId}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                              {org.entityName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{org.entityName}</div>
                              <div className="text-xs text-gray-500">
                                Level {org.entityLevel} • {org.entityType}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      )) : (
                        <SelectItem value="no-orgs" disabled>
                          <div className="text-gray-400 text-sm">No child organizations available</div>
                        </SelectItem>
                      );
                    })()
                  ) : (
                    // Show only locations belonging to this organization or its children
                    (() => {
                      const getOrgAndChildIds = (org: Organization): string[] => {
                        let ids = [org.entityId];
                        if (org.children) {
                          org.children.forEach(child => {
                            ids = [...ids, ...getOrgAndChildIds(child)];
                          });
                        }
                        return ids;
                      };

                      const allowedOrgIds = selectedOrg ? getOrgAndChildIds(selectedOrg) : [];
                      const allowedLocations = locations.filter(location =>
                        (location as any).parentEntityId && allowedOrgIds.includes((location as any).parentEntityId)
                      );

                      return allowedLocations.length > 0 ? allowedLocations.map(location => (
                        <SelectItem key={(location as any).entityId} value={(location as any).entityId}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-semibold">
                              📍
                            </div>
                            <div>
                              <div className="font-medium">{(location as any).entityName}</div>
                              <div className="text-xs text-gray-500">
                                {hierarchy?.hierarchy?.find((org: any) => org.entityId === (location as any).parentEntityId)?.entityName || 'Unknown Org'}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      )) : (
                        <SelectItem value="no-locations" disabled>
                          <div className="text-gray-400 text-sm">No locations available for transfer</div>
                        </SelectItem>
                      );
                    })()
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="transfer-amount">Amount to Transfer</Label>
              <Input
                id="transfer-amount"
                type="number"
                value={creditTransferForm.amount}
                onChange={(e) => setCreditTransferForm((prev: any) => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter credit amount"
                min="1"
                step="1"
              />
            </div>

            <div>
              <Label htmlFor="transfer-description">Description (Optional)</Label>
              <Textarea
                id="transfer-description"
                value={creditTransferForm.description}
                onChange={(e) => setCreditTransferForm((prev: any) => ({ ...prev, description: e.target.value }))}
                placeholder="Reason for transfer..."
                className="resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="temporary-transfer"
                checked={creditTransferForm.isTemporary}
                onChange={(e) => setCreditTransferForm((prev: any) => ({ ...prev, isTemporary: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="temporary-transfer" className="text-sm">
                Temporary transfer (can be recalled)
              </Label>
            </div>

            {creditTransferForm.isTemporary && (
              <div>
                <Label htmlFor="recall-deadline">Recall Deadline</Label>
                <Input
                  id="recall-deadline"
                  type="datetime-local"
                  value={creditTransferForm.recallDeadline}
                  onChange={(e) => setCreditTransferForm((prev: any) => ({ ...prev, recallDeadline: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditTransfer(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onTransferCredits}
              disabled={!creditTransferForm.destinationEntityId || !creditTransferForm.amount}
              className="bg-green-600 hover:bg-green-700"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfer Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
