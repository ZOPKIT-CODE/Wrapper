import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Send, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ExpiryManagementPanelProps {
  onRefresh: () => void;
}

const ExpiryManagementPanel: React.FC<ExpiryManagementPanelProps> = ({ onRefresh }) => {
  const [sendingWarnings, setSendingWarnings] = useState(false);
  const [extendCampaign, setExtendCampaign] = useState({
    campaignId: '',
    additionalDays: '30'
  });

  const handleSendExpiryWarnings = async (daysAhead: number) => {
    setSendingWarnings(true);
    try {
      const response = await api.post('/admin/seasonal-credits/warnings', {
        daysAhead
      });

      if (response.data.success) {
        toast.success(`Sent expiry warnings to ${response.data.data.emailsSent} tenants`);
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to send expiry warnings:', error);
      toast.error('Failed to send expiry warnings');
    } finally {
      setSendingWarnings(false);
    }
  };

  const handleExtendCampaignExpiry = async () => {
    if (!extendCampaign.campaignId || !extendCampaign.additionalDays) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const response = await api.put(`/admin/seasonal-credits/campaigns/${extendCampaign.campaignId}/extend`, {
        additionalDays: parseInt(extendCampaign.additionalDays)
      });

      if (response.data.success) {
        toast.success(`Extended campaign expiry by ${extendCampaign.additionalDays} days`);
        setExtendCampaign({ campaignId: '', additionalDays: '30' });
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to extend campaign expiry:', error);
      toast.error('Failed to extend campaign expiry');
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Use these tools to manually manage credit expiry warnings and extensions.
          Automated processes run daily, but you can trigger them manually here.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Manual Warning Triggers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Expiry Warnings
            </CardTitle>
            <CardDescription>
              Manually trigger expiry warning emails to tenants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Button
                onClick={() => handleSendExpiryWarnings(1)}
                disabled={sendingWarnings}
                variant="outline"
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Critical (1 day)
                <Badge className="ml-auto bg-red-100 text-red-800">Urgent</Badge>
              </Button>

              <Button
                onClick={() => handleSendExpiryWarnings(3)}
                disabled={sendingWarnings}
                variant="outline"
                className="w-full"
              >
                <Clock className="h-4 w-4 mr-2" />
                Soon (3 days)
                <Badge className="ml-auto bg-orange-100 text-orange-800">Warning</Badge>
              </Button>

              <Button
                onClick={() => handleSendExpiryWarnings(7)}
                disabled={sendingWarnings}
                variant="outline"
                className="w-full"
              >
                <Clock className="h-4 w-4 mr-2" />
                Upcoming (7 days)
                <Badge className="ml-auto bg-yellow-100 text-yellow-800">Notice</Badge>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              These warnings are automatically sent daily, but you can trigger them manually if needed.
            </p>
          </CardContent>
        </Card>

        {/* Campaign Extension */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Extend Campaign Expiry
            </CardTitle>
            <CardDescription>
              Extend the expiry date for a specific campaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaignId">Campaign ID</Label>
              <Input
                id="campaignId"
                placeholder="e.g., holiday-2024-q4"
                value={extendCampaign.campaignId}
                onChange={(e) => setExtendCampaign(prev => ({
                  ...prev,
                  campaignId: e.target.value
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalDays">Additional Days</Label>
              <Select
                value={extendCampaign.additionalDays}
                onValueChange={(value) => setExtendCampaign(prev => ({
                  ...prev,
                  additionalDays: value
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExtendCampaignExpiry}
              disabled={!extendCampaign.campaignId}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Extend Campaign
            </Button>

            <p className="text-xs text-muted-foreground">
              This will extend the expiry date for all allocations in the specified campaign.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Expiry Management Stats</CardTitle>
          <CardDescription>Current expiry warning status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">⚠️</div>
              <p className="text-sm font-medium">Critical (1 day)</p>
              <p className="text-xs text-muted-foreground">Daily automated</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">🔔</div>
              <p className="text-sm font-medium">Warning (3 days)</p>
              <p className="text-xs text-muted-foreground">Daily automated</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">📧</div>
              <p className="text-sm font-medium">Notice (7 days)</p>
              <p className="text-xs text-muted-foreground">Daily automated</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpiryManagementPanel;
