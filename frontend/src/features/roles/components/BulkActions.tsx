import React from 'react';
import { Download, Archive, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BulkAction } from '@/types/role-management';

interface BulkActionsProps {
  selectedCount: number;
  totalCount: number;
  onBulkAction: (action: BulkAction, selectedIds: string[]) => void;
  onClearSelection: () => void;
  selectedRoleIds: string[];
  isLoading?: boolean;
}

export function BulkActions({
  selectedCount,
  totalCount,
  onBulkAction,
  onClearSelection,
  selectedRoleIds,
  isLoading = false,
}: BulkActionsProps) {
  if (selectedCount === 0) {
    return null;
  }

  const handleAction = (action: BulkAction) => {
    onBulkAction(action, selectedRoleIds);
  };

  return (
    <Card className="border-[#1B2E5A]/20 bg-[#1B2E5A]/5">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-[#1B2E5A]">
              {selectedCount} role{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <span className="text-sm text-[#1B2E5A]/70">
              from {totalCount} total roles
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('export')}
              disabled={isLoading}
              className="border-[#1B2E5A]/30 text-[#1B2E5A] hover:bg-[#1B2E5A]/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Selected
            </Button>
            
            <Button
              variant="outline" 
              size="sm"
              onClick={() => handleAction('deactivate')}
              disabled={isLoading}
            >
              <Archive className="w-4 h-4 mr-2" />
              Deactivate
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleAction('delete')}
              disabled={isLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
