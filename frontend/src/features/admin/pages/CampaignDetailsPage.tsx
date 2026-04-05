import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Calendar, Users, DollarSign, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

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

export function CampaignDetailsPage() {
  const { campaignId } = useParams({ strict: false });
  const navigate = useNavigate();

  // Fetch campaign details
  const { data: details, isLoading } = useQuery<CampaignDetails>({
    queryKey: ['admin', 'campaign', campaignId],
    queryFn: async () => {
      const response = await api.get(`/admin/seasonal-credits/campaigns/${campaignId}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch campaign details');
    },
    enabled: !!campaignId
  });

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

  if (isLoading) {
    return (
      <Container className="dashboard-actionable-cursors">
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (!details) {
    return (
      <Container className="dashboard-actionable-cursors">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Campaign Not Found</h2>
          <p className="text-gray-600">The campaign you're looking for doesn't exist.</p>
          <Button onClick={() => navigate({ to: '/company-admin' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </Container>
    );
  }

  const { campaign, tenantBreakdown } = details;

  return (
    <Container className="dashboard-actionable-cursors">
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/company-admin' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{campaign.campaignName}</h1>
            <Badge className={getCreditTypeBadgeColor(campaign.creditType)}>
              {campaign.creditType}
            </Badge>
          </div>
        </div>

        {/* Campaign Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Credits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.totalCredits.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Used Credits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{campaign.usedCredits.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Credits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{campaign.availableCredits.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.tenantCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Breakdown</CardTitle>
            <CardDescription>Credit distribution across tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Total Credits</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantBreakdown.map((tenant) => (
                  <TableRow key={tenant.tenantId}>
                    <TableCell className="font-medium">{tenant.tenantName}</TableCell>
                    <TableCell>{tenant.totalCredits.toLocaleString()}</TableCell>
                    <TableCell className="text-orange-600">{tenant.usedCredits.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">{tenant.availableCredits.toLocaleString()}</TableCell>
                    <TableCell>{formatDate(tenant.expiresAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
