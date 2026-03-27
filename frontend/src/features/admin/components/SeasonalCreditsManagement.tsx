import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Calendar, Gift, TrendingUp, AlertTriangle, Plus, RefreshCw, Eye, Edit, Trash2, Send, Clock, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Sub-components
import ExpiryManagementPanel from './ExpiryManagementPanel';

interface Campaign {
  campaignId: string;
  campaignName: string;
  creditType: string;
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  tenantCount: number;
  expiresAt: string;
  createdAt: string;
}

interface ExpiringCredit {
  campaignId: string;
  campaignName: string;
  creditType: string;
  tenantId: string;
  tenantName: string;
  totalCredits: number;
  expiresAt: string;
  daysUntilExpiry: number;
}

interface CreditTypeConfig {
  [key: string]: {
    name: string;
    defaultExpiryDays: number;
    expiryRule: string;
    warningDays: number;
    description: string;
  };
}

const CREDIT_TYPES: CreditTypeConfig = {
  seasonal: {
    name: 'Seasonal Credits',
    defaultExpiryDays: 30,
    expiryRule: 'fixed_date',
    warningDays: 7,
    description: 'Holiday and seasonal promotional credits'
  },
  bonus: {
    name: 'Bonus Credits',
    defaultExpiryDays: 90,
    expiryRule: 'fixed_date',
    warningDays: 14,
    description: 'Loyalty and referral bonus credits'
  },
  promotional: {
    name: 'Promotional Credits',
    defaultExpiryDays: 14,
    expiryRule: 'fixed_date',
    warningDays: 3,
    description: 'Marketing campaign credits'
  },
  event: {
    name: 'Event Credits',
    defaultExpiryDays: 7,
    expiryRule: 'fixed_date',
    warningDays: 2,
    description: 'Special event and product launch credits'
  },
  partnership: {
    name: 'Partnership Credits',
    defaultExpiryDays: 60,
    expiryRule: 'fixed_date',
    warningDays: 10,
    description: 'Partner program and affiliate credits'
  },
  trial_extension: {
    name: 'Trial Extension Credits',
    defaultExpiryDays: 30,
    expiryRule: 'fixed_date',
    warningDays: 7,
    description: 'Extended trial period credits'
  }
};

const SeasonalCreditsManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expiringCredits, setExpiringCredits] = useState<ExpiringCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Form states
  const [newCampaign, setNewCampaign] = useState({
    campaignId: '',
    campaignName: '',
    creditType: '',
    totalCredits: '',
    expiresAt: '',
    expiresAtTime: '23:59', // Default to end of day
    targetApplications: [] as string[],
    tenantIds: [] as string[],
    sendNotifications: true,
    metadata: {}
  });

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/admin/seasonal-credits/campaigns');
      if (response.data.success) {
        setCampaigns(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      toast.error('Failed to load campaigns');
    }
  };

  const fetchExpiringCredits = async () => {
    try {
      const response = await api.get('/admin/seasonal-credits/expiring-soon', {
        params: { daysAhead: 30 }
      });
      if (response.data.success) {
        setExpiringCredits(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch expiring credits:', error);
      toast.error('Failed to load expiring credits');
    }
  };


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchCampaigns(), fetchExpiringCredits()]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleCreateCampaign = async () => {
    try {
      // Combine date and time into ISO datetime string
      let expiresAtDateTime = null;
      if (newCampaign.expiresAt) {
        const dateTimeString = `${newCampaign.expiresAt}T${newCampaign.expiresAtTime}:00`;
        expiresAtDateTime = new Date(dateTimeString).toISOString();
      }

      const campaignData = {
        ...newCampaign,
        totalCredits: parseFloat(newCampaign.totalCredits),
        expiresAt: expiresAtDateTime,
        targetApplications: newCampaign.targetApplications.length > 0 ? newCampaign.targetApplications : ['crm', 'hr', 'affiliate', 'system']
      };

      // Remove expiresAtTime from the data sent to backend
      delete campaignData.expiresAtTime;

      const response = await api.post('/admin/seasonal-credits/campaigns', campaignData);

      if (response.data.success) {
        toast.success('Campaign created successfully!');
        setCreateDialogOpen(false);
        setNewCampaign({
          campaignId: '',
          campaignName: '',
          creditType: '',
          totalCredits: '',
          expiresAt: '',
          expiresAtTime: '23:59',
          targetApplications: [],
          tenantIds: [],
          sendNotifications: true,
          metadata: {}
        });
        await fetchCampaigns();
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  const handleExtendExpiry = async (campaignId: string, additionalDays: number) => {
    try {
      const response = await api.put(`/admin/seasonal-credits/campaigns/${campaignId}/extend`, {
        additionalDays
      });

      if (response.data.success) {
        toast.success(`Extended expiry by ${additionalDays} days`);
        await fetchCampaigns();
      }
    } catch (error) {
      console.error('Failed to extend expiry:', error);
      toast.error('Failed to extend expiry');
    }
  };

  const handleSendExpiryWarnings = async () => {
    try {
      const response = await api.post('/admin/seasonal-credits/warnings', {
        daysAhead: 7
      });

      if (response.data.success) {
        toast.success(`Sent expiry warnings to ${response.data.data.emailsSent} tenants`);
      }
    } catch (error) {
      console.error('Failed to send expiry warnings:', error);
      toast.error('Failed to send expiry warnings');
    }
  };

  const getCreditTypeBadgeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      seasonal: 'bg-green-100 text-green-800',
      bonus: 'bg-yellow-100 text-yellow-800',
      promotional: 'bg-blue-100 text-blue-800',
      event: 'bg-pink-100 text-pink-800',
      partnership: 'bg-purple-100 text-purple-800',
      trial_extension: 'bg-cyan-100 text-cyan-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getDaysUntilExpiryColor = (days: number) => {
    if (days <= 3) return 'text-red-600';
    if (days <= 7) return 'text-orange-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading seasonal credits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Seasonal Credits Management</h2>
          <p className="text-muted-foreground">
            Create and manage seasonal, promotional, and bonus credit campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} variant="default">
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
          <Button onClick={handleSendExpiryWarnings} variant="outline">
            <Send className="h-4 w-4 mr-2" />
            Send Warnings
          </Button>
          <Button onClick={() => { fetchCampaigns(); fetchExpiringCredits(); }} variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="management">Management</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaigns.length}</div>
                <p className="text-xs text-muted-foreground">
                  Running credit campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Credits Issued</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.totalCredits, 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.usedCredits, 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {((campaigns.reduce((sum, c) => sum + c.usedCredits, 0) /
                    Math.max(campaigns.reduce((sum, c) => sum + c.totalCredits, 0), 1)) * 100).toFixed(1)}% utilization
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {expiringCredits.filter(c => c.daysUntilExpiry <= 7).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Within 7 days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
              <CardDescription>Latest seasonal credit campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.campaignId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{campaign.campaignName}</p>
                        <Badge className={getCreditTypeBadgeColor(campaign.creditType)}>
                          {CREDIT_TYPES[campaign.creditType]?.name || campaign.creditType}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {campaign.tenantCount} tenants • Expires {new Date(campaign.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-medium">
                        {campaign.availableCredits.toFixed(2)} / {campaign.totalCredits.toFixed(2)} credits
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {((campaign.usedCredits / campaign.totalCredits) * 100).toFixed(1)}% used
                      </p>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active campaigns
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Campaigns</CardTitle>
              <CardDescription>Manage seasonal credit campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Total Credits</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.campaignId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.campaignName}</p>
                          <p className="text-sm text-muted-foreground">{campaign.campaignId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCreditTypeBadgeColor(campaign.creditType)}>
                          {CREDIT_TYPES[campaign.creditType]?.name || campaign.creditType}
                        </Badge>
                      </TableCell>
                      <TableCell>{campaign.tenantCount}</TableCell>
                      <TableCell>{campaign.totalCredits.toFixed(2)}</TableCell>
                      <TableCell>
                        {((campaign.usedCredits / campaign.totalCredits) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{new Date(campaign.expiresAt).toLocaleDateString()}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(campaign.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate({ to: `/company-admin/campaigns/${campaign.campaignId}` })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExtendExpiry(campaign.campaignId, 30)}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credits Expiring Soon</CardTitle>
              <CardDescription>Monitor credits that will expire in the next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Days Left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringCredits.map((credit, index) => (
                    <TableRow key={index}>
                      <TableCell>{credit.tenantName}</TableCell>
                      <TableCell>{credit.campaignName}</TableCell>
                      <TableCell>
                        <Badge className={getCreditTypeBadgeColor(credit.creditType)}>
                          {CREDIT_TYPES[credit.creditType]?.name || credit.creditType}
                        </Badge>
                      </TableCell>
                      <TableCell>{credit.totalCredits.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{new Date(credit.expiresAt).toLocaleDateString()}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(credit.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getDaysUntilExpiryColor(credit.daysUntilExpiry)}`}>
                          {credit.daysUntilExpiry} days
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {expiringCredits.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No credits expiring soon
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Credit utilization by campaign type</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(CREDIT_TYPES).map(([type, config]) => {
                  const typeCampaigns = campaigns.filter(c => c.creditType === type);
                  const totalCredits = typeCampaigns.reduce((sum, c) => sum + c.totalCredits, 0);
                  const usedCredits = typeCampaigns.reduce((sum, c) => sum + c.usedCredits, 0);
                  const utilization = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;

                  return (
                    <div key={type} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getCreditTypeBadgeColor(type)}>
                          {config.name}
                        </Badge>
                        <span className="text-sm">{typeCampaigns.length} campaigns</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{utilization.toFixed(1)}% used</p>
                        <p className="text-xs text-muted-foreground">
                          {usedCredits.toFixed(2)} / {totalCredits.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expiry Distribution</CardTitle>
                <CardDescription>Credits expiring in different timeframes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expiring in 3 days</span>
                    <Badge variant="destructive">
                      {expiringCredits.filter(c => c.daysUntilExpiry <= 3).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expiring in 7 days</span>
                    <Badge className="bg-orange-100 text-orange-800">
                      {expiringCredits.filter(c => c.daysUntilExpiry <= 7).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expiring in 30 days</span>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {expiringCredits.filter(c => c.daysUntilExpiry <= 30).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
          <ExpiryManagementPanel onRefresh={() => { fetchCampaigns(); fetchExpiringCredits(); }} />
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Seasonal Credit Campaign</DialogTitle>
            <DialogDescription>
              Launch a new seasonal, promotional, or bonus credit campaign
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaignId">Campaign ID</Label>
                <Input
                  id="campaignId"
                  placeholder="e.g., holiday-2024-q4"
                  value={newCampaign.campaignId}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, campaignId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditType">Credit Type</Label>
                <Select
                  value={newCampaign.creditType}
                  onValueChange={(value) => setNewCampaign(prev => ({ ...prev, creditType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credit type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CREDIT_TYPES).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.name} ({config.defaultExpiryDays} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                placeholder="e.g., Holiday Season Special 2024"
                value={newCampaign.campaignName}
                onChange={(e) => setNewCampaign(prev => ({ ...prev, campaignName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalCredits">Total Credits</Label>
                <Input
                  id="totalCredits"
                  type="number"
                  placeholder="10000"
                  value={newCampaign.totalCredits}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, totalCredits: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiry Date</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={newCampaign.expiresAt}
                  onChange={(e) => {
                    setNewCampaign(prev => ({ ...prev, expiresAt: e.target.value }));
                    // If no time is set, default to end of day
                    if (!prev.expiresAtTime) {
                      setNewCampaign(prev => ({ ...prev, expiresAtTime: '23:59' }));
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]} // Prevent past dates
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiresAtTime">Expiry Time (Hours:Minutes)</Label>
                <Input
                  id="expiresAtTime"
                  type="time"
                  value={newCampaign.expiresAtTime}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, expiresAtTime: e.target.value }))}
                  step="60"
                />
                <p className="text-xs text-muted-foreground">
                  Default: 23:59 (end of day). Set specific time for precise expiry.
                </p>
              </div>
              {newCampaign.expiresAt && newCampaign.expiresAtTime && (
                <div className="space-y-2">
                  <Label>Preview Expiry DateTime</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {new Date(`${newCampaign.expiresAt}T${newCampaign.expiresAtTime}:00`).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} disabled={!newCampaign.campaignId || !newCampaign.campaignName || !newCampaign.creditType || !newCampaign.totalCredits}>
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default SeasonalCreditsManagement;
