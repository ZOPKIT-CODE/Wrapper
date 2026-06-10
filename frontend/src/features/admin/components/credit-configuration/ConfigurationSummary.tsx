import React from 'react'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, Plus, Copy } from 'lucide-react'

interface ConfigurationSummaryProps {
  totalOperations: number
  activeTenants: number
  totalApplications: number
  onCreateOperation: () => void
  onOpenTemplates: () => void
  mode: 'global' | 'tenant'
  selectedTenant?: {
    companyName: string
    assignmentCount: number
  } | null
}

export const ConfigurationSummary: React.FC<ConfigurationSummaryProps> = ({
  totalOperations,
  activeTenants,
  totalApplications,
  onCreateOperation,
  onOpenTemplates,
  mode,
  selectedTenant,
}) => {
  return (
    <Card className="border-l-primary border-l-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calculator className="h-6 w-6" />
              Credit Configuration Management
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              {mode === 'global'
                ? 'Manage global defaults and tenant-specific overrides for credit costs'
                : `Configure credit costs for ${selectedTenant?.companyName || 'selected tenant'}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-muted-foreground text-sm">
                {mode === 'global' ? 'Global Operations' : 'Tenant Apps'}
              </div>
              <div className="text-primary text-lg font-semibold">
                {mode === 'global'
                  ? totalOperations
                  : selectedTenant?.assignmentCount || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-sm">
                {mode === 'global' ? 'Active Tenants' : 'Total Apps'}
              </div>
              <div className="text-lg font-semibold text-blue-600">
                {mode === 'global' ? activeTenants : totalApplications}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={onOpenTemplates} variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Templates
              </Button>
              <Button onClick={onCreateOperation} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {mode === 'global'
                  ? 'Add Global Operation'
                  : 'Add Tenant Operation'}
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-muted/30 mt-4 flex items-center gap-6 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary h-3 w-3 rounded"></div>
            <span className="text-sm">Global Default</span>
          </div>
          {mode === 'tenant' && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-green-500"></div>
                <span className="text-sm">Tenant Override</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-orange-500"></div>
                <span className="text-sm">Inherits Global</span>
              </div>
            </>
          )}
        </div>
      </CardHeader>
    </Card>
  )
}
