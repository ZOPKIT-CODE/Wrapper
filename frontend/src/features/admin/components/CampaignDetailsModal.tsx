import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Calendar, Users, DollarSign, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';

interface CampaignDetails {
  campaign: {
    campaignId: string;
    campaignName: string;
    creditType: string;
    totalCredits: number;
    usedCredits: number;
    availableCredits: number;
    tenantCount: number;
    expiresAt: string;
    createdAt: string;
  };
  tenantBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    totalCredits: number;
    usedCredits: number;
    availableCredits: number;
    applicationBreakdown: string[];
    expiresAt: string;
  }>;
}

interface CampaignDetailsModalProps {
  campaignId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CampaignDetailsModal: React.FC<CampaignDetailsModalProps> = ({
  campaignId,
  open,
  onOpenChange
}) => {
  const [details, setDetails] = useState<CampaignDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (campaignId && open) {
      fetchCampaignDetails();
    }
  }, [campaignId, open]);

  const fetchCampaignDetails = async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const response = await api.get(`/admin/seasonal-credits/campaigns/${campaignId}`);
      if (response.data.success) {
        setDetails(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch campaign details:', error);
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const calculateUtilization = (used: number, total: number) => {
    return total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading campaign details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!details) {
    return null;
  }

  const { campaign, tenantBreakdown } = details;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {campaign.campaignName}
          </DialogTitle>
          <DialogDescription>
            Campaign ID: {campaign.campaignId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Campaign Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.totalCredits.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Distributed across {campaign.tenantCount} tenants
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.usedCredits.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  {calculateUtilization(campaign.usedCredits, campaign.totalCredits)}% utilization
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.availableCredits.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  {calculateUtilization(campaign.availableCredits, campaign.totalCredits)}% remaining
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expires</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const dateTime = formatDateTime(campaign.expiresAt);
                  return (
                    <>
                      <div className="text-lg font-bold">{dateTime.date}</div>
                      <div className="text-sm text-muted-foreground">{dateTime.time}</div>
                      <Badge className={getCreditTypeBadgeColor(campaign.creditType)}>
                        {campaign.creditType}
                      </Badge>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <Tabs defaultValue="tenants" className="space-y-4">
            <TabsList>
              <TabsTrigger value="tenants">Tenant Breakdown</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Credits by Tenant</CardTitle>
                  <CardDescription>
                    How credits are distributed and used across different tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Total Credits</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Utilization</TableHead>
                        <TableHead>Applications</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenantBreakdown.map((tenant) => (
                        <TableRow key={tenant.tenantId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tenant.tenantName}</p>
                              <p className="text-sm text-muted-foreground">{tenant.tenantId}</p>
                            </div>
                          </TableCell>
                          <TableCell>{tenant.totalCredits.toFixed(2)}</TableCell>
                          <TableCell>{tenant.usedCredits.toFixed(2)}</TableCell>
                          <TableCell>{tenant.availableCredits.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {calculateUtilization(tenant.usedCredits, tenant.totalCredits)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {tenant.applicationBreakdown?.map((app) => (
                                <Badge key={app} variant="outline" className="text-xs">
                                  {app}
                                </Badge>
                              )) || 'All apps'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const dateTime = formatDateTime(tenant.expiresAt);
                              return (
                                <div className="flex flex-col">
                                  <span>{dateTime.date}</span>
                                  <span className="text-xs text-muted-foreground">{dateTime.time}</span>
                                </div>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Utilization Overview</CardTitle>
                    <CardDescription>Credit usage patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Average per tenant</span>
                        <span className="font-medium">
                          {(campaign.totalCredits / campaign.tenantCount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Highest utilization</span>
                        <span className="font-medium">
                          {Math.max(...tenantBreakdown.map(t => calculateUtilization(t.usedCredits, t.totalCredits)))}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Lowest utilization</span>
                        <span className="font-medium">
                          {Math.min(...tenantBreakdown.map(t => calculateUtilization(t.usedCredits, t.totalCredits)))}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Tenants with usage</span>
                        <span className="font-medium">
                          {tenantBreakdown.filter(t => t.usedCredits > 0).length} / {campaign.tenantCount}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Time to Expiry</CardTitle>
                    <CardDescription>Campaign timeline</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Created</span>
                        <span className="font-medium">{formatDate(campaign.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Expires</span>
                        <div className="text-right">
                          {(() => {
                            const dateTime = formatDateTime(campaign.expiresAt);
                            return (
                              <>
                                <span className="font-medium">{dateTime.date}</span>
                                <span className="text-xs text-muted-foreground block">{dateTime.time}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Days remaining</span>
                        <span className="font-medium">
                          {Math.max(0, Math.ceil((new Date(campaign.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Campaign duration</span>
                        <span className="font-medium">
                          {Math.ceil((new Date(campaign.expiresAt).getTime() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Application Usage Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Application Usage</CardTitle>
                  <CardDescription>Credits distributed by application</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['crm', 'hr', 'affiliate', 'system'].map((app) => {
                      const appUsage = tenantBreakdown.filter(t =>
                        t.applicationBreakdown?.includes(app)
                      ).length;

                      return (
                        <div key={app} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{app}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-[#1B2E5A] h-2 rounded-full"
                                style={{ width: `${(appUsage / campaign.tenantCount) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium w-12 text-right">
                              {appUsage}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignDetailsModal;
