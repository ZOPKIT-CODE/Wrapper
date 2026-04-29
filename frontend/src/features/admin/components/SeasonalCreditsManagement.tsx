import React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, LayoutList, History, Activity, Coins, Plus } from 'lucide-react';
import { useCampaigns, useExpiringSoon } from '../hooks/useSeasonalCredits';
import { CampaignListTable } from './seasonal-credits/CampaignListTable';
import { CreditBatchMonitor } from './seasonal-credits/CreditBatchMonitor';
import { ExpiryTimelineChart } from './seasonal-credits/ExpiryTimelineChart';
import { CronStatusPanel } from './seasonal-credits/CronStatusPanel';

const SeasonalCreditsManagement: React.FC = () => {
  const { data: campaigns } = useCampaigns();
  const { data: expiringSoon } = useExpiringSoon(7);

  const criticalCount = expiringSoon?.filter((c) => c.daysUntilExpiry <= 1).length ?? 0;
  const activeCampaigns = campaigns?.filter((c) => c.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Seasonal Credits</h2>
          <p className="text-muted-foreground text-sm">
            Campaigns, batch monitoring, expiry timeline, and cron health
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/company-admin/seasonal-credits/new">
            <Plus className="w-4 h-4 mr-1" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Gift className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Active Campaigns</p>
              <p className="font-semibold">{activeCampaigns}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Coins className="w-5 h-5 text-yellow-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Expiring ≤7d</p>
              <p className="font-semibold">{expiringSoon?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Activity className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Critical (≤24h)</p>
              <p className="font-semibold">
                {criticalCount > 0 ? (
                  <Badge className="bg-red-100 text-red-800 border-0">{criticalCount}</Badge>
                ) : (
                  <span>0</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <LayoutList className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Total Campaigns</p>
              <p className="font-semibold">{campaigns?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="active-batches">Active Batches</TabsTrigger>
          <TabsTrigger value="expired">Expired History</TabsTrigger>
          <TabsTrigger value="timeline">Expiry Timeline</TabsTrigger>
          <TabsTrigger value="cron">Cron Status</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All Campaigns</CardTitle>
              <CardDescription>View, distribute, cancel, or rerun failed distributions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <CampaignListTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-batches" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Active Credit Batches</CardTitle>
              <CardDescription>
                Live view of all non-expired credit batches across tenants. Select multiple to force-expire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditBatchMonitor mode="active" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Expired Batch History</CardTitle>
              <CardDescription>Audit log of all expired credit batches.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreditBatchMonitor mode="expired" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" /> Credits Expiring (Next 30 Days)
              </CardTitle>
              <CardDescription>Bar chart grouped by urgency window.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExpiryTimelineChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" /> Expiry Cron Health
              </CardTitle>
              <CardDescription>
                Last 20 cron runs — success rate, duration, and manual trigger.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CronStatusPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SeasonalCreditsManagement;
