import React from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Alert, AlertDescription } from '@/components/ui';

interface SyncResult {
  success: boolean;
  userCount: number;
  error?: string;
  warning?: string;
  syncedAt: string;
  applicationUrl?: string;
  statusCode?: number;
  response?: any;
}

interface SyncResultsTabProps {
  syncResults: { [key: string]: SyncResult };
  hasData: boolean;
}

export function SyncResultsTab({ syncResults, hasData }: SyncResultsTabProps) {
  if (!hasData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-muted-foreground">No data available. Load user data first to see sync results.</p>
        </CardContent>
      </Card>
    );
  }

  if (Object.keys(syncResults).length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No sync results yet. Start a sync operation to see results here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(syncResults).map(([appCode, result]) => (
        <Card key={appCode}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {appCode.toUpperCase()} Sync Result
                </CardTitle>
                <CardDescription>
                  {result.syncedAt ? new Date(result.syncedAt).toLocaleString() : 'No timestamp'} • {result.userCount || 0} users
                </CardDescription>
              </div>
              
              <Badge variant={result.success ? 'default' : 'destructive'}>
                {result.success ? 'Success' : 'Failed'}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {result.error && (
                <Alert variant="destructive">
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
              
              {result.warning && (
                <Alert variant="default">
                  <AlertDescription>{result.warning}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    {result.success ? 'Success' : 'Failed'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Users:</span>
                  <span className="ml-2">{result.userCount || 0}</span>
                </div>
                <div>
                  <span className="font-medium">Synced At:</span>
                  <span className="ml-2">{result.syncedAt ? new Date(result.syncedAt).toLocaleString() : 'N/A'}</span>
                </div>
                {result.applicationUrl && (
                  <div>
                    <span className="font-medium">App URL:</span>
                    <span className="ml-2 text-[#1B2E5A]">{result.applicationUrl}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
