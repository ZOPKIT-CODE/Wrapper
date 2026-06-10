import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Plus, Copy } from 'lucide-react';

interface ConfigurationSummaryProps {
  totalOperations: number;
  activeTenants: number;
  totalApplications: number;
  onCreateOperation: () => void;
  onOpenTemplates: () => void;
  mode: 'global' | 'tenant';
  selectedTenant?: {
    companyName: string;
    assignmentCount: number;
  } | null;
}

export const ConfigurationSummary: React.FC<ConfigurationSummaryProps> = ({
  totalOperations,
  activeTenants,
  totalApplications,
  onCreateOperation,
  onOpenTemplates,
  mode,
  selectedTenant
}) => {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Credit Configuration Management
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {mode === 'global'
                ? 'Manage global defaults and tenant-specific overrides for credit costs'
                : `Configure credit costs for ${selectedTenant?.companyName || 'selected tenant'}`
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                {mode === 'global' ? 'Global Operations' : 'Tenant Apps'}
              </div>
              <div className="text-lg font-semibold text-primary">
                {mode === 'global' ? totalOperations : selectedTenant?.assignmentCount || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">
                {mode === 'global' ? 'Active Tenants' : 'Total Apps'}
              </div>
              <div className="text-lg font-semibold text-blue-600">
                {mode === 'global' ? activeTenants : totalApplications}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={onOpenTemplates} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Templates
              </Button>
              <Button onClick={onCreateOperation} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {mode === 'global' ? 'Add Global Operation' : 'Add Tenant Operation'}
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded"></div>
            <span className="text-sm">Global Default</span>
          </div>
          {mode === 'tenant' && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm">Tenant Override</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-sm">Inherits Global</span>
              </div>
            </>
          )}
        </div>
      </CardHeader>
    </Card>
  );
};
