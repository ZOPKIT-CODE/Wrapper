import React, { useMemo } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { TenantCreditPanel } from '../components/seasonal-credits/TenantCreditPanel';
import {
  ArrowLeft,
  Users,
  CreditCard,
  Building2,
  Activity,
  Shield,
  Calendar,
  Clock,
  MapPin,
  GitBranch,
  Globe,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Download,
  Layers,
  UserCheck,
  UserX,
  UserPlus,
  Crown,
} from 'lucide-react';
import { Container } from '@/components/common/Page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader';
import { AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useActiveBatches, useExpiredHistory } from '../hooks/useSeasonalCredits';

interface TenantUser {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isTenantAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Subscription {
  plan: string;
  status: string;
  billingCycle: string;
  yearlyPrice: string;
  isTrialUser: boolean;
  hasEverUpgraded: boolean;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  createdAt: string;
}

interface ActivityLog {
  logId: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  resourceType: string;
  timestamp: string;
}

interface TenantDetailsData {
  tenant: Record<string, any>;
  users: TenantUser[];
  entitySummary: {
    total: number;
    organizations: number;
    locations: number;
    departments: number;
    teams: number;
    active: number;
  };
  creditSummary: {
    totalCredits: string;
    reservedCredits: string;
    activeEntities: number;
    averageCredits: string;
  };
  subscription: Subscription | null;
  pendingInvitations: number;
  activityStats: {
    uniqueActiveUsers24h: number;
    uniqueActiveUsers7d: number;
    uniqueActiveUsers30d: number;
  };
  recentActivity: ActivityLog[];
}

function formatRelativeTime(date: string | null): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysFromNow(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysSince(date: string | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function formatActionLabel(action: string): string {
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PLAN_PRICES: Record<string, { yearlyUsd: number; yearlyInr: number }> = {
  starter: { yearlyUsd: 120, yearlyInr: 9999 },
  professional: { yearlyUsd: 240, yearlyInr: 19999 },
  enterprise: { yearlyUsd: 360, yearlyInr: 29999 },
};

export function TenantDetailsPage() {
  const { tenantId } = useParams({ strict: false });
  const navigate = useNavigate();

  const { data: tenantData, isLoading } = useQuery<TenantDetailsData>({
    queryKey: ['admin', 'tenant', tenantId],
    queryFn: async () => {
      const response = await api.get(`/admin/tenants/${tenantId}/details`);
      return response.data.data;
    },
    enabled: !!tenantId,
  });

  const { data: activeBatchesData, isLoading: activeBatchesLoading } = useActiveBatches(
    tenantId ? { tenantId, limit: 100 } : undefined
  );
  const { data: expiredBatchesData, isLoading: expiredBatchesLoading } = useExpiredHistory(
    tenantId ? { tenantId, limit: 100 } : undefined
  );

  const activeBatches = activeBatchesData?.batches ?? [];
  const expiredBatches = expiredBatchesData?.batches ?? [];
  const allKnownBatches = [...activeBatches, ...expiredBatches];

  const allocationSummaryByApp = useMemo(() => {
    const aggregate = new Map<string, {
      count: number;
      allocated: number;
      used: number;
      remaining: number;
      expiredCount: number;
      expiring7dCount: number;
    }>();
    const now = Date.now();
    const next7Days = now + 7 * 24 * 60 * 60 * 1000;

    for (const batch of allKnownBatches) {
      const app = batch.targetApplication || 'Org pool';
      const bucket = aggregate.get(app) ?? {
        count: 0,
        allocated: 0,
        used: 0,
        remaining: 0,
        expiredCount: 0,
        expiring7dCount: 0,
      };

      const allocated = Number(batch.totalCredits ?? 0);
      const used = Number(batch.usedCredits ?? 0);
      const remaining = Number(batch.remainingCredits ?? 0);
      const expiryTs = batch.expiresAt ? new Date(batch.expiresAt).getTime() : null;

      bucket.count += 1;
      bucket.allocated += allocated;
      bucket.used += used;
      bucket.remaining += remaining;
      if (batch.isExpired || (expiryTs !== null && expiryTs <= now)) bucket.expiredCount += 1;
      if (expiryTs !== null && expiryTs > now && expiryTs <= next7Days) bucket.expiring7dCount += 1;

      aggregate.set(app, bucket);
    }

    return Array.from(aggregate.entries())
      .map(([application, values]) => ({ application, ...values }))
      .sort((a, b) => b.allocated - a.allocated);
  }, [allKnownBatches]);

  if (isLoading) {
    return (
      <Container className="dashboard-actionable-cursors">
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    );
  }

  if (!tenantData) {
    return (
      <Container className="dashboard-actionable-cursors">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Tenant Not Found</h2>
          <p className="text-gray-600">The tenant you're looking for doesn't exist.</p>
          <Button onClick={() => navigate({ to: '/company-admin' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </Container>
    );
  }

  const { tenant, users, entitySummary, creditSummary, subscription, pendingInvitations, activityStats, recentActivity } = tenantData;

  // Computed user metrics
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const adminCount = users.filter((u) => u.isTenantAdmin).length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentLogins = users.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > sevenDaysAgo).length;
  const mostRecentLogin = users
    .filter((u) => u.lastLoginAt)
    .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())[0]?.lastLoginAt ?? null;

  // Computed credit metrics
  const totalCredits = Number(creditSummary.totalCredits) || 0;
  const reservedCredits = Number(creditSummary.reservedCredits) || 0;
  const availableCredits = totalCredits - reservedCredits;
  const avgCredits = Number(creditSummary.averageCredits) || 0;
  const creditUtilization = totalCredits > 0 ? ((reservedCredits / totalCredits) * 100) : 0;

  // Account health
  const accountAgeDays = daysSince(tenant.createdAt);
  const isOnboarded = Boolean(tenant.onboardedAt);
  const isActive = Boolean(tenant.isActive);
  const isVerified = Boolean(tenant.isVerified);

  // Subscription info
  const planName = subscription?.plan || 'Free';
  const planStatus = subscription?.status || 'none';
  const billingCycle = subscription?.billingCycle || 'N/A';
  const planPrices = PLAN_PRICES[planName.toLowerCase()];
  const currentPrice = planPrices
    ? `$${planPrices.yearlyUsd}/yr USD · ₹${planPrices.yearlyInr.toLocaleString('en-IN')}/yr INR`
    : 'Free';
  const periodEnd = subscription?.currentPeriodEnd;
  const renewalDays = daysFromNow(periodEnd ?? null);

  // Status helpers
  const getStatusBadge = () => {
    if (!isActive) return <Badge className="bg-red-100 text-red-800 border-0">Inactive</Badge>;
    if (subscription?.isTrialUser) return <Badge className="bg-amber-100 text-amber-800 border-0">Trial</Badge>;
    if (planStatus === 'active') return <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>;
    if (planStatus === 'past_due') return <Badge className="bg-orange-100 text-orange-800 border-0">Past Due</Badge>;
    if (planStatus === 'canceled') return <Badge className="bg-gray-100 text-gray-800 border-0">Canceled</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 border-0">Free</Badge>;
  };

  const getPlanBadge = () => {
    const colors: Record<string, string> = {
      starter: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-indigo-100 text-indigo-800',
      free: 'bg-gray-100 text-gray-800',
    };
    const cls = colors[planName.toLowerCase()] || colors.free;
    return <Badge className={`${cls} border-0 capitalize`}>{planName}</Badge>;
  };

  const handleExport = async () => {
    try {
      const response = await api.get(`/admin/tenants/${tenantId}/export`, { responseType: 'blob' });
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenant-${tenantId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  return (
    <Container className="dashboard-actionable-cursors">
      <div className="space-y-6 pb-8">
        {/* ── Section 1: Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl bg-gradient-to-br from-primary-hover via-primary to-[#0f1f40] p-5 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/company-admin' })}
            className="gap-2 shrink-0 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {tenant.companyName}
              </h1>
              {getStatusBadge()}
              {tenant.industry && (
                <Badge variant="outline" className="text-xs font-normal border-white/30 text-white">
                  {tenant.industry}
                </Badge>
              )}
              {tenant.organizationSize && (
                <Badge variant="outline" className="text-xs font-normal border-white/30 text-white">
                  {tenant.organizationSize}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-blue-100/80">
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                {tenant.subdomain}
              </span>
              {tenant.adminEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {tenant.adminEmail}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {/* ── Section 2: KPI Summary Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard
            icon={<Users className="h-4 w-4 text-blue-600" />}
            label="Users"
            value={`${activeUsers} / ${totalUsers}`}
            sub="Active"
          />
          <KpiCard
            icon={<CreditCard className="h-4 w-4 text-purple-600" />}
            label="Plan"
            value={planName}
            sub={currentPrice}
            badge={getPlanBadge()}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            label="Credits"
            value={availableCredits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            sub="Available"
          />
          <KpiCard
            icon={<Building2 className="h-4 w-4 text-orange-600" />}
            label="Entities"
            value={String(entitySummary.total)}
            sub={`${entitySummary.organizations} orgs`}
          />
          <KpiCard
            icon={<Activity className="h-4 w-4 text-rose-600" />}
            label="Account Age"
            value={`${accountAgeDays}d`}
            sub={isOnboarded ? 'Onboarded' : 'Not onboarded'}
          />
        </div>

        {/* ── Main Content Grid (2 columns) ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Section 3: Subscription & Billing ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                Subscription & Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Plan" value={<span className="capitalize font-medium">{planName}</span>} />
              <InfoRow label="Status" value={
                <Badge className={`border-0 text-xs ${
                  planStatus === 'active' ? 'bg-green-100 text-green-800' :
                  planStatus === 'past_due' ? 'bg-orange-100 text-orange-800' :
                  planStatus === 'canceled' ? 'bg-red-100 text-red-800' :
                  planStatus === 'trialing' ? 'bg-amber-100 text-amber-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {planStatus === 'none' ? 'Free Tier' : planStatus}
                </Badge>
              } />
              <InfoRow label="Billing Cycle" value={<span className="capitalize">{billingCycle}</span>} />
              <InfoRow label="Price" value={currentPrice} />
              {periodEnd && (
                <InfoRow label="Renewal" value={
                  <span className="flex items-center gap-1">
                    {formatDate(periodEnd)}
                    {renewalDays !== null && renewalDays > 0 && (
                      <span className="text-xs text-muted-foreground">({renewalDays}d)</span>
                    )}
                  </span>
                } />
              )}
              {subscription?.isTrialUser && (
                <InfoRow label="Trial" value={
                  <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Trial User</Badge>
                } />
              )}
              {subscription?.hasEverUpgraded && (
                <InfoRow label="Upgraded" value={
                  <span className="flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                  </span>
                } />
              )}
              {subscription?.stripeCustomerId && (
                <InfoRow label="Stripe ID" value={
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {subscription.stripeCustomerId}
                  </code>
                } />
              )}
              {!subscription && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No active subscription
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 4: User Engagement ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                User Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat icon={<UserCheck className="h-4 w-4 text-green-600" />} value={activeUsers} label="Active" />
                <MiniStat icon={<UserX className="h-4 w-4 text-red-500" />} value={inactiveUsers} label="Inactive" />
                <MiniStat icon={<Crown className="h-4 w-4 text-amber-500" />} value={adminCount} label="Admins" />
              </div>

              {totalUsers > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Active users</span>
                    <span>{Math.round((activeUsers / totalUsers) * 100)}%</span>
                  </div>
                  <Progress value={(activeUsers / totalUsers) * 100} className="h-2" />
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <InfoRow label="Logins (7d)" value={
                  <span className="font-medium">{recentLogins} users</span>
                } />
                <InfoRow label="Last Login" value={formatRelativeTime(mostRecentLogin)} />
                <InfoRow label="Pending Invites" value={
                  pendingInvitations > 0
                    ? <span className="flex items-center gap-1"><UserPlus className="h-3.5 w-3.5 text-blue-500" />{pendingInvitations}</span>
                    : '0'
                } />
                <InfoRow label="Active (24h)" value={`${activityStats.uniqueActiveUsers24h} users`} />
                <InfoRow label="Active (7d)" value={`${activityStats.uniqueActiveUsers7d} users`} />
                <InfoRow label="Active (30d)" value={`${activityStats.uniqueActiveUsers30d} users`} />
              </div>
            </CardContent>
          </Card>

          {/* ── Section 4b: Credit Batch Management ── */}
          {tenantId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  Credit Batches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TenantCreditPanel
                  tenantId={tenantId}
                  tenantName={tenantData?.tenant?.companyName}
                />
              </CardContent>
            </Card>
          )}

          {/* ── Section 5: Credit Analytics ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Credit Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {availableCredits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-emerald-600">Available</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">
                    {totalCredits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>

              {totalCredits > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Utilization (reserved)</span>
                    <span>{creditUtilization.toFixed(1)}%</span>
                  </div>
                  <Progress value={creditUtilization} className="h-2" />
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <InfoRow label="Reserved" value={reservedCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
                <InfoRow label="Active Entities" value={String(creditSummary.activeEntities)} />
                <InfoRow label="Avg per Entity" value={avgCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
              </div>
            </CardContent>
          </Card>

          {/* ── Section 5b: Application Allocations ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                Application Allocations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MiniStat icon={<Layers className="h-4 w-4 text-indigo-600" />} value={allKnownBatches.length} label="Allocations" />
                <MiniStat
                  icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
                  value={Math.round(allocationSummaryByApp.reduce((sum, row) => sum + row.allocated, 0))}
                  label="Allocated"
                />
                <MiniStat
                  icon={<Clock className="h-4 w-4 text-amber-600" />}
                  value={allocationSummaryByApp.reduce((sum, row) => sum + row.expiring7dCount, 0)}
                  label="Expiring 7d"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-md border p-2">
                  <div className="text-muted-foreground">Total Used</div>
                  <div className="font-semibold">
                    {allocationSummaryByApp.reduce((sum, row) => sum + row.used, 0).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-muted-foreground">Total Remaining</div>
                  <div className="font-semibold">
                    {allocationSummaryByApp.reduce((sum, row) => sum + row.remaining, 0).toFixed(2)}
                  </div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-muted-foreground">Expired Batches</div>
                  <div className="font-semibold">
                    {allocationSummaryByApp.reduce((sum, row) => sum + row.expiredCount, 0)}
                  </div>
                </div>
              </div>

              {allocationSummaryByApp.length > 0 ? (
                <div className="space-y-2">
                  {allocationSummaryByApp.slice(0, 8).map((row) => (
                    <div key={row.application} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span className="font-medium capitalize">{row.application}</span>
                      <span className="text-muted-foreground">
                        {row.remaining.toFixed(2)} remaining / {row.used.toFixed(2)} used / {row.allocated.toFixed(2)} allocated ({row.count})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No application allocations found for this tenant yet.
                </div>
              )}

              {(activeBatchesLoading || expiredBatchesLoading) && (
                <div className="text-xs text-muted-foreground">Loading detailed allocation rows...</div>
              )}

              {activeBatches.length > 0 && (
                <div className="rounded-md border">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Active Allocation Batches</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Allocated</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeBatches.slice(0, 12).map((batch) => (
                        <TableRow key={batch.allocationId}>
                          <TableCell className="capitalize">{batch.targetApplication || 'Org pool'}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{batch.creditType}</Badge></TableCell>
                          <TableCell>{Number(batch.totalCredits || 0).toFixed(2)}</TableCell>
                          <TableCell>{Number(batch.usedCredits || 0).toFixed(2)}</TableCell>
                          <TableCell>{Number(batch.remainingCredits || 0).toFixed(2)}</TableCell>
                          <TableCell>{formatDate(batch.expiresAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {expiredBatches.length > 0 && (
                <div className="rounded-md border">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b">Recently Expired Batches</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Allocated</TableHead>
                        <TableHead>Used Before Expiry</TableHead>
                        <TableHead>Unused Expired</TableHead>
                        <TableHead>Expired On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiredBatches.slice(0, 10).map((batch) => {
                        const allocated = Number(batch.totalCredits || 0);
                        const used = Number(batch.usedCredits || 0);
                        const expiredUnused = Math.max(0, allocated - used);
                        return (
                          <TableRow key={batch.allocationId}>
                            <TableCell className="capitalize">{batch.targetApplication || 'Org pool'}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{batch.creditType}</Badge></TableCell>
                            <TableCell>{allocated.toFixed(2)}</TableCell>
                            <TableCell>{used.toFixed(2)}</TableCell>
                            <TableCell className="text-red-600">{expiredUnused.toFixed(2)}</TableCell>
                            <TableCell>{formatDate(batch.expiresAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 6: Organization Structure ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-orange-600" />
                Organization Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <EntityStat icon={<Building2 className="h-4 w-4 text-blue-600" />} count={entitySummary.organizations} label="Organizations" />
                <EntityStat icon={<MapPin className="h-4 w-4 text-green-600" />} count={entitySummary.locations} label="Locations" />
                <EntityStat icon={<Layers className="h-4 w-4 text-purple-600" />} count={entitySummary.departments} label="Departments" />
                <EntityStat icon={<Shield className="h-4 w-4 text-orange-600" />} count={entitySummary.teams} label="Teams" />
              </div>

              {entitySummary.total > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Active entities</span>
                    <span>{entitySummary.active} / {entitySummary.total}</span>
                  </div>
                  <Progress value={(entitySummary.active / entitySummary.total) * 100} className="h-2" />
                </div>
              )}

              {entitySummary.total === 0 && (
                <div className="text-center py-3 text-sm text-muted-foreground">
                  No entities created yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 7: Recent Activity ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-rose-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((event) => (
                    <div key={event.logId} className="flex items-start gap-3 text-sm">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {formatActionLabel(event.action)}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{event.userName || event.userEmail || 'System'}</span>
                          <span>&middot;</span>
                          <span>{formatRelativeTime(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No recent activity
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 8: Company Profile ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-600" />
                Company Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact</div>
                <div className="space-y-2">
                  <InfoRow label="Admin Email" value={tenant.adminEmail || 'N/A'} />
                  {tenant.billingEmail && <InfoRow label="Billing Email" value={tenant.billingEmail} />}
                  {tenant.supportEmail && <InfoRow label="Support Email" value={tenant.supportEmail} />}
                  {tenant.phone && (
                    <InfoRow label="Phone" value={
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{tenant.phone}</span>
                    } />
                  )}
                </div>
              </div>

              {/* Address */}
              {(tenant.billingCity || tenant.billingCountry || tenant.mailingCity) && (
                <div className="border-t pt-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Address</div>
                  <div className="text-sm text-muted-foreground">
                    {[
                      tenant.billingStreet || tenant.mailingStreet,
                      tenant.billingCity || tenant.mailingCity,
                      tenant.billingState || tenant.mailingState,
                      tenant.billingZip || tenant.mailingZip,
                      tenant.billingCountry || tenant.mailingCountry,
                    ].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}

              {/* Localization */}
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Localization</div>
                <div className="space-y-2">
                  {tenant.defaultTimeZone && <InfoRow label="Timezone" value={tenant.defaultTimeZone} />}
                  {tenant.defaultCurrency && <InfoRow label="Currency" value={tenant.defaultCurrency} />}
                  {tenant.defaultLocale && <InfoRow label="Locale" value={tenant.defaultLocale} />}
                </div>
              </div>

              {/* Onboarding */}
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account</div>
                <div className="space-y-2">
                  <InfoRow label="Created" value={
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(tenant.createdAt)}
                    </span>
                  } />
                  <InfoRow label="Onboarded" value={
                    isOnboarded
                      ? <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />{formatDate(tenant.onboardedAt)}</span>
                      : <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Not yet</span>
                  } />
                  <InfoRow label="Verified" value={
                    isVerified
                      ? <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3.5 w-3.5" />Yes</span>
                      : <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3.5 w-3.5" />No</span>
                  } />
                  {tenant.lastActivityAt && (
                    <InfoRow label="Last Active" value={
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatRelativeTime(tenant.lastActivityAt)}
                      </span>
                    } />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}

/* ── Reusable Sub-components ── */

function KpiCard({ icon, label, value, sub, badge }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-md bg-muted/60">{icon}</div>
          {badge}
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        <div className="text-[11px] text-muted-foreground/60 mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}

function MiniStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-2.5">
      {icon}
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function EntityStat({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
      {icon}
      <div>
        <div className="text-lg font-bold leading-none">{count}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
